/**
 * QB Target Throw - Game Manager (Megatouch QB Zone Style)
 * Central orchestrator for the football throwing mini-game
 * Features: Receivers and defenders sweeping horizontally across lanes
 */

import {
  World,
  Entity,
  Player,
  RigidBodyType,
  ColliderShape,
  CollisionGroup,
  Audio,
} from 'hytopia';

import {
  GameState,
  PlayerGameState,
  ReceiverType,
  DefenderType,
  ReceiverArchetype,
  DefenderArchetype,
  ReceiverData,
  DefenderData,
  FootballData,
  WaveConfig,
  SpawnConfig,
  MegatouchGameState,
  LaneMovement,
  UIUpdateData,
} from './types/GameTypes';

// ============================================
// Receiver Archetypes
// ============================================
// Player at Z=25 facing -Z. Field: Z=-30 (red endzone) to Z=30 (blue endzone)
// Bullseye model is ~20.3 units diameter
// Size + Distance scoring: Smaller targets = more points, Further = more points
const RECEIVER_ARCHETYPES: Record<string, ReceiverArchetype> = {
  // EXTRA LARGE targets - Easiest to hit, lowest points
  receiver_xlarge: {
    id: 'receiver_xlarge',
    receiverType: ReceiverType.BASIC,
    basePointsShort: 25,    // XL + Close = easiest possible
    basePointsMedium: 40,
    basePointsDeep: 60,     // XL + Far = still easy
    depthShortMaxZ: 10.0,
    depthMediumMaxZ: -5.0,
    modelUri: 'models/bullseye/scene.gltf',
    modelScale: 0.175, // ~3.5m diameter - very easy target
    collisionHalfExtents: { x: 1.75, y: 1.75, z: 0.3 },
    laneMovement: {
      speed: 1.5, // Slowest
      minX: -12.0,
      maxX: 12.0,
      direction: 1,
    },
  },
  // LARGE targets - Easy to hit, lower points
  receiver_large: {
    id: 'receiver_large',
    receiverType: ReceiverType.BASIC,
    basePointsShort: 50,    // Large + Close = easy
    basePointsMedium: 75,
    basePointsDeep: 100,    // Large + Far = moderate
    depthShortMaxZ: 10.0,
    depthMediumMaxZ: -5.0,
    modelUri: 'models/bullseye/scene.gltf',
    modelScale: 0.135, // ~2.7m diameter - easy target
    collisionHalfExtents: { x: 1.35, y: 1.35, z: 0.3 },
    laneMovement: {
      speed: 2.0,
      minX: -12.0,
      maxX: 12.0,
      direction: 1,
    },
  },
  // MEDIUM targets - Standard difficulty
  receiver_medium: {
    id: 'receiver_medium',
    receiverType: ReceiverType.BASIC,
    basePointsShort: 100,
    basePointsMedium: 150,
    basePointsDeep: 200,
    depthShortMaxZ: 10.0,
    depthMediumMaxZ: -5.0,
    modelUri: 'models/bullseye/scene.gltf',
    modelScale: 0.10, // ~2m diameter - standard target (player height)
    collisionHalfExtents: { x: 1.0, y: 1.0, z: 0.25 },
    laneMovement: {
      speed: 2.5,
      minX: -12.0,
      maxX: 12.0,
      direction: 1,
    },
  },
  // SMALL targets - Hard to hit, higher points, faster
  receiver_small: {
    id: 'receiver_small',
    receiverType: ReceiverType.FAST,
    basePointsShort: 150,
    basePointsMedium: 225,
    basePointsDeep: 300,
    depthShortMaxZ: 5.0,
    depthMediumMaxZ: -10.0,
    modelUri: 'models/bullseye/scene.gltf',
    modelScale: 0.07, // ~1.4m diameter - harder target
    collisionHalfExtents: { x: 0.7, y: 0.7, z: 0.2 },
    laneMovement: {
      speed: 3.5,
      minX: -12.0,
      maxX: 12.0,
      direction: -1,
    },
  },
  // TINY bonus targets - Very hard to hit, highest points, brief appearance
  receiver_tiny: {
    id: 'receiver_tiny',
    receiverType: ReceiverType.BONUS,
    basePointsShort: 250,
    basePointsMedium: 350,
    basePointsDeep: 500,    // Tiny + Far = jackpot!
    depthShortMaxZ: 0.0,
    depthMediumMaxZ: -15.0,
    modelUri: 'models/bullseye/scene.gltf',
    modelScale: 0.05, // ~1m diameter - very hard target
    collisionHalfExtents: { x: 0.5, y: 0.5, z: 0.2 },
    laneMovement: {
      speed: 4.0,
      minX: -12.0,
      maxX: 12.0,
      direction: 1,
    },
    lifetime: 4.0, // Brief appearance
  },
};

// ============================================
// Defender Archetypes
// ============================================
// Using Hytopia player model with American Football skins from AthleteDomains
// Player model at scale 1.0 is roughly human-sized (~1.8m)
const DEFENDER_SKINS = [
  'skins/football/defender_1.png',
  'skins/football/defender_2.png',
  'skins/football/defender_3.png',
  'skins/football/defender_4.png',
  'skins/football/defender_5.png',
  'skins/football/defender_6.png',
  'skins/football/defender_7.png',
  'skins/football/defender_8.png',
  'skins/football/defender_9.png',
  'skins/football/defender_10.png',
];

const DEFENDER_ARCHETYPES: Record<string, DefenderArchetype> = {
  defender_obstacle: {
    id: 'defender_obstacle',
    defenderType: DefenderType.STANDARD,
    blockWeight: 1.0,
    modelUri: 'models/defender/scene.gltf',
    modelScale: 0.055, // ~2.6m tall player
    collisionHalfExtents: { x: 0.6, y: 1.3, z: 0.4 },
    laneMovement: {
      speed: 2.5,
      minX: -10.0,
      maxX: 10.0,
      direction: -1,
    },
  },
};

