import JSZip from "jszip";

type AnyRecord = Record<string, any>;
export type ImportedConversation = { id: string; title: string; text: string };
const obj = (v: unknown): AnyRecord => v && typeof v === "object" && !Array.isArray(v) ? v as AnyRecord : {};
const textOf = (content: any): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(textOf).filter(Boolean).join("\n");
  const c = obj(content);
  if (Array.isArray(c.parts)) return c.parts.map(textOf).filter(Boolean).join("\n");
  if (typeof c.text === "string") return c.text;
  if (typeof c.content === "string") return c.content;
  return "";
};
function isMessage(value: unknown): boolean {
  const m = obj(value);
  return !!(m.author?.role || m.role || m.sender || m.type || m.message?.author?.role || m.message?.role);
}
function messageText(input: unknown): string {
  let m = obj(input);
  if (m.message && typeof m.message === "object") m = obj(m.message);
  const role = String(m.author?.role ?? m.sender ?? m.role ?? m.type ?? "").toLowerCase();
  if (role && !/(user|assistant|human|model)/.test(role)) return "";
  const body = textOf(m.content ?? m.message ?? m.text);
  return body.trim() ? `${role || "message"}: ${body.trim()}` : "";
}
function messagesFrom(root: AnyRecord): string[] {
  if (root.mapping && typeof root.mapping === "object") {
    return Object.values(root.mapping).map((n: any) => n?.message).filter(Boolean)
      .sort((a: any, b: any) => Number(a.create_time ?? 0) - Number(b.create_time ?? 0))
      .map(messageText).filter(Boolean);
  }
  for (const key of ["messages", "chat_messages", "turns", "history"]) {
    if (Array.isArray(root[key]) && root[key].some(isMessage)) return root[key].map(messageText).filter(Boolean);
  }
  return [];
}
function extract(data: unknown, parentTitle = ""): ImportedConversation[] {
  if (Array.isArray(data)) {
    if (data.length && data.some(isMessage)) {
      const text = data.map(messageText).filter(Boolean).join("\n\n");
      return text ? [{ id: crypto.randomUUID(), title: parentTitle || "Imported conversation", text }] : [];
    }
    return data.flatMap((item, i) => extract(item, parentTitle || `Conversation ${i + 1}`));
  }
  const root = obj(data);
  const title = String(root.title ?? root.name ?? root.conversation_name ?? parentTitle ?? "").trim();
  const messages = messagesFrom(root);
  if (messages.length) return [{ id: String(root.id ?? root.uuid ?? crypto.randomUUID()), title: title || "Imported conversation", text: messages.join("\n\n") }];
  for (const key of ["conversations", "conversation", "chats", "data", "items"]) {
    if (root[key]) {
      const found = extract(root[key], title);
      if (found.length) return found;
    }
  }
  return [];
}

/** Extract individual conversations from common provider JSON exports; never merges separate chats. */
export async function importChatExport(file: File): Promise<ImportedConversation[]> {
  if (file.size > 100_000_000) throw new Error("Chat export is too large (100 MB limit).");
  let jsonText = "";
  let sourceName = file.name;
  if (file.name.toLowerCase().endsWith(".zip")) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entries = Object.values(zip.files).filter((e) => !e.dir && e.name.toLowerCase().endsWith(".json"));
    const entry = entries.find((e) => /conversations\.json$/i.test(e.name)) ?? entries.find((e) => /chat|export/i.test(e.name));
    if (!entry) throw new Error("No conversation JSON was found in this ZIP.");
    if (((entry as any)._data?.uncompressedSize ?? 0) > 50_000_000) throw new Error("Conversation JSON is too large.");
    jsonText = await entry.async("string");
    sourceName = entry.name.split("/").pop() || sourceName;
  } else {
    jsonText = await file.text();
  }
  let data: unknown;
  try { data = JSON.parse(jsonText); } catch { throw new Error("This export is not valid JSON. For HTML exports, copy the conversation text and paste it instead."); }
  const conversations = extract(data);
  if (!conversations.length || conversations.every((c) => c.text.trim().length < 10)) throw new Error("Could not recognize conversations in this export. Formats vary; copy and paste the conversation instead.");
  return conversations.map((c, i) => ({ ...c, title: c.title === "Imported conversation" ? `${sourceName} · ${i + 1}` : c.title }));
}
