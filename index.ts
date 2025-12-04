/**
 * HySports Football - Multi-Round American Football Mini-Game
 *
 * A competitive football arcade game featuring 5 unique game modes:
 * 1. QB Target Throw - Throw at moving targets
 * 2. Receiver Run - Throw to AI receivers running routes
 * 3. QB Accuracy Gauntlet - Multiple targets, hit as many as possible
 * 4. Field Goal Frenzy - Kick field goals in wind
 * 5. Hail Mary - Deep bombs for maximum points
 *
 * Multiplayer competitive with leaderboards and round scoring.
 */

import {
  startServer,
  Audio,
  DefaultPlayerEntity,
  DefaultPlayerEntityController,
  PlayerEvent,
  PlayerCameraMode,
  BaseEntityControllerEvent,
  Player,
  World,
  Vector3Like,
  QuaternionLike,
  Quaternion,
} from 'hytopia';

import worldMap from './assets/map.json';
import { MultiRoundGameManager } from './src/MultiRoundGameManager';
import { GameRound, MultiRoundGameState, ROUND_CONFIGS } from './src/types/MultiRoundTypes';

// Store references
let gameManager: MultiRoundGameManager;
let musicStarted = false;
let gameWorld: World;

// Track player entities for round change updates
const playerEntities: Map<string, MultiRoundPlayerEntity> = new Map();

// Start background music - called on first user interaction
function startBackgroundMusic(): void {
  if (musicStarted || !gameWorld) return;
  musicStarted = true;
  new Audio({
    uri: 'audio/music/champions.mp3',
    loop: true,
    volume: 0.08,
  }).play(gameWorld);
  console.log('[Server] Background music started (triggered by user input)');
}

/**
 * Multi-Round Player Entity - adapts to different game modes
 * Handles different input and movement based on current round
 */
class MultiRoundPlayerEntity extends DefaultPlayerEntity {
  private gameManager: MultiRoundGameManager;
  private isCharging: boolean = false;

  constructor(player: Player, gameManager: MultiRoundGameManager) {
    super({
      player,
      name: `player_${player.id}`,
    });

    this.gameManager = gameManager;

    // Get the controller (DefaultPlayerEntityController)
    const controller = this.controller as DefaultPlayerEntityController;

    // Disable auto-cancel of mouse left click (needed for hold-to-charge)
    controller.autoCancelMouseLeftClick = false;

    // Movement enabled/disabled based on round type
    this.updateMovementForRound();

    // Listen for player input events on the controller
    controller.on(BaseEntityControllerEvent.TICK_WITH_PLAYER_INPUT, ({ input }) => {
      this.handleInput(input);
    });
  }

  /**
   * Update movement capabilities based on current round
   */
  public updateMovementForRound(): void {
    const controller = this.controller as DefaultPlayerEntityController;
    const currentRound = this.gameManager.getCurrentRound();

    // All rounds are stationary (QB/Kicker position) - player throws/kicks from fixed position
    const stationaryRounds = [
      GameRound.QB_TARGET_THROW,
      GameRound.RECEIVER_RUN,         // Player is QB throwing to AI receivers
      GameRound.QB_ACCURACY_GAUNTLET, // Player is QB throwing at multiple targets
      GameRound.FIELD_GOAL_FRENZY,
      GameRound.HAIL_MARY,
      GameRound.BARNYARD_BLITZ,       // Player throws at farm animals
    ];

    if (stationaryRounds.includes(currentRound)) {
      // Stationary QB mode - no movement
      controller.canWalk = () => false;
      controller.canRun = () => false;
      controller.canJump = () => false;
    }
  }

  /**
   * Handle player input - routes to current round handler
   */
  private handleInput(input: { ml?: boolean; [key: string]: any }): void {
    const player = this.player;
    if (!player) return;

    // Only process input when game is in playing state
    if (!this.gameManager.isPlaying()) return;

    // Handle action button (left mouse) for throwing/kicking
    if (input.ml && !this.isCharging) {
      // Start charging
      this.isCharging = true;
      this.routeInputToRound('start');

      // Start music on first user interaction (browser autoplay policy)
      startBackgroundMusic();
    } else if (!input.ml && this.isCharging) {
      // Release throw/kick
      this.isCharging = false;
      this.routeInputToRound('release');
    }
  }

  /**
   * Route input to the appropriate round handler
   */
  private routeInputToRound(inputType: 'start' | 'release'): void {
    const player = this.player;
    if (!player) return;

    // Route input through game manager to current round handler
    this.gameManager.handlePlayerInput(player.id, player, inputType);
  }

