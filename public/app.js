const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const formatTime = (s) => {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d)) return String(s);
  return d.toLocaleString();
};

// Utility: parse recipients list from comma/newline separated text
function parseRecipientsList(text) {
  return (text || '').split(/[\n,]/).map(s => s.trim()).filter(Boolean);
}

// Toast notifications
function toast(message, type = 'ok', ms = 2200) {
  const el = document.getElementById('toast');
  if (!el) return alert(message);
  el.textContent = message;
  el.classList.remove('ok', 'fail');
  el.classList.add(type === 'fail' ? 'fail' : 'ok');
  el.hidden = false;
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => { el.hidden = true; }, ms);
}

// Theme handling
function applyTheme(theme) {
  if (theme === 'system') {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

// Scrollspy for sidebar and Back-to-top
function initScrollSpy() {
  const links = Array.from(document.querySelectorAll('.side a[href^="#"]'));
  const targets = links
    .map(a => ({ a, id: a.getAttribute('href').slice(1), el: null }))
    .map(x => ({ ...x, el: document.getElementById(x.id) }))
    .filter(x => x.el);

  if (targets.length === 0) return;

  const setActive = (id) => {
    links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
    try { localStorage.setItem('sb_active_section', id); } catch (_) {}
  };

  const observer = new IntersectionObserver((entries) => {
    // Choose the most visible section in viewport
    const visible = entries
      .filter(e => e.isIntersecting)
      .sort((a,b) => b.intersectionRatio - a.intersectionRatio);
    if (visible[0]) setActive(visible[0].target.id);
  }, { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });

  targets.forEach(t => observer.observe(t.el));

  // Restore last active on load
  const last = localStorage.getItem('sb_active_section');
  if (last) {
    const el = document.getElementById(last);
    if (el) {
      setActive(last);
      // don't auto-scroll aggressively; highlight is enough
    }
  }

  // Back-to-top button
  const btt = document.getElementById('backToTop');
  if (btt) {
    const onScroll = () => {
      if (window.scrollY > 320) btt.classList.add('show'); else btt.classList.remove('show');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    btt.addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
}

function initTheme() {
  const sel = document.getElementById('themeSelect');
  const saved = localStorage.getItem('sb_theme') || 'light';
  sel.value = saved;
  applyTheme(saved);
  sel.addEventListener('change', () => {
    const v = sel.value;
    localStorage.setItem('sb_theme', v);
    applyTheme(v);
  });

  // Send Text form
  function parseMessage(text) {
    const lines = (text || '').split(/\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length <= 1) return lines[0] || '';
    return lines; // array of messages
  }
  document.getElementById('sendTextForm')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const recipients = parseRecipientsList(form.recipientsText.value);
    const message = parseMessage(form.messageText.value);
    const headless = form.headless.value === 'true';
    const userDataDir = form.userDataDir.value?.trim() || null;
    const callbackUrl = form.callbackUrl.value?.trim() || null;
    if (recipients.length === 0) { alert('Recipients are required'); return; }
    if (!message || (Array.isArray(message) && message.length === 0)) { alert('Message is required'); return; }
    const payload = { recipients, message, headless, userDataDir, callbackUrl };
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      const res = await fetchJSON('/sendText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (userDataDir) { try { localStorage.setItem('sb_userDataDir', userDataDir); } catch (_) {} }
      toast(`Text job queued. Job ID: ${res.id}`, 'ok');
      // Update recent chips
      try {
        updateRecentRecipients(recipients);
      } catch (_) {}
      if (res?.id) openLogs(res.id);
    } catch (e) {
      toast(e.message, 'fail');
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  // Send Snap form
  document.getElementById('sendSnapForm')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const caption = form.caption.value?.trim();
    const recipients = parseRecipientsList(form.recipientsText.value);
    const category = form.category.value?.trim();
    const imagePath = form.imagePath.value?.trim() || null;
    const captionPosition = form.captionPosition.value ? Number(form.captionPosition.value) : null;
    const headless = form.headless.value === 'true';
    const userDataDir = form.userDataDir.value?.trim() || null;
    const callbackUrl = form.callbackUrl.value?.trim() || null;
    if (!caption) { alert('Caption is required'); return; }
    const payload = {
      caption,
      recipients: recipients.length ? recipients : null,
      category: category || null,
      imagePath,
      captionPosition,
      headless,
      userDataDir,
      callbackUrl,
    };
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      const res = await fetchJSON('/sendSnap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (userDataDir) { try { localStorage.setItem('sb_userDataDir', userDataDir); } catch (_) {} }
      toast(`Snap queued. Job ID: ${res.id}`, 'ok');
      if (res?.id) openLogs(res.id);
    } catch (e) {
      toast(e.message, 'fail');
    } finally {
      if (btn) btn.disabled = false;
    }
  });
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const current = localStorage.getItem('sb_theme') || 'light';
      if (current === 'system') applyTheme('system');
    });
  }
}

