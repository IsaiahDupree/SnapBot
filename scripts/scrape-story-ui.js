import { createConnectedSnapBot } from '../utils/connectToSession.js';
import path from 'path';
import fs from 'fs';

const IMAGE_PATH = path.resolve('test_assets/test_image.png');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeStoryUI() {
    console.log('📸 Full workflow: Capture snap → Open send UI → Scrape story options\n');

    try {
        const bot = await createConnectedSnapBot();
        console.log('✅ Connected to session!\n');

        // Step 1: Capture a snap
        console.log('📸 Step 1: Capturing snap...');
        await bot.captureSnap({
            path: IMAGE_PATH,
            caption: 'Test for story scraping'
        });
        console.log('✅ Snap captured!\n');
        await delay(2000);

        // Step 2: Click the send button to open recipient selector
        console.log('📤 Step 2: Clicking send button to open recipient selector...');
        const sendButton = await bot.page.$("button.YatIx.fGS78.eKaL7.Bnaur");
        if (sendButton) {
            await sendButton.click();
            console.log('✅ Send button clicked!');
            await delay(2000); // Wait for UI to load
        } else {
            console.log('⚠️  Send button not found - trying alternate selector...');
            // Try the submit button
            const submitBtn = await bot.page.$("button[type='submit']");
            if (submitBtn) {
                await submitBtn.click();
                console.log('✅ Submit button clicked!');
                await delay(2000);
            }
        }

        console.log('\n🔍 Step 3: Scraping UI for story options...\n');

        // Step 3: Scrape the recipient selector
        const uiData = await bot.page.evaluate(() => {
            const data = {
                listItems: [],
                divs: [],
                buttons: [],
                submitButton: null
            };

            // Look for list items that might contain story options
            const listItems = document.querySelectorAll('div[role="listitem"], li, ul li');
            listItems.forEach((item, index) => {
                const text = item.textContent?.trim() || '';
                const visible = item.offsetWidth > 0 && item.offsetHeight > 0;

                if (visible) {
                    data.listItems.push({
                        index,
                        textContent: text.substring(0, 200),
                        className: item.className,
                        ariaLabel: item.getAttribute('aria-label'),
                        id: item.id || null,
                        hasStoryKeyword: text.toLowerCase().includes('story') ||
                            text.toLowerCase().includes('spotlight') ||
                            text.toLowerCase().includes('public'),
                        visible
                    });
                }
            });

            // Look for divs that might be clickable story options
            const allDivs = document.querySelectorAll('div');
            allDivs.forEach((div, index) => {
                const text = div.textContent?.trim() || '';
                const visible = div.offsetWidth > 0 && div.offsetHeight > 0;

                if (visible && (
                    text.toLowerCase().includes('my story') ||
                    text.toLowerCase().includes('spotlight') ||
                    text.toLowerCase().includes('public story')
                )) {
                    data.divs.push({
                        index,
                        textContent: text.substring(0, 100),
                        className: div.className,
                        ariaLabel: div.getAttribute('aria-label'),
                        id: div.id || null,
                        clickable: div.onclick !== null || div.getAttribute('role') === 'button'
                    });
                }
            });

            // Get all visible buttons
            const buttons = document.querySelectorAll('button');
            buttons.forEach((btn, index) => {
                if (btn.offsetWidth > 0 && btn.offsetHeight > 0) {
                    data.buttons.push({
                        index,
                        className: btn.className,
                        type: btn.type,
                        textContent: btn.textContent?.trim().substring(0, 100) || null,
                        ariaLabel: btn.getAttribute('aria-label'),
                        title: btn.title
                    });
                }
            });

            // Look specifically for submit button
            const submitBtn = document.querySelector('button[type="submit"]');
            if (submitBtn) {
                data.submitButton = {
                    className: submitBtn.className,
                    visible: submitBtn.offsetWidth > 0 && submitBtn.offsetHeight > 0,
                    textContent: submitBtn.textContent?.trim()
                };
            }

            return data;
        });

        console.log('='.repeat(80));
        console.log(`\n📊 Results:`);
        console.log(`   - Total visible list items: ${uiData.listItems.length}`);
        console.log(`   - Story-related divs: ${uiData.divs.length}`);
        console.log(`   - Total visible buttons: ${uiData.buttons.length}`);

        // Show story-related list items
        const storyItems = uiData.listItems.filter(item => item.hasStoryKeyword);
        if (storyItems.length > 0) {
            console.log(`\n🎯 STORY-RELATED LIST ITEMS (${storyItems.length}):`);
            storyItems.forEach(item => {
                console.log(`\n   📝 Item #${item.index}`);
                console.log(`      Text: "${item.textContent}"`);
                console.log(`      Class: "${item.className}"`);
                if (item.ariaLabel) console.log(`      Aria-label: "${item.ariaLabel}"`);
            });
        } else {
            console.log('\n⚠️  No story-related list items found in the standard way.');
        }

        // Show story-related divs
        if (uiData.divs.length > 0) {
            console.log(`\n✨ STORY-RELATED DIVS (${uiData.divs.length}):`);
            uiData.divs.forEach(div => {
                console.log(`\n   📦 Div #${div.index}`);
                console.log(`      Text: "${div.textContent}"`);
                console.log(`      Class: "${div.className}"`);
                console.log(`      Clickable: ${div.clickable}`);
            });
        }

        // Show first 10 list items for reference
        console.log(`\n📋 First10 list items (for reference):`);
        uiData.listItems.slice(0, 10).forEach(item => {
            console.log(`   ${item.index}: "${item.textContent.substring(0, 50)}..." | Class: ${item.className}`);
        });

        console.log('\n' + '='.repeat(80));

        // Save data
        const outputPath = 'data/story-ui-scrape.json';
        fs.mkdirSync('data', { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(uiData, null, 2));
        console.log(`\n💾 Full data saved to: ${outputPath}`);

        console.log('\n✅ Scrape complete!');

        // Provide recommendations
        if (storyItems.length > 0 || uiData.divs.length > 0) {
            console.log('\n💡 RECOMMENDATION:');
            console.log('   Use the class names above to update the postToMyStory() and postToSpotlight() methods!');
        } else {
            console.log('\n⚠️  Could not find story options.');
            console.log('   This might mean:');
            console.log('   1. The send UI selector has changed');
            console.log('   2. Story posting is done differently on web');
            console.log('   3. We need to look at the DOM structure more carefully');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

scrapeStoryUI();
