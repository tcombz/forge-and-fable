import re, sys

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

original_len = len(content)

# === CHANGE 1a: CardPreview art height 180->240 ===
old1a = '<div style={{ height: 180, position: "relative" }}><CardArt card={card} />'
new1a = '<div style={{ height: 240, position: "relative", overflow:"hidden" }}><CardArt card={card} />'
if old1a in content:
    content = content.replace(old1a, new1a, 1)
    print("Change 1a done: art height 180->240")
else:
    print("MISSING 1a!")

# === CHANGE 1b: Remove cost bubble from CardPreview ===
pattern1b = r'<div style=\{\{ position: "absolute", top: 8, left: 8, width: isBP\|\|isEnv\?38:32.*?card\.cost\}</div>'
result1b, n1b = re.subn(pattern1b, '', content, count=1, flags=re.DOTALL)
if n1b > 0:
    content = result1b
    print("Change 1b done: cost bubble removed")
else:
    print("MISSING 1b!")

# === CHANGE 2a: Collection blueCost prop ===
old2a = '<Card card={displayCard} size="sm" animDelay={i * 0.04} hideCost />'
new2a = '<Card card={displayCard} size="sm" animDelay={i * 0.04} blueCost />'
if old2a in content:
    content = content.replace(old2a, new2a)
    print("Change 2a done: hideCost->blueCost in CollectionCard")
else:
    print("MISSING 2a!")

# === CHANGE 2b: Card function signature ===
old2b = 'function Card({ card, size = "md", onClick, animDelay = 0, isThird = false, hideCost = false }) {'
new2b = 'function Card({ card, size = "md", onClick, animDelay = 0, isThird = false, hideCost = false, blueCost = false }) {'
if old2b in content:
    content = content.replace(old2b, new2b)
    print("Change 2b done: Card signature blueCost added")
else:
    print("MISSING 2b!")

# === CHANGE 2c: Card cost circle condition + blueCost color ===
old2c = '{!hideCost && <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: isBP ? "radial-gradient(#ff3050,#a00018)" : isEnv ? "radial-gradient(#40c0e0,#1a6888)" : isPrismatic ? "radial-gradient(#ffffff,#c0a0ff)" : "radial-gradient(#ffe040,#d09000)",'
new2c = '{(!hideCost || blueCost) && <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: isBP ? "radial-gradient(#ff3050,#a00018)" : isEnv ? "radial-gradient(#40c0e0,#1a6888)" : isPrismatic ? "radial-gradient(#ffffff,#c0a0ff)" : blueCost ? "radial-gradient(#60b0ff,#1060c0)" : "radial-gradient(#ffe040,#d09000)",'
if old2c in content:
    content = content.replace(old2c, new2c)
    print("Change 2c done: cost circle blueCost color")
else:
    print("MISSING 2c!")

# === CHANGE 3a: Siphon Wraith bleedAmount: 2 ===
old3a = '{ id: "siphon", name: "Siphon Wraith"'
new3a = '{ id: "siphon", name: "Siphon Wraith", bleedAmount: 2'
if old3a in content:
    content = content.replace(old3a, new3a, 1)
    print("Change 3a done: bleedAmount: 2 added to Siphon Wraith")
else:
    print("MISSING 3a!")

# === CHANGE 3b: bleedAmount usage in attack handlers ===
old3b = '(att.keywords || []).includes("Bleed") ? 1 : 0'
new3b = '(att.keywords || []).includes("Bleed") ? (att.bleedAmount || 1) : 0'
count3b = content.count(old3b)
if count3b > 0:
    content = content.replace(old3b, new3b)
    print(f"Change 3b done: replaced {count3b} bleed occurrences")
else:
    print("MISSING 3b!")

# === CHANGE 4a: Velrun - AI initGame ===
old4a = 'const pd = shuf(matchConfig?.playerDeck?.length > 0 ? [...matchConfig.playerDeck] : [...fallback]);'
new4a = 'const resolveFromPool = (c) => { const fresh = GAMEPLAY_POOL.find(p => p.id === c.id); return fresh ? { ...c, atk: fresh.atk, hp: fresh.hp, keywords: fresh.keywords, effects: fresh.effects, ability: fresh.ability } : c; }; const pd = shuf((matchConfig?.playerDeck?.length > 0 ? [...matchConfig.playerDeck] : [...fallback]).map(resolveFromPool));'
if old4a in content:
    content = content.replace(old4a, new4a, 1)
    print("Change 4a done: AI initGame resolveFromPool")
else:
    print("MISSING 4a!")

# === CHANGE 4b: PvP d1 (combined with d2 on same line) ===
old4b = 'const d1 = shuf(matchConfig?.playerDeck?.length > 0 ? [...matchConfig.playerDeck] : [...fb]), d2 = shuf([...fb]);'
new4b = 'const rfp = (c) => { const fresh = GAMEPLAY_POOL.find(p => p.id === c.id); return fresh ? { ...c, atk: fresh.atk, hp: fresh.hp, keywords: fresh.keywords, effects: fresh.effects, ability: fresh.ability } : c; }; const d1 = shuf((matchConfig?.playerDeck?.length > 0 ? [...matchConfig.playerDeck] : [...fb]).map(rfp)), d2 = shuf([...fb]);'
if old4b in content:
    content = content.replace(old4b, new4b, 1)
    print("Change 4b done: PvP d1 resolveFromPool")
else:
    print("MISSING 4b!")

