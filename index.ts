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
import { GameManager } from './src/GameManager';

// Store references
let gameManager: GameManager;

/**
 * Custom QB Player Entity - extends DefaultPlayerEntity
 * Handles aiming and throwing while keeping all default physics
 */
class QBPlayerEntity extends DefaultPlayerEntity {
  private gameManager: GameManager;
  private isCharging: boolean = false;

  constructor(player: Player, gameManager: GameManager) {
    super({
      player,
      name: `player_${player.id}`,
    });

    this.gameManager = gameManager;

    // Get the controller (DefaultPlayerEntityController)
    const controller = this.controller as DefaultPlayerEntityController;

    // Disable auto-cancel of mouse left click (needed for hold-to-charge)
    controller.autoCancelMouseLeftClick = false;

    // Disable default movement - QB is stationary
    controller.canWalk = () => false;
    controller.canRun = () => false;
    controller.canJump = () => false;

    // Listen for player input events on the controller
    controller.on(BaseEntityControllerEvent.TICK_WITH_PLAYER_INPUT, ({ input }) => {
      this.handleInput(input);
    });
  }

  /**
   * Handle player input for throwing
   */
  private handleInput(input: { ml?: boolean; [key: string]: any }): void {
    const player = this.player;
    if (!player) return;

    // Handle throw charging with left mouse button
    if (input.ml && !this.isCharging) {
      // Start charging
      this.isCharging = true;
      this.gameManager.startCharge(player);
    } else if (!input.ml && this.isCharging) {
      // Release throw
      this.isCharging = false;
      this.gameManager.releaseThrow(player);
    }
  }

  /**
   * Override spawn to set up camera after entity is spawned
   */
  public override spawn(world: World, position: Vector3Like, rotation?: QuaternionLike): void {
    super.spawn(world, position, rotation);

    const player = this.player;
    if (!player) return;

    // Set up camera for first-person aiming at QB eye level
    player.camera.setMode(PlayerCameraMode.FIRST_PERSON);
    player.camera.setAttachedToEntity(this);
    player.camera.setOffset({ x: 0, y: 1.7, z: 0 }); // QB eye level (~6ft tall)
    player.camera.setModelHiddenNodes(['head', 'neck']); // Hide head in first person
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

    // Create custom QB player entity (extends DefaultPlayerEntity)
    const playerEntity = new QBPlayerEntity(player, gameManager);

    // Spawn player at QB position (near blue endzone, facing red endzone)
    // Stadium field: Red endzone Z=-34 to -31, Blue endzone Z=31 to 34
    // Player faces toward negative Z (red endzone direction)
    const spawnPos = { x: 0, y: 2, z: 25 }; // Near blue endzone (Z=31-34)
    // Use Quaternion helper for proper 180 degree rotation
    const spawnRotation = Quaternion.fromEuler(0, 180, 0);
    playerEntity.spawn(world, spawnPos, spawnRotation);

    // Register player with game manager
    gameManager.registerPlayer(player, playerEntity);

    // Load the game UI
    player.ui.load('ui/index.html');

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
