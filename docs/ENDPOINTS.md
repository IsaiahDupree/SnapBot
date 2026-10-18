# SnapBot API Endpoints

This document lists and describes all public HTTP endpoints exposed by the SnapBot API and their expected request/response shapes.

Base URL (local):
- http://localhost:3000

Notes
- All endpoints are JSON over HTTP unless otherwise noted.
- Server-Sent Events (SSE) endpoints stream text/event-stream.
- In test automation, set environment variable `TEST_MODE=1` to return safe mock responses without launching a browser or touching the real database. Never enable `TEST_MODE` in dev/prod.
- Media policy: videos must be pre-converted to Y4M and audio to WAV before use. No auto-conversion occurs in the container.

Authentication
- None (local operator workflow). Keep your server protected behind your network.

Common Error Shape
```json
{ "ok": false, "error": "message" }
```

---

## Health & Dashboard

- GET `/health`
  - Description: API health check (queries DB unless in TEST_MODE)
  - Response: `{ ok: true, db: boolean }`

- GET `/dashboard/summary`
  - Description: Aggregated dashboard data (health, stats, recent jobs, filters, callbacks, and a machine-readable list of endpoints).
  - Response:
    ```json
    {
      "ok": true,
      "health": { "db": true, "callbacksWorker": true, "callbacksTable": true },
      "stats": { "recipients": 0, "jobStatuses": { "queued": 1 } },
      "jobs": [ /* recent jobs */ ],
      "filters": [ /* recipient filters */ ],
      "callbacks": [ /* recent webhook events */ ],
      "endpoints": [ { "method": "GET", "path": "/health", "desc": "..." } ]
    }
    ```

- GET `/favicon.ico`
  - Description: Silences browser favicon requests (returns 204 No Content).

---

## Authentication & Scraping

- POST `/login`
  - Description: Launches a Puppeteer browser and ensures the Snapchat web session is logged in (uses .env USER_NAME/USER_PASSWORD unless provided in body).
  - Body:
    ```json
    {
      "username": "optional",
      "password": "optional",
      "headless": true,
      "userDataDir": "C:\\Users\\...\\Chrome\\User Data\\Default"
    }
    ```
  - Response: `{ ok: true, logged: true }`

- GET `/listRecipients`
  - Description: Logs in (if needed) and scrapes recipients; upserts them into DB.
  - Query params: `headless=true|false`, `limit=number`, `userDataDir=path` (optional)
  - Response: `{ ok: true, count: number, recipients: [ { id, name } ] }`

- GET `/userStatus`
  - Description: Logs in (if needed) and scrapes user status information from the UI.
  - Query params: `headless=true|false`, `userDataDir=path` (optional)
  - Response: `{ ok: true, count: number, statuses: [...] }`

- GET `/recipients`
  - Description: Lists recipients from the database (no browser work).
  - Response: `{ ok: true, count: number, recipients: [ { id, name } ] }`

- GET `/recipients/search`
  - Description: Search recipients by (case-insensitive) name substring.
  - Query params: `q` (string, optional), `limit` (default 50)
  - Response: `{ ok: true, count: number, recipients: [ { id, name } ] }`

---

## Jobs (Create and Manage)

- POST `/sendSnap`
  - Description: Queue a job to capture and send an image snap.
  - Body:
    ```json
    {
      "category": "BestFriends",             // or omit and use recipients[]
      "recipients": ["Alice", "Bob"],        // optional if category provided
      "caption": "Hello from SnapBot",
      "imagePath": "C:\\path\\to\\image.png", // optional; if omitted bot captures from camera
      "captionPosition": 42,                  // optional 0-100
      "headless": true,
      "userDataDir": "C:\\Users\\...\\Chrome\\User Data\\Default",
      "callbackUrl": "https://your.webhook/endpoint" // optional
    }
    ```
  - Response: `{ ok: true, id: "<jobId>" }` (HTTP 202)

- POST `/sendVideo`
  - Description: Queue a job to record and send a video snap.
  - Body:
    ```json
    {
      "category": "BestFriends",             // or recipients[]
      "recipients": ["Alice"],               // optional if category provided
      "caption": "Video test",
      "videoPathY4M": "C:\\files\\clip.y4m",  // required (pre-converted)
      "audioPathWAV": "C:\\files\\track.wav", // required (pre-converted)
      "durationMs": 3000,
      "headless": false,
      "userDataDir": "C:\\Users\\...\\Chrome\\User Data\\Default",
      "callbackUrl": "https://your.webhook/endpoint"
    }
    ```
  - Response: `{ ok: true, id: "<jobId>" }` (HTTP 202)

