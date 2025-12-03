/**
 * QBNPC - AI-controlled Quarterback
 * Used in Receiver Run mode to throw passes to player receivers
 */

import {
  Entity,
  World,
  Vector3Like,
  RigidBodyType,
  ColliderShape,
  CollisionGroup,
} from 'hytopia';

import { FootballNPC, FootballNPCOptions } from './FootballNPC';

export interface ThrowTarget {
  position: Vector3Like;
  leadAmount: number; // How far ahead to throw (for moving targets)
}

export interface QBNPCOptions extends Partial<FootballNPCOptions> {
  throwPower?: number;
  accuracy?: number; // 0-1, how accurate the throws are
  readTime?: number; // Time to wait before throwing (ms)
}

export class QBNPC extends FootballNPC {
  private _throwPower: number;
  private _accuracy: number;
  private _readTime: number;
  private _isThrowing: boolean = false;
  private _throwCount: number = 0;
  private _world: World | null = null;

  constructor(options: QBNPCOptions = {}) {
    super({
      role: 'quarterback',
      modelUri: options.modelUri || 'models/defender/scene.gltf',
      modelScale: options.modelScale || 0.06,
      speed: options.speed || 2,
      usePathfinding: false,
      teamColor: options.teamColor || 'blue',
      ...options,
    });

    this._throwPower = options.throwPower || 25;
    this._accuracy = options.accuracy || 0.85;
    this._readTime = options.readTime || 1500;
  }

  get throwPower(): number { return this._throwPower; }
  get accuracy(): number { return this._accuracy; }
  get isThrowing(): boolean { return this._isThrowing; }
  get throwCount(): number { return this._throwCount; }

  /**
   * Override spawn to track world reference
   */
  public override spawn(world: World, position: Vector3Like, rotation?: any): void {
    super.spawn(world, position, rotation);
    this._world = world;
  }

  /**
   * Calculate throw velocity to hit a target
   */
  private calculateThrowVelocity(targetPos: Vector3Like, leadAmount: number = 0): Vector3Like {
    const pos = this.position;

    // Add some inaccuracy based on accuracy setting
    const inaccuracyRange = (1 - this._accuracy) * 3;
    const inaccuracyX = (Math.random() - 0.5) * inaccuracyRange;
    const inaccuracyZ = (Math.random() - 0.5) * inaccuracyRange;

    // Calculate direction to target (with lead and inaccuracy)
    const dx = (targetPos.x + leadAmount + inaccuracyX) - pos.x;
    const dz = (targetPos.z + inaccuracyZ) - pos.z;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);

    // Normalize horizontal direction
    const dirX = dx / horizontalDist;
    const dirZ = dz / horizontalDist;

    // Calculate required vertical velocity for arc
    // Using projectile motion: we want the ball to arc nicely
    const flightTime = horizontalDist / this._throwPower;
    const gravity = 15; // Match game's gravity
    const peakHeight = 3; // Desired peak height above release point

    // Calculate vertical velocity needed
    const velY = (peakHeight / (flightTime / 2)) + (gravity * flightTime / 4);

    return {
      x: dirX * this._throwPower,
      y: velY,
      z: dirZ * this._throwPower,
    };
  }

  /**
   * Throw a pass to a target position
   */
  public throwPass(
    target: ThrowTarget,
    onThrow?: (footballEntity: Entity) => void
  ): Entity | null {
    if (!this._world || !this.isSpawned) {
      console.warn('[QBNPC] Cannot throw - not spawned');
      return null;
    }

    this._isThrowing = true;
    this._throwCount++;

    // Face the target
    this.faceToward(target.position);

    // Play throw animation
    this.playAnimation('idle', true); // TODO: Add throw animation

    // Calculate throw velocity
    const velocity = this.calculateThrowVelocity(target.position, target.leadAmount);

    // Create football entity
    const ballId = `qb_pass_${Date.now()}_${this._throwCount}`;
    const spawnPos = {
      x: this.position.x,
      y: this.position.y + 1.5,
      z: this.position.z - 0.5,
    };

    const footballEntity = new Entity({
      name: ballId,
      modelUri: 'models/football/scene.gltf',
      modelScale: 0.00375,
      rigidBodyOptions: {
        type: RigidBodyType.DYNAMIC,
        linearVelocity: velocity,
        gravityScale: 1.0,
        ccdEnabled: true,
        enabledRotations: { x: true, y: true, z: true },
        colliders: [
          {
            shape: ColliderShape.BALL,
            radius: 0.15,
            bounciness: 0.3,
            collisionGroups: {
              belongsTo: [CollisionGroup.GROUP_1],
              collidesWith: [CollisionGroup.BLOCK, CollisionGroup.PLAYER],
            },
          },
        ],
      },
    });

    footballEntity.spawn(this._world, spawnPos);

    console.log(`[QBNPC] Threw pass #${this._throwCount} to (${target.position.x.toFixed(1)}, ${target.position.z.toFixed(1)})`);

    // Reset throwing state after animation
    setTimeout(() => {
      this._isThrowing = false;
    }, 500);

    if (onThrow) {
      onThrow(footballEntity);
    }

    return footballEntity;
  }

  /**
   * Throw to a moving receiver with lead
   */
  public throwToReceiver(
    receiver: Entity,
    receiverVelocity: Vector3Like,
    onThrow?: (footballEntity: Entity) => void
  ): Entity | null {
    // Calculate lead based on receiver velocity and distance
    const distance = this.distanceTo(receiver.position);
    const flightTime = distance / this._throwPower;

    // Predict where receiver will be
    const leadPosition = {
      x: receiver.position.x + receiverVelocity.x * flightTime,
      y: receiver.position.y + 1, // Throw chest height
      z: receiver.position.z + receiverVelocity.z * flightTime,
    };

    return this.throwPass(
      { position: leadPosition, leadAmount: 0 },
      onThrow
    );
  }

  /**
   * Throw after reading the defense (delayed throw)
   */
  public readAndThrow(
    target: ThrowTarget,
    onThrow?: (footballEntity: Entity) => void
  ): void {
    // Wait for read time before throwing
    setTimeout(() => {
      if (this.isSpawned && this._isActive) {
        this.throwPass(target, onThrow);
      }
    }, this._readTime);
  }

  /**
   * Scramble away from pressure
   */
  public scramble(escapeDirection: Vector3Like): void {
    this.playAnimation('run', true);
    this.moveToward(escapeDirection);
  }

  /**
   * Get into throwing stance
   */
  public setStance(): void {
    this.playAnimation('idle', true);
  }

  /**
   * Reset for a new play
   */
  public reset(): void {
    this._isThrowing = false;
    this.stopMovement();
    this.setStance();
  }
}

export default QBNPC;
