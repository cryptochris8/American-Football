/**
 * FieldGoalFrenzyRound - Kick field goals from increasing distances
 * Wind adds challenge as distance increases
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
import {
  KICK_ROTATION_CONFIG,
  createAlignmentQuaternion,
  createAxisAngleQuaternion,
  multiplyQuaternions,
} from '../utils/QuaternionUtils';

// Field goal configuration
const GOAL_POST_X_LEFT = -3;
const GOAL_POST_X_RIGHT = 3;
const CROSSBAR_Y = 3;
const GOAL_POST_Z = -32;

// Distance tiers - realistic NFL field goal distances
const KICK_DISTANCES = [
  { distance: 25, points: 100, name: 'Short (25 yards)' },
  { distance: 35, points: 200, name: 'Medium (35 yards)' },
  { distance: 45, points: 350, name: 'Long (45 yards)' },
  { distance: 55, points: 500, name: 'Very Long (55 yards)' },
  { distance: 65, points: 750, name: 'Extreme (65 yards)' },
  { distance: 70, points: 1000, name: 'Record (70 yards)' },
];

interface PlayerKickState {
  playerId: string;
  currentDistanceIndex: number;
  kicksMade: number;
  kicksAttempted: number;
  streak: number;
  isCharging: boolean;
  chargePower: number;
  chargeStartTime: number;
  lastKickTime: number;
}

interface ActiveKick {
  id: string;
  entity: Entity;
  playerId: string;
  spawnTime: number;
  distanceIndex: number;
  hasResult: boolean;
  tumbleAngle: number;
  initialVelocity: { x: number; y: number; z: number };
}

export class FieldGoalFrenzyRound extends BaseRound {
  private playerStates: Map<string, PlayerKickState> = new Map();
  private activeKicks: Map<string, ActiveKick> = new Map();
  private windSpeed: number = 0;
  private windDirection: number = 0; // 0 = no wind, negative = left, positive = right
  private windUpdateTimer: number = 0;

  public initialize(): void {
    console.log('[FieldGoalFrenzyRound] Initializing...');
    this.playerStates.clear();
    this.activeKicks.clear();
    this.windSpeed = 0;
    this.windDirection = 0;
    this.windUpdateTimer = 0;

    // Initialize player states
    this.getActivePlayers().forEach(playerId => {
      this.playerStates.set(playerId, {
        playerId,
        currentDistanceIndex: 0,
        kicksMade: 0,
        kicksAttempted: 0,
        streak: 0,
        isCharging: false,
        chargePower: 0,
        chargeStartTime: 0,
        lastKickTime: 0,
      });

      // Position player at first kick distance
      this.positionPlayerForKick(playerId, 0);
    });
  }

  public start(): void {
    console.log('[FieldGoalFrenzyRound] Starting!');
    this.isActive = true;
    this.updateWind();
  }

  public update(dt: number): void {
    if (!this.isActive) return;

    // Update wind periodically
    this.windUpdateTimer += dt;
    if (this.windUpdateTimer >= 10) {
      this.updateWind();
      this.windUpdateTimer = 0;
    }

    // Update charging
    this.updateCharging(dt);

    // Update active kicks
    this.updateKicks(dt);
  }

  public end(): void {
    console.log('[FieldGoalFrenzyRound] Ending...');
    this.isActive = false;
  }

  public override cleanup(): void {
    super.cleanup();
    this.playerStates.clear();
    this.activeKicks.clear();
  }

  // ============================================
  // Wind System
  // ============================================

  private updateWind(): void {
    // Random wind between -5 and 5
    this.windSpeed = Math.random() * 5;
    this.windDirection = (Math.random() - 0.5) * 2; // -1 to 1

    console.log(`[FieldGoalFrenzy] Wind updated: ${(this.windSpeed * this.windDirection).toFixed(1)} m/s`);

    // Notify all players
    this.getActivePlayers().forEach(playerId => {
      const player = this.getPlayer(playerId);
      if (player) {
        player.ui.sendData({
          type: 'wind_update',
          windSpeed: this.windSpeed,
          windDirection: this.windDirection > 0 ? 'right' : 'left',
        });
      }
    });
  }

  // ============================================
  // Player Positioning
  // ============================================

  private positionPlayerForKick(playerId: string, distanceIndex: number): void {
    const playerEntity = this.gameManager.getPlayerEntity(playerId);
    if (!playerEntity) return;

    const kickDistance = KICK_DISTANCES[distanceIndex];
    const kickZ = GOAL_POST_Z + kickDistance.distance;

    // Position player facing the goal posts (negative Z direction)
    playerEntity.setPosition({ x: 0, y: 2, z: kickZ });
    playerEntity.setRotation(Quaternion.fromEuler(0, 180, 0)); // Face toward goal posts

    console.log(`[FieldGoalFrenzy] Positioned ${playerId} at z=${kickZ} (${kickDistance.distance} yards), facing goal posts`);

    // Notify player of new distance
    const uiPlayer = this.getPlayer(playerId);
    if (uiPlayer) {
      uiPlayer.ui.sendData({
        type: 'kick_distance',
        distance: kickDistance.distance,
        points: kickDistance.points,
        name: kickDistance.name,
      });
    }
  }

  // ============================================
  // Kick Mechanics
  // ============================================

  private updateCharging(dt: number): void {
    this.playerStates.forEach((state, playerId) => {
      if (state.isCharging) {
        state.chargePower = Math.min(1, state.chargePower + 1.2 * dt);

        // Send charge power update to UI
        const player = this.getPlayer(playerId);
        if (player) {
          player.ui.sendData({
            type: 'game_update',
            chargePower: state.chargePower,
          });
        }
      }
    });
  }

  public startCharge(playerId: string): void {
    console.log(`[FieldGoalFrenzy] startCharge called for ${playerId}, isActive=${this.isActive}`);
    if (!this.isActive) return;

    const state = this.playerStates.get(playerId);
    if (!state) {
      console.log(`[FieldGoalFrenzy] No state found for ${playerId}`);
      return;
    }

    // Check cooldown
    const now = Date.now();
    if (now - state.lastKickTime < 1000) {
      console.log(`[FieldGoalFrenzy] Cooldown active for ${playerId}`);
      return;
    }

    state.isCharging = true;
    state.chargePower = 0;
    state.chargeStartTime = now;
    console.log(`[FieldGoalFrenzy] Started charging for ${playerId}`);
  }

  public releaseKick(playerId: string, player: Player): void {
    console.log(`[FieldGoalFrenzy] releaseKick called for ${playerId}, isActive=${this.isActive}`);
    if (!this.isActive) return;

    const state = this.playerStates.get(playerId);
    if (!state || !state.isCharging) {
      console.log(`[FieldGoalFrenzy] Cannot kick - no state or not charging`);
      return;
    }

    state.isCharging = false;
    const power = Math.max(0.3, state.chargePower);
    console.log(`[FieldGoalFrenzy] Kick power: ${power.toFixed(2)} (chargePower was ${state.chargePower.toFixed(2)})`);
    state.chargePower = 0;
    state.lastKickTime = Date.now();
    state.kicksAttempted++;

    const playerEntity = this.gameManager.getPlayerEntity(playerId);
    if (!playerEntity) return;

    // Get kick direction from camera
    const yaw = player.camera?.orientation?.yaw || 0;
    const pitch = player.camera?.orientation?.pitch || 0;
    console.log(`[FieldGoalFrenzy] Camera yaw=${yaw.toFixed(2)}, pitch=${pitch.toFixed(2)}`);

    // Calculate kick velocity
    const kickDistance = KICK_DISTANCES[state.currentDistanceIndex];
    const basePower = 15 + (kickDistance.distance / 60) * 15; // Harder kicks for longer distance
    console.log(`[FieldGoalFrenzy] Distance=${kickDistance.distance} yards, basePower=${basePower.toFixed(1)}`);

    const dirX = -Math.sin(yaw) * Math.cos(pitch);
    const dirY = Math.sin(pitch);
    const dirZ = -Math.cos(yaw) * Math.cos(pitch);

    const velocity = {
      x: dirX * basePower * power + (this.windDirection * this.windSpeed * 0.3),
      y: 12 + power * 8, // Good arc
      z: dirZ * basePower * power,
    };
    console.log(`[FieldGoalFrenzy] Kick velocity: x=${velocity.x.toFixed(1)}, y=${velocity.y.toFixed(1)}, z=${velocity.z.toFixed(1)}`);

    this.spawnKick(playerId, playerEntity.position, velocity, state.currentDistanceIndex);

    // Update stats
    this.gameManager.updatePlayerStats(playerId, {
      totalThrows: (this.gameManager.getState().playerScores.get(playerId)?.stats.totalThrows || 0) + 1,
    });

    this.playSound('audio/sfx/ball-wind.wav', 0.6);
  }

  private spawnKick(playerId: string, position: any, velocity: any, distanceIndex: number): void {
    const kickId = `kick_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const footballEntity = new Entity({
      name: kickId,
      modelUri: 'models/football/scene.gltf',
      modelScale: 0.00375,
      rigidBodyOptions: {
        type: RigidBodyType.DYNAMIC,
        linearVelocity: velocity,
        gravityScale: 1.0,
        ccdEnabled: true,
        colliders: [
          {
            shape: ColliderShape.BALL,
            radius: 0.15,
            bounciness: 0.4,
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
      y: position.y + 0.5,
      z: position.z - 0.5,
    };

    // Set initial rotation to align with kick direction
    const initialRotation = createAlignmentQuaternion(velocity);
    this.spawnEntity(footballEntity, spawnPos, initialRotation);

    this.activeKicks.set(kickId, {
      id: kickId,
      entity: footballEntity,
      playerId,
      spawnTime: Date.now(),
      distanceIndex,
      hasResult: false,
      tumbleAngle: 0,
      initialVelocity: velocity,
    });
  }

  private updateKicks(dt: number): void {
    const toRemove: string[] = [];
    const now = Date.now();

    this.activeKicks.forEach((kick, kickId) => {
      if (kick.hasResult) return;

      const elapsed = (now - kick.spawnTime) / 1000;
      const ballPos = kick.entity.position;

      // Update end-over-end tumble rotation
      kick.tumbleAngle += KICK_ROTATION_CONFIG.radiansPerSecond * dt;

      // Get current velocity for alignment
      const rigidBody = kick.entity.rawRigidBody;
      let currentVelocity = kick.initialVelocity;
      if (rigidBody) {
        const vel = rigidBody.linvel();
        currentVelocity = { x: vel.x, y: vel.y, z: vel.z };
      }

      // Apply end-over-end rotation (align to velocity + tumble around Z axis)
      const alignQuat = createAlignmentQuaternion(currentVelocity);
      const tumbleQuat = createAxisAngleQuaternion({ x: 0, y: 0, z: 1 }, kick.tumbleAngle);
      const finalQuat = multiplyQuaternions(alignQuat, tumbleQuat);
      kick.entity.setRotation(finalQuat);

      // Check if ball has passed the goal post Z
      if (ballPos.z <= GOAL_POST_Z) {
        this.checkFieldGoal(kickId);
      }

      // Remove if too old or fell too low
      if (elapsed >= 5 || ballPos.y < -2) {
        if (!kick.hasResult) {
          this.handleMiss(kick.playerId);
        }
        toRemove.push(kickId);
      }
    });

    toRemove.forEach(id => {
      const kick = this.activeKicks.get(id);
      if (kick) {
        this.despawnEntity(kick.entity);
        this.activeKicks.delete(id);
      }
    });
  }

  private checkFieldGoal(kickId: string): void {
    const kick = this.activeKicks.get(kickId);
    if (!kick || kick.hasResult) return;

    kick.hasResult = true;
    const ballPos = kick.entity.position;

    // Check if ball is between uprights and above crossbar
    const isGood = ballPos.x > GOAL_POST_X_LEFT &&
                   ballPos.x < GOAL_POST_X_RIGHT &&
                   ballPos.y > CROSSBAR_Y;

    if (isGood) {
      this.handleFieldGoalMade(kick.playerId, kick.distanceIndex);
    } else {
      this.handleMiss(kick.playerId);
    }
  }

  private handleFieldGoalMade(playerId: string, distanceIndex: number): void {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    const kickDistance = KICK_DISTANCES[distanceIndex];
    state.kicksMade++;
    state.streak++;

    // Bonus for streak
    const streakBonus = Math.min(state.streak - 1, 5) * 50;
    const totalPoints = kickDistance.points + streakBonus;

    this.addScore(playerId, totalPoints);

    // Update stats
    this.gameManager.updatePlayerStats(playerId, {
      fieldGoals: (this.gameManager.getState().playerScores.get(playerId)?.stats.fieldGoals || 0) + 1,
      successfulHits: (this.gameManager.getState().playerScores.get(playerId)?.stats.successfulHits || 0) + 1,
    });

    console.log(`[FieldGoalFrenzy] GOOD! +${totalPoints} pts (${state.streak} streak)`);

    // Play appropriate cheer
    if (state.streak >= 3) {
      this.playSound('audio/sfx/large-cheer.wav', 0.7);
    } else {
      this.playSound('audio/sfx/slight-cheer.wav', 0.5);
    }

    // Notify player
    const player = this.getPlayer(playerId);
    if (player) {
      player.ui.sendData({
        type: 'field_goal_good',
        points: totalPoints,
        streak: state.streak,
        distance: kickDistance.distance,
      });
    }

    // Progress to next distance
    if (state.currentDistanceIndex < KICK_DISTANCES.length - 1) {
      state.currentDistanceIndex++;
      setTimeout(() => {
        if (this.isActive) {
          this.positionPlayerForKick(playerId, state.currentDistanceIndex);
        }
      }, 1500);
    }
  }

  private handleMiss(playerId: string): void {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    state.streak = 0;

    // Go back one distance (but not below 0)
    if (state.currentDistanceIndex > 0) {
      state.currentDistanceIndex--;
    }

    console.log(`[FieldGoalFrenzy] Miss! Reset to distance ${KICK_DISTANCES[state.currentDistanceIndex].distance}`);
    this.playSound('audio/sfx/ball-ground.wav', 0.5);

    // Notify player
    const player = this.getPlayer(playerId);
    if (player) {
      player.ui.sendData({
        type: 'field_goal_miss',
        newDistance: KICK_DISTANCES[state.currentDistanceIndex].distance,
      });
    }

    // Reposition after delay
    setTimeout(() => {
      if (this.isActive) {
        this.positionPlayerForKick(playerId, state.currentDistanceIndex);
      }
    }, 1500);
  }

  // ============================================
  // Player Input Handler
  // ============================================

  public handlePlayerInput(playerId: string, player: Player, inputType: 'start' | 'release'): void {
    if (inputType === 'start') {
      this.startCharge(playerId);
    } else {
      this.releaseKick(playerId, player);
    }
  }
}

export default FieldGoalFrenzyRound;
