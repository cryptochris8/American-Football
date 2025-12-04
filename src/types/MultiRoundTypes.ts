/**
 * Multi-Round Game Types
 * Types for the multi-round football mini-game system
 */

import type { Entity, Player } from 'hytopia';

// ============================================
// Game Round Types
// ============================================

export enum GameRound {
  QB_TARGET_THROW = 1,     // Original target throwing
  RECEIVER_RUN = 2,        // Players throw to AI receivers running routes
  QB_ACCURACY_GAUNTLET = 3, // Multiple targets, hit as many as possible
  FIELD_GOAL_FRENZY = 4,   // Kick field goals
  HAIL_MARY = 5,           // Long bomb to moving receiver
  BARNYARD_BLITZ = 6,      // Farm animals as targets
}

export enum MultiRoundGameState {
  LOBBY = 'lobby',                  // Waiting for players
  ROUND_INTRO = 'round_intro',      // Showing round info
  COUNTDOWN = 'countdown',          // 3-2-1 countdown
  PLAYING = 'playing',              // Active gameplay
  ROUND_RESULTS = 'round_results',  // Showing round scores
  GAME_OVER = 'game_over',          // Final leaderboard
}

// ============================================
// Player Score Types
// ============================================

export interface PlayerRoundScore {
  playerId: string;
  playerName: string;
  roundScores: Map<GameRound, number>;  // Score per round
  totalScore: number;
  roundsWon: number;
  stats: PlayerGameStats;
}

export interface PlayerGameStats {
  totalThrows: number;
  successfulHits: number;
  accuracy: number;
  longestStreak: number;
  touchdowns: number;
  fieldGoals: number;
  yardsGained: number;
  catchesMade: number;
  tacklesAvoided: number;
}

// ============================================
// Leaderboard Types
// ============================================

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  score: number;
  isCurrentPlayer: boolean;
}

export interface RoundLeaderboard {
  round: GameRound;
  entries: LeaderboardEntry[];
}

export interface GameLeaderboard {
  entries: LeaderboardEntry[];
  roundWinners: Map<GameRound, string>;  // Round -> playerName
}

// ============================================
// Round Configuration Types
// ============================================

export interface RoundConfig {
  round: GameRound;
  name: string;
  description: string;
  duration: number;  // Seconds
  minPlayers: number;
  maxPlayers: number;
  scoreMultiplier: number;  // Bonus for this round's points
}

export const ROUND_CONFIGS: Record<GameRound, RoundConfig> = {
  [GameRound.QB_TARGET_THROW]: {
    round: GameRound.QB_TARGET_THROW,
    name: 'QB Target Throw',
    description: 'Throw footballs at moving targets! Build combos for bonus points.',
    duration: 60,
    minPlayers: 1,
    maxPlayers: 8,
    scoreMultiplier: 1.0,
  },
  [GameRound.RECEIVER_RUN]: {
    round: GameRound.RECEIVER_RUN,
    name: 'Receiver Run',
    description: 'Run routes and catch passes from the AI quarterback!',
    duration: 45,
    minPlayers: 1,
    maxPlayers: 8,
    scoreMultiplier: 1.2,
  },
  [GameRound.QB_ACCURACY_GAUNTLET]: {
    round: GameRound.QB_ACCURACY_GAUNTLET,
    name: 'QB Accuracy Gauntlet',
    description: 'Multiple targets appear - hit as many as you can! Combos for speed!',
    duration: 60,
    minPlayers: 1,
    maxPlayers: 8,
    scoreMultiplier: 1.5,
  },
  [GameRound.FIELD_GOAL_FRENZY]: {
    round: GameRound.FIELD_GOAL_FRENZY,
    name: 'Field Goal Frenzy',
    description: 'Kick field goals from increasing distances! Watch the wind!',
    duration: 60,
    minPlayers: 1,
    maxPlayers: 8,
    scoreMultiplier: 1.3,
  },
  [GameRound.HAIL_MARY]: {
    round: GameRound.HAIL_MARY,
    name: 'Hail Mary',
    description: 'One shot, one chance! Throw the perfect deep ball to win!',
    duration: 30,
    minPlayers: 1,
    maxPlayers: 8,
    scoreMultiplier: 2.0,
  },
  [GameRound.BARNYARD_BLITZ]: {
    round: GameRound.BARNYARD_BLITZ,
    name: 'Barnyard Blitz',
    description: 'Round up the escaped farm animals! Hit cows, pigs, chickens, and rabbits. Watch out for the dog!',
    duration: 60,
    minPlayers: 1,
    maxPlayers: 8,
    scoreMultiplier: 1.2,
  },
};

