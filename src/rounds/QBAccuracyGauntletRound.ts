/**
 * QBAccuracyGauntletRound - Multiple targets challenge
 * Players throw at multiple static targets scattered across the field.
 * Hit as many as possible with combo bonuses for speed!
 */

import {
  World,
  Entity,
  Player,
  RigidBodyType,
  ColliderShape,
  CollisionGroup,
} from 'hytopia';

import { BaseRound } from './BaseRound';
import type { MultiRoundGameManager } from '../MultiRoundGameManager';
import {
  SPIRAL_CONFIG,
  createAlignmentQuaternion,
  createAxisAngleQuaternion,
  multiplyQuaternions,
} from '../utils/QuaternionUtils';

// Target configurations - different sizes and point values
const TARGET_CONFIGS = {
  large: {
    id: 'large',
    points: 50,
    modelScale: 0.15,
    hitRadius: 1.5,
  },
  medium: {
    id: 'medium',
    points: 100,
    modelScale: 0.10,
    hitRadius: 1.0,
  },
  small: {
    id: 'small',
    points: 200,
    modelScale: 0.07,
    hitRadius: 0.7,
  },
  tiny: {
    id: 'tiny',
    points: 400,
    modelScale: 0.05,
    hitRadius: 0.5,
  },
};

// Wave configurations - each wave has a set of targets
const WAVE_CONFIGS = [
  // Wave 1: Easy - large targets, close
  {
    name: 'Warm Up',
    targets: [
      { type: 'large', x: -4, z: 10 },
      { type: 'large', x: 4, z: 10 },
      { type: 'large', x: 0, z: 5 },
    ],
    bonusTime: 15,
  },
  // Wave 2: Medium mix
  {
    name: 'Getting Started',
    targets: [
      { type: 'large', x: -6, z: 5 },
      { type: 'medium', x: 0, z: 0 },
      { type: 'large', x: 6, z: 5 },
      { type: 'medium', x: -3, z: -5 },
      { type: 'medium', x: 3, z: -5 },
    ],
    bonusTime: 20,
  },
  // Wave 3: More targets, varying distances
  {
    name: 'Spread Formation',
    targets: [
      { type: 'medium', x: -8, z: 10 },
      { type: 'small', x: 0, z: 10 },
      { type: 'medium', x: 8, z: 10 },
      { type: 'medium', x: -5, z: 0 },
      { type: 'small', x: 5, z: 0 },
      { type: 'large', x: 0, z: -10 },
    ],
    bonusTime: 25,
  },
  // Wave 4: Small targets challenge
  {
    name: 'Precision Required',
    targets: [
      { type: 'small', x: -7, z: 5 },
      { type: 'small', x: -3, z: -5 },
      { type: 'tiny', x: 0, z: 0 },
      { type: 'small', x: 3, z: -5 },
      { type: 'small', x: 7, z: 5 },
      { type: 'medium', x: 0, z: -15 },
    ],
    bonusTime: 25,
  },
  // Wave 5: Deep targets
  {
    name: 'Long Range',
    targets: [
      { type: 'large', x: -6, z: -10 },
      { type: 'medium', x: 0, z: -15 },
      { type: 'large', x: 6, z: -10 },
      { type: 'small', x: -3, z: -20 },
      { type: 'small', x: 3, z: -20 },
      { type: 'tiny', x: 0, z: -25 },
    ],
    bonusTime: 30,
  },
  // Wave 6: Scatter pattern
  {
    name: 'Scatter Shot',
    targets: [
      { type: 'medium', x: -8, z: 8 },
      { type: 'small', x: 5, z: 3 },
      { type: 'tiny', x: -4, z: -2 },
      { type: 'medium', x: 7, z: -7 },
      { type: 'small', x: -6, z: -12 },
      { type: 'tiny', x: 2, z: -18 },
      { type: 'small', x: -2, z: -25 },
    ],
    bonusTime: 35,
  },
  // Wave 7: Ultimate challenge
  {
    name: 'Ultimate Gauntlet',
    targets: [
      { type: 'small', x: -9, z: 5 },
      { type: 'tiny', x: -5, z: 0 },
      { type: 'small', x: 0, z: 5 },
      { type: 'tiny', x: 5, z: 0 },
      { type: 'small', x: 9, z: 5 },
      { type: 'tiny', x: -7, z: -10 },
      { type: 'tiny', x: 0, z: -15 },
      { type: 'tiny', x: 7, z: -10 },
      { type: 'small', x: 0, z: -25 },
    ],
    bonusTime: 40,
  },
];

