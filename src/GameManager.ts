/**
 * QB Target Throw - Game Manager
 * Central orchestrator for the football throwing mini-game
 */

import {
  World,
  Entity,
  Player,
  RigidBodyType,
  ColliderShape,
} from 'hytopia';

import {
  GameState,
  GameStateData,
  PlayerGameState,
  TargetType,
  TargetDepth,
  TargetLane,
  TargetConfig,
  TargetData,
  FootballData,
  ScoringConfig,
  ThrowConfig,
  UIUpdateData,
  GameEvent,
} from './types/GameTypes';

// Game configuration constants
const SCORING_CONFIG: ScoringConfig = {
  basePoints: {
    [TargetType.BASIC]: 100,
    [TargetType.MOVING]: 150,
    [TargetType.BONUS]: 300,
  },
  depthMultiplier: {
    [TargetDepth.SHORT]: 1.0,
    [TargetDepth.MEDIUM]: 1.5,
    [TargetDepth.DEEP]: 2.0,
  },
  comboMultiplierStep: 0.1,
  maxComboMultiplier: 3.0,
  accuracyBonusThreshold: 80,
  accuracyBonusPoints: 500,
};

const THROW_CONFIG: ThrowConfig = {
  minPower: 10,
  maxPower: 35,
  chargeRate: 1.5,    // Full charge in ~0.67 seconds
  gravity: -15,
  ballLifetime: 5,
  throwCooldown: 0.3,
};

const ROUND_DURATION = 60; // seconds
const COUNTDOWN_DURATION = 3;
const TARGET_SPAWN_INTERVAL_BASE = 2.0; // seconds
const TARGET_SPAWN_INTERVAL_MIN = 0.8;

// Target depth Z positions
const DEPTH_POSITIONS = {
  [TargetDepth.SHORT]: 12,
  [TargetDepth.MEDIUM]: 22,
  [TargetDepth.DEEP]: 32,
};

// Target Y heights (slightly above ground)
const TARGET_HEIGHT = 2.5;

export class GameManager {
  private world: World;
  private gameState: GameStateData;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private lastTickTime: number = 0;

  constructor(world: World) {
    this.world = world;
    this.gameState = this.createInitialState();
  }

  private createInitialState(): GameStateData {
    return {
      state: GameState.WAITING,
      roundNumber: 1,
      timeRemaining: ROUND_DURATION,
      roundDuration: ROUND_DURATION,
      countdownTime: COUNTDOWN_DURATION,
      activeBalls: new Map(),
      activeTargets: new Map(),
      playerStates: new Map(),
      targetSpawnTimer: 0,
      nextTargetSpawnTime: TARGET_SPAWN_INTERVAL_BASE,
      difficultyLevel: 1,
    };
  }

  /**
   * Initialize the game manager and start the game loop
   */
  public initialize(): void {
    console.log('[GameManager] Initializing QB Target Throw game...');

    // Start the game tick loop (60 FPS)
    this.lastTickTime = Date.now();
    this.tickInterval = setInterval(() => this.tick(), 1000 / 60);
  }

  /**
   * Register a player who joined the game
   */
  public registerPlayer(player: Player, playerEntity: Entity): void {
    const playerId = player.id;

    if (this.gameState.playerStates.has(playerId)) {
      console.log(`[GameManager] Player ${player.username} already registered`);
      return;
    }

    const playerState: PlayerGameState = {
      player,
      playerEntity,
      score: 0,
      combo: 0,
      maxCombo: 0,
      totalThrows: 0,
      successfulHits: 0,
      isCharging: false,
      chargeStartTime: 0,
      chargePower: 0,
      lastThrowTime: 0,
      tutorialStep: 0,
      hasCompletedTutorial: false,
    };

    this.gameState.playerStates.set(playerId, playerState);
    console.log(`[GameManager] Registered player: ${player.username}`);

    // Send initial UI state
    this.sendUIUpdate(player);

    // Auto-start game if this is the first player
    if (this.gameState.state === GameState.WAITING) {
      this.startCountdown();
    }
  }

