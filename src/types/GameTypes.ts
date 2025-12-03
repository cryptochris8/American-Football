/**
 * QB Target Throw Game Types
 * Core type definitions for the football throwing mini-game
 * Updated for Megatouch QB Zone-style gameplay
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

// Target Types (legacy - kept for compatibility)
export enum TargetType {
  BASIC = 'basic',          // Standard stationary target (100 pts)
  MOVING = 'moving',        // Moves horizontally (150 pts)
  BONUS = 'bonus'           // Time-limited high value (300 pts)
}

// Receiver Types (Megatouch QB Zone style)
export enum ReceiverType {
  BASIC = 'basic',          // Standard receiver - 75/125/175 pts by depth
  FAST = 'fast',            // Smaller, faster receiver - 100/175/250 pts
  BONUS = 'bonus'           // Brief high-value receiver - 150/225/325 pts
}

// Defender Types
export enum DefenderType {
  STANDARD = 'standard'     // Standard blocking defender
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
  hasHitGround: boolean; // Once true, ball can no longer score
  spiralAngle: number; // Current spiral rotation angle (radians)
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
  notification?: {
    message: string;
    type: 'positive' | 'negative' | 'bonus';
    points?: number;
  };
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
  PERFECT_ACCURACY = 'perfect_accuracy',
  DEFENDER_BLOCK = 'defender_block',
  RECEIVER_HIT = 'receiver_hit'
}

// ============================================
// Megatouch QB Zone-style Types
// ============================================

// Lane movement component for horizontal sweeping
export interface LaneMovement {
  speed: number;          // Movement speed (units/second)
  minX: number;           // Left boundary
  maxX: number;           // Right boundary
  direction: 1 | -1;      // Current direction (1 = right, -1 = left)
}

// Receiver configuration from JSON
export interface ReceiverConfig {
  archetypeId: string;    // receiver_basic, receiver_fast, receiver_bonus
  weight: number;         // Spawn weight (0-1)
  allowedDepthsZ: [number, number]; // [min, max] Z position range
}

// Defender configuration from JSON
export interface DefenderConfig {
  archetypeId: string;    // defender_obstacle
  weight: number;         // Spawn weight (0-1)
  allowedDepthsZ: [number, number]; // [min, max] Z position range
}

// Wave configuration for spawning
export interface WaveConfig {
  waveIndex: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  receiverSpawnIntervalSeconds: number;
  defenderSpawnIntervalSeconds: number;
  receivers: ReceiverConfig[];
  defenders: DefenderConfig[];
}

// Spawn configuration from JSON
export interface SpawnConfig {
  id: string;
  description: string;
  roundDurationSeconds: number;
  lanesX: number[];       // X positions for lanes [-4, -2, 0, 2, 4]
  waves: WaveConfig[];
}

// Receiver archetype definition
export interface ReceiverArchetype {
  id: string;
  receiverType: ReceiverType;
  basePointsShort: number;
  basePointsMedium: number;
  basePointsDeep: number;
  depthShortMaxZ: number;
  depthMediumMaxZ: number;
  modelUri?: string;           // Optional 3D model
  blockTextureUri?: string;    // Optional block texture (simpler)
  modelScale: number;
  collisionHalfExtents: { x: number; y: number; z: number };
  laneMovement: LaneMovement;
  lifetime?: number;      // For bonus receivers
}

// Defender archetype definition
export interface DefenderArchetype {
  id: string;
  defenderType: DefenderType;
  blockWeight: number;    // How much this blocks
  modelUri?: string;           // Optional 3D model
  blockTextureUri?: string;    // Optional block texture (simpler)
  modelScale: number;
  collisionHalfExtents: { x: number; y: number; z: number };
  laneMovement: LaneMovement;
}

// Active receiver instance
export interface ReceiverData {
  id: string;
  entity: Entity;
  archetype: ReceiverArchetype;
  spawnTime: number;
  isHit: boolean;
  laneMovement: LaneMovement;
  depthZ: number;         // Z position (depth into field)
  initialX: number;       // Starting X for boundary calculation
}

// Active defender instance
export interface DefenderData {
  id: string;
  entity: Entity;
  archetype: DefenderArchetype;
  spawnTime: number;
  laneMovement: LaneMovement;
  depthZ: number;
  initialX: number;
}

// Extended game state for Megatouch QB Zone mode
export interface MegatouchGameState {
  // Core state
  state: GameState;
  roundDurationSeconds: number;
  timeRemainingSeconds: number;

  // Scoring
  score: number;
  multiplier: number;
  multiplierMax: number;
  multiplierStep: number;

  // Streaks
  currentStreak: number;
  bestStreak: number;

  // Stats
  totalThrows: number;
  successfulHits: number;
  blockedThrows: number;

  // Wave control
  currentWaveIndex: number;
  waveStartTime: number;
  lastReceiverSpawnTime: number;
  lastDefenderSpawnTime: number;

  // Active entities
  activeReceivers: Map<string, ReceiverData>;
  activeDefenders: Map<string, DefenderData>;
  activeBalls: Map<string, FootballData>;

  // Lane configuration
  lanesX: number[];

  // Player state
  playerStates: Map<string, PlayerGameState>;
}
