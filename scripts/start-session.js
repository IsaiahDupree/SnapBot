import SessionManager from '../utils/sessionManager.js';
import SnapBot from '../snapbot.js';
import dotenv from 'dotenv';

dotenv.config();

const manager = new SessionManager();
const { USER_NAME, USER_PASSWORD } = process.env;

async function startSession() {
    console.log('==================================================');
    console.log('🔐 Snapchat Session Manager');
    console.log('==================================================\n');

    try {
        // Start the session
        await manager.start({
            headless: false,
            cookieFile: USER_NAME
        });

        console.log('\n==================================================');
        console.log('✅ Session started successfully!');
        console.log('==================================================\n');

        // Check if already logged in
        const isLogged = await manager.checkLoginStatus(10000);

        if (!isLogged) {
            console.log('⚠️  Not logged in. Attempting automatic login...');

            // Create a temporary SnapBot instance to perform login
            const bot = new SnapBot();
            bot.browser = manager.browser;
            bot.page = manager.page;

            try {
                console.log('🔑 Logging in with credentials from .env...');
                await bot.login({ username: USER_NAME, password: USER_PASSWORD });

                // Check for login success
                const nowLogged = await manager.checkLoginStatus(10000);
                if (nowLogged) {
                    console.log('✅ Login successful! Saving cookies...');
                    await manager.saveCookies();
                } else {
                    console.error('❌ Login failed - authentication not confirmed');
                    console.error('Please check your credentials in .env file');
                    await manager.close();
                    process.exit(1);
                }
            } catch (error) {
                console.error('❌ Login error:', error.message);
                if (error.message.includes('Authentication failed') ||
                    error.message.includes('password')) {
                    console.error('⚠️  Wrong password detected. Please update .env file');
                }
                await manager.close();
                process.exit(1);
            }
        } else {
            console.log('✅ Already logged in using saved cookies!');
            await manager.saveCookies(); // Update cookies
        }

        console.log('\n📝 Session ready:');
        console.log('   - Browser is running and authenticated');
        console.log('   - Run your test scripts in another terminal');
        console.log('   - They will connect to this browser automatically');
        console.log('   - Press Ctrl+C to stop the session\n');

        // Monitor session
        await manager.monitorSession(
            60000, // Check every minute
            true   // Auto-save cookies
        );

        // Keep process alive
        await new Promise(() => { }); // Never resolves
    } catch (error) {
        console.error('❌ Failed to start session:', error.message);
        await manager.close();
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down session manager...');
    await manager.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n\n🛑 Shutting down session manager...');
    await manager.close();
    process.exit(0);
});

// Start the session
startSession();
