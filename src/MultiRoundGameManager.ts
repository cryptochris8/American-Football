/**
 * MultiRoundGameManager - Orchestrates the multi-round football mini-game
 * Manages game flow, round transitions, scoring, and leaderboards
 */

import {
  World,
  Entity,
  Player,
  GameServer,
  Audio,
  WorldLoopEvent,
} from 'hytopia';

import {
  GameRound,
  MultiRoundGameState,
  MultiRoundState,
  PlayerRoundScore,
  PlayerGameStats,
  LeaderboardEntry,
  RoundSpecificState,
  QBTargetThrowState,
  ReceiverRunState,
  QBAccuracyGauntletState,
  FieldGoalFrenzyState,
  HailMaryState,
  BarnyardBlitzState,
  ROUND_CONFIGS,
  MultiRoundUIUpdate,
  RoundIntroUIData,
  RoundResultsUIData,
  GameOverUIData,
} from './types/MultiRoundTypes';

// Import round handlers
import { QBTargetThrowRound } from './rounds/QBTargetThrowRound';
import { ReceiverRunRound } from './rounds/ReceiverRunRound';
import { QBAccuracyGauntletRound } from './rounds/QBAccuracyGauntletRound';
import { FieldGoalFrenzyRound } from './rounds/FieldGoalFrenzyRound';
import { HailMaryRound } from './rounds/HailMaryRound';
import { BarnyardBlitzRound } from './rounds/BarnyardBlitzRound';
import { BaseRound } from './rounds/BaseRound';

// Constants
const COUNTDOWN_DURATION = 3;
const ROUND_INTRO_DURATION = 5;
const ROUND_RESULTS_DURATION = 8;
const MIN_PLAYERS_TO_START = 1;

// Default round order
const DEFAULT_ROUND_ORDER: GameRound[] = [
  GameRound.QB_TARGET_THROW,
  GameRound.RECEIVER_RUN,
  GameRound.QB_ACCURACY_GAUNTLET,
  GameRound.FIELD_GOAL_FRENZY,
  GameRound.HAIL_MARY,
  GameRound.BARNYARD_BLITZ,
];

// Callback for when rounds change
type RoundChangeCallback = (round: GameRound) => void;

export class MultiRoundGameManager {
  private world: World;
  private gameState: MultiRoundState;
  private tickHandler: ((payload: { tickDeltaMs: number }) => void) | null = null;
  private currentRoundHandler: BaseRound | null = null;
  private playerEntities: Map<string, Entity> = new Map();
  private roundChangeCallbacks: RoundChangeCallback[] = [];

  constructor(world: World) {
    this.world = world;
    this.gameState = this.createInitialState();
  }

  private createInitialState(): MultiRoundState {
    return {
      gameState: MultiRoundGameState.LOBBY,
      currentRound: GameRound.QB_TARGET_THROW,
      roundNumber: 0,
      totalRounds: DEFAULT_ROUND_ORDER.length,
      timeRemainingSeconds: 0,
      roundStartTime: 0,
      countdownTime: COUNTDOWN_DURATION,
      playerScores: new Map(),
      activePlayers: new Set(),
      roundState: this.createEmptyRoundState(GameRound.QB_TARGET_THROW),
      roundOrder: [...DEFAULT_ROUND_ORDER],
      currentRoundIndex: 0,
    };
  }

