import JSZip from "jszip";

export interface CodeFile {
  path: string;
  size: number; // characters
  content: string | null; // null when too large to include
}

const SKIP_DIR = /(^|\/)(node_modules|\.git|\.next|dist|build|out|coverage|__pycache__|\.venv|venv|\.idea|\.vscode)\//;
// Secrets and noise are never read, listed or exported.
const SKIP_FILE = /(^|\/)(\.env[^/]*|[^/]*\.(pem|key|p12|pfx)|id_rsa[^/]*|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i;
const BINARY = /\.(png|jpe?g|gif|webp|ico|svg|pdf|zip|gz|mp[34]|mov|woff2?|ttf|eot|exe|dll|so|bin)$/i;
const MAX_FILE = 200_000;
const MAX_FILES = 3000;
const MAX_ARCHIVE = 50_000_000; // bytes
const MAX_ENTRY = 5_000_000; // uncompressed bytes per file
const MAX_TOTAL = 30_000_000; // characters read in total
export const isSafePath = (p: string) => !!p && !p.startsWith("/") && !p.includes("\\") && !p.includes("\u0000") && !/(^|\/)\.\.(\/|$)/.test(p);

export async function readCodebase(file: Blob): Promise<{ files: CodeFile[]; skipped: number }> {
  if (file.size > MAX_ARCHIVE) throw new Error("This ZIP is too large (limit 50 MB).");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter((e) => !e.dir);
  const roots = new Set(entries.map((e) => e.name.split("/")[0]));
  const strip = roots.size === 1 && entries.every((e) => e.name.includes("/")) ? `${[...roots][0]}/` : "";
  const files: CodeFile[] = [];
  let skipped = 0;
  let total = 0;
  for (const e of entries) {
    const path = e.name.slice(strip.length);
    const declaredSize = (e as any)._data?.uncompressedSize;
    if (!isSafePath(path) || declaredSize > MAX_ENTRY || total + (declaredSize ?? 0) > MAX_TOTAL || SKIP_DIR.test(path) || SKIP_FILE.test(path) || BINARY.test(path) || files.length >= MAX_FILES) {
      skipped++;
      continue;
    }
    const text = await e.async("string");
    total += text.length;
    if (total > MAX_TOTAL) throw new Error("ZIP contents exceed the 30 MB text limit.");
    if (text.includes("\u0000")) {
      skipped++;
      continue;
    }
    files.push({ path, size: text.length, content: text.length > MAX_FILE ? null : text });
  }
  return { files, skipped };
}
