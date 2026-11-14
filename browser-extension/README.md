# ContextBridge Clip

This Manifest V3 extension offers two user-triggered capture modes: selected text, and message text currently rendered in the active tab. The visible-chat mode uses DOM selectors for common ChatGPT, Claude, and Gemini layouts. It asks only for temporary `activeTab` access when you invoke it; it does not run in the background or request persistent site access.

Captured content appears in the popup for review and editing. Click **Copy text and open app**, then paste it into ContextBridge. The popup stores only your app URL. Conversation text remains in the popup until it closes and reaches the clipboard only after you click copy.

Visible-chat extraction cannot guarantee full history: sites may change their markup, omit collapsed messages, virtualize offscreen turns, or render content in a way that is not exposed as message nodes. If the capture looks incomplete, use selection capture or import the provider's JSON export.

## Install in Chrome or Edge

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on Developer mode, choose **Load unpacked**, and select this `browser-extension` folder.
3. Open a supported AI chat, click the extension, capture visible chat, review/edit it, then copy and paste into ContextBridge.