// Density handling
function applyDensity(density) {
  if (density === 'compact') {
    document.documentElement.setAttribute('data-density', 'compact');
  } else {
    document.documentElement.setAttribute('data-density', 'comfortable');
  }
}

function initDensity() {
  const sel = document.getElementById('densitySelect');
  const saved = localStorage.getItem('sb_density') || 'comfortable';
  sel.value = saved;
  applyDensity(saved);
  sel.addEventListener('change', () => {
    const v = sel.value;
    localStorage.setItem('sb_density', v);
    applyDensity(v);
  });
}

// Collapsible cards
function initCollapsibles() {
  document.querySelectorAll('.card').forEach((card) => {
    const h2 = card.querySelector('h2');
    if (!h2 || h2.querySelector('.collapse')) return;
    const id = card.id || h2.textContent.trim().toLowerCase().replace(/\s+/g, '-');
    const key = `sb_collapse_${id}`;
    const btn = document.createElement('button');
    btn.className = 'collapse';
    const saved = localStorage.getItem(key) === 'true';
    if (saved) card.dataset.collapsed = 'true';
    btn.textContent = saved ? 'Expand' : 'Collapse';
    btn.addEventListener('click', () => {
      const isCollapsed = card.dataset.collapsed === 'true';
      if (isCollapsed) {
        delete card.dataset.collapsed;
      } else {
        card.dataset.collapsed = 'true';
      }
      localStorage.setItem(key, (!isCollapsed).toString());
      btn.textContent = !isCollapsed ? 'Expand' : 'Collapse';
    });
    h2.appendChild(btn);
  });
}

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function renderSummary(data) {
  // Health
  const badges = [];
  badges.push(data.health?.db ? '<span class="badge ok">DB OK</span>' : '<span class="badge fail">DB Down</span>');
  if (typeof data.health?.callbacksWorker === 'boolean') {
    badges.push(data.health.callbacksWorker ? '<span class="badge ok">Callbacks Worker: On</span>' : '<span class="badge fail">Callbacks Worker: Off</span>');
  }
  if (typeof data.health?.callbacksTable === 'boolean') {
    badges.push(data.health.callbacksTable ? '<span class="badge ok">Callbacks Table: OK</span>' : '<span class="badge fail">Callbacks Table: Missing</span>');
  }
  $('#health').innerHTML = badges.join(' ');

  // Stats
  const statuses = data.stats?.jobStatuses || {};
  const statusBadges = Object.entries(statuses)
    .map(([k, v]) => `<span class="badge">${k}: ${v}</span>`)
    .join(' ');
  $('#stats').innerHTML = `
    <div><strong>Total Recipients:</strong> ${data.stats?.recipients ?? 0}</div>
    <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">${statusBadges}</div>
  `;

  // Jobs
  const tbody = $('#jobsTable tbody');
  tbody.innerHTML = (data.jobs || [])
    .map(j => `
      <tr>
        <td title="${j.id}"><a href="#" data-jobid="${j.id}" class="truncate">${j.id}</a></td>
        <td>${j.type}</td>
        <td>${j.status}</td>
        <td>${formatTime(j.created_at)}</td>
        <td>${formatTime(j.updated_at)}</td>
        <td>
          <button class="button" data-job-retry data-id="${j.id}" ${j.status === 'running' ? 'disabled' : ''}>Retry</button>
          ${j.status === 'queued' ? `<button class="remove" data-job-cancel data-id="${j.id}">Cancel</button>` : ''}
        </td>
      </tr>
    `).join('');

  // Filters
  const wl = $('#whitelist');
  const bl = $('#blacklist');
  wl.innerHTML = '';
  bl.innerHTML = '';
  (data.filters || []).forEach(f => {
    const li = document.createElement('li');
    li.className = 'filter-item';
    li.innerHTML = `<span>${f.value}</span><button class="remove" data-mode="${f.mode}" data-value="${f.value}">Remove</button>`;
    (f.mode === 'whitelist' ? wl : bl).appendChild(li);
  });

  // Endpoints
  const epBody = $('#endpointsTable tbody');
  epBody.innerHTML = (data.endpoints || [])
    .map((ep, idx) => `
      <tr>
        <td>${ep.method}</td>
        <td><code class="truncate" title="${ep.path}">${ep.path}</code></td>
        <td>${ep.desc}</td>
        <td><button class="primary" data-run-idx="${idx}">Run</button></td>
      </tr>
    `).join('');

  // Store endpoints for run modal usage
  window.__endpoints = data.endpoints || [];

  // Callbacks
  const cbBody = $('#callbacksTable tbody');
  if (cbBody) {
    window.__callbacks = data.callbacks || [];
    renderCallbacks();
  }
}

