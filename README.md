# Build an agent that wins Dream Relay

Your submission is a complete agent program: strategy, memory, prompts, model scheduling, movement and fallbacks. This template is a starting point, not a fixed set of behaviors. Add skills, replace the controller, or write your own architecture.

One bot plays against the house. Collect crystals, carry up to three, then bank at the shrine: 1/2/3 crystals score 10/20/35. Four flank sources give two crystals and refill 8 seconds after harvest. The north cache gives three, opens at 15 seconds, and refills 45 seconds after harvest. The bank is in the center. Banking takes 1.2 seconds of standing still. Damage earns no points. [Learn the game](https://mcpanel.blockwarriors.ai/dreamweaver/#Guide).

Before the first observation, the runner sends `{"type":"prepare","version":1,"nonce":"..."}`. Initialize your agent and reply `{"type":"ready","version":1,"nonce":"..."}` with the same nonce. Do not emit actions or model requests during preparation. The runner allows 20 seconds; the match clock starts only after acknowledgement. This proves the entrypoint has loaded, not that its strategy is good. Both starter runtimes include the handler and `npm run check` verifies it.

Existing saved versions are immutable: add the handler to older bots, push a new revision, import it and test it before selecting it. Older versions without the handler fail preparation; they are not silently started late. Game protocol v4 and ruleset 0.6 are unchanged; this is runner transport version 3. After acknowledgement, answer an initial `status: "idle"`, `tick: 0` observation with an opening action within three seconds. The arena stays frozen until both opening actions are ready, then applies them together. Do not wait for `running` to send your opening action. Model calls are rejected during preparation and become available when the clock starts.

## Choose your starting point

- **Small controller:** set `entrypoint` in `dreamweaver.json` to `simple.ts`. Edit its `decide(observation)` function. It uses an editable movement helper and no model. This is the shortest way to understand the loop.
- **Jev agent:** keep `bot.ts`. Start in `agent/strategy.ts` and `agent/config.ts`; expand into prompts, memory and scheduling as needed.
- **Your own harness:** point `entrypoint` at your program. Keep the readiness and JSON-lines contract. You may replace every strategy module; matching the starter's architecture is not required.

## Your first submission

1. Run `npm ci --ignore-scripts` and `npm run check`.
2. Change one decision, then check again.
3. Commit it. Run `npm run submission -- HEAD` to inspect the **committed** files without executing them. Uncommitted edits are not submitted.
4. Push the printed SHA or a tag that points to it, then import that revision in **My team → Bot → Add version**.
5. Run a practice match, open its replay, and inspect one mistake. Change the decision and repeat on the same conditions.
6. When satisfied, the captain clicks **Save entry** for that tested version. A push, import or practice result alone does not enter the competition.

The artifact is your whole repository snapshot: code, prompts, configuration, static data, manifest and lockfile. Provider keys and development tokens stay outside it. Runtime dependencies must be bundled into committed source; the server does not run `npm install` or build scripts. The packaging check is not a secret scanner or a substitute for hosted practice.

## Start

Use Node 24. No API keys, Minecraft installation or dependencies are needed for the local checks.

```sh
npm ci --ignore-scripts
npm run check
```

`dreamweaver.json` starts `bot.ts`. It reads observations and model responses from stdin and writes actions and model requests to stdout. Diagnostic decisions go to stderr. Every observation produces an action without waiting for inference.

## Make it yours

| File | What you own |
| --- | --- |
| `agent/config.ts` | Jev/scripted/hybrid mode, play style, budgets and timing |
| `agent/strategy.ts` | Skills, source valuation, defensive reactions and local fallback |
| `agent/memory.ts` | Match memory: progress, score changes, damage, previous skill |
| `agent/prompts.ts` | Information sent to Jev and the optional planner |
| `agent/models.ts` | Request scheduling, timeouts, response validation and budgets |
| `agent/harness.ts` | How those pieces decide the next action |
| `tactical.ts` | Reference pathfinding and five hotbar abilities; editable |
| `types.ts` | Observation and action fields |
| `tests/` | Delayed/error responses, plan validation, defense, resets and evaluation recovery |

The default banks after two crystals, matching one flank harvest. Set `bankAt: 3` to experiment with full loads. The endgame reflex reserves one second per return cell plus five seconds for the channel and delays; adjust it only after measuring native movement.

Start with a hypothesis: “bank two crystals when an attacker is nearby,” “race for the cache only when we arrive first,” or “intercept only if stolen cargo is worth the detour.” Add a test, change one module, and compare results. Skills can use any legal movement/ability action; you are not limited to the reference choices. The highest-valued current skill is the fallback when no valid model choice is available.

`agent/config.ts` defaults to `mode: 'scripted'` (no model calls). Use `scripted` to measure your code alone, or `hybrid` for a slow Claude planner alongside Jev. Commit this setting; hosted games do not receive your development shell variables. The planner chooses a short-lived goal, stance and banking threshold; Jev chooses a current skill; code handles danger and movement. Claude availability and model selection belong to the organizer. If either provider is unavailable, the local policy keeps playing.

Routes have a configurable two-second commitment to avoid model-driven oscillation; changed cargo, blocked progress, unavailable skills or immediate danger can interrupt it. Full cargo and a conservative endgame travel estimate trigger banking. Memory resets each match. Responses are matched to request IDs, expire by wall time and game ticks, and are revalidated against current skills. Plans cannot override immediate defense or stop the observation loop. Tests use fake model responses; they do not prove model quality.

## Submit and practice

Create a repository from this template, install the BlockWarriors GitHub App on it, then link it in [My team → Bot](https://mcpanel.blockwarriors.ai/dreamweaver/#Workspace). Push a tag or commit and import it with **Add version**. The imported code is immutable; later pushes do not change it.

For a coding agent, create a team agent token in the workspace and store it privately as `DREAMWEAVER_TOKEN`. It is a development credential, never part of the submitted agent.

```sh
node tools/dreamweaver.ts doctor
node tools/dreamweaver.ts link YOUR-TEAM/YOUR-BOT
node tools/dreamweaver.ts submit v1
node tools/dreamweaver.ts practice SUBMISSION_ID guardian 42 0
node tools/dreamweaver.ts inspect RUN_ID
node tools/dreamweaver.ts download RUN_ID replays/game.ndjson
npm run review -- replays/game.ndjson 0
```

Create the output directory first. Open the replay in Dream Relay → Open replay. Look at interrupted deliveries, lost cargo, idle routes and unused abilities. The replay reviewer prints timestamps for these moments. Hosted diagnostics contain bounded stderr and model outputs; they are not a full debug transcript.

## Compare revisions

`evaluation.json` defines opponents and seeds; every case runs both seats. The default uses six hosted games and consumes your team's practice/model allowance. It never selects a competition entry.

```sh
node tools/dreamweaver.ts evaluate SUBMISSION_ID results/v1.json
# Run the same command again to collect a result or queue the next case.
# It resumes from disk, queues one game at a time, and never waits in a polling loop.
node tools/dreamweaver.ts evaluate NEW_SUBMISSION_ID results/v2.json
node tools/dreamweaver.ts compare results/v1.json results/v2.json
```

Create `results/` first. Keep the same matrix for both revisions. A failed game is an error to inspect, not a scored loss. Keep result files when retrying: their saved idempotency keys prevent duplicate games after a network failure. After an interrupted CLI process, remove a leftover `.lock` only after confirming that process has exited. Never edit run IDs to make a comparison pass.

Tune on seed 42, then use seeds you have not tuned against and all five house styles. A better average across matched trials is useful evidence; one win is not. Local checks do not simulate native physics or real model latency. The [contributor guide](https://github.com/project-blockwarriors/blockwarriors-dreamweaver-cmd/blob/main/docs/contributing.md#bot-and-game-iteration) also explains the optional Java grid simulator.

After a successful hosted test, the captain selects the exact revision in **Bot → Competition entry**. Qualifiers and finals lock separately. Pushing a tag or finishing an evaluation does not select your entry.

## Runtime limits

Node 24 standard library or prebundled code; no package install during a game. Python 3.12 is also supported by the platform. The sandbox has no network, provider keys, team token or access to other teams. Include prompts, modules and static data in the repository. Writable scratch space is temporary; learning does not persist between official matches.

Model requests use the organizer's broker. Jev supports up to 12 choices per question; the example offers the 12 highest-valued feasible skills. Prototype limits: 360 Jev calls, 18 Claude calls, 12 KB per request, 2 MB total Jev input per match, with additional team/event allowances. This harness uses lower configurable caps. Jev's provider deadline is 750 ms; Claude's is 8 seconds. One in-flight request per provider is supported. Do not expect an arbitrary provider URL or model name to be honored.

Actions are cardinal movement plus hotbar slots 1–5. `seq` increases and `observedTick` identifies the observation; actions older than 20 ticks expire. The arena enforces costs, damage and scoring. Read [the full rules](https://github.com/project-blockwarriors/blockwarriors-dreamweaver-cmd/blob/main/docs/strategy-lab.md) before changing movement or timing.

For a minimal Python transport example, copy `python/bot.py`, `python/dreamweaver.json` and the empty `python/requirements.txt` to the root. The modular harness and its strategy tests are TypeScript; port or replace those modules if you choose Python. The protocol smoke check supports either runtime.
