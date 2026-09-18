# Wedding Website (React + Cloudflare Workers)

A wedding website with an RSVP form backed by PostgreSQL and an admin dashboard to review submissions. The frontend is a React single-page app built with Vite; the backend is a Cloudflare Worker that serves a JSON API and the built static assets. All event-specific content (names, date, venue, registry, images) lives in `backend/config.js` and `static/assets/` so the site can be rebranded by swapping those files alone.

## Stack

- **React 18 + Vite** — single-page frontend (`frontend/`), built into `static/`
- **Cloudflare Worker** — JSON API and asset serving (`backend/`)
- **Neon serverless driver** — PostgreSQL
- **HMAC-signed session cookies + CSRF tokens** — admin auth
- **Werkzeug-compatible hash verification** — `users.password_hash` values created by the old Flask app still work
- **Resend REST API** — RSVP email notifications
- **Cloudflare assets binding** — serves `static/`

## Project layout

```
backend/          Cloudflare Worker (ES modules)
  index.js        Routing: API endpoints, calendar links, SPA fallback
  auth.js         Session cookies, CSRF, Werkzeug password verification
  db.js           Neon client + rsvps/users table creation
  email.js        Resend notification on new RSVP
  config.js       Event-specific content (names, date, venue, registry)
  utils.js        RSVP validation, calendar URL/ICS builders
frontend/         React + Vite app (npm workspace)
  src/pages/      Home, Rsvp, Confirmation, Qa, AdminLogin, AdminDashboard
static/           Vite build output + images, served by the Worker at /static/
wrangler.toml     Worker config (entry point, assets, ADMIN_PATH var)
```

## Prerequisites

- Node.js 18 or newer
- A Neon (or any Postgres) database
- A Cloudflare account (for `wrangler dev` / deploy)

## Install dependencies

```powershell
npm install
```

This installs the root dev dependencies (wrangler, Neon driver) and the `frontend` npm workspace.

## Local development

1. Create a `.dev.vars` file in the repo root (gitignored):

   ```
   DATABASE_URL=postgresql://...
   SESSION_SECRET=a-long-random-string
   RESEND_API_KEY=...
   RESEND_FROM_EMAIL=...
   NOTIFY_EMAILS=comma,separated,emails
   ```

2. Build the frontend and start the Worker:

   ```powershell
   npm run dev
   ```

   Visit http://localhost:8787/ — the Worker serves the built SPA and the API on one origin.

   For frontend hot-reload, run the Vite dev server alongside the Worker. Vite proxies `/api`, `/calendar`, and `/calendar.ics` to `127.0.0.1:8787`:

   ```powershell
   # Terminal 1
   npm run dev:backend

   # Terminal 2
   npm run dev:frontend
   ```

   Then visit http://localhost:5173/.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | secret | Neon Postgres connection string |
| `SESSION_SECRET` | secret | HMAC key for signing admin session cookies |
| `RESEND_API_KEY` | secret | Resend API key for RSVP notifications |
| `RESEND_FROM_EMAIL` | secret | Verified sender address |
| `NOTIFY_EMAILS` | secret | Comma-separated notification recipients |
| `ADMIN_PATH` | `wrangler.toml` `[vars]` | URL segment for the admin pages (e.g. `admin-a7c3f9d2b81`) |

Set secrets locally in `.dev.vars`; set them in production with `wrangler secret put`.

## Admin login

The admin dashboard lives at `/{ADMIN_PATH}` and is protected by a database-backed login. On first request the Worker creates the `users` table if needed (see `initDb()` in `backend/db.js`), but it does not seed any users — insert an admin row yourself:

```sql
INSERT INTO users (username, password_hash) VALUES ('admin', '<hash>');
```

The hash must be in Werkzeug format (`pbkdf2:sha256:<iterations>$<salt>$<hash>` or `scrypt:<n>:<r>:<p>$<salt>$<hash>`), which keeps hashes created by the previous Flask version working. Generate one with Python:

```powershell
python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('your-secure-password'))"
```

Sessions are HMAC-signed `HttpOnly` cookies; admin mutations also require the `X-CSRF-Token` header issued at login.

## API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/config` | Public event config (from `backend/config.js`) |
| `POST` | `/api/rsvp` | Submit an RSVP (JSON or form body) |
| `GET` | `/api/admin/session` | Check admin session, returns CSRF token |
| `POST` | `/api/admin/login` | Log in, sets session cookie |
| `POST` | `/api/admin/logout` | Log out, clears session cookie |
| `GET` | `/api/admin/rsvps` | List RSVPs with totals (admin only) |
| `DELETE` | `/api/admin/rsvps/:id` | Delete an RSVP (admin + CSRF) |
| `GET` | `/calendar` | Redirect to a prefilled Google Calendar event |
| `GET` | `/calendar.ics` | Download an ICS invite |

All other `GET` paths fall through to the SPA's `index.html`.

## Database schema

`initDb()` in `backend/db.js` creates two tables on first use:

- `rsvps` — one row per submission (`guests_json` holds additional party members)
- `users` — admin accounts (`username`, `password_hash`)

## Deploy

1. Set the secrets in your Cloudflare account:

   ```powershell
   npx wrangler secret put DATABASE_URL
   npx wrangler secret put SESSION_SECRET
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put RESEND_FROM_EMAIL
   npx wrangler secret put NOTIFY_EMAILS
   ```

2. Build the frontend and deploy the Worker:

   ```powershell
   npm run deploy
   ```

## Rebranding

To adapt the site for a different event, edit `backend/config.js` (names, date, venue, registry, calendar details) and replace the images in `static/assets/`.

## Legacy files

`tests/test_rsvp.py` and `metrics/` are Python leftovers from the previous Flask version and are not part of the current app. `sql.txt` holds old local env vars and is gitignored.
