# Animal NPC Football Game Concepts

*Brainstorming Document - Created December 2024*

This document contains game concepts using Hytopia's built-in animal NPC models as targets with the player as quarterback.

---

## Available Animal NPCs (from @hytopia.com/assets)

### Land Animals (Best for Receivers)
| Model | File |
|-------|------|
| Rabbit | `models/npcs/rabbit.gltf` |
| Wolf | `models/npcs/wolf.gltf` |
| Dog (German Shepherd) | `models/npcs/dog-german-shepherd.gltf` |
| Fox | `models/npcs/fox.gltf` |
| Pig | `models/npcs/pig.gltf` |
| Cow | `models/npcs/cow.gltf` |
| Chicken | `models/npcs/chicken.gltf` |
| Sheep | `models/npcs/sheep.gltf` |
| Bear | `models/npcs/bear.gltf` |
| Raccoon | `models/npcs/raccoon.gltf` |
| Ocelot | `models/npcs/ocelot.gltf` |
| Capybara | `models/npcs/capybara.gltf` |
| Horse | `models/npcs/horse.gltf` |
| Donkey | `models/npcs/donkey.gltf` |
| Beaver | `models/npcs/beaver.gltf` |
| Lizard | `models/npcs/lizard.gltf` |
| Frog | `models/npcs/frog.gltf` |
| Turtle | `models/npcs/turtle.gltf` |
| Penguin | `models/npcs/penguin.gltf` |
| Flamingo | `models/npcs/flamingo.gltf` |
| Peacock | `models/npcs/peacock.gltf` |
| Bat | `models/npcs/bat.gltf` |
| Bee (adult/baby) | `models/npcs/bee-adult.gltf`, `models/npcs/bee-baby.gltf` |
| Spider | `models/npcs/spider.gltf` |

### Fish Models
- Carp, Bass, Trout, Tuna, Swordfish, Pufferfish, Catfish, Pike, and many more

### Skeleton/Zombie Models
- `models/npcs/skeleton.gltf`
- `models/npcs/skeleton-archer.gltf`
- `models/npcs/skeleton-warrior-mace.gltf`
- `models/npcs/zombie.gltf`
- `models/npcs/zombie-desert.gltf`
- `models/npcs/zombie-ice.gltf`

---

## Game Concept 1: "Barnyard Blitz"

**Theme:** Farm-themed QB challenge - animals escaped the barn and you need to "round them up" with footballs

### Animals as Receivers (by difficulty)
| Animal | Behavior | Points | Speed |
|--------|----------|--------|-------|
| Cow | Slow, large target | 50 | Slow |
| Pig | Medium, waddles side-to-side | 100 | Medium |
| Chicken | Small, erratic zigzag | 200 | Fast |
| Rabbit | Tiny, hops unpredictably | 300 | Very Fast |

### Defender
- Dog (German Shepherd) chases the football - interceptions!

### Fun Mechanics
- Chickens could "flutter" (jump) randomly making them harder to hit
- Pigs could occasionally stop to "eat" (stationary bonus)
- Cows moo when hit (audio feedback)
- Bonus round: Hit the rooster on the barn roof for 500 pts

### Why This Works
- Simple theme everyone understands
- Clear animal hierarchy by size/speed
- Funny sounds potential
- Uses common animals with good animations

---

## Game Concept 2: "Safari Snap"

**Theme:** Wildlife photographer turned QB - "tag" animals for research points

### Biome Zones on Field
- **Grassland (close):** Zebra-like patterns, capybaras, flamingos
- **Forest (mid):** Fox, raccoon, beaver, deer
- **Mountain (deep):** Wolf, bear, ocelot

### Scoring by Distance + Rarity
| Zone | Easy | Medium | Hard |
|------|------|--------|------|
| Grassland | Capybara (50) | Flamingo (100) | Peacock (150) |
| Forest | Raccoon (100) | Fox (200) | Beaver (250) |
| Mountain | Wolf (200) | Ocelot (350) | Bear (500) |

### Special Mechanics
- Bears are large but charge AT you if you miss (becomes a defender!)
- Foxes can "dodge" - 30% chance to avoid the ball
- Peacocks fan their tail when spawning (visual cue for bonus timing)

---

## Game Concept 3: "Predator vs Prey"

**Theme:** Competitive ecological balance - help prey escape predators OR hit predators to save prey

### Mode A - Save the Prey
- Prey animals (rabbits, sheep, chickens) run across field
- Predators (wolves, bears, foxes) chase them
- Hit the PREDATOR to save the prey = points
- If predator catches prey = lose points
- Creates urgency and moving "defender" targets

