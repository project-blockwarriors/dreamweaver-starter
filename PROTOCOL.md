# Bot protocol: dreamweaver.v2

The game runs on Paper 1.21.4. Your process is not a Minecraft player client: it controls an arena entity through JSON lines. One complete observation is in `fixtures/observation.json`.

Each observation is `{"type":"observation","observation":{...}}`. It contains `protocol`, `ruleset`, `matchId`, `tick`, `duration`, `status`, `self`, `opponent`, `beacon`, `nodes`, `hazard`, and `blocks`.

- Bot fields: `seat`, `x`, `z`, `health`, `cargo`, `flux`, `score`, `wardUntil`, and a five-element `cooldowns` array in **ticks remaining**.
- `hazard`: `x` column, `warnUntil` and `activeUntil` as absolute ticks. A negative column means no hazard. It is active when `warnUntil <= tick < activeUntil`.
- `blocks`: temporary walls with `x`, `z` and absolute expiry `until`.
- `beacon` and each of the four `nodes`: grid coordinates `x`, `z`.

Respond with:

```json
{"type":"action","action":{"seq":1,"observedTick":20,"dx":1,"dz":0,"slot":2,"activate":true}}
```

`seq` must strictly increase. `observedTick` must refer to a recent observation (at most 20 ticks old). `dx`/`dz` are integers −1, 0 or 1. `slot` is 1–5. `activate` is a boolean. No other action fields are accepted. Malformed output, stale decisions and excess output can end or invalidate a run. Keep each output line under 16 KiB and all stdout under 6 MiB per match. Flush Python output (`flush=True`).

## Optional model requests

A Jev request:

```json
{"type":"model","provider":"jev","requestId":"tactic-20","state":{"cargo":2,"hazardSoon":true},"questions":{"tactic":{"type":"choice","instructions":"Protect cargo and score points.","criteria":{"dash":"Escape the imminent hazard","deposit":"Complete a safe delivery"}}}}
```

A Claude planner request:

```json
{"type":"model","provider":"claude","requestId":"plan-20","prompt":"Choose a short-term objective from this arena state: ..."}
```

Responses have `type: "model-response"`, the same `requestId`, `latencyMs`, and either `result` or `error`. `result` is the provider response: do not assume a common response shape or trust it to be a valid game action. The broker permits one in-flight call per bot, at most 360 Jev requests or 18 Claude requests per match, with timeouts of 750 ms/eight seconds respectively. Claude responses are capped at 256 output tokens. Jev requests are capped at 12 KB each and 2 MB total per seat per match. Jev supports named choice questions; the response has `result.answers.tactic.choice`, a pinned model ID and token usage. These are prototype limits, not promised event budgets.

Keep the observation loop running. Use the newest observation to validate a model's proposed action. Models may be unconfigured, throttled, slow or unavailable. Keep a deterministic policy active and log provider errors to stderr. A match can complete without any model call; success in the game does not establish a latency advantage for a particular model.

Ruleset 0.2 adds `respawnUntil`, `recoveryUntil`, `depositUntil` and `facingX`/`facingZ` to bots, `readyAt` to resource nodes, `multiplier`/`bonusAt`/`movesAt` and an announced `next` to the beacon, and `loot` entries with position, amount and expiry. Times are absolute ticks unless specified otherwise. Do not move during a deposit unless you intend to cancel it. A Weave activation aims in the selected direction without moving.
