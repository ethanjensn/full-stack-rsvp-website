from flask import Flask, render_template, request, Response, redirect
import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import List, Literal

import psycopg2
import psycopg2.extras
import resend
from pydantic import BaseModel, Field, ValidationError, field_validator

import config

app = Flask(__name__)


@app.context_processor
def inject_config():
    return {"config": config}


EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_REGEX = re.compile(r"^[\d\s\-\(\)\+]+$")
ADMIN_PATH = os.environ.get("ADMIN_PATH", "admin-a7c3f9d2b81").strip("/") or "admin-a7c3f9d2b81"

# Configure Resend API
resend.api_key = os.environ.get("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "onboarding@resend.dev")
NOTIFY_EMAILS = os.environ.get("NOTIFY_EMAILS", "").split(",") if os.environ.get("NOTIFY_EMAILS") else []

def get_db_connection():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable is not set")

    conn = psycopg2.connect(database_url)
    return conn

class Guest(BaseModel):
    first: str = Field(default="")
    last: str = Field(default="")

    @field_validator("first", "last", mode="before")
    @classmethod
    def strip_name(cls, v):
        return (v or "").strip()


class RSVPSubmission(BaseModel):
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: str = Field(..., max_length=254)
    phone: str = Field(..., max_length=20)
    attendance: Literal["yes", "no"] = Field(default="yes")
    party_size: int = Field(default=1, ge=1, le=10)
    song_request: str = Field(default="", max_length=500)
    guests: List[Guest] = Field(default_factory=list)

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def validate_required_name(cls, v, info):
        label = "First name" if info.field_name == "first_name" else "Last name"
        cleaned = (v or "").strip()
        if not cleaned:
            raise ValueError(f"{label} is required.")
        if len(cleaned) > 100:
            raise ValueError(f"{label} must be 100 characters or fewer.")
        return cleaned

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, v):
        cleaned = (v or "").strip()
        if not cleaned:
            raise ValueError("Email is required.")
        if len(cleaned) > 254:
            raise ValueError("Email must be 254 characters or fewer.")
        if not EMAIL_REGEX.match(cleaned):
            raise ValueError("Please provide a valid email address.")
        return cleaned

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v):
        cleaned = (v or "").strip()
        if not cleaned:
            raise ValueError("Phone number is required.")
        if len(cleaned) > 20:
            raise ValueError("Phone number must be 20 characters or fewer.")
        if not PHONE_REGEX.match(cleaned):
            raise ValueError("Please provide a valid phone number.")
        return cleaned

    @field_validator("attendance", mode="before")
    @classmethod
    def validate_attendance(cls, v):
        value = (v or "yes").strip().lower()
        if value not in {"yes", "no"}:
            raise ValueError("Attendance selection is invalid.")
        return value

    @field_validator("party_size", mode="before")
    @classmethod
    def validate_party_size(cls, v):
        try:
            parsed = int(v)
        except (TypeError, ValueError):
            return 1
        if parsed < 1:
            raise ValueError("Party size must be at least 1.")
        if parsed > 10:
            raise ValueError("Party size cannot exceed 10.")
        return parsed

    @field_validator("song_request", mode="before")
    @classmethod
    def validate_song_request(cls, v):
        cleaned = (v or "").strip()
        if len(cleaned) > 500:
            raise ValueError("Song request must be 500 characters or fewer.")
        return cleaned

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

@app.route("/calendar")
def calendar():
    """Redirect to Google Calendar for adding the wedding event."""
    from urllib.parse import quote
    title = quote(config.CALENDAR_TITLE)
    details = quote(config.CALENDAR_DESCRIPTION)
    location = quote(config.CALENDAR_LOCATION)
    start = config.CALENDAR_START_UTC
    end = config.CALENDAR_END_UTC
    url = f"https://calendar.google.com/calendar/render?action=TEMPLATE&text={title}&dates={start}/{end}&details={details}&location={location}"
    return redirect(url)


