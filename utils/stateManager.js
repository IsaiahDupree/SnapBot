/**
 * State management utilities for SnapBot
 * Handles popups, modals, and ensures correct UI state
 */

export async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Dismiss common popups and modals
 */
export async function dismissPopups(page) {
    try {
        // Find and click "Got it!" button
        const buttons = await page.$$('button');
        for (const button of buttons) {
            const text = await button.evaluate(el => el.textContent?.trim());
            if (text === 'Got it!' || text === 'Allow') {
                console.log(`   ✓ Dismissing "${text}" popup...`);
                await button.click();
                await delay(500);
                return true;
            }
        }

        // Check for any modal close buttons
        const closeButtons = await page.$$('button[aria-label="Close"], button.close-button, [data-dismiss="modal"]');
        if (closeButtons.length > 0) {
            console.log('   ✓ Closing modal...');
            await closeButtons[0].click();
            await delay(500);
            return true;
        }

        return false;
    } catch (error) {
        // Popup handling is non-critical, continue
        return false;
    }
}

/**
 * Ensure we're on the main Snapchat camera page
 */
export async function ensureCameraPage(page) {
    console.log('   Checking camera page state...');

    // Dismiss any popups first
    await dismissPopups(page);

    // Check if we're already on the camera page
    const cameraButton = await page.$('button.qJKfS');
    const captureButton = await page.$('button.FBYjn.gK0xL');

    if (cameraButton || captureButton) {
        console.log('   ✓ Already on camera page');
        return true;
    }

    // Try to navigate to camera if we're not there
    console.log('   Navigating to camera page...');
    const snapchatLogo = await page.$('a[href="/"], button[aria-label="Snapchat"]');
    if (snapchatLogo) {
        await snapchatLogo.click();
        await delay(1000);
        await dismissPopups(page);
        return true;
    }

    return false;
}

/**
 * Open the camera view if not already open
 */
export async function openCameraView(page) {
    console.log('   Opening camera view...');

    await dismissPopups(page);

    // Click the camera/new snap button
    const cameraBtn = await page.$('button.qJKfS');
    if (cameraBtn) {
        const isVisible = await cameraBtn.evaluate(el => el.offsetWidth > 0 && el.offsetHeight > 0);
        if (isVisible) {
            await cameraBtn.click();
            await delay(1500);
            await dismissPopups(page);
            console.log('   ✓ Camera view opened');
            return true;
        }
    }

    return false;
}

/**
 * Capture a snap with state management
 */
export async function captureSnapRobust(page, options = {}) {
    console.log('   Capturing snap...');

    // Ensure we're on camera page
    await ensureCameraPage(page);
    await dismissPopups(page);

    // Open camera if needed
    let captureBtn = await page.$('button.FBYjn.gK0xL.A7Cr_.m3ODJ');
    if (!captureBtn) {
        await openCameraView(page);
        await delay(1000);
        captureBtn = await page.$('button.FBYjn.gK0xL.A7Cr_.m3ODJ');
    }

    // Dismiss any popups that appeared
    await dismissPopups(page);

    // Click capture
    if (captureBtn) {
        await captureBtn.click();
        console.log('   ✓ Snap captured');
        await delay(2000);

        // Handle caption if provided
        if (options.caption) {
            const captionBtn = await page.$('button.eUb32[title="Add a caption"]');
            if (captionBtn) {
                await captionBtn.click();
                await delay(500);
                const textareaSelector = 'textarea.B9QiX[aria-label="Caption Input"]';
                const textarea = await page.$(textareaSelector);
                if (textarea) {
                    await page.type(textareaSelector, options.caption, { delay: 50 });
                    console.log('   ✓ Caption added');
                }
            }
        }

        return true;
    }

    throw new Error('Could not capture snap - capture button not found');
}

/**
 * Open the send/recipient selector
 */
export async function openRecipientSelector(page) {
    console.log('   Opening recipient selector...');

    await dismissPopups(page);

    // Try primary send button
    const sendBtn = await page.$('button.YatIx.fGS78.eKaL7.Bnaur');
    if (sendBtn) {
        await sendBtn.click();
        await delay(2000);
        await dismissPopups(page);
        console.log('   ✓ Recipient selector opened');
        return true;
    }

    // Try submit button as fallback
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
        await submitBtn.click();
        await delay(2000);
        await dismissPopups(page);
        console.log('   ✓ Recipient selector opened (via submit)');
        return true;
    }

    throw new Error('Could not open recipient selector - send button not found');
}

/**
 * Find and click a story option by text
 */
export async function selectStoryOption(page, searchText) {
    console.log(`   Looking for "${searchText}"...`);

    await dismissPopups(page);

    // Wait for list to load
    await delay(1000);

    // Try multiple selector patterns
    const selectors = [
        'ul.UxcmY li',
        'div[role="listitem"]',
        'li',
        'div.recipient-item'
    ];

    for (const selector of selectors) {
        const items = await page.$$(selector);

        for (const item of items) {
            const isVisible = await item.evaluate(el => el.offsetWidth > 0 && el.offsetHeight > 0);
            if (!isVisible) continue;

            const text = await item.evaluate(el => el.textContent?.toLowerCase() || '');

            if (text.includes(searchText.toLowerCase())) {
                console.log(`   ✓ Found "${searchText}" option`);
                await item.click();
                await delay(500);
                return true;
            }
        }
    }

    // Fallback: if searching for "my story", click first option
    if (searchText.toLowerCase().includes('story')) {
        console.log('   Using fallback: clicking first story option...');
        const firstItem = await page.$('ul.UxcmY li:first-child');
        if (firstItem) {
            await firstItem.click();
            await delay(500);
            return true;
        }
    }

    return false;
}

/**
 * Complete the send action
 */
export async function clickSendButton(page) {
    console.log('   Clicking final send button...');

    await dismissPopups(page);

    const sendBtn = await page.$('button[type="submit"]');
    if (sendBtn) {
        await sendBtn.click();
        await delay(2000);
        console.log('   ✓ Sent!');
        return true;
    }

    throw new Error('Send button not found');
}
