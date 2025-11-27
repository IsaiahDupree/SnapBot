import { createConnectedSnapBot } from '../utils/connectToSession.js';
import { dismissPopups, ensureCameraPage, delay } from '../utils/stateManager.js';

async function findUploadButton() {
    console.log('🔍 Brute-force Upload Button Discovery\n');

    try {
        const bot = await createConnectedSnapBot();
        console.log('✅ Connected!\n');

        await dismissPopups(bot.page);
        await ensureCameraPage(bot.page);

        console.log('Collecting buttons...');
        // Get all buttons that are visible and not the main capture button
        const buttons = await bot.page.$$('button');
        const candidates = [];

        for (const btn of buttons) {
            const info = await btn.evaluate(el => ({
                className: el.className,
                title: el.title,
                ariaLabel: el.getAttribute('aria-label'),
                visible: el.offsetWidth > 0 && el.offsetHeight > 0,
                isCapture: el.className.includes('gK0xL') || el.className.includes('m3ODJ') // Capture button classes
            }));

            if (info.visible && !info.isCapture) {
                candidates.push({ handle: btn, ...info });
            }
        }

        console.log(`Found ${candidates.length} candidate buttons to test.`);

        for (let i = 0; i < candidates.length; i++) {
            const btn = candidates[i];
            console.log(`\n[${i + 1}/${candidates.length}] Testing button: Class="${btn.className}" Title="${btn.title}"`);

            try {
                // Setup file chooser listener with timeout
                const fileChooserPromise = new Promise((resolve) => {
                    const timeout = setTimeout(() => resolve(null), 2000);
                    bot.page.waitForFileChooser({ timeout: 2000 })
                        .then(chooser => {
                            clearTimeout(timeout);
                            resolve(chooser);
                        })
                        .catch(() => resolve(null));
                });

                // Click the button
                await btn.handle.click();

                // Wait for result
                const fileChooser = await fileChooserPromise;

                if (fileChooser) {
                    console.log('🎉 FOUND IT! This button opened the file chooser!');
                    console.log('   Selector details:');
                    console.log(`   Class: "${btn.className}"`);
                    console.log(`   Title: "${btn.title}"`);
                    console.log(`   AriaLabel: "${btn.ariaLabel}"`);

                    // Construct a unique selector
                    let selector = 'button';
                    if (btn.className) selector += `.${btn.className.split(' ').join('.')}`;
                    console.log(`\n   Recommended Selector: '${selector}'`);

                    return; // Stop after finding it
                } else {
                    console.log('   ❌ No file chooser.');

                    // Attempt to recover state (close modals etc)
                    // Press Escape
                    await bot.page.keyboard.press('Escape');
                    await delay(500);
                }

            } catch (err) {
                console.log('   ⚠️ Error clicking button:', err.message);
            }
        }

        console.log('\n❌ Finished testing all buttons. No file chooser detected.');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

findUploadButton();
