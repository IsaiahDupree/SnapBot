import SnapBot from '../snapbot.js';
import dotenv from 'dotenv';
dotenv.config();

const { USER_NAME, USER_PASSWORD } = process.env;

console.log(`Testing login for user: ${USER_NAME}`);

async function testLogin() {
    const bot = new SnapBot();
    try {
        await bot.launchSnapchat({ headless: false });
        console.log('Browser launched. Attempting login...');
        const logged = await bot.ensureLoggedIn({ username: USER_NAME, password: USER_PASSWORD }, { handlePopup: true, retry: 1 });
        console.log(`Login result: ${logged}`);
        if (logged) {
            console.log('SUCCESS: Logged in!');
        } else {
            console.error('FAILURE: Could not log in.');
        }
        // Keep open for a bit to see
        await new Promise(r => setTimeout(r, 10000));
        await bot.closeBrowser();
    } catch (e) {
        console.error('ERROR during login test:', e);
        try { await bot.closeBrowser(); } catch (_) { }
    }
}

testLogin();
