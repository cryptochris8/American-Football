/**
 * HailMaryRound - Throw deep passes to a moving receiver
 * One chance for glory! Maximum distance = maximum points
 */

import {
  World,
  Entity,
  Player,
  RigidBodyType,
  ColliderShape,
  CollisionGroup,
  Quaternion,
} from 'hytopia';

import { BaseRound } from './BaseRound';
import type { MultiRoundGameManager } from '../MultiRoundGameManager';
import { ReceiverNPC } from '../entities/ReceiverNPC';
import {
  SPIRAL_CONFIG,
  createAlignmentQuaternion,
  createAxisAngleQuaternion,
  multiplyQuaternions,
} from '../utils/QuaternionUtils';

// Receiver patterns for Hail Mary
const RECEIVER_PATTERNS = [
  { startX: -8, endX: 8, z: -25, speed: 4 },
  { startX: 8, endX: -8, z: -30, speed: 5 },
  { startX: -10, endX: 10, z: -35, speed: 6 },
  { startX: 0, endX: 0, z: -40, speed: 0 }, // Stationary deep
];

// Points based on catch distance
const DISTANCE_POINTS = [
  { minZ: -20, maxZ: -10, points: 200, name: 'Short' },
  { minZ: -30, maxZ: -20, points: 400, name: 'Medium' },
  { minZ: -40, maxZ: -30, points: 700, name: 'Deep' },
  { minZ: -50, maxZ: -40, points: 1000, name: 'Hail Mary!' },
];

// Bonus points for perfect catches
const PERFECT_CATCH_BONUS = 250;

interface ActiveReceiver {
  id: string;
  entity: ReceiverNPC;
  pattern: typeof RECEIVER_PATTERNS[0];
  direction: 1 | -1;
  spawnTime: number;
}

interface ActiveThrow {
  id: string;
  entity: Entity;
  playerId: string;
  spawnTime: number;
  initialVelocity: { x: number; y: number; z: number };
  spiralAngle: number;
}

interface PlayerThrowState {
  playerId: string;
  throwsRemaining: number;
  bestCatchDistance: number;
  bestPoints: number;
  totalCatches: number;
  isCharging: boolean;
  chargePower: number;
  lastThrowTime: number;
}

const THROWS_PER_PLAYER = 5;
const CATCH_RADIUS = 3.0;
const QB_POSITION_Z = 25;
const QB_POSITION = { x: 0, y: 2, z: QB_POSITION_Z };

export class HailMaryRound extends BaseRound {
  private receivers: Map<string, ActiveReceiver> = new Map();
  private activeThrows: Map<string, ActiveThrow> = new Map();
  private playerStates: Map<string, PlayerThrowState> = new Map();
  private receiverSpawnTimer: number = 0;
  private elapsedTime: number = 0;

  public initialize(): void {
    console.log('[HailMaryRound] Initializing...');
    this.receivers.clear();
    this.activeThrows.clear();
    this.playerStates.clear();
    this.receiverSpawnTimer = 0;
    this.elapsedTime = 0;

    // Initialize player states and position players at QB position
    this.getActivePlayers().forEach(playerId => {
      this.playerStates.set(playerId, {
        playerId,
        throwsRemaining: THROWS_PER_PLAYER,
        bestCatchDistance: 0,
        bestPoints: 0,
        totalCatches: 0,
        isCharging: false,
        chargePower: 0,
        lastThrowTime: 0,
      });

      // Position player at QB position (facing toward receivers)
      const playerEntity = this.gameManager.getPlayerEntity(playerId);
      if (playerEntity) {
        playerEntity.setPosition(QB_POSITION);
        playerEntity.setRotation(Quaternion.fromEuler(0, 180, 0)); // Face toward receivers (negative Z)
        console.log(`[HailMaryRound] Positioned ${playerId} at QB position (z=${QB_POSITION_Z}), facing receivers`);

        // Notify player of throws remaining
        if ('player' in playerEntity) {
          (playerEntity as any).player.ui.sendData({
            type: 'hail_mary_start',
            throwsRemaining: THROWS_PER_PLAYER,
          });
        }
      }
    });
  }

  public start(): void {
    console.log('[HailMaryRound] Starting!');
    this.isActive = true;

    // Spawn initial receivers
    this.spawnReceivers();
  }

