/**
 * BaseRound - Abstract base class for all game rounds
 * Provides common functionality for round management
 */

import {
  World,
  Entity,
  Player,
  Audio,
} from 'hytopia';

import type { MultiRoundGameManager } from '../MultiRoundGameManager';
import type { GameRound } from '../types/MultiRoundTypes';

export abstract class BaseRound {
  protected world: World;
  protected gameManager: MultiRoundGameManager;
  protected isActive: boolean = false;
  protected activeEntities: Set<Entity> = new Set();

  constructor(world: World, gameManager: MultiRoundGameManager) {
    this.world = world;
    this.gameManager = gameManager;
  }

  /**
   * Initialize the round (called before countdown)
   */
  public abstract initialize(): void;

  /**
   * Start the round (called after countdown)
   */
  public abstract start(): void;

  /**
   * Update the round each tick
   */
  public abstract update(dt: number): void;

  /**
   * End the round
   */
  public abstract end(): void;

  /**
   * Clean up round resources
   */
  public cleanup(): void {
    this.isActive = false;

    // Despawn all active entities
    this.activeEntities.forEach(entity => {
      if (entity.isSpawned) {
        entity.despawn();
      }
    });
    this.activeEntities.clear();
  }

  /**
   * Add score for a player
   */
  protected addScore(playerId: string, points: number): void {
    this.gameManager.addPlayerScore(playerId, points);
  }

  /**
   * Play a sound effect
   */
  protected playSound(uri: string, volume: number = 0.5): void {
    try {
      new Audio({
        uri,
        volume,
      }).play(this.world);
    } catch (error) {
      console.log(`[BaseRound] Sound not found: ${uri}`);
    }
  }

  /**
   * Spawn an entity and track it
   */
  protected spawnEntity(entity: Entity, position: any, rotation?: any): void {
    entity.spawn(this.world, position, rotation);
    this.activeEntities.add(entity);
  }

  /**
   * Despawn a tracked entity
   */
  protected despawnEntity(entity: Entity): void {
    if (entity.isSpawned) {
      entity.despawn();
    }
    this.activeEntities.delete(entity);
  }

  /**
   * Get all player entities
   */
  protected getPlayerEntities(): Map<string, Entity> {
    return this.gameManager.getAllPlayerEntities();
  }

  /**
   * Get active player IDs
   */
  protected getActivePlayers(): Set<string> {
    return this.gameManager.getActivePlayers();
  }

  /**
   * Send data to a specific player's UI
   */
  protected sendToPlayerUI(player: Player, data: any): void {
    player.ui.sendData(data);
  }

  /**
   * Calculate distance between two positions
   */
  protected distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Get a random position within bounds
   */
  protected randomPosition(
    minX: number, maxX: number,
    y: number,
    minZ: number, maxZ: number
  ): { x: number; y: number; z: number } {
    return {
      x: minX + Math.random() * (maxX - minX),
      y,
      z: minZ + Math.random() * (maxZ - minZ),
    };
  }

  /**
   * Get a random element from an array
   */
  protected randomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }
}

export default BaseRound;
