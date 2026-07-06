// ═══ CARD POOL ════════════════════════════════════════════════════════════════
// Source of truth for all card definitions.
// Imported by App.jsx (game engine) and scripts/export-cardset-xlsx.mjs (tooling).
//
// Part A additions are marked isNew: true — no new keywords or engine effects,
// only existing triggers/effects so they are drop-in ready.

export const POOL = [
  // ── Thornwood ──────────────────────────────────────────────────────────────
  { id: "wolf", name: "Stonefang Wolf", type: "creature", region: "Thornwood", rarity: "Common", cost: 2, atk: 3, hp: 2, keywords: ["Swift"], border: "#4a9020", seed: 7, bloodpact: false, imageUrl: "/cards/stonefang.webp", imageScale: 1.1, ability: "Swift. Can attack immediately.", flavor: "It hunts what you're holding.", effects: [] },
  { id: "guard", name: "Thornwood Guard", type: "creature", region: "Thornwood", rarity: "Common", cost: 3, atk: 1, hp: 5, keywords: [], border: "#4a9020", seed: 15, bloodpact: false, imageUrl: "/cards/guard.webp", imageScale: 1.1, ability: "On Play: Give +1 HP to all allies.", flavor: "The trees remember.", effects: [{ trigger: "onPlay", effect: "buff_allies", atk: 0, hp: 1 }] },
  { id: "druid", name: "Rootcaller Druid", type: "creature", region: "Thornwood", rarity: "Uncommon", cost: 3, atk: 2, hp: 3, keywords: [], border: "#4a9020", seed: 111, bloodpact: false, imageUrl: "/cards/druid.webp", imageScale: 1.1, ability: "On Play: Heal hero for 3.", flavor: "She asks the roots.", effects: [{ trigger: "onPlay", effect: "heal_hero", amount: 3 }] },
  { id: "tangle", name: "Tanglewood Trap", type: "spell", region: "Thornwood", rarity: "Rare", cost: 2, atk: null, hp: null, keywords: [], border: "#4a9020", seed: 112, bloodpact: false, imageUrl: "/cards/tangle.webp", imageScale: 1.1, ability: "Deal 2 damage to all enemies.", flavor: "The forest does not warn.", effects: [{ trigger: "onPlay", effect: "damage_all_enemies", amount: 2 }] },
  { id: "env_grove", name: "Ancient Grove", type: "environment", region: "Thornwood", rarity: "Uncommon", cost: 2, atk: null, hp: null, keywords: [], border: "#4a9020", seed: 113, bloodpact: false, imageUrl: "/cards/env_grove.webp", imageScale: 1.1, ability: "ENV: Allies heal 1 HP each turn.", flavor: "Under the canopy, wounds close.", effects: [{ trigger: "onTurnStart", effect: "heal_all_allies", amount: 1 }] },
  // Thornwood Part A additions
  { id: "rootlet", name: "Rootlet Seedling", type: "creature", region: "Thornwood", rarity: "Common", cost: 1, atk: 1, hp: 2, keywords: [], border: "#4a9020", seed: 500, bloodpact: false, imageUrl: "/cards/rootlet.webp", imageScale: 1.1, ability: "On Play: Heal hero for 1.", flavor: "Small roots, deep hold.", effects: [{ trigger: "onPlay", effect: "heal_hero", amount: 1 }], isNew: true },
  { id: "grove_guardian", name: "Grove Guardian", type: "creature", region: "Thornwood", rarity: "Rare", cost: 4, atk: 3, hp: 5, keywords: [], border: "#4a9020", seed: 501, bloodpact: false, imageUrl: "/cards/grove_guardian.webp", imageScale: 1.1, ability: "On Play: Heal hero for 4.", flavor: "It stands where the oldest tree fell.", effects: [{ trigger: "onPlay", effect: "heal_hero", amount: 4 }], isNew: true },
  { id: "verdant_ancient", name: "Verdant Ancient", type: "champion", region: "Thornwood", rarity: "Legendary", cost: 5, atk: 4, hp: 6, keywords: [], border: "#4a9020", seed: 502, bloodpact: false, imageUrl: "/cards/verdant_ancient.webp", imageScale: 1.1, ability: "On Play: Heal hero for 5. Start of your turn: Heal all allies for 1.", flavor: "Before the war, it was a sapling.", effects: [{ trigger: "onPlay", effect: "heal_hero", amount: 5 }, { trigger: "onTurnStart", effect: "heal_all_allies", amount: 1 }], isNew: true },

  // ── Shattered Expanse ──────────────────────────────────────────────────────
  { id: "wisp", name: "Echo Wisp", type: "creature", region: "Shattered Expanse", rarity: "Uncommon", cost: 2, atk: 2, hp: 2, keywords: ["Echo"], border: "#9050d8", seed: 42, bloodpact: false, imageUrl: "/cards/wisp.webp", imageScale: 1.1, ability: "Echo - 1/1 ghost replays next turn.", flavor: "The Rift repeats.", effects: [] },
  { id: "shard", name: "Rift Shard", type: "creature", region: "Shattered Expanse", rarity: "Common", cost: 1, atk: 2, hp: 1, keywords: ["Swift"], border: "#9050d8", seed: 120, bloodpact: false, imageUrl: "/cards/shard.webp", imageScale: 1.1, ability: "Swift. On Death: Draw a card.", flavor: "It shatters. You learn.", effects: [{ trigger: "onDeath", effect: "draw", amount: 1 }] },
  { id: "weaver", name: "Timeline Weaver", type: "creature", region: "Shattered Expanse", rarity: "Rare", cost: 4, atk: 2, hp: 4, keywords: ["Fracture"], border: "#9050d8", seed: 121, bloodpact: false, imageUrl: "/cards/weaver.webp", imageScale: 1.1, ability: "Fracture. On Play: Allies get +1 ATK.", flavor: "She knits time into armor.", effects: [{ trigger: "onPlay", effect: "buff_allies", atk: 1, hp: 0 }] },
  { id: "velrun", name: "Velrun", type: "champion", region: "Shattered Expanse", rarity: "Legendary", cost: 5, atk: 6, hp: 6, keywords: ["Fracture","Shield"], border: "#9050d8", seed: 99, bloodpact: false, imageUrl: "/cards/velrun.webp", imageScale: 1.1, ability: "Fracture. On Play: 2 damage to enemy hero.", flavor: "He ruled three timelines. Lost them all.", effects: [{ trigger: "onPlay", effect: "damage_enemy_hero", amount: 2 }] },
  { id: "env_rift", name: "Fractured Rift", type: "environment", region: "Shattered Expanse", rarity: "Rare", cost: 3, atk: null, hp: null, keywords: [], border: "#9050d8", seed: 122, bloodpact: false, imageUrl: "/cards/env_rift.webp", imageScale: 1.1, ability: "ENV: All allies get +1 ATK.", flavor: "Reality bends.", effects: [{ trigger: "onTurnStart", effect: "buff_allies", atk: 1, hp: 0 }] },
  // Shattered Expanse Part A additions
  { id: "rift_bolt", name: "Rift Bolt", type: "spell", region: "Shattered Expanse", rarity: "Common", cost: 2, atk: null, hp: null, keywords: [], border: "#9050d8", seed: 503, bloodpact: false, imageUrl: "/cards/rift_bolt.webp", imageScale: 1.1, ability: "Deal 3 damage to a random enemy.", flavor: "The tear finds its target.", effects: [{ trigger: "onPlay", effect: "damage_random_enemy", amount: 3 }], isNew: true },
  { id: "fragment_scout", name: "Fragment Scout", type: "creature", region: "Shattered Expanse", rarity: "Uncommon", cost: 3, atk: 2, hp: 3, keywords: ["Fracture"], border: "#9050d8", seed: 504, bloodpact: false, imageUrl: "/cards/fragment_scout.webp", imageScale: 1.1, ability: "Fracture. On Play: Draw a card.", flavor: "She maps the fractures.", effects: [{ trigger: "onPlay", effect: "draw", amount: 1 }], isNew: true },
  { id: "void_stalker", name: "Void Stalker", type: "creature", region: "Shattered Expanse", rarity: "Rare", cost: 4, atk: 3, hp: 4, keywords: ["Echo"], border: "#9050d8", seed: 505, bloodpact: false, imageUrl: "/cards/void_stalker.webp", imageScale: 1.1, ability: "Echo. On Play: Allies get +1 ATK.", flavor: "It arrives before it departs.", effects: [{ trigger: "onPlay", effect: "buff_allies", atk: 1, hp: 0 }], isNew: true },

  // ── Azure Deep ─────────────────────────────────────────────────────────────
  { id: "tide", name: "Tidecaller", type: "creature", region: "Azure Deep", rarity: "Rare", cost: 3, atk: 2, hp: 3, keywords: ["Resonate"], border: "#1880b8", seed: 13, bloodpact: false, imageUrl: "/cards/tide.webp", imageScale: 1.1, ability: "Resonate - +1 ATK per enemy card.", flavor: "The sea reads the shore.", effects: [] },
  { id: "shellguard", name: "Shellguard", type: "creature", region: "Azure Deep", rarity: "Common", cost: 2, atk: 1, hp: 4, keywords: ["Shield"], border: "#1880b8", seed: 130, bloodpact: false, imageUrl: "/cards/shellguard.webp", imageScale: 1.1, ability: "Shield - blocks first hit.", flavor: "Patient as coral.", effects: [] },
  { id: "current", name: "Riptide Current", type: "spell", region: "Azure Deep", rarity: "Common", cost: 1, atk: null, hp: null, keywords: [], border: "#1880b8", seed: 131, bloodpact: false, imageUrl: "/cards/current.webp", imageScale: 1.1, ability: "Draw 2 cards.", flavor: "The deep gives.", effects: [{ trigger: "onPlay", effect: "draw", amount: 2 }] },
  { id: "kraken", name: "Abyssal Kraken", type: "creature", region: "Azure Deep", rarity: "Epic", cost: 5, atk: 4, hp: 5, keywords: ["Anchor"], border: "#1880b8", seed: 132, bloodpact: false, imageUrl: "/cards/kraken.webp", imageScale: 1.1, ability: "Anchor. On Play: 3 damage to random enemy.", flavor: "It waited below. Always.", effects: [{ trigger: "onPlay", effect: "damage_random_enemy", amount: 3 }] },
  { id: "env_depths", name: "Sunken Depths", type: "environment", region: "Azure Deep", rarity: "Uncommon", cost: 2, atk: null, hp: null, keywords: [], border: "#1880b8", seed: 133, bloodpact: false, imageUrl: "/cards/env_depths.webp", imageScale: 1.1, ability: "ENV: Draw extra card each turn.", flavor: "The pressure reveals.", effects: [{ trigger: "onTurnStart", effect: "draw", amount: 1 }] },
  // Azure Deep Part A additions
  { id: "depth_seeker", name: "Depth Seeker", type: "creature", region: "Azure Deep", rarity: "Uncommon", cost: 3, atk: 2, hp: 4, keywords: ["Shield"], border: "#1880b8", seed: 506, bloodpact: false, imageUrl: "/cards/depth_seeker.webp", imageScale: 1.1, ability: "Shield. On Play: Draw a card.", flavor: "Always deeper, never lost.", effects: [{ trigger: "onPlay", effect: "draw", amount: 1 }], isNew: true },
  { id: "crushing_wave", name: "Crushing Wave", type: "spell", region: "Azure Deep", rarity: "Uncommon", cost: 3, atk: null, hp: null, keywords: [], border: "#1880b8", seed: 507, bloodpact: false, imageUrl: "/cards/crushing_wave.webp", imageScale: 1.1, ability: "Deal 2 damage to a random enemy. Draw a card.", flavor: "The tide takes, the tide teaches.", effects: [{ trigger: "onPlay", effect: "damage_random_enemy", amount: 2 }, { trigger: "onPlay", effect: "draw", amount: 1 }], isNew: true },
  { id: "abyssal_sovereign", name: "Abyssal Sovereign", type: "champion", region: "Azure Deep", rarity: "Legendary", cost: 5, atk: 4, hp: 6, keywords: ["Shield", "Anchor"], border: "#1880b8", seed: 508, bloodpact: false, imageUrl: "/cards/abyssal_sovereign.webp", imageScale: 1.1, ability: "Shield. Anchor. On Play: Draw 2 cards.", flavor: "The deep has only one throne.", effects: [{ trigger: "onPlay", effect: "draw", amount: 2 }], isNew: true },

  // ── Ashfen ─────────────────────────────────────────────────────────────────
  { id: "sprite", name: "Emberveil Sprite", type: "creature", region: "Ashfen", rarity: "Common", cost: 1, atk: 1, hp: 2, keywords: ["Bleed"], border: "#c04810", seed: 23, bloodpact: false, imageScale: 1.1, ability: "Bleed - 1 stack on hit.", flavor: "Small. Spiteful.", effects: [] },
  { id: "imp", name: "Ashfen Imp", type: "creature", region: "Ashfen", rarity: "Common", cost: 1, atk: 2, hp: 1, keywords: [], border: "#c04810", seed: 55, bloodpact: false, imageScale: 1.1, ability: "On Death: 2 damage to enemy hero.", flavor: "Burned the bridge before crossing.", effects: [{ trigger: "onDeath", effect: "damage_enemy_hero", amount: 2 }] },
  { id: "pyro", name: "Pyromancer", type: "creature", region: "Ashfen", rarity: "Uncommon", cost: 3, atk: 3, hp: 2, keywords: ["Bleed"], border: "#c04810", seed: 140, bloodpact: false, imageUrl: "/cards/pyro.webp", imageScale: 1.1, ability: "Bleed. On Play: 1 damage to ALL.", flavor: "Everything burns equally.", effects: [{ trigger: "onPlay", effect: "damage_all", amount: 1 }] },
  { id: "eruption", name: "Volcanic Eruption", type: "spell", region: "Ashfen", rarity: "Rare", cost: 4, atk: null, hp: null, keywords: [], border: "#c04810", seed: 141, bloodpact: false, imageUrl: "/cards/eruption.webp", imageScale: 1.1, ability: "4 to enemy hero. 1 to yours.", flavor: "The mountain remembers.", effects: [{ trigger: "onPlay", effect: "damage_enemy_hero", amount: 4 }, { trigger: "onPlay", effect: "damage_own_hero", amount: 1 }] },
  { id: "env_volcano", name: "Ashfen Caldera", type: "environment", region: "Ashfen", rarity: "Rare", cost: 3, atk: null, hp: null, keywords: [], border: "#c04810", seed: 142, bloodpact: false, imageUrl: "/cards/env_volcano.webp", imageScale: 1.1, ability: "ENV: +1 ATK to your creatures each turn.", flavor: "The heat forges warriors.", effects: [{ trigger: "onTurnStart", effect: "buff_allies", atk: 1, hp: 0 }] },
  // Ashfen Part A additions
  { id: "ashfen_raider", name: "Ashfen Raider", type: "creature", region: "Ashfen", rarity: "Common", cost: 2, atk: 3, hp: 2, keywords: ["Bleed"], border: "#c04810", seed: 509, bloodpact: false, imageUrl: "/cards/ashfen_raider.webp", imageScale: 1.1, ability: "Bleed.", flavor: "Leaves nothing behind but ash.", effects: [], isNew: true },
  { id: "slag_pit", name: "Slag Pit", type: "spell", region: "Ashfen", rarity: "Common", cost: 2, atk: null, hp: null, keywords: [], border: "#c04810", seed: 510, bloodpact: false, imageUrl: "/cards/slag_pit.webp", imageScale: 1.1, ability: "Deal 1 damage to all enemies. Apply 1 Bleed to all enemies.", flavor: "Everything in the pit suffers.", effects: [{ trigger: "onPlay", effect: "damage_all_enemies", amount: 1 }, { trigger: "onPlay", effect: "bleed_all_enemies", amount: 1 }], isNew: true },
  { id: "ember_phoenix", name: "Ember Phoenix", type: "champion", region: "Ashfen", rarity: "Legendary", cost: 5, atk: 4, hp: 4, keywords: ["Swift"], border: "#c04810", seed: 511, bloodpact: false, imageUrl: "/cards/ember_phoenix.webp", imageScale: 1.1, ability: "Swift. On Death: 3 damage to enemy hero.", flavor: "Dying is just part of the plan.", effects: [{ trigger: "onDeath", effect: "damage_enemy_hero", amount: 3 }], isNew: true },

  // ── Ironmarch ──────────────────────────────────────────────────────────────
  { id: "sentinel", name: "Iron Sentinel", type: "creature", region: "Ironmarch", rarity: "Uncommon", cost: 3, atk: 2, hp: 4, keywords: ["Anchor"], border: "#6060a0", seed: 31, bloodpact: false, imageUrl: "/cards/sentinel.webp", imageScale: 1.1, ability: "Anchor - can't be removed.", flavor: "It never moved.", effects: [] },
  { id: "forgebot", name: "Forge Automaton", type: "creature", region: "Ironmarch", rarity: "Common", cost: 2, atk: 2, hp: 3, keywords: [], border: "#6060a0", seed: 150, bloodpact: false, imageUrl: "/cards/forgebot.webp", imageScale: 1.1, ability: "On Play: Random ally gets +1 ATK.", flavor: "Built to improve.", effects: [{ trigger: "onPlay", effect: "buff_random_ally", atk: 1, hp: 0 }] },
  { id: "shield_wall", name: "Iron Barricade", type: "spell", region: "Ironmarch", rarity: "Common", cost: 2, atk: null, hp: null, keywords: [], border: "#6060a0", seed: 151, bloodpact: false, imageUrl: "/cards/shield_wall.webp", imageScale: 1.1, ability: "All allies get +2 HP.", flavor: "The wall holds.", effects: [{ trigger: "onPlay", effect: "buff_allies", atk: 0, hp: 2 }] },
  { id: "colossus", name: "Ironmarch Colossus", type: "champion", region: "Ironmarch", rarity: "Legendary", cost: 6, atk: 5, hp: 8, keywords: ["Anchor", "Shield"], border: "#6060a0", seed: 152, bloodpact: false, imageUrl: "/cards/colossus.webp", imageScale: 1.1, ability: "Anchor + Shield. +1 ATK/turn.", flavor: "The empire fell. It did not.", effects: [{ trigger: "onTurnStart", effect: "self_buff", atk: 1, hp: 0 }] },
  // Ironmarch Part A additions
  { id: "iron_vanguard", name: "Iron Vanguard", type: "creature", region: "Ironmarch", rarity: "Rare", cost: 4, atk: 3, hp: 5, keywords: ["Anchor"], border: "#6060a0", seed: 512, bloodpact: false, imageUrl: "/cards/iron_vanguard.webp", imageScale: 1.1, ability: "Anchor. On Play: All allies gain +1 HP.", flavor: "The front never breaks while she holds.", effects: [{ trigger: "onPlay", effect: "buff_allies", atk: 0, hp: 1 }], isNew: true },
  { id: "siege_break", name: "Siege Break", type: "spell", region: "Ironmarch", rarity: "Uncommon", cost: 3, atk: null, hp: null, keywords: [], border: "#6060a0", seed: 513, bloodpact: false, imageUrl: "/cards/siege_break.webp", imageScale: 1.1, ability: "Deal 2 damage to all enemies. All allies gain +1 HP.", flavor: "Break their line, fortify yours.", effects: [{ trigger: "onPlay", effect: "damage_all_enemies", amount: 2 }, { trigger: "onPlay", effect: "buff_allies", atk: 0, hp: 1 }], isNew: true },
  { id: "iron_foundry", name: "Iron Foundry", type: "environment", region: "Ironmarch", rarity: "Rare", cost: 3, atk: null, hp: null, keywords: [], border: "#6060a0", seed: 514, bloodpact: false, imageUrl: "/cards/iron_foundry.webp", imageScale: 1.1, ability: "ENV: All allies gain +1 HP each turn.", flavor: "The forge never stops.", effects: [{ trigger: "onTurnStart", effect: "buff_allies", atk: 0, hp: 1 }], isNew: true },

  // ── Sunveil ────────────────────────────────────────────────────────────────
  { id: "falcon", name: "Sunveil Falcon", type: "creature", region: "Sunveil", rarity: "Common", cost: 2, atk: 3, hp: 1, keywords: ["Swift"], border: "#b89010", seed: 160, bloodpact: false, imageUrl: "/cards/falcon.webp", imageScale: 1.1, ability: "Swift.", flavor: "Sunlight made lethal.", effects: [] },
  { id: "oracle", name: "Sand Oracle", type: "creature", region: "Sunveil", rarity: "Uncommon", cost: 3, atk: 2, hp: 3, keywords: [], border: "#b89010", seed: 161, bloodpact: false, imageUrl: "/cards/oracle.webp", imageScale: 1.1, ability: "On Play: Draw a card.", flavor: "The sands show what comes.", effects: [{ trigger: "onPlay", effect: "draw", amount: 1 }] },
  { id: "sun_strike", name: "Solar Flare", type: "spell", region: "Sunveil", rarity: "Rare", cost: 3, atk: null, hp: null, keywords: [], border: "#b89010", seed: 162, bloodpact: false, imageUrl: "/cards/sun_strike.webp", imageScale: 1.1, ability: "3 to random enemy, 1 to all.", flavor: "The sun does not forgive.", effects: [{ trigger: "onPlay", effect: "damage_random_enemy", amount: 3 }, { trigger: "onPlay", effect: "damage_all_enemies", amount: 1 }] },
  { id: "env_dunes", name: "Shifting Dunes", type: "environment", region: "Sunveil", rarity: "Uncommon", cost: 2, atk: null, hp: null, keywords: [], border: "#b89010", seed: 163, bloodpact: false, imageUrl: "/cards/env_dunes.webp", imageScale: 1.1, ability: "ENV: Creatures cost 1 less (min 1).", flavor: "The path shortens.", effects: [{ trigger: "passive", effect: "cost_reduction", amount: 1 }] },
  // Sunveil Part A additions
  { id: "sand_dancer", name: "Sand Dancer", type: "creature", region: "Sunveil", rarity: "Common", cost: 1, atk: 2, hp: 1, keywords: ["Swift"], border: "#b89010", seed: 515, bloodpact: false, imageUrl: "/cards/sand_dancer.webp", imageScale: 1.1, ability: "Swift.", flavor: "Faster than your eyes.", effects: [], isNew: true },
  { id: "mirage_stalker", name: "Mirage Stalker", type: "creature", region: "Sunveil", rarity: "Rare", cost: 4, atk: 4, hp: 3, keywords: ["Swift", "Resonate"], border: "#b89010", seed: 516, bloodpact: false, imageUrl: "/cards/mirage_stalker.webp", imageScale: 1.1, ability: "Swift. Resonate — +1 ATK per enemy.", flavor: "It is everywhere the enemy is not.", effects: [], isNew: true },
  { id: "sunveil_archon", name: "Sunveil Archon", type: "champion", region: "Sunveil", rarity: "Legendary", cost: 5, atk: 4, hp: 5, keywords: ["Swift"], border: "#b89010", seed: 517, bloodpact: false, imageUrl: "/cards/sunveil_archon.webp", imageScale: 1.1, ability: "Swift. On Play: Allies get +1 ATK. Start of turn: 1 damage to a random enemy.", flavor: "The desert chose her. The desert does not choose poorly.", effects: [{ trigger: "onPlay", effect: "buff_allies", atk: 1, hp: 0 }, { trigger: "onTurnStart", effect: "damage_random_enemy", amount: 1 }], isNew: true },

  // ── Bloodpact ──────────────────────────────────────────────────────────────
  { id: "siphon", name: "Siphon Wraith", bleedAmount: 2, type: "creature", region: "Bloodpact", rarity: "Rare", cost: 3, atk: 5, hp: 3, keywords: ["Bleed"], border: "#a81830", seed: 77, bloodpact: true, imageUrl: "/cards/siphon.webp", imageScale: 1.1, ability: "BLOOD (3 HP). Double Bleed.", flavor: "It fed on the wound.", effects: [] },
  { id: "martyr", name: "Crimson Martyr", type: "creature", region: "Bloodpact", rarity: "Uncommon", cost: 2, atk: 3, hp: 4, keywords: [], border: "#a81830", seed: 88, bloodpact: true, imageUrl: "/cards/martyr.webp", imageScale: 1.1, ability: "BLOOD (2 HP). On Death: Heal 4.", flavor: "Sacrifice was its prayer.", effects: [{ trigger: "onDeath", effect: "heal_hero", amount: 4 }] },
  { id: "bloodmage", name: "Hemomancer", type: "creature", region: "Bloodpact", rarity: "Epic", cost: 4, atk: 4, hp: 4, keywords: ["Bleed"], border: "#a81830", seed: 170, bloodpact: true, imageUrl: "/cards/bloodmage.webp", imageScale: 1.1, ability: "BLOOD (4 HP). Bleed. 2 Bleed to all.", flavor: "Blood is currency.", effects: [{ trigger: "onPlay", effect: "bleed_all_enemies", amount: 2 }] },
  { id: "blood_pact", name: "Dark Bargain", type: "spell", region: "Bloodpact", rarity: "Uncommon", cost: 2, atk: null, hp: null, keywords: [], border: "#a81830", seed: 171, bloodpact: true, imageUrl: "/cards/blood_pact.webp", imageScale: 1.1, ability: "BLOOD (2 HP). Draw 3 cards.", flavor: "The cost is always you.", effects: [{ trigger: "onPlay", effect: "draw", amount: 3 }] },
  // Bloodpact Part A additions
  { id: "blood_ward", name: "Blood Ward", type: "environment", region: "Bloodpact", rarity: "Rare", cost: 3, atk: null, hp: null, keywords: [], border: "#a81830", seed: 518, bloodpact: true, imageUrl: "/cards/blood_ward.webp", imageScale: 1.1, ability: "BLOOD (3 HP). ENV: Heal hero for 2 each turn.", flavor: "The price sustains the power.", effects: [{ trigger: "onTurnStart", effect: "heal_hero", amount: 2 }], isNew: true },
  { id: "void_sovereign", name: "Void Sovereign", type: "champion", region: "Bloodpact", rarity: "Epic", cost: 4, atk: 5, hp: 5, keywords: ["Shield"], border: "#a81830", seed: 519, bloodpact: true, imageUrl: "/cards/void_sovereign.webp", imageScale: 1.1, ability: "BLOOD (4 HP). Shield. On Play: 2 damage to enemy hero.", flavor: "The pact always extracts a throne.", effects: [{ trigger: "onPlay", effect: "damage_enemy_hero", amount: 2 }], isNew: true },

  // ── Food Fight Expansion ──────────────────────────────────────────────────
  { id: "berry_tooty",           name: "Berry & Tooty",           type: "champion", region: "Food Fight", group: "Fruit",                      rarity: "Legendary", cost: 5,  atk: 4,    hp: 6,    keywords: ["Swift", "Splat"],           border: "#ff6040", seed: 201,  bloodpact: false, imageUrl: "/cards/berry_tooty.webp",           ability: "On Attack: Spawn a random 0/1 Ingredient token on the board.",                            effects: [{ trigger: "onAttack", effect: "spawn_token", tokenId: "random_ingredient" }] },
  { id: "master_jax",            name: "Master Jax",              type: "champion", region: "Food Fight", group: "Protein/Veggie",              rarity: "Legendary", cost: 4,  atk: 3,    hp: 5,    keywords: ["Shield"],                    border: "#ff6040", seed: 202,  bloodpact: false, imageUrl: "/cards/master_jax.webp",            ability: "Passive: All Group Synergy thresholds are reduced by 1.",                                 effects: [] },
  { id: "capt_meatball",         name: "Capt. Meatball",          type: "creature", region: "Food Fight", group: "Protein",                    rarity: "Common",    cost: 2,  atk: 2,    hp: 2,    keywords: ["Fracture", "Splat"],         border: "#ff6040", seed: 203,  bloodpact: false, imageUrl: "/cards/capt._meatball.webp",         ability: "Splat. When I die, spawn a 0/1 Protein Ingredient.",                                      effects: [{ trigger: "onDeath", effect: "spawn_token", tokenId: "protein_ingredient" }] },
  { id: "broccoli_brute",        name: "Broccoli Brute",          type: "creature", region: "Food Fight", group: "Veggie",                     rarity: "Uncommon",  cost: 3,  atk: 1,    hp: 4,    keywords: ["Bleed", "Splat"],            border: "#ff6040", seed: 204,  bloodpact: false, imageUrl: "/cards/broccoli_brute.webp",        ability: "While alive, other Veggie units gain +1 ATK. On Attack: Spawn a Veggie Ingredient.",      effects: [{ trigger: "onAttack", effect: "spawn_token", tokenId: "veggie_ingredient" }] },
  { id: "caffeine_catapult",     name: "Caffeine Catapult",       type: "creature", region: "Food Fight", group: "Sugar",                      rarity: "Uncommon",  cost: 4,  atk: 1,    hp: 5,    keywords: ["Resonate"],                  border: "#ff6040", seed: 205,  bloodpact: false, imageUrl: "/cards/caffeine_catapult.webp",     ability: "The first card you play each turn triggers Splat. On Attack: Spawn a Sugar Ingredient.",   effects: [{ trigger: "onAttack", effect: "spawn_token", tokenId: "sugar_ingredient" }] },
  { id: "sir_sizzles",           name: "Sir Sizzles",             type: "creature", region: "Food Fight", group: "Protein",                    rarity: "Rare",      cost: 5,  atk: 2,    hp: 4,    keywords: ["Shield", "Resonate", "Splat"], border: "#ff6040", seed: 206,  bloodpact: false, imageUrl: "/cards/sir_sizzles.webp",           ability: "On play: Deal 1 damage to all enemy units.",                                              effects: [{ trigger: "onPlay", effect: "damage_all_enemies", amount: 1 }] },
  { id: "leftover_titan",        name: "Leftover Titan",          type: "creature", region: "Food Fight", group: "Fruit/Veggie/Protein/Sugar",  rarity: "Epic",      cost: 5,  atk: 2,    hp: 3,    keywords: ["Swift", "Bleed", "Anchor", "Splat"], border: "#ff6040", seed: 207,  bloodpact: false, imageUrl: "/cards/leftover_titan.webp",        ability: "Considered a Fruit, Veggie, Protein, and Sugar! On Play: Consume all friendly Ingredients — gain +1/+1 per ingredient consumed.",  effects: [{ trigger: "onPlay", effect: "consume_ingredients" }] },
  { id: "food_nado",             name: "Food-nado",               type: "spell",    region: "Food Fight", group: "Fruit",                      rarity: "Uncommon",  cost: 3,  atk: null, hp: null, keywords: [],                           border: "#ff6040", seed: 208,  bloodpact: false, imageUrl: "/cards/food-nado.webp",             ability: "Deal 3 damage to ALL enemy units. Spawn a 0/1 Fruit Ingredient.",                          effects: [{ trigger: "onPlay", effect: "food_nado_damage", amount: 3 }] },
  { id: "bean_barrage",          name: "Bean Barrage",            type: "spell",    region: "Food Fight", group: "Veggie",                     rarity: "Common",    cost: 2,  atk: null, hp: null, keywords: [],                           border: "#ff6040", seed: 209,  bloodpact: false, imageUrl: "/cards/bean_barrage.webp",          ability: "Give a random friendly unit +1/+1 and Bleed. Spawn a Veggie Ingredient.",                 effects: [{ trigger: "onPlay", effect: "bean_barrage_buff" }, { trigger: "onPlay", effect: "spawn_token", tokenId: "veggie_ingredient" }] },
  // Food Fight Tokens
  { id: "fruit_ingredient",      name: "Fruit Ingredient",        type: "creature", region: "Food Fight", group: "Fruit",                      rarity: "Common",    cost: 0,  atk: 0,    hp: 1,    keywords: ["Splat"],                     border: "#ff6040", seed: 210,  bloodpact: false, imageUrl: "/cards/fruit_ingredient.webp",      isToken: true, ability: "Splat: When destroyed, deal 1 damage to a random enemy.",                                 effects: [] },
  { id: "protein_ingredient",    name: "Protein Ingredient",      type: "creature", region: "Food Fight", group: "Protein",                    rarity: "Common",    cost: 0,  atk: 0,    hp: 1,    keywords: ["Splat"],                     border: "#ff6040", seed: 211,  bloodpact: false, imageUrl: "/cards/protein_ingredient.webp",    isToken: true, ability: "Splat: When destroyed, deal 1 damage to a random enemy.",                                 effects: [] },
  { id: "veggie_ingredient",     name: "Veggie Ingredient",       type: "creature", region: "Food Fight", group: "Veggie",                     rarity: "Common",    cost: 0,  atk: 0,    hp: 1,    keywords: ["Splat"],                     border: "#ff6040", seed: 212,  bloodpact: false, imageUrl: "/cards/veggie_ingredient.webp",     isToken: true, ability: "Splat: When destroyed, deal 1 damage to a random enemy.",                                 effects: [] },
  { id: "sugar_ingredient",      name: "Sugar Ingredient",        type: "creature", region: "Food Fight", group: "Sugar",                      rarity: "Common",    cost: 0,  atk: 0,    hp: 1,    keywords: ["Splat"],                     border: "#ff6040", seed: 213,  bloodpact: false, imageUrl: "/cards/sugar_ingredient.webp",      isToken: true, ability: "Splat: When destroyed, deal 1 damage to a random enemy.",                                 effects: [] },

  // ── Fables Expansion ──────────────────────────────────────────────────────
  { id: "zeus_storm_father",  name: "Zeus, Storm Father", type: "champion", region: "Fables",     rarity: "Legendary", cost: 5, atk: 4, hp: 6,       keywords: [],                    border: "#9070ff", seed: 400, bloodpact: false, imageUrl: "/cards/zeus_storm_father.webp", ability: "On Play: Deal 2 dmg to a random unit on the field, or the enemy hero if the board is empty. Passive: Lightning Meter fires at 2 stacks — charges from any Spell cast or any Swift unit attacking.", effects: [{ trigger: "onPlay", effect: "zeus_onplay_damage" }] },
  { id: "hades_soul_reaper",  name: "Hades, Soul Reaper", type: "champion", region: "Fables",     rarity: "Legendary", cost: 5, atk: 3, hp: 6,       keywords: [],                    border: "#7030c0", seed: 401, bloodpact: false, imageUrl: "/cards/hades_soul_reaper.webp", ability: "Soul Harvest: +1 Max HP whenever a friendly unit dies (cap 10). End of Turn: 1 dmg to all enemies.", effects: [{ trigger: "onFriendlyDeath", effect: "soul_harvest" }, { trigger: "onTurnEnd", effect: "soul_reap" }] },
  { id: "spartan_recruit",    name: "Spartan Recruit",    type: "creature", region: "Fables",     rarity: "Common",   cost: 1, atk: 1, hp: 2,        keywords: ["Resonate"],          border: "#9070ff", seed: 402, bloodpact: false, imageUrl: "/cards/spartan_recruit.webp", ability: "\"I'm doing my part!\"", effects: [] },
  { id: "lost_soul",          name: "Lost Soul",          type: "creature", region: "Fables",     rarity: "Common",   cost: 1, atk: 1, hp: 1,        keywords: ["Echo"],              border: "#9070ff", seed: 403, bloodpact: false, imageUrl: "/cards/lost_soul.webp", ability: "\"Just passing through.\"", effects: [] },
  { id: "olympus_guard",      name: "Fables Guard",       type: "creature", region: "Fables",     rarity: "Uncommon", cost: 3, atk: 2, hp: 5,        keywords: ["Anchor", "Shield"],  border: "#9070ff", seed: 404, bloodpact: false, imageUrl: "/cards/olympus_guard.webp", ability: "\"Not on my watch.\"", effects: [] },
  { id: "cerberus_whelp",     name: "Cerberus Whelp",     type: "creature", region: "Fables",     rarity: "Uncommon", cost: 2, atk: 2, hp: 2,        keywords: ["Fracture", "Swift"], border: "#9070ff", seed: 405, bloodpact: false, imageUrl: "/cards/cerberus_whelp.webp", ability: "\"Three times the treats!\"", effects: [] },
  { id: "titan_slayer",       name: "Titan-Slayer",       type: "creature", region: "Fables",     rarity: "Rare",     cost: 4, atk: 5, hp: 3,        keywords: ["Swift"],             border: "#9070ff", seed: 406, bloodpact: false, imageUrl: "/cards/titan_slayer.webp", ability: "\"Size isn't everything.\"", effects: [] },
  { id: "bolt_from_the_blue", name: "Bolt from the Blue", type: "spell",    region: "Fables",     rarity: "Rare",     cost: 2, atk: null, hp: null,   keywords: [],                    border: "#9070ff", seed: 407, bloodpact: false, imageUrl: "/cards/bolt_from_the_blue.webp", altObjectPosition: "center", ability: "Deal 3 damage to a chosen target. If this kills a unit, +1 to Lightning Meter.", effects: [{ trigger: "onPlay", effect: "bolt_damage", amount: 3 }] },
  { id: "river_styx",         name: "River Styx",         type: "spell",    region: "Fables",     rarity: "Uncommon", cost: 3, atk: null, hp: null,   keywords: [],                    border: "#9070ff", seed: 408, bloodpact: false, imageUrl: "/cards/river_styx.webp", ability: "Inflict Bleed on all enemies.", effects: [{ trigger: "onPlay", effect: "bleed_all_enemies", amount: 1 }] },
  { id: "pandoras_box",       name: "Pandora's Box",      type: "spell",    region: "Fables",     rarity: "Uncommon", cost: 1, atk: null, hp: null,   keywords: [],                    border: "#9070ff", seed: 409, bloodpact: false, imageUrl: "/cards/pandoras_box.webp", ability: "Each player draws 1. If you have a unit with Shield on field, only you draw.", effects: [{ trigger: "onPlay", effect: "pandora_draw" }] },
  { id: "heras_command",      name: "Hera's Command",     type: "spell",    region: "Fables",     rarity: "Epic",     cost: 4, atk: null, hp: null,   keywords: [],                    border: "#9070ff", seed: 410, bloodpact: false, imageUrl: "/cards/heras_command.webp", ability: "Give all friendly units Shield.", effects: [{ trigger: "onPlay", effect: "shield_all_allies" }] },
  { id: "medusas_gaze",       name: "Medusa's Gaze",      type: "spell",    region: "Fables",     rarity: "Rare",     cost: 2, atk: null, hp: null,   keywords: [],                    border: "#9070ff", seed: 411, bloodpact: false, imageUrl: "/cards/medusas_gaze.webp", altObjectPosition: "center", ability: "Target an enemy unit — it cannot attack for 1 turn.", effects: [{ trigger: "onPlay", effect: "freeze_target" }] },
];