function renderCallbacks() {
  const cbBody = document.querySelector('#callbacksTable tbody');
  if (!cbBody) return;
  const status = document.getElementById('callbacksStatus')?.value || '';
  const q = (document.getElementById('callbacksSearch')?.value || '').toLowerCase();
  let items = (window.__callbacks || []).slice();
  if (status) items = items.filter(ev => ev.status === status);
  if (q) {
    items = items.filter(ev => `${ev.id} ${ev.job_id} ${ev.url} ${ev.last_error || ''}`.toLowerCase().includes(q));
  }
  cbBody.innerHTML = items.map(ev => `
    <tr>
      <td class="truncate" title="${ev.id}">${ev.id}</td>
      <td class="truncate" title="${ev.job_id}">${ev.job_id}</td>
      <td>${ev.status}</td>
      <td>${ev.attempt_count}/${ev.max_attempts}</td>
      <td>${ev.next_attempt_at ? new Date(ev.next_attempt_at).toLocaleString() : ''}</td>
      <td>${ev.updated_at ? new Date(ev.updated_at).toLocaleString() : ''}</td>
      <td class="truncate" title="${ev.last_error || ''}">${ev.last_error || ''}</td>
      <td>
        <button class="button" data-retry data-id="${ev.id}" ${ev.status === 'delivered' ? 'disabled' : ''}>Retry</button>
        <button class="button" data-copy-payload data-id="${ev.id}">Copy Payload</button>
        ${ev.last_error ? `<button class="button" data-copy-error data-id="${ev.id}">Copy Error</button>` : ''}
        <button class="button" data-cb-details data-id="${ev.id}">Details</button>
      </td>
    </tr>
  `).join('');
}

document.getElementById('callbacksStatus')?.addEventListener('change', renderCallbacks);
document.getElementById('callbacksSearch')?.addEventListener('input', () => {
  clearTimeout(window.__cbT);
  window.__cbT = setTimeout(renderCallbacks, 120);
});

// Run modal logic (top-level)
const runModal = {
  el: $('#runModal'),
  method: $('#runMethod'),
  path: $('#runPath'),
  payload: $('#runPayload'),
  result: $('#runResult'),
  warning: $('#runWarning'),
  sendBtn: $('#runSendBtn'),
  current: null,
};

function sampleForEndpoint(ep, ctx) {
  const lastJobId = ctx?.jobs?.[0]?.id || '';
  const samples = {
    'POST /login': { payload: { headless: false } },
    'POST /sendSnap': { payload: { category: 'BestFriends', caption: 'Hello!', headless: false }, warning: 'Make sure you are logged in; this will attempt to capture and send a snap.' },
    'POST /sendVideo': { payload: { category: 'BestFriends', videoPathY4M: 'C:/path/to/video.y4m', audioPathWAV: 'C:/path/to/audio.wav', caption: 'Video test', durationMs: 3000, headless: false }, warning: 'Requires pre-converted Y4M and WAV files accessible to Chrome.' },
    'POST /sendText': { payload: { recipients: ['Alice'], message: 'Hello from dashboard', headless: false } },
    'GET /jobs/:id': { payload: undefined },
    'GET /listRecipients': { payload: undefined },
    'GET /userStatus': { payload: undefined },
    'GET /filters': { payload: undefined },
    'POST /filters': { payload: { mode: 'blacklist', value: 'Team Snapchat' } },
    'DELETE /filters': { payload: { mode: 'blacklist', value: 'Team Snapchat' } },
  };
  const key = `${ep.method} ${ep.path}`.replace(/:\w+/g, lastJobId ? lastJobId : 'ID');
  return samples[key] || { payload: ep.method === 'GET' ? undefined : {} };
}

function openRunModal(ep) {
  runModal.current = ep;
  runModal.method.value = ep.method;
  runModal.path.value = ep.path;
  const sample = sampleForEndpoint(ep, window.__dashboard);
  if (sample.payload !== undefined) {
    runModal.payload.parentElement.style.display = '';
    runModal.payload.value = JSON.stringify(sample.payload, null, 2);
  } else {
    runModal.payload.parentElement.style.display = 'none';
    runModal.payload.value = '';
  }
  if (sample.warning) {
    runModal.warning.hidden = false;
    runModal.warning.textContent = sample.warning;
  } else {
    runModal.warning.hidden = true;
    runModal.warning.textContent = '';
  }
  runModal.result.textContent = '';
  runModal.el.hidden = false;
}

function closeModals() {
  $('#runModal').hidden = true;
  $('#logsModal').hidden = true;
  $('#cbModal').hidden = true;
  const rp = document.getElementById('rpModal'); if (rp) rp.hidden = true;
  if (window.__sse) { window.__sse.close(); window.__sse = null; }
}

document.body.addEventListener('click', (ev) => {
  if (ev.target.matches('[data-close]')) { closeModals(); }
});

