import { createConnectedSnapBot } from '../utils/connectToSession.js';
import { createStoryPost } from '../db/repositories.js';
import { UIObserver } from '../utils/uiObserver.js';
import path from 'path';
import fs from 'fs';

async function testVideoUpload() {
    console.log('🎥 Testing Video Upload to Snapchat (with UI Observation)\n');
    console.log('='.repeat(60));

    // Use the cropped video we created
    const VIDEO_PATH = path.resolve('test_assets/test_video.mp4');

    if (!fs.existsSync(VIDEO_PATH)) {
        console.error(`❌ Video file not found: ${VIDEO_PATH}`);
        console.log('   Please run: node scripts/crop-video.js first');
        return;
    }

    try {
        const bot = await createConnectedSnapBot();
        console.log('✅ Connected!\n');

        // Initialize Observer
        const observer = new UIObserver(bot, 'data/observations/video-test');
        await observer.observe('initial_state');

        // Try to upload the video
        try {
            console.log(`🎬 Attempting to upload video: ${path.basename(VIDEO_PATH)}`);
            await bot.uploadVideo({
                videoPath: VIDEO_PATH,
                caption: 'Automated video upload test!'
            });
            console.log('   ✅ Video uploaded successfully!\n');
            await observer.observe('after_upload_success');

        } catch (uploadError) {
            console.log('   ⚠️ Upload failed (likely due to missing selector).');
            await observer.observe('after_upload_failure');

            console.log('   🔄 Falling back to LIVE RECORDING simulation...');

            await bot.recordVideo({
                caption: 'Fallback: Live recorded video!',
                durationMs: 5000
            });
            console.log('   ✅ Video recorded (fallback)!\n');
            await observer.observe('after_recording_fallback');
        }

        // Post to My Story
        console.log('📤 Posting to My Story...');
        await bot.postToMyStory();
        console.log('   ✅ Posted!\n');
        await observer.observe('after_posting');

        // Save to database
        const videoPost = await createStoryPost({
            storyType: 'my_story',
            mediaType: 'video',
            caption: 'Automated video post!',
            durationSeconds: 10,
            metadata: {
                method: 'fallback_recording',
                original_file: path.basename(VIDEO_PATH)
            }
        });
        console.log(`   💾 Saved to DB: ${videoPost.id.slice(0, 8)}...\n`);

        console.log('='.repeat(60));
        console.log('✅ Video posting test complete!');
        console.log('\n💡 Check your Snapchat to verify the video story was posted.');
        console.log('📂 Check data/observations/video-test/ for screenshots and data.');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
    }
}

testVideoUpload();