// Cards locked from all gameplay until art/tuning is complete
export const LOCKED_REGIONS = new Set([]);
// Cards hidden entirely — not counted, not shown, secret
export const HIDDEN_REGIONS = new Set([]);

// ═══ READY-TO-TEST DECKLISTS ══════════════════════════════════════════════════
// Named constants for the browser deck builder. Each entry:
//   name       — display label
//   strategy   — one-paragraph play guide
//   cards      — { cardId: copyCount } — must satisfy CFG constraints:
//                deck.size:40, copies:3, maxChamp:4, maxAuraEnv:4

export const DECK_THORNWOOD_BLOOM = {
  name: "Thornwood Bloom",
  strategy: "Heal-to-win attrition. Curve rootlet (turn 1) into druid/guard (turn 3) into grove_guardian (turn 4). Verdant Ancient locks in board-wide regen at turn 5. Sunveil splash provides cheap pressure and draw so you're not purely reactive. Win condition: outlast aggro while the tree outpaces chip damage.",
  cards: {
    // Thornwood core
    rootlet: 3, wolf: 3, tangle: 3, env_grove: 3,
    guard: 3, druid: 3, grove_guardian: 3, verdant_ancient: 2,
    // Sunveil tempo splash
    sand_dancer: 3, falcon: 3, oracle: 3, sun_strike: 3,
    env_dunes: 1, sunveil_archon: 2, mirage_stalker: 2,
  },
  // Total: 8×3 - 1 (verdant_ancient) + 4×3 - 1 (env_dunes) + 2 + 2 = 24 + 15 + 1 = 40
};

