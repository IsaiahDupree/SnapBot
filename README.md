# SnapBot v2

SnapBot is a modern, browser-level automation library designed specifically for Snapchat.
Built on top of Puppeteer, SnapBot enables developers to create powerful Snapchat bots without relying on internal APIs or reverse engineering — all through the familiar browser environment.

Whether you're automating daily snaps, managing multiple accounts, or building complex chat workflows, SnapBot abstracts the hard parts so you can focus on what matters: the logic and creativity behind your automation.

## 💼 Use Cases
* Daily content distribution via snaps
* Streak automation for agencies or influencers
* CRM-style customer engagement bots
* AI-integrated messaging workflows
* Custom Snapchat tools for businesses

## 🚀 Features

* **Image Uploads**: Send images directly through the bot.
* **Full Chat Automation**: Automate sending and receiving messages.
* **Snap Shortcuts**: Quickly send snaps to predefined contacts.
* **Smart Notification Blocking**: Prevent unwanted notifications during automation.
* **Advanced Contact Handling**: Manage contacts efficiently within the bot.
* **Multiple Account Support**: Handle multiple Snapchat accounts simultaneously.
* **Custom Captions**: Send snaps with personalized captions.
* **Snapstreak Maintenance**: Ensure your streaks never break again.

## 📦 Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/Emmanuel-Rods/SnapBot
   ```



2. **Navigate to the project directory**:

   ```bash
   cd SnapBot
   ```



3. **Install the necessary dependencies**:

   ```bash
   npm install
   ```



4. **Set up environment variables**:

   ```bash
   cp .env.example .env
   ```



Edit the `.env` file and add your Snapchat credentials:

```env
USER_NAME=<Your Snapchat Username>
USER_PASSWORD=<Your Snapchat Password>
```



## 🛠️ Usage

To run the bot, use the following command:

```bash
npm run bot
```



This command will start SnapBot, logging into Snapchat, capturing a snap, and sending it to your specified contacts.

If you run into a CAPTCHA when using SnapBot, see this guide for a solution:  
[Bypass CAPTCHA](https://github.com/Emmanuel-Rods/SnapBot/blob/main/bypass%20captcha.md)

## 📚 Available Methods

SnapBot provides a comprehensive set of methods to interact with Snapchat:

* `launchSnapchat(config)`: Opens Snapchat in a browser. Set `headless` to `false` in the config to see the browser.
* `login(credentials)`: Logs into Snapchat using the provided credentials.
* `isLogged()`: Checks if the user is currently logged in.
* `captureSnap(options)`: Takes a snap and applies a caption.
* `send(person)`: Sends the snap to the specified recipient(s).
* `closeBrowser()`: Closes the browser session.
* `screenshot(options)`: Saves a screenshot of the current screen state.
* `logout()`: Logs out of the current Snapchat account, allowing you to log in with another account without closing the browser.
* `wait(time)`: Pauses the script for a specified duration (in milliseconds).
* `openFriendRequests()`: Opens the friend requests section.
* `listRecipients()`: Lists all available recipients.
* `sendMessage(options)`: Sends a message with the specified options.
* `saveCookies(username)`: Saves the current session cookies for the given username.
* `useCookies(username)`: Loads saved session cookies for the given username.
* `extractChatData(chatID)`: Extracts chat data for the specified chat ID.
* `userStatus()`: Retrieves the current user's status.
* `blockTypingNotifications(boolean)`: Enables or disables typing notifications based on the boolean value.
* `useShortcut(shortcutsArray)`: Applies predefined shortcuts from the provided array.

## 📖 Documentation

For detailed information on each method and advanced usage, please refer to the [docs.md](https://github.com/Emmanuel-Rods/SnapBot/blob/main/docs.md) file in the repository.


### 🧭 Architecture & API (Project Plan)

See `docs/ARCHITECTURE.md` for the comprehensive plan covering architecture, REST API, database schema, logging, Docker usage, configuration, implementation status, and next steps.

Local copy: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)


### 🎬 Media Preparation (outside container)

The container does not perform media conversion. Prepare inputs beforehand:

```bash
# Convert MP4 to Y4M video (4:2:0)
ffmpeg -y -i input.mp4 -pix_fmt yuv420p -f yuv4mpegpipe output.y4m

# Extract WAV audio (48kHz stereo)
ffmpeg -y -i input.mp4 -vn -ac 2 -ar 48000 -f wav output.wav
```

Mount the prepared files into the container under `/app/media`.


### 🗂️ Docker Volumes

The Docker image defines the following mount points:

- `/app/media` — media files to send (Y4M/WAV)
- `/app/logs` — JSON logs (pino)
- `/app/data/cookies` — persistent cookies directory (configurable via `COOKIES_DIR`)

Example run command is available in `docs/ARCHITECTURE.md`.


### 🤝 Contributing

We welcome contributions!
If you have ideas, feature requests, bug reports, or improvements for the documentation:

* 📬 **Open an issue** on GitHub
* ✉️ **Email suggestions** to [alewsor@gmail.com](mailto:alewsor@gmail.com)
* 📝 **Help improve the README or `docs.md`** — every edit counts!

Whether it’s code, feedback, or typo fixes — your support makes SnapBot better for everyone. 💛

### 🧩 Stability Notice

SnapBot relies heavily on DOM selectors, which means updates to the Snapchat web interface can occasionally break its functionality.

I’m actively working on an auto-update system to detect and adapt to these changes — and **your help is welcome**!

If you're interested in helping build this system, feel free to:

* 💬 Open an issue
* 🛠️ Submit a pull request
* ✉️ Reach out at [alewsor@gmail.com](mailto:alewsor@gmail.com)

Together we can make SnapBot more stable and smarter. 🧠✨

### 🚀 Showcase Your Bots

Built something cool using SnapBot?
We’d love to feature your creations in our showcase!
Share your bots with us by opening an issue or sending an email to [alewsor@gmail.com](mailto:alewsor@gmail.com), and get your project highlighted for the community to see.


### 📝 TODO
 * [ ] Add comprehensive JSDoc comments for all methods and functions
 * [ ] Implement better error handling and user-friendly error messages
 

> [!WARNING]
> 
> This project is intended for educational and research purposes only. The developers and contributors are not responsible for any misuse or damages resulting from the use of this software. Users are solely responsible for ensuring their compliance with all applicable laws and terms of service.

## 📬 Contact

For any queries or contributions, feel free to reach out at: [alewsor@gmail.com](mailto:alewsor@gmail.com)

