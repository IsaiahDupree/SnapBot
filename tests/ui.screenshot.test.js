import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import puppeteer from 'puppeteer';

process.env.TEST_MODE = '1';
const { default: app } = await import('../api/app.js');

let server;
let baseUrl;
let browser;

before(async () => {
  await fs.mkdir(path.resolve('tests', 'screenshots'), { recursive: true });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
  browser = await puppeteer.launch({ headless: 'new' });
});

after(async () => {
  try { await browser?.close(); } catch {}
  try { await new Promise((resolve) => server?.close(resolve)); } catch {}
});

describe('UI smoke with screenshots (TEST_MODE)', () => {
  test('Dashboard loads and shows Endpoints', async () => {
    const page = await browser.newPage();
    await page.goto(baseUrl + '/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#endpointsTable tbody');
    await page.screenshot({ path: 'tests/screenshots/dashboard.png', fullPage: true });
    const title = await page.$eval('h1', (el) => el.textContent.trim());
    assert.match(title, /SnapBot Dashboard/i);
    await page.close();
  });

  test('Jobs List filter (queued) shows Cancel button', async () => {
    const page = await browser.newPage();
    await page.goto(baseUrl + '/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#jobsListTable tbody');
    await page.select('#jobsFilterStatus', 'queued');
    await page.waitForSelector('#jobsListTable tbody tr');
    await page.screenshot({ path: 'tests/screenshots/jobs-list.png' });
    // Assert a cancel button is present for queued jobs (no click to avoid flake)
    const cancelBtn = await page.$('#jobsListTable tbody button[data-job-cancel]');
    assert.ok(cancelBtn, 'Expected a cancel button for queued job');
    await page.close();
  });

  test('Recipients DB search shows Alice chip', async () => {
    const page = await browser.newPage();
    await page.goto(baseUrl + '/', { waitUntil: 'networkidle0' });
    await page.type('#recDbSearch', 'ali');
    await page.waitForSelector('#recDbResults button');
    await page.screenshot({ path: 'tests/screenshots/recipients-db-search.png' });
    const btnTexts = await page.$$eval('#recDbResults button', (els) => els.map((b) => b.textContent || ''));
    assert.ok(btnTexts.some((t) => /alice/i.test(t)), 'Expected an Alice chip');
    await page.close();
  });

  test('Run POST /sendText via Run modal and capture screenshots', async () => {
    const page = await browser.newPage();
    await page.goto(baseUrl + '/', { waitUntil: 'networkidle0' });

    // Find the row for POST /sendText and click Run
    const rows = await page.$$('#endpointsTable tbody tr');
    let found = false;
    for (const row of rows) {
      const text = await row.evaluate((r) => r.innerText);
      if (text.includes('/sendText')) {
        const btn = await row.$('button[data-run-idx]');
        await btn.click();
        found = true;
        break;
      }
    }
    assert.equal(found, true, 'Could not find /sendText endpoint row');

    await page.waitForSelector('#runModal:not([hidden])');
    await page.screenshot({ path: 'tests/screenshots/run-modal.png' });

    // Send request from modal
    await page.click('#runSendBtn');
    await page.waitForFunction(() => {
      const pre = document.getElementById('runResult');
      return pre && pre.textContent && pre.textContent.includes('ok');
    }, { timeout: 5000 });
    await page.screenshot({ path: 'tests/screenshots/run-result.png' });

    // Click View Logs button if present (optional)
    const btns = await page.$$('#runModal button');
    let logsOpened = false;
    for (const b of btns) {
      const txt = await page.evaluate((el) => el.textContent || '', b);
      if (txt.includes('View Logs')) {
        await b.click();
        try {
          await page.waitForSelector('#logsModal:not([hidden])', { timeout: 5000 });
          await page.screenshot({ path: 'tests/screenshots/logs-modal.png' });
          logsOpened = true;
        } catch (_) {
          // Logs modal didn't open quickly; ignore in smoke test
        }
        break;
      }
    }

    await page.close();
  });
});
