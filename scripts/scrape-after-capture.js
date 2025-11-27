import { createConnectedSnapBot } from '../utils/connectToSession.js';
import path from 'path';
import fs from 'fs';

const IMAGE_PATH = path.resolve('test_assets/test_image.png');

async function scrapeAfterCapture() {
    console.log('📸 Capturing snap and then scraping UI...\n');

    try {
        const bot = await createConnectedSnapBot();
        console.log('✅ Connected to session!\n');

        // Step 1: Capture a snap
        console.log('📸 Capturing snap...');
        await bot.captureSnap({
            path: IMAGE_PATH,
            caption: 'Test for UI scraping'
        });
        console.log('✅ Snap captured!\n');

        // Step 2: Wait a moment for UI to update
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 3: Scrape buttons
        console.log('🔍 Scraping buttons after capture...\n');

        const buttonData = await bot.page.evaluate(() => {
            const buttons = [];

            // Get all button elements
            const buttonElements = document.querySelectorAll('button');

            buttonElements.forEach((btn, index) => {
                const info = {
                    index,
                    tagName: btn.tagName,
                    id: btn.id || null,
                    className: btn.className || null,
                    title: btn.title || null,
                    ariaLabel: btn.getAttribute('aria-label') || null,
                    type: btn.type || null,
                    textContent: btn.textContent?.trim().substring(0, 100) || null,
                    visible: btn.offsetWidth > 0 && btn.offsetHeight > 0,
                    disabled: btn.disabled,
                    parentClass: btn.parentElement?.className || null,
                    hasSVG: btn.querySelector('svg') !== null,
                    svgTitle: btn.querySelector('svg title')?.textContent || null,
                    // Get computed position to see if it's in viewport
                    rect: btn.getBoundingClientRect ? {
                        top: btn.getBoundingClientRect().top,
                        left: btn.getBoundingClientRect().left,
                        width: btn.getBoundingClientRect().width,
                        height: btn.getBoundingClientRect().height
                    } : null
                };
                buttons.push(info);
            });

            // Also get divs with role="button"
            const divButtons = document.querySelectorAll('div[role="button"]');
            divButtons.forEach((btn, index) => {
                const info = {
                    index: `div-${index}`,
                    tagName: 'DIV[role="button"]',
                    id: btn.id || null,
                    className: btn.className || null,
                    title: btn.title || null,
                    ariaLabel: btn.getAttribute('aria-label') || null,
                    textContent: btn.textContent?.trim().substring(0, 100) || null,
                    visible: btn.offsetWidth > 0 && btn.offsetHeight > 0,
                    parentClass: btn.parentElement?.className || null,
                    hasSVG: btn.querySelector('svg') !== null,
                    svgTitle: btn.querySelector('svg title')?.textContent || null,
                    rect: btn.getBoundingClientRect ? {
                        top: btn.getBoundingClientRect().top,
                        left: btn.getBoundingClientRect().left,
                        width: btn.getBoundingClientRect().width,
                        height: btn.getBoundingClientRect().height
                    } : null
                };
                buttons.push(info);
            });

            // Also look for list items that might be recipients
            const listItems = document.querySelectorAll('ul li, div[role="listitem"]');
            const recipients = [];
            listItems.forEach((item, index) => {
                const text = item.textContent?.trim() || '';
                if (text.includes('Story') || text.includes('Spotlight') || text.includes('Public')) {
                    recipients.push({
                        index: `li-${index}`,
                        textContent: text.substring(0, 200),
                        className: item.className,
                        ariaLabel: item.getAttribute('aria-label'),
                        visible: item.offsetWidth > 0 && item.offsetHeight > 0
                    });
                }
            });

            return { buttons, recipients };
        });

        const visibleButtons = buttonData.buttons.filter(b => b.visible);

        console.log(`📊 Found ${buttonData.buttons.length} total buttons (${visibleButtons.length} visible)`);
        console.log(`📋 Found ${buttonData.recipients.length} story-related list items\n`);
        console.log('='.repeat(80));

        // Show buttons that might be related to sending
        const sendButtons = visibleButtons.filter(b =>
            b.className?.includes('YatIx') ||
            b.type === 'submit' ||
            (b.textContent && (b.textContent.toLowerCase().includes('send') || b.textContent.toLowerCase().includes('post')))
        );

        console.log('\n📤 Potential SEND buttons:');
        sendButtons.forEach(btn => {
            console.log(`\n   Button #${btn.index}`);
            if (btn.className) console.log(`      class: "${btn.className}"`);
            if (btn.type) console.log(`      type: "${btn.type}"`);
            if (btn.textContent) console.log(`      text: "${btn.textContent}"`);
            if (btn.ariaLabel) console.log(`      aria-label: "${btn.ariaLabel}"`);
        });

        // Show story-related recipients
        if (buttonData.recipients.length > 0) {
            console.log('\n\n🎯 STORY-RELATED list items:');
            buttonData.recipients.forEach(item => {
                console.log(`\n   ${item.index}`);
                console.log(`      text: "${item.textContent}"`);
                console.log(`      class: "${item.className}"`);
                if (item.ariaLabel) console.log(`      aria-label: "${item.ariaLabel}"`);
            });
        }

        console.log('\n' + '='.repeat(80));

        // Save data
        const outputPath = 'data/ui-after-capture.json';
        fs.mkdirSync('data', { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(buttonData, null, 2));
        console.log(`\n💾 Full data saved to: ${outputPath}`);

        console.log('\n✅ Scrape complete!');
        console.log('\n💡 Next: Look at the "story-related list items" above');
        console.log('   Those are the elements we need to click to select My Story or Spotlight!');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

scrapeAfterCapture();
