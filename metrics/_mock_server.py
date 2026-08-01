"""Local development server backed by an in-memory database mock.

Used by `python -m metrics --live` when DATABASE_URL is not set, so Lighthouse
audits and latency benchmarks can run fully locally without connecting to any
real (hosted) database. psycopg2.connect is patched before app is imported.

Run directly: python -m metrics._mock_server [port]
"""

import os
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("DATABASE_URL", "postgresql://mock:mock@localhost/mock")


class InMemoryConnection:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def cursor(self, **_kwargs):
        return InMemoryCursor()

    def commit(self):
        pass


class InMemoryCursor:
    rows = []  # shared RSVP store across cursors

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, query, params=None):
        normalized = query.lstrip().upper()
        if normalized.startswith("INSERT INTO RSVPS") and params:
            columns = (
                "created_at", "first_name", "last_name", "email", "phone",
                "attendance", "party_size", "guests_json", "song_request",
            )
            type(self).rows.append(dict(zip(columns, params)))

    def fetchall(self):
        return list(type(self).rows)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5055
    with patch("psycopg2.connect", side_effect=lambda *a, **k: InMemoryConnection()):
        from app import app

        app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)


if __name__ == "__main__":
    main()
