#!/usr/bin/env node
// Generates docs/forge-and-fable-card-set.xlsx from src/data/cards.js.
// Run: npm run export:cardset

import ExcelJS from "exceljs";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

import {
  POOL,
  LOCKED_REGIONS,
  HIDDEN_REGIONS,
  DECK_THORNWOOD_BLOOM,
  DECK_ASHFEN_INFERNO,
  DECK_SHATTERED_TEMPORAL,
  DECK_IRON_FORTRESS,
  DECK_AZURE_CONTROL,
} from "../src/data/cards.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT  = path.join(ROOT, "docs", "forge-and-fable-card-set.xlsx");

fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });

// ── helpers ──────────────────────────────────────────────────────────────────
const RARITY_ORDER = { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5 };

function headerRow(ws, cols) {
  const row = ws.addRow(cols.map(c => c.header));
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E3B4E" } };
    cell.alignment = { vertical: "middle", wrapText: false };
    cell.border = { bottom: { style: "thin", color: { argb: "FF888888" } } };
  });
  cols.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width ?? 14;
  });
}

function rarityColor(rarity) {
  return { Common: "FFB0B0B0", Uncommon: "FF4CAF50", Rare: "FF2196F3",
           Epic: "FF9C27B0", Legendary: "FFFFC107" }[rarity] ?? "FFB0B0B0";
}

function newBadge(isNew) {
  return isNew ? "★ NEW" : "";
}

// ── Workbook ──────────────────────────────────────────────────────────────────
const wb = new ExcelJS.Workbook();
wb.creator = "Forge & Fable";
wb.created = new Date();

// ════════════════════════════════════════════════════════════════════════════
// Sheet 1: All Cards
// ════════════════════════════════════════════════════════════════════════════
const wsAll = wb.addWorksheet("All Cards", { views: [{ state: "frozen", ySplit: 1 }] });

const allCols = [
  { header: "ID",       width: 22 },
  { header: "Name",     width: 26 },
  { header: "New?",     width:  8 },
  { header: "Region",   width: 20 },
  { header: "Type",     width: 14 },
  { header: "Rarity",   width: 12 },
  { header: "Cost",     width:  6 },
  { header: "ATK",      width:  6 },
  { header: "HP",       width:  6 },
  { header: "Keywords", width: 26 },
  { header: "Ability",  width: 56 },
  { header: "Flavor",   width: 40 },
  { header: "Bloodpact",width:  10 },
];
headerRow(wsAll, allCols);

const playable = POOL.filter(c =>
  !LOCKED_REGIONS.has(c.region) &&
  !HIDDEN_REGIONS.has(c.region) &&
  !c.isToken
).sort((a, b) => {
  if (a.region < b.region) return -1;
  if (a.region > b.region) return 1;
  return (RARITY_ORDER[a.rarity] ?? 0) - (RARITY_ORDER[b.rarity] ?? 0) || a.cost - b.cost;
});

let lastRegion = null;
for (const c of playable) {
  if (lastRegion && c.region !== lastRegion) {
    wsAll.addRow([]); // blank spacer between regions
  }
  lastRegion = c.region;

  const row = wsAll.addRow([
    c.id,
    c.name,
    newBadge(c.isNew),
    c.region,
    c.type,
    c.rarity,
    c.cost,
    c.atk ?? "—",
    c.hp  ?? "—",
    (c.keywords ?? []).join(", "),
    c.ability ?? "",
    c.flavor  ?? "",
    c.bloodpact ? `${c.cost} HP` : "",
  ]);

  // Color rarity cell
  row.getCell(6).font = { bold: true, color: { argb: rarityColor(c.rarity) } };

  // Highlight new cards
  if (c.isNew) {
    row.getCell(3).font  = { bold: true, color: { argb: "FFFFC107" } };
    row.eachCell(cell => {
      if (!cell.fill?.fgColor?.argb) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A2433" } };
      }
    });
  }

  row.alignment = { vertical: "top", wrapText: false };
}

