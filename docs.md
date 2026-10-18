## 🚀 Getting Started with SnapBot

**SnapBot** is a modern, browser-level automation **library** designed specifically for Snapchat.  
Built on top of **Puppeteer**, SnapBot enables developers to create powerful Snapchat bots without relying on internal APIs or reverse engineering — all through the familiar browser environment.

Whether you're automating daily snaps, managing multiple accounts, or building complex chat workflows, SnapBot abstracts the hard parts so you can focus on what matters: the logic and creativity behind your automation.

### 💼 Use Cases
- Daily content distribution via snaps
- Streak automation for agencies or influencers
- CRM-style customer engagement bots
- AI-integrated messaging workflows
- Custom Snapchat tools for businesses

## 🚀 Getting Started (Developer Preview)

At its core, SnapBot wraps Snapchat's browser interface into clean, async JavaScript functions. Below is an overview of the key methods you'll be using when building automation workflows.

SnapBot exposes a set of methods that offer fine-grained control over Snapchat Web automation. Here's a list of the available methods:

### Available Methods

- `launchSnapchat(config)`
- `login(credentials)`
- `isLogged()`
- `captureSnap(options)`
- `send(person)`
- `closeBrowser()`
- `screenshot(options)`
- `logout()`
- `wait(time)`
- `openFriendRequests()`
- `listRecipients()`
- `sendMessage(options)`
- `saveCookies(username)`
- `useCookies(username)`
- `extractChatData(chatID)`
- `userStatus()`
- `blockTypingNotifications(boolean)`
- `useShortcut(shortcutsArray)`

#### Importing and Initializing
To get started, import the `SnapBot` class and initialize a new instance.
```js
import SnapBot from "./snapbot.js";
const bot = new SnapBot();
```

#### `launchSnapchat(options)`
Launches a new Puppeteer browser session configured to work seamlessly with Snapchat’s web app.

This method must be called before performing any other actions. It sets up the browser, grants media permissions, and navigates to the Snapchat home page.
##### Example:
```js

await bot.launchSnapchat({
  headless: false,
  userDataDir: "C:\\Users\\yourname\\AppData\\Local\\Google\\Chrome\\User Data\\Default",
  args: [
    "--start-maximized",
    "--force-device-scale-factor=1",
    "--use-fake-ui-for-media-stream",
    "--allow-file-access-from-files",
    "--enable-media-stream",
  ],
});
```

**Parameters:**

This method accepts any Puppeteer launch configuration object. You're free to customize it based on your needs — whether that's enabling debugging, using a persistent session, or tweaking performance settings.

Common options include:

- **`headless`** – Set to `false` if you want to see what the bot is doing.
- **`userDataDir`** – Use this to persist login sessions between runs.
- **`args`** – Chromium flags like camera/mic overrides, window size, etc.

#### `login(credentials)`
Logs into Snapchat using the given credentials.
##### Example: 
```js
let credentials = { 
  username: "your_username",
  password: "your_password",
}

await bot.login(credentials)
```

**Parameters:**
`username` (string): The Snapchat username or email.
`password` (string): The corresponding password.

#### `isLogged()`
Checks whether the bot is currently logged into Snapchat.
##### Example: 
```js
const logged = await bot.isLogged()  //returns a boolean
  if (!logged) {
    await bot.login(credentials);
  } else {
    console.log("bot is already logged");
  }
```

#### `wait(milliseconds)`
Pauses the execution of the bot for a specified amount of time (in milliseconds).
##### Example: 
```js
await bot.wait(2000) //waits for 2 seconds
```

**Parameters:**
`milliseconds` (`number`) — The amount of time to wait before continuing execution. Must be specified in milliseconds.

#### `listRecipients()`
Returns the list of the first ~20 visible chat recipients on the Snapchat web interface with their `Name`and `ChatID`. This limitation exists because Snapchat uses lazy rendering — only the chats currently visible in the viewport are available in the DOM.

> A future update will include automatic scrolling to fetch the full list dynamically.

##### Example: 
```js
const recipients = await bot.listRecipients();
console.log(recipients);
```

