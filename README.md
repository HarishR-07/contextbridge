# ContextBridge

**Open-source AI conversation manager for context management and project memory. Turn ChatGPT, Claude, and Gemini chats into editable snapshots and portable AI handoffs with your own API key.**

> **Suggested GitHub About description:** Open-source AI conversation manager for context management and project memory. Turn ChatGPT, Claude, and Gemini chats into editable snapshots and portable handoffs for Claude Code, Cursor, and other AI coding assistants. Self-hosted with your own API key (BYOK).

> **Suggested GitHub topics:** `ai-context-management` `ai-handoff` `project-memory` `context-engineering` `chatgpt` `claude` `gemini` `cursor` `ai-coding-assistant` `conversation-export` `self-hosted` `bring-your-own-key`

ContextBridge helps with lost context in long AI chats, switching between AI assistants, and keeping project decisions and next steps available to coding agents. It converts conversations into editable project state, checks evidence quotes, and exports files that tools can read, including `CLAUDE.md`, `AGENTS.md`, and `.cursorrules`. It is a self-hostable Next.js app: AI features use **your own API key**; this project does not provide or fall back to an owner-funded model key.

## What problem does ContextBridge solve?

AI conversations often lose useful project context when a chat grows too long, a user starts a new conversation, or a project moves between ChatGPT, Claude, Gemini, Cursor, or another coding assistant. ContextBridge creates a user-editable project memory and portable context handoff from chat exports or pasted conversation text. It is designed for AI context management, long-chat summarization, project handoff between AI tools, and reusable coding-agent instructions.

## Common use cases

- Carry decisions, requirements, open issues, and next steps from a long ChatGPT, Claude, or Gemini conversation into a new chat.
- Reduce repeated explanations when switching AI models or coding assistants.
- Create a portable project memory that can be reviewed, corrected, versioned, and exported.
- Build handoff files for coding agents such as Claude Code and Cursor.
- Keep API costs under your control with bring-your-own-key (BYOK) and self-hosting.
- Import chat export archives and inspect code ZIPs before selecting files for model-assisted relevance analysis.

## Quick start

Requirements: Git, Node.js 20 or later, and npm.

```bash
git clone https://github.com/OWNER/contextbridge.git
cd contextbridge
npm ci
npm run dev
```

Open `http://localhost:3000`, select OpenAI, Anthropic, or Google Gemini, paste your provider API key, and optionally enter a model ID. Create the key in the provider's developer/API dashboard (links below); an ordinary ChatGPT or Claude website account, including Claude Free, is not an API key and does not include API access. Without a key you can still import, edit, compare, and export existing snapshots; AI extraction, optimization, task planning, and relevance selection need provider API access.

### API key setup

1. Choose one supported provider and create an API key in its developer console.
2. Start ContextBridge locally or deploy your own trusted instance.
3. Select that provider in the app and paste the key into **Your provider API key**. The field is held in page memory and clears on reload.
4. Leave **Model ID** blank to use the default model, or enter a model ID enabled for your account.
5. Run an AI action. The provider charges your account according to its own pricing, quotas, and terms.

Never paste an API key into a public chat, source file, GitHub issue, or repository. Revoke a key if it is exposed.

The key is held in page memory and sent to the ContextBridge server in a request header; the server forwards it to the provider selected for that request. The key is cleared on page reload. The app does not intentionally persist or log the key. Run locally or use only a server you trust. Your provider bills your account and applies its data policies. Review conversation text and selected code before sending.

## Providers and model IDs

Supported APIs: OpenAI, Anthropic, and Google Gemini. The default models are `gpt-6-luna`, `claude-sonnet-5`, and `gemini-3.8-flash`. You can supply another model ID available to your account in the Model ID field. Availability, model names, quotas, and prices are controlled by each provider and can change. The OpenAI adapter uses Chat Completions; choose an OpenAI model that supports that API and JSON mode. Gemini model IDs should not include a slash.

Get API access from the provider directly:

