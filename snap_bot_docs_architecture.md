# SnapBot Automation Platform — Architecture, API, and Project Plan

Last updated: 2025-09-12 22:23 EDT

This document summarizes what we’re building for SnapBot, how it’s structured, environment and deployment details, and the current implementation status with next steps.

We follow the project preferences: prefer simple solutions, avoid duplicate logic, consider dev/test/prod environments, and avoid introducing new tech when fixing issues unless necessary. Also, do not perform media conversion inside the container; require pre-converted Y4M video and WAV audio; use Postgres; use HMAC-signed webhooks; and base Docker image on the Puppeteer-maintained image.

## Goals

- Automate Snapchat Web workflows with a robust, headless-capable bot (SnapBot) powered by Puppeteer/Chromium.
- Expose an HTTP API to schedule and run jobs (send snap, send video), list recipients, and check user status.
- Persist jobs, runs, recipients, webhook deliveries, and logs in Postgres with DB migrations.
- Provide structured logging with pino to console, file, and DB (correlated by jobId).
- Package in a Docker image based on the Puppeteer-maintained base, with clear volume mounts and healthcheck.
- Support video sending with pre-converted media only (Y4M video + WAV audio), no in-container conversion.

Non-goals (for now):
- Media conversion or editing inside the container.
- Complex job orchestration beyond a single-run worker model.
- Multi-tenancy or advanced auth.

## System Architecture

- API Server: `api/server.js`
  - Express routes to submit jobs, trigger login, list recipients, and fetch user status.
  - Validates inputs and enqueues jobs that are executed asynchronously.
- Job Runner: `services/jobRunner.js`
  - Consumes jobs immediately after creation (fire-and-forget scheduling), runs SnapBot flows, sends callbacks, and logs results.
- Bot Automation: `snapbot.js`
  - Puppeteer automation of the Snapchat Web UI.
  - Key methods: `launchSnapchat()`, `ensureLoggedIn()`, `captureSnap()`, `recordVideo()`, `send()`, `listRecipients()`, `userStatus()`, `closeBrowser()`.
- Database: Postgres (`pg`)
  - Pooled connections in `db/pool.js` using `DATABASE_URL`.
  - Repositories in `db/repositories.js` (jobs, runs, recipients, webhook deliveries, logs).
  - Migrations in `migrations/`.
- Logging: `pino` via `utils/logger.js`
  - JSON logs to console and file (LOG_FILE), and structured events saved to DB (`logs` table).
- Webhooks
  - HMAC SHA-256 signed callbacks with retry/backoff; persistence of delivery attempts in DB.

## Database Schema (Migrations)

- `migrations/001_init.sql`
  - `jobs (id, type, payload, callback_url, status, created_at, updated_at)`
  - `runs (id, job_id, started_at, finished_at, status, error)`
  - `media (id, path, kind, metadata, created_at)` [foundation for potential media management]
  - `recipients (id, name)`
  - `sessions (id, account, cookies_path, created_at, updated_at)`
  - `webhook_deliveries (id, job_id, attempt, status, response_code, error, sent_at)`
  - `jobs.updated_at` trigger
- `migrations/002_logs.sql`
  - `logs (id, job_id, level, message, meta, created_at)`

Run with: `npm run migrate` (calls `scripts/migrate.js`).

## REST API

Base URL: `http://localhost:3000` (default `PORT`)

- GET `/health`
  - Returns DB connectivity status.
- POST `/login`
  - Body: `{ username?, password?, headless?, userDataDir? }`
  - Ensures a browser context launches and logs in (using env creds by default).
- POST `/sendSnap`
  - Body: `{ category: "BestFriends" | "Groups" | "Friends", caption?, headless?, userDataDir?, callbackUrl? }`
  - Creates a job to capture a photo and send to a category, then returns `202` with `id`.
- POST `/sendVideo`
  - Body: `{ category, videoPathY4M, audioPathWAV, caption?, durationMs?, headless?, userDataDir?, callbackUrl? }`
  - Pre-converted inputs required: Y4M video, WAV audio. Validates presence and wires Chromium fake device flags.
- GET `/listRecipients`
  - Query: `?headless=true&userDataDir=...`
  - Logs in, scrapes recipients, upserts into DB, and returns the list.
- GET `/userStatus`
  - Query: `?headless=true&userDataDir=...`
  - Logs in and returns per-recipient status info (type/time/streak shape).
- GET `/jobs/:id`
  - Returns job and all runs for that job.

Example: Send a video job
```bash
curl -X POST http://localhost:3000/sendVideo \
  -H "Content-Type: application/json" \
  -d '{
    "category": "BestFriends",
    "videoPathY4M": "/app/media/input.y4m",
    "audioPathWAV": "/app/media/input.wav",
    "caption": "Hey!",
    "durationMs": 5000,
    "headless": true,
    "userDataDir": "/app/data/cookies/profile",
    "callbackUrl": "https://example.com/snapbot/callback"
  }'
```

