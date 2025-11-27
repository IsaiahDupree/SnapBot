import { createConnectedSnapBot } from '../utils/connectToSession.js';
import { createStoryPost, updateStoryAnalytics } from '../db/repositories.js';
import path from 'path';

const IMAGE_PATH = path.resolve('test_assets/test_image.png');

async function testStoryPosting() {
    console.log('==================================================');
    console.log('📸 Testing Story Posting to Snapchat');
    console.log('==================================================\n');

    try {
        console.log('🔌 Connecting to active session...');
        const bot = await createConnectedSnapBot();
        console.log('✅ Connected!\n');

        // Test 1: Post to My Story
        console.log('📸 Test 1: Posting to My Story...');
        await bot.captureSnap({
            path: IMAGE_PATH,
            caption: 'Test from SnapBot - My Story'
        });
        console.log('   ✅ Snap captured');

        // Attempt to post to My Story (using existing send method patterns)
        console.log('   🚀 Attempting to post...');
        await bot.postToMyStory();
        console.log('   ✅ Posted to My Story!');

        // Save to database
        const storyPost = await createStoryPost({
            storyType: 'my_story',
            mediaPath: IMAGE_PATH,
            mediaType: 'image',
            caption: 'Test from SnapBot - My Story',
            durationSeconds: null,
            metadata: { test: true, posted_via: 'script' }
        });
        console.log(`   ✅ Saved to database: ${storyPost.id.slice(0, 8)}...\n`);

        // Test 2: Post to Spotlight
        console.log('🌟 Test 2: Posting to Spotlight...');
        await bot.captureSnap({
            path: IMAGE_PATH,
            caption: '#spotlight #test Amazing content!'
        });
        console.log('   ✅ Snap captured');

        await bot.postToSpotlight();
        console.log('   ✅ Posted to Spotlight!');

        const spotlightPost = await createStoryPost({
            storyType: 'spotlight',
            mediaPath: IMAGE_PATH,
            mediaType: 'image',
            caption: '#spotlight #test Amazing content!',
            durationSeconds: null,
            metadata: { hashtags: ['spotlight', 'test'] }
        });
        console.log(`   ✅ Saved to database: ${spotlightPost.id.slice(0, 8)}...\n`);

        console.log('==================================================');
        console.log('✅ Story posting tests complete!');
        console.log('==================================================');
        console.log('\n📝 Next steps:');
        console.log('   1. Check your Snapchat app/web to confirm posts appear');
        console.log('   2. Update analytics with real view counts');
        console.log('   3. Track engagement over time');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error);
    }
}

testStoryPosting();
