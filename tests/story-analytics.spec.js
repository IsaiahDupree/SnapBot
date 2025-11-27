import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
    createStoryPost,
    getStoryPost,
    listStoryPosts,
    updateStoryAnalytics,
    getStoryAnalytics,
    addStoryViewer,
    getStoryViewers,
    createEngagementSnapshot,
    getEngagementHistory
} from '../db/repositories.js';
import path from 'path';

describe('Story Posts & Analytics Tests', { timeout: 60000 }, () => {
    let testStoryId;
    let spotlightStoryId;

    test('1. Create My Story post', async () => {
        console.log('\n📸 Creating My Story post...');
        const result = await createStoryPost({
            storyType: 'my_story',
            mediaPath: path.resolve('test_assets/test_image.png'),
            mediaType: 'image',
            caption: 'Test story from automated test!',
            durationSeconds: null,
            metadata: { hashtags: ['test', 'automation'] }
        });

        assert.ok(result.id, 'Should return story ID');
        testStoryId = result.id;
        console.log(`   ✅ Story created: ${testStoryId.slice(0, 8)}...`);
    });

    test('2. Create Spotlight post', async () => {
        console.log('\n🌟 Creating Spotlight post...');
        const result = await createStoryPost({
            storyType: 'spotlight',
            mediaPath: path.resolve('test_assets/test_video.mp4'),
            mediaType: 'video',
            caption: 'Viral content! #spotlight',
            durationSeconds: 15,
            metadata: { hashtags: ['viral', 'spotlight'] }
        });

        assert.ok(result.id, 'Should return story ID');
        spotlightStoryId = result.id;
        console.log(`   ✅ Spotlight created: ${spotlightStoryId.slice(0, 8)}...`);
    });

    test('3. Retrieve story posts', async () => {
        console.log('\n📋 Retrieving story posts...');

        const myStory = await getStoryPost(testStoryId);
        assert.ok(myStory, 'Should retrieve My Story');
        assert.equal(myStory.story_type, 'my_story');
        console.log(`   ✅ Retrieved: ${myStory.caption}`);

        const spotlight = await getStoryPost(spotlightStoryId);
        assert.ok(spotlight, 'Should retrieve Spotlight');
        assert.equal(spotlight.story_type, 'spotlight');
        console.log(`   ✅ Retrieved: ${spotlight.caption}`);
    });

    test('4. List story posts by type', async () => {
        console.log('\n📊 Listing stories by type...');

        const myStories = await listStoryPosts({ storyType: 'my_story' });
        assert.ok(myStories.length >= 1, 'Should have at least one My Story');
        console.log(`   ✅ Found ${myStories.length} My Story post(s)`);

        const spotlightPosts = await listStoryPosts({ storyType: 'spotlight' });
        assert.ok(spotlightPosts.length >= 1, 'Should have at least one Spotlight post');
        console.log(`   ✅ Found ${spotlightPosts.length} Spotlight post(s)`);
    });

    test('5. Update analytics for My Story', async () => {
        console.log('\n📈 Updating My Story analytics...');

        await updateStoryAnalytics(testStoryId, {
            total_views: 120,
            total_screenshots: 5,
            total_shares: 8,
            total_likes: 45,
            reach: 115
        });

        const analytics = await getStoryAnalytics(testStoryId);
        assert.equal(analytics.total_views, 120);
        assert.equal(analytics.total_likes, 45);
        assert.equal(analytics.reach, 115);
        console.log(`   ✅ Analytics: ${analytics.total_views} views, ${analytics.total_likes} likes`);
    });

    test('6. Update analytics for Spotlight', async () => {
        console.log('\n🌟 Updating Spotlight analytics...');

        await updateStoryAnalytics(spotlightStoryId, {
            total_views: 5420,
            total_likes: 892,
            total_shares: 124,
            total_comments: 56,
            reach: 4800,
            completion_rate: 78.5,
            avg_watch_time_seconds: 12
        });

        const analytics = await getStoryAnalytics(spotlightStoryId);
        assert.equal(analytics.total_views, 5420);
        assert.equal(analytics.total_likes, 892);
        assert.equal(analytics.completion_rate, '78.50');
        console.log(`   ✅ Spotlight Analytics: ${analytics.total_views} views, ${analytics.total_likes} likes, ${analytics.completion_rate}% completion`);
    });

    test('7. Add story viewers', async () => {
        console.log('\n👥 Adding story viewers...');

        // Add viewers to My Story
        await addStoryViewer(testStoryId, 'Sarah', { tookScreenshot: true });
        await addStoryViewer(testStoryId, 'Quincy', { shared: true });
        await addStoryViewer(testStoryId, 'Des');

        const viewers = await getStoryViewers(testStoryId);
        assert.ok(viewers.length >= 3, 'Should have at least 3 viewers');
        console.log(`   ✅ ${viewers.length} viewers recorded`);
        viewers.slice(0, 3).forEach(v =>
            console.log(`      - ${v.viewer_name} ${v.took_screenshot ? '📸' : ''} ${v.shared ? '🔄' : ''}`)
        );
    });

    test('8. Create engagement snapshots', async () => {
        console.log('\n📊 Creating engagement snapshots...');

        // Create snapshot for My Story
        const snapshot1 = await createEngagementSnapshot(testStoryId);
        assert.ok(snapshot1.id, 'Should create snapshot');

        // Wait a bit and create another
        await new Promise(r => setTimeout(r, 1000));

        // Update analytics slightly
        await updateStoryAnalytics(testStoryId, { total_views: 135 });
        const snapshot2 = await createEngagementSnapshot(testStoryId);

        const history = await getEngagementHistory(testStoryId);
        assert.ok(history.length >= 2, 'Should have engagement history');
        console.log(`   ✅ ${history.length} snapshots created`);
        console.log(`      Latest: ${history[0].views} views`);
    });

    test('9. Verify complete story workflow', async () => {
        console.log('\n✅ Verifying complete workflow...');

        const allStories = await listStoryPosts();
        console.log(`   📸 Total stories: ${allStories.length}`);

        for (const story of allStories.slice(0, 2)) {
            const analytics = await getStoryAnalytics(story.id);
            console.log(`   - ${story.story_type}: ${analytics.total_views} views, ${analytics.total_likes} likes`);
        }

        assert.ok(allStories.length >= 2, 'Should have at least 2 stories');
        console.log(`   ✅ Workflow verified!`);
    });
});
