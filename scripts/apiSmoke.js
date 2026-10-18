import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000';
// Determine headless mode from args or env
// Priority: --headful arg -> HEADLESS env -> default true
const rawArgs = process.argv.slice(2);
const argSet = new Set(rawArgs.map((s) => s.replace(/^--/, '')));
const envHeadless = typeof process.env.HEADLESS === 'string'
  ? !/^false|0|no$/i.test(process.env.HEADLESS)
  : true;
const HEADLESS = argSet.has('headful') ? false : envHeadless;

function log(label, obj) {
  console.log(`\n== ${label} ==`);
  if (obj !== undefined) console.log(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
}

async function req(method, path, body) {
  const url = `${API_URL}${path}`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (_) { json = text; }
  return { status: res.status, ok: res.ok, data: json };
}

async function health() {
  const r = await req('GET', '/health');
  log('GET /health', r);
  return r.ok;
}

async function login({ username, password, headless = true, userDataDir = null } = {}) {
  const body = { username, password, headless, userDataDir };
  const r = await req('POST', '/login', body);
  log('POST /login', r);
  return r.ok;
}

async function sendSnap({ category = 'BestFriends', caption = null, headless = true, userDataDir = null, callbackUrl = null } = {}) {
  const body = { category, caption, headless, userDataDir, callbackUrl };
  const r = await req('POST', '/sendSnap', body);
  log('POST /sendSnap', r);
  return r.data?.id;
}

async function sendVideo({ category = 'BestFriends', videoPathY4M, audioPathWAV, caption = null, durationMs = 5000, headless = true, userDataDir = null, callbackUrl = null } = {}) {
  const body = { category, videoPathY4M, audioPathWAV, caption, durationMs, headless, userDataDir, callbackUrl };
  const r = await req('POST', '/sendVideo', body);
  log('POST /sendVideo', r);
  return r.data?.id;
}

async function job(id) {
  const r = await req('GET', `/jobs/${id}`);
  log(`GET /jobs/${id}`, r);
  return r.ok ? r.data : null;
}

async function main() {
  const args = argSet;
  const wantLogin = args.has('login');
  const wantSendSnap = args.has('sendSnap');
  const wantSendVideo = args.has('sendVideo');

  log('SMOKE CONFIG', {
    apiUrl: API_URL,
    headless: HEADLESS,
    actions: {
      login: wantLogin,
      sendSnap: wantSendSnap,
      sendVideo: wantSendVideo,
    },
  });

  const ok = await health();
  if (!ok) process.exitCode = 1;

  if (wantLogin) {
    await login({ headless: HEADLESS, userDataDir: process.env.USER_PROFILE_DIR || null });
  }

  if (wantSendSnap) {
    const id = await sendSnap({ category: process.env.SNAP_CATEGORY || 'BestFriends', caption: process.env.SNAP_CAPTION || null, headless: HEADLESS, userDataDir: process.env.USER_PROFILE_DIR || null, callbackUrl: process.env.CALLBACK_URL || null });
    if (id) {
      // brief wait, then fetch job details
      await new Promise((r) => setTimeout(r, 1500));
      await job(id);
    }
  }

  if (wantSendVideo) {
    const videoPathY4M = process.env.VIDEO_Y4M;
    const audioPathWAV = process.env.AUDIO_WAV;
    if (!videoPathY4M || !audioPathWAV) {
      console.warn('VIDEO_Y4M and AUDIO_WAV env vars are required for --sendVideo');
    } else {
      const id = await sendVideo({ category: process.env.SNAP_CATEGORY || 'BestFriends', videoPathY4M, audioPathWAV, caption: process.env.SNAP_CAPTION || null, durationMs: Number(process.env.DURATION_MS || 5000), headless: HEADLESS, userDataDir: process.env.USER_PROFILE_DIR || null, callbackUrl: process.env.CALLBACK_URL || null });
      if (id) {
        await new Promise((r) => setTimeout(r, 1500));
        await job(id);
      }
    }
  }
}

main().catch((e) => {
  console.error('apiSmoke failed:', e);
  process.exit(1);
});
