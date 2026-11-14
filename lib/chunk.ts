export const CHUNK_CHARS = 60_000;
export const MAX_CHUNKS = 10;

/** Splits long text at paragraph boundaries so each part fits in one request. */
export function splitChunks(text: string, size = CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  let cur = "";
  const push = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = "";
  };
  for (const para of text.split(/\n{2,}/)) {
    if (para.length > size) {
      push();
      for (let i = 0; i < para.length; i += size) chunks.push(para.slice(i, i + size));
      continue;
    }
    if (cur.length + para.length + 2 > size) push();
    cur += (cur ? "\n\n" : "") + para;
  }
  push();
  if (chunks.length > 1 && chunks[chunks.length - 1].length < 200) {
    const tail = chunks.pop()!;
    chunks[chunks.length - 1] += `\n\n${tail}`;
  }
  return chunks;
}
