# Wedding Website (Flask)

Simple Flask app for a wedding website: RSVP form backed by PostgreSQL and an admin view to review submissions. All event-specific content (names, date, venue, registry, images) lives in `config.py` and `static/assets/` so the site can be rebranded by swapping those files alone.

## Prerequisites
- Python 3.9 or newer

## Install dependencies
```powershell
pip install -r requirements.txt
```

## Run the server
```powershell
flask --app app run
# or
python app.py
```

Visit http://localhost:5000/ to confirm the site loads.

## Admin login

The admin dashboard is protected by a database-backed login. The first time the app starts, it creates a `users` table from `users.sql` and seeds one admin account from environment variables. Set these in your terminal or deployment platform:

```powershell
$env:FLASK_SECRET_KEY = "a-long-random-string-for-sessions"
$env:ADMIN_INITIAL_USERNAME = "admin"
$env:ADMIN_INITIAL_PASSWORD = "your-secure-password"
```

After the first run, the user is stored in the database and the initial environment variables can be removed. To log in, visit the admin URL and use the seeded credentials.

## Database schema

The `rsvps` table is created by `init_db()` in `app.py`. The `users` table is defined in `users.sql` and executed on app startup. Do not edit `sql.txt`; it is only for local environment variables.
