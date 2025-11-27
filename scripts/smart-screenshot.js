import { createConnectedSnapBot } from '../utils/connectToSession.js';
import {
    dismissPopups,
    ensureCameraPage,
    captureSnapRobust,
    openRecipientSelector,
    selectStoryOption,
    clickSendButton,
    delay
} from '../utils/stateManager.js';
import path from 'path';
import fs from 'fs';

const IMAGE_PATH = path.resolve('test_assets/test_image.png');

async function smartScreenshot() {
    console.log('📸 Smart UI Screenshot - With State Management\n');
    console.log('='.repeat(70));

    try {
        const bot = await createConnectedSnapBot();
        console.log('✅ Connected!\n');

        const screenshotsDir = path.resolve('data/screenshots');
        fs.mkdirSync(screenshotsDir, { recursive: true });

        // Step 1: Dismiss any popups and ensure correct state
        console.log('🔧 Step 1: Preparing browser state...');
        await dismissPopups(bot.page);
        await ensureCameraPage(bot.page);
        console.log('   ✅ State ready\n');

        // Screenshot initial state
        await bot.page.screenshot({
            path: path.join(screenshotsDir, '1-initial-state.png'),
            fullPage: true
        });
        console.log('   📸 Saved: 1-initial-state.png\n');

        // Step 2: Capture snap using robust method
        console.log('📸 Step 2: Capturing snap...');
        await captureSnapRobust(bot.page, { caption: 'Screenshot test' });
        console.log('   ✅ Snap captured!\n');

        await bot.page.screenshot({
            path: path.join(screenshotsDir, '2-after-capture.png'),
            fullPage: true
        });
        console.log('   📸 Saved: 2-after-capture.png\n');

        // Step 3: Open recipient selector
        console.log('📤 Step 3: Opening recipient selector...');
        await openRecipientSelector(bot.page);
        console.log('   ✅ Selector opened!\n');

        await delay(1500); // Give UI time to fully load

        // THE KEY SCREENSHOT
        console.log('📸 Step 4: Capturing recipient selector...');
        await bot.page.screenshot({
            path: path.join(screenshotsDir, '3-RECIPIENT-SELECTOR.png'),
            fullPage: true
        });
        console.log('   ✅ Saved: 3-RECIPIENT-SELECTOR.png\n');

        // Extract visible items
        console.log('📋 Step 5: Extracting recipient data...');
        const items = await bot.page.evaluate(() => {
            const results = [];
            const selectors = ['ul.UxcmY li', 'div[role="listitem"]'];

            selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach((el, idx) => {
                    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
                        results.push({
                            selector,
                            index: idx,
                            text: el.textContent?.trim().substring(0, 100) || '',
                            className: el.className,
                            hasStory: el.textContent?.toLowerCase().includes('story') || false,
                            hasSpotlight: el.textContent?.toLowerCase().includes('spotlight') || false
                        });
                    }
                });
            });

            return results;
        });

        console.log(`   Found ${items.length} items\n`);

        // Show story-related items
        const storyItems = items.filter(i => i.hasStory || i.hasSpotlight);
        if (storyItems.length > 0) {
            console.log('🎯 STORY OPTIONS FOUND:');
            storyItems.forEach(item => {
                console.log(`   ✨ "${item.text}"`);
                console.log(`      Selector: ${item.selector}[${item.index}]`);
                console.log(`      Class: ${item.className}\n`);
            });
        } else {
            console.log('📋 First 10 items (for reference):');
            items.slice(0, 10).forEach((item, i) => {
                console.log(`   [${i}] "${item.text}"`);
            });
        }

        // Save data
        fs.writeFileSync(
            path.join(screenshotsDir, 'recipient-data.json'),
            JSON.stringify(items, null, 2)
        );
        console.log('\n💾 Data saved to: recipient-data.json');

        console.log('\n' + '='.repeat(70));
        console.log('✅ Smart screenshot complete!');
        console.log('\n📂 Check: data/screenshots/3-RECIPIENT-SELECTOR.png');
        console.log('   This shows exactly what options are available for posting.');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
    }
}

smartScreenshot();
