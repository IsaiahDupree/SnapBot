import path from 'path';
import fs from 'fs';

/**
 * UI Observer - Captures state after interactions
 */
export class UIObserver {
    constructor(bot, outputDir = 'data/observations') {
        this.bot = bot;
        this.outputDir = path.resolve(outputDir);
        this.stepCount = 0;

        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Capture the current state of the UI
     * @param {string} actionName - Name of the action just performed
     */
    async observe(actionName) {
        this.stepCount++;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const prefix = `${this.stepCount.toString().padStart(3, '0')}-${actionName.replace(/\s+/g, '_')}`;

        console.log(`\n👁️  Observing state after: "${actionName}"...`);

        try {
            // 1. Take Screenshot
            const screenshotPath = path.join(this.outputDir, `${prefix}.png`);
            await this.bot.page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`   📸 Screenshot saved: ${path.basename(screenshotPath)}`);

            // 2. Dump visible buttons
            const buttons = await this.bot.page.evaluate(() => {
                return Array.from(document.querySelectorAll('button')).map(b => ({
                    text: b.textContent?.trim().substring(0, 50),
                    title: b.title,
                    ariaLabel: b.getAttribute('aria-label'),
                    className: b.className,
                    visible: b.offsetWidth > 0 && b.offsetHeight > 0,
                    x: b.getBoundingClientRect().x,
                    y: b.getBoundingClientRect().y
                })).filter(b => b.visible);
            });

            // 3. Dump inputs
            const inputs = await this.bot.page.evaluate(() => {
                return Array.from(document.querySelectorAll('input')).map(i => ({
                    type: i.type,
                    accept: i.accept,
                    id: i.id,
                    visible: i.offsetWidth > 0 && i.offsetHeight > 0
                }));
            });

            // Save data
            const dataPath = path.join(this.outputDir, `${prefix}.json`);
            fs.writeFileSync(dataPath, JSON.stringify({
                timestamp,
                action: actionName,
                url: this.bot.page.url(),
                buttons,
                inputs
            }, null, 2));
            console.log(`   💾 Data saved: ${path.basename(dataPath)}`);

        } catch (error) {
            console.error(`   ❌ Observation failed: ${error.message}`);
        }
    }
}
