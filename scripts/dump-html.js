import { createConnectedSnapBot } from '../utils/connectToSession.js';
import { dismissPopups, ensureCameraPage, delay } from '../utils/stateManager.js';
import fs from 'fs';

async function dumpHtml() {
    console.log('📄 Dumping Page HTML\n');

    try {
        const bot = await createConnectedSnapBot();
        console.log('✅ Connected!\n');

        await dismissPopups(bot.page);
        // await ensureCameraPage(bot.page); // Skip this if it's causing issues, just dump whatever page we are on

        const html = await bot.page.content();
        fs.writeFileSync('data/page_dump.html', html);
        console.log('✅ Saved HTML to data/page_dump.html');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

dumpHtml();
