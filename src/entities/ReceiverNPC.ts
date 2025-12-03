/**
 * ReceiverNPC - AI-controlled receiver that runs routes
 * Used in Receiver Run mode where players must catch passes from NPC QB
 */

import {
  Entity,
  SimpleEntityController,
  World,
  Vector3Like,
  Quaternion,
} from 'hytopia';

import { FootballNPC, FootballNPCOptions } from './FootballNPC';

export type RouteType = 'slant' | 'post' | 'corner' | 'go' | 'curl' | 'out' | 'in' | 'flat';

export interface ReceiverRoute {
  type: RouteType;
  waypoints: Vector3Like[];
  catchZone: Vector3Like; // Where the receiver should catch the ball
}

// Predefined route patterns (relative positions, will be adjusted based on spawn position)
const ROUTE_PATTERNS: Record<RouteType, { offsets: Vector3Like[], catchOffset: Vector3Like }> = {
  slant: {
    offsets: [
      { x: 0, y: 0, z: -5 },
      { x: 3, y: 0, z: -15 },
    ],
    catchOffset: { x: 3, y: 0, z: -15 },
  },
  post: {
    offsets: [
      { x: 0, y: 0, z: -10 },
      { x: 5, y: 0, z: -25 },
    ],
    catchOffset: { x: 5, y: 0, z: -25 },
  },
  corner: {
    offsets: [
      { x: 0, y: 0, z: -10 },
      { x: -5, y: 0, z: -20 },
    ],
    catchOffset: { x: -5, y: 0, z: -20 },
  },
  go: {
    offsets: [
      { x: 0, y: 0, z: -10 },
      { x: 0, y: 0, z: -30 },
    ],
    catchOffset: { x: 0, y: 0, z: -30 },
  },
  curl: {
    offsets: [
      { x: 0, y: 0, z: -12 },
      { x: 0, y: 0, z: -10 },
    ],
    catchOffset: { x: 0, y: 0, z: -10 },
  },
  out: {
    offsets: [
      { x: 0, y: 0, z: -8 },
      { x: -8, y: 0, z: -8 },
    ],
    catchOffset: { x: -8, y: 0, z: -8 },
  },
  in: {
    offsets: [
      { x: 0, y: 0, z: -8 },
      { x: 6, y: 0, z: -8 },
    ],
    catchOffset: { x: 6, y: 0, z: -8 },
  },
  flat: {
    offsets: [
      { x: -3, y: 0, z: -2 },
      { x: -8, y: 0, z: -2 },
    ],
    catchOffset: { x: -8, y: 0, z: -2 },
  },
};

export interface ReceiverNPCOptions extends Partial<FootballNPCOptions> {
  routeType?: RouteType;
}

export class ReceiverNPC extends FootballNPC {
  private _routeType: RouteType;
  private _route: ReceiverRoute | null = null;
  private _isRunningRoute: boolean = false;
  private _hasCaughtBall: boolean = false;
  private _isOpenForPass: boolean = false;
  private _openForPassCallback: (() => void) | null = null;

  constructor(options: ReceiverNPCOptions = {}) {
    super({
      role: 'receiver',
      modelUri: options.modelUri || 'models/defender/scene.gltf',
      modelScale: options.modelScale || 0.055,
      speed: options.speed || 6,
      usePathfinding: false, // Receivers use simple movement for smoother routes
      teamColor: options.teamColor || 'blue',
      ...options,
    });

    this._routeType = options.routeType || 'slant';
  }

  get routeType(): RouteType { return this._routeType; }
  get isRunningRoute(): boolean { return this._isRunningRoute; }
  get hasCaughtBall(): boolean { return this._hasCaughtBall; }
  get isOpenForPass(): boolean { return this._isOpenForPass; }
  get catchZone(): Vector3Like | null { return this._route?.catchZone || null; }

  /**
   * Generate a route based on spawn position and route type
   */
  public generateRoute(spawnPosition: Vector3Like, routeType?: RouteType): ReceiverRoute {
    const type = routeType || this._routeType;
    const pattern = ROUTE_PATTERNS[type];

    // Mirror route if on right side of field
    const mirror = spawnPosition.x > 0 ? -1 : 1;

    const waypoints = pattern.offsets.map(offset => ({
      x: spawnPosition.x + (offset.x * mirror),
      y: spawnPosition.y + offset.y,
      z: spawnPosition.z + offset.z,
    }));

    const catchZone = {
      x: spawnPosition.x + (pattern.catchOffset.x * mirror),
      y: spawnPosition.y + pattern.catchOffset.y,
      z: spawnPosition.z + pattern.catchOffset.z,
    };

    this._route = { type, waypoints, catchZone };
    return this._route;
  }

  /**
   * Run the assigned route
   */
  public runRoute(onOpenForPass?: () => void): void {
    if (!this._route || this._route.waypoints.length === 0) {
      console.warn('[ReceiverNPC] No route set!');
      return;
    }

    this._isRunningRoute = true;
    this._openForPassCallback = onOpenForPass || null;
    this.playAnimation('run', true);

    // Start running the route
    this.setWaypoints(this._route.waypoints);

    // Signal when receiver reaches the catch zone
    const checkOpenForPass = setInterval(() => {
      if (!this.isSpawned || !this._isRunningRoute) {
        clearInterval(checkOpenForPass);
        return;
      }

      if (this._route?.catchZone) {
        const distance = this.distanceTo(this._route.catchZone);
        if (distance < 3 && !this._isOpenForPass) {
          this._isOpenForPass = true;
          if (this._openForPassCallback) {
            this._openForPassCallback();
          }
        }
      }
    }, 100);
  }

  /**
   * Called when the receiver catches the ball
   */
  public catchBall(): void {
    this._hasCaughtBall = true;
    this._isRunningRoute = false;
    this.playAnimation('idle', true);
    this.stopMovement();
  }

  /**
   * Check if a thrown ball is catchable
   */
  public canCatchBall(ballPosition: Vector3Like, catchRadius: number = 2.0): boolean {
    if (this._hasCaughtBall || !this._isOpenForPass) return false;

    const distance = this.distanceTo(ballPosition);
    return distance <= catchRadius;
  }

  /**
   * Run after catching (for additional yards)
   */
  public runAfterCatch(targetEndzone: Vector3Like): void {
    if (!this._hasCaughtBall) return;

    this.playAnimation('run', true);
    this.moveToward(targetEndzone);
  }

  /**
   * Get available route types
   */
  public static getRouteTypes(): RouteType[] {
    return Object.keys(ROUTE_PATTERNS) as RouteType[];
  }

  /**
   * Get a random route type
   */
  public static getRandomRouteType(): RouteType {
    const routes = ReceiverNPC.getRouteTypes();
    return routes[Math.floor(Math.random() * routes.length)];
  }
}

export default ReceiverNPC;