# === CHANGE 4c: PvP p2d ===
old4c = 'const p2d = shuf(matchConfig?.playerDeck?.length > 0 ? [...matchConfig.playerDeck] : [...p2fb]);'
new4c = 'const p2d = shuf((matchConfig?.playerDeck?.length > 0 ? [...matchConfig.playerDeck] : [...p2fb]).map(c => { const fresh = GAMEPLAY_POOL.find(p => p.id === c.id); return fresh ? { ...c, atk: fresh.atk, hp: fresh.hp, keywords: fresh.keywords, effects: fresh.effects, ability: fresh.ability } : c; }));'
if old4c in content:
    content = content.replace(old4c, new4c, 1)
    print("Change 4c done: PvP p2d resolveFromPool")
else:
    print("MISSING 4c!")

# === CHANGE 5: Fractured Rift nerf ===
old5 = 'ability: "ENV: All allies get +2 ATK.", flavor: "Reality bends.", effects: [{ trigger: "onTurnStart", effect: "buff_allies", atk: 2, hp: 0 }]'
new5 = 'ability: "ENV: All allies get +1 ATK.", flavor: "Reality bends.", effects: [{ trigger: "onTurnStart", effect: "buff_allies", atk: 1, hp: 0 }]'
if old5 in content:
    content = content.replace(old5, new5, 1)
    print("Change 5 done: Fractured Rift nerf +2->+1")
else:
    print("MISSING 5!")

# === CHANGE 6: CURRENT_PATCH ===
old6 = 'const CURRENT_PATCH = "v29";'
new6 = 'const CURRENT_PATCH = "IRON CRUCIBLE \u03b1";'
if old6 in content:
    content = content.replace(old6, new6, 1)
    print("Change 6 done: CURRENT_PATCH = IRON CRUCIBLE \u03b1")
else:
    print("MISSING 6!")

# === CHANGE 7: PatchNotesModal rows ===
idx7 = content.find('Timeline Weaver nerfed: ATK 3')
if idx7 >= 0:
    start7 = content.rfind('const rows = [', 0, idx7)
    end7 = content.find('];', idx7)
    if start7 >= 0 and end7 >= 0:
        new7 = (
            'const rows = [\n'
            '    { icon:"\U0001f5e1", label:<>Siphon Wraith: applies 2 Bleed stacks per attack (Double Bleed)<NEW /></> },\n'
            '    { icon:"\U0001f30b", label:<>Fractured Rift nerfed: all allies +1 ATK per turn (was +2)<NEW /></> },\n'
            '    { icon:"\U0001f6e1", label:<>Velrun 6/6 + Shield resolves correctly from live card pool<NEW /></> },\n'
            '    { icon:"\U0001f3b4", label:<>Card art preview: full height \u00b7 blue mana circles in collection<NEW /></> },\n'
            '    { icon:"\u2694", label:"Timeline Weaver 2/4 nerf \u00b7 Bleed hero dmg removed \u00b7 Echo cost:1" },\n'
            '    { icon:"\U0001f30d", label:"Shifting Dunes fix \u00b7 PvP opponent deck fix \u00b7 Feedback Wall" },\n'
            '    { icon:"\U0001f3db", label:"Nav restored in battle \u00b7 smoother animations \u00b7 stable connections" },\n'
            '    { icon:"\u2697", label:"Coming next: Leaderboard \u00b7 Thornwood Expansion \u00b7 Draft Mode", dim:true },\n'
            '  ];'
        )
        content = content[:start7] + new7 + content[end7+2:]
        print("Change 7 done: PatchNotesModal rows updated")
    else:
        print("MISSING 7 - could not find rows boundaries!")
else:
    print("MISSING 7 - Timeline Weaver text not found!")

# === CHANGE 8: Footer text ===
old8 = '{CURRENT_PATCH}: CARD BALANCE \u00b7 BLEED FIX \u00b7 ECHO COST \u00b7 ENV FIX \u00b7 PVP DECK FIX \u00b7 FEEDBACK WALL'
new8 = '{CURRENT_PATCH}: DOUBLE BLEED \u00b7 VELRUN POOL FIX \u00b7 FULL ART PREVIEW \u00b7 FRACTURED RIFT NERF \u00b7 IRON CRUCIBLE LAUNCH'
if old8 in content:
    content = content.replace(old8, new8, 1)
    print("Change 8 done: footer text updated")
else:
    print("MISSING 8!")

# === CHANGE 9: Ticker text ===
old9 = '`\U0001f4dc ${CURRENT_PATCH} \u2014 Velrun 6/6+Shield \u00b7 Timeline Weaver 2/4 nerf \u00b7 Bleed fix \u00b7 Echo cost:1 \u00b7 Env fixes \u00b7 Feedback Wall`'
new9 = '`\U0001f4dc ${CURRENT_PATCH} \u2014 Siphon Wraith Double Bleed \u00b7 Velrun pool fix \u00b7 Full art preview \u00b7 Blue mana circles \u00b7 Fractured Rift nerf`'
if old9 in content:
    content = content.replace(old9, new9, 1)
    print("Change 9 done: ticker text updated")
else:
    # Try to find the ticker line
    idx9 = content.find('Velrun 6/6+Shield')
    if idx9 >= 0:
        print(f"MISSING 9 - ticker found but pattern mismatch. Context: {repr(content[idx9-30:idx9+120])}")
    else:
        print("MISSING 9 - 'Velrun 6/6+Shield' not found in ticker")

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nAll done. File size: {len(content)} (was {original_len})")
