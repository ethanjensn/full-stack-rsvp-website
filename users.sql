-- Admin user accounts for the RSVP dashboard.
-- This file is executed once on app startup by init_db() in app.py.
-- It is separate from sql.txt, which is reserved for local environment setup.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);
