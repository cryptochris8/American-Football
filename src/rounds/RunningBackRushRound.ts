/**
 * RunningBackRushRound - Players run with the ball and dodge 11 defenders
 * Reach the endzone to score a touchdown
 */

import {
  World,
  Entity,
  Player,
  Quaternion,
} from 'hytopia';

import { BaseRound } from './BaseRound';
import type { MultiRoundGameManager } from '../MultiRoundGameManager';
import { DefenderNPC } from '../entities/DefenderNPC';

// Field configuration
const PLAYER_START_Z = 25;
const ENDZONE_Z = -30;
const FIELD_WIDTH = 12;
const TOUCHDOWN_POINTS = 600;
const YARD_POINTS = 5;
const TACKLE_PENALTY = -50;

// 11 defenders in a realistic formation
const DEFENDER_POSITIONS = [
  // Defensive Line (4 players) - closest to line of scrimmage
  { x: -6, y: 2, z: 18, role: 'lineman', speed: 3.5, reactionTime: 400 },
  { x: -2, y: 2, z: 18, role: 'lineman', speed: 3.5, reactionTime: 400 },
  { x: 2, y: 2, z: 18, role: 'lineman', speed: 3.5, reactionTime: 400 },
  { x: 6, y: 2, z: 18, role: 'lineman', speed: 3.5, reactionTime: 400 },

  // Linebackers (3 players) - second level
  { x: -5, y: 2, z: 10, role: 'linebacker', speed: 5, reactionTime: 250 },
  { x: 0, y: 2, z: 8, role: 'linebacker', speed: 5, reactionTime: 250 },
  { x: 5, y: 2, z: 10, role: 'linebacker', speed: 5, reactionTime: 250 },

  // Cornerbacks (2 players) - edges
  { x: -10, y: 2, z: 5, role: 'cornerback', speed: 6, reactionTime: 200 },
  { x: 10, y: 2, z: 5, role: 'cornerback', speed: 6, reactionTime: 200 },

  // Safeties (2 players) - deep coverage
  { x: -4, y: 2, z: -5, role: 'safety', speed: 6.5, reactionTime: 150 },
  { x: 4, y: 2, z: -5, role: 'safety', speed: 6.5, reactionTime: 150 },
];

interface DefenderState {
  id: string;
  entity: DefenderNPC;
  role: string;
  basePosition: { x: number; y: number; z: number };
  isChasing: boolean;
  targetPlayer: string | null;
  pursuitAngle: number;
}

interface PlayerRushState {
  playerId: string;
  startZ: number;
  currentZ: number;
  maxYards: number;
  touchdowns: number;
  isTackled: boolean;
  tacklesAvoided: number;
  lastPosition: { x: number; y: number; z: number };
  velocity: { x: number; z: number };
}

export class RunningBackRushRound extends BaseRound {
  private defenders: Map<string, DefenderState> = new Map();
  private playerStates: Map<string, PlayerRushState> = new Map();
  private elapsedTime: number = 0;
  private defendersSpawned: boolean = false;

  public initialize(): void {
    console.log('[RunningBackRushRound] Initializing with 11 defenders...');
    this.defenders.clear();
    this.playerStates.clear();
    this.elapsedTime = 0;
    this.defendersSpawned = false;

    // Initialize player states
    this.getActivePlayers().forEach(playerId => {
      this.playerStates.set(playerId, {
        playerId,
        startZ: PLAYER_START_Z,
        currentZ: PLAYER_START_Z,
        maxYards: 0,
        touchdowns: 0,
        isTackled: false,
        tacklesAvoided: 0,
        lastPosition: { x: 0, y: 2, z: PLAYER_START_Z },
        velocity: { x: 0, z: 0 },
      });
    });

    // Position players at start
    this.resetPlayerPositions();
  }

  public start(): void {
    console.log('[RunningBackRushRound] Starting!');
    this.isActive = true;
    this.spawnAllDefenders();
  }