// ============================================
// Default Spawn Configuration (from JSON)
// ============================================
// Player at Z=25 facing -Z. Stadium: Z=-30 to Z=30
// Goal posts at red endzone (Z ~ -32)
const GOAL_POST_CONFIG = {
  z: -32,           // Z position of goal posts (past red endzone)
  leftUpright: -3,  // X position of left upright
  rightUpright: 3,  // X position of right upright
  crossbarY: 3,     // Height of crossbar
  points: 500,      // Points for field goal
};

const DEFAULT_SPAWN_CONFIG: SpawnConfig = {
  id: 'qb_target_throw_spawning_default',
  description: 'Megatouch QB Zone-style waves with size-based scoring',
  roundDurationSeconds: 60,
  lanesX: [-6.0, -3.0, 0.0, 3.0, 6.0],
  waves: [
    {
      waveIndex: 0,
      startTimeSeconds: 0,
      endTimeSeconds: 15,
      receiverSpawnIntervalSeconds: 1.5,
      defenderSpawnIntervalSeconds: 3.0,
      // Wave 1: Even distribution of all 5 sizes, close to mid range
      receivers: [
        { archetypeId: 'receiver_xlarge', weight: 0.2, allowedDepthsZ: [5.0, 15.0] },
        { archetypeId: 'receiver_large', weight: 0.2, allowedDepthsZ: [5.0, 15.0] },
        { archetypeId: 'receiver_medium', weight: 0.2, allowedDepthsZ: [0.0, 12.0] },
        { archetypeId: 'receiver_small', weight: 0.2, allowedDepthsZ: [0.0, 10.0] },
        { archetypeId: 'receiver_tiny', weight: 0.2, allowedDepthsZ: [-5.0, 8.0] },
      ],
      // Defenders spread across field - more near QB, fewer further back
      defenders: [
        { archetypeId: 'defender_obstacle', weight: 0.5, allowedDepthsZ: [10.0, 18.0] },  // Close (50%)
        { archetypeId: 'defender_obstacle', weight: 0.3, allowedDepthsZ: [0.0, 10.0] },   // Mid (30%)
        { archetypeId: 'defender_obstacle', weight: 0.2, allowedDepthsZ: [-10.0, 0.0] },  // Far (20%)
      ],
    },
    {
      waveIndex: 1,
      startTimeSeconds: 15,
      endTimeSeconds: 35,
      receiverSpawnIntervalSeconds: 1.3,
      defenderSpawnIntervalSeconds: 2.0,
      // Wave 2: Even distribution of all 5 sizes, mid range
      receivers: [
        { archetypeId: 'receiver_xlarge', weight: 0.2, allowedDepthsZ: [-5.0, 10.0] },
        { archetypeId: 'receiver_large', weight: 0.2, allowedDepthsZ: [-5.0, 10.0] },
        { archetypeId: 'receiver_medium', weight: 0.2, allowedDepthsZ: [-10.0, 5.0] },
        { archetypeId: 'receiver_small', weight: 0.2, allowedDepthsZ: [-10.0, 5.0] },
        { archetypeId: 'receiver_tiny', weight: 0.2, allowedDepthsZ: [-15.0, 0.0] },
      ],
      // Defenders spread across field - more near QB, fewer further back
      defenders: [
        { archetypeId: 'defender_obstacle', weight: 0.4, allowedDepthsZ: [5.0, 15.0] },   // Close (40%)
        { archetypeId: 'defender_obstacle', weight: 0.35, allowedDepthsZ: [-5.0, 5.0] },  // Mid (35%)
        { archetypeId: 'defender_obstacle', weight: 0.25, allowedDepthsZ: [-15.0, -5.0] }, // Far (25%)
      ],
    },
    {
      waveIndex: 2,
      startTimeSeconds: 35,
      endTimeSeconds: 60,
      receiverSpawnIntervalSeconds: 1.0,
      defenderSpawnIntervalSeconds: 1.6,
      // Wave 3: Even distribution of all 5 sizes, full field depth
      receivers: [
        { archetypeId: 'receiver_xlarge', weight: 0.2, allowedDepthsZ: [-15.0, 5.0] },
        { archetypeId: 'receiver_large', weight: 0.2, allowedDepthsZ: [-15.0, 5.0] },
        { archetypeId: 'receiver_medium', weight: 0.2, allowedDepthsZ: [-20.0, 0.0] },
        { archetypeId: 'receiver_small', weight: 0.2, allowedDepthsZ: [-20.0, -5.0] },
        { archetypeId: 'receiver_tiny', weight: 0.2, allowedDepthsZ: [-25.0, -10.0] },
      ],
      // Defenders spread across full field - more near QB, fewer further back
      defenders: [
        { archetypeId: 'defender_obstacle', weight: 0.35, allowedDepthsZ: [0.0, 12.0] },   // Close (35%)
        { archetypeId: 'defender_obstacle', weight: 0.35, allowedDepthsZ: [-10.0, 0.0] },  // Mid (35%)
        { archetypeId: 'defender_obstacle', weight: 0.2, allowedDepthsZ: [-20.0, -10.0] }, // Far (20%)
        { archetypeId: 'defender_obstacle', weight: 0.1, allowedDepthsZ: [-28.0, -20.0] }, // Deep (10%)
      ],
    },
  ],
};

// Configuration constants
const THROW_CONFIG = {
  minPower: 10,
  maxPower: 35,
  chargeRate: 1.5,
  gravity: -15,
  ballLifetime: 5,
  throwCooldown: 0.3,
};

// Interception penalty config
const INTERCEPTION_CONFIG = {
  pointPenalty: 100,  // Points deducted on interception
  soundUri: 'audio/sfx/interception.mp3',
  soundVolume: 0.5,
};

// Throw sound config
const THROW_SOUND_CONFIG = {
  soundUri: 'audio/sfx/ball-wind.wav',
  soundVolume: 0.6,
};

// Crowd cheer config for streaks
const CROWD_CHEER_CONFIG = {
  slightCheer: {
    soundUri: 'audio/sfx/slight-cheer.wav',
    soundVolume: 0.5,
    streakThreshold: 3,  // Plays at 3 hits in a row
  },
  largeCheer: {
    soundUri: 'audio/sfx/large-cheer.wav',
    soundVolume: 0.7,
    streakThreshold: 5,  // Plays at 5 hits in a row
  },
};

