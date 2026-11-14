const field = document.getElementById("text");
const status = document.getElementById("status");
const urlField = document.getElementById("url");
chrome.storage.local.get(["appUrl"], (v) => { if (v.appUrl) urlField.value = v.appUrl; });
document.getElementById("capture").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab.");
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.getSelection()?.toString() || "" });
    field.value = result?.result || "";
    status.textContent = field.value ? `Captured ${field.value.length.toLocaleString()} selected characters.` : "Select the conversation text on the page first.";
  } catch { status.textContent = "Could not read selection on this page. Select and copy/paste the text instead."; }
});
document.getElementById("capture-chat").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab.");
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
      const selectors = [
        "[data-message-author-role]", // ChatGPT
        '[data-testid*="chat-message"]', ".font-claude-message", // Claude variants
        "user-query", ".user-query", "message-content", ".model-response-text", // Gemini variants
        '[role="listitem"][data-message-id]'
      ];
      const nodes = [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))];
      const visible = nodes.filter((el) => el instanceof HTMLElement && el.getClientRects().length && !el.closest("nav, aside"));
      const messages = visible.map((el) => {
        const rawRole = el.getAttribute("data-message-author-role") || el.getAttribute("data-author") || el.tagName;
        let role = /user|human|query/i.test(rawRole) ? "user" : /assistant|model|claude|response|content/i.test(rawRole) ? "assistant" : "message";
        const content = (el.innerText || el.textContent || "").trim();
        return content ? `${role}: ${content}` : "";
      }).filter(Boolean);
      return [...new Set(messages)].join("\n\n");
    } });
    field.value = result?.result || "";
    status.textContent = field.value ? `Captured ${field.value.split("\n\n").length} visible messages. Review for missing history.` : "No supported visible message nodes found. Use selection capture or import an official export.";
  } catch { status.textContent = "Could not inspect this page. Select and copy/paste the text or import an official export."; }
});
document.getElementById("send").addEventListener("click", async () => {
  try {
    const url = new URL(urlField.value);
    if (!/^https?:$/.test(url.protocol)) throw new Error("Use an http or https app URL.");
    await navigator.clipboard.writeText(field.value);
    await chrome.storage.local.set({ appUrl: url.href });
    await chrome.tabs.create({ url: url.href });
    status.textContent = "Copied. Paste the text into ContextBridge.";
  } catch (e) { status.textContent = e.message || "Copy failed. Select and copy the text manually."; }
});