  public update(dt: number): void {
    if (!this.isActive) return;

    this.elapsedTime += dt;

    // Update player velocities (for pursuit prediction)
    this.updatePlayerVelocities(dt);

    // Update defenders with improved pursuit AI
    this.updateDefenderPursuit(dt);

    // Check for tackles
    this.checkTackles();

    // Update player yards
    this.updatePlayerYards();

    // Check for touchdowns
    this.checkTouchdowns();
  }

  public end(): void {
    console.log('[RunningBackRushRound] Ending...');
    this.isActive = false;

    // Award final yards
    this.playerStates.forEach((state, playerId) => {
      const yardsGained = state.maxYards;
      if (yardsGained > 0) {
        this.addScore(playerId, yardsGained * YARD_POINTS);
      }
    });
  }

  public override cleanup(): void {
    // Despawn all defenders
    this.defenders.forEach(defender => {
      if (defender.entity.isSpawned) {
        defender.entity.despawn();
      }
    });
    this.defenders.clear();

    super.cleanup();
    this.playerStates.clear();
  }

  // ============================================
  // Defender Management
  // ============================================

  private spawnAllDefenders(): void {
    if (this.defendersSpawned) return;
    this.defendersSpawned = true;

    console.log('[RunningBackRushRound] Spawning 11 defenders...');

    DEFENDER_POSITIONS.forEach((pos, i) => {
      const defender = new DefenderNPC({
        speed: pos.speed,
        tackleRadius: 1.5,
        reactionTime: pos.reactionTime,
      });

      const defenderId = `defender_${pos.role}_${i}`;
      this.spawnEntity(defender, { x: pos.x, y: pos.y, z: pos.z });

      this.defenders.set(defenderId, {
        id: defenderId,
        entity: defender,
        role: pos.role,
        basePosition: { x: pos.x, y: pos.y, z: pos.z },
        isChasing: false,
        targetPlayer: null,
        pursuitAngle: 0,
      });

      console.log(`[RunningBackRushRound] Spawned ${pos.role} at (${pos.x}, ${pos.z})`);
    });
  }

  private updatePlayerVelocities(dt: number): void {
    this.getActivePlayers().forEach(playerId => {
      const state = this.playerStates.get(playerId);
      if (!state || state.isTackled) return;

      const playerEntity = this.gameManager.getPlayerEntity(playerId);
      if (!playerEntity) return;

      const currentPos = playerEntity.position;

      // Calculate velocity based on position change
      state.velocity = {
        x: (currentPos.x - state.lastPosition.x) / dt,
        z: (currentPos.z - state.lastPosition.z) / dt,
      };

      state.lastPosition = { x: currentPos.x, y: currentPos.y, z: currentPos.z };
    });
  }

  private updateDefenderPursuit(dt: number): void {
    this.defenders.forEach((defenderState, defenderId) => {
      const defender = defenderState.entity;
      if (!defender.isSpawned || defender.hasTackled) return;

      // Find the best target player
      let bestTarget: { playerId: string; position: { x: number; y: number; z: number }; priority: number } | null = null;

      this.getActivePlayers().forEach(playerId => {
        const state = this.playerStates.get(playerId);
        if (!state || state.isTackled) return;

        const playerEntity = this.gameManager.getPlayerEntity(playerId);
        if (!playerEntity) return;

        const playerPos = playerEntity.position;
        const defenderPos = defender.position;

        // Calculate priority based on distance and role
        let priority = 1000 - this.distance(defenderPos, playerPos);

        // Role-specific targeting
        switch (defenderState.role) {
          case 'lineman':
            // Linemen focus on players near the line of scrimmage
            if (playerPos.z > 10) priority += 50;
            break;
          case 'linebacker':
            // Linebackers cover the middle
            if (Math.abs(playerPos.x) < 6) priority += 30;
            break;
          case 'cornerback':
            // Cornerbacks cover the edges
            if (Math.abs(playerPos.x) > 5) priority += 40;
            break;
          case 'safety':
            // Safeties are last line of defense
            if (playerPos.z < 0) priority += 60;
            break;
        }

        if (!bestTarget || priority > bestTarget.priority) {
          bestTarget = {
            playerId,
            position: { ...playerPos },
            priority,
          };
        }
      });

      if (bestTarget) {
        // Calculate pursuit position (intercept point)
        const playerState = this.playerStates.get(bestTarget.playerId);
        const pursuitPos = this.calculatePursuitPosition(
          defender.position,
          bestTarget.position,
          playerState?.velocity || { x: 0, z: 0 },
          defenderState.role
        );

        // Move defender toward pursuit position
        this.moveDefenderToward(defender, pursuitPos, dt);
        defenderState.isChasing = true;
        defenderState.targetPlayer = bestTarget.playerId;
      }
    });
  }

