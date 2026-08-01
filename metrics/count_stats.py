"""Static analysis collectors for the RSVP website.

Every function here works purely by reading files - no server, database, or
network access required. Metrics that have no equivalent in this Flask stack
return None so the report renderer can emit a TODO placeholder.
"""

import importlib.util
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SKIP_DIRS = {".git", "__pycache__", ".venv", "venv", "node_modules", ".idea", ".vscode"}
SKIP_FILES = {"PROJECT_METRICS.md", ".coverage", "sql.txt"}
LANGUAGE_BY_SUFFIX = {
    ".py": "Python",
    ".html": "HTML",
    ".css": "CSS",
    ".js": "JavaScript",
    ".md": "Markdown",
    ".sql": "SQL",
    ".txt": "Text",
}

ROUTE_RE = re.compile(
    r"@app\.route\(\s*(f)?([\"'])(?P<path>[^\"']+)\2\s*"
    r"(?:,\s*methods\s*=\s*\[(?P<methods>[^\]]*)\])?",
    re.MULTILINE,
)
CREATE_TABLE_RE = re.compile(
    r"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\((.*?)\)\s*[\"']",
    re.IGNORECASE | re.DOTALL,
)
PYDANTIC_MODEL_RE = re.compile(r"^class\s+(\w+)\(BaseModel\)", re.MULTILINE)
TEST_METHOD_RE = re.compile(r"^\s*def\s+(test_\w+)", re.MULTILINE)


def _iter_project_files(root=ROOT):
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.name in SKIP_FILES:
            continue
        yield path


def _read(path):
    return path.read_text(encoding="utf-8", errors="ignore")


def collect_code_stats(root=ROOT):
    """Total files, lines per language, largest files, average file size."""
    files = list(_iter_project_files(root))
    lines_by_language = {}
    file_sizes = []
    total_lines = 0
    for path in files:
        size = path.stat().st_size
        file_sizes.append((path.relative_to(root).as_posix(), size))
        language = LANGUAGE_BY_SUFFIX.get(path.suffix.lower())
        if language:
            line_count = len(_read(path).splitlines())
            total_lines += line_count
            lines_by_language[language] = lines_by_language.get(language, 0) + line_count
    file_sizes.sort(key=lambda item: item[1], reverse=True)
    return {
        "total_files": len(files),
        "total_lines": total_lines,
        "lines_by_language": lines_by_language,
        "largest_files": file_sizes[:5],
        "avg_file_size": round(sum(size for _, size in file_sizes) / len(file_sizes)) if file_sizes else 0,
    }


def collect_backend_stats(root=ROOT):
    """Flask routes (endpoints), pydantic models, and module counts."""
    app_path = root / "app.py"
    routes = []
    if app_path.exists():
        source = _read(app_path)
        for match in ROUTE_RE.finditer(source):
            methods = match.group("methods")
            method_list = (
                [m.strip().strip("\"'").upper() for m in methods.split(",")]
                if methods
                else ["GET"]
            )
            routes.append(
                {
                    "path": match.group("path"),
                    "methods": method_list,
                    "dynamic": bool(match.group(1)),
                }
            )
        models = PYDANTIC_MODEL_RE.findall(source)
    else:
        models = []
    py_modules = [
        p
        for p in root.glob("*.py")
        if p.stem not in {"app"} and not p.stem.startswith("test_")
    ]
    return {
        "endpoints": routes,
        "endpoint_count": len(routes),
        "pydantic_models": models,
        "utility_modules": [p.stem for p in py_modules],
        "middleware_count": 0,  # Flask middleware (@app.before_request etc.) - none used
        "controllers": None,  # no controller layer; routes live in app.py
        "services": None,  # no service layer; db/email helpers live in app.py
    }


def collect_frontend_stats(root=ROOT):
    """Jinja templates (pages) and static assets."""
    templates_dir = root / "templates"
    static_dir = root / "static"
    templates = sorted(templates_dir.glob("*.html")) if templates_dir.exists() else []
    static_files = [p for p in static_dir.rglob("*") if p.is_file()] if static_dir.exists() else []
    static_size = sum(p.stat().st_size for p in static_files)
    return {
        "template_pages": [p.name for p in templates],
        "page_count": len(templates),
        "static_asset_count": len(static_files),
        "static_asset_size": static_size,
        "react_components": None,  # no React - server-rendered Jinja templates
        "custom_hooks": None,  # no React
        "contexts": None,  # no React
        "bundle_size": None,  # no bundler/build step
        "first_load_js": None,  # no Next.js
    }


