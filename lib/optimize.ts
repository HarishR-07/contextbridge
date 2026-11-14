import { estimateTokens } from "./tokens";

/** Removes long paragraphs that repeat verbatim (ignoring case and spacing). */
export function dedupeParagraphs(text: string): { text: string; removedChars: number } {
  const seen = new Set<string>();
  const out: string[] = [];
  let removedChars = 0;
  for (const p of text.split(/\n{2,}/)) {
    const key = p.trim().toLowerCase().replace(/\s+/g, " ");
    if (key.length > 40 && seen.has(key)) {
      removedChars += p.length;
      continue;
    }
    seen.add(key);
    out.push(p);
  }
  return { text: out.join("\n\n"), removedChars };
}

export interface OptimizeReport {
  original: number;
  duplicate: number;
  optimized: number;
  reduction: number; // percent
}

export function buildReport(original: string, removedChars: number, optimized: string): OptimizeReport {
  const o = estimateTokens(original);
  const n = estimateTokens(optimized);
  return { original: o, duplicate: Math.ceil(removedChars / 4), optimized: n, reduction: o ? Math.max(0, Math.round(((o - n) / o) * 100)) : 0 };
}
