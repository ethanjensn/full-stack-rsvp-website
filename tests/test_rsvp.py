import importlib
import os
import sys
import unittest
from unittest.mock import patch

# init_db() runs at import time and requires DATABASE_URL to be set; the value
# is never used because psycopg2.connect is mocked below.
os.environ.setdefault("DATABASE_URL", "postgresql://mock:mock@localhost/mock")

VALID_FORM = {
    "firstName": "Alex",
    "lastName": "Morgan",
    "email": "alex.morgan@example.com",
    "phone": "+1 555 010 1234",
    "attendance": "yes",
    "partySize": "2",
    "guest2First": "Jamie",
    "guest2Last": "Morgan",
    "songRequest": "First Dance",
}


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
        self._select_result = []

    def __enter__(self):
        return self

    def __exit__(self, _exc_type, _exc_value, _traceback):
        return False

    def execute(self, query, params=None):
        normalized = query.lstrip().upper()
        if normalized.startswith("INSERT INTO RSVPS"):
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
        elif normalized.startswith("SELECT"):
            self._select_result = list(self.database.rsvps)

    def fetchall(self):
        return self._select_result


class WeddingTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.database = InMemoryDatabase()
        cls.patcher = patch("psycopg2.connect", side_effect=cls.database.connect)
        cls.patcher.start()
        sys.modules.pop("app", None)
        cls.wedding_app = importlib.import_module("app")
        # CSRF and rate limiting are exercised by the browser in production;
        # they are disabled here so form posts can be tested directly.
        cls.wedding_app.app.config["WTF_CSRF_ENABLED"] = False
        cls.wedding_app.app.config["RATELIMIT_ENABLED"] = False

    @classmethod
    def tearDownClass(cls):
        cls.patcher.stop()

    def setUp(self):
        self.database.rsvps.clear()
        self.client = self.wedding_app.app.test_client()

    def post_rsvp(self, **overrides):
        data = dict(VALID_FORM)
        data.update(overrides)
        return self.client.post("/submit_rsvp", data=data)


class RSVPSubmissionTests(WeddingTestCase):
    def test_valid_submission_returns_success_and_records_rsvp(self):
        response = self.post_rsvp()

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
        response = self.post_rsvp(firstName=" ")

        self.assertEqual(response.status_code, 400)
        self.assertIn(b"First name is required.", response.data)
        self.assertEqual(self.database.rsvps, [])


class ValidationTests(WeddingTestCase):
    def assert_rejected(self, expected_message, **overrides):
        response = self.post_rsvp(**overrides)
        self.assertEqual(response.status_code, 400)
        self.assertIn(expected_message.encode(), response.data)
        self.assertEqual(self.database.rsvps, [])

    def test_invalid_email_rejected(self):
        self.assert_rejected("Please provide a valid email address.", email="not-an-email")

    def test_missing_email_rejected(self):
        self.assert_rejected("Email is required.", email="")

    def test_invalid_phone_rejected(self):
        self.assert_rejected("Please provide a valid phone number.", phone="call me maybe")

    def test_party_size_zero_rejected(self):
        self.assert_rejected("Party size must be at least 1.", partySize="0")

    def test_party_size_above_ten_rejected(self):
        self.assert_rejected("Party size cannot exceed 10.", partySize="11")

    def test_invalid_attendance_rejected(self):
        self.assert_rejected("Attendance selection is invalid.", attendance="maybe")

    def test_song_request_too_long_rejected(self):
        self.assert_rejected("Song request must be 500 characters or fewer.", songRequest="x" * 501)


class PageTests(WeddingTestCase):
    def test_index_page_loads(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)

    def test_rsvp_page_loads(self):
        response = self.client.get("/rsvp")
        self.assertEqual(response.status_code, 200)

    def test_qa_page_loads(self):
        response = self.client.get("/qa")
        self.assertEqual(response.status_code, 200)

    def test_calendar_redirects_to_google(self):
        response = self.client.get("/calendar")
        self.assertEqual(response.status_code, 302)
        self.assertIn("calendar.google.com", response.headers["Location"])

    def test_calendar_ics_served(self):
        response = self.client.get("/calendar.ics")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "text/calendar")
        self.assertIn(b"BEGIN:VCALENDAR", response.data)
        self.assertIn(b"END:VCALENDAR", response.data)


class AdminDashboardTests(WeddingTestCase):
    ADMIN_URL = "/admin-a7c3f9d2b81"

    def test_admin_dashboard_empty(self):
        response = self.client.get(self.ADMIN_URL)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"No submissions yet.", response.data)

    def test_admin_dashboard_lists_submission(self):
        self.post_rsvp()
        response = self.client.get(self.ADMIN_URL)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Alex", response.data)
        self.assertIn(b"Morgan", response.data)
        self.assertIn(b"alex.morgan@example.com", response.data)
        self.assertIn(b"First Dance", response.data)


if __name__ == "__main__":
    unittest.main()
