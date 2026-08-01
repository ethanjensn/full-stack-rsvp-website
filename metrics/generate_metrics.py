"""Orchestrator for the metrics report.

Collects static stats (always available) and live stats (Lighthouse + API
benchmark, when the app can boot locally), fills the markdown template, and
writes PROJECT_METRICS.md to the project root.

Usage: python -m metrics [--live]

Static metrics (file analysis only - no network, no database) always run.
Live metrics (local server + Lighthouse + API benchmark) only run with the
--live flag. The live server runs locally on 127.0.0.1:5055 and never touches
any deployed/hosted environment: with DATABASE_URL set it uses that database,
otherwise it boots with an in-memory database mock.
"""

import os
import subprocess
import sys
import time
import urllib.request
from datetime import date
from pathlib import Path

from . import api_benchmark, count_stats, lighthouse

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_PATH = Path(__file__).resolve().parent / "project_metrics_template.md"
OUTPUT_PATH = ROOT / "PROJECT_METRICS.md"

SERVER_PORT = 5055
BASE_URL = f"http://127.0.0.1:{SERVER_PORT}"
SERVER_START_TIMEOUT = 15  # seconds


def todo(hint):
    return f"_TODO: {hint}_"


def fmt_size(num_bytes):
    if num_bytes >= 1024 * 1024:
        return f"{num_bytes / (1024 * 1024):.1f} MB"
    return f"{num_bytes / 1024:.1f} KB"


def start_server():
    """Boot the Flask app locally on a dedicated port.

    With DATABASE_URL set, boots the real app. Without it, boots the app with
    an in-memory database mock (metrics._mock_server) so live metrics still
    run fully locally without touching any hosted database.

    Returns (subprocess handle, mode) where mode is "real" or "mock",
    or (None, None) if the app failed to start.
    """
    if os.environ.get("DATABASE_URL"):
        cmd = [
            sys.executable, "-m", "flask", "--app", "app", "run",
            "--port", str(SERVER_PORT), "--no-reload",
        ]
        mode = "real"
    else:
        cmd = [sys.executable, "-m", "metrics._mock_server", str(SERVER_PORT)]
        mode = "mock"
    proc = subprocess.Popen(
        cmd,
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env=os.environ.copy(),
    )
    deadline = time.time() + SERVER_START_TIMEOUT
    while time.time() < deadline:
        if proc.poll() is not None:
            return None, None  # process died
        try:
            with urllib.request.urlopen(BASE_URL + "/", timeout=2):
                return proc, mode
        except OSError:
            time.sleep(0.5)
    proc.terminate()
    return None, None


