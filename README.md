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

## Cloudflare Workers deployment

This branch also contains a Cloudflare Workers rewrite of the Flask app (`src/index.js`) that uses:

- **Nunjucks** for templates (Jinja2-compatible syntax)
- **Neon serverless driver** for PostgreSQL
- **HMAC-signed session cookies** for admin auth
- **Werkzeug hash verification** so existing `users.password_hash` values from the Flask app keep working
- **Resend REST API** for email notifications
- **Cloudflare assets binding** for `static/` files

### Setup

1. Install Node dependencies:

   ```powershell
   npm install
   ```

2. Bundle Nunjucks templates into `src/templates-bundle.js`:

   ```powershell
   npm run bundle-templates
   ```

3. Create a `.dev.vars` file in the repo root for local testing (this file is gitignored):

   ```
   DATABASE_URL=postgresql://...
   SESSION_SECRET=a-long-random-string
   RESEND_API_KEY=...
   RESEND_FROM_EMAIL=...
   NOTIFY_EMAILS=...
   ```

4. Run locally:

   ```powershell
   npx wrangler dev
   ```

### Deploy

1. Set the secrets in your Cloudflare account:

   ```powershell
   npx wrangler secret put DATABASE_URL
   npx wrangler secret put SESSION_SECRET
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put RESEND_FROM_EMAIL
   npx wrangler secret put NOTIFY_EMAILS
   ```

2. Deploy:

   ```powershell
   npx wrangler deploy
   ```

The Worker reads `ADMIN_PATH` from `wrangler.toml` vars and uses the existing Neon `users` table for admin login, so no credential migration is needed.
