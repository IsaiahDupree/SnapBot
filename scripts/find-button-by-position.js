import { createConnectedSnapBot } from '../utils/connectToSession.js';
import { dismissPopups, ensureCameraPage, delay } from '../utils/stateManager.js';

async function findButtonByPosition() {
    console.log('📍 Position-based Button Discovery\n');

    try {
        const bot = await createConnectedSnapBot();
        console.log('✅ Connected!\n');

        await dismissPopups(bot.page);
        await ensureCameraPage(bot.page);

        // Find capture button
        const captureBtn = await bot.page.$('button.gK0xL, button.m3ODJ');
        if (!captureBtn) {
            console.log('❌ Could not find capture button!');
            return;
        }

        const captureBox = await captureBtn.boundingBox();
        console.log(`📸 Capture button at: x=${captureBox.x}, y=${captureBox.y}, w=${captureBox.width}`);

        // Find all other buttons
        const buttons = await bot.page.$$('button');
        const candidates = [];

        for (const btn of buttons) {
            const box = await btn.boundingBox();
            if (!box) continue;

            // Skip if it's the capture button (overlapping position)
            if (Math.abs(box.x - captureBox.x) < 10 && Math.abs(box.y - captureBox.y) < 10) continue;

            // Check if it's roughly on the same Y level (bottom bar)
            const yDiff = Math.abs(box.y - captureBox.y);
            if (yDiff < 100) {
                candidates.push({ handle: btn, box });
            }
        }

        console.log(`Found ${candidates.length} buttons in the bottom area.`);

        // Filter for buttons to the LEFT
        const leftButtons = candidates.filter(c => c.box.x < captureBox.x);
        // Sort by X descending (closest to capture button)
        leftButtons.sort((a, b) => b.box.x - a.box.x);

        console.log(`Found ${leftButtons.length} buttons to the LEFT of capture.`);

        if (leftButtons.length > 0) {
            const target = leftButtons[0]; // Closest to left
            console.log(`🎯 Most likely candidate: x=${target.box.x}, y=${target.box.y}`);

            // Get class info
            const info = await target.handle.evaluate(el => ({
                className: el.className,
                title: el.title,
                ariaLabel: el.getAttribute('aria-label')
            }));
            console.log(`   Class: "${info.className}"`);
            console.log(`   Title: "${info.title}"`);

            // Test it
            console.log('👉 Clicking candidate...');

            const fileChooserPromise = new Promise((resolve) => {
                const timeout = setTimeout(() => resolve(null), 3000);
                bot.page.waitForFileChooser({ timeout: 3000 })
                    .then(chooser => {
                        clearTimeout(timeout);
                        resolve(chooser);
                    })
                    .catch(() => resolve(null));
            });

            await target.handle.click();
            const fileChooser = await fileChooserPromise;

            if (fileChooser) {
                console.log('🎉 FOUND IT! This is the upload button!');
                console.log(`   Selector: button.${info.className.split(' ').join('.')}`);
            } else {
                console.log('❌ Did not trigger file chooser.');

                // Check if it opened "Memories" view (which has tabs "Snaps", "Camera Roll", etc)
                // If so, we might need to click "Camera Roll" or "Import" inside it
                console.log('   Checking for "Import" or "Camera Roll" buttons...');
                await delay(1000);

                // Look for "Import" button
                const importBtn = await bot.page.$('button:has-text("Import"), button[title*="Import"]');
                if (importBtn) {
                    console.log('   Found "Import" button inside!');
                }
            }
        } else {
            console.log('❌ No buttons found to the left of capture button.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

findButtonByPosition();
