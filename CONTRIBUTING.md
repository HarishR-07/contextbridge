# Contributing

Contributions are welcome. ContextBridge is an open-source project for reducing lost context between AI chats and coding sessions. If that problem matters to you, help us make imports, handoffs, evidence, and exports more dependable.

## Good places to contribute

- Improve ChatGPT, Claude, or Gemini export importers and add small synthetic fixtures.
- Improve provenance, snapshot editing, long-chat drift checks, and handoff evaluation.
- Improve accessibility, browser-extension support, provider compatibility, and setup documentation.
- Report confusing behavior or propose a focused feature in a GitHub issue before starting a large change.

## Before opening a pull request

1. Keep API keys, access codes, chat exports, and private project data out of commits and test fixtures.
2. Make changes focused and document user-visible behavior or privacy changes.
3. Run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`.
4. Include regression coverage for bug fixes when practical.
5. Keep pull requests focused and explain the user problem, behavior change, and any privacy or security impact.

## Development steps

1. Fork the repository and create a branch for your change.
2. Install dependencies with `npm ci`.
3. Make the change and update docs when user-visible behavior changes.
4. Run `npm run typecheck`, `npm test`, and `npm run build`.
5. Open a pull request against `main` and describe how you verified it.

Use pull requests for changes. For security issues, follow [SECURITY.md](SECURITY.md) rather than posting exploit details publicly.
