import { createConnectedSnapBot } from '../utils/connectToSession.js';
import path from 'path';
import fs from 'fs';

const IMAGE_PATH = path.resolve('test_assets/test_image.png');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function quickScreenshot() {
    console.log('📸 Quick UI Screenshot - Focus on recipient selector\n');

    try {
        const bot = await createConnectedSnapBot();
        console.log('✅ Connected!\n');

        const screenshotsDir = path.resolve('data/screenshots');
        fs.mkdirSync(screenshotsDir, { recursive: true });

        // Use the simpler captureSnap from the original code
        console.log('📸 Capturing snap (simplified)...');

        // Click camera button
        const cameraBtn = await bot.page.$("button.qJKfS");
        if (cameraBtn) {
            await cameraBtn.click();
            console.log('   Camera button clicked');
            await delay(2000);
        }

        // Click capture
        const captureBtn = await bot.page.$("button.FBYjn.gK0xL.A7Cr_.m3ODJ");
        if (captureBtn) {
            await captureBtn.click();
            console.log('   Capture button clicked');
            await delay(3000);
        } else {
            console.log('   Using alternate capture method...');
            await bot.page.screenshot({ path: path.join(screenshotsDir, 'camera-ui.png') });
        }

        console.log('\n📤 Clicking send button...');
        const sendBtn = await bot.page.$("button.YatIx.fGS78.eKaL7.Bnaur");
        if (sendBtn) {
            await sendBtn.click();
            console.log('   Send button clicked!');
            await delay(2500);

            // SCREENSHOT THE RECIPIENT SELECTOR
            console.log('\n📸 Taking screenshot of recipient selector...');
            await bot.page.screenshot({
                path: path.join(screenshotsDir, 'RECIPIENT-SELECTOR.png'),
                fullPage: true
            });
            console.log('   ✅ Saved: RECIPIENT-SELECTOR.png');

            // Extract list items
            const items = await bot.page.evaluate(() => {
                const results = [];
                const allLi = document.querySelectorAll('ul.UxcmY li, div[role="listitem"]');

                allLi.forEach((el, idx) => {
                    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
                        results.push({
                            index: idx,
                            text: el.textContent?.trim().substring(0, 100) || '',
                            className: el.className
                        });
                    }
                });

                return results;
            });

            console.log(`\n📋 Found ${items.length} visible items:`);
            items.slice(0, 10).forEach(item => {
                console.log(`   [${item.index}] "${item.text}"`);
            });

            fs.writeFileSync(
                path.join(screenshotsDir, 'items.json'),
                JSON.stringify(items, null, 2)
            );

        } else {
            console.log('   ⚠️  Send button not found!');
        }

        console.log('\n✅ Complete! Check data/screenshots/RECIPIENT-SELECTOR.png');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

quickScreenshot();
