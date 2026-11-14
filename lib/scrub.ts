// Best-effort redaction of common secrets. It reduces risk but cannot catch everything.
const RULES: [string, RegExp][] = [
  ["API_KEY", /\b(?:sk-ant-|sk-proj-|sk-|sk_live_|rk_live_|ghp_|gho_|github_pat_|xox[baprs]-|AIza|AKIA)[A-Za-z0-9_-]{16,}/g],
  ["JWT", /\beyJ[A-Za-z0-9_-]{10,2000}\.[A-Za-z0-9_-]{10,2000}\.[A-Za-z0-9_-]{10,2000}/g],
  ["BEARER_TOKEN", /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g],
  ["CONNECTION_STRING", /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'@:]{0,100}:[^\s"'@]{1,100}@[^\s"']{1,200}/g],
  ["SECRET", /\b([A-Z0-9_]{0,40}(?:API_?KEY|SECRET|TOKEN|PASSWORD|PASSWD)[A-Z0-9_]{0,40}|api_?key|secret|token|password)\s*[:=]\s*["']?(?!\[REDACTED)(?=[^\s"',;]*\d|[^\s"',;]{12})[^\s"',;]{8,}["']?/gi],
];

const KEY_HEADER = /-----BEGIN [A-Z ]{0,30}PRIVATE KEY-----/g;

/** Linear-time PEM private key removal (a regex with a lazy span is quadratic on hostile input). */
function redactPrivateKeys(text: string): { text: string; count: number } {
  let out = "";
  let last = 0;
  let count = 0;
  KEY_HEADER.lastIndex = 0;
  for (let m = KEY_HEADER.exec(text); m; m = KEY_HEADER.exec(text)) {
    const end = text.indexOf("-----END", m.index + m[0].length);
    if (end === -1) break; // unterminated: no later header can terminate either
    const close = text.indexOf("-----", end + 8);
    const stop = close === -1 ? text.length : close + 5;
    out += text.slice(last, m.index) + "[REDACTED_PRIVATE_KEY]";
    last = stop;
    KEY_HEADER.lastIndex = stop;
    count++;
  }
  return { text: out + text.slice(last), count };
}

export function scrubSecrets(text: string): { text: string; count: number } {
  const keys = redactPrivateKeys(text);
  let count = keys.count;
  let out = keys.text;
  for (const [label, re] of RULES) {
    out = out.replace(re, (_m, name) => {
      count++;
      return label === "SECRET" ? `${name}=[REDACTED]` : `[REDACTED_${label}]`;
    });
  }
  return { text: out, count };
}
