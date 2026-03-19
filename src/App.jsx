import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { supabase } from "./supabase";
import ForgeAndFableTeaser from "./components/ForgeAndFableTeaser";

// ═══ STORAGE ═════════════════════════════════════════════════════════════════
const store = {
  get: async (k) => { try { if (window.storage) return await window.storage.get(k); return null; } catch (e) { return null; } },
  set: async (k, v) => { try { if (window.storage) { await window.storage.set(k, v); return true; } return false; } catch (e) { return false; } },
  del: async (k) => { try { if (window.storage) { await window.storage.delete(k); return true; } return false; } catch (e) { return false; } }
};

// ═══ ALPHA KEYS ══════════════════════════════════════════════════════════════
// Supabase: run once to create the used_keys tracking table —
//   CREATE TABLE used_alpha_keys (key TEXT PRIMARY KEY, used_by_name TEXT, used_at TIMESTAMPTZ DEFAULT NOW());
//   ALTER TABLE used_alpha_keys ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "read" ON used_alpha_keys FOR SELECT USING (true);
//   CREATE POLICY "claim" ON used_alpha_keys FOR INSERT WITH CHECK (auth.role() = 'authenticated');
const ALPHA_KEYS_LIST = [
  "VELRUN-ASCENDS","WOLF-RUNS-FREE","TIDE-CALLS-YOU","ECHO-WISP-RISE","IRON-HOLDS-ALL",
  "ASH-AND-EMBER","SUN-VEILED-ONE","BLOOD-IS-PAID","RIFT-HERALD-01","RIFT-HERALD-02",
  "RIFT-HERALD-03","RIFT-HERALD-04","THORNWOOD-001","THORNWOOD-002","THORNWOOD-003",
  "THORNWOOD-004","FORGE-FOUNDER","AZURE-DEEP-01","VOID-STALKER-1","ALPHA-KEY-0001",
  "FLAME-WARDEN-2","DUSK-HERALD-05","BONE-TIDE-RISE","STAR-FORGED-01","KRAKEN-WAKES-1",
];
const ALPHA_KEYS = new Set(ALPHA_KEYS_LIST);
const CURRENT_PATCH = "FABLES & FOOD FIGHT α.2";
const DAILY_QUEST_POOL = [
  { id:"win2",      label:"Win 2 matches",             goal:2, type:"wins",    reward:50 },
  { id:"win1ranked",label:"Win a ranked match",         goal:1, type:"rankwin", reward:75 },
  { id:"play3",     label:"Play 3 matches",             goal:3, type:"played",  reward:35 },
  { id:"winai2",    label:"Beat the AI twice",          goal:2, type:"aiwins",  reward:40 },
  { id:"fastwin",   label:"Win in under 8 turns",       goal:1, type:"fastwin", reward:60 },
  { id:"bigwin",    label:"Win with 15+ HP remaining",  goal:1, type:"bigwin",  reward:55 },
  { id:"casual1",   label:"Win a casual match",         goal:1, type:"caswin",  reward:30 },
  { id:"play5",     label:"Play 5 matches",             goal:5, type:"played",  reward:60 },
];
const getTodayStr = () => new Date().toISOString().slice(0, 10);
const initDailyQuests = (stored) => {
  const today = getTodayStr();
  if (stored?.date === today && stored?.quests?.length === 3) return stored;
  const shuffled = [...DAILY_QUEST_POOL].sort(() => Math.random() - 0.5);
  return { date: today, quests: shuffled.slice(0, 3).map(q => ({ ...q, progress: 0, completed: false })) };
};
const applyQuestProgress = (dailyQuests, types) => {
  if (!dailyQuests?.quests) return dailyQuests;
  let changed = false;
  const updated = dailyQuests.quests.map(q => {
    if (q.completed || !types.includes(q.type)) return q;
    const newProg = Math.min(q.goal, q.progress + 1);
    if (newProg !== q.progress) changed = true;
    return { ...q, progress: newProg, completed: newProg >= q.goal };
  });
  return changed ? { ...dailyQuests, quests: updated } : dailyQuests;
};

// ═══ AUDIO ═══════════════════════════════════════════════════════════════════
const SFX = (() => {
  let ctx = null;
  const init = () => { if (!ctx) try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} return ctx; };
  const masterVolume = 0.32;
  const tone = (f, type, vol, t0, dur) => {
    const c = init(); if (!c) return; if (c.state === "suspended") c.resume();
    try { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = type; o.frequency.value = Math.min(f, 880); g.gain.setValueAtTime(vol * masterVolume, c.currentTime + t0); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t0 + dur); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.05); } catch (e) {}
  };
  // Gentle detuned chord pad — euphoric harp-like shimmer
  const chord = (freqs, type, vol, t0, dur) => freqs.forEach((f,i) => tone(f, type, vol * (1 - i * 0.06), t0 + i * 0.055, dur - i * 0.04));
  return {
    init,
    play(t) {
      switch (t) {
        // ── End turn: warm ascending harp resolve ────────────────────────
        case "end_turn_go":
          [220,277,330,440,523,659,784].forEach((f,i) => tone(f,"sine",0.045,i*0.055,0.32));
          tone(440,"sine",0.03,0.32,0.55); tone(523,"sine",0.022,0.42,0.45);
          break;
        // ── Card hover: soft euphoric shimmer ────────────────────────────
        case "card_hover":
          tone(880,"sine",0.016,0,0.03); tone(1047,"sine",0.010,0.022,0.04); tone(1319,"sine",0.007,0.04,0.05);
          break;
        // ── Card inspect: crisp crystalline tick ─────────────────────────
        case "card_inspect":
          tone(660,"sine",0.06,0,0.04); tone(880,"sine",0.045,0.03,0.06); tone(660,"sine",0.025,0.08,0.12);
          break;
        // ── Card play: satisfying thwip ──────────────────────────────────
        case "card":
          tone(260,"sine",0.07,0,0.06); tone(390,"sine",0.05,0.04,0.1); tone(520,"sine",0.03,0.09,0.09);
          break;
        // ── Attack: sharp sword slash ────────────────────────────────────
        case "attack":
          tone(900,"sawtooth",0.055,0,0.018); tone(600,"sawtooth",0.06,0.012,0.025); tone(300,"triangle",0.07,0.02,0.08);
          tone(160,"triangle",0.065,0.03,0.12); tone(80,"sine",0.05,0.06,0.14);
          break;
        // ── Kill: descending impact ──────────────────────────────────────
        case "kill":
          [200,160,120,80].forEach((f,i) => tone(f,"triangle",0.065,i*0.07,0.22));
          break;
        // ── Victory: triumphant fanfare ──────────────────────────────────
        case "victory":
          [330,415,523,415,523,659,784].forEach((f,i) => tone(f,"sine",0.065,i*0.1,0.3));
          tone(523,"sine",0.04,0.55,0.65); tone(659,"sine",0.03,0.65,0.5);
          break;
        // ── Defeat: somber descend ───────────────────────────────────────
        case "defeat":
          [330,262,196,131].forEach((f,i) => tone(f,"sine",0.065,i*0.22,0.4));
          break;
        // ── Draw: soft ping ──────────────────────────────────────────────
        case "draw": tone(330,"sine",0.045,0,0.1); tone(440,"sine",0.03,0.07,0.12); break;
        // ── Ability: rising sparkle chord ────────────────────────────────
        case "ability":
          [330,415,523,659,523,659].forEach((f,i) => tone(f,"sine",0.055,i*0.05,0.16));
          tone(784,"sine",0.025,0.28,0.25);
          break;
        // ── Spell cast: arcane bloom ─────────────────────────────────────
        case "spell_cast":
          [220,277,349,440,523,440,349].forEach((f,i) => tone(f,"triangle",0.048,i*0.06,0.28));
          tone(523,"sine",0.035,0.32,0.6);
          break;
        // ── Heal: warm lift ──────────────────────────────────────────────
        case "heal":
          [330,415,523,659,784].forEach((f,i) => tone(f,"sine",0.048,i*0.055,0.26));
          tone(523,"sine",0.038,0.3,0.55); tone(659,"sine",0.022,0.42,0.38);
          break;
        // ── Environment rise: deep ambient swell ─────────────────────────
        case "env_rise":
          [80,110,165,220,277,349].forEach((f,i) => tone(f,"sine",0.055,i*0.1,0.45));
          tone(220,"sine",0.04,0.55,0.75); tone(277,"sine",0.028,0.68,0.55);
          break;
        // ── Pack open: shimmering reveal ─────────────────────────────────
        case "pack_open":
          [165,208,262,330,415,523].forEach((f,i) => tone(f,"triangle",0.055,i*0.075,0.32));
          break;
        // ── Rare reveal: golden fanfare ──────────────────────────────────
        case "rare_reveal":
          [330,415,523,659,784,659].forEach((f,i) => tone(f,"sine",0.07,i*0.08,0.38));
          tone(784,"sine",0.04,0.5,0.6);
          break;
        // ── Flip: light card whoosh ───────────────────────────────────────
        case "flip": tone(415,"sine",0.045,0,0.07); tone(523,"sine",0.028,0.04,0.07); break;
        // ── Timer warn: gentle pulse ─────────────────────────────────────
        case "timer_warn": tone(440,"triangle",0.06,0,0.1); tone(440,"triangle",0.05,0.22,0.1); break;
        // ── Timer end: soft three-tone end ───────────────────────────────
        case "timer_end":
          [415,330,220].forEach((f,i) => tone(f,"sine",0.06,i*0.1,0.22));
          break;
        // ── Environment play: terrain shift ──────────────────────────────
        case "env_play":
          [110,165,220,277,349,440].forEach((f,i) => tone(f,"sine",0.05,i*0.1,0.42));
          tone(277,"sine",0.038,0.55,0.65);
          break;
        // ── Prismatic: full rainbow shimmer ──────────────────────────────
        case "prismatic":
          [262,330,415,523,659,784,659,523].forEach((f,i) => tone(f,"sine",0.032,i*0.065,0.32));
          tone(523,"sine",0.02,0.45,0.65);
          break;
        // ── Lightning strike: sharp crack + deep thunder rumble ──────────
        case "lightning_strike":
          tone(1200,"sawtooth",0.12,0,0.008); tone(900,"sawtooth",0.10,0.005,0.015);
          tone(600,"sawtooth",0.09,0.012,0.02); tone(300,"triangle",0.10,0.018,0.05);
          tone(120,"sine",0.12,0.025,0.25); tone(80,"sine",0.10,0.08,0.4);
          tone(60,"sine",0.07,0.18,0.55); tone(40,"sine",0.05,0.3,0.7);
          break;
      }
    }
  };
})();

// ═══ MUSIC ═══════════════════════════════════════════════════════════════════
// HOW TO ADD YOUR OWN TRACKS:
// 1. Upload your audio files somewhere publicly accessible (e.g. Cloudflare R2, GitHub raw, Vercel /public folder)
// 2. Replace the placeholder URLs below with your actual file URLs
// 3. Supported formats: .mp3, .ogg, .wav (mp3 recommended for browser compatibility)
// 4. HOMEPAGE track: calm, ambient, fantasy — plays on Home/Store/Collection/Guide tabs
// 5. BATTLE track: intense, driving — plays only during BattleScreen (auto-switches)
// 6. The MusicPlayer component (bottom-right corner) lets users toggle/volume control in-game
const MUSIC_TRACKS = {
  home: {
    url: "/music-home.mp3", // <-- PASTE your homepage track URL here e.g. "https://yourcdn.com/forge_theme.mp3"
    label: "Home Theme",
  },
  battle: {
    url: "/music-battle.mp3", // <-- PASTE your battle track URL here e.g. "https://yourcdn.com/battle_theme.mp3"
    label: "Battle Theme",
  },
};

const MusicCtx = (() => {
  let audio = null;
  let currentTrack = null;
  let volume = 0.08;
  let muted = false;
  const listeners = new Set();
  const notify = () => listeners.forEach(fn => fn({ currentTrack, muted, volume }));
  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    getState() { return { currentTrack, muted, volume }; },
    play(track) {
      const info = MUSIC_TRACKS[track];
      if (!info || !info.url) return; // no URL configured — silent
      if (currentTrack === track && audio && !audio.paused) return;
      currentTrack = track;
      if (audio) { audio.pause(); audio.src = ""; }
      audio = new Audio(info.url);
      audio.loop = true;
      audio.volume = muted ? 0 : volume;
      audio.play().catch(() => {}); // autoplay may be blocked until user interaction
      notify();
    },
    stop() { if (audio) { audio.pause(); audio.src = ""; } currentTrack = null; notify(); },
    toggleMute() { muted = !muted; if (audio) audio.volume = muted ? 0 : volume; notify(); },
    setVolume(v) { volume = v; if (audio && !muted) audio.volume = v; notify(); },
  };
})();

function useMusicState() {
  const [state, setState] = useState(MusicCtx.getState());
  useEffect(() => MusicCtx.subscribe(setState), []);
  return state;
}

function MusicPlayer() {
  const { currentTrack, muted, volume } = useMusicState();
  const [expanded, setExpanded] = useState(false);
  const hasUrls = MUSIC_TRACKS.home.url || MUSIC_TRACKS.battle.url;
  if (!hasUrls) return null; // hide if no tracks configured
  const label = currentTrack ? (MUSIC_TRACKS[currentTrack]?.label || currentTrack) : "No Track";
  return (
    <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 200, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      {expanded && (
        <div style={{ background: "linear-gradient(160deg,#1e1c10,#12100a)", border: "1px solid #3a3018", borderRadius: 12, padding: "12px 16px", minWidth: 180, boxShadow: "0 12px 40px rgba(0,0,0,0.9)", animation: "fadeIn 0.2s ease-out" }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 9, color: "#e8c060", marginBottom: 8, letterSpacing: 1 }}>♪ {label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, color: "#806040" }}>VOL</span>
            <input type="range" min={0} max={1} step={0.05} value={volume} onChange={e => MusicCtx.setVolume(parseFloat(e.target.value))} style={{ flex: 1, accentColor: "#e8c060", cursor: "pointer" }} />
          </div>
          <button onClick={() => MusicCtx.toggleMute()} style={{ marginTop: 8, width: "100%", padding: "5px", background: muted ? "rgba(200,60,60,0.18)" : "rgba(232,192,96,0.1)", border: `1px solid ${muted ? "#a03030" : "#e8c06044"}`, borderRadius: 6, color: muted ? "#d06060" : "#e8c060", fontFamily: "'Cinzel',serif", fontSize: 9, cursor: "pointer" }}>{muted ? "UNMUTE" : "MUTE"}</button>
        </div>
      )}
      <button onClick={() => setExpanded(p => !p)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(14,12,10,0.95)", border: `1px solid ${currentTrack ? "#e8c06055" : "#2a2010"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, boxShadow: currentTrack ? "0 0 12px #e8c06033" : "none", transition: "all .2s" }} title="Music Controls">
        {muted ? "🔇" : currentTrack ? "🎵" : "🔈"}
      </button>
    </div>
  );
}

// ═══ CONFIG ══════════════════════════════════════════════════════════════════
const CFG = { startHP: 30, startHand: 3, maxHand: 7, maxBoard: 6, startEnergy: 1, maxEnergy: 7, turnTimer: 45, deck: { size: 40, maxChamp: 4, maxAuraEnv: 4, copies: 3 } };

// ═══ CONSTANTS ═══════════════════════════════════════════════════════════════
const RC = { Common: "#8a8a7a", Uncommon: "#c0922a", Rare: "#5090ff", Epic: "#a860d8", Legendary: "#f0b818" };
const RARITY_GLOW = { Rare: "#3070d0", Epic: "#9040c0", Legendary: "#e8c060", Champion: "#f0a020", Prismatic: "#ffffff" };
const REGION_COLORS = { Fables: "#9070ff", "Food Fight": "#ff6040", Bloodpact: "#cc2030" };
const KW = [
  { name: "Swift", icon: "\u26A1", color: "#5a9a28", desc: "Attacks the turn it's played" },
  { name: "Fracture", icon: "\u2727", color: "#a060d0", desc: "A Fragment copy enters alongside" },
  { name: "Echo", icon: "\u2941", color: "#28a0cc", desc: "On play: adds a 1/1 ghost copy to your hand" },
  { name: "Bleed", icon: "\u2620", color: "#d04040", desc: "Inflicts bleed; fires at end of your turn then clears" },
  { name: "Resonate", icon: "\u25C8", color: "#c88020", desc: "+1 ATK per enemy on the field" },
  { name: "Anchor", icon: "\u2693", color: "#80b0e0", desc: "Cannot be removed, banished, or targeted by enemy spells" },
  { name: "Shield", icon: "\u2666", color: "#60a0d0", desc: "Blocks the first hit taken" },
  { name: "Splat", icon: "💥", color: "#ff6040", desc: "When destroyed, deal 1 damage to a random enemy target" },
];
const REGIONS = ["Thornwood", "Shattered Expanse", "Azure Deep", "Ashfen", "Ironmarch", "Sunveil", "Food Fight", "Fables"];
const GLOW = { Thornwood: "#70ff30", "Shattered Expanse": "#c090ff", "Azure Deep": "#30d0ff", Ashfen: "#ff6820", Ironmarch: "#9090ff", Sunveil: "#ffd030", Bloodpact: "#ff2848", "Food Fight": "#ff5030", Fables: "#9070ff" };
const ENV_THEMES = {
  Thornwood:         { bg: "linear-gradient(180deg,#040e02 0%,#0a1a06 40%,#081808 100%)", particle: "#60dd28", glow: "#40a020", pShape: "leaf",   pDir: "down", pCount: 28, pSpeed: 0.5 },
  "Shattered Expanse":{ bg: "linear-gradient(180deg,#06001a 0%,#0c0030 40%,#080020 100%)", particle: "#c080ff", glow: "#8040d0", pShape: "spark",  pDir: "up",   pCount: 35, pSpeed: 1.2 },
  "Azure Deep":      { bg: "linear-gradient(180deg,#010818 0%,#041030 40%,#030828 100%)", particle: "#40c0ff", glow: "#2080c0", pShape: "bubble", pDir: "up",   pCount: 22, pSpeed: 0.4 },
  Ashfen:            { bg: "linear-gradient(180deg,#180400 0%,#2a0800 40%,#1a0400 100%)", particle: "#ff7030", glow: "#c04010", pShape: "spark",  pDir: "up",   pCount: 45, pSpeed: 1.8 },
  Ironmarch:         { bg: "linear-gradient(180deg,#04040a 0%,#0a0a18 40%,#060614 100%)", particle: "#9090cc", glow: "#5050a0", pShape: "spark",  pDir: "up",   pCount: 30, pSpeed: 1.0 },
  Sunveil:           { bg: "linear-gradient(180deg,#140a00 0%,#221400 40%,#180c00 100%)", particle: "#ffc820", glow: "#b08010", pShape: "circle", pDir: "up",   pCount: 25, pSpeed: 0.6 },
  Bloodpact:         { bg: "linear-gradient(180deg,#100004 0%,#1c000a 40%,#120006 100%)", particle: "#ff2040", glow: "#a01020", pShape: "drop",   pDir: "down", pCount: 20, pSpeed: 0.7 },
  "Food Fight":      { bg: "linear-gradient(180deg,#140402 0%,#220806 40%,#160402 100%)", particle: "#ff5030", glow: "#cc2010", pShape: "drop",   pDir: "up",   pCount: 30, pSpeed: 1.0 },
  Fables:            { bg: "linear-gradient(180deg,#060212 0%,#0c0428 40%,#060218 100%)", particle: "#9070ff", glow: "#6040c0", pShape: "spark",  pDir: "up",   pCount: 28, pSpeed: 0.8 },
};
const BATTLE_MAPS = {
  default: { label: "Ruined Keep", enemyBg: "rgba(180,40,40,0.09)", playerBg: "rgba(40,100,20,0.09)", dividerBg: "#1a1510", accent: "#382e18" },
  thornwood: { label: "Thornwood Hollow", enemyBg: "rgba(40,160,20,0.12)", playerBg: "rgba(20,100,10,0.10)", dividerBg: "#0a1808", accent: "#204018" },
  expanse: { label: "Shattered Expanse", enemyBg: "rgba(120,40,200,0.10)", playerBg: "rgba(80,20,160,0.08)", dividerBg: "#0c0020", accent: "#280840" },
  ashfen: { label: "Ashfen Wastes", enemyBg: "rgba(200,60,10,0.10)", playerBg: "rgba(160,40,5,0.08)", dividerBg: "#180400", accent: "#401008" },
};
const hpCol = (h) => (h > 20 ? "#48c058" : h > 10 ? "#f09020" : "#e03030");

// ═══ RANKED ══════════════════════════════════════════════════════════════════
// Supabase: run once to add ranked columns to profiles —
//   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ranked_rating INT DEFAULT 1000;
//   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ranked_wins INT DEFAULT 0;
//   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ranked_losses INT DEFAULT 0;
const RANK_TIERS = [
  { min: 2000, name: "Grandmaster", color: "#ff6020", icon: "👑" },
  { min: 1800, name: "Diamond",     color: "#60d8ff", icon: "💎" },
  { min: 1600, name: "Platinum",    color: "#c080ff", icon: "🔮" },
  { min: 1400, name: "Gold",        color: "#f0c040", icon: "🥇" },
  { min: 1200, name: "Silver",      color: "#c8c8d8", icon: "🥈" },
  { min: 1000, name: "Bronze",      color: "#c08840", icon: "🥉" },
  { min: 0,    name: "Iron",        color: "#808080", icon: "⚔" },
];
function getRank(rating) { return RANK_TIERS.find(t => (rating||1000) >= t.min) || RANK_TIERS[RANK_TIERS.length-1]; }
// ELO-style delta: expected outcome vs actual
function calcRatingDelta(myRating, oppRating, won) {
  const K = 24;
  const expected = 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
  return Math.round(K * ((won ? 1 : 0) - expected));
}
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 8)}`;
const shuf = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [b[i], b[j]] = [b[j], b[i]]; } return b; };
const PI = Math.PI;

// ═══ UTILS ═══════════════════════════════════════════════════════════════════
function mkRng(seed) { let s = ((seed || 1) * 69069 + 1) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function hexToRgb(hex) { const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null; }
function safeRoundRect(ctx, x, y, w, h, r) {
  const rad = typeof r === "number" ? r : 0;
  ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.lineTo(x + w - rad, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rad); ctx.lineTo(x + w, y + h - rad); ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h); ctx.lineTo(x + rad, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rad); ctx.lineTo(x, y + rad); ctx.quadraticCurveTo(x, y, x + rad, y); ctx.closePath();
}
// NOTE: getStarterCollection defined after GAMEPLAY_POOL below

// ═══ FLOATING PARTICLES ══════════════════════════════════════════════════════
function FloatingParticles({ count = 30, color = "#e8c06015", speed = 1, shape = "circle", direction = "up" }) {
  const ref = useRef(null);
  const particles = useRef([]);
  useEffect(() => {
    particles.current = [];
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    const W = c.width = c.offsetWidth || 400;
    const H = c.height = c.offsetHeight || 300;
    const down = direction === "down";
    for (let i = 0; i < count; i++) {
      const r = 1 + Math.random() * (shape === "leaf" ? 4 : shape === "drop" ? 3 : 2.5);
      particles.current.push({
        x: Math.random() * W, y: Math.random() * H,
        r,
        vx: (Math.random() - 0.5) * (shape === "leaf" ? 0.8 : 0.4) * speed,
        vy: down ? (0.3 + Math.random() * 0.8) * speed : -(0.3 + Math.random() * 0.8) * speed,
        a: 0.2 + Math.random() * 0.5,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.04 * speed,
        pulse: Math.random() * Math.PI * 2,
      });
    }
    let af;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      particles.current.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.rot += p.rotV; p.pulse += 0.03;
        if (down && p.y > H + 15) { p.y = -10; p.x = Math.random() * W; }
        if (!down && p.y < -15) { p.y = H + 10; p.x = Math.random() * W; }
        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
        const alpha = p.a * (shape === "spark" ? 0.5 + 0.5 * Math.abs(Math.sin(p.pulse)) : 1);
        ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
        if (shape === "leaf") {
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.beginPath(); ctx.ellipse(0, 0, p.r * 2.2, p.r * 0.9, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(0, -p.r * 0.9); ctx.lineTo(0, p.r * 0.9); ctx.strokeStyle = color; ctx.globalAlpha = alpha * 0.4; ctx.lineWidth = 0.5; ctx.stroke();
        } else if (shape === "drop") {
          ctx.translate(p.x, p.y);
          ctx.beginPath(); ctx.arc(0, 0, p.r * 0.8, 0, Math.PI * 2);
          ctx.moveTo(-p.r * 0.5, -p.r * 0.3); ctx.quadraticCurveTo(0, -p.r * 2.2, p.r * 0.5, -p.r * 0.3); ctx.fill();
        } else if (shape === "spark") {
          ctx.translate(p.x, p.y);
          ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = alpha * 0.3; ctx.beginPath(); ctx.arc(0, 0, p.r * 2.5, 0, Math.PI * 2); ctx.fill();
        } else if (shape === "bubble") {
          ctx.translate(p.x, p.y);
          ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2);
          ctx.fillStyle = "transparent"; ctx.strokeStyle = color; ctx.globalAlpha = alpha * 0.6; ctx.lineWidth = 0.8; ctx.stroke();
          ctx.beginPath(); ctx.arc(-p.r * 0.3, -p.r * 0.3, p.r * 0.25, 0, Math.PI * 2); ctx.fillStyle = color; ctx.globalAlpha = alpha * 0.4; ctx.fill();
        } else {
          ctx.beginPath(); ctx.arc(p.x - (ctx.canvas.width > 0 ? 0 : 0), p.y - (ctx.canvas.height > 0 ? 0 : 0), p.r, 0, Math.PI * 2);
          ctx.restore(); ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      });
      af = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(af);
  }, [count, color, speed, shape, direction]);
  return (<canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />);
}

// ═══ VFX ═════════════════════════════════════════════════════════════════════
// VFX types that should replace rather than stack
const VFX_REPLACE = new Set(["attackImpact","faceAttack","damage","creatureDie","heal"]);
function useVFX() {
  const [effects, setEffects] = useState([]);
  const add = useCallback((type, opts = {}) => {
    const id = uid("vfx");
    const dur = opts.duration || 1200;
    setEffects((p) => {
      const base = VFX_REPLACE.has(type) ? p.filter(x => x.type !== type) : p;
      return [...base, { id, type, ...opts, created: Date.now() }];
    });
    setTimeout(() => setEffects((p) => p.filter((x) => x.id !== id)), dur);
  }, []);
  return { effects, add };
}
function VFXOverlay({ effects }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 50, overflow: "hidden" }}>
      {effects.map((fx) => {
        if (fx.type === "damage") return (<Fragment key={fx.id}>
          <div style={{ position:"absolute", inset:0, animation:"vfxHitFlash 0.35s ease-out forwards", background:"rgba(255,30,30,0.18)", borderRadius:"inherit" }} />
          {fx.amount > 0 && <div style={{ position:"absolute", top:"38%", left:"50%", transform:"translate(-50%,-50%)", animation:"vfxShake .35s ease-out, vfxFloat 0.9s 0.1s ease-out forwards", fontSize:42, fontFamily:"'Cinzel',serif", fontWeight:900, color:"#ff3030", textShadow:"0 0 40px #ff0000cc, 0 0 80px #ff000055", letterSpacing:2 }}>-{fx.amount}</div>}
          <div style={{ position:"absolute", top:"38%", left:"50%", transform:"translate(-50%,-50%)", width:180, height:180, borderRadius:"50%", animation:"vfxRingBurst 0.5s ease-out forwards", border:"3px solid #ff404088" }} />
        </Fragment>);
        if (fx.type === "heal") return (<Fragment key={fx.id}>
          <div style={{ position:"absolute", inset:0, animation:"vfxHealFlash 0.5s ease-out forwards", background:"rgba(30,200,80,0.12)", borderRadius:"inherit" }} />
          <div style={{ position:"absolute", top:"50%", left:"50%", width:200, height:200, borderRadius:"50%", animation:"vfxRingBurst 0.7s ease-out forwards", border:"2px solid #40ff7088" }} />
          <div style={{ position:"absolute", top:"50%", left:"50%", width:120, height:120, borderRadius:"50%", animation:"vfxRingBurst 0.5s 0.1s ease-out forwards", border:"1px solid #40ff7055" }} />
          {fx.amount > 0 && <div style={{ position:"absolute", top:"38%", left:"50%", transform:"translate(-50%,-50%)", animation:"vfxFloat 1.1s ease-out forwards", fontSize:38, fontFamily:"'Cinzel',serif", fontWeight:900, color:"#40ff70", textShadow:"0 0 30px #00ff44cc, 0 0 60px #00ff4455", letterSpacing:2 }}>+{fx.amount}</div>}
        </Fragment>);
        if (fx.type === "ability") return (<Fragment key={fx.id}>
          <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", animation:"vfxPulse .9s ease-out forwards", background:`radial-gradient(circle,${fx.color||"#e8c060"}55,transparent)`, width:300, height:300, borderRadius:"50%" }} />
          <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:200, height:200, borderRadius:"50%", animation:"vfxRingBurst 0.6s ease-out forwards", border:`2px solid ${fx.color||"#e8c060"}88` }} />
        </Fragment>);
        if (fx.type === "environment") return (<div key={fx.id} style={{ position:"absolute", inset:0, animation:"vfxEnv 2.5s ease-out forwards", background:`radial-gradient(ellipse at 50% 100%,${fx.color||"#4a9020"}40,transparent 70%)`, borderTop:`2px solid ${fx.color||"#4a9020"}44` }} />);
        if (fx.type === "spell") return (<Fragment key={fx.id}>
          <div style={{ position:"absolute", top:"50%", left:"50%", width:320, height:320, borderRadius:"50%", animation:"spellCast 0.9s ease-out forwards", background:`radial-gradient(circle,${fx.color||"#c090d0"}77,${fx.color||"#c090d0"}33 50%,transparent 70%)`, border:`3px solid ${fx.color||"#c090d0"}99` }}/>
          <div style={{ position:"absolute", top:"50%", left:"50%", width:460, height:460, borderRadius:"50%", animation:"vfxRingBurst 1s 0.1s ease-out forwards", border:`2px solid ${fx.color||"#c090d0"}55` }}/>
          <div style={{ position:"absolute", top:"50%", left:"50%", width:560, height:560, borderRadius:"50%", animation:"vfxRingBurst 1.2s 0.2s ease-out forwards", border:`1px solid ${fx.color||"#c090d0"}33` }}/>
          <div style={{ position:"absolute", inset:0, animation:"vfxSpellFlash 0.5s ease-out forwards", background:`${fx.color||"#c090d0"}1a` }} />
        </Fragment>);
        if (fx.type === "envchange") return (<div key={fx.id} style={{ position:"absolute", inset:0, animation:"envFlash 1.5s ease-out forwards", background:`${fx.color||"#4a9020"}35`, pointerEvents:"none", borderRadius:"inherit" }}/>);
        if (fx.type === "attackImpact") return (<Fragment key={fx.id}>
          <div style={{ position:"absolute", top:"50%", left:"50%", width:280, height:280, borderRadius:"50%", animation:"vfxRingBurst 0.5s ease-out forwards", border:"4px solid #ff804099" }} />
          <div style={{ position:"absolute", top:"50%", left:"50%", width:160, height:160, borderRadius:"50%", animation:"vfxRingBurst 0.35s ease-out forwards", border:"3px solid #ffb060aa" }} />
          <div style={{ position:"absolute", top:"50%", left:"50%", width:80, height:80, borderRadius:"50%", animation:"vfxRingBurst 0.22s ease-out forwards", border:"2px solid #ffd09088" }} />
          <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", animation:"vfxPulse .45s ease-out forwards", background:"radial-gradient(circle,#ff800055,transparent 70%)", width:220, height:220, borderRadius:"50%" }} />
          <div style={{ position:"absolute", inset:0, animation:"vfxHitFlash 0.4s ease-out forwards", background:"rgba(255,100,0,0.22)" }} />
        </Fragment>);
        if (fx.type === "creatureDie") return (<Fragment key={fx.id}>
          <div style={{ position:"absolute", top:"50%", left:"50%", width:320, height:320, borderRadius:"50%", animation:"vfxRingBurst 0.6s ease-out forwards", border:`4px solid ${fx.color||"#e06040"}88` }} />
          <div style={{ position:"absolute", top:"50%", left:"50%", width:200, height:200, borderRadius:"50%", animation:"vfxRingBurst 0.45s 0.05s ease-out forwards", border:`3px solid ${fx.color||"#e06040"}77` }} />
          <div style={{ position:"absolute", top:"50%", left:"50%", width:100, height:100, borderRadius:"50%", animation:"vfxRingBurst 0.3s 0.1s ease-out forwards", border:`2px solid ${fx.color||"#e06040"}66` }} />
          <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", animation:"vfxPulse 0.7s ease-out forwards", background:`radial-gradient(circle,${fx.color||"#e06040"}55,transparent 65%)`, width:300, height:300, borderRadius:"50%" }} />
          <div style={{ position:"absolute", inset:0, animation:"vfxHitFlash 0.5s ease-out forwards", background:`rgba(220,60,20,0.14)` }} />
        </Fragment>);
        if (fx.type === "summonBurst") return (<Fragment key={fx.id}>
          <div style={{ position:"absolute", top:"50%", left:"50%", width:220, height:220, borderRadius:"50%", animation:"vfxRingBurst 0.6s ease-out forwards", border:`2px solid ${fx.color||"#e8c06055"}` }} />
          <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", animation:"vfxPulse 0.5s ease-out forwards", background:`radial-gradient(circle,${fx.color||"#e8c060"}22,transparent 65%)`, width:280, height:280, borderRadius:"50%" }} />
        </Fragment>);
        if (fx.type === "floatText") { const topPct = fx.zone==="player" ? "72%" : fx.zone==="enemy" ? "28%" : "30%"; return (<div key={fx.id} style={{ position:"absolute", top:topPct, left:"50%", transform:"translate(-50%,-50%)", animation:"vfxFloat 1.4s ease-out forwards", textAlign:"center", pointerEvents:"none", zIndex:60 }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:fx.big?22:14, fontWeight:900, color:fx.color||"#e8c060", textShadow:`0 0 20px ${fx.color||"#e8c060"}88, 0 2px 4px rgba(0,0,0,0.9)`, letterSpacing:2, whiteSpace:"nowrap" }}>{fx.text}</div>
          {fx.sub && <div style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:fx.color||"#e8c060", opacity:0.7, marginTop:2 }}>{fx.sub}</div>}
        </div>); }
        if (fx.type === "faceAttack") return (<Fragment key={fx.id}>
          <div style={{ position:"absolute", inset:0, animation:"vfxHitFlash 0.5s ease-out forwards", background:"rgba(255,40,10,0.2)" }} />
          <div style={{ position:"absolute", top:"50%", left:"50%", width:300, height:300, borderRadius:"50%", animation:"vfxRingBurst 0.7s ease-out forwards", border:"4px solid #ff301088" }} />
          <div style={{ position:"absolute", top:"38%", left:"50%", transform:"translate(-50%,-50%)", animation:"vfxShake .4s ease-out, vfxFloat 1s 0.1s ease-out forwards", fontSize:48, fontFamily:"'Cinzel',serif", fontWeight:900, color:"#ff2010", textShadow:"0 0 40px #ff0000cc, 0 0 80px #ff000055", letterSpacing:2 }}>⚔</div>
        </Fragment>);
        return null;
      })}
    </div>
  );
}


// ═══ CARD PREVIEW MODAL ══════════════════════════════════════════════════════
function CardPreview({ card, onClose }) {
  if (!card) return null;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { if (card.rarity === "Prismatic" || card.altSetId === "prismatic") SFX.play("prismatic"); }, [card.id]);
  const border = card.border || "#e8c060";
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(2,1,0,0.92)", backdropFilter: "blur(10px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, animation: "fadeIn 0.2s ease-out" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <Card card={card} size="lg" />
        <button onClick={onClose} style={{ padding: "7px 36px", background: "rgba(0,0,0,0.4)", border: `1px solid ${border}33`, borderRadius: 8, color: "#806040", fontFamily: "'Cinzel',serif", fontSize: 9, letterSpacing: 3, cursor: "pointer" }}>CLOSE</button>
      </div>
    </div>
  );
}

// ═══ PATCH NOTES MODAL ═══════════════════════════════════════════════════════
function PatchNotesModal({ onDismiss }) {
  const NEW = () => (
    <span style={{ marginLeft:6, padding:"1px 6px", background:"rgba(120,204,69,0.18)", border:"1px solid #78cc4555", borderRadius:8, fontSize:8, color:"#78cc45", fontFamily:"'Cinzel',serif", fontWeight:700, letterSpacing:1, verticalAlign:"middle" }}>NEW</span>
  );
  const rows = [
    { icon:"⚔", label:<>Friend Duels — challenge online friends directly from the player sidebar<NEW /></> },
    { icon:"👤", label:<>New Player Sidebar — profile, level, shards, friends list and online status<NEW /></> },
    { icon:"🟢", label:<>Live presence — online status now tracks globally, not just on the Friends tab<NEW /></> },
    { icon:"🚫", label:<>Match declined notification — get notified when a challenge is turned down<NEW /></> },
    { icon:"📖", label:"THE FABLES — Zeus, Hades, Lightning Meter, Soul Harvest, Anchor" },
    { icon:"🍓", label:"FOOD FIGHT — Berry & Tooty, Master Jax, Group Synergy, Splat" },
    { icon:"🛡", label:"Shield blocks first hit, first spell, and first attacker strike" },
    { icon:"⚡", label:"Zeus — Lightning Meter fires at 2 stacks · charges from Spells + Swift attacks" },
    { icon:"💀", label:"Hades — Soul Harvest triggers from hand · gains HP on every friendly death" },
    { icon:"🏆", label:"Ranked Season 1 live · ELO matchmaking · Iron → Bronze → Silver → Gold → Grandmaster" },
    { icon:"⚗", label:"Coming next: Leaderboard · Draft Mode · Faction pack openings in store", dim:true },
  ];
  return (
    <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(2,1,0,0.96)", backdropFilter:"blur(16px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"linear-gradient(160deg,#1c1a0e,#0e0c06)", border:"1px solid #e8c06044", borderRadius:18, width:"100%", maxWidth:430, boxShadow:"0 30px 80px rgba(0,0,0,0.98)", animation:"fadeIn 0.35s ease-out", overflow:"hidden" }}>
        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#1a1608,#100e04)", borderBottom:"1px solid #2a2210", padding:"20px 24px 16px", textAlign:"center" }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:900, color:"#e8c060", letterSpacing:1, marginBottom:6 }}>Forge {"&"} Fable</div>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(232,192,96,0.1)", border:"1px solid #e8c06033", borderRadius:20, padding:"4px 14px" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#78cc45", boxShadow:"0 0 8px #78cc45", animation:"pulse 1.5s infinite" }} />
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:10, fontWeight:700, color:"#e8a020", letterSpacing:3 }}>{CURRENT_PATCH} · PATCH NOTES</span>
          </div>
        </div>
        {/* Rows */}
        <div style={{ padding:"12px 18px 8px", display:"flex", flexDirection:"column", gap:1 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 8px", borderRadius:7, background: i%2===0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
              <span style={{ fontSize:13, flexShrink:0, width:20, textAlign:"center" }}>{r.icon}</span>
              <span style={{ fontSize:11, color: r.dim ? "#4a4030" : "#c0b490", lineHeight:1.4, flex:1 }}>{r.label}</span>
            </div>
          ))}
        </div>
        {/* Alpha notice */}
        <div style={{ margin:"10px 18px 14px", background:"rgba(232,160,32,0.07)", border:"1px solid #e8a02033", borderRadius:10, padding:"11px 13px" }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#e8a020", letterSpacing:3, fontWeight:700, marginBottom:4 }}>⚠ ALPHA TESTING PHASE</div>
          <div style={{ fontSize:10, color:"#806838", lineHeight:1.7 }}>You may experience lag or sync delays — that's expected in early multiplayer. We appreciate the support and hope you have a blast on the battlefield! 🔥</div>
        </div>
        {/* CTA */}
        <div style={{ padding:"0 18px 18px" }}>
          <button onClick={onDismiss} style={{ width:"100%", padding:"13px", background:"linear-gradient(135deg,#c89010,#f0c040)", border:"none", borderRadius:10, fontFamily:"'Cinzel',serif", fontSize:13, fontWeight:700, letterSpacing:3, color:"#1a1000", cursor:"pointer", boxShadow:"0 4px 20px rgba(200,144,0,0.35)", transition:"all .2s" }} onMouseEnter={e=>e.currentTarget.style.transform="translateY(-1px)"} onMouseLeave={e=>e.currentTarget.style.transform="none"}>ENTER THE ARENA</button>
        </div>
      </div>
    </div>
  );
}

// ═══ CANVAS ART ══════════════════════════════════════════════════════════════
function drawCardArt(ctx, card, W, H) {
  const rng = mkRng(card.seed || 42); const region = card.region || "Thornwood"; const type = card.type || "creature"; const g = GLOW[region] || "#70ff30";
  ctx.clearRect(0, 0, W, H);
  const bgs = { Thornwood: ["#010801","#041204","#071a06"], "Shattered Expanse": ["#02000a","#06001a","#0a002a"], "Azure Deep": ["#010308","#020818","#030c28"], Ashfen: ["#0c0100","#1e0400","#2a0600"], Ironmarch: ["#030304","#06060c","#0a0a14"], Sunveil: ["#0c0600","#1a0e00","#260e00"], Bloodpact: ["#080002","#120006","#1c000a"] };
  const cols = bgs[region] || bgs.Thornwood;
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, cols[0]); bg.addColorStop(0.5, cols[1]); bg.addColorStop(1, cols[2]);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 35; i++) { ctx.beginPath(); ctx.arc(rng() * W, rng() * H, rng() * 1.8 + 0.3, 0, PI * 2); ctx.fillStyle = `rgba(${100 + rng() * 155 | 0},${100 + rng() * 155 | 0},${150 + rng() * 105 | 0},${0.1 + rng() * 0.6})`; ctx.fill(); }
  const cx = W * 0.5, cy = H * 0.46;
  const gc = hexToRgb(g);
  if (gc) { const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * 0.32); aura.addColorStop(0, `rgba(${gc.r},${gc.g},${gc.b},0.22)`); aura.addColorStop(1, `rgba(${gc.r},${gc.g},${gc.b},0)`); ctx.fillStyle = aura; ctx.fillRect(0, 0, W, H); }
  ctx.shadowBlur = 22; ctx.shadowColor = g;
  if (type === "spell") { const og = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.15); og.addColorStop(0, g + "cc"); og.addColorStop(0.5, g + "55"); og.addColorStop(1, g + "00"); ctx.fillStyle = og; ctx.beginPath(); ctx.arc(cx, cy, W * 0.15, 0, PI * 2); ctx.fill(); ctx.strokeStyle = g + "88"; ctx.lineWidth = 1.5; for (let i = 0; i < 8; i++) { const a = i * PI / 4, len = W * (0.15 + rng() * 0.25); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * W * 0.12, cy + Math.sin(a) * W * 0.12); ctx.quadraticCurveTo(cx + Math.cos(a + 0.4) * len * 0.7, cy + Math.sin(a + 0.4) * len * 0.7, cx + Math.cos(a) * len, cy + Math.sin(a) * len); ctx.stroke(); }
  } else if (type === "environment") { ctx.shadowBlur = 30; const eg = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.4); eg.addColorStop(0, g + "44"); eg.addColorStop(0.5, g + "18"); eg.addColorStop(1, g + "00"); ctx.fillStyle = eg; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = g + "55"; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(cx, cy, W * 0.28, 0, PI * 2); ctx.stroke(); ctx.setLineDash([]); for (let i = 0; i < 6; i++) { const a = i * PI / 3; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * W * 0.22, cy + Math.sin(a) * W * 0.22, 3 + rng() * 4, 0, PI * 2); ctx.fillStyle = g + "aa"; ctx.fill(); }
  } else { const sc = W * 0.18; ctx.fillStyle = "rgba(4,4,4,0.88)"; if (type === "champion") { ctx.fillRect(cx - sc * 0.55, cy - sc * 0.1, sc * 1.1, sc * 1.05); safeRoundRect(ctx, cx - sc * 0.4, cy - sc * 0.9, sc * 0.8, sc * 0.8, sc * 0.12); ctx.fill(); ctx.fillRect(cx - sc * 1.35, cy, sc * 0.5, sc * 0.9); ctx.fillRect(cx + sc * 0.85, cy, sc * 0.5, sc * 0.9); ctx.shadowBlur = 16; ctx.shadowColor = g; ctx.fillStyle = g + "55"; ctx.fillRect(cx - sc * 0.32, cy - sc * 0.64, sc * 0.64, sc * 0.14); } else { ctx.beginPath(); ctx.ellipse(cx, cy + sc * 0.4, sc * 0.7, sc * 0.8, 0, 0, PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(cx, cy - sc * 0.5, sc * 0.55, 0, PI * 2); ctx.fill(); } }
  ctx.shadowBlur = 0;
  const v = ctx.createRadialGradient(W * 0.5, H * 0.4, W * 0.1, W * 0.5, H * 0.5, W * 0.85); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(0.55, "rgba(0,0,0,0.08)"); v.addColorStop(1, "rgba(0,0,0,0.78)"); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}
function ArtCanvas({ card, style = {} }) { const ref = useRef(null); useEffect(() => { const c = ref.current; if (!c) return; const dpr = window.devicePixelRatio || 1; c.width = 280 * dpr; c.height = 190 * dpr; const ctx = c.getContext("2d"); ctx.scale(dpr, dpr); drawCardArt(ctx, card, 280, 190); }, [card.id, card.seed, card.region, card.type]); return (<canvas ref={ref} style={{ width: "100%", height: "100%", display: "block", ...style }} />); }
function CardArt({ card }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (card.imageUrl && !imgFailed) return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <ArtCanvas card={card} style={{ position: "absolute", inset: 0 }} />
      <img src={card.imageUrl} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: card.altObjectPosition || "top", zIndex: 1, imageRendering: "high-quality", transform: `scale(${card.imageScale || 1}) translateZ(0)`, transformOrigin: "center top", willChange: "transform" }} referrerPolicy="no-referrer" onError={() => setImgFailed(true)} />
    </div>
  );
  return (<div style={{ position: "relative", width: "100%", height: "100%" }}><ArtCanvas card={card} style={{ position: "absolute", inset: 0 }} /></div>);
}

// ═══ CARD POOL ═══════════════════════════════════════════════════════════════
const POOL = [
  { id: "wolf", name: "Stonefang Wolf", type: "creature", region: "Thornwood", rarity: "Common", cost: 2, atk: 3, hp: 2, keywords: ["Swift"], border: "#4a9020", seed: 7, bloodpact: false, imageUrl: "/cards/stonefang.jpg", imageScale: 1.1, ability: "Swift. Can attack immediately.", flavor: "It hunts what you're holding.", effects: [], levelUp: [{ at: 2, bonus: { atk: 1, hp: 0 }, label: "Pack Leader" }, { at: 4, bonus: { atk: 1, hp: 1 }, label: "Alpha" }] },
  { id: "guard", name: "Thornwood Guard", type: "creature", region: "Thornwood", rarity: "Common", cost: 3, atk: 1, hp: 5, keywords: [], border: "#4a9020", seed: 15, bloodpact: false, imageUrl: "/cards/guard.jpg", imageScale: 1.1, ability: "On Play: Give +1 HP to all allies.", flavor: "The trees remember.", effects: [{ trigger: "onPlay", effect: "buff_allies", atk: 0, hp: 1 }], levelUp: [{ at: 3, bonus: { atk: 0, hp: 2 }, label: "Ironbark" }, { at: 5, bonus: { atk: 1, hp: 2 }, label: "Ancient Oak" }] },
  { id: "druid", name: "Rootcaller Druid", type: "creature", region: "Thornwood", rarity: "Uncommon", cost: 3, atk: 2, hp: 3, keywords: [], border: "#4a9020", seed: 111, bloodpact: false, imageUrl: "/cards/druid.jpg", imageScale: 1.1, ability: "On Play: Heal hero for 3.", flavor: "She asks the roots.", effects: [{ trigger: "onPlay", effect: "heal_hero", amount: 3 }], levelUp: [{ at: 2, bonus: { atk: 0, hp: 1 }, label: "Elder" }, { at: 4, bonus: { atk: 1, hp: 2 }, label: "Arch-Druid" }] },
  { id: "tangle", name: "Tanglewood Trap", type: "spell", region: "Thornwood", rarity: "Rare", cost: 2, atk: null, hp: null, keywords: [], border: "#4a9020", seed: 112, bloodpact: false, imageUrl: "/cards/tangle.jpg", imageScale: 1.1, ability: "Deal 2 damage to all enemies.", flavor: "The forest does not warn.", effects: [{ trigger: "onPlay", effect: "damage_all_enemies", amount: 2 }] },
  { id: "env_grove", name: "Ancient Grove", type: "environment", region: "Thornwood", rarity: "Uncommon", cost: 2, atk: null, hp: null, keywords: [], border: "#4a9020", seed: 113, bloodpact: false, imageUrl: "/cards/env_grove.jpg", imageScale: 1.1, ability: "ENV: Allies heal 1 HP each turn.", flavor: "Under the canopy, wounds close.", effects: [{ trigger: "onTurnStart", effect: "heal_all_allies", amount: 1 }] },
  { id: "wisp", name: "Echo Wisp", type: "creature", region: "Shattered Expanse", rarity: "Uncommon", cost: 2, atk: 2, hp: 2, keywords: ["Echo"], border: "#9050d8", seed: 42, bloodpact: false, imageUrl: "/cards/wisp.jpg", imageScale: 1.1, ability: "Echo - 1/1 ghost replays next turn.", flavor: "The Rift repeats.", effects: [], levelUp: [{ at: 2, bonus: { atk: 0, hp: 1 }, label: "Resonant" }, { at: 4, bonus: { atk: 1, hp: 1 }, label: "Twin Soul" }] },
  { id: "shard", name: "Rift Shard", type: "creature", region: "Shattered Expanse", rarity: "Common", cost: 1, atk: 2, hp: 1, keywords: ["Swift"], border: "#9050d8", seed: 120, bloodpact: false, imageUrl: "/cards/shard.jpg", imageScale: 1.1, ability: "Swift. On Death: Draw a card.", flavor: "It shatters. You learn.", effects: [{ trigger: "onDeath", effect: "draw", amount: 1 }], levelUp: [{ at: 2, bonus: { atk: 1, hp: 0 }, label: "Prism" }, { at: 4, bonus: { atk: 1, hp: 1 }, label: "Crystal Core" }] },
  { id: "weaver", name: "Timeline Weaver", type: "creature", region: "Shattered Expanse", rarity: "Rare", cost: 4, atk: 2, hp: 4, keywords: ["Fracture"], border: "#9050d8", seed: 121, bloodpact: false, imageUrl: "/cards/weaver.jpg", imageScale: 1.1, ability: "Fracture. On Play: Allies get +1 ATK.", flavor: "She knits time into armor.", effects: [{ trigger: "onPlay", effect: "buff_allies", atk: 1, hp: 0 }], levelUp: [{ at: 2, bonus: { atk: 1, hp: 1 }, label: "Chrono Sage" }, { at: 4, bonus: { atk: 2, hp: 1 }, label: "Time Lord" }] },
  { id: "velrun", name: "Velrun", type: "champion", region: "Shattered Expanse", rarity: "Legendary", cost: 5, atk: 6, hp: 6, keywords: ["Fracture","Shield"], border: "#9050d8", seed: 99, bloodpact: false, imageUrl: "/cards/velrun.jpg", imageScale: 1.1, ability: "Fracture. On Play: 2 damage to enemy hero.", flavor: "He ruled three timelines. Lost them all.", effects: [{ trigger: "onPlay", effect: "damage_enemy_hero", amount: 2 }], levelUp: [{ at: 3, bonus: { atk: 1, hp: 2 }, label: "Ascendant" }, { at: 5, bonus: { atk: 2, hp: 2 }, label: "Timeline King" }] },
  { id: "env_rift", name: "Fractured Rift", type: "environment", region: "Shattered Expanse", rarity: "Rare", cost: 3, atk: null, hp: null, keywords: [], border: "#9050d8", seed: 122, bloodpact: false, imageUrl: "/cards/env_rift.jpg", imageScale: 1.1, ability: "ENV: All allies get +1 ATK.", flavor: "Reality bends.", effects: [{ trigger: "onTurnStart", effect: "buff_allies", atk: 1, hp: 0 }] },
  { id: "tide", name: "Tidecaller", type: "creature", region: "Azure Deep", rarity: "Rare", cost: 3, atk: 2, hp: 3, keywords: ["Resonate"], border: "#1880b8", seed: 13, bloodpact: false, imageUrl: "/cards/tide.jpg", imageScale: 1.1, ability: "Resonate - +1 ATK per enemy card.", flavor: "The sea reads the shore.", effects: [], levelUp: [{ at: 2, bonus: { atk: 0, hp: 1 }, label: "Stormsurge" }, { at: 4, bonus: { atk: 1, hp: 1 }, label: "Tempest" }] },
  { id: "shellguard", name: "Shellguard", type: "creature", region: "Azure Deep", rarity: "Common", cost: 2, atk: 1, hp: 4, keywords: ["Shield"], border: "#1880b8", seed: 130, bloodpact: false, imageUrl: "/cards/shellguard.jpg", imageScale: 1.1, ability: "Shield - blocks first hit.", flavor: "Patient as coral.", effects: [], levelUp: [{ at: 3, bonus: { atk: 0, hp: 2 }, label: "Reef Wall" }, { at: 5, bonus: { atk: 1, hp: 2 }, label: "Leviathan Shell" }] },
  { id: "current", name: "Riptide Current", type: "spell", region: "Azure Deep", rarity: "Common", cost: 1, atk: null, hp: null, keywords: [], border: "#1880b8", seed: 131, bloodpact: false, imageUrl: "/cards/current.jpg", imageScale: 1.1, ability: "Draw 2 cards.", flavor: "The deep gives.", effects: [{ trigger: "onPlay", effect: "draw", amount: 2 }] },
  { id: "kraken", name: "Abyssal Kraken", type: "creature", region: "Azure Deep", rarity: "Epic", cost: 5, atk: 4, hp: 5, keywords: ["Anchor"], border: "#1880b8", seed: 132, bloodpact: false, imageUrl: "/cards/kraken.jpg", imageScale: 1.1, ability: "Anchor. On Play: 3 damage to random enemy.", flavor: "It waited below. Always.", effects: [{ trigger: "onPlay", effect: "damage_random_enemy", amount: 3 }], levelUp: [{ at: 2, bonus: { atk: 1, hp: 1 }, label: "Deep Terror" }, { at: 4, bonus: { atk: 2, hp: 2 }, label: "Worldbreaker" }] },
  { id: "env_depths", name: "Sunken Depths", type: "environment", region: "Azure Deep", rarity: "Uncommon", cost: 2, atk: null, hp: null, keywords: [], border: "#1880b8", seed: 133, bloodpact: false, imageUrl: "/cards/env_depths.jpg", imageScale: 1.1, ability: "ENV: Draw extra card each turn.", flavor: "The pressure reveals.", effects: [{ trigger: "onTurnStart", effect: "draw", amount: 1 }] },
  { id: "sprite", name: "Emberveil Sprite", type: "creature", region: "Ashfen", rarity: "Common", cost: 1, atk: 1, hp: 2, keywords: ["Bleed"], border: "#c04810", seed: 23, bloodpact: false, imageUrl: "/alt-art/sprite-anime-island.png", imageScale: 1.1, ability: "Bleed - 1 stack on hit.", flavor: "Small. Spiteful.", effects: [], levelUp: [{ at: 2, bonus: { atk: 1, hp: 0 }, label: "Spite Flame" }, { at: 4, bonus: { atk: 1, hp: 1 }, label: "Inferno Core" }] },
  { id: "imp", name: "Ashfen Imp", type: "creature", region: "Ashfen", rarity: "Common", cost: 1, atk: 2, hp: 1, keywords: [], border: "#c04810", seed: 55, bloodpact: false, imageUrl: "/alt-art/imp-anime-island.png", imageScale: 1.1, ability: "On Death: 2 damage to enemy hero.", flavor: "Burned the bridge before crossing.", effects: [{ trigger: "onDeath", effect: "damage_enemy_hero", amount: 2 }], levelUp: [{ at: 2, bonus: { atk: 1, hp: 1 }, label: "Scarred Imp" }, { at: 4, bonus: { atk: 2, hp: 1 }, label: "Pit Champion" }] },
  { id: "pyro", name: "Pyromancer", type: "creature", region: "Ashfen", rarity: "Uncommon", cost: 3, atk: 3, hp: 2, keywords: ["Bleed"], border: "#c04810", seed: 140, bloodpact: false, imageUrl: "/cards/pyro.jpg", imageScale: 1.1, ability: "Bleed. On Play: 1 damage to ALL.", flavor: "Everything burns equally.", effects: [{ trigger: "onPlay", effect: "damage_all", amount: 1 }], levelUp: [{ at: 2, bonus: { atk: 1, hp: 1 }, label: "Firestarter" }, { at: 4, bonus: { atk: 2, hp: 1 }, label: "Inferno" }] },
  { id: "eruption", name: "Volcanic Eruption", type: "spell", region: "Ashfen", rarity: "Rare", cost: 4, atk: null, hp: null, keywords: [], border: "#c04810", seed: 141, bloodpact: false, imageUrl: "/cards/eruption.jpg", imageScale: 1.1, ability: "4 to enemy hero. 1 to yours.", flavor: "The mountain remembers.", effects: [{ trigger: "onPlay", effect: "damage_enemy_hero", amount: 4 }, { trigger: "onPlay", effect: "damage_own_hero", amount: 1 }] },
  { id: "env_volcano", name: "Ashfen Caldera", type: "environment", region: "Ashfen", rarity: "Rare", cost: 3, atk: null, hp: null, keywords: [], border: "#c04810", seed: 142, bloodpact: false, imageUrl: "/cards/env_volcano.jpg", imageScale: 1.1, ability: "ENV: +1 ATK to your creatures each turn.", flavor: "The heat forges warriors.", effects: [{ trigger: "onTurnStart", effect: "buff_allies", atk: 1, hp: 0 }] },
  { id: "sentinel", name: "Iron Sentinel", type: "creature", region: "Ironmarch", rarity: "Uncommon", cost: 3, atk: 2, hp: 4, keywords: ["Anchor"], border: "#6060a0", seed: 31, bloodpact: false, imageUrl: "/cards/sentinel.jpg", imageScale: 1.1, ability: "Anchor - can't be removed.", flavor: "It never moved.", effects: [], levelUp: [{ at: 3, bonus: { atk: 1, hp: 1 }, label: "Immovable" }, { at: 5, bonus: { atk: 2, hp: 2 }, label: "Eternal Wall" }] },
  { id: "forgebot", name: "Forge Automaton", type: "creature", region: "Ironmarch", rarity: "Common", cost: 2, atk: 2, hp: 3, keywords: [], border: "#6060a0", seed: 150, bloodpact: false, imageUrl: "/cards/forgebot.jpg", imageScale: 1.1, ability: "On Play: Random ally gets +1 ATK.", flavor: "Built to improve.", effects: [{ trigger: "onPlay", effect: "buff_random_ally", atk: 1, hp: 0 }], levelUp: [{ at: 2, bonus: { atk: 1, hp: 0 }, label: "Overclocked" }, { at: 4, bonus: { atk: 1, hp: 1 }, label: "War Engine" }] },
  { id: "shield_wall", name: "Iron Barricade", type: "spell", region: "Ironmarch", rarity: "Common", cost: 2, atk: null, hp: null, keywords: [], border: "#6060a0", seed: 151, bloodpact: false, imageUrl: "/cards/shield_wall.jpg", imageScale: 1.1, ability: "All allies get +2 HP.", flavor: "The wall holds.", effects: [{ trigger: "onPlay", effect: "buff_allies", atk: 0, hp: 2 }] },
  { id: "colossus", name: "Ironmarch Colossus", type: "champion", region: "Ironmarch", rarity: "Legendary", cost: 6, atk: 5, hp: 8, keywords: ["Anchor", "Shield"], border: "#6060a0", seed: 152, bloodpact: false, imageUrl: "/cards/colossus.jpg", imageScale: 1.1, ability: "Anchor + Shield. +1 ATK/turn.", flavor: "The empire fell. It did not.", effects: [{ trigger: "onTurnStart", effect: "self_buff", atk: 1, hp: 0 }], levelUp: [{ at: 3, bonus: { atk: 1, hp: 1 }, label: "Living Fortress" }, { at: 5, bonus: { atk: 2, hp: 2 }, label: "God-Machine" }] },
  { id: "falcon", name: "Sunveil Falcon", type: "creature", region: "Sunveil", rarity: "Common", cost: 2, atk: 3, hp: 1, keywords: ["Swift"], border: "#b89010", seed: 160, bloodpact: false, imageUrl: "/cards/falcon.jpg", imageScale: 1.1, ability: "Swift.", flavor: "Sunlight made lethal.", effects: [], levelUp: [{ at: 2, bonus: { atk: 1, hp: 1 }, label: "Raptor" }, { at: 4, bonus: { atk: 1, hp: 1 }, label: "Sky Tyrant" }] },
  { id: "oracle", name: "Sand Oracle", type: "creature", region: "Sunveil", rarity: "Uncommon", cost: 3, atk: 2, hp: 3, keywords: [], border: "#b89010", seed: 161, bloodpact: false, imageUrl: "/cards/oracle.jpg", imageScale: 1.1, ability: "On Play: Draw a card.", flavor: "The sands show what comes.", effects: [{ trigger: "onPlay", effect: "draw", amount: 1 }], levelUp: [{ at: 2, bonus: { atk: 0, hp: 1 }, label: "Seer" }, { at: 4, bonus: { atk: 1, hp: 2 }, label: "Prophet" }] },
  { id: "sun_strike", name: "Solar Flare", type: "spell", region: "Sunveil", rarity: "Rare", cost: 3, atk: null, hp: null, keywords: [], border: "#b89010", seed: 162, bloodpact: false, imageUrl: "/cards/sun_strike.jpg", imageScale: 1.1, ability: "3 to random enemy, 1 to all.", flavor: "The sun does not forgive.", effects: [{ trigger: "onPlay", effect: "damage_random_enemy", amount: 3 }, { trigger: "onPlay", effect: "damage_all_enemies", amount: 1 }] },
  { id: "env_dunes", name: "Shifting Dunes", type: "environment", region: "Sunveil", rarity: "Uncommon", cost: 2, atk: null, hp: null, keywords: [], border: "#b89010", seed: 163, bloodpact: false, imageUrl: "/cards/env_dunes.jpg", imageScale: 1.1, ability: "ENV: Creatures cost 1 less (min 1).", flavor: "The path shortens.", effects: [{ trigger: "passive", effect: "cost_reduction", amount: 1 }] },
  { id: "siphon", name: "Siphon Wraith", bleedAmount: 2, type: "creature", region: "Bloodpact", rarity: "Rare", cost: 3, atk: 5, hp: 3, keywords: ["Bleed"], border: "#a81830", seed: 77, bloodpact: true, imageUrl: "/cards/siphon.jpg", imageScale: 1.1, ability: "BLOOD (3 HP). Double Bleed.", flavor: "It fed on the wound.", effects: [], levelUp: [{ at: 2, bonus: { atk: 1, hp: 1 }, label: "Hungering" }, { at: 4, bonus: { atk: 2, hp: 1 }, label: "Soul Drinker" }] },
  { id: "martyr", name: "Crimson Martyr", type: "creature", region: "Bloodpact", rarity: "Uncommon", cost: 2, atk: 3, hp: 4, keywords: [], border: "#a81830", seed: 88, bloodpact: true, imageUrl: "/cards/martyr.jpg", imageScale: 1.1, ability: "BLOOD (2 HP). On Death: Heal 4.", flavor: "Sacrifice was its prayer.", effects: [{ trigger: "onDeath", effect: "heal_hero", amount: 4 }], levelUp: [{ at: 2, bonus: { atk: 0, hp: 2 }, label: "Devoted" }, { at: 4, bonus: { atk: 1, hp: 3 }, label: "Saint's Wrath" }] },
  { id: "bloodmage", name: "Hemomancer", type: "creature", region: "Bloodpact", rarity: "Epic", cost: 4, atk: 4, hp: 4, keywords: ["Bleed"], border: "#a81830", seed: 170, bloodpact: true, imageUrl: "/cards/bloodmage.jpg", imageScale: 1.1, ability: "BLOOD (4 HP). Bleed. 2 Bleed to all.", flavor: "Blood is currency.", effects: [{ trigger: "onPlay", effect: "bleed_all_enemies", amount: 2 }], levelUp: [{ at: 2, bonus: { atk: 1, hp: 1 }, label: "Blood Lord" }, { at: 4, bonus: { atk: 2, hp: 2 }, label: "Sanguine King" }] },
  { id: "blood_pact", name: "Dark Bargain", type: "spell", region: "Bloodpact", rarity: "Uncommon", cost: 2, atk: null, hp: null, keywords: [], border: "#a81830", seed: 171, bloodpact: true, imageUrl: "/cards/blood_pact.jpg", imageScale: 1.1, ability: "BLOOD (2 HP). Draw 3 cards.", flavor: "The cost is always you.", effects: [{ trigger: "onPlay", effect: "draw", amount: 3 }] },
  // ── Food Fight Expansion ─────────────────────────────────────────────────────────
  { id: "berry_tooty",           name: "Berry & Tooty",           type: "champion", region: "Food Fight", group: "Fruit",                      rarity: "Legendary", cost: 5,  atk: 4,    hp: 6,    keywords: ["Swift", "Splat"],           border: "#ff6040", seed: 201,  bloodpact: false, imageUrl: "/cards/berry_tooty.png",           ability: "On Attack: Spawn a random 0/1 Ingredient token on the board.",                            effects: [{ trigger: "onAttack", effect: "spawn_token", tokenId: "random_ingredient" }] },
  { id: "master_jax",            name: "Master Jax",              type: "champion", region: "Food Fight", group: "Protein/Veggie",              rarity: "Legendary", cost: 4,  atk: 3,    hp: 5,    keywords: ["Shield"],                    border: "#ff6040", seed: 202,  bloodpact: false, imageUrl: "/cards/master_jax.png",            ability: "Passive: All Group Synergy thresholds are reduced by 1.",                                 effects: [] },
  { id: "capt_meatball",         name: "Capt. Meatball",          type: "creature", region: "Food Fight", group: "Protein",                    rarity: "Common",    cost: 2,  atk: 2,    hp: 2,    keywords: ["Fracture", "Splat"],         border: "#ff6040", seed: 203,  bloodpact: false, imageUrl: "/cards/capt._meatball.png",         ability: "Splat. When I die, spawn a 0/1 Protein Ingredient.",                                      effects: [{ trigger: "onDeath", effect: "spawn_token", tokenId: "protein_ingredient" }] },
  { id: "broccoli_brute",        name: "Broccoli Brute",          type: "creature", region: "Food Fight", group: "Veggie",                     rarity: "Uncommon",  cost: 3,  atk: 1,    hp: 4,    keywords: ["Bleed", "Splat"],            border: "#ff6040", seed: 204,  bloodpact: false, imageUrl: "/cards/broccoli_brute.png",        ability: "While alive, other Veggie units gain +1 ATK. On Attack: Spawn a Veggie Ingredient.",      effects: [{ trigger: "onAttack", effect: "spawn_token", tokenId: "veggie_ingredient" }] },
  { id: "caffeine_catapult",     name: "Caffeine Catapult",       type: "creature", region: "Food Fight", group: "Sugar",                      rarity: "Uncommon",  cost: 4,  atk: 1,    hp: 5,    keywords: ["Resonate"],                  border: "#ff6040", seed: 205,  bloodpact: false, imageUrl: "/cards/caffeine_catapult.png",     ability: "The first card you play each turn triggers Splat. On Attack: Spawn a Sugar Ingredient.",   effects: [{ trigger: "onAttack", effect: "spawn_token", tokenId: "sugar_ingredient" }] },
  { id: "sir_sizzles",           name: "Sir Sizzles",             type: "creature", region: "Food Fight", group: "Protein",                    rarity: "Rare",      cost: 5,  atk: 2,    hp: 4,    keywords: ["Shield", "Resonate", "Splat"], border: "#ff6040", seed: 206,  bloodpact: false, imageUrl: "/cards/sir_sizzles.png",           ability: "On play: Deal 1 damage to all enemy units.",                                              effects: [{ trigger: "onPlay", effect: "damage_all_enemies", amount: 1 }] },
  { id: "leftover_titan",        name: "Leftover Titan",          type: "creature", region: "Food Fight", group: "Fruit/Veggie/Protein/Sugar",  rarity: "Epic",      cost: 5,  atk: 2,    hp: 3,    keywords: ["Swift", "Bleed", "Anchor", "Splat"], border: "#ff6040", seed: 207,  bloodpact: false, imageUrl: "/cards/leftover_titan.png",        ability: "Considered a Fruit, Veggie, Protein, and Sugar! On Play: Consume all friendly Ingredients — gain +1/+1 per ingredient consumed.",  effects: [{ trigger: "onPlay", effect: "consume_ingredients" }] },
  { id: "food_nado",             name: "Food-nado",               type: "spell",    region: "Food Fight", group: "Fruit",                      rarity: "Uncommon",  cost: 3,  atk: null, hp: null, keywords: [],                           border: "#ff6040", seed: 208,  bloodpact: false, imageUrl: "/cards/food-nado.png",             ability: "Deal 3 damage to ALL enemy units. Spawn a 0/1 Fruit Ingredient.",                          effects: [{ trigger: "onPlay", effect: "food_nado_damage", amount: 3 }] },
  { id: "bean_barrage",          name: "Bean Barrage",            type: "spell",    region: "Food Fight", group: "Veggie",                     rarity: "Common",    cost: 2,  atk: null, hp: null, keywords: [],                           border: "#ff6040", seed: 209,  bloodpact: false, imageUrl: "/cards/bean_barrage.png",          ability: "Give a random friendly unit +1/+1 and Bleed. Spawn a Veggie Ingredient.",                 effects: [{ trigger: "onPlay", effect: "bean_barrage_buff" }, { trigger: "onPlay", effect: "spawn_token", tokenId: "veggie_ingredient" }] },
  // ── Food Fight Tokens ────────────────────────────────────────────────────────────
  { id: "fruit_ingredient",      name: "Fruit Ingredient",        type: "creature", region: "Food Fight", group: "Fruit",                      rarity: "Common",    cost: 0,  atk: 0,    hp: 1,    keywords: ["Splat"],                     border: "#ff6040", seed: 210,  bloodpact: false, imageUrl: "/cards/fruit_ingredient.png",      isToken: true, ability: "Splat: When destroyed, deal 1 damage to a random enemy.",                                 effects: [] },
  { id: "protein_ingredient",    name: "Protein Ingredient",      type: "creature", region: "Food Fight", group: "Protein",                    rarity: "Common",    cost: 0,  atk: 0,    hp: 1,    keywords: ["Splat"],                     border: "#ff6040", seed: 211,  bloodpact: false, imageUrl: "/cards/protein_ingredient.png",    isToken: true, ability: "Splat: When destroyed, deal 1 damage to a random enemy.",                                 effects: [] },
  { id: "veggie_ingredient",     name: "Veggie Ingredient",       type: "creature", region: "Food Fight", group: "Veggie",                     rarity: "Common",    cost: 0,  atk: 0,    hp: 1,    keywords: ["Splat"],                     border: "#ff6040", seed: 212,  bloodpact: false, imageUrl: "/cards/veggie_ingredient.png",     isToken: true, ability: "Splat: When destroyed, deal 1 damage to a random enemy.",                                 effects: [] },
  { id: "sugar_ingredient",      name: "Sugar Ingredient",        type: "creature", region: "Food Fight", group: "Sugar",                      rarity: "Common",    cost: 0,  atk: 0,    hp: 1,    keywords: ["Splat"],                     border: "#ff6040", seed: 213,  bloodpact: false, imageUrl: "/cards/sugar_ingredient.png",      isToken: true, ability: "Splat: When destroyed, deal 1 damage to a random enemy.",                                 effects: [] },
  // ── Fables Expansion ─────────────────────────────────────────────────────────
  { id: "zeus_storm_father",  name: "Zeus, Storm Father", type: "champion", region: "Fables",     rarity: "Legendary", cost: 5, atk: 4, hp: 6,       keywords: [],                    border: "#9070ff", seed: 400, bloodpact: false, imageUrl: "/cards/zeus_storm_father.jpg", ability: "On Play: Deal 2 dmg to a random unit on the field, or the enemy hero if the board is empty. Passive: Lightning Meter fires at 2 stacks — charges from any Spell cast or any Swift unit attacking.", effects: [{ trigger: "onPlay", effect: "zeus_onplay_damage" }] },
  { id: "hades_soul_reaper",  name: "Hades, Soul Reaper", type: "champion", region: "Fables",     rarity: "Legendary", cost: 5, atk: 3, hp: 6,       keywords: [],                    border: "#7030c0", seed: 401, bloodpact: false, imageUrl: "/cards/hades_soul_reaper.png", ability: "Soul Harvest: +1 Max HP whenever a friendly unit dies (cap 10). End of Turn: 1 dmg to all enemies.", effects: [{ trigger: "onFriendlyDeath", effect: "soul_harvest" }, { trigger: "onTurnEnd", effect: "soul_reap" }] },
  { id: "spartan_recruit",    name: "Spartan Recruit",    type: "creature", region: "Fables",     rarity: "Common",   cost: 1, atk: 1, hp: 2,        keywords: ["Resonate"],          border: "#9070ff", seed: 402, bloodpact: false, imageUrl: "/cards/spartan_recruit.jpg", ability: "\"I'm doing my part!\"", effects: [] },
  { id: "lost_soul",          name: "Lost Soul",          type: "creature", region: "Fables",     rarity: "Common",   cost: 1, atk: 1, hp: 1,        keywords: ["Echo"],              border: "#9070ff", seed: 403, bloodpact: false, imageUrl: "/cards/lost_soul.jpg", ability: "\"Just passing through.\"", effects: [] },
  { id: "olympus_guard",      name: "Fables Guard",       type: "creature", region: "Fables",     rarity: "Uncommon", cost: 3, atk: 2, hp: 5,        keywords: ["Anchor", "Shield"],  border: "#9070ff", seed: 404, bloodpact: false, imageUrl: "/cards/olympus_guard.jpg", ability: "\"Not on my watch.\"", effects: [] },
  { id: "cerberus_whelp",     name: "Cerberus Whelp",     type: "creature", region: "Fables",     rarity: "Uncommon", cost: 2, atk: 2, hp: 2,        keywords: ["Fracture", "Swift"], border: "#9070ff", seed: 405, bloodpact: false, imageUrl: "/cards/cerberus_whelp.jpg", ability: "\"Three times the treats!\"", effects: [] },
  { id: "titan_slayer",       name: "Titan-Slayer",       type: "creature", region: "Fables",     rarity: "Rare",     cost: 4, atk: 5, hp: 3,        keywords: ["Swift"],             border: "#9070ff", seed: 406, bloodpact: false, imageUrl: "/cards/titan_slayer.jpg", ability: "\"Size isn't everything.\"", effects: [] },
  { id: "bolt_from_the_blue", name: "Bolt from the Blue", type: "spell",    region: "Fables",     rarity: "Rare",     cost: 2, atk: null, hp: null,   keywords: [],                    border: "#9070ff", seed: 407, bloodpact: false, imageUrl: "/cards/bolt_from_the_blue.jpg", altObjectPosition: "center", ability: "Deal 3 damage to a chosen target. If this kills a unit, +1 to Lightning Meter.", effects: [{ trigger: "onPlay", effect: "bolt_damage", amount: 3 }] },
  { id: "river_styx",         name: "River Styx",         type: "spell",    region: "Fables",     rarity: "Uncommon", cost: 3, atk: null, hp: null,   keywords: [],                    border: "#9070ff", seed: 408, bloodpact: false, imageUrl: "/cards/river_styx.jpg", ability: "Inflict Bleed on all enemies.", effects: [{ trigger: "onPlay", effect: "bleed_all_enemies", amount: 1 }] },
  { id: "pandoras_box",       name: "Pandora's Box",      type: "spell",    region: "Fables",     rarity: "Uncommon", cost: 1, atk: null, hp: null,   keywords: [],                    border: "#9070ff", seed: 409, bloodpact: false, imageUrl: "/cards/pandoras_box.jpg", ability: "Each player draws 1. If you have a unit with Shield on field, only you draw.", effects: [{ trigger: "onPlay", effect: "pandora_draw" }] },
  { id: "heras_command",      name: "Hera's Command",     type: "spell",    region: "Fables",     rarity: "Epic",     cost: 4, atk: null, hp: null,   keywords: [],                    border: "#9070ff", seed: 410, bloodpact: false, imageUrl: "/cards/heras_command.jpg", ability: "Give all friendly units Shield.", effects: [{ trigger: "onPlay", effect: "shield_all_allies" }] },
  { id: "medusas_gaze",       name: "Medusa's Gaze",      type: "spell",    region: "Fables",     rarity: "Rare",     cost: 2, atk: null, hp: null,   keywords: [],                    border: "#9070ff", seed: 411, bloodpact: false, imageUrl: "/cards/medusas_gaze.jpg", altObjectPosition: "center", ability: "Target an enemy unit — it cannot attack for 1 turn.", effects: [{ trigger: "onPlay", effect: "freeze_target" }] },
];
// Cards locked from all gameplay until art/tuning is complete
const LOCKED_REGIONS = new Set([]);
// Cards hidden entirely — not counted, not shown, secret
const HIDDEN_REGIONS = new Set([]);
// Dev accounts (email) + named Fables testers (display name) can access locked content
const DEV_ACCOUNTS = new Set(["sncombz@gmail.com", "brebur32@gmail.com", "luisvarada@gmail.com"]);
const FABLES_NAMES = new Set(["tcombz", "ustunned", "v4varada-ttv"]);
function isFablesTester(user) {
  return user?.isFablesTesterFlag === true ||
         DEV_ACCOUNTS.has((user?.email||"").toLowerCase()) ||
         FABLES_NAMES.has((user?.name||"").toLowerCase());
}
const GAMEPLAY_POOL = POOL.filter(c => !LOCKED_REGIONS.has(c.region) && !c.isToken);
// Only base cards are given to new accounts — no locked faction cards
function getStarterCollection() { const c = {}; GAMEPLAY_POOL.forEach((x) => { c[x.id] = 3; }); return c; }
// ── Food Fight Group Synergy ────────────────────────────────────────────────
function computeGroupCounts(board) {
  const counts = { Fruit: 0, Veggie: 0, Protein: 0, Sugar: 0 };
  board.forEach(c => { const groups = c.group ? c.group.split("/") : []; groups.forEach(g => { if (g in counts) counts[g]++; }); });
  return counts;
}
function getActiveSynergies(board, jaxReduction = 0) {
  const gc = computeGroupCounts(board);
  const t = (g, n) => gc[g] >= Math.max(1, n - jaxReduction);
  return { counts: gc, fruit: { t2: t("Fruit",2), t4: t("Fruit",4), t6: t("Fruit",6) }, veggie: { t2: t("Veggie",2), t4: t("Veggie",4), t6: t("Veggie",6) }, protein: { t2: t("Protein",2), t4: t("Protein",4), t6: t("Protein",6) }, sugar: { t2: t("Sugar",2), t4: t("Sugar",4), t6: t("Sugar",6) } };
}
function spawnToken(s, tokenId, side, vfx, L) {
  const def = POOL.find(c => c.id === tokenId);
  if (!def) return s;
  const myB = side === "player" ? "playerBoard" : "enemyBoard";
  if (s[myB].length >= CFG.maxBoard) return s;
  const inst = { ...makeInst(def, side === "player" ? "pb" : "eb"), canAttack: (def.keywords||[]).includes("Swift") };
  s[myB] = [...s[myB], inst];
  if (L) L(`🍽 ${def.name} spawned!`);
  return s;
}
// Build a proper random 40-card deck from what the player owns (up to 3 copies each).
// If they don't own enough, fill with random pool cards to always hit exactly CFG.deck.size.
function buildRandomDeck(pool, col) {
  const SIZE = CFG.deck.size; // 40
  const owned = [];
  pool.forEach(c => { const q = Math.min(col?.[c.id] || 0, 3); for (let i = 0; i < q; i++) owned.push(c); });
  const shuffled = shuf(owned);
  if (shuffled.length >= SIZE) return shuffled.slice(0, SIZE);
  // Not enough owned — pad with random copies from pool to reach 40
  const pad = shuf([...pool, ...pool, ...pool]).slice(0, SIZE - shuffled.length);
  return shuf([...shuffled, ...pad]);
}
const HOME_CARDS = [POOL.find((c) => c.id === "velrun"), POOL.find((c) => c.id === "kraken"), POOL.find((c) => c.id === "colossus"), POOL.find((c) => c.id === "bloodmage"), POOL.find((c) => c.id === "weaver")].filter(Boolean);

// ═══ PACKS ═══════════════════════════════════════════════════════════════════
const PACKS = [
  { id: "anime_island",  name: "Anime Island",    desc: "5 anime alt art unlocks. 0.1% Prismatic ☀",                    cost: 300, count: 5, color: "#ff80c0", pool: "all",        guarantees: [], altPack: true },
  { id: "food_fight",    name: "Food Fight Pack", desc: "5 cards from the Food Fight faction. New keywords: Sauced.",   cost: 200, count: 5, color: "#ff5030", pool: "Food Fight", guarantees: [{ rarity: "Rare", count: 1 }] },
  { id: "fables_pack",   name: "Fables Pack",     desc: "5 cards from the Fables faction. New keywords: Gilded.",       cost: 200, count: 5, color: "#9070ff", pool: "Fables",     guarantees: [{ rarity: "Rare", count: 1 }] },
];
function rollPack(pack) {
  const pool = pack.pool === "all" ? GAMEPLAY_POOL : GAMEPLAY_POOL.filter((c) => c.region === pack.pool);
  const weights = { Common: 35, Uncommon: 35, Rare: 20, Epic: 8, Legendary: 2 };
  const totalW = 100;
  const rollOne = () => { let r = Math.random() * totalW, acc = 0; for (const [rar, w] of Object.entries(weights)) { acc += w; if (r <= acc) { const opts = pool.filter((c) => c.rarity === rar); return opts.length > 0 ? opts[Math.floor(Math.random() * opts.length)] : pool[Math.floor(Math.random() * pool.length)]; } } return pool[0]; };
  const cards = [];
  for (const g of (pack.guarantees || [])) { const rarIdx = ["Common","Uncommon","Rare","Epic","Legendary"].indexOf(g.rarity); const eligible = pool.filter((c) => ["Common","Uncommon","Rare","Epic","Legendary"].indexOf(c.rarity) >= rarIdx); for (let i = 0; i < g.count; i++) cards.push(eligible[Math.floor(Math.random() * eligible.length)] || pool[0]); }
  while (cards.length < pack.count) cards.push(rollOne());
  return cards;
}
function rollAltArtPack(pack) {
  // Rolls 5 Anime Island alt art unlocks (weighted by alt art rarity)
  const altPool = { Common:[], Uncommon:[], Rare:[], Epic:[], Legendary:[] };
  for (const [cardId, alts] of Object.entries(ALT_ARTS)) {
    for (const alt of alts) {
      if (alt.setId === "anime_island" && altPool[alt.rarity]) altPool[alt.rarity].push({ cardId, alt });
    }
  }
  const rollOne = () => {
    const r = Math.random() * 1000;
    // 0.1% Prismatic = 1 in 1000
    if (r < 1) {
      const base = POOL.find(c => c.id === "sun_strike");
      const pAlt = ALT_ARTS.sun_strike?.find(a => a.setId === "prismatic");
      if (base && pAlt) return { ...base, imageUrl: pAlt.imageUrl, altSetId: "prismatic", _altLabel: pAlt.label, rarity: "Prismatic" };
    }
    // weights: Common 350, Uncommon 349, Rare 200, Epic 80, Legendary 20 (of 999)
    const buckets = [["Legendary",20],["Epic",80],["Rare",200],["Uncommon",349],["Common",350]];
    let acc = 1; // start after prismatic range
    for (const [rar, w] of buckets) {
      acc += w; if (r < acc) {
        const opts = altPool[rar] || [];
        if (opts.length) { const { cardId, alt } = opts[Math.floor(Math.random() * opts.length)]; const base = POOL.find(c => c.id === cardId); return base ? { ...base, imageUrl: alt.imageUrl, altSetId: "anime_island", _altLabel: alt.label, rarity: base.rarity } : null; }
      }
    }
    const fallback = altPool.Common[0];
    if (fallback) { const base = POOL.find(c => c.id === fallback.cardId); return base ? { ...base, imageUrl: fallback.alt.imageUrl, altSetId: "anime_island" } : null; }
    return null;
  };
  return Array.from({ length: pack.count }, rollOne).filter(Boolean);
}

// ═══ CARD COMPONENT ══════════════════════════════════════════════════════════
function Card({ card, size = "md", onClick, animDelay = 0, isThird = false, hideCost = false, blueCost = false }) {
  const [hov, setHov] = useState(false);
  const [flip, setFlip] = useState(false);
  const W = size === "sm" ? 148 : size === "lg" ? 228 : 188;
  const H = size === "sm" ? 240 : size === "lg" ? 370 : 300;
  const artH = size === "sm" ? 90 : size === "lg" ? 140 : 116;
  const kws = KW.filter((k) => (card.keywords || []).includes(k.name));
  const isBP = card.bloodpact || card.region === "Bloodpact";
  const isEnv = card.type === "environment";
  const border = card.border || "#e8c060";
  const isPrismatic = card.rarity === "Prismatic" || card.altSetId === "prismatic";
  const isAnimeIsland = !isPrismatic && (card.altSetId === "anime_island" || (card.imageUrl && card.imageUrl.includes("anime-island")));
  const rarityGlow = isPrismatic ? "#ffffff" : (RARITY_GLOW[card.rarity] || null);
  const handleClick = () => { if (onClick) onClick(card); else { SFX.play("flip"); setFlip((f) => !f); } };
  return (
    <div style={{ perspective: 1000, width: W, flexShrink: 0, animation: animDelay ? `cardReveal 0.6s ease-out ${animDelay}s both` : (isPrismatic ? `prismPulse 3s ease-in-out infinite` : undefined), transform: hov ? "translateY(-8px) scale(1.02)" : "none", transition: "transform .2s ease, filter .2s ease", filter: hov ? `drop-shadow(0 12px 28px ${isPrismatic ? "#ffffff" : border}88)` : (isPrismatic ? undefined : rarityGlow ? `drop-shadow(0 0 7px ${rarityGlow}99)` : undefined),
      boxShadow: hov && rarityGlow ? `0 0 32px ${rarityGlow}aa, 0 0 72px ${rarityGlow}44` : undefined }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} className={`
        border-2 border-[#b8860b] rounded-lg
        ${isThird ? 'shadow-[0_0_12px_#ffd700]' : ''}
        transition-all duration-500
      `}>
      <div onClick={handleClick} style={{ width: W, transformStyle: "preserve-3d", transition: "transform .5s cubic-bezier(.4,0,.2,1)", transform: flip ? "rotateY(180deg)" : "none", cursor: "pointer" }}>
        <div style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", border: isPrismatic ? "2px solid transparent" : `2px solid ${rarityGlow || border}`, borderRadius: 14, overflow: "hidden", position: "relative", height: H, width: W, ...(isPrismatic ? { backgroundImage: "linear-gradient(#0a0806,#0a0806), linear-gradient(135deg,#ff0080,#ff8000,#ffff00,#00ff80,#0080ff,#8000ff,#ff0080)", backgroundOrigin: "border-box", backgroundClip: "padding-box, border-box", borderWidth: 3 } : {}) }}>
          {/* Full-bleed art */}
          <div style={{ position: "absolute", inset: 0 }}><CardArt card={card} /></div>
          {/* Prismatic rainbow shimmer */}
          {isPrismatic && (
            <div style={{ position:"absolute", inset:0, borderRadius:14, background:"linear-gradient(135deg,#ff008020,#ff800030,#ffff0020,#00ff8030,#0080ff20,#8000ff30,#ff008020)", backgroundSize:"400% 400%", animation:"prismShimmer 4s linear infinite", pointerEvents:"none", zIndex:3, mixBlendMode:"screen" }} />
          )}
          {/* Foil shimmer for Rare+ (non-prismatic) */}
          {!isPrismatic && ["Rare","Epic","Legendary"].includes(card.rarity) && (
            <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: `linear-gradient(105deg,transparent 20%,${RC[card.rarity]}22 40%,${RC[card.rarity]}44 50%,${RC[card.rarity]}22 60%,transparent 80%)`, backgroundSize: "400% 100%", animation: "foilShimmer 4s linear infinite", pointerEvents: "none", zIndex: 3, mixBlendMode: "screen" }} />
          )}
          {/* Bottom gradient overlay */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(4,2,0,0.97) 0%, rgba(4,2,0,0.90) 28%, rgba(4,2,0,0.55) 52%, transparent 74%)", zIndex: 1 }} />
          {/* Top row: cost badge + type tags */}
          <div style={{ position: "absolute", top: 8, left: 8, right: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start", zIndex: 4 }}>
            {!hideCost && <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: isBP ? "radial-gradient(#ff3050,#a00018)" : isEnv ? "radial-gradient(#40c0e0,#1a6888)" : isPrismatic ? "radial-gradient(#ffffff,#c0a0ff)" : "radial-gradient(#60b0ff,#1060c0)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cinzel',serif", fontWeight: 900, fontSize: 15, color: "#fff", boxShadow: isPrismatic ? "0 0 14px #ffffff88, 0 2px 6px rgba(0,0,0,0.8)" : isBP ? "0 0 10px #ff305088, 0 2px 6px rgba(0,0,0,0.8)" : isEnv ? "0 0 10px #40c0e088, 0 2px 6px rgba(0,0,0,0.8)" : "0 0 10px #60b0ff88, 0 2px 6px rgba(0,0,0,0.8)" }}>{isBP ? "B" : card.cost}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
              {isPrismatic && <div style={{ fontSize: 7, background: "linear-gradient(135deg,rgba(0,0,0,0.85),rgba(0,0,0,0.75))", color: "#ffffff", border: "1px solid rgba(255,255,255,0.6)", borderRadius: 4, padding: "2px 6px", fontFamily: "'Cinzel',serif", fontWeight: 700, backgroundImage:"linear-gradient(135deg,#ff008088,#8000ff88)", animation:"prismShimmer 4s linear infinite", backgroundSize:"400% 400%" }}>✦ PRISMATIC</div>}
              {isAnimeIsland && <div style={{ fontSize: 7, background: "rgba(0,0,0,0.8)", color: "#ff80c0", border: "1px solid #ff80c088", borderRadius: 4, padding: "2px 6px", fontFamily: "'Cinzel',serif", fontWeight: 700 }}>🌸</div>}
              {isEnv && <div style={{ fontSize: 7, background: "rgba(0,0,0,0.75)", color: "#28c0cc", border: "1px solid #28a0cc66", borderRadius: 4, padding: "2px 6px", fontFamily: "'Cinzel',serif", fontWeight: 700 }}>ENV</div>}
              {card.type === "spell" && <div style={{ fontSize: 7, background: "rgba(0,0,0,0.75)", color: "#d090d0", border: "1px solid #d090d066", borderRadius: 4, padding: "2px 6px", fontFamily: "'Cinzel',serif", fontWeight: 700 }}>SPELL</div>}
              {card.type === "champion" && <div style={{ fontSize: 7, background: "rgba(0,0,0,0.75)", color: "#e8c060", border: "1px solid #e8c06066", borderRadius: 4, padding: "2px 6px", fontFamily: "'Cinzel',serif", fontWeight: 700 }}>CHAMPION</div>}
            </div>
          </div>
          {/* Bottom text overlay */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 10px 8px", zIndex: 4 }}>
            {kws.length > 0 && (<div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 3 }}>{kws.map((k) => (<span key={k.name} style={{ fontSize: 7, padding: "1px 5px", borderRadius: 20, background: `${k.color}cc`, color: "#fff", border: `1px solid ${k.color}ee`, fontWeight: 700, textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.8)" }}>{k.icon} {k.name}</span>))}</div>)}
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: size === "sm" ? 10 : 12, fontWeight: 700, color: "#fff", lineHeight: 1.2, textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>{card.name}</div>
            <div style={{ fontSize: 8, color: border, marginTop: 1, marginBottom: 3, textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>{(card.type || "creature").charAt(0).toUpperCase() + (card.type || "").slice(1)} · <span style={{ color: REGION_COLORS[card.region] || border }}>{card.region}</span></div>
            <div style={{ fontSize: size === "sm" ? 8.5 : 9.5, color: isEnv ? "#80d0e0" : "#d8c898", lineHeight: 1.5, marginBottom: card.atk != null ? 5 : 0 }}>{card.ability}</div>
            {card.atk != null ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.55)", borderRadius: 6, padding: "3px 10px" }}>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontFamily: "'Cinzel',serif", fontWeight: 700, color: "#ff7750", lineHeight: 1 }}>{card.currentAtk != null ? card.currentAtk : card.atk}</div><div style={{ fontSize: 7, color: "#996655", letterSpacing: 1 }}>ATK</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontFamily: "'Cinzel',serif", fontWeight: 700, color: "#50c065", lineHeight: 1 }}>{card.currentHp != null ? card.currentHp : card.hp}</div><div style={{ fontSize: 7, color: "#448850", letterSpacing: 1 }}>HP</div></div>
              </div>
            ) : (
              <div style={{ textAlign: "center", fontFamily: "'Cinzel',serif", fontSize: size === "sm" ? 9 : 11, fontWeight: 700, letterSpacing: 2, color: isEnv ? "#40c0e0" : "#d090d0" }}>{isEnv ? "ENVIRONMENT" : "SPELL"}</div>
            )}
          </div>
          {/* Inner frame */}
          <div style={{ position: "absolute", inset: 4, borderRadius: 10, border: `1px solid ${border}30`, pointerEvents: "none", zIndex: 5 }} />
          {/* Champion yellow back glow */}
          {card.type === "champion" && <div style={{ position:"absolute", inset:0, borderRadius:12, boxShadow:"inset 0 0 22px rgba(240,200,30,0.18), 0 0 32px rgba(240,200,30,0.32)", pointerEvents:"none", zIndex:5 }} />}
        </div>
        {/* Back - Forge and Fable card back */}
        <div style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", position: "absolute", top: 0, left: 0, width: W, height: H, borderRadius: 14, overflow: "hidden", boxShadow: "0 0 36px #c8901066, 0 8px 32px rgba(0,0,0,0.8)" }}>
          <img src="/card-back.jpg" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      </div>
    </div>
  );
}


// ═══ ALTERNATE ART ═══════════════════════════════════════════════════════════
// To add new alt arts: add the card id as a key, list each alt art set.
// imageUrl points to /public/alt-art/<filename>.
// "owned: true" means all players get it free; otherwise requires alt-art pack pull.
const ALT_ARTS = {
  wolf:       [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Common",    imageUrl:"/alt-art/stonefang-anime-island.png", rarity:"Common" }],
  guard:      [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Common",    imageUrl:"/alt-art/guard-anime-island.png",     rarity:"Common" }],
  druid:      [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Uncommon",  imageUrl:"/alt-art/druid-anime-island.png",     rarity:"Uncommon" }],
  tangle:     [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Rare",      imageUrl:"/alt-art/tangle-anime-island.png",    rarity:"Rare" }],
  env_grove:  [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Uncommon",  imageUrl:"/alt-art/env_grove-anime-island.png", rarity:"Uncommon" }],
  wisp:       [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Uncommon",  imageUrl:"/alt-art/wisp-anime-island.png",      rarity:"Uncommon" }],
  shard:      [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Common",    imageUrl:"/alt-art/shard-anime-island.jpg",     rarity:"Common" }],
  weaver:     [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Rare",      imageUrl:"/alt-art/weaver-anime-island.png",    rarity:"Rare" }],
  velrun:     [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Legendary", imageUrl:"/alt-art/velrun-anime-island.jpg",    rarity:"Legendary", freeForOwners: true, altObjectPosition: "50% 15%" }],
  env_rift:   [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Rare",      imageUrl:"/alt-art/env_rift-anime-island.png",  rarity:"Rare" }],
  tide:       [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Rare",      imageUrl:"/alt-art/tide-anime-island.png",      rarity:"Rare" }],
  shellguard: [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Common",    imageUrl:"/alt-art/shellguard-anime-island.jpg",rarity:"Common" }],
  current:    [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Common",    imageUrl:"/alt-art/current-anime-island.png",   rarity:"Common" }],
  kraken:     [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Epic",      imageUrl:"/alt-art/kraken-anime-island.png",    rarity:"Epic" }],
  env_depths: [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Uncommon",  imageUrl:"/alt-art/env_depths-anime-island.png",rarity:"Uncommon" }],
  sprite:     [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Common",    imageUrl:"/alt-art/sprite-anime-island.png",    rarity:"Common" }],
  imp:        [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Common",    imageUrl:"/alt-art/imp-anime-island.png",       rarity:"Common" }],
  pyro:       [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Uncommon",  imageUrl:"/alt-art/pyro-anime-island.png",      rarity:"Uncommon" }],
  eruption:   [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Rare",      imageUrl:"/alt-art/eruption-anime-island.png",  rarity:"Rare" }],
  env_volcano:[{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Rare",      imageUrl:"/alt-art/env_volcano-anime-island.png",rarity:"Rare" }],
  sentinel:   [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Uncommon",  imageUrl:"/alt-art/sentinel-anime-island.jpg",  rarity:"Uncommon" }],
  forgebot:   [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Common",    imageUrl:"/alt-art/forgebot-anime-island.png",  rarity:"Common" }],
  shield_wall:[{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Common",    imageUrl:"/alt-art/shield_wall-anime-island.png",rarity:"Common" }],
  colossus:   [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Legendary", imageUrl:"/alt-art/colossus-anime-island.png",  rarity:"Legendary" }],
  falcon:     [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Common",    imageUrl:"/alt-art/falcon-anime-island.png",    rarity:"Common" }],
  oracle:     [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Uncommon",  imageUrl:"/alt-art/oracle-anime-island.jpg",    rarity:"Uncommon" }],
  sun_strike: [
    { setId:"anime_island", setName:"Anime Island", label:"Anime Island · Rare",      imageUrl:"/alt-art/sun_strike-anime-island.jpg",  rarity:"Rare" },
    { setId:"prismatic",    setName:"Prismatic",    label:"☀ Prismatic Sun Strike ✦", imageUrl:"/alt-art/sun_strike2-anime-island.jpg", rarity:"Prismatic" },
  ],
  env_dunes:  [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Uncommon",  imageUrl:"/alt-art/env_dunes-anime-island.png", rarity:"Uncommon" }],
  siphon:     [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Rare",      imageUrl:"/alt-art/siphon-anime-island.jpg",    rarity:"Rare" }],
  martyr:     [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Uncommon",  imageUrl:"/alt-art/martyr-anime-island.png",    rarity:"Uncommon" }],
  bloodmage:  [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Epic",      imageUrl:"/alt-art/bloodmage-anime-island.png", rarity:"Epic" }],
  blood_pact: [{ setId:"anime_island", setName:"Anime Island", label:"Anime Island · Uncommon",  imageUrl:"/alt-art/blood_pact-anime-island.png",rarity:"Uncommon" }],
};

/** Returns the card with the correct imageUrl applied based on selectedArts map */
function resolveCardArt(card, selectedArts) {
  const base = POOL.find(x => x.id === card.id) || card;
  const merged = card.imageUrl ? card : { ...card, imageUrl: base.imageUrl, imageScale: base.imageScale, altObjectPosition: base.altObjectPosition };
  const altSetId = selectedArts && selectedArts[card.id];
  if (!altSetId) return merged;
  const alts = ALT_ARTS[card.id] || [];
  const alt = alts.find((a) => a.setId === altSetId);
  return alt ? { ...merged, imageUrl: alt.imageUrl, ...(alt.altObjectPosition ? { altObjectPosition: alt.altObjectPosition } : {}) } : merged;
}

// ═══ TOKEN + HAND CARD ═══════════════════════════════════════════════════════
function Token({ c, selected, isTarget, canSelect, onClick, onRightClick, animType }) {
  const [hov, setHov] = useState(false);
  const pct = c.currentHp / c.maxHp;
  const opac = (c.hasAttacked && !isTarget) ? 0.45 : 1;
  const kws = KW.filter((k) => (c.keywords || []).includes(k.name));
  return (
    <div className="token" onClick={onClick} onContextMenu={(e) => { e.preventDefault(); if (onRightClick) onRightClick(); }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ width: 125, height: 172, cursor: (canSelect || isTarget) ? "pointer" : "default", userSelect: "none", border: `2px solid ${selected ? "#f0d840" : animType==="hit" ? "#ff3030" : (animType==="attacking"||animType==="attacking-down") ? "#ff8030" : isTarget && hov ? "#e84040" : hov && canSelect ? c.border + "aa" : c.border + "55"}`, borderRadius: 10, overflow: "hidden", opacity: animType==="dying" ? 1 : opac, boxShadow: animType==="hit" ? "0 0 28px #ff303088, 0 0 60px #ff202044" : (animType==="attacking"||animType==="attacking-down") ? `0 0 28px ${c.border}aa, 0 0 50px ${c.border}55` : selected ? `0 0 22px #f0d84066` : hov ? `0 6px 18px ${c.border}44` : "none", transform: animType ? "none" : selected ? "translateY(-8px)" : hov ? "translateY(-4px)" : "none", animation: animType === "attacking" ? "cardLunge 0.45s cubic-bezier(0.25,0.46,0.45,0.94)" : animType === "attacking-down" ? "cardLungeDown 0.45s cubic-bezier(0.25,0.46,0.45,0.94)" : animType === "hit" ? "cardHit 0.5s ease-out" : animType === "dying" ? "cardDie 0.6s ease-out forwards" : animType === "summoning" ? (c.rarity==="Prismatic"?"prismaticPop 0.7s ease-out, cardSummon 0.5s ease-out":"cardSummon 0.5s ease-out") : "none", transition: animType ? "none" : "all .18s", position: "relative" }}>
      {/* Full art */}
      <div style={{ position: "absolute", inset: 0 }}><CardArt card={c} /></div>
      {/* Bottom gradient */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(4,2,0,0.96) 0%, rgba(4,2,0,0.75) 28%, rgba(4,2,0,0.25) 50%, transparent 68%)", zIndex: 1 }} />
      {/* Bottom text */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 6px 4px", zIndex: 3 }}>
        {c.bleed > 0 && <div style={{ fontSize: 7, color: "#ff6060", fontWeight: 700, marginBottom: 1 }}>🩸 BLEED {c.bleed}</div>}
        {c.frozen && <div style={{ fontSize: 7, color: "#80c0ff", fontWeight: 700, marginBottom: 1 }}>❄ FROZEN</div>}
        {c.buffNote && <div style={{ fontSize: 7, color: "#60e880", fontWeight: 700, marginBottom: 1 }}>⬆ {c.buffNote}</div>}
        {c.debuffNote && <div style={{ fontSize: 7, color: "#ff6060", fontWeight: 700, marginBottom: 1 }}>⬇ {c.debuffNote}</div>}
        {c.synTag && <div style={{ fontSize: 7, color: "#e8c8ff", fontWeight: 700, marginBottom: 2, background: "rgba(80,0,120,0.82)", border: "1px solid #c080ff88", borderRadius: 4, padding: "1px 4px", display: "inline-block", textShadow: "0 1px 3px rgba(0,0,0,0.9)", letterSpacing: 0.3 }}>✦ {c.synTag}</div>}
        {(kws.length > 0 || c.shielded) && <div style={{ display: "flex", gap: 2, flexWrap: "wrap", marginBottom: 2 }}>{kws.filter(k => k.name !== "Shield").map((k) => (<span key={k.name} style={{ fontSize: 6, padding: "1px 3px", borderRadius: 6, background: `${k.color}cc`, color: "#fff", border: `1px solid ${k.color}ee`, fontWeight: 700, textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.8)" }}>{k.icon}{k.name}</span>))}{c.shielded && <span style={{ fontSize: 6, padding: "1px 3px", borderRadius: 6, background: "rgba(40,100,200,0.85)", color: "#fff", border: "1px solid #60a0ffcc", fontWeight: 700 }}>♦ SHIELD</span>}</div>}
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, color: "#fff", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 0 6px #000, 0 1px 4px #000, -1px 0 3px #000, 1px 0 3px #000" }}>{c.name}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
          <span style={{ fontSize: 19, fontFamily: "'Cinzel',serif", fontWeight: 700, color: "#ff7050", textShadow: "0 0 8px #000, 0 1px 4px #000, -1px 0 3px #000, 1px 0 3px #000" }}>{c.currentAtk}</span>
          <span style={{ fontSize: 19, fontFamily: "'Cinzel',serif", fontWeight: 700, color: pct < 0.4 ? "#e04040" : "#50c060", textShadow: "0 0 8px #000, 0 1px 4px #000, -1px 0 3px #000, 1px 0 3px #000" }}>{c.currentHp}</span>
        </div>
      </div>
      {/* HP bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "#080604", zIndex: 4 }}><div style={{ height: "100%", width: `${Math.max(0, pct) * 100}%`, background: pct < 0.4 ? "#d84040" : "#48a028", transition: "width .3s" }} /></div>
      {/* Shield glow overlay */}
      {c.shielded && <div style={{ position:"absolute", inset:0, borderRadius:8, border:"2px solid #60a0ffcc", pointerEvents:"none", zIndex:6, animation:"shieldPulse 2s ease-in-out infinite" }} />}
      {/* Champion yellow back glow */}
      {c.type === "champion" && <div style={{ position:"absolute", inset:0, borderRadius:8, boxShadow:"inset 0 0 18px rgba(240,200,30,0.22), 0 0 28px rgba(240,200,30,0.28)", pointerEvents:"none", zIndex:5 }} />}
      {/* Anchor indicator */}
      {(c.anchored || (c.keywords||[]).includes("Anchor")) && <div style={{ position:"absolute", top:4, right:4, fontSize:9, background:"rgba(0,0,0,0.75)", borderRadius:4, padding:"1px 4px", zIndex:7, color:"#80b0e0" }}>⚓</div>}
    </div>
  );
}
function HandCard({ card, playable, onClick, onRightClick, onDragStart }) {
  const [hov, setHov] = useState(false);
  const [dragging, setDragging] = useState(false);
  const isBP = card.bloodpact; const isEnv = card.type === "environment";
  const hasShield = (card.keywords || []).includes("Shield") || card.shielded;
  const kws = KW.filter(k => (card.keywords || []).includes(k.name));
  return (
    <div
      style={{ position: "relative", zIndex: hov && playable ? 20 : undefined }}
      onMouseEnter={() => { if (!dragging) { setHov(true); if (playable) SFX.play("card_hover"); } }}
      onMouseLeave={() => setHov(false)}
      draggable={playable && !!onDragStart}
      onDragStart={playable && onDragStart ? (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.dataTransfer.setDragImage(e.currentTarget, e.clientX - rect.left, e.clientY - rect.top);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", card.uid);
        setDragging(true); setHov(false); onDragStart(card);
      } : undefined}
      onDragEnd={() => setDragging(false)}
    >
      <div onClick={playable ? onClick : undefined} onContextMenu={onRightClick ? (e) => { e.preventDefault(); onRightClick(); } : undefined} style={{ width: 100, height: 140, flexShrink: 0, cursor: playable ? (onDragStart ? "grab" : "pointer") : "not-allowed", opacity: playable ? (dragging ? 0.45 : 1) : 0.35, border: `2px solid ${isBP ? "#a81830" : hov && playable ? card.border : "#201c10"}`, borderRadius: 10, overflow: "hidden", transform: hov && playable && !dragging ? "scale(1.12)" : "none", transformOrigin: "50% 100%", boxShadow: hov && playable && !dragging ? `0 8px 28px ${card.border}88, 0 0 40px ${card.border}44` : "none", transition: "all .2s", userSelect: "none", position: "relative" }}>
        {/* Full art */}
        <div style={{ position: "absolute", inset: 0 }}><CardArt card={card} /></div>
        {/* Bottom gradient */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(4,2,0,0.95) 0%, rgba(4,2,0,0.65) 35%, transparent 62%)" }} />
        {/* Cost badge top-left */}
        <div style={{ position: "absolute", top: 4, left: 4, zIndex: 3, width: isBP||isEnv ? 26 : 22, height: isBP||isEnv ? 26 : 28, borderRadius: isBP||isEnv ? "50%" : "50% 50% 45% 45% / 40% 40% 60% 60%", background: isBP ? "radial-gradient(#ff3050,#a00018)" : isEnv ? "radial-gradient(#40c0e0,#1a6888)" : "linear-gradient(160deg,#90e0ff 0%,#2090d0 40%,#0a60a0 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cinzel',serif", fontWeight: 900, fontSize: 12, color: "#fff", boxShadow: isBP ? "0 0 7px #ff305088,0 1px 4px rgba(0,0,0,0.8)" : isEnv ? "0 0 7px #40c0e088,0 1px 4px rgba(0,0,0,0.8)" : "0 0 10px #2090ff88, 0 1px 4px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.4)" }}>{isBP ? "B" : card.cost}</div>
        {/* Type tag top-right */}
        {(card.type === "spell" || card.type === "environment" || card.type === "champion") && (
          <div style={{ position: "absolute", top: 4, right: 4, zIndex: 3, fontSize: 6, background: "rgba(0,0,0,0.75)", color: isEnv ? "#28c0cc" : card.type === "champion" ? "#e8c060" : "#d090d0", border: `1px solid ${isEnv?"#28a0cc":card.type==="champion"?"#e8c060":"#d090d0"}55`, borderRadius: 3, padding: "1px 4px", fontFamily: "'Cinzel',serif", fontWeight: 700 }}>{isEnv ? "ENV" : card.type === "champion" ? "CHP" : "SPL"}</div>
        )}
        {/* Bottom: name + stats */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 5px 4px", zIndex: 3 }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, color: "#fff", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 0 6px #000, 0 1px 4px #000, -1px 0 2px #000, 1px 0 2px #000", lineHeight: 1.2 }}>{card.name}</div>
          {card.atk != null ? (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
              <span style={{ fontSize: 14, fontFamily: "'Cinzel',serif", fontWeight: 700, color: "#ff7050", textShadow: "0 0 6px #000, 0 1px 4px #000" }}>{card.currentAtk ?? card.atk}</span>
              <span style={{ fontSize: 14, fontFamily: "'Cinzel',serif", fontWeight: 700, color: "#50c060", textShadow: "0 0 6px #000, 0 1px 4px #000" }}>{card.currentHp ?? card.hp}</span>
            </div>
          ) : (
            <div style={{ fontSize: 7, color: isEnv ? "#40c0e0" : "#d090d0", fontFamily: "'Cinzel',serif", marginTop: 2 }}>{isEnv ? "ENV" : "SPELL"}</div>
          )}
        </div>
      {/* Shield glow on HandCard */}
      {hasShield && <div style={{ position:"absolute", inset:0, borderRadius:10, border:"2px solid #60a0ffcc", pointerEvents:"none", zIndex:6, animation:"shieldPulse 2s ease-in-out infinite" }} />}
      </div>
      {/* Hover tooltip with full card info */}
      {hov && !dragging && (
        <div style={{ position: "fixed", top: "auto", bottom: "auto", left: "auto", width: 240, background: "linear-gradient(160deg,#1e1c10,#12100a)", border: `2px solid ${card.border}88`, borderRadius: 12, padding: 14, zIndex: 9999, boxShadow: `0 16px 40px rgba(0,0,0,0.95), 0 0 30px ${card.border}33`, pointerEvents: "none" }}
          ref={el => { if (el) { const rect = el.parentElement?.getBoundingClientRect?.() || {}; const w = el.offsetWidth || 240; const h = el.offsetHeight || 280; const vw = window.innerWidth; const vh = window.innerHeight; el.style.left = Math.max(8, Math.min(vw - w - 8, (rect.left||0) + (rect.width||0)/2 - w/2)) + "px"; const spaceAbove = (rect.top||0) - 12; if (spaceAbove >= h) { el.style.top = "auto"; el.style.bottom = (vh - (rect.top||0) + 12) + "px"; } else { el.style.top = ((rect.bottom||0) + 12) + "px"; el.style.bottom = "auto"; } } }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, fontWeight: 700, color: "#f0e0c8", marginBottom: 5 }}>{card.name}</div>
          <div style={{ fontSize: 11, color: card.border, marginBottom: 6, fontFamily: "'Cinzel',serif" }}>{(card.type || "creature").charAt(0).toUpperCase() + (card.type || "").slice(1)} · <span style={{ color: REGION_COLORS[card.region] || card.border }}>{card.region}</span></div>
          <div style={{ fontSize: 12, color: "#d0c098", lineHeight: 1.65, marginBottom: 6 }}>{card.ability}</div>
          {card.atk != null && <div style={{ fontSize: 12, color: "#a09060", marginBottom: 3 }}>ATK <span style={{ color: "#ff7050", fontWeight: 700 }}>{card.atk}</span> · HP <span style={{ color: "#50c060", fontWeight: 700 }}>{card.hp}</span></div>}
          <div style={{ fontSize: 10, fontStyle: "italic", color: "#706040", marginTop: 4, lineHeight:1.5 }}>"{card.flavor}"</div>
          {kws.length > 0 && (
            <div style={{ marginTop: 6, borderTop: "1px solid #2a2010", paddingTop: 5, display: "flex", flexDirection: "column", gap: 3 }}>
              {kws.map(k => (
                <div key={k.name} style={{ fontSize: 10, lineHeight: 1.4 }}>
                  <span style={{ color: k.color, fontWeight: 700 }}>{k.icon} {k.name}:</span>
                  <span style={{ color: "#907858" }}> {k.desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══ TURN TIMER ══════════════════════════════════════════════════════════════
function TurnTimer({ active, duration = CFG.turnTimer, onExpire, turnNum, children }) {
  const [time, setTime] = useState(duration);
  const [warned, setWarned] = useState(false);
  useEffect(() => { setTime(duration); setWarned(false); }, [active, duration]);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setTime((t) => {
        if (t <= 1) { clearInterval(id); onExpire(); return 0; }
        if (t === 11 && !warned) { SFX.play("timer_warn"); setWarned(true); }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active, warned, onExpire]);
  const elapsed = duration - time;
  const pct = elapsed / duration; // grows 0→1 as time runs out
  const urgent = time <= 10;
  const col = urgent ? "#e04040" : time <= 20 ? "#e08830" : "#e8c060";
  const blinkStyle = urgent ? { animation: "timerBlink 0.6s ease-in-out infinite alternate" } : {};
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}>
      {/* Left bar — fills left→right */}
      <div style={{ flex:1, height:4, background:"#1a1408", borderRadius:2, overflow:"hidden", border:"1px solid #2a1a08" }}>
        <div style={{ height:"100%", width:`${pct*100}%`, background:col, transition:"width 1s linear, background 0.5s", boxShadow:urgent?`0 0 8px ${col}`:"none", ...blinkStyle }} />
      </div>
      {/* Center: turn label + time */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:1, flexShrink:0 }}>
        {children || <span style={{ fontFamily:"'Cinzel',serif", fontSize:9, letterSpacing:3, color:urgent?col:"#241a08", ...blinkStyle }}>TURN {turnNum}</span>}
        <span style={{ fontFamily:"'Cinzel',serif", fontSize:13, fontWeight:900, color:col, letterSpacing:1, lineHeight:1, ...blinkStyle, textShadow:urgent?`0 0 10px ${col}`:"none" }}>{time}s</span>
      </div>
      {/* Right bar — mirror, also fills left→right */}
      <div style={{ flex:1, height:4, background:"#1a1408", borderRadius:2, overflow:"hidden", border:"1px solid #2a1a08" }}>
        <div style={{ height:"100%", width:`${pct*100}%`, background:col, transition:"width 1s linear, background 0.5s", boxShadow:urgent?`0 0 8px ${col}`:"none", ...blinkStyle }} />
      </div>
    </div>
  );
}
// inject timerBlink keyframe once
if (typeof document !== "undefined" && !document.getElementById("timerBlinkStyle")) {
  const s = document.createElement("style"); s.id = "timerBlinkStyle";
  s.textContent = "@keyframes timerBlink { 0%{opacity:1} 100%{opacity:0.25} }";
  document.head.appendChild(s);
}

// ═══ GAME ENGINE ═════════════════════════════════════════════════════════════
// Returns effective cost of a card accounting for active environment cost reductions
function getEffectiveCost(card, env, side = null) {
  if (!env || card.type === "environment") return card.cost;
  if (side && env.owner && env.owner !== side) return card.cost;
  const envEffects = (env.effects && env.effects.length > 0) ? env.effects : ((GAMEPLAY_POOL.find(c => c.id === env.id) || env).effects || []);
  const reduction = envEffects.filter(e => e.effect === "cost_reduction").reduce((n,e) => n+(e.amount||0), 0);
  return Math.max(1, card.cost - reduction);
}
function makeInst(c, p = "p") { const pool = POOL.find(x => x.id === c.id) || c; const kw = pool.keywords || c.keywords || []; return { ...c, imageUrl: pool.imageUrl || c.imageUrl, imageScale: pool.imageScale || c.imageScale, altObjectPosition: pool.altObjectPosition || c.altObjectPosition, uid: uid(p + c.id), currentHp: c.hp, maxHp: c.hp, currentAtk: c.atk, canAttack: false, hasAttacked: false, bleed: 0, echoQueued: false, keywords: kw, shielded: kw.includes("Shield") }; }
const TARGETED_SPELL_EFFECTS = ["bolt_damage", "anchor_target", "freeze_target"];

function resolveEffects(trigger, card, state, side, vfx, opts = {}) {
  const effects = (card.effects || []).filter((e) => e.trigger === trigger); let s = { ...state };
  const L = (m) => { s.log = [...(s.log || []).slice(-20), m]; };
  const myB = side === "player" ? "playerBoard" : "enemyBoard", thB = side === "player" ? "enemyBoard" : "playerBoard";
  const myHP = side === "player" ? "playerHP" : "enemyHP", thHP = side === "player" ? "enemyHP" : "playerHP";
  // Auto-fire Splat on death
  if (trigger === "onDeath" && (card.keywords || []).includes("Splat")) {
    const splatThB = side === "player" ? "enemyBoard" : "playerBoard";
    const splatThHP = side === "player" ? "enemyHP" : "playerHP";
    const jaxRed = s[side === "player" ? "playerBoard" : "enemyBoard"].some(c => c.id === "master_jax") ? 1 : 0;
    const syn = getActiveSynergies(s[side === "player" ? "playerBoard" : "enemyBoard"], jaxRed);
    const splatDmg = syn.protein.t4 ? 2 : 1;
    const splatTargets = s[splatThB].filter(c => c.currentHp > 0);
    if (splatTargets.length > 0) {
      const st = splatTargets[Math.floor(Math.random() * splatTargets.length)];
      s[splatThB] = s[splatThB].map(c => c.uid === st.uid ? { ...c, currentHp: c.currentHp - splatDmg } : c).filter(c => c.currentHp > 0);
      L(`💥 Splat! ${card.name} deals ${splatDmg} to ${st.name}!`);
    } else {
      s[splatThHP] -= splatDmg;
      L(`💥 Splat! ${card.name} deals ${splatDmg} to hero!`);
    }
  }
  for (const fx of effects) {
    switch (fx.effect) {
      case "heal_hero": s[myHP] = Math.min(CFG.startHP, s[myHP] + fx.amount); L(`${card.name} heals ${fx.amount}!`); if (vfx) { vfx.add("heal", { amount: fx.amount, side }); if (card.type === "environment") vfx.add("floatText", { text: `+${fx.amount} HP`, sub: card.name, color: "#40ff70", duration: 1600, zone: side }); } break;
      case "damage_enemy_hero": s[thHP] -= fx.amount; L(`${card.name} deals ${fx.amount} to hero!`); if (vfx) { vfx.add("damage", { amount: fx.amount }); if (card.type === "environment") vfx.add("floatText", { text: `-${fx.amount} HP`, sub: card.name, color: "#ff5040", duration: 1600, zone: side==="player"?"enemy":"player" }); } break;
      case "damage_own_hero": s[myHP] -= fx.amount; L(`${card.name} costs ${fx.amount} HP!`); break;
      case "damage_all_enemies": s[thB] = s[thB].map((c) => { if (c.shielded) { L(`${card.name} blocked by ${c.name}'s shield!`); return { ...c, shielded: false }; } return { ...c, currentHp: c.currentHp - fx.amount }; }).filter((c) => c.currentHp > 0); L(`${card.name}: ${fx.amount} to all enemies!`); if (vfx) vfx.add("ability", { color: "#ff4040" }); break;
      case "damage_all": s[myB] = s[myB].map((c) => c.uid === card.uid ? c : { ...c, currentHp: c.currentHp - fx.amount }).filter((c) => c.currentHp > 0); s[thB] = s[thB].map((c) => { if (c.shielded) { return { ...c, shielded: false }; } return { ...c, currentHp: c.currentHp - fx.amount }; }).filter((c) => c.currentHp > 0); L(`${card.name}: ${fx.amount} to ALL!`); if (vfx) vfx.add("ability", { color: "#ff8040" }); break;
      case "damage_random_enemy": if (s[thB].length > 0) { const idx = Math.floor(Math.random() * s[thB].length); const tgt = s[thB][idx]; if (tgt.shielded) { s[thB] = s[thB].map((c,i) => i === idx ? { ...c, shielded: false } : c); L(`${card.name} blocked by ${tgt.name}'s shield! Shield broken.`); } else { s[thB] = s[thB].map((c, i) => i === idx ? { ...c, currentHp: c.currentHp - fx.amount } : c).filter((c) => c.currentHp > 0); L(`${card.name} hits ${tgt.name} for ${fx.amount}!`); } } break;
      case "buff_allies": { const isDebuff = (fx.atk||0) < 0 || (fx.hp||0) < 0; const noteStr = `${isDebuff?"":"+"}${fx.atk||0}atk/${fx.hp||0}hp (${card.name})`; s[myB] = s[myB].map((c) => ({ ...c, currentAtk: c.currentAtk + (fx.atk || 0), currentHp: c.currentHp + (fx.hp || 0), maxHp: c.maxHp + (fx.hp || 0), [isDebuff?"debuffNote":"buffNote"]: noteStr, statusLog: [...(c.statusLog||[]), { type:isDebuff?"debuff":"buff", note:noteStr }] })); L(`${card.name} ${isDebuff?"debuffs":"buffs"} ${fx.atk||0}/${fx.hp||0}!`); if (vfx) { if (card.type==="environment") vfx.add("floatText", { text:`${isDebuff?"":"+"}${fx.atk||0} ATK`, sub: card.name, color: isDebuff?"#ff6040":"#60e880", zone: side, duration:1600 }); else vfx.add("ability", { color: isDebuff?"#ff6040":"#40ff60" }); } break; }
      case "buff_random_ally": { const allies = s[myB].filter((c) => c.id !== card.id); if (allies.length > 0) { const t = allies[Math.floor(Math.random() * allies.length)]; const bNote = `+${fx.atk||0}atk (${card.name})`; s[myB] = s[myB].map((c) => c.uid === t.uid ? { ...c, currentAtk: c.currentAtk + (fx.atk || 0), buffNote: bNote, statusLog: [...(c.statusLog||[]), { type:"buff", note:bNote }] } : c); L(`${card.name} buffs ${t.name}!`); } break; }
      case "buff_keyword_allies": { const kbNote = `+${fx.atk||0}atk keyword (${card.name})`; s[myB] = s[myB].map((c) => (c.keywords || []).length > 0 ? { ...c, currentAtk: c.currentAtk + (fx.atk || 0), buffNote: kbNote, statusLog: [...(c.statusLog||[]), { type:"buff", note:kbNote }] } : c); break; }
      case "heal_all_allies": {
        s[myB] = s[myB].map((c) => {
          const healed = Math.min(c.maxHp, c.currentHp + fx.amount) - c.currentHp;
          return { ...c, currentHp: c.currentHp + healed, ...(healed > 0 ? { buffNote: `+${healed} HP (${card.name})` } : {}) };
        });
        if (s[myB].length > 0) L(`${card.name} heals allies +${fx.amount} HP!`);
        if (vfx && s[myB].length > 0) {
          vfx.add("heal", { amount: fx.amount });
          if (card.type === "environment") vfx.add("floatText", { text: `+${fx.amount} HP`, sub: card.name, color: "#40ff70", duration: 1600, zone: side });
        }
        break;
      }
      case "self_buff": { const sbNote = `+${fx.atk||0}atk self`; s[myB] = s[myB].map((c) => c.uid === card.uid ? { ...c, currentAtk: c.currentAtk + (fx.atk || 0), buffNote: sbNote, statusLog: [...(c.statusLog||[]), { type:"buff", note:sbNote }] } : c); break; }
      case "draw": { const dk = side === "player" ? "playerDeck" : "enemyDeck", hd = side === "player" ? "playerHand" : "enemyHand"; for (let i = 0; i < fx.amount; i++) { if (s[dk].length > 0 && s[hd].length < CFG.maxHand) { s[hd] = [...s[hd], makeInst(s[dk][0], side === "player" ? "p" : "e")]; s[dk] = s[dk].slice(1); } } L(`${card.name}: Draw ${fx.amount}!`); break; }
      case "bleed_all_enemies": s[thB] = s[thB].map((c) => ({ ...c, bleed: (c.bleed || 0) + fx.amount })); L(`${card.name}: ${fx.amount} Bleed to all!`); break;
      // ── Fables mechanics ──────────────────────────────────────────────────
      case "zeus_onplay_damage": {
        // Zeus on play: 2 dmg to a random unit on field, or enemy hero if board empty
        const thBZ = side === "player" ? "enemyBoard" : "playerBoard";
        const thHPZ = side === "player" ? "enemyHP" : "playerHP";
        if (s[thBZ].length > 0) {
          const idx = Math.floor(Math.random() * s[thBZ].length);
          const tgt = s[thBZ][idx];
          if (tgt.shielded) {
            s[thBZ] = s[thBZ].map((c, i) => i === idx ? { ...c, shielded: false } : c);
            L(`⚡ Zeus blocked by ${tgt.name}'s shield! Shield broken.`);
          } else {
            s[thBZ] = s[thBZ].map((c, i) => i === idx ? { ...c, currentHp: c.currentHp - 2 } : c).filter(c => c.currentHp > 0);
            L(`⚡ Zeus strikes ${tgt.name} for 2!`);
          }
        } else {
          s[thHPZ] -= 2;
          L(`⚡ Zeus strikes enemy hero for 2!`);
        }
        SFX.play("lightning_strike");
        if (vfx) { vfx.add("floatText", { text: "⚡ ZEUS!", color: "#ffe040", duration: 1400, zone: side === "player" ? "enemy" : "player" }); }
        break;
      }
      case "bolt_damage": {
        // Deal 3 damage; if it kills a unit, +1 to lightning meter
        const mKey = side === "player" ? "playerLightningMeter" : "enemyLightningMeter";
        if (s[thB].length > 0) {
          const rawIdx = opts.targetUid ? s[thB].findIndex(c => c.uid === opts.targetUid) : -1;
          const idx = rawIdx >= 0 ? rawIdx : Math.floor(Math.random() * s[thB].length);
          const btgt = s[thB][idx];
          if (btgt.shielded) {
            s[thB] = s[thB].map((c, i) => i === idx ? { ...c, shielded: false } : c);
            L(`${card.name} blocked by ${btgt.name}'s shield! Shield broken.`);
          } else {
            const nHp = btgt.currentHp - fx.amount;
            s[thB] = s[thB].map((c, i) => i === idx ? { ...c, currentHp: nHp } : c).filter(c => c.currentHp > 0);
            L(`${card.name} deals ${fx.amount} to ${btgt.name}!`);
            if (nHp <= 0) {
              s[mKey] = Math.min(2, (s[mKey] || 0) + 1);
              L(`⚡ Lightning Meter +1 (kill bonus)!`);
              if (s[mKey] >= 2) s = fireLightningMeter(s, side, vfx, L);
            }
          }
        } else {
          s[thHP] -= fx.amount;
          L(`${card.name} deals ${fx.amount} to enemy hero!`);
        }
        if (vfx) vfx.add("ability", { color: "#f0d020" });
        break;
      }
      case "soul_harvest": {
        // Hades: +1 maxHp AND currentHp on friendly unit death (cap 10) — works from hand OR board
        const myH = side === "player" ? "playerHand" : "enemyHand";
        const hadesOnBoard = s[myB].find(c => c.id === "hades_soul_reaper");
        const hadesInHand = s[myH].find(c => c.id === "hades_soul_reaper");
        const hadesUnit = hadesOnBoard || hadesInHand;
        if (hadesUnit && hadesUnit.maxHp < 10) {
          const newMax = Math.min(10, hadesUnit.maxHp + 1);
          const applyHarvest = c => c.id === "hades_soul_reaper"
            ? { ...c, maxHp: newMax, currentHp: Math.min(newMax, c.currentHp + 1), buffNote: `Soul Harvest ${newMax}/10` }
            : c;
          if (hadesOnBoard) s[myB] = s[myB].map(applyHarvest);
          else s[myH] = s[myH].map(applyHarvest);
          L(`💀 Hades Soul Harvest: +1 HP! (${newMax}/10 max)`);
          if (vfx) vfx.add("ability", { color: "#7030c0" });
        }
        break;
      }
      case "soul_reap": {
        // Hades end of turn: 1 dmg to all enemies (units + hero); shield absorbs and breaks
        const hadesActive = s[myB].some(c => c.id === "hades_soul_reaper");
        if (hadesActive) {
          s[thB] = s[thB].map(c => c.shielded ? { ...c, shielded: false } : { ...c, currentHp: c.currentHp - 1 }).filter(c => c.currentHp > 0);
          s[thHP] -= 1;
          L(`💀 Hades: 1 dmg to all enemies!`);
          if (vfx) vfx.add("ability", { color: "#7030c0" });
        }
        break;
      }
      case "shield_all_allies": {
        s[myB] = s[myB].map(c => ({ ...c, shielded: true }));
        L(`${card.name}: all allies gain Shield!`);
        if (vfx) vfx.add("ability", { color: "#60a0ff" });
        break;
      }
      case "pandora_draw": {
        const myHasShield = s[myB].some(c => c.shielded || (c.keywords||[]).includes("Shield"));
        const dk = side === "player" ? "playerDeck" : "enemyDeck";
        const hd = side === "player" ? "playerHand" : "enemyHand";
        const thDk = side === "player" ? "enemyDeck" : "playerDeck";
        const thHd = side === "player" ? "enemyHand" : "playerHand";
        if (s[dk].length > 0 && s[hd].length < CFG.maxHand) { s[hd] = [...s[hd], makeInst(s[dk][0], side === "player" ? "p" : "e")]; s[dk] = s[dk].slice(1); }
        if (!myHasShield && s[thDk].length > 0 && s[thHd].length < CFG.maxHand) { s[thHd] = [...s[thHd], makeInst(s[thDk][0], side === "player" ? "e" : "p")]; s[thDk] = s[thDk].slice(1); }
        L(`${card.name}: ${myHasShield ? "only you draw!" : "both players draw!"}`);
        break;
      }
      case "anchor_target":
      case "freeze_target": {
        if (s[thB].length > 0) {
          const rawIdx = opts.targetUid ? s[thB].findIndex(c => c.uid === opts.targetUid) : -1;
          const idx = rawIdx >= 0 ? rawIdx : Math.floor(Math.random() * s[thB].length);
          const frozen = s[thB][idx];
          s[thB] = s[thB].map((c, i) => i === idx ? { ...c, frozen: true, canAttack: false, hasAttacked: true } : c);
          L(`${card.name}: ${frozen.name} is frozen — cannot attack this turn!`);
          if (vfx) vfx.add("ability", { color: "#80c0ff" });
        }
        break;
      }
      case "spawn_token": {
        const ingredientTypes = ["fruit_ingredient","protein_ingredient","veggie_ingredient","sugar_ingredient"];
        const tokenId = fx.tokenId === "random_ingredient" ? ingredientTypes[Math.floor(Math.random() * ingredientTypes.length)] : fx.tokenId;
        s = spawnToken(s, tokenId, side, vfx, L);
        break;
      }
      case "consume_ingredients": {
        const ingredIds = ["fruit_ingredient","protein_ingredient","veggie_ingredient","sugar_ingredient"];
        const consumed = s[myB].filter(c => ingredIds.includes(c.id));
        if (consumed.length > 0) {
          s[myB] = s[myB].filter(c => !ingredIds.includes(c.id));
          // Board card has a new uid from makeInst — find last matching card.id (just appended)
          let buffed = false;
          s[myB] = [...s[myB]].reverse().map(c => {
            if (!buffed && c.id === card.id) { buffed = true; return { ...c, currentAtk: c.currentAtk + consumed.length, currentHp: c.currentHp + consumed.length, maxHp: c.maxHp + consumed.length, synTag: `🍽 +${consumed.length}/+${consumed.length}` }; }
            return c;
          }).reverse();
          L(`🍽 Leftover Titan consumes ${consumed.length} ingredient(s)! +${consumed.length}/+${consumed.length}!`);
          if (vfx) vfx.add("ability", { color: "#ff8040" });
        }
        break;
      }
      case "food_nado_damage": {
        if (s[thB].length > 0) {
          // Deal fx.amount to ALL enemy units
          const dying = [];
          s[thB] = s[thB].map(c => {
            if (c.shielded) { L(`Food-nado blocked by ${c.name}'s shield!`); return { ...c, shielded: false }; }
            const hp = c.currentHp - fx.amount;
            if (hp <= 0) dying.push(c);
            return { ...c, currentHp: hp };
          }).filter(c => c.currentHp > 0);
          dying.forEach(c => { s = resolveEffects("onDeath", c, s, side === "player" ? "enemy" : "player", vfx); });
          L(`🌪 Food-nado deals ${fx.amount} to all enemies! (${dying.length} slain)`);
        } else {
          s[thHP] -= fx.amount;
          L(`🌪 Food-nado deals ${fx.amount} to enemy hero!`);
        }
        s = spawnToken(s, "fruit_ingredient", side, vfx, L);
        if (vfx) vfx.add("ability", { color: "#ff8040" });
        break;
      }
      case "bean_barrage_buff": {
        if (s[myB].length > 0) {
          const bbIdx = Math.floor(Math.random() * s[myB].length);
          s[myB] = s[myB].map((c,i) => i === bbIdx ? { ...c, currentAtk: c.currentAtk + 1, currentHp: c.currentHp + 1, maxHp: c.maxHp + 1, bleed: (c.bleed||0) + 2, buffNote: "+1/+1 Bleed" } : c);
          L(`Bean Barrage: ${s[myB][bbIdx]?.name || "ally"} gains +1/+1 and Bleed!`);
        }
        break;
      }
    }
  }
  return s;
}

// Helper: fire lightning meter at 4 — 2 dmg to random enemy unit or hero
function fireLightningMeter(s, side, vfx, L) {
  const thB = side === "player" ? "enemyBoard" : "playerBoard";
  const thHP = side === "player" ? "enemyHP" : "playerHP";
  const meterKey = side === "player" ? "playerLightningMeter" : "enemyLightningMeter";
  if ((s[meterKey] || 0) < 2) return s;
  const aliveTargets = s[thB].filter(c => c.currentHp > 0);
  const heroName = side === "player" ? (s.enemyName || "Enemy") : (s.playerName || "You");
  if (aliveTargets.length > 0) {
    const ltgt = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
    if (ltgt.shielded) {
      s[thB] = s[thB].map(c => c.uid === ltgt.uid ? { ...c, shielded: false } : c);
      if (L) L(`⚡ LIGHTNING blocked by ${ltgt.name}'s shield! Shield broken.`);
    } else {
      s[thB] = s[thB].map(c => c.uid === ltgt.uid ? { ...c, currentHp: c.currentHp - 2 } : c).filter(c => c.currentHp > 0);
      if (L) L(`⚡ LIGHTNING STRIKES ${ltgt.name} for 2!`);
    }
  } else {
    s[thHP] -= 2;
    if (L) L(`⚡ LIGHTNING strikes ${heroName} for 2!`);
  }
  s[meterKey] = 0;
  SFX.play("lightning_strike");
  if (vfx) {
    vfx.add("damage", { amount: 2, duration: 800 });
    vfx.add("ability", { color: "#f0e000", duration: 1200 });
    vfx.add("floatText", { text: "⚡ ZEUS STRIKES!", color: "#ffe040", duration: 1600, zone: side === "player" ? "enemy" : "player" });
    vfx.add("creatureDie", { color: "#f0d000", duration: 900 });
  }
  return s;
}

// ═══ ENEMY AI ════════════════════════════════════════════════════════════════
// Phase 1: draw + play cards only (no attacks, no end-of-turn)
function computeEnemyPlayPhase(g, vfx) {
  let s = { ...g, playerBoard: g.playerBoard.map((c) => ({ ...c })), enemyBoard: g.enemyBoard.map((c) => ({ ...c })), playerHand: [...g.playerHand], enemyHand: [...g.enemyHand], enemyDeck: [...g.enemyDeck], playerDeck: [...g.playerDeck], log: [...g.log] };
  const L = (m) => { s.log = [...s.log.slice(-20), m]; };
  // Fire enemy env effect at start of enemy turn, decrement
  if (s.environment?.owner === "enemy") { s = resolveEffects("onTurnStart", s.environment, s, "enemy", vfx); const rem = (s.environment.turnsRemaining||2) - 1; if (rem <= 0) { s.environment = null; L("Environment fades."); } else { s.environment = { ...s.environment, turnsRemaining: rem }; } }
  if (s.enemyDeck.length > 0 && s.enemyHand.length < 6) { s.enemyHand = [...s.enemyHand, makeInst(s.enemyDeck[0], "e")]; s.enemyDeck = s.enemyDeck.slice(1); L("Enemy draws."); }
  let en = s.maxEnergy;
  [...s.enemyHand].sort((a, b) => b.cost - a.cost).forEach((card) => {
    if (card.type === "environment") { if (!card.bloodpact && card.cost <= en) { en -= card.cost; s.environment = { ...card, owner: "enemy", turnsRemaining: 2 }; s.enemyHand = s.enemyHand.filter((c) => c.uid !== card.uid); L(`Enemy: ${card.name}! (2 rounds)`); s = resolveEffects("onPlay", card, s, "enemy", vfx); } return; }
    if (card.type === "spell") { if (card.bloodpact ? card.cost < s.enemyHP : card.cost <= en) { if (card.bloodpact) s.enemyHP -= card.cost; else en -= card.cost; s.enemyHand = s.enemyHand.filter((c) => c.uid !== card.uid); L(`Enemy casts ${card.name}!`); s = resolveEffects("onPlay", card, s, "enemy", vfx); } return; }
    if (s.enemyBoard.length >= CFG.maxBoard) return;
    const ec = card.bloodpact ? 0 : card.cost; if (ec > en) return;
    const resBonus = (card.keywords||[]).includes("Resonate") ? s.playerBoard.length : 0;
    const inst = { ...makeInst(card, "eb"), canAttack: (card.keywords || []).includes("Swift"), currentAtk: card.atk + resBonus };
    if (card.bloodpact) { s.enemyHP -= card.cost; L(`Enemy blood-plays ${card.name}!`); } else { en -= ec; L(`Enemy plays ${card.name}!`); }
    s.enemyBoard = [...s.enemyBoard, inst]; s.enemyHand = s.enemyHand.filter((c) => c.uid !== card.uid);
    if ((card.keywords || []).includes("Fracture") && s.enemyBoard.length < CFG.maxBoard) s.enemyBoard = [...s.enemyBoard, { ...inst, uid: uid("ef"), shielded: false, currentHp: Math.ceil(card.hp / 2), maxHp: Math.ceil(card.hp / 2), currentAtk: Math.ceil(card.atk / 2), name: card.name + " Frag", keywords: [], effects: [] }];
    s = resolveEffects("onPlay", card, s, "enemy", vfx);
  });
  return s;
}
// Phase 2: attacks + end-of-turn (bleed, levelup, echo, draw)
function computeEnemyAttackPhase(g, vfx) {
  let s = { ...g, playerBoard: g.playerBoard.map((c) => ({ ...c })), enemyBoard: g.enemyBoard.map((c) => ({ ...c })), playerHand: [...g.playerHand], enemyHand: [...g.enemyHand], playerDeck: [...g.playerDeck], log: [...g.log] };
  const L = (m) => { s.log = [...s.log.slice(-20), m]; };
  s.enemyBoard.filter((c) => c.canAttack && !c.hasAttacked).forEach((att) => {
    if (s.playerHP <= 0) return;
    const av = att.currentAtk;
    if (s.playerBoard.length > 0) { const tgt = [...s.playerBoard].sort((a, b) => a.currentHp - b.currentHp)[0]; let nTHP = tgt.shielded ? tgt.currentHp : tgt.currentHp - av; let nAHP = att.shielded ? att.currentHp : att.currentHp - tgt.currentAtk; if (tgt.shielded) L(`${tgt.name} shield absorbs!`); if (att.shielded) L(`${att.name} shield absorbs counter!`); s.enemyBoard = s.enemyBoard.map((c) => c.uid === att.uid ? { ...c, hasAttacked: true, currentHp: nAHP, shielded: false } : c).filter((c) => c.currentHp > 0); s.playerBoard = s.playerBoard.map((c) => c.uid === tgt.uid ? { ...c, currentHp: nTHP, shielded: false, bleed: (c.bleed || 0) + ((att.keywords || []).includes("Bleed") ? (att.bleedAmount || 1) : 0) } : c).filter((c) => c.currentHp > 0); if (nTHP <= 0) { L(`${tgt.name} falls!`); s = resolveEffects("onDeath", tgt, s, "player", vfx); if (s.playerBoard.find(c => c.id === "hades_soul_reaper") || s.playerHand.find(c => c.id === "hades_soul_reaper")) { s = resolveEffects("onFriendlyDeath", {id:"hades_soul_reaper",effects:[{trigger:"onFriendlyDeath",effect:"soul_harvest"}]}, s, "player", vfx); } } if (nAHP <= 0) s = resolveEffects("onDeath", att, s, "enemy", vfx);
    } else { s.playerHP -= av; s.enemyBoard = s.enemyBoard.map((c) => c.uid === att.uid ? { ...c, hasAttacked: true } : c); L(`${att.name} hits you for ${av}!`); if (s.enemyZeusInPlay && (att.keywords || []).includes("Swift")) { s.enemyLightningMeter = (s.enemyLightningMeter || 0) + 1; if (s.enemyLightningMeter >= 2) { s = fireLightningMeter(s, "enemy", vfx, L); } } s = resolveEffects("onAttack", att, s, "enemy", vfx); }
  });
  if (s.playerHP <= 0) return { ...s, phase: "gameover", winner: "enemy", log: [...s.log, "Defeated..."] };
  const newTurn = g.turn + 1, newMax = Math.min(CFG.maxEnergy, newTurn);
  // End of enemy turn: fire + clear bleed on player board only
  { s.playerBoard = s.playerBoard.map(c => c.bleed>0?{...c,currentHp:c.currentHp-c.bleed,bleed:0}:c).filter(c=>c.currentHp>0); }
  s.playerBoard.forEach((c) => { if (c.effects && c.effects.length) s = resolveEffects("onTurnStart", c, s, "player", vfx); });
  // Fire player-owned env at start of player's turn
  if (s.environment?.owner === "player") s = resolveEffects("onTurnStart", s.environment, s, "player", vfx);
  s.playerBoard = s.playerBoard.map((c) => ({ ...c, canAttack: true, hasAttacked: false }));
  // Food Fight synergy: start-of-turn effects
  { const jaxRed = s.playerBoard.some(c => c.id === "master_jax") ? 1 : 0; const syn = getActiveSynergies(s.playerBoard, jaxRed);
    const addTag = (c, t) => ({ ...c, synTag: c.synTag ? c.synTag + " · " + t : t });
    s.playerBoard = s.playerBoard.map(c => ({ ...c, synTag: null }));
    if (syn.fruit.t2) { s.playerBoard = s.playerBoard.map(c => c.id === "berry_tooty" ? addTag({ ...c, currentHp: Math.min(c.maxHp, c.currentHp + 1) }, "🍎+HP") : c); }
    if (syn.fruit.t4) { s.playerBoard = s.playerBoard.map(c => c.id === "berry_tooty" ? addTag({ ...c, currentAtk: c.currentAtk + 1 }, "🍎+ATK") : c); s.log = [...s.log, "🍎 Fruit T4: Berry & Tooty +1 ATK!"]; }
    if (syn.fruit.t6) { s.playerBoard = s.playerBoard.map(c => (c.group||"").includes("Fruit") && !(c.keywords||[]).includes("Swift") ? addTag({ ...c, keywords: [...(c.keywords||[]), "Swift"], canAttack: true }, "🍎Swift") : c); s.log = [...s.log, "🍎 Fruit T6: Fruit units gain Swift!"]; }
    if (syn.veggie.t2) { s.playerBoard = s.playerBoard.map(c => (c.group||"").includes("Veggie") ? addTag({ ...c, currentAtk: c.currentAtk + 1, currentHp: c.currentHp + 1, maxHp: c.maxHp + 1 }, "🥦+1/+1") : c); s.log = [...s.log, "🥦 Veggie T2: Veggie units +1/+1!"]; }
    if (syn.veggie.t4) { s.playerBoard = s.playerBoard.map(c => (c.keywords||[]).includes("Anchor") ? c : addTag({ ...c, keywords: [...(c.keywords||[]), "Anchor"] }, "🥦Anchor")); }
    if (syn.veggie.t6) { s.enemyBoard = s.enemyBoard.map(c => ({ ...c, bleed: (c.bleed||0) + 1 })); s.log = [...s.log, "🥦 Veggie T6: All enemies gain Bleed!"]; }
    if (syn.protein.t2) { s.playerBoard = s.playerBoard.map(c => (c.group||"").includes("Protein") ? addTag({ ...c, currentAtk: c.currentAtk + 1 }, "🍖+ATK") : c); s.log = [...s.log, "🍖 Protein T2: Protein units +1 ATK!"]; }
    if (syn.protein.t6) { s.playerBoard = s.playerBoard.map(c => (c.group||"").includes("Protein") && !(c.keywords||[]).includes("Bleed") ? addTag({ ...c, keywords: [...(c.keywords||[]), "Bleed"] }, "🍖Bleed") : c); s.log = [...s.log, "🍖 Protein T6: Protein units gain Bleed!"]; }
    if (syn.sugar.t4) { s.playerBoard = s.playerBoard.map(c => (c.group||"").includes("Sugar") ? addTag({ ...c, currentAtk: c.currentAtk + 2 }, "🍬+2ATK") : c); s.log = [...s.log, "🍬 Sugar T4: Sugar units +2 ATK!"]; }
    if (syn.sugar.t6) { s.playerBoard = s.playerBoard.map(c => addTag({ ...c, currentAtk: c.currentAtk + 3, currentHp: c.currentHp - 1 }, "🍬Crash")).filter(c => c.currentHp > 0); s.log = [...s.log, "🍬 Sugar Crash: +3 ATK, -1 HP to all!"]; }
    s.firstCardPlayedThisTurn = false; s.spellsPlayedThisTurn = 0;
  }
  s.enemyBoard = s.enemyBoard.map((c) => ({ ...c, canAttack: true, hasAttacked: false }));
  if (s.playerDeck.length > 0 && s.playerHand.length < CFG.maxHand) { s.playerHand = [...s.playerHand, makeInst(s.playerDeck[0], "p")]; s.playerDeck = s.playerDeck.slice(1); }
  if (s.enemyHP <= 0) return { ...s, phase: "gameover", winner: "player", log: [...s.log, "Victory!"] };
  L(`Turn ${newTurn}`);
  return { ...s, turn: newTurn, phase: "player", playerEnergy: newMax, maxEnergy: newMax };
}
function computeEnemyTurn(g, vfx) {
  let s = { ...g, playerBoard: g.playerBoard.map((c) => ({ ...c })), enemyBoard: g.enemyBoard.map((c) => ({ ...c })), playerHand: [...g.playerHand], enemyHand: [...g.enemyHand], enemyDeck: [...g.enemyDeck], playerDeck: [...g.playerDeck], log: [...g.log] };
  const L = (m) => { s.log = [...s.log.slice(-20), m]; };
  if (s.environment?.owner === "enemy") { s = resolveEffects("onTurnStart", s.environment, s, "enemy", vfx); const rem = (s.environment.turnsRemaining||2) - 1; if (rem <= 0) { s.environment = null; L("Environment fades."); } else { s.environment = { ...s.environment, turnsRemaining: rem }; } }
  if (s.enemyDeck.length > 0 && s.enemyHand.length < 6) { s.enemyHand = [...s.enemyHand, makeInst(s.enemyDeck[0], "e")]; s.enemyDeck = s.enemyDeck.slice(1); L("Enemy draws."); }
  let en = s.maxEnergy;
  [...s.enemyHand].sort((a, b) => b.cost - a.cost).forEach((card) => {
    if (card.type === "environment") { if (!card.bloodpact && card.cost <= en) { en -= card.cost; s.environment = { ...card, owner: "enemy", turnsRemaining: 2 }; s.enemyHand = s.enemyHand.filter((c) => c.uid !== card.uid); L(`Enemy: ${card.name}! (2 rounds)`); s = resolveEffects("onPlay", card, s, "enemy", vfx); } return; }
    if (card.type === "spell") { if (card.bloodpact ? card.cost < s.enemyHP : card.cost <= en) { if (card.bloodpact) s.enemyHP -= card.cost; else en -= card.cost; s.enemyHand = s.enemyHand.filter((c) => c.uid !== card.uid); L(`Enemy casts ${card.name}!`); s = resolveEffects("onPlay", card, s, "enemy", vfx); } return; }
    if (s.enemyBoard.length >= CFG.maxBoard) return;
    const ec = card.bloodpact ? 0 : card.cost; if (ec > en) return;
    const resBonus = (card.keywords||[]).includes("Resonate") ? s.playerBoard.length : 0;
    const inst = { ...makeInst(card, "eb"), canAttack: (card.keywords || []).includes("Swift"), currentAtk: card.atk + resBonus };
    if (card.bloodpact) { s.enemyHP -= card.cost; L(`Enemy blood-plays ${card.name}!`); } else { en -= ec; L(`Enemy plays ${card.name}!`); }
    s.enemyBoard = [...s.enemyBoard, inst]; s.enemyHand = s.enemyHand.filter((c) => c.uid !== card.uid);
    if ((card.keywords || []).includes("Fracture") && s.enemyBoard.length < CFG.maxBoard) s.enemyBoard = [...s.enemyBoard, { ...inst, uid: uid("ef"), shielded: false, currentHp: Math.ceil(card.hp / 2), maxHp: Math.ceil(card.hp / 2), currentAtk: Math.ceil(card.atk / 2), name: card.name + " Frag", keywords: [], effects: [] }];
    s = resolveEffects("onPlay", card, s, "enemy", vfx);
  });
  s.enemyBoard.filter((c) => c.canAttack && !c.hasAttacked).forEach((att) => {
    if (s.playerHP <= 0) return;
    const av = att.currentAtk;
    if (s.playerBoard.length > 0) { const tgt = [...s.playerBoard].sort((a, b) => a.currentHp - b.currentHp)[0]; let nTHP = tgt.shielded ? tgt.currentHp : tgt.currentHp - av; let nAHP = att.shielded ? att.currentHp : att.currentHp - tgt.currentAtk; if (att.shielded) L(`${att.name} shield absorbs counter!`); s.enemyBoard = s.enemyBoard.map((c) => c.uid === att.uid ? { ...c, hasAttacked: true, currentHp: nAHP, shielded: false } : c).filter((c) => c.currentHp > 0); s.playerBoard = s.playerBoard.map((c) => c.uid === tgt.uid ? { ...c, currentHp: nTHP, shielded: false, bleed: (c.bleed || 0) + ((att.keywords || []).includes("Bleed") ? (att.bleedAmount || 1) : 0) } : c).filter((c) => c.currentHp > 0); if (nTHP <= 0) { L(`${tgt.name} falls!`); s = resolveEffects("onDeath", tgt, s, "player", vfx); } if (nAHP <= 0) s = resolveEffects("onDeath", att, s, "enemy", vfx);
    } else { s.playerHP -= av; s.enemyBoard = s.enemyBoard.map((c) => c.uid === att.uid ? { ...c, hasAttacked: true } : c); L(`${att.name} hits you for ${av}!`); if (s.enemyZeusInPlay && (att.keywords || []).includes("Swift")) { s.enemyLightningMeter = (s.enemyLightningMeter || 0) + 1; if (s.enemyLightningMeter >= 2) { s = fireLightningMeter(s, "enemy", vfx, L); } } s = resolveEffects("onAttack", att, s, "enemy", vfx); }
  });
  if (s.playerHP <= 0) return { ...s, phase: "gameover", winner: "enemy", log: [...s.log, "Defeated..."] };
  const newTurn = g.turn + 1, newMax = Math.min(CFG.maxEnergy, newTurn);
  // End of enemy turn: fire + clear bleed on player board only
  { s.playerBoard = s.playerBoard.map(c => c.bleed>0?{...c,currentHp:c.currentHp-c.bleed,bleed:0}:c).filter(c=>c.currentHp>0); }
  s.playerBoard.forEach((c) => { if (c.effects && c.effects.length) s = resolveEffects("onTurnStart", c, s, "player", vfx); });
  // Fire player-owned env at start of player's turn (transition from enemy turn back to player)
  if (s.environment?.owner === "player") s = resolveEffects("onTurnStart", s.environment, s, "player", vfx);
  s.playerBoard = s.playerBoard.map((c) => ({ ...c, canAttack: true, hasAttacked: false }));
  // Food Fight synergy: start-of-turn effects
  { const jaxRed = s.playerBoard.some(c => c.id === "master_jax") ? 1 : 0; const syn = getActiveSynergies(s.playerBoard, jaxRed);
    const addTag = (c, t) => ({ ...c, synTag: c.synTag ? c.synTag + " · " + t : t });
    s.playerBoard = s.playerBoard.map(c => ({ ...c, synTag: null }));
    if (syn.fruit.t2) { s.playerBoard = s.playerBoard.map(c => c.id === "berry_tooty" ? addTag({ ...c, currentHp: Math.min(c.maxHp, c.currentHp + 1) }, "🍎+HP") : c); }
    if (syn.fruit.t4) { s.playerBoard = s.playerBoard.map(c => c.id === "berry_tooty" ? addTag({ ...c, currentAtk: c.currentAtk + 1 }, "🍎+ATK") : c); }
    if (syn.fruit.t6) { s.playerBoard = s.playerBoard.map(c => (c.group||"").includes("Fruit") && !(c.keywords||[]).includes("Swift") ? addTag({ ...c, keywords: [...(c.keywords||[]), "Swift"], canAttack: true }, "🍎Swift") : c); }
    if (syn.veggie.t2) { s.playerBoard = s.playerBoard.map(c => (c.group||"").includes("Veggie") ? addTag({ ...c, currentAtk: c.currentAtk + 1, currentHp: c.currentHp + 1, maxHp: c.maxHp + 1 }, "🥦+1/+1") : c); }
    if (syn.veggie.t4) { s.playerBoard = s.playerBoard.map(c => (c.keywords||[]).includes("Anchor") ? c : addTag({ ...c, keywords: [...(c.keywords||[]), "Anchor"] }, "🥦Anchor")); }
    if (syn.veggie.t6) { s.enemyBoard = s.enemyBoard.map(c => ({ ...c, bleed: (c.bleed||0) + 1 })); }
    if (syn.protein.t2) { s.playerBoard = s.playerBoard.map(c => (c.group||"").includes("Protein") ? addTag({ ...c, currentAtk: c.currentAtk + 1 }, "🍖+ATK") : c); }
    if (syn.protein.t6) { s.playerBoard = s.playerBoard.map(c => (c.group||"").includes("Protein") && !(c.keywords||[]).includes("Bleed") ? addTag({ ...c, keywords: [...(c.keywords||[]), "Bleed"] }, "🍖Bleed") : c); }
    if (syn.sugar.t4) { s.playerBoard = s.playerBoard.map(c => (c.group||"").includes("Sugar") ? addTag({ ...c, currentAtk: c.currentAtk + 2 }, "🍬+2ATK") : c); }
    if (syn.sugar.t6) { s.playerBoard = s.playerBoard.map(c => addTag({ ...c, currentAtk: c.currentAtk + 3, currentHp: c.currentHp - 1 }, "🍬Crash")).filter(c => c.currentHp > 0); s.log = [...s.log, "🍬 Sugar Crash: +3 ATK, -1 HP to all!"]; }
    s.firstCardPlayedThisTurn = false; s.spellsPlayedThisTurn = 0;
  }
  s.enemyBoard = s.enemyBoard.map((c) => ({ ...c, canAttack: true, hasAttacked: false }));
  if (s.playerDeck.length > 0 && s.playerHand.length < CFG.maxHand) { s.playerHand = [...s.playerHand, makeInst(s.playerDeck[0], "p")]; s.playerDeck = s.playerDeck.slice(1); }
  if (s.enemyHP <= 0) return { ...s, phase: "gameover", winner: "player", log: [...s.log, "Victory!"] };
  L(`Turn ${newTurn}`);
  return { ...s, turn: newTurn, phase: "player", playerEnergy: newMax, maxEnergy: newMax };
}

// ═══ OPENING DRAW ════════════════════════════════════════════════════════════
function OpeningDraw({ onResult }) {
  const [phase, setPhase] = useState("waiting"); // waiting | flipping | result
  const [winner, setWinner] = useState(null);
  const flip = () => {
    setPhase("flipping");
    SFX.play("pack_open");
    const w = Math.random() >= 0.5 ? "player" : "enemy";
    setTimeout(() => {
      setWinner(w);
      setPhase("result");
      SFX.play(w === "player" ? "ability" : "defeat");
      setTimeout(() => onResult(w), 2200);
    }, 1500);
  };
  return (
    <div style={{ position:"absolute", inset:0, zIndex:30, background:"rgba(6,4,2,0.96)", backdropFilter:"blur(10px)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:24, borderRadius:14 }}>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:14, color:"#c89030", letterSpacing:5, animation:"fadeIn 0.6s ease-out" }}>COIN FLIP</div>
      <p style={{ fontSize:12, color:"#806040", margin:0, textAlign:"center" }}>Who goes first? Fate decides.</p>
      {/* Coin */}
      <div style={{ position:"relative", width:120, height:120 }}>
        <div style={{ width:120, height:120, borderRadius:"50%",
          background: phase==="result" ? (winner==="player" ? "radial-gradient(circle at 35% 35%,#ffe060,#c89010,#7a5000)" : "radial-gradient(circle at 35% 35%,#d0d0d0,#808080,#404040)") : "radial-gradient(circle at 35% 35%,#ffe060,#c89010,#7a5000)",
          boxShadow: phase==="result" ? (winner==="player" ? "0 0 40px #f0c04088,0 8px 24px rgba(0,0,0,0.8)" : "0 0 20px #80808044,0 8px 24px rgba(0,0,0,0.8)") : "0 0 24px #c8901044,0 8px 24px rgba(0,0,0,0.8)",
          animation: phase==="flipping" ? "coinSpin 1.5s ease-out forwards" : phase==="result" ? "pulse 2s infinite" : "none",
          display:"flex", alignItems:"center", justifyContent:"center",
          border: phase==="result" && winner==="player" ? "3px solid #ffe06088" : "3px solid #c8901044",
          fontSize:44, userSelect:"none" }}>
          {phase==="result" ? (winner==="player" ? "⚔" : "🛡") : "⚔"}
        </div>
        {phase==="flipping" && <div style={{ position:"absolute", inset:-16, borderRadius:"50%", border:"2px solid #e8c06033", animation:"vfxRingBurst 1.5s ease-out forwards" }} />}
      </div>
      {phase==="waiting" && <button onClick={flip} style={{ padding:"14px 40px", background:"linear-gradient(135deg,#c89010,#f0c040)", border:"none", borderRadius:9, fontFamily:"'Cinzel',serif", fontSize:14, fontWeight:700, letterSpacing:3, color:"#1a1000", cursor:"pointer", animation:"pulse 2s ease-in-out infinite", boxShadow:"0 4px 20px rgba(200,144,0,0.4)" }}>FLIP THE COIN</button>}
      {phase==="flipping" && <div style={{ fontFamily:"'Cinzel',serif", fontSize:12, color:"#806040", animation:"pulse 0.4s infinite", letterSpacing:3 }}>DECIDING FATE…</div>}
      {phase==="result" && winner && (
        <div style={{ textAlign:"center", animation:"cardReveal 0.5s ease-out" }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:900, color:winner==="player"?"#f0c040":"#e05050", textShadow:`0 0 30px ${winner==="player"?"#f0c04088":"#e0505088"}`, letterSpacing:2 }}>{winner==="player"?"YOU GO FIRST!":"ENEMY GOES FIRST!"}</div>
          <div style={{ fontSize:11, color:"#806040", marginTop:8 }}>Battle begins…</div>
        </div>
      )}
    </div>
  );
}

// ═══ BATTLE SCREEN ═══════════════════════════════════════════════════════════
function logColor(line) {
  const l = line.toLowerCase();
  if (/victory|you win/.test(l)) return "#78cc45";
  if (/defeated|defeat/.test(l)) return "#e05050";
  if (/💀|destroyed!|falls[.]| dies|death/.test(l)) return "#d05050";
  if (/attacks|deals.*direct|strike/.test(l)) return "#ff8040";
  if (/cast |casts |play |plays |enters/.test(l)) return "#e8c060";
  if (/heal|shield absorbs/.test(l)) return "#50c090";
  if (/your turn ends|turn ends/.test(l)) return "#8080a0";
  if (/enemy goes first|you go first|draw/.test(l)) return "#80c0e0";
  if (/bleed|pay.*hp|bloodpact/.test(l)) return "#d04868";
  if (/reshapes|environment/.test(l)) return "#40c0c0";
  if (/fragment/.test(l)) return "#c090ff";
  return "#c0aa78";
}
function logIcon(line) {
  const l = line.toLowerCase();
  if (/victory|you win/.test(l)) return "\u2728 ";
  if (/defeated/.test(l)) return "\u{1F480} ";
  if (/destroyed|falls[.]/.test(l)) return "\u2620 ";
  if (/attacks|deals.*direct/.test(l)) return "\u2694 ";
  if (/cast |casts /.test(l)) return "\u2736 ";
  if (/play |plays |enters/.test(l)) return "\u25B6 ";
  if (/heal|shield absorbs/.test(l)) return "\uD83D\uDC9A ";
  if (/bleed/.test(l)) return "\uD83E\uDE78 ";
  if (/reshapes/.test(l)) return "\uD83C\uDF3F ";
  return "\u00B7 ";
}
// ═══ BATTLE CHAT (GIF) ════════════════════════════════════════════════════════
const GIPHY_KEY = "6HnQE0960QsP5zT7DWHbow94frssuHfS";
const AI_REACTIONS = ["nice","reaction","wow","gaming","card game","epic","gg","celebrate"];
function BattleChat({ user, aiMode, matchId }) {
  const [messages, setMessages] = useState([{ from: "System", text: "Battle chat active. Search GIFs to react!", id: 0 }]);
  const [gifQuery, setGifQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showGifPanel, setShowGifPanel] = useState(false);
  const msgRef = useRef(null);
  const chatBottomRef = useRef(null);
  const chatChRef = useRef(null);
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  // PvP broadcast channel for cross-player GIF chat
  useEffect(() => {
    if (aiMode || !matchId) return;
    chatChRef.current = supabase.channel("bchat_" + matchId)
      .on("broadcast", { event: "gif" }, ({ payload }) => {
        if (payload.from !== user?.id) {
          setMessages(m => [...m, { from: payload.name || "Opponent", gif: payload.url, id: Date.now() }]);
        }
      }).subscribe();
    return () => { if (chatChRef.current) { supabase.removeChannel(chatChRef.current); chatChRef.current = null; } };
  }, [matchId]); // eslint-disable-line
  const searchGifs = async () => {
    if (!gifQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(gifQuery)}&limit=12&rating=g`);
      const data = await res.json();
      setGifs(data.data || []);
    } catch (_) { setGifs([]); }
    setSearching(false);
  };
  const sendGif = (gif) => {
    const url = gif?.images?.fixed_height_small?.url || gif?.images?.downsized?.url;
    if (!url) return;
    setMessages(m => [...m, { from: user?.name || "You", gif: url, id: Date.now() }]);
    setShowGifPanel(false); setGifQuery(""); setGifs([]);
    if (!aiMode && chatChRef.current) {
      chatChRef.current.send({ type: "broadcast", event: "gif", payload: { from: user?.id, name: user?.name || "You", url } });
    }
    if (aiMode) {
      setTimeout(async () => {
        const rq = AI_REACTIONS[Math.floor(Math.random() * AI_REACTIONS.length)];
        try {
          const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(rq)}&limit=10&rating=g`);
          const data = await res.json();
          const picks = data.data || [];
          if (picks.length > 0) {
            const pick = picks[Math.floor(Math.random() * picks.length)];
            const aUrl = pick?.images?.fixed_height_small?.url || pick?.images?.downsized?.url;
            if (aUrl) setMessages(m => [...m, { from: "AI", gif: aUrl, id: Date.now() + 1 }]);
          }
        } catch (_) {}
      }, 1200 + Math.random() * 1800);
    }
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"#080604", border:"1px solid #1e1a0e", borderRadius:12, overflow:"hidden" }}>
      <div style={{ padding:"8px 12px", borderBottom:"1px solid #1e1808", flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#c09048", letterSpacing:2, fontWeight:700 }}>CHAT</span>
        <button onClick={()=>setShowGifPanel(v=>!v)} style={{ padding:"4px 10px", background:showGifPanel?"linear-gradient(135deg,#c89010,#f0c040)":"rgba(232,192,96,0.1)", border:"1px solid #3a2c10", borderRadius:6, fontSize:10, cursor:"pointer", color:showGifPanel?"#1a1000":"#a09060", fontFamily:"'Cinzel',serif", fontWeight:600 }}>GIF</button>
      </div>
      {showGifPanel && (
        <div style={{ padding:"8px 10px", borderBottom:"1px solid #1e1808", flexShrink:0, background:"#0a0806" }}>
          <div style={{ display:"flex", gap:6, marginBottom:6 }}>
            <input value={gifQuery} onChange={e=>setGifQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchGifs()} placeholder="Search GIFs..." style={{ flex:1, padding:"5px 8px", background:"#100e08", border:"1px solid #2a2010", borderRadius:6, color:"#f0e8d8", fontSize:11, outline:"none" }} />
            <button onClick={searchGifs} disabled={searching} style={{ padding:"5px 10px", background:"linear-gradient(135deg,#c89010,#f0c040)", border:"none", borderRadius:6, fontSize:10, cursor:"pointer", color:"#1a1000", fontWeight:700 }}>{searching?"...":"GO"}</button>
          </div>
          {gifs.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:4, maxHeight:140, overflowY:"auto" }}>
              {gifs.map((g,i) => {
                const url = g?.images?.fixed_height_small?.url;
                return url ? (<img key={i} src={url} alt="" onClick={()=>sendGif(g)} style={{ width:"100%", height:60, objectFit:"cover", borderRadius:4, cursor:"pointer", border:"1px solid #2a2010" }} />) : null;
              })}
            </div>
          )}
        </div>
      )}
      <div ref={msgRef} style={{ flex:1, overflowY:"auto", padding:"8px 10px", display:"flex", flexDirection:"column", gap:6 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ display:"flex", flexDirection:"column", alignItems:m.from==="You"||m.from===user?.name?"flex-end":"flex-start" }}>
            <div style={{ fontSize:8, color: m.from==="AI"?"#c04040":m.from==="System"?"#806040":"#4a9020", fontFamily:"'Cinzel',serif", marginBottom:2, letterSpacing:1 }}>{m.from}</div>
            {m.gif ? (<img src={m.gif} alt="" style={{ maxWidth:120, borderRadius:6, border:`1px solid ${m.from==="AI"?"#3a1010":"#1a3a10"}` }} />) : (<div style={{ background:m.from==="System"?"rgba(100,80,20,0.15)":m.from==="AI"?"rgba(80,20,20,0.3)":"rgba(20,60,10,0.3)", border:`1px solid ${m.from==="AI"?"#3a1010":m.from==="System"?"#3a3010":"#1a3a10"}`, borderRadius:8, padding:"5px 9px", fontSize:10, color:"#c0a870", maxWidth:180, lineHeight:1.5 }}>{m.text}</div>)}
          </div>
        ))}
        <div ref={chatBottomRef} />
      </div>
    </div>
  );
}

function BattleScreen({ user, onUpdateUser, matchConfig, onExit }) {
  const isDevAccount = isFablesTester(user);
  const ACTIVE_POOL = GAMEPLAY_POOL;
  const initGame = () => {
    const resolveFromPool = (c) => { const fresh = ACTIVE_POOL.find(p => p.id === c.id); return fresh ? { ...c, atk: fresh.atk, hp: fresh.hp, keywords: fresh.keywords, effects: fresh.effects, ability: fresh.ability } : c; };
    const playerCards = matchConfig?.playerDeck?.length > 0 ? [...matchConfig.playerDeck] : buildRandomDeck(ACTIVE_POOL, user?.collection);
    const pd = shuf(playerCards.slice(0, CFG.deck.size).map(resolveFromPool));
    const ed = shuf(buildRandomDeck(GAMEPLAY_POOL, getStarterCollection()));
    const playerZeusInPlay = pd.some(c => c.id === "zeus_storm_father");
    const enemyZeusInPlay = ed.some(c => c.id === "zeus_storm_father");
    return { matchId: uid("m"), turn: 1, phase: "opening", winner: null, playerHP: CFG.startHP, playerEnergy: CFG.startEnergy, maxEnergy: CFG.startEnergy, playerHand: pd.slice(0, CFG.startHand).map((c) => makeInst(c, "p")), playerDeck: pd.slice(CFG.startHand), playerBoard: [], enemyHP: CFG.startHP, enemyHand: ed.slice(0, CFG.startHand).map((c) => makeInst(c, "e")), enemyDeck: ed.slice(CFG.startHand), enemyBoard: [], environment: null, envLastTurn: null, mapTheme: "default", log: ["Draw for priority!"], playerLightningMeter: 0, enemyLightningMeter: 0, firstCardPlayedThisTurn: false, spellsPlayedThisTurn: 0, playerZeusInPlay, enemyZeusInPlay, playerName: user?.name || "You", enemyName: "Enemy" };
  };
  const [game, setGame] = useState(initGame);
  const [animUids, setAnimUids] = useState({});
  const [attacker, setAttacker] = useState(null);
  const [targetingSpell, setTargetingSpell] = useState(null);
  const [aiThink, setAiThink] = useState(false);
  const [previewCard, setPreviewCard] = useState(null);
  const [timerKey, setTimerKey] = useState(0);
  const [dragOverField, setDragOverField] = useState(false);
  const dragCardRef = useRef(null);
  const cardsPlayedRef = useRef(0);
  const wonSavedRef = useRef(false);
  const [matchResult, setMatchResult] = useState(null);
  const [expandedSynGroup, setExpandedSynGroup] = useState(null);
  const [turnBanner, setTurnBanner] = useState(null); // "YOUR TURN" | "ENEMY TURN"
  const logRef = useRef(null);
  const [liveAction, setLiveAction] = useState(null);
  const vfx = useVFX();
  // Start battle music when component mounts, home music on unmount
  useEffect(() => { MusicCtx.play("battle"); return () => MusicCtx.play("home"); }, []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTo({ top: 99999, behavior: "smooth" }); }, [game?.log]);

  // Save stats + quests when AI match ends
  useEffect(() => {
    if (game.phase !== "gameover" || wonSavedRef.current) return;
    wonSavedRef.current = true;
    const won = game.winner === "player";
    SFX.play(won ? "victory" : "defeat");
    const shardsBase = won ? 25 : 10;
    const storedQuests = initDailyQuests(user?.dailyQuests);
    const types = ["played"];
    if (won) { types.push("wins"); types.push("aiwins"); }
    if (won && game.turn < 8) types.push("fastwin");
    if (won && game.playerHP >= 15) types.push("bigwin");
    const updatedQuests = applyQuestProgress(storedQuests, types);
    let questShards = 0;
    updatedQuests.quests.forEach((q, i) => { if (q.completed && !storedQuests.quests[i]?.completed) questShards += q.reward; });
    const questsGained = updatedQuests.quests.filter((q, i) => q.completed && !storedQuests.quests[i]?.completed);
    const histEntry = { opponent: "AI", result: won ? "W" : "L", date: new Date().toISOString(), turns: game.turn, ranked: false };
    const update = {
      battlesPlayed: (user?.battlesPlayed || 0) + 1,
      shards: (user?.shards || 0) + shardsBase + questShards,
      dailyQuests: updatedQuests,
      matchHistory: [histEntry, ...(user?.matchHistory || [])].slice(0, 50),
    };
    if (won) update.battlesWon = (user?.battlesWon || 0) + 1;
    if (onUpdateUser) onUpdateUser(update);
    setMatchResult({ won, turns: game.turn, cardsPlayed: cardsPlayedRef.current, hpLeft: game.playerHP, shardsEarned: shardsBase + questShards, questsGained });
  }, [game.phase, game.winner]); // eslint-disable-line

  const g = game;
  const envTheme = g.environment ? ENV_THEMES[g.environment.region] || null : null;

  const showTurnBanner = (type) => { setTurnBanner(type); setTimeout(() => setTurnBanner(null), 1100); };

  const handleOpeningResult = (winner) => { setGame((p) => ({ ...p, phase: winner === "player" ? "player" : "enemy", log: [...p.log, winner === "player" ? "You go first!" : "Enemy goes first!"] })); setTimerKey((k) => k + 1); showTurnBanner(winner === "player" ? "YOUR TURN" : "ENEMY TURN"); if (winner === "enemy") setTimeout(() => doEnemyTurn(), 1400); };

  const flashAction = (msg) => { setLiveAction(msg); setTimeout(() => setLiveAction(null), 1800); };
  const doEnemyTurn = async () => {
    showTurnBanner("ENEMY TURN");
    setAiThink(true);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    try {
    // Snapshot state
    let s = await new Promise(r => { setGame(p => { r({ ...p, playerBoard: p.playerBoard.map(c=>({...c})), enemyBoard: p.enemyBoard.map(c=>({...c})), playerHand:[...p.playerHand], enemyHand:[...p.enemyHand], enemyDeck:[...p.enemyDeck], playerDeck:[...p.playerDeck], log:[...p.log] }); return p; }); });
    const push = () => setGame(() => ({ ...s }));
    await wait(300);
    // Environment tick
    // Fire enemy env effect at start of enemy turn, then decrement
    if (s.environment?.owner==="enemy") { s=resolveEffects("onTurnStart",s.environment,s,"enemy",vfx); const rem=(s.environment.turnsRemaining||2)-1; if(rem<=0){s.environment=null;s.log=[...s.log.slice(-20),"Environment fades."];}else{s.environment={...s.environment,turnsRemaining:rem};} }
    // Draw
    if (s.enemyDeck.length>0&&s.enemyHand.length<6) { s.enemyHand=[...s.enemyHand,makeInst(s.enemyDeck[0],"e")];s.enemyDeck=s.enemyDeck.slice(1);s.log=[...s.log.slice(-20),"Enemy draws."];push();flashAction("Enemy draws...");await wait(500); }
    // Play cards
    let en=s.maxEnergy;
    for (const card of [...s.enemyHand].sort((a,b)=>b.cost-a.cost)) {
      if (card.type==="environment") { if(!card.bloodpact&&card.cost<=en){en-=card.cost;s.environment={...card,owner:"enemy",turnsRemaining:2};s.enemyHand=s.enemyHand.filter(c=>c.uid!==card.uid);s.log=[...s.log.slice(-20),`Enemy: ${card.name}! (2 rounds)`];s=resolveEffects("onPlay",card,s,"enemy",vfx);push();flashAction(`Enemy plays ${card.name}!`);SFX.play("env_play");await wait(750);} continue; }
      if (card.type==="spell") { const canCast=card.bloodpact?card.cost<s.enemyHP:card.cost<=en; if(canCast){if(card.bloodpact)s.enemyHP-=card.cost;else en-=card.cost;s.enemyHand=s.enemyHand.filter(c=>c.uid!==card.uid);s.log=[...s.log.slice(-20),`Enemy casts ${card.name}!`];s=resolveEffects("onPlay",card,s,"enemy",vfx);if(s.enemyZeusInPlay){s.enemyLightningMeter=(s.enemyLightningMeter||0)+1;if(s.enemyLightningMeter>=2){s=fireLightningMeter(s,"enemy",vfx,(m)=>{s.log=[...s.log.slice(-20),m];});}}push();flashAction(`Enemy casts ${card.name}!`);SFX.play("ability");await wait(700);} continue; }
      if(s.enemyBoard.length>=CFG.maxBoard)continue;
      const ec=card.bloodpact?0:card.cost; if(ec>en)continue;
      const resBonus=(card.keywords||[]).includes("Resonate")?s.playerBoard.length:0;
      const inst={...makeInst(card,"eb"),canAttack:(card.keywords||[]).includes("Swift"),currentAtk:card.atk+resBonus};
      if(card.bloodpact){s.enemyHP-=card.cost;s.log=[...s.log.slice(-20),`Enemy blood-plays ${card.name}!`];}else{en-=ec;s.log=[...s.log.slice(-20),`Enemy plays ${card.name}!`];}
      s.enemyBoard=[...s.enemyBoard,inst];s.enemyHand=s.enemyHand.filter(c=>c.uid!==card.uid);
      if((card.keywords||[]).includes("Fracture")&&s.enemyBoard.length<CFG.maxBoard)s.enemyBoard=[...s.enemyBoard,{...inst,uid:uid("ef"),shielded:false,currentHp:Math.ceil(card.hp/2),maxHp:Math.ceil(card.hp/2),currentAtk:Math.ceil(card.atk/2),name:card.name+" Frag",keywords:[],effects:[]}];
      s=resolveEffects("onPlay",card,s,"enemy",vfx);
      setAnimUids(p=>({...p,[inst.uid]:"summon"}));
      setTimeout(()=>setAnimUids(p=>{const n={...p};delete n[inst.uid];return n;}),550);
      push();flashAction(`Enemy plays ${card.name}!`);SFX.play("summon");await wait(850);
    }
    // Attacks
    const attUids=s.enemyBoard.filter(c=>c.canAttack&&!c.hasAttacked).map(c=>c.uid);
    for (const attUid of attUids) {
      if(s.playerHP<=0)break;
      const att=s.enemyBoard.find(c=>c.uid===attUid);
      if(!att||att.hasAttacked)continue;
      const av=att.currentAtk;
      setAnimUids(p=>({...p,[att.uid]:"attacking"}));SFX.play("attack");await wait(340);
      if(s.playerBoard.length>0){
        const tgt=[...s.playerBoard].sort((a,b)=>a.currentHp-b.currentHp)[0];
        setAnimUids(p=>({...p,[tgt.uid]:"hit"}));vfx.add("attackImpact",{duration:500});await wait(200);
        const nTHP=tgt.shielded?tgt.currentHp:tgt.currentHp-av;const nAHP=att.shielded?att.currentHp:att.currentHp-tgt.currentAtk;
        if(nAHP<att.currentHp&&nAHP>0){setAnimUids(p=>({...p,[att.uid]:"hit"}));await wait(280);}
        const dyingUids={};if(nTHP<=0){dyingUids[tgt.uid]="dying";SFX.play("kill");}if(nAHP<=0)dyingUids[att.uid]="dying";
        if(Object.keys(dyingUids).length>0){setAnimUids(p=>({...p,...dyingUids}));vfx.add("creatureDie",{color:"#e06040",duration:700});await wait(680);}
        s.enemyBoard=s.enemyBoard.map(c=>c.uid===att.uid?{...c,hasAttacked:true,currentHp:nAHP,shielded:false}:c).filter(c=>c.currentHp>0);
        s.playerBoard=s.playerBoard.map(c=>c.uid===tgt.uid?{...c,currentHp:nTHP,shielded:false,bleed:(c.bleed||0)+((att.keywords||[]).includes("Bleed")?1:0)}:c).filter(c=>c.currentHp>0);
        s.log=[...s.log.slice(-20),`${att.name}(${av}) attacks ${tgt.name}`];
        if(nTHP<=0){s.log=[...s.log,`💀 ${tgt.name} slain!`];s=resolveEffects("onDeath",tgt,s,"player",vfx);}
        if(nAHP<=0){s.log=[...s.log,`💀 ${att.name} slain!`];s=resolveEffects("onDeath",att,s,"enemy",vfx);}
        // Hades Soul Harvest: player Hades gains HP when a player unit is killed by enemy
        if(nTHP<=0&&(s.playerBoard.find(c=>c.id==="hades_soul_reaper")||s.playerHand.find(c=>c.id==="hades_soul_reaper"))){s=resolveEffects("onFriendlyDeath",{id:"hades_soul_reaper",effects:[{trigger:"onFriendlyDeath",effect:"soul_harvest"}]},s,"player",vfx);}
        // Hades Soul Harvest: enemy Hades gains HP when enemy unit dies
        if(nAHP<=0&&(s.enemyBoard.find(c=>c.id==="hades_soul_reaper")||s.enemyHand.find(c=>c.id==="hades_soul_reaper"))){s=resolveEffects("onFriendlyDeath",{id:"hades_soul_reaper",effects:[{trigger:"onFriendlyDeath",effect:"soul_harvest"}]},s,"enemy",vfx);}
        // Lightning Meter: enemy Swift attack
        if(s.enemyZeusInPlay&&(att.keywords||[]).includes("Swift")){s.enemyLightningMeter=(s.enemyLightningMeter||0)+1;if(s.enemyLightningMeter>=2){s=fireLightningMeter(s,"enemy",vfx,(m)=>{s.log=[...s.log.slice(-20),m];});}}
        s=resolveEffects("onAttack",att,s,"enemy",vfx);
        flashAction(`${att.name} attacks ${tgt.name}!`);
      } else {
        s.playerHP-=av;s.enemyBoard=s.enemyBoard.map(c=>c.uid===att.uid?{...c,hasAttacked:true}:c);
        s.log=[...s.log.slice(-20),`${att.name} hits you for ${av}!`];flashAction(`${att.name} hits you for ${av}!`);vfx.add("damage",{amount:av,duration:500});
        if(s.enemyZeusInPlay&&(att.keywords||[]).includes("Swift")){s.enemyLightningMeter=(s.enemyLightningMeter||0)+1;if(s.enemyLightningMeter>=2){s=fireLightningMeter(s,"enemy",vfx,(m)=>{s.log=[...s.log.slice(-20),m];});}}
        s=resolveEffects("onAttack",att,s,"enemy",vfx);
      }
      push();await wait(400);setAnimUids({});if(s.playerHP<=0)break;
    }
    // Player death check
    if(s.playerHP<=0){setGame(()=>({...s,phase:"gameover",winner:"enemy",log:[...s.log,"Defeated..."]}));return;}
    // End of enemy turn: fire + clear bleed on player board only
    s.playerBoard=s.playerBoard.map(c=>c.bleed>0?{...c,currentHp:c.currentHp-c.bleed,bleed:0}:c).filter(c=>c.currentHp>0);
    // Hades End of Turn: 1 dmg to all players if enemy has Hades
    if(s.enemyBoard.some(c=>c.id==="hades_soul_reaper")){s=resolveEffects("onTurnEnd",{id:"hades_soul_reaper",effects:[{trigger:"onTurnEnd",effect:"soul_reap"}]},s,"enemy",vfx);if(s.playerHP<=0){setGame(()=>({...s,phase:"gameover",winner:"enemy",log:[...s.log,"Defeated..."]}));return;}}
    // Lightning Meter: enemy Swift attacks tracked above; fire if at 4
    if(s.enemyZeusInPlay&&(s.enemyLightningMeter||0)>=2){s=fireLightningMeter(s,"enemy",vfx,(m)=>{s.log=[...s.log.slice(-20),m];});}
    if(s.playerHP<=0){setGame(()=>({...s,phase:"gameover",winner:"enemy",log:[...s.log,"Defeated..."]}));return;}
    // Clear temp frozen/anchored from enemy units
    s.enemyBoard=s.enemyBoard.map(c=>(c.anchored||c.frozen)?{...c,anchored:false,frozen:false,canAttack:true}:c);
    s.playerBoard.forEach(c=>{if(c.effects&&c.effects.length)s=resolveEffects("onTurnStart",c,s,"player",vfx);});
    s.playerBoard=s.playerBoard.map(c=>({...c,canAttack:true,hasAttacked:false}));
    // Food Fight synergy: start-of-turn effects
    {const jaxRed=s.playerBoard.some(c=>c.id==="master_jax")?1:0;const syn=getActiveSynergies(s.playerBoard,jaxRed);
      const addTag=(c,t)=>({...c,synTag:c.synTag?c.synTag+" · "+t:t});
      s.playerBoard=s.playerBoard.map(c=>({...c,synTag:null}));
      if(syn.fruit.t2){s.playerBoard=s.playerBoard.map(c=>c.id==="berry_tooty"?addTag({...c,currentHp:Math.min(c.maxHp,c.currentHp+1)},"🍎+HP"):c);}
      if(syn.fruit.t4){s.playerBoard=s.playerBoard.map(c=>c.id==="berry_tooty"?addTag({...c,currentAtk:c.currentAtk+1},"🍎+ATK"):c);s.log=[...s.log,"🍎 Fruit T4: Berry & Tooty +1 ATK!"];}
      if(syn.fruit.t6){s.playerBoard=s.playerBoard.map(c=>(c.group||"").includes("Fruit")&&!(c.keywords||[]).includes("Swift")?addTag({...c,keywords:[...(c.keywords||[]),"Swift"],canAttack:true},"🍎Swift"):c);s.log=[...s.log,"🍎 Fruit T6: Fruit units gain Swift!"];}
      if(syn.veggie.t2){s.playerBoard=s.playerBoard.map(c=>(c.group||"").includes("Veggie")?addTag({...c,currentAtk:c.currentAtk+1,currentHp:c.currentHp+1,maxHp:c.maxHp+1},"🥦+1/+1"):c);s.log=[...s.log,"🥦 Veggie T2: Veggie units +1/+1!"];}
      if(syn.veggie.t4){s.playerBoard=s.playerBoard.map(c=>(c.keywords||[]).includes("Anchor")?c:addTag({...c,keywords:[...(c.keywords||[]),"Anchor"]},"🥦Anchor"));}
      if(syn.veggie.t6){s.enemyBoard=s.enemyBoard.map(c=>({...c,bleed:(c.bleed||0)+1}));s.log=[...s.log,"🥦 Veggie T6: All enemies gain Bleed!"];}
      if(syn.protein.t2){s.playerBoard=s.playerBoard.map(c=>(c.group||"").includes("Protein")?addTag({...c,currentAtk:c.currentAtk+1},"🍖+ATK"):c);s.log=[...s.log,"🍖 Protein T2: Protein units +1 ATK!"];}
      if(syn.protein.t6){s.playerBoard=s.playerBoard.map(c=>(c.group||"").includes("Protein")&&!(c.keywords||[]).includes("Bleed")?addTag({...c,keywords:[...(c.keywords||[]),"Bleed"]},"🍖Bleed"):c);s.log=[...s.log,"🍖 Protein T6: Protein units gain Bleed!"];}
      if(syn.sugar.t4){s.playerBoard=s.playerBoard.map(c=>(c.group||"").includes("Sugar")?addTag({...c,currentAtk:c.currentAtk+2},"🍬+2ATK"):c);s.log=[...s.log,"🍬 Sugar T4: Sugar units +2 ATK!"];}
      if(syn.sugar.t6){s.playerBoard=s.playerBoard.map(c=>addTag({...c,currentAtk:c.currentAtk+3,currentHp:c.currentHp-1},"🍬Crash")).filter(c=>c.currentHp>0);s.log=[...s.log,"🍬 Sugar Crash: +3 ATK, -1 HP to all!"];}
      s.firstCardPlayedThisTurn=false;s.spellsPlayedThisTurn=0;
    }
    s.enemyBoard=s.enemyBoard.map(c=>({...c,canAttack:true,hasAttacked:false}));
    if(s.playerDeck.length>0&&s.playerHand.length<CFG.maxHand){s.playerHand=[...s.playerHand,makeInst(s.playerDeck[0],"p")];s.playerDeck=s.playerDeck.slice(1);}
    if(s.enemyHP<=0){setGame(()=>({...s,phase:"gameover",winner:"player",log:[...s.log,"Victory!"]}));return;}
    const newTurn=s.turn+1,newMax=Math.min(CFG.maxEnergy,newTurn);
    s.log=[...s.log,`Turn ${newTurn}`];
    setGame(()=>({...s,turn:newTurn,phase:"player",playerEnergy:newMax,maxEnergy:newMax}));
    setTimerKey(k=>k+1);setTimeout(()=>showTurnBanner("YOUR TURN"),200);
    } finally {
      setAiThink(false);
    }
  };

  const endTurn = useCallback(() => {
    if (g.phase !== "player" || aiThink) return;
    setAttacker(null); setTargetingSpell(null); SFX.play("timer_end");
    setGame((p) => {
      let s = { ...p, phase: "enemy", log: [...p.log.slice(-20), "Your turn ends."] };
      // End of player turn: fire + clear bleed on enemy board
      s.enemyBoard = s.enemyBoard.map(c=>c.bleed>0?{...c,currentHp:c.currentHp-c.bleed,bleed:0}:c).filter(c=>c.currentHp>0);
      // Hades End of Turn: 1 dmg to all enemies while Hades is active on player board
      if (s.playerBoard.some(c => c.id === "hades_soul_reaper")) {
        s = resolveEffects("onTurnEnd", { id:"hades_soul_reaper", effects:[{ trigger:"onTurnEnd", effect:"soul_reap" }] }, s, "player", vfx);
        if (s.enemyHP <= 0) { s.phase = "gameover"; s.winner = "player"; }
      }
      // Clear temporary frozen from player's units after their turn
      s.playerBoard = s.playerBoard.map(c => (c.anchored || c.frozen) ? { ...c, anchored: false, frozen: false, canAttack: true } : c);
      // Fire env effect at end of player's turn, then decrement
      if (s.environment?.owner === "player") {
        s = resolveEffects("onTurnStart", s.environment, s, "player", vfx);
        const rem = (s.environment.turnsRemaining || 2) - 1;
        if (rem <= 0) { s.environment = null; s.log = [...s.log.slice(-20), "Environment fades."]; }
        else s.environment = { ...s.environment, turnsRemaining: rem };
      }
      return s;
    });
    setTimeout(() => doEnemyTurn(), 300);
  }, [g.phase, aiThink]);

  const playCard = (card, targetUid = null) => {
    if (g.phase !== "player" || aiThink) return;
    cardsPlayedRef.current += 1;
    if (card.type === "environment") {
      const ec = getEffectiveCost(card, g.environment, "player");
      if (card.bloodpact ? card.cost >= g.playerHP : ec > g.playerEnergy) return; SFX.play("env_play"); vfx.add("envchange", { color: card.border || "#40a020" }); setAttacker(null); setGame((prev) => { let s = { ...prev, playerHand: prev.playerHand.filter((c) => c.uid !== card.uid), log: [...prev.log.slice(-20)] }; if (card.bloodpact) { s.playerHP -= card.cost; s.log = [...s.log, `Pay ${card.cost} HP: ${card.name}!`]; } else { s.playerEnergy -= ec; s.log = [...s.log, `${card.name} reshapes the field! (2 rounds)`]; } s.environment = { ...card, owner: "player", turnsRemaining: 2 }; s = resolveEffects("onPlay", card, s, "player", vfx); vfx.add("environment", { color: card.border, duration: 2000 }); return s; }); return; }
    if (card.type === "spell") {
      const ec = getEffectiveCost(card, g.environment, "player");
      if (card.bloodpact ? card.cost >= g.playerHP : ec > g.playerEnergy) return;
      // Enter targeting mode if spell needs a target and enemy has units
      const needsTarget = (card.effects || []).some(e => TARGETED_SPELL_EFFECTS.includes(e.effect));
      if (needsTarget && !targetUid && g.enemyBoard.length > 0) { setTargetingSpell(card); return; }
      SFX.play("ability"); vfx.add("spell", { color: card.border || "#c090d0" }); setAttacker(null); setTargetingSpell(null);
      setGame((prev) => {
        let s = { ...prev, playerHand: prev.playerHand.filter((c) => c.uid !== card.uid), log: [...prev.log.slice(-20)] };
        if (card.bloodpact) { s.playerHP -= card.cost; s.log = [...s.log, `Pay ${card.cost} HP: ${card.name}!`]; }
        else { s.playerEnergy -= getEffectiveCost(card, prev.environment, "player"); s.log = [...s.log, `Cast ${card.name}!`]; }
        // Caffeine Catapult: first card played each turn triggers Splat
        if (!s.firstCardPlayedThisTurn && s.playerBoard.some(c => c.id === "caffeine_catapult")) {
          const catTargets = s.enemyBoard.filter(c => c.currentHp > 0);
          if (catTargets.length > 0) { const ct = catTargets[Math.floor(Math.random() * catTargets.length)]; s.enemyBoard = s.enemyBoard.map(c => c.uid === ct.uid ? { ...c, currentHp: c.currentHp - 1 } : c).filter(c => c.currentHp > 0); s.log = [...s.log, `💥 Catapult! ${ct.name} takes 1!`]; }
          else { s.enemyHP -= 1; s.log = [...s.log, "💥 Catapult hits enemy face!"]; }
        }
        s.firstCardPlayedThisTurn = true;
        s = resolveEffects("onPlay", card, s, "player", vfx, targetUid ? { targetUid } : {});
        if (s.enemyHP <= 0) { s.phase = "gameover"; s.winner = "player"; s.log = [...s.log, "Victory!"]; }
        else if (s.playerHP <= 0) { s.phase = "gameover"; s.winner = "enemy"; s.log = [...s.log, "Defeated..."]; }
        return s;
      });
      return;
    }
    if (g.playerBoard.length >= CFG.maxBoard) return;
    const ecCreature = getEffectiveCost(card, g.environment, "player");
    if (card.bloodpact ? card.cost >= g.playerHP : ecCreature > g.playerEnergy) return;
    SFX.play("card"); setAttacker(null);
    const inst = { ...makeInst(card, "pb"), currentHp: card.currentHp, maxHp: card.maxHp, canAttack: (card.keywords || []).includes("Swift"), hasAttacked: false };
    const summonUid = inst.uid;
    setGame((prev) => { const eff = getEffectiveCost(card, prev.environment, "player"); let s = { ...prev, playerHand: prev.playerHand.filter((c) => c.uid !== card.uid), log: [...prev.log.slice(-20)] }; if (card.bloodpact) { s.playerHP -= card.cost; s.log = [...s.log, `Pay ${card.cost} HP: ${card.name}!`]; } else { s.playerEnergy -= eff; s.log = [...s.log, `You play ${card.name}!`]; }
      // Caffeine Catapult: first card played each turn triggers Splat
      if (!s.firstCardPlayedThisTurn && s.playerBoard.some(c => c.id === "caffeine_catapult")) {
        const catTargets = s.enemyBoard.filter(c => c.currentHp > 0);
        if (catTargets.length > 0) { const ct = catTargets[Math.floor(Math.random() * catTargets.length)]; s.enemyBoard = s.enemyBoard.map(c => c.uid === ct.uid ? { ...c, currentHp: c.currentHp - 1 } : c).filter(c => c.currentHp > 0); s.log = [...s.log, `💥 Catapult! ${ct.name} takes 1!`]; }
        else { s.enemyHP -= 1; s.log = [...s.log, "💥 Catapult hits enemy face!"]; }
      }
      // Sugar T2 synergy: first unit played each turn gets Swift
      const jaxRed = s.playerBoard.some(c => c.id === "master_jax") ? 1 : 0;
      const playerSyn = getActiveSynergies(s.playerBoard, jaxRed);
      const sugarSwift = playerSyn.sugar.t2 && !s.firstCardPlayedThisTurn;
      s.firstCardPlayedThisTurn = true;
      // Resonate: set ATK based on enemy board count at time of play
      const resonateBonus = (card.keywords||[]).includes("Resonate") ? prev.enemyBoard.length : 0;
      const finalInst = { ...inst, currentAtk: inst.currentAtk + resonateBonus, canAttack: inst.canAttack || sugarSwift, keywords: sugarSwift && !inst.keywords.includes("Swift") ? [...inst.keywords, "Swift"] : inst.keywords };
      s.playerBoard = [...prev.playerBoard, finalInst];
      if ((card.keywords || []).includes("Fracture") && s.playerBoard.length < CFG.maxBoard) { s.playerBoard = [...s.playerBoard, { ...finalInst, uid: uid("pf"), shielded: false, currentHp: Math.ceil(card.hp / 2), maxHp: Math.ceil(card.hp / 2), currentAtk: Math.ceil(card.atk / 2), name: card.name + " Frag", keywords: (card.keywords || []).filter(k => k !== "Fracture"), levelUp: [], effects: [] }]; s.log = [...s.log, "Fragment enters!"]; }
      // Echo: add 1/1 ghost to hand immediately
      if ((card.keywords||[]).includes("Echo") && s.playerHand.length < CFG.maxHand) { const ghost = { ...makeInst({ ...card, id: card.id+"_e", cost:1, hp:1, atk:1, keywords:[], effects:[] }, "p"), uid: uid("echo"), currentHp:1, maxHp:1, currentAtk:1, name: card.name+" Echo" }; s.playerHand = [...s.playerHand, ghost]; s.log = [...s.log, `Echo: ${card.name} ghost enters hand!`]; }
      s = resolveEffects("onPlay", card, s, "player", vfx); return s; });
    setAnimUids(p => ({ ...p, [summonUid]: "summoning" }));
    setTimeout(() => setAnimUids(p => { const n = {...p}; delete n[summonUid]; return n; }), 550);
  };

  const selectAtt = (c) => { if (g.phase !== "player" || aiThink) return; if (attacker === c.uid) { setAttacker(null); return; } if (c.canAttack && !c.hasAttacked) setAttacker(c.uid); };
  const atkCreature = async (tgt) => {
    if (!attacker || g.phase !== "player") return;
    const att = g.playerBoard.find((c) => c.uid === attacker);
    if (!att) return;
    SFX.play("attack");
    setAnimUids({ [att.uid]: "attacking" });
    await new Promise(r => setTimeout(r, 340));
    setAnimUids(p => ({ ...p, [tgt.uid]: "hit" }));
    vfx.add("attackImpact", { duration: 500 });
    await new Promise(r => setTimeout(r, 200));
    const av = att.currentAtk;
    const nTHP = tgt.shielded ? tgt.currentHp : tgt.currentHp - av;
    const nAHP = att.shielded ? att.currentHp : att.currentHp - tgt.currentAtk;
    // Counter-hit: attacker takes damage back and survives — show recoil
    if (nAHP < att.currentHp && nAHP > 0) {
      setAnimUids(p => ({ ...p, [att.uid]: "hit" }));
      await new Promise(r => setTimeout(r, 280));
    }
    const dyingUids = {};
    if (nTHP <= 0) { dyingUids[tgt.uid] = "dying"; SFX.play("kill"); }
    if (nAHP <= 0) dyingUids[att.uid] = "dying";
    if (Object.keys(dyingUids).length > 0) { setAnimUids(p => ({ ...p, ...dyingUids })); vfx.add("creatureDie", { color:"#e06040", duration:700 }); await new Promise(r => setTimeout(r, 680)); }
    setGame((prev) => {
      let s = { ...prev, log: [...prev.log.slice(-20)] };
      if (tgt.shielded) s.log = [...s.log, `${tgt.name} shield absorbs!`];
      if (att.shielded) s.log = [...s.log, `${att.name} shield absorbs counter!`];
      // Anchor immunity: anchored units cannot be removed by effects — but can die from combat damage
      s.enemyBoard = prev.enemyBoard.map((c) => c.uid === tgt.uid ? { ...c, currentHp: nTHP, shielded: false, bleed: (c.bleed || 0) + ((att.keywords || []).includes("Bleed") ? (att.bleedAmount || 1) : 0) } : c).filter((c) => c.currentHp > 0);
      s.playerBoard = prev.playerBoard.map((c) => c.uid === att.uid ? { ...c, hasAttacked: true, currentHp: nAHP, shielded: false } : c).filter((c) => c.currentHp > 0);
      s.log = [...s.log, `${att.name}(${av}) attacks ${tgt.name}`];
      if (nTHP <= 0) { s.log = [...s.log, `💀 ${tgt.name} slain by ${att.name}!`]; s = resolveEffects("onDeath", tgt, s, "enemy", vfx); }
      if (nAHP <= 0) { s.log = [...s.log, `💀 ${att.name} slain by ${tgt.name}!`]; s = resolveEffects("onDeath", att, s, "player", vfx); }
      // Hades Soul Harvest: +1 maxHp if Hades is on board OR in hand and a friendly unit died
      if (nAHP <= 0 && (s.playerBoard.find(c => c.id === "hades_soul_reaper") || s.playerHand.find(c => c.id === "hades_soul_reaper"))) {
        s = resolveEffects("onFriendlyDeath", { id:"hades_soul_reaper", effects:[{ trigger:"onFriendlyDeath", effect:"soul_harvest" }] }, s, "player", vfx);
      }
      // Lightning Meter: +1 if attacker is Swift
      if (s.playerZeusInPlay && (att.keywords || []).includes("Swift")) {
        s.playerLightningMeter = (s.playerLightningMeter || 0) + 1;
        if (s.playerLightningMeter >= 2) { s = fireLightningMeter(s, "player", vfx, (m) => { s.log = [...s.log.slice(-20), m]; }); }
      }
      s = resolveEffects("onAttack", att, s, "player", vfx);
      if (s.enemyHP <= 0) { s.phase = "gameover"; s.winner = "player"; }
      return s;
    });
    setAttacker(null);
    await new Promise(r => setTimeout(r, 200));
    setAnimUids({});
  };
  const atkFace = async () => { if (!attacker || g.phase !== "player") return; const att = g.playerBoard.find((c) => c.uid === attacker); if (!att) return; SFX.play("attack"); setAnimUids({ [att.uid]: "attacking" }); await new Promise(r => setTimeout(r, 380)); const dmg = att.currentAtk; vfx.add("damage", { amount: dmg, duration: 500 }); setGame((prev) => { const nHP = prev.enemyHP - dmg; let s = { ...prev, enemyHP: nHP, playerBoard: prev.playerBoard.map((c) => c.uid === att.uid ? { ...c, hasAttacked: true } : c), log: [...prev.log.slice(-20), `${att.name} deals ${dmg} direct!`] }; if (s.playerZeusInPlay && (att.keywords || []).includes("Swift")) { s.playerLightningMeter = (s.playerLightningMeter || 0) + 1; if (s.playerLightningMeter >= 2) { s = fireLightningMeter(s, "player", vfx, (m) => { s.log = [...s.log.slice(-20), m]; }); } } s = resolveEffects("onAttack", att, s, "player", vfx); if (s.enemyHP <= 0) { s.phase = "gameover"; s.winner = "player"; s.log = [...s.log, "Victory!"]; } return s; }); setAttacker(null); await new Promise(r => setTimeout(r, 200)); setAnimUids({}); };
  const attCard = attacker ? g.playerBoard.find((c) => c.uid === attacker) : null;

  return (<div className="battle-wrapper" style={{ width:"100%", height:"calc(100vh - 72px)", padding:"8px 14px 6px", background:"#0a0806", boxSizing:"border-box", overflow:"hidden", display:"flex", flexDirection:"column" }} onClick={() => { SFX.init(); }}>
    {previewCard && <CardPreview card={previewCard} onClose={() => setPreviewCard(null)} />}
    {/* Live Action Ticker */}
    {liveAction && (
      <div style={{ position:"fixed", top:"38%", left:"50%", transform:"translateX(-50%)", zIndex:290, pointerEvents:"none", animation:"fadeIn 0.15s" }}>
        <div style={{ background:"rgba(10,8,4,0.92)", border:`2px solid ${logColor(liveAction)}`, borderRadius:12, padding:"12px 28px", fontFamily:"'Cinzel',serif", fontSize:16, fontWeight:700, color:logColor(liveAction), letterSpacing:1, whiteSpace:"nowrap", boxShadow:`0 4px 28px ${logColor(liveAction)}55` }}>
          {logIcon(liveAction)}{liveAction}
        </div>
      </div>
    )}
    {/* Turn Banner */}
    {turnBanner && (
      <div style={{ position:"fixed", inset:0, display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, pointerEvents:"none" }}>
        <div style={{ animation:"turnStamp 1.3s ease-out forwards", display:"flex", flexDirection:"column", alignItems:"center", gap:0 }}>
          {/* decorative top bar */}
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:4 }}>
            <div style={{ height:1, width:80, background:`linear-gradient(90deg,transparent,${turnBanner==="YOUR TURN"?"#78cc45":"#e05050"})` }} />
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:9, letterSpacing:5, color:turnBanner==="YOUR TURN"?"#78cc4588":"#e0505088" }}>FORGE {"&"} FABLE</span>
            <div style={{ height:1, width:80, background:`linear-gradient(270deg,transparent,${turnBanner==="YOUR TURN"?"#78cc45":"#e05050"})` }} />
          </div>
          {/* main announcement */}
          <div style={{ background:turnBanner==="YOUR TURN"?"linear-gradient(135deg,#071a02 0%,#0d2804 50%,#071a02 100%)":"linear-gradient(135deg,#1a0202 0%,#280404 50%,#1a0202 100%)", border:`2px solid ${turnBanner==="YOUR TURN"?"#78cc45":"#e05050"}`, borderRadius:6, padding:"12px 48px", textAlign:"center", position:"relative", overflow:"hidden", boxShadow:`0 0 50px ${turnBanner==="YOUR TURN"?"#78cc4533":"#e0505033"}` }}>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:24, fontWeight:900, color:turnBanner==="YOUR TURN"?"#78cc45":"#e05050", letterSpacing:6, textShadow:`0 0 24px ${turnBanner==="YOUR TURN"?"#78cc45":"#e05050"}, 0 2px 4px rgba(0,0,0,0.9)`, lineHeight:1 }}>{turnBanner}</div>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, letterSpacing:3, color:turnBanner==="YOUR TURN"?"#78cc4588":"#e0505088", marginTop:5 }}>{turnBanner==="YOUR TURN"?"PLAY YOUR CARDS":"OPPONENT THINKING"}</div>
          </div>
          {/* bottom bar */}
          <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:4 }}>
            <div style={{ height:1, width:80, background:`linear-gradient(90deg,transparent,${turnBanner==="YOUR TURN"?"#78cc45":"#e05050"})` }} />
            <div style={{ width:6, height:6, borderRadius:"50%", background:turnBanner==="YOUR TURN"?"#78cc45":"#e05050", boxShadow:`0 0 12px ${turnBanner==="YOUR TURN"?"#78cc45":"#e05050"}`, animation:"pulse 0.8s infinite" }} />
            <div style={{ height:1, width:80, background:`linear-gradient(270deg,transparent,${turnBanner==="YOUR TURN"?"#78cc45":"#e05050"})` }} />
          </div>
        </div>
      </div>
    )}
    {g.phase === "gameover" && matchResult && (<div style={{ position:"fixed", inset:0, zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", background: matchResult.won ? "rgba(2,12,1,0.95)" : "rgba(12,2,2,0.95)", animation:"fadeIn 0.5s ease-out" }}>
      <div style={{ textAlign:"center", maxWidth:460, width:"100%", padding:"0 20px" }}>
        {/* Result header */}
        <div style={{ fontSize:72, marginBottom:8, animation:"pulse 1.2s ease-in-out infinite" }}>{matchResult.won ? "✨" : "💀"}</div>
        <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:52, fontWeight:900, color: matchResult.won ? "#78cc45" : "#e05050", margin:"0 0 4px", textShadow:`0 0 60px ${matchResult.won ? "#78cc45" : "#e05050"}, 0 4px 12px rgba(0,0,0,0.9)`, letterSpacing:8 }}>{matchResult.won ? "VICTORY" : "DEFEATED"}</h2>
        <p style={{ fontFamily:"'Cinzel',serif", fontSize:13, color:"#807060", marginBottom:20, letterSpacing:2 }}>{matchResult.won ? "You crushed the enemy!" : "The enemy prevails..."}</p>
        {/* Stats grid */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16, background:"rgba(255,255,255,0.03)", border:"1px solid #2a2010", borderRadius:12, padding:"14px 12px" }}>
          {[["TURNS", matchResult.turns, "#e8c060"], ["CARDS PLAYED", matchResult.cardsPlayed, "#c090ff"], ["HP LEFT", matchResult.won ? matchResult.hpLeft : "—", matchResult.won ? "#78cc45" : "#604030"]].map(([l,v,c]) => (
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:900, color:c, lineHeight:1 }}>{v}</div>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:8, color:"#504028", letterSpacing:2, marginTop:5 }}>{l}</div>
            </div>
          ))}
        </div>
        {/* Shards earned */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:16, background:"rgba(160,184,200,0.07)", border:"1px solid #2a3a4a", borderRadius:10, padding:"10px 20px" }}>
          <span style={{ fontSize:20 }}>⬙</span>
          <span style={{ fontFamily:"'Cinzel',serif", fontSize:20, fontWeight:900, color:"#a0b8c8" }}>+{matchResult.shardsEarned}</span>
          <span style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#506070", letterSpacing:2 }}>SHARDS EARNED</span>
        </div>
        {/* Quest completions */}
        {matchResult.questsGained.length > 0 && (
          <div style={{ marginBottom:16, background:"rgba(120,200,69,0.06)", border:"1px solid #78cc4533", borderRadius:10, padding:"10px 16px" }}>
            {matchResult.questsGained.map(q => (
              <div key={q.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 0" }}>
                <span style={{ fontSize:14 }}>✓</span>
                <span style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#78cc45", flex:1, textAlign:"left" }}>{q.label}</span>
                <span style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#a0b8c8" }}>+{q.reward} shards</span>
              </div>
            ))}
          </div>
        )}
        {/* Buttons */}
        <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
          <button onClick={() => { wonSavedRef.current = false; cardsPlayedRef.current = 0; setMatchResult(null); setGame(initGame()); setAttacker(null); setAiThink(false); }} style={{ padding:"13px 32px", background:"linear-gradient(135deg,#c89010,#f0c040)", border:"none", borderRadius:10, fontFamily:"'Cinzel',serif", fontWeight:700, fontSize:13, letterSpacing:2, color:"#1a1000", cursor:"pointer", boxShadow:"0 0 24px #e8c06066" }}>REMATCH</button>
          <button onClick={onExit} style={{ padding:"13px 26px", background:"transparent", border:"2px solid #3a2c10", borderRadius:10, fontFamily:"'Cinzel',serif", fontSize:12, color:"#a09058", cursor:"pointer" }}>EXIT</button>
        </div>
      </div>
    </div>)}
    <div className="battle-grid" style={{ display:"grid", gridTemplateColumns:"280px 1fr 300px", gap:14, flex:1, minHeight:0 }}>
      {/* Left Panel — Synergy Tracker + Chat */}
      <div className="battle-side" style={{ display:"flex", flexDirection:"column", gap:4, height:"100%", overflowY:"auto", minHeight:0 }}>
        {/* Food Fight Synergy Tracker */}
        {(() => {
          const jaxRed = g.playerBoard.some(c => c.id === "master_jax") ? 1 : 0;
          const syn = getActiveSynergies(g.playerBoard, jaxRed);
          const hasFoodFight = g.playerBoard.some(c => c.region === "Food Fight") || g.playerHand.some(c => c.region === "Food Fight");
          if (!hasFoodFight) return null;
          const GROUP_COLOR = { Fruit:"#ff8040", Veggie:"#50c040", Protein:"#e08020", Sugar:"#d040b0" };
          const GROUP_ICON  = { Fruit:"🍎", Veggie:"🥦", Protein:"🍖", Sugar:"🍬" };
          const GROUP_DESCS = {
            Fruit:   { t2:"Berry & Tooty heals +1 HP each turn", t4:"Berry & Tooty gains +1 ATK each turn", t6:"All Fruit units gain Swift" },
            Veggie:  { t2:"All Veggie units gain +1/+1 each turn", t4:"All friendly units gain Anchor", t6:"All enemy units gain Bleed" },
            Protein: { t2:"All Protein units gain +1 ATK each turn", t4:"Splat deals 2 dmg instead of 1", t6:"All Protein units gain Bleed" },
            Sugar:   { t2:"First unit played each turn gains Swift", t4:"All Sugar units gain +2 ATK each turn", t6:"+3 ATK & -1 HP to all (Sugar Crash)" },
          };
          const jaxNote = jaxRed > 0 ? " (Jax -1)" : "";
          return (
            <div style={{ background:"rgba(10,8,4,0.95)", border:"2px solid #604018", borderRadius:10, padding:"10px 12px", fontSize:10, fontFamily:"'Cinzel',serif", boxShadow:"0 0 16px rgba(200,100,20,0.18)" }}>
              <div style={{ color:"#f0b040", letterSpacing:3, marginBottom:8, fontSize:9, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
                <span>🍽</span><span>GROUP SYNERGY</span>{jaxRed > 0 && <span style={{ fontSize:8, color:"#b08030", fontWeight:400 }}>Jax: thresholds -1</span>}
              </div>
              {Object.entries(syn.counts).map(([grp, cnt]) => {
                const active = syn[grp.toLowerCase()];
                const col = GROUP_COLOR[grp];
                const isExpanded = expandedSynGroup === grp;
                const descs = GROUP_DESCS[grp];
                const thresholds = [2,4,6];
                const hasAny = cnt > 0;
                return (
                  <div key={grp} style={{ marginBottom: isExpanded ? 8 : 4 }}>
                    <div onClick={() => setExpandedSynGroup(isExpanded ? null : grp)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3, cursor:"pointer", padding:"3px 4px", borderRadius:5, background: isExpanded ? `${col}18` : "transparent", transition:"background .2s" }}>
                      <span style={{ color: hasAny ? col : "#503020", fontWeight: hasAny ? 700 : 400, fontSize:11 }}>{GROUP_ICON[grp]} {grp}</span>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ color: hasAny ? col : "#503020", fontWeight:700, fontSize:13 }}>{cnt}</span>
                        <span style={{ color: hasAny ? col : "#503020", fontSize:8 }}>{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:2, marginBottom: isExpanded ? 5 : 0 }}>
                      {thresholds.map(t => {
                        const isActive = active?.[`t${t}`];
                        const thresh = Math.max(1, t - jaxRed);
                        return <div key={t} style={{ flex:1, height:6, borderRadius:3, background: isActive ? col : "rgba(255,255,255,0.06)", boxShadow: isActive ? `0 0 8px ${col}aa` : "none", transition:"all .3s", cursor:"pointer" }} title={`T${t} (${thresh}): ${descs[`t${t}`]}`} />;
                      })}
                    </div>
                    {isExpanded && (
                      <div style={{ paddingLeft:4 }}>
                        {thresholds.map(t => {
                          const isActive = active?.[`t${t}`];
                          const thresh = Math.max(1, t - jaxRed);
                          return (
                            <div key={t} style={{ display:"flex", alignItems:"flex-start", gap:5, marginBottom:3, opacity: isActive ? 1 : 0.45 }}>
                              <span style={{ color: isActive ? col : "#604020", fontWeight:700, fontSize:9, minWidth:18, paddingTop:1 }}>T{t}</span>
                              <span style={{ color: isActive ? "#e0d0a0" : "#604020", fontSize:9, lineHeight:1.4 }}>
                                {thresh} {grp}: {descs[`t${t}`]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
        <div style={{ height:240, overflow:"hidden" }}><BattleChat user={user} aiMode={true} /></div>
        <div style={{ display:"flex", gap:4, paddingTop:4 }}>
          <button onClick={onExit} style={{ flex:1, padding:"8px 4px", background:"rgba(180,40,20,0.15)", border:"1px solid #5a1810", borderRadius:8, color:"#a06040", fontFamily:"'Cinzel',serif", fontSize:10, cursor:"pointer", letterSpacing:1 }}>⬅ EXIT</button>
          <button onClick={()=>{ const el=document.documentElement; if(!document.fullscreenElement){el.requestFullscreen?.();}else{document.exitFullscreen?.();} }} style={{ flex:1, padding:"8px 4px", background:"rgba(14,12,8,0.8)", border:"1px solid #604028aa", borderRadius:8, color:"#a08050", fontFamily:"'Cinzel',serif", fontSize:13, cursor:"pointer" }} title="Fullscreen">⛶</button>
        </div>
      </div>
      <div style={{ background: envTheme ? envTheme.bg : "linear-gradient(180deg,#2a1c0c 0%,#1e1408 50%,#281a08 100%)", border: `1px solid ${envTheme ? envTheme.glow + "44" : "#5a3c1a55"}`, borderRadius: 14, overflow: "hidden", position: "relative", transition: "background 1.5s ease, border-color 1s ease", boxShadow: envTheme ? undefined : "inset 0 0 60px rgba(0,0,0,0.4), 0 0 0 1px #3a2010", display:"flex", flexDirection:"column", height:"100%" }}>
        {g.phase === "opening" && <OpeningDraw onResult={handleOpeningResult} />}
        <VFXOverlay effects={vfx.effects} />
        {/* Environment particles */}
        {envTheme && <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}><FloatingParticles count={20} color={envTheme.particle} speed={0.6} /></div>}
        {/* Enemy zone */}
        <div style={{ background: "linear-gradient(180deg, rgba(180,30,20,0.28) 0%, rgba(120,18,12,0.22) 100%)", borderBottom: "2px solid #8a2010", borderLeft: "3px solid #c03020", padding: "7px 12px", position: "relative", zIndex: 2, boxShadow: "inset 0 -6px 24px rgba(200,40,20,0.18), inset 3px 0 12px rgba(200,40,20,0.12)", flex:"0 0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#3a0c0c,#200808)", border: "2px solid #a0202044", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#cc6666", fontFamily: "'Cinzel',serif", fontWeight: 700 }}>AI</div>
              <span style={{ fontFamily: "'Cinzel',serif", fontSize: 14, color: "#cc4848", letterSpacing: 2, fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>ENEMY</span>
              <div style={{ display: "flex", gap: 2, marginLeft: 4 }}>{Array.from({ length: g.enemyHand.length }).map((_, i) => (<div key={i} style={{ width: 14, height: 20, background: "linear-gradient(135deg,#240c0c,#180808)", border: "1px solid #341818", borderRadius: 2 }} />))}</div>
              <span style={{ fontSize: 8, color: "#604040", fontFamily: "'Cinzel',serif" }}>Deck: {g.enemyDeck.length}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
                <div style={{ width: 90, height: 10, background: "#180808", borderRadius: 5, overflow: "hidden", border:"1px solid #2a1010" }}><div style={{ height: "100%", width: `${Math.max(0,(g.enemyHP / CFG.startHP) * 100)}%`, background: `linear-gradient(90deg, ${hpCol(g.enemyHP)}99, ${hpCol(g.enemyHP)})`, borderRadius:5, transition: "width .4s, background .5s", boxShadow:`0 0 8px ${hpCol(g.enemyHP)}66` }} /></div>
                <span style={{ fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 700, color: hpCol(g.enemyHP), textShadow:`0 0 10px ${hpCol(g.enemyHP)}88` }}>{g.enemyHP} <span style={{ fontSize:9, color:"#604040", fontWeight:400 }}>HP</span></span>
              </div>
            </div>
          </div>
          {g.environment?.owner === "enemy" && <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 12px", background:`${g.environment.border}18`, border:`1px solid ${g.environment.border}33`, borderRadius:6, marginBottom:5, animation:"slideDown 0.3s" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:g.environment.border, boxShadow:`0 0 6px ${g.environment.border}`, animation:"pulse 2s infinite", flexShrink:0 }} />
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:g.environment.border, fontWeight:700, flexShrink:0 }}>{g.environment.name}</span>
            <span style={{ fontSize:10, color:"#a09068", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.environment.ability}</span>
            <span style={{ fontSize:10, color:"#806040", fontFamily:"'Cinzel',serif", flexShrink:0 }}>{Math.ceil((g.environment.turnsRemaining||4)/2)}R</span>
          </div>}
          {/* Enemy Lightning Meter */}
          {g.enemyZeusInPlay && (() => {
            const em = g.enemyLightningMeter||0; const full = em >= 2;
            return (
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, padding:"5px 10px", background:full?"rgba(255,220,0,0.13)":"rgba(255,220,0,0.04)", border:`1px solid rgba(255,220,0,${full?0.65:0.2})`, borderRadius:8, boxShadow:full?"0 0 14px rgba(255,210,0,0.4)":"none", transition:"all .3s" }}>
              <span style={{ fontSize:18, lineHeight:1, filter:full?"drop-shadow(0 0 6px #ffe040) drop-shadow(0 0 12px #f0a000)":"none", transition:"filter .3s" }}>⚡</span>
              <div style={{ display:"flex", gap:5 }}>
                {[0,1].map(i => { const lit = i < em; return (<div key={i} style={{ width:28, height:14, borderRadius:4, background: lit ? "linear-gradient(90deg,#fffaaa,#ffe030,#f09000)" : "rgba(60,50,0,0.45)", border:`1px solid ${lit?"#f0d020":"#2a1c00"}`, boxShadow: lit ? "0 0 10px #ffe040bb, inset 0 1px 0 rgba(255,255,200,0.4)" : "none", transition:"all .25s" }} />); })}
              </div>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:full?"#ffe040":"#a08820", fontWeight:700 }}>{full?"READY!":"ENEMY ⚡"}</span>
            </div>);
          })()}
          <div style={{ fontSize: 13, color: targetingSpell ? "#ffe040" : "#e05050", fontFamily: "'Cinzel',serif", letterSpacing: 3, marginBottom: 4, textAlign: "center", fontWeight: 700, textShadow: "0 -1px 0 rgba(255,255,255,0.3), 0 1px 4px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.8)" }}>{targetingSpell ? `⚡ CHOOSE TARGET — ${targetingSpell.name}` : "ENEMY FIELD"}</div>
          <div style={{ height:182, display:"flex", gap:8, flexWrap:"nowrap", justifyContent:"center", alignItems:"center", overflowX:"auto", overflowY:"visible", scrollbarWidth:"thin" }}>
            {g.enemyBoard.length === 0 ? <span style={{ fontSize: 10, color: "#241010", letterSpacing: 3 }}>---</span> : g.enemyBoard.map((c) => (<Token key={c.uid} c={resolveCardArt(c, {})} animType={animUids[c.uid]} isTarget={!!attacker || !!targetingSpell} canSelect={false} onClick={() => { if (targetingSpell) { playCard(targetingSpell, c.uid); } else if (attacker) { atkCreature(c); } else { SFX.play("ability"); setPreviewCard(c); } }} />))}
          </div>
        </div>
        {/* Centre divider with timer */}
        <div style={{ padding: "5px 14px", background: envTheme ? "rgba(0,0,0,0.35)" : "#0e0c08", borderBottom: "2px solid #3a1a0a", borderTop: "2px solid #1a3a0a", display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 2 }}>
          {g.phase === "player" && !aiThink ? (
            <TurnTimer key={timerKey} active={true} onExpire={endTurn} turnNum={g.turn}>
              {attCard ? (
                <button onClick={g.enemyBoard.length === 0 ? atkFace : undefined} style={{ padding: "3px 12px", background: g.enemyBoard.length === 0 ? "linear-gradient(135deg,#6a0808,#a01010)" : "rgba(255,255,255,0.04)", border: `1px solid ${g.enemyBoard.length === 0 ? "#e04040" : "#2a1a10"}`, borderRadius: 20, color: g.enemyBoard.length === 0 ? "#ffaaaa" : "#604030", fontFamily: "'Cinzel',serif", fontSize: 9, cursor: g.enemyBoard.length === 0 ? "pointer" : "default" }}>
                  {g.enemyBoard.length === 0 ? "STRIKE HERO" : "SELECT TARGET"}
                </button>
              ) : null}
            </TurnTimer>
          ) : (
            <>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(to right,transparent,#382e18)" }} />
              {attCard ? (
                <button onClick={g.enemyBoard.length === 0 ? atkFace : undefined} style={{ padding: "5px 16px", background: g.enemyBoard.length === 0 ? "linear-gradient(135deg,#6a0808,#a01010)" : "rgba(255,255,255,0.04)", border: `1px solid ${g.enemyBoard.length === 0 ? "#e04040" : "#2a1a10"}`, borderRadius: 20, color: g.enemyBoard.length === 0 ? "#ffaaaa" : "#604030", fontFamily: "'Cinzel',serif", fontSize: 9, cursor: g.enemyBoard.length === 0 ? "pointer" : "default" }}>
                  {g.enemyBoard.length === 0 ? "STRIKE HERO" : "SELECT TARGET"}
                </button>
              ) : (
                <span style={{ fontSize: 9, color: envTheme ? envTheme.glow + "88" : "#241a08", letterSpacing: 3, fontFamily: "'Cinzel',serif" }}>TURN {g.turn}</span>
              )}
              <div style={{ flex: 1, height: 1, background: "linear-gradient(to left,transparent,#382e18)" }} />
            </>
          )}
        </div>
        {/* Player zone */}
        <div style={{ background: "linear-gradient(180deg, rgba(20,100,10,0.22) 0%, rgba(30,130,15,0.28) 100%)", borderLeft: "3px solid #307030", padding: "7px 12px", position: "relative", zIndex: 2, boxShadow: "inset 0 6px 24px rgba(20,160,10,0.18), inset 3px 0 12px rgba(20,160,10,0.12)", flex:1, display:"flex", flexDirection:"column", overflow:"visible", minHeight:0 }}>
          {g.environment?.owner === "player" && <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 12px", background:`${g.environment.border}18`, border:`1px solid ${g.environment.border}33`, borderRadius:6, marginBottom:5, animation:"slideDown 0.3s" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:g.environment.border, boxShadow:`0 0 6px ${g.environment.border}`, animation:"pulse 2s infinite", flexShrink:0 }} />
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:g.environment.border, fontWeight:700, flexShrink:0 }}>{g.environment.name}</span>
            <span style={{ fontSize:10, color:"#a09068", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.environment.ability}</span>
            <span style={{ fontSize:10, color:"#806040", fontFamily:"'Cinzel',serif", flexShrink:0 }}>{Math.ceil((g.environment.turnsRemaining||4)/2)}R</span>
          </div>}
          <div style={{ fontSize: 13, color: dragOverField ? "#a0ff60" : "#6dc830", fontFamily: "'Cinzel',serif", letterSpacing: 3, marginBottom: 4, textAlign: "center", fontWeight: 700, textShadow: "0 -1px 0 rgba(255,255,255,0.3), 0 1px 4px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.8)", transition: "color .15s" }}>YOUR FIELD</div>
          <div
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverField(true); }}
            onDragLeave={() => setDragOverField(false)}
            onDrop={(e) => { e.preventDefault(); setDragOverField(false); const card = dragCardRef.current; if (card) playCard(card); dragCardRef.current = null; }}
            style={{ height:182, flex:"0 0 auto", display:"flex", gap:8, flexWrap:"nowrap", justifyContent:"center", alignItems:"center", overflowX:"auto", overflowY:"visible", scrollbarWidth:"thin", marginBottom:6, borderRadius:8, border: dragOverField ? "2px dashed #78cc4599" : "2px dashed transparent", background: dragOverField ? "rgba(100,200,50,0.07)" : "transparent", transition:"all .15s" }}>
            {g.playerBoard.length === 0 ? <span style={{ fontSize: 10, color: dragOverField ? "#78cc45" : "#181408", letterSpacing: 3 }}>{dragOverField ? "DROP TO PLAY" : "PLAY A CARD"}</span> : g.playerBoard.map((c) => (<Token key={c.uid} c={resolveCardArt(c, user?.selectedArts || {})} animType={animUids[c.uid]} selected={attacker === c.uid} isTarget={false} canSelect={g.phase === "player" && c.canAttack && !c.hasAttacked && !aiThink} onClick={() => selectAtt(c)} onRightClick={() => { SFX.play("ability"); setPreviewCard(c); }} />))}
          </div>
          <div style={{ paddingTop: 38, marginTop: -28, marginBottom: 6, flex:"0 0 auto", overflow:"visible", position:"relative", zIndex:10 }}>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "nowrap", overflow:"visible" }}>
              {g.playerHand.map((card) => { const isEnv = card.type === "environment"; const isSpl = card.type === "spell"; const eff = getEffectiveCost(card, g.environment, "player"); const cp = g.phase === "player" && !aiThink && (isEnv || isSpl || g.playerBoard.length < CFG.maxBoard) && (card.bloodpact ? card.cost < g.playerHP : eff <= g.playerEnergy); return (<HandCard key={card.uid} card={resolveCardArt({ ...card, cost: eff }, user?.selectedArts || {})} playable={cp} onClick={() => playCard(card)} onRightClick={() => { SFX.play("card_inspect"); setPreviewCard(card); }} onDragStart={(c) => { dragCardRef.current = c; }} />); })}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flex:"0 0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#4a9020,#6aab3a)", border: "2px solid #e8c06055", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cinzel',serif", fontSize: 12, fontWeight: 700, color: "#fff" }}>{user?.avatarUrl ? <img src={user.avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : (user?.name || "??").slice(0, 2).toUpperCase()}</div>
              <span style={{ fontSize: 10, color: "#e8c060", fontFamily: "'Cinzel',serif" }}>Deck: {g.playerDeck.length}</span>
              <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                <div style={{ width: 90, height: 10, background: "#080808", borderRadius: 5, overflow: "hidden", border:"1px solid #1a1a0a" }}><div style={{ height: "100%", width: `${Math.max(0,(g.playerHP / CFG.startHP) * 100)}%`, background: `linear-gradient(90deg, ${hpCol(g.playerHP)}99, ${hpCol(g.playerHP)})`, borderRadius:5, transition: "width .4s, background .5s", boxShadow:`0 0 8px ${hpCol(g.playerHP)}66` }} /></div>
                <span style={{ fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 700, color: hpCol(g.playerHP), textShadow:`0 0 10px ${hpCol(g.playerHP)}88` }}>{g.playerHP} <span style={{ fontSize:9, color:"#806040", fontWeight:400 }}>HP</span></span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 8, color: "#c0a060", fontFamily: "'Cinzel',serif" }}>ENERGY</span>
                <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>{Array.from({ length: g.maxEnergy }).map((_, i) => (<div key={i} style={{ width: 18, height: 22, background: i < g.playerEnergy ? "linear-gradient(160deg,#90e0ff 0%,#2090d0 45%,#1060a0 100%)" : "rgba(20,50,80,0.35)", borderRadius: "50% 50% 45% 45% / 40% 40% 60% 60%", border: `1px solid ${i < g.playerEnergy ? "#60c8ff88" : "#1a3a5a44"}`, boxShadow: i < g.playerEnergy ? "0 2px 8px #2090ff55, inset 0 1px 0 rgba(255,255,255,0.35)" : "none", transition: "all .25s" }} />))}</div>
                <span style={{ fontFamily: "'Cinzel',serif", fontSize: 10, color: "#60c8ff", fontWeight: 700 }}>{g.playerEnergy}/{g.maxEnergy}</span>
              </div>
              <button onClick={()=>{SFX.play("end_turn_go");endTurn();}} disabled={g.phase !== "player" || aiThink} style={{ padding: "8px 16px", background: g.phase === "player" && !aiThink ? "linear-gradient(135deg,#c89010,#f0c040)" : "rgba(255,255,255,0.04)", border: "none", borderRadius: 7, fontFamily: "'Cinzel',serif", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: g.phase === "player" && !aiThink ? "#1a1000" : "#404030", cursor: g.phase === "player" && !aiThink ? "pointer" : "not-allowed", boxShadow: g.phase==="player"&&!aiThink?"0 0 18px #e8c06044,0 4px 12px rgba(200,144,0,0.3)":"none", transition:"all .18s" }}>{aiThink ? "THINKING..." : "END TURN"}</button>
            </div>
          </div>
          {/* Lightning Meter — only shown when player has Zeus in deck */}
          {g.playerZeusInPlay && (() => {
            const pm = g.playerLightningMeter||0; const full = pm >= 2;
            return (
            <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:6, padding:"7px 14px", background:full?"rgba(255,220,0,0.13)":"rgba(255,220,0,0.04)", border:`1px solid rgba(255,220,0,${full?0.65:0.22})`, borderRadius:9, boxShadow:full?"0 0 18px rgba(255,210,0,0.45)":"none", transition:"all .3s", animation:full?"lightningReady 0.8s ease-in-out infinite":undefined }}>
              <span style={{ fontSize:22, lineHeight:1, filter:full?"drop-shadow(0 0 8px #ffe040) drop-shadow(0 0 16px #f0a000)":"drop-shadow(0 0 2px #a07800)", transition:"filter .3s" }}>⚡</span>
              <div style={{ display:"flex", gap:6 }}>
                {[0,1].map(i => { const lit = i < pm; return (<div key={i} style={{ width:36, height:16, borderRadius:5, background: lit ? "linear-gradient(90deg,#fffaaa,#ffe030,#f09000)" : "rgba(60,50,0,0.45)", border:`1px solid ${lit?"#f0d020":"#2a1c00"}`, boxShadow: lit ? "0 0 12px #ffe040cc, inset 0 1px 0 rgba(255,255,200,0.4)" : "none", transition:"all .3s" }} />); })}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
                <span style={{ fontFamily:"'Cinzel',serif", fontSize:8, color:"#f0d020bb", letterSpacing:2, fontWeight:700 }}>LIGHTNING</span>
                <span style={{ fontFamily:"'Cinzel',serif", fontSize:full?12:10, color:full?"#ffe040":"#a08820", fontWeight:700, transition:"all .2s" }}>{full?"READY!":pm+" / 2"}</span>
              </div>
            </div>);
          })()}
        </div>
      </div>
      {/* Sidebar log */}
      <div className="battle-log" style={{ display: "flex", flexDirection: "column", gap: 8, height:"100%", overflowY:"auto", minHeight:0 }}>
        {attCard && (<div style={{ background: `${attCard.border}15`, border: `1px solid ${attCard.border}55`, borderRadius: 10, padding: 10 }}><div style={{ fontFamily: "'Cinzel',serif", fontSize: 9, color: attCard.border, fontWeight: 600 }}>ATTACKING</div><div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, color: "#f0e8d8", fontWeight: 700 }}>{attCard.name}</div><div style={{ fontSize: 12, color: "#ff7050", fontWeight: 700 }}>ATK {attCard.currentAtk}</div><button onClick={() => setAttacker(null)} style={{ marginTop: 6, width: "100%", padding: "3px", background: "transparent", border: "1px solid #241408", borderRadius: 4, color: "#806040", fontFamily: "'Cinzel',serif", fontSize: 8, cursor: "pointer" }}>Cancel</button></div>)}
        <div style={{ background: "#080604", border: "1px solid #161408", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: 500 }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, color: "#c09048", letterSpacing: 3, padding: "8px 12px", borderBottom: "1px solid #281e08", fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>BATTLE LOG</div>
          <div ref={logRef} style={{ overflowY: "auto", padding: "8px 12px", maxHeight: 460 }}>{g.log.map((l, i) => {
            const col = logColor(l);
            const isLast = i === g.log.length - 1;
            // Highlight card names in log
            const parts = [];
            let remaining = l;
            for (const card of POOL) {
              if (remaining.includes(card.name)) {
                const idx = remaining.indexOf(card.name);
                if (idx > 0) parts.push({ text: remaining.slice(0, idx) });
                parts.push({ card });
                remaining = remaining.slice(idx + card.name.length);
              }
            }
            if (remaining) parts.push({ text: remaining });
            const rendered = parts.length > 1 ? parts.map((p, pi) => p.card
              ? <span key={pi} onClick={(e) => { e.stopPropagation(); SFX.play("card_inspect"); setPreviewCard(p.card); }} style={{ color: p.card.border, textDecoration: "underline", cursor: "pointer", fontWeight: 700 }}>{p.card.name}</span>
              : <span key={pi}>{p.text}</span>
            ) : l;
            return (<div key={i} style={{ fontSize: 11, lineHeight: 1.65, marginBottom: 4, color: col, borderLeft: isLast ? `2px solid ${col}` : "2px solid transparent", paddingLeft: 6, fontFamily: "'Cinzel',serif", fontWeight: isLast ? 700 : 400 }}>{logIcon(l)}{rendered}</div>);
          })}</div>
        </div>
      </div>
    </div>
  </div>);
}

// ═══ DECK BUILDER ═════════════════════════════════════════════
// ═══ STARTER DECK ════════════════════════════════════════════════════════════
// Valid 40-card starter deck using Common (3x) and Uncommon (2x) cards
const STARTER_DECK = (() => {
  const get = (id) => POOL.find(c => c.id === id);
  return [
    // Creatures (28)
    ...Array(3).fill(get("wolf")),       // Thornwood, Swift 3/2
    ...Array(3).fill(get("guard")),      // Thornwood, tanky 1/5
    ...Array(3).fill(get("shard")),      // Shattered Expanse, Swift 2/1
    ...Array(3).fill(get("shellguard")), // Azure Deep, Shield 1/4
    ...Array(3).fill(get("forgebot")),   // Ironmarch, 2/3
    ...Array(3).fill(get("falcon")),     // Sunveil, Swift 3/1
    ...Array(3).fill(get("imp")),        // Ashfen, 2/1
    ...Array(3).fill(get("sprite")),     // Ashfen, Bleed 1/2
    ...Array(2).fill(get("druid")),      // Thornwood Uncommon, healer 2/3
    ...Array(2).fill(get("wisp")),       // Shattered Expanse Uncommon, Echo 2/2
    // Spells (8)
    ...Array(3).fill(get("current")),    // Azure Deep Common — draw/heal
    ...Array(3).fill(get("shield_wall")),// Ironmarch Common — shield buff
    ...Array(2).fill(get("blood_pact")), // Bloodpact Uncommon — bloodpact spell
    // Environments (4 — meets Aura/Env cap)
    ...Array(2).fill(get("env_grove")),  // Thornwood Uncommon
    ...Array(2).fill(get("env_depths")), // Azure Deep Uncommon
  ].filter(Boolean);
})();

function DeckBuilderModal({ user, onSave, onClose, editDeck }) {
  const col = user?.collection || {};
  const selectedArts = user?.selectedArts || {};
  const deckPool = GAMEPLAY_POOL;
  const owned = deckPool;
  const isNew = !editDeck;
  const [deck, setDeck] = useState(() => editDeck ? [...editDeck.cards] : []);
  const [dbPreview, setDbPreview] = useState(null);
  const [errMsg, setErrMsg] = useState("");
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setDbPreview(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [deckName, setDeckName] = useState(editDeck ? editDeck.name : "Starter Deck");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [shakeId, setShakeId] = useState(null);
  const filtered = owned.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    return true;
  });

  // Deck counts
  const countInDeck = (card) => deck.filter((c) => c.id === card.id).length;
  const champCount = deck.filter(c => c.type === "champion").length;
  const auraEnvCount = deck.filter(c => c.type === "aura" || c.type === "environment").length;
  const total = deck.length;
  const canSave = total === CFG.deck.size;

  const addCard = (card) => {
    if (total >= CFG.deck.size) { setErrMsg(`Deck full (${CFG.deck.size}/${CFG.deck.size})`); return; }
    // Champions: max 1 copy of any specific champion, max 4 champions total
    if (card.type === "champion") {
      if (countInDeck(card) >= 1) { setErrMsg(`Champions are unique — only 1 copy of "${card.name}" allowed`); return; }
      if (champCount >= CFG.deck.maxChamp) { setErrMsg(`Champion cap reached (${champCount}/${CFG.deck.maxChamp})`); return; }
    } else {
      if (countInDeck(card) >= CFG.deck.copies) { setErrMsg(`Rule of 3: max ${CFG.deck.copies} copies of "${card.name}"`); return; }
    }
    if ((card.type === "aura" || card.type === "environment") && auraEnvCount >= CFG.deck.maxAuraEnv) { setErrMsg(`Aura/Environment cap reached (${auraEnvCount}/${CFG.deck.maxAuraEnv})`); return; }
    setErrMsg("");
    setDeck(d => [...d, card]);
    setShakeId(card.id); setTimeout(() => setShakeId(null), 380);
  };
  const removeCard = (idx) => { setErrMsg(""); setDeck(d => d.filter((_, i) => i !== idx)); };
  const save = () => { if (!canSave) return; onSave({ name: deckName, cards: deck }, editDeck?.index); onClose(); };

  const isBlocked = (c) => {
    if (total >= CFG.deck.size) return true;
    if (c.type === "champion") return countInDeck(c) >= 1 || champCount >= CFG.deck.maxChamp;
    if (countInDeck(c) >= CFG.deck.copies) return true;
    if ((c.type === "aura" || c.type === "environment") && auraEnvCount >= CFG.deck.maxAuraEnv) return true;
    return false;
  };

  const need = CFG.deck.size - total;
  const pct = (total / CFG.deck.size) * 100;

  return (<div style={{ position:"fixed", inset:0, zIndex:600, background:"rgba(2,1,0,0.97)", display:"flex", flexDirection:"column" }}>
    {dbPreview && <CardPreview card={dbPreview} onClose={() => setDbPreview(null)} />}
    {/* Header bar */}
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px", borderBottom:"2px solid #3a2c10", background:"linear-gradient(180deg,#1a1608,#0e0c06)", flexShrink:0, gap:12, flexWrap:"wrap" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <h3 style={{ fontFamily:"'Cinzel',serif", fontSize:18, color:"#e8c060", margin:0, letterSpacing:2 }}>⚒ {isNew ? "NEW DECK" : `EDIT: ${editDeck.name}`}</h3>
        <div style={{ display:"flex", gap:6, fontSize:10 }}>
          <span style={{ fontFamily:"'Cinzel',serif", padding:"5px 12px", fontSize:11, fontWeight:700, background:champCount>=CFG.deck.maxChamp?"rgba(240,192,64,0.25)":"rgba(232,160,20,0.12)", border:`2px solid ${champCount>=CFG.deck.maxChamp?"#f0c040":"#8a6020"}`, borderRadius:8, color:champCount>=CFG.deck.maxChamp?"#f0e060":"#c09040", letterSpacing:1, boxShadow:champCount>=CFG.deck.maxChamp?"0 0 12px #f0c04044":"none" }}>👑 {champCount}/{CFG.deck.maxChamp} CHAMPS · max 1 each</span>
          <span style={{ fontFamily:"'Cinzel',serif", padding:"3px 8px", background:auraEnvCount>=CFG.deck.maxAuraEnv?"rgba(40,180,120,0.22)":"rgba(40,180,120,0.12)", border:`1px solid ${auraEnvCount>=CFG.deck.maxAuraEnv?"#40c090":"#406050"}`, borderRadius:6, color:auraEnvCount>=CFG.deck.maxAuraEnv?"#40e0a0":"#70b090" }}>🌿 {auraEnvCount}/{CFG.deck.maxAuraEnv} Aura/Env</span>
          <span style={{ fontFamily:"'Cinzel',serif", padding:"3px 8px", background:canSave?"rgba(232,192,96,0.22)":"rgba(232,192,96,0.10)", border:`1px solid ${canSave?"#e8c060":"#806040"}`, borderRadius:6, color:canSave?"#e8c060":"#c09050" }}>📚 {total}/{CFG.deck.size}</span>
        </div>
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <input value={deckName} onChange={(e) => setDeckName(e.target.value)} placeholder="Deck name..." style={{ padding:"8px 12px", background:"#100e08", border:"1px solid #3a2810", borderRadius:8, color:"#f0e8d8", fontSize:12, outline:"none", fontFamily:"'Cinzel',serif", width:160 }} />
        <button onClick={save} disabled={!canSave} style={{ padding:"8px 20px", background:canSave?"linear-gradient(135deg,#c89010,#f0c040)":"rgba(255,255,255,0.06)", border:"none", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:11, fontWeight:700, letterSpacing:1, color:canSave?"#1a1000":"#403020", cursor:canSave?"pointer":"not-allowed" }}>
          SAVE ({total}/{CFG.deck.size})
        </button>
        <button onClick={onClose} style={{ padding:"8px 16px", background:"transparent", border:"1px solid #4a2010", borderRadius:8, color:"#806040", fontFamily:"'Cinzel',serif", fontSize:11, cursor:"pointer" }}>✕ CLOSE</button>
      </div>
    </div>

    {/* Main content */}
    <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", flex:1, overflow:"hidden" }}>
      {/* Card pool */}
      <div style={{ display:"flex", flexDirection:"column", overflow:"hidden", borderRight:"1px solid #2a2010" }}>
        <div style={{ padding:"10px 16px", borderBottom:"1px solid #2a1808", flexShrink:0, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cards..." style={{ flex:1, minWidth:120, padding:"8px 12px", background:"#100e08", border:"1px solid #2a2010", borderRadius:8, color:"#f0e8d8", fontSize:12, outline:"none" }} />
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{ padding:"8px 10px", background:"#100e08", border:"1px solid #2a2010", borderRadius:8, color:"#f0e8d8", fontSize:10, outline:"none", fontFamily:"'Cinzel',serif" }}>
            <option value="all">All Types</option>
            <option value="creature">Creatures</option>
            <option value="champion">Champions</option>
            <option value="spell">Spells</option>
            <option value="environment">Environments</option>
            <option value="aura">Auras</option>
          </select>
          <span style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#605030" }}>{filtered.length}</span>
        </div>
        <div style={{ overflowY:"auto", padding:"16px 20px", flex:1 }}>
          {filtered.length === 0
            ? <p style={{ color:"#604028", fontSize:13, textAlign:"center", marginTop:40 }}>Open packs and win battles to grow your collection!</p>
            : <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>
              {filtered.map((c, i) => {
                const inDeck = countInDeck(c);
                const blocked = isBlocked(c);
                return (
                  <div key={i} onClick={() => !blocked && addCard(c)} onContextMenu={(e) => { e.preventDefault(); setDbPreview(resolveCardArt(c, selectedArts)); }} style={{ position:"relative", cursor:blocked?"not-allowed":"pointer", opacity:blocked?0.35:1, transition:"opacity .2s", transform:"none" }}
                    onMouseEnter={e => { if (!blocked) e.currentTarget.style.transform="translateY(-4px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform="none"; }}>
                    <div style={{ animation: shakeId === c.id ? "deckCardShake 0.35s ease-out" : undefined, position:"relative" }}>
                      {(() => { const maxC = c.type==="champion" ? 1 : CFG.deck.copies; const left = maxC - inDeck; return left > 0 && left < maxC ? (<div style={{ position:"absolute", bottom:6, right:5, zIndex:10, fontFamily:"'Cinzel',serif", fontSize:11, fontWeight:900, color:"#e8c060", textShadow:"0 0 8px #e8c06088, 0 1px 3px rgba(0,0,0,0.95)", lineHeight:1 }}>{left}</div>) : null; })()}
                      <Card card={resolveCardArt(c, selectedArts)} size="sm" onClick={() => {}} />
                    </div>
                  </div>
                );
              })}
            </div>
          }
        </div>
      </div>

      {/* Deck list */}
      <div style={{ display:"flex", flexDirection:"column", overflow:"hidden", background:"linear-gradient(180deg,#0e0c06,#0a0806)" }}>
        <div style={{ padding:"14px 18px", borderBottom:"1px solid #2a2010", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:"#c09848", letterSpacing:2, fontWeight:700 }}>YOUR DECK — {total}/{CFG.deck.size} · <span style={{ color:"#60c0ff", fontWeight:700 }}>⚡{deck.reduce((s,c)=>s+(c.cost||0),0)} mana</span></div>
            {deck.length > 0 && <button onClick={() => { setErrMsg(""); setDeck([]); }} style={{ padding:"3px 10px", background:"rgba(180,40,20,0.12)", border:"1px solid #5a1810", borderRadius:6, fontFamily:"'Cinzel',serif", fontSize:8, color:"#a06040", cursor:"pointer", letterSpacing:1 }}>CLEAR ALL</button>}
          </div>
          {errMsg && <div style={{ fontSize:9, color:"#e06050", fontFamily:"'Cinzel',serif", marginBottom:4, letterSpacing:0.5 }}>⚠ {errMsg}</div>}
          {!canSave && <div style={{ fontSize:10, color:"#604028", marginBottom:4 }}>{need > 0 ? `Need ${need} more` : "At limit — remove a card"}</div>}
          <div style={{ height:4, background:"#1a1408", borderRadius:2, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${pct}%`, background: canSave ? "linear-gradient(90deg,#40c070,#80e0a0)" : "linear-gradient(90deg,#c89010,#f0c040)", transition:"width .3s", borderRadius:2 }} />
          </div>
        </div>
        <div style={{ overflowY:"auto", flex:1, padding:"10px 14px", display:"flex", flexDirection:"column", gap:4 }}>
          {deck.length === 0 && <p style={{ color:"#504030", fontSize:11, textAlign:"center", marginTop:30, fontStyle:"italic" }}>Click cards on the left to add them</p>}
          {deck.map((c, i) => {
            const dc = resolveCardArt(c, selectedArts);
            const typeColor = c.type==="champion"?"#f0c040":c.type==="environment"||c.type==="aura"?"#40c090":c.type==="spell"?"#c090d0":"#806040";
            return (
              <div key={i} onContextMenu={(e) => { e.preventDefault(); setDbPreview(dc); }} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(0,0,0,0.3)", borderRadius:7, padding:"4px 8px", border:`1px solid ${c.border}22`, gap:8, cursor:"context-menu" }}>
                <div style={{ width:30, height:42, borderRadius:4, overflow:"hidden", flexShrink:0, border:`1px solid ${c.border}44` }}>
                  <CardArt card={dc} />
                </div>
                <div style={{ width:18, height:18, borderRadius:"50%", background:"linear-gradient(160deg,#90e0ff,#1870a0)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',serif", fontWeight:900, fontSize:9, color:"#fff", flexShrink:0, boxShadow:"0 0 6px #2090ff88" }}>{c.cost||0}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#f0e0c8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</div>
                  <div style={{ fontSize:7, color:typeColor, fontFamily:"'Cinzel',serif", letterSpacing:0.5 }}>{(c.type||"creature").toUpperCase()}</div>
                </div>
                <button onClick={() => removeCard(i)} style={{ background:"rgba(180,60,40,0.15)", border:"1px solid #c0706055", borderRadius:5, color:"#e08060", fontSize:16, fontWeight:700, cursor:"pointer", lineHeight:1, flexShrink:0, width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </div>);
}

// ═══ PVP BATTLE SCREEN ═══════════════════════════════════════════════

// ═══ EMOTES ══════════════════════════════════════════════════════════════════
function PvpBattleScreen({ user, matchConfig, onExit, onUpdateUser, setInPvpMatch }) {
  const { matchId, opponentName, opponentId } = matchConfig;
  const [gs, setGs] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [attacker, setAttacker] = useState(null);
  const [previewCard, setPreviewCard] = useState(null);
  const [timerKey, setTimerKey] = useState(0);
  const [dragOverField, setDragOverField] = useState(false);
  const dragCardRef = useRef(null);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const wonSavedRef = useRef(false);
  const pollRef = useRef(null);
  const prevGsRef = useRef(null);
  const pvpBcRef = useRef(null);
  const drawDismissedRef = useRef(false);
  const [turnBanner, setTurnBanner] = useState(null);
  const [logHoverCard, setLogHoverCard] = useState(null);
  const [forfeitConfirm, setForfeitConfirm] = useState(false);
  const [profilePopup, setProfilePopup] = useState(null); // { id, name, avatar, rating, wins, losses, role }
  const [friendAdded, setFriendAdded] = useState(null); // id of recently added user
  const [dyingCards, setDyingCards] = useState([]); // cards mid-death animation
  const [connectError, setConnectError] = useState(false);
  const [liveAction, setLiveAction] = useState(null);
  const [pvpMatchResult, setPvpMatchResult] = useState(null);
  const [expandedSynGroup, setExpandedSynGroup] = useState(null);
  const [targetingSpell, setTargetingSpell] = useState(null);
  const flashAction = (msg) => { setLiveAction(msg); setTimeout(() => setLiveAction(null), 1800); };
  const showTurnBanner = (type) => { setTurnBanner(type); setTimeout(() => setTurnBanner(null), 1100); };
  const [animUids, setAnimUids] = useState({});
  const cardsPlayedRef = useRef(0);
  const lastOpMoveRef = useRef(Date.now());
  const [disconnectWarn, setDisconnectWarn] = useState(false);
  const vfx = useVFX();
  const logRef = useRef(null);
  const prevBoardUidsRef = useRef({ player: new Set(), enemy: new Set() });

  // Detect new board cards and trigger summoning animation
  useEffect(() => {
    if (!gs || !myRole) return;
    const ai = toAI(gs, myRole);
    const prev = prevBoardUidsRef.current;
    const newUids = {};
    ai.playerBoard.forEach(c => { if (!prev.player.has(c.uid)) newUids[c.uid] = "summoning"; });
    ai.enemyBoard.forEach(c => { if (!prev.enemy.has(c.uid)) newUids[c.uid] = "summoning"; });
    if (Object.keys(newUids).length > 0) {
      setAnimUids(p => ({ ...p, ...newUids }));
      setTimeout(() => setAnimUids(p => { const n = {...p}; Object.keys(newUids).forEach(u => delete n[u]); return n; }), 600);
    }
    prevBoardUidsRef.current = { player: new Set(ai.playerBoard.map(c=>c.uid)), enemy: new Set(ai.enemyBoard.map(c=>c.uid)) };
  }, [gs, myRole]); // eslint-disable-line

  // Mark nav as in-match so tabs are blocked; register forfeit for nav-leave auto-FF
  useEffect(() => {
    setInPvpMatch?.(true);
    return () => { setInPvpMatch?.(false); pvpForfeitRef.current = null; };
  }, []); // eslint-disable-line
  useEffect(() => { pvpForfeitRef.current = forfeit; }, [gs]); // keep closure fresh
  // Warn on browser refresh/close during active match
  useEffect(() => {
    if (gs?.winner) return; // match already over, no need to warn
    const handler = (e) => { e.preventDefault(); e.returnValue = "You have an active match. Leaving will forfeit."; return e.returnValue; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [gs?.winner]);

  // Save match history and stats when PvP ends (covers win, loss, and forfeit)
  useEffect(() => {
    if (!gs?.winner || !myRole || wonSavedRef.current) return;
    wonSavedRef.current = true;
    const won = gs.winner === myRole;
    const didForfeit = !won && (gs.log || []).some(l => typeof l === "string" && l.includes("forfeited"));
    SFX.play(won ? "victory" : "defeat");
    const isRanked = (matchConfig?.ranked === true) || (gs?.ranked === true);
    const myStoredRating = myRole === "p1" ? (gs?.p1Rating || user?.rankedRating || 1000) : (gs?.p2Rating || user?.rankedRating || 1000);
    const oppRating = myRole === "p1" ? (gs?.p2Rating || 1000) : (gs?.p1Rating || 1000);
    const ratingDelta = isRanked ? calcRatingDelta(myStoredRating, oppRating, won) : 0;
    const newRating = Math.max(0, (user?.rankedRating||1000) + ratingDelta);
    const opRole = myRole === "p1" ? "p2" : "p1";
    const histEntry = {
      opponent: opponentName, result: won ? "W" : "L",
      forfeit: didForfeit || undefined,
      opponentAvatar: gs[opRole+"Avatar"] || "",
      date: new Date().toISOString(), turns: gs.turn || 0,
      ranked: isRanked, ratingDelta: isRanked ? ratingDelta : undefined,
    };
    const newHistory = [histEntry, ...(user?.matchHistory || [])].slice(0, 50);
    // Quest tracking
    const shardsBase = won ? 25 : 10;
    const storedQuests = initDailyQuests(user?.dailyQuests);
    const types = ["played"];
    if (won) { types.push("wins"); if (!isRanked) types.push("caswin"); if (isRanked) types.push("rankwin"); }
    if (won && (gs.turn||0) < 8) types.push("fastwin");
    const myHPNow = myRole === "p1" ? (gs?.p1HP||0) : (gs?.p2HP||0);
    if (won && myHPNow >= 15) types.push("bigwin");
    const updatedQuests = applyQuestProgress(storedQuests, types);
    let questShards = 0;
    updatedQuests.quests.forEach((q, i) => { if (q.completed && !storedQuests.quests[i]?.completed) questShards += q.reward; });
    const questsGained = updatedQuests.quests.filter((q, i) => q.completed && !storedQuests.quests[i]?.completed);
    const update = {
      matchHistory: newHistory,
      battlesPlayed: (user?.battlesPlayed || 0) + 1,
      shards: (user?.shards || 0) + shardsBase + questShards,
      dailyQuests: updatedQuests,
    };
    if (won) update.battlesWon = (user?.battlesWon || 0) + 1;
    if (isRanked) {
      update.rankedRating = newRating;
      update.rankedWins = won ? (user?.rankedWins||0)+1 : (user?.rankedWins||0);
      update.rankedLosses = !won ? (user?.rankedLosses||0)+1 : (user?.rankedLosses||0);
    }
    if (onUpdateUser) onUpdateUser(update);
    setPvpMatchResult({ won, turns: gs.turn||0, cardsPlayed: cardsPlayedRef.current, hpLeft: myHPNow, shardsEarned: shardsBase + questShards, questsGained, ratingDelta: isRanked ? ratingDelta : null });
    // Clean up match row so stale data doesn't accumulate
    if (matchId) supabase.from("matches").delete().eq("id", matchId).then(() => {}).catch(() => {});
  }, [gs?.winner]); // eslint-disable-line

  // Convert DB state (p1/p2) to AI state format (player/enemy) from my perspective
  const toAI = (g, role) => {
    const me = role === "p1" ? "p1" : "p2", op = role === "p1" ? "p2" : "p1";
    // Per-player envs: player sees ONLY their own slot — no cross-player fallback
    const myEnv = g[me+"Env"] || null;
    return {
      turn: g.turn, winner: g.winner ? (g.winner === role ? "player" : "enemy") : null,
      phase: g.phase === role ? "player" : "enemy",
      playerHP: g[me+"HP"], playerEnergy: g[me+"Energy"], maxEnergy: g[me+"Max"],
      playerHand: g[me+"Hand"]||[], playerDeck: g[me+"Deck"]||[], playerBoard: g[me+"Board"]||[],
      enemyHP: g[op+"HP"], enemyHand: g[op+"Hand"]||[], enemyDeck: g[op+"Deck"]||[], enemyBoard: g[op+"Board"]||[],
      playerLightningMeter: g[me+"LightningMeter"]||0, enemyLightningMeter: g[op+"LightningMeter"]||0,
      playerZeusInPlay: g[me+"ZeusInPlay"]||false, enemyZeusInPlay: g[op+"ZeusInPlay"]||false,
      playerName: g[me+"Name"]||"You", enemyName: g[op+"Name"]||"Opponent",
      environment: myEnv, log: g.log||[]
    };
  };
  // Convert AI state format back to DB format
  const fromAI = (ai, role, orig) => {
    const me = role, op = role === "p1" ? "p2" : "p1";
    // Write env back to the per-player slot
    const envUpdate = ai.environment ? { [me+"Env"]: { ...ai.environment, envOwner: role } } : { [me+"Env"]: null };
    return {
      ...orig,
      ...envUpdate,
      // Keep legacy gs.env pointing to most recently played env for VFX compat
      env: ai.environment || orig[op+"Env"] || null,
      envOwner: ai.environment?.envOwner || orig[op+"Env"]?.envOwner || null,
      turn: ai.turn,
      phase: ai.phase === "player" ? role : op,
      winner: ai.winner === "player" ? role : (ai.winner === "enemy" ? op : null),
      [me+"HP"]: ai.playerHP, [me+"Energy"]: ai.playerEnergy, [me+"Max"]: ai.maxEnergy,
      [me+"Hand"]: ai.playerHand, [me+"Deck"]: ai.playerDeck, [me+"Board"]: ai.playerBoard,
      [op+"HP"]: ai.enemyHP, [op+"Hand"]: ai.enemyHand, [op+"Deck"]: ai.enemyDeck, [op+"Board"]: ai.enemyBoard,
      [me+"LightningMeter"]: ai.playerLightningMeter||0, [op+"LightningMeter"]: ai.enemyLightningMeter||0,
      log: ai.log,
    };
  };
  // Apply a PvP action client-side and return new DB-format game state
  const applyPvpAction = (gs, action, role, vfxInst) => {
    const op = role === "p1" ? "p2" : "p1";
    if (action.type === "play_card") {
      let ai = toAI(gs, role);
      const card = ai.playerHand.find(c => c.uid === action.cardUid);
      if (!card) return gs;
      const eff = getEffectiveCost(card, ai.environment);
      ai = { ...ai, playerHand: ai.playerHand.filter(c => c.uid !== card.uid), log: [...ai.log.slice(-20)] };
      if (card.bloodpact) { ai.playerHP -= card.cost; ai.log = [...ai.log, `Pay ${card.cost} HP: ${card.name}!`]; }
      else { ai.playerEnergy -= eff; }
      if (card.type === "environment") {
        // Per-player env: each player owns their slot, lasts 4 half-turns (2 full rounds)
        ai.environment = { ...card, owner: "player", envOwner: role, turnsRemaining: 2 }; ai.log = [...ai.log, `${(gs[role+"Name"]||role.toUpperCase())} plays ${card.name}! (2 rounds)`];
        ai = resolveEffects("onPlay", card, ai, "player", vfxInst);
        return fromAI(ai, role, gs);
      } else if (card.type === "spell") {
        ai.log = [...ai.log, `${(gs[role+"Name"]||"You")} casts ${card.name}!`];
      } else {
        const resBonus = (card.keywords||[]).includes("Resonate") ? ai.enemyBoard.length : 0;
        const inst = { ...makeInst(card, "pb"), canAttack: (card.keywords||[]).includes("Swift"), hasAttacked: false, currentAtk: card.atk + resBonus };
        ai.playerBoard = [...ai.playerBoard, inst]; ai.log = [...ai.log, `${(gs[role+"Name"]||"You")} plays ${card.name}!`];
        if ((card.keywords||[]).includes("Fracture") && ai.playerBoard.length < CFG.maxBoard) {
          ai.playerBoard = [...ai.playerBoard, { ...inst, uid: uid("pf"), shielded: false, currentHp: Math.ceil(card.hp/2), maxHp: Math.ceil(card.hp/2), currentAtk: Math.ceil(card.atk/2), name: card.name+" Frag", keywords: (card.keywords||[]).filter(k=>k!=="Fracture"), effects:[] }];
          ai.log = [...ai.log, "Fragment enters!"];
        }
        // Echo: add 1/1 ghost to hand immediately
        if ((card.keywords||[]).includes("Echo") && ai.playerHand.length < CFG.maxHand) {
          const ghost = { ...makeInst({ ...card, id: card.id+"_e", cost:1, hp:1, atk:1, keywords:[], effects:[] }, "p"), uid: uid("echo"), currentHp:1, maxHp:1, currentAtk:1, name: card.name+" Echo" };
          ai.playerHand = [...ai.playerHand, ghost]; ai.log = [...ai.log, `Echo: ${card.name} ghost enters hand!`];
        }
      }
      // Caffeine Catapult: first card each turn triggers Splat
      if (!gs.firstCardPlayedThisTurn && ai.playerBoard.some(c => c.id === "caffeine_catapult")) {
        const catTargets = ai.enemyBoard.filter(c => c.currentHp > 0);
        if (catTargets.length > 0) { const ct = catTargets[Math.floor(Math.random() * catTargets.length)]; ai.enemyBoard = ai.enemyBoard.map(c => c.uid === ct.uid ? { ...c, currentHp: c.currentHp - 1 } : c).filter(c => c.currentHp > 0); ai.log = [...ai.log, `💥 Catapult! ${ct.name} takes 1!`]; }
        else { ai.enemyHP -= 1; ai.log = [...ai.log, "💥 Catapult hits enemy face!"]; }
      }
      ai = resolveEffects("onPlay", card, ai, "player", vfxInst, action.targetUid ? { targetUid: action.targetUid } : {});
      if (ai.enemyHP <= 0) { ai.winner = "player"; ai.log = [...ai.log, "Victory!"]; }
      else if (ai.playerHP <= 0) { ai.winner = "enemy"; ai.log = [...ai.log, "Defeated..."]; }
      const out1 = fromAI(ai, role, gs);
      out1.firstCardPlayedThisTurn = true;
      return out1;
    } else if (action.type === "attack_creature") {
      let ai = toAI(gs, role);
      const att = ai.playerBoard.find(c => c.uid === action.attackerUid);
      const tgt = ai.enemyBoard.find(c => c.uid === action.targetUid);
      if (!att || !tgt) return gs;
      const av = att.currentAtk;
      let nTHP = tgt.shielded ? tgt.currentHp : tgt.currentHp - av;
      let nAHP = att.shielded ? att.currentHp : att.currentHp - tgt.currentAtk;
      ai.log = [...ai.log.slice(-20), `${att.name}(${av}) attacks ${tgt.name}`];
      if (tgt.shielded) ai.log = [...ai.log, `${tgt.name} shield absorbs!`];
      if (att.shielded) ai.log = [...ai.log, `${att.name} shield absorbs counter!`];
      ai.enemyBoard = ai.enemyBoard.map(c => c.uid === tgt.uid ? { ...c, currentHp: nTHP, shielded: false, bleed: (c.bleed||0)+((att.keywords||[]).includes("Bleed")?1:0) } : c).filter(c => c.currentHp > 0);
      ai.playerBoard = ai.playerBoard.map(c => c.uid === att.uid ? { ...c, hasAttacked: true, currentHp: nAHP, shielded: false } : c).filter(c => c.currentHp > 0);
      if (nTHP <= 0) { ai.log = [...ai.log, `💀 ${tgt.name} slain by ${att.name}!`]; ai = resolveEffects("onDeath", tgt, ai, "enemy", vfxInst); if (ai.enemyBoard.find(c=>c.id==="hades_soul_reaper")||ai.enemyHand.find(c=>c.id==="hades_soul_reaper")) { ai = resolveEffects("onFriendlyDeath",{id:"hades_soul_reaper",effects:[{trigger:"onFriendlyDeath",effect:"soul_harvest"}]},ai,"enemy",vfxInst); } }
      if (nAHP <= 0) { ai.log = [...ai.log, `💀 ${att.name} slain by ${tgt.name}!`]; ai = resolveEffects("onDeath", att, ai, "player", vfxInst); if (ai.playerBoard.find(c=>c.id==="hades_soul_reaper")||ai.playerHand.find(c=>c.id==="hades_soul_reaper")) { ai = resolveEffects("onFriendlyDeath",{id:"hades_soul_reaper",effects:[{trigger:"onFriendlyDeath",effect:"soul_harvest"}]},ai,"player",vfxInst); } }
      // onAttack triggers (spawn tokens, etc.)
      const attAfterCreature = ai.playerBoard.find(c => c.uid === action.attackerUid);
      if (attAfterCreature) ai = resolveEffects("onAttack", attAfterCreature, ai, "player", vfxInst);
      // Lightning meter: Swift attacker
      if (ai.playerZeusInPlay && (att.keywords||[]).includes("Swift")) {
        ai.playerLightningMeter = (ai.playerLightningMeter||0) + 1;
        if (ai.playerLightningMeter >= 2) { const pvpLog = []; ai = fireLightningMeter(ai, "player", null, m => pvpLog.push(m)); ai.log = [...ai.log.slice(-20), ...pvpLog]; }
      }
      if (ai.enemyHP <= 0) { ai.winner = "player"; ai.log = [...ai.log, "Victory!"]; }
      return fromAI(ai, role, gs);
    } else if (action.type === "attack_face") {
      let ai = toAI(gs, role);
      const att = ai.playerBoard.find(c => c.uid === action.attackerUid);
      if (!att) return gs;
      const dmg = att.currentAtk;
      ai.enemyHP -= dmg;
      ai.playerBoard = ai.playerBoard.map(c => c.uid === att.uid ? { ...c, hasAttacked: true } : c);
      ai.log = [...ai.log.slice(-20), `${att.name} deals ${dmg} direct!`];
      // onAttack triggers (spawn tokens, etc.)
      const attAfterFace = ai.playerBoard.find(c => c.uid === action.attackerUid);
      if (attAfterFace) ai = resolveEffects("onAttack", attAfterFace, ai, "player", vfxInst);
      // Lightning meter: Swift attacker face
      if (ai.playerZeusInPlay && (att.keywords||[]).includes("Swift")) {
        ai.playerLightningMeter = (ai.playerLightningMeter||0) + 1;
        if (ai.playerLightningMeter >= 2) { const pvpLog = []; ai = fireLightningMeter(ai, "player", null, m => pvpLog.push(m)); ai.log = [...ai.log.slice(-20), ...pvpLog]; }
      }
      if (ai.enemyHP <= 0) { ai.winner = "player"; ai.log = [...ai.log, "Victory!"]; }
      return fromAI(ai, role, gs);
    } else if (action.type === "end_turn") {
      const newTurn = gs.turn + 1;
      const newMax = Math.min(CFG.maxEnergy, newTurn);
      let s = { ...gs };
      // Fire env effect at end of current player's turn, then decrement
      if (s[role+"Env"]) {
        let roleAi = toAI(s, role);
        if (roleAi.environment) { roleAi = resolveEffects("onTurnStart", roleAi.environment, roleAi, "player", vfxInst); s = fromAI(roleAi, role, s); }
        const remaining = (s[role+"Env"].turnsRemaining || 2) - 1;
        if (remaining <= 0) {
          s[role+"Env"] = null;
          s.log = [...(s.log||[]).slice(-20), `${role.toUpperCase()} environment fades.`];
          if (s.env?.envOwner === role) s.env = s[op+"Env"] || null;
        } else {
          s[role+"Env"] = { ...s[role+"Env"], turnsRemaining: remaining };
        }
      }
      // End of player's turn: fire + clear bleed on OPPONENT's board only
      { s[op+"Board"]=(s[op+"Board"]||[]).map(c=>c.bleed>0?{...c,currentHp:c.currentHp-c.bleed,bleed:0}:c).filter(c=>c.currentHp>0); }
      // Check if bleed killed the hero
      if (!s.winner) { if ((s[role+"HP"]||20) <= 0) { s.winner = op; s.log = [...(s.log||[]).slice(-20), `${role} hero bled out!`]; } else if ((s[op+"HP"]||20) <= 0) { s.winner = role; s.log = [...(s.log||[]).slice(-20), `${op} hero bled out!`]; } }
      if (s.winner) return s;
      s[role+"Board"] = s[role+"Board"].map(c => ({ ...c, canAttack: true, hasAttacked: false }));
      s[op+"Board"] = s[op+"Board"].map(c => ({ ...c, canAttack: true, hasAttacked: false }));
      if ((s[op+"Deck"]||[]).length > 0 && (s[op+"Hand"]||[]).length < CFG.maxHand) {
        s[op+"Hand"] = [...s[op+"Hand"], makeInst(s[op+"Deck"][0], op)];
        s[op+"Deck"] = s[op+"Deck"].slice(1);
      } else if ((s[op+"Deck"]||[]).length === 0) {
        // Deck empty: increment fatigue and deal damage
        s[op+"Fatigue"] = (s[op+"Fatigue"]||0) + 1;
        s[op+"HP"] = (s[op+"HP"]||20) - s[op+"Fatigue"];
        s.log = [...(s.log||[]).slice(-20), `${op.toUpperCase()} deck empty — ${s[op+"Fatigue"]} fatigue damage!`];
        if (!s.winner && s[op+"HP"] <= 0) { s.winner = role; s.log = [...s.log, `${op} falls to fatigue!`]; }
      }
      if ((s[role+"Deck"]||[]).length === 0) {
        s[role+"Fatigue"] = (s[role+"Fatigue"]||0) + 1;
        s[role+"HP"] = (s[role+"HP"]||20) - s[role+"Fatigue"];
        s.log = [...(s.log||[]).slice(-20), `${role.toUpperCase()} deck empty — ${s[role+"Fatigue"]} fatigue damage!`];
        if (!s.winner && s[role+"HP"] <= 0) { s.winner = op; s.log = [...s.log, `${role} falls to fatigue!`]; }
      }
      s.turn = newTurn; s.phase = op;
      s[op+"Max"] = newMax; s[op+"Energy"] = newMax;
      s.firstCardPlayedThisTurn = false;
      s.log = [...(s.log||[]).slice(-20), `Turn ${newTurn}`];
      // Fire onTurnStart effects for the new active player's board (not env — env fires at their end_turn)
      let opAi = toAI(s, op);
      opAi.playerBoard.forEach(c => { if ((c.effects||[]).some(e => e.trigger === "onTurnStart")) opAi = resolveEffects("onTurnStart", c, opAi, "player", null); });
      // Food Fight synergy tier effects for the new active player (op)
      { const jaxRed = opAi.playerBoard.some(c => c.id === "master_jax") ? 1 : 0;
        const syn = getActiveSynergies(opAi.playerBoard, jaxRed);
        const addTag = (c, t) => ({ ...c, synTag: c.synTag ? c.synTag + " · " + t : t });
        opAi.playerBoard = opAi.playerBoard.map(c => ({ ...c, synTag: null }));
        if (syn.fruit.t2) { opAi.playerBoard = opAi.playerBoard.map(c => c.id === "berry_tooty" ? addTag({ ...c, currentHp: Math.min(c.maxHp, c.currentHp + 1) }, "🍎+HP") : c); }
        if (syn.fruit.t4) { opAi.playerBoard = opAi.playerBoard.map(c => c.id === "berry_tooty" ? addTag({ ...c, currentAtk: c.currentAtk + 1 }, "🍎+ATK") : c); }
        if (syn.fruit.t6) { opAi.playerBoard = opAi.playerBoard.map(c => (c.group||"").includes("Fruit") && !(c.keywords||[]).includes("Swift") ? addTag({ ...c, keywords: [...(c.keywords||[]), "Swift"], canAttack: true }, "🍎Swift") : c); }
        if (syn.veggie.t2) { opAi.playerBoard = opAi.playerBoard.map(c => (c.group||"").includes("Veggie") ? addTag({ ...c, currentAtk: c.currentAtk + 1, currentHp: c.currentHp + 1, maxHp: c.maxHp + 1 }, "🥦+1/+1") : c); }
        if (syn.veggie.t4) { opAi.playerBoard = opAi.playerBoard.map(c => (c.keywords||[]).includes("Anchor") ? c : addTag({ ...c, keywords: [...(c.keywords||[]), "Anchor"] }, "🥦Anchor")); }
        if (syn.veggie.t6) { opAi.enemyBoard = opAi.enemyBoard.map(c => ({ ...c, bleed: (c.bleed||0) + 1 })); }
        if (syn.protein.t2) { opAi.playerBoard = opAi.playerBoard.map(c => (c.group||"").includes("Protein") ? addTag({ ...c, currentAtk: c.currentAtk + 1 }, "🍖+ATK") : c); }
        if (syn.protein.t6) { opAi.playerBoard = opAi.playerBoard.map(c => (c.group||"").includes("Protein") && !(c.keywords||[]).includes("Bleed") ? addTag({ ...c, keywords: [...(c.keywords||[]), "Bleed"] }, "🍖Bleed") : c); }
        if (syn.sugar.t4) { opAi.playerBoard = opAi.playerBoard.map(c => (c.group||"").includes("Sugar") ? addTag({ ...c, currentAtk: c.currentAtk + 2 }, "🍬+2ATK") : c); }
        if (syn.sugar.t6) { opAi.playerBoard = opAi.playerBoard.map(c => addTag({ ...c, currentAtk: c.currentAtk + 3, currentHp: c.currentHp - 1 }, "🍬Crash")).filter(c => c.currentHp > 0); }
      }
      s = fromAI(opAi, op, s);
      return s;
    }
    return gs;
  };


  useEffect(() => {
    MusicCtx.play("battle");
    let channel = null;
    const setup = async () => {
      const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
      if (!match) { onExit(); return; }
      const role = match.player1_id === user.id ? "p1" : "p2";
      setMyRole(role);
      const fetchFresh = async () => {
        const { data: fresh } = await supabase.from("matches").select("game_state").eq("id", matchId).single();
        if (fresh?.game_state) {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          setGs(prev => ((fresh.game_state.seq||0) > (prev?.seq||-1)) ? fresh.game_state : prev);
        }
      };
      // Fast broadcast — use embedded gs if present to skip the DB re-fetch round-trip
      pvpBcRef.current = supabase.channel("pvp_bc_" + matchId)
        .on("broadcast", { event: "updated" }, (msg) => {
          if (msg?.payload?.gs) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            setGs(prev => ((msg.payload.gs.seq||0) > (prev?.seq||-1)) ? msg.payload.gs : prev);
          } else {
            fetchFresh();
          }
        })
        .subscribe();
      // postgres_changes as reliable fallback
      channel = supabase.channel("pvp_" + matchId)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, fetchFresh)
        .subscribe();
      if (match.game_state) { setGs(match.game_state); return; }
      if (role === "p1") {
        // Fetch opponent profile to store their rating for accurate ELO
        const oppId = match.player2_id;
        const { data: oppProfile } = oppId ? await supabase.from("profiles").select("ranked_rating").eq("id", oppId).single() : { data: null };
        const rfp = (c) => { const fresh = GAMEPLAY_POOL.find(p => p.id === c.id); return fresh ? { ...c, atk: fresh.atk, hp: fresh.hp, keywords: fresh.keywords, effects: fresh.effects, ability: fresh.ability } : c; };
        const p1Cards = matchConfig?.playerDeck?.length > 0 ? [...matchConfig.playerDeck] : buildRandomDeck(GAMEPLAY_POOL, user?.collection);
        const d1 = shuf(p1Cards.slice(0, CFG.deck.size).map(rfp));
        const d2 = shuf(buildRandomDeck(GAMEPLAY_POOL, getStarterCollection()));
        const dc = GAMEPLAY_POOL[Math.floor(Math.random() * GAMEPLAY_POOL.length)];
        const ec = GAMEPLAY_POOL[Math.floor(Math.random() * GAMEPLAY_POOL.length)];
        const firstPlayer = (dc.cost || 0) >= (ec.cost || 0) ? "p1" : "p2";
        const init = {
          turn: 1, phase: firstPlayer, winner: null, seq: 0,
          ranked: matchConfig?.ranked === true,
          p1Rating: user?.rankedRating || 1000,
          p2Rating: oppProfile?.ranked_rating ?? 1000,
          drawAnim: { p1Card: dc, p2Card: ec, first: firstPlayer },
          p1Arts: user?.selectedArts || {}, p1Avatar: user?.avatarUrl || "", p1Name: user?.name || "Player", p1Wins: user?.rankedWins||0, p1Losses: user?.rankedLosses||0,
          p1HP: CFG.startHP, p1Energy: CFG.startEnergy, p1Max: CFG.startEnergy,
          p1Hand: d1.slice(0, CFG.startHand).map((c) => makeInst(c, "p1")),
          p1Deck: d1.slice(CFG.startHand), p1Board: [],
          p2HP: CFG.startHP, p2Energy: CFG.startEnergy, p2Max: CFG.startEnergy,
          p2Hand: d2.slice(0, CFG.startHand).map((c) => makeInst(c, "p2")),
          p2Deck: d2.slice(CFG.startHand), p2Board: [],
          p1Env: null, p2Env: null, env: null,
          p1LightningMeter: 0, p2LightningMeter: 0,
          p1ZeusInPlay: d1.some(c => c.id === "zeus_storm_father"), p2ZeusInPlay: false,
          log: [firstPlayer === "p1" ? `Match started! ${user?.name||"P1"} goes first.` : `Match started! ${oppProfile?.name||"P2"} goes first.`]
        };
        await supabase.from("matches").update({ game_state: init }).eq("id", matchId);
        setGs(init);
      } else {
        // P2 polling fallback — Realtime may miss the UPDATE if P1 wrote before we subscribed
        let attempts = 0;
        pollRef.current = setInterval(async () => {
          attempts++;
          if (attempts > 25) { clearInterval(pollRef.current); pollRef.current = null; setConnectError(true); return; }
          const { data: fresh } = await supabase.from("matches").select("game_state").eq("id", matchId).single();
          if (fresh?.game_state) {
            clearInterval(pollRef.current); pollRef.current = null;
            const p2Cards = matchConfig?.playerDeck?.length > 0 ? [...matchConfig.playerDeck] : buildRandomDeck(GAMEPLAY_POOL, user?.collection);
            const p2d = shuf(p2Cards.slice(0, CFG.deck.size).map(c => { const fresh = GAMEPLAY_POOL.find(p => p.id === c.id); return fresh ? { ...c, atk: fresh.atk, hp: fresh.hp, keywords: fresh.keywords, effects: fresh.effects, ability: fresh.ability } : c; }));
            const withArts = { ...fresh.game_state, p2Arts: user?.selectedArts || {}, p2Avatar: user?.avatarUrl || "", p2Name: user?.name || "Player", p2Rating: user?.rankedRating||1000, p2Wins: user?.rankedWins||0, p2Losses: user?.rankedLosses||0,
              p2Hand: p2d.slice(0, CFG.startHand).map((c) => makeInst(c, "p2")),
              p2Deck: p2d.slice(CFG.startHand),
              p2ZeusInPlay: p2d.some(c => c.id === "zeus_storm_father") };
            await supabase.from("matches").update({ game_state: withArts }).eq("id", matchId);
            setGs(withArts);
          }
        }, 1200);
      }
    };
    setup();
    return () => { if (channel) supabase.removeChannel(channel); if (pvpBcRef.current) supabase.removeChannel(pvpBcRef.current); if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } MusicCtx.play("home"); };
  }, [matchId]);

  useEffect(() => { if (logRef.current) logRef.current.scrollTo({ top: 99999, behavior: "smooth" }); }, [gs?.log]);

  // Track opponent's last move for disconnect detection
  useEffect(() => {
    if (gs && myRole && gs.phase !== myRole && !gs.winner) lastOpMoveRef.current = Date.now();
    if (gs?.winner) setDisconnectWarn(false);
  }, [gs?.seq]); // eslint-disable-line
  // Disconnect detection: if opponent's turn > 90s, show claim-victory UI
  useEffect(() => {
    if (!gs || !myRole || gs.winner) return;
    const interval = setInterval(() => {
      const isOppTurn = gs.phase !== myRole;
      if (isOppTurn && Date.now() - lastOpMoveRef.current > 90000) setDisconnectWarn(true);
      else setDisconnectWarn(false);
    }, 10000);
    return () => clearInterval(interval);
  }, [gs, myRole]); // eslint-disable-line

  // Animate opponent actions + show turn banner when gs changes
  useEffect(() => {
    if (!gs || !myRole) { prevGsRef.current = gs; return; }
    const prev = prevGsRef.current;
    if (prev && prev.phase !== myRole && gs.phase === myRole && !gs.winner) { showTurnBanner("YOUR TURN"); SFX.play("ability"); setTimerKey(k => k + 1); }
    else if (prev && prev.phase === myRole && gs.phase !== myRole && !gs.winner) { showTurnBanner("OPPONENT'S TURN"); setTimerKey(k => k + 1); }
    if (prev && prev.phase !== myRole) {
      const prevAi = toAI(prev, myRole), currAi = toAI(gs, myRole);
      const anims = {};
      currAi.enemyBoard.forEach(c => { if (!prevAi.enemyBoard.find(p => p.uid === c.uid)) { anims[c.uid] = "summoning"; vfx.add("summonBurst", { color: c.border||"#e8c060", duration:700 }); } });
      // Store dying cards so we can render them during death animation
      const dying = [];
      prevAi.enemyBoard.forEach(c => { if (!currAi.enemyBoard.find(n => n.uid === c.uid)) { anims[c.uid] = "dying"; dying.push({ ...c, _side:"enemy" }); } });
      prevAi.playerBoard.forEach(c => { if (!currAi.playerBoard.find(n => n.uid === c.uid)) { anims[c.uid] = "dying"; dying.push({ ...c, _side:"player" }); } });
      if (dying.length > 0) { setDyingCards(dying); setTimeout(() => setDyingCards([]), 750); }
      prevAi.playerBoard.forEach(c => { const cur = currAi.playerBoard.find(n => n.uid === c.uid); if (cur && cur.currentHp < c.currentHp && !anims[c.uid]) anims[c.uid] = "hit"; });

      const newEntries = (gs.log||[]).slice((prev.log||[]).length);

      // Opponent VFX: environment change
      if (gs.env?.id !== prev.env?.id && gs.env) { vfx.add("envchange", { color: gs.env.border||"#40a020" }); vfx.add("environment", { color: gs.env.border, duration:2200 }); SFX.play("env_play"); }

      // Opponent VFX: spell cast — color by effect type
      const spellEntries = newEntries.filter(l => l.includes("casts ") || l.includes("Cast ") || l.includes("spell"));
      spellEntries.forEach(l => {
        const color = /heal|restore|mend/i.test(l) ? "#40c060" : /damage|blast|burn|fire|bolt/i.test(l) ? "#e05030" : "#c090d0";
        vfx.add("spell", { color, duration:1100 });
        SFX.play("ability");
      });
      // Opponent VFX: card played (new summon)
      const newSummons = currAi.enemyBoard.filter(c => !prevAi.enemyBoard.find(p => p.uid === c.uid));
      if (newSummons.length > 0) { SFX.play("card"); }

      // Opponent VFX: heal (detect HP gain)
      const opHPKey = (myRole==="p1"?"p2":"p1")+"HP";
      if (gs[opHPKey] > prev[opHPKey]) { vfx.add("heal", { amount: gs[opHPKey]-prev[opHPKey] }); SFX.play("heal"); }

      // Receiving damage: my HP dropped — show floating damage text
      const myHPKey = myRole+"HP";
      const hpDrop = (prev[myHPKey]||0) - (gs[myHPKey]||0);
      if (hpDrop > 0) {
        vfx.add("damage", { amount: hpDrop, duration: 1200 });
        vfx.add("faceAttack", { duration: 600 });
        SFX.play("attack");
      }
      // My HP healed from opponent effect
      const myHPGain = (gs[myHPKey]||0) - (prev[myHPKey]||0);
      if (myHPGain > 0) { vfx.add("heal", { amount: myHPGain }); SFX.play("heal"); }

      // Opponent attack sequence: parse creature attacks and face attacks
      const atkEntries = newEntries.filter(l => / attacks /.test(l));
      const directEntries = newEntries.filter(l => / deals .* direct/.test(l));
      const allAtkEntries = [...atkEntries, ...directEntries];

      let delay = 0;
      allAtkEntries.forEach(atkEntry => {
        const isFace = / deals .* direct/.test(atkEntry);
        const m = isFace
          ? atkEntry.match(/^(.+?) deals/)
          : atkEntry.match(/^(.+?)\(\d+\) attacks (.+?)(?:\s|$)/);
        if (!m) return;
        const atkName = m[1].trim();
        const tgtName = isFace ? null : m[2].trim();
        const atkCard = prevAi.enemyBoard.find(c => c.name === atkName);
        const tgtCard = tgtName ? prevAi.playerBoard.find(c => c.name === tgtName) : null;
        setTimeout(() => {
          SFX.play("attack");
          if (atkCard) setAnimUids(p => ({ ...p, [atkCard.uid]: "attacking-down" }));
          setTimeout(() => {
            if (tgtCard) {
              setAnimUids(p => ({ ...p, ...(atkCard?{[atkCard.uid]:"attacking-down"}:{}), [tgtCard.uid]: "hit" }));
              vfx.add("attackImpact", { duration:650 });
              SFX.play("attack");
            } else {
              // face attack — dramatic screen impact
              vfx.add("faceAttack", { duration:900 });
              SFX.play("attack");
            }
            setTimeout(() => {
              if (atkCard) setAnimUids(p => { const n={...p}; delete n[atkCard.uid]; return n; });
              if (tgtCard) setAnimUids(p => { const n={...p}; delete n[tgtCard.uid]; return n; });
            }, 500);
          }, 380);
        }, delay);
        delay += 950;
      });

      if (Object.keys(anims).length > 0) {
        const hasDying = Object.values(anims).includes("dying");
        const atkDelay = allAtkEntries.length * 950;
        setTimeout(() => {
          setAnimUids(p => ({ ...p, ...anims }));
          if (hasDying) { SFX.play("kill"); vfx.add("creatureDie", { color:"#e06040", duration:800 }); }
          setTimeout(() => setAnimUids(p => {
            const n = {...p};
            Object.keys(anims).forEach(k => delete n[k]);
            return n;
          }), 750);
        }, atkDelay);
      }

      // VFX: my creature healed
      const myHealedCard = currAi.playerBoard.find(c => { const prev = prevAi.playerBoard.find(p=>p.uid===c.uid); return prev && c.currentHp > prev.currentHp; });
      if (myHealedCard) { SFX.play("heal"); }

      // Summon animation: newly appeared board cards
      const myNewCards = currAi.playerBoard.filter(c => !prevAi.playerBoard.find(p => p.uid === c.uid));
      const opNewCards = currAi.enemyBoard.filter(c => !prevAi.enemyBoard.find(p => p.uid === c.uid));
      const summonAnims = {};
      myNewCards.forEach(c => { summonAnims[c.uid] = "summoning"; });
      opNewCards.forEach(c => { summonAnims[c.uid] = "summoning"; });
      if (Object.keys(summonAnims).length > 0) {
        setAnimUids(p => ({ ...p, ...summonAnims }));
        setTimeout(() => setAnimUids(p => { const n = {...p}; Object.keys(summonAnims).forEach(k => delete n[k]); return n; }), 550);
      }
    }
    prevGsRef.current = gs;
  }, [gs]); // eslint-disable-line

  const invokeAction = async (action) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true); setAttacker(null);
    let newGs;
    try {
      newGs = { ...applyPvpAction(gs, action, myRole, vfx), seq: (gs.seq||0)+1 };
      setGs(newGs); // optimistic — UI responds instantly
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
    if (!newGs) return;
    try {
      await supabase.from("matches").update({ game_state: newGs }).eq("id", matchId);
      if (pvpBcRef.current) pvpBcRef.current.send({ type:"broadcast", event:"updated", payload:{ gs: newGs } });
    } catch (err) {
      console.error("PvP action failed:", err);
    }
  };
  const isMyTurn = gs && myRole && gs.phase === myRole && !gs.winner;

  const playCard = (card, targetUid = null) => {
    if (!isMyTurn || syncingRef.current) return;
    cardsPlayedRef.current += 1;
    const ai = toAI(gs, myRole);
    const canAfford = card.bloodpact ? card.cost < ai.playerHP : getEffectiveCost(card, ai.environment) <= ai.playerEnergy;
    if (!canAfford) return;
    if (card.type !== "spell" && card.type !== "environment" && ai.playerBoard.length >= CFG.maxBoard) return;
    // Enter targeting mode for spells that need a target
    if (card.type === "spell" && !targetUid) {
      const needsTarget = (card.effects || []).some(e => TARGETED_SPELL_EFFECTS.includes(e.effect));
      if (needsTarget && ai.enemyBoard.length > 0) { setTargetingSpell(card); return; }
    }
    SFX.play(card.type === "environment" ? "env_play" : card.type === "spell" ? "ability" : "card");
    if (card.type === "environment") { vfx.add("envchange", { color: card.border || "#40a020" }); vfx.add("environment", { color: card.border, duration: 2000 }); }
    if (card.type === "spell") vfx.add("spell", { color: card.border || "#c090d0" });
    flashAction(`${card.type === "spell" ? "Cast" : card.type === "environment" ? "Field:" : "Play"} ${card.name}!`);
    setTargetingSpell(null);
    invokeAction({ type: "play_card", cardUid: card.uid, targetUid });
  };

  const selectAtt = (c) => { if (!isMyTurn || syncingRef.current) return; setAttacker(attacker === c.uid ? null : (c.canAttack && !c.hasAttacked ? c.uid : attacker)); };

  const atkCreature = async (tgt) => {
    if (!attacker || !isMyTurn || syncingRef.current) return;
    SFX.play("attack");
    const attUid = attacker;
    const attCard2 = toAI(gs, myRole).playerBoard.find(c => c.uid === attUid);
    if (attCard2) flashAction(`${attCard2.name} attacks ${tgt.name}!`);
    setAnimUids({ [attUid]: "attacking" });
    await new Promise(r => setTimeout(r, 220));
    setAnimUids(p => ({ ...p, [tgt.uid]: "hit" }));
    await new Promise(r => setTimeout(r, 180));
    // Compute result to find dying cards before committing state
    let newGs;
    try {
      newGs = { ...applyPvpAction(gs, { type: "attack_creature", attackerUid: attUid, targetUid: tgt.uid }, myRole, vfx), seq: (gs.seq||0)+1 };
    } catch (err) { console.error("atkCreature compute failed:", err); return; }
    const aiOld = toAI(gs, myRole), aiNew = toAI(newGs, myRole);
    const dyingUids = {};
    aiOld.playerBoard.forEach(c => { if (!aiNew.playerBoard.find(n => n.uid === c.uid)) dyingUids[c.uid] = "dying"; });
    aiOld.enemyBoard.forEach(c => { if (!aiNew.enemyBoard.find(n => n.uid === c.uid)) dyingUids[c.uid] = "dying"; });
    if (Object.keys(dyingUids).length > 0) { SFX.play("kill"); setAnimUids(p => ({ ...p, ...dyingUids })); await new Promise(r => setTimeout(r, 500)); }
    syncingRef.current = true; setSyncing(true); setAttacker(null);
    setGs(newGs); // optimistic
    syncingRef.current = false; setSyncing(false);
    try { await supabase.from("matches").update({ game_state: newGs }).eq("id", matchId); if (pvpBcRef.current) pvpBcRef.current.send({ type:"broadcast", event:"updated", payload:{ gs: newGs } }); } catch (err) { console.error("PvP action failed:", err); }
    await new Promise(r => setTimeout(r, 200));
    setAnimUids({});
  };

  const atkFace = async () => {
    if (!attacker || !isMyTurn || syncingRef.current) return;
    SFX.play("attack");
    const attUid = attacker;
    const attCard2 = toAI(gs, myRole).playerBoard.find(c => c.uid === attUid);
    if (attCard2) flashAction(`${attCard2.name} hits ${opponentName || "opponent"} directly!`);
    setAnimUids({ [attUid]: "attacking" });
    await new Promise(r => setTimeout(r, 280));
    invokeAction({ type: "attack_face", attackerUid: attUid });
    await new Promise(r => setTimeout(r, 400));
    setAnimUids({});
  };

  const endTurn = () => {
    if (!isMyTurn || syncingRef.current) return;
    SFX.play("timer_end");
    setTimerKey((k) => k + 1);
    invokeAction({ type: "end_turn" });
  };

  const forfeit = async () => {
    const op = myRole === "p1" ? "p2" : "p1";
    const newGs = { ...gs, winner: op, seq: (gs.seq||0)+1, log: [...(gs.log||[]).slice(-20), `${user?.name||"Player"} forfeited.`] };
    setForfeitConfirm(false);
    setGs(newGs); // optimistic
    try {
      await supabase.from("matches").update({ game_state: newGs }).eq("id", matchId);
      if (pvpBcRef.current) pvpBcRef.current.send({ type:"broadcast", event:"updated", payload:{ gs: newGs } });
      // Allow a moment for the opponent to read the forfeit state, then clean up
      setTimeout(() => { if (matchId) supabase.from("matches").delete().eq("id", matchId).catch(() => {}); }, 5000);
    } catch (err) { console.error("Forfeit failed:", err); }
    // History/stats are saved by the gs?.winner useEffect which fires when gs updates
  };

  if (!gs || !myRole) return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"80px 24px", textAlign:"center" }}>
      {connectError ? (<>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:18, color:"#e05050", marginBottom:12 }}>CONNECTION FAILED</div>
        <p style={{ fontSize:12, color:"#a09070", marginBottom:24, lineHeight:1.7 }}>Could not connect to Player 1's match. The match may have expired or there was a network issue.</p>
        <button onClick={onExit} style={{ padding:"10px 28px", background:"linear-gradient(135deg,#3a1010,#5a1818)", border:"1px solid #c0202055", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:11, color:"#e08080", cursor:"pointer" }}>BACK TO LOBBY</button>
      </>) : (<>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:18, color:"#e8c060", animation:"pulse 1.5s infinite" }}>CONNECTING...</div>
        <p style={{ fontSize:12, color:"#a09070", marginTop:12, lineHeight:1.7 }}>
          {myRole === "p2" || !myRole ? "Waiting for Player 1 to initialize the match..." : "Setting up the board..."}
        </p>
        <button onClick={onExit} style={{ marginTop:24, padding:"8px 20px", background:"transparent", border:"1px solid #3a2010", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:10, color:"#806040", cursor:"pointer" }}>CANCEL</button>
      </>)}
    </div>
  );

  const ai = toAI(gs, myRole);
  const attCard = attacker ? ai.playerBoard.find((c) => c.uid === attacker) : null;
  const opRole = myRole === "p1" ? "p2" : "p1";
  const myEnvCard = gs[myRole+"Env"] || null;
  const opEnvCard = gs[opRole+"Env"] || null;
  const myEnvTheme = myEnvCard ? ENV_THEMES[myEnvCard.region] || null : null;
  const opEnvTheme = opEnvCard ? ENV_THEMES[opEnvCard.region] || null : null;
  const envTheme = myEnvTheme || opEnvTheme;
  const myWon = gs.winner === myRole;
  const oppWon = gs.winner && gs.winner !== myRole;

  const CARD_NAMES_SORTED = [...new Set(POOL.map(c=>c.name))].sort((a,b)=>b.length-a.length);
  const renderLogLine = (text, key) => {
    const parts = []; let rem = text; let ki=0;
    while (rem.length > 0) {
      let found=false;
      for (const nm of CARD_NAMES_SORTED) {
        const idx=rem.indexOf(nm);
        if (idx!==-1) { if(idx>0) parts.push(<span key={ki++}>{rem.slice(0,idx)}</span>); const cd=POOL.find(c=>c.name===nm); parts.push(<span key={ki++} style={{color:cd?.border||"#c0a040",fontWeight:700,cursor:"pointer",borderBottom:"1px dotted currentColor"}} onClick={(e)=>{e.stopPropagation();if(cd){SFX.play("card_inspect");setPreviewCard(p=>p?.id===cd.id?null:cd);}}}>{nm}</span>); rem=rem.slice(idx+nm.length); found=true; break; }
      }
      if (!found) { parts.push(<span key={ki++}>{rem}</span>); rem=""; }
    }
    return <span key={key}>{parts}</span>;
  };
  return (<div className="battle-wrapper" style={{ width:"100%", height:"calc(100vh - 72px)", padding:"8px 14px 6px", background:"#0a0806", boxSizing:"border-box", overflow:"hidden", display:"flex", flexDirection:"column" }} onClick={() => { SFX.init(); }}>
    {previewCard && <CardPreview card={previewCard} onClose={() => setPreviewCard(null)} />}
    {/* Forfeit confirm */}
    {/* In-battle profile popup */}
    {profilePopup && (<div style={{ position:"fixed", inset:0, zIndex:620, background:"rgba(0,0,0,0.82)", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={()=>setProfilePopup(null)}>
      <div style={{ background:"linear-gradient(160deg,#1c1a0e,#0e0c06)", border:"1px solid #4a3a18", borderRadius:18, padding:"28px 36px", minWidth:280, textAlign:"center", boxShadow:"0 30px 80px rgba(0,0,0,0.98), 0 0 0 1px #3a2c10", animation:"fadeIn 0.2s ease-out" }} onClick={e=>e.stopPropagation()}>
        {/* Avatar */}
        <div style={{ width:72, height:72, borderRadius:"50%", overflow:"hidden", margin:"0 auto 14px", border:"2px solid #e8c06077", background:"#1a1610", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',serif", fontSize:26, color:"#e8c060", boxShadow:"0 4px 20px rgba(0,0,0,0.6)" }}>
          {profilePopup.avatar ? <img src={profilePopup.avatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : (profilePopup.name||"?").slice(0,2).toUpperCase()}
        </div>
        {/* Name */}
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:17, fontWeight:700, color:"#f0d878", marginBottom:3, letterSpacing:1 }}>{profilePopup.name || "Unknown"}</div>
        {/* Rank badge */}
        {(() => { const r = profilePopup.rating||1000; const rank = r>=1800?"💎 DIAMOND":r>=1600?"🔮 PLATINUM":r>=1400?"🥇 GOLD":r>=1200?"🥈 SILVER":r>=1000?"🥉 BRONZE":"⚔ IRON"; return <div style={{ fontSize:10, color:"#c0a040", fontFamily:"'Cinzel',serif", letterSpacing:2, marginBottom:16, opacity:0.8 }}>{rank}</div>; })()}
        {/* Stats row */}
        <div style={{ display:"flex", gap:0, justifyContent:"center", marginBottom:16, background:"rgba(255,255,255,0.03)", borderRadius:10, overflow:"hidden", border:"1px solid #2a2010" }}>
          <div style={{ flex:1, padding:"12px 8px", borderRight:"1px solid #2a2010" }}>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:20, fontWeight:700, color:"#78cc45", lineHeight:1 }}>{profilePopup.wins||0}</div>
            <div style={{ fontSize:8, color:"#50602e", letterSpacing:2, marginTop:4, fontFamily:"'Cinzel',serif" }}>WINS</div>
          </div>
          {profilePopup.losses != null && <div style={{ flex:1, padding:"12px 8px", borderRight:"1px solid #2a2010" }}>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:20, fontWeight:700, color:"#e05050", lineHeight:1 }}>{profilePopup.losses}</div>
            <div style={{ fontSize:8, color:"#603030", letterSpacing:2, marginTop:4, fontFamily:"'Cinzel',serif" }}>LOSSES</div>
          </div>}
          <div style={{ flex:1, padding:"12px 8px" }}>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:20, fontWeight:700, color:"#60c8ff", lineHeight:1 }}>{profilePopup.rating||1000}</div>
            <div style={{ fontSize:8, color:"#305060", letterSpacing:2, marginTop:4, fontFamily:"'Cinzel',serif" }}>RATING</div>
          </div>
        </div>
        {profilePopup.role === "opp" && profilePopup.id && (
          <button onClick={async () => {
            if (friendAdded === profilePopup.id) return;
            await supabase.from("friendships").upsert([{
              requester: user.id, accepter: profilePopup.id,
              status: "pending"
            }], { onConflict: "requester,accepter", ignoreDuplicates: true });
            setFriendAdded(profilePopup.id);
          }} style={{ padding:"8px 20px", background: friendAdded===profilePopup.id ? "rgba(120,200,69,0.1)" : "linear-gradient(135deg,#1a3a08,#2a5a10)", border:`1px solid ${friendAdded===profilePopup.id?"#78cc4566":"#4a8020"}`, borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:10, color: friendAdded===profilePopup.id ? "#78cc45" : "#a0e060", cursor: friendAdded===profilePopup.id ? "default":"pointer", letterSpacing:1, marginBottom:8, width:"100%" }}>
            {friendAdded===profilePopup.id ? "✓ REQUEST SENT" : "⚉ ADD FRIEND"}
          </button>
        )}
        <button onClick={()=>setProfilePopup(null)} style={{ padding:"8px 24px", background:"transparent", border:"1px solid #3a2010", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:10, color:"#806040", cursor:"pointer", letterSpacing:1 }}>CLOSE</button>
      </div>
    </div>)}
    {forfeitConfirm && (<div style={{ position:"fixed", inset:0, zIndex:600, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={()=>setForfeitConfirm(false)}>
      <div style={{ background:"#120a06", border:"1px solid #c04020", borderRadius:14, padding:"28px 36px", textAlign:"center", maxWidth:320 }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:32, marginBottom:8 }}>🏳️</div>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:16, color:"#e8c060", fontWeight:700, marginBottom:8 }}>FORFEIT MATCH?</div>
        <p style={{ fontSize:11, color:"#a09070", marginBottom:20 }}>Your opponent wins the match. This cannot be undone.</p>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={forfeit} style={{ padding:"9px 22px", background:"linear-gradient(135deg,#8a0808,#c01010)", border:"none", borderRadius:7, fontFamily:"'Cinzel',serif", fontSize:11, color:"#ffcccc", cursor:"pointer", fontWeight:700 }}>FORFEIT</button>
          <button onClick={()=>setForfeitConfirm(false)} style={{ padding:"9px 22px", background:"transparent", border:"1px solid #3a2010", borderRadius:7, fontFamily:"'Cinzel',serif", fontSize:11, color:"#806040", cursor:"pointer" }}>CANCEL</button>
        </div>
      </div>
    </div>)}
    {/* Disconnect warning */}
    {disconnectWarn && !gs.winner && (
      <div style={{ position:"fixed", inset:0, zIndex:550, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center", animation:"fadeIn 0.3s" }}>
        <div style={{ background:"#120a06", border:"1px solid #e8c06055", borderRadius:14, padding:"32px 40px", textAlign:"center", maxWidth:340 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>⚡</div>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:16, color:"#e8c060", fontWeight:700, marginBottom:8, letterSpacing:2 }}>OPPONENT MAY HAVE DISCONNECTED</div>
          <p style={{ fontSize:11, color:"#907060", marginBottom:24, lineHeight:1.7 }}>No activity from {opponentName||"your opponent"} in 90+ seconds. You may claim victory or continue waiting.</p>
          <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
            <button onClick={async () => { const newGs = { ...gs, winner: myRole, seq: (gs.seq||0)+1, log: [...(gs.log||[]).slice(-20), `${opponentName||"Opponent"} disconnected.`] }; setGs(newGs); try { await supabase.from("matches").update({ game_state: newGs }).eq("id", matchId); } catch(_){} }} style={{ padding:"10px 22px", background:"linear-gradient(135deg,#1a5a08,#2a8010)", border:"none", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:11, color:"#a0e060", cursor:"pointer", fontWeight:700, letterSpacing:1 }}>CLAIM VICTORY</button>
            <button onClick={() => { lastOpMoveRef.current = Date.now(); setDisconnectWarn(false); }} style={{ padding:"10px 22px", background:"transparent", border:"1px solid #3a2010", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:11, color:"#806040", cursor:"pointer" }}>KEEP WAITING</button>
          </div>
        </div>
      </div>
    )}
    {/* Opening draw overlay — coin flip result */}
    {gs?.drawAnim && !gs.winner && !drawDismissedRef.current && (<div style={{ position:"fixed", inset:0, zIndex:500, background:"rgba(0,0,0,0.92)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20, animation:"fadeIn 0.4s" }}>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:13, color:"#a09060", letterSpacing:5 }}>COIN FLIP</div>
      <div style={{ width:120, height:120, borderRadius:"50%", background:"radial-gradient(circle at 35% 35%,#ffe060,#c89010,#7a5000)", boxShadow:"0 0 40px #f0c04088,0 8px 24px rgba(0,0,0,0.8)", border:"3px solid #ffe06088", display:"flex", alignItems:"center", justifyContent:"center", animation:"pulse 2s infinite", fontSize:48 }}>{gs.drawAnim.first===myRole?"⚔":"🛡"}</div>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:700, color:gs.drawAnim.first===myRole?"#78cc45":"#e05050", letterSpacing:2, animation:"pulse 1s infinite" }}>{gs.drawAnim.first===myRole?"YOU GO FIRST!":"OPPONENT GOES FIRST"}</div>
      <div style={{ fontSize:11, color:"#806040", fontFamily:"'Cinzel',serif", letterSpacing:2 }}>{gs.drawAnim.first===myRole?(user?.name||"YOU"):(opponentName||"OPPONENT")} wins the flip</div>
      <button onClick={() => { drawDismissedRef.current = true; setGs(g => ({ ...g, drawAnim: null })); }} style={{ marginTop:8, padding:"10px 28px", background:"linear-gradient(135deg,#c89010,#f0c040)", border:"none", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:12, fontWeight:700, color:"#1a1000", cursor:"pointer", letterSpacing:2 }}>BEGIN BATTLE</button>
    </div>)}
    {/* Fullscreen turn announcement */}
    {turnBanner && (<div style={{ position:"fixed", inset:0, display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, pointerEvents:"none" }}>
      <div style={{ animation:"turnStamp 1.3s ease-out forwards", display:"flex", flexDirection:"column", alignItems:"center", gap:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:4 }}>
          <div style={{ height:1, width:80, background:`linear-gradient(90deg,transparent,${turnBanner==="YOUR TURN"?"#78cc45":"#e05050"})` }} />
          <span style={{ fontFamily:"'Cinzel',serif", fontSize:9, letterSpacing:5, color:turnBanner==="YOUR TURN"?"#78cc4588":"#e0505088" }}>FORGE &amp; FABLE</span>
          <div style={{ height:1, width:80, background:`linear-gradient(270deg,transparent,${turnBanner==="YOUR TURN"?"#78cc45":"#e05050"})` }} />
        </div>
        <div style={{ background:turnBanner==="YOUR TURN"?"linear-gradient(135deg,#071a02 0%,#0d2804 50%,#071a02 100%)":"linear-gradient(135deg,#1a0202 0%,#280404 50%,#1a0202 100%)", border:`2px solid ${turnBanner==="YOUR TURN"?"#78cc45":"#e05050"}`, borderRadius:6, padding:"12px 48px", textAlign:"center", position:"relative", overflow:"hidden", boxShadow:`0 0 50px ${turnBanner==="YOUR TURN"?"#78cc4533":"#e0505033"}` }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:24, fontWeight:900, color:turnBanner==="YOUR TURN"?"#78cc45":"#e05050", letterSpacing:6, textShadow:`0 0 24px ${turnBanner==="YOUR TURN"?"#78cc45":"#e05050"}, 0 2px 4px rgba(0,0,0,0.9)`, lineHeight:1 }}>{turnBanner}</div>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, letterSpacing:3, color:turnBanner==="YOUR TURN"?"#78cc4588":"#e0505088", marginTop:5 }}>{turnBanner==="YOUR TURN"?"COMMAND YOUR FORCES":`${(opponentName||"OPPONENT").toUpperCase()} IS MOVING`}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:4 }}>
          <div style={{ height:1, width:80, background:`linear-gradient(90deg,transparent,${turnBanner==="YOUR TURN"?"#78cc45":"#e05050"})` }} />
          <div style={{ width:6, height:6, borderRadius:"50%", background:turnBanner==="YOUR TURN"?"#78cc45":"#e05050", boxShadow:`0 0 12px ${turnBanner==="YOUR TURN"?"#78cc45":"#e05050"}`, animation:"pulse 0.8s infinite" }} />
          <div style={{ height:1, width:80, background:`linear-gradient(270deg,transparent,${turnBanner==="YOUR TURN"?"#78cc45":"#e05050"})` }} />
        </div>
      </div>
    </div>)}
    {/* Live action flash */}
    {liveAction && (<div style={{ position:"fixed", top:"38%", left:"50%", transform:"translateX(-50%)", zIndex:290, pointerEvents:"none", animation:"fadeIn 0.15s" }}>
      <div style={{ background:"rgba(10,8,4,0.92)", border:`2px solid ${logColor(liveAction)}`, borderRadius:12, padding:"12px 28px", fontFamily:"'Cinzel',serif", fontSize:16, fontWeight:700, color:logColor(liveAction), letterSpacing:1, whiteSpace:"nowrap", boxShadow:`0 4px 28px ${logColor(liveAction)}55` }}>
        {logIcon(liveAction)}{liveAction}
      </div>
    </div>)}
    {/* Top bar: centered turn status */}
    {!gs.winner && (<div style={{ display:"flex", justifyContent:"center", alignItems:"center", marginBottom:6 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ width:7, height:7, borderRadius:"50%", background:isMyTurn?"#78cc45":"#e8c060", boxShadow:`0 0 8px ${isMyTurn?"#78cc45":"#e8c060"}`, animation:"pulse 1.5s infinite" }} />
        <span style={{ fontFamily:"'Cinzel',serif", fontSize:14, fontWeight:700, letterSpacing:2, color:isMyTurn?"#78cc45":"#e8c060", textShadow:"0 1px 6px rgba(0,0,0,0.9)" }}>{isMyTurn ? "YOUR TURN" : `${(opponentName||"OPP").toUpperCase()}'S TURN`}</span>
        {syncing && <span style={{ fontSize:8, color:"#806040", fontFamily:"'Cinzel',serif" }}>SYNC…</span>}
      </div>
    </div>)}
    {gs.winner && pvpMatchResult && (<div style={{ position:"fixed", inset:0, zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", background: myWon?"rgba(2,12,1,0.95)":"rgba(12,2,2,0.95)", animation:"fadeIn 0.5s" }}>
      <div style={{ textAlign:"center", maxWidth:460, width:"100%", padding:"0 20px" }}>
        <div style={{ fontSize:72, marginBottom:8, animation:"pulse 1.2s ease-in-out infinite" }}>{myWon?"✨":"💀"}</div>
        <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:52, fontWeight:900, color:myWon?"#78cc45":"#e05050", margin:"0 0 4px", textShadow:`0 0 60px ${myWon?"#78cc45":"#e05050"}, 0 4px 12px rgba(0,0,0,0.9)`, letterSpacing:8 }}>{myWon?"VICTORY":"DEFEATED"}</h2>
        <p style={{ fontFamily:"'Cinzel',serif", fontSize:13, color:"#807060", marginBottom:20, letterSpacing:2 }}>{myWon?`You defeated ${opponentName}!`:`${opponentName} wins this round.`}</p>
        {/* Stats grid */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16, background:"rgba(255,255,255,0.03)", border:"1px solid #2a2010", borderRadius:12, padding:"14px 12px" }}>
          {[["TURNS", pvpMatchResult.turns, "#e8c060"], ["CARDS PLAYED", pvpMatchResult.cardsPlayed, "#c090ff"], ["HP LEFT", myWon ? pvpMatchResult.hpLeft : "—", myWon ? "#78cc45" : "#604030"]].map(([l,v,c]) => (
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:900, color:c, lineHeight:1 }}>{v}</div>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:8, color:"#504028", letterSpacing:2, marginTop:5 }}>{l}</div>
            </div>
          ))}
        </div>
        {/* Shards + rating */}
        <div style={{ display:"grid", gridTemplateColumns: pvpMatchResult.ratingDelta != null ? "1fr 1fr" : "1fr", gap:8, marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, background:"rgba(160,184,200,0.07)", border:"1px solid #2a3a4a", borderRadius:10, padding:"10px 16px" }}>
            <span style={{ fontSize:18 }}>⬙</span>
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:18, fontWeight:900, color:"#a0b8c8" }}>+{pvpMatchResult.shardsEarned}</span>
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#506070", letterSpacing:1 }}>SHARDS</span>
          </div>
          {pvpMatchResult.ratingDelta != null && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, background: pvpMatchResult.ratingDelta >= 0 ? "rgba(120,200,69,0.07)" : "rgba(200,80,80,0.07)", border:`1px solid ${pvpMatchResult.ratingDelta >= 0 ? "#78cc4533" : "#e0505033"}`, borderRadius:10, padding:"10px 16px" }}>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:18, fontWeight:900, color: pvpMatchResult.ratingDelta >= 0 ? "#78cc45" : "#e05050" }}>{pvpMatchResult.ratingDelta >= 0 ? "+" : ""}{pvpMatchResult.ratingDelta}</span>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#506070", letterSpacing:1 }}>MMR</span>
            </div>
          )}
        </div>
        {/* Quest completions */}
        {pvpMatchResult.questsGained.length > 0 && (
          <div style={{ marginBottom:16, background:"rgba(120,200,69,0.06)", border:"1px solid #78cc4533", borderRadius:10, padding:"10px 16px" }}>
            {pvpMatchResult.questsGained.map(q => (
              <div key={q.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 0" }}>
                <span style={{ fontSize:14 }}>✓</span>
                <span style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#78cc45", flex:1, textAlign:"left" }}>{q.label}</span>
                <span style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#a0b8c8" }}>+{q.reward} shards</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={onExit} style={{ padding:"13px 48px", background:"linear-gradient(135deg,#c89010,#f0c040)", border:"none", borderRadius:10, fontFamily:"'Cinzel',serif", fontWeight:700, fontSize:13, letterSpacing:2, color:"#1a1000", cursor:"pointer", boxShadow:"0 0 24px #e8c06066" }}>EXIT</button>
      </div>
    </div>)}
    <div className="battle-grid" style={{ display:"grid", gridTemplateColumns:"300px 1fr 340px", gap:14, flex:1, minHeight:0 }}>
      {/* Left Panel — Synergy Tracker + Chat */}
      <div className="battle-side" style={{ display:"flex", flexDirection:"column", gap:6, height:"100%", overflowY:"auto", minHeight:0 }}>
        {/* Food Fight Synergy Tracker */}
        {(() => {
          const jaxRed = ai.playerBoard.some(c => c.id === "master_jax") ? 1 : 0;
          const syn = getActiveSynergies(ai.playerBoard, jaxRed);
          const hasFoodFight = ai.playerBoard.some(c => c.region === "Food Fight") || ai.playerHand.some(c => c.region === "Food Fight");
          if (!hasFoodFight) return null;
          const GROUP_COLOR = { Fruit:"#ff8040", Veggie:"#50c040", Protein:"#e08020", Sugar:"#d040b0" };
          const GROUP_ICON  = { Fruit:"🍎", Veggie:"🥦", Protein:"🍖", Sugar:"🍬" };
          const GROUP_DESCS = {
            Fruit:   { t2:"Berry & Tooty heals +1 HP each turn", t4:"Berry & Tooty gains +1 ATK each turn", t6:"All Fruit units gain Swift" },
            Veggie:  { t2:"All Veggie units gain +1/+1 each turn", t4:"All friendly units gain Anchor", t6:"All enemy units gain Bleed" },
            Protein: { t2:"All Protein units gain +1 ATK each turn", t4:"Splat deals 2 dmg instead of 1", t6:"All Protein units gain Bleed" },
            Sugar:   { t2:"First unit played each turn gains Swift", t4:"All Sugar units gain +2 ATK each turn", t6:"+3 ATK & -1 HP to all (Sugar Crash)" },
          };
          const jaxNote = jaxRed > 0 ? " (Jax -1)" : "";
          return (
            <div style={{ background:"rgba(10,8,4,0.95)", border:"2px solid #604018", borderRadius:10, padding:"10px 12px", fontSize:10, fontFamily:"'Cinzel',serif", boxShadow:"0 0 16px rgba(200,100,20,0.18)" }}>
              <div style={{ color:"#f0b040", letterSpacing:3, marginBottom:8, fontSize:11, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
                <span>🍽</span><span>GROUP SYNERGY</span>{jaxRed > 0 && <span style={{ fontSize:8, color:"#b08030", fontWeight:400 }}>Jax: thresholds -1</span>}
              </div>
              {Object.entries(syn.counts).map(([grp, cnt]) => {
                const active = syn[grp.toLowerCase()];
                const col = GROUP_COLOR[grp];
                const isExpanded = expandedSynGroup === grp;
                const descs = GROUP_DESCS[grp];
                const thresholds = [2,4,6];
                const hasAny = cnt > 0;
                return (
                  <div key={grp} style={{ marginBottom: isExpanded ? 8 : 4 }}>
                    <div onClick={() => setExpandedSynGroup(isExpanded ? null : grp)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3, cursor:"pointer", padding:"3px 4px", borderRadius:5, background: isExpanded ? `${col}18` : "transparent", transition:"background .2s" }}>
                      <span style={{ color: hasAny ? col : "#503020", fontWeight: hasAny ? 700 : 400, fontSize:13 }}>{GROUP_ICON[grp]} {grp}</span>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ color: hasAny ? col : "#503020", fontWeight:700, fontSize:13 }}>{cnt}</span>
                        <span style={{ color: hasAny ? col : "#503020", fontSize:8 }}>{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:2, marginBottom: isExpanded ? 5 : 0 }}>
                      {thresholds.map(t => {
                        const isActive = active?.[`t${t}`];
                        const thresh = Math.max(1, t - jaxRed);
                        return <div key={t} style={{ flex:1, height:6, borderRadius:3, background: isActive ? col : "rgba(255,255,255,0.06)", boxShadow: isActive ? `0 0 8px ${col}aa` : "none", transition:"all .3s", cursor:"pointer" }} title={`T${t} (${thresh}): ${descs[`t${t}`]}`} />;
                      })}
                    </div>
                    {isExpanded && (
                      <div style={{ paddingLeft:4 }}>
                        {thresholds.map(t => {
                          const isActive = active?.[`t${t}`];
                          const thresh = Math.max(1, t - jaxRed);
                          return (
                            <div key={t} style={{ display:"flex", alignItems:"flex-start", gap:5, marginBottom:3, opacity: isActive ? 1 : 0.45 }}>
                              <span style={{ color: isActive ? col : "#604020", fontWeight:700, fontSize:9, minWidth:18, paddingTop:1 }}>T{t}</span>
                              <span style={{ color: isActive ? "#e0d0a0" : "#604020", fontSize:9, lineHeight:1.4 }}>
                                {thresh} {grp}: {descs[`t${t}`]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
        {/* Opponent Food Fight Synergy Tracker */}
        {(() => {
          const opBoard = ai.enemyBoard;
          const opHand = ai.enemyHand;
          const hasFoodFight = opBoard.some(c => c.region === "Food Fight") || opHand.some(c => c.region === "Food Fight");
          if (!hasFoodFight) return null;
          const jaxRed = opBoard.some(c => c.id === "master_jax") ? 1 : 0;
          const syn = getActiveSynergies(opBoard, jaxRed);
          const GROUP_COLOR = { Fruit:"#ff8040", Veggie:"#50c040", Protein:"#e08020", Sugar:"#d040b0" };
          const GROUP_ICON  = { Fruit:"🍎", Veggie:"🥦", Protein:"🍖", Sugar:"🍬" };
          return (
            <div style={{ background:"rgba(10,4,4,0.95)", border:"2px solid #601818", borderRadius:10, padding:"10px 12px", fontSize:10, fontFamily:"'Cinzel',serif", boxShadow:"0 0 16px rgba(200,40,20,0.18)" }}>
              <div style={{ color:"#e06040", letterSpacing:3, marginBottom:8, fontSize:9, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
                <span>🍽</span><span>OPP SYNERGY</span>
              </div>
              {Object.entries(syn.counts).map(([grp, cnt]) => {
                const active = syn[grp.toLowerCase()];
                const col = GROUP_COLOR[grp];
                const thresholds = [2,4,6];
                const hasAny = cnt > 0;
                return (
                  <div key={grp} style={{ marginBottom:4 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                      <span style={{ color: hasAny ? col : "#503020", fontWeight: hasAny ? 700 : 400, fontSize:13 }}>{GROUP_ICON[grp]} {grp}</span>
                      <span style={{ color: hasAny ? col : "#503020", fontWeight:700, fontSize:13 }}>{cnt}</span>
                    </div>
                    <div style={{ display:"flex", gap:2 }}>
                      {thresholds.map(t => { const isActive = active?.[`t${t}`]; return <div key={t} style={{ flex:1, height:6, borderRadius:3, background: isActive ? col : "rgba(255,255,255,0.06)", boxShadow: isActive ? `0 0 8px ${col}aa` : "none", transition:"all .3s" }} />; })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
        <div style={{ height:200, overflow:"hidden" }}><BattleChat user={user} aiMode={false} matchId={matchId} /></div>
        <div style={{ display:"flex", gap:4, paddingTop:4 }}>
          <button onClick={onExit} style={{ flex:1, padding:"8px 4px", background:"rgba(180,40,20,0.15)", border:"1px solid #5a1810", borderRadius:8, color:"#a06040", fontFamily:"'Cinzel',serif", fontSize:10, cursor:"pointer", letterSpacing:1 }}>⬅ EXIT</button>
          {!gs?.winner && <button onClick={()=>setForfeitConfirm(true)} style={{ flex:1, padding:"8px 4px", background:"rgba(120,10,10,0.15)", border:"1px solid #8a2020", borderRadius:8, color:"#e05050", fontFamily:"'Cinzel',serif", fontSize:10, cursor:"pointer", letterSpacing:1 }}>🏳 FF</button>}
          <button onClick={()=>{ const el=document.documentElement; if(!document.fullscreenElement){el.requestFullscreen?.();}else{document.exitFullscreen?.();} }} style={{ flex:1, padding:"8px 4px", background:"rgba(14,12,8,0.8)", border:"1px solid #604028aa", borderRadius:8, color:"#a08050", fontFamily:"'Cinzel',serif", fontSize:13, cursor:"pointer" }} title="Fullscreen">⛶</button>
        </div>
      </div>
      <div style={{ background: envTheme ? envTheme.bg : "linear-gradient(180deg,#2a1c0c 0%,#1e1408 50%,#281a08 100%)", border:`1px solid ${envTheme?envTheme.glow+"44":"#5a3c1a55"}`, borderRadius:14, overflow:"visible", position:"relative", transition:"background 1.5s ease, border-color 1s ease", boxShadow: envTheme ? undefined : "inset 0 0 60px rgba(0,0,0,0.4), 0 0 0 1px #3a2010", display:"flex", flexDirection:"column", height:"100%" }}>
        {envTheme && <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:1 }}><FloatingParticles count={20} color={envTheme.particle} speed={0.6} /></div>}
        <VFXOverlay effects={vfx.effects} />
        {/* Dying cards overlay — renders cards mid-death animation so they don't pop out */}
        {dyingCards.length > 0 && (
          <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:55, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            {dyingCards.map(c => (
              <div key={c.uid} style={{ width:90, height:126, borderRadius:8, overflow:"hidden", border:`2px solid ${c.border}88`, animation:"cardDie 0.75s ease-out forwards", position:"relative", opacity:1, flexShrink:0 }}>
                <div style={{ position:"absolute", inset:0 }}><CardArt card={c} /></div>
                <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top,rgba(4,2,0,0.9) 0%,rgba(4,2,0,0.6) 35%,transparent 65%)" }} />
                <div style={{ position:"absolute", bottom:4, left:0, right:0, textAlign:"center", fontFamily:"'Cinzel',serif", fontSize:8, color:"#fff", fontWeight:700, textShadow:"0 0 6px #000" }}>{c.name}</div>
              </div>
            ))}
          </div>
        )}
        {/* Opponent zone — use opponent's env theme */}
        <div style={{ background: opEnvTheme ? opEnvTheme.bg : "rgba(180,30,20,0.22)", borderBottom:"2px solid #8a2010", borderLeft:"3px solid #c03020", padding:"7px 12px", position:"relative", zIndex:2, transition:"background 1.5s ease", boxShadow:"inset 0 -6px 24px rgba(200,40,20,0.14), inset 3px 0 12px rgba(200,40,20,0.1)", flex:"0 0 auto" }}>
          {opEnvTheme && <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:1 }}><FloatingParticles count={opEnvTheme.pCount||20} color={opEnvTheme.particle} speed={opEnvTheme.pSpeed||0.6} shape={opEnvTheme.pShape||"circle"} direction={opEnvTheme.pDir||"up"} /></div>}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div onClick={()=>setProfilePopup({ id:opponentId, name:opponentName, avatar:myRole==="p1"?gs?.p2Avatar:gs?.p1Avatar, role:"opp", rating:myRole==="p1"?gs?.p2Rating:gs?.p1Rating, wins:myRole==="p1"?gs?.p2Wins:gs?.p1Wins, losses:myRole==="p1"?gs?.p2Losses:gs?.p1Losses })} style={{ width:36, height:36, borderRadius:"50%", background:"linear-gradient(135deg,#3a0c0c,#200808)", border:"2px solid #a0202044", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:"#cc6666", fontFamily:"'Cinzel',serif", fontWeight:700, cursor:"pointer", transition:"border-color .18s", boxShadow:"none" }} title="View profile">
                {(myRole==="p1" ? gs?.p2Avatar : gs?.p1Avatar) ? <img src={myRole==="p1" ? gs.p2Avatar : gs.p1Avatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : (opponentName||"?").slice(0,2).toUpperCase()}
              </div>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:14, color:"#cc4848", letterSpacing:2, fontWeight:700, textShadow:"0 1px 4px rgba(0,0,0,0.8)" }}>{(opponentName||"OPPONENT").toUpperCase()}</span>
              <div style={{ display:"flex", gap:2 }}>{Array.from({length:ai.enemyHand.length}).map((_,i)=>(<div key={i} style={{ width:14, height:20, background:"linear-gradient(135deg,#240c0c,#180808)", border:"1px solid #341818", borderRadius:2 }}/>))}</div>
              <span style={{ fontSize:10, color:"#604040" }}>Deck:{ai.enemyDeck.length}</span>
              <div style={{ display:"flex", gap:3, alignItems:"flex-end" }}>{Array.from({length:gs[myRole==="p1"?"p2Max":"p1Max"]||0}).map((_,i)=>(<div key={i} style={{ width:14, height:17, background:i<(gs[myRole==="p1"?"p2Energy":"p1Energy"]||0)?"linear-gradient(160deg,#90e0ff 0%,#2090d0 45%,#1060a0 100%)":"rgba(20,50,80,0.35)", borderRadius:"50% 50% 45% 45% / 40% 40% 60% 60%", border:`1px solid ${i<(gs[myRole==="p1"?"p2Energy":"p1Energy"]||0)?"#60c8ff66":"#1a3a5a33"}`, boxShadow:i<(gs[myRole==="p1"?"p2Energy":"p1Energy"]||0)?"0 2px 6px #2090ff44":"none", transition:"all .25s" }}/>))}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
                <div style={{ width:90, height:10, background:"#180808", borderRadius:5, overflow:"hidden", border:"1px solid #2a1010" }}><div style={{ height:"100%", width:`${Math.max(0,(ai.enemyHP/CFG.startHP)*100)}%`, background:`linear-gradient(90deg,${hpCol(ai.enemyHP)}99,${hpCol(ai.enemyHP)})`, borderRadius:5, transition:"width .4s,background .5s", boxShadow:`0 0 8px ${hpCol(ai.enemyHP)}66` }}/></div>
                <span style={{ fontFamily:"'Cinzel',serif", fontSize:18, fontWeight:700, color:hpCol(ai.enemyHP), textShadow:`0 0 10px ${hpCol(ai.enemyHP)}88` }}>{ai.enemyHP} <span style={{ fontSize:9, color:"#604040", fontWeight:400 }}>HP</span></span>
              </div>
            </div>
          </div>
          {opEnvCard && <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 12px", background:`${opEnvCard.border}18`, border:`1px solid ${opEnvCard.border}33`, borderRadius:6, marginBottom:5, position:"relative", zIndex:2, animation:"slideDown 0.3s" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:opEnvCard.border, boxShadow:`0 0 6px ${opEnvCard.border}`, animation:"pulse 2s infinite", flexShrink:0 }} />
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:opEnvCard.border, fontWeight:700, flexShrink:0 }}>{opEnvCard.name}</span>
            <span style={{ fontSize:10, color:"#a09068", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{opEnvCard.ability}</span>
            <span style={{ fontSize:10, color:"#e05050", fontFamily:"'Cinzel',serif", flexShrink:0, background:"rgba(200,50,50,0.15)", padding:"1px 5px", borderRadius:4 }}>OPP · {Math.ceil((opEnvCard.turnsRemaining||4)/2)}R</span>
          </div>}
          {/* Opponent lightning meter */}
          {ai.enemyZeusInPlay && (() => { const em=ai.enemyLightningMeter||0; const full=em>=2; return (<div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, padding:"5px 10px", background:full?"rgba(255,220,0,0.13)":"rgba(255,220,0,0.04)", border:`1px solid rgba(255,220,0,${full?0.65:0.2})`, borderRadius:8, boxShadow:full?"0 0 14px rgba(255,210,0,0.4)":"none", transition:"all .3s" }}><span style={{ fontSize:18, lineHeight:1, filter:full?"drop-shadow(0 0 6px #ffe040) drop-shadow(0 0 12px #f0a000)":"none", transition:"filter .3s" }}>⚡</span><div style={{ display:"flex", gap:5 }}>{[0,1].map(i=>{ const lit=i<em; return (<div key={i} style={{ width:28, height:14, borderRadius:4, background:lit?"linear-gradient(90deg,#fffaaa,#ffe030,#f09000)":"rgba(60,50,0,0.45)", border:`1px solid ${lit?"#f0d020":"#2a1c00"}`, boxShadow:lit?"0 0 10px #ffe040bb, inset 0 1px 0 rgba(255,255,200,0.4)":"none", transition:"all .25s" }}/>); })}</div><span style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:full?"#ffe040":"#a08820", fontWeight:700 }}>{full?"READY!":"OPP ⚡"}</span></div>); })()}
          <div style={{ fontSize:13, color:targetingSpell?"#ffe040":"#5a2424", fontFamily:"'Cinzel',serif", letterSpacing:3, marginBottom:4, textAlign:"center", fontWeight:700, textShadow:"0 1px 4px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.6)" }}>{targetingSpell?`⚡ CHOOSE TARGET — ${targetingSpell.name}`:"ENEMY FIELD"}</div>
          <div style={{ height:182, display:"flex", gap:8, flexWrap:"nowrap", justifyContent:"center", alignItems:"center", overflowX:"auto", overflowY:"visible", scrollbarWidth:"thin" }}>
            {ai.enemyBoard.length===0?<span style={{ fontSize:10, color:"#241010", letterSpacing:3 }}>---</span>:ai.enemyBoard.map((c)=>(<Token key={c.uid} c={resolveCardArt(c,myRole==="p1"?gs?.p2Arts||{}:gs?.p1Arts||{})} animType={animUids[c.uid]} isTarget={!!attacker||!!targetingSpell} canSelect={false} onClick={()=>{ if(targetingSpell){playCard(targetingSpell,c.uid);}else if(attacker)atkCreature(c); else setPreviewCard(c); }}/>))}
          </div>
        </div>
        {/* Divider with timer */}
        <div style={{ padding:"5px 14px", background:envTheme?"rgba(0,0,0,0.35)":"#0e0c08", borderBottom:"2px solid #1a3a0a", borderTop:"2px solid #3a1a0a", display:"flex", alignItems:"center", gap:10, position:"relative", zIndex:2, flex:"0 0 auto" }}>
          {!gs.winner ? (
            <TurnTimer key={timerKey} active={true} onExpire={isMyTurn ? endTurn : ()=>{}} turnNum={gs.turn}>
              {isMyTurn && attCard ? (
                <button onClick={ai.enemyBoard.length===0?atkFace:undefined} style={{ padding:"3px 12px", background:ai.enemyBoard.length===0?"linear-gradient(135deg,#6a0808,#a01010)":"rgba(255,255,255,0.04)", border:`1px solid ${ai.enemyBoard.length===0?"#e04040":"#2a1a10"}`, borderRadius:20, color:ai.enemyBoard.length===0?"#ffaaaa":"#604030", fontFamily:"'Cinzel',serif", fontSize:9, cursor:ai.enemyBoard.length===0?"pointer":"default" }}>
                  {ai.enemyBoard.length===0?"STRIKE HERO":"SELECT TARGET"}
                </button>
              ) : null}
            </TurnTimer>
          ) : (
            <>
              <div style={{ flex:1, height:1, background:"linear-gradient(to right,transparent,#382e18)" }}/>
              <span style={{ fontSize:9, color:envTheme?envTheme.glow+"88":"#241a08", letterSpacing:3, fontFamily:"'Cinzel',serif" }}>TURN {gs.turn}</span>
              <div style={{ flex:1, height:1, background:"linear-gradient(to left,transparent,#382e18)" }}/>
            </>
          )}
        </div>
        {/* My zone — use my env theme */}
        <div style={{ background: myEnvTheme ? myEnvTheme.bg : "rgba(20,100,10,0.22)", borderLeft:"3px solid #307030", padding:"7px 12px", position:"relative", zIndex:2, transition:"background 1.5s ease", boxShadow:"inset 0 6px 24px rgba(20,160,10,0.14), inset 3px 0 12px rgba(20,160,10,0.1)", flex:1, display:"flex", flexDirection:"column", overflow:"visible", minHeight:0 }}>
          {myEnvTheme && <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:1 }}><FloatingParticles count={myEnvTheme.pCount||20} color={myEnvTheme.particle} speed={myEnvTheme.pSpeed||0.6} shape={myEnvTheme.pShape||"circle"} direction={myEnvTheme.pDir||"up"} /></div>}
          {myEnvCard && <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 12px", background:`${myEnvCard.border}18`, border:`1px solid ${myEnvCard.border}44`, borderRadius:6, marginBottom:5, position:"relative", zIndex:2, animation:"slideDown 0.3s" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:myEnvCard.border, boxShadow:`0 0 6px ${myEnvCard.border}`, animation:"pulse 2s infinite", flexShrink:0 }} />
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:myEnvCard.border, fontWeight:700, flexShrink:0 }}>{myEnvCard.name}</span>
            <span style={{ fontSize:10, color:"#a09068", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{myEnvCard.ability}</span>
            <span style={{ fontSize:10, color:"#78cc45", fontFamily:"'Cinzel',serif", flexShrink:0, background:"rgba(80,180,50,0.15)", padding:"1px 5px", borderRadius:4 }}>YOURS · {Math.ceil((myEnvCard.turnsRemaining||4)/2)}R</span>
          </div>}
          <div style={{ fontSize:13, color:dragOverField?"#a0ff60":"#6dc830", fontFamily:"'Cinzel',serif", letterSpacing:3, marginBottom:4, textAlign:"center", fontWeight:700, textShadow:"0 -1px 0 rgba(255,255,255,0.3), 0 1px 4px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.8)", position:"relative", zIndex:2, transition:"color .15s" }}>YOUR FIELD</div>
          <div
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverField(true); }}
            onDragLeave={() => setDragOverField(false)}
            onDrop={(e) => { e.preventDefault(); setDragOverField(false); const card = dragCardRef.current; if (card) playCard(card); dragCardRef.current = null; }}
            style={{ height:182, flex:"0 0 auto", display:"flex", gap:8, flexWrap:"nowrap", justifyContent:"center", alignItems:"center", overflowX:"auto", overflowY:"visible", scrollbarWidth:"thin", marginBottom:6, borderRadius:8, border: dragOverField ? "2px dashed #78cc4599" : "2px dashed transparent", background: dragOverField ? "rgba(100,200,50,0.07)" : "transparent", transition:"all .15s" }}>
            {ai.playerBoard.length===0?<span style={{ fontSize:10, color:dragOverField?"#78cc45":"#181408", letterSpacing:3 }}>{dragOverField?"DROP TO PLAY":isMyTurn?"PLAY A CARD":"WAITING..."}</span>:ai.playerBoard.map((c)=>(<Token key={c.uid} c={resolveCardArt(c,myRole==="p1"?gs?.p1Arts||{}:gs?.p2Arts||{})} animType={animUids[c.uid]} selected={attacker===c.uid} isTarget={false} canSelect={isMyTurn&&c.canAttack&&!c.hasAttacked&&!syncing} onClick={()=>selectAtt(c)} onRightClick={()=>setPreviewCard(c)}/>))}
          </div>
          <div style={{ paddingTop:38, marginTop:-28, marginBottom:6, flex:"0 0 auto", overflow:"visible", position:"relative", zIndex:10 }}>
            <div style={{ display:"flex", gap:6, justifyContent:"center", flexWrap:"nowrap", overflow:"visible" }}>
              {ai.playerHand.map((card)=>{
                const needsAllies=(card.type==="spell")&&(card.effects||[]).some(e=>["buff_allies","heal_all_allies","buff_random_ally","buff_keyword_allies"].includes(e.effect));
                const eff=getEffectiveCost(card,ai.environment);
                const canAfford=card.bloodpact?card.cost<ai.playerHP:eff<=ai.playerEnergy;
                const cp=isMyTurn&&!syncing&&canAfford&&(card.type==="environment"||card.type==="spell"||ai.playerBoard.length<CFG.maxBoard)&&!(needsAllies&&ai.playerBoard.length===0);
                return(<HandCard key={card.uid} card={resolveCardArt({...card,cost:eff},myRole==="p1"?gs?.p1Arts||{}:gs?.p2Arts||{})} playable={cp} onClick={()=>playCard(card)} onRightClick={()=>{ SFX.play("card_inspect"); setPreviewCard(card); }} onDragStart={(c) => { dragCardRef.current = c; }}/>);
              })}
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flex:"0 0 auto" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div onClick={()=>setProfilePopup({ name:user?.name, avatar:user?.avatarUrl, role:"self", wins:user?.rankedWins||0, losses:user?.rankedLosses||0, rating:user?.rankedRating||1000 })} style={{ width:36, height:36, borderRadius:"50%", background:"linear-gradient(135deg,#4a9020,#6aab3a)", border:"2px solid #e8c06055", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',serif", fontSize:12, fontWeight:700, color:"#fff", cursor:"pointer" }} title="View your profile">
                {user?.avatarUrl?<img src={user.avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>:(user?.name||"?").slice(0,2).toUpperCase()}
              </div>
              <span style={{ fontSize:10, color:"#e8c060", fontFamily:"'Cinzel',serif" }}>Deck:{ai.playerDeck.length}</span>
              <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                <div style={{ width:90, height:10, background:"#080808", borderRadius:5, overflow:"hidden", border:"1px solid #1a1a0a" }}><div style={{ height:"100%", width:`${Math.max(0,(ai.playerHP/CFG.startHP)*100)}%`, background:`linear-gradient(90deg,${hpCol(ai.playerHP)}99,${hpCol(ai.playerHP)})`, borderRadius:5, transition:"width .4s,background .5s", boxShadow:`0 0 8px ${hpCol(ai.playerHP)}66` }}/></div>
                <span style={{ fontFamily:"'Cinzel',serif", fontSize:18, fontWeight:700, color:hpCol(ai.playerHP), textShadow:`0 0 10px ${hpCol(ai.playerHP)}88` }}>{ai.playerHP} <span style={{ fontSize:9, color:"#806040", fontWeight:400 }}>HP</span></span>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                <span style={{ fontSize:8, color:"#c0a060", fontFamily:"'Cinzel',serif" }}>ENERGY</span>
                <div style={{ display:"flex", gap:4, alignItems:"flex-end" }}>{Array.from({length:ai.maxEnergy}).map((_,i)=>(<div key={i} style={{ width:18, height:22, background:i<ai.playerEnergy?"linear-gradient(160deg,#90e0ff 0%,#2090d0 45%,#1060a0 100%)":"rgba(20,50,80,0.35)", borderRadius:"50% 50% 45% 45% / 40% 40% 60% 60%", border:`1px solid ${i<ai.playerEnergy?"#60c8ff88":"#1a3a5a44"}`, boxShadow:i<ai.playerEnergy?"0 2px 8px #2090ff55, inset 0 1px 0 rgba(255,255,255,0.35)":"none", transition:"all .25s" }}/>))}</div>
                <span style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#60c8ff", fontWeight:700 }}>{ai.playerEnergy}/{ai.maxEnergy}</span>
              </div>
              <button onClick={()=>{SFX.play("end_turn_go");endTurn();}} disabled={!isMyTurn||syncing} style={{ padding:"8px 16px", background:isMyTurn&&!syncing?"linear-gradient(135deg,#c89010,#f0c040)":"rgba(255,255,255,0.04)", border:"none", borderRadius:7, fontFamily:"'Cinzel',serif", fontSize:10, fontWeight:700, letterSpacing:2, color:isMyTurn&&!syncing?"#1a1000":"#404030", cursor:isMyTurn&&!syncing?"pointer":"not-allowed", boxShadow:isMyTurn&&!syncing?"0 0 18px #e8c06044,0 4px 12px rgba(200,144,0,0.3)":"none", transition:"all .18s" }}>{syncing?"SYNCING...":"END TURN"}</button>
            </div>
          </div>
          {/* My lightning meter */}
          {ai.playerZeusInPlay && (() => { const pm=ai.playerLightningMeter||0; const full=pm>=2; return (<div style={{ display:"flex", alignItems:"center", gap:10, marginTop:6, padding:"7px 14px", background:full?"rgba(255,220,0,0.13)":"rgba(255,220,0,0.04)", border:`1px solid rgba(255,220,0,${full?0.65:0.22})`, borderRadius:9, boxShadow:full?"0 0 18px rgba(255,210,0,0.45)":"none", transition:"all .3s", animation:full?"lightningReady 0.8s ease-in-out infinite":undefined }}><span style={{ fontSize:22, lineHeight:1, filter:full?"drop-shadow(0 0 8px #ffe040) drop-shadow(0 0 16px #f0a000)":"drop-shadow(0 0 2px #a07800)", transition:"filter .3s" }}>⚡</span><div style={{ display:"flex", gap:6 }}>{[0,1].map(i=>{ const lit=i<pm; return (<div key={i} style={{ width:36, height:16, borderRadius:5, background:lit?"linear-gradient(90deg,#fffaaa,#ffe030,#f09000)":"rgba(60,50,0,0.45)", border:`1px solid ${lit?"#f0d020":"#2a1c00"}`, boxShadow:lit?"0 0 12px #ffe040cc, inset 0 1px 0 rgba(255,255,200,0.4)":"none", transition:"all .3s" }}/>); })}</div><div style={{ display:"flex", flexDirection:"column", gap:1 }}><span style={{ fontFamily:"'Cinzel',serif", fontSize:8, color:"#f0d020bb", letterSpacing:2, fontWeight:700 }}>LIGHTNING</span><span style={{ fontFamily:"'Cinzel',serif", fontSize:full?12:10, color:full?"#ffe040":"#a08820", fontWeight:700 }}>{full?"READY!":pm+" / 2"}</span></div></div>); })()}
        </div>
      </div>
      {/* Log */}
      <div className="battle-log" style={{ display:"flex", flexDirection:"column", gap:8, height:"100%", overflowY:"auto", minHeight:0 }}>
        {attCard&&(<div style={{ background:`${attCard.border}15`, border:`1px solid ${attCard.border}55`, borderRadius:10, padding:10 }}><div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:attCard.border, fontWeight:600 }}>ATTACKING</div><div style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#f0e8d8", fontWeight:700 }}>{attCard.name}</div><div style={{ fontSize:12, color:"#ff7050", fontWeight:700 }}>ATK {attCard.currentAtk}</div><button onClick={()=>setAttacker(null)} style={{ marginTop:6, width:"100%", padding:"3px", background:"transparent", border:"1px solid #241408", borderRadius:4, color:"#806040", fontFamily:"'Cinzel',serif", fontSize:8, cursor:"pointer" }}>Cancel</button></div>)}
        <div style={{ background:"#080604", border:"1px solid #161408", borderRadius:10, overflow:"hidden", display:"flex", flexDirection:"column", maxHeight:500 }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:15, color:"#c09048", letterSpacing:3, padding:"8px 12px", borderBottom:"1px solid #281e08", fontWeight:700, display:"flex", justifyContent:"space-between", alignItems:"center", textShadow:"0 1px 4px rgba(0,0,0,0.8)" }}><span>BATTLE LOG</span><span style={{ fontSize:9, color:"#403828" }}>TURN {gs.turn}</span></div>
          <div ref={logRef} style={{ overflowY:"auto", padding:"8px 12px", maxHeight:460 }}>{(gs.log||[]).map((l,i)=>{const isLast=i===(gs.log||[]).length-1;return(<div key={i} style={{ fontSize:13, lineHeight:1.7, marginBottom:5, color:logColor(l), borderLeft:isLast?`2px solid ${logColor(l)}`:"2px solid #1a160e", paddingLeft:6, fontFamily:"'Cinzel',serif", fontWeight:isLast?700:400, display:"flex", alignItems:"flex-start", gap:4 }}><span style={{ opacity:0.5, flexShrink:0 }}>{logIcon(l)}</span>{renderLogLine(l, i)}</div>);})}</div>
        </div>
      </div>
    </div>
  </div>);
}

// ═══ MATCHMAKING ═══════════════════════════════════════════════════════════════════════
// Phase lifecycle: waiting → found → accepted → entering
//                 waiting → timeout | error
//                 found / accepted → declined
function MatchmakingScreen({ user, ranked, onMatch, onCancel, onRetry }) {
  const [phase, setPhase] = useState('waiting');
  const [dots, setDots] = useState(0);
  const [oppName, setOppName] = useState('');
  const [countdown, setCountdown] = useState(20);

  // Stable refs so closures in effects/callbacks always see the latest values
  const activeRef       = useRef(true);
  const transitionedRef = useRef(false);
  const phaseRef        = useRef('waiting');
  const rowIdRef        = useRef(null);
  const matchIdRef      = useRef(null);
  const oppIdRef        = useRef(null);
  const oppNameRef      = useRef('');
  const mmChannelRef    = useRef(null);
  const matchChRef      = useRef(null);
  const pollTimerRef    = useRef(null);

  // Keep phaseRef synced with phase state
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Animated waiting dots
  useEffect(() => {
    const id = setInterval(() => setDots(d => (d + 1) % 4), 500);
    return () => clearInterval(id);
  }, []);

  // 20-second acceptance countdown — auto-decline on expiry
  useEffect(() => {
    if (phase !== 'found') return;
    setCountdown(20);
    const id = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(id); doDecline(); return 0; } return c - 1; });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]); // eslint-disable-line

  // ── Transition into found/acceptance state when pairing is confirmed ──────────────────
  const transitionMatched = (row) => {
    if (transitionedRef.current || !activeRef.current) return;
    transitionedRef.current = true;
    matchIdRef.current = row.match_id;
    oppIdRef.current   = row.opponent_id;
    oppNameRef.current = row.opponent_name || 'Opponent';
    setOppName(row.opponent_name || 'Opponent');
    phaseRef.current = 'found';
    setPhase('found');
    SFX.play('rare_reveal');
    // Subscribe to matches row — fires when both accept (status=active) or someone cancels
    matchChRef.current = supabase.channel('mready_' + row.match_id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${row.match_id}` }, (payload) => {
        if (!activeRef.current) return;
        if (payload.new.status === 'active' && (phaseRef.current === 'accepted' || phaseRef.current === 'found')) {
          phaseRef.current = 'entering';
          setPhase('entering');
          clearTimeout(pollTimerRef.current);
          setTimeout(() => { if (activeRef.current) onMatch({ matchId: row.match_id, opponentId: row.opponent_id, opponentName: oppNameRef.current }); }, 700);
        } else if (payload.new.status === 'cancelled') {
          setPhase('declined');
        }
      })
      .subscribe();
  };

  // ── Cancel / decline ───────────────────────────────────────────────────────────────
  const doDecline = async () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setPhase('declined');
    clearTimeout(pollTimerRef.current);
    try {
      if (matchIdRef.current) { await supabase.rpc('cancel_duel', { p_match_id: matchIdRef.current }); }
      else if (rowIdRef.current) { await supabase.from('matchmaking').delete().eq('id', rowIdRef.current); }
    } catch (_) {}
    if (mmChannelRef.current) supabase.removeChannel(mmChannelRef.current);
    if (matchChRef.current)   supabase.removeChannel(matchChRef.current);
  };

  // ── Accept duel ───────────────────────────────────────────────────────────────────
  const doAccept = async () => {
    if (!matchIdRef.current || phaseRef.current !== 'found') return;
    phaseRef.current = 'accepted'; // sync update — Realtime callback checks this before useEffect can run
    setPhase('accepted');
    try {
      const { data } = await supabase.rpc('accept_duel', { p_match_id: matchIdRef.current, p_user_id: user.id });
      if (data?.ready) {
        phaseRef.current = 'entering';
        setPhase('entering');
        setTimeout(() => { if (activeRef.current) onMatch({ matchId: matchIdRef.current, opponentId: oppIdRef.current, opponentName: oppNameRef.current }); }, 700);
        return;
      }
    } catch (_) { setPhase('error'); return; }
    // Polling fallback: Realtime may miss the status→active update, so poll every 1s
    let aTries = 0;
    const checkActive = async () => {
      if (!activeRef.current || phaseRef.current !== 'accepted') return; // Realtime already handled
      aTries++;
      if (aTries > 20) { setPhase('declined'); return; }
      try {
        const { data: m } = await supabase.from('matches').select('status').eq('id', matchIdRef.current).single();
        if (m?.status === 'active') {
          if (phaseRef.current !== 'accepted') return;
          phaseRef.current = 'entering';
          setPhase('entering');
          setTimeout(() => { if (activeRef.current) onMatch({ matchId: matchIdRef.current, opponentId: oppIdRef.current, opponentName: oppNameRef.current }); }, 700);
          return;
        }
      } catch (_) {}
      setTimeout(checkActive, 1000);
    };
    setTimeout(checkActive, 1000);
  };

  // ── Main setup effect: insert row, Realtime subscribe, start poll ─────────────────────
  useEffect(() => {
    activeRef.current = true;
    const go = async () => {
      // Purge any stale rows for this user
      await supabase.from('matchmaking').delete().eq('user_id', user.id);
      if (!activeRef.current) return;
      // Insert fresh waiting row
      const { data, error } = await supabase.from('matchmaking')
        .insert({ user_id: user.id, display_name: user.name, status: 'waiting', ranked: !!ranked }).select().single();
      if (!activeRef.current) return;
      if (error || !data) { console.error('[MM] matchmaking insert failed:', error); setPhase('error'); return; }
      const rowId = data.id;
      rowIdRef.current = rowId;
      // Realtime on our own row — fires when the OTHER client's pair_players() updates us
      mmChannelRef.current = supabase.channel('mm_row_' + rowId)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matchmaking', filter: `id=eq.${rowId}` }, (payload) => {
          if (payload.new.status === 'matched' && activeRef.current) transitionMatched(payload.new);
        })
        .subscribe();
      // Poll: call pair_players() RPC every 1.5s
      // The caller that wins FOR UPDATE SKIP LOCKED does the pairing; others retry
      const doPoll = async () => {
        if (!activeRef.current || phaseRef.current !== 'waiting') return;
        try {
          const { data: res, error: rpcErr } = await supabase.rpc('pair_players', { p_user_id: user.id, p_display_name: user.name, p_row_id: rowId });
          if (rpcErr) console.error('[MM] pair_players error:', rpcErr);
          if (res?.paired && activeRef.current) {
            transitionMatched({ match_id: res.match_id, opponent_id: res.opponent_id, opponent_name: res.opponent_name });
            return;
          }
        } catch (e) { console.error('[MM] pair_players threw:', e); }
        // Fallback: check if our row was already matched (Realtime may have missed the UPDATE)
        if (activeRef.current && phaseRef.current === 'waiting') {
          try {
            const { data: row } = await supabase.from('matchmaking').select('status,match_id,opponent_id,opponent_name').eq('id', rowId).single();
            if (row?.status === 'matched' && activeRef.current) { transitionMatched(row); return; }
          } catch (_) {}
          pollTimerRef.current = setTimeout(doPoll, 1500);
        }
      };
      pollTimerRef.current = setTimeout(doPoll, 1000);
      // 5-minute queue timeout
      setTimeout(() => {
        if (activeRef.current && phaseRef.current === 'waiting') {
          setPhase('timeout'); activeRef.current = false;
          supabase.from('matchmaking').delete().eq('id', rowId).then(() => {});
          if (mmChannelRef.current) supabase.removeChannel(mmChannelRef.current);
        }
      }, 5 * 60 * 1000);
    };
    go();
    return () => {
      activeRef.current = false;
      clearTimeout(pollTimerRef.current);
      // Only delete row if still waiting (matched rows are cleaned by cancel_duel)
      if (rowIdRef.current && ['waiting','error','timeout'].includes(phaseRef.current)) {
        supabase.from('matchmaking').delete().eq('id', rowIdRef.current).then(() => {});
      }
      if (mmChannelRef.current) supabase.removeChannel(mmChannelRef.current);
      if (matchChRef.current)   supabase.removeChannel(matchChRef.current);
    };
  }, []); // eslint-disable-line

  const pulseDots = [0,1,2].map(i => (<div key={i} style={{ width:8, height:8, borderRadius:'50%', background:'#e8c060', animation:`pulse 1.2s ${i*0.4}s ease-in-out infinite` }} />));
  const backBtn = (label='CANCEL') => (<button onClick={onCancel} style={{ marginTop:28, padding:'10px 28px', background:'transparent', border:'1px solid #3a2010', borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:11, color:'#806040', cursor:'pointer' }}>{label}</button>);

  if (phase === 'found') return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'60px 24px', textAlign:'center' }}>
      <div style={{ fontSize:56, marginBottom:14, animation:'pulse 0.7s ease-in-out infinite' }}>⚔</div>
      <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:26, color:'#e8c060', margin:'0 0 6px', letterSpacing:3 }}>DUEL FOUND</h2>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:'#806040', letterSpacing:3, marginBottom:6 }}>CHALLENGER</div>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:22, color:'#f0e8d8', fontWeight:700, marginBottom:24 }}>{oppName}</div>
      <div style={{ width:64, height:64, borderRadius:'50%', background:`conic-gradient(#e8c060 ${countdown/20*360}deg, #2a2010 0deg)`, margin:'0 auto 22px', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:50, height:50, borderRadius:'50%', background:'#0e0c08', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Cinzel',serif", fontSize:20, fontWeight:700, color:'#e8c060' }}>{countdown}</div>
      </div>
      <div style={{ display:'flex', gap:14, justifyContent:'center' }}>
        <button onClick={doAccept} style={{ padding:'14px 38px', background:'linear-gradient(135deg,#4a8020,#78cc45)', border:'none', borderRadius:9, fontFamily:"'Cinzel',serif", fontSize:14, fontWeight:700, letterSpacing:2, color:'#fff', cursor:'pointer', boxShadow:'0 4px 20px rgba(78,200,50,0.4)' }}>ACCEPT</button>
        <button onClick={doDecline} style={{ padding:'14px 24px', background:'transparent', border:'1px solid #5a1818', borderRadius:9, fontFamily:"'Cinzel',serif", fontSize:13, color:'#c07060', cursor:'pointer' }}>DECLINE</button>
      </div>
    </div>
  );

  if (phase === 'accepted') return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ fontSize:48, marginBottom:16, color:'#78cc45' }}>✓</div>
      <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:22, color:'#78cc45', margin:'0 0 12px' }}>You Accepted</h2>
      <p style={{ fontSize:13, color:'#a09070', marginBottom:24 }}>Waiting for <strong style={{ color:'#e8c060' }}>{oppName}</strong> to respond…</p>
      <div style={{ display:'flex', gap:4, justifyContent:'center', marginBottom:28 }}>{pulseDots}</div>
      <button onClick={doDecline} style={{ padding:'8px 22px', background:'transparent', border:'1px solid #3a2010', borderRadius:7, fontFamily:"'Cinzel',serif", fontSize:10, color:'#806040', cursor:'pointer' }}>CANCEL</button>
    </div>
  );

  if (phase === 'entering') return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ fontSize:60, marginBottom:16, animation:'pulse 0.6s ease-in-out infinite' }}>⚔</div>
      <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:24, color:'#e8c060', margin:'0 0 8px', letterSpacing:3 }}>ENTERING THE ARENA</h2>
      <p style={{ fontSize:13, color:'#a09070' }}>Both players ready. Prepare yourself…</p>
    </div>
  );

  if (phase === 'declined') return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ fontSize:48, marginBottom:16 }}>🚫</div>
      <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:22, color:'#e05050', margin:'0 0 12px' }}>Duel Cancelled</h2>
      <p style={{ fontSize:13, color:'#a09070', marginBottom:4 }}>The match was declined or the opponent left.</p>
      {backBtn('BACK TO LOBBY')}
    </div>
  );

  if (phase === 'timeout') return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ fontSize:48, marginBottom:16 }}>⏱</div>
      <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:22, color:'#a09070', margin:'0 0 12px' }}>No Opponents Found</h2>
      <p style={{ fontSize:13, color:'#806040', marginBottom:24 }}>Queue timed out after 5 minutes.</p>
      <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
        <button onClick={onRetry || onCancel} style={{ padding:'11px 28px', background:'linear-gradient(135deg,#1060a0,#2080d0)', border:'none', borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:11, fontWeight:700, letterSpacing:2, color:'#fff', cursor:'pointer' }}>TRY AGAIN</button>
        {backBtn('BACK')}
      </div>
    </div>
  );

  if (phase === 'error') return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ fontSize:48, marginBottom:16 }}>⚠</div>
      <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:22, color:'#e05050', margin:'0 0 12px' }}>Connection Error</h2>
      <p style={{ fontSize:13, color:'#a09070', marginBottom:4 }}>Could not reach matchmaking. Check your connection.</p>
      {backBtn('BACK')}
    </div>
  );

  return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ width:72, height:72, borderRadius:'50%', background:'linear-gradient(135deg,#1a1610,#0e0c08)', border:'2px solid #e8c06044', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px', fontSize:28 }}>🔍</div>
      <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:24, color:'#e8c060', margin:'0 0 8px' }}>{'Searching' + '.'.repeat(dots)}</h2>
      <p style={{ fontSize:13, color:'#a09070', marginBottom:28 }}>Waiting in the queue — this may take a moment.</p>
      <div style={{ display:'flex', gap:4, justifyContent:'center', marginBottom:24 }}>{pulseDots}</div>
      <button onClick={() => { doDecline(); setTimeout(onCancel, 200); }} style={{ padding:'10px 28px', background:'transparent', border:'1px solid #3a2010', borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:11, color:'#806040', cursor:'pointer' }}>CANCEL</button>
    </div>
  );
}
// ═══ MATCH SETUP ═════════════════════════════════════════════
function GameTab({ user, onUpdateUser, setInPvpMatch, setMatchActive, pendingDuel, clearPendingDuel }) {
  const [matchConfig, setMatchConfig] = useState(null);
  const [matchmaking, setMatchmaking] = useState(false);
  const [ranked, setRanked] = useState(() => localStorage.getItem("fnf_ranked") === "true");
  const decks = user?.decks || [];
  // Persist deck selection across tab switches / re-renders
  const [aiDeckVal,  setAiDeckVal]  = useState(() => localStorage.getItem("fnf_ai_deck")  || "");
  const [pvpDeckVal, setPvpDeckVal] = useState(() => localStorage.getItem("fnf_pvp_deck") || "");
  const resolveDeck = (val) => val === "starter" ? { name:"Starter Deck", cards: STARTER_DECK } : val ? decks[parseInt(val)] || null : null;
  const selectedDeck = resolveDeck(aiDeckVal);
  const pvpDeck      = resolveDeck(pvpDeckVal);
  const userRank = getRank(user?.rankedRating);
  if (matchmaking) return (<MatchmakingScreen key={matchmaking} user={user} ranked={ranked} onMatch={(cfg) => { setMatchmaking(false); const cfg2 = { mode:"pvp", ranked, playerDeck: pvpDeck?.cards || null, ...cfg }; setMatchConfig(cfg2); setMatchActive?.(true); }} onCancel={() => setMatchmaking(false)} onRetry={() => { setMatchmaking(false); setTimeout(() => setMatchmaking(true), 80); }} />);
  // Friend duel — deck selection before entering
  if (pendingDuel && !matchConfig) return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"60px 24px", textAlign:"center" }}>
      <div style={{ fontSize:42, marginBottom:12 }}>⚔️</div>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:900, color:"#e8c060", marginBottom:6, letterSpacing:1 }}>DUEL CHALLENGE</div>
      <div style={{ fontSize:14, color:"#d0c098", marginBottom:28 }}>vs <span style={{ color:"#f0e0a0", fontWeight:700 }}>{pendingDuel.opponentName}</span></div>
      <div style={{ background:"linear-gradient(160deg,#141010,#0e0c08)", border:"1px solid #3a2010", borderRadius:14, padding:24, marginBottom:20, textAlign:"left" }}>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:"#e8c060", letterSpacing:2, marginBottom:12 }}>CHOOSE YOUR DECK</div>
        <select value={pvpDeckVal} onChange={(e) => { setPvpDeckVal(e.target.value); localStorage.setItem("fnf_pvp_deck", e.target.value); }} style={{ width:"100%", padding:"10px 12px", background:"#0c0a06", border:"1px solid #3a2010", borderRadius:7, color:"#f0e8d8", fontFamily:"'Cinzel',serif", fontSize:11, outline:"none" }}>
          <option value="">-- Random deck --</option>
          <option value="starter">Starter Deck</option>
          {decks.map((d, i) => (<option key={i} value={i}>{d.name} ({d.cards?.length || 0} cards)</option>))}
        </select>
      </div>
      <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
        <button onClick={() => {
          const cfg = { mode:"pvp", ranked:false, matchId: pendingDuel.matchId, opponentName: pendingDuel.opponentName, opponentId: pendingDuel.opponentId, playerDeck: pvpDeck?.cards || null };
          clearPendingDuel();
          setMatchConfig(cfg);
          setMatchActive?.(true);
        }} style={{ padding:"14px 36px", background:"linear-gradient(135deg,#c89010,#f0c040)", border:"none", borderRadius:10, fontFamily:"'Cinzel',serif", fontSize:14, fontWeight:700, color:"#1a1000", cursor:"pointer", letterSpacing:1 }}>ENTER DUEL</button>
        <button onClick={() => clearPendingDuel()} style={{ padding:"14px 20px", background:"transparent", border:"1px solid #3a1010", borderRadius:10, fontFamily:"'Cinzel',serif", fontSize:12, color:"#806040", cursor:"pointer" }}>DECLINE</button>
      </div>
    </div>
  );
  if (!matchConfig) return (<div style={{ maxWidth:720, margin:"0 auto", padding:"60px 24px 60px", display:"flex", flexDirection:"column", alignItems:"center" }}><div style={{ width:"100%" }}>
    <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:28, fontWeight:700, color:"#e8c060", margin:"0 0 4px", textAlign:"center" }}>Battle Setup</h2>
    <p style={{ fontSize:13, color:"#a09070", margin:"0 0 28px", textAlign:"center" }}>Choose your battle mode!</p>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:24 }}>
      <div style={{ background:"linear-gradient(160deg,#141010,#0e0c08)", border:"1px solid #3a2010", borderRadius:14, padding:24, textAlign:"center" }}>
        <div style={{ fontSize:32, marginBottom:12 }}>🤖</div>
        <h3 style={{ fontFamily:"'Cinzel',serif", fontSize:15, color:"#e8c060", margin:"0 0 8px" }}>VS AI</h3>
        <p style={{ fontSize:11, color:"#806040", marginBottom:16, lineHeight:1.6 }}>Test your deck against the AI opponent. Great for practice!</p>
        <select value={aiDeckVal} onChange={(e) => { setAiDeckVal(e.target.value); localStorage.setItem("fnf_ai_deck", e.target.value); }} style={{ width:"100%", padding:"7px", background:"#0c0a06", border:"1px solid #3a2010", borderRadius:7, color:"#f0e8d8", fontFamily:"'Cinzel',serif", fontSize:10, outline:"none", marginBottom:10 }}>
          <option value="">-- Random deck --</option>
          <option value="starter">Starter Deck</option>
          {decks.map((d, i) => (<option key={i} value={i}>{d.name} ({d.cards?.length || 0} cards)</option>))}
        </select>
        <button onClick={() => { SFX.play("card"); setMatchConfig({ mode:"ai", playerDeck: selectedDeck?.cards || null }); setMatchActive?.(true); }} style={{ width:"100%", padding:"12px", background:"linear-gradient(135deg,#c89010,#f0c040)", border:"none", borderRadius:9, fontFamily:"'Cinzel',serif", fontSize:12, fontWeight:700, letterSpacing:2, color:"#1a1000", cursor:"pointer" }}>START BATTLE</button>
      </div>
      <div style={{ background:"linear-gradient(160deg,#101420,#080c14)", border:`1px solid ${ranked?"#6040c0":"#102038"}`, borderRadius:14, padding:24, textAlign:"center", transition:"border-color .25s" }}>
        <div style={{ fontSize:32, marginBottom:12 }}>{ranked ? "🏆" : "⚔"}</div>
        <h3 style={{ fontFamily:"'Cinzel',serif", fontSize:15, color:ranked?"#c080ff":"#60a0e0", margin:"0 0 8px" }}>VS PLAYER</h3>
        {/* Ranked toggle */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:12 }}>
          <button onClick={()=>{ setRanked(false); localStorage.setItem("fnf_ranked","false"); }} style={{ padding:"4px 12px", background:!ranked?"rgba(60,150,240,0.2)":"transparent", border:`1px solid ${!ranked?"#3090e0":"#1a2030"}`, borderRadius:6, fontFamily:"'Cinzel',serif", fontSize:9, color:!ranked?"#60a0e0":"#304050", cursor:"pointer" }}>CASUAL</button>
          <button onClick={()=>{ setRanked(true); localStorage.setItem("fnf_ranked","true"); }} style={{ padding:"4px 12px", background:ranked?"rgba(160,80,240,0.2)":"transparent", border:`1px solid ${ranked?"#a050f0":"#1a1030"}`, borderRadius:6, fontFamily:"'Cinzel',serif", fontSize:9, color:ranked?"#c080ff":"#403060", cursor:"pointer" }}>RANKED</button>
        </div>
        {ranked && <div style={{ fontSize:9, color:userRank.color, fontFamily:"'Cinzel',serif", marginBottom:8, padding:"3px 10px", background:`${userRank.color}15`, border:`1px solid ${userRank.color}33`, borderRadius:8, display:"inline-block" }}>{userRank.icon} {userRank.name} · {user?.rankedRating||1000} MMR</div>}
        {!ranked && <p style={{ fontSize:11, color:"#6080a0", marginBottom:10, lineHeight:1.5 }}>Casual — no rating change</p>}
        {ranked && <p style={{ fontSize:11, color:"#8060a0", marginBottom:10, lineHeight:1.5 }}>Rating changes on win/loss. ELO-based.</p>}
        <select value={pvpDeckVal} onChange={(e) => { setPvpDeckVal(e.target.value); localStorage.setItem("fnf_pvp_deck", e.target.value); }} style={{ width:"100%", padding:"7px", background:"#0c0a06", border:"1px solid #1a2038", borderRadius:7, color:"#f0e8d8", fontFamily:"'Cinzel',serif", fontSize:10, outline:"none", marginBottom:10 }}><option value="">-- Random deck --</option><option value="starter">Starter Deck</option>{decks.map((d, i) => (<option key={i} value={i}>{d.name} ({d.cards?.length || 0} cards)</option>))}</select>
        <div style={{ fontSize:9, color:"#405060", fontFamily:"'Cinzel',serif", marginBottom:10, letterSpacing:1 }}>Using: {pvpDeck?.name || "Random deck"}</div>
        <button onClick={() => { SFX.play("card"); setMatchmaking(true); }} style={{ width:"100%", padding:"12px", background:ranked?"linear-gradient(135deg,#5020a0,#8040d0)":"linear-gradient(135deg,#1060a0,#2080d0)", border:"none", borderRadius:9, fontFamily:"'Cinzel',serif", fontSize:12, fontWeight:700, letterSpacing:2, color:"#fff", cursor:"pointer" }}>{ranked?"RANKED MATCH":"FIND MATCH"}</button>
      </div>
    </div>
    <p style={{ fontSize:10, color:"#504030", textAlign:"center", margin:0 }}>Build and manage decks in the <strong style={{ color:"#806040" }}>Cards</strong> tab.</p>
  </div></div>);
  if (matchConfig?.mode === "pvp") return (<PvpBattleScreen user={user} matchConfig={matchConfig} onExit={() => { setMatchConfig(null); setInPvpMatch?.(false); setMatchActive?.(false); }} onUpdateUser={onUpdateUser} setInPvpMatch={setInPvpMatch} />);
  return (<BattleScreen user={user} onUpdateUser={onUpdateUser} matchConfig={matchConfig} onExit={() => { setMatchConfig(null); setMatchActive?.(false); setSelectedDeck(null); }} />);
}
// ═══ PACK OPENING ════════════════════════════════════════════════════════════
function PackOpening({ user, onUpdateUser }) {
  const [opening, setOpening] = useState(null);
  const [revealed, setRevealed] = useState([]);
  const [revIdx, setRevIdx] = useState(-1);
  const [shakeCard, setShakeCard] = useState(-1);
  const [newCardIdxs, setNewCardIdxs] = useState(new Set());

  const openPack = (pack) => { setOpening({ pack, cards: pack.altPack ? rollAltArtPack(pack) : rollPack(pack) }); setRevealed([]); setRevIdx(-1); setNewCardIdxs(new Set()); SFX.play("pack_open"); };
  const applyCard = (card, isAlt, revealIdx) => {
    if (!onUpdateUser || !user) return;
    if (isAlt) {
      const ao = { ...(user.altOwned || {}) };
      const isNewAlt = !(ao[card.id] || []).includes(card.altSetId);
      ao[card.id] = [...new Set([...(ao[card.id] || []), card.altSetId])];
      onUpdateUser({ altOwned: ao });
      if (isNewAlt && revealIdx != null) setNewCardIdxs(p => new Set([...p, revealIdx]));
    } else {
      const col = { ...(user.collection || {}) };
      const isNew = (col[card.id] || 0) === 0;
      // First time unlocking a card → award max copies so it's deck-ready immediately
      col[card.id] = isNew ? (CFG.deck?.copies || 3) : (col[card.id] || 0) + 1;
      onUpdateUser({ collection: col });
      if (isNew && revealIdx != null) setNewCardIdxs(p => new Set([...p, revealIdx]));
    }
  };
  const revealNext = () => {
    if (!opening) return;
    const next = revIdx + 1; if (next >= opening.cards.length) return;
    setShakeCard(next);
    setTimeout(() => {
      setRevIdx(next); setRevealed((p) => [...p, next]);
      const card = opening.cards[next];
      if (["Rare","Epic","Legendary","Prismatic"].includes(card.rarity)) SFX.play("rare_reveal"); else SFX.play("flip");
      applyCard(card, !!opening.pack.altPack, next);
      setShakeCard(-1);
    }, 400);
  };
  const revealAll = () => { if (!opening) return; setRevealed(opening.cards.map((_, i) => i)); setRevIdx(opening.cards.length - 1); SFX.play("rare_reveal"); opening.cards.forEach((c, i) => applyCard(c, !!opening.pack.altPack, i)); };

  return (<div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px" }}>
    <div style={{ textAlign: "center", marginBottom: 28 }}><h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 28, fontWeight: 700, color: "#e8c060", margin: "0 0 8px" }}>Card Packs</h2><p style={{ fontSize: 13, color: "#a09070", margin: 0 }}>Discover new cards for your collection</p></div>
    {!opening ? (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 14 }}>
        {PACKS.map((p, idx) => (
          <div key={p.id} onClick={() => openPack(p)} style={{ background: "#121008", border: `1px solid ${p.color}33`, borderRadius: 14, padding: 22, cursor: "pointer", transition: "all .3s", textAlign: "center", animation: `cardReveal 0.5s ease-out ${idx * 0.08}s both` }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-8px) scale(1.03)"; e.currentTarget.style.boxShadow = `0 16px 40px ${p.color}33`; e.currentTarget.style.borderColor = p.color + "66"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = p.color + "33"; }}>
            <div style={{ width: 50, height: 50, borderRadius: 12, background: `linear-gradient(135deg,${p.color}22,${p.color}08)`, border: `1px solid ${p.color}44`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontFamily: "'Cinzel',serif", fontSize: 20, fontWeight: 900, color: p.color }}>{p.count}</div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 700, color: p.color, marginBottom: 6 }}>{p.name}</div>
            <p style={{ fontSize: 10, color: "#a09060", margin: "0 0 12px", lineHeight: 1.5 }}>{p.desc}</p>
            {p.cost === 0 && (user?.freePackUsed || localStorage.getItem("freePackUsed_" + (user?.id||"anon"))) === new Date().toDateString()
              ? <div style={{ padding:"8px 12px", background:"rgba(255,255,255,0.03)", border:"1px solid #282010", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:10, color:"#504030", fontWeight:600, letterSpacing:1 }}>CLAIMED TODAY</div>
              : <div style={{ padding:"8px 12px", background:`${p.color}15`, border:`1px solid ${p.color}33`, borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:10, color:p.color, fontWeight:600, letterSpacing:1 }}>{p.cost===0?"FREE · 1/DAY":`${p.cost} SHARDS`}</div>}
          </div>
        ))}
      </div>
    ) : (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, color: opening.pack.color, letterSpacing: 4, marginBottom: 24, textShadow: `0 0 20px ${opening.pack.color}44` }}>{opening.pack.name.toUpperCase()}</div>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 28, minHeight: 280 }}>
          {opening.cards.map((card, i) => {
            const isRevealed = revealed.includes(i);
            const isShaking = shakeCard === i;
            const rarGlow = { Rare: "#5090ff", Epic: "#a860d8", Legendary: "#f0b818" }[card.rarity] || null;
            return (
              <div key={i} onClick={!isRevealed ? revealNext : undefined} style={{ width: 142, cursor: isRevealed ? "default" : "pointer", perspective: 1000 }}>
                <div style={{ transition: "transform 0.6s cubic-bezier(.4,0,.2,1)", transformStyle: "preserve-3d", transform: isRevealed ? "rotateY(0deg)" : isShaking ? "rotateY(90deg)" : "rotateY(180deg)" }}>
                  {isRevealed ? (
                    <div style={{ animation: "cardReveal 0.5s ease-out", position: "relative" }}>
                      {rarGlow && <div style={{ position: "absolute", inset: -8, borderRadius: 20, background: `radial-gradient(circle,${rarGlow}33,transparent 70%)`, animation: "vfxPulse 1s ease-out", pointerEvents: "none", zIndex: -1 }} />}
                      <Card card={card} size="sm" />
                      {newCardIdxs.has(i) && (
                        <div style={{ position:"absolute", top:-10, left:"50%", transform:"translateX(-50%)", background:"linear-gradient(135deg,#78cc45,#4a9020)", borderRadius:10, padding:"3px 10px", fontFamily:"'Cinzel',serif", fontSize:8, fontWeight:900, color:"#fff", letterSpacing:2, boxShadow:"0 2px 12px #78cc4588", animation:"splatLabel 0.4s cubic-bezier(0.34,1.56,0.64,1) both", whiteSpace:"nowrap", zIndex:10 }}>NEW!</div>
                      )}
                    </div>
                  ) : (
                    <div style={{ width: 142, height: 248, background: `linear-gradient(135deg,#1a1408,${opening.pack.color}15)`, border: `2px solid ${opening.pack.color}44`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: `radial-gradient(circle,${opening.pack.color}22,transparent)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 900, color: opening.pack.color + "88" }}>?</div>
                      <div style={{ fontSize: 8, color: opening.pack.color + "88", fontFamily: "'Cinzel',serif", letterSpacing: 1 }}>CLICK TO REVEAL</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          {revealed.length < opening.cards.length ? (<>
            <button onClick={revealNext} style={{ padding: "11px 24px", background: "linear-gradient(135deg,#c89010,#f0c040)", border: "none", borderRadius: 8, fontFamily: "'Cinzel',serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#1a1000", cursor: "pointer" }}>REVEAL NEXT</button>
            <button onClick={revealAll} style={{ padding: "11px 24px", background: "transparent", border: "1px solid #3a2c10", borderRadius: 8, fontFamily: "'Cinzel',serif", fontSize: 11, color: "#a09058", cursor: "pointer" }}>REVEAL ALL</button>
          </>) : (<>
            <button onClick={() => openPack(opening.pack)} style={{ padding: "11px 24px", background: "linear-gradient(135deg,#c89010,#f0c040)", border: "none", borderRadius: 8, fontFamily: "'Cinzel',serif", fontSize: 11, fontWeight: 700, color: "#1a1000", cursor: "pointer" }}>OPEN ANOTHER</button>
            <button onClick={() => { setOpening(null); setRevealed([]); setRevIdx(-1); }} style={{ padding: "11px 20px", background: "transparent", border: "1px solid #3a2c10", borderRadius: 8, fontFamily: "'Cinzel',serif", fontSize: 11, color: "#a09058", cursor: "pointer" }}>DONE</button>
          </>)}
        </div>
      </div>
    )}
  </div>);
}

// ═══ AUTH ═════════════════════════════════════════════════════════════════════
function getLastFriday() { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 2) % 7)); d.setHours(0,0,0,0); return d; }
const toAppUser = (p, email) => ({
  id: p.id, email, name: p.name, alphaKey: p.alpha_key, shards: p.shards ?? 1000,
  lastShardReset: p.last_shard_reset, battlesPlayed: p.battles_played ?? 0,
  battlesWon: p.battles_won ?? 0, cardsForged: p.cards_forged ?? 0,
  collection: p.collection || {}, decks: p.decks || [], avatarUrl: p.avatar_url || null,
  selectedArts: p.selected_arts || {}, matchHistory: p.match_history || [], altOwned: p.alt_owned || {},
  joined: p.joined || new Date().toLocaleDateString(), lastPatchSeen: p.last_patch_seen || null,
  rankedRating: p.ranked_rating ?? 1000, rankedWins: p.ranked_wins ?? 0, rankedLosses: p.ranked_losses ?? 0,
  isFablesTesterFlag: p.is_fables_tester || false,
});
function useAuth() {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(true);
  const loadProfile = async (session) => {
    if (!session?.user) { setUser(null); setLoading(false); return; }
    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (data) {
        let p = { ...data };
        const lastFri = getLastFriday();
        const lastReset = p.last_shard_reset ? new Date(p.last_shard_reset) : new Date(0);
        if (lastFri > lastReset) {
          p = { ...p, shards: 1000, last_shard_reset: new Date().toISOString() };
          await supabase.from("profiles").update({ shards: 1000, last_shard_reset: p.last_shard_reset }).eq("id", p.id);
        }
        // On every login: ensure all users have 3x every base card (never blocks login on failure)
        try {
          const updates = {};
          const col = { ...(p.collection || {}) };
          let needsColUpdate = false;
          GAMEPLAY_POOL.forEach(c => { if (!col[c.id] || col[c.id] < 3) { col[c.id] = 3; needsColUpdate = true; } });
          // All alpha players now get Fables and Food Fight cards
          POOL.filter(c => c.region === "Fables" || c.region === "Food Fight").forEach(c => { if (!col[c.id] || col[c.id] < 3) { col[c.id] = 3; needsColUpdate = true; } });
          if (needsColUpdate) { p = { ...p, collection: col }; updates.collection = col; }
          if (session.user.email?.toLowerCase() === "sncombz@gmail.com" && (!p.alt_owned || Object.keys(p.alt_owned).length === 0)) {
            const founderAlts = Object.fromEntries(Object.entries(ALT_ARTS).map(([id, alts]) => [id, alts.map(a => a.setId)]));
            p = { ...p, alt_owned: founderAlts };
            updates.alt_owned = founderAlts;
          }
          if (Object.keys(updates).length > 0) await supabase.from("profiles").update(updates).eq("id", p.id);
        } catch (_) { /* non-critical — login continues regardless */ }
        setUser(toAppUser(p, session.user.email));
      } else {
        // Authenticated but no profile row — upsert during signup may have failed.
        // Flag so LoginModal can show "complete profile" step.
        setUser({ __needsProfile: true, id: session.user.id, email: session.user.email });
      }
    } catch (e) {
      setUser({ __needsProfile: true, id: session.user?.id, email: session.user?.email });
    }
    setLoading(false);
  };
  useEffect(() => {
    // Safety timeout — if Supabase takes >5s to init, stop showing loading screen
    const safety = setTimeout(() => { setLoading(false); }, 5000);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      clearTimeout(safety);
      loadProfile(session);
    });
    return () => { clearTimeout(safety); subscription.unsubscribe(); };
  }, []);
  return {
    user, loading,
    login: () => {},
    logout: async () => { await supabase.auth.signOut(); setUser(null); },
    completeProfile: (row, email) => { setUser(toAppUser(row, email)); setLoading(false); },
    update: async (delta) => {
      const updated = { ...user, ...delta };
      const dbMap = { battlesPlayed: "battles_played", battlesWon: "battles_won", shards: "shards", collection: "collection", decks: "decks", avatarUrl: "avatar_url", selectedArts: "selected_arts", matchHistory: "match_history", altOwned: "alt_owned", freePackUsed: "free_pack_used", lastPatchSeen: "last_patch_seen", rankedRating: "ranked_rating", rankedWins: "ranked_wins", rankedLosses: "ranked_losses", dailyQuests: "daily_quests" };
      const dbDelta = {};
      Object.entries(delta).forEach(([k, v]) => { if (dbMap[k]) dbDelta[dbMap[k]] = v; });
      if (Object.keys(dbDelta).length > 0) {
        const { error } = await supabase.from("profiles").update(dbDelta).eq("id", user.id);
        if (error) console.error("Profile update failed:", error.message, dbDelta);
      }
      setUser(updated);
    }
  };
}

function LoginModal({ needsProfile = false, userId, userEmail, onSignOut, onProfileCreated }) {
  const [mode, setMode] = useState(needsProfile ? "complete" : "signin");
  const [email, setEmail] = useState(userEmail || ""); const [password, setPassword] = useState("");
  const [name, setName] = useState(""); const [key, setKey] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);

  const inp = (val, set, ph, type="text") => (
    <input type={type} value={val} onChange={(e) => set(e.target.value)} placeholder={ph}
      style={{ width:"100%", padding:"12px 14px", background:"#0c0a06", border:"1px solid #3a3020", borderRadius:9,
        color:"#f0e8d8", fontSize:13, fontFamily:"'Lora',serif", outline:"none", marginBottom:8, boxSizing:"border-box" }} />
  );

  const handleSignIn = async () => {
    if (!email || !password) { setErr("Email and password required."); return; }
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setErr(error.message);
    setBusy(false);
    // On success: onAuthStateChange fires -> loadProfile sets loading=true -> global screen takes over
  };

  const handleSignUp = async () => {
    if (!email || !password || !name.trim() || !key.trim()) { setErr("All fields required."); return; }
    if (name.trim().length < 2) { setErr("Name must be at least 2 characters."); return; }
    if (password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    const k = key.trim().toUpperCase();
    if (!ALPHA_KEYS.has(k)) { setErr("Invalid alpha key."); return; }
    setBusy(true); setErr("");
    // Check if key already used
    const { data: usedRow } = await supabase.from("used_alpha_keys").select("key").eq("key", k).maybeSingle();
    if (usedRow) { setErr("That alpha key has already been claimed."); setBusy(false); return; }
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) { setErr(error.message); setBusy(false); return; }
    if (data.user) {
      const starter = getStarterCollection();
      const isAdmin = ["sncombz@gmail.com","tylercombz2@me.com"].includes(email.trim().toLowerCase());
      const founderAltOwned = isAdmin ? Object.fromEntries(Object.entries(ALT_ARTS).map(([id, alts]) => [id, alts.map(a => a.setId)])) : {};
      const starterDeckEntry = { name: "Starter Deck", cards: STARTER_DECK };
      await supabase.from("profiles").upsert({
        id: data.user.id, name: name.trim(), alpha_key: k, shards: 1000,
        last_shard_reset: new Date().toISOString(), battles_played: 0, battles_won: 0,
        cards_forged: 0, collection: starter, decks: [starterDeckEntry], joined: new Date().toLocaleDateString(),
        alt_owned: founderAltOwned,
      });
      // Mark key as used
      await supabase.from("used_alpha_keys").upsert({ key: k, used_by_name: name.trim(), used_at: new Date().toISOString() });
      setSent(true);
    }
    setBusy(false);
  };

  const handleComplete = async () => {
    if (!name.trim() || !key.trim()) { setErr("Name and alpha key required."); return; }
    if (name.trim().length < 2) { setErr("Name must be at least 2 characters."); return; }
    const k = key.trim().toUpperCase();
    if (!ALPHA_KEYS.has(k)) { setErr("Invalid alpha key."); return; }
    setBusy(true); setErr("");
    // Check if key already used
    const { data: usedRow2 } = await supabase.from("used_alpha_keys").select("key").eq("key", k).maybeSingle();
    if (usedRow2) { setErr("That alpha key has already been claimed."); setBusy(false); return; }
    const uid = userId || (await supabase.auth.getUser()).data?.user?.id;
    if (!uid) { setErr("Session expired. Please sign in again."); setBusy(false); return; }
    const starter = getStarterCollection();
    const isAdmin = ["sncombz@gmail.com","tylercombz2@me.com"].includes((userEmail || email || "").trim().toLowerCase());
    const founderAltOwned = isAdmin ? Object.fromEntries(Object.entries(ALT_ARTS).map(([id, alts]) => [id, alts.map(a => a.setId)])) : {};
    const starterDeckEntry = { name: "Starter Deck", cards: STARTER_DECK };
    const { error } = await supabase.from("profiles").upsert({
      id: uid, name: name.trim(), alpha_key: k, shards: 1000,
      last_shard_reset: new Date().toISOString(), battles_played: 0, battles_won: 0,
      cards_forged: 0, collection: starter, decks: [starterDeckEntry], joined: new Date().toLocaleDateString(),
      alt_owned: founderAltOwned,
    });
    if (error) { setErr(error.message); setBusy(false); return; }
    // Mark key as used
    await supabase.from("used_alpha_keys").upsert({ key: k, used_by_name: name.trim(), used_at: new Date().toISOString() });
    // Directly update user state — no need for refreshSession or onAuthStateChange
    const profileRow = {
      id: uid, name: name.trim(), alpha_key: k, shards: 1000,
      last_shard_reset: new Date().toISOString(), battles_played: 0, battles_won: 0,
      cards_forged: 0, collection: starter, decks: [starterDeckEntry], joined: new Date().toLocaleDateString(),
      alt_owned: founderAltOwned,
    };
    if (onProfileCreated) onProfileCreated(profileRow, userEmail);
    setBusy(false);
  };

  return (<div style={{ position:"fixed", inset:0, zIndex:999, background:"rgba(4,2,0,0.75)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
    <div style={{ background:"linear-gradient(160deg,#1e1c10,#100e08)", border:"1px solid #3a3020", borderRadius:18, padding:42, maxWidth:420, width:"100%", textAlign:"center", boxShadow:"0 32px 80px rgba(0,0,0,0.9)", animation:"fadeIn 0.6s ease-out", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}><FloatingParticles count={15} color="#e8c060" speed={0.3} /></div>
      <div style={{ position:"relative", zIndex:1 }}>
        <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:26, fontWeight:900, color:"#e8c060", margin:"0 0 4px", textShadow:"0 0 40px #c89020aa" }}>Forge {"&"} Fable</h2>
        <div style={{ fontSize:9, background:"rgba(200,100,20,0.2)", border:"1px solid #c0600844", color:"#c07030", borderRadius:10, padding:"3px 14px", fontFamily:"'Cinzel',serif", letterSpacing:2, display:"inline-block", marginBottom:20 }}>v19 · ALPHA — PLAY WITH FRIENDS</div>
        {mode === "complete" ? (<>
          <p style={{ fontSize:13, color:"#e8c060", marginBottom:16 }}>Your email is confirmed! Complete your profile to enter.</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name (2+ chars)"
            style={{ width:"100%", padding:"12px 14px", background:"#0c0a06", border:"1px solid #3a3020", borderRadius:9, color:"#f0e8d8", fontSize:13, fontFamily:"'Lora',serif", outline:"none", marginBottom:8, boxSizing:"border-box" }} />
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Alpha key  e.g. FORGE-FOUNDER"
            style={{ width:"100%", padding:"12px 14px", background:"#0c0a06", border:"1px solid #3a3020", borderRadius:9, color:"#f0e8d8", fontSize:13, fontFamily:"'Lora',serif", outline:"none", marginBottom:8, boxSizing:"border-box" }} />
          {err && <div style={{ fontSize:11, color:"#e04040", marginBottom:10, padding:"6px 10px", background:"rgba(200,30,30,0.1)", borderRadius:6 }}>{err}</div>}
          <button onClick={handleComplete} disabled={busy} style={{ width:"100%", padding:"13px", background:busy?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#c89010,#f0c040)", border:"none", borderRadius:9, fontFamily:"'Cinzel',serif", fontSize:13, fontWeight:700, letterSpacing:2, color:busy?"#806040":"#1a1000", cursor:busy?"not-allowed":"pointer" }}>{busy?"FORGING...":"COMPLETE PROFILE"}</button>
          {onSignOut && <button onClick={onSignOut} style={{ marginTop:10, width:"100%", padding:"8px", background:"transparent", border:"1px solid #3a1010", borderRadius:8, color:"#804040", fontFamily:"'Cinzel',serif", fontSize:9, cursor:"pointer" }}>Sign out and start over</button>}
        </>) : sent ? (<>
          <div style={{ fontSize:40, marginBottom:12 }}>✉️</div>
          <p style={{ fontSize:14, color:"#60c040", marginBottom:8 }}>Check your email!</p>
          <p style={{ fontSize:12, color:"#a09070", lineHeight:1.7 }}>We sent a confirmation link. Click it, then sign in below.</p>
          <button onClick={() => { setSent(false); setMode("signin"); }} style={{ marginTop:16, padding:"10px 28px", background:"linear-gradient(135deg,#c89010,#f0c040)", border:"none", borderRadius:9, fontFamily:"'Cinzel',serif", fontSize:12, fontWeight:700, letterSpacing:2, color:"#1a1000", cursor:"pointer" }}>SIGN IN</button>
        </>) : (<>
          <div style={{ display:"flex", gap:6, marginBottom:16, justifyContent:"center" }}>
            {["signin","signup"].map((m) => (<button key={m} onClick={() => { setMode(m); setErr(""); }} style={{ padding:"7px 18px", background:mode===m?"rgba(232,192,96,0.15)":"transparent", border:`1px solid ${mode===m?"#e8c060":"#3a3020"}`, borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:10, fontWeight:700, color:mode===m?"#e8c060":"#604030", cursor:"pointer" }}>{m==="signin"?"SIGN IN":"SIGN UP"}</button>))}
          </div>
          {inp(email, setEmail, "Email address", "email")}
          {inp(password, setPassword, "Password (6+ chars)", "password")}
          {mode === "signup" && (<>
            {inp(name, setName, "Display name (2+ chars)")}
            {inp(key, setKey, "Alpha key  e.g. FORGE-FOUNDER")}
          </>)}
          {err && <div style={{ fontSize:11, color:"#e04040", marginBottom:10, padding:"6px 10px", background:"rgba(200,30,30,0.1)", borderRadius:6 }}>{err}</div>}
          <button onClick={mode==="signin" ? handleSignIn : handleSignUp} disabled={busy} style={{ width:"100%", padding:"13px", background:busy?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#c89010,#f0c040)", border:"none", borderRadius:9, fontFamily:"'Cinzel',serif", fontSize:13, fontWeight:700, letterSpacing:2, color:busy?"#806040":"#1a1000", cursor:busy?"not-allowed":"pointer" }}>{busy?"FORGING...":mode==="signin"?"ENTER THE FORGE":"CREATE ACCOUNT"}</button>
          {mode==="signup" && <p style={{ fontSize:10, color:"#3a3010", marginTop:12 }}>Alpha access required — request a key from the community.</p>}
        </>)}
      </div>
    </div>
  </div>);
}

// ═══ COLLECTION ══════════════════════════════════════════════════════════════
function CollectionScreen({ user, onUpdateUser, onDeckBuilding }) {
  const col = user?.collection || {};
  const selectedArts = user?.selectedArts || {};
  const fablesTester = isFablesTester(user);
  // All alpha players now see Fables + Food Fight — GAMEPLAY_POOL includes both
  const ownablePool = GAMEPLAY_POOL;
  const owned      = ownablePool.filter((c) => (col[c.id] || 0) > 0);
  const notYet     = ownablePool.filter((c) => (col[c.id] || 0) === 0);
  // Nothing is coming soon — both expansions are live
  const comingSoon = [];
  const [search, setSearch] = useState("");
  const [regFilter, setRegFilter] = useState("all");
  const [artPicker, setArtPicker] = useState(null);
  const [previewCard, setPreviewCard] = useState(null);
  // Deck builder: null=closed, "select"=deck picker, { index, name, cards }=editing
  const [deckBuilderState, setDeckBuilderState] = useState(null);
  const openDeckBuilder = (state) => { setDeckBuilderState(state); if (onDeckBuilding) onDeckBuilding(state && state !== "select"); };
  const closeDeckBuilder = () => { setDeckBuilderState(null); if (onDeckBuilding) onDeckBuilding(false); };
  const decks = user?.decks || [];
  const saveDeck = async (deck, editIndex) => {
    let newDecks;
    if (editIndex != null && editIndex !== "starter") {
      newDecks = decks.map((d, i) => i === editIndex ? deck : d);
    } else {
      newDecks = [...decks, deck];
    }
    await onUpdateUser({ decks: newDecks });
  };
  const deleteDeck = async (i) => { const newDecks = decks.filter((_, idx) => idx !== i); await onUpdateUser({ decks: newDecks }); };
  const filter = (cards) => cards.filter((c) => {
    if (regFilter !== "all" && c.region !== regFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const getAvailableAlts = (card) => {
    const alts = ALT_ARTS[card.id] || [];
    return alts.filter((a) => a.freeForOwners || (user?.altOwned || {})[card.id]?.includes(a.setId));
  };
  const selectArt = async (cardId, setId) => {
    const newArts = { ...selectedArts, [cardId]: setId === "base" ? undefined : setId };
    if (setId === "base") delete newArts[cardId];
    if (onUpdateUser) await onUpdateUser({ selectedArts: newArts });
    setArtPicker(null);
  };

  const CollectionCard = ({ card, i }) => {
    const alts = getAvailableAlts(card);
    const activeSel = selectedArts[card.id] || "base";
    const displayCard = resolveCardArt(card, selectedArts);
    const isOpen = artPicker === card.id;
    const qty = col[card.id] || 0;
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, position:"relative" }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); SFX.play("card_inspect"); setPreviewCard(displayCard); }}>
        <Card card={displayCard} size="sm" animDelay={i * 0.04} blueCost />
        {alts.length > 0 && (
          <div style={{ position:"relative" }}>
            <button onClick={() => setArtPicker(isOpen ? null : card.id)}
              style={{ padding:"4px 10px", background: isOpen ? "rgba(180,130,20,0.25)" : "rgba(255,255,255,0.05)", border:`1px solid ${isOpen?"#e8c06088":"#3a2810"}`, borderRadius:20, fontFamily:"'Cinzel',serif", fontSize:9, color: isOpen?"#e8c060":"#a08040", cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
              🎨 <span>ALT ART</span>
              {activeSel !== "base" && <span style={{ width:6, height:6, borderRadius:"50%", background:"#e8c060", display:"inline-block" }} />}
            </button>
            {isOpen && (
              <div style={{ position:"absolute", top:"calc(100% + 6px)", left:"50%", transform:"translateX(-50%)", zIndex:200, background:"#0e0c08", border:"1px solid #3a2810", borderRadius:12, padding:12, boxShadow:"0 12px 40px rgba(0,0,0,0.9)", minWidth:280 }}>
                <div style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#c09048", marginBottom:10, letterSpacing:2, fontWeight:700 }}>CHOOSE ART STYLE</div>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                  {/* Base art */}
                  <div onClick={() => selectArt(card.id, "base")}
                    style={{ cursor:"pointer", border:`2px solid ${activeSel==="base"?"#e8c060":"#2a2010"}`, borderRadius:10, overflow:"hidden", width:100, background:"#0c0a06", transition:"all .2s", boxShadow: activeSel==="base"?"0 0 14px #e8c06055":"none" }}>
                    <div style={{ height:70, position:"relative" }}><CardArt card={card} /></div>
                    <div style={{ padding:"5px 6px", textAlign:"center" }}>
                      <div style={{ fontFamily:"'Cinzel',serif", fontSize:8, color: activeSel==="base"?"#e8c060":"#a08040", fontWeight:700 }}>ORIGINAL</div>
                      <div style={{ fontSize:7, color:"#605030", marginTop:1 }}>Base Art</div>
                    </div>
                    {activeSel==="base" && <div style={{ textAlign:"center", fontSize:10, paddingBottom:4 }}>✓</div>}
                  </div>
                  {/* Alt arts */}
                  {alts.map((alt) => {
                    const isActive = activeSel === alt.setId;
                    const altRarityGlow = RARITY_GLOW[alt.rarity] || null;
                    return (
                      <div key={alt.setId} onClick={() => selectArt(card.id, alt.setId)}
                        style={{ cursor:"pointer", border:`2px solid ${isActive?(altRarityGlow||"#e8c060"):"#2a2010"}`, borderRadius:10, overflow:"hidden", width:100, background:"#0c0a06", transition:"all .2s", boxShadow: isActive ? `0 0 16px ${altRarityGlow||"#e8c060"}88` : altRarityGlow ? `0 0 6px ${altRarityGlow}44` : "none", filter: altRarityGlow ? `drop-shadow(0 0 5px ${altRarityGlow}66)` : "none" }}>
                        <div style={{ height:70, position:"relative", overflow:"hidden" }}>
                          {alt.imageUrl ? <img src={alt.imageUrl} alt={alt.setName} style={{ width:"100%", height:"100%", objectFit:"cover" }} referrerPolicy="no-referrer" /> : <CardArt card={card} />}
                        </div>
                        <div style={{ padding:"5px 6px", textAlign:"center" }}>
                          <div style={{ fontFamily:"'Cinzel',serif", fontSize:8, color: isActive?(altRarityGlow||"#e8c060"):"#a08040", fontWeight:700 }}>{alt.setName.toUpperCase()}</div>
                          <div style={{ fontSize:7, color: altRarityGlow||"#605030", marginTop:1 }}>{alt.label || alt.rarity}</div>
                        </div>
                        {isActive && <div style={{ textAlign:"center", fontSize:10, paddingBottom:4, color:altRarityGlow||"#e8c060" }}>✓</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 60px" }} onClick={() => { if(artPicker) setArtPicker(null); }}>
      {previewCard && <CardPreview card={previewCard} onClose={() => setPreviewCard(null)} />}
      {deckBuilderState && deckBuilderState !== "select" && (
        <DeckBuilderModal
          user={user}
          onSave={saveDeck}
          onClose={closeDeckBuilder}
          editDeck={deckBuilderState.isNew ? null : deckBuilderState}
        />
      )}
      {/* Deck Select Panel */}
      {deckBuilderState === "select" && (
        <div style={{ position:"fixed", inset:0, zIndex:600, background:"rgba(2,1,0,0.97)", display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"18px 24px", borderBottom:"2px solid #3a2c10", background:"linear-gradient(180deg,#1a1608,#0e0c06)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <h3 style={{ fontFamily:"'Cinzel',serif", fontSize:20, color:"#e8c060", margin:0, letterSpacing:2 }}>⚒ YOUR DECKS</h3>
            <button onClick={closeDeckBuilder} style={{ padding:"8px 18px", background:"transparent", border:"1px solid #4a2010", borderRadius:8, color:"#806040", fontFamily:"'Cinzel',serif", fontSize:11, cursor:"pointer" }}>✕ CLOSE</button>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"28px 32px", display:"flex", flexDirection:"column", gap:14, maxWidth:700, margin:"0 auto", width:"100%" }}>
            {/* Create new */}
            <div onClick={() => openDeckBuilder({ isNew:true })}
              style={{ display:"flex", alignItems:"center", gap:16, padding:"18px 22px", background:"rgba(232,192,96,0.06)", border:"2px dashed #e8c06055", borderRadius:14, cursor:"pointer", transition:"all .2s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(232,192,96,0.12)";e.currentTarget.style.borderColor="#e8c060aa";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(232,192,96,0.06)";e.currentTarget.style.borderColor="#e8c06055";}}>
              <div style={{ width:52, height:52, borderRadius:"50%", background:"rgba(232,192,96,0.1)", border:"2px solid #e8c06066", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>+</div>
              <div>
                <div style={{ fontFamily:"'Cinzel',serif", fontSize:16, fontWeight:700, color:"#e8c060", letterSpacing:1 }}>CREATE NEW DECK</div>
                <div style={{ fontSize:10, color:"#806040", marginTop:3 }}>Start fresh from 40 cards — Rule of 3, max 4 Champions</div>
              </div>
            </div>
            {/* Pinned: Starter Deck always first */}
            {(() => {
              const hasStarter = decks.some(d => d.name === "Starter Deck");
              if (hasStarter) return null;
              return (
                <div style={{ display:"flex", alignItems:"center", gap:16, padding:"18px 22px", background:"rgba(232,192,96,0.04)", border:"1px solid #3a2c10", borderRadius:14 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ fontFamily:"'Cinzel',serif", fontSize:16, fontWeight:700, color:"#f0e0c8", letterSpacing:1 }}>Starter Deck</div>
                      <span style={{ fontSize:7, padding:"2px 7px", background:"rgba(232,192,96,0.12)", border:"1px solid #e8c06044", borderRadius:20, fontFamily:"'Cinzel',serif", color:"#a08040", letterSpacing:1 }}>DEFAULT</span>
                    </div>
                    <div style={{ fontSize:10, color:"#806040", marginTop:4 }}>{STARTER_DECK.length} cards</div>
                  </div>
                  <button onClick={() => openDeckBuilder({ isNew:false, index:"starter", name:"Starter Deck", cards:STARTER_DECK })}
                    style={{ padding:"9px 20px", background:"linear-gradient(135deg,#c89010,#f0c040)", border:"none", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:11, fontWeight:700, color:"#1a1000", cursor:"pointer", letterSpacing:1 }}>EDIT</button>
                </div>
              );
            })()}
            {/* Saved decks */}
            {decks.map((d, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:16, padding:"18px 22px", background:"#0e0c08", border:"1px solid #2a2010", borderRadius:14 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Cinzel',serif", fontSize:16, fontWeight:700, color:"#f0e0c8", letterSpacing:1 }}>{d.name}</div>
                  <div style={{ fontSize:10, color:"#806040", marginTop:4 }}>{d.cards?.length || 0} cards</div>
                </div>
                <button onClick={() => openDeckBuilder({ isNew:false, index:i, name:d.name, cards:d.cards||[] })}
                  style={{ padding:"9px 20px", background:"linear-gradient(135deg,#c89010,#f0c040)", border:"none", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:11, fontWeight:700, color:"#1a1000", cursor:"pointer", letterSpacing:1 }}>EDIT</button>
                <button onClick={() => deleteDeck(i)}
                  style={{ padding:"9px 14px", background:"transparent", border:"1px solid #5a1010", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:11, color:"#904040", cursor:"pointer" }}>DELETE</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Header row: title + deck builder CTA */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 24, fontWeight: 700, color: "#e8c060", margin: 0 }}>Collection</h2>
          <div style={{ fontSize: 11, color: "#806040", marginTop: 3 }}>{owned.length} / {ownablePool.length} cards obtained</div>
        </div>
        <button onClick={() => openDeckBuilder("select")}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 22px", background: "linear-gradient(135deg,#1a1608,#2a2010)", border: "2px solid #e8c06055", borderRadius: 12, cursor: "pointer", fontFamily: "'Cinzel',serif", color: "#e8c060", transition: "all .2s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor="#e8c060aa"; e.currentTarget.style.background="linear-gradient(135deg,#2a2010,#3a3018)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor="#e8c06055"; e.currentTarget.style.background="linear-gradient(135deg,#1a1608,#2a2010)"; }}>
          <span style={{ fontSize: 22 }}>🗂</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>BUILD DECK</div>
            <div style={{ fontSize: 9, color: "#a08040", marginTop: 1 }}>{decks.length} deck{decks.length !== 1 ? "s" : ""} saved</div>
          </div>
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." style={{ flex: 1, minWidth: 120, padding: "8px 12px", background: "#100e08", border: "1px solid #2a2010", borderRadius: 7, color: "#f0e8d8", fontSize: 12, outline: "none" }} />
        <select value={regFilter} onChange={(e) => setRegFilter(e.target.value)} style={{ padding: "8px", background: "#100e08", border: "1px solid #2a2010", borderRadius: 7, color: "#f0e8d8", fontFamily: "'Cinzel',serif", fontSize: 10, outline: "none" }}>
          <option value="all">All</option>{[...REGIONS, "Bloodpact"].map((r) => (<option key={r} value={r}>{r}</option>))}
        </select>
      </div>
      {/* OWNED */}
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#c09848", marginBottom:12, fontWeight:600 }}>OWNED ({filter(owned).length})</div>
      <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:28, alignItems:"flex-start" }}>
        {filter(owned).map((c, i) => <Fragment key={c.id}>{CollectionCard({ card:c, i })}</Fragment>)}
        {filter(owned).length === 0 && <div style={{ fontSize:11, color:"#503828", fontStyle:"italic" }}>No cards yet — open some packs!</div>}
      </div>
      {/* NOT YET OBTAINED */}
      {filter(notYet).length > 0 && (<>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#604028", marginBottom:12, fontWeight:600 }}>NOT YET OBTAINED ({filter(notYet).length})</div>
        <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:28 }}>
          {filter(notYet).map((c) => (
            <div key={c.id} style={{ opacity:0.35, filter:"grayscale(55%)", cursor:"default", position:"relative" }} title={c.name}>
              <Card card={c} size="sm" />
            </div>
          ))}
        </div>
      </>)}
      {/* COMING SOON — Fables + Food Fight */}
      {comingSoon.filter(c => regFilter==="all"||c.region===regFilter).filter(c=>!search||c.name.toLowerCase().includes(search.toLowerCase())).length > 0 && (<>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#9070ff88", marginBottom:12, fontWeight:600, letterSpacing:2 }}>COMING SOON ({comingSoon.length})</div>
        <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
          {comingSoon.filter(c => regFilter==="all"||c.region===regFilter).filter(c=>!search||c.name.toLowerCase().includes(search.toLowerCase())).map((c) => (
            <div key={c.id} style={{ position:"relative", filter:"grayscale(65%) brightness(0.6)", opacity:0.8 }}>
              <Card card={c} size="sm" />
              {/* Corner ribbon banner */}
              <div style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%", overflow:"hidden", borderRadius:8, pointerEvents:"none" }}>
                <div style={{ position:"absolute", top:14, left:-20, width:88, background:"linear-gradient(135deg,#7040d0,#a060ff)", color:"#fff", fontFamily:"'Cinzel',serif", fontSize:6, fontWeight:900, letterSpacing:1, padding:"4px 0", textAlign:"center", transform:"rotate(-38deg)", transformOrigin:"center", boxShadow:"0 2px 10px rgba(0,0,0,0.6), 0 0 8px #9070ff88", whiteSpace:"nowrap" }}>COMING SOON</div>
              </div>
            </div>
          ))}
        </div>
      </>)}
    </div>
  );
}

// ═══ HOME ════════════════════════════════════════════════════════════════════
const TICKER_ITEMS = [
  '🏆 RANKED SEASON 1 LIVE — ELO matchmaking active · Iron → Bronze → Silver → Gold → Grandmaster',
  `🎉 PATCH ${CURRENT_PATCH} — THE FABLES & FOOD FIGHT are NOW LIVE · All alpha accounts granted full sets`,
  '📖 THE FABLES NOW LIVE — Zeus, Hades, Lightning Meter, Soul Harvest · 12 Olympus champions',
  '🍓 FOOD FIGHT NOW LIVE — Berry & Tooty, Master Jax, Group Synergy system · Splat keyword · Ingredient tokens',
  '💥 NEW: Splat keyword — units deal 1 damage on death · amplified by Protein Synergy Tier 4',
  '🛡 Shield rework — blocks first hit, first spell, and first attacker strike · breaks after absorb',
  '⚡ Zeus — Lightning Meter charges from Spells + Swift attacks · fires at 2 stacks',
  '🎯 Spell targeting — click a targeted spell, then click your mark',
  '🌸 ANIME ISLAND — Alternative art collection · 0.1% Prismatic Sun Strike',
  '🩸 Bloodpact spike: Venomlord at 4-cost clearing boards consistently in casual queue',
  '✨ ALPHA EARLY ACCESS LIVE — Welcome to Forge & Fable · Report bugs in Discord',
];
function CardOfTheWeek() {
  const [open, setOpen] = useState(false);
  const [tilt, setTilt] = useState({ rx:0, ry:0 });
  const card = POOL.find(c => c.id === "hades_soul_reaper");
  if (!card) return null;
  const bc = card.border || "#9050d0";
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:0, cursor:"pointer" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { setOpen(false); setTilt({ rx:0, ry:0 }); }}>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#c090ff", letterSpacing:5, fontWeight:700, textShadow:"0 0 14px #9070ff88", marginBottom:12 }}>✦ CARD OF THE WEEK ✦</div>
      {/* Fixed-height card slot — card lives here, never escapes into nav */}
      <div style={{ height:170, width:160, display:"flex", alignItems:"flex-end", justifyContent:"center", position:"relative", overflow:"visible" }}>
        {/* Light beam cone from chest opening */}
        <div style={{ position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)", width:open?150:0, height:open?220:0, background:"linear-gradient(to top,rgba(255,200,40,0.28),rgba(255,220,80,0.08),transparent)", clipPath:"polygon(35% 100%,65% 100%,100% 0%,0% 0%)", transition:"all 0.5s ease", pointerEvents:"none", opacity:open?1:0 }} />
        {/* Light rays */}
        {["-40deg","-20deg","0deg","20deg","40deg"].map((r,i) => (
          <div key={i} style={{ position:"absolute", bottom:0, left:"50%", width:3, height:open?200:0, transformOrigin:"bottom center", transform:`translateX(-50%) rotate(${r})`, background:"linear-gradient(to top,rgba(255,210,60,0.5),transparent)", transition:`height 0.4s ${i*0.04}s ease, opacity 0.4s`, opacity:open?0.6:0, pointerEvents:"none" }} />
        ))}
        {/* The card */}
        <div style={{ transform:`translateY(${open?0:20}px)`, opacity:open?1:0, transition:"all 0.42s cubic-bezier(0.34,1.2,0.64,1)", perspective:800, position:"relative", zIndex:2 }}>
          <div style={{ transform:`rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`, transition:"transform 0.08s linear", transformStyle:"preserve-3d" }}
            onMouseMove={e => { const r=e.currentTarget.getBoundingClientRect(),xp=(e.clientX-r.left)/r.width,yp=(e.clientY-r.top)/r.height; setTilt({ rx:(yp-0.5)*-20, ry:(xp-0.5)*20 }); }}>
            <Card card={card} size="md" hideCost />
          </div>
        </div>
      </div>
      {/* Chest sits right below card slot */}
      <div style={{ position:"relative", width:170 }}>
        {/* Ground glow */}
        <div style={{ position:"absolute", bottom:-8, left:"50%", transform:"translateX(-50%)", width:200, height:30, background:`radial-gradient(ellipse,${bc}${open?"55":"1a"} 0%,transparent 70%)`, transition:"all 0.4s", pointerEvents:"none" }} />
        <div style={{ perspective:500 }}>
          {/* Lid */}
          <div style={{ width:"100%", height:52, background:"linear-gradient(135deg,#3c1e06,#5c3210,#7c4a18)", borderRadius:"12px 12px 3px 3px", border:`2px solid ${open?"#f0d060":"#6a4010"}`, borderBottom:"none", transformOrigin:"bottom center", transform:open?"rotateX(-118deg)":"rotateX(0deg)", transition:"transform 0.48s cubic-bezier(0.34,1.1,0.64,1)", position:"relative", zIndex:4, display:"flex", alignItems:"center", justifyContent:"center", gap:8, backfaceVisibility:"hidden", boxShadow:open?"0 -4px 18px #e8c06055":"none" }}>
            <span style={{ fontSize:20, filter:open?"drop-shadow(0 0 8px #f0d060)":"none", transition:"filter .3s" }}>⚔</span>
            <div style={{ width:26, height:9, background:"linear-gradient(90deg,#b07010,#f0d050,#b07010)", borderRadius:5, boxShadow:open?"0 0 14px #f0d050":"0 0 3px #906020", transition:"box-shadow .3s" }} />
          </div>
          {/* Body */}
          <div style={{ width:"100%", height:62, background:"linear-gradient(180deg,#241004,#160a02)", borderRadius:"3px 3px 12px 12px", border:`2px solid ${open?"#f0d060":"#5a3810"}`, borderTop:"none", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, boxShadow:"0 8px 28px rgba(0,0,0,0.85)" }}>
            <div style={{ width:34, height:12, background:"linear-gradient(90deg,#a06010,#f0c030,#a06010)", borderRadius:6, boxShadow:open?"0 0 16px #e8c060cc, 0 0 28px #c89020aa":"0 0 3px #c8902033", transition:"all 0.4s" }} />
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:7, color:open?"#e8c060":"#705020", letterSpacing:2, fontWeight:700, transition:"color 0.3s" }}>{open?"HADES AWAITS":"HOVER TO OPEN"}</span>
          </div>
        </div>
        {/* Sparkles */}
        {[[-22,-6],[24,4],[-16,22],[20,20],[-8,-18],[10,-16]].map(([ox,oy],i) => (
          <div key={i} style={{ position:"absolute", top:`calc(40% + ${oy}px)`, left:`calc(50% + ${ox}px)`, width:4, height:4, background:"#f0e040", borderRadius:"50%", boxShadow:"0 0 7px #f0e040, 0 0 13px #f0a000", opacity:open?0.9:0, transform:open?`translate(${ox*0.7}px,${oy-12}px) scale(1)`:"scale(0)", transition:`all 0.45s ${i*0.06}s`, pointerEvents:"none" }} />
        ))}
      </div>
      <div style={{ marginTop:10, fontFamily:"'Cinzel',serif", fontSize:9, color:bc, letterSpacing:2, fontWeight:700, textShadow:`0 0 10px ${bc}`, opacity:open?1:0, transform:open?"translateY(0)":"translateY(4px)", transition:"all 0.3s" }}>{card.name.toUpperCase()}</div>
    </div>
  );
}

function HomeScreen({ setTab, user }) {
  const [active, setActive] = useState(0);
  const [entered, setEntered] = useState(false);
  const [statCounts, setStatCounts] = useState({ cards: 44, factions: 8, keywords: 9 });
  const [cardTilt, setCardTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50 });
  const starCanvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const statsRef = useRef(null);
  const statsCountedRef = useRef(false);

  useEffect(() => {
    MusicCtx.play("home"); setEntered(true);
    const carouselId = setInterval(() => setActive((c) => (c + 1) % HOME_CARDS.length), 3500);

    // ── Animated canvas starfield ──────────────────────────
    const canvas = starCanvasRef.current;
    let animId, stars = [], W = 0, H = 0, time = 0;
    function resize() {
      if (!canvas) return;
      W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight;
    }
    function makeStar(layer) {
      return { x: Math.random()*W, y: Math.random()*H, r: layer===0?0.4+Math.random()*0.7:layer===1?0.7+Math.random()*1.1:1.1+Math.random()*1.6, twinkleOffset: Math.random()*Math.PI*2, twinkleSpeed: 0.5+Math.random()*1.4, layer, base: 0.2+Math.random()*0.65 };
    }
    if (canvas) {
      resize();
      [160,70,28].forEach((n,l)=>{ for(let i=0;i<n;i++) stars.push(makeStar(l)); });
      function frame() {
        time += 0.007;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,W,H);
        const ox=(mouseRef.current.x/W-0.5), oy=(mouseRef.current.y/H-0.5);
        stars.forEach(s=>{
          const px=ox*18*(s.layer+1), py=oy*10*(s.layer+1);
          const tw=0.5+0.5*Math.sin(time*s.twinkleSpeed+s.twinkleOffset);
          const op=s.base*(0.4+0.6*tw);
          ctx.beginPath(); ctx.arc(((s.x+px+W)%W),((s.y+py+H)%H),s.r,0,Math.PI*2);
          ctx.fillStyle=`rgba(255,248,220,${op})`; ctx.fill();
          if(s.r>1.3){ ctx.beginPath(); ctx.arc(((s.x+px+W)%W),((s.y+py+H)%H),s.r*2.8,0,Math.PI*2); ctx.fillStyle=`rgba(255,240,180,${op*0.1})`; ctx.fill(); }
        });
        animId=requestAnimationFrame(frame);
      }
      frame();
      window.addEventListener('resize', resize);
    }

    // ── Mouse tracking for parallax ────────────────────────
    const onMouse = e => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMouse);

    // ── Stat counter IntersectionObserver ──────────────────
    const statsEl = statsRef.current;
    let obs;
    if (statsEl) {
      obs = new IntersectionObserver(entries => {
        if (entries.some(e=>e.isIntersecting) && !statsCountedRef.current) {
          statsCountedRef.current = true;
          const targets = { cards:65, factions:9, keywords:8 };
          const dur = 1600; const start = performance.now();
          const tick = now => {
            const t = Math.min((now-start)/dur,1), ease=1-Math.pow(1-t,3);
            setStatCounts({ cards:Math.round(ease*targets.cards), factions:Math.round(ease*targets.factions), keywords:Math.round(ease*targets.keywords) });
            if(t<1) requestAnimationFrame(tick);
          };
          setStatCounts({ cards:0, factions:0, keywords:0 });
          requestAnimationFrame(tick);
        }
      }, { threshold: 0.3 });
      obs.observe(statsEl);
    }

    return () => {
      clearInterval(carouselId);
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
      if(obs && statsEl) obs.unobserve(statsEl);
    };
  }, []);

  const REGION_ICONS = { Thornwood: "🌿", "Shattered Expanse": "💎", "Azure Deep": "🌊", Ashfen: "🔥", Ironmarch: "⚙", Sunveil: "☀", Bloodpact: "🩸", "Food Fight": "🍓", Fables: "📖" };
  const REGION_ICON_SIZE = { fontSize: 16 };
  // Ticker items doubled for seamless loop
  const tickerDoubled = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (<>
    {/* Live ticker strip */}
    <div style={{ overflow:"hidden", height:36, background:"rgba(3,2,8,0.92)", borderBottom:"1px solid rgba(232,192,96,0.08)", display:"flex", alignItems:"center", position:"sticky", top:0, zIndex:50 }}>
      <div style={{ flexShrink:0, padding:"0 18px", fontFamily:"'Cinzel',serif", fontSize:9, fontWeight:700, color:"#cc2030", letterSpacing:3, borderRight:"1px solid rgba(232,192,96,0.12)", height:"100%", display:"flex", alignItems:"center", background:"rgba(4,3,10,0.6)", whiteSpace:"nowrap", position:"relative", zIndex:2 }}>● LIVE</div>
      <div style={{ flex:1, overflow:"hidden", height:"100%", display:"flex", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", animation:"tickerScroll 80s linear infinite", whiteSpace:"nowrap", willChange:"transform" }}>
          {tickerDoubled.map((item, i) => (
            <span key={i} style={{ fontSize:11, color:"rgba(160,148,120,0.85)", padding:"0 36px", borderRight:"1px solid rgba(232,192,96,0.08)" }} dangerouslySetInnerHTML={{ __html: item.replace(/([A-Z]{2,}(?:\s[A-Z0-9]+)*\s(?:LIVE|DEPLOYED|SOON|REPORT|GIVEAWAY))/g, '<span style="color:#e8c060;font-weight:600">$1</span>') }} />
          ))}
        </div>
      </div>
    </div>

    {/* HERO — space nebula background */}
    <section style={{ position: "relative", minHeight: 580, overflow: "hidden" }}>
      {/* Nebula animated background */}
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(120deg,#0a0420 0%,#10062a 25%,#060818 50%,#1a0828 75%,#060c1e 100%)", backgroundSize:"400% 400%", animation:"nebulaDrift 18s ease infinite", willChange:"background-position", zIndex:0 }} />
      {/* Nebula clouds */}
      <div style={{ position:"absolute", top:"-20%", left:"-10%", width:"70%", height:"140%", background:"radial-gradient(ellipse at center,rgba(80,20,160,0.25) 0%,rgba(40,0,120,0.15) 40%,transparent 70%)", pointerEvents:"none", zIndex:1 }} />
      <div style={{ position:"absolute", top:"10%", right:"-5%", width:"60%", height:"120%", background:"radial-gradient(ellipse at center,rgba(180,100,20,0.12) 0%,rgba(120,60,0,0.08) 40%,transparent 70%)", pointerEvents:"none", zIndex:1 }} />
      <div style={{ position:"absolute", bottom:"0", left:"30%", width:"50%", height:"80%", background:"radial-gradient(ellipse at center,rgba(20,60,160,0.18) 0%,rgba(0,30,100,0.1) 50%,transparent 70%)", pointerEvents:"none", zIndex:1 }} />
      {/* Animated canvas starfield — 3 parallax layers */}
      <canvas ref={starCanvasRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%", zIndex:1, pointerEvents:"none" }} />
      <FloatingParticles count={20} color="#a060ff" speed={0.4} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 28px 44px", display: "grid", gridTemplateColumns: "1fr 400px", gap: 52, alignItems: "center", position: "relative", zIndex: 2 }}>
        {/* LEFT: Title + CTA */}
        <div style={{ animation: entered ? "slideInLeft 0.8s ease-out" : undefined }}>
          {/* Patch badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(220,160,30,0.14)", border: "1px solid #d8a03055", borderRadius: 30, padding: "5px 18px", marginBottom: 22 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#e8c060", boxShadow: "0 0 10px #e8c060cc", animation: "pulse 2s infinite" }} />
            <span style={{ fontFamily: "'Cinzel',serif", fontSize: 10, color: "#d8a838", letterSpacing: 3, fontWeight: 700 }}>{CURRENT_PATCH} · MULTIPLAYER ALPHA LIVE</span>
          </div>
          {/* Title */}
          <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: "clamp(48px,6.5vw,80px)", fontWeight: 900, lineHeight: 0.95, color: "#f0d878", margin: "0 0 6px", textShadow: "0 0 80px #c89020bb, 0 0 140px #c8902055, 0 4px 8px rgba(0,0,0,0.9), 0 2px 2px rgba(0,0,0,1)" }}>
            Forge
          </h1>
          <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: "clamp(48px,6.5vw,80px)", fontWeight: 900, lineHeight: 0.95, color: "#f0d878", margin: "0 0 22px", textShadow: "0 0 80px #c89020bb, 0 0 140px #c8902055, 0 4px 8px rgba(0,0,0,0.9)" }}>
            {"&"} Fable
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.9, color: "#b8aad0", margin: "0 0 24px", maxWidth: 420, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>44 cards across 8 factions. Real abilities, the Lightning Meter, and environments that reshape the battlefield. Creatures that level up, bleed, echo, and strike.</p>
          {/* Stat boxes */}
          <div ref={statsRef} style={{ display: "flex", gap: 10, marginBottom: 28 }}>
            {[{ val: statCounts.cards, sub: "CARDS" }, { val: statCounts.factions, sub: "FACTIONS" }, { val: statCounts.keywords, sub: "KEYWORDS" }].map((s) => (<div key={s.sub} style={{ background: "rgba(232,192,96,0.08)", border: "1px solid rgba(232,192,96,0.2)", borderRadius: 10, padding: "12px 20px", textAlign: "center", backdropFilter:"blur(4px)" }}><div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 900, color: "#e8c060", textShadow:"0 0 20px #e8c06066" }}>{s.val}</div><div style={{ fontSize: 8, color: "#806040", letterSpacing: 2, fontFamily: "'Cinzel',serif", marginTop: 2 }}>{s.sub}</div></div>))}
          </div>
          {/* CTA Buttons */}
          {user && (<div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={() => setTab("play")} style={{ padding: "14px 32px", background: "linear-gradient(135deg,#7a0808,#c82020)", border: "1px solid #e84040aa", borderRadius: 8, color: "#ffe0e0", fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 700, letterSpacing: 3, cursor: "pointer", boxShadow: "0 6px 28px rgba(200,30,30,0.5), 0 0 40px rgba(200,30,30,0.2)", animation: "battleGlow 2.4s ease-in-out infinite", transition: "transform .2s" }} onMouseEnter={(e) => { e.currentTarget.style.transform="translateY(-3px) scale(1.03)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform="none"; }}>BATTLE</button>
            <button onClick={() => setTab("store")} style={{ padding: "14px 28px", background: "linear-gradient(135deg,#503006,#8a5010)", border: "1px solid #d8901055", borderRadius: 8, color: "#f0d880", fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 700, letterSpacing: 3, cursor: "pointer", boxShadow: "0 6px 24px rgba(180,120,0,0.3)", transition: "all .2s" }} onMouseEnter={(e) => { e.currentTarget.style.transform="translateY(-3px)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform="none"; }}>STORE</button>
            <button onClick={() => setTab("collection")} style={{ padding: "14px 28px", background: "rgba(232,192,96,0.06)", border: "1px solid #e8c06066", borderRadius: 8, color: "#e8c060", fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: 3, cursor: "pointer", fontWeight: 600, backdropFilter:"blur(4px)", transition: "all .2s" }} onMouseEnter={(e) => { e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.background="rgba(232,192,96,0.12)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform="none"; e.currentTarget.style.background="rgba(232,192,96,0.06)"; }}>COLLECTION</button>

          </div>)}
          {!user && (<div style={{ padding:"16px 22px", background:"rgba(232,192,96,0.06)", border:"1px solid #e8c06033", borderRadius:10, fontSize:12, color:"#a09060", fontFamily:"'Cinzel',serif", letterSpacing:1 }}>Sign in to start your journey ⚔</div>)}
        </div>
        {/* RIGHT: Card of the Week — treasure chest */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, animation: entered ? "slideInRight 0.8s ease-out" : undefined }}>
          <CardOfTheWeek />
        </div>
      </div>
    </section>

    {/* Coming Soon — 3 faction teasers */}
    <section style={{ background:"linear-gradient(180deg,#080610 0%,#0c0814 100%)", borderTop:"1px solid #1a1228", borderBottom:"1px solid #1a1228", padding:"36px 28px 28px" }}>
      <style>{`
        @keyframes berryBounceFF{0%,100%{transform:scaleY(1) scaleX(1) translateY(0)}38%{transform:scaleY(1.09) scaleX(0.93) translateY(-16px)}58%{transform:scaleY(0.87) scaleX(1.1) translateY(4px)}74%{transform:scaleY(1.04) scaleX(0.97) translateY(-5px)}}
        @keyframes boltFloat{0%,100%{transform:translateY(0) scale(1) rotate(-4deg);filter:drop-shadow(0 0 10px #ffe04099)}40%{transform:translateY(-14px) scale(1.08) rotate(4deg);filter:drop-shadow(0 0 22px #ffe040dd) drop-shadow(0 0 40px #f0a00066)}70%{transform:translateY(-6px) scale(1.03) rotate(-2deg);filter:drop-shadow(0 0 14px #ffe040bb)}}
        @keyframes blossomSpin{0%{transform:rotate(0deg) scale(1);filter:drop-shadow(0 0 8px #ff80c066)}40%{transform:rotate(25deg) scale(1.15);filter:drop-shadow(0 0 20px #ff80c0cc) drop-shadow(0 0 36px #ff40a055)}70%{transform:rotate(10deg) scale(1.06);filter:drop-shadow(0 0 12px #ff80c099)}100%{transform:rotate(0deg) scale(1);filter:drop-shadow(0 0 8px #ff80c066)}}
      `}</style>
      <div style={{ maxWidth:1100, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#504038", letterSpacing:5, fontWeight:700 }}>COMING SOON</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:0 }}>

          {/* COL 1 — The Fables */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 32px 0 0", borderRight:"1px solid #1e1430", gap:10 }}>
            <div style={{ fontSize:38, animation:"boltFloat 2.2s ease-in-out infinite", display:"inline-block" }}>⚡</div>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#78cc45", letterSpacing:5, fontWeight:700, textShadow:"0 0 8px #78cc4566" }}>● NOW LIVE</div>
            <div style={{ fontFamily:"'Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif", fontSize:26, fontStyle:"italic", color:"#c8a0e8", lineHeight:1.2, textAlign:"center" }}>The Fables</div>
            <p style={{ fontSize:11, color:"#a890d0", lineHeight:1.75, margin:"0 0 8px", textAlign:"center" }}>Zeus, Hades, and 10 more. Greek myth comes to battle with the Lightning Meter and Soul Harvest.</p>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center" }}>
              {["12 Cards","Zeus","Hades","Lightning Meter"].map(t => (
                <span key={t} style={{ fontSize:9, padding:"4px 12px", background:"rgba(144,80,255,0.18)", border:"1px solid #9060dd88", borderRadius:20, color:"#d0b0ff", fontFamily:"'Cinzel',serif", letterSpacing:1, fontWeight:600 }}>{t}</span>
              ))}
            </div>
          </div>

          {/* COL 2 — Anime Island Alt Art */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 32px", borderRight:"1px solid #1e1430", gap:10 }}>
            <div style={{ fontSize:38, animation:"blossomSpin 2.6s ease-in-out infinite", display:"inline-block" }}>🌸</div>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#ff80c0", letterSpacing:5, fontWeight:700 }}>OUT NOW!</div>
            <div style={{ fontFamily:"'Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif", fontSize:26, fontStyle:"italic", color:"#f0a0d0", lineHeight:1.2, textAlign:"center" }}>Anime Island</div>
            <p style={{ fontSize:11, color:"#d898b8", lineHeight:1.75, margin:"0 0 8px", textAlign:"center" }}>Alternative art skins for the full base set — animated Prismatic variants and rare alt frames.</p>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center" }}>
              {["Alt Art Skins","0.1% Prismatic","All Regions"].map(t => (
                <span key={t} style={{ fontSize:9, padding:"4px 12px", background:"rgba(255,80,160,0.18)", border:"1px solid #ff60b088", borderRadius:20, color:"#ffb0d8", fontFamily:"'Cinzel',serif", letterSpacing:1, fontWeight:600 }}>{t}</span>
              ))}
            </div>
          </div>

          {/* COL 3 — Food Fight */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 0 0 32px", gap:10 }}>
            <svg viewBox="0 0 80 90" xmlns="http://www.w3.org/2000/svg" style={{ width:38, height:42, filter:"drop-shadow(0 0 10px rgba(220,50,50,0.7))", animation:"berryBounceFF 1.8s ease-in-out infinite" }}>
              <path d="M40 14 Q44 4 48 0" stroke="#2e7d32" strokeWidth="3" strokeLinecap="round" fill="none"/>
              <ellipse cx="50" cy="7" rx="9" ry="5" fill="#388e3c" transform="rotate(-25 50 7)"/>
              <ellipse cx="32" cy="8" rx="7" ry="4" fill="#2e7d32" transform="rotate(20 32 8)"/>
              <path d="M40 18 C20 16,4 34,4 52 C4 72,20 88,40 88 C60 88,76 72,76 52 C76 34,60 16,40 18 Z" fill="url(#ffGH2)"/>
              {[{x:28,y:34},{x:44,y:30},{x:58,y:38},{x:22,y:50},{x:38,y:52},{x:54,y:52},{x:30,y:66},{x:48,y:64}].map((s,i)=>(<ellipse key={i} cx={s.x} cy={s.y} rx="2.2" ry="3" fill="rgba(255,240,180,0.7)" transform={`rotate(${-15+i*5} ${s.x} ${s.y})`}/>))}
              <ellipse cx="30" cy="36" rx="8" ry="5" fill="rgba(255,255,255,0.25)" transform="rotate(-20 30 36)"/>
              <defs><radialGradient id="ffGH2" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#ff7070"/><stop offset="45%" stopColor="#dd1111"/><stop offset="100%" stopColor="#6b0000"/></radialGradient></defs>
            </svg>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#78cc45", letterSpacing:5, fontWeight:700, textShadow:"0 0 8px #78cc4566" }}>● NOW LIVE</div>
            <div style={{ fontFamily:"'Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif", fontSize:26, fontStyle:"italic", color:"#ff8080", lineHeight:1.2, textAlign:"center" }}>Food Fight</div>
            <p style={{ fontSize:11, color:"#e09090", lineHeight:1.75, margin:0, textAlign:"center" }}>Berry {"&"} Tooty, Master Jax, and Group Synergy. Splat, ingredients, and culinary chaos.</p>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center" }}>
              {["13 Cards","Splat","Group Synergy","Tokens"].map(t => (
                <span key={t} style={{ fontSize:9, padding:"4px 12px", background:"rgba(220,80,40,0.18)", border:"1px solid #dd603088", borderRadius:20, color:"#ffaaaa", fontFamily:"'Cinzel',serif", letterSpacing:1, fontWeight:600 }}>{t}</span>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>

    {/* Fables card fan — full-width showcase */}
    <section style={{ background:"linear-gradient(180deg,#060212 0%,#0a0420 50%,#060212 100%)", borderBottom:"1px solid #1a1228", padding:"44px 28px 36px" }}>
      <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:"#c0a0ff", letterSpacing:5, fontWeight:700, textShadow:"0 0 12px #9070ff66" }}>THE FABLES · NOW LIVE — INSPECT THE SET</div>
        <ForgeAndFableTeaser inline={true} />
        <div style={{ fontSize:11, color:"#d0b8ff", fontFamily:"'Cinzel',serif", letterSpacing:4, fontWeight:700, textShadow:"0 1px 4px rgba(0,0,0,0.9), 0 0 12px #9070ff44" }}>↑ CLICK A CARD TO INSPECT</div>
      </div>
    </section>
    {/* Region/faction badge strip */}
    <section style={{ borderTop:"1px solid rgba(255,255,255,0.06)", padding: "28px 28px 40px", background:"rgba(0,0,0,0.3)", backdropFilter:"blur(8px)" }}>
      <div style={{ maxWidth:1100, margin:"0 auto" }}>
        <div style={{ textAlign:"center", fontFamily:"'Cinzel',serif", fontSize:9, color:"#504038", letterSpacing:3, marginBottom:18, fontWeight:700 }}>FACTIONS & REGIONS</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", overflowX: "auto", justifyContent: "center", scrollbarWidth: "none", paddingBottom: 4 }}>
          {[...REGIONS, "Bloodpact"].map((r, i) => (<div key={r} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, padding: "10px 14px", background: `linear-gradient(180deg,${GLOW[r]}0e,transparent)`, border: `1px solid ${GLOW[r]}25`, borderRadius: 10, fontFamily: "'Cinzel',serif", fontSize: 9, color: GLOW[r], fontWeight: 700, letterSpacing: 0.5, animation: `cardReveal 0.4s ease-out ${i * 0.05}s both`, cursor: "pointer", transition: "all .22s", flexShrink: 0, textAlign:"center", backdropFilter:"blur(4px)", whiteSpace:"nowrap" }} onMouseEnter={(e) => { e.currentTarget.style.background = `linear-gradient(180deg,${GLOW[r]}20,${GLOW[r]}08)`; e.currentTarget.style.borderColor = GLOW[r] + "55"; e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow=`0 8px 24px ${GLOW[r]}22`; }} onMouseLeave={(e) => { e.currentTarget.style.background = `linear-gradient(180deg,${GLOW[r]}0e,transparent)`; e.currentTarget.style.borderColor = GLOW[r] + "25"; e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; }} onClick={() => setTab("collection")}>
            <div style={{ fontSize:18 }}>{REGION_ICONS[r] || "⬡"}</div>
            {r}
          </div>))}
        </div>
      </div>
    </section>
    {/* Patch Notes Hub Section */}
    {(() => {
      const patchRows = [
        { icon:"🔧", label:"Matchmaking fixed — PvP queue now connects reliably in all regions" },
        { icon:"🔢", label:"Mana rework — game now starts at 1 mana, gains +1 per turn up to 7 max (was starting at 2)" },
        { icon:"🎯", label:"Spell targeting — click a targeted spell, then click the enemy unit to aim it" },
        { icon:"⚡", label:"Zeus rework — Lightning Meter fires 2 dmg at just 2 charges · charges from any Spell or Swift attack · Swift keyword removed from Zeus" },
        { icon:"💀", label:"Hades rework — Soul Harvest works from hand AND board · Shield keyword removed · HP gain capped at 10" },
        { icon:"🃏", label:"Fracture fix — Fragment copy now inherits all keywords from original (except Fracture)" },
        { icon:"🌅", label:"Shifting Dunes fix — mana discount now correctly applies in PvP as well as AI mode" },
        { icon:"💊", label:"HP bars now color-coded: green (healthy) → orange (mid) → red (critical at 10 or below)" },
        { icon:"⚗", label:"Coming next: Leaderboard · Food Fight launch · Draft Mode", dim:true },
      ];
      return (
        <section style={{ background:"linear-gradient(180deg,#0c0a06,#080608)", borderTop:"1px solid #2a2010", padding:"32px 28px 36px" }}>
          <div style={{ maxWidth:1100, margin:"0 auto" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:13, color:"#806040", letterSpacing:3, fontWeight:700 }}>📋 PATCH NOTES</span>
              <span style={{ padding:"3px 10px", background:"rgba(232,192,96,0.12)", border:"1px solid #e8c06044", borderRadius:12, fontSize:9, color:"#e8c060", fontFamily:"'Cinzel',serif", letterSpacing:2, fontWeight:700 }}>{CURRENT_PATCH}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:8 }}>
              {patchRows.map((r,i) => (
                <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"10px 14px", borderRadius:9, background: r.dim ? "transparent" : "rgba(255,255,255,0.02)", border:`1px solid ${r.dim?"transparent":"#2a2010"}` }}>
                  <span style={{ fontSize:16, flexShrink:0, width:24, textAlign:"center", lineHeight:1.3 }}>{r.icon}</span>
                  <span style={{ fontSize:12, color: r.dim ? "#4a4030" : "#c0b490", lineHeight:1.5, flex:1 }}>{r.label}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop:16, background:"rgba(232,160,32,0.06)", border:"1px solid #e8a02022", borderRadius:10, padding:"12px 16px" }}>
              <span style={{ fontSize:10, color:"#806838", lineHeight:1.7 }}>⚠ Alpha phase — you may experience occasional lag or sync delays. We appreciate your support! 🔥</span>
            </div>
          </div>
        </section>
      );
    })()}
    {/* Bottom info bar */}
    <div style={{ background:"rgba(0,0,0,0.5)", borderTop:"1px solid rgba(255,255,255,0.05)", padding:"10px 28px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#504038", letterSpacing:2 }}>FORGE {"&"} FABLE</div>
      <div style={{ fontSize:9, color:"#3a3028", letterSpacing:2, fontFamily:"'Cinzel',serif" }}>{CURRENT_PATCH} · 44 CARDS · 8 REGIONS · {user ? "ALPHA" : "GUEST"}</div>
      <div style={{ fontSize:9, color:"#3a3028", letterSpacing:1 }}>MULTIPLAYER ALPHA</div>
    </div>
  </>);
}

// ═══ GUIDE ═══════════════════════════════════════════════════════════════════
function GuideScreen() {
  return (<div style={{ maxWidth: 860, margin: "0 auto", padding: "44px 24px 60px" }}>
    <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 26, fontWeight: 700, color: "#e8c060", textAlign: "center", margin: "0 0 30px" }}>How to Play</h2>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 26 }}>
      {[{ n: "1", t: "Opening Draw", d: "Each player draws 3 cards. One card is revealed from each hand — whoever drew the higher-cost card goes first. Ties are redrawn automatically.", c: "#e8c060" }, { n: "2", t: "Your Turn", d: "Gain 1 Mana each turn (starts at 2, max 7). Play creatures onto the board, cast spells for instant effects, or drop an Environment card to reshape the field.", c: "#28a0cc" }, { n: "3", t: "Combat", d: "Tap a creature to select it, then click an enemy creature or the enemy hero directly. Creatures with Swift can attack the same turn they're played.", c: "#9050d8" }, { n: "4", t: "Win Condition", d: "Both heroes start at 30 HP. Reduce the enemy hero to 0 to win. You have 45 seconds per turn — a warning fires at 10s. End your turn or it ends automatically!", c: "#c04810" }].map((s, i) => (<div key={s.t} style={{ background: "#1a1610", border: `1px solid ${s.c}44`, borderRadius: 13, padding: 22, animation: `cardReveal 0.4s ease-out ${i * 0.1}s both` }}><div style={{ fontFamily: "'Cinzel',serif", fontSize: 24, fontWeight: 900, color: s.c, marginBottom: 8 }}>{s.n}</div><div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, fontWeight: 700, color: s.c, marginBottom: 8 }}>{s.t}</div><p style={{ fontSize: 12, color: "#d8c898", lineHeight: 1.75, margin: 0 }}>{s.d}</p></div>))}
    </div>
    <div style={{ background: "#121008", border: "1px solid #242010", borderRadius: 14, padding: 24, marginBottom: 16 }}>
      <h3 style={{ fontFamily: "'Cinzel',serif", fontSize: 15, color: "#e8c060", margin: "0 0 18px", fontWeight: 700 }}>Keywords</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>{KW.map((k) => (<div key={k.name} style={{ padding: 12, background: `${k.color}14`, border: `1px solid ${k.color}44`, borderRadius: 9 }}><div style={{ fontSize: 16, marginBottom: 4 }}>{k.icon}</div><div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, color: k.color, marginBottom: 3, fontWeight: 700 }}>{k.name}</div><p style={{ fontSize: 10, color: "#d0b880", margin: 0, lineHeight: 1.6 }}>{k.desc}</p></div>))}</div>
    </div>

    {/* Factions & Regions */}
    <div style={{ background: "#0e0a06", border: "1px solid #2a2010", borderRadius: 14, padding: 24, marginBottom: 16 }}>
      <h3 style={{ fontFamily: "'Cinzel',serif", fontSize: 15, color: "#e8c060", margin: "0 0 6px", fontWeight: 700 }}>🌍 Factions {"&"} Regions</h3>
      <p style={{ fontSize: 11, color: "#a09068", margin: "0 0 18px", lineHeight: 1.7 }}>Each card belongs to a region — the place it hails from. Regions define a card's identity, art style, and the kinds of strategies they enable. Build around a region for synergy, or mix factions for flexibility.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
        {[
          { name:"Thornwood",        icon:"🌿", color:"#40a040", desc:"Ancient forests, druids, and wild beasts. Healing and growth." },
          { name:"Shattered Expanse",icon:"💎", color:"#8060d0", desc:"Fractured void. Echo and Fracture effects run deep here." },
          { name:"Azure Deep",       icon:"🌊", color:"#2090c0", desc:"Ocean depths. High HP walls and drowning debuffs." },
          { name:"Ashfen",           icon:"🔥", color:"#d06020", desc:"Volcanic marshes. Bleed and burn — slow attrition." },
          { name:"Ironmarch",        icon:"⚙",  color:"#a0a0a0", desc:"War machine empire. Shields and Anchor-locked titans." },
          { name:"Sunveil",          icon:"☀",  color:"#d0a020", desc:"Desert kingdom. Resonate and Swift glass-cannon warriors." },
          { name:"Bloodpact",        icon:"🩸", color:"#c03030", desc:"Forbidden arts. Pay life to unleash devastating power." },
          { name:"Food Fight",       icon:"🍓", color:"#ff5030", desc:"Culinary chaos. Tokens, splat effects, and saucy mayhem.", isNew: true },
          { name:"Fables",           icon:"📖", color:"#9070ff", desc:"Fairy tale warriors. Enchanted environments and story spells.", isNew: true },
        ].map(r => (
          <div key={r.name} style={{ padding:"12px 14px", background:`${r.color}0a`, border:`1px solid ${r.color}28`, borderRadius:9, position:"relative" }}>
            {r.isNew && <div style={{ position:"absolute", top:-8, right:-8, background:"linear-gradient(135deg,#e8c060,#c89010)", borderRadius:10, padding:"2px 8px", fontFamily:"'Cinzel',serif", fontSize:7, fontWeight:900, color:"#1a1000", letterSpacing:1 }}>NEW</div>}
            <div style={{ fontSize:20, marginBottom:6 }}>{r.icon}</div>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:r.color, fontWeight:700, marginBottom:4 }}>{r.name}</div>
            <p style={{ fontSize:10, color:"#b09878", margin:0, lineHeight:1.6 }}>{r.desc}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Ranked Mode section */}
    <div style={{ background: "#0e0c14", border: "1px solid #3a2a6033", borderRadius: 14, padding: 24 }}>
      <h3 style={{ fontFamily: "'Cinzel',serif", fontSize: 15, color: "#c080ff", margin: "0 0 6px", fontWeight: 700 }}>🏆 Ranked Mode</h3>
      <p style={{ fontSize: 12, color: "#a080c0", margin: "0 0 20px", lineHeight: 1.7 }}>Toggle <strong style={{ color:"#c080ff" }}>RANKED</strong> in Battle Setup before queuing. Wins and losses adjust your MMR using an ELO formula. Reach higher tiers to earn your badge.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { min:2000, name:"Grandmaster", color:"#ff6020", icon:"👑", desc:"Top tier. You are the myth." },
          { min:1800, name:"Diamond",     color:"#60d8ff", icon:"💎", desc:"Elite — consistently dominant." },
          { min:1600, name:"Platinum",    color:"#c080ff", icon:"🔮", desc:"Skilled forger. Feared." },
          { min:1400, name:"Gold",        color:"#f0c040", icon:"🥇", desc:"Strong strategist." },
          { min:1200, name:"Silver",      color:"#c8c8d8", icon:"🥈", desc:"Solid fundamentals." },
          { min:1000, name:"Bronze",      color:"#c08840", icon:"🥉", desc:"Learning the forge." },
          { min:0,    name:"Iron",        color:"#808080", icon:"⚔",  desc:"Every legend starts here." },
        ].map(t => (
          <div key={t.name} style={{ padding:"12px 14px", background:`${t.color}0a`, border:`1px solid ${t.color}33`, borderRadius:9, display:"flex", alignItems:"flex-start", gap:10 }}>
            <span style={{ fontSize:20, flexShrink:0 }}>{t.icon}</span>
            <div>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:t.color, fontWeight:700, marginBottom:2 }}>{t.name} <span style={{ fontWeight:400, opacity:0.6, fontSize:9 }}>({t.min}+ MMR)</span></div>
              <div style={{ fontSize:10, color:"#b09080", lineHeight:1.5 }}>{t.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {[
          { icon:"📊", title:"ELO Formula", body:"Win vs a higher-rated opponent = bigger gain. Lose to a lower-rated = bigger drop. K-factor 24." },
          { icon:"🔄", title:"Starting MMR", body:"All players begin at 1000. No MMR is gained or lost in Casual mode — only Ranked games count." },
          { icon:"🏅", title:"Ranked Wins / Losses", body:"Tracked separately from casual. Displayed on your profile badge along with current MMR." },
          { icon:"⚠", title:"Forfeit = Loss", body:"Leaving a Ranked match early counts as a full loss. Your MMR drops as if you lost normally." },
        ].map(r => (
          <div key={r.title} style={{ padding:"12px 14px", background:"rgba(255,255,255,0.02)", border:"1px solid #2a2040", borderRadius:9 }}>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:"#c0a0e0", fontWeight:700, marginBottom:4 }}>{r.icon} {r.title}</div>
            <p style={{ fontSize:10, color:"#a088a8", margin:0, lineHeight:1.6 }}>{r.body}</p>
          </div>
        ))}
      </div>
    </div>
  </div>);
}


// ═══ STORE ═══════════════════════════════════════════════════════════════════
function StoreScreen({ user, onUpdateUser }) {
  const shards = user?.shards || 0;
  const [opening, setOpening] = useState(null);
  useEffect(() => { SFX.play("pack_open"); }, []);
  const [revealed, setRevealed] = useState([]);
  const [revIdx, setRevIdx] = useState(-1);
  const [shakeCard, setShakeCard] = useState(-1);
  const [dupeToast, setDupeToast] = useState(null); // { amount, id }

  const showDupeToast = (amount) => {
    const id = uid("dt");
    setDupeToast({ amount, id });
    setTimeout(() => setDupeToast(null), 2200);
  };

  const buyPack = (pack) => {
    if (pack.cost > 0 && shards < pack.cost) { SFX.play("defeat"); return; }
    if (pack.cost === 0) {
      const today = new Date().toDateString();
      const lsKey = "freePackUsed_" + (user?.id || "anon");
      const storedDay = user?.freePackUsed || localStorage.getItem(lsKey);
      if (storedDay === today) { SFX.play("defeat"); return; }
      localStorage.setItem(lsKey, today);
      onUpdateUser({ freePackUsed: today });
    }
    const newShards = shards - pack.cost;

    if (pack.altPack) {
      // Alt art pack — rolls alt art unlocks, updates altOwned
      const cards = rollAltArtPack(pack);
      const ao = { ...(user.altOwned || {}) };
      let dupeShards = 0;
      cards.forEach((c) => {
        if (!c?.altSetId) return;
        const alreadyOwned = (ao[c.id] || []).includes(c.altSetId);
        if (alreadyOwned) {
          // Dupe alt art → refund shards
          dupeShards += c.rarity === "Prismatic" ? 500 : c.rarity === "Legendary" ? 40 : c.rarity === "Epic" ? 20 : c.rarity === "Rare" ? 10 : c.rarity === "Uncommon" ? 5 : 3;
        } else {
          ao[c.id] = [...(ao[c.id] || []), c.altSetId];
        }
      });
      const finalShards = newShards + dupeShards;
      if (dupeShards > 0) { SFX.play("rare_reveal"); showDupeToast(dupeShards); }
      onUpdateUser({ shards: finalShards, altOwned: ao });
      setOpening({ pack, cards });
      setRevealed([]); setRevIdx(-1);
      SFX.play("pack_open");
      return;
    }

    // Regular card pack
    const cards = rollPack(pack);
    const col = { ...(user.collection || {}) };
    let dupeShards = 0;
    cards.forEach((c) => {
      {
        const gain = c.rarity === "Common" ? 2 : c.rarity === "Uncommon" ? 5 : c.rarity === "Rare" ? 10 : c.rarity === "Epic" ? 20 : 40;
        dupeShards += gain; SFX.play("flip");
      }
    });
    const finalShards = newShards + dupeShards;
    if (dupeShards > 0) { SFX.play("rare_reveal"); showDupeToast(dupeShards); }
    onUpdateUser({ shards: finalShards, collection: col });
    setOpening({ pack, cards });
    setRevealed([]); setRevIdx(-1);
    SFX.play("pack_open");
  };

  const revealNext = () => {
    if (!opening) return;
    const next = revIdx + 1; if (next >= opening.cards.length) return;
    setShakeCard(next);
    setTimeout(() => {
      setRevIdx(next); setRevealed((p) => [...p, next]);
      const card = opening.cards[next];
      if (card.rarity === "Prismatic") { SFX.play("victory"); }
      else if (["Rare","Epic","Legendary"].includes(card.rarity)) SFX.play("rare_reveal");
      else SFX.play("flip");
      setShakeCard(-1);
    }, 400);
  };
  const revealAll = () => {
    if (!opening) return;
    setRevealed(opening.cards.map((_, i) => i)); setRevIdx(opening.cards.length - 1);
    const hasPrismatic = opening.cards.some(c => c.rarity === "Prismatic");
    SFX.play(hasPrismatic ? "victory" : "rare_reveal");
  };

  return (
    <div style={{ position:"relative", minHeight:"100vh" }}>
      {/* Store animated background */}
      <style>{`
        @keyframes storeFloat{0%,100%{transform:translateY(0) rotate(0deg);opacity:0.18}50%{transform:translateY(-28px) rotate(12deg);opacity:0.32}}
        @keyframes storeGlow{0%,100%{opacity:0.06}50%{opacity:0.14}}
        @keyframes storeCoin{0%{transform:translateY(0) rotate(0deg)}100%{transform:translateY(-120px) rotate(360deg);opacity:0}}
      `}</style>
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 20% 30%,rgba(232,192,96,0.07),transparent 55%),radial-gradient(ellipse at 80% 70%,rgba(180,120,40,0.05),transparent 50%)", animation:"storeGlow 5s ease-in-out infinite" }} />
        {[{l:"12%",t:"18%",s:22,d:0},{l:"78%",t:"12%",s:16,d:1.2},{l:"55%",t:"72%",s:20,d:0.6},{l:"30%",t:"60%",s:14,d:1.8},{l:"88%",t:"45%",s:18,d:0.3},{l:"8%",t:"80%",s:12,d:2.1}].map((c,i)=>(
          <div key={i} style={{ position:"absolute", left:c.l, top:c.t, width:c.s, height:c.s, borderRadius:"50%", background:"radial-gradient(circle,#e8c060,#c8900a)", boxShadow:`0 0 ${c.s}px rgba(232,192,96,0.4)`, animation:`storeFloat ${3.5+i*0.7}s ease-in-out ${c.d}s infinite` }} />
        ))}
      </div>
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px", position: "relative", zIndex:1 }}>
      {/* Dupe Shard Toast */}
      {dupeToast && (
        <div key={dupeToast.id} style={{ position: "fixed", top: "30%", left: "50%", transform: "translateX(-50%)", zIndex: 400, pointerEvents: "none", animation: "dupeToast 2.2s ease-out forwards" }}>
          <div style={{ background: "linear-gradient(135deg,rgba(20,14,4,0.97),rgba(30,22,6,0.97))", border: "1px solid #e8c06088", borderRadius: 16, padding: "14px 32px", textAlign: "center", boxShadow: "0 8px 40px #e8c06044" }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>✨</div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 900, color: "#f0c040" }}>+{dupeToast.amount}</div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, color: "#a09060", letterSpacing: 2, marginTop: 2 }}>SHARDS FROM DUPES</div>
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 28, fontWeight: 700, color: "#e8c060", margin: "0 0 8px" }}>Shard Store</h2>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#e8c06012", border: "1px solid #e8c06033", borderRadius: 20, padding: "6px 18px" }}>
          <span style={{ fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 900, color: "#e8c060" }}>{shards}</span>
          <span style={{ fontSize: 10, color: "#a09060" }}>SHARDS</span>
        </div>
        <p style={{ fontSize: 10, color: "#605040", marginTop: 8 }}>Alpha testers start with 1,000 shards · resets to 1,000 every Friday at midnight</p>
      </div>

      {!opening ? (<>
        {/* Cosmetics header */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:"#806040", letterSpacing:3, marginBottom:6, fontWeight:700 }}>COSMETICS</div>
          <p style={{ fontSize:11, color:"#604838", margin:0, lineHeight:1.6 }}>All cards come with their base art. Chase alternate art variants to stand out — these are purely cosmetic and do not affect gameplay.</p>
        </div>

        {/* Anime Island pack — featured */}
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, color: "#a09060", letterSpacing: 2, marginBottom: 12 }}>ALT ART — CURRENT SET</div>
        <div style={{ background:"linear-gradient(135deg,#0e0620,#180a2e,#0a1020)", border:"2px solid #ff80c044", borderRadius:16, overflow:"hidden", position:"relative", marginBottom:24 }}>
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg,rgba(255,128,192,0.07),rgba(160,64,255,0.09),rgba(64,192,255,0.05))", pointerEvents:"none" }} />
          <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:"linear-gradient(90deg,#ff80c0,#a040ff,#40c0ff,#ff80c0)" }} />
          <div style={{ position:"relative", zIndex:1, display:"grid", gridTemplateColumns:"1fr auto", gap:0, alignItems:"center" }}>
            <div style={{ padding:"28px 24px 28px 28px" }}>
              <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,128,192,0.15)", border:"1px solid #ff80c044", borderRadius:20, padding:"4px 14px", marginBottom:12 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#ff80c0", boxShadow:"0 0 8px #ff80c0", animation:"pulse 2s infinite" }} />
                <span style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#ff80c0", letterSpacing:3, fontWeight:700 }}>LIVE NOW</span>
              </div>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:900, color:"#f0a0c0", marginBottom:4, textShadow:"0 0 30px #ff80c044" }}>Anime Island</div>
              <div style={{ fontSize:10, color:"#c080b0", marginBottom:10, fontFamily:"'Cinzel',serif", letterSpacing:1 }}>Alternate art for the base Forge {"&"} Fable card set</div>
              <p style={{ fontSize:11, color:"#b090c0", marginBottom:14, lineHeight:1.7, maxWidth:320 }}>Anime-style alternate art for every region. Prismatic holofoil variants included. Dupes convert to shards automatically.</p>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>{["Alt Art Only","0.1% Prismatic","All 7 Regions","Dupe → Shards"].map(tag=>(<span key={tag} style={{ padding:"3px 10px", background:"rgba(255,128,192,0.1)", border:"1px solid #ff80c030", borderRadius:12, fontSize:9, color:"#c090b0", fontFamily:"'Cinzel',serif" }}>{tag}</span>))}</div>
              <button onClick={()=>{ const p=PACKS.find(pk=>pk.id==="anime_island"); if(p&&(shards>=p.cost))buyPack(p); else SFX.play("defeat"); }} style={{ padding:"11px 28px", background:shards>=300?"linear-gradient(135deg,#a020c0,#ff40a0)":"rgba(255,255,255,0.05)", border:`1px solid ${shards>=300?"transparent":"#3a2020"}`, borderRadius:9, fontFamily:"'Cinzel',serif", fontSize:12, fontWeight:700, color:shards>=300?"#fff":"#604040", cursor:shards>=300?"pointer":"not-allowed", letterSpacing:2, boxShadow:shards>=300?"0 6px 24px rgba(255,64,160,0.4)":"none", transition:"all .2s" }} onMouseEnter={e=>{if(shards>=300)e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>e.currentTarget.style.transform="none"}>OPEN PACK · 300 ◈</button>
            </div>
            <div style={{ padding:"20px 24px 20px 0", display:"flex", alignItems:"center", gap:8 }}>{["🌸","✨","🌺"].map((em,i)=>(<div key={i} style={{ width:70, height:100, borderRadius:10, background:"linear-gradient(160deg,#1a0830,rgba(255,128,192,0.15))", border:"2px solid #ff80c044", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:4, transform:`rotate(${(i-1)*7}deg) translateY(${i===1?-8:4}px)`, boxShadow:"0 4px 16px rgba(255,80,160,0.2)" }}><div style={{ fontSize:24 }}>{em}</div><div style={{ fontSize:7, color:"#f0a0c0", fontFamily:"'Cinzel',serif", textAlign:"center" }}>ALT ART</div></div>))}</div>
          </div>
        </div>

        {/* ── UPCOMING ALT ART & FACTION PACKS — locked until launch ──────── */}
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:"#a09060", letterSpacing:2, marginBottom:12, marginTop:28 }}>ALT ART — UPCOMING PACKS</div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {/* Food Fight — locked */}
          <div style={{ background:"#0a0808", border:"1px solid rgba(200,40,40,0.15)", borderRadius:14, padding:"20px 22px", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,#661010,#993030,#661010)" }} />
            <div style={{ display:"inline-block", padding:"2px 10px", background:"rgba(200,40,40,0.08)", border:"1px solid rgba(200,40,40,0.15)", borderRadius:20, fontFamily:"'Cinzel',serif", fontSize:8, color:"#994040", letterSpacing:3, marginBottom:8 }}>NEW FACTION</div>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:18, fontWeight:900, color:"#883040", marginBottom:4, letterSpacing:1 }}>Food Fight Pack</div>
            <p style={{ fontSize:10, color:"rgba(160,80,80,0.55)", margin:"0 0 12px", lineHeight:1.65 }}>12 culinary warriors — Champions, creatures and spells. Berry {"&"} Tooty and Master Jax lead the charge. 1 Rare guaranteed.</p>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>{["12 Cards","1 Rare","Food Fight Faction"].map(t=>(<span key={t} style={{ padding:"2px 8px", background:"rgba(120,40,40,0.06)", border:"1px solid rgba(120,40,40,0.12)", borderRadius:10, fontSize:8, color:"rgba(160,80,80,0.4)", fontFamily:"'Cinzel',serif" }}>{t}</span>))}</div>
              <div style={{ padding:"8px 18px", background:"rgba(255,255,255,0.03)", border:"1px solid #3a2020", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:10, fontWeight:700, color:"#604040", letterSpacing:2 }}>COMING SOON</div>
            </div>
          </div>
          {/* Fables — locked */}
          <div style={{ background:"#08080e", border:"1px solid rgba(144,100,255,0.15)", borderRadius:14, padding:"20px 22px", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,#3a2880,#5a40b0,#3a2880)" }} />
            <div style={{ display:"inline-block", padding:"2px 10px", background:"rgba(100,70,200,0.08)", border:"1px solid rgba(100,70,200,0.15)", borderRadius:20, fontFamily:"'Cinzel',serif", fontSize:8, color:"#706090", letterSpacing:3, marginBottom:8 }}>NEW FACTION</div>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:18, fontWeight:900, color:"#5a4090", marginBottom:4, letterSpacing:1 }}>Fables Pack</div>
            <p style={{ fontSize:10, color:"rgba(120,100,180,0.55)", margin:"0 0 12px", lineHeight:1.65 }}>13 fairy tale warriors — Dragon Knights, Crystal Golems, enchanted environments. One Rare guaranteed.</p>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>{["13 Cards","1 Rare","Fables Faction"].map(t=>(<span key={t} style={{ padding:"2px 8px", background:"rgba(80,60,160,0.06)", border:"1px solid rgba(80,60,160,0.12)", borderRadius:10, fontSize:8, color:"rgba(130,110,200,0.4)", fontFamily:"'Cinzel',serif" }}>{t}</span>))}</div>
              <div style={{ padding:"8px 18px", background:"rgba(255,255,255,0.03)", border:"1px solid #2a1840", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:10, fontWeight:700, color:"#504060", letterSpacing:2 }}>COMING SOON</div>
            </div>
          </div>
        </div>
            </>) : (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, color: opening.pack.color, letterSpacing: 4, marginBottom: 24, textShadow: `0 0 20px ${opening.pack.color}44` }}>{opening.pack.name.toUpperCase()}</div>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 28, minHeight: 280 }}>
            {opening.cards.map((card, i) => {
              const isRevealed = revealed.includes(i);
              const isShaking = shakeCard === i;
              const rarGlow = { Rare: "#5090ff", Epic: "#a860d8", Legendary: "#f0b818" }[card.rarity] || null;
              const isNewAlt = card.altSetId && !((user.altOwned||{})[card.id]||[]).includes(card.altSetId);
              return (
                <div key={i} onClick={!isRevealed ? revealNext : undefined} style={{ width: 142, cursor: isRevealed ? "default" : "pointer", perspective: 1000 }}>
                  <div style={{ transition: "transform 0.6s cubic-bezier(.4,0,.2,1)", transformStyle: "preserve-3d", transform: isRevealed ? "rotateY(0deg)" : isShaking ? "rotateY(90deg)" : "rotateY(180deg)" }}>
                    {isRevealed ? (
                      <div style={{ animation: "cardReveal 0.5s ease-out", position: "relative" }}>
                        {rarGlow && <div style={{ position: "absolute", inset: -8, borderRadius: 20, background: `radial-gradient(circle,${rarGlow}33,transparent 70%)`, animation: "vfxPulse 1s ease-out", pointerEvents: "none", zIndex: -1 }} />}
                        {isNewAlt && <div style={{ position:"absolute", top:-10, left:"50%", transform:"translateX(-50%)", background:"linear-gradient(135deg,#20a040,#40d060)", borderRadius:20, padding:"3px 12px", fontFamily:"'Cinzel',serif", fontSize:8, fontWeight:900, color:"#fff", letterSpacing:2, whiteSpace:"nowrap", boxShadow:"0 2px 10px #40d06088", zIndex:10 }}>✦ NEW</div>}
                        <Card card={card} size="sm" />
                      </div>
                    ) : (
                      <div style={{ width: 142, height: 248, background: `linear-gradient(135deg,#1a1408,${opening.pack.color}15)`, border: `2px solid ${opening.pack.color}44`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: `radial-gradient(circle,${opening.pack.color}22,transparent)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 900, color: opening.pack.color + "88" }}>?</div>
                        <div style={{ fontSize: 8, color: opening.pack.color + "88", fontFamily: "'Cinzel',serif", letterSpacing: 1 }}>CLICK TO REVEAL</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {revealed.length < opening.cards.length ? (<>
              <button onClick={revealNext} style={{ padding: "11px 24px", background: "linear-gradient(135deg,#c89010,#f0c040)", border: "none", borderRadius: 8, fontFamily: "'Cinzel',serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#1a1000", cursor: "pointer" }}>REVEAL NEXT</button>
              <button onClick={revealAll} style={{ padding: "11px 24px", background: "transparent", border: "1px solid #3a2c10", borderRadius: 8, fontFamily: "'Cinzel',serif", fontSize: 11, color: "#a09058", cursor: "pointer" }}>REVEAL ALL</button>
            </>) : (<>
              <button onClick={() => { setOpening(null); setRevealed([]); setRevIdx(-1); }} style={{ padding: "11px 24px", background: "linear-gradient(135deg,#c89010,#f0c040)", border: "none", borderRadius: 8, fontFamily: "'Cinzel',serif", fontSize: 11, fontWeight: 700, color: "#1a1000", cursor: "pointer" }}>DONE</button>
            </>)}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

// ═══ COMING SOON PAGES ═══════════════════════════════════════════════════════
function ForgeScreen() {
  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", background: "radial-gradient(circle,#e8c06022,transparent)", border: "2px solid #e8c06033", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontFamily: "'Cinzel',serif", fontSize: 32, color: "#e8c060" }}>F</div>
      <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 28, fontWeight: 700, color: "#e8c060", margin: "0 0 12px" }}>The Forge</h2>
      <p style={{ fontSize: 14, color: "#a09060", lineHeight: 1.8, maxWidth: 400, margin: "0 auto 24px" }}>Craft new cards by combining duplicates. Upgrade card rarity. Forge legendary versions with custom art.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, maxWidth: 400, margin: "0 auto 28px" }}>
        {[["Combine", "Merge 3 cards into a higher rarity"], ["Upgrade", "Boost a card's base stats"], ["Transmute", "Convert shards into random cards"]].map(([t, d]) => (
          <div key={t} style={{ background: "#121008", border: "1px solid #242010", borderRadius: 10, padding: 14 }}>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, color: "#c09848", fontWeight: 700, marginBottom: 4 }}>{t}</div>
            <div style={{ fontSize: 8, color: "#706040", lineHeight: 1.5 }}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "12px 28px", background: "rgba(255,255,255,0.04)", border: "1px solid #303020", borderRadius: 8, fontFamily: "'Cinzel',serif", fontSize: 12, color: "#606050", letterSpacing: 3, display: "inline-block" }}>COMING SOON</div>
    </div>
  );
}
// ─── AI Card Forge (rule-based generator, no external API key needed) ─────────
function generateCardConcept(idea) {
  const L = idea.toLowerCase().trim();

  // ── Faction ───────────────────────────────────────────────────────────
  let faction = ["Thornwood","Shattered Expanse","Azure Deep","Ashfen","Ironmarch","Sunveil","Bloodpact"][Math.floor(Math.random()*7)];
  if (/fire|flame|ash|burn|ember|lava|inferno|pyre|volcanic/.test(L)) faction = "Ashfen";
  else if (/water|ocean|sea|tide|wave|deep|coral|fish|aqua|flood|mermaid|kraken/.test(L)) faction = "Azure Deep";
  else if (/shadow|void|rift|crystal|shard|prism|echo|ghost|phantom|wisp/.test(L)) faction = "Shattered Expanse";
  else if (/iron|steel|forge|war|march|machine|golem|gear|armor|construct/.test(L)) faction = "Ironmarch";
  else if (/sun|gold|light|veil|dawn|glow|radiant|holy|divine|angel|celestial/.test(L)) faction = "Sunveil";
  else if (/blood|death|pact|sacrifice|dark|soul|curse|undead|dread|lich|vampire|necro/.test(L)) faction = "Bloodpact";
  else if (/forest|grove|leaf|vine|thorn|wolf|beast|root|bark|tree|druid|fae|nature/.test(L)) faction = "Thornwood";

  // ── Type ──────────────────────────────────────────────────────────────
  let type = "Creature";
  if (/\bspell\b|\bcast\b|\bmagic\b|\bcurse\b|\bbolt\b|\bblast\b|\binvoke\b|\britual\b/.test(L)) type = "Spell";
  else if (/\bzone\b|\bfield\b|\bterrain\b|\brealm\b|\benviron|\balter the|\bchange the\b/.test(L)) type = "Environment";

  // ── Keywords ──────────────────────────────────────────────────────────
  const pickedKws = [];
  if (/fast|quick|swift|speed|dash|rush|agile|instant/.test(L)) pickedKws.push("Swift");
  if (/shield|guard|protect|defend|armor|tank|fortif/.test(L)) pickedKws.push("Shield");
  if (/echo|copy|mirror|reflect|twin|doppel/.test(L)) pickedKws.push("Echo");
  if (/bleed|wound|poison|drain|rot|venom|toxin|sap/.test(L)) pickedKws.push("Bleed");
  if (/split|fracture|clone|double|divide|fragment/.test(L)) pickedKws.push("Fracture");
  if (/resonate|song|music|hum|vibrat|harmonic/.test(L)) pickedKws.push("Resonate");
  const allKws = ["Swift","Shield","Echo","Bleed","Fracture","Resonate"];
  if (pickedKws.length === 0) pickedKws.push(allKws[Math.floor(Math.random()*allKws.length)]);
  pickedKws.splice(2);

  // ── Stats ─────────────────────────────────────────────────────────────
  const isAggressive = /attack|destroy|kill|powerful|strong|mighty|devastating|burst|ruthless|dominate/.test(L);
  const isDefensive  = /heal|protect|guard|restore|block|absorb|tough|durable|endure|resilient/.test(L);
  const atk  = type === "Creature" ? (isAggressive ? 3+Math.floor(Math.random()*4) : 1+Math.floor(Math.random()*3)) : null;
  const hp   = type === "Creature" ? (isDefensive  ? 4+Math.floor(Math.random()*4) : 2+Math.floor(Math.random()*4)) : null;
  const cost = type === "Spell" ? 1+Math.floor(Math.random()*4) : (isAggressive||isDefensive ? 3+Math.floor(Math.random()*3) : 2+Math.floor(Math.random()*4));

  // ── Name ──────────────────────────────────────────────────────────────
  // 1. Try to pull the subject noun directly from the idea
  const subjectMap = [
    [/dragon|drake/, "Drake"], [/wolf|wolves/, "Wolf"], [/knight|warrior/, "Warden"],
    [/mage|wizard|sorcerer/, "Mage"], [/priest|cleric|healer/, "Herald"],
    [/demon|fiend/, "Fiend"], [/serpent|snake|viper/, "Coil"], [/golem|titan/, "Titan"],
    [/witch|hex|warlock/, "Hexer"], [/archer|ranger/, "Ranger"],
    [/guardian|sentinel/, "Sentinel"], [/shadow|shade/, "Shade"],
    [/spirit|wisp|ghost|phantom/, "Wisp"], [/hunter|stalker/, "Stalker"],
    [/lich|undead/, "Lich"], [/kraken|leviathan/, "Leviathan"],
    [/vampire|blood/, "Wraith"], [/angel|celestial/, "Seraph"],
    [/elemental|construct/, "Elemental"], [/bear|beast/, "Beast"],
  ];
  let subjectWord = "";
  for (const [rx, s] of subjectMap) { if (rx.test(L)) { subjectWord = s; break; } }

  // 2. Find an adjective/flavor word from the idea (not stop words, not verbs ending -s/-ing/-ed)
  const stopWords = /^(when|that|this|with|from|into|over|have|will|make|does|deal|deals|give|gives|draw|draws|gain|gains|play|plays|cast|casts|take|takes|enemy|enemies|friend|allies|board|field|hero|your|their|all|any|each|can|and|the|for|has|its|upon|after|which|they|them)$/i;
  const verbForms = /ing$|ed$|es$|ies$/;
  const rawWords = idea.replace(/[^a-zA-Z ]/g,"").split(/\s+/);
  const flavorWord = rawWords.find(w => w.length >= 4 && !stopWords.test(w) && !verbForms.test(w) && !/^\d+$/.test(w));

  const facPfx = { Thornwood:["Thorn","Grove","Wild","Root"], "Shattered Expanse":["Rift","Void","Shard","Prism"], "Azure Deep":["Tide","Coral","Deep","Wave"], Ashfen:["Ash","Ember","Scorch","Pyre"], Ironmarch:["Iron","Steel","Forge","Bolt"], Sunveil:["Sun","Dawn","Veil","Gilded"], Bloodpact:["Blood","Dread","Soul","Vile"] };
  const typeSfx = { Creature:["Walker","Warden","Stalker","Herald","Kin"], Spell:["Strike","Surge","Wave","Rend"], Environment:["Hollow","Expanse","Depths","Wastes"] };
  const px = facPfx[faction]||[]; const sx = typeSfx[type]||[];

  let name;
  if (subjectWord && flavorWord) {
    // "Fire Drake", "Shadow Wisp", "Iron Titan"
    const adj = flavorWord.charAt(0).toUpperCase() + flavorWord.slice(1).toLowerCase();
    name = `${adj} ${subjectWord}`;
  } else if (subjectWord) {
    // "Ember Drake", "Void Fiend"
    const pfx = px[Math.floor(Math.random()*px.length)] || "";
    name = pfx ? `${pfx} ${subjectWord}` : subjectWord;
  } else if (flavorWord) {
    // "Cruel Stalker", "Frozen Herald"
    const adj = flavorWord.charAt(0).toUpperCase() + flavorWord.slice(1).toLowerCase();
    const sfx = sx[Math.floor(Math.random()*sx.length)] || "";
    name = sfx ? `${adj} ${sfx}` : adj;
  } else {
    name = `${px[Math.floor(Math.random()*px.length)]}${sx[Math.floor(Math.random()*sx.length)]}`;
  }

  // ── Ability ───────────────────────────────────────────────────────────
  const dmg  = 1 + Math.floor(Math.random()*3);
  const heal = 2 + Math.floor(Math.random()*3);
  const buff = 1 + Math.floor(Math.random()*2);

  let ability = "";
  // Direct damage on entry / attack / spell
  if (/deal.*damage|damage.*all|hurt|strike.*all|burn.*all|zap|lightning/.test(L)) {
    const target = /all enemy|all foe|all opp/.test(L) ? "all enemy creatures" : "a target creature or hero";
    ability = type === "Spell"
      ? `Deal ${dmg+1} damage to ${target}.`
      : `When ${name} enters the battlefield, deal ${dmg} damage to ${target}.`;
  }
  // Healing
  else if (/heal|restore.*hp|recover.*hp|mend|regenerat/.test(L)) {
    const who = /all.*friend|friendly.*all|allies/.test(L) ? "all friendly creatures" : "your hero";
    ability = `When ${name} enters or attacks, restore ${heal} HP to ${who}.`;
  }
  // Revive / resurrection
  else if (/reviv|resurrect|bring.*back|return.*grave|raise.*dead/.test(L)) {
    ability = `When ${name} enters, return a friendly creature from your discard to your hand.`;
  }
  // Destroy / kill on death or entry
  else if (/destroy|eliminate|execute|annihilate/.test(L)) {
    const trigger = /when.*die|on.*death|destroyed/.test(L) ? "dies" : "destroys a creature";
    ability = `When ${name} ${trigger}, gain +${buff}/+${buff} and draw a card.`;
  }
  // Buff allies
  else if (/buff|boost|strengthen|empower|give.*friend|friend.*all|strengthen.*allies/.test(L)) {
    ability = `When ${name} enters, give all other friendly creatures +${buff}/+${buff} until end of turn.`;
  }
  // Draw / hand manipulation
  else if (/draw.*card|card.*draw|fill.*hand|look.*deck/.test(L)) {
    ability = `When ${name} enters the battlefield, draw ${buff} card${buff>1?"s":""}.`;
  }
  // Stealth / cannot be targeted
  else if (/stealth|invisible|cannot.*target|ignore.*guard|unblockable/.test(L)) {
    ability = `${name} cannot be targeted by spells or abilities. Attacks bypass guard creatures.`;
  }
  // Environment specific
  else if (type === "Environment") {
    if (/damage|burn|hurt|punish/.test(L))
      ability = `While active, deal 1 damage to the enemy hero at the start of each turn.`;
    else if (/draw|card/.test(L))
      ability = `While active, both players draw an extra card each turn.`;
    else
      ability = `While active, all friendly creatures enter with +1/+1.`;
  }
  // Spell with no matched pattern
  else if (type === "Spell") {
    if (/bleed|poison|wither/.test(L))
      ability = `Apply 2 Bleed to all enemy creatures.`;
    else if (/shield|protect/.test(L))
      ability = `Give all friendly creatures Shield until your next turn.`;
    else
      ability = `Deal ${dmg+1} damage to a target, then draw a card.`;
  }
  // Keyword fallback
  else {
    const kw = pickedKws[0];
    const kwAbilities = {
      Swift:    `Swift. When ${name} attacks, it deals damage before the defender can strike back.`,
      Shield:   `${name} enters with Shield. When Shield breaks, deal ${dmg} damage to the attacker.`,
      Bleed:    `${name} inflicts 2 Bleed on every creature it damages.`,
      Echo:     `Echo. When ${name} leaves play, a 1/1 Echo copy enters your hand.`,
      Fracture: `Fracture. ${name} splits into two ${Math.ceil((atk||1)/2)}/${Math.ceil((hp||1)/2)} copies when it dies.`,
      Resonate: `Resonate. ${name} gains +1 ATK for each enemy creature on the field.`,
    };
    ability = kwAbilities[kw] || `When ${name} enters the battlefield, deal ${dmg} damage to the lowest-HP enemy creature.`;
  }

  const rarity = Math.random()<0.06?"Legendary":Math.random()<0.18?"Epic":Math.random()<0.38?"Rare":Math.random()<0.6?"Uncommon":"Common";
  return { name, faction, type, cost, atk, hp, ability, keywords: pickedKws, rarity };
}

function FeedbackWall({ user }) {
  const CATS = ["Bug Report","Balance Idea","Question","General Feedback"];
  const [cat, setCat] = useState("General Feedback");
  const [msg, setMsg] = useState("");
  const [posts, setPosts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [tableError, setTableError] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const SQL_SETUP = `CREATE TABLE community_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, user_name TEXT,
  category TEXT, message TEXT,
  upvotes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE community_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read" ON community_feedback FOR SELECT USING (true);
CREATE POLICY "insert" ON community_feedback FOR INSERT WITH CHECK (auth.role()='authenticated');
CREATE POLICY "upvote" ON community_feedback FOR UPDATE USING (true);`;

  const load = async () => {
    try {
      const { data, error } = await supabase.from("community_feedback").select("*").order("upvotes", { ascending: false }).order("created_at", { ascending: false }).limit(50);
      if (error) { if (error.code === "42P01" || error.message?.includes("does not exist")) setTableError(SQL_SETUP); return; }
      if (data) { setPosts(data); setTableError(null); }
    } catch(_) {}
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!msg.trim() || !user || submitting) return;
    setSubmitting(true); setSubmitError(null);
    try {
      const { error } = await supabase.from("community_feedback").insert([{ user_id: user.id, user_name: user.name || "Anonymous", category: cat, message: msg.trim(), upvotes: 0 }]);
      if (error) throw error;
      setMsg(""); setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      await load();
    } catch(e) {
      const m = e?.message || String(e);
      if (m.includes("does not exist") || m.includes("relation") || e?.code === "42P01") setTableError(SQL_SETUP);
      else setSubmitError(m || "Submit failed — check console");
    }
    setSubmitting(false);
  };

  const catColor = { "Bug Report":"#e84040","Balance Idea":"#78cc45","Question":"#60c0ff","General Feedback":"#e8c060" };

  return (
    <div>
      {/* Submit form */}
      <div style={{ background:"linear-gradient(160deg,#141008,#0e0c06)", border:"1px solid #3a2c10", borderRadius:14, padding:22, marginBottom:20 }}>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:"#e8a020", letterSpacing:3, marginBottom:14, fontWeight:700 }}>✦ SUBMIT FEEDBACK</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
          {CATS.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ padding:"5px 12px", background: cat===c ? `${catColor[c]}22` : "rgba(0,0,0,0.3)", border:`1px solid ${cat===c ? catColor[c]+"66" : "#2a2010"}`, borderRadius:20, fontSize:9, color: cat===c ? catColor[c] : "#806040", fontFamily:"'Cinzel',serif", cursor:"pointer", fontWeight: cat===c ? 700 : 400 }}>{c}</button>
          ))}
        </div>
        <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder={cat === "Bug Report" ? "Describe what happened and when..." : cat === "Balance Idea" ? "Which card, mechanic, or stat needs changing and why?" : cat === "Question" ? "What would you like to know?" : "Share your thoughts..."} style={{ width:"100%", minHeight:90, background:"rgba(0,0,0,0.5)", border:"1px solid #2a2010", borderRadius:8, padding:"10px 12px", color:"#e0d8c0", fontFamily:"'Lora',Georgia,serif", fontSize:12, lineHeight:1.7, outline:"none", resize:"vertical", boxSizing:"border-box" }} />
        <button onClick={submit} disabled={!msg.trim() || !user || submitting} style={{ marginTop:12, padding:"10px 24px", background: msg.trim() && user && !submitting ? "linear-gradient(135deg,#c89010,#f0c040)" : "rgba(100,80,20,0.2)", border:"none", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:11, fontWeight:700, letterSpacing:2, color: msg.trim() && user ? "#1a1000" : "#4a3820", cursor: msg.trim() && user && !submitting ? "pointer" : "default" }}>
          {submitting ? "SENDING..." : submitted ? "✓ SENT!" : "SUBMIT"}
        </button>
        {!user && <div style={{ marginTop:8, fontSize:10, color:"#504030", fontFamily:"'Cinzel',serif", letterSpacing:2 }}>SIGN IN TO SUBMIT</div>}
        {submitError && <div style={{ marginTop:8, fontSize:10, color:"#e84040", fontFamily:"'Cinzel',serif" }}>⚠ {submitError}</div>}
        {tableError && <div style={{ marginTop:12, background:"rgba(0,0,0,0.5)", border:"1px solid #5a1818", borderRadius:9, padding:"12px 14px" }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#e84040", marginBottom:6 }}>⚠ TABLE NOT FOUND — run this SQL in Supabase then refresh:</div>
          <pre style={{ background:"#0a0806", borderRadius:6, padding:10, fontSize:8, color:"#c0a060", overflowX:"auto", whiteSpace:"pre-wrap", wordBreak:"break-all", margin:"0 0 8px" }}>{tableError}</pre>
          <button onClick={()=>navigator.clipboard?.writeText(tableError)} style={{ padding:"4px 12px", background:"rgba(232,192,96,0.1)", border:"1px solid #e8c06044", borderRadius:6, fontFamily:"'Cinzel',serif", fontSize:8, color:"#e8c060", cursor:"pointer" }}>COPY SQL</button>
        </div>}
      </div>
      {/* Posts */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#504038", letterSpacing:3, fontWeight:700 }}>COMMUNITY FEEDBACK · {posts.length} POSTS</div>
        <button onClick={load} style={{ padding:"4px 10px", background:"transparent", border:"1px solid #3a2010", borderRadius:7, fontSize:9, color:"#806040", fontFamily:"'Cinzel',serif", cursor:"pointer" }}>REFRESH</button>
      </div>
      {tableError ? (
        <div style={{ textAlign:"center", padding:"24px", background:"rgba(0,0,0,0.4)", borderRadius:12, border:"1px solid #5a1818" }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:12, color:"#e84040", marginBottom:8 }}>⚠ Feedback table not found</div>
          <div style={{ fontSize:10, color:"#806040", marginBottom:10 }}>Run this SQL in Supabase:</div>
          <pre style={{ background:"#0a0806", border:"1px solid #2a1a08", borderRadius:8, padding:12, fontSize:9, color:"#c0a060", textAlign:"left", overflowX:"auto", whiteSpace:"pre-wrap", wordBreak:"break-all", marginBottom:10 }}>{tableError}</pre>
          <button onClick={()=>navigator.clipboard?.writeText(tableError)} style={{ padding:"5px 14px", background:"rgba(232,192,96,0.1)", border:"1px solid #e8c06044", borderRadius:7, fontFamily:"'Cinzel',serif", fontSize:9, color:"#e8c060", cursor:"pointer" }}>COPY SQL</button>
        </div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign:"center", padding:"40px", background:"rgba(0,0,0,0.3)", borderRadius:12, border:"1px solid #1a1810" }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:13, color:"#3a3020", marginBottom:6 }}>No feedback yet</div>
          <div style={{ fontSize:11, color:"#2a2010" }}>Be the first to share your thoughts!</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {posts.map((p, i) => (
            <div key={p.id} style={{ background:"linear-gradient(160deg,#12100a,#0c0a06)", border:"1px solid #2a2010", borderRadius:10, padding:"12px 16px", display:"flex", gap:12, alignItems:"flex-start", animation:`cardReveal 0.3s ease-out ${i*0.03}s both` }}>
              <div style={{ flexShrink:0, paddingTop:2 }}>
                <div style={{ padding:"2px 8px", background:`${catColor[p.category]||"#e8c060"}18`, border:`1px solid ${catColor[p.category]||"#e8c060"}44`, borderRadius:10, fontSize:8, color:catColor[p.category]||"#e8c060", fontFamily:"'Cinzel',serif", fontWeight:700, whiteSpace:"nowrap" }}>{p.category}</div>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, color:"#c0b490", lineHeight:1.6, marginBottom:4 }}>{p.message}</div>
                <div style={{ fontSize:9, color:"#3a3020", fontFamily:"'Cinzel',serif", letterSpacing:1 }}>{p.user_name} · {new Date(p.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══ PLAYER PROFILE SCREEN ═══════════════════════════════════════════════════
const ACHIEVEMENTS = [
  { id: "first_win",       icon: "⚔", name: "First Blood",          desc: "Win your first match.",              check: u => (u.rankedWins||0)+(u.casualWins||0) >= 1,            progress: u => Math.min(1,(u.rankedWins||0)+(u.casualWins||0)), total: 1 },
  { id: "ten_wins",        icon: "🏅", name: "Veteran",              desc: "Win 10 matches total.",              check: u => (u.rankedWins||0)+(u.casualWins||0) >= 10,           progress: u => Math.min(10,(u.rankedWins||0)+(u.casualWins||0)), total: 10 },
  { id: "fifty_wins",      icon: "🥈", name: "Battle-Hardened",      desc: "Win 50 matches total.",              check: u => (u.rankedWins||0)+(u.casualWins||0) >= 50,           progress: u => Math.min(50,(u.rankedWins||0)+(u.casualWins||0)), total: 50 },
  { id: "hundred_wins",    icon: "🥇", name: "Forge Master",         desc: "Win 100 matches total.",             check: u => (u.rankedWins||0)+(u.casualWins||0) >= 100,          progress: u => Math.min(100,(u.rankedWins||0)+(u.casualWins||0)), total: 100 },
  { id: "reach_silver",    icon: "🥈", name: "Silver Ranked",        desc: "Reach Silver rank (1200+ MMR).",     check: u => (u.rankedRating||1000) >= 1200,                       progress: u => Math.min(1200,u.rankedRating||1000), total: 1200 },
  { id: "reach_gold",      icon: "🥇", name: "Gold Ranked",          desc: "Reach Gold rank (1400+ MMR).",       check: u => (u.rankedRating||1000) >= 1400,                       progress: u => Math.min(1400,u.rankedRating||1000), total: 1400 },
  { id: "reach_diamond",   icon: "💎", name: "Diamond Ascendant",    desc: "Reach Diamond rank (1800+ MMR).",    check: u => (u.rankedRating||1000) >= 1800,                       progress: u => Math.min(1800,u.rankedRating||1000), total: 1800 },
  { id: "collector_10",    icon: "❖",  name: "Collector",            desc: "Own 10 unique cards.",               check: u => Object.values(u.collection||{}).filter(v=>v>0).length >= 10,  progress: u => Math.min(10,Object.values(u.collection||{}).filter(v=>v>0).length), total: 10 },
  { id: "collector_30",    icon: "❖",  name: "Archivist",            desc: "Own 30 unique cards.",               check: u => Object.values(u.collection||{}).filter(v=>v>0).length >= 30,  progress: u => Math.min(30,Object.values(u.collection||{}).filter(v=>v>0).length), total: 30 },
  { id: "full_collection", icon: "👑", name: "Complete Set",         desc: "Own every card in the game.",        check: u => GAMEPLAY_POOL.every(c => (u.collection||{})[c.id] > 0),      progress: u => GAMEPLAY_POOL.filter(c=>(u.collection||{})[c.id]>0).length, total: GAMEPLAY_POOL.length },
  { id: "deck_builder",    icon: "📋", name: "Deck Builder",         desc: "Build your first deck.",             check: u => (u.decks||[]).length >= 1,                            progress: u => Math.min(1,(u.decks||[]).length), total: 1 },
  { id: "five_decks",      icon: "📚", name: "Tactician",            desc: "Build 5 different decks.",           check: u => (u.decks||[]).length >= 5,                            progress: u => Math.min(5,(u.decks||[]).length), total: 5 },
  { id: "fables_owner",    icon: "⚡", name: "Touched by Olympus",   desc: "Own Zeus or Hades.",                 check: u => (u.collection||{}).zeus_storm_father > 0 || (u.collection||{}).hades_soul_reaper > 0, progress: u => ((u.collection||{}).zeus_storm_father>0?1:0)+((u.collection||{}).hades_soul_reaper>0?1:0), total: 2 },
  { id: "food_fight_fan",  icon: "🍖", name: "Food Fight Fan",       desc: "Own 5 Food Fight cards.",            check: u => GAMEPLAY_POOL.filter(c=>c.region==="Food Fight"&&(u.collection||{})[c.id]>0).length >= 5, progress: u => GAMEPLAY_POOL.filter(c=>c.region==="Food Fight"&&(u.collection||{})[c.id]>0).length, total: 5 },
  { id: "rich",            icon: "💎", name: "Shard Hoarder",        desc: "Accumulate 5000 shards.",            check: u => (u.shards||0) >= 5000,                               progress: u => Math.min(5000,u.shards||0), total: 5000 },
];

function PlayerProfileScreen({ user }) {
  const [profileTab, setProfileTab] = useState("overview");

  if (!user) return null;

  const wins = (user.rankedWins||0) + (user.casualWins||0);
  const losses = (user.rankedLosses||0) + (user.casualLosses||0);
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins/total)*100) : 0;
  const rank = getRank(user.rankedRating);
  const gpIds = new Set(GAMEPLAY_POOL.map(c=>c.id));
  const uniqueOwned = Object.entries(user.collection||{}).filter(([id,v])=>v>0&&gpIds.has(id)).length;
  const totalCards = GAMEPLAY_POOL.filter(c=>!c.isToken).length;

  // By-region breakdown
  const regionStats = [...new Set(GAMEPLAY_POOL.filter(c=>!c.isToken).map(c=>c.region))].map(r => {
    const regionCards = GAMEPLAY_POOL.filter(c=>c.region===r&&!c.isToken);
    const owned = regionCards.filter(c=>(user.collection||{})[c.id]>0).length;
    return { region: r, owned, total: regionCards.length, color: GLOW[r] || "#e8c060" };
  }).sort((a,b) => b.owned/b.total - a.owned/a.total);

  const decks = user.decks || [];

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "collection", label: "Collection" },
    { id: "decks", label: "Deck Boxes" },
    { id: "achievements", label: "Achievements" },
  ];

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 16px 60px", fontFamily: "'Cinzel', serif" }}>
      {/* Profile Header */}
      <div style={{ background: "linear-gradient(160deg,#1a1208,#0e0a04)", border: "1px solid #2a2010", borderRadius: 16, padding: "24px 28px", marginBottom: 20, display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", overflow: "hidden", border: `3px solid ${rank.color}88`, display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1408", fontFamily: "'Cinzel',serif", fontSize: 24, color: "#e8c060", flexShrink: 0, boxShadow: `0 0 20px ${rank.color}44` }}>
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : (user.name||"?").slice(0,2).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#f0d878", letterSpacing: 2, marginBottom: 4 }}>{user.name}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ padding: "3px 10px", background: `${rank.color}20`, border: `1px solid ${rank.color}55`, borderRadius: 8, fontSize: 10, color: rank.color, fontWeight: 700 }}>{rank.icon} {rank.name}</span>
            <span style={{ padding: "3px 10px", background: "#20180a", border: "1px solid #3a2810", borderRadius: 8, fontSize: 10, color: "#a08040" }}>{user.rankedRating||1000} MMR</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[["WINS", wins, "#78cc45"], ["LOSSES", losses, "#e05050"], ["WIN%", winRate+"%", winRate>=50?"#78cc45":"#e8a020"], ["SHARDS", user.shards||0, "#60c8ff"]].map(([l,v,c]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: c }}>{v}</div>
                <div style={{ fontSize: 8, color: "#604828", letterSpacing: 1 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, background: "#0e0c08", borderRadius: 10, padding: 4, border: "1px solid #1e1810" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setProfileTab(t.id)} style={{ flex: 1, padding: "8px 4px", background: profileTab === t.id ? "linear-gradient(135deg,#2a2010,#1a1408)" : "transparent", border: profileTab === t.id ? "1px solid #3a2810" : "1px solid transparent", borderRadius: 7, fontSize: 10, fontWeight: 700, color: profileTab === t.id ? "#e8c060" : "#806040", cursor: "pointer", fontFamily: "'Cinzel',serif", letterSpacing: 0.5, transition: "all .15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {profileTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Match Stats */}
          <div style={{ background: "#0e0c08", border: "1px solid #1e1810", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 9, letterSpacing: 4, color: "#6a4c20", marginBottom: 14 }}>MATCH HISTORY</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                ["Ranked Wins", user.rankedWins||0, "#78cc45"],
                ["Ranked Losses", user.rankedLosses||0, "#e05050"],
                ["Casual Wins", user.casualWins||0, "#60c8a0"],
                ["Casual Losses", user.casualLosses||0, "#e08060"],
              ].map(([l,v,c]) => (
                <div key={l} style={{ background: "#0a0806", border: "1px solid #1a1408", borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#806040" }}>{l}</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: c }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Collection Summary */}
          <div style={{ background: "#0e0c08", border: "1px solid #1e1810", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 9, letterSpacing: 4, color: "#6a4c20", marginBottom: 10 }}>COLLECTION SUMMARY</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1, height: 8, background: "#1a1408", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${Math.round((uniqueOwned/totalCards)*100)}%`, height: "100%", background: "linear-gradient(90deg,#c89010,#f0c040)", borderRadius: 4, transition: "width .5s" }} />
              </div>
              <span style={{ fontSize: 12, color: "#e8c060", fontWeight: 700, flexShrink: 0 }}>{uniqueOwned} / {totalCards}</span>
            </div>
            <div style={{ fontSize: 10, color: "#604828" }}>{Math.round((uniqueOwned/totalCards)*100)}% complete</div>
          </div>
          {/* Recent achievements unlocked */}
          <div style={{ background: "#0e0c08", border: "1px solid #1e1810", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 9, letterSpacing: 4, color: "#6a4c20", marginBottom: 14 }}>RECENT ACHIEVEMENTS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ACHIEVEMENTS.filter(a => a.check(user)).slice(-4).map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "#080604", border: "1px solid #2a2010", borderRadius: 8 }}>
                  <span style={{ fontSize: 18 }}>{a.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, color: "#e8c060", fontWeight: 700 }}>{a.name}</div>
                    <div style={{ fontSize: 9, color: "#604828" }}>{a.desc}</div>
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "#78cc45" }}>✓</span>
                </div>
              ))}
              {ACHIEVEMENTS.filter(a => a.check(user)).length === 0 && (
                <div style={{ fontSize: 11, color: "#503828", textAlign: "center", padding: 16 }}>No achievements yet — keep playing!</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collection Tab */}
      {profileTab === "collection" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 10, color: "#604828", textAlign: "center", marginBottom: 4 }}>Cards owned by region</div>
          {regionStats.map(r => (
            <div key={r.region} style={{ background: "#0e0c08", border: `1px solid ${r.color}33`, borderRadius: 10, padding: "14px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{r.region}</span>
                <span style={{ fontSize: 11, color: "#a08040" }}>{r.owned} / {r.total}</span>
              </div>
              <div style={{ height: 6, background: "#1a1408", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${Math.round((r.owned/r.total)*100)}%`, height: "100%", background: `linear-gradient(90deg,${r.color}88,${r.color})`, borderRadius: 3, transition: "width .5s" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Decks Tab */}
      {profileTab === "decks" && (
        <div>
          {decks.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "#503828", fontSize: 12 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              No decks built yet. Head to Cards to build your first deck!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {decks.map((deck, i) => {
                const cardCount = (deck.cards||[]).reduce((s,c)=>s+(c.count||1),0);
                const regions = [...new Set((deck.cards||[]).map(c=>{ const found = POOL.find(p=>p.id===c.id); return found?.region||"?"; }))];
                return (
                  <div key={i} style={{ background: "#0e0c08", border: "1px solid #2a2010", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ fontSize: 28, flexShrink: 0 }}>🃏</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#e8c060", marginBottom: 4 }}>{deck.name || `Deck ${i+1}`}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 9, color: "#806040" }}>{cardCount} cards</span>
                        {regions.slice(0,3).map(r => (
                          <span key={r} style={{ fontSize: 9, color: GLOW[r]||"#e8c060", padding: "1px 6px", background: `${GLOW[r]||"#e8c060"}15`, border: `1px solid ${GLOW[r]||"#e8c060"}33`, borderRadius: 4 }}>{r}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Achievements Tab */}
      {profileTab === "achievements" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 10, color: "#604828", textAlign: "center", marginBottom: 4 }}>
            {ACHIEVEMENTS.filter(a=>a.check(user)).length} / {ACHIEVEMENTS.length} unlocked
          </div>
          {ACHIEVEMENTS.map(a => {
            const done = a.check(user);
            const prog = a.progress(user);
            const pct = Math.min(100, Math.round((prog/a.total)*100));
            return (
              <div key={a.id} style={{ background: done ? "linear-gradient(135deg,#0e120a,#0a0e06)" : "#0e0c08", border: `1px solid ${done?"#78cc4444":"#1e1810"}`, borderRadius: 10, padding: "14px 18px", opacity: done ? 1 : 0.7, transition: "all .2s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: done?0:8 }}>
                  <span style={{ fontSize: 22, filter: done?"none":"grayscale(1) brightness(0.5)" }}>{a.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: done?"#e8c060":"#605040" }}>{a.name}</div>
                    <div style={{ fontSize: 9, color: "#504030", marginTop: 2 }}>{a.desc}</div>
                  </div>
                  {done && <span style={{ fontSize: 16, color: "#78cc45" }}>✓</span>}
                </div>
                {!done && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 9, color: "#604030" }}>
                      <span>{prog} / {a.total}</span><span>{pct}%</span>
                    </div>
                    <div style={{ height: 4, background: "#1a1408", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: pct+"%", height: "100%", background: "linear-gradient(90deg,#604010,#c08020)", borderRadius: 2, transition: "width .5s" }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══ FRIENDS SCREEN ══════════════════════════════════════════════════════════
function FriendsScreen({ user, onStartDuel, incomingChallenge, setIncomingChallenge }) {
  const [friends, setFriends] = useState([]);
  const [pendingIn, setPendingIn] = useState([]);
  const [pendingOut, setPendingOut] = useState([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState(null);
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [challengeSent, setChallengeSent] = useState(null);
  const [sendingTo, setSendingTo] = useState(null);
  const [sentTo, setSentTo] = useState({});
  const [addErr, setAddErr] = useState({});
  const [friendsRlsErr, setFriendsRlsErr] = useState(false);
  const [viewProfile, setViewProfile] = useState(null); // { id, name, avatar_url, ... }
  const presenceRef = useRef(null);

  const loadFriends = async () => {
    if (!user?.id) return;
    // Plain select — avoid FK join which fails if foreign keys aren't declared
    const { data, error } = await supabase.from("friendships")
      .select("*")
      .or(`requester.eq.${user.id},accepter.eq.${user.id}`);
    if (error) { setFriendsRlsErr(true); return; }
    if (!data) return;
    setFriendsRlsErr(false);
    // Supabase RLS silently returns [] (no error) when policies block rows for the accepter.
    // If data is empty, verify with a count query that doesn't filter by user — if unreachable,
    // at least we flag the issue so the user sees the SQL hint.
    if (data.length === 0) {
      const { error: cntErr } = await supabase.from("friendships").select("id", { count: "exact", head: true });
      if (cntErr) setFriendsRlsErr(true);
    }

    // Gather the "other" side IDs and fetch their profiles separately
    const otherIds = [...new Set(data.map(r => r.requester === user.id ? r.accepter : r.requester))];
    let pm = {};
    if (otherIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id,name,avatar_url").in("id", otherIds);
      if (profs) profs.forEach(p => { pm[p.id] = p; });
    }
    const nm = (id) => pm[id]?.name || id.slice(0, 8);
    const av = (id) => pm[id]?.avatar_url || null;

    const accepted = data.filter(r => r.status === "accepted");
    const pending  = data.filter(r => r.status === "pending");
    setFriends(accepted.map(r => r.requester === user.id
      ? { id: r.accepter,  name: nm(r.accepter),  avatar_url: av(r.accepter),  rowId: r.id }
      : { id: r.requester, name: nm(r.requester), avatar_url: av(r.requester), rowId: r.id }));
    setPendingIn( pending.filter(r => r.accepter === user.id).map(r => ({ id: r.requester, name: nm(r.requester), avatar_url: av(r.requester), rowId: r.id })));
    setPendingOut(pending.filter(r => r.requester === user.id).map(r => ({ id: r.accepter,  name: nm(r.accepter),  avatar_url: av(r.accepter),  rowId: r.id })));
  };

  useEffect(() => {
    loadFriends();
    // Presence channel for online status
    const ch = supabase.channel("presence:forge_global", { config: { presence: { key: user?.id } } });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      setOnlineIds(new Set(Object.keys(state)));
    }).subscribe(async (status) => {
      if (status === "SUBSCRIBED" && user?.id) {
        await ch.track({ user_id: user.id, name: user.name, online_at: new Date().toISOString() });
      }
    });
    presenceRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]); // eslint-disable-line

  const FRIENDS_SQL = `-- Run this in Supabase SQL Editor to allow friend search:\nCREATE POLICY "profiles_public_read" ON profiles\n  FOR SELECT TO authenticated\n  USING (true);`;

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    setSearchErr(null);
    const { data, error } = await supabase.from("profiles").select("id,name,avatar_url").ilike("name", `%${search.trim()}%`).limit(8);
    if (error) {
      setSearchErr(error.message.includes("permission") || error.code === "42501"
        ? "blocked_rls"
        : error.message);
      setSearching(false);
      return;
    }
    const results = (data || []).filter(p => p.id !== user?.id);
    if (results.length === 0 && data?.length === 0) setSearchErr("no_results");
    setSearchResults(results);
    setSearching(false);
  };

  const sendRequest = async (target) => {
    const existing = [...friends, ...pendingIn, ...pendingOut].find(f => f.id === target.id);
    if (existing || sendingTo === target.id) return;
    setSendingTo(target.id);
    const { error } = await supabase.from("friendships").insert([{
      requester: user.id, accepter: target.id, status: "pending"
    }]);
    if (!error) {
      setSentTo(prev => ({ ...prev, [target.id]: true }));
      // Broadcast notification — wait for SUBSCRIBED before sending
      const notifCh = supabase.channel(`friends_notif:${target.id}`);
      notifCh.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          notifCh.send({ type: "broadcast", event: "friend_request", payload: { fromId: user.id, fromName: user.name } })
            .finally(() => supabase.removeChannel(notifCh));
        }
      });
      await loadFriends();
      setTimeout(() => setSearchResults(prev => prev.filter(p => p.id !== target.id)), 1200);
    } else {
      setAddErr(prev => ({ ...prev, [target.id]: error.code === "23505" ? "Already sent" : (error.message || "Failed") }));
    }
    setSendingTo(null);
  };

  const acceptRequest = async (row) => {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", row.rowId);
    await loadFriends();
  };

  const removeFriend = async (row) => {
    await supabase.from("friendships").delete().eq("id", row.rowId);
    await loadFriends();
  };

  const sendChallenge = async (friend) => {
    setChallengeSent(friend.id);
    const ch = supabase.channel(`challenge:${friend.id}`);
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        ch.send({ type: "broadcast", event: "challenge", payload: { fromId: user.id, fromName: user.name, fromAvatar: user.avatarUrl } })
          .finally(() => supabase.removeChannel(ch));
      }
    });
    setTimeout(() => setChallengeSent(null), 8000);
  };

  const openProfile = async (id, name) => {
    setViewProfile({ id, name, loading: true });
    const { data } = await supabase.from("profiles").select("id,name,avatar_url,ranked_wins,ranked_losses,ranked_rating,collection").eq("id", id).single();
    if (data) setViewProfile({ ...data, loading: false });
    else setViewProfile({ id, name, loading: false });
  };

  const STATUS = { online: "#78cc45", offline: "#504030" };
  const isOnline = (id) => onlineIds.has(id);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 16px" }}>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:24, fontWeight:900, color:"#e8c060", marginBottom:4, letterSpacing:2 }}>⚉ FRIENDS</div>
      <div style={{ fontSize:11, color:"#604030", fontFamily:"'Cinzel',serif", letterSpacing:2, marginBottom:24 }}>CHALLENGE FRIENDS · SEE WHO'S ONLINE</div>

      {/* Search */}
      <div style={{ display:"flex", gap:8, marginBottom:24 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="Search by username…" style={{ flex:1, padding:"10px 14px", background:"#0e0c08", border:"1px solid #3a2a10", borderRadius:8, color:"#e8d8a0", fontFamily:"'Cinzel',serif", fontSize:12, outline:"none" }} />
        <button onClick={doSearch} disabled={searching} style={{ padding:"10px 20px", background:"linear-gradient(135deg,#4a3010,#6a4818)", border:"1px solid #8a6030", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:11, color:"#e8c060", cursor:"pointer", fontWeight:700 }}>{searching?"…":"SEARCH"}</button>
      </div>

      {/* Search error / hints */}
      {searchErr === "blocked_rls" && (
        <div style={{ background:"#1a0808", border:"1px solid #a02020aa", borderRadius:10, padding:"14px 18px", marginBottom:16, fontSize:11, color:"#e06060", fontFamily:"'Cinzel',serif" }}>
          <div style={{ fontWeight:700, marginBottom:6 }}>⚠ Search blocked by Supabase row-level security.</div>
          <div style={{ fontSize:9, color:"#c05040", marginBottom:8 }}>Run this SQL in your Supabase dashboard → SQL Editor:</div>
          <pre style={{ background:"#0a0404", border:"1px solid #3a1010", borderRadius:6, padding:"8px 10px", fontSize:9, color:"#ff9090", overflowX:"auto", margin:0 }}>{`ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "profiles_public_read"\n  ON profiles FOR SELECT\n  TO authenticated USING (true);`}</pre>
        </div>
      )}
      {searchErr && searchErr !== "blocked_rls" && searchErr !== "no_results" && (
        <div style={{ background:"#100808", border:"1px solid #5a1010", borderRadius:8, padding:"10px 14px", marginBottom:12, fontSize:10, color:"#d05050", fontFamily:"'Cinzel',serif" }}>
          ⚠ {searchErr}
        </div>
      )}
      {searchErr === "no_results" && (
        <div style={{ marginBottom:16 }}>
          <div style={{ padding:"12px 14px", fontSize:11, color:"#504030", fontFamily:"'Cinzel',serif", textAlign:"center", marginBottom:8 }}>
            No players found matching "{search}".
          </div>
          <div style={{ background:"#0e0e08", border:"1px solid #3a2a10", borderRadius:8, padding:"10px 14px", fontSize:9, color:"#705040", fontFamily:"'Cinzel',serif" }}>
            <div style={{ marginBottom:6, color:"#c0a060" }}>If you expect to find players, RLS may be blocking the search. Run in Supabase SQL Editor:</div>
            <pre style={{ background:"#080804", border:"1px solid #2a1e08", borderRadius:6, padding:"8px 10px", fontSize:9, color:"#a09060", overflowX:"auto", margin:0 }}>{`CREATE POLICY "profiles_public_read"\n  ON profiles FOR SELECT\n  TO authenticated USING (true);`}</pre>
          </div>
        </div>
      )}

      {/* Search results */}
      {searchResults.length > 0 && (
        <div style={{ background:"#0a0806", border:"1px solid #2a1e08", borderRadius:10, marginBottom:20, overflow:"hidden" }}>
          <div style={{ padding:"8px 14px", borderBottom:"1px solid #1a1408", fontFamily:"'Cinzel',serif", fontSize:9, color:"#604030", letterSpacing:3 }}>SEARCH RESULTS</div>
          {searchResults.map(p => (
            <div key={p.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderBottom:"1px solid #140e04" }}>
              <div style={{ width:34, height:34, borderRadius:"50%", background:"#1a1208", border:"1px solid #3a2810", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',serif", fontSize:12, color:"#e8c060", overflow:"hidden", flexShrink:0 }}>
                {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : (p.name||"?").slice(0,2).toUpperCase()}
              </div>
              <span style={{ flex:1, fontFamily:"'Cinzel',serif", fontSize:13, color:"#d0c098" }}>{p.name}</span>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
                <button onClick={()=>sendRequest(p)} disabled={sendingTo===p.id||sentTo[p.id]} style={{ padding:"6px 14px", background:sentTo[p.id]?"rgba(80,180,40,0.18)":sendingTo===p.id?"rgba(100,100,100,0.15)":"rgba(200,144,16,0.15)", border:`1px solid ${sentTo[p.id]?"#4a8030":"#8a6030"}`, borderRadius:6, fontFamily:"'Cinzel',serif", fontSize:10, color:sentTo[p.id]?"#78cc45":sendingTo===p.id?"#806040":"#e8c060", cursor:sentTo[p.id]||sendingTo===p.id?"default":"pointer" }}>{sentTo[p.id]?"✓ SENT":sendingTo===p.id?"…":"+ ADD"}</button>
                {addErr[p.id] && <span style={{ fontSize:9, color:"#e05050", fontFamily:"'Cinzel',serif" }}>{addErr[p.id]}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RLS hint for friendships table */}
      {friendsRlsErr && (
        <div style={{ background:"#1a0808", border:"1px solid #a02020aa", borderRadius:10, padding:"14px 18px", marginBottom:16, fontSize:11, color:"#e06060", fontFamily:"'Cinzel',serif" }}>
          <div style={{ fontWeight:700, marginBottom:6 }}>⚠ Friend list blocked by Supabase RLS.</div>
          <div style={{ fontSize:9, color:"#c05040", marginBottom:8 }}>Run this SQL in Supabase → SQL Editor:</div>
          <pre style={{ background:"#0a0404", border:"1px solid #3a1010", borderRadius:6, padding:"8px 10px", fontSize:9, color:"#ff9090", overflowX:"auto", margin:0 }}>{`CREATE POLICY "friendships_read" ON friendships\n  FOR SELECT TO authenticated\n  USING (requester = auth.uid()::text OR accepter = auth.uid()::text);\n\nCREATE POLICY "friendships_insert" ON friendships\n  FOR INSERT TO authenticated\n  WITH CHECK (requester = auth.uid()::text);\n\nCREATE POLICY "friendships_update" ON friendships\n  FOR UPDATE TO authenticated\n  USING (requester = auth.uid()::text OR accepter = auth.uid()::text);\n\nCREATE POLICY "friendships_delete" ON friendships\n  FOR DELETE TO authenticated\n  USING (requester = auth.uid()::text OR accepter = auth.uid()::text);`}</pre>
        </div>
      )}

      {/* Pending incoming */}
      {pendingIn.length > 0 && (
        <div style={{ background:"#0a0806", border:"1px solid #3a2a10", borderRadius:10, marginBottom:20, overflow:"hidden" }}>
          <div style={{ padding:"8px 14px", borderBottom:"1px solid #1a1408", fontFamily:"'Cinzel',serif", fontSize:9, color:"#e8c060", letterSpacing:3 }}>PENDING REQUESTS ({pendingIn.length})</div>
          {pendingIn.map(p => (
            <div key={p.rowId} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderBottom:"1px solid #100c04" }}>
              <div style={{ width:34, height:34, borderRadius:"50%", background:"#1a1208", border:"1px solid #3a2810", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',serif", fontSize:12, color:"#e8c060" }}>{p.name.slice(0,2).toUpperCase()}</div>
              <span style={{ flex:1, fontFamily:"'Cinzel',serif", fontSize:13, color:"#d0c098" }}>{p.name}</span>
              <button onClick={()=>acceptRequest(p)} style={{ padding:"6px 14px", background:"linear-gradient(135deg,#1a4010,#2a6018)", border:"1px solid #4a8030", borderRadius:6, fontFamily:"'Cinzel',serif", fontSize:10, color:"#78cc45", cursor:"pointer", fontWeight:700 }}>ACCEPT</button>
              <button onClick={()=>removeFriend(p)} style={{ padding:"6px 10px", background:"transparent", border:"1px solid #3a1010", borderRadius:6, fontFamily:"'Cinzel',serif", fontSize:10, color:"#804040", cursor:"pointer" }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Friends list */}
      <div style={{ background:"#0a0806", border:"1px solid #2a1e08", borderRadius:10, overflow:"hidden" }}>
        <div style={{ padding:"8px 14px", borderBottom:"1px solid #1a1408", fontFamily:"'Cinzel',serif", fontSize:9, color:"#604030", letterSpacing:3 }}>FRIENDS — {friends.filter(f=>isOnline(f.id)).length} ONLINE</div>
        {friends.length === 0 && <div style={{ padding:"28px", textAlign:"center", fontFamily:"'Cinzel',serif", fontSize:11, color:"#3a2a10", letterSpacing:2 }}>NO FRIENDS YET — SEARCH TO ADD</div>}
        {friends.map(f => {
          const online = isOnline(f.id);
          return (
            <div key={f.rowId} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderBottom:"1px solid #100c04", background: online ? "rgba(120,200,69,0.04)" : "transparent", transition:"background .3s" }}>
              <div onClick={()=>openProfile(f.id, f.name)} style={{ position:"relative", flexShrink:0, cursor:"pointer" }} title="View profile">
                <div style={{ width:38, height:38, borderRadius:"50%", background:"#1a1208", border:`2px solid ${online?"#78cc4566":"#2a1e0a"}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',serif", fontSize:13, color:"#e8c060", transition:"border-color .3s", overflow:"hidden" }}>
                  {f.avatar_url ? <img src={f.avatar_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : f.name.slice(0,2).toUpperCase()}
                </div>
                <div style={{ position:"absolute", bottom:1, right:1, width:10, height:10, borderRadius:"50%", background:online?"#78cc45":"#e05050", border:"2px solid #0a0806", transition:"background .3s", boxShadow:online?"0 0 6px #78cc4588":"0 0 4px #e0505055" }} />
              </div>
              <div onClick={()=>openProfile(f.id, f.name)} style={{ flex:1, cursor:"pointer" }}>
                <div style={{ fontFamily:"'Cinzel',serif", fontSize:13, color:"#d0c098", fontWeight:700 }}>{f.name}</div>
                <div style={{ fontSize:9, color:online?"#78cc4599":"#e0505088", fontFamily:"'Cinzel',serif", letterSpacing:1 }}>{online?"ONLINE · TAP TO VIEW":"OFFLINE · TAP TO VIEW"}</div>
              </div>
              {online && (
                <button onClick={()=>sendChallenge(f)} disabled={challengeSent===f.id} style={{ padding:"8px 16px", background:challengeSent===f.id?"rgba(255,255,255,0.04)":"linear-gradient(135deg,#c89010,#f0c040)", border:"none", borderRadius:7, fontFamily:"'Cinzel',serif", fontSize:10, fontWeight:700, color:challengeSent===f.id?"#404030":"#1a1000", cursor:challengeSent===f.id?"default":"pointer", letterSpacing:1 }}>{challengeSent===f.id?"SENT…":"⚔ DUEL"}</button>
              )}
              <button onClick={()=>removeFriend(f)} style={{ padding:"6px 10px", background:"transparent", border:"1px solid #2a1010", borderRadius:6, fontFamily:"'Cinzel',serif", fontSize:10, color:"#603030", cursor:"pointer", opacity:0.6 }}>✕</button>
            </div>
          );
        })}
      </div>

      {pendingOut.length > 0 && (
        <div style={{ marginTop:16, background:"#0a0806", border:"1px solid #1a1408", borderRadius:10, overflow:"hidden" }}>
          <div style={{ padding:"8px 14px", borderBottom:"1px solid #1a1408", fontFamily:"'Cinzel',serif", fontSize:9, color:"#403828", letterSpacing:3 }}>SENT REQUESTS</div>
          {pendingOut.map(p => (
            <div key={p.rowId} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderBottom:"1px solid #100c04" }}>
              <div style={{ width:34, height:34, borderRadius:"50%", background:"#1a1208", border:"1px solid #2a1e0a", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',serif", fontSize:12, color:"#806040" }}>{p.name.slice(0,2).toUpperCase()}</div>
              <span style={{ flex:1, fontFamily:"'Cinzel',serif", fontSize:13, color:"#806040" }}>{p.name}</span>
              <button onClick={()=>removeFriend(p)} style={{ padding:"6px 12px", background:"transparent", border:"1px solid #2a1a08", borderRadius:6, fontFamily:"'Cinzel',serif", fontSize:10, color:"#604030", cursor:"pointer" }}>CANCEL</button>
            </div>
          ))}
        </div>
      )}

      {/* Friend profile modal */}
      {viewProfile && (
        <div style={{ position:"fixed", inset:0, zIndex:600, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={() => setViewProfile(null)}>
          <div style={{ background:"linear-gradient(160deg,#1a1208,#0e0a04)", border:"2px solid #3a2810", borderRadius:18, width:320, maxHeight:"80vh", overflowY:"auto", animation:"fadeIn 0.2s" }} onClick={e=>e.stopPropagation()}>
            {viewProfile.loading ? (
              <div style={{ padding:40, textAlign:"center", fontFamily:"'Cinzel',serif", color:"#e8c060", fontSize:13, letterSpacing:2, animation:"pulse 1.5s infinite" }}>LOADING…</div>
            ) : (() => {
              const wins = viewProfile.ranked_wins || 0;
              const losses = viewProfile.ranked_losses || 0;
              const rating = viewProfile.ranked_rating || 1000;
              const total = wins + losses;
              const wr = total > 0 ? Math.round(wins/total*100) : 0;
              const rank = getRank(rating);
              const colSize = Object.values(viewProfile.collection||{}).filter(v=>v>0).length;
              return (
                <>
                  {/* Header */}
                  <div style={{ position:"relative", height:80, background:`linear-gradient(160deg,${rank.color}22,#0e0a04)`, borderRadius:"16px 16px 0 0", overflow:"hidden", flexShrink:0 }}>
                    <div style={{ position:"absolute", top:"50%", left:20, transform:"translateY(-50%)", display:"flex", alignItems:"center", gap:14 }}>
                      <div style={{ width:52, height:52, borderRadius:"50%", overflow:"hidden", border:`2px solid ${rank.color}88`, display:"flex", alignItems:"center", justifyContent:"center", background:"#1a1408", fontFamily:"'Cinzel',serif", fontSize:16, color:"#e8c060", flexShrink:0 }}>
                        {viewProfile.avatar_url ? <img src={viewProfile.avatar_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : (viewProfile.name||"?").slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontFamily:"'Cinzel',serif", fontSize:15, fontWeight:900, color:"#f0e0c8", letterSpacing:1 }}>{viewProfile.name}</div>
                        <div style={{ fontSize:10, color:rank.color, fontFamily:"'Cinzel',serif", fontWeight:700 }}>{rank.icon} {rank.label}</div>
                      </div>
                    </div>
                    <button onClick={()=>setViewProfile(null)} style={{ position:"absolute", top:10, right:14, background:"none", border:"none", color:"#604030", fontSize:18, cursor:"pointer", lineHeight:1 }}>✕</button>
                  </div>
                  {/* Stats */}
                  <div style={{ padding:"18px 22px", display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, borderBottom:"1px solid #1a1408" }}>
                    {[["RATING", rating],["WINS", wins],["WIN RATE", wr+"%"]].map(([label,val])=>(
                      <div key={label} style={{ textAlign:"center" }}>
                        <div style={{ fontFamily:"'Cinzel',serif", fontSize:18, fontWeight:900, color:"#e8c060" }}>{val}</div>
                        <div style={{ fontSize:8, color:"#504030", fontFamily:"'Cinzel',serif", letterSpacing:2, marginTop:2 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Record */}
                  <div style={{ padding:"14px 22px", borderBottom:"1px solid #1a1408" }}>
                    <div style={{ fontSize:9, color:"#604030", fontFamily:"'Cinzel',serif", letterSpacing:2, marginBottom:8 }}>RANKED RECORD</div>
                    <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                      <div style={{ height:8, borderRadius:4, background:"#78cc45", width:`${total>0?wr:50}%`, minWidth:4, transition:"width .4s" }} />
                      <div style={{ height:8, borderRadius:4, background:"#e05050", flex:1, minWidth:4 }} />
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:5, fontSize:10, fontFamily:"'Cinzel',serif" }}>
                      <span style={{ color:"#78cc45" }}>{wins}W</span>
                      <span style={{ color:"#806040" }}>{total} games</span>
                      <span style={{ color:"#e05050" }}>{losses}L</span>
                    </div>
                  </div>
                  {/* Collection */}
                  <div style={{ padding:"14px 22px" }}>
                    <div style={{ fontSize:9, color:"#604030", fontFamily:"'Cinzel',serif", letterSpacing:2, marginBottom:8 }}>COLLECTION</div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:900, color:"#e8c060" }}>{colSize}</span>
                      <span style={{ fontSize:10, color:"#604030", fontFamily:"'Cinzel',serif" }}>/ {GAMEPLAY_POOL.length} cards</span>
                    </div>
                    <div style={{ height:6, background:"#0e0c08", borderRadius:3, overflow:"hidden", marginTop:8, border:"1px solid #1a1408" }}>
                      <div style={{ height:"100%", width:`${Math.round(colSize/GAMEPLAY_POOL.length*100)}%`, background:"linear-gradient(90deg,#804010,#e8c060)", borderRadius:3, transition:"width .5s" }} />
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LORE SCREEN ──────────────────────────────────────────────────────────────
const LORE_REGIONS = [
  {
    id: "thornwood",
    name: "Thornwood",
    glyph: "🌲",
    color: "#4a9020",
    bg: "linear-gradient(135deg,#0a1a06 0%,#0f2a08 50%,#0a1a06 100%)",
    tagline: "Where roots remember every war.",
    lore: `Deep within the Thornwood, the trees have grown for ten thousand years — and they remember everything. Every battle, every betrayal, every pact sworn under canopy shade is encoded in their rings. The wolves that prowl these ancient paths are not beasts. They are guardians of memory, their howls a language older than any written tongue.\n\nThe Thornwood Guard swear no oath to king or coin. Their allegiance is to the forest itself — to the slow pulse of sap through wood, to the decree that no blade may fell what nature raised. The Rootcaller Druids can commune with the oldest trees, drawing out their fury or their mercy.\n\nTanglers hunt from below. Centuries of war have taught the undergrowth patience. Invaders who march too deep find the ground rising to meet them.`,
    cards: ["Stonefang Wolf", "Thornwood Guard", "Rootcaller Druid", "Tanglewood Trap", "Ancient Grove"],
    champion: null,
    flavor: `"The forest does not hate you. It simply does not need you to survive."`,
  },
  {
    id: "shattered",
    name: "Shattered Expanse",
    glyph: "◈",
    color: "#40a0c0",
    bg: "linear-gradient(135deg,#060e1a 0%,#081828 50%,#060e1a 100%)",
    tagline: "Time broke here. It never healed.",
    lore: `When the first Rift tore open in the Expanse, it did not close. It fractured — shattering into hundreds of smaller rifts, each one a window into a slightly different when. The Echo Wisps that drift through this landscape are echoes of people who walked these sands in timelines that no longer exist.\n\nVelrun has navigated these rifts for longer than memory allows. They have watched themselves die. They have spoken to themselves at futures that never arrived. The Timeline Weaver draws threads from collapsed moments and weaves them into fresh possibility — sometimes to heal, sometimes to erase.\n\nThe Shattered Expanse rewards those who embrace contradiction. Here, cause follows effect. Here, arrival precedes departure.`,
    cards: ["Echo Wisp", "Rift Shard", "Timeline Weaver", "Velrun", "Fractured Rift"],
    champion: { name: "Velrun", title: "Walker Between Moments", lore: "Velrun remembers every version of this fight. In most of them, you lose. But Velrun has learned that memory is not prophecy — and occasionally, the forgotten path is the only one left." },
    flavor: `"I've already been here. You just don't know it yet."`,
  },
  {
    id: "azure",
    name: "Azure Deep",
    glyph: "◉",
    color: "#2060e0",
    bg: "linear-gradient(135deg,#040a1e 0%,#060f30 50%,#040a1e 100%)",
    tagline: "The ocean is patient. The ocean always wins.",
    lore: `Below the surface of the Moaning Sea lies a civilization older than any above it. The Azure Deep spans trenches and ridgelines, coral cities and abyssal plains. The Tidecaller communes with the current itself, drawing storms from calm water. Shellguards formed their shells over decades spent in war-zones — each crack in their carapace a story of survival.\n\nThe Abyssal Kraken does not hunt. It waits. Its patience is geological. When the Kraken stirs, fishermen say the sea itself holds its breath. Riptide Current can funnel the force of an entire ocean through a single point — enough to knock champions from their feet.\n\nThe Deep does not welcome visitors. But those who earn its respect become part of the tide.`,
    cards: ["Tidecaller", "Shellguard", "Riptide Current", "Abyssal Kraken", "Sunken Depths"],
    champion: { name: "Abyssal Kraken", title: "Hunger of the Deep", lore: "No one knows how old the Kraken is. Scholars have found cave paintings of it. The paintings are underwater now." },
    flavor: `"It isn't attacking you. You swam into its dream."`,
  },
  {
    id: "ashfen",
    name: "Ashfen",
    glyph: "🔥",
    color: "#d04010",
    bg: "linear-gradient(135deg,#1a0600 0%,#2a0800 50%,#1a0600 100%)",
    tagline: "Nothing burns alone in Ashfen.",
    lore: `Ashfen is what happens when a swamp catches fire and refuses to stop burning. The peat has been smoldering for three centuries. The sky is a permanent orange. The Emberveil Sprites emerged from the smoke — fragile, luminous, dangerous. The Ashfen Imps have adapted to the heat over generations, their skin cured to leather by constant exposure.\n\nThe Pyromancer does not control fire. They negotiate with it. Fire, in Ashfen's philosophy, is alive — a creature with opinions. To command a flame is to make a promise you cannot take back.\n\nThe Volcanic Eruption is not a disaster. It is a cleansing. Everything that survives becomes something stronger.`,
    cards: ["Emberveil Sprite", "Ashfen Imp", "Pyromancer", "Volcanic Eruption", "Ashfen Caldera"],
    champion: null,
    flavor: `"We do not fear the fire. We are the fire's children."`,
  },
  {
    id: "ironmarch",
    name: "Ironmarch",
    glyph: "⚙",
    color: "#8090a0",
    bg: "linear-gradient(135deg,#0a0e14 0%,#121820 50%,#0a0e14 100%)",
    tagline: "Progress does not ask permission.",
    lore: `The Ironmarch began as a forge-city — a single foundry where great weapons were cast in the age of the Titan Wars. It has become an empire. The Iron Sentinels are not soldiers. They are policies. Each one represents a law made physical, an edict given legs and blades.\n\nForge Automatons are built to build. They construct walls, mine ore, repair themselves, and occasionally request reassignment to combat units after witnessing too many battles. The Ironmarch Colossus is not the biggest thing the Ironmarch has ever made — it is simply the biggest thing they have ever let off the chain.\n\nThe Iron Barricade spell encodes the founding principle of Ironmarch: that the greatest weapon is the thing that cannot be moved.`,
    cards: ["Iron Sentinel", "Forge Automaton", "Iron Barricade", "Ironmarch Colossus"],
    champion: { name: "Ironmarch Colossus", title: "The Walking Edict", lore: "Constructed during the Siege of Velmarrow, the Colossus was meant to be dismantled after the war. No one gave the order. No one dared deliver it." },
    flavor: `"It takes three months to build an Iron Sentinel. It takes a forge-master's entire career to build its heart."`,
  },
  {
    id: "sunveil",
    name: "Sunveil",
    glyph: "☀",
    color: "#d0a020",
    bg: "linear-gradient(135deg,#1a1400 0%,#261e00 50%,#1a1400 100%)",
    tagline: "In the light, nothing hides.",
    lore: `The Sunveil Plains stretch from the Gilded Shelf to the Windwall Crags — vast, dry, and mercilessly honest. There is no cover here. The Sunveil Falcon sees every movement from a thousand feet up. The Sand Oracle reads the truth of things from the angle of shadows at noon.\n\nSunveil culture prizes clarity above all. Their magic is not subtle — Solar Flare does not creep or surprise. It announces itself and burns. The Shifting Dunes environment card captures Sunveil's defining philosophy: the ground itself refuses to let you stand still.\n\nThose who call Sunveil home do not hide from the sun. They use it.`,
    cards: ["Sunveil Falcon", "Sand Oracle", "Solar Flare", "Shifting Dunes"],
    champion: null,
    flavor: `"Stand in the light and be judged. Or step into the shade and be forgotten."`,
  },
  {
    id: "bloodpact",
    name: "Bloodpact",
    glyph: "⚉",
    color: "#a01020",
    bg: "linear-gradient(135deg,#14000a 0%,#200010 50%,#14000a 100%)",
    tagline: "Every gift has a price. The Bloodpact collects.",
    lore: `The Bloodpact is not a faction. It is a contract. Anyone may sign it — and many have, in moments of desperation when no other door remained open. The Siphon Wraith collects the interest. The Crimson Martyr demonstrates what full payment looks like.\n\nThe Hemomancer understands that blood is not waste. It is currency, communication, and causality. Every drop has potential. The Dark Bargain spell represents the core of the Bloodpact's philosophy: sacrifice something real, gain something real. No illusions.\n\nThose who wield Bloodpact power are not evil. They are pragmatic. They have simply accepted the arithmetic of power — and they are very good at math.`,
    cards: ["Siphon Wraith", "Crimson Martyr", "Hemomancer", "Dark Bargain"],
    champion: { name: "Hemomancer", title: "Architect of Sacrifice", lore: "The Hemomancer trains for years to learn a single lesson: how to give just enough to get everything." },
    flavor: `"You still have two kidneys. Shall we discuss the exchange rate?"`,
  },
  {
    id: "foodfight",
    name: "Food Fight",
    glyph: "🍖",
    color: "#ff6040",
    bg: "linear-gradient(135deg,#1a0800 0%,#2a0e00 50%,#1a0800 100%)",
    tagline: "The most important battle of your life.",
    lore: `Nobody knows how it started. The historians blame Berry & Tooty for the first incident — an aggressive Splat landing on a Protein delegation. The delegation retaliated with a Veggie Ingredient. Within an hour, the entire cafeteria was at war.\n\nNow the Food Fight spans realms. Master Jax brought tactical doctrine. Capt. Meatball brought raw aggression. The Broccoli Brute brought a passion for synergy that scholars call "deeply concerning." The Caffeine Catapult runs on refined sugar and grievances.\n\nThe Leftover Titan is what happens when nobody cleans up after the battle. It has absorbed nutrients from every group. It is considered a Fruit, Veggie, Protein, AND Sugar, which is unprecedented and frankly impressive. Food-nado is the signature finishing move: everything, everywhere, all at once. `,
    cards: ["Berry & Tooty", "Master Jax", "Capt. Meatball", "Broccoli Brute", "Caffeine Catapult", "Sir Sizzles", "Leftover Titan", "Food-nado", "Bean Barrage"],
    champion: { name: "Berry & Tooty", title: "The Champions of Chaos", lore: "They argue constantly. They also win constantly. The two facts are related." },
    flavor: `"This is not a food fight. This is ART." — Master Jax, probably.`,
  },
  {
    id: "fables",
    name: "Fables",
    glyph: "⚡",
    color: "#9070ff",
    bg: "linear-gradient(135deg,#0a0620 0%,#100a30 50%,#0a0620 100%)",
    tagline: "The gods have returned. They are angry.",
    lore: `Olympus did not fall. It descended. When the age of faith ended, the gods did not vanish — they contracted. They became denser, more specific, more dangerous. Zeus, Storm Father, traded worship for precision. Every lightning bolt now chosen. Every storm deliberate.\n\nHades came down last, and deepest. The Underworld is not below Olympus — it is below everything. His Soul Harvest began the moment living things first drew breath. He has been patient.\n\nMedusa never asked to be a monster. She asks it now. Her Gaze does not kill — it clarifies. The Cerberus Whelp has not yet grown three heads. It's working on it. The Spartan Recruits march because the alternative is explaining themselves to Hades.\n\nThe Fables expansion marks the gods' return to the field of play. For the first time in ten thousand years, they are taking sides.`,
    cards: ["Zeus, Storm Father", "Hades, Soul Reaper", "Spartan Recruit", "Lost Soul", "Fables Guard", "Cerberus Whelp", "Titan-Slayer", "Bolt from the Blue", "River Styx", "Pandora's Box", "Hera's Command", "Medusa's Gaze"],
    champion: { name: "Zeus & Hades", title: "Brothers of Sky and Grave", lore: "They do not cooperate. They compete. Every soul that dies is a point for Hades. Every storm that strikes is a point for Zeus. The game has been running since the first sunrise." },
    flavor: `"Bring your best deck, mortal. We have been playing since before your kind had language."`,
  },
];

function LoreScreen() {
  const [selected, setSelected] = useState(null);
  const [animating, setAnimating] = useState(false);

  const select = (region) => {
    if (selected?.id === region.id) { setSelected(null); return; }
    setAnimating(true);
    setSelected(region);
    setTimeout(() => setAnimating(false), 80);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px 60px", fontFamily: "'Cinzel', serif" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ fontSize: 11, letterSpacing: 6, color: "#6a4c20", marginBottom: 8 }}>CHRONICLES OF</div>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: "#c8a060", margin: 0, letterSpacing: 3, textShadow: "0 0 40px #8b6020aa" }}>FORGE &amp; FABLE</h1>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "#5a3c10", marginTop: 8 }}>THE KNOWN REALMS</div>
        <div style={{ width: 60, height: 1, background: "linear-gradient(90deg,transparent,#6a4c20,transparent)", margin: "18px auto 0" }} />
      </div>

      {/* Region Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 32 }}>
        {LORE_REGIONS.map(r => (
          <div key={r.id} onClick={() => select(r)} style={{
            background: selected?.id === r.id ? r.bg : "linear-gradient(135deg,#0e0c08,#141008)",
            border: `1px solid ${selected?.id === r.id ? r.color + "88" : "#2a2010"}`,
            borderRadius: 10,
            padding: "14px 16px",
            cursor: "pointer",
            transition: "all 0.2s",
            boxShadow: selected?.id === r.id ? `0 0 24px ${r.color}44, inset 0 0 20px ${r.color}11` : "none",
            transform: selected?.id === r.id ? "scale(1.02)" : "scale(1)",
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{r.glyph}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: selected?.id === r.id ? r.color : "#a08040", letterSpacing: 1 }}>{r.name}</div>
            <div style={{ fontSize: 9, color: "#5a4820", marginTop: 4, letterSpacing: 0.5, fontStyle: "italic", lineHeight: 1.4 }}>{r.tagline}</div>
          </div>
        ))}
      </div>

      {/* Expanded Lore Panel */}
      {selected && (
        <div style={{
          background: selected.bg,
          border: `1px solid ${selected.color}55`,
          borderRadius: 14,
          padding: "32px 28px",
          marginBottom: 32,
          opacity: animating ? 0 : 1,
          transition: "opacity 0.08s",
          boxShadow: `0 0 60px ${selected.color}22, inset 0 0 40px ${selected.color}08`,
        }}>
          {/* Region header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 40, lineHeight: 1 }}>{selected.glyph}</div>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 5, color: selected.color + "aa", marginBottom: 4 }}>REALM LORE</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: selected.color, letterSpacing: 2, textShadow: `0 0 20px ${selected.color}66` }}>{selected.name}</div>
              <div style={{ fontSize: 11, color: "#806040", fontStyle: "italic", marginTop: 4 }}>{selected.tagline}</div>
            </div>
          </div>

          {/* Lore text */}
          <div style={{ fontSize: 13, color: "#c8a870", lineHeight: 1.85, marginBottom: 24 }}>
            {selected.lore.split("\n\n").map((para, i) => (
              <p key={i} style={{ margin: i === 0 ? 0 : "16px 0 0" }}>{para}</p>
            ))}
          </div>

          {/* Flavor quote */}
          <div style={{ borderLeft: `3px solid ${selected.color}55`, paddingLeft: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: selected.color + "cc", fontStyle: "italic", lineHeight: 1.6 }}>{selected.flavor}</div>
          </div>

          {/* Cards in this realm */}
          <div style={{ marginBottom: selected.champion ? 24 : 0 }}>
            <div style={{ fontSize: 9, letterSpacing: 4, color: "#6a4c20", marginBottom: 10 }}>KNOWN CARDS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {selected.cards.map(name => (
                <span key={name} style={{ background: selected.color + "22", border: `1px solid ${selected.color}44`, borderRadius: 6, padding: "4px 10px", fontSize: 10, color: selected.color + "dd", letterSpacing: 0.5 }}>{name}</span>
              ))}
            </div>
          </div>

          {/* Champion spotlight */}
          {selected.champion && (
            <div style={{ marginTop: 24, background: "rgba(0,0,0,0.4)", border: `1px solid ${selected.color}44`, borderRadius: 10, padding: "18px 20px" }}>
              <div style={{ fontSize: 9, letterSpacing: 4, color: selected.color + "88", marginBottom: 8 }}>CHAMPION SPOTLIGHT</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: selected.color, marginBottom: 2 }}>{selected.champion.name}</div>
              <div style={{ fontSize: 10, color: "#806040", fontStyle: "italic", marginBottom: 10, letterSpacing: 1 }}>{selected.champion.title}</div>
              <div style={{ fontSize: 12, color: "#c0a060", lineHeight: 1.7 }}>{selected.champion.lore}</div>
            </div>
          )}
        </div>
      )}

      {/* Bottom flavor */}
      {!selected && (
        <div style={{ textAlign: "center", color: "#3a2c10", fontSize: 11, fontStyle: "italic", letterSpacing: 1 }}>
          Select a realm to read its chronicle.
        </div>
      )}
    </div>
  );
}

function CommunityScreen({ user }) {
  const [idea, setIdea] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [communityCards, setCommunityCards] = useState([]);
  const [posting, setPosting] = useState(false);
  const [myVotes, setMyVotes] = useState(() => { try { return JSON.parse(localStorage.getItem("community_votes")||"{}"); } catch(_) { return {}; } });
  const [activeTab, setActiveTab] = useState("forge"); // "forge" | "wall" | "feedback" | "lore" | "guide"
  const [tableError, setTableError] = useState(null);
  const [postError, setPostError] = useState(null);

  useEffect(() => { loadCards(); }, []);

  const SQL_SETUP = `CREATE TABLE community_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, user_name TEXT, name TEXT, faction TEXT, type TEXT,
  cost INT, atk INT, hp INT, ability TEXT, keywords TEXT[],
  rarity TEXT, original_idea TEXT, votes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE community_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read" ON community_cards FOR SELECT USING (true);
CREATE POLICY "insert" ON community_cards FOR INSERT WITH CHECK (auth.role()='authenticated');
CREATE POLICY "vote" ON community_cards FOR UPDATE USING (true);`;

  const loadCards = async () => {
    try {
      const { data, error } = await supabase.from("community_cards").select("*").order("votes", { ascending: false }).limit(30);
      if (error) { if (error.message?.includes("does not exist") || error.message?.includes("relation") || error.message?.includes("schema cache") || error.code === "42P01") { setTableError(SQL_SETUP); } return; }
      if (data) { setCommunityCards(data); setTableError(null); }
    } catch(_) {}
  };

  const forge = () => {
    if (!idea.trim() || generating) return;
    setGenerating(true);
    SFX.play("ability");
    setTimeout(() => {
      const concept = generateCardConcept(idea);
      setGenerated(concept);
      setGenerating(false);
      SFX.play("rare_reveal");
    }, 1200 + Math.random() * 600);
  };

  const postToWall = async () => {
    if (!generated || !user || posting) return;
    setPosting(true);
    try {
      const { error: insertErr } = await supabase.from("community_cards").insert([{
        user_id: user.id, user_name: user.name || "Anonymous",
        name: generated.name, faction: generated.faction, type: generated.type,
        cost: generated.cost, atk: generated.atk, hp: generated.hp,
        ability: generated.ability, keywords: generated.keywords, rarity: generated.rarity,
        original_idea: idea, votes: 0,
      }]);
      if (insertErr) throw insertErr;
      SFX.play("victory");
      setGenerated(null); setIdea("");
      await loadCards();
      setActiveTab("wall");
    } catch(e) {
      const msg = e?.message || String(e);
      const needsTable = msg.includes("does not exist") || msg.includes("relation") || msg.includes("schema cache");
      if (needsTable) { setTableError(SQL_SETUP); } else { setPostError(`Post failed: ${msg}`); }
    }
    setPosting(false);
  };

  const vote = async (cardId) => {
    if (!user || myVotes[cardId]) return;
    setMyVotes(p => { const n = { ...p, [cardId]: true }; try { localStorage.setItem("community_votes", JSON.stringify(n)); } catch(_) {} return n; });
    SFX.play("card");
    try {
      await supabase.rpc("increment_votes", { card_id: cardId }).catch(() =>
        supabase.from("community_cards").update({ votes: (communityCards.find(c=>c.id===cardId)?.votes||0)+1 }).eq("id", cardId)
      );
      setCommunityCards(p => p.map(c => c.id===cardId ? { ...c, votes: (c.votes||0)+1 } : c));
    } catch(_) {}
  };

  const rarityColor = { Common:"#8a8a7a", Uncommon:"#c0922a", Rare:"#5090ff", Epic:"#a860d8", Legendary:"#f0b818" };

  return (
    <div style={{ maxWidth:900, margin:"0 auto", padding:"32px 24px 60px" }}>
      {/* Header */}
      <div style={{ textAlign:"center", marginBottom:28 }}>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#504038", letterSpacing:4, marginBottom:8 }}>COMMUNITY HUB</div>
        <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:26, fontWeight:900, color:"#e8c060", margin:"0 0 6px", textShadow:"0 0 40px #e8c06044" }}>Card Forge</h2>
        <p style={{ fontSize:12, color:"#806040", maxWidth:460, margin:"0 auto", lineHeight:1.8 }}>Describe your card idea. The forge generates a full card — name, abilities, faction, stats. Post it to the community for votes.</p>
      </div>
      {/* Tab switcher */}
      <div style={{ display:"flex", justifyContent:"center", gap:0, marginBottom:24, border:"1px solid #3a2c10", borderRadius:10, overflow:"hidden", maxWidth:600, margin:"0 auto 28px" }}>
        {[["forge","⚗ FORGE"],["wall","🗳 VOTE WALL"],["feedback","💬 FEEDBACK"],["lore","📖 LORE"],["guide","◉ GUIDE"]].map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)} style={{ flex:1, padding:"10px 0", fontFamily:"'Cinzel',serif", fontSize:10, fontWeight:700, letterSpacing:2, color:activeTab===id?"#1a1000":"#806040", background:activeTab===id?"linear-gradient(135deg,#c89010,#f0c040)":"transparent", border:"none", cursor:"pointer", transition:"all .18s" }}>{label}</button>
        ))}
      </div>

      {activeTab === "forge" && (
        <div style={{ display:"grid", gridTemplateColumns: generated ? "1fr 1fr" : "1fr", gap:24, alignItems:"start" }}>
          {/* Input panel */}
          <div style={{ background:"linear-gradient(160deg,#141008,#0e0c06)", border:"1px solid #3a2c10", borderRadius:14, padding:24 }}>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:"#e8a020", letterSpacing:3, marginBottom:12, fontWeight:700 }}>✦ DESCRIBE YOUR CARD IDEA</div>
            <textarea value={idea} onChange={e=>setIdea(e.target.value)} placeholder="e.g. A shadow wolf that bleeds enemies and hunts in packs..." style={{ width:"100%", minHeight:100, background:"rgba(0,0,0,0.5)", border:"1px solid #2a2010", borderRadius:8, padding:"10px 12px", color:"#e0d8c0", fontFamily:"'Lora',Georgia,serif", fontSize:12, lineHeight:1.7, outline:"none", resize:"vertical", boxSizing:"border-box" }} />
            <div style={{ display:"flex", gap:10, marginTop:12, flexWrap:"wrap" }}>
              {["A healing spirit","Fire beast with shield","Echo spell that copies","Iron war golem"].map(hint=>(
                <button key={hint} onClick={()=>setIdea(hint)} style={{ padding:"4px 10px", background:"rgba(232,192,96,0.06)", border:"1px solid #3a2c1044", borderRadius:20, fontSize:9, color:"#806040", fontFamily:"'Cinzel',serif", cursor:"pointer" }}>{hint}</button>
              ))}
            </div>
            <button onClick={forge} disabled={!idea.trim() || generating} style={{ marginTop:16, width:"100%", padding:"13px", background: generating ? "rgba(200,144,16,0.3)" : "linear-gradient(135deg,#c89010,#f0c040)", border:"none", borderRadius:9, fontFamily:"'Cinzel',serif", fontSize:13, fontWeight:700, letterSpacing:3, color: generating ? "#806020" : "#1a1000", cursor: idea.trim() && !generating ? "pointer" : "default", boxShadow: generating ? "none" : "0 4px 20px rgba(200,144,16,0.4)", transition:"all .2s" }}>
              {generating ? "⚗ FORGING..." : "⚗ FORGE CARD"}
            </button>
            {generating && <div style={{ textAlign:"center", marginTop:10, fontFamily:"'Cinzel',serif", fontSize:9, color:"#806040", letterSpacing:3, animation:"pulse 1s infinite" }}>CHANNELING THE ARCANE...</div>}
          </div>
          {/* Generated card result */}
          {generated && (
            <div style={{ background:"linear-gradient(160deg,#12100a,#0c0a06)", border:"1px solid #4a3818", borderRadius:14, padding:24, animation:"fadeIn 0.4s ease-out" }}>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#e8a020", letterSpacing:3, marginBottom:14, fontWeight:700 }}>✦ FORGED CARD</div>
              {/* Card preview */}
              <div style={{ background:"linear-gradient(160deg,#1a1408,#0e0c06)", border:`2px solid ${rarityColor[generated.rarity]||"#e8c060"}`, borderRadius:12, padding:16, marginBottom:14, position:"relative" }}>
                {/* Rarity badge */}
                <div style={{ position:"absolute", top:8, right:10, fontSize:8, color:rarityColor[generated.rarity], background:"rgba(0,0,0,0.7)", padding:"2px 8px", borderRadius:10, border:`1px solid ${rarityColor[generated.rarity]}44`, fontFamily:"'Cinzel',serif", fontWeight:700 }}>{(generated.rarity||"Common").toUpperCase()}</div>
                {/* Cost */}
                <div style={{ position:"absolute", top:8, left:10, width:28, height:28, borderRadius:"50%", background:"radial-gradient(#ffe040,#d09000)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',serif", fontWeight:900, fontSize:13, color:"#1a1000" }}>{generated.cost}</div>
                <div style={{ paddingTop:8 }}>
                  <div style={{ fontFamily:"'Cinzel',serif", fontSize:18, fontWeight:900, color:"#f0e8d0", margin:"0 0 2px", textAlign:"center" }}>{generated.name}</div>
                  <div style={{ fontSize:9, color:"#806040", textAlign:"center", marginBottom:10 }}>{generated.type} · <span style={{ color:GLOW[generated.faction]||"#e8c060" }}>{generated.faction}</span></div>
                  {generated.keywords.length > 0 && (
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap", justifyContent:"center", marginBottom:10 }}>
                      {generated.keywords.map(kw=>{ const kd=KW.find(k=>k.name===kw); return (<span key={kw} style={{ fontSize:9, padding:"2px 8px", borderRadius:12, background:(kd?.color||"#e8c060")+"cc", color:"#fff", border:"1px solid "+(kd?.color||"#e8c060")+"ee", fontWeight:700, textShadow:"0 1px 3px rgba(0,0,0,0.9)" }}>{kd?.icon||"◆"} {kw}</span>); })}
                    </div>
                  )}
                  {generated.type==="Creature" && <div style={{ display:"flex", gap:16, justifyContent:"center", marginBottom:10 }}>
                    <span style={{ fontFamily:"'Cinzel',serif", fontSize:13, color:"#e05050" }}>⚔ {generated.atk}</span>
                    <span style={{ fontFamily:"'Cinzel',serif", fontSize:13, color:"#50c060" }}>♥ {generated.hp}</span>
                  </div>}
                  <div style={{ fontSize:11, color:"#c0b890", lineHeight:1.7, borderTop:"1px solid #2a2010", paddingTop:8 }}>{generated.ability}</div>
                </div>
              </div>
              {/* Actions */}
              {user ? (
                <>
                  <button onClick={() => { setPostError(null); postToWall(); }} disabled={posting} style={{ width:"100%", padding:"11px", background:"linear-gradient(135deg,#204080,#3060c0)", border:"none", borderRadius:9, fontFamily:"'Cinzel',serif", fontSize:12, fontWeight:700, letterSpacing:2, color:"#e0f0ff", cursor: posting?"default":"pointer", boxShadow:"0 4px 18px rgba(50,100,220,0.35)" }}>
                    {posting ? "POSTING..." : "POST TO COMMUNITY ✦"}
                  </button>
                  {postError && <div style={{ marginTop:6, fontSize:10, color:"#e05050", fontFamily:"'Cinzel',serif", textAlign:"center" }}>{postError}</div>}
                </>
              ) : <div style={{ fontSize:10, color:"#504030", textAlign:"center", fontFamily:"'Cinzel',serif", letterSpacing:2 }}>SIGN IN TO POST</div>}
              <button onClick={forge} style={{ marginTop:8, width:"100%", padding:"8px", background:"transparent", border:"1px solid #3a2c10", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:10, color:"#806040", cursor:"pointer" }}>RE-FORGE</button>
            </div>
          )}
        </div>
      )}

      {activeTab === "wall" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#504038", letterSpacing:3, fontWeight:700 }}>COMMUNITY CARDS · SORTED BY VOTES</div>
            <button onClick={loadCards} style={{ padding:"5px 12px", background:"transparent", border:"1px solid #3a2010", borderRadius:7, fontSize:9, color:"#806040", fontFamily:"'Cinzel',serif", cursor:"pointer" }}>REFRESH</button>
          </div>
          {tableError ? (
            <div style={{ textAlign:"center", padding:"32px 24px", background:"rgba(0,0,0,0.4)", borderRadius:12, border:"1px solid #5a1818" }}>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:13, color:"#e84040", marginBottom:8 }}>⚠ Community board table not found</div>
              <div style={{ fontSize:10, color:"#806040", marginBottom:12 }}>Run this SQL in Supabase to create it:</div>
              <pre style={{ background:"#0a0806", border:"1px solid #2a1a08", borderRadius:8, padding:14, fontSize:9, color:"#c0a060", textAlign:"left", overflowX:"auto", whiteSpace:"pre-wrap", wordBreak:"break-all", marginBottom:12 }}>{tableError}</pre>
              <button onClick={()=>{ navigator.clipboard?.writeText(tableError); }} style={{ padding:"6px 16px", background:"rgba(232,192,96,0.1)", border:"1px solid #e8c06044", borderRadius:7, fontFamily:"'Cinzel',serif", fontSize:9, color:"#e8c060", cursor:"pointer" }}>COPY SQL</button>
            </div>
          ) : communityCards.length === 0 ? (
            <div style={{ textAlign:"center", padding:"48px 24px", background:"rgba(0,0,0,0.3)", borderRadius:12, border:"1px solid #1a1810" }}>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:14, color:"#3a3020", marginBottom:8 }}>No cards forged yet</div>
              <div style={{ fontSize:11, color:"#2a2010" }}>Be the first to forge and post a card!</div>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14 }}>
              {communityCards.map((card, i) => (
                <div key={card.id} style={{ background:"linear-gradient(160deg,#12100a,#0c0a06)", border:`1px solid ${rarityColor[card.rarity]||"#3a2810"}55`, borderRadius:12, padding:16, animation:`cardReveal 0.35s ease-out ${i*0.04}s both`, position:"relative" }}>
                  {/* Rarity bar */}
                  <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${rarityColor[card.rarity]||"#e8c060"},transparent)`, borderRadius:"12px 12px 0 0" }} />
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div>
                      <div style={{ fontFamily:"'Cinzel',serif", fontSize:14, fontWeight:900, color:"#f0e8d0" }}>{card.name}</div>
                      <div style={{ fontSize:9, color:"#604030", marginTop:1 }}>{card.type} · <span style={{ color:GLOW[card.faction]||"#e8c060" }}>{card.faction}</span></div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:8, color:rarityColor[card.rarity], fontFamily:"'Cinzel',serif", fontWeight:700 }}>{card.rarity}</div>
                      {card.type==="Creature" && <div style={{ fontSize:9, color:"#a08060", marginTop:2 }}><span style={{ color:"#e05050" }}>⚔{card.atk}</span> <span style={{ color:"#50c060" }}>♥{card.hp}</span></div>}
                    </div>
                  </div>
                  {card.keywords?.length > 0 && <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:6 }}>
                    {card.keywords.map(kw=>{ const kd=KW.find(k=>k.name===kw); return (<span key={kw} style={{ fontSize:8, padding:"1px 6px", borderRadius:10, background:(kd?.color||"#e8c060")+"cc", color:"#fff", border:"1px solid "+(kd?.color||"#e8c060")+"ee", fontWeight:700, textShadow:"0 1px 3px rgba(0,0,0,0.9)" }}>{kw}</span>); })}
                  </div>}
                  <div style={{ fontSize:10, color:"#a09070", lineHeight:1.6, marginBottom:10, borderTop:"1px solid #1a1810", paddingTop:8 }}>{card.ability}</div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:9, color:"#3a2a18" }}>by {card.user_name}</span>
                    <button onClick={()=>vote(card.id)} disabled={!!myVotes[card.id] || !user} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", background: myVotes[card.id] ? "rgba(80,180,80,0.15)" : "rgba(232,192,96,0.08)", border:`1px solid ${myVotes[card.id]?"#50c06055":"#3a2c1055"}`, borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:10, fontWeight:700, color:myVotes[card.id]?"#50c060":"#806040", cursor: !myVotes[card.id] && user ? "pointer" : "default" }}>
                      {myVotes[card.id]?"✓":""} ▲ {card.votes||0}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "feedback" && <FeedbackWall user={user} />}
      {activeTab === "lore" && <LoreScreen />}
      {activeTab === "guide" && <GuideScreen />}
    </div>
  );
}

// ═══ APP ══════════════════════════════════════════════════════════════════════
// Global ref so nav can trigger PvP forfeit when user confirms leaving
const pvpForfeitRef = { current: null };

const NAV = [
  { id: "home",       label: "Home",    icon: "⬡" },
  { id: "store",      label: "Store",   icon: "◈" },
  { id: "play",       label: "Battle",  icon: "⚔" },
  { id: "collection", label: "Cards",   icon: "❖" },
  { id: "community",  label: "Hub",     icon: "✦" },
];

// ═══ ALPHA KEY ADMIN PANEL (tcombz only) ═════════════════════════════════════
function AlphaKeyAdminPanel() {
  const [usedKeys, setUsedKeys] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("used_alpha_keys").select("key,used_by_name,used_at");
    setUsedKeys(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const usedSet = new Set((usedKeys || []).map(r => r.key));
  const unused = ALPHA_KEYS_LIST.filter(k => !usedSet.has(k));

  const copy = (k) => {
    navigator.clipboard?.writeText(k).catch(() => {});
    setCopied(k);
    setTimeout(() => setCopied(null), 1800);
  };

  const [showUsed, setShowUsed] = useState(false);

  return (
    <div style={{ marginBottom:14, padding:"10px 12px", background:"rgba(0,30,60,0.4)", border:"1px solid #102840", borderRadius:9 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <span style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#40c8ff", letterSpacing:2, fontWeight:700 }}>⚿ ALPHA KEYS — {unused.length} unused / {(usedKeys||[]).length} claimed</span>
        <button onClick={load} disabled={loading} style={{ fontSize:8, color:"#406080", background:"transparent", border:"none", cursor:"pointer", fontFamily:"'Cinzel',serif", letterSpacing:1 }}>{loading ? "…" : "↻"}</button>
      </div>
      {usedKeys === null
        ? <div style={{ fontSize:9, color:"#406080", textAlign:"center", padding:6 }}>Loading…</div>
        : <>
            {/* Tab toggle */}
            <div style={{ display:"flex", gap:4, marginBottom:8 }}>
              {[["UNUSED", false], ["CLAIMED", true]].map(([label, val]) => (
                <button key={label} onClick={() => setShowUsed(val)} style={{ flex:1, padding:"4px 0", fontFamily:"'Cinzel',serif", fontSize:8, fontWeight:700, letterSpacing:1, cursor:"pointer", borderRadius:5, border:`1px solid ${showUsed===val?"#40c8ff":"#102840"}`, background:showUsed===val?"rgba(64,200,255,0.12)":"transparent", color:showUsed===val?"#40c8ff":"#406080", transition:"all .15s" }}>{label}</button>
              ))}
            </div>
            {!showUsed
              ? unused.length === 0
                ? <div style={{ fontSize:9, color:"#e05050", textAlign:"center", padding:6 }}>All keys claimed!</div>
                : <div style={{ display:"flex", flexDirection:"column", gap:3, maxHeight:220, overflowY:"auto" }}>
                    {unused.map(k => (
                      <div key={k} onClick={() => copy(k)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 8px", background:"rgba(0,40,80,0.35)", border:`1px solid ${copied===k?"#40c8ff44":"#102840"}`, borderRadius:6, cursor:"pointer", transition:"border-color .15s" }}>
                        <span style={{ fontFamily:"monospace", fontSize:10, color:"#60c8ff", letterSpacing:1 }}>{k}</span>
                        <span style={{ fontSize:8, fontFamily:"'Cinzel',serif", color:copied===k?"#78cc45":"#406080", flexShrink:0, marginLeft:6 }}>{copied===k?"✓ COPIED":"COPY"}</span>
                      </div>
                    ))}
                  </div>
              : (usedKeys||[]).length === 0
                ? <div style={{ fontSize:9, color:"#406080", textAlign:"center", padding:6 }}>No keys claimed yet</div>
                : <div style={{ display:"flex", flexDirection:"column", gap:3, maxHeight:220, overflowY:"auto" }}>
                    {(usedKeys||[]).map(r => (
                      <div key={r.key} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", background:"rgba(0,20,40,0.4)", border:"1px solid #0e1e2e", borderRadius:6 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:"monospace", fontSize:9, color:"#40a0c8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.key}</div>
                          <div style={{ fontFamily:"'Cinzel',serif", fontSize:8, color:"#78cc45", marginTop:1 }}>{r.used_by_name}</div>
                        </div>
                        <div style={{ fontSize:7, color:"#305060", fontFamily:"'Cinzel',serif", flexShrink:0, textAlign:"right" }}>{r.used_at ? new Date(r.used_at).toLocaleDateString() : ""}</div>
                      </div>
                    ))}
                  </div>
            }
          </>
      }
    </div>
  );
}

function PlayerSidebar({ user, onUpdateUser, onlineIds, onClose, onChallenge, onLogout, onShowPatchNotes }) {
  const [friends, setFriends] = useState([]);
  const [pendingIn, setPendingIn] = useState([]);
  const [pendingOut, setPendingOut] = useState([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState(null);
  const [sentTo, setSentTo] = useState({});
  const [avatarErr, setAvatarErr] = useState("");
  const [challengeSent, setChallengeSent] = useState(null);
  const [removeConfirm, setRemoveConfirm] = useState(null); // friend object pending removal

  useEffect(() => { loadFriends(); }, []); // eslint-disable-line

  const loadFriends = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase.from("friendships").select("*")
      .or(`requester.eq.${user.id},accepter.eq.${user.id}`);
    if (error || !data) return;
    const otherIds = [...new Set(data.map(r => r.requester === user.id ? r.accepter : r.requester))];
    let pm = {};
    if (otherIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id,name,avatar_url").in("id", otherIds);
      if (profs) profs.forEach(p => { pm[p.id] = p; });
    }
    const nm = (id) => pm[id]?.name || id.slice(0, 8);
    const av = (id) => pm[id]?.avatar_url || null;
    const accepted = data.filter(r => r.status === "accepted");
    const pending  = data.filter(r => r.status === "pending");
    setFriends(accepted.map(r => r.requester === user.id
      ? { id: r.accepter,  name: nm(r.accepter),  avatar_url: av(r.accepter),  rowId: r.id }
      : { id: r.requester, name: nm(r.requester), avatar_url: av(r.requester), rowId: r.id }));
    setPendingIn( pending.filter(r => r.accepter  === user.id).map(r => ({ id: r.requester, name: nm(r.requester), avatar_url: av(r.requester), rowId: r.id })));
    setPendingOut(pending.filter(r => r.requester === user.id).map(r => ({ id: r.accepter,  name: nm(r.accepter),  avatar_url: av(r.accepter),  rowId: r.id })));
  };

  const acceptFriend = async (row) => {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", row.rowId);
    await loadFriends();
  };
  const declineFriend = async (row) => {
    await supabase.from("friendships").delete().eq("id", row.rowId);
    await loadFriends();
  };
  const removeFriend = async (f) => {
    await supabase.from("friendships").delete().eq("id", f.rowId);
    setRemoveConfirm(null);
    await loadFriends();
  };

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    const { data } = await supabase.from("profiles").select("id,name,avatar_url").ilike("name", `%${search.trim()}%`).limit(8);
    const results = (data || []).filter(p => p.id !== user?.id && !friends.some(f => f.id === p.id) && !pendingOut.some(f => f.id === p.id));
    setSearchResults(results);
    setSearching(false);
  };

  const sendRequest = async (target) => {
    if (sendingTo === target.id || sentTo[target.id]) return;
    setSendingTo(target.id);
    const { error } = await supabase.from("friendships").insert([{ requester: user.id, accepter: target.id, status: "pending" }]);
    if (!error) {
      setSentTo(prev => ({ ...prev, [target.id]: true }));
      const notifCh = supabase.channel(`friends_notif:${target.id}`);
      notifCh.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          notifCh.send({ type: "broadcast", event: "friend_request", payload: { fromId: user.id, fromName: user.name } })
            .finally(() => supabase.removeChannel(notifCh));
        }
      });
      setSearchResults(prev => prev.filter(p => p.id !== target.id));
    }
    setSendingTo(null);
  };

  const sendChallenge = (friend) => {
    if (challengeSent) return;
    setChallengeSent(friend.id);
    const ch = supabase.channel(`challenge:${friend.id}`);
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        ch.send({ type: "broadcast", event: "challenge", payload: { fromId: user.id, fromName: user.name, fromAvatar: user.avatarUrl } })
          .finally(() => supabase.removeChannel(ch));
      }
    });
    if (onChallenge) onChallenge(friend);
    setTimeout(() => setChallengeSent(null), 12000);
  };

  const rank = getRank(user?.rankedRating);
  const wins = user?.rankedWins || 0;
  const losses = user?.rankedLosses || 0;
  const winRate = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
  const gpCount = Object.entries(user?.collection || {}).filter(([,v]) => v > 0).length;

  return (
    <>
      <div style={{ position:"fixed", inset:0, zIndex:490 }} onClick={onClose} />
      <div style={{ position:"fixed", top:0, right:0, bottom:0, width:300, zIndex:500, background:"linear-gradient(180deg,#0f0d09 0%,#0a0806 100%)", borderLeft:"2px solid #2a2010", display:"flex", flexDirection:"column", boxShadow:"-12px 0 48px rgba(0,0,0,0.95)", animation:"slideInRight 0.22s ease-out", overflowY:"auto" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:"16px 16px 12px", borderBottom:"1px solid #1a1408", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#604030", letterSpacing:4, fontWeight:700 }}>PLAYER PROFILE</div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#604030", fontSize:18, padding:"2px 6px", lineHeight:1 }}>✕</button>
        </div>

        {/* Avatar + Identity */}
        <div style={{ padding:"20px 16px 16px", display:"flex", flexDirection:"column", alignItems:"center", borderBottom:"1px solid #1a1408", flexShrink:0 }}>
          <label style={{ position:"relative", cursor:"pointer", marginBottom:12 }}>
            <div style={{ width:84, height:84, borderRadius:"50%", overflow:"hidden", border:`3px solid ${rank.color}88`, background:"#1a1408", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',serif", fontSize:22, color:"#e8c060", boxShadow:`0 0 24px ${rank.color}44, 0 0 48px ${rank.color}22` }}>
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : (user.name||"?").slice(0,2).toUpperCase()}
            </div>
            <div style={{ position:"absolute", bottom:2, right:2, width:24, height:24, background:"#1a1408", border:`1px solid ${rank.color}66`, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, boxShadow:"0 2px 8px rgba(0,0,0,0.6)" }}>📷</div>
            <input type="file" accept="image/*" style={{ display:"none" }} onChange={async (e) => {
              const file = e.target.files[0]; if (!file) return;
              if (file.size > 2*1024*1024) { setAvatarErr("Must be under 2MB"); return; }
              const ext = file.name.split(".").pop().toLowerCase();
              const path = `avatars/${user.id}.${ext}`;
              const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert:true, contentType:file.type });
              if (upErr) { setAvatarErr("Upload failed"); return; }
              const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
              if (urlData?.publicUrl) { await onUpdateUser?.({ avatarUrl: urlData.publicUrl + "?t=" + Date.now() }); setAvatarErr(""); }
            }} />
          </label>
          {avatarErr && <div style={{ fontSize:9, color:"#e05050", marginBottom:4, fontFamily:"'Cinzel',serif" }}>{avatarErr}</div>}
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:19, fontWeight:900, color:"#f0d878", letterSpacing:1, marginBottom:5, textAlign:"center" }}>{user.name}</div>
          <div style={{ padding:"3px 12px", background:`${rank.color}18`, border:`1px solid ${rank.color}55`, borderRadius:10, fontSize:10, color:rank.color, fontFamily:"'Cinzel',serif", fontWeight:700, marginBottom:5, letterSpacing:1 }}>{rank.icon} {rank.name} · {user.rankedRating||1000} MMR</div>
          <button onClick={onShowPatchNotes} style={{ background:"none", border:"none", cursor:"pointer", color:"#e05050", fontFamily:"'Cinzel',serif", fontSize:9, letterSpacing:2, fontWeight:700 }}>📋 PATCH NOTES</button>
        </div>

        {/* Currency & Progress */}
        <div style={{ padding:"14px 16px", borderBottom:"1px solid #1a1408", flexShrink:0 }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#604030", letterSpacing:3, marginBottom:10, fontWeight:700 }}>LEVEL & PROGRESS</div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <div style={{ width:32, height:32, background:"linear-gradient(135deg,#e8c060,#a07820)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',serif", fontSize:13, fontWeight:900, color:"#1a1000", flexShrink:0, boxShadow:"0 0 12px #e8c06044" }}>{Math.floor((user.battlesPlayed||0)/10)+1}</div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{ fontFamily:"'Cinzel',serif", fontSize:8, color:"#907050", letterSpacing:1 }}>Level {Math.floor((user.battlesPlayed||0)/10)+1}</span>
                <span style={{ fontFamily:"'Cinzel',serif", fontSize:8, color:"#604030" }}>{(user.battlesPlayed||0)%10}/10 battles</span>
              </div>
              <div style={{ height:7, background:"rgba(255,255,255,0.06)", borderRadius:4, overflow:"hidden", border:"1px solid #2a1e08" }}>
                <div style={{ height:"100%", width:`${Math.min(100,((user.battlesPlayed||0)%10)*10)}%`, background:"linear-gradient(90deg,#c89010,#f0c040)", borderRadius:4, transition:"width .4s", boxShadow:"0 0 6px #e8c06066" }} />
              </div>
            </div>
          </div>
          <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid #2a2010", borderRadius:9, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:20, marginBottom:2 }}>⬙</div>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:19, fontWeight:900, color:"#a0b8c8", lineHeight:1, marginBottom:2 }}>{user?.shards||0}</div>
              <div style={{ fontSize:9, color:"#504028", letterSpacing:1, fontFamily:"'Cinzel',serif" }}>Shards</div>
            </div>
            <div style={{ flex:1, paddingLeft:16, borderLeft:"1px solid #2a2010", marginLeft:14 }}>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#907050", marginBottom:3 }}>{user.battlesPlayed||0} battles played</div>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#604030" }}>{(user.decks||[]).length} decks built</div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", borderBottom:"1px solid #1a1408", flexShrink:0 }}>
          {[["WIN%", winRate+"%", winRate>=50?"#78cc45":"#e8a020"], ["WINS", wins, "#78cc45"], ["LOSS", losses, "#e05050"], ["CARDS", gpCount, "#e8c060"]].map(([l,v,c],i) => (
            <div key={l} style={{ padding:"10px 4px", textAlign:"center", borderRight:i<3?"1px solid #1a1408":"none" }}>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:15, fontWeight:900, color:c, lineHeight:1 }}>{v}</div>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:7, color:"#504028", letterSpacing:1, marginTop:4 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Daily Quests */}
        {(() => {
          const dq = initDailyQuests(user?.dailyQuests);
          return (
            <div style={{ padding:"12px 16px 12px", borderBottom:"1px solid #1a1408", flexShrink:0 }}>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#604030", letterSpacing:3, marginBottom:10, fontWeight:700, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span>DAILY QUESTS</span>
                <span style={{ color:"#3a2010", fontSize:8 }}>RESETS DAILY</span>
              </div>
              {dq.quests.map(q => {
                const pct = Math.min(100, Math.round((q.progress / q.goal) * 100));
                return (
                  <div key={q.id} style={{ marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                      <span style={{ fontFamily:"'Cinzel',serif", fontSize:10, color: q.completed ? "#78cc45" : "#c0a060", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{q.completed ? "✓ " : ""}{q.label}</span>
                      <span style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#a0b8c8", flexShrink:0, marginLeft:6 }}>⬙ {q.reward}</span>
                    </div>
                    <div style={{ height:5, background:"rgba(255,255,255,0.05)", borderRadius:3, overflow:"hidden", border:"1px solid #1e1408" }}>
                      <div style={{ height:"100%", width:`${pct}%`, background: q.completed ? "linear-gradient(90deg,#50a030,#78cc45)" : "linear-gradient(90deg,#6a4010,#c89010)", borderRadius:3, transition:"width .5s" }} />
                    </div>
                    <div style={{ fontFamily:"'Cinzel',serif", fontSize:8, color:"#3a2810", marginTop:2, textAlign:"right" }}>{q.progress}/{q.goal}</div>
                  </div>
                );
              })}
            </div>
          );
        })()}
        {/* Add Friend Search — above friends list */}
        <div style={{ padding:"10px 16px 10px", borderBottom:"1px solid #1a1408", flexShrink:0 }}>
          <div style={{ display:"flex", gap:6, marginBottom:searchResults.length > 0 ? 8 : 0 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder="Find Friend..."
              style={{ flex:1, padding:"9px 12px", background:"rgba(255,255,255,0.04)", border:"1px solid #3a2010", borderRadius:9, color:"#f0e8d8", fontFamily:"'Cinzel',serif", fontSize:11, outline:"none" }}
            />
            <button onClick={doSearch} disabled={searching} style={{ padding:"9px 14px", background:"linear-gradient(135deg,#c89010,#f0c040)", border:"none", borderRadius:9, fontFamily:"'Cinzel',serif", fontSize:10, fontWeight:700, color:"#1a1000", cursor:"pointer", letterSpacing:1 }}>
              {searching ? "…" : "FIND"}
            </button>
          </div>
          {searchResults.map(p => (
            <div key={p.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", marginBottom:5, background:"rgba(255,255,255,0.02)", borderRadius:9, border:"1px solid #1a1408" }}>
              <div style={{ width:32, height:32, borderRadius:"50%", overflow:"hidden", background:"#1a1408", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#e8c060", flexShrink:0 }}>
                {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : (p.name||"?").slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex:1, fontFamily:"'Cinzel',serif", fontSize:12, color:"#d0b878", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div>
              <button onClick={() => sendRequest(p)} disabled={!!sentTo[p.id] || sendingTo === p.id} style={{ padding:"5px 12px", background:sentTo[p.id]?"rgba(120,200,69,0.1)":"rgba(232,192,96,0.1)", border:`1px solid ${sentTo[p.id]?"#78cc4555":"#e8c06055"}`, borderRadius:7, fontFamily:"'Cinzel',serif", fontSize:9, color:sentTo[p.id]?"#78cc45":"#e8c060", cursor:sentTo[p.id]?"default":"pointer", letterSpacing:1 }}>
                {sentTo[p.id] ? "SENT ✓" : sendingTo === p.id ? "…" : "ADD"}
              </button>
            </div>
          ))}
        </div>

        {/* Friends section */}
        <div style={{ padding:"14px 16px 6px", flexShrink:0 }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#604030", letterSpacing:3, marginBottom:10, fontWeight:700, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span>FRIENDS</span>
            <span style={{ color:"#403020", fontSize:12, fontWeight:900 }}>{friends.length}</span>
          </div>

          {/* Pending incoming requests */}
          {pendingIn.map(f => (
            <div key={f.rowId} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", marginBottom:5, background:"rgba(232,192,96,0.06)", border:"1px solid #3a2810", borderRadius:10 }}>
              <div style={{ width:34, height:34, borderRadius:"50%", overflow:"hidden", background:"#1a1408", border:"1px solid #4a3010", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#e8c060", fontFamily:"'Cinzel',serif", flexShrink:0 }}>
                {f.avatar_url ? <img src={f.avatar_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : (f.name||"?").slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:"'Cinzel',serif", fontSize:12, color:"#d0b878", fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</div>
                <div style={{ fontSize:9, color:"#e8c06088", fontFamily:"'Cinzel',serif" }}>Friend request</div>
              </div>
              <button onClick={() => acceptFriend(f)} style={{ width:28, height:28, background:"rgba(120,200,69,0.15)", border:"1px solid #78cc4555", borderRadius:6, fontFamily:"'Cinzel',serif", fontSize:13, color:"#78cc45", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✓</button>
              <button onClick={() => declineFriend(f)} style={{ width:28, height:28, background:"transparent", border:"1px solid #3a1010", borderRadius:6, fontFamily:"'Cinzel',serif", fontSize:13, color:"#e05050", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
            </div>
          ))}

          {/* Friend list */}
          {friends.length === 0 && pendingIn.length === 0 && (
            <div style={{ fontSize:11, color:"#3a2810", textAlign:"center", padding:"10px 0 4px", fontStyle:"italic", fontFamily:"'Lora',serif" }}>No friends yet — search below!</div>
          )}
          {friends.map(f => {
            const online = onlineIds.has(f.id);
            const challenged = challengeSent === f.id;
            return (
              <div key={f.rowId} style={{ marginBottom:5 }}>
                {removeConfirm?.rowId === f.rowId ? (
                  <div style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 10px", background:"rgba(180,20,20,0.08)", borderRadius:11, border:"1px solid #5a1010" }}>
                    <div style={{ flex:1, fontFamily:"'Cinzel',serif", fontSize:10, color:"#c07060" }}>Remove <strong style={{ color:"#e09070" }}>{f.name}</strong> as a friend?</div>
                    <button onClick={() => removeFriend(f)} style={{ padding:"4px 10px", background:"rgba(200,40,40,0.2)", border:"1px solid #a02020", borderRadius:6, fontFamily:"'Cinzel',serif", fontSize:9, color:"#e05050", cursor:"pointer", fontWeight:700 }}>YES</button>
                    <button onClick={() => setRemoveConfirm(null)} style={{ padding:"4px 10px", background:"transparent", border:"1px solid #2a1a0a", borderRadius:6, fontFamily:"'Cinzel',serif", fontSize:9, color:"#604030", cursor:"pointer" }}>NO</button>
                  </div>
                ) : (
                  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 10px", background:online?"rgba(120,200,69,0.04)":"rgba(255,255,255,0.015)", borderRadius:11, border:`1px solid ${online?"#78cc4522":"#1a1408"}`, transition:"all .3s" }}>
                    <div style={{ position:"relative", flexShrink:0 }}>
                      <div style={{ width:40, height:40, borderRadius:"50%", overflow:"hidden", background:"#1a1408", border:`2px solid ${online?"#78cc4566":"#2a1e0a"}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',serif", fontSize:13, color:"#e8c060", transition:"border-color .3s" }}>
                        {f.avatar_url ? <img src={f.avatar_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : (f.name||"?").slice(0,2).toUpperCase()}
                      </div>
                      <div style={{ position:"absolute", bottom:1, right:1, width:11, height:11, borderRadius:"50%", background:online?"#78cc45":"#503020", border:"2px solid #0a0806", boxShadow:online?"0 0 7px #78cc4588":"none", transition:"all .3s" }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"'Cinzel',serif", fontSize:13, color:"#d0b878", fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</div>
                      <div style={{ fontSize:9, color:online?"#78cc4599":"#503020", fontFamily:"'Cinzel',serif", letterSpacing:1 }}>{online ? "Online" : "Offline"}</div>
                    </div>
                    {online && (
                      <button onClick={() => sendChallenge(f)} disabled={!!challengeSent} title="Challenge to duel" style={{ width:32, height:32, background:challenged?"rgba(232,192,96,0.2)":"rgba(200,120,20,0.13)", border:`1px solid ${challenged?"#e8c060aa":"#5a3810"}`, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", cursor:challengeSent?"default":"pointer", fontSize:15, flexShrink:0, transition:"all .18s" }} onMouseEnter={e=>{if(!challengeSent){e.currentTarget.style.background="rgba(232,192,96,0.22)";e.currentTarget.style.borderColor="#c89010";}}} onMouseLeave={e=>{if(!challengeSent){e.currentTarget.style.background="rgba(200,120,20,0.13)";e.currentTarget.style.borderColor="#5a3810";}}}>
                        {challenged ? "⏳" : "⚔"}
                      </button>
                    )}
                    <button onClick={() => setRemoveConfirm(f)} title="Remove friend" style={{ width:24, height:24, background:"transparent", border:"none", borderRadius:5, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:12, color:"#3a2010", flexShrink:0, transition:"color .15s" }} onMouseEnter={e=>e.currentTarget.style.color="#a05040"} onMouseLeave={e=>e.currentTarget.style.color="#3a2010"}>✕</button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pending outgoing */}
          {pendingOut.length > 0 && (
            <div style={{ marginTop:4 }}>
              {pendingOut.map(f => (
                <div key={f.rowId} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", marginBottom:4, background:"rgba(255,255,255,0.02)", borderRadius:9, border:"1px solid #1a1408", opacity:0.7 }}>
                  <div style={{ width:30, height:30, borderRadius:"50%", overflow:"hidden", background:"#1a1408", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#e8c060", flexShrink:0 }}>
                    {f.avatar_url ? <img src={f.avatar_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : (f.name||"?").slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ flex:1, fontFamily:"'Cinzel',serif", fontSize:11, color:"#907050", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</div>
                  <div style={{ fontSize:8, color:"#604020", fontFamily:"'Cinzel',serif" }}>pending…</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Match History */}
        {(user?.matchHistory||[]).length > 0 && (
          <div style={{ padding:"10px 16px 10px", borderTop:"1px solid #1a1408", flexShrink:0 }}>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#604030", letterSpacing:3, marginBottom:8, fontWeight:700 }}>MATCH HISTORY</div>
            <div style={{ display:"flex", flexDirection:"column", gap:3, maxHeight:160, overflowY:"auto" }}>
              {(user.matchHistory||[]).slice(0,20).map((h,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", background:"rgba(255,255,255,0.02)", borderRadius:7, border:"1px solid #1a1408" }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:h.result==="W"?"#78cc45":"#e05050", flexShrink:0, boxShadow:h.result==="W"?"0 0 6px #78cc4566":"0 0 6px #e0505066" }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#d0b878", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.result==="W"?"W":"L"} · {h.opponent||"Unknown"}</div>
                    <div style={{ fontSize:8, color:"#504028", fontFamily:"'Cinzel',serif" }}>{h.ranked?"Ranked":"Casual"}{h.turns?" · "+h.turns+" turns":""}</div>
                  </div>
                  {h.ratingDelta != null && <div style={{ fontSize:9, fontFamily:"'Cinzel',serif", color:h.ratingDelta>=0?"#78cc45":"#e05050", flexShrink:0 }}>{h.ratingDelta>=0?"+":""}{h.ratingDelta}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin — alpha keys (tcombz / sncombz only) */}
        {(user?.name?.toLowerCase() === "tcombz" || user?.email === "sncombz@gmail.com" || user?.email === "tylercombz2@me.com") && (
          <div style={{ padding:"10px 16px 6px", borderTop:"1px solid #1a1408", flexShrink:0 }}>
            <AlphaKeyAdminPanel />
          </div>
        )}

        {/* Footer */}
        <div style={{ padding:"10px 16px 16px", borderTop:"1px solid #1a1408", marginTop:"auto", display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
          <button onClick={onLogout} style={{ width:"100%", padding:"9px", background:"rgba(160,20,20,0.1)", border:"1px solid #4a1010", borderRadius:8, color:"#a05040", fontFamily:"'Cinzel',serif", fontSize:10, cursor:"pointer", letterSpacing:1 }}>SIGN OUT</button>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [tab, setTab] = useState("home"); const { user, loading, login, logout, update, completeProfile } = useAuth(); const [showSidebar, setShowSidebar] = useState(false); const [onlineIds, setOnlineIds] = useState(new Set()); const [showPatchNotes, setShowPatchNotes] = useState(false); const [inPvpMatch, setInPvpMatch] = useState(false); const [navLeaveModal, setNavLeaveModal] = useState(null); const [avatarErr, setAvatarErr] = useState(""); const [navHovered, setNavHovered] = useState(false); const [matchActive, setMatchActive] = useState(false); const [histPopup, setHistPopup] = useState(null); const [deckBuilding, setDeckBuilding] = useState(false); // { targetTab }
  const [friendBadge, setFriendBadge] = useState(0);
  const [globalChallenge, setGlobalChallenge] = useState(null); // { fromId, fromName, fromAvatar }
  const [pendingDuel, setPendingDuel] = useState(null); // { matchId, opponentName, opponentId }
  const [declinedToast, setDeclinedToast] = useState(null); // name of player who declined
  const [isMobile] = useState(() => window.innerWidth < 900);
  const checkFs = () => !!(document.fullscreenElement || window.innerHeight === screen.height);
  const [isFullscreen, setIsFullscreen] = useState(checkFs);
  useEffect(() => {
    const update = () => setIsFullscreen(checkFs());
    document.addEventListener("fullscreenchange", update);
    window.addEventListener("resize", update);
    return () => { document.removeEventListener("fullscreenchange", update); window.removeEventListener("resize", update); };
  }, []); // eslint-disable-line
  const inBattle = matchActive;
  // Show patch notes once per account+device — triggers only when user logs in
  useEffect(() => {
    if (!user) return;
    const localKey = `patchSeen_${user.id}`;
    const localSeen = localStorage.getItem(localKey);
    if (localSeen === CURRENT_PATCH) return; // already dismissed this session/device
    if (user.lastPatchSeen !== CURRENT_PATCH) setShowPatchNotes(true);
  }, [user?.id]); // eslint-disable-line
  // App-level notification subscriptions — active regardless of current tab
  useEffect(() => {
    if (!user?.id) return;
    const presenceCh = supabase.channel("presence:forge_global", { config: { presence: { key: user.id } } });
    presenceCh.on("presence", { event: "sync" }, () => {
      const state = presenceCh.presenceState();
      setOnlineIds(new Set(Object.keys(state)));
    }).subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceCh.track({ user_id: user.id, name: user.name, online_at: new Date().toISOString() });
      }
    });
    const friendCh = supabase.channel(`friends_notif:${user.id}`)
      .on("broadcast", { event: "friend_request" }, () => setFriendBadge(p => p + 1))
      .subscribe();
    const challengeCh = supabase.channel(`challenge:${user.id}`)
      .on("broadcast", { event: "challenge" }, ({ payload }) => {
        setGlobalChallenge(payload);
        setFriendBadge(p => p + 1);
      })
      .on("broadcast", { event: "challenge_cancel" }, () => setGlobalChallenge(null))
      .on("broadcast", { event: "challenge_declined" }, ({ payload }) => {
        setDeclinedToast(payload?.declinerName || "Opponent");
        setTimeout(() => setDeclinedToast(null), 4000);
      })
      .on("broadcast", { event: "challenge_accepted" }, ({ payload }) => {
        setGlobalChallenge(null);
        setPendingDuel({ matchId: payload.matchId, opponentName: payload.accepterName, opponentId: null });
        setTab("play");
      })
      .subscribe();
    return () => { supabase.removeChannel(presenceCh); supabase.removeChannel(friendCh); supabase.removeChannel(challengeCh); };
  }, [user?.id]); // eslint-disable-line
  const acceptGlobalChallenge = async () => {
    if (!globalChallenge) return;
    const saved = globalChallenge;
    setGlobalChallenge(null);
    const { data: match, error } = await supabase.from("matches").insert([{
      player1_id: saved.fromId, player2_id: user.id,
      status: "active"
    }]).select().single();
    if (error || !match) { console.error("match insert failed:", error); return; }
    if (match) {
      const ch = supabase.channel(`challenge:${saved.fromId}`);
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          ch.send({ type: "broadcast", event: "challenge_accepted", payload: { matchId: match.id, accepterName: user.name } })
            .finally(() => supabase.removeChannel(ch));
        }
      });
      setPendingDuel({ matchId: match.id, opponentName: saved.fromName, opponentId: saved.fromId });
      setTab("play");
    }
  };
  if (loading) return (<div style={{ minHeight: "100vh", background: "#161210", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ fontFamily: "'Cinzel',serif", color: "#e8c060", fontSize: 16, letterSpacing: 4, animation: "pulse 1.5s ease-in-out infinite" }}>FORGING...</div></div>);
  return (<div style={{ minHeight: "100vh", background: "#161210", color: "#e8e0d0", fontFamily: "'Lora',Georgia,serif", overflowX: "hidden" }} onClick={() => setShowSidebar(false)}>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');
      html{zoom:1.25}
      @media(max-width:1280px){html{zoom:1}}
      @media(max-width:768px){html{zoom:1}}
      *{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#161210}::-webkit-scrollbar-thumb{background:#4a4022;border-radius:3px}select option{background:#1a1408}button{transition:all .18s}canvas{image-rendering:auto}
      @keyframes vfxShake{0%,100%{transform:translate(-50%,-50%)}25%{transform:translate(-55%,-45%)}75%{transform:translate(-45%,-55%)}}
      @keyframes vfxFloat{0%{opacity:1;transform:translate(-50%,-50%)}100%{opacity:0;transform:translate(-50%,-120%)}}
      @keyframes vfxPulse{0%{opacity:.8;transform:translate(-50%,-50%) scale(.5)}100%{opacity:0;transform:translate(-50%,-50%) scale(2)}}
      @keyframes vfxEnv{0%{opacity:0}30%{opacity:1}100%{opacity:0}}
      @keyframes fadeIn{0%{opacity:0;transform:translateY(10px)}100%{opacity:1;transform:translateY(0)}}
      @keyframes cardReveal{0%{opacity:0;transform:scale(.9) translateY(12px)}100%{opacity:1;transform:scale(1) translateY(0)}}
      @keyframes slideInLeft{0%{opacity:0;transform:translateX(-40px)}100%{opacity:1;transform:translateX(0)}}
      @keyframes slideInRight{0%{opacity:0;transform:translateX(40px)}100%{opacity:1;transform:translateX(0)}}
      @keyframes slideDown{0%{opacity:0;transform:translateY(-10px)}100%{opacity:1;transform:translateY(0)}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
      @keyframes turnBannerIn{0%{opacity:0;transform:translate(-50%,-50%) scale(0.7)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.05)}25%{transform:translate(-50%,-50%) scale(1)}75%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.1)}}
      @keyframes turnStamp{0%{opacity:0;transform:scale(1.4)}8%{opacity:1;transform:scale(0.94)}16%{transform:scale(1.02)}22%{transform:scale(1)}70%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.05)}}
      @keyframes cardDie{0%{opacity:1;transform:scale(1) rotate(0deg);filter:brightness(1)}12%{opacity:1;transform:scale(1.08) rotate(2deg);filter:brightness(2.8) saturate(0.4)}28%{opacity:.8;transform:scale(0.9) rotate(-10deg) translateY(6px);filter:brightness(0.7) blur(1px)}55%{opacity:.4;transform:scale(0.68) rotate(-24deg) translateY(22px);filter:brightness(0.3) blur(2.5px)}100%{opacity:0;transform:scale(0.3) rotate(-45deg) translateY(50px);filter:brightness(0) blur(5px)}}
      @keyframes cardSummon{0%{opacity:0;transform:translateY(48px) scale(0.82)}60%{opacity:1;transform:translateY(-6px) scale(1.04)}100%{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes spellCast{0%{opacity:0;transform:translate(-50%,-50%) scale(0.4)}30%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}70%{opacity:.9;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.4)}}
      @keyframes envFlash{0%{opacity:0}20%{opacity:1}80%{opacity:.8}100%{opacity:0}}
      @keyframes prismaticPop{0%{transform:scale(1);filter:brightness(1)}25%{transform:scale(1.12);filter:brightness(2.5) hue-rotate(60deg)}60%{transform:scale(1.05);filter:brightness(1.8) hue-rotate(120deg)}100%{transform:scale(1);filter:brightness(1)}}
      @keyframes foilShimmer{0%{background-position:200% center}100%{background-position:-200% center}}
      @keyframes prismShimmer{0%{background-position:0% 50%;filter:hue-rotate(0deg) brightness(1.2)}50%{background-position:100% 50%;filter:hue-rotate(180deg) brightness(1.5)}100%{background-position:0% 50%;filter:hue-rotate(360deg) brightness(1.2)}}
      @keyframes prismPulse{0%,100%{box-shadow:0 0 18px #ff808088,0 0 36px #8080ff66,0 0 54px #80ff8044}33%{box-shadow:0 0 18px #80ff8088,0 0 36px #ff808066,0 0 54px #8080ff44}66%{box-shadow:0 0 18px #8080ff88,0 0 36px #80ff8066,0 0 54px #ff808044}}
      @keyframes nebulaDrift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
      @keyframes tickerScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
      @keyframes battleGlow{0%,100%{box-shadow:0 6px 28px rgba(200,30,30,0.5),0 0 40px rgba(200,30,30,0.2)}50%{box-shadow:0 6px 40px rgba(255,50,60,0.75),0 0 64px rgba(220,30,30,0.45),0 0 90px rgba(200,0,0,0.2)}}
      @keyframes lightningReady{0%,100%{box-shadow:0 0 22px rgba(240,200,0,0.35),inset 0 0 10px rgba(240,200,0,0.07);border-color:rgba(240,200,0,0.7)}50%{box-shadow:0 0 40px rgba(255,220,0,0.65),0 0 70px rgba(240,160,0,0.3),inset 0 0 18px rgba(240,200,0,0.12);border-color:rgba(255,230,0,1)}}
      @keyframes starTwinkle{0%,100%{opacity:0.2}50%{opacity:0.9}}
      @keyframes floatBadge{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      @keyframes deckCardShake{0%{transform:translateX(0) rotate(0deg)}15%{transform:translateX(-7px) rotate(-2deg)}30%{transform:translateX(7px) rotate(2deg)}45%{transform:translateX(-5px) rotate(-1deg)}60%{transform:translateX(5px) rotate(1deg)}75%{transform:translateX(-3px)}90%{transform:translateX(2px)}100%{transform:translateX(0) rotate(0deg)}}
      @keyframes shieldPulse{0%,100%{opacity:0.7;box-shadow:0 0 10px #60a0ff44,inset 0 0 8px #4080c033}50%{opacity:1;box-shadow:0 0 20px #60a0ff99,inset 0 0 16px #4080c066}}
      @keyframes dupeToast{0%{opacity:0;transform:translateY(20px) scale(0.8)}15%{opacity:1;transform:translateY(0) scale(1)}75%{opacity:1}100%{opacity:0;transform:translateY(-30px) scale(0.9)}}
      @keyframes vfxHitFlash{0%{opacity:0}10%{opacity:1}100%{opacity:0}}
      @keyframes vfxHealFlash{0%{opacity:0}15%{opacity:1}60%{opacity:.7}100%{opacity:0}}
      @keyframes vfxRingBurst{0%{opacity:0.9;transform:translate(-50%,-50%) scale(0.1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}
      @keyframes vfxSpellFlash{0%{opacity:0}15%{opacity:1}100%{opacity:0}}
      @keyframes cardLunge{0%{transform:translateY(0) scale(1)}30%{transform:translateY(-44px) scale(1.1) rotate(-3deg)}55%{transform:translateY(-36px) scale(1.06) rotate(-1deg)}100%{transform:translateY(0) scale(1) rotate(0deg)}}
      @keyframes cardLungeDown{0%{transform:translateY(0) scale(1)}30%{transform:translateY(44px) scale(1.1) rotate(3deg)}55%{transform:translateY(36px) scale(1.06) rotate(1deg)}100%{transform:translateY(0) scale(1) rotate(0deg)}}
      @keyframes coinSpin{0%{transform:rotateY(0deg);opacity:1}40%{transform:rotateY(720deg)}70%{transform:rotateY(1260deg)}100%{transform:rotateY(1440deg)}}
      @keyframes cardHit{0%{transform:translate(0,0) rotate(0deg);filter:none}8%{transform:translate(-14px,6px) rotate(-4deg);filter:brightness(5) saturate(0) drop-shadow(0 0 18px #ff1010)}22%{transform:translate(12px,5px) rotate(3deg);filter:brightness(3.5) saturate(0.1) drop-shadow(0 0 12px #ff2020)}40%{transform:translate(-8px,3px) rotate(-2deg);filter:brightness(2.5) drop-shadow(0 0 8px #ff3030)}58%{transform:translate(6px,1px) rotate(1deg);filter:brightness(1.8)}75%{transform:translate(-4px,0) rotate(0deg);filter:brightness(1.2)}100%{transform:translate(0,0) rotate(0deg);filter:none}}
      @media(prefers-reduced-motion:reduce){*{animation-duration:0.01ms!important;transition-duration:0.01ms!important}}
      @supports(-webkit-backdrop-filter:blur(0px)){nav{-webkit-backdrop-filter:blur(10px)!important;backdrop-filter:blur(10px)!important}}
      @media(max-width:768px){
        nav{height:56px!important;padding:0 2px!important;overflow-x:auto!important;overflow-y:hidden!important;flex-wrap:nowrap!important;scrollbar-width:none!important}
        nav::-webkit-scrollbar{display:none!important}
        nav button{padding:4px 8px!important;min-width:40px!important;flex-shrink:0!important}
        nav button span:first-child{font-size:15px!important}
        h1{font-size:36px!important}
        h2{font-size:20px!important}
        .home-grid{grid-template-columns:1fr!important;gap:24px!important}
        .battle-grid{grid-template-columns:1fr!important}
        .battle-side{display:none!important}
        .battle-log{display:none!important}
        .battle-wrapper{height:calc(100vh - 56px)!important}
        .hand-row{overflow-x:auto!important;flex-wrap:nowrap!important;padding-bottom:8px!important;justify-content:flex-start!important}
        .token{width:88px!important;height:118px!important}
        .board-row{overflow-x:auto!important;flex-wrap:nowrap!important;justify-content:flex-start!important}
        .nav-labels{display:none!important}
      }
      @media(max-width:640px){
        section>div{grid-template-columns:1fr!important}
        .pack-grid{grid-template-columns:repeat(2,1fr)!important}
      }
      /* Raised gold text — white top highlight + deep drop shadow on all Cinzel elements */
      [style*="Cinzel"]{text-shadow:0 -1px 0 rgba(255,255,255,0.22),0 1px 0 rgba(0,0,0,0.65),0 2px 6px rgba(0,0,0,0.88);}
    `}</style>
    {isMobile && (
      <div style={{ position:"fixed", inset:0, zIndex:9999, background:"linear-gradient(160deg,#0a0806,#0e0c08)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32, textAlign:"center" }}>
        <div style={{ fontSize:64, marginBottom:20, lineHeight:1 }}>⚔</div>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:900, color:"#e8c060", letterSpacing:4, marginBottom:12 }}>FORGE & FABLE</div>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:12, color:"#c08040", letterSpacing:2, marginBottom:20 }}>BEST EXPERIENCED ON DESKTOP</div>
        <div style={{ maxWidth:320, fontFamily:"'Lora',serif", fontSize:13, color:"#907060", lineHeight:1.8, marginBottom:28 }}>
          The battle board requires a wider screen for the full experience. Open this page on a laptop or desktop to play.
        </div>
        <div style={{ width:60, height:2, background:"linear-gradient(90deg,transparent,#e8c06066,transparent)", marginBottom:24 }} />
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#503020", letterSpacing:3 }}>MOBILE SUPPORT COMING SOON</div>
      </div>
    )}
    {!user && !loading && <ForgeAndFableTeaser />}
    {(!user || user.__needsProfile) && <LoginModal needsProfile={!!user?.__needsProfile} userId={user?.id} userEmail={user?.email} onSignOut={logout} onProfileCreated={completeProfile} />}
    {user && showPatchNotes && <PatchNotesModal onDismiss={() => { localStorage.setItem(`patchSeen_${user.id}`, CURRENT_PATCH); update({ lastPatchSeen: CURRENT_PATCH }); setShowPatchNotes(false); }} />}
    {globalChallenge && (
      <div style={{ position:"fixed", inset:0, zIndex:700, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ background:"linear-gradient(160deg,#1a1208,#0e0a04)", border:"2px solid #e8c060aa", borderRadius:18, padding:"36px 44px", textAlign:"center", maxWidth:340, animation:"fadeIn 0.3s" }}>
          <div style={{ fontSize:48, marginBottom:12 }}>⚔️</div>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:20, fontWeight:900, color:"#e8c060", marginBottom:6, letterSpacing:1 }}>CHALLENGE!</div>
          <div style={{ fontSize:14, color:"#d0c098", marginBottom:24 }}><span style={{ color:"#f0e0a0", fontWeight:700 }}>{globalChallenge.fromName}</span> challenges you to a duel!</div>
          <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
            <button onClick={acceptGlobalChallenge} style={{ padding:"12px 28px", background:"linear-gradient(135deg,#c89010,#f0c040)", border:"none", borderRadius:10, fontFamily:"'Cinzel',serif", fontSize:13, fontWeight:700, color:"#1a1000", cursor:"pointer", letterSpacing:1 }}>ACCEPT</button>
            <button onClick={() => {
              const ch = supabase.channel(`challenge:${globalChallenge.fromId}`);
              ch.subscribe((status) => {
                if (status === "SUBSCRIBED") {
                  ch.send({ type:"broadcast", event:"challenge_declined", payload:{ declinerName: user.name } })
                    .finally(() => supabase.removeChannel(ch));
                }
              });
              setGlobalChallenge(null);
            }} style={{ padding:"12px 20px", background:"transparent", border:"1px solid #4a2010", borderRadius:10, fontFamily:"'Cinzel',serif", fontSize:12, color:"#806040", cursor:"pointer" }}>DECLINE</button>
          </div>
        </div>
      </div>
    )}
    {/* Fullscreen nudge — shown in battle when not fullscreen */}
    {inBattle && !isFullscreen && (
      <div style={{ position:"fixed", right:20, bottom:80, zIndex:350, background:"linear-gradient(160deg,#141008,#1e1a0a)", border:"1px solid #e8c06055", borderRadius:14, padding:"16px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:8, boxShadow:"0 8px 32px rgba(0,0,0,0.9), 0 0 0 1px #e8c06022", animation:"fadeIn 0.35s ease-out", pointerEvents:"none", minWidth:180, textAlign:"center" }}>
        <span style={{ fontSize:32, lineHeight:1, filter:"drop-shadow(0 0 8px #e8c06066)" }}>⛶</span>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:11, fontWeight:700, color:"#e8c060", letterSpacing:1, lineHeight:1.5 }}>FULL SCREEN<br/>RECOMMENDED</div>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#806040", letterSpacing:1 }}>Press <strong style={{ color:"#c0a050" }}>F11</strong> for the best experience</div>
      </div>
    )}
    {/* Match declined toast */}
    {declinedToast && (
      <div style={{ position:"fixed", top:88, right:20, zIndex:800, background:"linear-gradient(135deg,#1a0808,#2a0e0e)", border:"1px solid #c04040aa", borderRadius:12, padding:"12px 18px", display:"flex", alignItems:"center", gap:10, boxShadow:"0 8px 32px rgba(0,0,0,0.9), 0 0 0 1px #8a202055", animation:"slideInRight 0.25s ease-out", pointerEvents:"none" }}>
        <span style={{ fontSize:20 }}>🚫</span>
        <div>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:12, fontWeight:700, color:"#e05050", letterSpacing:1 }}>MATCH DECLINED</div>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#a06060", marginTop:2 }}>{declinedToast} declined your challenge</div>
        </div>
      </div>
    )}
    {/* Floating Discord badge — hidden while deck builder is open */}
    {!deckBuilding && <a href="https://discord.gg/RrjBaN8Akk" target="_blank" rel="noopener noreferrer" style={{ position:"fixed", bottom:20, left:20, zIndex:9999, display:"flex", alignItems:"center", gap:8, padding:"10px 16px", background:"linear-gradient(135deg,#4752c4,#5865F2)", border:"1px solid #7289daaa", borderRadius:28, color:"#fff", fontFamily:"'Cinzel',serif", fontSize:11, fontWeight:700, letterSpacing:1, textDecoration:"none", boxShadow:"0 4px 24px rgba(88,101,242,0.5), 0 2px 8px rgba(0,0,0,0.6)", transition:"all .2s", userSelect:"none" }} onMouseEnter={(e)=>{e.currentTarget.style.transform="translateY(-3px) scale(1.04)";e.currentTarget.style.boxShadow="0 8px 32px rgba(88,101,242,0.7), 0 2px 8px rgba(0,0,0,0.6)";}} onMouseLeave={(e)=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 4px 24px rgba(88,101,242,0.5), 0 2px 8px rgba(0,0,0,0.6)";}}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
      JOIN DISCORD
    </a>}
    {/* Nav leave warning — shows instead of window.confirm when leaving active PvP */}
    {navLeaveModal && (<div style={{ position:"fixed", inset:0, zIndex:700, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={()=>setNavLeaveModal(null)}>
      <div style={{ background:"linear-gradient(160deg,#1c140a,#100c06)", border:"1px solid #b84020", borderRadius:16, padding:"32px 40px", textAlign:"center", maxWidth:340, boxShadow:"0 30px 80px rgba(0,0,0,0.98)", animation:"fadeIn 0.2s ease-out" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:40, marginBottom:10 }}>⚔️</div>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:18, fontWeight:700, color:"#e8c060", marginBottom:8, letterSpacing:1 }}>LEAVE BATTLE?</div>
        <p style={{ fontSize:12, color:"#a09070", lineHeight:1.6, marginBottom:24 }}>You have an active PvP match. Leaving now counts as a <span style={{ color:"#e84040", fontWeight:700 }}>forfeit</span>. Your opponent wins.</p>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={()=>setNavLeaveModal(null)} style={{ padding:"10px 22px", background:"linear-gradient(135deg,#1a3010,#2a4a18)", border:"1px solid #78cc4566", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:11, color:"#78cc45", cursor:"pointer", fontWeight:700, letterSpacing:1 }}>STAY & FIGHT</button>
          <button onClick={()=>{ pvpForfeitRef.current?.(); setInPvpMatch(false); setTab(navLeaveModal.targetTab); setNavLeaveModal(null); }} style={{ padding:"10px 22px", background:"linear-gradient(135deg,#3a0808,#5a1010)", border:"1px solid #c0202055", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:11, color:"#e06060", cursor:"pointer", fontWeight:700, letterSpacing:1 }}>FORFEIT & LEAVE</button>
        </div>
      </div>
    </div>)}
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at 15% 15%,rgba(200,140,20,0.11) 0%,transparent 50%),radial-gradient(ellipse at 85% 85%,rgba(30,120,200,0.08) 0%,transparent 50%)" }} />

    <nav style={{ position: "sticky", width: "100%", top: 0, zIndex: 100, background: "linear-gradient(180deg,#221e12 0%,#181408 100%)", borderBottom: "2px solid #4a3c18", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 72, boxShadow: "0 4px 24px rgba(0,0,0,0.5)", overflow: "hidden", WebkitFontSmoothing: "antialiased" }} onClick={(e) => { e.stopPropagation(); }}>
      <button onClick={() => { if (inPvpMatch) { setNavLeaveModal({ targetTab:"home" }); return; } setTab("home"); }} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg,#e8c060,#a07820)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cinzel',serif", fontSize: 16, fontWeight: 900, color: "#1a1000", boxShadow: "0 2px 12px #e8c06044" }}>F</div>
        <div>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 16, fontWeight: 900, color: "#e8c060", lineHeight: 1, letterSpacing: 1 }}>Forge {"&"} Fable</div>
          <div style={{ fontSize: 8, color: "#6a5028", letterSpacing: 3, fontFamily: "'Cinzel',serif", marginTop: 3 }}>{CURRENT_PATCH} · ALPHA</div>
        </div>
      </button>
      <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
        {NAV.map((t) => {
          const active = tab === t.id;
          const locked = inPvpMatch && t.id !== "play";
          return (
            <button key={t.id} onClick={() => {
              if (locked) { setNavLeaveModal({ targetTab: t.id }); return; }
              setTab(t.id);
            }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 16px", gap: 4, background: active ? "linear-gradient(180deg,rgba(232,192,96,0.18) 0%,rgba(232,192,96,0.06) 100%)" : "transparent", border: "none", borderBottom: active ? "3px solid #e8c060" : "3px solid transparent", cursor: "pointer", minWidth: 68, transition: "all .18s", position: "relative", opacity: locked ? 0.45 : 1 }}
>
              <span style={{ position: "relative", fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 900, color: active ? "#e8c060" : "#b09458", lineHeight: 1, textShadow: active ? "0 0 20px #e8c06088" : "none", transition: "all .18s" }}>
                {t.icon}
              </span>
              <span className="nav-labels" style={{ fontFamily: "'Cinzel',serif", fontSize: 10, fontWeight: 700, color: active ? "#e8c060" : "#a08858", letterSpacing: 1, lineHeight: 1, transition: "all .18s" }}>{t.label}</span>
            </button>
          );
        })}
      </div>
      {user && (<div style={{ position: "relative", flexShrink: 0, display:"flex", alignItems:"center", gap:14 }}>
        <a href="https://discord.gg/RrjBaN8Akk" target="_blank" rel="noopener noreferrer" title="Join our Discord" style={{ display:"flex", alignItems:"center", justifyContent:"center", width:34, height:34, borderRadius:8, background:"rgba(88,101,242,0.18)", border:"1px solid #5865F255", color:"#8b9bff", flexShrink:0, transition:"all .18s", textDecoration:"none" }} onMouseEnter={(e)=>{e.currentTarget.style.background="rgba(88,101,242,0.35)";e.currentTarget.style.color="#fff";}} onMouseLeave={(e)=>{e.currentTarget.style.background="rgba(88,101,242,0.18)";e.currentTarget.style.color="#8b9bff";}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
        </a>
        <button onClick={(e) => { e.stopPropagation(); setShowSidebar((p) => !p); }} style={{ background:"none", border:"2px solid #e8c06044", borderRadius:"50%", padding:0, cursor:"pointer", width:36, height:36, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',serif", fontSize:10, fontWeight:700, color:"#e8c060" }}>{user.avatarUrl ? <img src={user.avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : (user.name||"?").slice(0,2).toUpperCase()}</button>
        {friendBadge > 0 && <span style={{ position:"absolute", top:-4, right:-4, minWidth:18, height:18, borderRadius:9, background:"#e04040", border:"2px solid #181408", animation:"pulse 1.2s ease-in-out infinite", boxShadow:"0 0 8px #e0404088", pointerEvents:"none", zIndex:10, fontFamily:"'Cinzel',serif", fontSize:9, fontWeight:900, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", padding:"0 4px", lineHeight:1 }}>{friendBadge > 9 ? "9+" : friendBadge}</span>}
      </div>)}
    </nav>
    {/* Profile popup — rendered OUTSIDE nav to avoid backdropFilter/overflow:hidden clipping */}
    {showSidebar && user && (
      <PlayerSidebar
        user={user}
        onUpdateUser={update}
        onlineIds={onlineIds}
        onClose={() => { setShowSidebar(false); setFriendBadge(0); }}
        onChallenge={() => {}}
        onLogout={() => { logout(); setShowSidebar(false); }}
        onShowPatchNotes={() => { localStorage.removeItem(`patchSeen_${user.id}`); update({ lastPatchSeen: null }); setShowPatchNotes(true); setShowSidebar(false); }}
      />
    )}
    {histPopup && (<>
      <div style={{ position:"fixed", inset:0, zIndex:510 }} onClick={()=>setHistPopup(null)}/>
      <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:520, background:"#0e0c08", border:"1px solid #3a2a10", borderRadius:16, padding:"24px 28px", minWidth:230, textAlign:"center", boxShadow:"0 24px 60px rgba(0,0,0,0.98)", animation:"fadeIn 0.2s ease-out" }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:64, height:64, borderRadius:"50%", overflow:"hidden", margin:"0 auto 12px", border:"2px solid #e8c06044", background:"#1a1408", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',serif", fontSize:22, color:"#e8c060" }}>
          {histPopup.opponentAvatar ? <img src={histPopup.opponentAvatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : (histPopup.opponent||"?").slice(0,2).toUpperCase()}
        </div>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:16, fontWeight:700, color:"#f0d878", marginBottom:4 }}>{histPopup.opponent||"Unknown"}</div>
        <div style={{ fontSize:9, color:"#806040", fontFamily:"'Cinzel',serif", letterSpacing:2, marginBottom:14 }}>{histPopup.ranked ? "RANKED MATCH" : "CASUAL MATCH"}</div>
        <div style={{ display:"flex", gap:0, justifyContent:"center", background:"rgba(255,255,255,0.03)", borderRadius:8, overflow:"hidden", border:"1px solid #2a2010", marginBottom:16 }}>
          {[["RESULT", histPopup.result==="W"?"WIN":histPopup.result==="FF"?"FF":"LOSS", histPopup.result==="W"?"#78cc45":histPopup.result==="FF"?"#e8a020":"#e05050"], ["TURNS", (histPopup.turns||0)+" T", "#e8c060"], ["DATE", histPopup.date?new Date(histPopup.date).toLocaleDateString():"—", "#a09070"]].map(([l,v,c],i)=>(
            <div key={l} style={{ flex:1, padding:"10px 6px", borderRight:i<2?"1px solid #2a2010":"none" }}>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:13, fontWeight:700, color:c, lineHeight:1, marginBottom:3 }}>{v}</div>
              <div style={{ fontSize:7, color:"#604030", letterSpacing:2, fontFamily:"'Cinzel',serif" }}>{l}</div>
            </div>
          ))}
        </div>
        {histPopup.ranked && histPopup.ratingDelta != null && <div style={{ fontSize:10, color:histPopup.ratingDelta>=0?"#78cc45":"#e05050", fontFamily:"'Cinzel',serif", marginBottom:14 }}>{histPopup.ratingDelta>=0?"+":""}{histPopup.ratingDelta} MMR</div>}
        <button onClick={()=>setHistPopup(null)} style={{ padding:"6px 22px", background:"transparent", border:"1px solid #3a2810", borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:9, color:"#806040", cursor:"pointer", letterSpacing:1 }}>CLOSE</button>
      </div>
    </>)}
    <div style={{ position: "relative", paddingTop: inBattle ? 4 : 0 }} onClick={() => setShowSidebar(false)}>
      {tab === "home" && <HomeScreen setTab={setTab} user={user} />}
      {tab === "play" && <GameTab user={user} onUpdateUser={update} setInPvpMatch={setInPvpMatch} setMatchActive={setMatchActive} pendingDuel={pendingDuel} clearPendingDuel={() => setPendingDuel(null)} />}
      {tab === "store" && <StoreScreen user={user} onUpdateUser={update} />}
      {tab === "collection" && <CollectionScreen user={user} onUpdateUser={update} onDeckBuilding={setDeckBuilding} />}
      {tab === "community" && <CommunityScreen user={user} />}
      {!inBattle && <footer style={{ borderTop: "1px solid #1e1a0e", padding: 22, textAlign: "center" }}><div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 700, color: "#40301a" }}>Forge {"&"} Fable</div><p style={{ fontSize: 9, color: "#30280e", margin: "4px 0 0", letterSpacing: 1 }}>{CURRENT_PATCH}: FABLES CARDS LIVE · ZEUS LIGHTNING METER · HADES SOUL HARVEST · CERBERUS WHELP · MEDUSA'S GAZE</p></footer>}
    </div>
    <MusicPlayer />
  </div>);
}