  private createEmptyRoundState(round: GameRound): RoundSpecificState {
    switch (round) {
      case GameRound.QB_TARGET_THROW:
        return {
          type: 'qb_target_throw',
          activeReceivers: new Map(),
          activeDefenders: new Map(),
          activeBalls: new Map(),
          currentWaveIndex: 0,
          multiplier: 1.0,
        };
      case GameRound.RECEIVER_RUN:
        return {
          type: 'receiver_run',
          npcQB: null,
          playerRoutes: new Map(),
          activeBalls: new Map(),
          catchesMade: 0,
          routesRun: 0,
        };
      case GameRound.QB_ACCURACY_GAUNTLET:
        return {
          type: 'qb_accuracy_gauntlet',
          activeTargets: new Map(),
          activeBalls: new Map(),
          targetsHit: 0,
          currentWave: 0,
        };
      case GameRound.FIELD_GOAL_FRENZY:
        return {
          type: 'field_goal_frenzy',
          currentDistance: 20,
          windSpeed: 0,
          windDirection: 0,
          activeBalls: new Map(),
          kicksMade: 0,
          kicksAttempted: 0,
        };
      case GameRound.HAIL_MARY:
        return {
          type: 'hail_mary',
          targetReceiver: null,
          activeBalls: new Map(),
          throwsRemaining: 3,
          bestDistance: 0,
        };
      case GameRound.BARNYARD_BLITZ:
        return {
          type: 'barnyard_blitz',
          activeAnimals: new Map(),
          activeDefenders: new Map(),
          activeBalls: new Map(),
          currentWaveIndex: 0,
          multiplier: 1.0,
          streak: 0,
        };
    }
  }

  private createInitialPlayerScore(player: Player): PlayerRoundScore {
    return {
      playerId: player.id,
      playerName: player.username,
      roundScores: new Map(),
      totalScore: 0,
      roundsWon: 0,
      stats: {
        totalThrows: 0,
        successfulHits: 0,
        accuracy: 0,
        longestStreak: 0,
        touchdowns: 0,
        fieldGoals: 0,
        yardsGained: 0,
        catchesMade: 0,
        tacklesAvoided: 0,
      },
    };
  }

  // ============================================
  // Initialization & Game Loop
  // ============================================

  public initialize(): void {
    console.log('[MultiRoundGameManager] Initializing multi-round game system...');
    this.tickHandler = ({ tickDeltaMs }: { tickDeltaMs: number }) => {
      let dt = tickDeltaMs / 1000;
      if (dt > 0.1) dt = 0.1;
      this.tick(dt);
    };
    this.world.loop.on(WorldLoopEvent.TICK_START, this.tickHandler);
  }

  private tick(dt: number): void {

    switch (this.gameState.gameState) {
      case MultiRoundGameState.LOBBY:
        this.updateLobby(dt);
        break;
      case MultiRoundGameState.ROUND_INTRO:
        this.updateRoundIntro(dt);
        break;
      case MultiRoundGameState.COUNTDOWN:
        this.updateCountdown(dt);
        break;
      case MultiRoundGameState.PLAYING:
        this.updatePlaying(dt);
        break;
      case MultiRoundGameState.ROUND_RESULTS:
        this.updateRoundResults(dt);
        break;
      case MultiRoundGameState.GAME_OVER:
        this.updateGameOver(dt);
        break;
    }
  }

  // ============================================
  // State Update Methods
  // ============================================

  private updateLobby(dt: number): void {
    // Check if we have enough players to start
    if (this.gameState.activePlayers.size >= MIN_PLAYERS_TO_START) {
      this.startGame();
    }
  }

  private updateRoundIntro(dt: number): void {
    this.gameState.timeRemainingSeconds -= dt;
    if (this.gameState.timeRemainingSeconds <= 0) {
      this.startCountdown();
    }
    this.broadcastUIUpdate();
  }

  private updateCountdown(dt: number): void {
    this.gameState.countdownTime -= dt;
    if (this.gameState.countdownTime <= 0) {
      this.startRound();
    }
    this.broadcastUIUpdate();
  }

  private updatePlaying(dt: number): void {
    this.gameState.timeRemainingSeconds -= dt;

    // Update current round handler
    if (this.currentRoundHandler) {
      this.currentRoundHandler.update(dt);
    }

    if (this.gameState.timeRemainingSeconds <= 0) {
      this.endRound();
    }

    this.broadcastUIUpdate();
  }

  private updateRoundResults(dt: number): void {
    this.gameState.timeRemainingSeconds -= dt;
    if (this.gameState.timeRemainingSeconds <= 0) {
      this.advanceToNextRound();
    }
  }

