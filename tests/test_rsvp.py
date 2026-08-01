import importlib
import sys
import unittest
from unittest.mock import patch


class InMemoryDatabase:
    def __init__(self):
        self.rsvps = []

    def connect(self, *_args, **_kwargs):
        return InMemoryConnection(self)


class InMemoryConnection:
    def __init__(self, database):
        self.database = database
        self.commits = 0

    def __enter__(self):
        return self

    def __exit__(self, _exc_type, _exc_value, _traceback):
        return False

    def cursor(self, **_kwargs):
        return InMemoryCursor(self.database)

    def commit(self):
        self.commits += 1


class InMemoryCursor:
    def __init__(self, database):
        self.database = database

    def __enter__(self):
        return self

    def __exit__(self, _exc_type, _exc_value, _traceback):
        return False

    def execute(self, query, params=None):
        if query.lstrip().upper().startswith("INSERT INTO RSVPS"):
            (
                created_at,
                first_name,
                last_name,
                email,
                phone,
                attendance,
                party_size,
                guests_json,
                song_request,
            ) = params
            self.database.rsvps.append(
                {
                    "created_at": created_at,
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": email,
                    "phone": phone,
                    "attendance": attendance,
                    "party_size": party_size,
                    "guests_json": guests_json,
                    "song_request": song_request,
                }
            )


class RSVPSubmissionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.database = InMemoryDatabase()
        cls.patcher = patch("psycopg2.connect", side_effect=cls.database.connect)
        cls.patcher.start()
        sys.modules.pop("app", None)
        cls.wedding_app = importlib.import_module("app")

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def setUp(self):
        self.database.rsvps.clear()
        self.client = self.wedding_app.app.test_client()

    def test_valid_submission_returns_success_and_records_rsvp(self):
        response = self.client.post(
            "/submit_rsvp",
            data={
                "firstName": "Alex",
                "lastName": "Morgan",
                "email": "alex.morgan@example.com",
                "phone": "+1 555 010 1234",
                "attendance": "yes",
                "partySize": "2",
                "guest2First": "Jamie",
                "guest2Last": "Morgan",
                "songRequest": "First Dance",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Thank you, Alex Morgan!", response.data)
        self.assertEqual(len(self.database.rsvps), 1)
        self.assertEqual(
            self.database.rsvps[0],
            {
                "created_at": self.database.rsvps[0]["created_at"],
                "first_name": "Alex",
                "last_name": "Morgan",
                "email": "alex.morgan@example.com",
                "phone": "+1 555 010 1234",
                "attendance": "yes",
                "party_size": 2,
                "guests_json": '[{"first": "Jamie", "last": "Morgan"}]',
                "song_request": "First Dance",
            },
        )

    def test_invalid_submission_returns_bad_request_without_recording_rsvp(self):
        response = self.client.post(
            "/submit_rsvp",
            data={
                "firstName": " ",
                "lastName": "Morgan",
                "email": "alex.morgan@example.com",
                "phone": "+1 555 010 1234",
                "attendance": "yes",
                "partySize": "1",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn(b"First name is required.", response.data)
        self.assertEqual(self.database.rsvps, [])


if __name__ == "__main__":
    unittest.main()