def build_tokens(static, live):
    code = static["code"]
    backend = static["backend"]
    frontend = static["frontend"]
    database = static["database"]
    security = static["security"]
    testing = static["testing"]
    lh = live["lighthouse"]
    bench = live["benchmark"]
    server_up = live["server_up"]

    tokens = {"date": date.today().isoformat()}

    # --- Performance ---
    for key, value in lh.items():
        if value is not None:
            tokens[key] = str(value)
        elif not server_up:
            tokens[key] = todo("regenerate with `python -m metrics --live` to audit the local server (in-memory mock DB; no hosted services contacted)")
        else:
            tokens[key] = todo(lighthouse.INSTALL_HINT)

    # --- Frontend ---
    tokens["page_count"] = str(frontend["page_count"])
    tokens["static_asset_count"] = str(frontend["static_asset_count"])
    tokens["static_asset_size"] = fmt_size(frontend["static_asset_size"])
    tokens["react_components"] = todo("not applicable - no React; would need a JS frontend framework")
    tokens["custom_hooks"] = todo("not applicable - no React; would need a JS frontend framework")
    tokens["contexts"] = todo("not applicable - no React; would need a JS frontend framework")
    tokens["bundle_size"] = todo("no bundler in this stack; would need a build tool (Webpack/Vite)")
    tokens["first_load_js"] = todo("not applicable - Next.js-specific; would need Next.js build output")

    # --- Backend ---
    tokens["endpoint_count"] = str(backend["endpoint_count"])
    tokens["middleware_count"] = str(backend["middleware_count"])
    tokens["controllers"] = todo("no controller layer; route handlers live in app.py")
    tokens["services"] = todo("no service layer; db/email helpers live in app.py")
    tokens["pydantic_model_count"] = str(len(backend["pydantic_models"]))
    tokens["utility_module_count"] = str(len(backend["utility_modules"]))
    rows = ["| Path | Methods | Notes |", "| --- | --- | --- |"]
    for ep in backend["endpoints"]:
        note = "dynamic secret admin path" if ep["dynamic"] else ""
        rows.append(f"| `{ep['path']}` | {', '.join(ep['methods'])} | {note} |")
    tokens["endpoint_table"] = "\n".join(rows)

    # --- Database ---
    tokens["table_count"] = str(database["table_count"])
    tokens["column_count"] = str(database["column_count"])
    tokens["relations"] = str(database["relations"])
    tokens["indexes"] = str(database["indexes"])
    tokens["migrations"] = (
        str(database["migrations"])
        if database["migrations"] is not None
        else todo("no migration tooling; would need Alembic or Flask-Migrate")
    )
    tokens["prisma_models"] = todo("not applicable - raw psycopg2 SQL; would need Prisma or an ORM such as SQLAlchemy")
    if database["tables"]:
        tokens["table_details"] = "\n".join(
            f"- `{t['name']}` ({len(t['columns'])} columns): {', '.join(t['columns'])}"
            for t in database["tables"]
        )
    else:
        tokens["table_details"] = "- None detected"

    # --- Security ---
    tokens["security_checklist"] = "\n".join(
        f"{'[x]' if item['detected'] else '[ ]'} {item['label']}"
        + ("" if item["detected"] else f" _(not detected - {item['hint']})_" if item["hint"] else " _(not detected)_")
        for item in security
    )

    # --- Code statistics ---
    lint = static["lint"]
    tokens["lint_score"] = (
        f"{lint['score']}/10"
        if lint["score"] is not None
        else todo("install pylint (`pip install pylint`) to measure code quality")
    )
    tokens["total_files"] = str(code["total_files"])
    tokens["total_lines"] = f"{code['total_lines']:,}"
    tokens["avg_file_size"] = fmt_size(code["avg_file_size"])
    tokens["lines_by_language"] = "\n".join(
        f"- {lang}: {count:,} lines"
        for lang, count in sorted(code["lines_by_language"].items(), key=lambda kv: kv[1], reverse=True)
    ) or "- None"
    tokens["largest_files"] = "\n".join(
        f"- `{name}` ({fmt_size(size)})" for name, size in code["largest_files"]
    ) or "- None"

    # --- Architecture ---
    tokens["model_count"] = str(len(backend["pydantic_models"]) + database["table_count"])

    # --- Testing ---
    tokens["test_framework"] = testing["framework"] or todo("no tests detected")
    tokens["test_count"] = str(testing["test_count"])
    tokens["test_coverage"] = (
        f"{testing['coverage']}%"
        if testing["coverage"] is not None
        else todo("install coverage.py (`pip install coverage`) to measure test coverage")
    )

    # --- Build ---
    tokens["build_time"] = todo("no build step in this stack; would need a bundler/task runner to measure")
    tokens["build_output_size"] = todo("no build output; static assets are served as-is")

    # --- API benchmark ---
    if bench:
        lines = [
            "| Endpoint | Requests | Avg | Min | Max |",
            "| --- | --- | --- | --- | --- |",
        ]
        for r in bench["routes"]:
            lines.append(
                f"| `{r['route']}` | {r['requests']} | {r['avg_ms']:.0f} ms | "
                f"{r['min_ms']:.0f} ms | {r['max_ms']:.0f} ms |"
            )
        lines += [
            "",
            f"- Average latency: {bench['overall_avg_ms']:.0f} ms",
            f"- Fastest endpoint: `{bench['fastest']['route']}` ({bench['fastest']['avg_ms']:.0f} ms avg)",
            f"- Slowest endpoint: `{bench['slowest']['route']}` ({bench['slowest']['avg_ms']:.0f} ms avg)",
        ]
        tokens["benchmark_section"] = "\n".join(lines)
    else:
        tokens["benchmark_section"] = todo(
            "regenerate with `python -m metrics --live` to benchmark the local server (in-memory mock DB; no hosted services contacted)"
            if not server_up
            else "server started but no benchmarkable routes responded"
        )

    # --- Resume highlights (real measured numbers only) ---
    bullets = [
        f"Built a full-stack RSVP platform with {backend['endpoint_count']} Flask REST endpoints "
        f"and {frontend['page_count']} server-rendered pages.",
        f"Designed a PostgreSQL database schema ({database['table_count']} table"
        f"{'s' if database['table_count'] != 1 else ''}, {database['column_count']} columns) "
        "accessed through parameterized SQL queries.",
    ]
    if lh.get("lh_performance") is not None:
        bullets.append(
            f"Achieved {lh['lh_performance']} Lighthouse Performance and "
            f"{lh['lh_accessibility']} Accessibility scores."
        )
    if testing["test_count"]:
        bullets.append(
            f"Implemented {testing['test_count']} automated tests with an in-memory database mock "
            f"({testing['framework']})."
        )
    if any(item["label"] == "Input validation" and item["detected"] for item in security):
        bullets.append(
            f"Enforced server-side input validation with {len(backend['pydantic_models'])} "
            "pydantic models, preventing malformed data and SQL injection."
        )
    detected_labels = {item["label"] for item in security if item["detected"]}
    hardening_map = {
        "Rate limiting": "rate limiting",
        "CSRF protection": "CSRF protection",
        "Helmet (security headers)": "secure HTTP headers",
    }
    hardening = [phrase for label, phrase in hardening_map.items() if label in detected_labels]
    if hardening:
        bullets.append("Hardened HTTP endpoints with " + ", ".join(hardening) + ".")
    if lint["score"] is not None:
        bullets.append(f"Maintained a {lint['score']}/10 static code quality score (pylint).")
    if bench:
        bullets.append(
            f"Benchmarked {len(bench['routes'])} API endpoints with an average latency of "
            f"{bench['overall_avg_ms']:.0f} ms."
        )
    tokens["resume_highlights"] = "\n".join(f"- {b}" for b in bullets)

    return tokens


