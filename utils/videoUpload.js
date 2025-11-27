/**
 * Upload a video file from the computer
 * @param {Object} options - Upload options
 * @param {string} options.videoPath - Path to the video file
 * @param {string} options.caption - Optional caption
 */
async uploadVideo({ videoPath, caption }) {
    try {
        console.log('📹 Uploading video from file...');

        // Dismiss any popups
        await this.page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                if (btn.textContent?.trim() === 'Got it!') {
                    btn.click();
                    break;
                }
            }
        });
        await delay(500);

        // Look for the gallery/upload button (usually next to or near the camera button)
        // Based on the screenshot, it appears to be one of the small circular buttons
        const uploadSelectors = [
            'button[title*="gallery"]',
            'button[title*="Gallery"]',
            'button[aria-label*="gallery"]',
            'button[aria-label*="Gallery"]',
            'input[type="file"]',
            'button.gallery-button',
            // The button shown in the screenshot (might be one of these)
            'button[title="Upload from device"]',
            'button[title="Memories"]'
        ];

        let uploadButton = null;
        for (const selector of uploadSelectors) {
            uploadButton = await this.page.$(selector);
            if (uploadButton) {
                console.log(`   Found upload button: ${selector}`);
                break;
            }
        }

        // Alternative: Look for file input and trigger it directly
        let fileInput = await this.page.$('input[type="file"][accept*="video"]');
        if (!fileInput) {
            fileInput = await this.page.$('input[type="file"]');
        }

        if (uploadButton) {
            // Click the button to open file picker
            await uploadButton.click();
            await delay(1000);
        }

        // Upload the file
        if (fileInput) {
            await fileInput.uploadFile(videoPath);
            console.log('   ✅ Video file uploaded');
            await delay(3000); // Wait for video to process
        } else {
            throw new Error('Could not find file input element');
        }

        // Add caption if provided
        if (caption) {
            const captionBtn = await this.page.$('button.eUb32[title="Add a caption"]');
            if (captionBtn) {
                await captionBtn.click();
                await delay(500);
                await this.page.type('textarea.B9QiX[aria-label="Caption Input"]', caption, { delay: 50 });
                console.log('   ✅ Caption added');
            }
        }

        console.log('✅ Video ready to send!');
        return true;

    } catch (error) {
        console.error('❌ Error uploading video:', error);
        throw error;
    }
}
