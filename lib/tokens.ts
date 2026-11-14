export type TokenModel = "gpt-4o-mini" | "gpt-4.1" | "gpt-5" | "o3" | "o4-mini" | "claude-sonnet" | "gemini-2.5";
export const TOKEN_MODELS: { id: TokenModel; label: string; exact: boolean }[] = [
  { id: "gpt-4o-mini", label: "GPT-4o mini", exact: true },
  { id: "gpt-4.1", label: "GPT-4.1", exact: true },
  { id: "gpt-5", label: "GPT-5", exact: true },
  { id: "o3", label: "o3", exact: true },
  { id: "o4-mini", label: "o4-mini", exact: true },
  { id: "claude-sonnet", label: "Claude (rough estimate)", exact: false },
  { id: "gemini-2.5", label: "Gemini (rough estimate)", exact: false },
];

export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);
let tokenizer: Promise<typeof import("js-tiktoken")> | null = null;
const encoders = new Map<string, import("js-tiktoken").Tiktoken>();
export async function countTokens(text: string, model: TokenModel = "gpt-4o-mini"): Promise<number> {
  if (model === "claude-sonnet" || model === "gemini-2.5") return Math.ceil(text.length / 4);
  try {
    tokenizer ??= import("js-tiktoken");
    const { encodingForModel } = await tokenizer;
    let enc = encoders.get(model);
    if (!enc) { enc = encodingForModel(model); encoders.set(model, enc); }
    return enc.encode(text).length;
  } catch {
    return Math.ceil(text.length / 4);
  }
}
