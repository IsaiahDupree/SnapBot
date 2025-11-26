import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

process.env.TEST_MODE = '1';

describe('System Tests', () => {
    test('Environment: TEST_MODE should be active', () => {
        assert.equal(process.env.TEST_MODE, '1');
    });

    test('File System: Logs directory should exist', () => {
        const logsDir = path.resolve('logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir);
        }
        assert.ok(fs.existsSync(logsDir), 'Logs directory must exist');
    });

    test('File System: Screenshots directory should exist', () => {
        const screenshotsDir = path.resolve('tests/screenshots');
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }
        assert.ok(fs.existsSync(screenshotsDir), 'Screenshots directory must exist');
    });

    test('Configuration: Package.json should be valid', () => {
        const packageJsonPath = path.resolve('package.json');
        assert.ok(fs.existsSync(packageJsonPath));
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        assert.ok(pkg.name);
        assert.ok(pkg.version);
        assert.ok(pkg.scripts['test:system']);
    });
});