wsAll.autoFilter = { from: "A1", to: `M1` };

// ════════════════════════════════════════════════════════════════════════════
// Sheet 2: New Cards Only (Part A)
// ════════════════════════════════════════════════════════════════════════════
const wsNew = wb.addWorksheet("Part A — New Cards", { views: [{ state: "frozen", ySplit: 1 }] });

const newCols = [
  { header: "Region",   width: 20 },
  { header: "Name",     width: 26 },
  { header: "Type",     width: 14 },
  { header: "Rarity",   width: 12 },
  { header: "Cost",     width:  6 },
  { header: "ATK",      width:  6 },
  { header: "HP",       width:  6 },
  { header: "Keywords", width: 26 },
  { header: "Ability",  width: 60 },
  { header: "Fills gap",width: 34 },
];
headerRow(wsNew, newCols);

const GAPS = {
  rootlet:          "1-drop for Thornwood — no early curve existed",
  grove_guardian:   "4-drop for Thornwood — gap between druid (3) and champion (5)",
  verdant_ancient:  "Thornwood champion — only region without one",
  rift_bolt:        "Removal spell for Shattered Expanse — had none",
  fragment_scout:   "3-drop for Shattered Expanse + Fracture/draw synergy",
  void_stalker:     "4-drop Echo with team buff — fills tempo gap",
  depth_seeker:     "3-drop tank with draw — Azure had no 3-drop creature",
  crushing_wave:    "Removal spell + draw for Azure — had neither",
  abyssal_sovereign:"Azure champion — only region without one (also adds Anchor)",
  ashfen_raider:    "2-drop Bleed — Ashfen had no 2-drop at all",
  slag_pit:         "Board-clear + Bleed spread at cost 2 — enables turn-2 Bleed flood",
  ember_phoenix:    "Ashfen champion — only region without one",
  iron_vanguard:    "4-drop for Ironmarch — gap between sentinel (3) and colossus (6)",
  siege_break:      "Removal + HP buff — Ironmarch had no removal spell",
  iron_foundry:     "Environment for Ironmarch — region had no env",
  sand_dancer:      "1-drop Swift for Sunveil — no cheap opener existed",
  mirage_stalker:   "4-drop Swift+Resonate — Sunveil topped out at cost 3",
  sunveil_archon:   "Sunveil champion — only region without one",
  blood_ward:       "Environment for Bloodpact — region had no env",
  void_sovereign:   "High-curve Bloodpact champion — region had no champion",
};

const newCards = POOL.filter(c => c.isNew).sort((a, b) => {
  if (a.region < b.region) return -1;
  if (a.region > b.region) return 1;
  return a.cost - b.cost;
});

lastRegion = null;
for (const c of newCards) {
  if (lastRegion && c.region !== lastRegion) wsNew.addRow([]);
  lastRegion = c.region;

  const row = wsNew.addRow([
    c.region, c.name, c.type, c.rarity, c.cost,
    c.atk ?? "—", c.hp ?? "—",
    (c.keywords ?? []).join(", "),
    c.ability ?? "",
    GAPS[c.id] ?? "",
  ]);
  row.getCell(4).font = { bold: true, color: { argb: rarityColor(c.rarity) } };
  row.alignment = { vertical: "top", wrapText: true };
}

// ════════════════════════════════════════════════════════════════════════════
// Sheet 3: Keyword Glossary
// ════════════════════════════════════════════════════════════════════════════
const wsKW = wb.addWorksheet("Keyword Glossary");

headerRow(wsKW, [
  { header: "Keyword",     width: 16 },
  { header: "Effect",      width: 64 },
  { header: "Engine status", width: 18 },
]);