```js
[
    {
        "id": "0cc1a845-93d9-50fb-b79c-f64402ddfd58",
        "name": "Roger Rodrigues💤"
    },
    {
        "id": "77cd80c1-a9c4-58ad-8219-611eaf28cbd6",
        "name": "Shavina Barbosa"
    },
    {
        "id": "6091f50d-5821-51a7-9c39-462a5702e92f",
        "name": "Rahul M"
    },
 ]
```

**Returns:**
- `Array` — Each object contains:
    - `name` (`string`) — The display name of the user 
    - `id` (`string`) — The internal chat ID

> [!IMPORTANT]
> chatIDs:
> `chatID`s are a crucial part of SnapBot's workflow. They uniquely identify each chat and are used extensively in methods like `sendMessage()`, `extractChatData()`, and others. Be sure to store or reference these IDs when interacting with recipients, as they form the backbone of most chat-related operations.

#### `sendMessage(obj)`
Sends a message to a recipient identified by their `chatID`.

This method types and sends a message in an open chat. You can pass either a single string or an array of strings (to send multiline messages). After sending, the bot can either stay in the chat or exit based on the `exit` option.
##### Example: 
```js
await bot.sendMessage({
  chat: chatID,
  message: ["Hey!", "This is a multiline message."],
  exit: true, // closes the chat after sending
});
```

**Parameters:**

| Key       | Type                 | Description                                                                                             |
| --------- | -------------------- | ------------------------------------------------------------------------------------------------------- |
| `chat`    | `string`             | The unique `chatID` of the recipient (see `listRecipients()` for how to obtain it).                     |
| `message` | `string \| string[]` | The message to send. You can pass a single line or an array for multiline.                              |
| `exit`    | `boolean`            | If `true`, the bot will close the chat window after sending the message. If `false`, it will stay open. |

#### `extractChatData(chatID)`
Extracts the full visible chat history from the currently open chatbox for the given chat ID. The data is grouped by day, showing both sent and received messages.
##### Example:

```js
const id = "6091f50d-5821-51a7-9c39-462a5702e92f";

await bot.sendMessage({
  chat: id,
  message: "This message was sent via bot, do not reply", 
  exit: false, // keep chat open
});

const chatHistory = await bot.extractChatData(id);
await bot.wait(1000);
//optionally save the chat locally
fs.writeFileSync(`chats.json`, JSON.stringify(chatHistory, null, 2));

```

**Returns:**  
An array of objects structured like this:
```js
[
  {
    time: "April 8",
    conversation: [
      { from: "Me", text: "This message was sent via bot, do not reply" },
      { from: "Rahul M", text: "That is crazy" }
    ]
  },
]

```

**Parameters:**

| Name   | Type     | Description                                       |
| ------ | -------- | ------------------------------------------------- |
| chatID | `string` | The chat ID of the user (from `listRecipients()`) |

> [!NOTE]
>  The chatbox must be open before calling this method.  
> You can use `bot.sendMessage({ chat: id, message: "", exit: false })` to open the chat without sending a message.

#### `userStatus()`
Fetches the current status of users you've recently interacted with. Returns an array of objects, where each object includes:
- `id`: Unique identifier of the user (chatID).
- `name`: Display name of the user.
- `status`: An object containing:
    - `type`: Can be `"Delivered"`, `"Opened"`, or `"Received"` depending on the last interaction.
    - `time`: How long ago the interaction happened (e.g., `"2h"`, `"5h"`).
    - `streak`: Current Snapstreak as a string (e.g., `"430 🔥"`) or `null` if no streak.
##### Example:

```js
const statusList = await bot.userStatus();
console.log(statusList);
```

```js
[
  {
    id: "0cc1a845-93d9-50fb-b79c-f64402ddfd58",
    name: "Roger Rodrigues💤",
    status: {
      type: "Received",
      time: "2h",
      streak: "430 🔥"
    }
  },
  {
    id: "77cd80c1-a9c4-58ad-8219-611eaf28cbd6",
    name: "Shavina Barbosa",
    status: {
      type: "Opened",
      time: "5h",
      streak: "307 🔥"
    }
  },
  {
    id: "6091f50d-5821-51a7-9c39-462a5702e92f",
    name: "Rahul M",
    status: {
      type: "Delivered",
      time: "21h",
      streak: null
    }
  }
]
```

