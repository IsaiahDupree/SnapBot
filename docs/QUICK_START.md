# SnapBot Quick Start (Windows)

This guide gets you from zero to a running API and dashboard with Postgres.

## Commands at a glance

```powershell
# From top-level repo
cd .\SnapBot
npm install
npm run migrate
npm run api
start http://localhost:3057/
```

## Prerequisites

- Node.js 18+ and npm
- Postgres 13+ (local or remote)
- A valid Snapchat account (see notes about login & CAPTCHA below)

## 1) Environment variables

Create a `.env` file in the project root (`SnapBot/.env`). Do NOT commit secrets.

Example (adjust for your environment):

```ini
PORT=3057
DATABASE_URL=postgres://<USER>:<PASSWORD>@<HOST>:<PORT>/<DB_NAME>

# Optional: default Snapchat creds (can also be provided per-request)
USER_NAME=your.snap.username
USER_PASSWORD=yourStrongPassword

# HMAC signature for webhooks (recommended)
CALLBACK_HMAC_SECRET=replace-with-strong-secret

# Callback worker: set to 0 to disable background deliveries
CALLBACK_WORKER=1
```

Notes

- `DATABASE_URL` is required for any DB features. Without it, the dashboard summary and endpoints that use DB will fail.
- `CALLBACK_HMAC_SECRET` enables `X-Signature` on webhook callbacks.


## 2) Install dependencies

From the top-level repo:

```powershell
cd .\SnapBot
npm install
```

## 3) Apply database migrations (choose ONE)

Option A — Recommended (no psql needed):

```powershell
cd .\SnapBot
npm run migrate
```

Option B — Manual via psql (if you have psql installed):

```powershell
# Using a connection string from .env (PowerShell)
cd .\SnapBot
psql "$env:DATABASE_URL" -f "migrations/001_init.sql"
psql "$env:DATABASE_URL" -f "migrations/002_logs.sql"
psql "$env:DATABASE_URL" -f "migrations/003_filters.sql"
psql "$env:DATABASE_URL" -f "migrations/003_webhook_events.sql"

# Or specify host/user/db directly (replace placeholders)
psql -h <HOST> -U <USER> -d <DB_NAME> -f "migrations/001_init.sql"
psql -h <HOST> -U <USER> -d <DB_NAME> -f "migrations/002_logs.sql"
psql -h <HOST> -U <USER> -d <DB_NAME> -f "migrations/003_filters.sql"
psql -h <HOST> -U <USER> -d <DB_NAME> -f "migrations/003_webhook_events.sql"
```

Tables created

- `jobs`, `runs`, `recipients`, `sessions`, `media`
- `logs`, `webhook_deliveries`
- `recipient_filters`, `webhook_events`

## 4) Start in TWO terminals (Backend and Frontend)

Terminal 1 — Backend (API + serves dashboard):

```powershell
# In a PowerShell window (from repo root)
cd .\SnapBot
npm run api
```

Log should show:

```text
{"service":"api","port":"3057","msg":"API listening"}
```

Terminal 2 — Frontend (open dashboard in browser):

```powershell
# In another PowerShell window
start http://localhost:3057/
# (Optional) If you prefer Chrome: start chrome http://localhost:3057/
```

### Start both in one command (from repo root)

One-liner that opens a new PowerShell window for the backend and then opens the dashboard in your default browser:

```powershell
Start-Process powershell -ArgumentList '-NoExit','-Command','cd .\SnapBot; npm run api'; Start-Sleep -Seconds 1; Start-Process 'http://localhost:3057/'
```

If you use PowerShell 7 (pwsh), you can use:

```powershell
Start-Process pwsh -ArgumentList '-NoExit','-Command','cd .\SnapBot; npm run api'; Start-Sleep -Seconds 1; Start-Process 'http://localhost:3057/'
```

## 5) Test endpoints (PowerShell‑friendly)

PowerShell treats `curl` as an alias for `Invoke-WebRequest`. Use `Invoke-RestMethod` for JSON:

```powershell
# Health
Invoke-RestMethod http://localhost:3057/health

# Send text (replace recipients and callback URL)
$body = {
  recipients = @("Alice")
  message = "Hello from SnapBot"
  headless = $false
  callbackUrl = "https://webhook.site/<your-id>"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3057/sendText -Method POST -ContentType 'application/json' -Body $body
```

Live logs for a job are available under “Recent Jobs” -> click the job ID to open the logs modal.

### Automated tests (API + UI screenshots)

```powershell
# From repo root -> SnapBot
cd .\SnapBot

# API tests (Supertest via Node's test runner)
npm run test:api

# UI smoke tests with screenshots (Puppeteer)
npm run test:ui

# Run both
npm test
```

Screenshots are written to `tests/screenshots/`.

### Full endpoint reference

See `docs/ENDPOINTS.md` for complete request/response shapes for every route (health, dashboard, jobs, logs, filters, callbacks, and scraping helpers).

## 6) Snapchat login tips

- If CAPTCHA appears, log in once manually in a normal Chrome profile, then pass that profile directory via `userDataDir` in requests.
- Example request body can include:
  - `headless: false` to verify visually.
  - `userDataDir: "C:\\Users\\<you>\\AppData\\Local\\Google\\Chrome\\User Data"` (or a dedicated profile path).

## Troubleshooting

- 500 on `GET /dashboard/summary`
  - Ensure `DATABASE_URL` is set in `.env` and API has been restarted.
  - Confirm migrations were applied successfully (run `\dt` in psql to list tables; verify `jobs`, `logs`, `recipient_filters`, `webhook_events`).
  - Check the terminal output where `npm run api` is running; any SQL errors will appear there.

- Port already in use on start (EADDRINUSE)
  - Kill the process using port 3057:

    ```powershell
    Get-NetTCPConnection -LocalPort 3057 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
    ```

  - Or change the port in `.env` and restart:

    ```ini
    PORT=3058
    ```

- 503 "DB not configured"
  - `DATABASE_URL` is missing or invalid. Set it and restart the API.

- PowerShell curl errors (e.g., `-H` not recognized)
  - Use `Invoke-RestMethod` as shown instead of bash-style `curl` with `-H` and `-d`.

- Favicon not found (`/favicon.ico`)
  - Harmless; it won’t affect API functionality.

## Stopping

Press `Ctrl + C` in the terminal where the API is running.

## Optional: Webhook callbacks view

- The dashboard includes a "Callbacks" card listing recent webhook events.
- Use the Status/Search filters and the "Retry" button to trigger immediate retries.
- The background worker is controlled by `CALLBACK_WORKER` env var.
