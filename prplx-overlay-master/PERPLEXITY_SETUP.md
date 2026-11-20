# Perplexity Overlay - Setup & Usage Guide

## 🚀 Quick Start

### Prerequisites

1. **Node.js** installed (v18+ recommended)
2. **macOS** (required for Safari automation via AppleScript)
3. **Safari** with JavaScript automation enabled
4. **Perplexity.ai account** (logged in and ready)

### Initial Setup

#### 1. Install Dependencies

```bash
cd prplx-overlay
npm install
```

#### 2. Enable Safari Automation

**This is required for Perplexity integration to work!**

1. Open **Safari**
2. Go to **Safari → Settings** (or **Preferences**)
3. Click the **Advanced** tab
4. Check **"Show Develop menu in menu bar"** (if not already checked)
5. Go to **Develop → Allow JavaScript from Apple Events**
6. Make sure this option is **enabled** ✅

#### 3. Prepare Perplexity in Safari

1. Open **Safari** and navigate to **https://perplexity.ai**
2. **Log in** to your Perplexity account
3. **Complete any Cloudflare CAPTCHA** if prompted
4. **Keep the Perplexity tab open** - it should be the active tab or easily accessible
5. ⚠️ **Important**: Do NOT use a Private/Incognito window - AppleScript cannot access private windows

#### 4. Verify Script Location

Make sure the automation script exists:
```bash
ls -la prplx-overlay/scripts/perplexity_send.jxa
```

If it doesn't exist, it should be in the repository. The script must be executable:
```bash
chmod +x prplx-overlay/scripts/perplexity_send.jxa
```

---

## 🎮 Launching the App

### Development Mode (Recommended)

```bash
cd prplx-overlay
npm start
```

This will:
- Start the Vite dev server on port 5180
- Compile TypeScript for Electron
- Launch the Electron overlay window

### What You'll See

- A **transparent, always-on-top overlay** window
- Initially shows a toolbar with buttons
- The overlay is **invisible to screen recorders** (transparent background)
- Window can be moved with keyboard shortcuts

---

## ⌨️ Keyboard Shortcuts

### Main Overlay Controls

| Shortcut | Action | Description |
|----------|--------|-------------|
| **⌘ ↓** | Toggle Window | Show/hide the overlay window |
| **⌘ `` ` ``** | Stealth / Focus Mode | Toggle passive / capture overlay mode |
| **⌘ H** | Take Screenshot | Capture region screenshot (snip) |
| **⌘ 1** | Capture & Attach | Capture screenshot and attach to chat |
| **⌘ 2** | Quick Solve | Capture screenshot and auto-send Quick-Solve prompt |
| **⌘ ⇧ C** | Clipboard Quick-Ask | Pull clipboard text or image into overlay |
| **⌘ Enter** | Send / Process | Send prompt or solve captured screenshots |
| **⌘ R** | Reset | Clear queues and reset view |
| **⌘ ⇧ Space** | Show/Center | Center and show the window |
| **⌘ ←/→/↑ / ⌘ ⇧ ↓** | Move Window | Move overlay across current display |
| **⌘ Q** | Quit App | Exit the application |

### Perplexity Chat Controls

| Shortcut | Action | Description |
|----------|--------|-------------|
| **⌘ ⇧ N** | New Chat | Start a fresh Perplexity conversation |
| **Enter** | Send Message | Send your typed message to Perplexity |

---

## 💬 Using Perplexity Chat

### Step-by-Step Guide

1. **Open the Chat Interface**
   - Click the **💬 Chat** button in the overlay toolbar
   - Use the model buttons above the chat log to switch between **Sonar**, **GPT-5**, **GPT-5 + Reasoning**, and **Claude Sonnet 4.5 + Reasoning**
   - Toggle **🌐 Web On/Off** to enable or disable Perplexity's internet search
   - Or use the toggle if it's already visible

2. **Type Your Question**
   - Click in the input field at the bottom
   - Type your question or prompt
   - Press **Enter** or click the send button (paper plane icon)

3. **Wait for Response**
   - A loading indicator shows "Perplexity is replying..."
   - The script automatically:
     - Finds your open Perplexity tab in Safari
     - Injects your message into the chat
     - Waits for the response to complete (usually 30-90 seconds)
     - Captures the answer and displays it in the overlay

4. **View the Answer**
   - The response appears in the chat bubble
   - You can continue the conversation with follow-up questions
   - Responses may include citation markers (like `source+2​`) - these are normal

5. **Start a New Chat**
   - Click the **🆕 New Chat** button in the toolbar
   - Or press **⌘ ⇧ N**
   - This clears the conversation and starts fresh

### Tips for Best Results

- ✅ **Keep Safari visible** (not minimized) - the script needs to find the tab
- ✅ **Wait for Perplexity to finish** - don't close Safari or switch tabs during processing
- ✅ **One question at a time** - wait for each response before asking the next
- ✅ **Check your internet connection** - Perplexity needs to be online
- ⚠️ **The Safari window may briefly come to front** - this is normal for automation

---

## 🔧 Troubleshooting

### "Perplexity automation script not found"

**Solution:**
```bash
# Make sure you're in the prplx-overlay directory
cd prplx-overlay
ls scripts/perplexity_send.jxa

