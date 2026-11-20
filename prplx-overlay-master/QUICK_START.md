# ⚡ Quick Start Guide - Perplexity Overlay

## 🎯 5-Minute Setup

### Step 1: Enable Safari Automation (One-Time)
1. Safari → Settings → Advanced
2. Check "Show Develop menu"
3. Develop → "Allow JavaScript from Apple Events" ✅

### Step 2: Open Perplexity
1. Open Safari → Go to `perplexity.ai`
2. Log in to your account
3. Complete CAPTCHA if needed
4. Keep tab open (NOT in Private mode)

### Step 3: Launch the App
```bash
cd prplx-overlay
npm install  # First time only
npm start
```

---

## ⌨️ Essential Hotkeys Cheat Sheet

| Key | Action |
|-----|--------|
| **⌘ ↓** | Show/Hide overlay |
| **⌘ `` ` ``** | Toggle Stealth / Passive overlay mode |
| **⌘ H** | Capture region screenshot (snip) |
| **⌘ 1** | Capture screenshot & attach |
| **⌘ 2** | Capture screenshot & auto-solve |
| **⌘ ⇧ C** | Pull clipboard text/image into chat |
| **⌘ Enter** | Send prompt / Process screenshots |
| **⌘ ⇧ N** | New chat session |
| **⌘ Q** | Quit app |

*(On Windows/Linux, replace `⌘` with `Ctrl` and use **Direct AI** mode.)*

---

## 💬 How to Use

1. **Show overlay**: Press **⌘ ↓**
2. **Choose Engine**: Select **Perplexity** (macOS Safari) or **Direct AI** (Gemini, Ollama, OpenAI/Groq/OpenRouter) in the top bar
3. **Ask or Capture**: Type a question, click a Quick Prompt preset, paste from clipboard (**⌘ ⇧ C**), or snip screen (**⌘ H**)
4. **Send**: Press **Enter** or **⌘ Enter**
5. **History & Export**: Open **History** to restore previous chats or export as Markdown
6. **New chat**: Press **⌘ ⇧ N** or click **New**

---

## ❌ Common Issues

- **Script not found?** → Make sure you're in the project directory
- **Safari error (or on Windows/Linux)?** → Switch to **Direct AI** mode in the overlay header and configure Gemini, Ollama, or an OpenAI-compatible provider in **Settings**
- **No Perplexity response?** → Check Safari has an open logged-in `perplexity.ai` tab and "Allow JavaScript from Apple Events" is enabled
- **Window not showing?** → Press **⌘ ↓** or **⌘ ⇧ Space** to center and show

---

**Full guide**: See `PERPLEXITY_SETUP.md` for detailed instructions.

