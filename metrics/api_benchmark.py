"""API latency benchmark.

Benchmarks the routes listed in ROUTES below. GET routes only by default:
POST /submit_rsvp writes to the database and can trigger notification emails,
and /calendar redirects to an external site - add routes here only if you
accept those side effects. The dynamic admin path is never benchmarked.
"""

import time
import urllib.error
import urllib.request

# --- Configurable route list (paths appended to the local base URL) ---
ROUTES = ["/", "/rsvp", "/qa", "/calendar.ics"]

REQUESTS_PER_ROUTE = 20
REQUEST_TIMEOUT = 10


def _time_request(url):
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=REQUEST_TIMEOUT) as response:
            response.read()
            status = response.status
    except urllib.error.HTTPError as exc:
        status = exc.code
    except (urllib.error.URLError, OSError):
        return None, None
    elapsed_ms = (time.perf_counter() - start) * 1000
    return elapsed_ms, status


def run_benchmark(base_url, routes=None, requests_per_route=REQUESTS_PER_ROUTE):
    """Returns per-route latency stats plus overall fastest/slowest endpoints,
    or None if the server is unreachable."""
    routes = routes if routes is not None else ROUTES
    results = []
    for route in routes:
        samples = []
        status = None
        for _ in range(requests_per_route):
            elapsed_ms, status = _time_request(base_url + route)
            if elapsed_ms is not None:
                samples.append(elapsed_ms)
        if samples:
            results.append(
                {
                    "route": route,
                    "requests": len(samples),
                    "status": status,
                    "avg_ms": sum(samples) / len(samples),
                    "min_ms": min(samples),
                    "max_ms": max(samples),
                }
            )
    if not results:
        return None
    overall_avg = sum(r["avg_ms"] for r in results) / len(results)
    return {
        "routes": results,
        "overall_avg_ms": overall_avg,
        "fastest": min(results, key=lambda r: r["avg_ms"]),
        "slowest": max(results, key=lambda r: r["avg_ms"]),
    }
