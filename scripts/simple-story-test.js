import { createConnectedSnapBot } from '../utils/connectToSession.js';
import path from 'path';

const IMAGE_PATH = path.resolve('test_assets/test_image.png');

async function simpleStoryTest() {
    console.log('🧪 Simple Story Posting Test\n');
    console.log('='.repeat(60));

    try {
        console.log('🔌 Connecting...');
        const bot = await createConnectedSnapBot();
        console.log('✅ Connected!\n');

        // Test: Post to My Story
        console.log('📸 Test: Posting to My Story...');
        console.log('   Step 1: Capturing snap...');

        await bot.captureSnap({
            path: IMAGE_PATH,
            caption: 'Simple test - My Story'
        });

        console.log('   Step 2: Attempting to post to My Story...');
        await bot.postToMyStory();

        console.log('\n' + '='.repeat(60));
        console.log('✅ Test Complete!');
        console.log('\n💡 Check your Snapchat to verify the story was posted.');

    } catch (error) {
        console.error('\n❌ Test failed:');
        console.error('   Error:', error.message);
        console.error('\n📋 Full error:', error);
        console.log('\n💡 This error will help us identify which selector needs updating.');
    }
}

simpleStoryTest();
