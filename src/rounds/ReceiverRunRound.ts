/**
 * ReceiverRunRound - Player is QB throwing to AI receivers running routes
 * Clean, focused gameplay with one receiver per side and route markers
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
import { ReceiverNPC, RouteType } from '../entities/ReceiverNPC';
import {
  SPIRAL_CONFIG,
  createAlignmentQuaternion,
  createAxisAngleQuaternion,
  multiplyQuaternions,
} from '../utils/QuaternionUtils';

// Route configurations with waypoints
interface RouteDefinition {
  type: RouteType;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
  // Waypoints relative to start position (x is multiplied by direction)
  waypoints: { x: number; z: number }[];
}

const ROUTE_DEFINITIONS: RouteDefinition[] = [
  {
    type: 'flat',
    points: 50,
    difficulty: 'easy',
    waypoints: [
      { x: 0, z: -3 },      // Run forward 3 yards
      { x: -6, z: -3 },     // Break to sideline
    ],
  },
  {
    type: 'slant',
    points: 75,
    difficulty: 'easy',
    waypoints: [
      { x: 0, z: -2 },      // Short forward
      { x: 5, z: -10 },     // Diagonal to middle
    ],
  },
  {
    type: 'out',
    points: 100,
    difficulty: 'medium',
    waypoints: [
      { x: 0, z: -8 },      // Run forward 8 yards
      { x: -8, z: -8 },     // Break to sideline
    ],
  },
  {
    type: 'in',
    points: 100,
    difficulty: 'medium',
    waypoints: [
      { x: 0, z: -8 },      // Run forward 8 yards
      { x: 8, z: -8 },      // Break to middle
    ],
  },
  {
    type: 'curl',
    points: 125,
    difficulty: 'medium',
    waypoints: [
      { x: 0, z: -10 },     // Run forward 10 yards
      { x: 0, z: -8 },      // Curl back
    ],
  },
  {
    type: 'corner',
    points: 150,
    difficulty: 'hard',
    waypoints: [
      { x: 0, z: -10 },     // Run forward
      { x: -8, z: -18 },    // Break to corner
    ],
  },
  {
    type: 'post',
    points: 175,
    difficulty: 'hard',
    waypoints: [
      { x: 0, z: -10 },     // Run forward
      { x: 6, z: -20 },     // Break to post
    ],
  },
  {
    type: 'go',
    points: 200,
    difficulty: 'hard',
    waypoints: [
      { x: 0, z: -15 },     // Deep
      { x: 0, z: -25 },     // Very deep
    ],
  },
];

interface ActiveReceiver {
  id: string;
  entity: ReceiverNPC;
  route: RouteDefinition;
  startPosition: { x: number; y: number; z: number };
  currentWaypointIndex: number;
  direction: 1 | -1;
  hasBeenHit: boolean;
  spawnTime: number;
  side: 'left' | 'right';
}

interface RouteMarker {
  id: string;
  entity: Entity;
  position: { x: number; y: number; z: number };
}

interface ActiveBall {
  id: string;
  entity: Entity;
  playerId: string;
  spawnTime: number;
  spiralAngle: number;
  initialVelocity: { x: number; y: number; z: number };
  hasHitGround: boolean;
}

interface PlayerThrowState {
  playerId: string;
  isCharging: boolean;
  chargePower: number;
  lastThrowTime: number;
  completions: number;
  attempts: number;
  streak: number;
}

// Field positions
const QB_POSITION = { x: 0, y: 2, z: 25 };
const LINE_OF_SCRIMMAGE_Z = 20;
const CATCH_RADIUS = 2.5;
const RECEIVER_SPEED = 6;

// Spawn positions for left and right receivers
const LEFT_SPAWN = { x: -6, y: 2, z: LINE_OF_SCRIMMAGE_Z };
const RIGHT_SPAWN = { x: 6, y: 2, z: LINE_OF_SCRIMMAGE_Z };

export class ReceiverRunRound extends BaseRound {
  private receivers: Map<string, ActiveReceiver> = new Map();
  private routeMarkers: Map<string, RouteMarker> = new Map();
  private activeBalls: Map<string, ActiveBall> = new Map();
  private playerStates: Map<string, PlayerThrowState> = new Map();

  // Track which side needs a new receiver
  private leftReceiverActive: boolean = false;
  private rightReceiverActive: boolean = false;
  private spawnCooldown: number = 0;

  public initialize(): void {
    console.log('[ReceiverRunRound] Initializing - Clean route mode...');
    this.receivers.clear();
    this.routeMarkers.clear();
    this.activeBalls.clear();
    this.playerStates.clear();
    this.leftReceiverActive = false;
    this.rightReceiverActive = false;
    this.spawnCooldown = 0;

    // Initialize player states
    this.getActivePlayers().forEach(playerId => {
      this.playerStates.set(playerId, {
        playerId,
        isCharging: false,
        chargePower: 0,
        lastThrowTime: 0,
        completions: 0,
        attempts: 0,
        streak: 0,
      });

      // Position player at QB position
      const playerEntity = this.gameManager.getPlayerEntity(playerId);
      if (playerEntity) {
        playerEntity.setPosition(QB_POSITION);
        playerEntity.setRotation(Quaternion.fromEuler(0, 180, 0));

        if ('player' in playerEntity) {
          (playerEntity as any).player.ui.sendData({
            type: 'round_info',
            message: 'Throw to receivers running routes!',
          });
        }
      }
    });
  }

  public start(): void {
    console.log('[ReceiverRunRound] Starting!');
    this.isActive = true;

    // Spawn first receivers on both sides
    this.spawnReceiver('left');
    setTimeout(() => {
      if (this.isActive) this.spawnReceiver('right');
    }, 1500); // Stagger right side spawn
  }

  public update(dt: number): void {
    if (!this.isActive) return;

    // Handle spawn cooldown
    if (this.spawnCooldown > 0) {
      this.spawnCooldown -= dt;
    }

    // Spawn new receivers if needed
    if (this.spawnCooldown <= 0) {
      if (!this.leftReceiverActive) {
        this.spawnReceiver('left');
        this.spawnCooldown = 0.5; // Small delay between spawns
      } else if (!this.rightReceiverActive) {
        this.spawnReceiver('right');
        this.spawnCooldown = 0.5;
      }
    }

    // Update receivers along their routes
    this.updateReceivers(dt);

    // Update charging
    this.updateCharging(dt);

    // Update balls in flight
    this.updateBalls(dt);

    // Check for catches
    this.checkCatches();
  }

  public end(): void {
    console.log('[ReceiverRunRound] Ending...');
    this.isActive = false;
  }

  public override cleanup(): void {
    // Despawn all receivers
    this.receivers.forEach(receiver => {
      if (receiver.entity.isSpawned) {
        receiver.entity.despawn();
      }
    });
    this.receivers.clear();

    // Despawn all route markers
    this.clearRouteMarkers();

    super.cleanup();
    this.activeBalls.clear();
    this.playerStates.clear();
  }

  // ============================================
  // Receiver & Route Management
  // ============================================

  private spawnReceiver(side: 'left' | 'right'): void {
    if (side === 'left' && this.leftReceiverActive) return;
    if (side === 'right' && this.rightReceiverActive) return;

    const receiverId = `receiver_${side}_${Date.now()}`;
    const route = this.randomElement(ROUTE_DEFINITIONS);
    const startPos = side === 'left' ? { ...LEFT_SPAWN } : { ...RIGHT_SPAWN };
    const direction = side === 'left' ? 1 : -1; // Left side breaks right, right side breaks left

    const receiver = new ReceiverNPC({
      speed: RECEIVER_SPEED,
    });

    this.spawnEntity(receiver, startPos);

    const activeReceiver: ActiveReceiver = {
      id: receiverId,
      entity: receiver,
      route,
      startPosition: startPos,
      currentWaypointIndex: 0,
      direction,
      hasBeenHit: false,
      spawnTime: Date.now(),
      side,
    };

    this.receivers.set(receiverId, activeReceiver);

    if (side === 'left') {
      this.leftReceiverActive = true;
    } else {
      this.rightReceiverActive = true;
    }

    // Spawn route markers to show the path
    this.spawnRouteMarkers(activeReceiver);

    console.log(`[ReceiverRunRound] Spawned ${side} receiver running ${route.type} route (${route.points} pts)`);

    // Notify players of new route
    this.getActivePlayers().forEach(playerId => {
      const playerEntity = this.gameManager.getPlayerEntity(playerId);
      if (playerEntity && 'player' in playerEntity) {
        (playerEntity as any).player.ui.sendData({
          type: 'route_spawned',
          side,
          routeType: route.type,
          points: route.points,
          difficulty: route.difficulty,
        });
      }
    });
  }

  private spawnRouteMarkers(receiver: ActiveReceiver): void {
    const { route, startPosition, direction, id } = receiver;

    // Spawn a marker at start position
    this.spawnMarker(`${id}_start`, startPosition, true);

    // Spawn markers at each waypoint
    route.waypoints.forEach((wp, index) => {
      const markerPos = {
        x: startPosition.x + (wp.x * direction),
        y: 0.1, // Just above ground
        z: startPosition.z + wp.z,
      };
      this.spawnMarker(`${id}_wp${index}`, markerPos, index === route.waypoints.length - 1);
    });

    // Spawn arrow indicators between waypoints
    let prevPos = startPosition;
    route.waypoints.forEach((wp, index) => {
      const nextPos = {
        x: startPosition.x + (wp.x * direction),
        y: 0.1,
        z: startPosition.z + wp.z,
      };

      // Spawn arrows along the path
      const arrowCount = Math.max(1, Math.floor(this.distance(prevPos, nextPos) / 3));
      for (let i = 1; i <= arrowCount; i++) {
        const t = i / (arrowCount + 1);
        const arrowPos = {
          x: prevPos.x + (nextPos.x - prevPos.x) * t,
          y: 0.1,
          z: prevPos.z + (nextPos.z - prevPos.z) * t,
        };
        this.spawnArrow(`${id}_arrow${index}_${i}`, arrowPos, prevPos, nextPos);
      }

      prevPos = nextPos;
    });
  }

  private spawnMarker(id: string, position: { x: number; y: number; z: number }, isFinal: boolean): void {
    // Use bullseye as waypoint marker (scaled down)
    const markerEntity = new Entity({
      name: id,
      modelUri: 'models/bullseye/scene.gltf',
      modelScale: isFinal ? 0.06 : 0.03, // Smaller scale for route markers
    });

    // Lay flat on the ground
    const rotation = Quaternion.fromEuler(90, 0, 0);
    this.spawnEntity(markerEntity, position, rotation);

    this.routeMarkers.set(id, {
      id,
      entity: markerEntity,
      position,
    });
  }

  private spawnArrow(id: string, position: { x: number; y: number; z: number }, from: any, to: any): void {
    // Calculate rotation to point from -> to
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const angle = Math.atan2(dx, -dz) * (180 / Math.PI);

    // Use small bullseye as direction indicator
    const arrowEntity = new Entity({
      name: id,
      modelUri: 'models/bullseye/scene.gltf',
      modelScale: 0.02, // Very small
    });

    // Lay flat on ground, rotated in direction of travel
    const rotation = Quaternion.fromEuler(90, angle, 0);
    this.spawnEntity(arrowEntity, position, rotation);

    this.routeMarkers.set(id, {
      id,
      entity: arrowEntity,
      position,
    });
  }

  private clearRouteMarkersForReceiver(receiverId: string): void {
    const markersToRemove: string[] = [];

    this.routeMarkers.forEach((marker, id) => {
      if (id.startsWith(receiverId)) {
        markersToRemove.push(id);
      }
    });

    markersToRemove.forEach(id => {
      const marker = this.routeMarkers.get(id);
      if (marker) {
        this.despawnEntity(marker.entity);
        this.routeMarkers.delete(id);
      }
    });
  }

  private clearRouteMarkers(): void {
    this.routeMarkers.forEach(marker => {
      this.despawnEntity(marker.entity);
    });
    this.routeMarkers.clear();
  }

  private updateReceivers(dt: number): void {
    const toRemove: string[] = [];

    this.receivers.forEach((receiver, id) => {
      if (!receiver.entity.isSpawned || receiver.hasBeenHit) {
        if (receiver.hasBeenHit) toRemove.push(id);
        return;
      }

      const pos = receiver.entity.position;
      const route = receiver.route;
      const waypoints = route.waypoints;

      // Get current target waypoint
      if (receiver.currentWaypointIndex >= waypoints.length) {
        // Route complete, remove receiver
        toRemove.push(id);
        return;
      }

      const wp = waypoints[receiver.currentWaypointIndex];
      const targetPos = {
        x: receiver.startPosition.x + (wp.x * receiver.direction),
        y: receiver.startPosition.y,
        z: receiver.startPosition.z + wp.z,
      };

      // Move toward waypoint
      const dx = targetPos.x - pos.x;
      const dz = targetPos.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.5) {
        // Reached waypoint, move to next
        receiver.currentWaypointIndex++;
      } else {
        // Move toward waypoint
        const moveSpeed = RECEIVER_SPEED * dt;
        const ratio = Math.min(1, moveSpeed / dist);
        const newX = pos.x + dx * ratio;
        const newZ = pos.z + dz * ratio;

        receiver.entity.setPosition({ x: newX, y: pos.y, z: newZ });

        // Face direction of movement
        const faceAngle = Math.atan2(dx, -dz);
        receiver.entity.setRotation(Quaternion.fromEuler(0, faceAngle * (180 / Math.PI), 0));
      }

      // Play run animation
      receiver.entity.playAnimation('run', true);

      // Timeout after 10 seconds
      if ((Date.now() - receiver.spawnTime) / 1000 > 10) {
        toRemove.push(id);
      }
    });

    toRemove.forEach(id => {
      const receiver = this.receivers.get(id);
      if (receiver) {
        // Mark side as available
        if (receiver.side === 'left') {
          this.leftReceiverActive = false;
        } else {
          this.rightReceiverActive = false;
        }

        // Clear route markers
        this.clearRouteMarkersForReceiver(id);

        if (receiver.entity.isSpawned) {
          receiver.entity.despawn();
        }
        this.receivers.delete(id);
      }
    });
  }

  // ============================================
  // Charging & Throwing
  // ============================================

  private updateCharging(dt: number): void {
    this.playerStates.forEach((state, playerId) => {
      if (state.isCharging) {
        state.chargePower = Math.min(1, state.chargePower + 1.2 * dt);

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

    const now = Date.now();
    if (now - state.lastThrowTime < 400) return;

    state.isCharging = true;
    state.chargePower = 0;
  }

  public releaseThrow(playerId: string, player: Player): void {
    if (!this.isActive) return;

    const state = this.playerStates.get(playerId);
    if (!state || !state.isCharging) return;

    state.isCharging = false;
    const power = Math.max(0.3, state.chargePower);
    state.chargePower = 0;
    state.lastThrowTime = Date.now();
    state.attempts++;

    const playerEntity = this.gameManager.getPlayerEntity(playerId);
    if (!playerEntity) return;

    // Reset charge UI
    if ('player' in playerEntity) {
      (playerEntity as any).player.ui.sendData({
        type: 'game_update',
        chargePower: 0,
      });
    }

    const yaw = player.camera?.orientation?.yaw || 0;
    const pitch = player.camera?.orientation?.pitch || 0;

    const basePower = 18 + power * 18;

    const dirX = -Math.sin(yaw) * Math.cos(pitch);
    const dirY = Math.sin(pitch);
    const dirZ = -Math.cos(yaw) * Math.cos(pitch);

    const velocity = {
      x: dirX * basePower,
      y: Math.max(4, dirY * basePower + 6),
      z: dirZ * basePower,
    };

    this.spawnFootball(playerId, playerEntity.position, velocity);

    this.gameManager.updatePlayerStats(playerId, {
      totalThrows: (this.gameManager.getState().playerScores.get(playerId)?.stats.totalThrows || 0) + 1,
    });

    this.playSound('audio/sfx/ball-wind.wav', 0.6);
  }

  private spawnFootball(playerId: string, position: any, velocity: any): void {
    const ballId = `pass_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const footballEntity = new Entity({
      name: ballId,
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
      y: position.y + 1.5,
      z: position.z - 0.5,
    };

    const initialRotation = createAlignmentQuaternion(velocity);
    this.spawnEntity(footballEntity, spawnPos, initialRotation);

    this.activeBalls.set(ballId, {
      id: ballId,
      entity: footballEntity,
      playerId,
      spawnTime: Date.now(),
      spiralAngle: 0,
      initialVelocity: velocity,
      hasHitGround: false,
    });
  }

  // ============================================
  // Ball Updates
  // ============================================

  private updateBalls(dt: number): void {
    const toRemove: string[] = [];
    const now = Date.now();

    this.activeBalls.forEach((ball, ballId) => {
      const elapsed = (now - ball.spawnTime) / 1000;
      const ballPos = ball.entity.position;

      // Update spiral rotation
      ball.spiralAngle += SPIRAL_CONFIG.radiansPerSecond * dt;

      const rigidBody = ball.entity.rawRigidBody;
      let currentVelocity = ball.initialVelocity;
      if (rigidBody) {
        const vel = rigidBody.linvel();
        currentVelocity = { x: vel.x, y: vel.y, z: vel.z };
      }

      const alignQuat = createAlignmentQuaternion(currentVelocity);
      const spiralQuat = createAxisAngleQuaternion({ x: 1, y: 0, z: 0 }, ball.spiralAngle);
      const finalQuat = multiplyQuaternions(alignQuat, spiralQuat);
      ball.entity.setRotation(finalQuat);

      // Check ground hit
      if (!ball.hasHitGround && ballPos.y <= 1.0) {
        ball.hasHitGround = true;
        this.playSound('audio/sfx/ball-ground.wav', 0.5);

        // Reset streak on incomplete
        this.playerStates.forEach(state => {
          if (state.playerId === ball.playerId) {
            state.streak = 0;
          }
        });
      }

      if (elapsed >= 4 || ballPos.y < -1) {
        toRemove.push(ballId);
      }
    });

    toRemove.forEach(id => {
      const ball = this.activeBalls.get(id);
      if (ball) {
        this.despawnEntity(ball.entity);
        this.activeBalls.delete(id);
      }
    });
  }

  private checkCatches(): void {
    this.activeBalls.forEach((ball, ballId) => {
      if (ball.hasHitGround) return;

      const ballPos = ball.entity.position;

      this.receivers.forEach((receiver, receiverId) => {
        if (receiver.hasBeenHit || !receiver.entity.isSpawned) return;

        const dist = this.distance(ballPos, receiver.entity.position);

        if (dist <= CATCH_RADIUS) {
          this.handleCatch(ball.playerId, ballId, receiver);
        }
      });
    });
  }

  private handleCatch(playerId: string, ballId: string, receiver: ActiveReceiver): void {
    const ball = this.activeBalls.get(ballId);
    const state = this.playerStates.get(playerId);
    if (!ball || !state) return;

    receiver.hasBeenHit = true;
    state.completions++;
    state.streak++;

    // Streak bonus
    const streakBonus = Math.min(state.streak - 1, 5) * 25;
    const points = receiver.route.points + streakBonus;

    this.addScore(playerId, points);

    this.gameManager.updatePlayerStats(playerId, {
      successfulHits: (this.gameManager.getState().playerScores.get(playerId)?.stats.successfulHits || 0) + 1,
      catchesMade: (this.gameManager.getState().playerScores.get(playerId)?.stats.catchesMade || 0) + 1,
    });

    console.log(`[ReceiverRunRound] CATCH! ${receiver.route.type} = ${points} pts (streak: ${state.streak})`);

    // Play cheer based on streak
    if (state.streak >= 3) {
      this.playSound('audio/sfx/large-cheer.wav', 0.7);
    } else {
      this.playSound('audio/sfx/slight-cheer.wav', 0.6);
    }

    // Remove ball
    this.despawnEntity(ball.entity);
    this.activeBalls.delete(ballId);

    // Clear route markers
    this.clearRouteMarkersForReceiver(receiver.id);

    // Mark side as available for new receiver
    if (receiver.side === 'left') {
      this.leftReceiverActive = false;
    } else {
      this.rightReceiverActive = false;
    }

    // Receiver celebrates then despawns
    receiver.entity.playAnimation('idle', false);
    setTimeout(() => {
      if (receiver.entity.isSpawned) {
        receiver.entity.despawn();
      }
      this.receivers.delete(receiver.id);
    }, 800);

    // Notify player
    const playerEntity = this.gameManager.getPlayerEntity(playerId);
    if (playerEntity && 'player' in playerEntity) {
      (playerEntity as any).player.ui.sendData({
        type: 'catch',
        points,
        routeType: receiver.route.type,
        completions: state.completions,
        attempts: state.attempts,
        streak: state.streak,
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

export default ReceiverRunRound;
