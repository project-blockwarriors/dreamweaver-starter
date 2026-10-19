# Building a Dreamweaver bot

- Read observations from stdin as JSON lines. Emit `{ "type": "action", "action": ... }` on stdout. Diagnostics go to stderr.
- Preserve `seq` (increasing) and `observedTick`. Actions older than 20 game ticks expire.
- Choose movement dx/dz in -1..1, slot 1..5 and activate boolean. Cardinal movement only; when both axes are set x wins.
- Keep processing observations during slow model requests. Emit `{ "type":"model", "requestId":"...", "state": ..., "questions": ... }` to the broker. Responses arrive as `model-response`; handle errors without stopping.
- Never require organizer credentials. Sandbox networking is disabled. Prototype: Node 24 standard library or Python 3.12 standard library; prebundle other code. No install scripts run.
- One bot per team. Make strategy, pathfinding and memory your own. Do not attempt to access host files or other teams.
- Commit the manifest and lockfile. A submission tag is resolved to an immutable source archive before competition lock.
