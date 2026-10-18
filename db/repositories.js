import pool from './pool.js';
import crypto from 'crypto';

function uuid() {
  return crypto.randomUUID();
}

// Jobs and stats helpers
export async function listJobs(limit = 20) {
  const r = await pool.query('SELECT * FROM jobs ORDER BY created_at DESC LIMIT $1', [limit]);
  return r.rows;
}

export async function countRecipients() {
  const r = await pool.query('SELECT COUNT(*)::int AS count FROM recipients');
  return r.rows[0]?.count || 0;
}

export async function jobStatusCounts() {
  const r = await pool.query("SELECT status, COUNT(*)::int AS count FROM jobs GROUP BY status");
  const map = {};
  for (const row of r.rows) map[row.status] = row.count;
  return map;
}

export async function listLogsForJob(jobId, limit = 100) {
  const r = await pool.query(
    'SELECT id, level, message, meta, created_at FROM logs WHERE job_id=$1 ORDER BY created_at ASC LIMIT $2',
    [jobId, limit]
  );
  return r.rows;
}

export async function createJob({ type, payload, callbackUrl }) {
  const id = uuid();
  await pool.query(
    'INSERT INTO jobs (id, type, payload, callback_url) VALUES ($1, $2, $3, $4)',
    [id, type, payload, callbackUrl || null]
  );
  return { id };
}

export async function updateJobStatus(id, status) {
  await pool.query('UPDATE jobs SET status=$2, updated_at=now() WHERE id=$1', [id, status]);
}

export async function getJob(id) {
  const r = await pool.query('SELECT * FROM jobs WHERE id=$1', [id]);
  return r.rows[0] || null;
}

export async function listRuns(jobId) {
  const r = await pool.query(
    'SELECT * FROM runs WHERE job_id=$1 ORDER BY started_at ASC',
    [jobId]
  );
  return r.rows;
}

export async function createRun(jobId) {
  const id = uuid();
  await pool.query('INSERT INTO runs (id, job_id) VALUES ($1, $2)', [id, jobId]);
  return { id };
}

export async function finishRun(id, status, error = null) {
  await pool.query(
    'UPDATE runs SET finished_at=now(), status=$2, error=$3 WHERE id=$1',
    [id, status, error]
  );
}

export async function recordWebhookDelivery({ jobId, attempt, status, responseCode = null, error = null }) {
  const id = uuid();
  await pool.query(
    'INSERT INTO webhook_deliveries (id, job_id, attempt, status, response_code, error) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, jobId, attempt, status, responseCode, error]
  );
  return { id };
}

// Webhook events queue
export async function enqueueWebhookEvent({ jobId, url, payload, maxAttempts = 7 }) {
  const id = uuid();
  await pool.query(
    'INSERT INTO webhook_events (id, job_id, url, payload, attempt_count, max_attempts, status, next_attempt_at, created_at, updated_at) VALUES ($1,$2,$3,$4,0,$5,\'pending\', now(), now(), now())',
    [id, jobId, url, payload, maxAttempts]
  );
  return { id };
}

export async function getDueWebhookEvents(limit = 10) {
  const r = await pool.query(
    "SELECT id, job_id, url, payload, attempt_count, max_attempts, status, next_attempt_at FROM webhook_events WHERE status='pending' AND next_attempt_at <= now() ORDER BY next_attempt_at ASC LIMIT $1",
    [limit]
  );
  return r.rows;
}

export async function updateWebhookEventAttempt({ id, success, nextAttemptAt = null, lastError = null }) {
  if (success) {
    await pool.query(
      "UPDATE webhook_events SET status='delivered', updated_at=now() WHERE id=$1",
      [id]
    );
  } else {
    // increment attempt_count, set last_error and possibly next_attempt_at or final fail
    await pool.query(
      "UPDATE webhook_events SET attempt_count=attempt_count+1, last_error=$2, next_attempt_at=$3, updated_at=now() WHERE id=$1",
      [id, lastError, nextAttemptAt]
    );
    const r = await pool.query('SELECT attempt_count, max_attempts FROM webhook_events WHERE id=$1', [id]);
    const row = r.rows[0];
    if (row && row.attempt_count >= row.max_attempts) {
      await pool.query("UPDATE webhook_events SET status='failed', updated_at=now() WHERE id=$1", [id]);
    }
  }
}

export async function listRecentWebhookEvents(limit = 50) {
  const r = await pool.query(
    `SELECT we.id, we.job_id, we.url, we.payload, we.attempt_count, we.max_attempts, we.status, we.next_attempt_at, we.last_error, we.created_at, we.updated_at,
            j.type AS job_type, j.status AS job_status
       FROM webhook_events we
       LEFT JOIN jobs j ON j.id = we.job_id
      ORDER BY we.updated_at DESC
      LIMIT $1`,
    [limit]
  );
  return r.rows;
}

export async function setWebhookEventPendingNow(id) {
  await pool.query(
    "UPDATE webhook_events SET status='pending', next_attempt_at=now(), updated_at=now() WHERE id=$1",
    [id]
  );
  return { id };
}

export async function upsertRecipients(recipients) {
  // recipients: [{ id, name }]
  if (!recipients || recipients.length === 0) return 0;
  let count = 0;
  for (const r of recipients) {
    if (!r?.id || !r?.name) continue;
    await pool.query(
      'INSERT INTO recipients (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name',
      [r.id, r.name]
    );
    count += 1;
  }
  return count;
}

export async function listRecipientsDb() {
  const r = await pool.query('SELECT id, name FROM recipients ORDER BY name ASC');
  return r.rows;
}

