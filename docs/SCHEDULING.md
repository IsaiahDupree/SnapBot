# Scheduling SnapBot Jobs

This guide shows simple, reliable ways to schedule SnapBot actions to run automatically.

Use the approach that best fits your environment: Windows Task Scheduler, cron on Linux, or PM2. External orchestrators (e.g., GitHub Actions, cloud schedulers) can also call the API.

## Prerequisites

- API server running locally or in Docker (see `docs/ARCHITECTURE.md`).
- Pre-converted media for video jobs (Y4M video + WAV audio). No in-container conversion.
- Environment variables configured (see `.env.example`).

---

## Option A: Windows Task Scheduler (PowerShell)

Schedule a PowerShell command to hit the API.

Example: Send a snap daily at 12:00 PM (noon)

PowerShell command (single-line):
```powershell
$body = @{ category = 'BestFriends'; caption = 'Daily hello'; headless = $true } | ConvertTo-Json -Compress; 
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/sendSnap' -ContentType 'application/json' -Body $body
```

Send a video (requires pre-converted media mounted or locally accessible):
```powershell
$body = @{ 
  category = 'BestFriends'; 
  videoPathY4M = 'C:\\path\\to\\media\\video.y4m'; 
  audioPathWAV = 'C:\\path\\to\\media\\audio.wav'; 
  caption = 'Daily video'; 
  durationMs = 5000; 
  headless = $true 
} | ConvertTo-Json -Compress;
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/sendVideo' -ContentType 'application/json' -Body $body
```

Task Scheduler tips:
- Program/script: `powershell.exe`
- Add arguments: `-NoProfile -ExecutionPolicy Bypass -Command "<the-single-line-command>"`
- Start in (optional): project directory
- Ensure Node/API service is running when the task triggers.

---

## Option B: cron (Linux)

Use cron to call the API on a schedule.

Crontab examples (run `crontab -e`):

- Send a snap every day at 12:00 PM:
```
0 12 * * * curl -sS -X POST http://localhost:3000/sendSnap \
  -H 'Content-Type: application/json' \
  -d '{"category":"BestFriends","caption":"Daily hello","headless":true}'
```

- Send a video every day at 12:05 PM:
```
5 12 * * * curl -sS -X POST http://localhost:3000/sendVideo \
  -H 'Content-Type: application/json' \
  -d '{"category":"BestFriends","videoPathY4M":"/app/media/video.y4m","audioPathWAV":"/app/media/audio.wav","caption":"Daily video","durationMs":5000,"headless":true}'
```

If your API is running in Docker elsewhere, replace the base URL accordingly.

---

## Option C: PM2

For Node-managed scheduling, PM2 can be used in multiple ways. Two practical patterns:

1) Use PM2 to run a one-off script on a cron schedule:
```bash
pm2 start "node scripts/apiSmoke.js --sendSnap" --name snapbot-daily-snap --cron "0 12 * * *" --no-autorestart
```

```bash
pm2 start "node scripts/apiSmoke.js --sendVideo" --name snapbot-daily-video --cron "5 12 * * *" --no-autorestart \
  --update-env -- \
  VIDEO_Y4M=/app/media/video.y4m \
  AUDIO_WAV=/app/media/audio.wav \
  SNAP_CATEGORY=BestFriends \
  SNAP_CAPTION="Daily video" \
  DURATION_MS=5000
```
Notes:
- `--cron` schedules a restart (invocation) at the given time.
- `--no-autorestart` prevents PM2 from respawning after normal exit (useful for one-off jobs).
- Ensure your environment variables are set (e.g., in PM2 ecosystem or exported in the shell).

2) Use an ecosystem file with `cron_restart`:
```js
module.exports = {
  apps: [
    {
      name: 'snapbot-daily-snap',
      script: 'scripts/apiSmoke.js',
      args: '--sendSnap',
      cron_restart: '0 12 * * *',
      autorestart: false,
    },
  ],
};
```
Start with:
```bash
pm2 start ecosystem.config.js
```

---

## Option D: External Orchestrators

- GitHub Actions (scheduled workflows) hitting your public API with `curl`.
- Cloud schedulers (e.g., AWS EventBridge + Lambda, GCP Cloud Scheduler, Zapier/IFTTT) to call your API endpoints.

Example GitHub Actions workflow snippet:
```yaml
name: Daily Snap
on:
  schedule:
    - cron: '0 12 * * *'
jobs:
  send:
    runs-on: ubuntu-latest
    steps:
      - name: Send snap
        run: |
          curl -sS -X POST ${{ secrets.SNAPBOT_API_URL }}/sendSnap \
            -H 'Content-Type: application/json' \
            -d '{"category":"BestFriends","caption":"Daily hello","headless":true}'
```

---

## Tips

- Use `COOKIES_DIR` to persist sessions between runs (see `.env.example`).
- For video jobs, mount `/app/media` in Docker or ensure local paths are accessible.
- Prefer headless mode in automation unless debugging.
- Always test via `npm run api:smoke` before putting jobs on a schedule.