### Mode B - Food Chain Frenzy
- Points based on where animal is in food chain
- Rabbit (prey) = 100 pts
- Fox (mid predator) = 200 pts
- Wolf (apex) = 400 pts
- But predators are faster and harder to hit

### Why This Works
- Adds strategic depth with moving defenders
- Creates urgency and tension
- Tells a "story" during gameplay

---

## Game Concept 4: "Fishing Frenzy QB"

**Theme:** Use the 20+ fish models for an underwater/dock-side game

### Setup
Player stands on a dock, throws at fish jumping out of water

### Fish Tiers
| Fish | Size | Points | Behavior |
|------|------|--------|----------|
| Carp | Large | 50 | Slow arc |
| Bass | Medium | 100 | Medium arc |
| Trout | Small | 200 | Fast arc |
| Swordfish | Long/thin | 300 | Straight jump |
| Pufferfish | Bonus | 500 | Inflates mid-jump (timing!) |

### Unique Mechanic
Fish jump in ARCS - you throw in arcs - creates interesting trajectory matching

---

## Game Concept 5: "Noah's Ark Airlift"

**Theme:** Animals need to board the ark before the flood - guide them with footballs

### Wave System
- **Wave 1:** Slow domesticated animals (cows, sheep, pigs, donkeys)
- **Wave 2:** Wild animals (wolves, bears, foxes)
- **Wave 3:** Small/fast animals (rabbits, chickens, raccoons)
- **Final Wave:** Pairs only! (must hit 2 of same animal in a row for bonus)

### Twist
Water level rises on the field as time passes - animals in the "flood zone" are worth 2x but disappear faster

---

## Game Concept 6: "Zoo Breakout"

**Theme:** Animals escaped - tranquilize them to return to enclosures

### Map Zones (like zoo exhibits)
- **Petting Zoo (easy):** Sheep, rabbit, chicken
- **Reptile House:** Lizard, turtle, frog
- **Arctic:** Penguin (waddles hilariously)
- **African:** Flamingo, peacock, ocelot
- **North American:** Bear, wolf, beaver, raccoon

### Combo System
- Hit animals from same exhibit in a row = combo multiplier
- "Complete the Exhibit" bonus for hitting all animals from one zone

### Why This Works
- Great variety of animals
- Zone-based scoring ties into existing wave system
- Natural difficulty progression

---

## Game Concept 7: "Monster Mash Football" (Halloween Theme)

**Using the skeleton/zombie models + animals**

### Entity Scoring
| Entity | Points | Behavior |
|--------|--------|----------|
| Zombie | 100 | Slow shamble |
| Skeleton | 150 | Medium walk |
| Skeleton-Archer | 200 | Shoots back! (dodge mechanic) |
| Bat | 250 | Flies erratically |
| Spider | 300 | Scuttles fast, small |
| Wolf | 200 | Werewolf vibes, fast |

### Spooky Mechanics
- Skeletons break apart on hit (satisfying!)
- Zombies take 2 hits to "down"
- Bats come in swarms (multi-hit bonus)

---

## Top Recommendations

For **most fun + least development effort:**

1. **Barnyard Blitz** - Simple theme, clear animal hierarchy, funny sounds, uses common animals with good animations

2. **Predator vs Prey** - Adds strategic depth with moving defenders, creates urgency, tells a "story"

3. **Zoo Breakout** - Great variety, zone-based scoring ties into existing wave system

---

## Technical Considerations

### What Works Well with Current Code
- Existing lane/wave spawn system adapts easily
- Collision detection already works
- Scoring multipliers already implemented
- Sound system ready for animal sounds

### New Mechanics to Consider Adding
- Animal-specific movement patterns (hop, waddle, gallop)
- Animal sounds on hit (moo, oink, howl)
- Different hitbox sizes per animal
- "Scared" animations when football passes close

### Example Implementation
```typescript
// Using an animal NPC as a receiver
const receiver = new Entity({
  modelUri: 'models/npcs/rabbit.gltf',  // Works without being in project folder!
  modelScale: 0.8,
  modelLoopedAnimations: ['walk'],  // Most have idle, walk, run animations
});
```

---

## Future Ideas to Explore

- Seasonal themes (Winter penguins, Summer tropical)
- Multiplayer competitive modes
- Custom animal skins/colors
- Achievement system based on animal types hit
- "Rare spawn" legendary animals for huge points
- Weather effects that affect animal behavior