#### `captureSnap()`
Captures and sends a snap with a caption. The snap is created using a local image file.

This method simulates taking a snap using an image from your filesystem and allows you to overlay a caption on it. You can also control the vertical position of the caption.

**Parameters:**
- `path` (string) – The full path to the image file on your system.
- `caption` (string) – The text you want to appear on the snap.
- `position` (number, optional) – Position of the caption relative to the center:
    - `0` = exactly center
    - negative = moves the caption **up**
    - positive = moves the caption **down**

By default, the caption will appear slightly below the center.

##### Example:

```js
 await bot.captureSnap({
    path: "C:\\Users\\itsro\\Downloads\\hello.png",
    caption: "Whats everyone doing?!",
    position: 50,
  });
```

>[!CAUTION]
>**Missing Caption Bug** 
>
>Currently, if you don't provide a caption, the image **will appear in preview** but **won’t be sent properly**. Snapchat reverts to a blank/camera screen when sending without a caption.

> [!TIP]
>  **Workaround:**
> 
>  To ensure the snap is sent, use a placeholder caption like an underscore `_` and push it out of view with a high `position` value:
>  ``` 
> {
>   path: "your/image/path",
>   caption: "_",
>   position: 500
> }
>  ```



#### `send(audience)`
Sends the currently captured snap to a selected group of recipients.

This method allows you to programmatically send your snap to **friends**, **best friends**, or **groups**. Make sure you’ve already captured a snap using `bot.captureSnap()` before calling this.

##### Example:
```js
await bot.captureSnap({
    path: "C:\\Users\\itsro\\Downloads\\happy.png",
    caption: "You Are My BestFriend!",
  });
await bot.send("bestfriends"); 
```

**Parameters:**

- `audience` → _(string)_  
        Defines who should receive the snap. Accepted values: `"friends"`, `"bestfriends"`, `"groups"`.

> [!note] 
The `"friends"` audience includes both **regular friends** and **best friends**. There's no need to specify them separately.

> [!WARNING]
> **Deprecated Soon**
>
> This `"send"` method and its system will be **deprecated soon**, as it's unreliable.  
> For example, **groups** can automatically be marked as **best friends** if you interact with them frequently—leading to unpredictable behavior when sending.

#### `useShortcut(shortcutsArray)`
Utilizes Snapchat's "Shortcuts" feature to send Snaps to predefined groups of friends represented by emojis. This allows for quick and efficient Snap distribution without selecting recipients individually.

```js 
await bot.useShortcut(["🔥", "👀"]);
```

**Parameters:**

- `shortcutsArray` (`string[]`): An array of emoji strings, each representing a specific Shortcut group on Snapchat.

> [!NOTE]
>  Shortcuts
> 
> In Snapchat, Shortcuts are user-defined groups of friends identified by an emoji. They facilitate sending Snaps to multiple recipients simultaneously. Ensure that the emojis provided correspond to existing Shortcuts in your Snapchat account.

> [!tip]
>  **Mobile Only:**
> 
> Currently, Snapchat does **not** support creating Shortcuts via the web interface.  
> Users must create and manage their Shortcuts directly from the **Snapchat mobile app**.
> 
> However, once created, these Shortcuts **can be used** through the bot with `useShortcut()`.


#### `saveCookies(username)`
Saves the current session cookies to a file named after the username. This allows you to persist sessions per account and avoid repeated logins.

##### Example:

```js 
await bot.saveCookies(credentials.username); 
// Creates a file: username-cookies.json
```

**Parameters:**

- `username` _(string)_ — The account's username. Used to name the cookie file.

#### `useCookies(username)` *(Deprecated / Non-functional)*