@app.route("/calendar.ics")
def calendar_ics():
    """Serve an iCalendar file for Apple Calendar and other .ics-capable apps."""
    start = config.CALENDAR_START_UTC
    end = config.CALENDAR_END_UTC
    summary = config.CALENDAR_TITLE
    description = config.CALENDAR_DESCRIPTION
    location = config.CALENDAR_LOCATION
    uid = config.CALENDAR_ICS_UID
    dtstamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{config.CALENDAR_ICS_PRODID}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{dtstamp}",
        f"DTSTART:{start}",
        f"DTEND:{end}",
        f"SUMMARY:{summary}",
        f"DESCRIPTION:{description}",
        f"LOCATION:{location}",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    # Fold lines longer than 75 octets per RFC 5545.
    folded = []
    for line in lines:
        encoded = line.encode("utf-8")
        if len(encoded) <= 75:
            folded.append(line)
        else:
            chunks = []
            current = line
            while current:
                encoded_current = current.encode("utf-8")
                if len(encoded_current) <= 74:
                    chunks.append(current)
                    break
                # Find a safe split point within the first 74 bytes.
                limit = 74
                while limit > 0 and len(current[:limit].encode("utf-8")) > 74:
                    limit -= 1
                chunks.append(current[:limit])
                current = current[limit:]
            folded.append(chunks[0])
            for chunk in chunks[1:]:
                folded.append(" " + chunk)

    body = "\r\n".join(folded) + "\r\n"
    return Response(
        body,
        mimetype="text/calendar",
        headers={"Content-Disposition": "attachment; filename=wedding.ics"},
    )

@app.route("/rsvp")
def rsvp():
    return render_template("rsvp.html")

@app.route("/submit_rsvp", methods=["POST"])
def submit_rsvp():
    raw_party_size = request.form.get("partySize")
    try:
        guest_count = int(raw_party_size)
    except (TypeError, ValueError):
        guest_count = 1
    guest_count = max(1, min(guest_count, 10))

    guests = []
    for idx in range(2, guest_count + 1):
        guests.append({
            "first": (request.form.get(f"guest{idx}First") or "").strip(),
            "last": (request.form.get(f"guest{idx}Last") or "").strip(),
        })

    form_data = {
        "first_name": request.form.get("firstName"),
        "last_name": request.form.get("lastName"),
        "email": request.form.get("email"),
        "phone": request.form.get("phone"),
        "attendance": request.form.get("attendance"),
        "party_size": raw_party_size,
        "song_request": request.form.get("songRequest"),
        "guests": guests,
    }

    try:
        submission = RSVPSubmission.model_validate(form_data)
    except ValidationError as e:
        error_message = e.errors()[0]["msg"]
        return render_template("rsvp.html", error_message=error_message, form_data=form_data), 400

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
                    submission.first_name,
                    submission.last_name,
                    submission.email,
                    submission.phone,
                    submission.attendance,
                    submission.party_size,
                    json.dumps([g.model_dump() for g in submission.guests]),
                    submission.song_request,
                ),
            )
        conn.commit()

    # Send email notification via Resend
    try:
        guests_list = "\n".join([f"{g['first']} {g['last']}" for g in guests if g.get("first") or g.get("last")])
        email_body = f"""
        New RSVP from {submission.first_name} {submission.last_name}

        Email: {submission.email}
        Phone: {submission.phone}
        Attendance: {submission.attendance}
        Party Size: {submission.party_size}

        Additional Guests:
        {guests_list if guests_list else "None"}

        Song Request:
        {submission.song_request if submission.song_request else "None"}
        """

        resend.Emails.send({
            "from": RESEND_FROM_EMAIL,
            "to": NOTIFY_EMAILS,
            "subject": f"New RSVP: {submission.first_name} {submission.last_name}",
            "html": f"<p>New RSVP from <strong>{submission.first_name} {submission.last_name}</strong></p>"
                    f"<p>Email: {submission.email}<br>"
                    f"Phone: {submission.phone}<br>"
                    f"Attendance: {submission.attendance}<br>"
                    f"Party Size: {submission.party_size}</p>"
                    f"<p><strong>Additional Guests:</strong><br>"
                    f"{guests_list if guests_list else 'None'}</p>"
                    f"<p><strong>Song Request:</strong><br>"
                    f"{submission.song_request if submission.song_request else 'None'}</p>"
        })
    except Exception as e:
        # Log the error but don't fail the RSVP submission
        print(f"Failed to send email notification: {e}")

    return render_template(
        "submit_rsvp.html",
        first_name=submission.first_name,
        last_name=submission.last_name,
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
    app.run(debug=False, host="0.0.0.0")