  private calculatePursuitPosition(
    defenderPos: { x: number; y: number; z: number },
    playerPos: { x: number; y: number; z: number },
    playerVelocity: { x: number; z: number },
    role: string
  ): { x: number; y: number; z: number } {
    // Predict where the player will be
    const predictionTime = role === 'safety' ? 1.0 : role === 'linebacker' ? 0.7 : 0.5;

    const predictedX = playerPos.x + playerVelocity.x * predictionTime;
    const predictedZ = playerPos.z + playerVelocity.z * predictionTime;

    // Clamp to field boundaries
    const targetX = Math.max(-FIELD_WIDTH, Math.min(FIELD_WIDTH, predictedX));
    const targetZ = Math.max(ENDZONE_Z - 5, Math.min(PLAYER_START_Z + 5, predictedZ));

    // Add some pursuit angle for better interception
    const dx = targetX - defenderPos.x;
    const dz = targetZ - defenderPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Safeties and cornerbacks take better pursuit angles
    let angleAdjust = 0;
    if (role === 'safety' || role === 'cornerback') {
      // Cut off the player's path
      angleAdjust = playerVelocity.x > 0 ? 2 : playerVelocity.x < 0 ? -2 : 0;
    }

    return {
      x: targetX + angleAdjust,
      y: playerPos.y,
      z: targetZ - 1, // Aim slightly ahead
    };
  }

  private moveDefenderToward(defender: DefenderNPC, target: { x: number; y: number; z: number }, dt: number): void {
    const pos = defender.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.1) return;

    const speed = defender.speed;
    const moveX = (dx / dist) * speed * dt;
    const moveZ = (dz / dist) * speed * dt;

    defender.setPosition({
      x: pos.x + moveX,
      y: pos.y,
      z: pos.z + moveZ,
    });

    // Face the direction of movement
    const angle = Math.atan2(dx, dz);
    defender.setRotation(Quaternion.fromEuler(0, angle * (180 / Math.PI), 0));