> [!warning]
> Deprecated & Non-functional
> The `useCookies()` method was originally introduced to restore session data using cookies saved via `saveCookies()`. However, due to a fundamental design limitation—cookies being applied _after_ the browser was launched—this method was non-functional and failed to restore any authenticated session.
>
> This functionality has since been replaced by `launchSnapchat(chromeConfig, cookiefile)`, which correctly applies cookies **prior to browser launch**, ensuring proper session restoration.
 

##### Recommended usage:

```js 
await bot.launchSnapchat(chromeConfig, "yourUsername");
//the same thing you set in saveCookies("yourUsername")
```

> [!NOTE]
> Cookie File Naming Convention
> 
>The second argument in `bot.launchSnapchat(chromeConfig, "your-username")` acts as a **key** to locate the cookie file.  
>For example, setting `"xyz"` will read or create `xyz-cookies.json`. However, if you use the same key (`xyz`) across multiple Snapchat accounts, the cookie file will be overwritten each time — which can lead to incorrect sessions.
>
>**Best practice:** Use the actual Snapchat username as the key:
>```
>await bot.launchSnapchat(chromeConfig, credentials.username); 
>```
>This ensures the correct cookies are automatically loaded based on the credentials, especially when switching between different accounts.


#### `screenshot({ path })`
Takes a screenshot of the current Snapchat screen. This method is a wrapper around Puppeteer's native `page.screenshot()`, so all configuration options supported by Puppeteer can be passed here.

##### Example:
```js 
await bot.screenshot({ path: "screenshot.png" });
```

**Parameters:**

| Name | Type   | Description                                             |
| ---- | ------ | ------------------------------------------------------- |
| path | string | File path to save the screenshot (e.g., `"./snap.png"`) |


>[!note]
> This is equivalent to `page.screenshot()`. You can use options like `fullPage`, `quality`, or `type` exactly as you would with Puppeteer.


#### `logout()`
Logs the user out of their Snapchat account by navigating to the logout endpoint. Once executed, the browser will be redirected to the Snapchat login page, effectively ending the session.
##### Example:
```js
await bot.saveCookies(username) //saves the cookies 
await bot.logout();
```

> [!note]
> Snapchat Logout Behavior
> 
> When you call `bot.logout()`, Snapchat **automatically redirects** the browser to the login screen.  
> If you call `bot.saveCookies()` **after** logging out, it will save the cookies of a **logged-out session**, which won't be useful for auto-login.  
> ✅ **Tip:** Always call `bot.saveCookies()` **before** logging out if you want to preserve an active login session for reuse later. 


#### `closeBrowser()`
Closes the currently running browser instance.  
Use this at the end of your workflow to properly shut down the bot and free up system resources.
##### Example:
```js 
await bot.closeBrowser();
```

>[!tip]  
You can safely call this at the end of your bot script to ensure everything is cleaned up.  
If you're planning to restart the bot or open a new session later, make sure you’ve saved any necessary data (like cookies or screenshots) **before** calling `closeBrowser()`.

#### `blockTypingNotifications(bool)`
Prevents Snapchat from sending the "User is typing..." indicator while the bot is interacting with chats.  
This is especially useful for maintaining a more professional presence — for example, seeing “Spotify is typing...” might feel off-brand or unpolished.

##### Example:
```js 
await bot.blockTypingNotifications(true);
```

> [!caution]  
Once enabled, this setting cannot be reverted during the current browser session. If you wish to bring back the typing indicator, you must **remove this line from your code** and **launch a fresh browser instance**.


#### `openFriendRequests()`
Navigates to the **Friend Requests** page on Snapchat.

>[!note] 
This feature is still under development. While it successfully opens the friend request page, it currently does **not** accept or reject requests.
>
>The method hasn't been split into separate `accept()` or `reject()` methods yet due to testing limitations — primarily because a suitable test account with incoming requests wasn't available.
>
>Expect updates in future versions as more testing becomes possible.

##### Example:
```js 
await bot.openFriendRequests();
await bot.wait(1000); // give it a second to load fully
await bot.screenshot({ path: "friend_requests.png" });
```

>[!tip]
> Until the ability to accept/reject is fully implemented, combining this method with a screenshot gives a nice workaround to **manually review** friend requests later.

