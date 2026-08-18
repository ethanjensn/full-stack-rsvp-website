# Admin login and security

This file explains how the admin login works and how the passwords and session cookie stay safe.

## Setting up the admin login

Before you start the app, set these environment variables in your terminal:

```powershell
$env:FLASK_SECRET_KEY = "a-long-random-string"
$env:ADMIN_INITIAL_USERNAME = "admin"
$env:ADMIN_INITIAL_PASSWORD = "your-secure-password"
```

When `app.py` starts, `seed_admin()` checks the `users` table in Neon. If the table is empty, it creates the first admin user with the values above. The real password is not stored in plain text — it is hashed before it is saved.

After the first run, the admin user lives in the database and the initial environment variables can be removed. You only need `DATABASE_URL` and `FLASK_SECRET_KEY` for normal use.

## What the admin sees

The admin dashboard is at `/<ADMIN_PATH>/login`. Replace `<ADMIN_PATH>` with the value of `ADMIN_PATH` (or the default `admin-a7c3f9d2b81`). Submitting the correct username and password sets a session cookie and redirects to the dashboard. Visiting `/<ADMIN_PATH>/logout` clears that cookie.

## What is `FLASK_SECRET_KEY`?

`FLASK_SECRET_KEY` is a long random string Flask uses to sign the "you are logged in" cookie.

When you log in, Flask writes a small cookie in your browser that says something like `admin = true`. On every page after that, your browser sends the cookie back. Flask uses the secret key to add a signature to that cookie, so it can prove the cookie was created by your server and not by someone else.

If an attacker learns your secret key, they can create their own cookie, sign it with your key, and visit the admin page without a username or password. That is why the secret key must be long, random, and private. It is also why `sql.txt` is `.gitignored` — you should not commit it.