  public update(dt: number): void {
    if (!this.isActive) return;

    this.elapsedTime += dt;
    this.receiverSpawnTimer += dt;

    // Spawn new receivers periodically
    if (this.receiverSpawnTimer >= 3) {
      this.spawnReceivers();
      this.receiverSpawnTimer = 0;
    }

    // Update receivers
    this.updateReceivers(dt);

    // Update throws
    this.updateThrows(dt);

    // Update charging
    this.updateCharging(dt);
  }

  public end(): void {
    console.log('[HailMaryRound] Ending...');
    this.isActive = false;

    // Award bonus for best catches
    this.playerStates.forEach((state, playerId) => {
      if (state.bestPoints > 0) {
        console.log(`[HailMaryRound] ${playerId} best catch: ${state.bestCatchDistance.toFixed(0)} yards = ${state.bestPoints} pts`);
      }
    });
  }

  public override cleanup(): void {
    // Despawn all receivers
    this.receivers.forEach(receiver => {
      if (receiver.entity.isSpawned) {
        receiver.entity.despawn();
      }
    });
    this.receivers.clear();

    super.cleanup();
    this.activeThrows.clear();
    this.playerStates.clear();
  }

  // ============================================
  // Receiver Management
  // ============================================

  private spawnReceivers(): void {
    // Clear old receivers that are off-field
    const toRemove: string[] = [];
    this.receivers.forEach((receiver, id) => {
      const pos = receiver.entity.position;
      if (pos.x < -15 || pos.x > 15) {
        toRemove.push(id);
      }
    });
    toRemove.forEach(id => {
      const receiver = this.receivers.get(id);
      if (receiver && receiver.entity.isSpawned) {
        receiver.entity.despawn();
      }
      this.receivers.delete(id);
    });

    // Spawn new receivers
    RECEIVER_PATTERNS.forEach((pattern, index) => {
      const receiverId = `receiver_${Date.now()}_${index}`;

      // Skip if we already have a receiver at this depth
      let hasReceiverAtDepth = false;
      this.receivers.forEach(r => {
        if (Math.abs(r.pattern.z - pattern.z) < 5) {
          hasReceiverAtDepth = true;
        }
      });
      if (hasReceiverAtDepth) return;

      const receiver = new ReceiverNPC({
        speed: pattern.speed,
      });

      const startX = pattern.startX;
      const direction = pattern.endX > pattern.startX ? 1 : -1;

      this.spawnEntity(receiver, { x: startX, y: 2, z: pattern.z });
      receiver.playAnimation('run', true);

      this.receivers.set(receiverId, {
        id: receiverId,
        entity: receiver,
        pattern,
        direction: direction as 1 | -1,
        spawnTime: Date.now(),
      });
    });
  }

  private updateReceivers(dt: number): void {
    const toRemove: string[] = [];

    this.receivers.forEach((receiver, id) => {
      if (!receiver.entity.isSpawned) {
        toRemove.push(id);
        return;
      }

      // Move receiver horizontally if they have speed
      if (receiver.pattern.speed > 0) {
        const pos = receiver.entity.position;
        const newX = pos.x + receiver.direction * receiver.pattern.speed * dt;

        // Bounce at boundaries
        if (newX <= -10 || newX >= 10) {
          receiver.direction = -receiver.direction as 1 | -1;
        }

        receiver.entity.setPosition({
          x: Math.max(-10, Math.min(10, newX)),
          y: pos.y,
          z: pos.z,
        });
      }
    });

    toRemove.forEach(id => {
      const receiver = this.receivers.get(id);
      if (receiver && receiver.entity.isSpawned) {
        receiver.entity.despawn();
      }
      this.receivers.delete(id);
    });
  }

  // ============================================
  // Throw Mechanics
  // ============================================

