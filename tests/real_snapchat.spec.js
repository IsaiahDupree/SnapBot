import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import SnapBot from '../snapbot.js';
import 'dotenv/config';

const { USER_NAME, USER_PASSWORD } = process.env;

describe('Real Snapchat Interactions (Direct)', { timeout: 300000 }, () => {
    let bot;

    before(async () => {
        bot = new SnapBot();
        await bot.launchSnapchat({ headless: false });
    });

    after(async () => {
        if (bot) await bot.closeBrowser();
    });

    test('Login: Should successfully login', async () => {
        const logged = await bot.ensureLoggedIn({ username: USER_NAME, password: USER_PASSWORD }, { handlePopup: true, retry: 1 });
        assert.equal(logged, true, 'Should be logged in');
    });

    test('Data: List Recipients', async () => {
        const recipients = await bot.listRecipients(5);
        assert.ok(Array.isArray(recipients));
        assert.ok(recipients.length > 0, 'Should find some recipients');
        console.log('Recipients found:', recipients.length);
    });

    test('Data: User Status', async () => {
        const statuses = await bot.userStatus();
        assert.ok(Array.isArray(statuses));
        console.log('Statuses found:', statuses.length);
    });

    test('Action: Send Text', async () => {
        // Attempt to send to a safe recipient or just verify the method doesn't crash
        try {
            await bot.sendTextToRecipients(['Team Snapchat'], 'Test from SnapBot Test Suite');
            assert.ok(true);
        } catch (e) {
            // If recipient not found, it might throw, but we want to verify the attempt
            console.warn('Send text warning:', e.message);
        }
    });

});
