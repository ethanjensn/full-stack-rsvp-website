from flask import Flask, render_template, request
import json
import os
import re
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras

app = Flask(__name__)

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ADMIN_PATH = os.environ.get("ADMIN_PATH", "admin-a7c3f9d2b81").strip("/") or "admin-a7c3f9d2b81"

def get_db_connection():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable is not set")

    conn = psycopg2.connect(database_url)
    return conn

def _validate_required_text(value: str, label: str, max_length: int = 100):
    cleaned = (value or "").strip()
    if not cleaned:
        return None, f"{label} is required."
    if len(cleaned) > max_length:
        return None, f"{label} must be {max_length} characters or fewer."
    return cleaned, None

def _validate_email(value: str):
    cleaned = (value or "").strip()
    if not cleaned:
        return None, "Email is required."
    if len(cleaned) > 254:
        return None, "Email must be 254 characters or fewer."
    if not EMAIL_REGEX.match(cleaned):
        return None, "Please provide a valid email address."
    return cleaned, None

def _validate_party_size(value: str):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return 1, None

    if parsed < 1:
        return 1, "Party size must be at least 1."
    if parsed > 10:
        return 10, "Party size cannot exceed 10."
    return parsed, None

def _validate_attendance(value: str):
    cleaned = (value or "yes").strip().lower()
    if cleaned not in {"yes", "no"}:
        return "yes", "Attendance selection is invalid."
    return cleaned, None

def _validate_phone(value: str):
    cleaned = (value or "").strip()
    if not cleaned:
        return None, "Phone number is required."
    if len(cleaned) > 20:
        return None, "Phone number must be 20 characters or fewer."
    # Basic phone validation - allows digits, spaces, dashes, parentheses, plus
    phone_regex = re.compile(r"^[\d\s\-\(\)\+]+$")
    if not phone_regex.match(cleaned):
        return None, "Please provide a valid phone number."
    return cleaned, None

def _validate_song_request(value: str):
    cleaned = (value or "").strip()
    if len(cleaned) > 500:
        return None, "Song request must be 500 characters or fewer."
    return cleaned, None

def init_db():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS rsvps (
                    id SERIAL PRIMARY KEY,
                    created_at TIMESTAMPTZ NOT NULL,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    attendance TEXT NOT NULL,
                    party_size INTEGER NOT NULL,
                    guests_json TEXT NOT NULL DEFAULT '[]',
                    song_request TEXT
                )
                """
            )
        conn.commit()

init_db()

@app.route("/")
def index():
    """Serve the blank landing page for verifying Flask."""
    return render_template("index.html")

@app.route("/rsvp")
def rsvp():
    return render_template("rsvp.html")

@app.route("/submit_rsvp", methods=["POST"])
def submit_rsvp():
    form_data = {
        "first_name": request.form.get("firstName"),
        "last_name": request.form.get("lastName"),
        "email": request.form.get("email"),
        "phone": request.form.get("phone"),
        "attendance": request.form.get("attendance"),
        "party_size": request.form.get("partySize"),
        "song_request": request.form.get("songRequest"),
    }

    first_name, err = _validate_required_text(form_data["first_name"], "First name")
    if err:
        return render_template("rsvp.html", error_message=err, form_data=form_data), 400

    last_name, err = _validate_required_text(form_data["last_name"], "Last name")
    if err:
        return render_template("rsvp.html", error_message=err, form_data=form_data), 400

    email, err = _validate_email(form_data["email"])
    if err:
        return render_template("rsvp.html", error_message=err, form_data=form_data), 400

    phone, err = _validate_phone(form_data["phone"])
    if err:
        return render_template("rsvp.html", error_message=err, form_data=form_data), 400

    attendance, err = _validate_attendance(form_data["attendance"])
    if err:
        form_data["attendance"] = attendance
        return render_template("rsvp.html", error_message=err, form_data=form_data), 400

    party_size, err = _validate_party_size(form_data["party_size"])
    if err:
        form_data["party_size"] = party_size
        return render_template("rsvp.html", error_message=err, form_data=form_data), 400

    song_request, err = _validate_song_request(form_data["song_request"])
    if err:
        return render_template("rsvp.html", error_message=err, form_data=form_data), 400

    guests = []
    guest_error = None
    for idx in range(2, party_size + 1):
        g_first = (request.form.get(f"guest{idx}First") or "").strip()
        g_last = (request.form.get(f"guest{idx}Last") or "").strip()

        if not (g_first or g_last):
            guests.append({"first": "", "last": ""})
            continue

        if len(g_first) > 100:
            guest_error = f"Guest {idx} first name must be 100 characters or fewer."
            break
        if len(g_last) > 100:
            guest_error = f"Guest {idx} last name must be 100 characters or fewer."
            break

        guests.append({"first": g_first, "last": g_last})

    if guest_error:
        form_data["party_size"] = party_size
        form_data["attendance"] = attendance
        form_data["guests"] = guests
        return render_template("rsvp.html", error_message=guest_error, form_data=form_data), 400

    created_at = datetime.now(timezone.utc)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO rsvps (created_at, first_name, last_name, email, phone, attendance, party_size, guests_json, song_request)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    created_at,
                    first_name,
                    last_name,
                    email,
                    phone,
                    attendance,
                    party_size,
                    json.dumps(guests),
                    song_request,
                ),
            )
        conn.commit()

    return render_template(
        "submit_rsvp.html",
        first_name=first_name,
        last_name=last_name,
    )

@app.route("/qa")
def qa():
    return render_template("q-and-a.html")

@app.route(f"/{ADMIN_PATH}")
def admin():
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM rsvps ORDER BY created_at DESC")
            rows = cur.fetchall()

    rsvps = []
    for row in rows:
        guests = []
        try:
            guests = json.loads(row.get("guests_json") or "[]")
        except json.JSONDecodeError:
            guests = []

        rsvps.append(
            {
                "id": row.get("id"),
                "created_at": row.get("created_at"),
                "first_name": row.get("first_name"),
                "last_name": row.get("last_name"),
                "email": row.get("email"),
                "phone": row.get("phone"),
                "attendance": row.get("attendance"),
                "party_size": row.get("party_size"),
                "guests": guests,
                "song_request": row.get("song_request"),
            }
        )

    return render_template("admin.html", rsvps=rsvps)

if __name__ == "__main__":
    app.run(debug=True)