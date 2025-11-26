# QB Target Throw – Game Design Doc (Hytopia / Claude Code)

## High-Level Concept

Arcade-style American football mini-game where the player is a quarterback
throwing footballs at targets downfield within a time limit. Think NFL QB
challenge meets Tecmo Bowl vibe: simple, fast, and addictive.

- Perspective: Third-person behind the QB.
- Mode: Single-player (can later add leaderboards / multiplayer lobbies).
- Session length: 60–90 seconds per run.

## Core Loop

1. Player spawns as QB at fixed spot on a shortened football field.
2. A countdown begins (e.g. 60 seconds).
3. Targets appear at various lanes/depths and may move sideways.
4. Player aims and charges throw power, then releases to throw a football.
5. If the ball hits a target, award points (more for deeper / moving / bonus targets).
6. Maintain a score multiplier for consecutive hits.
7. When time expires, show final score + stats (hits, misses, accuracy, best streak).

## Controls (Suggested)

Keyboard / Mouse:

- Move aim: Mouse X/Y moves crosshair.
- Optional lane controls:
  - A / D: Switch aim lane (left / mid / right).
  - W / S: Switch depth band (short / medium / deep).
- Throw:
  - Hold SPACE to charge throw (power bar fills from 0 to 1).
  - Release SPACE to throw. Power affects speed and arc height.

## Difficulty & Scoring

Target types and scoring:

- Basic Target (stationary)
  - Short: 50 pts
  - Medium: 75 pts
  - Deep: 100 pts

- Moving Target
  - Short: 100 pts
  - Medium: 150 pts
  - Deep: 200 pts

- Bonus Target
  - Short: 150 pts
  - Medium: 225 pts
  - Deep: 300 pts

Multiplier:

- Start at x1.0.
- Every successful hit without a miss increases multiplier by +0.1 up to x3.0.
- A miss or time-out resets multiplier to x1.0.

## Field Layout

- QB at origin: (0, 0, 0).
- Field extends forward on +Z axis.
- Lanes (X): -4 (left), 0 (mid), 4 (right).
- Depth bands (Z): 10 (short), 20 (medium), 30–35 (deep).
- Targets sit around Y ≈ 1.5–2 units.

## Entities Overview

- player_qb
- football_projectile
- target_basic / target_moving / target_bonus
- field_root
- game_controller
- ui_canvas_qb_throw

## Systems Overview

- InputAimSystem
- ThrowChargeSystem
- ThrowSpawnBallSystem
- BallPhysicsSystem
- BallTargetCollisionSystem
- ScoreAndComboSystem
- TargetSpawnSystem
- TargetMovementSystem
- TargetLifetimeSystem
- RoundTimerSystem
- UIHudUpdateSystem
- RoundStateInitSystem

Plus:

- QBTutorialSystem (tutorial prompts).
- ProgressionSystem (XP/levels, unlocks).
- LeaderboardService (local or backend-linked high scores).
