import SnapBot from '../snapbot.js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

const { USER_NAME, USER_PASSWORD } = process.env;
const RECIPIENT_NAME = '- > Sarah < - Ashley'; // Full exact name from Snapchat

async function testSendPicture() {
    const bot = new SnapBot();
    try {
        console.log('--- Testing Picture Sending ---');

        // 1. Launch & Login
        console.log('[1/3] Launching & Logging in...');
        await bot.launchSnapchat({ headless: false });
        const logged = await bot.ensureLoggedIn({ username: USER_NAME, password: USER_PASSWORD }, { handlePopup: true, retry: 1 });
        if (!logged) throw new Error('Login failed');
        console.log('✅ Login successful');

        // 2. Capture Snap with Image
        console.log('[2/3] Capturing snap with test image...');
        const imagePath = path.resolve(process.cwd(), 'test_assets', 'test_image.png');
        await bot.captureSnap({
            path: imagePath,
            caption: 'Test picture from SnapBot!'
        });
        console.log('✅ Snap captured with image and caption');

        // 3. Send to Specific Recipient
        console.log(`[3/3] Sending to "${RECIPIENT_NAME}"...`);
        await bot.sendToRecipients([RECIPIENT_NAME]);
        console.log('✅ Snap sent successfully!');

        console.log('--- Test Completed Successfully ---');

    } catch (e) {
        console.error('❌ Test Failed:', e);
    } finally {
        console.log('Closing browser in 5 seconds...');
        await new Promise(r => setTimeout(r, 5000));
        await bot.closeBrowser();
    }
}

testSendPicture();
