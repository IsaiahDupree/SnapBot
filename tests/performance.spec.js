import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import requestFactory from 'supertest';
import { performance } from 'perf_hooks';

process.env.TEST_MODE = '1';
const { default: app } = await import('../api/app.js');
const request = requestFactory(app);

describe('Performance Tests (TEST_MODE)', () => {
    test('API Latency: Health check should be under 100ms', async () => {
        const start = performance.now();
        await request.get('/health').expect(200);
        const end = performance.now();
        const duration = end - start;
        assert.ok(duration < 100, `Health check took ${duration.toFixed(2)}ms, expected < 100ms`);
    });

    test('API Latency: Dashboard summary should be under 200ms', async () => {
        const start = performance.now();
        await request.get('/dashboard/summary').expect(200);
        const end = performance.now();
        const duration = end - start;
        assert.ok(duration < 200, `Dashboard summary took ${duration.toFixed(2)}ms, expected < 200ms`);
    });

    test('Load Test: Should handle 50 sequential requests under 2s', async () => {
        const start = performance.now();
        for (let i = 0; i < 50; i++) {
            await request.get('/health').expect(200);
        }
        const end = performance.now();
        const duration = end - start;
        assert.ok(duration < 2000, `50 requests took ${duration.toFixed(2)}ms, expected < 2000ms`);
    });
});
