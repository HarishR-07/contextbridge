import { readFile } from "node:fs/promises";
const base = process.env.EVAL_URL || "http://localhost:3000";
const source = process.env.EVAL_DATASET || new URL("./cases.json", import.meta.url);
const cases = JSON.parse(await readFile(source, "utf8"));
if (!Array.isArray(cases) || cases.length > 100) throw new Error("Evaluation dataset must be an array with at most 100 cases.");
let total = 0, hit = 0;
for (const [i, test] of cases.entries()) {
  const headers = { "Content-Type": "application/json" };
  if (process.env.ACCESS_CODE) headers["x-access-code"] = process.env.ACCESS_CODE;
  const res = await fetch(`${base}/api/snapshot`, { method: "POST", headers, body: JSON.stringify({ conversation: test.conversation }) });
  if (!res.ok) throw new Error(`Case ${i + 1}: API returned ${res.status}. Is the app running and configured?`);
  const { state } = await res.json();
  for (const [field, needles] of Object.entries(test.expected)) for (const needle of needles) {
    total++;
    const haystack = JSON.stringify(state[field] ?? "").toLowerCase();
    if (haystack.includes(needle.toLowerCase())) hit++;
    else process.stdout.write(`MISS case ${i + 1}, ${field}: ${needle}\n`);
  }
}
process.stdout.write(`Synthetic fact recall: ${hit}/${total} (${total ? Math.round(100 * hit / total) : 0}%). This is a tiny smoke metric, not a quality guarantee.\n`);