interface TargetData {
  id: string;
  entity: Entity;
  config: typeof TARGET_CONFIGS[keyof typeof TARGET_CONFIGS];
  position: { x: number; y: number; z: number };
  isHit: boolean;
  spawnTime: number;
}

interface FootballData {
  id: string;
  entity: Entity;
  spawnTime: number;
  thrownBy: string;
  initialVelocity: { x: number; y: number; z: number };
  hasHitGround: boolean;
  spiralAngle: number;
}

interface PlayerGauntletState {
  playerId: string;
  currentWave: number;
  targetsHit: number;
  totalTargets: number;
  combo: number;
  lastHitTime: number;
  waveStartTime: number;
  isCharging: boolean;
  chargePower: number;
}

// Constants
const COMBO_WINDOW_MS = 2000; // 2 seconds to maintain combo
const COMBO_MULTIPLIER_MAX = 5;
const TARGET_HEIGHT = 2.0; // Height above ground for targets
const WAVE_TRANSITION_DELAY = 2000; // 2 seconds between waves

export class QBAccuracyGauntletRound extends BaseRound {
  private targets: Map<string, TargetData> = new Map();
  private footballs: Map<string, FootballData> = new Map();
  private playerStates: Map<string, PlayerGauntletState> = new Map();
  private waveTransitionTimer: number = 0;
  private isInTransition: boolean = false;

  public initialize(): void {
    console.log('[QBAccuracyGauntletRound] Initializing...');
    this.targets.clear();
    this.footballs.clear();
    this.playerStates.clear();
    this.waveTransitionTimer = 0;
    this.isInTransition = false;

    // Initialize player states
    this.getActivePlayers().forEach(playerId => {
      this.playerStates.set(playerId, {
        playerId,
        currentWave: 0,
        targetsHit: 0,
        totalTargets: 0,
        combo: 0,
        lastHitTime: 0,
        waveStartTime: 0,
        isCharging: false,
        chargePower: 0,
      });
    });
  }

  public start(): void {
    console.log('[QBAccuracyGauntletRound] Starting!');
    this.isActive = true;

    // Start first wave for all players
    this.playerStates.forEach((state, playerId) => {
      this.startWave(playerId, 0);
    });
  }

  public update(dt: number): void {
    if (!this.isActive) return;

    // Update charging
    this.updateCharging(dt);

    // Update footballs
    this.updateFootballs(dt);

    // Update combo decay
    this.updateCombos();

    // Handle wave transitions
    if (this.isInTransition) {
      this.waveTransitionTimer -= dt * 1000;
      if (this.waveTransitionTimer <= 0) {
        this.isInTransition = false;
        // Check if any players need new wave
        this.playerStates.forEach((state, playerId) => {
          if (state.targetsHit >= state.totalTargets && state.currentWave < WAVE_CONFIGS.length - 1) {
            this.startWave(playerId, state.currentWave + 1);
          }
        });
      }
    }
  }

  public end(): void {
    console.log('[QBAccuracyGauntletRound] Ending...');
    this.isActive = false;
  }

  public override cleanup(): void {
    super.cleanup();
    this.targets.clear();
    this.footballs.clear();
    this.playerStates.clear();
  }

  // ============================================
  // Wave Management
  // ============================================