  private updateGameOver(dt: number): void {
    // Game over state - wait for restart or players to leave
    this.gameState.timeRemainingSeconds -= dt;
    if (this.gameState.timeRemainingSeconds <= 0) {
      // Auto-restart after showing final results
      this.resetGame();
    }
  }

  // ============================================
  // Game Flow Methods
  // ============================================

  private startGame(): void {
    console.log('[MultiRoundGameManager] Starting multi-round game!');

    this.gameState.roundNumber = 0;
    this.gameState.currentRoundIndex = 0;

    // Reset all player scores
    this.gameState.playerScores.forEach((score, playerId) => {
      score.roundScores.clear();
      score.totalScore = 0;
      score.roundsWon = 0;
    });

    this.showRoundIntro();
  }

  private showRoundIntro(): void {
    const round = this.gameState.roundOrder[this.gameState.currentRoundIndex];
    this.gameState.currentRound = round;
    this.gameState.roundNumber++;
    this.gameState.gameState = MultiRoundGameState.ROUND_INTRO;
    this.gameState.timeRemainingSeconds = ROUND_INTRO_DURATION;

    const config = ROUND_CONFIGS[round];
    console.log(`[MultiRoundGameManager] Round ${this.gameState.roundNumber}: ${config.name}`);

    // Send round intro to all players
    this.broadcastRoundIntro();
  }

  private startCountdown(): void {
    this.gameState.gameState = MultiRoundGameState.COUNTDOWN;
    this.gameState.countdownTime = COUNTDOWN_DURATION;

    // Initialize round handler
    this.initializeRoundHandler();
  }

  private startRound(): void {
    this.gameState.gameState = MultiRoundGameState.PLAYING;
    this.gameState.roundStartTime = Date.now();

    const config = ROUND_CONFIGS[this.gameState.currentRound];
    this.gameState.timeRemainingSeconds = config.duration;

    // Notify listeners of round change (for player movement mode updates)
    this.notifyRoundChange();

    // Start round handler
    if (this.currentRoundHandler) {
      this.currentRoundHandler.start();
    }

    console.log(`[MultiRoundGameManager] Round started! ${config.duration} seconds`);
  }

  private endRound(): void {
    console.log('[MultiRoundGameManager] Round ended!');

    // Stop round handler
    if (this.currentRoundHandler) {
      this.currentRoundHandler.end();
    }

    // Calculate round winner
    const roundWinner = this.calculateRoundWinner();

    // Show round results
    this.gameState.gameState = MultiRoundGameState.ROUND_RESULTS;
    this.gameState.timeRemainingSeconds = ROUND_RESULTS_DURATION;

    this.broadcastRoundResults(roundWinner);
  }

  private advanceToNextRound(): void {
    // Clean up current round
    if (this.currentRoundHandler) {
      this.currentRoundHandler.cleanup();
      this.currentRoundHandler = null;
    }

    // Check if game is complete
    this.gameState.currentRoundIndex++;
    if (this.gameState.currentRoundIndex >= this.gameState.roundOrder.length) {
      this.endGame();
      return;
    }

    // Show intro for next round
    this.showRoundIntro();
  }

  private endGame(): void {
    console.log('[MultiRoundGameManager] Game Over!');
    this.gameState.gameState = MultiRoundGameState.GAME_OVER;
    this.gameState.timeRemainingSeconds = 15; // Show final results for 15 seconds

    this.broadcastGameOver();
  }

  private resetGame(): void {
    console.log('[MultiRoundGameManager] Resetting game...');

    // Clean up current round if active
    if (this.currentRoundHandler) {
      this.currentRoundHandler.cleanup();
      this.currentRoundHandler = null;
    }

    // Reset state
    this.gameState = this.createInitialState();

    // Keep registered players
    const currentPlayers = Array.from(this.playerEntities.keys());
    currentPlayers.forEach(playerId => {
      this.gameState.activePlayers.add(playerId);
    });

    // Return to lobby
    this.gameState.gameState = MultiRoundGameState.LOBBY;
  }

  // ============================================
  // Round Handler Management
  // ============================================

