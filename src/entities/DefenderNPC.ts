/**
 * DefenderNPC - AI-controlled defender that chases players
 * Used in Running Back Rush mode to tackle ball carriers
 */

import {
  Entity,
  PathfindingEntityController,
  World,
  Vector3Like,
} from 'hytopia';

import { FootballNPC, FootballNPCOptions } from './FootballNPC';

export type DefenderBehavior = 'chase' | 'zone' | 'patrol' | 'rush';

export interface DefenderZone {
  center: Vector3Like;
  radius: number;
}

export interface DefenderNPCOptions extends Partial<FootballNPCOptions> {
  behavior?: DefenderBehavior;
  zone?: DefenderZone;
  tackleRadius?: number;
  reactionTime?: number; // Delay before chasing (ms)
}

export class DefenderNPC extends FootballNPC {
  private _behavior: DefenderBehavior;
  private _zone: DefenderZone | null;
  private _tackleRadius: number;
  private _reactionTime: number;
  private _targetEntity: Entity | null = null;
  private _isChasing: boolean = false;
  private _hasTackled: boolean = false;
  private _patrolDirection: 1 | -1 = 1;
  private _chaseInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: DefenderNPCOptions = {}) {
    super({
      role: 'defender',
      modelUri: options.modelUri || 'models/defender/scene.gltf',
      modelScale: options.modelScale || 0.055,
      speed: options.speed || 5,
      usePathfinding: true, // Defenders use pathfinding to navigate around obstacles
      teamColor: options.teamColor || 'red',
      ...options,
    });

    this._behavior = options.behavior || 'chase';
    this._zone = options.zone || null;
    this._tackleRadius = options.tackleRadius || 1.5;
    this._reactionTime = options.reactionTime || 200;
  }

  get behavior(): DefenderBehavior { return this._behavior; }
  get tackleRadius(): number { return this._tackleRadius; }
  get isChasing(): boolean { return this._isChasing; }
  get hasTackled(): boolean { return this._hasTackled; }
  get targetEntity(): Entity | null { return this._targetEntity; }

  /**
   * Start chasing a target entity
   */
  public startChasing(target: Entity): void {
    this._targetEntity = target;
    this._isChasing = true;
    this.playAnimation('run', true);

    // Clear any existing chase interval
    if (this._chaseInterval) {
      clearInterval(this._chaseInterval);
    }

    // Delay start based on reaction time
    setTimeout(() => {
      if (!this.isSpawned || !this._isChasing) return;

      // Continuously update chase target
      this._chaseInterval = setInterval(() => {
        if (!this.isSpawned || !this._isChasing || !this._targetEntity?.isSpawned) {
          this.stopChasing();
          return;
        }

        // Check for tackle
        if (this.canTackle(this._targetEntity)) {
          this.tackle();
          return;
        }

        // Update pathfinding to follow target
        this.chase(this._targetEntity);
      }, 100);
    }, this._reactionTime);
  }

  /**
   * Stop chasing
   */
  public stopChasing(): void {
    this._isChasing = false;
    this._targetEntity = null;

    if (this._chaseInterval) {
      clearInterval(this._chaseInterval);
      this._chaseInterval = null;
    }

    this.stopMovement();
    this.playAnimation('idle', true);
  }

  /**
   * Check if defender can tackle the target
   */
  public canTackle(target: Entity): boolean {
    if (!target.isSpawned || this._hasTackled) return false;

    const distance = this.distanceTo(target.position);
    return distance <= this._tackleRadius;
  }

  /**
   * Perform a tackle
   */
  public tackle(): void {
    if (this._hasTackled) return;

    this._hasTackled = true;
    this._isChasing = false;
    this.stopMovement();
    this.playAnimation('idle', true);

    if (this._chaseInterval) {
      clearInterval(this._chaseInterval);
      this._chaseInterval = null;
    }

    console.log('[DefenderNPC] Tackle made!');
  }

  /**
   * Set up zone defense behavior
   */
  public defendZone(zone: DefenderZone): void {
    this._zone = zone;
    this._behavior = 'zone';
    this.moveToward(zone.center);
  }

  /**
   * Patrol between two points
   */
  public patrol(pointA: Vector3Like, pointB: Vector3Like): void {
    this._behavior = 'patrol';
    const waypoints = [pointA, pointB, pointA]; // Loop back
    this.setWaypoints(waypoints);
  }

  /**
   * Rush toward the quarterback position
   */
  public rushQB(qbPosition: Vector3Like): void {
    this._behavior = 'rush';
    this.playAnimation('run', true);
    this.moveToward(qbPosition);
  }

  /**
   * Check if a position is within this defender's zone
   */
  public isInZone(position: Vector3Like): boolean {
    if (!this._zone) return false;

    const dx = position.x - this._zone.center.x;
    const dz = position.z - this._zone.center.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    return distance <= this._zone.radius;
  }

  /**
   * React to a player entering the zone
   */
  public reactToPlayer(player: Entity): void {
    if (this._behavior === 'zone' && this._zone) {
      if (this.isInZone(player.position)) {
        this.startChasing(player);
      }
    }
  }

  /**
   * Reset defender state for a new play
   */
  public reset(): void {
    this._hasTackled = false;
    this._isChasing = false;
    this._targetEntity = null;

    if (this._chaseInterval) {
      clearInterval(this._chaseInterval);
      this._chaseInterval = null;
    }

    this.stopMovement();
    this.playAnimation('idle', true);
  }

  /**
   * Clean up when despawning
   */
  public override despawn(): void {
    if (this._chaseInterval) {
      clearInterval(this._chaseInterval);
      this._chaseInterval = null;
    }
    super.despawn();
  }

  /**
   * Create multiple defenders in a formation
   */
  public static createFormation(
    positions: Vector3Like[],
    options: Partial<DefenderNPCOptions> = {}
  ): DefenderNPC[] {
    return positions.map(pos => {
      const defender = new DefenderNPC(options);
      return defender;
    });
  }
}

export default DefenderNPC;
