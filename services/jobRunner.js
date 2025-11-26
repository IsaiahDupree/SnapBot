import dotenv from 'dotenv';
import fs from 'fs';
import SnapBot from '../snapbot.js';
import {
  createRun,
  finishRun,
  updateJobStatus,
  getJob,
  recordWebhookDelivery,
  saveLog,
  listRecipientFilters,
} from '../db/repositories.js';
import { enqueueWebhookEvent } from '../db/repositories.js';
import { createLogger } from '../utils/logger.js';

dotenv.config();

const { USER_NAME, USER_PASSWORD } = process.env;

const baseLog = createLogger({ service: 'jobRunner' });

// (Callback signing now happens in callbackWorker via utils/callbacks)

export async function runJob(job) {
  const log = baseLog.child({ jobId: job.id, type: job.type });
  await saveLog({ jobId: job.id, level: 'info', message: 'Job started', meta: { type: job.type } });
  const run = await createRun(job.id);
  await updateJobStatus(job.id, 'running');
  log.info({ runId: run.id }, 'Run created');

  const credentials = {
    username: USER_NAME || job.payload?.username,
    password: USER_PASSWORD || job.payload?.password,
  };

  const bot = new SnapBot();
  let ok = false;
  let errorMsg = null;
  let launched = false;

  try {
    const headless = job.payload?.headless ?? true;
    // Build filter-aware recipient list if configured and no explicit recipients were provided
    let filteredRecipients = null;
    try {
      const filters = await listRecipientFilters();
      if (filters && filters.length > 0 && !(Array.isArray(job.payload?.recipients) && job.payload.recipients.length > 0)) {
        const whitelist = new Set(filters.filter(f => f.mode === 'whitelist').map(f => String(f.value).toLowerCase()));
        const blacklist = new Set(filters.filter(f => f.mode === 'blacklist').map(f => String(f.value).toLowerCase()));
        const known = await bot.listRecipients();
        const names = known.map(r => r.name);
        let allowed;
        if (whitelist.size > 0) {
          allowed = names.filter(n => whitelist.has(n.toLowerCase()) && !blacklist.has(n.toLowerCase()));
        } else {
          allowed = names.filter(n => !blacklist.has(n.toLowerCase()));
        }
        if (allowed.length > 0) filteredRecipients = allowed;
      }
    } catch (_) {}

    if (job.type === 'sendVideo') {
      const videoPath = job.payload?.videoPathY4M;
      const audioPath = job.payload?.audioPathWAV;
      const caption = job.payload?.caption || null;
      const durationMs = job.payload?.durationMs ?? 5000;
      if (!videoPath || !audioPath) throw new Error('videoPathY4M and audioPathWAV are required');
      if (!fs.existsSync(videoPath)) throw new Error(`Video file not found: ${videoPath}`);
      if (!fs.existsSync(audioPath)) throw new Error(`Audio file not found: ${audioPath}`);
      log.info({ hasCaption: !!caption, durationMs }, 'Delegating to sendVideoTo wrapper');
      await bot.sendVideoTo(
        job.payload?.category || 'BestFriends',
        videoPath,
        audioPath,
        caption,
        {
          durationMs,
          headless,
          userDataDir: job.payload?.userDataDir || undefined,
          username: credentials.username,
          password: credentials.password,
          recipients: (job.payload?.recipients && job.payload.recipients.length > 0) ? job.payload.recipients : (filteredRecipients || null),
        }
      );
      ok = true;
    } else {
      const commonArgs = [
        '--start-maximized',
        '--force-device-scale-factor=1',
        '--allow-file-access-from-files',
        '--use-fake-ui-for-media-stream',
        '--enable-media-stream',
      ];
      const launchOptions = { headless, args: [...commonArgs] };
      if (job.payload?.userDataDir) {
        launchOptions.userDataDir = job.payload.userDataDir;
      }

      log.info({ headless, hasUserDataDir: !!launchOptions.userDataDir }, 'Launching browser');
      await bot.launchSnapchat(launchOptions);
      launched = true;
      const logged = await bot.ensureLoggedIn(credentials, { handlePopup: true, retry: 1 });
      if (!logged) throw new Error('Login not confirmed');
      log.info('Logged in to Snapchat');

      if (job.type === 'sendSnap') {
        const caption = job.payload?.caption || null;
        const imagePath = job.payload?.imagePath || null;
        const captionPosition = job.payload?.captionPosition ?? null;
        log.info({ hasCaption: !!caption, hasImage: !!imagePath, captionPosition }, 'Capturing snap');
        await bot.captureSnap({ caption, path: imagePath, position: captionPosition });
        if (Array.isArray(job.payload?.recipients) && job.payload.recipients.length > 0) {
          log.info({ recipients: job.payload.recipients.length }, 'Sending to specific recipients');
          await bot.sendToRecipients(job.payload.recipients);
        } else if (Array.isArray(filteredRecipients) && filteredRecipients.length > 0) {
          log.info({ recipients: filteredRecipients.length }, 'Sending to filtered recipients');
          await bot.sendToRecipients(filteredRecipients);
        } else {
          log.info({ category: job.payload?.category }, 'Sending to category');
          await bot.send(job.payload?.category || 'BestFriends');
        }
        await bot.wait(1000);
        await bot.closeBrowser();
        launched = false;
        ok = true;
      } else if (job.type === 'sendText') {
        const recipients = job.payload?.recipients || [];
        const message = job.payload?.message ?? '';
        if (!Array.isArray(recipients) || recipients.length === 0) throw new Error('recipients[] required for sendText');
        log.info({ recipients: recipients.length, isArrayMessage: Array.isArray(message) }, 'Sending text');
        if (typeof bot.sendTextToRecipients !== 'function') throw new Error('Text send not implemented');
        await bot.sendTextToRecipients(recipients, message);
        await bot.wait(500);
        await bot.closeBrowser();
        launched = false;
        ok = true;
      } else {
        throw new Error(`Unknown job type: ${job.type}`);
      }
    }
  } catch (err) {
    errorMsg = err?.message || String(err);
    log.error({ error: errorMsg }, 'Job failed');
    if (launched) {
      try { await bot.closeBrowser(); } catch (_) {}
    }
  }

  if (ok) {
    await finishRun(run.id, 'succeeded', null);
    await updateJobStatus(job.id, 'succeeded');
    log.info('Run succeeded');
    await saveLog({ jobId: job.id, level: 'info', message: 'Job succeeded' });
  } else {
    await finishRun(run.id, 'failed', errorMsg);
    await updateJobStatus(job.id, 'failed');
    await saveLog({ jobId: job.id, level: 'error', message: 'Job failed', meta: { error: errorMsg } });
  }

  // Enqueue callback for background delivery with retries
  const updatedJob = await getJob(job.id);
  if (updatedJob?.callback_url) {
    const payload = { id: updatedJob.id, type: updatedJob.type, status: updatedJob.status };
    await enqueueWebhookEvent({ jobId: updatedJob.id, url: updatedJob.callback_url, payload, maxAttempts: 7 });
  }
}

