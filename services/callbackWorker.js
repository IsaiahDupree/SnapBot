import fetch from 'node-fetch';
import { createLogger } from '../utils/logger.js';
import { hmacSign } from '../utils/callbacks.js';
import { getDueWebhookEvents, updateWebhookEventAttempt, recordWebhookDelivery } from '../db/repositories.js';

const log = createLogger({ service: 'callbackWorker' });

function backoffMsForAttempt(n) {
  // 1: 30s, 2: 2m, 3: 10m, 4: 30m, 5: 1h, 6: 6h, 7+: 24h
  const table = [30000, 120000, 600000, 1800000, 3600000, 21600000, 86400000];
  return table[Math.min(n - 1, table.length - 1)];
}

export function startCallbackWorker({ intervalMs = 3000, hmacSecret = process.env.CALLBACK_HMAC_SECRET } = {}) {
  let running = false;
  async function tick() {
    if (running) return;
    running = true;
    try {
      const due = await getDueWebhookEvents(10);
      if (due.length > 0) log.debug({ count: due.length }, 'Processing webhook events');
      for (const ev of due) {
        const body = JSON.stringify(ev.payload);
        const headers = { 'Content-Type': 'application/json', 'X-Job-Id': ev.job_id };
        const sig = hmacSign(body, hmacSecret);
        if (sig) headers['X-Signature'] = sig;
        let success = false;
        let status = null;
        let errorMsg = null;
        try {
          const res = await fetch(ev.url, { method: 'POST', headers, body });
          status = res.status;
          success = res.ok;
        } catch (err) {
          errorMsg = err?.message || String(err);
        }

        await recordWebhookDelivery({ jobId: ev.job_id, attempt: ev.attempt_count + 1, status: success ? 'delivered' : 'failed', responseCode: status, error: errorMsg });

        if (success) {
          await updateWebhookEventAttempt({ id: ev.id, success: true });
        } else {
          const nextDelay = backoffMsForAttempt(ev.attempt_count + 1);
          const nextAt = new Date(Date.now() + nextDelay);
          await updateWebhookEventAttempt({ id: ev.id, success: false, nextAttemptAt: nextAt.toISOString(), lastError: errorMsg || (status ? `HTTP ${status}` : 'network error') });
        }
      }
    } catch (err) {
      log.warn({ error: err?.message || String(err) }, 'Worker tick error');
    } finally {
      running = false;
    }
  }

  const timer = setInterval(tick, intervalMs);
  log.info({ intervalMs }, 'Callback worker started');
  return () => clearInterval(timer);
}