def main():
    print("Collecting static metrics...")
    static = {
        "code": count_stats.collect_code_stats(),
        "backend": count_stats.collect_backend_stats(),
        "frontend": count_stats.collect_frontend_stats(),
        "database": count_stats.collect_database_stats(),
        "security": count_stats.collect_security_stats(),
        "testing": count_stats.collect_testing_stats(),
        "lint": count_stats.collect_lint_stats(),
    }

    live_requested = "--live" in sys.argv[1:]
    server, server_mode = start_server() if live_requested else (None, None)
    server_up = server is not None
    if server_up:
        print(f"Local server started on port {SERVER_PORT} ({server_mode} database); collecting live metrics...")
    elif live_requested:
        print("Skipping live metrics (local server failed to start).")
    else:
        print("Skipping live metrics (pass --live to enable; runs fully locally, no hosted services contacted).")
    try:
        live = {
            "server_up": server_up,
            "lighthouse": lighthouse.run_lighthouse(BASE_URL) if server_up else {},
            "benchmark": api_benchmark.run_benchmark(BASE_URL) if server_up else None,
        }
    finally:
        if server_up:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()

    if not server_up:
        live["lighthouse"] = {key: None for key in (
            "lh_performance", "lh_accessibility", "lh_best_practices", "lh_seo",
            "fcp", "lcp", "tti", "tbt", "cls",
        )}

    tokens = build_tokens(static, live)
    report = TEMPLATE_PATH.read_text(encoding="utf-8")
    for key, value in tokens.items():
        report = report.replace("{{" + key + "}}", value)
    OUTPUT_PATH.write_text(report, encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH.name}")


if __name__ == "__main__":
    main()
