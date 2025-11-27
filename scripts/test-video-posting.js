import { createConnectedSnapBot } from '../utils/connectToSession.js';
import { createStoryPost } from '../db/repositories.js';
import path from 'path';

async function testVideoPosting() {
    console.log('🎥 Testing Video Posting to Snapchat\n');
    console.log('='.repeat(60));

    try {
        const bot = await createConnectedSnapBot();
        console.log('✅ Connected!\n');

        // METHOD 1: Record a video (5 seconds)
        console.log('🎬 Option 1: Recording video...');
        await bot.recordVideo({
            caption: 'Automated video post!',
            durationMs: 5000  // 5 seconds
        });
        console.log('   ✅ Video recorded!\n');

        // Post to My Story
        console.log('📤 Posting video to My Story...');
        await bot.postToMyStory();
        console.log('   ✅ Posted!\n');

        // Save to database
        const videoPost = await createStoryPost({
            storyType: 'my_story',
            mediaType: 'video',
            caption: 'Automated video post!',
            durationSeconds: 5,
            metadata: {
                recordedLive: true,
                source: 'bot'
            }
        });
        console.log(`   💾 Saved to DB: ${videoPost.id.slice(0, 8)}...\n`);

        // METHOD 2: Upload pre-recorded video (if you have one)
        console.log('\n🎬 Option 2: Uploading pre-recorded video...');
        const VIDEO_PATH = path.resolve('test_assets/test_video.mp4');

        // Note: You'll need to add the uploadVideo method to SnapBot class
        // await bot.uploadVideo({
        //     videoPath: VIDEO_PATH,
        //     caption: 'Uploaded video!'
        // });
        // await bot.postToSpotlight();

        console.log('\n' + '='.repeat(60));
        console.log('✅ Video posting test complete!');
        console.log('\n💡 Check your Snapchat to verify the video story was posted.');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
    }
}

testVideoPosting();