  private initializeRoundHandler(): void {
    const round = this.gameState.currentRound;

    switch (round) {
      case GameRound.QB_TARGET_THROW:
        this.currentRoundHandler = new QBTargetThrowRound(this.world, this);
        break;
      case GameRound.RECEIVER_RUN:
        this.currentRoundHandler = new ReceiverRunRound(this.world, this);
        break;
      case GameRound.QB_ACCURACY_GAUNTLET:
        this.currentRoundHandler = new QBAccuracyGauntletRound(this.world, this);
        break;
      case GameRound.FIELD_GOAL_FRENZY:
        this.currentRoundHandler = new FieldGoalFrenzyRound(this.world, this);
        break;
      case GameRound.HAIL_MARY:
        this.currentRoundHandler = new HailMaryRound(this.world, this);
        break;
      case GameRound.BARNYARD_BLITZ:
        this.currentRoundHandler = new BarnyardBlitzRound(this.world, this);
        break;
    }

    if (this.currentRoundHandler) {
      this.currentRoundHandler.initialize();
    }
  }

  // ============================================
  // Player Management
  // ============================================

  public registerPlayer(player: Player, playerEntity: Entity): void {
    const playerId = player.id;

    if (!this.gameState.playerScores.has(playerId)) {
      this.gameState.playerScores.set(playerId, this.createInitialPlayerScore(player));
    }

    this.gameState.activePlayers.add(playerId);
    this.playerEntities.set(playerId, playerEntity);

    console.log(`[MultiRoundGameManager] Registered player: ${player.username}`);

    // Send current game state to player
    this.sendUIUpdateToPlayer(player);
  }

  public unregisterPlayer(player: Player): void {
    this.gameState.activePlayers.delete(player.id);
    this.playerEntities.delete(player.id);
    console.log(`[MultiRoundGameManager] Unregistered player: ${player.username}`);
  }

  public getPlayerEntity(playerId: string): Entity | undefined {
    return this.playerEntities.get(playerId);
  }

  public getAllPlayerEntities(): Map<string, Entity> {
    return this.playerEntities;
  }

  public getActivePlayers(): Set<string> {
    return this.gameState.activePlayers;
  }

  // ============================================
  // Scoring System
  // ============================================

  public addPlayerScore(playerId: string, points: number): void {
    const playerScore = this.gameState.playerScores.get(playerId);
    if (!playerScore) return;

    const round = this.gameState.currentRound;
    const config = ROUND_CONFIGS[round];
    const adjustedPoints = Math.floor(points * config.scoreMultiplier);

    // Add to round score
    const currentRoundScore = playerScore.roundScores.get(round) || 0;
    playerScore.roundScores.set(round, currentRoundScore + adjustedPoints);

    // Add to total score
    playerScore.totalScore += adjustedPoints;

    console.log(`[Scoring] ${playerScore.playerName}: +${adjustedPoints} pts (${playerScore.totalScore} total)`);
  }

  public updatePlayerStats(playerId: string, stats: Partial<PlayerGameStats>): void {
    const playerScore = this.gameState.playerScores.get(playerId);
    if (!playerScore) return;

    Object.assign(playerScore.stats, stats);
  }

  private calculateRoundWinner(): string {
    const round = this.gameState.currentRound;
    let highestScore = 0;
    let winner = '';

    this.gameState.playerScores.forEach((playerScore, playerId) => {
      const roundScore = playerScore.roundScores.get(round) || 0;
      if (roundScore > highestScore) {
        highestScore = roundScore;
        winner = playerScore.playerName;
      }
    });

    // Update rounds won
    this.gameState.playerScores.forEach((playerScore) => {
      if (playerScore.playerName === winner) {
        playerScore.roundsWon++;
      }
    });

    return winner;
  }

  // ============================================
  // Leaderboard
  // ============================================

  public getLeaderboard(): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = [];

    this.gameState.playerScores.forEach((playerScore) => {
      entries.push({
        rank: 0,
        playerId: playerScore.playerId,
        playerName: playerScore.playerName,
        score: playerScore.totalScore,
        isCurrentPlayer: false,
      });
    });