  /**
   * Unregister a player who left
   */
  public unregisterPlayer(player: Player): void {
    this.gameState.playerStates.delete(player.id);
    console.log(`[GameManager] Unregistered player: ${player.username}`);
  }

  /**
   * Start the pre-round countdown
   */
  public startCountdown(): void {
    this.gameState.state = GameState.COUNTDOWN;
    this.gameState.countdownTime = COUNTDOWN_DURATION;
    console.log('[GameManager] Starting countdown...');
    this.broadcastUIUpdate();
  }

  /**
   * Start the actual round
   */
  private startRound(): void {
    this.gameState.state = GameState.PLAYING;
    this.gameState.timeRemaining = ROUND_DURATION;
    this.gameState.targetSpawnTimer = 0;
    this.gameState.nextTargetSpawnTime = 1.0; // First target spawns quickly

    // Reset player scores for new round
    this.gameState.playerStates.forEach((state) => {
      state.score = 0;
      state.combo = 0;
      state.totalThrows = 0;
      state.successfulHits = 0;
    });

    console.log(`[GameManager] Round ${this.gameState.roundNumber} started!`);
    this.broadcastUIUpdate();

    // Spawn initial targets
    this.spawnTargetWave();
  }

  /**
   * End the current round
   */
  private endRound(): void {
    this.gameState.state = GameState.ROUND_END;
    console.log(`[GameManager] Round ${this.gameState.roundNumber} ended!`);

    // Clean up active targets and balls
    this.gameState.activeTargets.forEach((target) => {
      if (target.entity.isSpawned) {
        target.entity.despawn();
      }
    });
    this.gameState.activeTargets.clear();

    this.gameState.activeBalls.forEach((ball) => {
      if (ball.entity.isSpawned) {
        ball.entity.despawn();
      }
    });
    this.gameState.activeBalls.clear();

    // Calculate final stats for each player
    this.gameState.playerStates.forEach((state, playerId) => {
      const accuracy = state.totalThrows > 0
        ? (state.successfulHits / state.totalThrows) * 100
        : 0;

      // Award accuracy bonus
      if (accuracy >= SCORING_CONFIG.accuracyBonusThreshold) {
        state.score += SCORING_CONFIG.accuracyBonusPoints;
      }

      console.log(`[GameManager] Player ${state.player.username} - Score: ${state.score}, Accuracy: ${accuracy.toFixed(1)}%`);
    });

    this.broadcastUIUpdate();

    // Auto-restart after showing results
    setTimeout(() => {
      this.gameState.roundNumber++;
      this.gameState.difficultyLevel = Math.min(this.gameState.roundNumber, 5);
      this.startCountdown();
    }, 5000);
  }

  /**
   * Main game tick - called every frame
   */
  private tick(): void {
    const now = Date.now();
    let dt = (now - this.lastTickTime) / 1000; // Delta time in seconds
    this.lastTickTime = now;

    // Validate dt - clamp to reasonable values
    if (typeof dt !== 'number' || isNaN(dt) || dt <= 0) {
      dt = 1 / 60; // Default to 60 FPS
    }
    if (dt > 0.1) {
      dt = 0.1; // Cap at 100ms to prevent huge jumps
    }

    switch (this.gameState.state) {
      case GameState.COUNTDOWN:
        this.updateCountdown(dt);
        break;
      case GameState.PLAYING:
        this.updatePlaying(dt);
        break;
    }
  }

  /**
   * Update countdown state
   */
  private updateCountdown(dt: number): void {
    this.gameState.countdownTime -= dt;

    if (this.gameState.countdownTime <= 0) {
      this.startRound();
    } else {
      this.broadcastUIUpdate();
    }
  }

  /**
   * Update playing state
   */
  private updatePlaying(dt: number): void {
    // Update round timer
    this.gameState.timeRemaining -= dt;
    if (this.gameState.timeRemaining <= 0) {
      this.endRound();
      return;
    }

    // Update target spawning
    this.updateTargetSpawning(dt);

    // Update moving targets
    this.updateMovingTargets(dt);

    // Update bonus target lifetimes
    this.updateBonusTargets(dt);

    // Update footballs (physics handled by engine, but we track lifetime)
    this.updateFootballs(dt);

    // Update player charging
    this.updatePlayerCharging(dt);

    // Send periodic UI updates
    this.broadcastUIUpdate();
  }