    // Play run animation
    defender.playAnimation('run', true);
  }

  // ============================================
  // Collision Detection
  // ============================================

  private checkTackles(): void {
    this.defenders.forEach(defenderState => {
      const defender = defenderState.entity;
      if (!defender.isSpawned || defender.hasTackled) return;

      this.getActivePlayers().forEach(playerId => {
        const state = this.playerStates.get(playerId);
        if (!state || state.isTackled) return;

        const playerEntity = this.gameManager.getPlayerEntity(playerId);
        if (!playerEntity) return;

        const dist = this.distance(defender.position, playerEntity.position);

        if (dist <= defender.tackleRadius) {
          this.handleTackle(playerId, defender);
        }
      });
    });
  }

  private handleTackle(playerId: string, defender: DefenderNPC): void {
    const state = this.playerStates.get(playerId);
    if (!state || state.isTackled) return;

    state.isTackled = true;
    defender.tackle();

    // Calculate yards gained
    const yardsGained = state.startZ - state.currentZ;
    state.maxYards = Math.max(state.maxYards, yardsGained);

    // Apply penalty
    this.addScore(playerId, TACKLE_PENALTY);

    console.log(`[RunningBackRushRound] ${playerId} tackled at ${yardsGained.toFixed(0)} yards!`);
    this.playSound('audio/sfx/ball-ground.wav', 0.5);

    // Notify player
    const playerEntity = this.gameManager.getPlayerEntity(playerId);
    if (playerEntity && 'player' in playerEntity) {
      (playerEntity as any).player.ui.sendData({
        type: 'tackled',
        yardsGained: Math.floor(yardsGained),
        penalty: TACKLE_PENALTY,
      });
    }

    // Reset player position after delay
    setTimeout(() => {
      if (this.isActive) {
        this.resetPlayer(playerId);
        this.resetDefendersToFormation();
      }
    }, 2000);
  }

  private resetPlayer(playerId: string): void {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    state.isTackled = false;
    state.currentZ = PLAYER_START_Z;
    state.velocity = { x: 0, z: 0 };

    const playerEntity = this.gameManager.getPlayerEntity(playerId);
    if (playerEntity) {
      const randomX = -FIELD_WIDTH / 2 + Math.random() * FIELD_WIDTH;
      playerEntity.setPosition({ x: randomX, y: 2, z: PLAYER_START_Z });
      state.lastPosition = { x: randomX, y: 2, z: PLAYER_START_Z };
    }
  }

  private resetDefendersToFormation(): void {
    // Reset all defenders to their base positions
    this.defenders.forEach((defenderState, defenderId) => {
      const defender = defenderState.entity;
      if (!defender.isSpawned) return;

      defender.hasTackled = false;
      defenderState.isChasing = false;
      defenderState.targetPlayer = null;

      defender.setPosition(defenderState.basePosition);
      defender.playAnimation('idle', true);
    });
  }

  private resetPlayerPositions(): void {
    let index = 0;
    this.getActivePlayers().forEach(playerId => {
      const playerEntity = this.gameManager.getPlayerEntity(playerId);
      if (playerEntity) {
        const x = -6 + (index * 4); // Spread players across
        playerEntity.setPosition({ x, y: 2, z: PLAYER_START_Z });
        playerEntity.setRotation(Quaternion.fromEuler(0, 180, 0)); // Face downfield
        index++;

        const state = this.playerStates.get(playerId);
        if (state) {
          state.lastPosition = { x, y: 2, z: PLAYER_START_Z };
        }
      }
    });
  }

  // ============================================
  // Scoring
  // ============================================

  private updatePlayerYards(): void {
    this.getActivePlayers().forEach(playerId => {
      const state = this.playerStates.get(playerId);
      if (!state || state.isTackled) return;

      const playerEntity = this.gameManager.getPlayerEntity(playerId);
      if (!playerEntity) return;

      state.currentZ = playerEntity.position.z;
      const yardsGained = state.startZ - state.currentZ;
      state.maxYards = Math.max(state.maxYards, yardsGained);
    });
  }

  private checkTouchdowns(): void {
    this.getActivePlayers().forEach(playerId => {
      const state = this.playerStates.get(playerId);
      if (!state || state.isTackled) return;

      const playerEntity = this.gameManager.getPlayerEntity(playerId);
      if (!playerEntity) return;

      if (playerEntity.position.z <= ENDZONE_Z) {
        this.handleTouchdown(playerId);
      }
    });
  }

  private handleTouchdown(playerId: string): void {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    state.touchdowns++;

    // Award touchdown points
    this.addScore(playerId, TOUCHDOWN_POINTS);

    // Update stats
    this.gameManager.updatePlayerStats(playerId, {
      touchdowns: (this.gameManager.getState().playerScores.get(playerId)?.stats.touchdowns || 0) + 1,
      tacklesAvoided: state.tacklesAvoided,
    });

    console.log(`[RunningBackRushRound] TOUCHDOWN! ${playerId} scored! +${TOUCHDOWN_POINTS} pts`);
    this.playSound('audio/sfx/large-cheer.wav', 0.7);

    // Notify player
    const playerEntity = this.gameManager.getPlayerEntity(playerId);
    if (playerEntity && 'player' in playerEntity) {
      (playerEntity as any).player.ui.sendData({
        type: 'touchdown',
        points: TOUCHDOWN_POINTS,
        totalTouchdowns: state.touchdowns,
      });
    }

    // Reset player and defenders
    this.resetPlayer(playerId);
    this.resetDefendersToFormation();
  }

  // ============================================
  // Player Controls
  // ============================================

  public handlePlayerInput(playerId: string, player: Player, inputType: string): void {
    // Players use normal movement controls (WASD)
    // No special input handling needed for this mode
  }
}

export default RunningBackRushRound;
