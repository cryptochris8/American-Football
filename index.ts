/**
 * QB Target Throw - American Football Mini-Game
 *
 * A football throwing arcade game where players aim and throw
 * footballs at targets to score points. Features combo system,
 * multiple target types, and increasing difficulty.
 *
 * This is Phase 1 of a larger American Football game inspired by Tecmo Bowl.
 */

import {
  startServer,
  Audio,
  Entity,
  DefaultPlayerEntity,
  PlayerEvent,
  BaseEntityController,
  PlayerEntity,
} from 'hytopia';

import worldMap from './assets/map.json';
import { GameManager } from './src/GameManager';

// Store references
let gameManager: GameManager;

/**
 * Custom QB Controller - handles aiming and throwing
 * The player is stationary but can look around to aim
 */
class QBController extends BaseEntityController {
  private gameManager: GameManager;
  private isCharging: boolean = false;

  constructor(gameManager: GameManager) {
    super();
    this.gameManager = gameManager;
  }

  /**
   * Called every tick with player input
   */
  public override tickWithPlayerInput(
    entity: PlayerEntity,
    input: any,
    cameraOrientation: any,
    deltaTimeMs: number
  ): void {
    // Validate deltaTimeMs before passing to parent
    const validDeltaTime = typeof deltaTimeMs === 'number' && !isNaN(deltaTimeMs) ? deltaTimeMs : 16;

    super.tickWithPlayerInput(entity, input, cameraOrientation, validDeltaTime);

    const player = entity.player;
    if (!player) return;

    // Handle throw charging with left mouse button
    if (input && input.ml && !this.isCharging) {
      // Start charging
      this.isCharging = true;
      this.gameManager.startCharge(player);
    } else if (input && !input.ml && this.isCharging) {
      // Release throw
      this.isCharging = false;
      this.gameManager.releaseThrow(player);
    }

    // Rotate entity to face camera direction (yaw only)
    if (cameraOrientation && typeof cameraOrientation.yaw === 'number' && !isNaN(cameraOrientation.yaw)) {
      const yaw = cameraOrientation.yaw;
      const halfYaw = yaw * 0.5;
      const sinHalf = Math.sin(halfYaw);
      const cosHalf = Math.cos(halfYaw);

      // Only set rotation if values are valid
      if (!isNaN(sinHalf) && !isNaN(cosHalf)) {
        entity.setRotation({
          x: 0,
          y: sinHalf,
          z: 0,
          w: cosHalf,
        });
      }
    }
  }

  public override tick(entity: Entity, deltaTimeMs: number): void {
    const validDeltaTime = typeof deltaTimeMs === 'number' && !isNaN(deltaTimeMs) ? deltaTimeMs : 16;
    super.tick(entity, validDeltaTime);
  }
}

startServer(world => {
  console.log('=================================');
  console.log('  QB TARGET THROW - Starting...');
  console.log('=================================');

  // Enable debug rendering for development (comment out for production)
  // world.simulation.enableDebugRendering(true);

  // Load the map
  world.loadMap(worldMap);

  // Initialize the game manager
  gameManager = new GameManager(world);
  gameManager.initialize();

  // Handle player joining
  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    console.log(`[Server] Player joined: ${player.username}`);

    // Create controller for this player
    const qbController = new QBController(gameManager);

    // Create a stationary QB player entity using default player model
    const playerEntity = new DefaultPlayerEntity({
      player,
      name: `player_${player.id}`,
    });

    // Set our custom controller after creation
    playerEntity.setController(qbController);

    // Spawn player at QB position (behind the line of scrimmage)
    const spawnPos = { x: 0, y: 1, z: -5 };
    playerEntity.spawn(world, spawnPos);

    // Register player with game manager
    gameManager.registerPlayer(player, playerEntity);

    // Load the game UI
    player.ui.load('ui/index.html');

    // Set up camera for first-person aiming
    player.camera.setMode('first_person');
    player.camera.setAttachedToEntity(playerEntity);
    player.camera.setOffset({ x: 0, y: 1.7, z: 0 }); // Eye level

    // Send welcome messages
    world.chatManager.sendPlayerMessage(player, 'Welcome to QB Target Throw!', '00FF00');
    world.chatManager.sendPlayerMessage(player, 'Hold LEFT CLICK to charge your throw', 'FFFF00');
    world.chatManager.sendPlayerMessage(player, 'Release to throw at targets!', 'FFFF00');
    world.chatManager.sendPlayerMessage(player, 'Build combos for bonus points!', '00FFFF');
  });

  // Handle player leaving
  world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    console.log(`[Server] Player left: ${player.username}`);

    // Unregister from game manager
    gameManager.unregisterPlayer(player);

    // Despawn player entities
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => {
      entity.despawn();
    });
  });

  // Chat commands for debugging/testing
  world.chatManager.registerCommand('/restart', player => {
    console.log(`[Server] ${player.username} requested game restart`);
    world.chatManager.sendPlayerMessage(player, 'Game will restart after current round.', 'FFFF00');
  });

  world.chatManager.registerCommand('/score', player => {
    const state = gameManager.getState();
    const playerState = state.playerStates.get(player.id);
    if (playerState) {
      world.chatManager.sendPlayerMessage(player, `Score: ${playerState.score}`, '00FF00');
      world.chatManager.sendPlayerMessage(player, `Combo: ${playerState.combo}x`, 'FFFF00');
      const accuracy = playerState.totalThrows > 0
        ? (playerState.successfulHits / playerState.totalThrows * 100).toFixed(1)
        : '100.0';
      world.chatManager.sendPlayerMessage(player, `Accuracy: ${accuracy}%`, '00FFFF');
    }
  });

  world.chatManager.registerCommand('/debug', player => {
    const state = gameManager.getState();
    console.log('[Debug] Game State:', state.state);
    console.log('[Debug] Active Targets:', state.activeTargets.size);
    console.log('[Debug] Active Balls:', state.activeBalls.size);
    console.log('[Debug] Time Remaining:', state.timeRemaining);
    world.chatManager.sendPlayerMessage(player, `State: ${state.state}, Targets: ${state.activeTargets.size}, Balls: ${state.activeBalls.size}`, '888888');
  });

  // Play background music
  new Audio({
    uri: 'audio/music/hytopia-main-theme.mp3',
    loop: true,
    volume: 0.08,
  }).play(world);

  console.log('[Server] QB Target Throw initialized!');
});
