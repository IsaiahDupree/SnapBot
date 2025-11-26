import SessionManager from '../utils/sessionManager.js';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const manager = new SessionManager();

async function startSession() {
    console.log('==================================================');
    console.log('🔐 Snapchat Session Manager');
    console.log('==================================================\n');

    try {
        // Start the session
        const wsEndpoint = await manager.start({
            headless: false,
            cookieFile: process.env.USER_NAME
        });

        console.log('\n==================================================');
        console.log('✅ Session started successfully!');
        console.log('==================================================');
        console.log('\n📝 Instructions:');
        console.log('   1. If not logged in, authenticate in the browser window');
        console.log('   2. Keep this script running');
        console.log('   3. Run your test scripts in another terminal');
        console.log('   4. Press Ctrl+C to stop the session\n');

        // Monitor session
        await manager.monitorSession(
            60000, // Check every minute
            true   // Auto-save cookies
        );

        // Keep process alive
        await new Promise(() => { }); // Never resolves
    } catch (error) {
        console.error('❌ Failed to start session:', error);
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