def collect_database_stats(root=ROOT):
    """Parse CREATE TABLE statements from app.py (raw psycopg2 SQL, no ORM)."""
    app_path = root / "app.py"
    tables = []
    if app_path.exists():
        source = _read(app_path)
        for match in CREATE_TABLE_RE.finditer(source):
            body = match.group(2)
            columns = [
                line.strip().split()[0]
                for line in body.splitlines()
                if line.strip() and not line.strip().startswith("--")
            ]
            tables.append({"name": match.group(1), "columns": columns})
        relations = len(re.findall(r"\bREFERENCES\b", source, re.IGNORECASE))
        indexes = len(re.findall(r"CREATE\s+(?:UNIQUE\s+)?INDEX", source, re.IGNORECASE))
    else:
        relations = 0
        indexes = 0
    migrations_dir = root / "migrations"
    migrations = (
        len([p for p in migrations_dir.rglob("*.py") if p.is_file()])
        if migrations_dir.exists()
        else None
    )
    return {
        "tables": tables,
        "table_count": len(tables),
        "column_count": sum(len(t["columns"]) for t in tables),
        "relations": relations,
        "indexes": indexes,
        "migrations": migrations,  # None -> no migration tooling present
        "prisma_models": None,  # no Prisma/ORM - raw psycopg2 SQL
    }


SECURITY_CHECKS = [
    # (label, any-of regex patterns, hint when missing)
    ("Input validation", [r"\bpydantic\b", r"\bBaseModel\b", r"ValidationError"], ""),
    ("SQL injection protection", [r"execute\([^)]*%s", r"VALUES\s*\(%s"], ""),
    ("Secrets via environment variables", [r"os\.environ\.get"], ""),
    ("Obscured admin path", [r"ADMIN_PATH"], ""),
    ("Authentication", [r"login_required", r"flask_login", r"\bauth\b"], "add Flask-Login or token auth"),
    ("Authorization", [r"role_required", r"permission", r"flask_principal"], "add role/permission checks"),
    ("bcrypt", [r"\bbcrypt\b"], "add bcrypt for password hashing"),
    ("JWT", [r"\bjwt\b", r"pyjwt", r"flask_jwt"], "add PyJWT / Flask-JWT-Extended"),
    ("Helmet (security headers)", [r"talisman", r"helmet"], "add Flask-Talisman"),
    ("CORS", [r"flask_cors", r"\bCORS\b"], "add Flask-CORS"),
    ("Rate limiting", [r"flask_limiter", r"ratelimit", r"rate_limit"], "add Flask-Limiter"),
    ("CSRF protection", [r"flask_wtf", r"\bcsrf\b"], "add Flask-WTF"),
]


def collect_security_stats(root=ROOT):
    """Pattern-detect security features across source + requirements."""
    haystacks = []
    for name in ("app.py", "config.py", "requirements.txt"):
        path = root / name
        if path.exists():
            haystacks.append(_read(path))
    haystack = "\n".join(haystacks)
    results = []
    for label, patterns, hint in SECURITY_CHECKS:
        detected = any(re.search(p, haystack, re.IGNORECASE) for p in patterns)
        results.append({"label": label, "detected": detected, "hint": hint})
    return results


# Stylistic-only pylint rules disabled for scoring; substantive findings stay enabled.
PYLINT_DISABLE = (
    "missing-module-docstring,missing-class-docstring,missing-function-docstring,"
    "too-many-locals,too-many-branches,too-many-statements"
)


def collect_lint_stats(root=ROOT):
    """Pylint code-quality score (X/10), or None if pylint is not installed."""
    if importlib.util.find_spec("pylint") is None:
        return {"score": None}
    try:
        result = subprocess.run(
            [
                sys.executable, "-m", "pylint", "app.py", "config.py", "metrics",
                f"--disable={PYLINT_DISABLE}", "--score=y",
            ],
            cwd=root, capture_output=True, text=True, timeout=180,
        )
        match = re.search(r"rated at (-?\d+(?:\.\d+)?)/10", result.stdout)
        if match:
            return {"score": float(match.group(1))}
    except (subprocess.SubprocessError, OSError):
        pass
    return {"score": None}


def collect_testing_stats(root=ROOT):
    """Test framework, test count, and coverage (if coverage.py is installed)."""
    tests_dir = root / "tests"
    test_names = []
    framework = None
    if tests_dir.exists():
        for path in sorted(tests_dir.rglob("test_*.py")):
            source = _read(path)
            test_names.extend(TEST_METHOD_RE.findall(source))
            if "unittest" in source:
                framework = "unittest"
            if "pytest" in source and framework is None:
                framework = "pytest"
    coverage = None
    if framework and importlib.util.find_spec("coverage") is not None:
        try:
            run = subprocess.run(
                [sys.executable, "-m", "coverage", "run", "-m", "unittest", "discover", "tests"],
                cwd=root, capture_output=True, text=True, timeout=120,
            )
            report = subprocess.run(
                [sys.executable, "-m", "coverage", "report", "--format=total"],
                cwd=root, capture_output=True, text=True, timeout=60,
            )
            if run.returncode == 0 and report.returncode == 0:
                coverage = int(report.stdout.strip())
        except (subprocess.SubprocessError, ValueError, OSError):
            coverage = None
    return {
        "framework": framework,
        "test_count": len(test_names),
        "test_names": test_names,
        "coverage": coverage,  # None -> TODO (install coverage.py)
    }
