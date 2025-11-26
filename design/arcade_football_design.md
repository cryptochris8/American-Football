# Arcade Football – Tecmo-Style Mini Game (Hytopia)

## High-Level Concept

A 5-on-5 or 7-on-7 arcade American football mode inspired by Tecmo Bowl:
- Short field (about 60 yards).
- Simple playbook (3–4 pass plays, 2–3 run plays).
- One drive at a time; score touchdowns or field goals.
- Over-the-top, readable, fast-paced.

The existing QB Target Throw mode is reused as a "QB Drill" accessible
from this stadium world (e.g., from a practice area or menu).

## Core Flow

1. Player selects "Arcade Football" from your main hub / lobby.
2. Player chooses:
   - Quick Game
   - Practice (launches QB Target Throw scene)
3. In Quick Game:
   - Coin flip / random who receives first.
   - Offense starts on its own 20–30 yard line.
   - Player selects a play from a small playbook UI.
   - Ball is snapped, and play runs in a side/top-down view.
   - End of down: update yard line, down & distance.
   - Score when crossing goal line; extra points optional.
   - First to a target score (e.g., 21) or time limit wins.

## Camera

Recommendation: Slightly elevated sideways or 3/4 top-down camera
similar to Tecmo Bowl, fixed on the ball carrier.

## Key Systems

- PlayCallSystem
  - Allows player to pick from 3–6 plays.

- SnapSystem
  - Handles snapping the ball, giving control to QB or RB.

- RouteSystem
  - Moves receivers along predefined routes using simple
    position keyframes or waypoints.

- DefenseAISystem
  - Simple zone + man-coverage behavior.
  - Pursuit of ball carrier when ball is thrown or handed off.

- BallCarrySystem
  - Tracks who has the ball (QB/RB/WR).
  - Allows limited movement input to evade defenders.

- TackleSystem
  - Collision-based tackling: when defender hits ball carrier,
    play is blown dead at that position.

- DownAndDistanceSystem
  - Tracks:
    - currentDown (1–4)
    - yardsToFirstDown
    - ballYardLine
  - Determines turnovers and new sets of downs.

- ScoringSystem
  - Touchdown (6 pts)
  - Extra point or two-point conversion (optional)
  - Field goal (optional)

## Reuse of QB Target Throw

- The QB Target Throw mode exists as a separate scene:
  - Used as a minigame accessible from:
    - Main hub
    - Practice mode entry inside the stadium
  - Shares core assets:
    - QB model
    - Football projectile
    - UI & scoring hooks
  - Can award XP/currency usable in Arcade Football (cosmetics, stadium skins, etc).

## Files Added in This Expansion

- `config/arcade_football_entities.json`
- `config/arcade_football_systems.json`
- `config/arcade_football_playbook.json`
- `src/systems/ArcadeFootballCoreSystems.ts`
- `src/systems/PlayCallSystem.ts`
- `src/systems/RouteSystem.ts`
- `src/systems/DefenseAISystem.ts`
- `src/systems/SnapSystem.ts`
- `src/systems/BallCarrySystem.ts`
- `src/systems/TackleSystem.ts`
- `src/systems/DownAndDistanceSystem.ts`
- `src/systems/ScoringSystem.ts`

Claude Code should:
1. Map these skeleton configs into your ECS types.
2. Fill out the TODOs with actual Hytopia API usage.
3. Wire an "Arcade Football" menu entry that loads this mode and links to the QB Drill.