// Ball ground hit sound config
const BALL_GROUND_CONFIG = {
  soundUri: 'audio/sfx/ball-ground.wav',
  soundVolume: 0.5,
};

const MAX_ACTIVE_RECEIVERS = 7;
const MAX_ACTIVE_DEFENDERS = 5;
const COUNTDOWN_DURATION = 3;

// Spiral rotation config
const SPIRAL_CONFIG = {
  rotationsPerSecond: 8, // How fast the football spins (8 rotations/sec = nice visible spiral)
  radiansPerSecond: 8 * Math.PI * 2, // ~50 rad/sec
};

// ============================================
// Quaternion Helper Functions
// ============================================

type Quat = { x: number; y: number; z: number; w: number };
type Vec3 = { x: number; y: number; z: number };

/**
 * Creates a quaternion that aligns the +X axis with a direction vector.
 * The football model's nose points along +X, so this orients the nose toward the velocity.
 */
function createAlignmentQuaternion(direction: Vec3): Quat {
  // Normalize direction
  const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
  if (len < 0.0001) {
    return { x: 0, y: 0, z: 0, w: 1 }; // Identity if no direction
  }

  const dx = direction.x / len;
  const dy = direction.y / len;
  const dz = direction.z / len;

  // We want to rotate +X (1, 0, 0) to (dx, dy, dz)
  // Using the half-vector method: q = normalize(1 + dot, cross)
  // A = (1, 0, 0), B = (dx, dy, dz)
  // dot = A·B = dx
  // cross = A×B = (0, -dz, dy)

  const dot = dx;

  // Handle the case where direction is opposite to +X (dot ≈ -1)
  if (dot < -0.9999) {
    // 180° rotation around Y axis
    return { x: 0, y: 1, z: 0, w: 0 };
  }

  // q = (w: 1 + dot, x: 0, y: -dz, z: dy) then normalize
  let qw = 1 + dot;
  let qx = 0;
  let qy = -dz;
  let qz = dy;

  // Normalize
  const qlen = Math.sqrt(qw * qw + qx * qx + qy * qy + qz * qz);
  qw /= qlen;
  qx /= qlen;
  qy /= qlen;
  qz /= qlen;

  return { x: qx, y: qy, z: qz, w: qw };
}

/**
 * Creates a quaternion for rotation around an axis by an angle.
 */
function createAxisAngleQuaternion(axis: Vec3, angle: number): Quat {
  // Normalize axis
  const len = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
  if (len < 0.0001) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }

  const ax = axis.x / len;
  const ay = axis.y / len;
  const az = axis.z / len;

  const halfAngle = angle / 2;
  const s = Math.sin(halfAngle);

  return {
    x: ax * s,
    y: ay * s,
    z: az * s,
    w: Math.cos(halfAngle),
  };
}

/**
 * Multiplies two quaternions: result = a * b
 */