  /**
   * Handle target spawning logic
   */
  private updateTargetSpawning(dt: number): void {
    this.gameState.targetSpawnTimer += dt;

    if (this.gameState.targetSpawnTimer >= this.gameState.nextTargetSpawnTime) {
      this.spawnTargetWave();
      this.gameState.targetSpawnTimer = 0;

      // Calculate next spawn time (gets faster with difficulty)
      const difficultyFactor = 1 - (this.gameState.difficultyLevel - 1) * 0.15;
      this.gameState.nextTargetSpawnTime = Math.max(
        TARGET_SPAWN_INTERVAL_MIN,
        TARGET_SPAWN_INTERVAL_BASE * difficultyFactor
      );
    }
  }

  /**
   * Spawn a wave of targets
   */
  private spawnTargetWave(): void {
    // Determine target type based on difficulty and randomness
    const rand = Math.random();
    let targetType = TargetType.BASIC;

    const movingChance = 0.1 + this.gameState.difficultyLevel * 0.1;
    const bonusChance = 0.05 + this.gameState.difficultyLevel * 0.03;

    if (rand < bonusChance) {
      targetType = TargetType.BONUS;
    } else if (rand < bonusChance + movingChance) {
      targetType = TargetType.MOVING;
    }

    // Choose random depth
    const depths = [TargetDepth.SHORT, TargetDepth.MEDIUM, TargetDepth.DEEP];
    const depthWeights = [0.4, 0.35, 0.25]; // Short more common
    const depthRand = Math.random();
    let depth = TargetDepth.SHORT;
    let cumWeight = 0;
    for (let i = 0; i < depths.length; i++) {
      cumWeight += depthWeights[i];
      if (depthRand <= cumWeight) {
        depth = depths[i];
        break;
      }
    }

    // Choose random lane
    const lanes = [TargetLane.LEFT, TargetLane.CENTER_LEFT, TargetLane.CENTER, TargetLane.CENTER_RIGHT, TargetLane.RIGHT];
    const lane = lanes[Math.floor(Math.random() * lanes.length)];

    const config: TargetConfig = {
      type: targetType,
      depth,
      lane,
      points: SCORING_CONFIG.basePoints[targetType],
      lifetime: targetType === TargetType.BONUS ? 4 : undefined,
      moveSpeed: targetType === TargetType.MOVING ? 3 + this.gameState.difficultyLevel : undefined,
      moveRange: targetType === TargetType.MOVING ? 4 : undefined,
    };

    this.spawnTarget(config);
  }

