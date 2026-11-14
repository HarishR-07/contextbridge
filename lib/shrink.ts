import type { CodeFile } from "./zipfiles";
import { estimateTokens } from "./tokens";

export type ShrinkMode = "full" | "compact" | "outline";

const ext = (path: string) => path.split(".").pop()?.toLowerCase() ?? "";
const SLASH = new Set(["js", "jsx", "ts", "tsx", "mjs", "cjs", "java", "c", "h", "cpp", "hpp", "cs", "go", "rs", "swift", "kt", "scala", "php"]);
const HASH = new Set(["py", "rb", "sh", "bash"]);
const CONTROL = new Set(["if", "for", "while", "switch", "catch", "return", "else", "function", "with"]);
const OUTLINE: Record<string, RegExp[]> = {
  js: [/^\s*(export\s+)?(default\s+)?(async\s+)?(function\*?|class|interface|type|enum)\b/, /^\s*(export\s+)?(const|let|var)\s+[\w$]+\s*(:[^=]+)?=\s*(async\s*)?(\([^)]*\)|[\w$]+)\s*(:[^=]+)?=>/, /^\s*(export\s+)?(const|let|var)\s+[\w$]+\s*=\s*(async\s+)?function/],
  py: [/^\s*(async\s+def|def|class)\s/],
  go: [/^(func|type)\s/],
  rs: [/^\s*(pub(\([^)]*\))?\s+)?(async\s+)?(fn|struct|enum|trait|impl|mod)\b/],
};
const GROUP: Record<string, string> = { jsx: "js", ts: "js", tsx: "js", mjs: "js", cjs: "js" };
const METHOD = /^\s+(?:(?:public|private|protected|static|async|readonly)\s+)*([A-Za-z_$][\w$]*)\s*\(.*\)\s*(?::[^{]+)?\{\s*$/;

function tidy(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").trimEnd() + "\n";
}

function compact(content: string, e: string): string {
  const out: string[] = [];
  let inBlock = false;
  for (const raw of content.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const t = line.trim();
    if (SLASH.has(e)) {
      if (inBlock) {
        if (t.includes("*/")) {
          inBlock = false;
          const after = t.slice(t.indexOf("*/") + 2).trim();
          if (after) out.push(after);
        }
        continue;
      }
      if (t.startsWith("//") && !/^\/\/\/?\s*(@|eslint|prettier|istanbul|#|<reference)/.test(t)) continue;
      if (t.startsWith("/*") && !t.startsWith("/*!")) {
        if (!t.includes("*/")) { inBlock = true; continue; }
        if (t.endsWith("*/")) continue;
      }
    } else if (HASH.has(e) && t.startsWith("#") && !t.startsWith("#!") && !/^#\s*(type:|noqa|pylint|pragma|-\*-|coding)/.test(t)) {
      continue;
    }
    out.push(line);
  }
  return tidy(out.join("\n"));
}

function outline(content: string, e: string): string {
  const rules = OUTLINE[GROUP[e] ?? e];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  if (!rules) {
    const head = lines.slice(0, 60).join("\n");
    return tidy(lines.length > 60 ? `${head}\n[${lines.length - 60} more lines omitted]` : head);
  }
  const keep = lines.filter((l) => rules.some((r) => r.test(l)) || (GROUP[e] === "js" || e === "js" ? METHOD.test(l) && !CONTROL.has(METHOD.exec(l)![1]) : false)).map((l) => l.replace(/\s+$/, ""));
  return tidy(`[outline only: declarations shown, bodies omitted]\n${keep.join("\n")}`);
}

export function shrinkFile(path: string, content: string, mode: ShrinkMode): string {
  if (mode === "full") return content;
  const e = ext(path);
  return mode === "compact" ? compact(content, e) : outline(content, e);
}

/** Token estimate before and after shrinking the chosen files (only files with content). */
export function shrinkReport(code: CodeFile[], paths: string[], mode: ShrinkMode) {
  const chosen = new Set(paths);
  let before = 0;
  let after = 0;
  for (const f of code) {
    if (!chosen.has(f.path) || f.content == null) continue;
    before += estimateTokens(f.content);
    after += estimateTokens(shrinkFile(f.path, f.content, mode));
  }
  return { before, after, saved: before ? Math.round(((before - after) / before) * 100) : 0 };
}
