"""Lighthouse performance collector.

Requires the Lighthouse CLI (a Node.js tool) and Chrome. The collector shells
out to `npx lighthouse` if available; otherwise every metric returns None so
the report can explain what tooling would be needed.
"""

import json
import os
import shutil
import subprocess

CATEGORIES = ["performance", "accessibility", "best-practices", "seo"]
AUDITS = {
    "fcp": "first-contentful-paint",
    "lcp": "largest-contentful-paint",
    "tti": "interactive",
    "tbt": "total-blocking-time",
    "cls": "cumulative-layout-shift",
}

INSTALL_HINT = (
    "install Node.js + Chrome and run `npm install -g lighthouse`, "
    "then regenerate with the server running"
)


def lighthouse_available():
    return shutil.which("npx") is not None or shutil.which("lighthouse") is not None


def run_lighthouse(base_url, timeout=180):
    """Run Lighthouse against base_url. Returns metric dict, or None values if
    the CLI or Chrome is unavailable (or the audit fails)."""
    empty = {f"lh_{cat.replace('-', '_')}": None for cat in CATEGORIES}
    empty.update({key: None for key in AUDITS})

    # Resolve full paths: on Windows these are .cmd shims that subprocess
    # cannot exec without a shell.
    npx_path = shutil.which("npx")
    lighthouse_path = shutil.which("lighthouse")
    if lighthouse_path:
        cmd = [lighthouse_path]
    elif npx_path:
        cmd = [npx_path, "--yes", "lighthouse"]
    else:
        return empty

    cmd += [
        base_url,
        "--output=json",
        "--output-path=stdout",
        "--quiet",
        "--chrome-flags=--headless --no-sandbox",
        "--only-categories=" + ",".join(CATEGORIES),
    ]
    try:
        result = subprocess.run(
            cmd, capture_output=True, encoding="utf-8", errors="replace",
            timeout=timeout, shell=os.name == "nt",
        )
        report = json.loads(result.stdout)
    except (subprocess.SubprocessError, json.JSONDecodeError, OSError):
        return empty

    metrics = {}
    for cat in CATEGORIES:
        score = report.get("categories", {}).get(cat, {}).get("score")
        metrics[f"lh_{cat.replace('-', '_')}"] = round(score * 100) if score is not None else None
    audits = report.get("audits", {})
    for key, audit_name in AUDITS.items():
        audit = audits.get(audit_name, {})
        value = audit.get("numericValue")
        display = audit.get("displayValue")
        if value is None or display is None:
            metrics[key] = None
        elif key == "cls":
            metrics[key] = round(value, 3)
        else:
            metrics[key] = display
    return metrics