  /**
   * Spawn a single target with the given config
   */
  private spawnTarget(config: TargetConfig): void {
    const targetId = `target_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const x = config.lane;
    const y = TARGET_HEIGHT;
    const z = DEPTH_POSITIONS[config.depth];

    // Determine texture based on type (using block entities)
    // Use .png for single-texture blocks
    let blockTextureUri = 'blocks/oak-leaves.png'; // Default green for basic
    if (config.type === TargetType.MOVING) {
      blockTextureUri = 'blocks/sand.png'; // Yellow-ish for moving
    } else if (config.type === TargetType.BONUS) {
      blockTextureUri = 'blocks/gold-block.png'; // Gold for bonus
    }

    // Create target as a block entity (flat disc shape)
    const targetEntity = new Entity({
      name: targetId,
      blockTextureUri,
      blockHalfExtents: { x: 0.7, y: 0.1, z: 0.7 }, // Flat disc shape
      rigidBodyOptions: {
        type: RigidBodyType.FIXED, // Fixed for targets - we control position manually
      },
    });

    targetEntity.spawn(this.world, { x, y, z });

    // Store target data
    const targetData: TargetData = {
      id: targetId,
      entity: targetEntity,
      config,
      spawnTime: Date.now(),
      isHit: false,
      moveDirection: config.type === TargetType.MOVING ? (Math.random() > 0.5 ? 1 : -1) : undefined,
      initialX: x,
    };

    this.gameState.activeTargets.set(targetId, targetData);
    console.log(`[GameManager] Spawned ${config.type} target at (${x}, ${y}, ${z})`);
  }

  /**
   * Update moving targets
   */
  private updateMovingTargets(dt: number): void {
    this.gameState.activeTargets.forEach((target) => {
      if (target.config.type !== TargetType.MOVING || !target.config.moveSpeed || !target.config.moveRange) {
        return;
      }

      const pos = target.entity.position;
      if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number' || typeof pos.z !== 'number') {
        return;
      }

      const newX = pos.x + (target.moveDirection || 1) * target.config.moveSpeed * dt;

      // Reverse direction at bounds
      const minX = (target.initialX || 0) - target.config.moveRange;
      const maxX = (target.initialX || 0) + target.config.moveRange;

      if (newX <= minX || newX >= maxX) {
        target.moveDirection = -(target.moveDirection || 1);
      }

      if (!isNaN(newX)) {
        target.entity.setPosition({ x: newX, y: pos.y, z: pos.z });
      }
    });
  }

  /**
   * Update bonus target lifetimes
   */
  private updateBonusTargets(dt: number): void {
    const now = Date.now();
    const toRemove: string[] = [];

    this.gameState.activeTargets.forEach((target, targetId) => {
      if (target.config.type !== TargetType.BONUS || !target.config.lifetime) {
        return;
      }

      const elapsed = (now - target.spawnTime) / 1000;
      if (elapsed >= target.config.lifetime) {
        toRemove.push(targetId);
      }
    });

    toRemove.forEach((targetId) => {
      const target = this.gameState.activeTargets.get(targetId);
      if (target && target.entity.isSpawned) {
        target.entity.despawn();
      }
      this.gameState.activeTargets.delete(targetId);
    });
  }

  /**
   * Update football projectiles and check for collisions
   */
  private updateFootballs(dt: number): void {
    const now = Date.now();
    const ballsToRemove: string[] = [];
    const hitPairs: { ballId: string; targetId: string }[] = [];

    // Check each ball for collisions with targets
    this.gameState.activeBalls.forEach((ball, ballId) => {
      const elapsed = (now - ball.spawnTime) / 1000;
      const ballPos = ball.entity.position;

      // Validate ball position
      if (!ballPos || typeof ballPos.x !== 'number' || typeof ballPos.y !== 'number' || typeof ballPos.z !== 'number') {
        ballsToRemove.push(ballId);
        return;
      }

      // Check collision with each target using distance
      this.gameState.activeTargets.forEach((target, targetId) => {
        if (target.isHit) return;

        const targetPos = target.entity.position;
        if (!targetPos || typeof targetPos.x !== 'number' || typeof targetPos.y !== 'number' || typeof targetPos.z !== 'number') {
          return;
        }

        const dx = ballPos.x - targetPos.x;
        const dy = ballPos.y - targetPos.y;
        const dz = ballPos.z - targetPos.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Collision threshold (ball radius + target radius)
        const collisionThreshold = 1.0;
        if (!isNaN(distance) && distance < collisionThreshold) {
          hitPairs.push({ ballId, targetId });
        }
      });

      // Remove if lifetime exceeded or fell below ground
      if (elapsed >= THROW_CONFIG.ballLifetime || ballPos.y < -2) {
        ballsToRemove.push(ballId);

        // This was a miss - break combo for the player who threw it
        const playerState = this.gameState.playerStates.get(ball.thrownBy.id);
        if (playerState) {
          playerState.combo = 0;
        }
      }
    });

    // Process hits
    hitPairs.forEach(({ ballId, targetId }) => {
      this.handleTargetHit(targetId, ballId);
    });

    // Remove expired balls
    ballsToRemove.forEach((ballId) => {
      const ball = this.gameState.activeBalls.get(ballId);
      if (ball && ball.entity.isSpawned) {
        ball.entity.despawn();
      }
      this.gameState.activeBalls.delete(ballId);
    });
  }

  /**
   * Update player throw charging
   */
  private updatePlayerCharging(dt: number): void {
    // Validate dt
    if (typeof dt !== 'number' || isNaN(dt) || dt <= 0) {
      return;
    }

    this.gameState.playerStates.forEach((state) => {
      if (state.isCharging) {
        const newPower = state.chargePower + THROW_CONFIG.chargeRate * dt;
        state.chargePower = isNaN(newPower) ? state.chargePower : Math.min(1, newPower);
      }
    });
  }

  /**
   * Handle player starting to charge a throw
   */
  public startCharge(player: Player): void {
    const state = this.gameState.playerStates.get(player.id);
    if (!state || this.gameState.state !== GameState.PLAYING) return;

    const now = Date.now();
    if (now - state.lastThrowTime < THROW_CONFIG.throwCooldown * 1000) return;

    state.isCharging = true;
    state.chargeStartTime = now;
    state.chargePower = 0;
  }

  /**
   * Handle player releasing a throw
   */
  public releaseThrow(player: Player): void {
    const state = this.gameState.playerStates.get(player.id);
    if (!state || !state.isCharging || this.gameState.state !== GameState.PLAYING) return;

    state.isCharging = false;
    const power = Math.max(0.2, state.chargePower); // Minimum power
    state.chargePower = 0;
    state.lastThrowTime = Date.now();
    state.totalThrows++;

    // Calculate throw direction from player's camera/facing
    const playerPos = state.playerEntity.position;
    if (!playerPos || typeof playerPos.x !== 'number' || typeof playerPos.y !== 'number' || typeof playerPos.z !== 'number') {
      console.log('[GameManager] Invalid player position for throw');
      return;
    }

    // Get yaw and pitch with defaults
    const yaw = typeof player.camera?.orientation?.yaw === 'number' ? player.camera.orientation.yaw : 0;
    const pitch = typeof player.camera?.orientation?.pitch === 'number' ? player.camera.orientation.pitch : 0;

    // Direction vector from yaw/pitch (Hytopia: -Z is forward)
    const dirX = -Math.sin(yaw) * Math.cos(pitch);
    const dirY = Math.sin(pitch); // Look up = throw up, look down = throw down
    const dirZ = -Math.cos(yaw) * Math.cos(pitch); // Negative Z is forward

    // Calculate velocity based on power
    const speed = THROW_CONFIG.minPower + power * (THROW_CONFIG.maxPower - THROW_CONFIG.minPower);
    const velocity = {
      x: dirX * speed,
      y: dirY * speed + 5, // Add slight upward arc
      z: dirZ * speed,
    };

    console.log(`[GameManager] Throw - yaw: ${yaw.toFixed(2)}, pitch: ${pitch.toFixed(2)}, dir: (${dirX.toFixed(2)}, ${dirY.toFixed(2)}, ${dirZ.toFixed(2)}), speed: ${speed.toFixed(1)}`);

    this.spawnFootball(player, playerPos, velocity);
  }

  /**
   * Spawn a football projectile
   */
  private spawnFootball(player: Player, position: { x: number; y: number; z: number }, velocity: { x: number; y: number; z: number }): void {
    const ballId = `football_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate yaw to point football in direction of travel (horizontal)
    // Add 90 degree offset to account for model's default orientation
    const yaw = Math.atan2(-velocity.x, -velocity.z) + Math.PI / 2;
    const halfYaw = yaw / 2;
    const rotation = {
      x: 0,
      y: Math.sin(halfYaw),
      z: 0,
      w: Math.cos(halfYaw),
    };

    // Create football using the 3D model
    const footballEntity = new Entity({
      name: ballId,
      modelUri: 'models/football/scene.gltf',
      modelScale: 0.00375, // Scale down the model to football size
      rigidBodyOptions: {
        type: RigidBodyType.DYNAMIC,
        linearVelocity: velocity,
        gravityScale: 1.0,
        ccdEnabled: true, // Prevent tunneling through targets
        enabledRotations: { x: false, y: false, z: false }, // Lock rotation - no tumbling
        rotation, // Point nose in direction of throw
        colliders: [
          {
            shape: ColliderShape.BALL,
            radius: 0.15, // Football collision radius for hit detection
          },
        ],
      },
    });

    // Spawn slightly in front of player
    const spawnPos = {
      x: position.x + velocity.x * 0.05,
      y: position.y + 1.5, // At chest height
      z: position.z + velocity.z * 0.05,
    };

    footballEntity.spawn(this.world, spawnPos);

    const ballData: FootballData = {
      id: ballId,
      entity: footballEntity,
      spawnTime: Date.now(),
      thrownBy: player,
      initialVelocity: velocity,
    };

    this.gameState.activeBalls.set(ballId, ballData);
    console.log(`[GameManager] ${player.username} threw football with power ${velocity.z.toFixed(1)}`);
  }

