
---

#  How to Bypass CAPTCHA with SnapBot

If you're running SnapBot and encounter a **CAPTCHA during login**, follow these steps to bypass it:

---


###  Step-by-Step Guide

1. **Run the Bot Once**  
    Start SnapBot normally. If you see a CAPTCHA, **close the bot** for now.
    
2. **Log into Snapchat Web Manually**
    
    - Open your **regular browser** (Chrome recommended).
        
    - Go to [https://www.snapchat.com/web/](https://www.snapchat.com/web/)
        
    - Try to log in — if you see a CAPTCHA, **solve it manually**.
        
3. **Find Your Chrome Profile Path**
    
    - Locate your Chrome user data folder.  
        Example for Windows:
        
        ```
        C:\Users\YOUR_USERNAME\AppData\Local\Google\Chrome\User Data\Default
        ```
        
    - Replace `YOUR_USERNAME` with your actual Windows username.
        
4. **Edit Your Code**  
    In your SnapBot code, modify the `bot.launchSnapchat` call like this:
    
    ```js
    await bot.launchSnapchat({
      headless: false, // Browser will be visible
      args: [
        "--start-maximized",
        "--force-device-scale-factor=1",
        "--allow-file-access-from-files",
        "--use-fake-ui-for-media-stream",
        "--enable-media-stream",
      ],
      userDataDir: "C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Google\\Chrome\\User Data\\Default", // Use your real Chrome profile
    });
    ```
    
5. **Run the Bot Again**  
    Now when you run the bot, it should use the **same profile where the CAPTCHA was already solved**.
    

---

### Done!

You’ve bypassed the CAPTCHA, and SnapBot should now work without interruptions.

---

> 📌 Special thanks to **marcel** for pointing this out
