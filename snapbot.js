import puppeteer from "puppeteer-extra";
import Stealth from "puppeteer-extra-plugin-stealth";

puppeteer.use(Stealth());

import fs from "fs";
import fsPromise from "fs/promises";
import path from "path";

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

const lastTestedVersion = "v13.38.0";

export default class SnapBot {
  constructor() {
    this.page = null;
    this.browser = null;
  }
  async launchSnapchat(obj, cookiefile) {
    try {
      const options = {
        ...obj,
        // executablePath: "/usr/bin/google-chrome",  // for docker
      };
      this.browser = await puppeteer.launch(options);
      const cookiesPath = cookiefile
        ? (cookiefile.includes("/") || cookiefile.includes("\\")
          ? cookiefile
          : path.join(process.env.COOKIES_DIR || path.resolve(process.cwd(), "data", "cookies"), `${cookiefile}-cookies.json`))
        : null;

      const context = this.browser.defaultBrowserContext();

      await context.overridePermissions("https://web.snapchat.com", [
        "camera",
        "microphone",
      ]);

      this.page = await context.newPage();

      await this.page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      });
      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
      );

      // Load cookies if available (before navigation)
      if (cookiesPath && fs.existsSync(cookiesPath)) {
        try {
          const cookiesString = fs.readFileSync(cookiesPath, "utf-8");
          const cookies = JSON.parse(cookiesString);
          const normalized = cookies.map((c) => (c.url || c.domain ? c : { ...c, url: "https://web.snapchat.com" }));
          await this.page.setCookie(...normalized);
          console.log("Cookies set from:", cookiesPath);
        } catch (error) {
          console.error("Error applying cookies from file", cookiesPath, error);
        }
      }

      //gets the version
      this.page.on("console", (msg) => {
        if (msg.type() === "log") {
          const text = msg.text();
          if (text.includes("Snapchat")) {
            console.log("Snapchat for Web Build info:", text);
            const version = text.match(/v\d+\.\d+\.\d+/);
            const currentVersion = version[0];
            console.log("Version", currentVersion);
            //check version
            if (currentVersion != lastTestedVersion) {
              console.warn(
                `⚠️  Warning: Some methods were last tested on version ${lastTestedVersion} \n\n` +
                `Detected current version is ${currentVersion}\n\n` +
                `Some features might not work properly.\n` +
                `If you encounter issues, please try updating the project using 'git pull'.\n` +
                `If the problem persists, consider raising an issue or contacting the developer.`
              );
            }
          }
        }
      });

      // Go directly to Snapchat Web app
      await this.page.goto("https://web.snapchat.com/");
    } catch (error) {
      console.error(`Error while Starting Snapchat : ${error}`);
    }
  }

  async login(credentials) {
    const { username, password } = credentials;
    if (username == "" || password == "") {
      throw new Error("Credentials cannot be empty");
    }
    try {
      // Ensure we're on the login screen
      const loginFieldSelector = 'input[name="accountIdentifier"], #ai_input';

      // short wait for network to settle
      try {
        await this.page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 });
      } catch (_) { }

      let loginField = await this.page.$(loginFieldSelector);

      if (!loginField) {
        // Try clicking a visible "Log in" button/link if present
        const loginCandidates = await this.page.$x(
          "//a[normalize-space()='Log in' or normalize-space()='Log In'] | //button[normalize-space()='Log in' or normalize-space()='Log In']"
        );
        if (loginCandidates && loginCandidates.length > 0) {
          console.log("Found 'Log in' button/link. Clicking...");
          await loginCandidates[0].click();
          try {
            await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
          } catch (_) { }
        } else {
          // Fallback: go straight to accounts login
          console.log("Directing to accounts login page...");
          await this.page.goto("https://accounts.snapchat.com/accounts/v2/login", { waitUntil: 'domcontentloaded' });
        }

        await this.page.waitForSelector(loginFieldSelector, { visible: true, timeout: 30000 });
        loginField = await this.page.$(loginFieldSelector);
      }

      // Enter username into the appropriate field
      const loginBtn = await this.page.$('input[name="accountIdentifier"]');
      const defaultLoginBtn = await this.page.$("#ai_input");
      console.log("Entering username...");
      if (loginBtn) {
        await this.page.type('input[name="accountIdentifier"]', username, { delay: 100 });
      } else if (defaultLoginBtn) {
        await this.page.type('#ai_input', username, { delay: 100 });
      }

      // Submit username (some flows have a single submit button)
      const submitBtn = await this.page.$("button[type='submit']");
      if (submitBtn) await submitBtn.click();
    } catch (e) {
      console.log("Username field error:", e);
    }
    try {
      //Enter Password
      console.log("Waiting for password field...");
      await this.page.waitForSelector("#password", {
        visible: true,
        timeout: 60000,
      });
      await this.page.type("#password", password, { delay: 100 });
      console.log("Password field filled.");
    } catch (e) {
      console.log("Password field loading error:", e);
    }

    await this.page.click("button[type='submit']");
    await delay(10000);
    //click not now
    try {
      const notNowBtn = "button.NRgbw.eKaL7.Bnaur"; //NRgbw eKaL7 Bnaur
      console.log("Checking for 'Not now' button...");
      await this.page.waitForSelector(notNowBtn, {
        visible: true,
        timeout: 5000,
      });
      await this.page.click(notNowBtn);
      console.log("Clicked 'Not now' button.");
    } catch (e) {
      console.log("Popup handling error or popup not found:", e);
    }
    await delay(1000);
  }

  async isLogged(timeout = 20000) {
    // Robust detection: wait for either login form or app UI elements
    const appSelector =
      "#downshift-1-toggle-button, div.ReactVirtualized__Grid__innerScrollContainer, button[title=\"View friend requests\"]";
    const loginSelector =
      'input[name="accountIdentifier"], #ai_input, #password';

    const start = Date.now();
    console.log("Detecting authentication state...");
    while (Date.now() - start < timeout) {
      try {
        const appEl = await this.page.$(appSelector);
        if (appEl) {
          console.log("Detected Snapchat Web UI – logged in");
          return true;
        }
        const loginEl = await this.page.$(loginSelector);
        if (loginEl) {
          console.log("Detected login form – login required");
          return false;
        }
      } catch (e) {
        // ignore transient errors while DOM updates
      }
      await delay(500);
    }

    // Fallback: infer from URL if selectors did not appear in time
    const url = this.page.url();
    console.warn(
      `Auth state uncertain after timeout. Current URL: ${url}. Assuming not logged in if login selectors appear later.`
    );
    const appElFinal = await this.page.$(appSelector);
    return Boolean(appElFinal);
  }

  async ensureLoggedIn(credentials, options = { handlePopup: true, retry: 0 }) {
    const { retry = 0, handlePopup = true } = options || {};
    let logged = await this.isLogged();
    if (!logged) {
      await this.login(credentials);
      await delay(1000);
      if (handlePopup) {
        try {
          await this.handlePopup();
        } catch (_) { }
      }
      logged = await this.isLogged();
      if (!logged && retry > 0) {
        console.log("Auth still not confirmed, retrying login...");
        return this.ensureLoggedIn(credentials, { handlePopup, retry: retry - 1 });
      }
    } else {
      console.log("Bot is already Logged in");
      if (handlePopup) {
        try {
          await this.handlePopup();
        } catch (_) { }
      }
    }
    return logged;
  }

  async handlePopup() {
    try {
      const notNowBtn = "button.NRgbw.eKaL7.Bnaur"; //NRgbw eKaL7 Bnaur
      const notNowBtnHandle = await this.page.waitForSelector(notNowBtn, {
        visible: true,
        timeout: 5000,
      });
      console.log("Checking for 'Not now' button...");
      if (notNowBtnHandle) {
        await this.page.waitForSelector(notNowBtn, {
          visible: true,
          timeout: 5000,
        });
        await this.page.click(notNowBtn);
        console.log("Clicked 'Not now' button.");
      } else {
        console.log("not found");
      }
    } catch (error) {
      console.log(`could not find Popup`);
    }
  }

  async captureSnap(obj) {
    try {
      //updated version here v2.0
      let captureBtnFound = false;
      const captureButtonSelector = "button.FBYjn.gK0xL.A7Cr_.m3ODJ";

      const captureButton = await this.page.$(captureButtonSelector);
      if (captureButton) {
        const isVisible = (await captureButton.boundingBox()) !== null;
        if (isVisible) {
          await captureButton.click();
          captureBtnFound = true;
        }
      }
      if (!captureBtnFound) {
        const svgButtonSelector = "button.qJKfS";
        await delay(1000);

        let isSVGbuttonFound = null;
        let retries = 0;
        const maxRetries = 3;

        while (!isSVGbuttonFound && retries < maxRetries) {
          try {
            isSVGbuttonFound = await this.page.waitForSelector(
              svgButtonSelector,
              {
                visible: true,
                timeout: 15000,
              }
            );
          } catch (error) {
            console.log("Couldn't find the SVG selector, retrying...");
          }

          if (!isSVGbuttonFound) {
            retries++;
            console.log(`Retries left: ${maxRetries - retries}`);
            await delay(1000);
          }
        }

        if (isSVGbuttonFound) {
          await this.page.click(svgButtonSelector);
          console.log("clicked svg button");
        } else {
          console.log("SVG button not found after maximum retries.");
        }
        // Capture button
        if (isSVGbuttonFound) {
          await delay(1000);
          const captureButtonSelector = "button.FBYjn.gK0xL.A7Cr_.m3ODJ"; //FBYjn gK0xL A7Cr_ m3ODJ
          const captureButton = await this.page.waitForSelector(
            captureButtonSelector,
            { visible: true }
          );
          await captureButton.click();
          console.log("✅ Clicked the capture button");
        }
      }

      await delay(3000);

      // 📸 Add custom image if `obj.path` exists
      if (obj.path) {
        try {
          const imageToBase64 = await fsPromise.readFile(obj.path, "base64");
          const imageData = `data:image/png;base64,${imageToBase64}`;

          // Wait for container
          const containerSelector = "#snap-preview-container";
          await this.page.waitForSelector(containerSelector, { visible: true });

          await this.page.evaluate(
            (containerSelector, imageData) => {
              const container = document.querySelector(containerSelector);
              if (container) {
                const img = container.querySelector("img");
                if (img) img.src = imageData;
              }
            },
            containerSelector,
            imageData
          );
          // await this.page.evaluate((imageData) => {
          //   const img = document.querySelector("#snap-preview-container img");
          //   if (img) img.src = imageData; // if imageData is already available in the page
          // }, imageData);

          console.log("✅ Image added successfully");
        } catch (error) {
          console.warn("⚠️ Error adding image:", error);
        }
      }

      await delay(1000);

      // 📝 Add caption if provided
      if (obj.caption) {
        await delay(2000);
        const captionButtonSelector = 'button.eUb32[title="Add a caption"]';
        await this.page.waitForSelector(captionButtonSelector, {
          visible: true,
        });
        await this.page.click(captionButtonSelector);

        await delay(1000);
        const textareaSelector = 'textarea.B9QiX[aria-label="Caption Input"]';
        await this.page.waitForSelector(textareaSelector, { visible: true });
        await this.page.type(textareaSelector, obj.caption, { delay: 100 });

        console.log("✅ Caption added successfully");

        await delay(1000);

        //caption pos
        if (obj.position) {
          const elementHandle = await this.page.$(textareaSelector);
          if (elementHandle) {
            const box = await elementHandle.boundingBox();
            if (box) {
              const startX = box.x + box.width / 2;
              const startY = box.y + box.height / 2;
              const endY = startY + obj.position;

              await this.page.mouse.move(startX, startY); // Move to starting position
              await this.page.mouse.down(); // Click and hold (start drag)
              await this.page.mouse.move(startX, endY, { steps: 10 }); // Drag smoothly
              await this.page.mouse.up(); // Release (drop)
            }
          }
        }
      }
    } catch (error) {
      console.error("❌ Error in capturing the snap:", error);
    }
  }

  async recordVideo({ caption, durationMs = 5000 } = {}) {
    try {
      // Ensure capture UI is visible
      const captureButtonSelector = "button.FBYjn.gK0xL.A7Cr_.m3ODJ";
      let captureButton = await this.page.$(captureButtonSelector);

      if (!captureButton) {
        const svgButtonSelector = "button.qJKfS";
        await delay(1000);
        try {
          const isSVGbuttonFound = await this.page.waitForSelector(svgButtonSelector, {
            visible: true,
            timeout: 15000,
          });
          if (isSVGbuttonFound) {
            await this.page.click(svgButtonSelector);
            await delay(1000);
          }
        } catch (_) { }

        captureButton = await this.page.waitForSelector(captureButtonSelector, {
          visible: true,
          timeout: 15000,
        });
      }

      // Hold mouse on capture button to record
      const box = await captureButton.boundingBox();
      if (!box) throw new Error("Capture button not visible for recording");
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;

      await this.page.mouse.move(x, y);
      await this.page.mouse.down();
      await delay(durationMs);
      await this.page.mouse.up();
      console.log(`🎥 Recorded video for ~${durationMs}ms`);

      await delay(1500);

      // Add caption if provided (same UI flow as captureSnap)
      if (caption) {
        const captionButtonSelector = 'button.eUb32[title="Add a caption"]';
        await this.page.waitForSelector(captionButtonSelector, { visible: true });
        await this.page.click(captionButtonSelector);
        await delay(500);
        const textareaSelector = 'textarea.B9QiX[aria-label="Caption Input"]';
        await this.page.waitForSelector(textareaSelector, { visible: true });
        await this.page.type(textareaSelector, caption, { delay: 100 });
        console.log("✅ Caption added to video");
      }
    } catch (error) {
      console.error("❌ Error in recording video:", error);
    }
  }

  async send(person) {
    try {
      const button = await this.page.$("button.YatIx.fGS78.eKaL7.Bnaur"); //updated this

      if (button) {
        console.log("Button found!");
        await button.click();
      } else {
        console.log("Button not found.");
      }
      await delay(1000);
      let selected = "";
      person = person.toLowerCase();
      if (person == "bestfriends") {
        selected = "ul.UxcmY li  div.Ewflr.cDeBk.A8BRr ";
      } else if (person == "groups") {
        selected = "li div.RbA83";
      } else if (person == "friends") {
        selected = "li div.Ewflr";
      } else if (person == "all") {
        console.log("not implemented yet");
      } else {
        throw new Error("Option not found");
      }
      const accounts = await this.page.$$(selected);
      for (const account of accounts) {
        const isFriendVisible = await account.evaluate(
          (el) => el.offsetWidth > 0 && el.offsetHeight > 0
        ); // Check if the div is visible
        if (isFriendVisible) {
          await account.click(); // Click on the div element
        } else {
          console.log("account not found.");
        }
      }
      const sendButton = await this.page.$("button[type='submit']"); //YatIx q5eEJ eKaL7 Bnaur
      await sendButton.click();
      delay(5000);
    } catch (error) {
      console.error("Error while sending snap", error);
    }
  }

  // Upload a video file from the computer
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

      // Find file input element
      let fileInput = await this.page.$('input[type="file"][accept*="video"]');
      if (!fileInput) {
        fileInput = await this.page.$('input[type="file"]');
      }

      if (!fileInput) {
        // Try clicking gallery/upload button first
        // Selectors based on common UI patterns, might need adjustment
        const uploadSelectors = [
          'button[title*="Upload"]',
          'button[aria-label*="Upload"]',
          'button[title*="Gallery"]',
          'button[aria-label*="Gallery"]',
          'button[title="Memories"]',
          'button.gallery-button'
        ];

        for (const selector of uploadSelectors) {
          const btn = await this.page.$(selector);
          if (btn) {
            await btn.click();
            await delay(1000);
            fileInput = await this.page.$('input[type="file"]');
            if (fileInput) break;
          }
        }
      }

      if (fileInput) {
        await fileInput.uploadFile(videoPath);
        console.log('   ✅ Video file uploaded');
        await delay(5000); // Wait for video to process
      } else {
        throw new Error('Could not find file input element');
      }

      // Add caption if provided
      if (caption) {
        const captionBtn = await this.page.$('button.eUb32[title="Add a caption"]');
        if (captionBtn) {
          await captionBtn.click();
          await delay(500);
          const textareaSelector = 'textarea.B9QiX[aria-label="Caption Input"]';
          await this.page.waitForSelector(textareaSelector, { visible: true });
          await this.page.type(textareaSelector, caption, { delay: 50 });
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

  // Post to My Story
  async postToMyStory() {
    try {
      console.log("Looking for story send button...");
      const button = await this.page.$("button.YatIx.fGS78.eKaL7.Bnaur");

      if (button) {
        await button.click();
        await delay(1000);

        // Look for "My Story" option
        const myStorySelector = "div[aria-label='My Story'], button[title='My Story'], div:has-text('My Story')";
        const myStoryButton = await this.page.$(myStorySelector);

        if (myStoryButton) {
          await myStoryButton.click();
          console.log("✅ Selected My Story");
        } else {
          // Fallback: click first story option (usually My Story)
          const storyOptions = await this.page.$$("ul.UxcmY li div");
          if (storyOptions && storyOptions.length > 0) {
            await storyOptions[0].click();
            console.log("✅ Selected first story option (likely My Story)");
          }
        }

        await delay(500);
        const sendButton = await this.page.$("button[type='submit']");
        if (sendButton) {
          await sendButton.click();
          console.log("✅ Posted to My Story!");
          await delay(2000);
        }
      } else {
        throw new Error("Send button not found");
      }
    } catch (error) {
      console.error("Error posting to My Story:", error);
      throw error;
    }
  }

  // Post to Spotlight
  async postToSpotlight() {
    try {
      console.log("Looking for story send button...");
      const button = await this.page.$("button.YatIx.fGS78.eKaL7.Bnaur");

      if (button) {
        await button.click();
        await delay(1000);

        // Look for "Spotlight" or "Public" option
        const spotlightSelectors = [
          "div[aria-label='Spotlight']",
          "button[title='Spotlight']",
          "div:has-text('Spotlight')",
          "div:has-text('Public Story')"
        ];

        let spotlightButton = null;
        for (const selector of spotlightSelectors) {
          spotlightButton = await this.page.$(selector);
          if (spotlightButton) break;
        }

        if (spotlightButton) {
          await spotlightButton.click();
          console.log("✅ Selected Spotlight");
        } else {
          // Fallback: look in list items
          const storyOptions = await this.page.$$("ul.UxcmY li div");
          // Spotlight is usually second or third option
          if (storyOptions && storyOptions.length > 1) {
            await storyOptions[1].click();
            console.log("✅ Selected secondary story option (possibly Spotlight)");
          }
        }

        await delay(500);
        const sendButton = await this.page.$("button[type='submit']");
        if (sendButton) {
          await sendButton.click();
          console.log("✅ Posted to Spotlight!");
          await delay(2000);
        }
      } else {
        throw new Error("Send button not found");
      }
    } catch (error) {
      console.error("Error posting to Spotlight:", error);
      throw error;
    }
  }

  // Select and send to specific recipients by display name
  async sendToRecipients(names = []) {
    if (!Array.isArray(names) || names.length === 0) {
      throw new Error("names array is required for sendToRecipients");
    }
    // Open the send overlay
    const button = await this.page.$("button.YatIx.fGS78.eKaL7.Bnaur");
    if (button) {
      await button.click();
    }
    await delay(1000);

    const lower = names.map((n) => String(n).trim().toLowerCase());
    // Wait for list of recipients and click matches
    await this.page.waitForSelector("div.ReactVirtualized__Grid__innerScrollContainer");
    const listItems = await this.page.$$("div[role='listitem']");

    for (const listItem of listItems) {
      const titleSpan = await listItem.$("span[id^='title-']");
      if (!titleSpan) continue;
      const name = await this.page.evaluate((el) => el.textContent.trim(), titleSpan);
      if (lower.includes(name.trim().toLowerCase())) {
        const isVisible = await listItem.evaluate((el) => el.offsetWidth > 0 && el.offsetHeight > 0);
        if (isVisible) await listItem.click();
      }
    }

    const sendButton = await this.page.$("button[type='submit']");
    if (!sendButton) throw new Error("Send button not found");
    await sendButton.click();
    await delay(3000);
  }

  // Send a text message (string or string[]) to specific recipients by display name
  async sendTextToRecipients(names = [], message = '') {
    if (!Array.isArray(names) || names.length === 0) {
      throw new Error('names array is required for sendTextToRecipients');
    }
    const msgs = Array.isArray(message) ? message : [String(message)];

    await this.page.waitForSelector("div.ReactVirtualized__Grid__innerScrollContainer");
    const lower = names.map((n) => String(n).trim().toLowerCase());
    const listItems = await this.page.$$("div[role='listitem']");

    for (const listItem of listItems) {
      const titleSpan = await listItem.$("span[id^='title-']");
      if (!titleSpan) continue;
      const displayName = await this.page.evaluate((el) => el.textContent.trim(), titleSpan);
      if (!lower.includes(displayName.toLowerCase())) continue;

      // Open chat
      await titleSpan.click();
      await delay(500);

      for (const msg of msgs) {
        await this.page.waitForSelector('div[role="textbox"].euyIb');
        await this.page.type('div[role="textbox"].euyIb', msg, { delay: 80 });
        await this.page.keyboard.press('Enter');
        await delay(200);
      }

      // Go back to the list (click title again)
      try { await titleSpan.click(); } catch (_) { }
      await delay(300);
    }
  }

  async closeBrowser() {
    await delay(5000);
    await this.browser.close();
    console.log("Snapchat closed");
  }

  async screenshot(obj) {
    await this.page.screenshot(obj);
  }

  async logout() {
    await this.page.waitForSelector("#downshift-1-toggle-button");
    await this.page.click("#downshift-1-toggle-button");
    await this.page.click("#downshift-1-item-9");
    console.log("Logged Out");
    await delay(12000);
  }

  async wait(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time);
    });
  }
  //beta
  async openFriendRequests() {
    await this.page.waitForSelector('button[title="View friend requests"]');
    const requests = await this.page.$('button[title="View friend requests"]');
    await requests.click();
  }

  async listRecipients(limit = undefined) {
    await this.page.waitForSelector("div.ReactVirtualized__Grid");
    await this.page.waitForSelector("div.ReactVirtualized__Grid__innerScrollContainer");
    const grid = await this.page.$("div.ReactVirtualized__Grid");

    const seen = new Set();
    const data = [];

    const scrapeVisible = async () => {
      const lists = await this.page.$$("div[role='listitem']");
      for (const listItem of lists) {
        const titleSpan = await listItem.$("span[id^='title-']");
        if (!titleSpan) continue;
        let id = await this.page.evaluate((el) => el.id, titleSpan);
        const name = await this.page.evaluate((el) => el.textContent.trim(), titleSpan);
        id = id.replace(/^title-/, "");
        if (!seen.has(id)) {
          seen.add(id);
          data.push({ id, name });
          if (limit && data.length >= limit) return true;
        }
      }
      return false;
    };

    let stable = 0;
    let lastCount = 0;
    let iterations = 0;
    // Initial scrape
    let done = await scrapeVisible();
    while (!done && iterations < 50 && stable < 3) {
      iterations += 1;
      await grid.evaluate((el) => { el.scrollBy(0, el.clientHeight); });
      await delay(500);
      done = await scrapeVisible();
      if (data.length === lastCount) stable += 1; else stable = 0;
      lastCount = data.length;
      if (limit && data.length >= limit) break;
    }

    return limit ? data.slice(0, limit) : data;
  }

  async sendMessage(obj) {
    await this.page.waitForSelector(
      "div.ReactVirtualized__Grid__innerScrollContainer"
    );
    const lists = await this.page.$$("div[role='listitem']");

    for (const listItem of lists) {
      const titleSpan = await listItem.$("span[id^='title-']");
      if (titleSpan) {
        const id = await this.page.evaluate((el) => el.id, titleSpan);
        let chatID = "title-" + obj.chat;
        if (id === chatID) {
          if (!obj.alreadyOpen) {
            await titleSpan.click();
          }

          if (obj.message === "") {
            // const cleanedID = obj.chat.replace(/^title-/, "");
            // return this.extractChatData(cleanedID);
          }

          // if its an array
          if (Array.isArray(obj.message)) {
            for (let msg of obj.message) {
              await this.page.waitForSelector('div[role="textbox"].euyIb');
              await this.page.type('div[role="textbox"].euyIb', `${msg}`);
              await this.page.keyboard.press("Enter");
            }
          }
          //if string
          if (typeof obj.message == "string") {
            await this.page.waitForSelector('div[role="textbox"].euyIb');
            await this.page.type('div[role="textbox"].euyIb', obj.message, {
              delay: 200,
            });
            await this.page.keyboard.press("Enter");
          }

          if (obj.exit) {
            // await delay(300);
            await titleSpan.click(); // go back
          }
        }
      }
    }
  }

  async saveCookies(username) {
    try {
      const dir = process.env.COOKIES_DIR || path.resolve(process.cwd(), "data", "cookies");
      try { fs.mkdirSync(dir, { recursive: true }); } catch (_) { }
      const cookies = await this.page.cookies("https://web.snapchat.com");
      const filePath = path.join(dir, `${username}-cookies.json`);
      fs.writeFileSync(filePath, JSON.stringify(cookies, null, 2));
      console.log("cookies saved to:", filePath);
    } catch (error) {
      console.error("Error in saving cookies", error);
    }
  }

  async useCookies(username) {
    try {
      const dir = process.env.COOKIES_DIR || path.resolve(process.cwd(), "data", "cookies");
      const filePath = path.join(dir, `${username}-cookies.json`);
      const cookiesString = fs.readFileSync(filePath, "utf-8");
      const cookies = JSON.parse(cookiesString);
      const normalized = cookies.map((c) => (c.url || c.domain ? c : { ...c, url: "https://web.snapchat.com" }));
      await this.page.setCookie(...normalized);
    } catch (error) {
      console.error("Error in using cookies", error);
    }
  }

  async extractChatData(userId) {
    return await this.page.evaluate((userId) => {
      const output = [];
      const $chatList = document.querySelector(`#cv-${userId}`);
      if (!$chatList) return [];

      const listItems = $chatList.querySelectorAll("li.T1yt2");

      let currentTime = null;
      let currentConvo = { time: "", conversation: [] };

      listItems.forEach((li) => {
        const timeElem = li.querySelector("time span");
        if (timeElem) {
          if (currentTime) output.push({ ...currentConvo });
          currentTime = timeElem.textContent.trim();
          currentConvo = { time: currentTime, conversation: [] };
          return;
        }

        const messageBlocks = li.querySelectorAll("li");

        if (messageBlocks.length > 0) {
          messageBlocks.forEach((block) => {
            let sender =
              block.querySelector("header .nonIntl")?.textContent.trim() || "";

            if (!sender) {
              const borderElem = block.querySelector(".KB4Aq");
              if (borderElem) {
                const color = getComputedStyle(borderElem).borderColor;
                if (color === "rgb(242, 60, 87)") sender = "Me";
                else if (color === "rgb(14, 173, 255)") sender = "Eren Yeager";
                else sender = "Unknown";
              }
            }

            const texts = Array.from(block.querySelectorAll("span.ogn1z")).map(
              (span) => span.textContent.trim()
            );

            texts.forEach((text) => {
              if (text) currentConvo.conversation.push({ from: sender, text });
            });
          });
        } else {
          const borderElem = li.querySelector(".KB4Aq");
          let sender = "Unknown";

          if (borderElem) {
            const color = getComputedStyle(borderElem).borderColor;
            sender = color === "rgb(242, 60, 87)" ? "Me" : "Unknown";
          }

          const text = li.querySelector("span.ogn1z")?.textContent.trim();
          if (text) currentConvo.conversation.push({ from: sender, text });
        }
      });

      if (currentConvo.conversation.length > 0) {
        output.push(currentConvo);
      }

      return output;
    }, userId);
  }

  async userStatus() {
    await this.page.waitForSelector(
      "div.ReactVirtualized__Grid__innerScrollContainer"
    );
    const lists = await this.page.$$("div[role='listitem']");
    const data = [];

    for (const listItem of lists) {
      const titleSpan = await listItem.$("span[id^='title-']");
      if (titleSpan) {
        const id = await this.page.evaluate((el) => el.id, titleSpan);
        const name = await this.page.evaluate(
          (el) => el.textContent.trim(),
          titleSpan
        );

        // Get the status span container using the ID
        const cleanedID = id.replace(/^title-/, "");
        const statusContainer = await listItem.$(`#status-${cleanedID}`);
        const statusParent = statusContainer
          ? await this.page.evaluateHandle(
            (el) => el.parentElement,
            statusContainer
          )
          : null;
        let status = [];

        if (statusParent) {
          const statusSpans = await statusParent.$$("span");
          status = await Promise.all(
            statusSpans.map((span) =>
              this.page.evaluate((el) => el.textContent.trim(), span)
            )
          );
        }
        let cleanedStatus = [
          ...new Set(
            status
              .map((text) => text?.trim())
              .filter((text) => text && text !== "·")
          ),
        ];

        let structuredStatus = {
          type: cleanedStatus[0] || null,
          time: cleanedStatus[1] || null,
          streak: cleanedStatus[2] || null,
        };

        data.push({ id: cleanedID, name, status: structuredStatus });
      }
    }
    return data;
  }

  async blockTypingNotifications(shouldBlock) {
    const client = await this.page.createCDPSession();

    await client.send("Fetch.enable", {
      patterns: [
        {
          urlPattern: "*SendTypingNotification*",
          requestStage: "Request",
        },
      ],
    });

    client.on("Fetch.requestPaused", async (event) => {
      const url = event.request.url;

      if (
        shouldBlock &&
        url.includes(
          "https://web.snapchat.com/messagingcoreservice.MessagingCoreService/SendTypingNotification"
        )
      ) {
        // console.log("[CDPBlock] Aborting request:", url);
        await client.send("Fetch.failRequest", {
          requestId: event.requestId,
          errorReason: "Failed",
        });
      } else {
        await client.send("Fetch.continueRequest", {
          requestId: event.requestId,
        });
      }
    });
  }

  //select
  async useShortcut(shortcutsArray) {
    const button = await this.page.$("button.YatIx.fGS78.eKaL7.Bnaur");
    if (button) {
      console.log("Send Button found!");
      await button.click();
    } else {
      console.log("Send Button not found.");
    }
    await delay(2000);
    for (const emoji of shortcutsArray) {
      const clicked = await this.page.$$eval(
        "div.THeKv button",
        (buttons, emoji) => {
          const btn = buttons.find((b) => b.textContent.trim() === emoji);
          if (btn) {
            btn.click();
            //now press the select
            return true;
          }
          return false;
        },
        emoji
      );

      if (clicked) {
        await this.page.waitForSelector("button.Y7u8A");
        await this.page.click("button.Y7u8A");
        const reclick = await this.page.$$eval(
          "div.THeKv button",
          (buttons, emoji) => {
            const btn = buttons.find((b) => b.textContent.trim() === emoji);
            if (btn) {
              btn.click();
              return true;
            }
            return false;
          },
          emoji
        );
      }
      if (!clicked) {
        console.warn(`Shortcut "${emoji}" not found.`);
      }
    }
    //send button

    const sendButton = await this.page.$("button[type='submit']"); //YatIx q5eEJ eKaL7 Bnaur
    await sendButton.click();
  }

  // add custom methods
  async sendVideoTo(category, videoPathY4M, audioPathWAV, caption = null, options = {}) {
    const {
      durationMs = 5000,
      headless = true,
      userDataDir = null,
      username = process.env.USER_NAME,
      password = process.env.USER_PASSWORD,
      recipients = null,
    } = options || {};

    if (!category) throw new Error("category is required");
    if (!videoPathY4M) throw new Error("videoPathY4M is required");
    if (!audioPathWAV) throw new Error("audioPathWAV is required");
    if (!fs.existsSync(videoPathY4M)) throw new Error(`Video file not found: ${videoPathY4M}`);
    if (!fs.existsSync(audioPathWAV)) throw new Error(`Audio file not found: ${audioPathWAV}`);

    const args = [
      "--start-maximized",
      "--force-device-scale-factor=1",
      "--allow-file-access-from-files",
      "--use-fake-ui-for-media-stream",
      "--enable-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${videoPathY4M}`,
      `--use-file-for-fake-audio-capture=${audioPathWAV}`,
    ];
    const launchOptions = { headless, args };
    if (userDataDir) launchOptions.userDataDir = userDataDir;

    try {
      await this.launchSnapchat(launchOptions);
      let logged = false;
      if (username && password) {
        logged = await this.ensureLoggedIn({ username, password }, { handlePopup: true, retry: 1 });
      } else {
        logged = await this.isLogged();
      }
      if (!logged) throw new Error("Login not confirmed");

      await this.recordVideo({ caption, durationMs });
      if (Array.isArray(recipients) && recipients.length > 0) {
        await this.sendToRecipients(recipients);
      } else {
        await this.send(category);
      }
    } finally {
      try { await this.closeBrowser(); } catch (_) { }
    }
  }
  static extend(methods) {
    Object.assign(SnapBot.prototype, methods);
  }
}