function multiplyQuaternions(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

export class GameManager {
  private world: World;
  private gameState: MegatouchGameState;
  private spawnConfig: SpawnConfig;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private lastTickTime: number = 0;

  constructor(world: World) {
    this.world = world;
    this.spawnConfig = DEFAULT_SPAWN_CONFIG;
    this.gameState = this.createInitialState();
  }

  private createInitialState(): MegatouchGameState {
    return {
      state: GameState.WAITING,
      roundDurationSeconds: this.spawnConfig.roundDurationSeconds,
      timeRemainingSeconds: this.spawnConfig.roundDurationSeconds,

      score: 0,
      multiplier: 1.0,
      multiplierMax: 3.0,
      multiplierStep: 0.1,

      currentStreak: 0,
      bestStreak: 0,

      totalThrows: 0,
      successfulHits: 0,
      blockedThrows: 0,

      currentWaveIndex: 0,
      waveStartTime: 0,
      lastReceiverSpawnTime: 0,
      lastDefenderSpawnTime: 0,

      activeReceivers: new Map(),
      activeDefenders: new Map(),
      activeBalls: new Map(),

      lanesX: this.spawnConfig.lanesX,
      playerStates: new Map(),
    };
  }

  public initialize(): void {
    console.log('[GameManager] Initializing Megatouch QB Zone game...');
    this.lastTickTime = Date.now();
    this.tickInterval = setInterval(() => this.tick(), 1000 / 60);
  }

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

    this.sendUIUpdate(player);

    if (this.gameState.state === GameState.WAITING) {
      this.startCountdown();
    }
  }

  public unregisterPlayer(player: Player): void {
    this.gameState.playerStates.delete(player.id);
    console.log(`[GameManager] Unregistered player: ${player.username}`);
  }

  public startCountdown(): void {
    this.gameState.state = GameState.COUNTDOWN;
    this.gameState.timeRemainingSeconds = COUNTDOWN_DURATION;
    console.log('[GameManager] Starting countdown...');
    this.broadcastUIUpdate();
  }

  private startRound(): void {
    this.gameState.state = GameState.PLAYING;
    this.gameState.timeRemainingSeconds = this.spawnConfig.roundDurationSeconds;
    this.gameState.currentWaveIndex = 0;
    this.gameState.waveStartTime = Date.now();
    this.gameState.lastReceiverSpawnTime = 0;
    this.gameState.lastDefenderSpawnTime = 0;

    // Reset scores
    this.gameState.score = 0;
    this.gameState.multiplier = 1.0;
    this.gameState.currentStreak = 0;
    this.gameState.totalThrows = 0;
    this.gameState.successfulHits = 0;
    this.gameState.blockedThrows = 0;

    this.gameState.playerStates.forEach((state) => {
      state.score = 0;
      state.combo = 0;
      state.totalThrows = 0;
      state.successfulHits = 0;
    });

    console.log('[GameManager] Round started - Megatouch QB Zone mode!');
    this.broadcastUIUpdate();
  }

  private endRound(): void {
    this.gameState.state = GameState.ROUND_END;
    console.log('[GameManager] Round ended!');

    // Clean up all active entities
    this.gameState.activeReceivers.forEach((receiver) => {
      if (receiver.entity.isSpawned) receiver.entity.despawn();
    });
    this.gameState.activeReceivers.clear();

    this.gameState.activeDefenders.forEach((defender) => {
      if (defender.entity.isSpawned) defender.entity.despawn();
    });
    this.gameState.activeDefenders.clear();

    this.gameState.activeBalls.forEach((ball) => {
      if (ball.entity.isSpawned) ball.entity.despawn();
    });
    this.gameState.activeBalls.clear();

    // Calculate final stats
    const accuracy = this.gameState.totalThrows > 0
      ? (this.gameState.successfulHits / this.gameState.totalThrows) * 100
      : 0;
    console.log(`[GameManager] Final Score: ${this.gameState.score}, Accuracy: ${accuracy.toFixed(1)}%, Best Streak: ${this.gameState.bestStreak}, Blocked: ${this.gameState.blockedThrows}`);

    this.broadcastUIUpdate();

    // Auto-restart after showing results
    setTimeout(() => {
      this.startCountdown();
    }, 5000);
  }

  private tick(): void {
    const now = Date.now();
    let dt = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    if (typeof dt !== 'number' || isNaN(dt) || dt <= 0) dt = 1 / 60;
    if (dt > 0.1) dt = 0.1;

    switch (this.gameState.state) {
      case GameState.COUNTDOWN:
        this.updateCountdown(dt);
        break;
      case GameState.PLAYING:
        this.updatePlaying(dt);
        break;
    }
  }

  private updateCountdown(dt: number): void {
    this.gameState.timeRemainingSeconds -= dt;
    if (this.gameState.timeRemainingSeconds <= 0) {
      this.startRound();
    } else {
      this.broadcastUIUpdate();
    }
  }

  private updatePlaying(dt: number): void {
    this.gameState.timeRemainingSeconds -= dt;
    if (this.gameState.timeRemainingSeconds <= 0) {
      this.endRound();
      return;
    }

    // Determine elapsed time in round
    const elapsedSeconds = this.spawnConfig.roundDurationSeconds - this.gameState.timeRemainingSeconds;

    // Update current wave based on time
    this.updateCurrentWave(elapsedSeconds);

    // LaneActorSpawnSystem - spawn receivers and defenders
    this.updateLaneActorSpawning(elapsedSeconds);

    // LaneMovementSystem - move all actors horizontally
    this.updateLaneMovement(dt);

    // Update receiver lifetimes (for bonus receivers)
    this.updateReceiverLifetimes();

    // Update footballs and check collisions
    this.updateFootballs(dt);

    // Update player charging
    this.updatePlayerCharging(dt);

    // Periodic UI updates
    this.broadcastUIUpdate();
  }

  // ============================================
  // LaneActorSpawnSystem
  // ============================================
  private updateCurrentWave(elapsedSeconds: number): void {
    const waves = this.spawnConfig.waves;
    for (let i = waves.length - 1; i >= 0; i--) {
      if (elapsedSeconds >= waves[i].startTimeSeconds && elapsedSeconds < waves[i].endTimeSeconds) {
        if (this.gameState.currentWaveIndex !== i) {
          this.gameState.currentWaveIndex = i;
          console.log(`[GameManager] Wave ${i + 1} started!`);
        }
        break;
      }
    }
  }

  private updateLaneActorSpawning(elapsedSeconds: number): void {
    const wave = this.spawnConfig.waves[this.gameState.currentWaveIndex];
    if (!wave) return;

    // Spawn receivers
    const timeSinceLastReceiver = elapsedSeconds - this.gameState.lastReceiverSpawnTime;
    if (timeSinceLastReceiver >= wave.receiverSpawnIntervalSeconds) {
      if (this.gameState.activeReceivers.size < MAX_ACTIVE_RECEIVERS) {
        this.spawnReceiver(wave);
        this.gameState.lastReceiverSpawnTime = elapsedSeconds;
      }
    }

    // Spawn defenders
    const timeSinceLastDefender = elapsedSeconds - this.gameState.lastDefenderSpawnTime;
    if (timeSinceLastDefender >= wave.defenderSpawnIntervalSeconds) {
      if (this.gameState.activeDefenders.size < MAX_ACTIVE_DEFENDERS) {
        this.spawnDefender(wave);
        this.gameState.lastDefenderSpawnTime = elapsedSeconds;
      }
    }
  }

  private spawnReceiver(wave: WaveConfig): void {
    // Select receiver type based on weights
    const totalWeight = wave.receivers.reduce((sum, r) => sum + r.weight, 0);
    let rand = Math.random() * totalWeight;
    let selectedConfig = wave.receivers[0];

    for (const receiverConfig of wave.receivers) {
      rand -= receiverConfig.weight;
      if (rand <= 0) {
        selectedConfig = receiverConfig;
        break;
      }
    }

    const archetype = RECEIVER_ARCHETYPES[selectedConfig.archetypeId];
    if (!archetype) {
      console.warn(`[GameManager] Unknown receiver archetype: ${selectedConfig.archetypeId}`);
      return;
    }

    // Random depth
    const depthZ = selectedConfig.allowedDepthsZ[0] +
      Math.random() * (selectedConfig.allowedDepthsZ[1] - selectedConfig.allowedDepthsZ[0]);

    // Receivers spawn on left or right edge and move across the field
    const spawnOnLeft = Math.random() > 0.5;
    const laneX = spawnOnLeft ? archetype.laneMovement.minX : archetype.laneMovement.maxX;
    const direction = spawnOnLeft ? 1 : -1; // Move toward opposite side

    const receiverId = `receiver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create entity with 3D model (no rigid body to avoid physics issues)
    const receiverEntity = new Entity({
      name: receiverId,
      modelUri: archetype.modelUri,
      modelScale: archetype.modelScale,
    });

    receiverEntity.spawn(this.world, { x: laneX, y: 1.5, z: depthZ });

    const receiverData: ReceiverData = {
      id: receiverId,
      entity: receiverEntity,
      archetype,
      spawnTime: Date.now(),
      isHit: false,
      laneMovement: {
        speed: archetype.laneMovement.speed,
        minX: archetype.laneMovement.minX,
        maxX: archetype.laneMovement.maxX,
        direction: direction as 1 | -1,
      },
      depthZ,
      initialX: laneX,
    };

    this.gameState.activeReceivers.set(receiverId, receiverData);
    const side = spawnOnLeft ? 'left' : 'right';
    console.log(`[GameManager] Spawned ${archetype.receiverType} receiver on ${side} at (${laneX.toFixed(1)}, ${depthZ.toFixed(1)})`);
  }

  private spawnDefender(wave: WaveConfig): void {
    const totalWeight = wave.defenders.reduce((sum, d) => sum + d.weight, 0);
    let rand = Math.random() * totalWeight;
    let selectedConfig = wave.defenders[0];

    for (const defenderConfig of wave.defenders) {
      rand -= defenderConfig.weight;
      if (rand <= 0) {
        selectedConfig = defenderConfig;
        break;
      }
    }

    const archetype = DEFENDER_ARCHETYPES[selectedConfig.archetypeId];
    if (!archetype) {
      console.warn(`[GameManager] Unknown defender archetype: ${selectedConfig.archetypeId}`);
      return;
    }

    // Random lane and depth
    const laneX = this.gameState.lanesX[Math.floor(Math.random() * this.gameState.lanesX.length)];
    const depthZ = selectedConfig.allowedDepthsZ[0] +
      Math.random() * (selectedConfig.allowedDepthsZ[1] - selectedConfig.allowedDepthsZ[0]);

    const defenderId = `defender_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create defender entity with cartoon football player model
    const defenderEntity = new Entity({
      name: defenderId,
      modelUri: archetype.modelUri,
      modelScale: archetype.modelScale,
    });

    defenderEntity.spawn(this.world, { x: laneX, y: 1, z: depthZ });

    const direction = Math.random() > 0.5 ? 1 : -1;

    const defenderData: DefenderData = {
      id: defenderId,
      entity: defenderEntity,
      archetype,
      spawnTime: Date.now(),
      laneMovement: {
        speed: archetype.laneMovement.speed,
        minX: archetype.laneMovement.minX,
        maxX: archetype.laneMovement.maxX,
        direction: direction as 1 | -1,
      },
      depthZ,
      initialX: laneX,
    };

    this.gameState.activeDefenders.set(defenderId, defenderData);
    console.log(`[GameManager] Spawned defender at (${laneX.toFixed(1)}, ${depthZ.toFixed(1)})`);
  }

  // ============================================
  // LaneMovementSystem
  // ============================================
  private updateLaneMovement(dt: number): void {
    const receiversToRemove: string[] = [];

    // Move receivers - they go one direction and despawn at the edge
    this.gameState.activeReceivers.forEach((receiver, id) => {
      const shouldRemove = this.moveReceiverAcrossField(receiver.entity, receiver.laneMovement, dt);
      if (shouldRemove) {
        receiversToRemove.push(id);
      }
    });

    // Remove receivers that crossed the field
    receiversToRemove.forEach((id) => {
      const receiver = this.gameState.activeReceivers.get(id);
      if (receiver && receiver.entity.isSpawned) {
        receiver.entity.despawn();
      }
      this.gameState.activeReceivers.delete(id);
    });

    // Move defenders - they bounce back and forth
    this.gameState.activeDefenders.forEach((defender) => {
      this.moveDefenderBouncing(defender.entity, defender.laneMovement, dt);
    });
  }

  // Receivers move in one direction across the field, despawn when reaching the edge
  private moveReceiverAcrossField(entity: Entity, movement: LaneMovement, dt: number): boolean {
    const pos = entity.position;
    if (!pos || typeof pos.x !== 'number') return true;

    const newX = pos.x + movement.direction * movement.speed * dt;

    // Check if receiver has crossed the field edge - if so, signal for removal
    if (newX <= movement.minX || newX >= movement.maxX) {
      return true; // Remove this receiver
    }

    if (!isNaN(newX)) {
      entity.setPosition({ x: newX, y: pos.y, z: pos.z });
    }
    return false;
  }

  // Defenders bounce back and forth
  private moveDefenderBouncing(entity: Entity, movement: LaneMovement, dt: number): void {
    const pos = entity.position;
    if (!pos || typeof pos.x !== 'number') return;

    const newX = pos.x + movement.direction * movement.speed * dt;

    // Reverse at boundaries
    if (newX <= movement.minX || newX >= movement.maxX) {
      movement.direction = -movement.direction as 1 | -1;
    }

    if (!isNaN(newX)) {
      entity.setPosition({ x: Math.max(movement.minX, Math.min(movement.maxX, newX)), y: pos.y, z: pos.z });
    }
  }

  // ============================================
  // Receiver Lifetime System
  // ============================================
  private updateReceiverLifetimes(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    this.gameState.activeReceivers.forEach((receiver, id) => {
      if (receiver.archetype.lifetime) {
        const elapsed = (now - receiver.spawnTime) / 1000;
        if (elapsed >= receiver.archetype.lifetime) {
          toRemove.push(id);
        }
      }
    });

    toRemove.forEach((id) => {
      const receiver = this.gameState.activeReceivers.get(id);
      if (receiver && receiver.entity.isSpawned) {
        receiver.entity.despawn();
      }
      this.gameState.activeReceivers.delete(id);
    });
  }

  // ============================================
  // Football Physics & Collision Systems
  // ============================================
  private updateFootballs(dt: number): void {
    const now = Date.now();
    const ballsToRemove: string[] = [];
    const receiverHits: { ballId: string; receiverId: string }[] = [];
    const defenderHits: { ballId: string; defenderId: string }[] = [];
    const fieldGoals: string[] = [];

    this.gameState.activeBalls.forEach((ball, ballId) => {
      const elapsed = (now - ball.spawnTime) / 1000;
      const ballPos = ball.entity.position;

      if (!ballPos || typeof ballPos.x !== 'number') {
        ballsToRemove.push(ballId);
        return;
      }

      // Update spiral rotation
      // Calculate current velocity: v = v0 + gravity * t
      const currentVelocity = {
        x: ball.initialVelocity.x,
        y: ball.initialVelocity.y + THROW_CONFIG.gravity * elapsed,
        z: ball.initialVelocity.z,
      };

      // Update spiral angle
      ball.spiralAngle += SPIRAL_CONFIG.radiansPerSecond * dt;

      // Create alignment quaternion (points nose toward velocity)
      const alignQuat = createAlignmentQuaternion(currentVelocity);

      // Create spiral rotation around the velocity axis (local X after alignment)
      // We rotate around (1, 0, 0) in local space, which after alignment is the velocity direction
      const spiralQuat = createAxisAngleQuaternion({ x: 1, y: 0, z: 0 }, ball.spiralAngle);

      // Combine: first align, then spiral around the aligned axis
      const finalQuat = multiplyQuaternions(alignQuat, spiralQuat);

      // Apply rotation to entity
      ball.entity.setRotation(finalQuat);

      // Check if ball has hit the ground (Y <= 1.2 accounts for ball radius + ground at Y=1)
      // Once grounded, ball can no longer score points
      if (!ball.hasHitGround && ballPos.y <= 1.3) {
        ball.hasHitGround = true;
        console.log(`[GameManager] Football hit the ground - can no longer score`);
        this.playBallGroundSound();
      }

      // BallTargetCollisionSystem - check receiver collisions (only if ball hasn't hit ground)
      if (!ball.hasHitGround) {
        this.gameState.activeReceivers.forEach((receiver, receiverId) => {
          if (receiver.isHit) return;
          const receiverPos = receiver.entity.position;
          if (!receiverPos) return;

          const dx = ballPos.x - receiverPos.x;
          const dy = ballPos.y - receiverPos.y;
          const dz = ballPos.z - receiverPos.z;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (!isNaN(distance) && distance < 1.2) {
            receiverHits.push({ ballId, receiverId });
          }
        });

        // BallDefenderCollisionSystem - check defender collisions
        this.gameState.activeDefenders.forEach((defender, defenderId) => {
          const defenderPos = defender.entity.position;
          if (!defenderPos) return;

          const dx = ballPos.x - defenderPos.x;
          const dy = ballPos.y - defenderPos.y;
          const dz = ballPos.z - defenderPos.z;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

          // Defender collision box is taller
          if (!isNaN(distance) && distance < 1.5) {
            defenderHits.push({ ballId, defenderId });
          }
        });

        // Field Goal Detection - check if ball passes through the uprights
        // Ball must be: between uprights (X), above crossbar (Y), and past goal post Z
        if (ballPos.z <= GOAL_POST_CONFIG.z &&
            ballPos.x > GOAL_POST_CONFIG.leftUpright &&
            ballPos.x < GOAL_POST_CONFIG.rightUpright &&
            ballPos.y > GOAL_POST_CONFIG.crossbarY) {
          fieldGoals.push(ballId);
        }
      }

      // Remove if lifetime exceeded or fell below ground
      if (elapsed >= THROW_CONFIG.ballLifetime || ballPos.y < -2) {
        ballsToRemove.push(ballId);
        // Miss - reset multiplier (only if it didn't already score)
        if (!ball.hasHitGround) {
          this.handleMiss();
        }
      }
    });

    // Process receiver hits (scoring)
    receiverHits.forEach(({ ballId, receiverId }) => {
      this.handleReceiverHit(receiverId, ballId);
    });

    // Process defender hits (blocked)
    defenderHits.forEach(({ ballId, defenderId }) => {
      this.handleDefenderBlock(ballId);
    });

    // Process field goals (bonus points!)
    fieldGoals.forEach((ballId) => {
      this.handleFieldGoal(ballId);
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

  private handleReceiverHit(receiverId: string, ballId: string): void {
    const receiver = this.gameState.activeReceivers.get(receiverId);
    const ball = this.gameState.activeBalls.get(ballId);

    if (!receiver || !ball || receiver.isHit) return;
    receiver.isHit = true;

    // Calculate points based on depth (Player at Z=25, lower Z = further from QB)
    const archetype = receiver.archetype;
    let basePoints: number;
    // Higher Z = closer to player (short), lower Z = further (deep)
    if (receiver.depthZ >= archetype.depthShortMaxZ) {
      basePoints = archetype.basePointsShort;  // e.g., Z > 10 = short
    } else if (receiver.depthZ >= archetype.depthMediumMaxZ) {
      basePoints = archetype.basePointsMedium; // e.g., Z 10 to -5 = medium
    } else {
      basePoints = archetype.basePointsDeep;   // e.g., Z < -5 = deep
    }

    const points = Math.floor(basePoints * this.gameState.multiplier);

    // Update game state
    this.gameState.score += points;
    this.gameState.successfulHits++;
    this.gameState.currentStreak++;
    this.gameState.bestStreak = Math.max(this.gameState.bestStreak, this.gameState.currentStreak);

    // Increase multiplier
    this.gameState.multiplier = Math.min(
      this.gameState.multiplierMax,
      this.gameState.multiplier + this.gameState.multiplierStep
    );

    // Update player state
    const playerState = this.gameState.playerStates.get(ball.thrownBy.id);
    if (playerState) {
      playerState.score += points;
      playerState.combo++;
      playerState.successfulHits++;
      playerState.maxCombo = Math.max(playerState.maxCombo, playerState.combo);
    }

    console.log(`[GameManager] Receiver hit! +${points} pts (${this.gameState.multiplier.toFixed(1)}x multiplier, ${this.gameState.currentStreak} streak)`);

    // Check for streak-based crowd cheers
    this.checkStreakCheers(this.gameState.currentStreak);

    // Remove receiver and ball
    if (receiver.entity.isSpawned) receiver.entity.despawn();
    this.gameState.activeReceivers.delete(receiverId);

    if (ball.entity.isSpawned) ball.entity.despawn();
    this.gameState.activeBalls.delete(ballId);
  }

  private handleDefenderBlock(ballId: string): void {
    const ball = this.gameState.activeBalls.get(ballId);
    if (!ball) return;

    this.gameState.blockedThrows++;

    // Deduct points for interception (don't go below 0)
    const penalty = INTERCEPTION_CONFIG.pointPenalty;
    this.gameState.score = Math.max(0, this.gameState.score - penalty);

    console.log(`[GameManager] INTERCEPTION! -${penalty} pts (${this.gameState.blockedThrows} total interceptions)`);

    // Reset multiplier and streak on interception
    this.gameState.multiplier = 1.0;
    this.gameState.currentStreak = 0;

    const playerState = this.gameState.playerStates.get(ball.thrownBy.id);
    if (playerState) {
      playerState.combo = 0;
      playerState.score = Math.max(0, playerState.score - penalty);

      // Send interception notification to the player
      this.sendInterceptionNotification(ball.thrownBy, penalty);
    }

    // Play interception sound effect
    this.playInterceptionSound();

    // Remove ball
    if (ball.entity.isSpawned) ball.entity.despawn();
    this.gameState.activeBalls.delete(ballId);
  }

  private sendInterceptionNotification(player: Player, penalty: number): void {
    const state = this.gameState.playerStates.get(player.id);
    if (!state) return;

    const accuracy = this.gameState.totalThrows > 0
      ? (this.gameState.successfulHits / this.gameState.totalThrows) * 100
      : 100;

    const timeRemaining = Math.ceil(this.gameState.timeRemainingSeconds);

    player.ui.sendData({
      type: 'game_update',
      state: this.gameState.state,
      score: this.gameState.score,
      combo: this.gameState.currentStreak,
      timeRemaining: isNaN(timeRemaining) ? 0 : timeRemaining,
      chargePower: isNaN(state.chargePower) ? 0 : state.chargePower,
      accuracy: isNaN(accuracy) ? 100 : Math.round(accuracy),
      roundNumber: 1,
      notification: {
        message: 'INTERCEPTION!',
        type: 'negative',
        points: -penalty,
      },
    });
  }

  private playInterceptionSound(): void {
    try {
      new Audio({
        uri: INTERCEPTION_CONFIG.soundUri,
        volume: INTERCEPTION_CONFIG.soundVolume,
      }).play(this.world);
    } catch (error) {
      // Sound file may not exist yet, log but don't crash
      console.log('[GameManager] Interception sound not found, skipping audio');
    }
  }

  private playThrowSound(): void {
    try {
      new Audio({
        uri: THROW_SOUND_CONFIG.soundUri,
        volume: THROW_SOUND_CONFIG.soundVolume,
      }).play(this.world);
    } catch (error) {
      // Sound file may not exist yet, log but don't crash
      console.log('[GameManager] Throw sound not found, skipping audio');
    }
  }

  private playSlightCheer(): void {
    try {
      new Audio({
        uri: CROWD_CHEER_CONFIG.slightCheer.soundUri,
        volume: CROWD_CHEER_CONFIG.slightCheer.soundVolume,
      }).play(this.world);
      console.log('[GameManager] Slight crowd cheer! 3 hits in a row!');
    } catch (error) {
      console.log('[GameManager] Slight cheer sound not found, skipping audio');
    }
  }

  private playLargeCheer(): void {
    try {
      new Audio({
        uri: CROWD_CHEER_CONFIG.largeCheer.soundUri,
        volume: CROWD_CHEER_CONFIG.largeCheer.soundVolume,
      }).play(this.world);
      console.log('[GameManager] Large crowd cheer! 5 hits in a row!');
    } catch (error) {
      console.log('[GameManager] Large cheer sound not found, skipping audio');
    }
  }

  private checkStreakCheers(streak: number): void {
    // Play large cheer at exactly 5 (and every 5 after: 10, 15, etc.)
    if (streak > 0 && streak % CROWD_CHEER_CONFIG.largeCheer.streakThreshold === 0) {
      this.playLargeCheer();
    }
    // Play slight cheer at exactly 3 (but not if we're at a large cheer milestone)
    else if (streak === CROWD_CHEER_CONFIG.slightCheer.streakThreshold) {
      this.playSlightCheer();
    }
  }

  private playBallGroundSound(): void {
    try {
      new Audio({
        uri: BALL_GROUND_CONFIG.soundUri,
        volume: BALL_GROUND_CONFIG.soundVolume,
      }).play(this.world);
    } catch (error) {
      console.log('[GameManager] Ball ground sound not found, skipping audio');
    }
  }

  private handleMiss(): void {
    // Reset multiplier and streak on miss
    this.gameState.multiplier = 1.0;
    this.gameState.currentStreak = 0;
  }

  private handleFieldGoal(ballId: string): void {
    const ball = this.gameState.activeBalls.get(ballId);
    if (!ball) return;

    // Award field goal points with multiplier
    const points = Math.floor(GOAL_POST_CONFIG.points * this.gameState.multiplier);

    // Update game state
    this.gameState.score += points;
    this.gameState.successfulHits++;
    this.gameState.currentStreak++;
    this.gameState.bestStreak = Math.max(this.gameState.bestStreak, this.gameState.currentStreak);

    // Increase multiplier (field goals boost it extra)
    this.gameState.multiplier = Math.min(
      this.gameState.multiplierMax,
      this.gameState.multiplier + this.gameState.multiplierStep * 2 // Double multiplier boost for field goal
    );

    // Update player state
    const playerState = this.gameState.playerStates.get(ball.thrownBy.id);
    if (playerState) {
      playerState.score += points;
      playerState.combo++;
      playerState.successfulHits++;
      playerState.maxCombo = Math.max(playerState.maxCombo, playerState.combo);
    }

    console.log(`[GameManager] FIELD GOAL! +${points} pts (${this.gameState.multiplier.toFixed(1)}x multiplier)`);

    // Remove ball
    if (ball.entity.isSpawned) ball.entity.despawn();
    this.gameState.activeBalls.delete(ballId);
  }

  // ============================================
  // Player Input & Throwing
  // ============================================
  private updatePlayerCharging(dt: number): void {
    if (typeof dt !== 'number' || isNaN(dt) || dt <= 0) return;

    this.gameState.playerStates.forEach((state) => {
      if (state.isCharging) {
        const newPower = state.chargePower + THROW_CONFIG.chargeRate * dt;
        state.chargePower = isNaN(newPower) ? state.chargePower : Math.min(1, newPower);
      }
    });
  }

  public startCharge(player: Player): void {
    const state = this.gameState.playerStates.get(player.id);
    if (!state || this.gameState.state !== GameState.PLAYING) return;

    const now = Date.now();
    if (now - state.lastThrowTime < THROW_CONFIG.throwCooldown * 1000) return;

    state.isCharging = true;
    state.chargeStartTime = now;
    state.chargePower = 0;
  }

  public releaseThrow(player: Player): void {
    const state = this.gameState.playerStates.get(player.id);
    if (!state || !state.isCharging || this.gameState.state !== GameState.PLAYING) return;

    state.isCharging = false;
    const power = Math.max(0.2, state.chargePower);
    state.chargePower = 0;
    state.lastThrowTime = Date.now();
    state.totalThrows++;
    this.gameState.totalThrows++;

    const playerPos = state.playerEntity.position;
    if (!playerPos || typeof playerPos.x !== 'number') {
      console.log('[GameManager] Invalid player position for throw');
      return;
    }

    const yaw = typeof player.camera?.orientation?.yaw === 'number' ? player.camera.orientation.yaw : 0;
    const pitch = typeof player.camera?.orientation?.pitch === 'number' ? player.camera.orientation.pitch : 0;

    // Direction vector (Hytopia: -Z is forward)
    const dirX = -Math.sin(yaw) * Math.cos(pitch);
    const dirY = Math.sin(pitch);
    const dirZ = -Math.cos(yaw) * Math.cos(pitch);

    const speed = THROW_CONFIG.minPower + power * (THROW_CONFIG.maxPower - THROW_CONFIG.minPower);
    const velocity = {
      x: dirX * speed,
      y: dirY * speed + 5,
      z: dirZ * speed,
    };

    console.log(`[GameManager] Throw - power: ${power.toFixed(2)}, speed: ${speed.toFixed(1)}`);
    this.spawnFootball(player, playerPos, velocity);
  }

  private spawnFootball(player: Player, position: { x: number; y: number; z: number }, velocity: { x: number; y: number; z: number }): void {
    const ballId = `football_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate initial rotation using proper quaternion alignment
    // This aligns the football's nose (+X axis) with the velocity direction
    const initialRotation = createAlignmentQuaternion(velocity);

    const footballEntity = new Entity({
      name: ballId,
      modelUri: 'models/football/scene.gltf',
      modelScale: 0.00375,
      rigidBodyOptions: {
        type: RigidBodyType.DYNAMIC,
        linearVelocity: velocity,
        gravityScale: 1.0,
        ccdEnabled: true,
        enabledRotations: { x: false, y: false, z: false }, // We control rotation manually for spiral
        rotation: initialRotation,
        colliders: [
          {
            shape: ColliderShape.BALL,
            radius: 0.15,
            bounciness: 0.6, // Add bounce when hitting ground
            // Football only collides with blocks, not players or other entities
            collisionGroups: {
              belongsTo: [CollisionGroup.GROUP_1], // Custom group for footballs
              collidesWith: [CollisionGroup.BLOCK], // Only collide with world blocks
            },
          },
        ],
      },
    });

    const spawnPos = {
      x: position.x + velocity.x * 0.05,
      y: position.y + 1.5,
      z: position.z + velocity.z * 0.05,
    };

    footballEntity.spawn(this.world, spawnPos);

    // Play throw sound effect
    this.playThrowSound();

    const ballData: FootballData = {
      id: ballId,
      entity: footballEntity,
      spawnTime: Date.now(),
      thrownBy: player,
      initialVelocity: velocity,
      hasHitGround: false,
      spiralAngle: 0, // Start with no spiral rotation
    };

    this.gameState.activeBalls.set(ballId, ballData);
    console.log(`[GameManager] ${player.username} threw football`);
  }

  // ============================================
  // UI Updates
  // ============================================
  private sendUIUpdate(player: Player): void {
    const state = this.gameState.playerStates.get(player.id);
    if (!state) return;

    const accuracy = this.gameState.totalThrows > 0
      ? (this.gameState.successfulHits / this.gameState.totalThrows) * 100
      : 100;

    const timeRemaining = this.gameState.state === GameState.COUNTDOWN
      ? Math.ceil(this.gameState.timeRemainingSeconds)
      : Math.ceil(this.gameState.timeRemainingSeconds);

    const uiData: UIUpdateData = {
      type: 'game_update',
      state: this.gameState.state,
      score: this.gameState.score,
      combo: this.gameState.currentStreak,
      timeRemaining: isNaN(timeRemaining) ? 0 : timeRemaining,
      chargePower: isNaN(state.chargePower) ? 0 : state.chargePower,
      accuracy: isNaN(accuracy) ? 100 : Math.round(accuracy),
      roundNumber: 1,
    };

    player.ui.sendData(uiData);
  }

  private broadcastUIUpdate(): void {
    this.gameState.playerStates.forEach((state) => {
      this.sendUIUpdate(state.player);
    });
  }

  public getState(): MegatouchGameState {
    return this.gameState;
  }

  public dispose(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    this.gameState.activeReceivers.forEach((receiver) => {
      if (receiver.entity.isSpawned) receiver.entity.despawn();
    });
    this.gameState.activeDefenders.forEach((defender) => {
      if (defender.entity.isSpawned) defender.entity.despawn();
    });
    this.gameState.activeBalls.forEach((ball) => {
      if (ball.entity.isSpawned) ball.entity.despawn();
    });
  }
}