export async function searchRecipientsByName(q, limit = 50) {
  const pat = `%${String(q || '').toLowerCase()}%`;
  const r = await pool.query(
    'SELECT id, name FROM recipients WHERE lower(name) LIKE $1 ORDER BY name ASC LIMIT $2',
    [pat, limit]
  );
  return r.rows;
}

export async function saveLog({ jobId = null, level, message, meta = null }) {
  const id = uuid();
  await pool.query(
    'INSERT INTO logs (id, job_id, level, message, meta) VALUES ($1, $2, $3, $4, $5)',
    [id, jobId, level, message, meta]
  );
  return { id };
}

// Recipient filters (whitelist/blacklist)
export async function listRecipientFilters() {
  const r = await pool.query('SELECT id, mode, value FROM recipient_filters ORDER BY mode ASC, value ASC');
  return r.rows;
}

export async function addRecipientFilter({ mode, value }) {
  if (!mode || !value) throw new Error('mode and value are required');
  const id = uuid();
  // Ensure not duplicate by lower(value)
  const exists = await pool.query('SELECT 1 FROM recipient_filters WHERE mode=$1 AND lower(value)=lower($2)', [mode, value]);
  if (exists.rowCount > 0) return null;
  await pool.query('INSERT INTO recipient_filters (id, mode, value) VALUES ($1, $2, $3)', [id, mode, value]);
  return { id };
}

export async function removeRecipientFilter({ mode, value }) {
  if (!mode || !value) throw new Error('mode and value are required');
  const r = await pool.query('DELETE FROM recipient_filters WHERE mode=$1 AND lower(value)=lower($2)', [mode, value]);
  return { deleted: r.rowCount };
}

export async function listJobsFiltered({ status = null, limit = 20, offset = 0 } = {}) {
  limit = Number(limit) || 20;
  offset = Number(offset) || 0;
  if (status) {
    const r = await pool.query(
      'SELECT * FROM jobs WHERE status=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [status, limit, offset]
    );
    return r.rows;
  }
  const r = await pool.query(
    'SELECT * FROM jobs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return r.rows;
}

// Story Posts & Analytics
export async function createStoryPost({ storyType, mediaPath, mediaType, caption, durationSeconds, metadata = null }) {
  const id = uuid();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await pool.query(
    `INSERT INTO story_posts (id, story_type, media_path, media_type, caption, duration_seconds, expires_at, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, storyType, mediaPath, mediaType, caption, durationSeconds, expiresAt, metadata]
  );
  // Create analytics record
  await pool.query(
    'INSERT INTO story_analytics (story_post_id) VALUES ($1)',
    [id]
  );
  return { id };
}

export async function getStoryPost(id) {
  const r = await pool.query('SELECT * FROM story_posts WHERE id=$1', [id]);
  return r.rows[0] || null;
}

export async function listStoryPosts({ storyType = null, isActive = true, limit = 50 } = {}) {
  let query = 'SELECT * FROM story_posts WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (storyType) {
    query += ` AND story_type=$${paramIndex++}`;
    params.push(storyType);
  }
  if (isActive !== null) {
    query += ` AND is_active=$${paramIndex++}`;
    params.push(isActive);
  }
  query += ` ORDER BY posted_at DESC LIMIT $${paramIndex}`;
  params.push(limit);

  const r = await pool.query(query, params);
  return r.rows;
}

export async function updateStoryAnalytics(storyPostId, updates) {
  const fields = [];
  const values = [storyPostId];
  let paramIndex = 2;

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key}=$${paramIndex++}`);
    values.push(value);
  }

  if (fields.length === 0) return;

  fields.push(`last_updated_at=NOW()`);
  const query = `UPDATE story_analytics SET ${fields.join(', ')} WHERE story_post_id=$1`;
  await pool.query(query, values);
}

export async function getStoryAnalytics(storyPostId) {
  const r = await pool.query('SELECT * FROM story_analytics WHERE story_post_id=$1', [storyPostId]);
  return r.rows[0] || null;
}

export async function addStoryViewer(storyPostId, viewerName, { watchDuration = null, tookScreenshot = false, shared = false } = {}) {
  const id = uuid();
  await pool.query(
    `INSERT INTO story_viewers (id, story_post_id, viewer_name, watch_duration_seconds, took_screenshot, shared)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (story_post_id, viewer_name) 
     DO UPDATE SET 
       viewed_at=NOW(),
       watch_duration_seconds=COALESCE($4, story_viewers.watch_duration_seconds),
       took_screenshot=$5 OR story_viewers.took_screenshot,
       shared=$6 OR story_viewers.shared`,
    [id, storyPostId, viewerName, watchDuration, tookScreenshot, shared]
  );
  return { id };
}

export async function getStoryViewers(storyPostId, limit = 100) {
  const r = await pool.query(
    'SELECT * FROM story_viewers WHERE story_post_id=$1 ORDER BY viewed_at DESC LIMIT $2',
    [storyPostId, limit]
  );
  return r.rows;
}

export async function createEngagementSnapshot(storyPostId) {
  const analytics = await getStoryAnalytics(storyPostId);
  if (!analytics) return null;

  const id = uuid();
  await pool.query(
    `INSERT INTO story_engagement_snapshots (id, story_post_id, views, likes, shares, comments)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, storyPostId, analytics.total_views, analytics.total_likes, analytics.total_shares, analytics.total_comments]
  );
  return { id };
}

export async function getEngagementHistory(storyPostId, limit = 50) {
  const r = await pool.query(
    'SELECT * FROM story_engagement_snapshots WHERE story_post_id=$1 ORDER BY snapshot_at DESC LIMIT $2',
    [storyPostId, limit]
  );
  return r.rows;
}
