/**
 * BarnyardBlitzRound - Farm animal target throwing game mode
 * Players throw footballs at farm animals (cow, pig, chicken, rabbit)
 * Dog defenders intercept throws
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
  SPIRAL_CONFIG,
  createAlignmentQuaternion,
  createAxisAngleQuaternion,
  multiplyQuaternions,
} from '../utils/QuaternionUtils';

// ============================================
// Animal Archetypes
// ============================================

const ANIMAL_ARCHETYPES = {
  cow: {
    id: 'cow',
    name: 'Cow',
    modelUri: 'models/npcs/cow.gltf',
    basePoints: 50,
    modelScale: 1.5,
    speed: 1.5,
    hitRadius: 2.5,
    animation: 'walk',
  },
  pig: {
    id: 'pig',
    name: 'Pig',
    modelUri: 'models/npcs/pig.gltf',
    basePoints: 100,
    modelScale: 1.2,
    speed: 2.5,
    hitRadius: 2.0,
    animation: 'walk',
  },
  chicken: {
    id: 'chicken',
    name: 'Chicken',
    modelUri: 'models/npcs/chicken.gltf',
    basePoints: 200,
    modelScale: 1.0,
    speed: 4.0,
    hitRadius: 1.5,
    animation: 'walk',
  },
  rabbit: {
    id: 'rabbit',
    name: 'Rabbit',
    modelUri: 'models/npcs/rabbit.gltf',
    basePoints: 300,
    modelScale: 1.2,
    speed: 5.0,
    hitRadius: 1.5,
    animation: 'walk',
  },
};

// Dog defender
const DOG_CONFIG = {
  modelUri: 'models/npcs/dog-german-shepherd.gltf',
  modelScale: 1.5,
  speed: 3.0,
  hitRadius: 2.0,
  animation: 'walk',
};

// ============================================
// Barnyard Props Configuration
// ============================================

interface PropConfig {
  id: string;
  modelUri: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale: number;
}

const BARNYARD_PROPS: PropConfig[] = [
  // Left side fences (along X = -14)
  { id: 'fence_l1', modelUri: 'models/environment/House/fence-wood-1.gltf', position: { x: -14, y: 1, z: -15 }, rotation: { x: 0, y: 90, z: 0 }, scale: 1.5 },
  { id: 'fence_l2', modelUri: 'models/environment/House/fence-wood-2.gltf', position: { x: -14, y: 1, z: -10 }, rotation: { x: 0, y: 90, z: 0 }, scale: 1.5 },
  { id: 'fence_l3', modelUri: 'models/environment/House/fence-wood-1.gltf', position: { x: -14, y: 1, z: -5 }, rotation: { x: 0, y: 90, z: 0 }, scale: 1.5 },
  { id: 'fence_l4', modelUri: 'models/environment/House/fence-wood-3.gltf', position: { x: -14, y: 1, z: 0 }, rotation: { x: 0, y: 90, z: 0 }, scale: 1.5 },
  { id: 'fence_l5', modelUri: 'models/environment/House/fence-wood-1.gltf', position: { x: -14, y: 1, z: 5 }, rotation: { x: 0, y: 90, z: 0 }, scale: 1.5 },
  { id: 'fence_l6', modelUri: 'models/environment/House/fence-wood-2.gltf', position: { x: -14, y: 1, z: 10 }, rotation: { x: 0, y: 90, z: 0 }, scale: 1.5 },

  // Right side fences (along X = 14)
  { id: 'fence_r1', modelUri: 'models/environment/House/fence-wood-1.gltf', position: { x: 14, y: 1, z: -15 }, rotation: { x: 0, y: 90, z: 0 }, scale: 1.5 },
  { id: 'fence_r2', modelUri: 'models/environment/House/fence-wood-3.gltf', position: { x: 14, y: 1, z: -10 }, rotation: { x: 0, y: 90, z: 0 }, scale: 1.5 },
  { id: 'fence_r3', modelUri: 'models/environment/House/fence-wood-1.gltf', position: { x: 14, y: 1, z: -5 }, rotation: { x: 0, y: 90, z: 0 }, scale: 1.5 },
  { id: 'fence_r4', modelUri: 'models/environment/House/fence-wood-2.gltf', position: { x: 14, y: 1, z: 0 }, rotation: { x: 0, y: 90, z: 0 }, scale: 1.5 },
  { id: 'fence_r5', modelUri: 'models/environment/House/fence-wood-1.gltf', position: { x: 14, y: 1, z: 5 }, rotation: { x: 0, y: 90, z: 0 }, scale: 1.5 },
  { id: 'fence_r6', modelUri: 'models/environment/House/fence-wood-3.gltf', position: { x: 14, y: 1, z: 10 }, rotation: { x: 0, y: 90, z: 0 }, scale: 1.5 },

  // Scarecrows (corners/edges)
  { id: 'scarecrow1', modelUri: 'models/environment/Halloween/scarecrow-wheat.gltf', position: { x: -12, y: 1, z: -18 }, rotation: { x: 0, y: 45, z: 0 }, scale: 1.2 },
  { id: 'scarecrow2', modelUri: 'models/environment/Halloween/scarecrow-pumpkin.gltf', position: { x: 12, y: 1, z: -18 }, rotation: { x: 0, y: -45, z: 0 }, scale: 1.2 },

  // Barrels (scattered around edges)
  { id: 'barrel1', modelUri: 'models/environment/City/barrel-wood-1.gltf', position: { x: -11, y: 1, z: 12 }, scale: 1.0 },
  { id: 'barrel2', modelUri: 'models/environment/City/barrel-wood-2.gltf', position: { x: -10, y: 1, z: 13 }, scale: 1.0 },
  { id: 'barrel3', modelUri: 'models/environment/City/barrel-wood-1.gltf', position: { x: 11, y: 1, z: 12 }, scale: 1.0 },
  { id: 'barrel4', modelUri: 'models/environment/City/barrel-wood-2.gltf', position: { x: 10, y: 1, z: 13 }, scale: 1.0 },

  // Crates
  { id: 'crate1', modelUri: 'models/environment/Dungeon/crate-1.gltf', position: { x: -12, y: 1, z: 15 }, scale: 1.0 },
  { id: 'crate2', modelUri: 'models/environment/Dungeon/crate-2.gltf', position: { x: 12, y: 1, z: 15 }, scale: 1.0 },

  // Pumpkins (decoration clusters)
  { id: 'pumpkin1', modelUri: 'models/environment/Halloween/stacked-pumpkin.gltf', position: { x: -8, y: 1, z: -18 }, scale: 1.0 },
  { id: 'pumpkin2', modelUri: 'models/environment/Farm/pumpkin-stage4.gltf', position: { x: 8, y: 1, z: -18 }, scale: 1.5 },
  { id: 'pumpkin3', modelUri: 'models/environment/Farm/pumpkin-stage4.gltf', position: { x: 0, y: 1, z: -20 }, scale: 1.5 },

  // Corn stalks (back of field)
  { id: 'corn1', modelUri: 'models/environment/Farm/corn-stage4.gltf', position: { x: -5, y: 1, z: -19 }, scale: 1.5 },
  { id: 'corn2', modelUri: 'models/environment/Farm/corn-stage4.gltf', position: { x: -3, y: 1, z: -19 }, scale: 1.5 },
  { id: 'corn3', modelUri: 'models/environment/Farm/corn-stage4.gltf', position: { x: 3, y: 1, z: -19 }, scale: 1.5 },
  { id: 'corn4', modelUri: 'models/environment/Farm/corn-stage4.gltf', position: { x: 5, y: 1, z: -19 }, scale: 1.5 },

  // Beehive
  { id: 'beehive1', modelUri: 'models/environment/Farm/beehive.gltf', position: { x: -13, y: 1, z: -12 }, scale: 1.2 },

  // Wagon cart (near player spawn area for atmosphere)
  { id: 'wagon1', modelUri: 'models/environment/Desert/wagon-cart.gltf', position: { x: 8, y: 1, z: 20 }, rotation: { x: 0, y: -30, z: 0 }, scale: 1.0 },
];

// ============================================
// Data Interfaces
// ============================================

interface AnimalData {
  id: string;
  entity: Entity;
  archetype: typeof ANIMAL_ARCHETYPES[keyof typeof ANIMAL_ARCHETYPES];
  spawnTime: number;
  isHit: boolean;
  speed: number;
  direction: 1 | -1;
  depthZ: number;
}

interface DogData {
  id: string;
  entity: Entity;
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

// ============================================
// Constants
// ============================================

const MAX_ANIMALS = 6;
const MAX_DOGS = 2;
const THROW_GRAVITY = -15;

// Wave configurations (60 second game)
const WAVE_CONFIGS = [
  {
    name: 'Wave 1 - Easy Pickings',
    startTime: 0,
    endTime: 20,
    spawnInterval: 2.0,
    dogSpawnInterval: 8.0,
    animalWeights: { cow: 40, pig: 35, chicken: 15, rabbit: 10 },
  },
  {
    name: 'Wave 2 - Getting Harder',
    startTime: 20,
    endTime: 40,
    spawnInterval: 1.5,
    dogSpawnInterval: 6.0,
    animalWeights: { cow: 25, pig: 35, chicken: 25, rabbit: 15 },
  },
  {
    name: 'Wave 3 - Barnyard Chaos',
    startTime: 40,
    endTime: 60,
    spawnInterval: 1.0,
    dogSpawnInterval: 4.0,
    animalWeights: { cow: 15, pig: 25, chicken: 35, rabbit: 25 },
  },
];

// ============================================
// BarnyardBlitzRound Class
// ============================================

export class BarnyardBlitzRound extends BaseRound {
  private animals: Map<string, AnimalData> = new Map();
  private dogs: Map<string, DogData> = new Map();
  private footballs: Map<string, FootballData> = new Map();
  private props: Map<string, Entity> = new Map();
  private multiplier: number = 1.0;
  private streak: number = 0;
  private longestStreak: number = 0;
  private lastAnimalSpawn: number = 0;
  private lastDogSpawn: number = 0;
  private elapsedTime: number = 0;
  private currentWaveIndex: number = 0;

  // Player charge states
  private playerCharging: Map<string, { isCharging: boolean; power: number; startTime: number }> = new Map();

  // ============================================
  // Lifecycle Methods
  // ============================================

  public initialize(): void {
    console.log('[BarnyardBlitzRound] Initializing...');
    this.animals.clear();
    this.dogs.clear();
    this.footballs.clear();
    this.multiplier = 1.0;
    this.streak = 0;
    this.longestStreak = 0;
    this.lastAnimalSpawn = 0;
    this.lastDogSpawn = 0;
    this.elapsedTime = 0;
    this.currentWaveIndex = 0;
    this.playerCharging.clear();
  }

  public start(): void {
    console.log('[BarnyardBlitzRound] Starting! Round up those farm animals!');
    this.isActive = true;

    // Spawn barnyard props for atmosphere
    this.spawnProps();
  }

  public update(dt: number): void {
    if (!this.isActive) return;

    this.elapsedTime += dt;

    // Update current wave
    this.updateWave();

    const wave = WAVE_CONFIGS[this.currentWaveIndex];

    // Spawn animals
    if (this.elapsedTime - this.lastAnimalSpawn >= wave.spawnInterval) {
      if (this.animals.size < MAX_ANIMALS) {
        this.spawnAnimal();
        this.lastAnimalSpawn = this.elapsedTime;
      }
    }

    // Spawn dogs
    if (this.elapsedTime - this.lastDogSpawn >= wave.dogSpawnInterval) {
      if (this.dogs.size < MAX_DOGS) {
        this.spawnDog();
        this.lastDogSpawn = this.elapsedTime;
      }
    }

    // Update animals (move horizontally)
    this.updateAnimals(dt);

    // Update dogs (bounce back and forth)
    this.updateDogs(dt);

    // Update footballs
    this.updateFootballs(dt);

    // Update player charging
    this.updateCharging(dt);
  }

  public end(): void {
    console.log('[BarnyardBlitzRound] Ending...');
    this.isActive = false;

    // Update longest streak stat
    this.getActivePlayers().forEach(playerId => {
      if (this.longestStreak > 0) {
        const currentLongest = this.gameManager.getState().playerScores.get(playerId)?.stats.longestStreak || 0;
        if (this.longestStreak > currentLongest) {
          this.gameManager.updatePlayerStats(playerId, {
            longestStreak: this.longestStreak,
          });
        }
      }
    });
  }

  public override cleanup(): void {
    super.cleanup();

    // Despawn barnyard props
    this.despawnProps();

    this.animals.clear();
    this.dogs.clear();
    this.footballs.clear();
    this.playerCharging.clear();
  }

  // ============================================
  // Props Management
  // ============================================

  private spawnProps(): void {
    console.log('[BarnyardBlitzRound] Spawning barnyard props...');

    for (const propConfig of BARNYARD_PROPS) {
      const propEntity = new Entity({
        name: `prop_${propConfig.id}`,
        modelUri: propConfig.modelUri,
        modelScale: propConfig.scale,
        rigidBodyOptions: {
          type: RigidBodyType.KINEMATIC,
          enabledRotations: { x: false, y: false, z: false },
        },
      });

      // Calculate rotation
      const rotation = propConfig.rotation
        ? Quaternion.fromEuler(propConfig.rotation.x, propConfig.rotation.y, propConfig.rotation.z)
        : Quaternion.fromEuler(0, 0, 0);

      this.spawnEntity(propEntity, propConfig.position, rotation);
      this.props.set(propConfig.id, propEntity);
    }

    console.log(`[BarnyardBlitzRound] Spawned ${this.props.size} barnyard props`);
  }

  private despawnProps(): void {
    console.log('[BarnyardBlitzRound] Despawning barnyard props...');

    this.props.forEach((entity, id) => {
      this.despawnEntity(entity);
    });

    this.props.clear();
    console.log('[BarnyardBlitzRound] All props despawned');
  }

  // ============================================
  // Wave Management
  // ============================================

  private updateWave(): void {
    for (let i = WAVE_CONFIGS.length - 1; i >= 0; i--) {
      if (this.elapsedTime >= WAVE_CONFIGS[i].startTime) {
        if (i !== this.currentWaveIndex) {
          this.currentWaveIndex = i;
          console.log(`[BarnyardBlitzRound] ${WAVE_CONFIGS[i].name}`);
        }
        break;
      }
    }
  }

  private getWeightedAnimalType(): keyof typeof ANIMAL_ARCHETYPES {
    const wave = WAVE_CONFIGS[this.currentWaveIndex];
    const weights = wave.animalWeights;
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (const [type, weight] of Object.entries(weights)) {
      random -= weight;
      if (random <= 0) {
        return type as keyof typeof ANIMAL_ARCHETYPES;
      }
    }

    return 'cow'; // Fallback
  }

  // ============================================
  // Spawning
  // ============================================

  private spawnAnimal(): void {
    const animalType = this.getWeightedAnimalType();
    const archetype = ANIMAL_ARCHETYPES[animalType];

    const spawnOnLeft = Math.random() > 0.5;
    const laneX = spawnOnLeft ? -12 : 12;
    const direction = spawnOnLeft ? 1 : -1;
    const depthZ = -20 + Math.random() * 35; // Z from -20 to 15

    const animalId = `animal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const animalEntity = new Entity({
      name: animalId,
      modelUri: archetype.modelUri,
      modelScale: archetype.modelScale,
      modelLoopedAnimations: [archetype.animation],
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC,
        enabledRotations: { x: false, y: true, z: false },
      },
    });

    this.spawnEntity(animalEntity, { x: laneX, y: 1, z: depthZ });

    // Face the direction of movement (direction 1 = moving right = face +X = -90 degrees)
    const faceAngle = direction === 1 ? -90 : 90;
    animalEntity.setRotation(Quaternion.fromEuler(0, faceAngle, 0));

    const animalData: AnimalData = {
      id: animalId,
      entity: animalEntity,
      archetype,
      spawnTime: Date.now(),
      isHit: false,
      speed: archetype.speed,
      direction: direction as 1 | -1,
      depthZ,
    };

    this.animals.set(animalId, animalData);
    console.log(`[BarnyardBlitzRound] Spawned ${archetype.name} at X=${laneX}, Z=${depthZ.toFixed(1)}`);
  }

  private spawnDog(): void {
    const laneX = -6 + Math.random() * 12;
    const depthZ = -5 + Math.random() * 15; // Mid-field area
    const direction = Math.random() > 0.5 ? 1 : -1;

    const dogId = `dog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const dogEntity = new Entity({
      name: dogId,
      modelUri: DOG_CONFIG.modelUri,
      modelScale: DOG_CONFIG.modelScale,
      modelLoopedAnimations: [DOG_CONFIG.animation],
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC,
        enabledRotations: { x: false, y: true, z: false },
      },
    });

    this.spawnEntity(dogEntity, { x: laneX, y: 1, z: depthZ });

    // Face the direction of movement (direction 1 = moving right = face +X = -90 degrees)
    const faceAngle = direction === 1 ? -90 : 90;
    dogEntity.setRotation(Quaternion.fromEuler(0, faceAngle, 0));

    const dogData: DogData = {
      id: dogId,
      entity: dogEntity,
      speed: DOG_CONFIG.speed,
      direction: direction as 1 | -1,
      depthZ,
    };

    this.dogs.set(dogId, dogData);
    console.log(`[BarnyardBlitzRound] Dog defender spawned!`);
  }

  // ============================================
  // Movement Updates
  // ============================================

  private updateAnimals(dt: number): void {
    const toRemove: string[] = [];

    this.animals.forEach((animal, id) => {
      const pos = animal.entity.position;
      const newX = pos.x + animal.direction * animal.speed * dt;

      // Remove if crossed field edge
      if (newX <= -14 || newX >= 14) {
        toRemove.push(id);
        return;
      }

      animal.entity.setPosition({ x: newX, y: pos.y, z: pos.z });
    });

    toRemove.forEach(id => {
      const animal = this.animals.get(id);
      if (animal) {
        this.despawnEntity(animal.entity);
        this.animals.delete(id);
      }
    });
  }

  private updateDogs(dt: number): void {
    this.dogs.forEach(dog => {
      const pos = dog.entity.position;
      let newX = pos.x + dog.direction * dog.speed * dt;

      // Bounce at boundaries
      if (newX <= -8 || newX >= 8) {
        dog.direction = -dog.direction as 1 | -1;
        newX = Math.max(-8, Math.min(8, newX));

        // Update facing direction (direction 1 = moving right = face +X = -90 degrees)
        const faceAngle = dog.direction === 1 ? -90 : 90;
        dog.entity.setRotation(Quaternion.fromEuler(0, faceAngle, 0));
      }

      dog.entity.setPosition({ x: newX, y: pos.y, z: pos.z });
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

      // Check animal collisions (only if ball hasn't hit ground)
      if (!ball.hasHitGround) {
        this.animals.forEach((animal, animalId) => {
          if (animal.isHit) return;

          const dist = this.distance(ballPos, animal.entity.position);
          if (dist < animal.archetype.hitRadius) {
            this.handleAnimalHit(animalId, ballId, ball.thrownBy);
          }
        });

        // Check dog collisions (interception)
        this.dogs.forEach((dog, dogId) => {
          const dist = this.distance(ballPos, dog.entity.position);
          if (dist < DOG_CONFIG.hitRadius) {
            this.handleDogInterception(ballId, ball.thrownBy);
          }
        });
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

  private handleAnimalHit(animalId: string, ballId: string, playerId: string): void {
    const animal = this.animals.get(animalId);
    const ball = this.footballs.get(ballId);

    if (!animal || !ball || animal.isHit) return;
    animal.isHit = true;

    // Calculate points with multiplier
    const basePoints = animal.archetype.basePoints;
    const points = Math.floor(basePoints * this.multiplier);

    // Update scoring
    this.addScore(playerId, points);
    this.streak++;
    this.longestStreak = Math.max(this.longestStreak, this.streak);
    this.multiplier = Math.min(3.0, this.multiplier + 0.1);

    // Update player stats
    this.gameManager.updatePlayerStats(playerId, {
      successfulHits: (this.gameManager.getState().playerScores.get(playerId)?.stats.successfulHits || 0) + 1,
    });

    console.log(`[BarnyardBlitzRound] Hit ${animal.archetype.name}! +${points} pts (${this.multiplier.toFixed(1)}x, ${this.streak} streak)`);

    // Play streak cheers
    if (this.streak === 3) {
      this.playSound('audio/sfx/slight-cheer.wav', 0.5);
    } else if (this.streak >= 5 && this.streak % 5 === 0) {
      this.playSound('audio/sfx/large-cheer.wav', 0.7);
    }

    // Remove animal and ball
    this.despawnEntity(animal.entity);
    this.animals.delete(animalId);
    this.despawnEntity(ball.entity);
    this.footballs.delete(ballId);
  }

  private handleDogInterception(ballId: string, playerId: string): void {
    const ball = this.footballs.get(ballId);
    if (!ball) return;

    // Penalty for dog interception
    this.addScore(playerId, -100);
    this.streak = 0;
    this.multiplier = 1.0;

    console.log(`[BarnyardBlitzRound] Dog intercepted! -100 pts, streak reset`);
    this.playSound('audio/sfx/interception.mp3', 0.5);

    // Remove ball
    this.despawnEntity(ball.entity);
    this.footballs.delete(ballId);
  }

  private handleMiss(): void {
    // Reset streak and multiplier on complete miss
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

  // ============================================
  // External Access
  // ============================================

  public handlePlayerInput(playerId: string, player: Player, inputType: 'start' | 'release'): void {
    if (inputType === 'start') {
      this.startCharge(playerId);
    } else {
      this.releaseThrow(playerId, player);
    }
  }

  // Get current game state for UI
  public getGameState(): {
    multiplier: number;
    streak: number;
    wave: number;
    animalsOnField: number;
    dogsOnField: number;
  } {
    return {
      multiplier: this.multiplier,
      streak: this.streak,
      wave: this.currentWaveIndex + 1,
      animalsOnField: this.animals.size,
      dogsOnField: this.dogs.size,
    };
  }
}

export default BarnyardBlitzRound;
