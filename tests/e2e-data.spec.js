import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createConnectedSnapBot } from '../utils/connectToSession.js';
import { upsertRecipients, listRecipientsDb } from '../db/repositories.js';
import { filterBlacklisted } from '../utils/blacklist.js';
import dotenv from 'dotenv';

dotenv.config();

describe('End-to-End: Snapchat Data to Database', { timeout: 60000 }, () => {
    let bot;

    test('Get recipients from Snapchat and save to database', async () => {
        console.log('Connecting to active session...');
        bot = await createConnectedSnapBot();

        // Get recipients from Snapchat
        console.log('Fetching recipients from Snapchat...');
        const allRecipients = await bot.listRecipients(10);
        console.log(`Found ${allRecipients.length} total recipients`);

        // Filter out blacklisted recipients (e.g., Team Snapchat)
        const recipients = filterBlacklisted(allRecipients);
        const filteredCount = allRecipients.length - recipients.length;
        if (filteredCount > 0) {
            console.log(`⚠️  Filtered out ${filteredCount} blacklisted recipient(s)`);
        }
        console.log(`Processing ${recipients.length} non-blacklisted recipients`);
        assert.ok(recipients.length > 0, 'Should have at least one non-blacklisted recipient');

        // Save to database
        console.log('Saving recipients to database...');
        await upsertRecipients(recipients);
        console.log('✅ Recipients saved');

        // Verify data is in database
        console.log('Verifying database storage...');
        const dbRecipients = await listRecipientsDb();
        console.log(`Database has ${dbRecipients.length} recipients`);
        assert.ok(dbRecipients.length >= recipients.length, 'Database should have at least as many recipients');

        // Verify specific recipients exist
        for (const recipient of recipients.slice(0, 3)) {
            const found = dbRecipients.find(r => r.id === recipient.id);
            assert.ok(found, `Recipient ${recipient.name} should be in database`);
            console.log(`✅ Verified ${recipient.name} in database`);
        }
    });

    test('Get user statuses and verify data structure', async () => {
        if (!bot) {
            bot = await createConnectedSnapBot();
        }

        console.log('Fetching user statuses...');
        const allStatuses = await bot.userStatus();

        // Filter out blacklisted users from statuses too
        const statuses = filterBlacklisted(allStatuses);
        console.log(`Found ${statuses.length} user statuses (${allStatuses.length - statuses.length} filtered)`);
        assert.ok(Array.isArray(statuses), 'Should return array');

        if (statuses.length > 0) {
            const firstStatus = statuses[0];
            console.log('Sample status:', firstStatus);
            assert.ok(firstStatus.id, 'Status should have id');
            assert.ok(firstStatus.name, 'Status should have name');
            assert.ok(firstStatus.status, 'Status should have status object');
        }
    });
});