  /**
   * Handle a target being hit by a football
   */
  private handleTargetHit(targetId: string, ballId: string): void {
    const target = this.gameState.activeTargets.get(targetId);
    const ball = this.gameState.activeBalls.get(ballId);

    if (!target || !ball || target.isHit) return;

    target.isHit = true;

    // Get the player who threw the ball
    const playerState = this.gameState.playerStates.get(ball.thrownBy.id);
    if (!playerState) return;

    // Calculate points
    const basePoints = target.config.points;
    const depthMultiplier = SCORING_CONFIG.depthMultiplier[target.config.depth];
    const comboMultiplier = 1 + Math.min(playerState.combo * SCORING_CONFIG.comboMultiplierStep, SCORING_CONFIG.maxComboMultiplier - 1);
    const points = Math.floor(basePoints * depthMultiplier * comboMultiplier);

    // Update player state
    playerState.score += points;
    playerState.combo++;
    playerState.successfulHits++;
    playerState.maxCombo = Math.max(playerState.maxCombo, playerState.combo);

    console.log(`[GameManager] ${playerState.player.username} hit ${target.config.type} target! +${points} pts (${playerState.combo}x combo)`);

    // Remove target and ball
    if (target.entity.isSpawned) {
      target.entity.despawn();
    }
    this.gameState.activeTargets.delete(targetId);

    if (ball.entity.isSpawned) {
      ball.entity.despawn();
    }
    this.gameState.activeBalls.delete(ballId);

    // Send UI update
    this.sendUIUpdate(playerState.player);
  }

