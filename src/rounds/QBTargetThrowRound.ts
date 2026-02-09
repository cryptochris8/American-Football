/**
 * QBTargetThrowRound - The original target throwing game mode
 * Players throw footballs at moving bullseye targets
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

// Receiver archetypes (bullseye targets)
const RECEIVER_ARCHETYPES = {
  receiver_xlarge: {
    id: 'receiver_xlarge',
    basePointsShort: 25,
    basePointsMedium: 40,
    basePointsDeep: 60,
    modelScale: 0.175,
    speed: 1.5,
  },
  receiver_large: {
    id: 'receiver_large',
    basePointsShort: 50,
    basePointsMedium: 75,
    basePointsDeep: 100,
    modelScale: 0.135,
    speed: 2.0,
  },
  receiver_medium: {
    id: 'receiver_medium',
    basePointsShort: 100,
    basePointsMedium: 150,
    basePointsDeep: 200,
    modelScale: 0.10,
    speed: 2.5,
  },
  receiver_small: {
    id: 'receiver_small',
    basePointsShort: 150,
    basePointsMedium: 225,
    basePointsDeep: 300,
    modelScale: 0.07,
    speed: 3.5,
  },
  receiver_tiny: {
    id: 'receiver_tiny',
    basePointsShort: 250,
    basePointsMedium: 350,
    basePointsDeep: 500,
    modelScale: 0.05,
    speed: 4.0,
    lifetime: 4.0,
  },
};

interface ReceiverData {
  id: string;
  entity: Entity;
  archetype: any;
  spawnTime: number;
  isHit: boolean;
  speed: number;
  direction: 1 | -1;
  depthZ: number;
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

interface DefenderData {
  id: string;
  entity: Entity;
  speed: number;
  direction: 1 | -1;
  depthZ: number;
}

// Constants
const MAX_RECEIVERS = 7;
const MAX_DEFENDERS = 5;
const SPAWN_INTERVAL_RECEIVER = 1.5;
const SPAWN_INTERVAL_DEFENDER = 2.5;
const THROW_GRAVITY = -15;
const FIELD_GOAL_POINTS = 500;

export class QBTargetThrowRound extends BaseRound {
  private receivers: Map<string, ReceiverData> = new Map();
  private defenders: Map<string, DefenderData> = new Map();
  private footballs: Map<string, FootballData> = new Map();
  private multiplier: number = 1.0;
  private streak: number = 0;
  private lastReceiverSpawn: number = 0;
  private lastDefenderSpawn: number = 0;
  private elapsedTime: number = 0;

  // Player charge states
  private playerCharging: Map<string, { isCharging: boolean; power: number; startTime: number }> = new Map();

  public initialize(): void {
    console.log('[QBTargetThrowRound] Initializing...');
    this.receivers.clear();
    this.defenders.clear();
    this.footballs.clear();
    this.multiplier = 1.0;
    this.streak = 0;
    this.lastReceiverSpawn = 0;
    this.lastDefenderSpawn = 0;
    this.elapsedTime = 0;
  }

  public start(): void {
    console.log('[QBTargetThrowRound] Starting!');
    this.isActive = true;
  }

  public update(dt: number): void {
    if (!this.isActive) return;

    this.elapsedTime += dt;

    // Spawn receivers
    if (this.elapsedTime - this.lastReceiverSpawn >= SPAWN_INTERVAL_RECEIVER) {
      if (this.receivers.size < MAX_RECEIVERS) {
        this.spawnReceiver();
        this.lastReceiverSpawn = this.elapsedTime;
      }
    }

    // Spawn defenders
    if (this.elapsedTime - this.lastDefenderSpawn >= SPAWN_INTERVAL_DEFENDER) {
      if (this.defenders.size < MAX_DEFENDERS) {
        this.spawnDefender();
        this.lastDefenderSpawn = this.elapsedTime;
      }
    }

    // Update receivers (move horizontally)
    this.updateReceivers(dt);

    // Update defenders (bounce back and forth)
    this.updateDefenders(dt);

    // Update footballs
    this.updateFootballs(dt);

    // Update player charging
    this.updateCharging(dt);
  }

  public end(): void {
    console.log('[QBTargetThrowRound] Ending...');
    this.isActive = false;
  }

  public override cleanup(): void {
    super.cleanup();
    this.receivers.clear();
    this.defenders.clear();
    this.footballs.clear();
    this.playerCharging.clear();
  }

  // ============================================
  // Spawning
  // ============================================

  private spawnReceiver(): void {
    const archetypeKeys = Object.keys(RECEIVER_ARCHETYPES);
    const archetypeKey = this.randomElement(archetypeKeys);
    const archetype = RECEIVER_ARCHETYPES[archetypeKey as keyof typeof RECEIVER_ARCHETYPES];

    const spawnOnLeft = Math.random() > 0.5;
    const laneX = spawnOnLeft ? -12 : 12;
    const direction = spawnOnLeft ? 1 : -1;
    const depthZ = -20 + Math.random() * 35; // Z from -20 to 15

    const receiverId = `receiver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const receiverEntity = new Entity({
      name: receiverId,
      modelUri: 'models/bullseye/scene.gltf',
      modelScale: archetype.modelScale,
    });

    this.spawnEntity(receiverEntity, { x: laneX, y: 1.5, z: depthZ });

    const receiverData: ReceiverData = {
      id: receiverId,
      entity: receiverEntity,
      archetype,
      spawnTime: Date.now(),
      isHit: false,
      speed: archetype.speed,
      direction: direction as 1 | -1,
      depthZ,
    };

    this.receivers.set(receiverId, receiverData);
  }

  private spawnDefender(): void {
    const laneX = -6 + Math.random() * 12;
    const depthZ = -15 + Math.random() * 30;
    const direction = Math.random() > 0.5 ? 1 : -1;

    const defenderId = `defender_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const defenderEntity = new Entity({
      name: defenderId,
      modelUri: 'models/defender/scene.gltf',
      modelScale: 0.055,
    });

    this.spawnEntity(defenderEntity, { x: laneX, y: 1, z: depthZ });

    const defenderData: DefenderData = {
      id: defenderId,
      entity: defenderEntity,
      speed: 2.5,
      direction: direction as 1 | -1,
      depthZ,
    };

    this.defenders.set(defenderId, defenderData);
  }

  // ============================================
  // Movement Updates
  // ============================================

  private updateReceivers(dt: number): void {
    const toRemove: string[] = [];

    this.receivers.forEach((receiver, id) => {
      const pos = receiver.entity.position;
      const newX = pos.x + receiver.direction * receiver.speed * dt;

      // Remove if crossed field edge
      if (newX <= -12 || newX >= 12) {
        toRemove.push(id);
        return;
      }

      receiver.entity.setPosition({ x: newX, y: pos.y, z: pos.z });

      // Check lifetime for bonus receivers
      if (receiver.archetype.lifetime) {
        const elapsed = (Date.now() - receiver.spawnTime) / 1000;
        if (elapsed >= receiver.archetype.lifetime) {
          toRemove.push(id);
        }
      }
    });

    toRemove.forEach(id => {
      const receiver = this.receivers.get(id);
      if (receiver) {
        this.despawnEntity(receiver.entity);
        this.receivers.delete(id);
      }
    });
  }

  private updateDefenders(dt: number): void {
    this.defenders.forEach(defender => {
      const pos = defender.entity.position;
      let newX = pos.x + defender.direction * defender.speed * dt;

      // Bounce at boundaries
      if (newX <= -10 || newX >= 10) {
        defender.direction = -defender.direction as 1 | -1;
        newX = Math.max(-10, Math.min(10, newX));
      }

      defender.entity.setPosition({ x: newX, y: pos.y, z: pos.z });
    });
  }

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

      // Apply spiral rotation (align to velocity + spin around nose)
      const alignQuat = createAlignmentQuaternion(currentVelocity);
      const spiralQuat = createAxisAngleQuaternion({ x: 1, y: 0, z: 0 }, ball.spiralAngle);
      const finalQuat = multiplyQuaternions(alignQuat, spiralQuat);
      ball.entity.setRotation(finalQuat);

      // Check ground hit
      if (!ball.hasHitGround && ballPos.y <= 1.3) {
        ball.hasHitGround = true;
        this.playSound('audio/sfx/ball-ground.wav', 0.5);
      }

      // Check receiver collisions
      if (!ball.hasHitGround) {
        this.receivers.forEach((receiver, receiverId) => {
          if (receiver.isHit) return;

          const dist = this.distance(ballPos, receiver.entity.position);
          if (dist < 1.2) {
            this.handleReceiverHit(receiverId, ballId, ball.thrownBy);
          }
        });

        // Check defender collisions
        this.defenders.forEach((defender, defenderId) => {
          const dist = this.distance(ballPos, defender.entity.position);
          if (dist < 1.5) {
            this.handleDefenderBlock(ballId, ball.thrownBy);
          }
        });

        // Check field goal
        if (ballPos.z <= -32 &&
            ballPos.x > -3 && ballPos.x < 3 &&
            ballPos.y > 3) {
          this.handleFieldGoal(ballId, ball.thrownBy);
        }
      }

      // Remove if lifetime exceeded or fell too far
      if (elapsed >= 5 || ballPos.y < -2) {
        toRemove.push(ballId);
        if (!ball.hasHitGround) {
          this.handleMiss();
        }
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

  // ============================================
  // Collision Handlers
  // ============================================

  private handleReceiverHit(receiverId: string, ballId: string, playerId: string): void {
    const receiver = this.receivers.get(receiverId);
    const ball = this.footballs.get(ballId);

    if (!receiver || !ball || receiver.isHit) return;
    receiver.isHit = true;

    // Calculate points based on depth
    const archetype = receiver.archetype;
    let basePoints: number;
    if (receiver.depthZ >= 10) {
      basePoints = archetype.basePointsShort;
    } else if (receiver.depthZ >= -5) {
      basePoints = archetype.basePointsMedium;
    } else {
      basePoints = archetype.basePointsDeep;
    }

    const points = Math.floor(basePoints * this.multiplier);

    // Update scoring
    this.addScore(playerId, points);
    this.streak++;
    this.multiplier = Math.min(3.0, this.multiplier + 0.1);

    // Update player stats
    this.gameManager.updatePlayerStats(playerId, {
      successfulHits: (this.gameManager.getState().playerScores.get(playerId)?.stats.successfulHits || 0) + 1,
    });

    console.log(`[QBTargetThrow] Hit! +${points} pts (${this.multiplier.toFixed(1)}x, ${this.streak} streak)`);

    // Play streak cheers
    if (this.streak === 3) {
      this.playSound('audio/sfx/slight-cheer.wav', 0.5);
    } else if (this.streak % 5 === 0) {
      this.playSound('audio/sfx/large-cheer.wav', 0.7);
    }

    // Remove receiver and ball
    this.despawnEntity(receiver.entity);
    this.receivers.delete(receiverId);
    this.despawnEntity(ball.entity);
    this.footballs.delete(ballId);
  }

  private handleDefenderBlock(ballId: string, playerId: string): void {
    const ball = this.footballs.get(ballId);
    if (!ball) return;

    // Penalty
    this.addScore(playerId, -100);
    this.streak = 0;
    this.multiplier = 1.0;

    this.playSound('audio/sfx/interception.mp3', 0.5);

    // Remove ball
    this.despawnEntity(ball.entity);
    this.footballs.delete(ballId);
  }

  private handleFieldGoal(ballId: string, playerId: string): void {
    const ball = this.footballs.get(ballId);
    if (!ball) return;

    const points = Math.floor(FIELD_GOAL_POINTS * this.multiplier);
    this.addScore(playerId, points);
    this.streak++;
    this.multiplier = Math.min(3.0, this.multiplier + 0.2); // Double boost for field goal

    // Update stats
    this.gameManager.updatePlayerStats(playerId, {
      fieldGoals: (this.gameManager.getState().playerScores.get(playerId)?.stats.fieldGoals || 0) + 1,
    });

    console.log(`[QBTargetThrow] FIELD GOAL! +${points} pts`);
    this.playSound('audio/sfx/large-cheer.wav', 0.7);

    // Remove ball
    this.despawnEntity(ball.entity);
    this.footballs.delete(ballId);
  }

  private handleMiss(): void {
    this.streak = 0;
    this.multiplier = 1.0;
  }

  // ============================================
  // Player Input
  // ============================================

  private updateCharging(dt: number): void {
    this.playerCharging.forEach((state, playerId) => {
      if (state.isCharging) {
        state.power = Math.min(1, state.power + 1.5 * dt);

        // Send charge power update to UI
        const player = this.getPlayer(playerId);
        if (player) {
          player.ui.sendData({
            type: 'game_update',
            chargePower: state.power,
          });
        }
      }
    });
  }

  public startCharge(playerId: string): void {
    if (!this.isActive) return;

    this.playerCharging.set(playerId, {
      isCharging: true,
      power: 0,
      startTime: Date.now(),
    });
  }

  public releaseThrow(playerId: string, player: Player): void {
    if (!this.isActive) return;

    const chargeState = this.playerCharging.get(playerId);
    if (!chargeState || !chargeState.isCharging) return;

    chargeState.isCharging = false;
    const power = Math.max(0.2, chargeState.power);
    chargeState.power = 0;

    const playerEntity = this.gameManager.getPlayerEntity(playerId);
    if (!playerEntity) return;

    // Reset charge UI
    const uiPlayer = this.getPlayer(playerId);
    if (uiPlayer) {
      uiPlayer.ui.sendData({
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

export default QBTargetThrowRound;
