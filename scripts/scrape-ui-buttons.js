import { createConnectedSnapBot } from '../utils/connectToSession.js';
import fs from 'fs';

async function scrapeUIButtons() {
    console.log('🔍 Scraping Snapchat UI for buttons and interactive elements...\n');

    try {
        const bot = await createConnectedSnapBot();
        console.log('✅ Connected to session!\n');

        // Extract all buttons and their attributes
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
                    textContent: btn.textContent?.trim() || null,
                    visible: btn.offsetWidth > 0 && btn.offsetHeight > 0,
                    disabled: btn.disabled,
                    // Get parent element info for context
                    parentClass: btn.parentElement?.className || null,
                    // Get any SVG content (often used for icons)
                    hasSVG: btn.querySelector('svg') !== null,
                    svgTitle: btn.querySelector('svg title')?.textContent || null
                };
                buttons.push(info);
            });

            // Also get divs with role="button" (common pattern)
            const divButtons = document.querySelectorAll('div[role="button"]');
            divButtons.forEach((btn, index) => {
                const info = {
                    index: `div-${index}`,
                    tagName: 'DIV[role="button"]',
                    id: btn.id || null,
                    className: btn.className || null,
                    title: btn.title || null,
                    ariaLabel: btn.getAttribute('aria-label') || null,
                    textContent: btn.textContent?.trim() || null,
                    visible: btn.offsetWidth > 0 && btn.offsetHeight > 0,
                    parentClass: btn.parentElement?.className || null,
                    hasSVG: btn.querySelector('svg') !== null,
                    svgTitle: btn.querySelector('svg title')?.textContent || null
                };
                buttons.push(info);
            });

            return buttons;
        });

        // Filter to show only visible buttons
        const visibleButtons = buttonData.filter(b => b.visible);

        console.log(`📊 Found ${buttonData.length} total buttons (${visibleButtons.length} visible)\n`);
        console.log('='.repeat(80));

        // Display visible buttons with key information
        visibleButtons.forEach(btn => {
            console.log(`\n🔘 Button #${btn.index}`);
            if (btn.ariaLabel) console.log(`   aria-label: "${btn.ariaLabel}"`);
            if (btn.title) console.log(`   title: "${btn.title}"`);
            if (btn.textContent && btn.textContent.length < 100) console.log(`   text: "${btn.textContent}"`);
            if (btn.className) console.log(`   class: "${btn.className}"`);
            if (btn.id) console.log(`   id: "${btn.id}"`);
            if (btn.type) console.log(`   type: "${btn.type}"`);
            if (btn.svgTitle) console.log(`   svg-title: "${btn.svgTitle}"`);
        });

        console.log('\n' + '='.repeat(80));

        // Save detailed data to JSON file
        const outputPath = 'data/ui-buttons-scrape.json';
        fs.mkdirSync('data', { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(buttonData, null, 2));
        console.log(`\n💾 Full button data saved to: ${outputPath}`);

        // Look for story-related buttons specifically
        console.log('\n🎯 Story-related buttons:');
        const storyButtons = visibleButtons.filter(b =>
            (b.ariaLabel && (b.ariaLabel.toLowerCase().includes('story') || b.ariaLabel.toLowerCase().includes('spotlight'))) ||
            (b.title && (b.title.toLowerCase().includes('story') || b.title.toLowerCase().includes('spotlight'))) ||
            (b.textContent && (b.textContent.toLowerCase().includes('story') || b.textContent.toLowerCase().includes('spotlight')))
        );

        if (storyButtons.length > 0) {
            storyButtons.forEach(btn => {
                console.log(`\n   🎬 Button #${btn.index}`);
                console.log(`      Label: ${btn.ariaLabel || btn.title || btn.textContent}`);
                console.log(`      Class: ${btn.className}`);
            });
        } else {
            console.log('   ⚠️  No obvious story-related buttons found');
            console.log('   💡 Try capturing a snap first, then run this script again');
        }

        console.log('\n✅ Scrape complete!');

    } catch (error) {
        console.error('❌ Error scraping UI:', error);
    }
}

scrapeUIButtons();