Callback Payload (HMAC signed if `CALLBACK_HMAC_SECRET` is set):
```json
{
  "id": "<job-id>",
  "type": "sendVideo",
  "status": "succeeded"
}
```
Headers include `X-Job-Id` and `X-Signature` (hex sha256 HMAC).

## Job Execution Flow

1. API validates request and creates a `jobs` record.
2. Immediately invokes `runJob()` (async) to:
   - Create a `runs` record
   - Launch Chromium with required flags (fake devices for video)
   - `ensureLoggedIn()` to Snapchat
   - Execute `captureSnap()` or `recordVideo()` then `send(category)`
   - Update run and job status
   - Save structured logs to DB
   - Send callback with retries/backoff; record webhook deliveries

## Media Handling and Video Support

- Container does not perform any transcoding. Inputs must be:
  - Video: Y4M
  - Audio: WAV
- Chromium flags used for video jobs:
  - `--use-fake-device-for-media-stream`
  - `--use-file-for-fake-video-capture=<videoPathY4M>`
  - `--use-file-for-fake-audio-capture=<audioPathWAV>`
- Ensure files exist on the mounted volume (`/app/media`).

## Configuration

`.env` (see `.env.example`, do not overwrite your existing `.env`)

- `USER_NAME`, `USER_PASSWORD` — Snapchat credentials.
- `DATABASE_URL` — Postgres connection string.
- `PORT` — API port; default 3000.
- `CALLBACK_HMAC_SECRET` — optional; enables HMAC-signed callbacks.
- `LOG_LEVEL` — pino level: trace | debug | info | warn | error | fatal.
- `LOG_FILE` — path to JSON log file; defaults to `logs/app.log` (or `/app/logs/app.log` in Docker).

## Logging and Observability

- Console and file logging via `pino` in `utils/logger.js`.
- Correlation:
  - API logs annotate routes and job IDs.
  - Job Runner attaches `jobId` to all messages.
- DB logs:
  - `saveLog({ jobId, level, message, meta })` persists structured events to `logs` table.
- Webhook deliveries:
  - Each attempt recorded with status and response codes.

## Docker

- Base image: `ghcr.io/puppeteer/puppeteer:latest` (all Chromium deps preinstalled).
- Non-root user: `pptruser`.
- Healthcheck: GET `/health`.
- Volumes:
  - `/app/media` — mount media for sending
  - `/app/logs` — persisted JSON logs
  - `/app/data/cookies` — prepared for persistent cookies (wiring into code is a small follow-up)
- CMD runs migrations then API: `node scripts/migrate.js && node api/server.js`

Example run:
```bash
docker build -t snapbot:dev .

docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgres://user:pass@host:5432/snapbot" \
  -e USER_NAME="..." \
  -e USER_PASSWORD="..." \
  -e CALLBACK_HMAC_SECRET="..." \
  -e LOG_LEVEL="info" \
  -e LOG_FILE="/app/logs/app.log" \
  -v C:\\full\\path\\to\\media:/app/media \
  -v C:\\full\\path\\to\\logs:/app/logs \
  --name snapbot snapbot:dev
```

## Security

- HMAC-signed webhooks with shared secret to prevent spoofing.
- Credentials provided via env; not stored beyond runtime.
- Chromium permissions automatically granted for camera/microphone.
- If CAPTCHA occurs, pre-login to Snapchat Web and pass a `userDataDir` (Chrome profile) to reuse cookies.

## Implementation Status

Completed
- Ensure login helper: `ensureLoggedIn()` in `snapbot.js`.
- Video capture support with fake device flags and presence checks.
- REST API endpoints: `/health`, `/login`, `/sendSnap`, `/sendVideo`, `/listRecipients`, `/userStatus`, `/jobs/:id`.
- Postgres integration and migrations.
- Webhook callbacks with retries/backoff and persistence of delivery attempts.
- Structured logging: pino to console/file and logs persisted in DB.
- Dockerfile on Puppeteer base image, healthcheck, volumes, non-root.

In Progress
- Volume-mountable cookie path wiring: redirect cookie files to `/app/data/cookies` in `snapbot.js`.
- Config/docs polish: document runtime flags and volume usage in `README.md`.

Pending / Next
- Convenience wrapper: `sendVideoTo(category, videoPathY4M, audioPathWAV, caption?)`.
- Documentation:
  - Docker usage examples
  - API reference
  - DB schema notes
  - ffmpeg conversion examples (outside container)
  - Scheduling patterns

## How to Run (Local)

- Install dependencies:
  - `npm ci`
- Configure `.env` (based on `.env.example`)
- Migrate DB:
  - `npm run migrate`
- Start API:
  - `npm run api`
- Health:
  - `GET http://localhost:3000/health`

## Known Limitations and Risks

- Snapchat Web selectors may change; we added some resilience but occasional updates may be needed.
- CAPTCHA can block automation; use `userDataDir` to reuse a pre-logged-in Chrome profile.
- Cookie persistence path follow-up: wire to `/app/data/cookies` for Docker volume persistence.
- Long videos are limited by how long the capture button is held (`durationMs`).
