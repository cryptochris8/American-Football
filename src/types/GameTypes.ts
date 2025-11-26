/**
 * QB Target Throw Game Types
 * Core type definitions for the football throwing mini-game
 */

import type { Entity, Player } from 'hytopia';

// Game States
export enum GameState {
  WAITING = 'waiting',      // Waiting for player to start
  COUNTDOWN = 'countdown',  // 3-2-1 countdown
  PLAYING = 'playing',      // Active gameplay
  ROUND_END = 'round_end',  // Round finished, showing results
  GAME_OVER = 'game_over'   // Game completely over
}

// Target Types
export enum TargetType {
  BASIC = 'basic',          // Standard stationary target (100 pts)
  MOVING = 'moving',        // Moves horizontally (150 pts)
  BONUS = 'bonus'           // Time-limited high value (300 pts)
}

// Target Depth/Distance zones
export enum TargetDepth {
  SHORT = 'short',          // z ~10, easiest
  MEDIUM = 'medium',        // z ~20, moderate
  DEEP = 'deep'             // z ~30-35, hardest (bonus multiplier)
}

// Lane positions for target spawning
export enum TargetLane {
  LEFT = -6,
  CENTER_LEFT = -3,
  CENTER = 0,
  CENTER_RIGHT = 3,
  RIGHT = 6
}

// Target configuration
export interface TargetConfig {
  type: TargetType;
  depth: TargetDepth;
  lane: TargetLane;
  points: number;
  lifetime?: number;        // For bonus targets (seconds)
  moveSpeed?: number;       // For moving targets
  moveRange?: number;       // Horizontal movement range
}

// Target instance data
export interface TargetData {
  id: string;
  entity: Entity;
  config: TargetConfig;
  spawnTime: number;
  isHit: boolean;
  moveDirection?: number;   // 1 or -1 for moving targets
  initialX?: number;        // Starting X position for movement
}

// Football projectile data
export interface FootballData {
  id: string;
  entity: Entity;
  spawnTime: number;
  thrownBy: Player;
  initialVelocity: { x: number; y: number; z: number };
}

// Player game state (per-player)
export interface PlayerGameState {
  player: Player;
  playerEntity: Entity;
  score: number;
  combo: number;
  maxCombo: number;
  totalThrows: number;
  successfulHits: number;
  isCharging: boolean;
  chargeStartTime: number;
  chargePower: number;      // 0-1 normalized
  lastThrowTime: number;
  tutorialStep: number;     // For tutorial progression
  hasCompletedTutorial: boolean;
}

// Global game state
export interface GameStateData {
  state: GameState;
  roundNumber: number;
  timeRemaining: number;    // Seconds
  roundDuration: number;    // Total round time in seconds
  countdownTime: number;    // Countdown remaining
  activeBalls: Map<string, FootballData>;
  activeTargets: Map<string, TargetData>;
  playerStates: Map<string, PlayerGameState>;
  targetSpawnTimer: number;
  nextTargetSpawnTime: number;
  difficultyLevel: number;  // Increases over time/rounds
}

// Spawn wave configuration
export interface SpawnWave {
  time: number;             // When to spawn (seconds into round)
  targets: TargetConfig[];
}

// Round configuration
export interface RoundConfig {
  roundNumber: number;
  duration: number;
  waves: SpawnWave[];
  bonusTargetChance: number;
  movingTargetChance: number;
  baseSpawnInterval: number;
}

// Scoring configuration
export interface ScoringConfig {
  basePoints: {
    [TargetType.BASIC]: number;
    [TargetType.MOVING]: number;
    [TargetType.BONUS]: number;
  };
  depthMultiplier: {
    [TargetDepth.SHORT]: number;
    [TargetDepth.MEDIUM]: number;
    [TargetDepth.DEEP]: number;
  };
  comboMultiplierStep: number;  // How much each combo adds
  maxComboMultiplier: number;
  accuracyBonusThreshold: number;  // % accuracy for bonus
  accuracyBonusPoints: number;
}

// Throw physics configuration
export interface ThrowConfig {
  minPower: number;
  maxPower: number;
  chargeRate: number;       // Power gained per second
  gravity: number;
  ballLifetime: number;     // Seconds before ball despawns
  throwCooldown: number;    // Minimum time between throws
}

// UI Data sent to client
export interface UIUpdateData {
  type: 'game_update';
  state: GameState;
  score: number;
  combo: number;
  timeRemaining: number;
  chargePower: number;
  accuracy: number;
  roundNumber: number;
  tutorialMessage?: string;
}

// Leaderboard entry
export interface LeaderboardEntry {
  playerName: string;
  score: number;
  accuracy: number;
  maxCombo: number;
  timestamp: number;
}

// Game events
export enum GameEvent {
  ROUND_START = 'round_start',
  ROUND_END = 'round_end',
  TARGET_HIT = 'target_hit',
  TARGET_MISSED = 'target_missed',
  THROW_START = 'throw_start',
  THROW_RELEASE = 'throw_release',
  COMBO_BREAK = 'combo_break',
  BONUS_TARGET_SPAWN = 'bonus_target_spawn',
  PERFECT_ACCURACY = 'perfect_accuracy'
}