# If missing, check if it's in the parent directory
ls ../scripts/perplexity_send.jxa
```

### "Error: You must enable 'Allow JavaScript from Apple Events'"

**Solution:**
1. Safari → Settings → Advanced
2. Enable "Show Develop menu"
3. Develop → "Allow JavaScript from Apple Events" ✅

### "Error: Perplexity input editor not found"

**Possible causes:**
- Perplexity tab is not loaded/found
- Cloudflare CAPTCHA is pending
- Perplexity UI has changed

**Solutions:**
1. Make sure Perplexity is open in Safari (non-private window)
2. Refresh the Perplexity tab
3. Complete any CAPTCHA challenges
4. Check that the URL contains `perplexity.ai`

### "Error: Timed out waiting for Perplexity response"

**Possible causes:**
- Perplexity is taking longer than expected (3-4 minutes)
- Network is slow
- Page is not responding

**Solutions:**
1. Wait longer - complex questions can take 3-4 minutes
2. Check your internet connection
3. Make sure Perplexity tab is active and not frozen
4. Try a simpler question first

### "The overlay window doesn't appear"

**Solution:**
1. Press **⌘ B** to toggle visibility
2. Check if the app is running: `ps aux | grep -i electron`
3. Check terminal for error messages
4. Make sure port 5180 is available: `lsof -i :5180`

### "Safari window pops to front"

This is **normal behavior** - the automation script needs to interact with Safari. The window will briefly come forward, then you can continue using your other apps while Perplexity processes in the background.

---

## 📝 Advanced Configuration

### Environment Variables (for testing)

You can test the Perplexity script directly from terminal:

```bash
# Basic usage
PERPLEXITY_MESSAGE='What is binary search?' ./scripts/perplexity_send.jxa

# Start a new chat
PERPLEXITY_MESSAGE='List two SQL joins' PERPLEXITY_NEW_CHAT=true ./scripts/perplexity_send.jxa

# JSON output with custom timeout
PERPLEXITY_MESSAGE='Explain quantum computing' \
  PERPLEXITY_OUTPUT=json \
  PERPLEXITY_TIMEOUT=120 \
  ./scripts/perplexity_send.jxa

# Force GPT-5 with reasoning and disable web search
PERPLEXITY_MESSAGE='Summarize the Ramanujan primes' \
  PERPLEXITY_MODEL='gpt-5-reasoning' \
  PERPLEXITY_WEB_SEARCH=off \
  ./scripts/perplexity_send.jxa
```

### Configuration Options

- `PERPLEXITY_TIMEOUT` - Maximum wait time in seconds (default: 45)
- `PERPLEXITY_POLL_INTERVAL_MS` - How often to check for response (default: 750ms)
- `PERPLEXITY_STABLE_POLLS` - Number of identical checks before considering complete (default: 3)
- `PERPLEXITY_OUTPUT` - Output format: `text` or `json` (default: `text`)
- `PERPLEXITY_NEW_CHAT` - Set to `true` to start fresh conversation
- `PERPLEXITY_MODEL` - Choose default model: `sonar`, `gpt-5`, `gpt-5-reasoning`, `claude-sonnet-4.5-reasoning`
- `PERPLEXITY_WEB_SEARCH` - Force web search `on` / `off` before asking the question

---

## 🎯 Common Workflows

### Example 1: Quick Question During Interview

1. Press **⌘ B** to show overlay (if hidden)
2. Click **💬 Chat** button
3. Type: "What is the time complexity of quicksort?"
4. Press **Enter**
5. Wait ~30-60 seconds for answer
6. Read the response in the overlay
7. Press **⌘ B** to hide overlay

### Example 2: Analyzing Screenshot Problem

1. Take screenshot with **⌘ H** (or capture a problem)
2. The app automatically sends it to AI for analysis
3. View the analysis in the chat interface

### Example 3: Multi-turn Conversation

1. Ask first question: "Explain binary trees"
2. Wait for response
3. Ask follow-up: "How do I implement insertion?"
4. Continue conversation naturally
5. Press **⌘ ⇧ N** when you want to start fresh

---

## ⚠️ Important Notes

1. **Privacy**: The overlay itself is invisible to screen recorders, but Safari automation may briefly bring the window forward
2. **Stability**: This relies on Perplexity's live UI - if they change their interface, the script may need updates
3. **Rate Limiting**: Perplexity may rate-limit if you send too many requests too quickly
4. **Network**: Requires active internet connection and Perplexity account
5. **macOS Only**: Safari automation via AppleScript only works on macOS

---

## 🆘 Getting Help

If you encounter issues:

1. **Check the terminal output** - Error messages appear there
2. **Verify Safari setup** - Make sure JavaScript automation is enabled
3. **Test the script directly** - Use the terminal commands above
4. **Check Perplexity** - Make sure you're logged in and the page loads
5. **Restart the app** - Sometimes a fresh start helps

---

## 📚 Additional Resources

- Main README: `README.md`
- Technical Documentation: `doc.md`
- Script Location: `scripts/perplexity_send.jxa`

---

**Enjoy your invisible AI assistant! 🚀**

