export const metadata = { title: "Privacy | ContextBridge" };

export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-slate-700">
      <a href="/" className="text-teal-700 underline">Back to ContextBridge</a>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Privacy</h1>
      <p className="mt-3">ContextBridge handles project conversations and code, so here is exactly what happens.</p>
      <h2 className="mt-5 font-semibold text-slate-900">What is sent</h2>
      <p>AI features require your own API key for Anthropic, OpenAI or Google Gemini. The key is held in page memory and forwarded through the app server to the selected provider for that request; it is cleared when the page reloads and ContextBridge does not intentionally persist it. Use a local or trusted deployment because its operator and hosting infrastructure handle the request in transit. Your provider bills you and handles submitted text under its own terms. For codebase ZIPs, file contents stay in your browser unless you explicitly select source files for deeper relevance analysis. File names, sizes, import links and the current project summary are sent to your selected provider for relevance selection.</p>
      <h2 className="mt-5 font-semibold text-slate-900">What is stored</h2>
      <p>Current snapshots live in page memory. Optional version history stores up to 20 versions in browser local storage. Handoff outcome ratings and estimated minutes saved are also stored locally in this browser, up to 100 entries; they contain no conversation text. If you configure Supabase and sign in, cloud project snapshots and their version history are stored in your Supabase account database under row-level security policies. Cloud versions are retained until the project is deleted. Export a ZIP to keep a portable copy. This app includes no tracking cookies. The access code and account session are kept in this browser tab&apos;s session storage. A personal API key, if entered, is held in page memory and cleared when the page reloads.</p>
      <h2 className="mt-5 font-semibold text-slate-900">Secrets</h2>
      <p>Common keys, tokens, passwords and private keys are redacted before sending. This is best effort and cannot catch everything, so check sensitive material yourself. Files like .env and key files are never read from ZIPs.</p>
      <h2 className="mt-5 font-semibold text-slate-900">Feedback</h2>
      <p>When you submit a handoff rating, the yes/partly/no result is sent to the app server, which logs the rating and can forward it to the deployment&apos;s configured feedback webhook. No project text, snapshot, target AI or time-saved estimate is sent. Your local history includes the rating and your estimated minutes saved; you can export or clear it in the app.</p>
    </main>
  );
}
