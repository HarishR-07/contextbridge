export const ACCESS_KEY = "cb_access_code";
export const AI_PROVIDER_KEY = "cb_ai_provider";
export const AI_MODEL_KEY = "cb_ai_model";

let aiCredentials = { provider: "", key: "", model: "" };
export function setAiCredentials(provider: string, key: string, model: string): void {
  aiCredentials = { provider, key, model };
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let code = "";
  try {
    code = sessionStorage.getItem(ACCESS_KEY) ?? "";
  } catch {}
  const { provider, key, model } = aiCredentials;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(code ? { "x-access-code": code } : {}),
      // Always send the selected provider, even when its key is blank. The server
      // must reject this request rather than silently using a deployment key.
      ...(provider ? { "x-ai-provider": provider, "x-ai-model": model, ...(key ? { "x-ai-key": key } : {}) } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}