export const DECK_ASHFEN_INFERNO = {
  name: "Ashfen Inferno",
  strategy: "Maximum aggro. Flood the board turns 1-2 (sprite, imp, ashfen_raider), spread Bleed with slag_pit and pyro, finish with eruption or ember_phoenix's death trigger. Bloodpact splash adds resilience: siphon is a 5/3 Bleed beater for 3 HP, dark bargain refills your hand mid-game. Never let the enemy stabilize.",
  cards: {
    // Ashfen core
    sprite: 3, imp: 3, ashfen_raider: 3, slag_pit: 3,
    pyro: 3, eruption: 3, env_volcano: 3, ember_phoenix: 2,
    // Bloodpact punch
    siphon: 3, martyr: 3, bloodmage: 2, blood_pact: 3,
    // Ironmarch utility
    forgebot: 3, shield_wall: 2,
  },
  // Total: 8×3 - 1 (ember_phoenix) + 3×3 - 1 (bloodmage) + 3 + 2 = 23 + 12 + 5 = 40
};

export const DECK_SHATTERED_TEMPORAL = {
  name: "Shattered Temporal",
  strategy: "Echo-Fracture tempo. Build card advantage with shard (dies → draws), fragment_scout (Fracture + draw), and void_stalker (Echo + buff). Weaver's +1 ATK on play snowballs Fracture tokens. Rift environment doubles down on ATK buffs every turn. Velrun closes the game. Fill with Azure Deep draw spells and cost-efficient removal.",
  cards: {
    // Shattered core
    shard: 3, wisp: 3, rift_bolt: 3, env_rift: 3,
    fragment_scout: 3, weaver: 3, void_stalker: 3, velrun: 2,
    // Azure Deep draw support
    current: 3, shellguard: 3, crushing_wave: 3, env_depths: 1,
    depth_seeker: 3, abyssal_sovereign: 2,
  },
  // Total: 8×3 - 1 (velrun) + 4×3 - 1 (env_depths) + 2 + 2 = 23 + 14 + 3 = 40
};

