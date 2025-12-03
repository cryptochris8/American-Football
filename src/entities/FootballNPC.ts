/**
 * FootballNPC - Base class for all football NPC entities
 * Provides common functionality for AI-controlled football players
 */

import {
  Entity,
  SimpleEntityController,
  PathfindingEntityController,
  RigidBodyType,
  ColliderShape,
  CollisionGroup,
  World,
  Vector3Like,
  QuaternionLike,
  Quaternion,
} from 'hytopia';

export type NPCRole = 'receiver' | 'defender' | 'quarterback' | 'runner';

export interface FootballNPCOptions {
  role: NPCRole;
  modelUri?: string;
  modelScale?: number;
  speed?: number;
  usePathfinding?: boolean;
  teamColor?: 'red' | 'blue';
}

// NPC skins for different teams/roles
const NPC_SKINS = {
  receiver: [
    'skins/football/defender_1.png',
    'skins/football/defender_2.png',
    'skins/football/defender_3.png',
  ],
  defender: [
    'skins/football/defender_4.png',
    'skins/football/defender_5.png',
    'skins/football/defender_6.png',
  ],
  quarterback: [
    'skins/football/defender_7.png',
  ],
  runner: [
    'skins/football/defender_8.png',
    'skins/football/defender_9.png',
    'skins/football/defender_10.png',
  ],
};

export class FootballNPC extends Entity {
  protected _role: NPCRole;
  protected _speed: number;
  protected _isActive: boolean = true;
  protected _teamColor: 'red' | 'blue';
  protected _currentTarget: Vector3Like | null = null;
  protected _waypoints: Vector3Like[] = [];
  protected _currentWaypointIndex: number = 0;
  protected _usePathfinding: boolean;

  constructor(options: FootballNPCOptions) {
    const usePathfinding = options.usePathfinding ?? false;

    super({
      name: `npc_${options.role}_${Date.now()}`,
      modelUri: options.modelUri || 'models/defender/scene.gltf',
      modelScale: options.modelScale || 0.055,
      modelLoopedAnimations: ['idle'],
      controller: usePathfinding
        ? new PathfindingEntityController()
        : new SimpleEntityController(),
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC,
        enabledRotations: { x: false, y: true, z: false },
      },
    });

    this._role = options.role;
    this._speed = options.speed || this.getDefaultSpeed(options.role);
    this._teamColor = options.teamColor || 'blue';
    this._usePathfinding = usePathfinding;
  }

  private getDefaultSpeed(role: NPCRole): number {
    switch (role) {
      case 'receiver': return 6;
      case 'defender': return 5;
      case 'quarterback': return 2;
      case 'runner': return 7;
      default: return 4;
    }
  }

  get role(): NPCRole { return this._role; }
  get speed(): number { return this._speed; }
  get isActive(): boolean { return this._isActive; }
  get teamColor(): 'red' | 'blue' { return this._teamColor; }

  /**
   * Set waypoints for the NPC to follow
   */
  public setWaypoints(waypoints: Vector3Like[]): void {
    this._waypoints = waypoints;
    this._currentWaypointIndex = 0;
    if (waypoints.length > 0) {
      this.moveToNextWaypoint();
    }
  }

  /**
   * Move to the next waypoint in the route
   */
  protected moveToNextWaypoint(): void {
    if (this._currentWaypointIndex >= this._waypoints.length) {
      this._isActive = false;
      return;
    }

    const target = this._waypoints[this._currentWaypointIndex];
    this._currentTarget = target;

    if (this._usePathfinding) {
      const controller = this.controller as PathfindingEntityController;
      controller.pathfind(target, this._speed, {
        maxJump: 2,
        maxFall: 3,
        pathfindCompleteCallback: () => {
          this._currentWaypointIndex++;
          this.moveToNextWaypoint();
        },
      });
    } else {
      const controller = this.controller as SimpleEntityController;
      controller.face(target, this._speed * 2);
      controller.move(target, this._speed, {
        moveCompleteCallback: () => {
          this._currentWaypointIndex++;
          this.moveToNextWaypoint();
        },
      });
    }
  }

  /**
   * Move directly toward a target position
   */
  public moveToward(target: Vector3Like): void {
    this._currentTarget = target;

    if (this._usePathfinding) {
      const controller = this.controller as PathfindingEntityController;
      controller.pathfind(target, this._speed, {
        maxJump: 2,
        maxFall: 3,
      });
    } else {
      const controller = this.controller as SimpleEntityController;
      controller.face(target, this._speed * 2);
      controller.move(target, this._speed);
    }
  }

  /**
   * Chase a target entity
   */
  public chase(targetEntity: Entity): void {
    if (!targetEntity.isSpawned || !this.isSpawned) return;

    this.moveToward(targetEntity.position);
  }

  /**
   * Stop all movement
   */
  public stopMovement(): void {
    if (this._usePathfinding) {
      // PathfindingEntityController extends SimpleEntityController
      const controller = this.controller as PathfindingEntityController;
      controller.stopMove();
      controller.stopFace();
    } else {
      const controller = this.controller as SimpleEntityController;
      controller.stopMove();
      controller.stopFace();
    }
    this._currentTarget = null;
  }

  /**
   * Face toward a position
   */
  public faceToward(target: Vector3Like): void {
    const controller = this.controller as SimpleEntityController;
    controller.face(target, this._speed * 2);
  }

  /**
   * Check distance to a position
   */
  public distanceTo(target: Vector3Like): number {
    const pos = this.position;
    const dx = pos.x - target.x;
    const dy = pos.y - target.y;
    const dz = pos.z - target.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Deactivate the NPC (stops movement, marks as inactive)
   */
  public deactivate(): void {
    this._isActive = false;
    this.stopMovement();
  }

  /**
   * Play a specific animation
   */
  public playAnimation(animationName: string, loop: boolean = true): void {
    if (loop) {
      this.startModelLoopedAnimations([animationName]);
    } else {
      this.startModelOneshotAnimations([animationName]);
    }
  }
}

export default FootballNPC;
