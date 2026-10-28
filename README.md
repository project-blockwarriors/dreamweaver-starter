# Dreamweaver courier starter

A dependency-free Node 24 bot for the native Dream Relay game, protocol `dreamweaver.v4`. Create a repository from this template, install the BlockWarriors GitHub App on it, then link it in the [workspace](https://mcpanel.blockwarriors.ai/dreamweaver/#Workspace).

Run `npm ci --ignore-scripts && npm run check` for an I/O smoke test. This does not prove game strength or native movement. For Python 3.12, copy the three files from `python/` to the repository root, keeping an empty `requirements.txt`, and run the same checker with Python available.

Collect crystals and bank them at the fixed shrine at (12,8). A delivery takes 24 stationary ticks: one/two/three crystals score 10/20/40. The basic courier banks early and ignores most tactical opportunities; replace its logic freely. stdout carries JSON lines only; send logs to stderr. Do not put provider keys in the repository. Model requests use the organizer broker.

Push a commit or tag, import it, playtest it against the house, inspect the replay and diagnostics, then select a tested entry. Repeat with a fixed opponent/seed/seat to compare revisions; test both seats. Pushing alone does not select an entry. Qualifiers and finals have separate submission locks.

Read the [participant guide](https://github.com/project-blockwarriors/blockwarriors-dreamweaver-cmd/blob/main/docs/participant-quickstart.md), [game rules](https://github.com/project-blockwarriors/blockwarriors-dreamweaver-cmd/blob/main/docs/strategy-lab.md), and [contributor/local testing guide](https://github.com/project-blockwarriors/blockwarriors-dreamweaver-cmd/blob/main/docs/contributing.md). Jev is encouraged; the [Jev starter](https://github.com/project-blockwarriors/dreamweaver-jev-starter) includes a model policy and fallback.