  /**
   * Override spawn to set up camera after entity is spawned
   */
  public override spawn(world: World, position: Vector3Like, rotation?: QuaternionLike): void {
    super.spawn(world, position, rotation);

    const player = this.player;
    if (!player) return;

    // Set up camera for first-person view
    player.camera.setMode(PlayerCameraMode.FIRST_PERSON);
    player.camera.setAttachedToEntity(this);
    player.camera.setOffset({ x: 0, y: 1.7, z: 0 }); // Eye level (~6ft tall)
    player.camera.setModelHiddenNodes(['head', 'neck']); // Hide head in first person
  }

  /**
   * Position player appropriately for the current round
   */
  public positionForRound(): void {
    const currentRound = this.gameManager.getCurrentRound();

    // Default QB position
    let position = { x: 0, y: 2, z: 25 };
    let rotation = Quaternion.fromEuler(0, 180, 0); // Face toward endzone

    switch (currentRound) {
      case GameRound.QB_TARGET_THROW:
      case GameRound.HAIL_MARY:
      case GameRound.QB_ACCURACY_GAUNTLET:
        // Standard QB position
        position = { x: 0, y: 2, z: 25 };
        break;

      case GameRound.RECEIVER_RUN:
        // QB position for throwing to receivers
        position = { x: 0, y: 2, z: 25 };
        break;

      case GameRound.FIELD_GOAL_FRENZY:
        // Kicker position (will be adjusted by round handler)
        position = { x: 0, y: 2, z: -12 }; // 20 yards from goal
        break;
    }

    this.setPosition(position);
    this.setRotation(rotation);
    this.updateMovementForRound();
  }
}