- POST `/sendText`
  - Description: Queue a job to send chat message(s) to recipients by display name.
  - Body:
    ```json
    {
      "recipients": ["Alice", "Bob"],
      "message": "Hello" // or ["Hello", "How are you?"] for a sequence
      ,
      "headless": true,
      "userDataDir": "C:\\Users\\...\\Chrome\\User Data\\Default",
      "callbackUrl": "https://your.webhook/endpoint"
    }
    ```
  - Response: `{ ok: true, id: "<jobId>" }` (HTTP 202)

- GET `/jobs/:id`
  - Description: Fetch job row and associated runs from the DB.
  - Response:
    ```json
    {
      "ok": true,
      "job": { "id": "...", "type": "sendText", "status": "queued", "payload": { ... } },
      "runs": [ { "id": "...", "status": "running", "started_at": "...", "finished_at": null } ]
    }
    ```

- POST `/jobs/:id/retry`
  - Description: Retry a job using the original payload (if not currently running).
  - Response: `{ ok: true, id: "<jobId>" }` (HTTP 202)

- GET `/jobs`
  - Description: List jobs (optionally filtered) with paging.
  - Query params:
    - `status` (optional): `queued` | `running` | `failed` | `succeeded` | `cancelled`
    - `limit` (optional, default 20)
    - `offset` (optional, default 0)
  - Response: `{ ok: true, count: number, jobs: [ { id, type, status, created_at, ... } ] }`

- POST `/jobs/:id/cancel`
  - Description: Cancel a queued job only. Returns 409 if not cancellable (e.g., running).
  - Response: `{ ok: true, id: "<jobId>", status: "cancelled" }`

---

## Logs

- GET `/jobs/:id/logs`
  - Description: Fetch recent logs for a job (polling).
  - Query params: `limit` (default 200)
  - Response: `{ ok: true, count: number, logs: [ { id, level, message, meta, created_at } ] }`

- GET `/jobs/:id/logs/stream`
  - Description: Live logs stream via Server-Sent Events (SSE). Content-Type `text/event-stream`.
  - Each event line is `data: {json}\n\n` with a single log row.

---

## Recipient Filters

- GET `/filters`
  - Description: List recipient filters.
  - Response: `{ ok: true, filters: [ { id, mode, value } ] }`

- POST `/filters`
  - Description: Add a filter.
  - Body: `{ "mode": "whitelist" | "blacklist", "value": "Display Name" }`
  - Response: `{ ok: true, id: "<filterId>" }`

- DELETE `/filters`
  - Description: Remove a filter.
  - Body: `{ "mode": "whitelist" | "blacklist", "value": "Display Name" }`
  - Response: `{ ok: true, deleted: 1 }`

---

## Webhook Callbacks

- GET `/callbacks`
  - Description: List recent webhook events.
  - Response: `{ ok: true, count: number, events: [ ... ] }`

- GET `/callbacks/:id`
  - Description: Get callback event details.
  - Response: `{ ok: true, event: { id, job_id, url, payload, ... } }`

- GET `/callbacks/:id/deliveries`
  - Description: List delivery attempts for the event’s job.
  - Response: `{ ok: true, jobId: "...", deliveries: [ { attempt, status, response_code, error, sent_at } ] }`

- POST `/callbacks/retry/:id`
  - Description: Mark a callback event as pending now (worker will retry).
  - Response: `{ ok: true, id: "<eventId>" }`

- POST `/callbacks/resubmit/:id`
  - Description: Clone an existing callback event and enqueue for delivery.
  - Response: `{ ok: true, id: "<newEventId>" }`

- POST `/callbacks/resubmit`
  - Description: Enqueue a custom callback payload.
  - Body:
    ```json
    { "jobId": null, "url": "https://example.com/webhook", "payload": { "any": "json" }, "maxAttempts": 7 }
    ```
  - Response: `{ ok: true, id: "<newEventId>" }`

---

## Environment Variables

- `PORT` — API port (default 3000)
- `USER_NAME`, `USER_PASSWORD` — Snapchat credentials for scripted login
- `CALLBACK_WORKER` — set to `0` to disable callback worker; any other value enables
- `TEST_MODE` — `1` during automated tests only (returns mock responses; no DB/Puppeteer)
- Database connection variables for Postgres (see `docs/ARCHITECTURE.md`)

---

## Examples (curl)

Send text:
```bash
curl -s -X POST http://localhost:3000/sendText \
  -H "Content-Type: application/json" \
  -d '{"recipients":["Alice"],"message":"Hello","headless":true}'
```

List recent logs for a job:
```bash
curl -s "http://localhost:3000/jobs/<jobId>/logs?limit=100"
```

Add a blacklist filter:
```bash
curl -s -X POST http://localhost:3000/filters \
  -H "Content-Type: application/json" \
  -d '{"mode":"blacklist","value":"Team Snapchat"}'
```
