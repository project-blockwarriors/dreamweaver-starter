# Dreamweaver competitor starter

Build one Minecraft arena bot with your team. Write the strategy yourself, use a coding agent, or combine both. This repository includes a working Node.js courier, a Python alternative, a protocol check, and the submission CLI.

**Prototype:** the rules and runtime limits are being tested for Spring 2027. Dates, eligibility, travel and prizes are not final. [Open the competition workspace](https://mcpanel.blockwarriors.ai/dreamweaver/#Workspace).

For an asynchronous Jev policy with pathfinding and fallback, use the [Jev starter template](https://github.com/project-blockwarriors/dreamweaver-jev-starter).

## Start a bot

Choose **Use this template → Create a new repository**. Keep your competition repository private. A team has one bot and up to four students.

Use Node 24 and run:

```sh
npm ci
npm run check
```

Edit `bot.mjs`. It reads JSON observations from stdin and writes actions to stdout. Log diagnostics to stderr. The starter collects a crystal and heads for the beacon; it is deliberately simple and does not plan around walls or opponents.

For Python 3.12, copy `python/bot.py`, `python/dreamweaver.json`, and `python/requirements.txt` to the repository root. The same `npm run check` command will launch Python. The Node CLI is a development tool, not part of the submitted bot process.

The local check validates protocol output for three observations. It is **not a Minecraft simulator**. Use a practice match to check actual movement, cooldowns, and sandbox behavior.

## Submit and playtest

1. Sign in with GitHub in the workspace and create or join a team.
2. Install the Dreamweaver GitHub App on **only your bot repository**. Link `owner/repository` in the workspace. The App requests read-only repository contents; linking requires your GitHub account to have write access.
3. Commit your bot, `dreamweaver.json`, and lock file. Tag and push the revision:

   ```sh
   git add .
   git commit -m "Add courier strategy"
   git tag submission-v1
   git push origin HEAD submission-v1
   ```

4. Import `submission-v1` in the workspace. Importing resolves the tag to a commit SHA and archives its source. Moving the tag later does not change that revision. **Pushing a tag alone does not submit it.**
5. Request a playtest. Read the result, watch its replay, then import another tag when you improve the bot. A queued run is not a successful validation.
6. Select one revision for qualifiers. You may change the selection before the deadline. Finalists get an improvement window and a separate finals selection and lock.

GitHub sign-in is available when the organizer has completed App registration. If execution is paused, practice jobs wait for an enabled worker instead of claiming success.

## Work through your coding agent

Create an agent token in the workspace and place it in your development environment as `DREAMWEAVER_TOKEN`. Do not commit it, paste it into your bot, or put it in `dreamweaver.json`. It expires with your sign-in (at most eight hours). Creating a new token revokes the old one.

```sh
node tools/dreamweaver.ts doctor
node tools/dreamweaver.ts link your-team/your-bot
node tools/dreamweaver.ts submit submission-v1
node tools/dreamweaver.ts practice SUBMISSION_ID
node tools/dreamweaver.ts status
node tools/dreamweaver.ts select SUBMISSION_ID qualifier
node tools/dreamweaver.ts replay downloaded-replay.ndjson
```

The token can submit and playtest for your team. It cannot manage game infrastructure or organizer operations. See [AGENTS.md](AGENTS.md) for the brief to give your coding agent.

## Game: Dream Relay

Each match lasts 180 seconds (3,600 server ticks). Your bot moves on a 25 × 25 grid, with coordinates 0–24. One move is allowed every four ticks. Movement is cardinal; x takes precedence if both axes are nonzero.

| Slot | Ability | Effect |
| --- | --- | --- |
| 1 | Harvest / deliver | Collect within one cell of a source, or channel for 0.6 seconds at the beacon. Carry up to three crystals. |
| 2 | Dash | Move up to three extra cells in the chosen direction; three-second cooldown. |
| 3 | Ward | Spend one flux for a one-second shield; two-second cooldown. |
| 4 | Weave | Spend one flux to place a five-second barrier in the adjacent cell; one-second cooldown. |
| 5 | Disrupt | Damage, interrupt and push an unshielded opponent within three cells; three-second cooldown. |

Deliveries score **10 points per crystal**, or **15** during the last six seconds of each beacon phase. Damage or movement interrupts a deposit; passive camping does not block it. Eliminations have no point reward. A bot has three health; on defeat it drops its cargo and respawns at its entry. Crystal collection restores flux up to six.

The beacon moves every 20 seconds, with its next position announced five seconds in advance. Hazard columns are announced 0.8 seconds before they become active. Woven barriers block Disrupt line of sight. Dropped cargo can be recovered by either bot. Legal building, collisions and cooldowns are checked by the server. A separate eight-tick ability gate prevents rapid switching from bypassing activation timing. The observation includes the opponent's position and state.

## Protocol and limits

Read [PROTOCOL.md](PROTOCOL.md) and `fixtures/observation.json`. The prototype runtime accepts standard-library or prebundled code; it does not install dependencies. There is no internet, Docker socket, provider credential or panel token inside the bot process. Limits: 256 MiB RAM, 0.5 CPU, 64 processes, 64 MiB temporary storage; read-only root and source archive. Source archive limit: 20 MiB. Symlinks and submodules are rejected. Practice limits are currently 12 requests per hour and one active run per team.

Jev/System One is encouraged; an LLM planner is optional. Request models through the broker protocol, keep responding while a model is working, and have a deterministic fallback for unavailable providers. Model keys are configured by the organizer, never submitted by a team. Provider availability and budgets are provisional.

## Competition format

The working schedule is April 23–25, 2027, Eastern time. Friday 10 am: opening. Saturday 10 am: qualifier lock. Sunday 10 am: finals lock. Qualifiers use four common hidden scenarios from both sides, against the same house opponent. Top 16 advance; finals are best-of-three, with a best-of-five championship. Ties and failed matches require organizer review.

The in-person Princeton finals and travel arrangements are still being planned. Wait for the published event rules before booking travel.
