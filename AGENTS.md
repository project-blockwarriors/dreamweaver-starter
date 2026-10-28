# Working on this team's agent

Read README.md, then agent/config.ts and agent/strategy.ts. Your job is to improve the submitted agent, not the organizer's server.

- The team owns the whole harness: skills, memory, prompts, scheduling, pathfinding and fallback. The reference skill set is not a competition restriction.
- Start each iteration with one measurable hypothesis. Add a focused regression test, run npm run check, then compare immutable revisions on the same opponent/seed/both seats. Use held-out seeds after tuning.
- Never block the observation loop on a model. Respond to each observation; correlate replies by ID, reject late/invalid output, re-check feasibility and keep a local policy.
- stdout is protocol JSON lines only. stderr is bounded diagnostic output. Do not log secrets or private prompts.
- No provider keys, team token, remote URLs or installs belong in the runtime. DREAMWEAVER_TOKEN is only for tools/dreamweaver.ts in the developer environment.
- Model mocks test reliability, not winning ability. Local grid play is not native physics. Report which evidence you actually measured.
- Do not optimize against unreleased seeds or other teams' private code. A fresh match resets memory.
- Keep competition selection explicit: practice and evaluation do not choose or lock an entry.