startServer(world => {
  console.log('==========================================');
  console.log('  HYSPORTS FOOTBALL - Multi-Round Game');
  console.log('==========================================');

  // Save world reference for audio
  gameWorld = world;

  // Enable debug rendering for development (comment out for production)
  // world.simulation.enableDebugRendering(true);

  // Load the map
  world.loadMap(worldMap);

  // Initialize the multi-round game manager
  gameManager = new MultiRoundGameManager(world);
  gameManager.initialize();

  // Register for round changes to update player movement modes
  gameManager.onRoundChange((round: GameRound) => {
    console.log(`[Server] Round changed to ${round}, updating player movement modes...`);
    playerEntities.forEach((entity, playerId) => {
      entity.updateMovementForRound();
      entity.positionForRound();
    });
  });

  // Handle player joining
  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    console.log(`[Server] Player joined: ${player.username}`);

    // Create multi-round player entity
    const playerEntity = new MultiRoundPlayerEntity(player, gameManager);

    // Track the player entity for round change updates
    playerEntities.set(player.id, playerEntity);

    // Spawn player at default QB position
    const spawnPos = { x: 0, y: 2, z: 25 };
    const spawnRotation = Quaternion.fromEuler(0, 180, 0);
    playerEntity.spawn(world, spawnPos, spawnRotation);

    // Register player with game manager
    gameManager.registerPlayer(player, playerEntity);

    // Load the game UI
    player.ui.load('ui/index.html');

    // Send welcome messages
    world.chatManager.sendPlayerMessage(player, 'Welcome to HySports Football!', '00FF00');
    world.chatManager.sendPlayerMessage(player, '5 Rounds of Football Action!', 'FFFF00');
    world.chatManager.sendPlayerMessage(player, 'Hold LEFT CLICK to charge throws/kicks', '00FFFF');
    world.chatManager.sendPlayerMessage(player, 'Compete for the highest score!', 'FF00FF');
  });

  // Handle player leaving
  world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    console.log(`[Server] Player left: ${player.username}`);

    // Remove from tracked player entities
    playerEntities.delete(player.id);

    // Unregister from game manager
    gameManager.unregisterPlayer(player);

    // Despawn player entities
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => {
      entity.despawn();
    });
  });

  // ============================================
  // Chat Commands
  // ============================================

  world.chatManager.registerCommand('/score', player => {
    const state = gameManager.getState();
    const playerScore = state.playerScores.get(player.id);
    if (playerScore) {
      world.chatManager.sendPlayerMessage(player, `Total Score: ${playerScore.totalScore}`, '00FF00');
      world.chatManager.sendPlayerMessage(player, `Rounds Won: ${playerScore.roundsWon}`, 'FFFF00');

      const stats = playerScore.stats;
      const accuracy = stats.totalThrows > 0
        ? (stats.successfulHits / stats.totalThrows * 100).toFixed(1)
        : '100.0';
      world.chatManager.sendPlayerMessage(player, `Accuracy: ${accuracy}%`, '00FFFF');
    }
  });

  world.chatManager.registerCommand('/stats', player => {
    const state = gameManager.getState();
    const playerScore = state.playerScores.get(player.id);
    if (playerScore) {
      const stats = playerScore.stats;
      world.chatManager.sendPlayerMessage(player, '--- Your Stats ---', 'FFFFFF');
      world.chatManager.sendPlayerMessage(player, `Throws: ${stats.totalThrows} | Hits: ${stats.successfulHits}`, '00FF00');
      world.chatManager.sendPlayerMessage(player, `Touchdowns: ${stats.touchdowns} | Field Goals: ${stats.fieldGoals}`, 'FFFF00');
      world.chatManager.sendPlayerMessage(player, `Catches: ${stats.catchesMade} | Tackles Avoided: ${stats.tacklesAvoided}`, '00FFFF');
    }
  });

  world.chatManager.registerCommand('/leaderboard', player => {
    const leaderboard = gameManager.getLeaderboard();
    world.chatManager.sendPlayerMessage(player, '--- LEADERBOARD ---', 'FFD700');

    leaderboard.slice(0, 5).forEach(entry => {
      const prefix = entry.playerId === player.id ? '> ' : '  ';
      world.chatManager.sendPlayerMessage(
        player,
        `${prefix}#${entry.rank} ${entry.playerName}: ${entry.score}`,
        entry.playerId === player.id ? '00FF00' : 'FFFFFF'
      );
    });
  });

  world.chatManager.registerCommand('/round', player => {
    const state = gameManager.getState();
    const config = ROUND_CONFIGS[state.currentRound];

    world.chatManager.sendPlayerMessage(player, `Round ${state.roundNumber}/${state.totalRounds}: ${config.name}`, '00FFFF');
    world.chatManager.sendPlayerMessage(player, `State: ${state.gameState}`, 'FFFF00');
    world.chatManager.sendPlayerMessage(player, `Time: ${Math.ceil(state.timeRemainingSeconds)}s`, '00FF00');
  });

  world.chatManager.registerCommand('/debug', player => {
    const state = gameManager.getState();
    console.log('[Debug] Game State:', state.gameState);
    console.log('[Debug] Current Round:', state.currentRound);
    console.log('[Debug] Round Number:', state.roundNumber);
    console.log('[Debug] Active Players:', state.activePlayers.size);
    console.log('[Debug] Time Remaining:', state.timeRemainingSeconds);

    world.chatManager.sendPlayerMessage(
      player,
      `State: ${state.gameState} | Round: ${state.currentRound} | Players: ${state.activePlayers.size}`,
      '888888'
    );
  });

  world.chatManager.registerCommand('/help', player => {
    world.chatManager.sendPlayerMessage(player, '--- COMMANDS ---', 'FFD700');
    world.chatManager.sendPlayerMessage(player, '/score - Show your score', 'FFFFFF');
    world.chatManager.sendPlayerMessage(player, '/stats - Show detailed stats', 'FFFFFF');
    world.chatManager.sendPlayerMessage(player, '/leaderboard - Show rankings', 'FFFFFF');
    world.chatManager.sendPlayerMessage(player, '/round - Show current round info', 'FFFFFF');
    world.chatManager.sendPlayerMessage(player, '/barnyard - Start Barnyard Blitz mode', 'FFFFFF');
  });

  // Test command for Barnyard Blitz
  world.chatManager.registerCommand('/barnyard', player => {
    world.chatManager.sendPlayerMessage(player, '--- BARNYARD BLITZ ---', 'FFD700');
    world.chatManager.sendPlayerMessage(player, 'Starting Barnyard Blitz mode!', '00FF00');
    world.chatManager.sendPlayerMessage(player, 'Hit farm animals for points!', 'FFFF00');
    world.chatManager.sendPlayerMessage(player, 'Cow=50, Pig=100, Chicken=200, Rabbit=300', '00FFFF');
    world.chatManager.sendPlayerMessage(player, 'Watch out for the dog! (-100 pts)', 'FF0000');

    // Set round to Barnyard Blitz and start
    gameManager.setTestRound(GameRound.BARNYARD_BLITZ);
  });

  console.log('[Server] HySports Football initialized!');
  console.log('[Server] Waiting for players to join...');
});
