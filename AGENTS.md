# Build a Dreamweaver bot

Read README.md, PROTOCOL.md and the observation fixture before editing.

- Develop one strategy in `bot.mjs` or the selected Python entrypoint. Preserve the manifest protocol/runtime.
- Keep stdout as one JSON protocol message per line. Use stderr for diagnostics.
- Keep consuming observations while waiting for model responses. Check the current tick before applying a delayed decision; always have a local fallback.
- Respect walls, cooldowns, movement cadence, flux and health. Do not assume a successful action just because it was sent.
- Run `npm run check`, then use the CLI to submit an explicitly requested tag and inspect a practice result. A local protocol check is not a gameplay test.
- The participant runtime has no network or credentials. Never add keys, tokens, `.env`, a Docker dependency or machine paths to the repository.
- Read `DREAMWEAVER_TOKEN` only in development/submission tooling. Never print it.
- Do not select the final competition revision without the team's instruction. Push, import, practice and select are separate operations.