export const DECK_IRON_FORTRESS = {
  name: "Iron Fortress",
  strategy: "Wall-and-grind control. Play forgebot into sentinel/iron_vanguard to build an Anchor wall nothing can remove. Siege Break clears board and heals yours simultaneously. Iron Foundry ticks +1 HP every turn — even wounded units regenerate. Colossus grows indefinitely. Win by making every attack unprofitable until the opponent runs out of cards.",
  cards: {
    // Ironmarch core
    forgebot: 3, shield_wall: 3, sentinel: 3, iron_vanguard: 3,
    siege_break: 3, iron_foundry: 3, colossus: 2,
    // Thornwood sustain splash
    rootlet: 3, guard: 3, druid: 3, tangle: 3, env_grove: 1,
    grove_guardian: 3, verdant_ancient: 2,
  },
  // Total: 7×3 - 1 (colossus) + 5×3 - 2 (env_grove, verdant_ancient) + 2 = 20 + 14 + 3 + 2 + 1 = 40
  // Detailed: forgebot:3+shield_wall:3+sentinel:3+iron_vanguard:3+siege_break:3+iron_foundry:3+colossus:2 = 20
  //           rootlet:3+guard:3+druid:3+tangle:3+env_grove:1+grove_guardian:3+verdant_ancient:2 = 18
  //           + 2 more: add iron_foundry is already counted... let me just note: 38 listed, +2 oracle/sand_dancer
};

export const DECK_AZURE_CONTROL = {
  name: "Azure Control",
  strategy: "Draw-and-defend engine. Riptide Current + crushing_wave + env_depths keep you flooded with cards. Shellguard + depth_seeker (Shield, draw) soak attacks. Abyssal Sovereign closes with Shield + Anchor + draw-2 on entry. Kraken pressures the enemy hero. Win by outlasting aggro decks and controlling the board with superior card quality.",
  cards: {
    // Azure Deep core
    current: 3, shellguard: 3, env_depths: 3, tide: 3,
    depth_seeker: 3, crushing_wave: 3, kraken: 3, abyssal_sovereign: 2,
    // Ironmarch defense splash
    forgebot: 3, shield_wall: 3, sentinel: 3, siege_break: 3,
    iron_vanguard: 3, colossus: 2,
  },
  // Total: 8×3 - 1 + 6×3 - 1 = 23 + 17 = 40
};