  private startWave(playerId: string, waveIndex: number): void {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    // Clamp wave index
    const actualWaveIndex = Math.min(waveIndex, WAVE_CONFIGS.length - 1);
    const wave = WAVE_CONFIGS[actualWaveIndex];

    state.currentWave = actualWaveIndex;
    state.targetsHit = 0;
    state.totalTargets = wave.targets.length;
    state.waveStartTime = Date.now();
    state.combo = 0;

    console.log(`[QBAccuracyGauntlet] Starting Wave ${actualWaveIndex + 1}: ${wave.name}`);

    // Spawn targets for this wave
    wave.targets.forEach((targetDef, index) => {
      this.spawnTarget(playerId, targetDef, index);
    });

    // Notify player
    const playerEntity = this.gameManager.getPlayerEntity(playerId);
    if (playerEntity && 'player' in playerEntity) {
      (playerEntity as any).player.ui.sendData({
        type: 'wave_start',
        wave: actualWaveIndex + 1,
        totalWaves: WAVE_CONFIGS.length,
        waveName: wave.name,
        targetCount: wave.targets.length,
      });
    }
  }

  private spawnTarget(playerId: string, targetDef: { type: string; x: number; z: number }, index: number): void {
    const config = TARGET_CONFIGS[targetDef.type as keyof typeof TARGET_CONFIGS];
    if (!config) return;

    const targetId = `target_${playerId}_${Date.now()}_${index}`;

    const targetEntity = new Entity({
      name: targetId,
      modelUri: 'models/bullseye/scene.gltf',
      modelScale: config.modelScale,
    });

    const position = {
      x: targetDef.x,
      y: TARGET_HEIGHT,
      z: targetDef.z,
    };

    this.spawnEntity(targetEntity, position);

    this.targets.set(targetId, {
      id: targetId,
      entity: targetEntity,
      config,
      position,
      isHit: false,
      spawnTime: Date.now(),
    });
  }

  private checkWaveComplete(playerId: string): void {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    if (state.targetsHit >= state.totalTargets) {
      const wave = WAVE_CONFIGS[state.currentWave];
      const timeTaken = (Date.now() - state.waveStartTime) / 1000;

      // Time bonus for fast completion
      let timeBonus = 0;
      if (timeTaken < wave.bonusTime) {
        const bonusPercent = (wave.bonusTime - timeTaken) / wave.bonusTime;
        timeBonus = Math.floor(500 * bonusPercent);
        this.addScore(playerId, timeBonus);
      }

      console.log(`[QBAccuracyGauntlet] Wave ${state.currentWave + 1} complete! Time: ${timeTaken.toFixed(1)}s, Bonus: ${timeBonus}`);

      // Notify player
      const playerEntity = this.gameManager.getPlayerEntity(playerId);
      if (playerEntity && 'player' in playerEntity) {
        (playerEntity as any).player.ui.sendData({
          type: 'wave_complete',
          wave: state.currentWave + 1,
          timeTaken,
          timeBonus,
          nextWave: state.currentWave < WAVE_CONFIGS.length - 1,
        });
      }

      this.playSound('audio/sfx/large-cheer.wav', 0.7);

      // Start transition to next wave
      if (state.currentWave < WAVE_CONFIGS.length - 1) {
        this.isInTransition = true;
        this.waveTransitionTimer = WAVE_TRANSITION_DELAY;
      } else {
        // All waves complete!
        console.log(`[QBAccuracyGauntlet] All waves complete for ${playerId}!`);

        // Perfect game bonus
        this.addScore(playerId, 1000);

        if (playerEntity && 'player' in playerEntity) {
          (playerEntity as any).player.ui.sendData({
            type: 'gauntlet_complete',
            perfectBonus: 1000,
          });
        }
      }
    }
  }

  // ============================================
  // Football Updates
  // ============================================

