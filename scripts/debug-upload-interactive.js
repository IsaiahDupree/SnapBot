import { createConnectedSnapBot } from '../utils/connectToSession.js';
import { dismissPopups, ensureCameraPage, delay } from '../utils/stateManager.js';

async function debugUploadInteractive() {
    console.log('🔍 Interactive Upload Debugger\n');

    try {
        const bot = await createConnectedSnapBot();
        console.log('✅ Connected!\n');

        await dismissPopups(bot.page);
        await ensureCameraPage(bot.page);

        console.log('Listing all visible buttons on Camera page:');
        const buttons = await bot.page.$$('button');
        const buttonInfos = [];

        for (const btn of buttons) {
            const info = await btn.evaluate(el => ({
                text: el.textContent,
                title: el.title,
                ariaLabel: el.getAttribute('aria-label'),
                class: el.className,
                visible: el.offsetWidth > 0 && el.offsetHeight > 0
            }));

            if (info.visible) {
                buttonInfos.push({ handle: btn, ...info });
                console.log(`   - Button: "${info.text}" Title: "${info.title}" Label: "${info.ariaLabel}" Class: "${info.class}"`);
            }
        }

        console.log('\nTesting potential upload buttons...');
        const potentialUploads = buttonInfos.filter(b =>
            (b.title && (b.title.toLowerCase().includes('upload') || b.title.toLowerCase().includes('gallery') || b.title.toLowerCase().includes('memories'))) ||
            (b.ariaLabel && (b.ariaLabel.toLowerCase().includes('upload') || b.ariaLabel.toLowerCase().includes('gallery') || b.ariaLabel.toLowerCase().includes('memories'))) ||
            b.class.includes('FBYjn') // Common class for circular buttons
        );

        for (const btn of potentialUploads) {
            console.log(`\n👉 Clicking: "${btn.title || btn.ariaLabel || btn.class}"`);
            await btn.handle.click();
            await delay(1000);

            const fileInput = await bot.page.$('input[type="file"]');
            if (fileInput) {
                console.log('   ✅ FILE INPUT FOUND! This is the upload button.');
                console.log(`   Selector details: Title="${btn.title}", Label="${btn.ariaLabel}", Class="${btn.class}"`);
                return;
            } else {
                console.log('   ❌ No file input appeared.');
                // Try to close any modal that might have opened if it wasn't the right button
                // This is risky but necessary for testing
            }
        }

        console.log('\n❌ Could not identify upload button automatically.');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

debugUploadInteractive();
