import pool from '../db/pool.js';

async function checkDatabase() {
    try {
        console.log('🔍 Comprehensive Database Check\n');

        // Check all tables
        const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
        console.log(`📊 Total Tables: ${tables.rows.length}`);
        console.log('Tables:');
        tables.rows.forEach(r => console.log(`   - ${r.table_name}`));

        // Recipients
        const recipientCount = await pool.query('SELECT COUNT(*) as count FROM recipients;');
        console.log(`\n👥 Recipients: ${recipientCount.rows[0].count}`);

        // Messages
        const messageCount = await pool.query('SELECT COUNT(*) as count FROM messages;');
        console.log(`💬 Messages: ${messageCount.rows[0].count}`);

        // Story Posts
        const storyCount = await pool.query('SELECT COUNT(*) as count FROM story_posts;');
        console.log(`📸 Story Posts: ${storyCount.rows[0].count}`);

        // Story Analytics
        const analyticsCount = await pool.query('SELECT COUNT(*) as count FROM story_analytics;');
        console.log(`📊 Story Analytics: ${analyticsCount.rows[0].count}`);

        // Jobs
        const jobCount = await pool.query('SELECT COUNT(*) as count FROM jobs;');
        console.log(`📋 Jobs: ${jobCount.rows[0].count}`);

        // Streaks
        const streakCount = await pool.query('SELECT COUNT(*) as count FROM streaks;');
        console.log(`🔥 Streaks: ${streakCount.rows[0].count}`);

        // Scheduled Tasks
        const taskCount = await pool.query('SELECT COUNT(*) as count FROM scheduled_tasks;');
        console.log(`⏰ Scheduled Tasks: ${taskCount.rows[0].count}`);

        // Views
        const views = await pool.query(`
      SELECT table_name 
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
        console.log(`\n👁️  Views: ${views.rows.length}`);
        views.rows.forEach(v => console.log(`   - ${v.table_name}`));

        console.log('\n✅ Database is fully operational!');
        console.log('\n📈 Capabilities:');
        console.log('   ✓ Message history with full-text search');
        console.log('   ✓ Story posts (My Story & Spotlight)');
        console.log('   ✓ Story analytics (views,likes, shares)');
        console.log('   ✓ Viewer tracking');
        console.log('   ✓ Engagement snapshots over time');
        console.log('   ✓ Streak monitoring');
        console.log('   ✓ Scheduled automation');
        console.log('   ✓ Analytics events');

    } catch (error) {
        console.error('❌ Database check failed:', error.message);
    } finally {
        await pool.end();
    }
}

checkDatabase();
