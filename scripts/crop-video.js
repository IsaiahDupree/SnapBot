/**
 * Crop and prepare video for Snapchat testing
 * Converts video to vertical format (9:16) suitable for Stories/Spotlight
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

const INPUT_VIDEO = 'C:\\Users\\Isaia\\Documents\\Coding\\SnapChatAutomation\\SnapBot\\20251125_2334_01kaz3wxhef9vvbjgx5v217v1x.mp4';
const OUTPUT_DIR = 'test_assets';
const OUTPUT_VIDEO = path.join(OUTPUT_DIR, 'test_video.mp4');
const OUTPUT_SHORT = path.join(OUTPUT_DIR, 'test_video_short.mp4');  // 10 second version

async function cropVideo() {
    console.log('🎬 Video Cropping Tool for SnapBot\n');
    console.log('='.repeat(70));

    try {
        // Check if FFmpeg is installed
        console.log('🔍 Checking for FFmpeg...');
        try {
            const { stdout } = await execAsync('ffmpeg -version');
            console.log('   ✅ FFmpeg found!\n');
        } catch (error) {
            console.error('❌ FFmpeg not found!');
            console.log('\n📥 Please install FFmpeg:');
            console.log('   Windows: winget install FFmpeg');
            console.log('   Or download from: https://ffmpeg.org/download.html\n');
            return;
        }

        // Create output directory
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
            console.log(`📁 Created directory: ${OUTPUT_DIR}\n`);
        }

        // Get video info
        console.log('📊 Analyzing input video...');
        const { stdout: probeOutput } = await execAsync(`ffprobe -v error -show_entries format=duration -show_entries stream=width,height -of json "${INPUT_VIDEO}"`);
        const videoInfo = JSON.parse(probeOutput);
        const duration = parseFloat(videoInfo.format.duration);
        const width = videoInfo.streams[0].width;
        const height = videoInfo.streams[0].height;

        console.log(`   Original: ${width}x${height}`);
        console.log(`   Duration: ${duration.toFixed(1)}s\n`);

        // Crop to vertical format (1080x1920 for Snapchat Stories)
        console.log('✂️  Cropping to vertical format (1080x1920)...');

        // Calculate crop parameters to center the video
        const targetWidth = 1080;
        const targetHeight = 1920;
        const targetRatio = targetHeight / targetWidth;  // 16:9
        const currentRatio = height / width;

        let cropFilter;
        if (currentRatio > targetRatio) {
            // Video is taller than target, crop height
            const cropHeight = Math.floor(width * targetRatio);
            cropFilter = `crop=${width}:${cropHeight}`;
        } else {
            // Video is wider than target, crop width
            const cropWidth = Math.floor(height / targetRatio);
            cropFilter = `crop=${cropWidth}:${height}`;
        }

        // Full length cropped video
        const cropCommand = `ffmpeg -i "${INPUT_VIDEO}" -vf "${cropFilter},scale=1080:1920" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -y "${OUTPUT_VIDEO}"`;

        console.log('   Processing...');
        await execAsync(cropCommand);
        console.log(`   ✅ Saved: ${OUTPUT_VIDEO}\n`);

        // Create short version (first 10 seconds for quick tests)
        console.log('⏱️  Creating short version (10 seconds)...');
        const shortCommand = `ffmpeg -i "${INPUT_VIDEO}" -t 10 -vf "${cropFilter},scale=1080:1920" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -y "${OUTPUT_SHORT}"`;

        await execAsync(shortCommand);
        console.log(`   ✅ Saved: ${OUTPUT_SHORT}\n`);

        // Get file sizes
        const fullSize = (fs.statSync(OUTPUT_VIDEO).size / 1024 / 1024).toFixed(2);
        const shortSize = (fs.statSync(OUTPUT_SHORT).size / 1024 / 1024).toFixed(2);

        console.log('='.repeat(70));
        console.log('\n✅ Video processing complete!\n');
        console.log('📦 Output files:');
        console.log(`   1. ${OUTPUT_VIDEO} (${fullSize} MB)`);
        console.log(`   2. ${OUTPUT_SHORT} (${shortSize} MB) - 10s version\n`);

        console.log('🎯 Ready for testing!');
        console.log('   Use in scripts with:');
        console.log(`   const VIDEO_PATH = path.resolve('${OUTPUT_VIDEO}');\n`);

    } catch (error) {
        console.error('\n❌ Error processing video:', error.message);
        if (error.stderr) {
            console.error('FFmpeg error:', error.stderr);
        }
    }
}

cropVideo();
