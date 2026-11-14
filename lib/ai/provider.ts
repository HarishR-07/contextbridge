import { AppError } from "../errors";

export interface CompleteOptions {
  json?: boolean; // default true: ask for a JSON object
  maxTokens?: number; // default 4096
}

export interface AIProvider {
  name: string;
  complete(system: string, user: string, opts?: CompleteOptions): Promise<string>;
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55_000),
    });
  } catch {
    throw new AppError(504, "The AI provider did not respond in time. Try again, or use a shorter input.");
  }
  if (!res.ok) throw new AppError(502, `The AI provider returned an error (HTTP ${res.status}). Check your API key and model name.`);
  const raw = await res.text();
  if (raw.length > 5_000_000) throw new AppError(502, "The AI provider response was too large to process.");
  try { return JSON.parse(raw); } catch { throw new AppError(502, "The AI provider returned an unreadable response."); }
}

class AnthropicProvider implements AIProvider {
  name = "anthropic";
  constructor(private key: string, private model: string) {}
  async complete(system: string, user: string, opts?: CompleteOptions) {
    const data = await post(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": this.key, "anthropic-version": "2023-06-01" },
      { model: this.model, max_tokens: opts?.maxTokens ?? 4096, system, messages: [{ role: "user", content: user }] },
    );
    return String(data?.content?.find((b: any) => b.type === "text")?.text ?? "");
  }
}

class OpenAIProvider implements AIProvider {
  name = "openai";
  constructor(private key: string, private model: string) {}
  async complete(system: string, user: string, opts?: CompleteOptions) {
    const data = await post(
      "https://api.openai.com/v1/chat/completions",
      { Authorization: `Bearer ${this.key}` },
      {
        model: this.model,
        ...(opts?.json === false ? {} : { response_format: { type: "json_object" } }),
        max_completion_tokens: opts?.maxTokens ?? 4096,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      },
    );
    return String(data?.choices?.[0]?.message?.content ?? "");
  }
}

class GeminiProvider implements AIProvider {
  name = "gemini";
  constructor(private key: string, private model: string) {}
  async complete(system: string, user: string, opts?: CompleteOptions) {
    const data = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      { "x-goog-api-key": this.key },
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: opts?.maxTokens ?? 4096, ...(opts?.json === false ? {} : { responseMimeType: "application/json" }) },
      },
    );
    return String(data?.candidates?.[0]?.content?.parts?.map((x: any) => x.text ?? "").join("") ?? "");
  }
}

export function getProvider(headers?: Headers): AIProvider {
  // BYOK-only: do not read deployment API keys. This prevents an empty or
  // malformed BYOK request from falling through to a project owner's account.
  const requestChoice = (headers?.get("x-ai-provider") || "").toLowerCase();
  const requestKey = headers?.get("x-ai-key") || "";
  if (!requestChoice) throw new AppError(400, "Choose a provider and enter your own API key to use AI features.");
  if (!requestKey) throw new AppError(400, "Enter your personal API key for the selected provider.");
  if (requestKey.length > 500) throw new AppError(400, "AI key is too long.");
  const requestedModel = headers?.get("x-ai-model")?.trim() || "";
  if (requestedModel.length > 100 || (requestedModel && !/^[\w.:-]+$/.test(requestedModel)))
    throw new AppError(400, "Model name contains unsupported characters or is too long.");
  if (requestChoice === "openai") return new OpenAIProvider(requestKey, requestedModel || "gpt-6-luna");
  if (requestChoice === "anthropic") return new AnthropicProvider(requestKey, requestedModel || "claude-sonnet-5");
  if (requestChoice === "gemini") return new GeminiProvider(requestKey, requestedModel || "gemini-3.8-flash");
  throw new AppError(400, "Choose OpenAI, Anthropic, or Gemini for your personal API key.");
}