const KEYWORDS = [
  ["Swift",    "Unit can attack the turn it is played (no summoning sickness).",                                         "Implemented"],
  ["Shield",   "Absorbs the first hit — the shield breaks and the unit takes no damage from that hit.",                  "Implemented"],
  ["Anchor",   "Immune to targeted removal and freeze spells.",                                                          "Implemented"],
  ["Bleed",    "Target takes 1 damage at the start of each of your turns per Bleed stack.",                             "Implemented"],
  ["Echo",     "When played, puts a 1/1 ghost copy of this card into your hand at cost 1.",                             "Implemented"],
  ["Fracture", "When played, a half-stats fragment copy of this unit is also put onto the board.",                       "Implemented"],
  ["Resonate", "This unit gains +1 ATK for each card currently on the enemy board at the time it enters play.",         "Implemented"],
  ["Splat",    "When this unit is destroyed, it deals 1 damage to a random enemy.",                                     "Implemented"],
];

for (const [kw, desc, status] of KEYWORDS) {
  const row = wsKW.addRow([kw, desc, status]);
  row.getCell(1).font = { bold: true };
  row.getCell(3).font = { color: { argb: "FF4CAF50" } };
  row.alignment = { vertical: "top", wrapText: true };
  row.height = 32;
}

// ════════════════════════════════════════════════════════════════════════════
// Sheet 4+: Decklists
// ════════════════════════════════════════════════════════════════════════════
const DECKS = [
  DECK_THORNWOOD_BLOOM,
  DECK_ASHFEN_INFERNO,
  DECK_SHATTERED_TEMPORAL,
  DECK_IRON_FORTRESS,
  DECK_AZURE_CONTROL,
];

const cardById = Object.fromEntries(POOL.map(c => [c.id, c]));

for (const deck of DECKS) {
  const wsDeck = wb.addWorksheet(deck.name, { views: [{ state: "frozen", ySplit: 2 }] });

  // Strategy header
  const stratRow = wsDeck.addRow([`Strategy: ${deck.strategy}`]);
  stratRow.getCell(1).font = { italic: true };
  stratRow.getCell(1).alignment = { wrapText: true };
  wsDeck.mergeCells(`A1:H1`);
  stratRow.height = 56;

  headerRow(wsDeck, [
    { header: "Card",     width: 24 },
    { header: "Region",   width: 18 },
    { header: "Type",     width: 12 },
    { header: "Rarity",   width: 10 },
    { header: "Cost",     width:  6 },
    { header: "ATK",      width:  6 },
    { header: "HP",       width:  6 },
    { header: "Copies",   width:  8 },
    { header: "New?",     width:  8 },
    { header: "Keywords", width: 26 },
    { header: "Ability",  width: 50 },
  ]);

  let total = 0;
  for (const [id, copies] of Object.entries(deck.cards)) {
    const c = cardById[id];
    if (!c) continue;
    total += copies;
    const row = wsDeck.addRow([
      c.name, c.region, c.type, c.rarity, c.cost,
      c.atk ?? "—", c.hp ?? "—", copies,
      c.isNew ? "★ NEW" : "",
      (c.keywords ?? []).join(", "),
      c.ability ?? "",
    ]);
    row.getCell(4).font = { bold: true, color: { argb: rarityColor(c.rarity) } };
    if (c.isNew) row.getCell(9).font = { bold: true, color: { argb: "FFFFC107" } };
    row.alignment = { vertical: "top", wrapText: false };
  }

  // Total row
  const totRow = wsDeck.addRow(["", "", "", "", "", "", "TOTAL:", total]);
  totRow.getCell(7).font = { bold: true };
  totRow.getCell(8).font = { bold: true, color: { argb: total === 40 ? "FF4CAF50" : "FFFF5722" } };
}

// ── write file ────────────────────────────────────────────────────────────────
await wb.xlsx.writeFile(OUT);
console.log(`✓  Written: ${OUT}`);
console.log(`   Sheets: All Cards, Part A — New Cards, Keyword Glossary, ${DECKS.map(d => d.name).join(", ")}`);
console.log(`   Playable cards: ${playable.length}  (${newCards.length} new)`);