  /**
   * Send UI update to a specific player
   */
  private sendUIUpdate(player: Player): void {
    const state = this.gameState.playerStates.get(player.id);
    if (!state) return;

    const accuracy = state.totalThrows > 0
      ? (state.successfulHits / state.totalThrows) * 100
      : 100;

    // Ensure all values are valid numbers
    const timeRemaining = this.gameState.state === GameState.COUNTDOWN
      ? Math.ceil(this.gameState.countdownTime || 0)
      : Math.ceil(this.gameState.timeRemaining || 0);

    const uiData: UIUpdateData = {
      type: 'game_update',
      state: this.gameState.state,
      score: state.score || 0,
      combo: state.combo || 0,
      timeRemaining: isNaN(timeRemaining) ? 0 : timeRemaining,
      chargePower: isNaN(state.chargePower) ? 0 : state.chargePower,
      accuracy: isNaN(accuracy) ? 100 : Math.round(accuracy),
      roundNumber: this.gameState.roundNumber || 1,
    };

    player.ui.sendData(uiData);
  }

  /**
   * Broadcast UI update to all players
   */
  private broadcastUIUpdate(): void {
    this.gameState.playerStates.forEach((state) => {
      this.sendUIUpdate(state.player);
    });
  }

  /**
   * Get current game state (for debugging)
   */
  public getState(): GameStateData {
    return this.gameState;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    // Despawn all entities
    this.gameState.activeTargets.forEach((target) => {
      if (target.entity.isSpawned) {
        target.entity.despawn();
      }
    });
    this.gameState.activeBalls.forEach((ball) => {
      if (ball.entity.isSpawned) {
        ball.entity.despawn();
      }
    });
  }
}