// ============================================
// Multi-Round Game State
// ============================================

export interface MultiRoundState {
  // Game state
  gameState: MultiRoundGameState;
  currentRound: GameRound;
  roundNumber: number;  // 1-indexed (which time through the rounds)
  totalRounds: number;  // Total number of rounds to play

  // Timing
  timeRemainingSeconds: number;
  roundStartTime: number;
  countdownTime: number;

  // Players
  playerScores: Map<string, PlayerRoundScore>;
  activePlayers: Set<string>;

  // Round-specific state
  roundState: RoundSpecificState;

  // Game settings
  roundOrder: GameRound[];  // Order of rounds to play
  currentRoundIndex: number;
}

// ============================================
// Round-Specific State Types
// ============================================

export type RoundSpecificState =
  | QBTargetThrowState
  | ReceiverRunState
  | QBAccuracyGauntletState
  | FieldGoalFrenzyState
  | HailMaryState
  | BarnyardBlitzState;

export interface QBTargetThrowState {
  type: 'qb_target_throw';
  activeReceivers: Map<string, any>;
  activeDefenders: Map<string, any>;
  activeBalls: Map<string, any>;
  currentWaveIndex: number;
  multiplier: number;
}

export interface ReceiverRunState {
  type: 'receiver_run';
  npcQB: Entity | null;
  playerRoutes: Map<string, any>;  // Player routes
  activeBalls: Map<string, any>;
  catchesMade: number;
  routesRun: number;
}

export interface QBAccuracyGauntletState {
  type: 'qb_accuracy_gauntlet';
  activeTargets: Map<string, any>;
  activeBalls: Map<string, any>;
  targetsHit: number;
  currentWave: number;
}

export interface FieldGoalFrenzyState {
  type: 'field_goal_frenzy';
  currentDistance: number;
  windSpeed: number;
  windDirection: number;  // degrees
  activeBalls: Map<string, any>;
  kicksMade: number;
  kicksAttempted: number;
}

export interface HailMaryState {
  type: 'hail_mary';
  targetReceiver: Entity | null;
  activeBalls: Map<string, any>;
  throwsRemaining: number;
  bestDistance: number;
}

export interface BarnyardBlitzState {
  type: 'barnyard_blitz';
  activeAnimals: Map<string, any>;
  activeDefenders: Map<string, any>;
  activeBalls: Map<string, any>;
  currentWaveIndex: number;
  multiplier: number;
  streak: number;
}

// ============================================
// UI Update Types
// ============================================

export interface MultiRoundUIUpdate {
  type: 'multi_round_update';
  gameState: MultiRoundGameState;
  currentRound: GameRound;
  roundName: string;
  roundNumber: number;
  totalRounds: number;
  timeRemaining: number;
  playerScore: number;
  playerRank: number;
  totalPlayers: number;
  leaderboard: LeaderboardEntry[];
  roundSpecificData?: any;
}

export interface RoundIntroUIData {
  type: 'round_intro';
  round: GameRound;
  roundName: string;
  description: string;
  duration: number;
  scoreMultiplier: number;
}

export interface RoundResultsUIData {
  type: 'round_results';
  round: GameRound;
  roundName: string;
  playerScore: number;
  playerRank: number;
  roundWinner: string;
  leaderboard: LeaderboardEntry[];
  nextRound?: GameRound;
}

export interface GameOverUIData {
  type: 'game_over';
  finalLeaderboard: LeaderboardEntry[];
  winner: string;
  playerFinalRank: number;
  playerTotalScore: number;
  stats: PlayerGameStats;
}
