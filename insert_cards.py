import os

new_cards = [
  '  { id: "strawberry_striker", name: "Strawberry Striker", type: "creature", region: "Food Fight", rarity: "Common",   cost: 1, atk: 2, hp: 2, keywords: ["Swift"],           border: "#ff4040", seed: 201, bloodpact: false, imageUrl: "", ability: "Dashes in fresh from the vine.", effects: [] },\n',
  '  { id: "taco_titan",         name: "Taco Titan",         type: "creature", region: "Food Fight", rarity: "Uncommon", cost: 3, atk: 3, hp: 4, keywords: [],                  border: "#ff4040", seed: 202, bloodpact: false, imageUrl: "", ability: "Folded in flavor, unfolded in fury.", effects: [] },\n',
  '  { id: "pizza_paladin",      name: "Pizza Paladin",      type: "creature", region: "Food Fight", rarity: "Rare",     cost: 4, atk: 2, hp: 5, keywords: ["Shield"],          border: "#ff4040", seed: 203, bloodpact: false, imageUrl: "", ability: "Eight slices of pure defense.", effects: [] },\n',
  '  { id: "broc_baron",         name: "Broccoli Baron",     type: "creature", region: "Food Fight", rarity: "Common",   cost: 2, atk: 1, hp: 6, keywords: [],                  border: "#ff4040", seed: 204, bloodpact: false, imageUrl: "", ability: "The undisputed lord of greens.", effects: [] },\n',
  '  { id: "donut_destroyer",    name: "Donut Destroyer",    type: "creature", region: "Food Fight", rarity: "Rare",     cost: 5, atk: 5, hp: 3, keywords: ["Bleed"],           border: "#ff4040", seed: 205, bloodpact: false, imageUrl: "", ability: "Glazed and dangerous.", effects: [] },\n',
  '  { id: "chili_champion",     name: "Chili Champion",     type: "creature", region: "Food Fight", rarity: "Uncommon", cost: 3, atk: 3, hp: 2, keywords: ["Swift","Sauced"],  border: "#ff4040", seed: 206, bloodpact: false, imageUrl: "", ability: "Burns both ways.", effects: [] },\n',
  '  { id: "ice_cream_imp",      name: "Ice Cream Imp",      type: "creature", region: "Food Fight", rarity: "Common",   cost: 2, atk: 1, hp: 1, keywords: ["Echo"],            border: "#ff4040", seed: 207, bloodpact: false, imageUrl: "", ability: "Two scoops, double trouble.", effects: [] },\n',
  '  { id: "noodle_ninja",       name: "Noodle Ninja",       type: "creature", region: "Food Fight", rarity: "Uncommon", cost: 3, atk: 2, hp: 4, keywords: [],                  border: "#ff4040", seed: 208, bloodpact: false, imageUrl: "", ability: "Slips through any defense.", effects: [] },\n',
  '  { id: "mushroom_mage",      name: "Mushroom Mage",      type: "champion", region: "Food Fight", rarity: "Legendary",cost: 5, atk: 3, hp: 4, keywords: [],                  border: "#ff4040", seed: 209, bloodpact: false, imageUrl: "", ability: "When played, draw 2 cards.", effects: [{ trigger: "onPlay", effect: "draw", amount: 2 }] },\n',
  '  { id: "lemon_lord_spell",   name: "Lemon Lord",         type: "spell",    region: "Food Fight", rarity: "Uncommon", cost: 3, atk: null, hp: null, keywords: [],            border: "#ff4040", seed: 210, bloodpact: false, imageUrl: "", ability: "Deal 4 damage to the enemy hero.", effects: [{ trigger: "onPlay", effect: "damage_enemy_hero", amount: 4 }] },\n',
  '  { id: "sugar_rush",         name: "Sugar Rush",         type: "spell",    region: "Food Fight", rarity: "Common",   cost: 2, atk: null, hp: null, keywords: [],            border: "#ff4040", seed: 211, bloodpact: false, imageUrl: "", ability: "Give all your creatures +1 ATK.", effects: [{ trigger: "onPlay", effect: "buff_allies", atk: 1, hp: 0 }] },\n',
  '  { id: "splat_zone",         name: "Splat Zone",         type: "environment",region:"Food Fight", rarity: "Rare",    cost: 3, atk: null, hp: null, keywords: [],            border: "#ff4040", seed: 212, bloodpact: false, imageUrl: "", ability: "ENV: +1 ATK to your creatures each turn.", effects: [{ trigger: "onTurnStart", effect: "buff_allies", atk: 1, hp: 0 }] },\n',
  '  { id: "garlic_bolt",        name: "Garlic Bolt",        type: "spell",    region: "Food Fight", rarity: "Epic",     cost: 6, atk: null, hp: null, keywords: [],            border: "#ff4040", seed: 213, bloodpact: true,  imageUrl: "", ability: "Sacrifice 6 HP to deal 4 damage to ALL creatures.", effects: [{ trigger: "onPlay", effect: "damage_all", amount: 4 }] },\n',
  '  { id: "forest_witch",       name: "Forest Witch",       type: "creature", region: "Fables",     rarity: "Common",   cost: 2, atk: 2, hp: 3, keywords: ["Bleed"],           border: "#9070ff", seed: 301, bloodpact: false, imageUrl: "", ability: "Hexes her foes with each passing breath.", effects: [] },\n',
  '  { id: "dragon_knight",      name: "Dragon Knight",      type: "champion", region: "Fables",     rarity: "Legendary",cost: 5, atk: 4, hp: 4, keywords: [],                  border: "#9070ff", seed: 302, bloodpact: false, imageUrl: "", ability: "When played, deal 2 damage to all enemies.", effects: [{ trigger: "onPlay", effect: "damage_all_enemies", amount: 2 }] },\n',
  '  { id: "crystal_golem",      name: "Crystal Golem",      type: "creature", region: "Fables",     rarity: "Rare",     cost: 4, atk: 2, hp: 6, keywords: ["Shield"],          border: "#9070ff", seed: 303, bloodpact: false, imageUrl: "", ability: "Faceted and unyielding.", effects: [] },\n',
  '  { id: "ench_archer",        name: "Enchanted Archer",   type: "creature", region: "Fables",     rarity: "Uncommon", cost: 3, atk: 3, hp: 2, keywords: ["Swift","Gilded"],  border: "#9070ff", seed: 304, bloodpact: false, imageUrl: "", ability: "Magicked arrows never miss.", effects: [] },\n',
  '  { id: "pumpkin_king",       name: "Pumpkin King",       type: "creature", region: "Fables",     rarity: "Epic",     cost: 5, atk: 4, hp: 4, keywords: ["Bleed"],           border: "#9070ff", seed: 305, bloodpact: false, imageUrl: "", ability: "Rules the dark harvest.", effects: [] },\n',
  "  { id: \"fairy_touch\",        name: \"Fairy's Touch\",      type: \"spell\",    region: \"Fables\",     rarity: \"Common\",   cost: 3, atk: null, hp: null, keywords: [],            border: \"#9070ff\", seed: 306, bloodpact: false, imageUrl: \"\", ability: \"Restore 3 HP to all your creatures.\", effects: [{ trigger: \"onPlay\", effect: \"heal_all_allies\", amount: 3 }] },\n",
  "  { id: \"dragon_breath\",      name: \"Dragon's Breath\",    type: \"spell\",    region: \"Fables\",     rarity: \"Rare\",     cost: 4, atk: null, hp: null, keywords: [],            border: \"#9070ff\", seed: 307, bloodpact: false, imageUrl: \"\", ability: \"Deal 4 damage to all enemy creatures.\", effects: [{ trigger: \"onPlay\", effect: \"damage_all_enemies\", amount: 4 }] },\n",
  '  { id: "cursed_mirror",      name: "Cursed Mirror",      type: "spell",    region: "Fables",     rarity: "Uncommon", cost: 2, atk: null, hp: null, keywords: [],            border: "#9070ff", seed: 308, bloodpact: false, imageUrl: "", ability: "Deal 4 damage to a random enemy.", effects: [{ trigger: "onPlay", effect: "damage_random_enemy", amount: 4 }] },\n',
  '  { id: "enchanted_glade",    name: "Enchanted Glade",    type: "environment",region:"Fables",    rarity: "Rare",     cost: 4, atk: null, hp: null, keywords: [],            border: "#9070ff", seed: 309, bloodpact: false, imageUrl: "", ability: "ENV: Heal your creatures +2 HP each turn.", effects: [{ trigger: "onTurnStart", effect: "heal_all_allies", amount: 2 }] },\n',
  '  { id: "wolf_pack",          name: "Wolf Pack",          type: "creature", region: "Fables",     rarity: "Uncommon", cost: 3, atk: 2, hp: 2, keywords: ["Fracture"],        border: "#9070ff", seed: 310, bloodpact: false, imageUrl: "", ability: "Splits into two on death.", effects: [] },\n',
  '  { id: "glass_slipper",      name: "Glass Slipper",      type: "spell",    region: "Fables",     rarity: "Common",   cost: 1, atk: null, hp: null, keywords: [],            border: "#9070ff", seed: 311, bloodpact: false, imageUrl: "", ability: "Draw 2 cards.", effects: [{ trigger: "onPlay", effect: "draw", amount: 2 }] },\n',
  '  { id: "silver_arrow",       name: "Silver Arrow",       type: "spell",    region: "Fables",     rarity: "Common",   cost: 2, atk: null, hp: null, keywords: [],            border: "#9070ff", seed: 312, bloodpact: false, imageUrl: "", ability: "Deal 3 damage to a random enemy.", effects: [{ trigger: "onPlay", effect: "damage_random_enemy", amount: 3 }] },\n',
  '  { id: "enchanted_blade",    name: "Enchanted Blade",    type: "spell",    region: "Fables",     rarity: "Epic",     cost: 3, atk: null, hp: null, keywords: [],            border: "#9070ff", seed: 313, bloodpact: false, imageUrl: "", ability: "Give all creatures +1 ATK and heal hero 2.", effects: [{ trigger: "onPlay", effect: "buff_allies", atk: 1, hp: 0 }, { trigger: "onPlay", effect: "heal_hero", amount: 2 }] },\n',
]

path = 'src/App.jsx'
lines = open(path, encoding='utf-8').readlines()

# Find the POOL closing ]; (the one after the card entries, around line 565-570)
pool_close = None
for i in range(560, 580):
    if lines[i].strip() == '];':
        pool_close = i
        break

print(f'Inserting 26 cards before line {pool_close+1}')
lines[pool_close:pool_close] = new_cards

open(path, 'w', encoding='utf-8').writelines(lines)
print(f'Done. Total lines now: {len(lines)}')