  private updateFootballs(dt: number): void {
    const toRemove: string[] = [];
    const now = Date.now();

    this.footballs.forEach((ball, ballId) => {
      const elapsed = (now - ball.spawnTime) / 1000;
      const ballPos = ball.entity.position;

      if (!ballPos) {
        toRemove.push(ballId);
        return;
      }

      // Update spiral rotation
      ball.spiralAngle += SPIRAL_CONFIG.radiansPerSecond * dt;

      // Get current velocity for alignment
      const rigidBody = ball.entity.rawRigidBody;
      let currentVelocity = ball.initialVelocity;
      if (rigidBody) {
        const vel = rigidBody.linvel();
        currentVelocity = { x: vel.x, y: vel.y, z: vel.z };
      }

      // Apply spiral rotation
      const alignQuat = createAlignmentQuaternion(currentVelocity);
      const spiralQuat = createAxisAngleQuaternion({ x: 1, y: 0, z: 0 }, ball.spiralAngle);
      const finalQuat = multiplyQuaternions(alignQuat, spiralQuat);
      ball.entity.setRotation(finalQuat);

      // Check ground hit
      if (!ball.hasHitGround && ballPos.y <= 1.0) {
        ball.hasHitGround = true;
        this.playSound('audio/sfx/ball-ground.wav', 0.5);

        // Miss - reset combo
        const state = this.playerStates.get(ball.thrownBy);
        if (state) {
          state.combo = 0;
        }
      }

      // Check target collisions
      if (!ball.hasHitGround) {
        this.targets.forEach((target, targetId) => {
          if (target.isHit) return;

          const dist = this.distance(ballPos, target.position);
          if (dist < target.config.hitRadius + 0.3) {
            this.handleTargetHit(targetId, ballId, ball.thrownBy);
          }
        });
      }

      // Remove if lifetime exceeded or fell too far
      if (elapsed >= 5 || ballPos.y < -2) {
        toRemove.push(ballId);
      }
    });

    toRemove.forEach(id => {
      const ball = this.footballs.get(id);
      if (ball) {
        this.despawnEntity(ball.entity);
        this.footballs.delete(id);
      }
    });
  }

  private handleTargetHit(targetId: string, ballId: string, playerId: string): void {
    const target = this.targets.get(targetId);
    const ball = this.footballs.get(ballId);
    const state = this.playerStates.get(playerId);

    if (!target || !ball || !state || target.isHit) return;
    target.isHit = true;

    const now = Date.now();

    // Update combo
    if (now - state.lastHitTime < COMBO_WINDOW_MS) {
      state.combo = Math.min(state.combo + 1, COMBO_MULTIPLIER_MAX);
    } else {
      state.combo = 1;
    }
    state.lastHitTime = now;

    // Calculate points with combo multiplier
    const comboMultiplier = 1 + (state.combo - 1) * 0.25; // 1x, 1.25x, 1.5x, 1.75x, 2x
    const points = Math.floor(target.config.points * comboMultiplier);

    this.addScore(playerId, points);
    state.targetsHit++;

    // Update player stats
    this.gameManager.updatePlayerStats(playerId, {
      successfulHits: (this.gameManager.getState().playerScores.get(playerId)?.stats.successfulHits || 0) + 1,
    });

    console.log(`[QBAccuracyGauntlet] Hit! +${points} pts (${state.combo}x combo, ${state.targetsHit}/${state.totalTargets})`);

    // Combo feedback sounds
    if (state.combo >= 3) {
      this.playSound('audio/sfx/slight-cheer.wav', 0.4 + state.combo * 0.1);
    }

    // Notify player
    const playerEntity = this.gameManager.getPlayerEntity(playerId);
    if (playerEntity && 'player' in playerEntity) {
      (playerEntity as any).player.ui.sendData({
        type: 'target_hit',
        points,
        combo: state.combo,
        targetsHit: state.targetsHit,
        totalTargets: state.totalTargets,
      });
    }

    // Remove target and ball
    this.despawnEntity(target.entity);
    this.targets.delete(targetId);
    this.despawnEntity(ball.entity);
    this.footballs.delete(ballId);

    // Check if wave complete
    this.checkWaveComplete(playerId);
  }

  // ============================================
  // Combo System
  // ============================================

