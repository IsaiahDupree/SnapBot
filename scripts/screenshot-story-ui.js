import { createConnectedSnapBot } from '../utils/connectToSession.js';
import path from 'path';
import fs from 'fs';

const IMAGE_PATH = path.resolve('test_assets/test_image.png');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function screenshotStoryUI() {
    console.log('📸 Visual UI Analysis: Screenshot the story posting interface\n');
    console.log('='.repeat(70));

    try {
        const bot = await createConnectedSnapBot();
        console.log('✅ Connected to session!\n');

        // Create screenshots directory
        const screenshotsDir = path.resolve('data/screenshots');
        fs.mkdirSync(screenshotsDir, { recursive: true });

        // Step 1: Screenshot before capture
        console.log('📸 Step 1: Taking screenshot of initial state...');
        await bot.page.screenshot({
            path: path.join(screenshotsDir, '1-before-capture.png'),
            fullPage: true
        });
        console.log('   ✅ Saved: 1-before-capture.png\n');

        // Step 2: Capture a snap
        console.log('📸 Step 2: Capturing snap...');
        await bot.captureSnap({
            path: IMAGE_PATH,
            caption: 'Screenshot test'
        });
        console.log('   ✅ Snap captured!');
        await delay(2000);

        // Screenshot after capture
        console.log('   📸 Taking screenshot after capture...');
        await bot.page.screenshot({
            path: path.join(screenshotsDir, '2-after-capture.png'),
            fullPage: true
        });
        console.log('   ✅ Saved: 2-after-capture.png\n');

        // Step 3: Click the send button
        console.log('📤 Step 3: Clicking send button...');
        const sendButton = await bot.page.$("button.YatIx.fGS78.eKaL7.Bnaur");
        if (sendButton) {
            await sendButton.click();
            console.log('   ✅ Send button clicked!');
        } else {
            console.log('   ⚠️  Primary send button not found, trying alternate...');
            const altButton = await bot.page.$("button[type='submit']");
            if (altButton) {
                await altButton.click();
                console.log('   ✅ Alternate send button clicked!');
            } else {
                throw new Error('No send button found!');
            }
        }

        await delay(2000); // Wait for UI to fully load

        // Screenshot the recipient selector UI
        console.log('   📸 Taking screenshot of recipient selector...');
        await bot.page.screenshot({
            path: path.join(screenshotsDir, '3-recipient-selector.png'),
            fullPage: true
        });
        console.log('   ✅ Saved: 3-recipient-selector.png\n');

        // Step 4: Extract text content of visible list items
        console.log('📋 Step 4: Extracting visible recipient options...');
        const recipients = await bot.page.evaluate(() => {
            const items = [];

            // Check multiple possible selectors
            const selectors = [
                'ul.UxcmY li',
                'div[role="listitem"]',
                'ul li',
                '.recipient-item'
            ];

            selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach((el, idx) => {
                    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
                        const text = el.textContent?.trim() || '';
                        const className = el.className;
                        const children = Array.from(el.children).map(child => ({
                            tag: child.tagName,
                            class: child.className,
                            text: child.textContent?.trim().substring(0, 50)
                        }));

                        items.push({
                            selector,
                            index: idx,
                            text: text.substring(0, 100),
                            className,
                            hasStoryKeyword: text.toLowerCase().includes('story') ||
                                text.toLowerCase().includes('spotlight'),
                            children
                        });
                    }
                });
            });

            return items;
        });

        console.log(`   Found ${recipients.length} visible recipient items\n`);

        // Display story-related items
        const storyItems = recipients.filter(r => r.hasStoryKeyword);
        if (storyItems.length > 0) {
            console.log('🎯 STORY-RELATED ITEMS:');
            storyItems.forEach(item => {
                console.log(`\n   ✨ ${item.selector}[${item.index}]`);
                console.log(`      Text: "${item.text}"`);
                console.log(`      Class: "${item.className}"`);
            });
        } else {
            console.log('⚠️  No items with "story" or "spotlight" keywords found.');
            console.log('   Showing first 5 items for reference:\n');
            recipients.slice(0, 5).forEach(item => {
                console.log(`   ${item.selector}[${item.index}]`);
                console.log(`      Text: "${item.text}"`);
                console.log(`      Class: "${item.className}"\n`);
            });
        }

        // Save data
        const dataPath = path.join(screenshotsDir, 'recipient-data.json');
        fs.writeFileSync(dataPath, JSON.stringify(recipients, null, 2));
        console.log(`💾 Full data saved to: ${dataPath}\n`);

        console.log('='.repeat(70));
        console.log('\n✅ Screenshot analysis complete!');
        console.log('\n📂 Check the screenshots in: data/screenshots/');
        console.log('   - 1-before-capture.png');
        console.log('   - 2-after-capture.png');
        console.log('   - 3-recipient-selector.png (THIS IS THE KEY ONE!)');
        console.log('\n💡 Look at screenshot #3 to identify:');
        console.log('   - Where "My Story" appears');
        console.log('   - Where "Spotlight" appears (if available)');
        console.log('   - What makes them visually distinct from regular recipients');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
    }
}

screenshotStoryUI();
