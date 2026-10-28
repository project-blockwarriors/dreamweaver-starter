# Bot protocol

Active native game: `dreamweaver.v4`, `dream-relay.0.5-strategy-preview`. The organizer sends JSON-lines `observation` messages on stdin. Reply with `{"type":"action","action":{"seq":1,"observedTick":20,"dx":0,"dz":1,"slot":1,"activate":false}}` on stdout. Sequence numbers increase; observations older than 20 ticks are rejected. Movement is cardinal and actions use hotbar slots 1–5. Minecraft remains authoritative.

The same stream carries asynchronous `model` requests and `model-response` results. Do not block observations waiting for inference, and use a local fallback on errors or stale replies. No network or organization credentials are available inside the hosted sandbox. See the [full contract](https://github.com/project-blockwarriors/blockwarriors-dreamweaver-cmd/blob/main/packages/contracts/index.ts) and [Jev policy](https://github.com/project-blockwarriors/dreamweaver-jev-starter) for examples.