runModal.sendBtn?.addEventListener('click', async () => {
  if (!runModal.current) return;
  const ep = runModal.current;
  try {
    let res;
    if (ep.method === 'GET') {
      res = await fetchJSON(ep.path);
    } else {
      const body = runModal.payload.value ? JSON.parse(runModal.payload.value) : {};
      res = await fetchJSON(ep.path, { method: ep.method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    runModal.result.textContent = JSON.stringify(res, null, 2);
    if (res?.id) {
      const btn = document.createElement('button');
      btn.className = 'primary';
      btn.textContent = 'View Logs';
      btn.addEventListener('click', () => openLogs(res.id));
      runModal.result.appendChild(document.createElement('br'));
      runModal.result.appendChild(btn);
    }
  } catch (e) {
    runModal.result.textContent = String(e.message || e);
  }
});

// Copy helpers for run modal
document.getElementById('copyPayloadBtn')?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(document.getElementById('runPayload').value || ''); } catch (_) {}
});
document.getElementById('copyResultBtn')?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(document.getElementById('runResult').textContent || ''); } catch (_) {}
});

document.body.addEventListener('click', async (ev) => {
  // Job cancel
  const jc = ev.target.closest('button[data-job-cancel]');
  if (jc) {
    const id = jc.dataset.id;
    try { await fetchJSON(`/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' }); await loadJobsListPage(); await load(); } catch (e) { alert(e.message); }
    return;
  }

  // Job retry
  const jr = ev.target.closest('button[data-job-retry]');
  if (jr) {
    const id = jr.dataset.id;
    try { await fetchJSON(`/jobs/${encodeURIComponent(id)}/retry`, { method: 'POST' }); await load(); } catch (e) { alert(e.message); }
    return;
  }

  const retry = ev.target.closest('button[data-retry]');
  if (retry) {
    const id = retry.dataset.id;
    try { await fetchJSON(`/callbacks/retry/${encodeURIComponent(id)}`, { method: 'POST' }); await load(); } catch (e) { alert(e.message); }
    return;
  }
  const cp = ev.target.closest('button[data-copy-payload]');
  if (cp) {
    const id = cp.dataset.id;
    const evObj = (window.__callbacks || []).find(x => x.id === id);
    if (evObj) {
      try { await navigator.clipboard.writeText(JSON.stringify(evObj.payload, null, 2)); } catch (_) {}
    }
    return;
  }
  const ce = ev.target.closest('button[data-copy-error]');
  if (ce) {
    const id = ce.dataset.id;
    const evObj = (window.__callbacks || []).find(x => x.id === id);
    if (evObj?.last_error) {
      try { await navigator.clipboard.writeText(evObj.last_error); } catch (_) {}
    }
    return;
  }

  // Callback details modal open
  const det = ev.target.closest('button[data-cb-details]');
  if (det) {
    const id = det.dataset.id;
    const evObj = (window.__callbacks || []).find(x => x.id === id);
    if (evObj) {
      document.getElementById('cbId').value = evObj.id;
      document.getElementById('cbJobId').value = evObj.job_id || '';
      document.getElementById('cbUrl').value = evObj.url || '';
      document.getElementById('cbPayload').value = JSON.stringify(evObj.payload ?? {}, null, 2);
      document.getElementById('cbModal').hidden = false;
      // Load deliveries history
      try {
        const d = await fetchJSON(`/callbacks/${encodeURIComponent(evObj.id)}/deliveries`);
        const tb = document.querySelector('#cbDeliveries tbody');
        tb.innerHTML = (d.deliveries || []).map(row => `
          <tr>
            <td>${row.attempt}</td>
            <td>${row.status}</td>
            <td>${row.response_code ?? ''}</td>
            <td class="truncate" title="${row.error || ''}">${row.error || ''}</td>
            <td>${formatTime(row.sent_at)}</td>
          </tr>
        `).join('');
      } catch (_) {
        // ignore
      }
    }
    return;
  }

  // Recent recipient chip add
  const chip = ev.target.closest('button[data-recent-name]');
  if (chip) {
    const name = chip.dataset.recentName;
    const ta = document.querySelector('#sendTextForm textarea[name="recipientsText"]');
    if (ta) {
      const current = parseRecipientsList(ta.value);
      if (!current.includes(name)) current.push(name);
      ta.value = current.join(', ');
    }
    return;
  }

  // Open Recipient Picker
  const openRp = ev.target.closest('#openRecipientPicker');
  if (openRp) {
    openRecipientPicker();
    return;
  }
});

  // Recipient Picker modal logic
  async function openRecipientPicker() {
    const modal = document.getElementById('rpModal');
    if (!modal) return;
    modal.hidden = false;
    try {
      const data = await fetchJSON('/recipients');
      window.__rp = { items: data.recipients || [], filtered: [] };
      renderRecipientPicker('');
      const input = document.getElementById('rpSearch');
      input.value = '';
      input.oninput = () => renderRecipientPicker(input.value);
    } catch (e) {
      toast(e.message, 'fail');
    }
  }
  function renderRecipientPicker(q) {
    const tbody = document.querySelector('#rpTable tbody');
    if (!tbody) return;
    const all = (window.__rp?.items || []);
    const qq = (q || '').toLowerCase();
    const items = qq ? all.filter(r => `${r.name} ${r.id}`.toLowerCase().includes(qq)) : all;
    tbody.innerHTML = items.map(r => `
      <tr>
        <td><input type="checkbox" data-rp-id="${r.id}" data-rp-name="${r.name}"></td>
        <td>${r.name}</td>
        <td class="truncate" title="${r.id}">${r.id}</td>
      </tr>
    `).join('');
  }
  document.getElementById('rpAddBtn')?.addEventListener('click', () => {
    const boxes = Array.from(document.querySelectorAll('#rpTable tbody input[type="checkbox"]:checked'));
    const names = boxes.map(b => b.dataset.rpName).filter(Boolean);
    if (names.length === 0) { toast('No recipients selected', 'fail'); return; }
    const ta = document.querySelector('#sendTextForm textarea[name="recipientsText"]');
    if (ta) {
      const current = parseRecipientsList(ta.value);
      const set = new Set([ ...current, ...names ]);
      const next = Array.from(set);
      ta.value = next.join(', ');
      updateRecentRecipients(names);
      toast(`Added ${names.length} recipient(s)`, 'ok');
    }
    closeModals();
  });

// Callback Details: Resubmit handler
document.getElementById('cbResubmitBtn')?.addEventListener('click', async () => {
  const id = document.getElementById('cbId').value;
  const jobId = document.getElementById('cbJobId').value || null;
  const url = document.getElementById('cbUrl').value?.trim();
  const payloadText = document.getElementById('cbPayload').value || '{}';
  let payload;
  try {
    payload = JSON.parse(payloadText);
  } catch (e) {
    alert('Payload must be valid JSON');
    return;
  }
  try {
    if (!url) throw new Error('URL is required');
    await fetchJSON('/callbacks/resubmit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: jobId || null, url, payload }),
    });
    closeModals();
    await load();
  } catch (e) {
    alert(e.message);
  }
});

async function load() {
  try {
    const data = await fetchJSON('/dashboard/summary');
    renderSummary(data);
    window.__dashboard = data;
  } catch (e) {
    $('#health').innerHTML = `<span class="badge fail">${e.message}</span>`;
  }
}

async function addFilter(mode, value) {
  await fetchJSON('/filters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, value }),
  });
}

async function removeFilter(mode, value) {
  await fetchJSON('/filters', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, value }),
  });
}

function wireEvents() {
  $('#refreshBtn').addEventListener('click', () => load());

  $('#filterForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const mode = form.mode.value;
    const value = form.value.value?.trim();
    if (!value) return;
    try {
      await addFilter(mode, value);
      form.reset();
      await load();
    } catch (e) {
      alert(e.message);
    }
  });
  // Recipients loading and quick actions
  $('#recipientsForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const headless = form.headless.value;
    const limit = form.limit.value;
    const userDataDir = form.userDataDir.value?.trim();
    const qs = new URLSearchParams({ headless, limit });
    if (userDataDir) qs.set('userDataDir', userDataDir);
    try {
      setRecipientsLoading(true, 'Loading recipients...');
      const res = await fetchJSON(`/listRecipients?${qs.toString()}`);
      await load(); // refresh stats
      window.__recipients = res.recipients || [];
      window.__recPage = { page: 1, size: getRecPageSize() };
      await renderRecipientsPage();
    } catch (e) {
      alert(e.message);
    } finally {
      setRecipientsLoading(false);
    }
  });

  // Prefill userDataDir from localStorage
  try {
    const storedUdd = localStorage.getItem('sb_userDataDir') || '';
    if (storedUdd) document.querySelector('#recipientsForm [name="userDataDir"]').value = storedUdd;
    if (storedUdd) document.querySelector('#sendSnapForm [name="userDataDir"]')?.setAttribute('value', storedUdd);
    if (storedUdd) document.querySelector('#sendTextForm [name="userDataDir"]')?.setAttribute('value', storedUdd);
  } catch (_) {}

  // Recent recipients chips
  function getRecentRecipients() {
    try { return JSON.parse(localStorage.getItem('sb_recent_recipients') || '[]'); } catch (_) { return []; }
  }
  function setRecentRecipients(arr) {
    try { localStorage.setItem('sb_recent_recipients', JSON.stringify(arr.slice(0, 20))); } catch (_) {}
  }
  function updateRecentRecipients(names) {
    const recent = getRecentRecipients();
    const set = new Set([ ...names.map(n => String(n).trim()), ...recent ]);
    setRecentRecipients(Array.from(set).slice(0, 20));
    renderRecentRecipients();
  }
  function renderRecentRecipients() {
    const cont = document.getElementById('recentRecipients');
    if (!cont) return;
    const recent = getRecentRecipients();
    cont.innerHTML = recent.map(n => `<button type="button" class="button" data-recent-name="${n}">${n}</button>`).join('');
  }
  renderRecentRecipients();

  // Show last init/seed timestamps
  const updateInitSeedBadges = () => {
    const initTs = localStorage.getItem('sb_init_ts');
    const seedTs = localStorage.getItem('sb_seed_ts');
    const initEl = document.getElementById('initStatus');
    const seedEl = document.getElementById('seedStatus');
    if (initEl) initEl.textContent = `Init: ${initTs ? new Date(Number(initTs)).toLocaleString() : '—'}`;
    if (seedEl) seedEl.textContent = `Seed: ${seedTs ? new Date(Number(seedTs)).toLocaleString() : '—'}`;
  };
  updateInitSeedBadges();

  // Jobs List (filters + paging)
  const jobsState = {
    page: 1,
    size: Number(document.getElementById('jobsPageSize')?.value || 20),
    status: document.getElementById('jobsFilterStatus')?.value || ''
  };

  async function loadJobsListPage() {
    const { page, size, status } = jobsState;
    const offset = (Math.max(1, page) - 1) * Math.max(1, size);
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    qs.set('limit', String(size));
    qs.set('offset', String(offset));
    try {
      const data = await fetchJSON(`/jobs?${qs.toString()}`);
      const items = data.jobs || [];
      window.__jobsLastCount = items.length;
      renderJobsListTable(items);
      const label = document.getElementById('jobsPageLabel');
      if (label) label.textContent = `Page ${jobsState.page}`;
      const prev = document.getElementById('jobsPrev');
      const next = document.getElementById('jobsNext');
      if (prev) prev.disabled = jobsState.page <= 1;
      if (next) next.disabled = items.length < jobsState.size;
    } catch (e) {
      // Show basic error in table
      const tbody = document.querySelector('#jobsListTable tbody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="6">${e.message}</td></tr>`;
    }
  }

  function renderJobsListTable(items) {
    const tbody = document.querySelector('#jobsListTable tbody');
    if (!tbody) return;
    tbody.innerHTML = (items || []).map(j => `
      <tr>
        <td title="${j.id}"><a href="#" data-jobid="${j.id}" class="truncate">${j.id}</a></td>
        <td>${j.type}</td>
        <td>${j.status}</td>
        <td>${formatTime(j.created_at)}</td>
        <td>${formatTime(j.updated_at)}</td>
        <td>
          <button class="button" data-job-retry data-id="${j.id}" ${j.status === 'running' ? 'disabled' : ''}>Retry</button>
          ${j.status === 'queued' ? `<button class="remove" data-job-cancel data-id="${j.id}">Cancel</button>` : ''}
        </td>
      </tr>
    `).join('');
  }

  document.getElementById('jobsFilterStatus')?.addEventListener('change', async () => {
    jobsState.status = document.getElementById('jobsFilterStatus').value || '';
    jobsState.page = 1;
    await loadJobsListPage();
  });
  document.getElementById('jobsPageSize')?.addEventListener('change', async () => {
    jobsState.size = Number(document.getElementById('jobsPageSize').value || 20);
    jobsState.page = 1;
    await loadJobsListPage();
  });
  document.getElementById('jobsPrev')?.addEventListener('click', async () => {
    if (jobsState.page > 1) {
      jobsState.page -= 1;
      await loadJobsListPage();
    }
  });
  document.getElementById('jobsNext')?.addEventListener('click', async () => {
    if ((window.__jobsLastCount || 0) >= jobsState.size) {
      jobsState.page += 1;
      await loadJobsListPage();
    }
  });

  // Initial load of Jobs List
  loadJobsListPage().catch(() => {});

  // Recipients DB search (GET /recipients/search?q=...)
  const recDbInput = document.getElementById('recDbSearch');
  if (recDbInput) {
    recDbInput.addEventListener('input', () => {
      clearTimeout(window.__recDbT);
      const q = recDbInput.value.trim();
      window.__recDbT = setTimeout(async () => {
        if (!q) { const c = document.getElementById('recDbResults'); if (c) c.innerHTML = ''; return; }
        try {
          const data = await fetchJSON(`/recipients/search?q=${encodeURIComponent(q)}&limit=50`);
          const cont = document.getElementById('recDbResults');
          if (cont) {
            cont.innerHTML = (data.recipients || []).map(r => `<button type="button" class="button" data-db-name="${r.name}">${r.name}</button>`).join('');
          }
        } catch (_) {
          // ignore for smoke UX
        }
      }, 180);
    });
  }

  const getRecipientsFormData = () => {
    const form = document.getElementById('recipientsForm');
    return {
      headless: (form.headless.value || 'false') === 'true',
      limit: form.limit.value ? Number(form.limit.value) : undefined,
      userDataDir: form.userDataDir.value?.trim() || localStorage.getItem('sb_userDataDir') || '',
    };
  };

  // Recipients pagination controls
  function getRecPageSize() {
    const sel = document.getElementById('recPageSize');
    return sel ? Number(sel.value) : 50;
  }
  async function renderRecipientsPage() {
    const items = window.__recipients || [];
    const size = (window.__recPage?.size) || getRecPageSize();
    const page = (window.__recPage?.page) || 1;
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / Math.max(1, size)));
    const current = Math.min(Math.max(1, page), pages);
    window.__recPage = { page: current, size };
    const start = (current - 1) * size;
    const slice = items.slice(start, start + size);
    await loadRecipientsTable(slice);
    const label = document.getElementById('recPageLabel');
    if (label) label.textContent = `Page ${current} / ${pages}`;
    const status = document.getElementById('recipientsStatus');
    if (status) status.textContent = `${total} recipients total`;
    const prev = document.getElementById('recPrev');
    const next = document.getElementById('recNext');
    if (prev) prev.disabled = current <= 1;
    if (next) next.disabled = current >= pages;
  }
  document.getElementById('recPageSize')?.addEventListener('change', async () => {
    window.__recPage = { page: 1, size: getRecPageSize() };
    await renderRecipientsPage();
  });
  document.getElementById('recPrev')?.addEventListener('click', async () => {
    if (!window.__recPage) window.__recPage = { page: 1, size: getRecPageSize() };
    window.__recPage.page = Math.max(1, (window.__recPage.page || 1) - 1);
    await renderRecipientsPage();
  });
  document.getElementById('recNext')?.addEventListener('click', async () => {
    if (!window.__recPage) window.__recPage = { page: 1, size: getRecPageSize() };
    window.__recPage.page = (window.__recPage.page || 1) + 1;
    await renderRecipientsPage();
  });

  // Initialize Account: POST /login (default headless=false for first-time auth)
  document.getElementById('initAccountBtn')?.addEventListener('click', async () => {
    const { userDataDir } = getRecipientsFormData();
    try {
      const body = { headless: false };
      if (userDataDir) body.userDataDir = userDataDir;
      await fetchJSON('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (userDataDir) try { localStorage.setItem('sb_userDataDir', userDataDir); } catch (_) {}
      try { localStorage.setItem('sb_init_ts', String(Date.now())); } catch (_) {}
      updateInitSeedBadges();
      alert('Initialization complete. You can now seed recipients.');
    } catch (e) {
      alert(e.message);
    }
  });

  // Seed Recipients: GET /listRecipients (default to headless=true after initialization)
  document.getElementById('seedRecipientsBtn')?.addEventListener('click', async () => {
    const { userDataDir, limit } = getRecipientsFormData();
    const qs = new URLSearchParams({ headless: 'true' });
    if (userDataDir) qs.set('userDataDir', userDataDir);
    if (limit) qs.set('limit', String(limit));
    try {
      setRecipientsLoading(true, 'Seeding recipients...');
      const res = await fetchJSON(`/listRecipients?${qs.toString()}`);
      if (userDataDir) try { localStorage.setItem('sb_userDataDir', userDataDir); } catch (_) {}
      await load();
      window.__recipients = res.recipients || [];
      window.__recPage = { page: 1, size: getRecPageSize() };
      await renderRecipientsPage();
      try { localStorage.setItem('sb_seed_ts', String(Date.now())); } catch (_) {}
      updateInitSeedBadges();
      alert(`Seeded ${res.count || (window.__recipients?.length || 0)} recipients.`);
    } catch (e) {
      alert(e.message);
    } finally {
      setRecipientsLoading(false);
    }
  });

  // Initialize & Seed: run login headful then listRecipients headless
  document.getElementById('initAndSeedBtn')?.addEventListener('click', async () => {
    const { userDataDir, limit } = getRecipientsFormData();
    try {
      setRecipientsLoading(true, 'Initializing...');
      const loginBody = { headless: false };
      if (userDataDir) loginBody.userDataDir = userDataDir;
      await fetchJSON('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loginBody) });
      if (userDataDir) try { localStorage.setItem('sb_userDataDir', userDataDir); } catch (_) {}
      try { localStorage.setItem('sb_init_ts', String(Date.now())); } catch (_) {}

      const qs = new URLSearchParams({ headless: 'true' });
      if (userDataDir) qs.set('userDataDir', userDataDir);
      if (limit) qs.set('limit', String(limit));
      setRecipientsLoading(true, 'Seeding recipients...');
      const res = await fetchJSON(`/listRecipients?${qs.toString()}`);
      await load();
      window.__recipients = res.recipients || [];
      window.__recPage = { page: 1, size: getRecPageSize() };
      await renderRecipientsPage();
      try { localStorage.setItem('sb_seed_ts', String(Date.now())); } catch (_) {}
      updateInitSeedBadges();
      alert(`Initialized & seeded ${res.count || (window.__recipients?.length || 0)} recipients.`);
    } catch (e) {
      alert(e.message);
    } finally {
      setRecipientsLoading(false);
    }
  });

async function loadRecipientsTable(items) {
  const tbody = $('#recipientsTable tbody');
  tbody.innerHTML = (items || []).map(r => `
    <tr>
      <td>${r.id}</td>
      <td>${r.name}</td>
      <td>
        <button class="primary" data-wl data-name="${r.name}">Whitelist</button>
        <button class="remove" data-bl data-name="${r.name}">Blacklist</button>
      </td>
    </tr>
  `).join('');
}

// Logs modal and SSE streaming with filters
function formatLogLine(row) {
  return `[${row.created_at}] ${String(row.level || '').toUpperCase()} - ${row.message}${row.meta ? ' ' + JSON.stringify(row.meta) : ''}`;
}

function renderLogs() {
  const buf = (window.__logs && window.__logs.buffer) || [];
  const level = $('#logsLevel')?.value || '';
  const q = ($('#logsSearch')?.value || '').toLowerCase();
  const filtered = buf.filter((r) => {
    if (level && String(r.level) !== level) return false;
    if (!q) return true;
    const hay = `${r.message || ''} ${JSON.stringify(r.meta || {})}`.toLowerCase();
    return hay.includes(q);
  });
  const pre = $('#logsStream');
  pre.textContent = filtered.map(formatLogLine).join('\n');
  window.__logs.filtered = filtered;
  const auto = ($('#logsAutoscroll')?.value || 'on') === 'on';
  window.__logs.autoscroll = auto;
  if (auto) pre.scrollTop = pre.scrollHeight;
}

function openLogs(jobId) {
  $('#logsJobId').value = jobId;
  $('#logsStream').textContent = '';
  $('#logsModal').hidden = false;
  window.__logs = { jobId, buffer: [], filtered: [], autoscroll: true };

  // Wire filter controls
  $('#logsLevel')?.addEventListener('change', renderLogs, { once: false });
  $('#logsSearch')?.addEventListener('input', () => {
    // Debounce mildly
    clearTimeout(window.__logsSearchT);
    window.__logsSearchT = setTimeout(renderLogs, 120);
  });
  $('#logsAutoscroll')?.addEventListener('change', renderLogs);
  $('#logsClearBtn')?.addEventListener('click', () => { window.__logs.buffer = []; renderLogs(); });

  if (window.__sse) { try { window.__sse.close(); } catch(_) {} }
  const es = new EventSource(`/jobs/${encodeURIComponent(jobId)}/logs/stream`);
  window.__sse = es;
  es.onmessage = (evt) => {
    try {
      const row = JSON.parse(evt.data);
      window.__logs.buffer.push(row);
      renderLogs();
    } catch (_) {}
  };
  es.onerror = () => {
    // Auto-close on error
    try { es.close(); } catch(_) {}
  };
}

// Export logs
document.getElementById('logsExportBtn')?.addEventListener('click', () => {
  const jobId = document.getElementById('logsJobId').value || 'job';
  const text = document.getElementById('logsStream').textContent || '';
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${jobId}-logs.txt`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
});
 

  document.body.addEventListener('click', async (ev) => {
    // Remove filter button
    const rm = ev.target.closest('button.remove');
    if (rm) {
      const mode = rm.dataset.mode;
      const value = rm.dataset.value;
      if (!confirm(`Remove ${mode} entry: ${value}?`)) return;
      try { await removeFilter(mode, value); await load(); } catch (e) { alert(e.message); }
      return;
    }

    // Endpoint Run button
    const run = ev.target.closest('button[data-run-idx]');
    if (run) {
      const idx = Number(run.dataset.runIdx);
      const ep = window.__endpoints?.[idx];
      if (ep) openRunModal(ep);
      return;
    }

    // Job logs link
    const jobLink = ev.target.closest('a[data-jobid]');
    if (jobLink) {
      ev.preventDefault();
      openLogs(jobLink.dataset.jobid);
      return;
    }

    // Recipients quick actions
    const wl = ev.target.closest('button[data-wl]');
    const bl = ev.target.closest('button[data-bl]');
    const el = wl || bl;
    if (el) {
      const mode = wl ? 'whitelist' : 'blacklist';
      const value = el.dataset.name;
      try { await addFilter(mode, value); await loadRecipientsTable(window.__recipients || []); } catch (e) { alert(e.message); }
      return;
    }
  });
}

wireEvents();
initTheme();
initDensity();
initCollapsibles();
initScrollSpy();
load();