  private updateCharging(dt: number): void {
    this.playerStates.forEach((state, playerId) => {
      if (state.isCharging) {
        state.chargePower = Math.min(1, state.chargePower + 0.8 * dt);

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
    console.log(`[HailMaryRound] startCharge called for ${playerId}, isActive=${this.isActive}`);
    if (!this.isActive) return;

    const state = this.playerStates.get(playerId);
    if (!state || state.throwsRemaining <= 0) {
      console.log(`[HailMaryRound] No state or no throws remaining for ${playerId}`);
      return;
    }

    const now = Date.now();
    if (now - state.lastThrowTime < 1500) {
      console.log(`[HailMaryRound] Cooldown active for ${playerId}`);
      return;
    }

    state.isCharging = true;
    state.chargePower = 0;
    console.log(`[HailMaryRound] Started charging for ${playerId}`);
  }

  public releaseThrow(playerId: string, player: Player): void {
    console.log(`[HailMaryRound] releaseThrow called for ${playerId}, isActive=${this.isActive}`);
    if (!this.isActive) return;

    const state = this.playerStates.get(playerId);
    if (!state || !state.isCharging || state.throwsRemaining <= 0) {
      console.log(`[HailMaryRound] Cannot throw - no state, not charging, or no throws`);
      return;
    }

    state.isCharging = false;
    const power = Math.max(0.5, state.chargePower);
    console.log(`[HailMaryRound] Throw power: ${power.toFixed(2)} (chargePower was ${state.chargePower.toFixed(2)})`);
    state.chargePower = 0;
    state.lastThrowTime = Date.now();
    state.throwsRemaining--;

    const playerEntity = this.gameManager.getPlayerEntity(playerId);
    if (!playerEntity) return;

    // Get throw direction
    const yaw = player.camera?.orientation?.yaw || 0;
    const pitch = player.camera?.orientation?.pitch || 0;
    console.log(`[HailMaryRound] Camera yaw=${yaw.toFixed(2)}, pitch=${pitch.toFixed(2)}`);

    // Hail Mary throws are powerful and high-arcing
    const basePower = 30 + power * 15;
    console.log(`[HailMaryRound] basePower=${basePower.toFixed(1)}, power=${power.toFixed(2)}`);

    const dirX = -Math.sin(yaw) * Math.cos(pitch);
    const dirY = Math.sin(pitch);
    const dirZ = -Math.cos(yaw) * Math.cos(pitch);

    const velocity = {
      x: dirX * basePower,
      y: Math.max(10, dirY * basePower + 12), // High arc
      z: dirZ * basePower,
    };
    console.log(`[HailMaryRound] Throw velocity: x=${velocity.x.toFixed(1)}, y=${velocity.y.toFixed(1)}, z=${velocity.z.toFixed(1)}`);

    this.spawnThrow(playerId, playerEntity.position, velocity);

    // Update stats
    this.gameManager.updatePlayerStats(playerId, {
      totalThrows: (this.gameManager.getState().playerScores.get(playerId)?.stats.totalThrows || 0) + 1,
    });

    this.playSound('audio/sfx/ball-wind.wav', 0.7);

    // Notify player of remaining throws
    if ('player' in playerEntity) {
      (playerEntity as any).player.ui.sendData({
        type: 'throw_made',
        throwsRemaining: state.throwsRemaining,
        power: Math.round(power * 100),
      });
    }
  }

  private spawnThrow(playerId: string, position: any, velocity: any): void {
    const throwId = `hailmary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const footballEntity = new Entity({
      name: throwId,
      modelUri: 'models/football/scene.gltf',
      modelScale: 0.004, // Slightly larger for visibility
      rigidBodyOptions: {
        type: RigidBodyType.DYNAMIC,
        linearVelocity: velocity,
        gravityScale: 0.8, // Slightly lower gravity for longer flight
        ccdEnabled: true,
        colliders: [
          {
            shape: ColliderShape.BALL,
            radius: 0.15,
            bounciness: 0.3,
            collisionGroups: {
              belongsTo: [CollisionGroup.GROUP_1],
              collidesWith: [CollisionGroup.BLOCK],
            },
          },
        ],
      },
    });

    const spawnPos = {
      x: position.x,
      y: position.y + 2,
      z: position.z - 1,
    };

    // Set initial rotation to align with throw direction
    const initialRotation = createAlignmentQuaternion(velocity);
    this.spawnEntity(footballEntity, spawnPos, initialRotation);

    this.activeThrows.set(throwId, {
      id: throwId,
      entity: footballEntity,
      playerId,
      spawnTime: Date.now(),
      initialVelocity: velocity,
      spiralAngle: 0,
    });
  }

  private updateThrows(dt: number): void {
    const toRemove: string[] = [];
    const now = Date.now();

    this.activeThrows.forEach((throwData, throwId) => {
      const elapsed = (now - throwData.spawnTime) / 1000;
      const ballPos = throwData.entity.position;

      // Update spiral rotation
      throwData.spiralAngle += SPIRAL_CONFIG.radiansPerSecond * dt;

      // Get current velocity for alignment
      const rigidBody = throwData.entity.rawRigidBody;
      let currentVelocity = throwData.initialVelocity;
      if (rigidBody) {
        const vel = rigidBody.linvel();
        currentVelocity = { x: vel.x, y: vel.y, z: vel.z };
      }

      // Apply spiral rotation (align to velocity + spin around nose)
      const alignQuat = createAlignmentQuaternion(currentVelocity);
      const spiralQuat = createAxisAngleQuaternion({ x: 1, y: 0, z: 0 }, throwData.spiralAngle);
      const finalQuat = multiplyQuaternions(alignQuat, spiralQuat);
      throwData.entity.setRotation(finalQuat);

      // Check for catches
      this.receivers.forEach((receiver, receiverId) => {
        if (!receiver.entity.isSpawned) return;

        const dist = this.distance(ballPos, receiver.entity.position);

        if (dist <= CATCH_RADIUS) {
          this.handleCatch(throwData.playerId, throwId, receiver);
          toRemove.push(throwId);
        }
      });

      // Remove if too old or hit ground
      if (elapsed >= 6 || ballPos.y < 1) {
        if (!toRemove.includes(throwId)) {
          this.handleIncomplete(throwData.playerId);
        }
        toRemove.push(throwId);
      }
    });

    toRemove.forEach(id => {
      const throwData = this.activeThrows.get(id);
      if (throwData) {
        this.despawnEntity(throwData.entity);
        this.activeThrows.delete(id);
      }
    });
  }

  // ============================================
  // Catch Handling
  // ============================================

  private handleCatch(playerId: string, throwId: string, receiver: ActiveReceiver): void {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    const receiverZ = receiver.entity.position.z;
    const catchDistance = QB_POSITION_Z - receiverZ;

    // Find points tier
    let points = 100;
    let tierName = 'Short';

    for (const tier of DISTANCE_POINTS) {
      if (receiverZ >= tier.minZ && receiverZ < tier.maxZ) {
        points = tier.points;
        tierName = tier.name;
        break;
      }
    }

    // Perfect catch bonus (if receiver wasn't moving much when caught)
    if (receiver.pattern.speed === 0 || Math.abs(receiver.entity.position.x) < 2) {
      points += PERFECT_CATCH_BONUS;
      tierName += ' (Perfect!)';
    }

    state.totalCatches++;
    if (points > state.bestPoints) {
      state.bestPoints = points;
      state.bestCatchDistance = catchDistance;
    }

    this.addScore(playerId, points);

    // Update stats
    this.gameManager.updatePlayerStats(playerId, {
      catchesMade: (this.gameManager.getState().playerScores.get(playerId)?.stats.catchesMade || 0) + 1,
      successfulHits: (this.gameManager.getState().playerScores.get(playerId)?.stats.successfulHits || 0) + 1,
    });

    console.log(`[HailMaryRound] CATCH! ${tierName} - ${catchDistance.toFixed(0)} yards = ${points} pts`);
    this.playSound('audio/sfx/large-cheer.wav', 0.8);

    // Notify player
    const playerEntity = this.gameManager.getPlayerEntity(playerId);
    if (playerEntity && 'player' in playerEntity) {
      (playerEntity as any).player.ui.sendData({
        type: 'catch',
        points,
        distance: Math.floor(catchDistance),
        tierName,
        totalCatches: state.totalCatches,
        bestDistance: Math.floor(state.bestCatchDistance),
      });
    }

    // Despawn the receiver that caught it
    if (receiver.entity.isSpawned) {
      receiver.entity.despawn();
    }
    this.receivers.delete(receiver.id);
  }

  private handleIncomplete(playerId: string): void {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    console.log(`[HailMaryRound] Incomplete pass. ${state.throwsRemaining} throws remaining`);
    this.playSound('audio/sfx/ball-ground.wav', 0.5);

    // Notify player
    const playerEntity = this.gameManager.getPlayerEntity(playerId);
    if (playerEntity && 'player' in playerEntity) {
      (playerEntity as any).player.ui.sendData({
        type: 'incomplete',
        throwsRemaining: state.throwsRemaining,
      });
    }
  }

  // ============================================
  // Player Input Handler
  // ============================================

  public handlePlayerInput(playerId: string, player: Player, inputType: 'start' | 'release'): void {
    if (inputType === 'start') {
      this.startCharge(playerId);
    } else {
      this.releaseThrow(playerId, player);
    }
  }
}

export default HailMaryRound;