    // Sort by score descending
    entries.sort((a, b) => b.score - a.score);

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return entries;
  }

  public getRoundLeaderboard(): LeaderboardEntry[] {
    const round = this.gameState.currentRound;
    const entries: LeaderboardEntry[] = [];

    this.gameState.playerScores.forEach((playerScore) => {
      entries.push({
        rank: 0,
        playerId: playerScore.playerId,
        playerName: playerScore.playerName,
        score: playerScore.roundScores.get(round) || 0,
        isCurrentPlayer: false,
      });
    });

    // Sort by score descending
    entries.sort((a, b) => b.score - a.score);

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return entries;
  }

  // ============================================
  // UI Updates
  // ============================================

  private sendUIUpdateToPlayer(player: Player): void {
    const playerScore = this.gameState.playerScores.get(player.id);
    const leaderboard = this.getLeaderboard();

    // Mark current player in leaderboard
    leaderboard.forEach(entry => {
      entry.isCurrentPlayer = entry.playerId === player.id;
    });

    const playerRank = leaderboard.find(e => e.playerId === player.id)?.rank || 0;
    const config = ROUND_CONFIGS[this.gameState.currentRound];

    const uiData: MultiRoundUIUpdate = {
      type: 'multi_round_update',
      gameState: this.gameState.gameState,
      currentRound: this.gameState.currentRound,
      roundName: config.name,
      roundNumber: this.gameState.roundNumber,
      totalRounds: this.gameState.totalRounds,
      timeRemaining: Math.ceil(this.gameState.timeRemainingSeconds),
      playerScore: playerScore?.totalScore || 0,
      playerRank: playerRank,
      totalPlayers: this.gameState.activePlayers.size,
      leaderboard: leaderboard.slice(0, 5), // Top 5
    };

    player.ui.sendData(uiData);
  }

  private broadcastUIUpdate(): void {
    GameServer.instance.playerManager.getConnectedPlayersByWorld(this.world).forEach(player => {
      this.sendUIUpdateToPlayer(player);
    });
  }

  private broadcastRoundIntro(): void {
    const config = ROUND_CONFIGS[this.gameState.currentRound];

    const introData: RoundIntroUIData = {
      type: 'round_intro',
      round: this.gameState.currentRound,
      roundName: config.name,
      description: config.description,
      duration: config.duration,
      scoreMultiplier: config.scoreMultiplier,
    };

    GameServer.instance.playerManager.getConnectedPlayersByWorld(this.world).forEach(player => {
      player.ui.sendData(introData);
    });
  }

  private broadcastRoundResults(winner: string): void {
    const config = ROUND_CONFIGS[this.gameState.currentRound];
    const leaderboard = this.getRoundLeaderboard();
    const nextRound = this.gameState.roundOrder[this.gameState.currentRoundIndex + 1];

    GameServer.instance.playerManager.getConnectedPlayersByWorld(this.world).forEach(player => {
      const playerScore = this.gameState.playerScores.get(player.id);
      const playerRank = leaderboard.find(e => e.playerId === player.id)?.rank || 0;

      // Mark current player
      leaderboard.forEach(entry => {
        entry.isCurrentPlayer = entry.playerId === player.id;
      });

      const resultsData: RoundResultsUIData = {
        type: 'round_results',
        round: this.gameState.currentRound,
        roundName: config.name,
        playerScore: playerScore?.roundScores.get(this.gameState.currentRound) || 0,
        playerRank: playerRank,
        roundWinner: winner,
        leaderboard: leaderboard,
        nextRound: nextRound,
      };

      player.ui.sendData(resultsData);
    });
  }

  private broadcastGameOver(): void {
    const leaderboard = this.getLeaderboard();
    const winner = leaderboard[0]?.playerName || 'No winner';

    GameServer.instance.playerManager.getConnectedPlayersByWorld(this.world).forEach(player => {
      const playerScore = this.gameState.playerScores.get(player.id);
      const playerRank = leaderboard.find(e => e.playerId === player.id)?.rank || 0;

      // Mark current player
      leaderboard.forEach(entry => {
        entry.isCurrentPlayer = entry.playerId === player.id;
      });

      const gameOverData: GameOverUIData = {
        type: 'game_over',
        finalLeaderboard: leaderboard,
        winner: winner,
        playerFinalRank: playerRank,
        playerTotalScore: playerScore?.totalScore || 0,
        stats: playerScore?.stats || {
          totalThrows: 0,
          successfulHits: 0,
          accuracy: 0,
          longestStreak: 0,
          touchdowns: 0,
          fieldGoals: 0,
          yardsGained: 0,
          catchesMade: 0,
          tacklesAvoided: 0,
        },
      };

      player.ui.sendData(gameOverData);
    });
  }

  // ============================================
  // Getters
  // ============================================

  public getState(): MultiRoundState {
    return this.gameState;
  }

  public getCurrentRound(): GameRound {
    return this.gameState.currentRound;
  }

  public getWorld(): World {
    return this.world;
  }

  public isPlaying(): boolean {
    return this.gameState.gameState === MultiRoundGameState.PLAYING;
  }

  public getCurrentRoundHandler(): BaseRound | null {
    return this.currentRoundHandler;
  }

  /**
   * Route player input to the current round handler
   */
  public handlePlayerInput(playerId: string, player: Player, inputType: 'start' | 'release'): void {
    console.log(`[MultiRoundGameManager] handlePlayerInput: ${inputType} from ${playerId}, isPlaying=${this.isPlaying()}, handler=${this.currentRoundHandler ? 'exists' : 'null'}`);
    if (!this.currentRoundHandler || !this.isPlaying()) {
      console.log(`[MultiRoundGameManager] Input ignored - not playing or no handler`);
      return;
    }

    console.log(`[MultiRoundGameManager] Routing input to round handler`);
    this.currentRoundHandler.handlePlayerInput(playerId, player, inputType);
  }

  /**
   * Register a callback to be notified when rounds change
   */
  public onRoundChange(callback: RoundChangeCallback): void {
    this.roundChangeCallbacks.push(callback);
  }

  /**
   * Notify all registered callbacks of a round change
   */
  private notifyRoundChange(): void {
    const round = this.gameState.currentRound;
    this.roundChangeCallbacks.forEach(callback => {
      try {
        callback(round);
      } catch (e) {
        console.error('[MultiRoundGameManager] Error in round change callback:', e);
      }
    });
  }

  // ============================================
  // Testing
  // ============================================

  /**
   * Set and start a specific round for testing (bypasses normal game flow)
   */
  public setTestRound(round: GameRound): void {
    console.log(`[MultiRoundGameManager] Starting test round: ${ROUND_CONFIGS[round].name}`);

    // Clean up current round if any
    if (this.currentRoundHandler) {
      this.currentRoundHandler.cleanup();
      this.currentRoundHandler = null;
    }

    // Set the round
    this.gameState.currentRound = round;
    this.gameState.roundNumber = 1;
    this.gameState.currentRoundIndex = 0;
    this.gameState.roundState = this.createEmptyRoundState(round);

    // Set duration
    const config = ROUND_CONFIGS[round];
    this.gameState.timeRemainingSeconds = config.duration;

    // Initialize the round handler
    this.initializeRoundHandler();

    // Start the round immediately
    this.gameState.gameState = MultiRoundGameState.PLAYING;
    this.gameState.roundStartTime = Date.now();

    if (this.currentRoundHandler) {
      this.currentRoundHandler.start();
    }

    // Notify callbacks
    this.notifyRoundChange();

    // Broadcast UI update
    this.broadcastUIUpdate();
  }

  // ============================================
  // Cleanup
  // ============================================

  public dispose(): void {
    if (this.tickHandler) {
      this.world.loop.off(WorldLoopEvent.TICK_START, this.tickHandler);
      this.tickHandler = null;
    }

    if (this.currentRoundHandler) {
      this.currentRoundHandler.cleanup();
      this.currentRoundHandler = null;
    }
  }
}

export default MultiRoundGameManager;
