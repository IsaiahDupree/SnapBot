import puppeteer from 'puppeteer-extra';
import Stealth from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

puppeteer.use(Stealth());
dotenv.config();

const SESSION_ENDPOINT_FILE = process.env.SESSION_ENDPOINT_FILE || '.session-endpoint';
const COOKIES_DIR = process.env.COOKIES_DIR || path.resolve(process.cwd(), 'data', 'cookies');
const USER_NAME = process.env.USER_NAME;

export class SessionManager {
    constructor() {
        this.browser = null;
        this.page = null;
        this.wsEndpoint = null;
    }

    async start({ headless = false, cookieFile = null } = {}) {
        try {
            console.log('🚀 Starting session manager...');

            // Launch browser with debugging port
            this.browser = await puppeteer.launch({
                headless,
                args: ['--remote-debugging-port=9222'],
            });

            this.wsEndpoint = this.browser.wsEndpoint();
            console.log('✅ Browser launched');
            console.log('📡 WebSocket endpoint:', this.wsEndpoint);

            // Save endpoint to file
            fs.writeFileSync(SESSION_ENDPOINT_FILE, this.wsEndpoint);
            console.log(`💾 Endpoint saved to ${SESSION_ENDPOINT_FILE}`);

            // Setup browser context and page
            const context = this.browser.defaultBrowserContext();
            await context.overridePermissions('https://web.snapchat.com', ['camera', 'microphone']);

            this.page = await context.newPage();
            await this.page.setViewport({
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1,
            });
            await this.page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            );

            // Load cookies if available
            const cookiesPath = cookieFile
                ? (cookieFile.includes('/') || cookieFile.includes('\\')
                    ? cookieFile
                    : path.join(COOKIES_DIR, `${cookieFile}-cookies.json`))
                : path.join(COOKIES_DIR, `${USER_NAME}-cookies.json`);

            if (fs.existsSync(cookiesPath)) {
                try {
                    const cookiesString = fs.readFileSync(cookiesPath, 'utf-8');
                    const cookies = JSON.parse(cookiesString);
                    const normalized = cookies.map((c) => (c.url || c.domain ? c : { ...c, url: 'https://web.snapchat.com' }));
                    await this.page.setCookie(...normalized);
                    console.log('🍪 Cookies loaded from:', cookiesPath);
                } catch (error) {
                    console.error('⚠️ Error loading cookies:', error.message);
                }
            }

            // Navigate to Snapchat
            await this.page.goto('https://web.snapchat.com/');
            console.log('🌐 Navigated to Snapchat Web');

            // Check if already logged in
            const isLogged = await this.checkLoginStatus();
            if (isLogged) {
                console.log('✅ Already logged in (using cookies)');
            } else {
                console.log('⚠️ Not logged in. Please authenticate manually in the browser.');
                console.log('   After logging in, cookies will be saved automatically.');
            }

            return this.wsEndpoint;
        } catch (error) {
            console.error('❌ Error starting session:', error);
            throw error;
        }
    }

    async checkLoginStatus(timeout = 10000) {
        const appSelector = '#downshift-1-toggle-button, div.ReactVirtualized__Grid__innerScrollContainer, button[title="View friend requests"]';
        const loginSelector = 'input[name="accountIdentifier"], #ai_input, #password';

        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                const appEl = await this.page.$(appSelector);
                if (appEl) return true;

                const loginEl = await this.page.$(loginSelector);
                if (loginEl) return false;
            } catch (e) {
                // ignore
            }
            await new Promise(r => setTimeout(r, 500));
        }
        return false;
    }

    async saveCookies(username = USER_NAME) {
        try {
            const dir = COOKIES_DIR;
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const cookies = await this.page.cookies('https://web.snapchat.com');
            const filePath = path.join(dir, `${username}-cookies.json`);
            fs.writeFileSync(filePath, JSON.stringify(cookies, null, 2));
            console.log('🍪 Cookies saved to:', filePath);
        } catch (error) {
            console.error('⚠️ Error saving cookies:', error);
        }
    }

    async monitorSession(checkIntervalMs = 60000, autoSaveCookies = true) {
        console.log('👀 Monitoring session...');

        const check = async () => {
            try {
                const isLogged = await this.checkLoginStatus(5000);
                if (!isLogged) {
                    console.log('⚠️ Session expired. Please re-authenticate manually.');
                } else {
                    if (autoSaveCookies) {
                        await this.saveCookies();
                    }
                }
            } catch (error) {
                console.error('⚠️ Session check error:', error.message);
            }
        };

        // Initial check
        await check();

        // Periodic checks
        setInterval(check, checkIntervalMs);
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('🔒 Browser closed');
        }

        // Clean up endpoint file
        if (fs.existsSync(SESSION_ENDPOINT_FILE)) {
            fs.unlinkSync(SESSION_ENDPOINT_FILE);
            console.log('🗑️ Endpoint file removed');
        }
    }
}

export default SessionManager;