  private updateCombos(): void {
    const now = Date.now();

    this.playerStates.forEach((state, playerId) => {
      if (state.combo > 0 && now - state.lastHitTime > COMBO_WINDOW_MS) {
        state.combo = 0;

        // Notify player combo ended
        const playerEntity = this.gameManager.getPlayerEntity(playerId);
        if (playerEntity && 'player' in playerEntity) {
          (playerEntity as any).player.ui.sendData({
            type: 'combo_end',
          });
        }
      }
    });
  }

  // ============================================
  // Player Input
  // ============================================

  private updateCharging(dt: number): void {
    this.playerStates.forEach((state, playerId) => {
      if (state.isCharging) {
        state.chargePower = Math.min(1, state.chargePower + 1.5 * dt);

        // Send charge power update to UI
        const playerEntity = this.gameManager.getPlayerEntity(playerId);
        if (playerEntity && 'player' in playerEntity) {
          (playerEntity as any).player.ui.sendData({
            type: 'game_update',
            chargePower: state.chargePower,
          });
        }
      }
    });
  }

  public startCharge(playerId: string): void {
    if (!this.isActive) return;

    const state = this.playerStates.get(playerId);
    if (!state) return;

    state.isCharging = true;
    state.chargePower = 0;
  }

  public releaseThrow(playerId: string, player: Player): void {
    if (!this.isActive) return;

    const state = this.playerStates.get(playerId);
    if (!state || !state.isCharging) return;

    state.isCharging = false;
    const power = Math.max(0.2, state.chargePower);
    state.chargePower = 0;

    const playerEntity = this.gameManager.getPlayerEntity(playerId);
    if (!playerEntity) return;

    // Reset charge UI
    if ('player' in playerEntity) {
      (playerEntity as any).player.ui.sendData({
        type: 'game_update',
        chargePower: 0,
      });
    }

    const playerPos = playerEntity.position;
    const yaw = player.camera?.orientation?.yaw || 0;
    const pitch = player.camera?.orientation?.pitch || 0;

    // Direction vector
    const dirX = -Math.sin(yaw) * Math.cos(pitch);
    const dirY = Math.sin(pitch);
    const dirZ = -Math.cos(yaw) * Math.cos(pitch);

    const speed = 10 + power * 25;
    const velocity = {
      x: dirX * speed,
      y: dirY * speed + 5,
      z: dirZ * speed,
    };

    this.spawnFootball(playerId, playerPos, velocity);

    // Update stats
    this.gameManager.updatePlayerStats(playerId, {
      totalThrows: (this.gameManager.getState().playerScores.get(playerId)?.stats.totalThrows || 0) + 1,
    });

    this.playSound('audio/sfx/ball-wind.wav', 0.6);
  }

  private spawnFootball(playerId: string, position: any, velocity: any): void {
    const ballId = `football_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const footballEntity = new Entity({
      name: ballId,
      modelUri: 'models/football/scene.gltf',
      modelScale: 0.00375,
      rigidBodyOptions: {
        type: RigidBodyType.DYNAMIC,
        linearVelocity: velocity,
        gravityScale: 1.0,
        ccdEnabled: true,
        enabledRotations: { x: false, y: false, z: false },
        colliders: [
          {
            shape: ColliderShape.BALL,
            radius: 0.15,
            bounciness: 0.6,
            collisionGroups: {
              belongsTo: [CollisionGroup.GROUP_1],
              collidesWith: [CollisionGroup.BLOCK],
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

    // Set initial rotation to align with throw direction
    const initialRotation = createAlignmentQuaternion(velocity);
    this.spawnEntity(footballEntity, spawnPos, initialRotation);

    const ballData: FootballData = {
      id: ballId,
      entity: footballEntity,
      spawnTime: Date.now(),
      thrownBy: playerId,
      initialVelocity: velocity,
      hasHitGround: false,
      spiralAngle: 0,
    };

    this.footballs.set(ballId, ballData);
  }

  // External access for player input
  public handlePlayerInput(playerId: string, player: Player, inputType: 'start' | 'release'): void {
    if (inputType === 'start') {
      this.startCharge(playerId);
    } else {
      this.releaseThrow(playerId, player);
    }
  }
}

export default QBAccuracyGauntletRound;
