import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createConnectedSnapBot } from '../utils/connectToSession.js';
import { upsertRecipients, listRecipientsDb, createJob, getJob } from '../db/repositories.js';
import { filterBlacklisted } from '../utils/blacklist.js';
import pool from '../db/pool.js';
import dotenv from 'dotenv';

dotenv.config();

describe('Comprehensive Data Persistence Tests', { timeout: 120000 }, () => {
    let bot;
    let recipients = [];
    let statuses = [];

    before(async () => {
        console.log('🔌 Connecting to active session...');
        bot = await createConnectedSnapBot();
        console.log('✅ Connected to browser session');
    });

    after(async () => {
        console.log('\n📊 Test Summary:');
        console.log(`   Recipients collected: ${recipients.length}`);
        console.log(`   Statuses collected: ${statuses.length}`);
    });

    test('1. Fetch recipients from Snapchat', async () => {
        console.log('\n👥 Fetching recipients from Snapchat...');
        const allRecipients = await bot.listRecipients(15);
        console.log(`   Found ${allRecipients.length} total recipients`);

        recipients = filterBlacklisted(allRecipients);
        const filtered = allRecipients.length - recipients.length;
        if (filtered > 0) {
            console.log(`   ⚠️  Filtered ${filtered} blacklisted recipient(s)`);
        }
        console.log(`   ✅ ${recipients.length} recipients to process`);

        assert.ok(recipients.length > 0, 'Should have at least one recipient');
        assert.ok(recipients.every(r => r.id && r.name), 'All recipients should have id and name');
    });

    test('2. Save recipients to database', async () => {
        console.log('\n💾 Saving recipients to database...');
        const saved = await upsertRecipients(recipients);
        console.log(`   ✅ Saved/updated ${saved} recipients`);

        assert.ok(saved >= recipients.length, 'Should save at least as many as fetched');
    });

    test('3. Verify recipients in database', async () => {
        console.log('\n🔍 Verifying database persistence...');
        const dbRecipients = await listRecipientsDb();
        console.log(`   Database has ${dbRecipients.length} recipients`);

        assert.ok(dbRecipients.length >= recipients.length, 'DB should have all saved recipients');

        // Verify each recipient exists
        for (const recipient of recipients.slice(0, 5)) {
            const found = dbRecipients.find(r => r.id === recipient.id);
            assert.ok(found, `${recipient.name} should be in database`);
            assert.equal(found.name, recipient.name, 'Name should match');
            console.log(`   ✅ ${recipient.name} verified`);
        }
    });

    test('4. Fetch user statuses from Snapchat', async () => {
        console.log('\n📊 Fetching user statuses...');
        const allStatuses = await bot.userStatus();
        console.log(`   Found ${allStatuses.length} total statuses`);

        statuses = filterBlacklisted(allStatuses);
        console.log(`   ✅ ${statuses.length} non-blacklisted statuses`);

        assert.ok(Array.isArray(statuses), 'Should return array');
        if (statuses.length > 0) {
            const sample = statuses[0];
            assert.ok(sample.id, 'Status should have id');
            assert.ok(sample.name, 'Status should have name');
            assert.ok(sample.status, 'Status should have status object');
            console.log(`   Sample: ${sample.name} - ${sample.status.type || 'N/A'}`);
        }
    });

    test('5. Create and verify job in database', async () => {
        console.log('\n📋 Creating test job...');
        const jobPayload = {
            recipients: recipients.slice(0, 1).map(r => r.name),
            message: 'Test message from automated test'
        };

        const job = await createJob({
            type: 'sendText',
            payload: jobPayload,
            callbackUrl: null
        });

        console.log(`   Created job: ${job.id.slice(0, 8)}...`);
        assert.ok(job.id, 'Job should have ID');
        assert.equal(job.type, 'sendText', 'Job type should match');

        // Verify we can retrieve it
        const retrieved = await getJob(job.id);
        assert.ok(retrieved, 'Should retrieve job from DB');
        assert.equal(retrieved.id, job.id, 'IDs should match');
        console.log(`   ✅ Job verified in database`);
    });

    test('6. Query database tables for counts', async () => {
        console.log('\n📈 Database statistics:');

        const recipientCount = await pool.query('SELECT COUNT(*) as count FROM recipients');
        console.log(`   Recipients: ${recipientCount.rows[0].count}`);
        assert.ok(recipientCount.rows[0].count >= recipients.length, 'Recipients saved');

        const jobCount = await pool.query('SELECT COUNT(*) as count FROM jobs');
        console.log(`   Jobs: ${jobCount.rows[0].count}`);
        assert.ok(Number(jobCount.rows[0].count) >= 1, 'At least one job saved');

        const logCount = await pool.query('SELECT COUNT(*) as count FROM logs');
        console.log(`   Logs: ${logCount.rows[0].count}`);

        console.log('   ✅ All database tables accessible');
    });
});
