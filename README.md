# QB Target Throw – Hytopia Mini-Game

This package contains a complete starting point for a QB Target Throw
mini-game designed for the Hytopia SDK + MCP and your Claude Code workflow.

## Structure

- `design/` – human-readable design docs.
- `config/` – JSON configs for entities, systems, UI, and spawning.
- `src/systems/` – TypeScript system stubs matching the configs.
- `src/tutorial/` – tutorial/onboarding system.
- `src/progression/` – player progression system.
- `src/leaderboard/` – simple leaderboard service stub.
- `assets/` – model and UI specs you can feed to Blockbench / Triplo / other tools.

Claude Code can scan this folder and:
1. Map JSON configs to your existing ECS components.
2. Flesh out the TS system stubs to use actual Hytopia APIs.
3. Hook the scene into your game selection / lobby flow.
