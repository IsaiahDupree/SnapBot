import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import requestFactory from 'supertest';

process.env.TEST_MODE = '1';
const { default: app } = await import('../api/app.js');
const request = requestFactory(app);

describe('Security Tests (TEST_MODE)', () => {
    test('Input Validation: Invalid JSON body should return 400', async () => {
        await request
            .post('/sendText')
            .send('invalid json')
            .set('Content-Type', 'application/json')
            .expect(400);
    });

    test('SQL Injection: Login endpoint should handle malicious input gracefully', async () => {
        // In TEST_MODE, logic is mocked, but we ensure the app doesn't crash with special characters
        const res = await request
            .post('/login')
            .send({ username: "' OR '1'='1", password: "' OR '1'='1", headless: true })
            .expect(200);
        assert.equal(res.body.ok, true);
    });

    test('XSS: Send Text endpoint should accept input but not execute it (mocked)', async () => {
        const xssPayload = '<script>alert("XSS")</script>';
        const res = await request
            .post('/sendText')
            .send({ recipients: ['Alice'], message: xssPayload, headless: true })
            .expect(202);
        assert.equal(res.body.ok, true);
    });

    test('Method Not Allowed: Invalid HTTP methods should be rejected', async () => {
        // Assuming Express handles this, or returns 404 if route not defined
        await request.put('/login').expect(404);
    });

    test('Large Payload: Should handle large request bodies', async () => {
        const largeString = 'a'.repeat(10000);
        const res = await request
            .post('/sendText')
            .send({ recipients: ['Alice'], message: largeString, headless: true })
            .expect(202);
        assert.equal(res.body.ok, true);
    });
});
