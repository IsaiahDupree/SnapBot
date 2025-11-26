import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import pool from '../db/pool.js';
import {
  createJob,
  getJob,
  listRuns,
  upsertRecipients,
  listRecipientFilters,
  addRecipientFilter,
  removeRecipientFilter,
  listJobs,
  listJobsFiltered,
  countRecipients,
  jobStatusCounts,
  listLogsForJob,
  listRecentWebhookEvents,
  setWebhookEventPendingNow,
  enqueueWebhookEvent,
  listRecipientsDb,
  searchRecipientsByName,
  updateJobStatus,
} from '../db/repositories.js';
import { runJob } from '../services/jobRunner.js';
import SnapBot from '../snapbot.js';
import { createLogger } from '../utils/logger.js';

dotenv.config();

const app = express();
app.use(express.json());

const log = createLogger({ service: 'api' });
const TEST_MODE = process.env.TEST_MODE === '1';

// Search recipients by name (DB)
app.get('/recipients/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    if (TEST_MODE) {
      const sample = [ { id: 'id-1', name: 'Alice' }, { id: 'id-2', name: 'Bob' } ];
      const filtered = q ? sample.filter(r => r.name.toLowerCase().includes(q.toLowerCase())) : sample;
      return res.json({ ok: true, count: Math.min(filtered.length, limit), recipients: filtered.slice(0, limit) });
    }
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const rows = await searchRecipientsByName(q, limit);
    res.json({ ok: true, count: rows.length, recipients: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Favicon (avoid 404 noise)
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// List recipients from DB (for quick-pick)
app.get('/recipients', async (_req, res) => {
  try {
    if (TEST_MODE) return res.json({ ok: true, count: 2, recipients: [ { id: 'id-1', name: 'Alice' }, { id: 'id-2', name: 'Bob' } ] });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const rows = await listRecipientsDb();
    res.json({ ok: true, count: rows.length, recipients: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Callback details
app.get('/callbacks/:id', async (req, res) => {
  try {
    if (TEST_MODE) return res.json({ ok: true, event: { id: req.params.id, job_id: 'job-1', url: 'https://example.com', payload: { a: 1 }, status: 'pending' } });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const r = await pool.query('SELECT * FROM webhook_events WHERE id=$1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, event: r.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Callback deliveries history (by event -> job_id)
app.get('/callbacks/:id/deliveries', async (req, res) => {
  try {
    if (TEST_MODE) return res.json({ ok: true, jobId: 'job-1', deliveries: [] });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const r = await pool.query('SELECT job_id FROM webhook_events WHERE id=$1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ ok: false, error: 'Not found' });
    const jobId = r.rows[0].job_id;
    const d = await pool.query(
      'SELECT attempt, status, response_code, error, sent_at FROM webhook_deliveries WHERE job_id=$1 ORDER BY sent_at DESC LIMIT 50',
      [jobId]
    );
    res.json({ ok: true, jobId, deliveries: d.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Retry a failed/pending callback now
app.post('/callbacks/retry/:id', async (req, res) => {
  try {
    if (TEST_MODE) return res.json({ ok: true, id: req.params.id });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const { id } = req.params;
    await setWebhookEventPendingNow(id);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Serve static dashboard assets from /public
const staticDir = path.resolve(process.cwd(), 'public');
app.use(express.static(staticDir));

app.get('/health', async (_req, res) => {
  try {
    if (TEST_MODE) return res.json({ ok: true, db: true });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const r = await pool.query('SELECT 1 as ok');
    res.json({ ok: true, db: r.rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Callbacks list
app.get('/callbacks', async (_req, res) => {
  try {
    if (TEST_MODE) return res.json({ ok: true, count: 0, events: [] });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const events = await listRecentWebhookEvents(50);
    res.json({ ok: true, count: events.length, events });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Dashboard summary endpoint used by the frontend
app.get('/dashboard/summary', async (_req, res) => {
  try {
    if (TEST_MODE) {
      const endpoints = [
        { method: 'GET', path: '/health', desc: 'API health check (queries DB)' },
        { method: 'GET', path: '/dashboard/summary', desc: 'Dashboard summary (reads jobs, filters, callbacks from DB)' },
        { method: 'POST', path: '/login', desc: 'Launch browser and ensure login' },
        { method: 'GET', path: '/listRecipients', desc: 'Scrape recipients; upserts into DB (supports headless and limit)' },
        { method: 'GET', path: '/recipients', desc: 'List recipients from DB (for quick-pick)' },
        { method: 'GET', path: '/recipients/search', desc: 'Search recipients by name (DB)' },
        { method: 'GET', path: '/userStatus', desc: 'Scrape visible user statuses' },
        { method: 'POST', path: '/sendSnap', desc: 'Capture and send image snap (category or recipients[]). Writes job to DB' },
        { method: 'POST', path: '/sendVideo', desc: 'Record and send video (Y4M/WAV). Writes job to DB' },
        { method: 'POST', path: '/sendText', desc: 'Send chat text to recipients[]. Writes job to DB' },
        { method: 'GET', path: '/jobs', desc: 'List jobs with optional status, limit, offset (DB)' },
        { method: 'GET', path: '/jobs/:id', desc: 'Fetch job status and runs (DB)' },
        { method: 'GET', path: '/jobs/:id/logs', desc: 'Fetch logs for a job (DB)' },
        { method: 'GET', path: '/jobs/:id/logs/stream', desc: 'Live logs via Server-Sent Events (DB)' },
        { method: 'POST', path: '/jobs/:id/retry', desc: 'Retry a job now (DB)' },
        { method: 'POST', path: '/jobs/:id/cancel', desc: 'Cancel a queued job (DB)' },
        { method: 'GET', path: '/filters', desc: 'List whitelist/blacklist (DB)' },
        { method: 'POST', path: '/filters', desc: 'Add a filter: { mode, value } (DB)' },
        { method: 'DELETE', path: '/filters', desc: 'Remove a filter: { mode, value } (DB)' },
        { method: 'GET', path: '/callbacks', desc: 'List recent webhook events (DB)' },
        { method: 'GET', path: '/callbacks/:id', desc: 'Get callback event details (DB)' },
        { method: 'GET', path: '/callbacks/:id/deliveries', desc: 'List deliveries for the event\'s job (DB)' },
        { method: 'POST', path: '/callbacks/retry/:id', desc: 'Retry a callback event immediately (DB)' },
        { method: 'POST', path: '/callbacks/resubmit/:id', desc: 'Clone an event and enqueue for delivery (DB)' },
        { method: 'POST', path: '/callbacks/resubmit', desc: 'Enqueue a custom payload to a URL (DB)' },
      ];
      return res.json({ ok: true, health: { db: true, callbacksWorker: true, callbacksTable: true }, stats: { recipients: 2, jobStatuses: {} }, jobs: [], filters: [], callbacks: [], endpoints });
    }
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const dbR = await pool.query('SELECT 1 as ok');
    const dbOk = dbR.rows[0].ok === 1;
    // Health: callbacks worker and table existence
    const workerOn = process.env.CALLBACK_WORKER !== '0';
    let callbacksTable = false;
    try {
      const tr = await pool.query("SELECT to_regclass('public.webhook_events') AS r");
      callbacksTable = Boolean(tr.rows?.[0]?.r);
    } catch (_) { callbacksTable = false; }
    // Resilient sections
    let recipientsCount = 0;
    let statusCounts = {};
    let jobs = [];
    let filters = [];
    let callbacks = [];

    try { recipientsCount = await countRecipients(); } catch (e) { log.warn({ section: 'countRecipients', error: e.message }, 'Summary section error'); }
    try { statusCounts = await jobStatusCounts(); } catch (e) { log.warn({ section: 'jobStatusCounts', error: e.message }, 'Summary section error'); }
    try { jobs = await listJobs(20); } catch (e) { log.warn({ section: 'listJobs', error: e.message }, 'Summary section error'); }
    try { filters = await listRecipientFilters(); } catch (e) { log.warn({ section: 'listRecipientFilters', error: e.message }, 'Summary section error'); }
    try { callbacks = await listRecentWebhookEvents(20); } catch (e) { log.warn({ section: 'listRecentWebhookEvents', error: e.message }, 'Summary section error'); }

    const endpoints = [
      { method: 'GET', path: '/health', desc: 'API health check (queries DB)' },
      { method: 'GET', path: '/dashboard/summary', desc: 'Dashboard summary (reads jobs, filters, callbacks from DB)' },
      { method: 'POST', path: '/login', desc: 'Launch browser and ensure login' },
      { method: 'GET', path: '/listRecipients', desc: 'Scrape recipients; upserts into DB (supports headless and limit)' },
      { method: 'GET', path: '/recipients', desc: 'List recipients from DB (for quick-pick)' },
      { method: 'GET', path: '/recipients/search', desc: 'Search recipients by name (DB)' },
      { method: 'GET', path: '/userStatus', desc: 'Scrape visible user statuses' },
      { method: 'POST', path: '/sendSnap', desc: 'Capture and send image snap (category or recipients[]). Writes job to DB' },
      { method: 'POST', path: '/sendVideo', desc: 'Record and send video (Y4M/WAV). Writes job to DB' },
      { method: 'POST', path: '/sendText', desc: 'Send chat text to recipients[]. Writes job to DB' },
      { method: 'GET', path: '/jobs', desc: 'List jobs with optional status, limit, offset (DB)' },
      { method: 'GET', path: '/jobs/:id', desc: 'Fetch job status and runs (DB)' },
      { method: 'GET', path: '/jobs/:id/logs', desc: 'Fetch logs for a job (DB)' },
      { method: 'GET', path: '/jobs/:id/logs/stream', desc: 'Live logs via Server-Sent Events (DB)' },
      { method: 'POST', path: '/jobs/:id/retry', desc: 'Retry a job now (DB)' },
      { method: 'POST', path: '/jobs/:id/cancel', desc: 'Cancel a queued job (DB)' },
      { method: 'GET', path: '/filters', desc: 'List whitelist/blacklist (DB)' },
      { method: 'POST', path: '/filters', desc: 'Add a filter: { mode, value } (DB)' },
      { method: 'DELETE', path: '/filters', desc: 'Remove a filter: { mode, value } (DB)' },
      { method: 'GET', path: '/callbacks', desc: 'List recent webhook events (DB)' },
      { method: 'GET', path: '/callbacks/:id', desc: 'Get callback event details (DB)' },
      { method: 'GET', path: '/callbacks/:id/deliveries', desc: 'List deliveries for the event\'s job (DB)' },
      { method: 'POST', path: '/callbacks/retry/:id', desc: 'Retry a callback event immediately (DB)' },
      { method: 'POST', path: '/callbacks/resubmit/:id', desc: 'Clone an event and enqueue for delivery (DB)' },
      { method: 'POST', path: '/callbacks/resubmit', desc: 'Enqueue a custom payload to a URL (DB)' },
    ];

    res.json({
      ok: true,
      health: { db: dbOk, callbacksWorker: workerOn, callbacksTable },
      stats: { recipients: recipientsCount, jobStatuses: statusCounts },
      jobs,
      filters,
      callbacks,
      endpoints,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

function bad(res, msg) {
  return res.status(400).json({ ok: false, error: msg });
}

app.post('/sendSnap', async (req, res) => {
  try {
    if (TEST_MODE) return res.status(202).json({ ok: true, id: 'job-test-snap' });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const { category, caption, headless, userDataDir, callbackUrl, recipients, imagePath, captionPosition } = req.body || {};
    if (!category && (!Array.isArray(recipients) || recipients.length === 0)) return bad(res, 'Either category or recipients[] is required');

    const payload = {
      category: category || null,
      recipients: Array.isArray(recipients) && recipients.length ? recipients : null,
      caption: caption || null,
      imagePath: imagePath || null,
      captionPosition: typeof captionPosition === 'number' ? captionPosition : null,
      headless: headless ?? true,
      userDataDir: userDataDir || null,
    };
    const { id } = await createJob({ type: 'sendSnap', payload, callbackUrl });
    const job = { id, type: 'sendSnap', payload };
    log.info({ jobId: id, route: '/sendSnap' }, 'Enqueued job');
    setImmediate(() => runJob(job).catch(() => {}));
    res.status(202).json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/sendVideo', async (req, res) => {
  try {
    if (TEST_MODE) return res.status(202).json({ ok: true, id: 'job-test-video' });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const { category, caption, headless, userDataDir, callbackUrl, videoPathY4M, audioPathWAV, durationMs, recipients } = req.body || {};
    if (!category && (!Array.isArray(recipients) || recipients.length === 0)) return bad(res, 'Either category or recipients[] is required');
    if (!videoPathY4M) return bad(res, 'videoPathY4M is required (pre-converted Y4M)');
    if (!audioPathWAV) return bad(res, 'audioPathWAV is required (WAV)');

    const payload = {
      category: category || null,
      recipients: Array.isArray(recipients) && recipients.length ? recipients : null,
      caption: caption || null,
      headless: headless ?? true,
      userDataDir: userDataDir || null,
      videoPathY4M,
      audioPathWAV,
      durationMs: durationMs ?? 5000,
    };
    const { id } = await createJob({ type: 'sendVideo', payload, callbackUrl });
    const job = { id, type: 'sendVideo', payload };
    log.info({ jobId: id, route: '/sendVideo' }, 'Enqueued job');
    setImmediate(() => runJob(job).catch(() => {}));
    res.status(202).json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// New: Send text message(s) to specific recipients by name
app.post('/sendText', async (req, res) => {
  try {
    if (TEST_MODE) return res.status(202).json({ ok: true, id: 'job-test-text' });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const { recipients, message, headless, userDataDir, callbackUrl } = req.body || {};
    if (!Array.isArray(recipients) || recipients.length === 0) return bad(res, 'recipients[] is required');
    if (typeof message !== 'string' && !Array.isArray(message)) return bad(res, 'message must be string or string[]');

    const payload = {
      recipients,
      message,
      headless: headless ?? true,
      userDataDir: userDataDir || null,
    };
    const { id } = await createJob({ type: 'sendText', payload, callbackUrl });
    const job = { id, type: 'sendText', payload };
    log.info({ jobId: id, route: '/sendText' }, 'Enqueued job');
    setImmediate(() => runJob(job).catch(() => {}));
    res.status(202).json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/jobs/:id', async (req, res) => {
  try {
    if (TEST_MODE) return res.json({ ok: true, job: { id: req.params.id, type: 'sendText', status: 'queued' }, runs: [] });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ ok: false, error: 'Not found' });
    const runs = await listRuns(job.id);
    res.json({ ok: true, job, runs });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Jobs list with optional status and paging
app.get('/jobs', async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    if (TEST_MODE) {
      const rows = [
        { id: 'job-1', type: 'sendText', status: 'queued', created_at: new Date().toISOString() },
        { id: 'job-2', type: 'sendSnap', status: 'succeeded', created_at: new Date().toISOString() },
      ];
      const filtered = status ? rows.filter(r => r.status === status) : rows;
      return res.json({ ok: true, count: filtered.length, jobs: filtered.slice(offset, offset + limit) });
    }
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const rows = await listJobsFiltered({ status, limit, offset });
    res.json({ ok: true, count: rows.length, jobs: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Recent logs for a job (polling)
app.get('/jobs/:id/logs', async (req, res) => {
  try {
    if (TEST_MODE) return res.json({ ok: true, count: 0, logs: [] });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ ok: false, error: 'Not found' });
    const limit = req.query.limit ? Number(req.query.limit) : 200;
    const logs = await listLogsForJob(job.id, limit);
    res.json({ ok: true, count: logs.length, logs });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Live logs via Server-Sent Events
app.get('/jobs/:id/logs/stream', async (req, res) => {
  try {
    if (TEST_MODE) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write(`data: {"level":"info","message":"test","created_at":"${new Date().toISOString()}"}\n\n`);
      res.end();
      return;
    }
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ ok: false, error: 'Not found' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let lastTs = new Date(0).toISOString();
    let closed = false;

    const send = (obj) => {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    };

    // Send initial batch
    try {
      const initial = await listLogsForJob(job.id, 200);
      initial.forEach((row) => send(row));
      if (initial.length > 0) lastTs = initial[initial.length - 1].created_at;
    } catch (_) {}

    const iv = setInterval(async () => {
      if (closed) return;
      try {
        const r = await pool.query(
          'SELECT id, level, message, meta, created_at FROM logs WHERE job_id=$1 AND created_at > $2 ORDER BY created_at ASC LIMIT 200',
          [job.id, lastTs]
        );
        if (r.rows.length > 0) {
          r.rows.forEach((row) => send(row));
          lastTs = r.rows[r.rows.length - 1].created_at;
        }
      } catch (_) {}
    }, 1000);

    req.on('close', () => {
      closed = true;
      clearInterval(iv);
      res.end();
    });
  } catch (e) {
    res.status(500).end();
  }
});

// Auth/session & scraping endpoints
app.post('/login', async (req, res) => {
  const { USER_NAME, USER_PASSWORD } = process.env;
  const { username, password, headless, userDataDir } = req.body || {};
  const creds = { username: username || USER_NAME, password: password || USER_PASSWORD };

  const commonArgs = [
    '--start-maximized',
    '--force-device-scale-factor=1',
    '--allow-file-access-from-files',
    '--use-fake-ui-for-media-stream',
    '--enable-media-stream',
  ];
  const launchOptions = { headless: headless ?? true, args: [...commonArgs] };
  if (userDataDir) launchOptions.userDataDir = userDataDir;

  if (TEST_MODE) return res.json({ ok: true, logged: true });
  const bot = new SnapBot();
  try {
    await bot.launchSnapchat(launchOptions);
    const logged = await bot.ensureLoggedIn(creds, { handlePopup: true, retry: 1 });
    await bot.closeBrowser();
    log.info({ route: '/login', logged: !!logged }, 'Login attempt');
    res.json({ ok: true, logged: !!logged });
  } catch (e) {
    try { await bot.closeBrowser(); } catch (_) {}
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Retry a job by ID (re-run using existing payload)
app.post('/jobs/:id/retry', async (req, res) => {
  try {
    if (TEST_MODE) return res.status(202).json({ ok: true, id: req.params.id });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ ok: false, error: 'Not found' });
    if (job.status === 'running') return res.status(409).json({ ok: false, error: 'Job already running' });
    const retryJob = { id: job.id, type: job.type, payload: job.payload };
    setImmediate(() => runJob(retryJob).catch(() => {}));
    res.status(202).json({ ok: true, id: job.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Cancel a queued job
app.post('/jobs/:id/cancel', async (req, res) => {
  try {
    if (TEST_MODE) return res.json({ ok: true, id: req.params.id, status: 'cancelled' });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ ok: false, error: 'Not found' });
    if (job.status !== 'queued') return res.status(409).json({ ok: false, error: 'Job not cancellable' });
    await updateJobStatus(job.id, 'cancelled');
    res.json({ ok: true, id: job.id, status: 'cancelled' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Resubmit a callback by cloning an existing event
app.post('/callbacks/resubmit/:id', async (req, res) => {
  try {
    if (TEST_MODE) return res.json({ ok: true, id: 'cb-new' });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const r = await pool.query('SELECT job_id, url, payload FROM webhook_events WHERE id=$1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ ok: false, error: 'Not found' });
    const row = r.rows[0];
    const { id } = await enqueueWebhookEvent({ jobId: row.job_id, url: row.url, payload: row.payload, maxAttempts: 7 });
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Resubmit a callback with custom URL and payload
app.post('/callbacks/resubmit', async (req, res) => {
  try {
    if (TEST_MODE) return res.json({ ok: true, id: 'cb-new' });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const { jobId = null, url, payload, maxAttempts = 7 } = req.body || {};
    if (!url) return bad(res, 'url is required');
    if (payload === undefined) return bad(res, 'payload is required');
    const { id } = await enqueueWebhookEvent({ jobId, url, payload, maxAttempts });
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/listRecipients', async (req, res) => {
  const { USER_NAME, USER_PASSWORD } = process.env;
  const headless = req.query.headless ? req.query.headless === 'true' : true;
  const userDataDir = req.query.userDataDir || null;
  const limit = req.query.limit ? Number(req.query.limit) : null;
  const creds = { username: USER_NAME, password: USER_PASSWORD };

  const commonArgs = [
    '--start-maximized',
    '--force-device-scale-factor=1',
    '--allow-file-access-from-files',
    '--use-fake-ui-for-media-stream',
    '--enable-media-stream',
  ];
  const launchOptions = { headless, args: [...commonArgs] };
  if (userDataDir) launchOptions.userDataDir = userDataDir;
  if (TEST_MODE) return res.json({ ok: true, count: 2, recipients: [ { id: 'id-1', name: 'Alice' }, { id: 'id-2', name: 'Bob' } ] });

  const bot = new SnapBot();
  try {
    await bot.launchSnapchat(launchOptions);
    const logged = await bot.ensureLoggedIn(creds, { handlePopup: true, retry: 1 });
    if (!logged) throw new Error('Login not confirmed');
    const recipients = await bot.listRecipients(limit || undefined);
    await upsertRecipients(recipients);
    await bot.closeBrowser();
    res.json({ ok: true, count: recipients.length, recipients });
  } catch (e) {
    try { await bot.closeBrowser(); } catch (_) {}
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/userStatus', async (req, res) => {
  const { USER_NAME, USER_PASSWORD } = process.env;
  const headless = req.query.headless ? req.query.headless === 'true' : true;
  const userDataDir = req.query.userDataDir || null;
  const creds = { username: USER_NAME, password: USER_PASSWORD };

  const commonArgs = [
    '--start-maximized',
    '--force-device-scale-factor=1',
    '--allow-file-access-from-files',
    '--use-fake-ui-for-media-stream',
    '--enable-media-stream',
  ];
  const launchOptions = { headless, args: [...commonArgs] };
  if (userDataDir) launchOptions.userDataDir = userDataDir;

  if (TEST_MODE) return res.json({ ok: true, count: 0, statuses: [] });

  const bot = new SnapBot();
  try {
    await bot.launchSnapchat(launchOptions);
    const logged = await bot.ensureLoggedIn(creds, { handlePopup: true, retry: 1 });
    if (!logged) throw new Error('Login not confirmed');
    const statuses = await bot.userStatus();
    await bot.closeBrowser();
    res.json({ ok: true, count: statuses.length, statuses });
  } catch (e) {
    try { await bot.closeBrowser(); } catch (_) {}
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Recipient filters
app.get('/filters', async (_req, res) => {
  try {
    if (TEST_MODE) return res.json({ ok: true, filters: [] });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const filters = await listRecipientFilters();
    res.json({ ok: true, filters });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/filters', async (req, res) => {
  try {
    if (TEST_MODE) return res.json({ ok: true, id: 'filter-1' });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const { mode, value } = req.body || {};
    if (!mode || !value) return res.status(400).json({ ok: false, error: 'mode and value are required' });
    const r = await addRecipientFilter({ mode, value });
    res.json({ ok: true, id: r?.id || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete('/filters', async (req, res) => {
  try {
    if (TEST_MODE) return res.json({ ok: true, deleted: 1 });
    if (!pool) return res.status(503).json({ ok: false, error: 'DB not configured' });
    const { mode, value } = req.body || {};
    if (!mode || !value) return res.status(400).json({ ok: false, error: 'mode and value are required' });
    const r = await removeRecipientFilter({ mode, value });
    res.json({ ok: true, deleted: r.deleted });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default app;