- [OpenAI API](https://platform.openai.com/api-keys)
- [Anthropic Console](https://console.anthropic.com/)
- [Google AI Studio](https://aistudio.google.com/apikey)

Keep API keys private, set provider spending limits where available, and revoke a key if you pasted it into an untrusted deployment. Never commit keys to GitHub.

## What it includes

- Create/update project snapshots, optimize context, plan task size, and ask handoff-check questions.
- Edit snapshots and verify supporting quotes against source text.
- Import ChatGPT/Claude/Gemini export JSON or ZIP archives (best effort), or import an existing ContextBridge JSON/ZIP snapshot.
- Browser-local history with compare/restore; optional Supabase accounts and cloud project versions.
- Long-chat chunk review, token estimates, code ZIP relevance selection and optional selected-file analysis.
- User-triggered Chrome/Edge extension to capture visible chat text.
- Export portable `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, evidence, state JSON, and handoff files.
- Local stdio MCP server for reading/updating a state JSON file.
- Synthetic evaluation harness; it does not measure real handoff success.

### How project handoff works

1. Paste conversation text or import a supported chat export.
2. ContextBridge scrubs some common secret formats, then sends the selected conversation to the provider using your key.
3. Review and edit the generated snapshot, its evidence quotes, and the chunk-by-chunk changes.
4. Export portable project state and agent instruction files, then add them to a new chat or coding project.

Secret scrubbing is best effort. Check the selected content before sending it to a model provider.

## Configuration

Copy `.env.example` to `.env.local` only if you need an access code, feedback webhook, or optional Supabase cloud saves. Local development works without environment variables. **Do not add model-provider keys to server environment variables:** AI routes are BYOK-only and intentionally ignore them.

For optional cloud saves, create a Supabase project, run [`supabase/schema.sql`](supabase/schema.sql), then set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The app uses Supabase Auth and row-level security. Never put a Supabase service-role key in this app. Enable email confirmation and provider signup protections before enabling public signups. Run the updated schema to create version-history tables in an existing database.

## Deploy your own instance

Deploy to a Node.js-capable host such as Vercel, or run with Docker/Node. GitHub Pages cannot run the Next.js API routes. Set `ACCESS_CODE` to a random value of at least 20 characters for a private instance. For an intentionally public BYOK instance, set `ALLOW_PUBLIC=true`; **do not configure any provider API key on the server**. Public instances still consume hosting/function resources. The included per-process IP limiter is best effort and is not shared across serverless instances; add a trusted shared rate limiter or keep the service private. A shared access code is not a user-account system.

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build
```

GitHub Actions runs typecheck, tests, and a production build on pushes and pull requests. `npm audit` can be run locally to check the current dependency advisory database; results depend on registry connectivity and may change as advisories are published.

## Privacy and security

- Conversation contents and selected code are sent to the user-selected provider when the matching AI feature is used. ContextBridge API handlers do not intentionally store or log those contents or API keys.
- BYOK keys pass through the ContextBridge server before reaching the provider. Use localhost or a deployment whose operator and infrastructure you trust. Keys are held in page memory and cleared on reload.
- Secret redaction and ZIP filtering are best effort. Review before submission/export.
- Production security headers, request size caps, same-origin checks, and a best-effort in-memory rate limit are configured. A public production deployment needs shared rate limiting and operational monitoring.
- Prompt injection in imported chats or code cannot be fully prevented. Review generated state and evidence.
- Report vulnerabilities privately using the process in [SECURITY.md](SECURITY.md); do not post credentials or exploit details in public issues.

## Honest limits

- The product's differentiation must come from a trusted workflow, useful format, measured quality, and distribution; the code alone is not a moat.
- Handoff quality is not established. Included examples are synthetic and string-matched; there is no representative consented dataset or receiving-model outcome study.
- Exact quote checks confirm text matching, not semantic support. Chunk diffs surface field changes but cannot identify all omissions or distortions.
- Import parsing, source import links, token estimates for non-OpenAI models, and code shrinking are best effort. The extension sees rendered content only.
- Billing, subscriptions, team workspaces, and per-user hosted quotas are not implemented. Browser-local state is not backed up. MCP state is local and does not sync with the web app.
- No security review can prove software vulnerability-free. Re-run dependency audits and review deployment controls before launch.
