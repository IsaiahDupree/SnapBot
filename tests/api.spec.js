import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import requestFactory from 'supertest';

process.env.TEST_MODE = '1';
const { default: app } = await import('../api/app.js');
const request = requestFactory(app);

describe('API endpoints (TEST_MODE)', () => {
  test('GET /favicon.ico', async () => {
    await request.get('/favicon.ico').expect(204);
  });

  test('GET /health', async () => {
    const res = await request.get('/health').expect(200);
    assert.equal(res.body.ok, true);
  });

  test('GET /dashboard/summary', async () => {
    const res = await request.get('/dashboard/summary').expect(200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.endpoints));
  });

  test('GET /recipients', async () => {
    const res = await request.get('/recipients').expect(200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.recipients));
  });

  test('GET /callbacks', async () => {
    const res = await request.get('/callbacks').expect(200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.events));
  });

  test('GET /callbacks/:id', async () => {
    const res = await request.get('/callbacks/ev-1').expect(200);
    assert.equal(res.body.ok, true);
    assert.ok(res.body.event);
  });

  test('GET /callbacks/:id/deliveries', async () => {
    const res = await request.get('/callbacks/ev-1/deliveries').expect(200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.deliveries));
  });

  test('POST /callbacks/retry/:id', async () => {
    const res = await request.post('/callbacks/retry/ev-1').expect(200);
    assert.equal(res.body.ok, true);
  });

  test('POST /callbacks/resubmit/:id', async () => {
    const res = await request.post('/callbacks/resubmit/ev-1').expect(200);
    assert.equal(res.body.ok, true);
  });

  test('POST /callbacks/resubmit', async () => {
    const res = await request
      .post('/callbacks/resubmit')
      .send({ jobId: null, url: 'https://example.com', payload: { ok: true } })
      .set('Content-Type', 'application/json')
      .expect(200);
    assert.equal(res.body.ok, true);
  });

  test('POST /login', async () => {
    const res = await request.post('/login').send({ headless: true }).set('Content-Type', 'application/json').expect(200);
    assert.equal(res.body.ok, true);
  });

  test('GET /listRecipients', async () => {
    const res = await request.get('/listRecipients?headless=true').expect(200);
    assert.equal(res.body.ok, true);
  });

  test('GET /userStatus', async () => {
    const res = await request.get('/userStatus?headless=true').expect(200);
    assert.equal(res.body.ok, true);
  });

  test('POST /sendSnap', async () => {
    const res = await request
      .post('/sendSnap')
      .send({ category: 'BestFriends', caption: 'Hello', headless: true })
      .set('Content-Type', 'application/json')
      .expect(202);
    assert.equal(res.body.ok, true);
  });

  test('POST /sendVideo', async () => {
    const res = await request
      .post('/sendVideo')
      .send({ category: 'BestFriends', caption: 'Hello', videoPathY4M: 'c:/tmp/v.y4m', audioPathWAV: 'c:/tmp/a.wav', durationMs: 1000, headless: true })
      .set('Content-Type', 'application/json')
      .expect(202);
    assert.equal(res.body.ok, true);
  });

  test('POST /sendText', async () => {
    const res = await request
      .post('/sendText')
      .send({ recipients: ['Alice'], message: 'Hi', headless: true })
      .set('Content-Type', 'application/json')
      .expect(202);
    assert.equal(res.body.ok, true);
  });

  test('GET /jobs/:id', async () => {
    const res = await request.get('/jobs/job-1').expect(200);
    assert.equal(res.body.ok, true);
  });

  test('GET /jobs/:id/logs', async () => {
    const res = await request.get('/jobs/job-1/logs').expect(200);
    assert.equal(res.body.ok, true);
  });

  test('GET /jobs/:id/logs/stream', async () => {
    const res = await request
      .get('/jobs/job-1/logs/stream')
      .set('Accept', 'text/event-stream')
      .buffer(true)
      .parse((res, cb) => {
        res.on('data', () => {});
        res.on('end', () => cb(null, res));
      })
      .expect(200);
    assert.ok(res.headers['content-type']?.includes('text/event-stream'));
  });

  test('POST /jobs/:id/retry', async () => {
    const res = await request.post('/jobs/job-1/retry').expect(202);
    assert.equal(res.body.ok, true);
  });

  test('GET /filters', async () => {
    const res = await request.get('/filters').expect(200);
    assert.equal(res.body.ok, true);
  });

  test('POST /filters', async () => {
    const res = await request
      .post('/filters')
      .send({ mode: 'blacklist', value: 'Team Snapchat' })
      .set('Content-Type', 'application/json')
      .expect(200);
    assert.equal(res.body.ok, true);
  });

  test('DELETE /filters', async () => {
    const res = await request
      .delete('/filters')
      .send({ mode: 'blacklist', value: 'Team Snapchat' })
      .set('Content-Type', 'application/json')
      .expect(200);
    assert.equal(res.body.ok, true);
  });

  test('GET /recipients/search', async () => {
    const res = await request.get('/recipients/search?q=ali&limit=10').expect(200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.recipients));
  });

  test('GET /jobs listing with filters', async () => {
    const res = await request.get('/jobs?status=queued&limit=1&offset=0').expect(200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.jobs));
  });

  test('POST /jobs/:id/cancel', async () => {
    const res = await request.post('/jobs/job-queued-1/cancel').expect(200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.status, 'cancelled');
  });
});
