import puppeteer from 'puppeteer-extra';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const SESSION_ENDPOINT_FILE = process.env.SESSION_ENDPOINT_FILE || '.session-endpoint';

/**
 * Connect to an existing browser session managed by SessionManager
 * @returns {Promise<{browser: Browser, page: Page}>}
 */
export async function connectToSession() {
    try {
        // Read endpoint from file
        if (!fs.existsSync(SESSION_ENDPOINT_FILE)) {
            throw new Error(
                `Session endpoint file not found: ${SESSION_ENDPOINT_FILE}\n` +
                'Please start the session manager first: node scripts/start-session.js'
            );
        }

        const wsEndpoint = fs.readFileSync(SESSION_ENDPOINT_FILE, 'utf-8').trim();
        console.log('📡 Connecting to session:', wsEndpoint);

        // Connect to existing browser
        const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
        console.log('✅ Connected to browser session');

        // Get the existing page (assume first page is the Snapchat page)
        const pages = await browser.pages();
        const page = pages.find(p => p.url().includes('snapchat.com')) || pages[0];

        if (!page) {
            throw new Error('No Snapchat page found in session');
        }

        console.log('📄 Using page:', page.url());

        return { browser, page };
    } catch (error) {
        console.error('❌ Error connecting to session:', error.message);
        throw error;
    }
}

/**
 * Create a SnapBot instance connected to the managed session
 * Note: This doesn't launch a new browser, it uses the existing one
 */
export async function createConnectedSnapBot() {
    const SnapBot = (await import('../snapbot.js')).default;
    const { browser, page } = await connectToSession();

    const bot = new SnapBot();
    bot.browser = browser;
    bot.page = page;

    return bot;
}

export default connectToSession;
