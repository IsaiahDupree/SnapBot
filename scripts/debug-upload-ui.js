import { createConnectedSnapBot } from '../utils/connectToSession.js';
import { dismissPopups, ensureCameraPage, delay } from '../utils/stateManager.js';
import path from 'path';
import fs from 'fs';

async function debugUploadUI() {
    console.log('🔍 Debugging Upload UI\n');

    try {
        const bot = await createConnectedSnapBot();
        console.log('✅ Connected!\n');

        await dismissPopups(bot.page);
        await ensureCameraPage(bot.page);

        const screenshotsDir = path.resolve('data/screenshots');
        fs.mkdirSync(screenshotsDir, { recursive: true });

        // Screenshot camera page
        await bot.page.screenshot({
            path: path.join(screenshotsDir, 'camera-page-upload-debug.png'),
            fullPage: true
        });
        console.log('📸 Saved camera page screenshot');

        // Scrape potential upload buttons
        const buttons = await bot.page.evaluate(() => {
            const results = [];
            const allButtons = document.querySelectorAll('button');

            allButtons.forEach((btn, idx) => {
                if (btn.offsetWidth > 0 && btn.offsetHeight > 0) {
                    results.push({
                        index: idx,
                        text: btn.textContent?.trim() || '',
                        title: btn.title || '',
                        ariaLabel: btn.getAttribute('aria-label') || '',
                        className: btn.className,
                        html: btn.outerHTML.substring(0, 100)
                    });
                }
            });
            return results;
        });

        console.log(`\nFound ${buttons.length} visible buttons. Potential upload buttons:`);
        const potentialUploads = buttons.filter(b =>
            b.title.toLowerCase().includes('upload') ||
            b.ariaLabel.toLowerCase().includes('upload') ||
            b.title.toLowerCase().includes('gallery') ||
            b.ariaLabel.toLowerCase().includes('gallery') ||
            b.title.toLowerCase().includes('memories') ||
            b.ariaLabel.toLowerCase().includes('memories')
        );

        potentialUploads.forEach(b => {
            console.log(`   [${b.index}] Title: "${b.title}", Label: "${b.ariaLabel}", Class: "${b.className}"`);
        });

        // Check for file inputs
        const inputs = await bot.page.evaluate(() => {
            const results = [];
            const allInputs = document.querySelectorAll('input');
            allInputs.forEach((inp, idx) => {
                results.push({
                    index: idx,
                    type: inp.type,
                    accept: inp.accept,
                    visible: inp.offsetWidth > 0 && inp.offsetHeight > 0
                });
            });
            return results;
        });

        console.log(`\nFound ${inputs.length} inputs. File inputs:`);
        const fileInputs = inputs.filter(i => i.type === 'file');
        fileInputs.forEach(i => {
            console.log(`   [${i.index}] Type: ${i.type}, Accept: ${i.accept}, Visible: ${i.visible}`);
        });

        if (fileInputs.length === 0 && potentialUploads.length > 0) {
            console.log('\nNo file inputs found. Attempting to click potential upload buttons...');
            // Try clicking the first potential upload button
            // We need to find the element again handle
            // This is a simplified check
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

debugUploadUI();
