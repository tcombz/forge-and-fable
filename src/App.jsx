import { useState, useEffect, useRef, useCallback } from "react";

// ═══ STORAGE ═════════════════════════════════════════════════════════════════
const store = {
  get: async (k) => { try { if (window.storage) return await window.storage.get(k); return null; } catch (e) { return null; } },
  set: async (k, v) => { try { if (window.storage) { await window.storage.set(k, v); return true; } return false; } catch (e) { return false; } },
  del: async (k) => { try { if (window.storage) { await window.storage.delete(k); return true; } return false; } catch (e) { return false; } }
};

// ═══ ALPHA KEYS ══════════════════════════════════════════════════════════════
const ALPHA_KEYS = new Set(["VELRUN-ASCENDS","WOLF-RUNS-FREE","TIDE-CALLS-YOU","ECHO-WISP-RISE","IRON-HOLDS-ALL","ASH-AND-EMBER","SUN-VEILED-ONE","BLOOD-IS-PAID","RIFT-HERALD-01","RIFT-HERALD-02","RIFT-HERALD-03","RIFT-HERALD-04","THORNWOOD-001","THORNWOOD-002","THORNWOOD-003","THORNWOOD-004","FORGE-FOUNDER","AZURE-DEEP-01","VOID-STALKER-1","ALPHA-KEY-0001"]);

// ═══ AUDIO ═══════════════════════════════════════════════════════════════════
const SFX = (() => {
  let ctx = null;
  const init = () => { if (!ctx) try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} return ctx; };
  const tone = (f, type, vol, t0, dur) => {
    const c = init(); if (!c) return; if (c.state === "suspended") c.resume();
    try { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, c.currentTime + t0); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t0 + dur); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.05); } catch (e) {}
  };
  return {
    init,
    play(t) {
      switch (t) {
        case "card": tone(280,"sine",0.12,0,0.1); tone(560,"sine",0.06,0.07,0.12); break;
        case "attack": tone(110,"sawtooth",0.06,0.02,0.14); tone(80,"square",0.03,0,0.08); break;
        case "kill": [220,170,130].forEach((f,i) => tone(f,"sawtooth",0.06,i*0.09,0.22)); break;
        case "victory": [400,500,600,500,800].forEach((f,i) => tone(f,"sine",0.08,i*0.13,0.3)); break;
        case "defeat": [350,280,200].forEach((f,i) => tone(f,"sine",0.08,i*0.22,0.38)); break;
        case "draw": tone(400,"sine",0.05,0,0.08); break;
        case "ability": [440,660,880].forEach((f,i) => tone(f,"sine",0.07,i*0.06,0.15)); break;
        case "pack_open": [200,300,400,500,600,800].forEach((f,i) => tone(f,"triangle",0.06,i*0.08,0.3)); break;
        case "rare_reveal": [400,600,800,1000,1200].forEach((f,i) => tone(f,"sine",0.1,i*0.1,0.4)); break;
        case "flip": tone(500,"sine",0.05,0,0.08); tone(700,"sine",0.03,0.05,0.06); break;
        case "timer_warn": tone(800,"square",0.08,0,0.1); tone(800,"square",0.08,0.2,0.1); break;
        case "timer_end": [600,400,200].forEach((f,i) => tone(f,"sawtooth",0.1,i*0.1,0.2)); break;
        case "env_play": [200,300,250,400,500].forEach((f,i) => tone(f,"sine",0.06,i*0.12,0.4)); break;
      }
    }
  };
})();

// ═══ CONFIG ══════════════════════════════════════════════════════════════════
const CFG = { startHP: 20, startHand: 3, maxHand: 7, maxBoard: 5, startEnergy: 2, maxEnergy: 7, turnTimer: 45, deck: { min: 15, max: 25, maxLeg: 2, copies: { Common: 2, Uncommon: 2, Rare: 1, Epic: 1, Legendary: 1 } } };

// ═══ CONSTANTS ═══════════════════════════════════════════════════════════════
const RC = { Common: "#8a8a7a", Uncommon: "#c0922a", Rare: "#5090ff", Epic: "#a860d8", Legendary: "#f0b818" };
const KW = [
  { name: "Swift", icon: "\u26A1", color: "#5a9a28", desc: "Attacks the turn it's played" },
  { name: "Fracture", icon: "\u2727", color: "#a060d0", desc: "A Fragment copy enters alongside" },
  { name: "Echo", icon: "\u2941", color: "#28a0cc", desc: "A free 1/1 ghost replays next turn" },
  { name: "Bleed", icon: "\u2620", color: "#d04040", desc: "Stacking damage each turn" },
  { name: "Resonate", icon: "\u25C8", color: "#c88020", desc: "+1 ATK per card in enemy hand" },
  { name: "Anchor", icon: "\u2693", color: "#80b0e0", desc: "Cannot be removed or rewound" },
  { name: "Shield", icon: "\u2666", color: "#60a0d0", desc: "Blocks the first hit taken" },
];
const REGIONS = ["Thornwood", "Shattered Expanse", "Azure Deep", "Ashfen", "Ironmarch", "Sunveil"];
const GLOW = { Thornwood: "#70ff30", "Shattered Expanse": "#c090ff", "Azure Deep": "#30d0ff", Ashfen: "#ff6820", Ironmarch: "#9090ff", Sunveil: "#ffd030", Bloodpact: "#ff2848" };
const ENV_THEMES = {
  Thornwood: { bg: "linear-gradient(180deg,#040e02 0%,#0a1a06 40%,#081808 100%)", particle: "#60ff30", glow: "#40a020" },
  "Shattered Expanse": { bg: "linear-gradient(180deg,#06001a 0%,#0c0030 40%,#080020 100%)", particle: "#c080ff", glow: "#8040d0" },
  "Azure Deep": { bg: "linear-gradient(180deg,#010818 0%,#041030 40%,#030828 100%)", particle: "#40c0ff", glow: "#2080c0" },
  Ashfen: { bg: "linear-gradient(180deg,#180400 0%,#2a0800 40%,#1a0400 100%)", particle: "#ff6020", glow: "#c04010" },
  Ironmarch: { bg: "linear-gradient(180deg,#04040a 0%,#0a0a18 40%,#060614 100%)", particle: "#8888ff", glow: "#5050a0" },
  Sunveil: { bg: "linear-gradient(180deg,#140a00 0%,#221400 40%,#180c00 100%)", particle: "#ffc020", glow: "#b08010" },
  Bloodpact: { bg: "linear-gradient(180deg,#100004 0%,#1c000a 40%,#120006 100%)", particle: "#ff2040", glow: "#a01020" },
};
const hpCol = (h) => (h > 12 ? "#50c060" : h > 6 ? "#d8b040" : "#d84040");
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
function getStarterCollection() { const c = {}; POOL.forEach((x) => { c[x.id] = x.rarity === "Common" ? 2 : x.rarity === "Uncommon" ? 1 : 0; }); return c; }

// ═══ FLOATING PARTICLES ══════════════════════════════════════════════════════
function FloatingParticles({ count = 30, color = "#e8c06015", speed = 1 }) {
  const ref = useRef(null);
  const particles = useRef([]);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    const W = c.width = c.offsetWidth;
    const H = c.height = c.offsetHeight;
    if (particles.current.length === 0) {
      for (let i = 0; i < count; i++) particles.current.push({ x: Math.random() * W, y: Math.random() * H, r: 0.5 + Math.random() * 2, vx: (Math.random() - 0.5) * 0.3 * speed, vy: -0.2 - Math.random() * 0.5 * speed, a: 0.1 + Math.random() * 0.4 });
    }
    let af;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      particles.current.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, PI * 2);
        ctx.fillStyle = color.replace(/[\d.]+\)$/, `${p.a})`).replace(/[0-9a-f]{2}$/i, Math.round(p.a * 255).toString(16).padStart(2, "0"));
        ctx.fill();
      });
      af = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(af);
  }, [count, color, speed]);
  return (<canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />);
}

// ═══ VFX ═════════════════════════════════════════════════════════════════════
function useVFX() {
  const [effects, setEffects] = useState([]);
  const add = useCallback((type, opts = {}) => {
    const id = uid("vfx");
    setEffects((p) => [...p, { id, type, ...opts, created: Date.now() }]);
    setTimeout(() => setEffects((p) => p.filter((x) => x.id !== id)), opts.duration || 1200);
  }, []);
  return { effects, add };
}
function VFXOverlay({ effects }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 50, overflow: "hidden" }}>
      {effects.map((fx) => {
        if (fx.type === "damage") return (<div key={fx.id} style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)", animation: "vfxShake .3s ease-out", fontSize: 36, fontFamily: "'Cinzel',serif", fontWeight: 900, color: "#ff4040", textShadow: "0 0 30px #ff0000, 0 0 60px #ff000066" }}>-{fx.amount}</div>);
        if (fx.type === "heal") return (<div key={fx.id} style={{ position: "absolute", top: fx.side === "player" ? "70%" : "20%", left: "50%", transform: "translate(-50%,-50%)", animation: "vfxFloat 1s ease-out forwards", fontSize: 28, fontFamily: "'Cinzel',serif", fontWeight: 900, color: "#40ff60", textShadow: "0 0 20px #00ff44" }}>+{fx.amount}</div>);
        if (fx.type === "ability") return (<div key={fx.id} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", animation: "vfxPulse .8s ease-out forwards", background: `radial-gradient(circle,${fx.color || "#e8c060"}44,transparent)`, width: 260, height: 260, borderRadius: "50%" }} />);
        if (fx.type === "environment") return (<div key={fx.id} style={{ position: "absolute", inset: 0, animation: "vfxEnv 2s ease-out forwards", background: `radial-gradient(ellipse at 50% 100%,${fx.color || "#4a9020"}30,transparent 70%)`, borderTop: `1px solid ${fx.color || "#4a9020"}22` }} />);
        return null;
      })}
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
function ArtCanvas({ card, style = {} }) { const ref = useRef(null); useEffect(() => { const c = ref.current; if (!c) return; drawCardArt(c.getContext("2d"), card, c.width, c.height); }, [card.id, card.seed, card.region, card.type]); return (<canvas ref={ref} width={280} height={190} style={{ width: "100%", height: "100%", display: "block", ...style }} />); }
function CardArt({ card }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (card.imageUrl && !imgFailed) return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ArtCanvas card={card} style={{ position: "absolute", inset: 0 }} />
      <img src={card.imageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 1 }} referrerPolicy="no-referrer" onError={() => setImgFailed(true)} />
    </div>
  );
  return (<div style={{ position: "relative", width: "100%", height: "100%" }}><ArtCanvas card={card} style={{ position: "absolute", inset: 0 }} /></div>);
}

// ═══ CARD POOL ═══════════════════════════════════════════════════════════════
const POOL = [
  { id: "wolf", name: "Stonefang Wolf", type: "creature", region: "Thornwood", rarity: "Common", cost: 2, atk: 3, hp: 2, keywords: ["Swift"], border: "#4a9020", seed: 7, bloodpact: false, imageUrl: "data:image/jpeg;base64,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", ability: "Swift. Can attack immediately.", flavor: "It hunts what you're holding.", effects: [], levelUp: [{ at: 2, bonus: { atk: 1, hp: 0 }, label: "Pack Leader" }, { at: 4, bonus: { atk: 1, hp: 1 }, label: "Alpha" }] },
  { id: "guard", name: "Thornwood Guard", type: "creature", region: "Thornwood", rarity: "Common", cost: 2, atk: 1, hp: 5, keywords: [], border: "#4a9020", seed: 15, bloodpact: false, ability: "On Play: Give +1 HP to all allies.", flavor: "The trees remember.", effects: [{ trigger: "onPlay", effect: "buff_allies", atk: 0, hp: 1 }], levelUp: [{ at: 3, bonus: { atk: 0, hp: 2 }, label: "Ironbark" }, { at: 5, bonus: { atk: 1, hp: 2 }, label: "Ancient Oak" }] },
  { id: "druid", name: "Rootcaller Druid", type: "creature", region: "Thornwood", rarity: "Uncommon", cost: 3, atk: 2, hp: 3, keywords: [], border: "#4a9020", seed: 111, bloodpact: false, ability: "On Play: Heal hero for 3.", flavor: "She asks the roots.", effects: [{ trigger: "onPlay", effect: "heal_hero", amount: 3 }], levelUp: [{ at: 2, bonus: { atk: 0, hp: 1 }, label: "Elder" }, { at: 4, bonus: { atk: 1, hp: 2 }, label: "Arch-Druid" }] },
  { id: "tangle", name: "Tanglewood Trap", type: "spell", region: "Thornwood", rarity: "Rare", cost: 2, atk: null, hp: null, keywords: [], border: "#4a9020", seed: 112, bloodpact: false, ability: "Deal 2 damage to all enemies.", flavor: "The forest does not warn.", effects: [{ trigger: "onPlay", effect: "damage_all_enemies", amount: 2 }] },
  { id: "env_grove", name: "Ancient Grove", type: "environment", region: "Thornwood", rarity: "Uncommon", cost: 2, atk: null, hp: null, keywords: [], border: "#4a9020", seed: 113, bloodpact: false, ability: "ENV: Allies heal 1 HP each turn.", flavor: "Under the canopy, wounds close.", effects: [{ trigger: "onTurnStart", effect: "heal_all_allies", amount: 1 }] },
  { id: "wisp", name: "Echo Wisp", type: "creature", region: "Shattered Expanse", rarity: "Uncommon", cost: 2, atk: 2, hp: 2, keywords: ["Echo"], border: "#9050d8", seed: 42, bloodpact: false, ability: "Echo - 1/1 ghost replays next turn.", flavor: "The Rift repeats.", effects: [], levelUp: [{ at: 2, bonus: { atk: 0, hp: 1 }, label: "Resonant" }, { at: 4, bonus: { atk: 1, hp: 1 }, label: "Twin Soul" }] },
  { id: "shard", name: "Rift Shard", type: "creature", region: "Shattered Expanse", rarity: "Common", cost: 1, atk: 2, hp: 1, keywords: ["Swift"], border: "#9050d8", seed: 120, bloodpact: false, ability: "Swift. On Death: Draw a card.", flavor: "It shatters. You learn.", effects: [{ trigger: "onDeath", effect: "draw", amount: 1 }], levelUp: [{ at: 2, bonus: { atk: 1, hp: 0 }, label: "Prism" }, { at: 4, bonus: { atk: 1, hp: 1 }, label: "Crystal Core" }] },
  { id: "weaver", name: "Timeline Weaver", type: "creature", region: "Shattered Expanse", rarity: "Rare", cost: 4, atk: 3, hp: 4, keywords: ["Fracture"], border: "#9050d8", seed: 121, bloodpact: false, ability: "Fracture. On Play: Allies get +1 ATK.", flavor: "She knits time into armor.", effects: [{ trigger: "onPlay", effect: "buff_allies", atk: 1, hp: 0 }], levelUp: [{ at: 2, bonus: { atk: 1, hp: 1 }, label: "Chrono Sage" }, { at: 4, bonus: { atk: 2, hp: 1 }, label: "Time Lord" }] },
  { id: "velrun", name: "Velrun", type: "champion", region: "Shattered Expanse", rarity: "Legendary", cost: 5, atk: 4, hp: 6, keywords: ["Fracture"], border: "#9050d8", seed: 99, bloodpact: false, ability: "Fracture. On Play: 2 damage to enemy hero.", flavor: "He ruled three timelines. Lost them all.", effects: [{ trigger: "onPlay", effect: "damage_enemy_hero", amount: 2 }], levelUp: [{ at: 3, bonus: { atk: 1, hp: 2 }, label: "Ascendant" }, { at: 5, bonus: { atk: 2, hp: 2 }, label: "Timeline King" }] },
  { id: "env_rift", name: "Fractured Rift", type: "environment", region: "Shattered Expanse", rarity: "Rare", cost: 3, atk: null, hp: null, keywords: [], border: "#9050d8", seed: 122, bloodpact: false, ability: "ENV: Keyword creatures get +1 ATK.", flavor: "Reality bends.", effects: [{ trigger: "onTurnStart", effect: "buff_keyword_allies", atk: 1, hp: 0 }] },
  { id: "tide", name: "Tidecaller", type: "creature", region: "Azure Deep", rarity: "Rare", cost: 3, atk: 2, hp: 3, keywords: ["Resonate"], border: "#1880b8", seed: 13, bloodpact: false, ability: "Resonate - +1 ATK per enemy card.", flavor: "The sea reads the shore.", effects: [], levelUp: [{ at: 2, bonus: { atk: 0, hp: 1 }, label: "Stormsurge" }, { at: 4, bonus: { atk: 1, hp: 1 }, label: "Tempest" }] },
  { id: "shellguard", name: "Shellguard", type: "creature", region: "Azure Deep", rarity: "Common", cost: 2, atk: 1, hp: 4, keywords: ["Shield"], border: "#1880b8", seed: 130, bloodpact: false, ability: "Shield - blocks first hit.", flavor: "Patient as coral.", effects: [], levelUp: [{ at: 3, bonus: { atk: 0, hp: 2 }, label: "Reef Wall" }, { at: 5, bonus: { atk: 1, hp: 2 }, label: "Leviathan Shell" }] },
  { id: "current", name: "Riptide Current", type: "spell", region: "Azure Deep", rarity: "Common", cost: 1, atk: null, hp: null, keywords: [], border: "#1880b8", seed: 131, bloodpact: false, ability: "Draw 2 cards.", flavor: "The deep gives.", effects: [{ trigger: "onPlay", effect: "draw", amount: 2 }] },
  { id: "kraken", name: "Abyssal Kraken", type: "creature", region: "Azure Deep", rarity: "Epic", cost: 5, atk: 4, hp: 5, keywords: ["Anchor"], border: "#1880b8", seed: 132, bloodpact: false, ability: "Anchor. On Play: 3 damage to random enemy.", flavor: "It waited below. Always.", effects: [{ trigger: "onPlay", effect: "damage_random_enemy", amount: 3 }], levelUp: [{ at: 2, bonus: { atk: 1, hp: 1 }, label: "Deep Terror" }, { at: 4, bonus: { atk: 2, hp: 2 }, label: "Worldbreaker" }] },
  { id: "env_depths", name: "Sunken Depths", type: "environment", region: "Azure Deep", rarity: "Uncommon", cost: 2, atk: null, hp: null, keywords: [], border: "#1880b8", seed: 133, bloodpact: false, ability: "ENV: Draw extra card each turn.", flavor: "The pressure reveals.", effects: [{ trigger: "onTurnStart", effect: "draw", amount: 1 }] },
  { id: "sprite", name: "Emberveil Sprite", type: "creature", region: "Ashfen", rarity: "Common", cost: 1, atk: 1, hp: 2, keywords: ["Bleed"], border: "#c04810", seed: 23, bloodpact: false, ability: "Bleed - 1 stack on hit.", flavor: "Small. Spiteful.", effects: [], levelUp: [{ at: 2, bonus: { atk: 1, hp: 0 }, label: "Spite Flame" }, { at: 4, bonus: { atk: 1, hp: 1 }, label: "Inferno Core" }] },
  { id: "imp", name: "Ashfen Imp", type: "creature", region: "Ashfen", rarity: "Common", cost: 1, atk: 2, hp: 1, keywords: [], border: "#c04810", seed: 55, bloodpact: false, ability: "On Death: 2 damage to enemy hero.", flavor: "Burned the bridge before crossing.", effects: [{ trigger: "onDeath", effect: "damage_enemy_hero", amount: 2 }], levelUp: [{ at: 2, bonus: { atk: 1, hp: 1 }, label: "Scarred Imp" }, { at: 4, bonus: { atk: 2, hp: 1 }, label: "Pit Champion" }] },
  { id: "pyro", name: "Pyromancer", type: "creature", region: "Ashfen", rarity: "Uncommon", cost: 3, atk: 3, hp: 2, keywords: ["Bleed"], border: "#c04810", seed: 140, bloodpact: false, ability: "Bleed. On Play: 1 damage to ALL.", flavor: "Everything burns equally.", effects: [{ trigger: "onPlay", effect: "damage_all", amount: 1 }], levelUp: [{ at: 2, bonus: { atk: 1, hp: 1 }, label: "Firestarter" }, { at: 4, bonus: { atk: 2, hp: 1 }, label: "Inferno" }] },
  { id: "eruption", name: "Volcanic Eruption", type: "spell", region: "Ashfen", rarity: "Rare", cost: 4, atk: null, hp: null, keywords: [], border: "#c04810", seed: 141, bloodpact: false, ability: "4 to enemy hero. 1 to yours.", flavor: "The mountain remembers.", effects: [{ trigger: "onPlay", effect: "damage_enemy_hero", amount: 4 }, { trigger: "onPlay", effect: "damage_own_hero", amount: 1 }] },
  { id: "env_volcano", name: "Ashfen Caldera", type: "environment", region: "Ashfen", rarity: "Rare", cost: 3, atk: null, hp: null, keywords: [], border: "#c04810", seed: 142, bloodpact: false, ability: "ENV: 1 damage to ALL creatures/turn.", flavor: "None are safe.", effects: [{ trigger: "onTurnStart", effect: "damage_all", amount: 1 }] },
  { id: "sentinel", name: "Iron Sentinel", type: "creature", region: "Ironmarch", rarity: "Uncommon", cost: 3, atk: 2, hp: 4, keywords: ["Anchor"], border: "#6060a0", seed: 31, bloodpact: false, ability: "Anchor - can't be removed.", flavor: "It never moved.", effects: [], levelUp: [{ at: 3, bonus: { atk: 1, hp: 1 }, label: "Immovable" }, { at: 5, bonus: { atk: 2, hp: 2 }, label: "Eternal Wall" }] },
  { id: "forgebot", name: "Forge Automaton", type: "creature", region: "Ironmarch", rarity: "Common", cost: 2, atk: 2, hp: 3, keywords: [], border: "#6060a0", seed: 150, bloodpact: false, ability: "On Play: Random ally gets +1 ATK.", flavor: "Built to improve.", effects: [{ trigger: "onPlay", effect: "buff_random_ally", atk: 1, hp: 0 }], levelUp: [{ at: 2, bonus: { atk: 1, hp: 0 }, label: "Overclocked" }, { at: 4, bonus: { atk: 1, hp: 1 }, label: "War Engine" }] },
  { id: "shield_wall", name: "Iron Barricade", type: "spell", region: "Ironmarch", rarity: "Common", cost: 2, atk: null, hp: null, keywords: [], border: "#6060a0", seed: 151, bloodpact: false, ability: "All allies get +2 HP.", flavor: "The wall holds.", effects: [{ trigger: "onPlay", effect: "buff_allies", atk: 0, hp: 2 }] },
  { id: "colossus", name: "Ironmarch Colossus", type: "champion", region: "Ironmarch", rarity: "Legendary", cost: 6, atk: 5, hp: 8, keywords: ["Anchor", "Shield"], border: "#6060a0", seed: 152, bloodpact: false, ability: "Anchor + Shield. +1 ATK/turn.", flavor: "The empire fell. It did not.", effects: [{ trigger: "onTurnStart", effect: "self_buff", atk: 1, hp: 0 }], levelUp: [{ at: 3, bonus: { atk: 1, hp: 1 }, label: "Living Fortress" }, { at: 5, bonus: { atk: 2, hp: 2 }, label: "God-Machine" }] },
  { id: "falcon", name: "Sunveil Falcon", type: "creature", region: "Sunveil", rarity: "Common", cost: 2, atk: 3, hp: 1, keywords: ["Swift"], border: "#b89010", seed: 160, bloodpact: false, ability: "Swift.", flavor: "Sunlight made lethal.", effects: [], levelUp: [{ at: 2, bonus: { atk: 1, hp: 1 }, label: "Raptor" }, { at: 4, bonus: { atk: 1, hp: 1 }, label: "Sky Tyrant" }] },
  { id: "oracle", name: "Sand Oracle", type: "creature", region: "Sunveil", rarity: "Uncommon", cost: 3, atk: 2, hp: 3, keywords: [], border: "#b89010", seed: 161, bloodpact: false, ability: "On Play: Draw a card.", flavor: "The sands show what comes.", effects: [{ trigger: "onPlay", effect: "draw", amount: 1 }], levelUp: [{ at: 2, bonus: { atk: 0, hp: 1 }, label: "Seer" }, { at: 4, bonus: { atk: 1, hp: 2 }, label: "Prophet" }] },
  { id: "sun_strike", name: "Solar Flare", type: "spell", region: "Sunveil", rarity: "Rare", cost: 3, atk: null, hp: null, keywords: [], border: "#b89010", seed: 162, bloodpact: false, ability: "3 to random enemy, 1 to all.", flavor: "The sun does not forgive.", effects: [{ trigger: "onPlay", effect: "damage_random_enemy", amount: 3 }, { trigger: "onPlay", effect: "damage_all_enemies", amount: 1 }] },
  { id: "env_dunes", name: "Shifting Dunes", type: "environment", region: "Sunveil", rarity: "Uncommon", cost: 2, atk: null, hp: null, keywords: [], border: "#b89010", seed: 163, bloodpact: false, ability: "ENV: Creatures cost 1 less (min 1).", flavor: "The path shortens.", effects: [{ trigger: "passive", effect: "cost_reduction", amount: 1 }] },
  { id: "siphon", name: "Siphon Wraith", type: "creature", region: "Bloodpact", rarity: "Rare", cost: 3, atk: 5, hp: 3, keywords: ["Bleed"], border: "#a81830", seed: 77, bloodpact: true, ability: "BLOOD (3 HP). Double Bleed.", flavor: "It fed on the wound.", effects: [], levelUp: [{ at: 2, bonus: { atk: 1, hp: 1 }, label: "Hungering" }, { at: 4, bonus: { atk: 2, hp: 1 }, label: "Soul Drinker" }] },
  { id: "martyr", name: "Crimson Martyr", type: "creature", region: "Bloodpact", rarity: "Uncommon", cost: 2, atk: 3, hp: 4, keywords: [], border: "#a81830", seed: 88, bloodpact: true, ability: "BLOOD (2 HP). On Death: Heal 4.", flavor: "Sacrifice was its prayer.", effects: [{ trigger: "onDeath", effect: "heal_hero", amount: 4 }], levelUp: [{ at: 2, bonus: { atk: 0, hp: 2 }, label: "Devoted" }, { at: 4, bonus: { atk: 1, hp: 3 }, label: "Saint's Wrath" }] },
  { id: "bloodmage", name: "Hemomancer", type: "creature", region: "Bloodpact", rarity: "Epic", cost: 4, atk: 6, hp: 4, keywords: ["Bleed"], border: "#a81830", seed: 170, bloodpact: true, ability: "BLOOD (4 HP). Bleed. 2 Bleed to all.", flavor: "Blood is currency.", effects: [{ trigger: "onPlay", effect: "bleed_all_enemies", amount: 2 }], levelUp: [{ at: 2, bonus: { atk: 1, hp: 1 }, label: "Blood Lord" }, { at: 4, bonus: { atk: 2, hp: 2 }, label: "Sanguine King" }] },
  { id: "blood_pact", name: "Dark Bargain", type: "spell", region: "Bloodpact", rarity: "Uncommon", cost: 2, atk: null, hp: null, keywords: [], border: "#a81830", seed: 171, bloodpact: true, ability: "BLOOD (2 HP). Draw 3 cards.", flavor: "The cost is always you.", effects: [{ trigger: "onPlay", effect: "draw", amount: 3 }] },
];
const HOME_CARDS = [POOL.find((c) => c.id === "velrun"), POOL.find((c) => c.id === "kraken"), POOL.find((c) => c.id === "colossus"), POOL.find((c) => c.id === "bloodmage"), POOL.find((c) => c.id === "weaver")].filter(Boolean);

// ═══ PACKS ═══════════════════════════════════════════════════════════════════
const PACKS = [
  { id: "starter", name: "Starter Pack", desc: "5 cards. Guaranteed Uncommon+", cost: 0, count: 5, color: "#e8c060", pool: "all", guarantees: [{ rarity: "Uncommon", count: 1 }] },
  { id: "thornwood", name: "Thornwood Pack", desc: "5 forest cards", cost: 100, count: 5, color: "#4a9020", pool: "Thornwood", guarantees: [] },
  { id: "expanse", name: "Expanse Pack", desc: "5 crystal cards", cost: 100, count: 5, color: "#9050d8", pool: "Shattered Expanse", guarantees: [] },
  { id: "ashfen", name: "Ashfen Pack", desc: "5 volcanic cards", cost: 100, count: 5, color: "#c04810", pool: "Ashfen", guarantees: [] },
  { id: "premium", name: "Rift Pack", desc: "5 cards. Guaranteed Rare+", cost: 250, count: 5, color: "#f0b818", pool: "all", guarantees: [{ rarity: "Rare", count: 1 }] },
];
function rollPack(pack) {
  const pool = pack.pool === "all" ? POOL : POOL.filter((c) => c.region === pack.pool);
  const weights = { Common: 50, Uncommon: 30, Rare: 15, Epic: 4, Legendary: 1 };
  const totalW = 100;
  const rollOne = () => { let r = Math.random() * totalW, acc = 0; for (const [rar, w] of Object.entries(weights)) { acc += w; if (r <= acc) { const opts = pool.filter((c) => c.rarity === rar); return opts.length > 0 ? opts[Math.floor(Math.random() * opts.length)] : pool[Math.floor(Math.random() * pool.length)]; } } return pool[0]; };
  const cards = [];
  for (const g of (pack.guarantees || [])) { const rarIdx = ["Common","Uncommon","Rare","Epic","Legendary"].indexOf(g.rarity); const eligible = pool.filter((c) => ["Common","Uncommon","Rare","Epic","Legendary"].indexOf(c.rarity) >= rarIdx); for (let i = 0; i < g.count; i++) cards.push(eligible[Math.floor(Math.random() * eligible.length)] || pool[0]); }
  while (cards.length < pack.count) cards.push(rollOne());
  return cards;
}

// ═══ CARD COMPONENT ══════════════════════════════════════════════════════════
function Card({ card, size = "md", onClick, animDelay = 0 }) {
  const [hov, setHov] = useState(false);
  const [flip, setFlip] = useState(false);
  const W = size === "sm" ? 142 : size === "lg" ? 222 : 182;
  const artH = size === "sm" ? 88 : size === "lg" ? 138 : 115;
  const kws = KW.filter((k) => (card.keywords || []).includes(k.name));
  const isBP = card.bloodpact || card.region === "Bloodpact";
  const isEnv = card.type === "environment";
  const border = card.border || "#e8c060";
  const handleClick = () => { if (onClick) onClick(card); else setFlip((f) => !f); };
  return (
    <div style={{ perspective: 1000, width: W, flexShrink: 0, animation: animDelay ? `cardReveal 0.6s ease-out ${animDelay}s both` : undefined }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div onClick={handleClick} style={{ width: W, transformStyle: "preserve-3d", transition: "transform .5s cubic-bezier(.4,0,.2,1)", transform: flip ? "rotateY(180deg)" : hov ? "translateY(-8px) scale(1.02)" : "none", cursor: "pointer", filter: hov ? `drop-shadow(0 12px 28px ${border}88)` : "none" }}>
        <div style={{ backfaceVisibility: "hidden", background: isEnv ? "linear-gradient(170deg,#0c1418,#080c10)" : isBP ? "linear-gradient(170deg,#1e0a12,#0e0608)" : "linear-gradient(170deg,#1c1910,#0e0c08)", border: `2px solid ${border}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px 5px" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: isBP ? "radial-gradient(#dd2040,#880018)" : isEnv ? "radial-gradient(#40a0c0,#206080)" : "radial-gradient(#f0d840,#c08808)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cinzel',serif", fontWeight: 900, fontSize: 13, color: isBP ? "#ffccdd" : "#1a1000" }}>{isBP ? "B" : isEnv ? "E" : card.cost}</div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {isEnv && <div style={{ fontSize: 7, background: "#28a0cc22", color: "#28a0cc", border: "1px solid #28a0cc44", borderRadius: 4, padding: "1px 6px", fontFamily: "'Cinzel',serif" }}>ENV</div>}
              <div style={{ fontSize: 8, color: RC[card.rarity] || "#aaa", background: "rgba(0,0,0,0.65)", padding: "2px 7px", borderRadius: 20, border: `1px solid ${RC[card.rarity] || "#888"}44` }}>{(card.rarity || "Common").toUpperCase()}</div>
            </div>
          </div>
          <div style={{ height: artH, margin: "0 8px", borderRadius: 8, overflow: "hidden", border: `1px solid ${border}60` }}><CardArt card={card} /></div>
          <div style={{ padding: "7px 10px 3px" }}>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: size === "sm" ? 10 : 12, fontWeight: 700, color: "#f8f0e0", lineHeight: 1.2 }}>{card.name}</div>
            <div style={{ fontSize: 8.5, color: "#c0a870", marginTop: 2 }}>{(card.type || "creature").charAt(0).toUpperCase() + (card.type || "").slice(1)} · <span style={{ color: border }}>{card.region}</span></div>
          </div>
          {kws.length > 0 && (<div style={{ padding: "3px 10px", display: "flex", gap: 4, flexWrap: "wrap" }}>{kws.map((k) => (<span key={k.name} style={{ fontSize: 8, padding: "2px 7px", borderRadius: 20, background: `${k.color}25`, color: k.color, border: `1px solid ${k.color}55` }}>{k.icon} {k.name}</span>))}</div>)}
          <div style={{ padding: "5px 10px 7px" }}><p style={{ fontSize: 10, color: isEnv ? "#80c0d0" : "#e0d0b0", lineHeight: 1.65, margin: 0 }}>{card.ability}</p></div>
          {card.atk != null && (<div style={{ display: "flex", justifyContent: "space-between", padding: "6px 16px 8px", background: "rgba(0,0,0,0.45)", borderTop: `1px solid ${border}38` }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontFamily: "'Cinzel',serif", fontWeight: 700, color: "#ff7750", lineHeight: 1 }}>{card.currentAtk != null ? card.currentAtk : card.atk}</div><div style={{ fontSize: 7, color: "#996655", letterSpacing: 1 }}>ATK</div></div><div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontFamily: "'Cinzel',serif", fontWeight: 700, color: "#50c065", lineHeight: 1 }}>{card.currentHp != null ? card.currentHp : card.hp}</div><div style={{ fontSize: 7, color: "#448850", letterSpacing: 1 }}>HP</div></div></div>)}
          <div style={{ textAlign: "center", padding: "3px 0 5px", fontSize: 7, color: "#2a2010" }}>tap for lore</div>
        </div>
        <div style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", position: "absolute", top: 0, left: 0, right: 0, background: "linear-gradient(160deg,#1c1810,#0e0c08)", border: `2px solid ${border}`, borderRadius: 14, padding: 14, minHeight: W * 1.75, display: "flex", flexDirection: "column", boxShadow: `0 0 28px ${border}44` }}>
          <div style={{ height: 65, borderRadius: 7, overflow: "hidden", opacity: 0.8, marginBottom: 10, border: `1px solid ${border}44` }}><CardArt card={card} /></div>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 700, color: "#f8f0e0", marginBottom: 8, textAlign: "center" }}>{card.name}</div>
          <div style={{ borderLeft: `3px solid ${border}`, paddingLeft: 10, marginBottom: 10 }}><p style={{ fontSize: 11, fontStyle: "italic", color: "#d8c898", lineHeight: 1.75, margin: 0 }}>"{card.flavor || "Lost to history."}"</p></div>
          <div style={{ textAlign: "center", fontSize: 7, color: "#2a2010", marginTop: "auto" }}>tap to flip</div>
        </div>
      </div>
    </div>
  );
}

// ═══ TOKEN + HAND CARD ═══════════════════════════════════════════════════════
function Token({ c, selected, isTarget, canSelect, onClick }) {
  const [hov, setHov] = useState(false);
  const pct = c.currentHp / c.maxHp;
  const opac = (c.hasAttacked && !isTarget) ? 0.45 : 1;
  return (<div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ width: 92, cursor: (canSelect || isTarget) ? "pointer" : "default", userSelect: "none", background: "linear-gradient(160deg,#1a1610,#0e0c08)", border: `2px solid ${selected ? "#f0d840" : isTarget && hov ? "#e84040" : hov && canSelect ? c.border + "aa" : c.border + "55"}`, borderRadius: 10, overflow: "hidden", opacity: opac, boxShadow: selected ? "0 0 20px #f0d84066" : "none", transform: selected ? "translateY(-8px)" : "none", transition: "all .18s", position: "relative" }}>
    {c.level > 1 && <div style={{ position: "absolute", top: 3, right: 3, zIndex: 3, background: c.border + "ee", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#fff", fontWeight: 700, fontFamily: "'Cinzel',serif" }}>{c.level}</div>}
    {c.shielded && <div style={{ position: "absolute", top: 3, left: 3, zIndex: 3, fontSize: 9, background: "#60a0d0cc", borderRadius: 3, padding: "0 3px", color: "#fff" }}>S</div>}
    <div style={{ height: 54, position: "relative", overflow: "hidden" }}><CardArt card={c} />{c.bleed > 0 && <div style={{ position: "absolute", top: 2, left: 2, background: "#d04040cc", color: "white", fontSize: 7, borderRadius: 3, padding: "1px 4px", fontWeight: 700 }}>B{c.bleed}</div>}</div>
    <div style={{ padding: "3px 5px 1px", fontFamily: "'Cinzel',serif", fontSize: 7.5, color: "#f0e0c8", fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.levelLabel || c.name.slice(0, 12)}</div>
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 9px 4px", background: "rgba(0,0,0,0.45)", borderTop: `1px solid ${c.border}38` }}><span style={{ fontSize: 14, fontFamily: "'Cinzel',serif", fontWeight: 700, color: "#ff7050" }}>{c.currentAtk}</span><span style={{ fontSize: 14, fontFamily: "'Cinzel',serif", fontWeight: 700, color: pct < 0.4 ? "#e04040" : "#50c060" }}>{c.currentHp}</span></div>
    <div style={{ height: 3, background: "#080604" }}><div style={{ height: "100%", width: `${Math.max(0, pct) * 100}%`, background: pct < 0.4 ? "#d84040" : "#48a028", transition: "width .3s" }} /></div>
  </div>);
}
function HandCard({ card, playable, onClick }) {
  const [hov, setHov] = useState(false);
  const isBP = card.bloodpact; const isEnv = card.type === "environment";
  return (<div onClick={playable ? onClick : undefined} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ width: 80, flexShrink: 0, cursor: playable ? "pointer" : "not-allowed", opacity: playable ? 1 : 0.35, background: isEnv ? "linear-gradient(170deg,#0c1418,#080c10)" : "linear-gradient(170deg,#1a1610,#0e0c08)", border: `2px solid ${isBP ? "#a81830" : hov && playable ? card.border : "#201c10"}`, borderRadius: 10, overflow: "hidden", transform: hov && playable ? "translateY(-22px) scale(1.05)" : "none", boxShadow: hov && playable ? `0 22px 38px ${card.border}66` : "none", transition: "all .2s", userSelect: "none" }}>
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 6px 2px", alignItems: "center" }}><div style={{ width: 24, height: 24, borderRadius: "50%", background: isBP ? "radial-gradient(#dd2040,#880018)" : isEnv ? "radial-gradient(#40a0c0,#206080)" : "radial-gradient(#f0d840,#c08808)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cinzel',serif", fontWeight: 900, fontSize: 12, color: isBP ? "#ffccdd" : "#1a1000" }}>{isBP ? "B" : isEnv ? "E" : card.cost}</div>{card.atk != null && <span style={{ fontSize: 8, color: "#a08050", fontWeight: 600 }}>{card.atk}/{card.hp}</span>}</div>
    <div style={{ height: 44, margin: "0 4px", borderRadius: 5, overflow: "hidden", border: `1px solid ${card.border}55` }}><CardArt card={card} /></div>
    <div style={{ padding: "3px 6px 2px", fontFamily: "'Cinzel',serif", fontSize: 8, color: "#f0e0c8", fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.name.length > 11 ? card.name.slice(0, 10) + ".." : card.name}</div>
  </div>);
}

// ═══ TURN TIMER ══════════════════════════════════════════════════════════════
function TurnTimer({ active, duration = CFG.turnTimer, onExpire }) {
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
  const pct = time / duration;
  const col = pct > 0.5 ? "#e8c060" : pct > 0.2 ? "#e08830" : "#e04040";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 80, height: 6, background: "#1a1408", borderRadius: 3, overflow: "hidden", border: "1px solid #2a200a" }}>
        <div style={{ height: "100%", width: `${pct * 100}%`, background: col, transition: "width 1s linear, background 0.5s", boxShadow: pct < 0.2 ? `0 0 8px ${col}` : "none" }} />
      </div>
      <span style={{ fontFamily: "'Cinzel',serif", fontSize: 11, fontWeight: 700, color: col, minWidth: 20, textAlign: "right" }}>{time}</span>
    </div>
  );
}

// ═══ GAME ENGINE ═════════════════════════════════════════════════════════════
function makeInst(c, p = "p") { return { ...c, uid: uid(p + c.id), currentHp: c.hp, maxHp: c.hp, currentAtk: c.atk, canAttack: false, hasAttacked: false, bleed: 0, xp: 0, level: 1, levelLabel: "", echoQueued: false, shielded: (c.keywords || []).includes("Shield") }; }
function levelUp(u) { if (!u.levelUp || !u.levelUp.length) return u; let c = { ...u }; u.levelUp.forEach((t, i) => { if (c.xp >= t.at && c.level <= i + 1) c = { ...c, level: i + 2, currentAtk: c.currentAtk + t.bonus.atk, currentHp: c.currentHp + t.bonus.hp, maxHp: c.maxHp + t.bonus.hp, levelLabel: t.label }; }); return c; }

function resolveEffects(trigger, card, state, side, vfx) {
  const effects = (card.effects || []).filter((e) => e.trigger === trigger); let s = { ...state };
  const L = (m) => { s.log = [...(s.log || []).slice(-20), m]; };
  const myB = side === "player" ? "playerBoard" : "enemyBoard", thB = side === "player" ? "enemyBoard" : "playerBoard";
  const myHP = side === "player" ? "playerHP" : "enemyHP", thHP = side === "player" ? "enemyHP" : "playerHP";
  for (const fx of effects) {
    switch (fx.effect) {
      case "heal_hero": s[myHP] = Math.min(CFG.startHP, s[myHP] + fx.amount); L(`${card.name} heals ${fx.amount}!`); if (vfx) vfx.add("heal", { amount: fx.amount, side }); break;
      case "damage_enemy_hero": s[thHP] -= fx.amount; L(`${card.name} deals ${fx.amount} to hero!`); if (vfx) vfx.add("damage", { amount: fx.amount }); break;
      case "damage_own_hero": s[myHP] -= fx.amount; L(`${card.name} costs ${fx.amount} HP!`); break;
      case "damage_all_enemies": s[thB] = s[thB].map((c) => ({ ...c, currentHp: c.currentHp - fx.amount })).filter((c) => c.currentHp > 0); L(`${card.name}: ${fx.amount} to all enemies!`); if (vfx) vfx.add("ability", { color: "#ff4040" }); break;
      case "damage_all": s[myB] = s[myB].map((c) => c.uid === card.uid ? c : { ...c, currentHp: c.currentHp - fx.amount }).filter((c) => c.currentHp > 0); s[thB] = s[thB].map((c) => ({ ...c, currentHp: c.currentHp - fx.amount })).filter((c) => c.currentHp > 0); L(`${card.name}: ${fx.amount} to ALL!`); if (vfx) vfx.add("ability", { color: "#ff8040" }); break;
      case "damage_random_enemy": if (s[thB].length > 0) { const idx = Math.floor(Math.random() * s[thB].length); const tgt = s[thB][idx]; s[thB] = s[thB].map((c, i) => i === idx ? { ...c, currentHp: c.currentHp - fx.amount } : c).filter((c) => c.currentHp > 0); L(`${card.name} hits ${tgt.name} for ${fx.amount}!`); } break;
      case "buff_allies": s[myB] = s[myB].map((c) => ({ ...c, currentAtk: c.currentAtk + (fx.atk || 0), currentHp: c.currentHp + (fx.hp || 0), maxHp: c.maxHp + (fx.hp || 0) })); L(`${card.name} buffs +${fx.atk || 0}/+${fx.hp || 0}!`); if (vfx) vfx.add("ability", { color: "#40ff60" }); break;
      case "buff_random_ally": { const allies = s[myB].filter((c) => c.uid !== card.uid); if (allies.length > 0) { const t = allies[Math.floor(Math.random() * allies.length)]; s[myB] = s[myB].map((c) => c.uid === t.uid ? { ...c, currentAtk: c.currentAtk + (fx.atk || 0) } : c); L(`${card.name} buffs ${t.name}!`); } break; }
      case "buff_keyword_allies": s[myB] = s[myB].map((c) => (c.keywords || []).length > 0 ? { ...c, currentAtk: c.currentAtk + (fx.atk || 0) } : c); break;
      case "heal_all_allies": s[myB] = s[myB].map((c) => ({ ...c, currentHp: Math.min(c.maxHp, c.currentHp + fx.amount) })); break;
      case "self_buff": s[myB] = s[myB].map((c) => c.uid === card.uid ? { ...c, currentAtk: c.currentAtk + (fx.atk || 0) } : c); break;
      case "draw": { const dk = side === "player" ? "playerDeck" : "enemyDeck", hd = side === "player" ? "playerHand" : "enemyHand"; for (let i = 0; i < fx.amount; i++) { if (s[dk].length > 0 && s[hd].length < CFG.maxHand) { s[hd] = [...s[hd], makeInst(s[dk][0], side === "player" ? "p" : "e")]; s[dk] = s[dk].slice(1); } } L(`${card.name}: Draw ${fx.amount}!`); break; }
      case "bleed_all_enemies": s[thB] = s[thB].map((c) => ({ ...c, bleed: (c.bleed || 0) + fx.amount })); L(`${card.name}: ${fx.amount} Bleed to all!`); break;
    }
  }
  return s;
}

// ═══ ENEMY AI ════════════════════════════════════════════════════════════════
function computeEnemyTurn(g, vfx) {
  let s = { ...g, playerBoard: g.playerBoard.map((c) => ({ ...c })), enemyBoard: g.enemyBoard.map((c) => ({ ...c })), playerHand: [...g.playerHand], enemyHand: [...g.enemyHand], enemyDeck: [...g.enemyDeck], playerDeck: [...g.playerDeck], log: [...g.log] };
  const L = (m) => { s.log = [...s.log.slice(-20), m]; };
  if (s.environment) s = resolveEffects("onTurnStart", s.environment, s, s.environment.owner, vfx);
  if (s.enemyDeck.length > 0 && s.enemyHand.length < 6) { s.enemyHand = [...s.enemyHand, makeInst(s.enemyDeck[0], "e")]; s.enemyDeck = s.enemyDeck.slice(1); L("Enemy draws."); }
  let en = s.maxEnergy;
  [...s.enemyHand].sort((a, b) => b.cost - a.cost).forEach((card) => {
    if (card.type === "environment") { if (!card.bloodpact && card.cost <= en) { en -= card.cost; s.environment = { ...card, owner: "enemy" }; s.enemyHand = s.enemyHand.filter((c) => c.uid !== card.uid); L(`Enemy: ${card.name}!`); s = resolveEffects("onPlay", card, s, "enemy", vfx); } return; }
    if (card.type === "spell") { if (card.bloodpact ? card.cost < s.enemyHP : card.cost <= en) { if (card.bloodpact) s.enemyHP -= card.cost; else en -= card.cost; s.enemyHand = s.enemyHand.filter((c) => c.uid !== card.uid); L(`Enemy casts ${card.name}!`); s = resolveEffects("onPlay", card, s, "enemy", vfx); } return; }
    if (s.enemyBoard.length >= CFG.maxBoard) return;
    const ec = card.bloodpact ? 0 : card.cost; if (ec > en) return;
    const inst = { ...makeInst(card, "eb"), canAttack: (card.keywords || []).includes("Swift") };
    if (card.bloodpact) { s.enemyHP -= card.cost; L(`Enemy blood-plays ${card.name}!`); } else { en -= ec; L(`Enemy plays ${card.name}!`); }
    s.enemyBoard = [...s.enemyBoard, inst]; s.enemyHand = s.enemyHand.filter((c) => c.uid !== card.uid);
    if ((card.keywords || []).includes("Fracture") && s.enemyBoard.length < CFG.maxBoard) s.enemyBoard = [...s.enemyBoard, { ...inst, uid: uid("ef"), currentHp: Math.ceil(card.hp / 2), maxHp: Math.ceil(card.hp / 2), currentAtk: Math.ceil(card.atk / 2), name: card.name + " Frag", keywords: [], levelUp: [], effects: [] }];
    s = resolveEffects("onPlay", card, s, "enemy", vfx);
  });
  s.enemyBoard.filter((c) => c.canAttack && !c.hasAttacked).forEach((att) => {
    if (s.playerHP <= 0) return;
    const av = att.currentAtk + ((att.keywords || []).includes("Resonate") ? s.playerHand.length : 0);
    if (s.playerBoard.length > 0) { const tgt = [...s.playerBoard].sort((a, b) => a.currentHp - b.currentHp)[0]; let nTHP = tgt.shielded ? tgt.currentHp : tgt.currentHp - av; let nAHP = att.currentHp - tgt.currentAtk; s.enemyBoard = s.enemyBoard.map((c) => c.uid === att.uid ? { ...c, hasAttacked: true, currentHp: nAHP } : c).filter((c) => c.currentHp > 0); s.playerBoard = s.playerBoard.map((c) => c.uid === tgt.uid ? { ...c, currentHp: nTHP, shielded: false, bleed: (c.bleed || 0) + ((att.keywords || []).includes("Bleed") ? 1 : 0) } : c).filter((c) => c.currentHp > 0); if (nTHP <= 0) { L(`${tgt.name} falls!`); s = resolveEffects("onDeath", tgt, s, "player", vfx); } if (nAHP <= 0) s = resolveEffects("onDeath", att, s, "enemy", vfx);
    } else { s.playerHP -= av; s.enemyBoard = s.enemyBoard.map((c) => c.uid === att.uid ? { ...c, hasAttacked: true } : c); L(`${att.name} hits you for ${av}!`); }
  });
  if (s.playerHP <= 0) return { ...s, phase: "gameover", winner: "enemy", log: [...s.log, "Defeated..."] };
  const newTurn = g.turn + 1, newMax = Math.min(CFG.maxEnergy, newTurn + 1);
  s.playerBoard = s.playerBoard.map((c) => c.bleed > 0 ? { ...c, currentHp: c.currentHp - c.bleed } : c).filter((c) => c.currentHp > 0);
  s.enemyBoard = s.enemyBoard.map((c) => c.bleed > 0 ? { ...c, currentHp: c.currentHp - c.bleed } : c).filter((c) => c.currentHp > 0);
  s.playerBoard.forEach((c) => { if (c.effects && c.effects.length) s = resolveEffects("onTurnStart", c, s, "player", vfx); });
  s.playerBoard = s.playerBoard.map((c) => { const lv = levelUp({ ...c, xp: c.xp + 1 }); if (lv.level > c.level) L(`${c.name} leveled to ${lv.levelLabel}!`); return { ...lv, canAttack: true, hasAttacked: false }; });
  s.enemyBoard = s.enemyBoard.map((c) => ({ ...levelUp({ ...c, xp: c.xp + 1 }), canAttack: true, hasAttacked: false }));
  s.playerBoard.filter((c) => (c.keywords || []).includes("Echo") && !c.echoQueued).forEach((src) => { if (s.playerBoard.length < CFG.maxBoard) { s.playerBoard = [...s.playerBoard, { ...makeInst({ ...src, id: src.id + "_e", hp: 1, atk: 1, keywords: [], levelUp: [], effects: [] }, "pe"), uid: uid("echo"), currentHp: 1, maxHp: 1, currentAtk: 1, name: src.name + " Echo", canAttack: true }]; L(`Echo of ${src.name}!`); } });
  s.playerBoard = s.playerBoard.map((c) => (c.keywords || []).includes("Echo") ? { ...c, echoQueued: true } : c);
  if (s.playerDeck.length > 0 && s.playerHand.length < CFG.maxHand) { s.playerHand = [...s.playerHand, makeInst(s.playerDeck[0], "p")]; s.playerDeck = s.playerDeck.slice(1); }
  if (s.enemyHP <= 0) return { ...s, phase: "gameover", winner: "player", log: [...s.log, "Victory!"] };
  L(`Turn ${newTurn}`);
  return { ...s, turn: newTurn, phase: "player", playerEnergy: newMax, maxEnergy: newMax };
}

// ═══ OPENING DRAW ════════════════════════════════════════════════════════════
function OpeningDraw({ onResult }) {
  const [phase, setPhase] = useState("waiting");
  const [pCard, setPCard] = useState(null);
  const [eCard, setECard] = useState(null);
  const [winner, setWinner] = useState(null);
  const draw = () => { const pc = POOL[Math.floor(Math.random() * POOL.length)]; const ec = POOL[Math.floor(Math.random() * POOL.length)]; setPCard(pc); setECard(ec); setPhase("drawing"); SFX.play("draw"); setTimeout(() => { const w = (pc.cost || 0) >= (ec.cost || 0) ? "player" : "enemy"; setWinner(w); setPhase("result"); SFX.play(w === "player" ? "ability" : "defeat"); setTimeout(() => onResult(w), 2000); }, 1200); };
  return (<div style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(6,4,2,0.96)", backdropFilter: "blur(10px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, borderRadius: 14 }}>
    <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, color: "#c89030", letterSpacing: 5, animation: "fadeIn 0.6s ease-out" }}>OPENING DRAW</div>
    <p style={{ fontSize: 13, color: "#c0a870", maxWidth: 300, textAlign: "center", lineHeight: 1.7, margin: 0 }}>Higher cost card goes first!</p>
    {phase === "waiting" && <button onClick={draw} style={{ padding: "14px 36px", background: "linear-gradient(135deg,#c89010,#f0c040)", border: "none", borderRadius: 9, fontFamily: "'Cinzel',serif", fontSize: 14, fontWeight: 700, letterSpacing: 2, color: "#1a1000", cursor: "pointer", animation: "pulse 2s ease-in-out infinite" }}>DRAW</button>}
    {(phase === "drawing" || phase === "result") && pCard && eCard && (<div style={{ display: "flex", gap: 40, alignItems: "center" }}>
      <div style={{ textAlign: "center", animation: "slideInLeft 0.5s ease-out" }}><div style={{ fontSize: 10, color: "#a09070", marginBottom: 8, fontFamily: "'Cinzel',serif" }}>YOU</div><div style={{ width: 100, padding: 10, background: `linear-gradient(135deg,#1a1408,${pCard.border}22)`, border: `2px solid ${pCard.border}`, borderRadius: 10, textAlign: "center" }}><div style={{ fontFamily: "'Cinzel',serif", fontSize: 9, color: "#f0e0c8", fontWeight: 700 }}>{pCard.name}</div><div style={{ fontSize: 24, fontFamily: "'Cinzel',serif", fontWeight: 900, color: "#e8c060", marginTop: 4 }}>{pCard.cost}</div></div></div>
      <div style={{ fontSize: 22, color: "#403020", fontFamily: "'Cinzel',serif", fontWeight: 900 }}>VS</div>
      <div style={{ textAlign: "center", animation: "slideInRight 0.5s ease-out" }}><div style={{ fontSize: 10, color: "#a09070", marginBottom: 8, fontFamily: "'Cinzel',serif" }}>ENEMY</div><div style={{ width: 100, padding: 10, background: "linear-gradient(135deg,#1a0808,#0e0604)", border: `2px solid ${eCard.border}`, borderRadius: 10, textAlign: "center" }}><div style={{ fontFamily: "'Cinzel',serif", fontSize: 9, color: "#f0e0c8", fontWeight: 700 }}>{eCard.name}</div><div style={{ fontSize: 24, fontFamily: "'Cinzel',serif", fontWeight: 900, color: "#cc4848", marginTop: 4 }}>{eCard.cost}</div></div></div>
    </div>)}
    {phase === "result" && winner && <div style={{ fontFamily: "'Cinzel',serif", fontSize: 16, color: winner === "player" ? "#f0c040" : "#e05050", animation: "vfxFloat 0.5s ease-out", textShadow: `0 0 20px ${winner === "player" ? "#f0c04066" : "#e0505066"}` }}>{winner === "player" ? "You go first!" : "Enemy goes first!"}</div>}
  </div>);
}

// ═══ BATTLE SCREEN ═══════════════════════════════════════════════════════════
function BattleScreen({ user, onUpdateUser, matchConfig, onExit }) {
  const initGame = () => { const fallback = [...POOL, ...POOL, ...POOL.slice(0, 5)]; const pd = shuf(matchConfig?.playerDeck?.length >= CFG.deck.min ? [...matchConfig.playerDeck] : [...fallback]); const ed = shuf([...fallback]); return { matchId: uid("m"), turn: 1, phase: "opening", winner: null, playerHP: CFG.startHP, playerEnergy: CFG.startEnergy, maxEnergy: CFG.startEnergy, playerHand: pd.slice(0, CFG.startHand).map((c) => makeInst(c, "p")), playerDeck: pd.slice(CFG.startHand), playerBoard: [], enemyHP: CFG.startHP, enemyHand: ed.slice(0, CFG.startHand).map((c) => makeInst(c, "e")), enemyDeck: ed.slice(CFG.startHand), enemyBoard: [], environment: null, log: ["Draw for priority!"] }; };
  const [game, setGame] = useState(initGame);
  const [attacker, setAttacker] = useState(null);
  const [aiThink, setAiThink] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const logRef = useRef(null);
  const vfx = useVFX();
  useEffect(() => { if (logRef.current) logRef.current.scrollTo({ top: 99999, behavior: "smooth" }); }, [game?.log]);

  const g = game;
  const envTheme = g.environment ? ENV_THEMES[g.environment.region] || null : null;

  const handleOpeningResult = (winner) => { setGame((p) => ({ ...p, phase: winner === "player" ? "player" : "enemy", log: [...p.log, winner === "player" ? "You go first!" : "Enemy goes first!"] })); setTimerKey((k) => k + 1); if (winner === "enemy") setTimeout(() => doEnemyTurn(), 600); };

  const doEnemyTurn = () => { setAiThink(true); setTimeout(() => { setGame((prev) => { const next = computeEnemyTurn(prev, vfx); if (next.phase === "gameover") { SFX.play(next.winner === "player" ? "victory" : "defeat"); if (onUpdateUser) onUpdateUser({ battlesPlayed: (user?.battlesPlayed || 0) + 1, battlesWon: next.winner === "player" ? (user?.battlesWon || 0) + 1 : (user?.battlesWon || 0) }); } return next; }); setAiThink(false); setTimerKey((k) => k + 1); }, 800); };

  const endTurn = useCallback(() => { if (g.phase !== "player" || aiThink) return; setAttacker(null); SFX.play("timer_end"); setGame((p) => ({ ...p, phase: "enemy", log: [...p.log.slice(-20), "Your turn ends."] })); setTimeout(() => doEnemyTurn(), 300); }, [g.phase, aiThink]);

  const playCard = (card) => {
    if (g.phase !== "player" || aiThink) return;
    if (card.type === "environment") { if (card.bloodpact ? card.cost >= g.playerHP : card.cost > g.playerEnergy) return; SFX.play("env_play"); setAttacker(null); setGame((prev) => { let s = { ...prev, playerHand: prev.playerHand.filter((c) => c.uid !== card.uid), log: [...prev.log.slice(-20)] }; if (card.bloodpact) { s.playerHP -= card.cost; s.log = [...s.log, `Pay ${card.cost} HP: ${card.name}!`]; } else { s.playerEnergy -= card.cost; s.log = [...s.log, `${card.name} reshapes the field!`]; } s.environment = { ...card, owner: "player" }; s = resolveEffects("onPlay", card, s, "player", vfx); vfx.add("environment", { color: card.border, duration: 2000 }); return s; }); return; }
    if (card.type === "spell") { if (card.bloodpact ? card.cost >= g.playerHP : card.cost > g.playerEnergy) return; SFX.play("ability"); setAttacker(null); setGame((prev) => { let s = { ...prev, playerHand: prev.playerHand.filter((c) => c.uid !== card.uid), log: [...prev.log.slice(-20)] }; if (card.bloodpact) { s.playerHP -= card.cost; s.log = [...s.log, `Pay ${card.cost} HP: ${card.name}!`]; } else { s.playerEnergy -= card.cost; s.log = [...s.log, `Cast ${card.name}!`]; } s = resolveEffects("onPlay", card, s, "player", vfx); return s; }); return; }
    if (g.playerBoard.length >= CFG.maxBoard) return;
    if (card.bloodpact ? card.cost >= g.playerHP : card.cost > g.playerEnergy) return;
    SFX.play("card"); setAttacker(null);
    setGame((prev) => { let s = { ...prev, playerHand: prev.playerHand.filter((c) => c.uid !== card.uid), log: [...prev.log.slice(-20)] }; if (card.bloodpact) { s.playerHP -= card.cost; s.log = [...s.log, `Pay ${card.cost} HP: ${card.name}!`]; } else { s.playerEnergy -= card.cost; s.log = [...s.log, `You play ${card.name}!`]; } const inst = { ...makeInst(card, "pb"), canAttack: (card.keywords || []).includes("Swift"), hasAttacked: false }; s.playerBoard = [...prev.playerBoard, inst]; if ((card.keywords || []).includes("Fracture") && s.playerBoard.length < CFG.maxBoard) { s.playerBoard = [...s.playerBoard, { ...inst, uid: uid("pf"), currentHp: Math.ceil(card.hp / 2), maxHp: Math.ceil(card.hp / 2), currentAtk: Math.ceil(card.atk / 2), name: card.name + " Frag", keywords: [], levelUp: [], effects: [] }]; s.log = [...s.log, "Fragment enters!"]; } s = resolveEffects("onPlay", card, s, "player", vfx); return s; });
  };

  const selectAtt = (c) => { if (g.phase !== "player" || aiThink) return; if (attacker === c.uid) { setAttacker(null); return; } if (c.canAttack && !c.hasAttacked) setAttacker(c.uid); };
  const atkCreature = (tgt) => { if (!attacker || g.phase !== "player") return; const att = g.playerBoard.find((c) => c.uid === attacker); if (!att) return; SFX.play("attack"); const av = att.currentAtk + ((att.keywords || []).includes("Resonate") ? g.enemyHand.length : 0); setGame((prev) => { let s = { ...prev, log: [...prev.log.slice(-20)] }; let nTHP = tgt.shielded ? tgt.currentHp : tgt.currentHp - av; let nAHP = att.currentHp - tgt.currentAtk; if (tgt.shielded) s.log = [...s.log, `${tgt.name} shield absorbs!`]; s.enemyBoard = prev.enemyBoard.map((c) => c.uid === tgt.uid ? { ...c, currentHp: nTHP, shielded: false, bleed: (c.bleed || 0) + ((att.keywords || []).includes("Bleed") ? 1 : 0) } : c).filter((c) => c.currentHp > 0); s.playerBoard = prev.playerBoard.map((c) => c.uid === att.uid ? { ...c, hasAttacked: true, currentHp: nAHP } : c).filter((c) => c.currentHp > 0); s.log = [...s.log, `${att.name}(${av}) attacks ${tgt.name}`]; if (nTHP <= 0) { SFX.play("kill"); s.log = [...s.log, `${tgt.name} destroyed!`]; s = resolveEffects("onDeath", tgt, s, "enemy", vfx); } if (nAHP <= 0) { s.log = [...s.log, `${att.name} falls.`]; s = resolveEffects("onDeath", att, s, "player", vfx); } if (s.enemyHP <= 0) { s.phase = "gameover"; s.winner = "player"; } return s; }); setAttacker(null); };
  const atkFace = () => { if (!attacker || g.phase !== "player") return; const att = g.playerBoard.find((c) => c.uid === attacker); if (!att) return; SFX.play("attack"); const dmg = att.currentAtk + ((att.keywords || []).includes("Resonate") ? g.enemyHand.length : 0); setGame((prev) => { const nHP = prev.enemyHP - dmg; let s = { ...prev, enemyHP: nHP, playerBoard: prev.playerBoard.map((c) => c.uid === att.uid ? { ...c, hasAttacked: true } : c), log: [...prev.log.slice(-20), `${att.name} deals ${dmg} direct!`] }; if (nHP <= 0) { s.phase = "gameover"; s.winner = "player"; s.log = [...s.log, "Victory!"]; } return s; }); setAttacker(null); };
  const attCard = attacker ? g.playerBoard.find((c) => c.uid === attacker) : null;

  return (<div style={{ maxWidth: 980, margin: "0 auto", padding: "0 16px 60px" }} onClick={() => SFX.init()}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <button onClick={onExit} style={{ padding: "7px 16px", background: "transparent", border: "1px solid #3a2c10", borderRadius: 7, color: "#806040", fontFamily: "'Cinzel',serif", fontSize: 9, cursor: "pointer" }}>EXIT</button>
      <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 700, color: "#e8c060", margin: 0 }}>Battle</h2>
      {g.phase === "player" && !aiThink ? <TurnTimer key={timerKey} active={true} onExpire={endTurn} /> : <div style={{ width: 110 }} />}
    </div>
    {g.phase === "gameover" && (<div style={{ textAlign: "center", background: g.winner === "player" ? "linear-gradient(135deg,#060e04,#0e0c08)" : "linear-gradient(135deg,#120404,#0e0c08)", border: `1px solid ${g.winner === "player" ? "#4a9020" : "#b83030"}`, borderRadius: 14, padding: 36, marginBottom: 20, animation: "fadeIn 0.5s ease-out" }}>
      <div style={{ fontSize: 56, marginBottom: 10, animation: "pulse 1s ease-in-out" }}>{g.winner === "player" ? "\u2728" : "\u2620"}</div>
      <h3 style={{ fontFamily: "'Cinzel',serif", fontSize: 28, color: g.winner === "player" ? "#78cc45" : "#e05050", margin: "0 0 18px", textShadow: `0 0 30px ${g.winner === "player" ? "#78cc4566" : "#e0505066"}` }}>{g.winner === "player" ? "VICTORY" : "DEFEATED"}</h3>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button onClick={() => { setGame(initGame()); setAttacker(null); setAiThink(false); }} style={{ padding: "11px 28px", background: "linear-gradient(135deg,#c89010,#f0c040)", border: "none", borderRadius: 8, fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 12, letterSpacing: 2, color: "#1a1000", cursor: "pointer" }}>REMATCH</button>
        <button onClick={onExit} style={{ padding: "11px 22px", background: "transparent", border: "1px solid #3a2c10", borderRadius: 8, fontFamily: "'Cinzel',serif", fontSize: 11, color: "#a09058", cursor: "pointer" }}>EXIT</button>
      </div>
    </div>)}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12 }}>
      <div style={{ background: envTheme ? envTheme.bg : "#0c0a08", border: `1px solid ${envTheme ? envTheme.glow + "44" : "#242010"}`, borderRadius: 14, overflow: "hidden", position: "relative", transition: "background 1.5s ease, border-color 1s ease" }}>
        {g.phase === "opening" && <OpeningDraw onResult={handleOpeningResult} />}
        <VFXOverlay effects={vfx.effects} />
        {/* Environment particles */}
        {envTheme && <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}><FloatingParticles count={20} color={envTheme.particle} speed={0.6} /></div>}
        {/* Environment banner */}
        {g.environment && (<div style={{ padding: "7px 14px", background: `${g.environment.border}15`, borderBottom: `1px solid ${g.environment.border}33`, display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 2, animation: "slideDown 0.4s ease-out" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: g.environment.border, boxShadow: `0 0 8px ${g.environment.border}88`, animation: "pulse 2s infinite" }} />
          <span style={{ fontFamily: "'Cinzel',serif", fontSize: 10, color: g.environment.border, fontWeight: 700 }}>{g.environment.name}</span>
          <span style={{ fontSize: 9, color: "#a09068", flex: 1 }}>{g.environment.ability}</span>
        </div>)}
        {/* Enemy zone */}
        <div style={{ background: "rgba(180,40,40,0.04)", borderBottom: "1px solid #241010", padding: "10px 14px", position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#3a0c0c,#200808)", border: "2px solid #a0202044", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#cc6666", fontFamily: "'Cinzel',serif", fontWeight: 700 }}>AI</div>
              <span style={{ fontFamily: "'Cinzel',serif", fontSize: 10, color: "#cc4848", letterSpacing: 2, fontWeight: 700 }}>ENEMY</span>
              <div style={{ display: "flex", gap: 2, marginLeft: 4 }}>{Array.from({ length: g.enemyHand.length }).map((_, i) => (<div key={i} style={{ width: 14, height: 20, background: "linear-gradient(135deg,#240c0c,#180808)", border: "1px solid #341818", borderRadius: 2 }} />))}</div>
              <span style={{ fontSize: 8, color: "#604040", fontFamily: "'Cinzel',serif" }}>Deck: {g.enemyDeck.length}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 60, height: 6, background: "#180808", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${(g.enemyHP / CFG.startHP) * 100}%`, background: hpCol(g.enemyHP), transition: "width .4s" }} /></div>
              <span style={{ fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 700, color: hpCol(g.enemyHP) }}>{g.enemyHP}</span>
            </div>
          </div>
          <div style={{ minHeight: 105, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
            {g.enemyBoard.length === 0 ? <span style={{ fontSize: 10, color: "#241010", letterSpacing: 3 }}>---</span> : g.enemyBoard.map((c) => (<Token key={c.uid} c={c} isTarget={!!attacker} canSelect={false} onClick={() => attacker && atkCreature(c)} />))}
          </div>
        </div>
        {/* Centre divider */}
        <div style={{ padding: "6px 14px", background: envTheme ? "rgba(0,0,0,0.3)" : "#080608", borderBottom: "1px solid #181010", borderTop: "1px solid #181010", display: "flex", alignItems: "center", justifyContent: "center", gap: 14, position: "relative", zIndex: 2 }}>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(to right,transparent,#382e18)" }} />
          {attCard ? (<button onClick={g.enemyBoard.length === 0 ? atkFace : undefined} style={{ padding: "5px 16px", background: g.enemyBoard.length === 0 ? "linear-gradient(135deg,#6a0808,#a01010)" : "rgba(255,255,255,0.04)", border: `1px solid ${g.enemyBoard.length === 0 ? "#e04040" : "#2a1a10"}`, borderRadius: 20, color: g.enemyBoard.length === 0 ? "#ffaaaa" : "#604030", fontFamily: "'Cinzel',serif", fontSize: 9, cursor: g.enemyBoard.length === 0 ? "pointer" : "default" }}>{g.enemyBoard.length === 0 ? "STRIKE HERO" : "SELECT TARGET"}</button>) : (<span style={{ fontSize: 9, color: envTheme ? envTheme.glow + "88" : "#241a08", letterSpacing: 3, fontFamily: "'Cinzel',serif" }}>TURN {g.turn}</span>)}
          <div style={{ flex: 1, height: 1, background: "linear-gradient(to left,transparent,#382e18)" }} />
        </div>
        {/* Player zone */}
        <div style={{ background: "rgba(40,100,20,0.04)", padding: "10px 14px", position: "relative", zIndex: 2 }}>
          <div style={{ minHeight: 105, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", alignItems: "center", marginBottom: 10 }}>
            {g.playerBoard.length === 0 ? <span style={{ fontSize: 10, color: "#181408", letterSpacing: 3 }}>PLAY A CARD</span> : g.playerBoard.map((c) => (<Token key={c.uid} c={c} selected={attacker === c.uid} isTarget={false} canSelect={g.phase === "player" && c.canAttack && !c.hasAttacked && !aiThink} onClick={() => selectAtt(c)} />))}
          </div>
          <div style={{ borderTop: "1px solid #181408", paddingTop: 10, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
              {g.playerHand.map((card) => { const isEnv = card.type === "environment"; const isSpl = card.type === "spell"; const cp = g.phase === "player" && !aiThink && (isEnv || isSpl || g.playerBoard.length < CFG.maxBoard) && (card.bloodpact ? card.cost < g.playerHP : card.cost <= g.playerEnergy); return (<HandCard key={card.uid} card={card} playable={cp} onClick={() => playCard(card)} />); })}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#4a9020,#6aab3a)", border: "2px solid #e8c06055", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cinzel',serif", fontSize: 10, fontWeight: 700, color: "#fff" }}>{(user?.name || "??").slice(0, 2).toUpperCase()}</div>
              <span style={{ fontSize: 8, color: "#e8c060", fontFamily: "'Cinzel',serif" }}>Deck: {g.playerDeck.length}</span>
              <span style={{ fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 700, color: hpCol(g.playerHP) }}>{g.playerHP}</span>
              <span style={{ fontSize: 9, color: "#806040" }}>HP</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 8, color: "#c0a060", fontFamily: "'Cinzel',serif" }}>ENERGY</span>
                <div style={{ display: "flex", gap: 2 }}>{Array.from({ length: g.maxEnergy }).map((_, i) => (<div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: i < g.playerEnergy ? "#e8b828" : "#241a08", border: `1px solid ${i < g.playerEnergy ? "#e89a10" : "#14100a"}`, transition: "background .3s" }} />))}</div>
                <span style={{ fontFamily: "'Cinzel',serif", fontSize: 10, color: "#e8b828", fontWeight: 700 }}>{g.playerEnergy}/{g.maxEnergy}</span>
              </div>
              <button onClick={endTurn} disabled={g.phase !== "player" || aiThink} style={{ padding: "8px 16px", background: g.phase === "player" && !aiThink ? "linear-gradient(135deg,#c89010,#f0c040)" : "rgba(255,255,255,0.04)", border: "none", borderRadius: 7, fontFamily: "'Cinzel',serif", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: g.phase === "player" && !aiThink ? "#1a1000" : "#404030", cursor: g.phase === "player" && !aiThink ? "pointer" : "not-allowed" }}>{aiThink ? "THINKING..." : "END TURN"}</button>
            </div>
          </div>
        </div>
      </div>
      {/* Sidebar log */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {attCard && (<div style={{ background: `${attCard.border}15`, border: `1px solid ${attCard.border}55`, borderRadius: 10, padding: 10 }}><div style={{ fontFamily: "'Cinzel',serif", fontSize: 9, color: attCard.border, fontWeight: 600 }}>ATTACKING</div><div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, color: "#f0e8d8", fontWeight: 700 }}>{attCard.name}</div><div style={{ fontSize: 12, color: "#ff7050", fontWeight: 700 }}>ATK {attCard.currentAtk}</div><button onClick={() => setAttacker(null)} style={{ marginTop: 6, width: "100%", padding: "3px", background: "transparent", border: "1px solid #241408", borderRadius: 4, color: "#806040", fontFamily: "'Cinzel',serif", fontSize: 8, cursor: "pointer" }}>Cancel</button></div>)}
        <div style={{ flex: 1, background: "#080604", border: "1px solid #161408", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 8, color: "#705028", letterSpacing: 2, padding: "6px 8px", borderBottom: "1px solid #161408", fontWeight: 600 }}>LOG</div>
          <div ref={logRef} style={{ overflowY: "auto", padding: "6px 8px", flex: 1, maxHeight: 300 }}>{g.log.map((l, i) => (<div key={i} style={{ fontSize: 9, lineHeight: 1.5, marginBottom: 1, color: "#a09060" }}>{l}</div>))}</div>
        </div>
      </div>
    </div>
  </div>);
}

// ═══ MATCH SETUP ═════════════════════════════════════════════════════════════
function GameTab({ user, onUpdateUser }) {
  const [matchConfig, setMatchConfig] = useState(null);
  if (!matchConfig) return (<div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 24px 60px", textAlign: "center" }}>
    <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 28, fontWeight: 700, color: "#e8c060", margin: "0 0 8px" }}>Battle Setup</h2>
    <p style={{ fontSize: 13, color: "#a09070", margin: "0 0 28px" }}>Fight the AI with your collection!</p>
    <button onClick={() => { SFX.play("card"); setMatchConfig({ mode: "ai", playerDeck: null }); }} style={{ padding: "16px 36px", background: "linear-gradient(135deg,#c89010,#f0c040)", border: "none", borderRadius: 9, fontFamily: "'Cinzel',serif", fontSize: 15, fontWeight: 700, letterSpacing: 3, color: "#1a1000", cursor: "pointer", boxShadow: "0 8px 30px #c8901044" }}>START BATTLE</button>
  </div>);
  return (<BattleScreen user={user} onUpdateUser={onUpdateUser} matchConfig={matchConfig} onExit={() => setMatchConfig(null)} />);
}

// ═══ PACK OPENING ════════════════════════════════════════════════════════════
function PackOpening({ user, onUpdateUser }) {
  const [opening, setOpening] = useState(null);
  const [revealed, setRevealed] = useState([]);
  const [revIdx, setRevIdx] = useState(-1);
  const [shakeCard, setShakeCard] = useState(-1);

  const openPack = (pack) => { setOpening({ pack, cards: rollPack(pack) }); setRevealed([]); setRevIdx(-1); SFX.play("pack_open"); };
  const revealNext = () => {
    if (!opening) return;
    const next = revIdx + 1; if (next >= opening.cards.length) return;
    setShakeCard(next);
    setTimeout(() => {
      setRevIdx(next); setRevealed((p) => [...p, next]);
      const card = opening.cards[next];
      if (["Rare","Epic","Legendary"].includes(card.rarity)) SFX.play("rare_reveal"); else SFX.play("flip");
      if (onUpdateUser && user) { const col = { ...(user.collection || {}) }; col[card.id] = (col[card.id] || 0) + 1; onUpdateUser({ collection: col }); }
      setShakeCard(-1);
    }, 400);
  };
  const revealAll = () => { if (!opening) return; setRevealed(opening.cards.map((_, i) => i)); setRevIdx(opening.cards.length - 1); SFX.play("rare_reveal"); if (onUpdateUser && user) { const col = { ...(user.collection || {}) }; opening.cards.forEach((c) => { col[c.id] = (col[c.id] || 0) + 1; }); onUpdateUser({ collection: col }); } };

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
            <div style={{ padding: "8px 12px", background: `${p.color}15`, border: `1px solid ${p.color}33`, borderRadius: 8, fontFamily: "'Cinzel',serif", fontSize: 10, color: p.color, fontWeight: 600, letterSpacing: 1 }}>{p.cost === 0 ? "FREE" : `${p.cost} SHARDS`}</div>
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
function useAuth() { const [user, setUser] = useState(null); const [loading, setLoading] = useState(true); useEffect(() => { const t = setTimeout(() => setLoading(false), 600); store.get("ff_user_v11").then((r) => { clearTimeout(t); try { if (r && r.value) setUser(JSON.parse(r.value)); } catch (e) {} setLoading(false); }).catch(() => { clearTimeout(t); setLoading(false); }); return () => clearTimeout(t); }, []); return { user, loading, login: async (u) => { await store.set("ff_user_v11", JSON.stringify(u)); setUser(u); }, logout: async () => { await store.del("ff_user_v11"); setUser(null); }, update: async (delta) => { const u = { ...user, ...delta }; await store.set("ff_user_v11", JSON.stringify(u)); setUser(u); } }; }

function LoginModal({ onLogin }) {
  const [step, setStep] = useState("key"); const [key, setKey] = useState(""); const [name, setName] = useState(""); const [err, setErr] = useState("");
  return (<div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(4,2,0,0.96)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
    <div style={{ background: "linear-gradient(160deg,#1e1c10,#100e08)", border: "1px solid #3a3020", borderRadius: 18, padding: 42, maxWidth: 420, width: "100%", textAlign: "center", boxShadow: "0 32px 80px rgba(0,0,0,0.9)", animation: "fadeIn 0.6s ease-out", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}><FloatingParticles count={15} color="#e8c060" speed={0.3} /></div>
      <div style={{ position: "relative", zIndex: 1 }}>
        <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 26, fontWeight: 900, color: "#e8c060", margin: "0 0 4px", textShadow: "0 0 40px #c89020aa" }}>Forge {"&"} Fable</h2>
        <div style={{ fontSize: 9, background: "rgba(200,100,20,0.2)", border: "1px solid #c0600844", color: "#c07030", borderRadius: 10, padding: "3px 14px", fontFamily: "'Cinzel',serif", letterSpacing: 2, display: "inline-block", marginBottom: 24 }}>PATCH 1 - THE RIFT OPENS</div>
        {step === "key" && (<>
          <p style={{ fontSize: 13, color: "#b0a070", margin: "0 0 24px", lineHeight: 1.7 }}>Enter your alpha key to begin.</p>
          <input value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { const k = key.trim().toUpperCase(); if (ALPHA_KEYS.has(k)) { setErr(""); setStep("name"); } else setErr("Invalid key."); } }} placeholder="e.g. FORGE-FOUNDER" maxLength={24} style={{ width: "100%", padding: "13px 16px", background: "#0c0a06", border: "1px solid #3a3020", borderRadius: 9, color: "#f0e8d8", fontSize: 14, fontFamily: "'Lora',serif", outline: "none", marginBottom: 8, textAlign: "center", letterSpacing: 3, boxSizing: "border-box" }} />
          {err && <div style={{ fontSize: 11, color: "#e04040", marginBottom: 10 }}>{err}</div>}
          <button onClick={() => { const k = key.trim().toUpperCase(); if (ALPHA_KEYS.has(k)) { setErr(""); setStep("name"); } else setErr("Invalid key."); }} style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg,#c89010,#f0c040)", border: "none", borderRadius: 9, fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 700, letterSpacing: 2, color: "#1a1000", cursor: "pointer" }}>VALIDATE</button>
          <p style={{ fontSize: 10, color: "#3a3010", marginTop: 16 }}>Try: FORGE-FOUNDER</p>
        </>)}
        {step === "name" && (<>
          <p style={{ fontSize: 13, color: "#60c040", margin: "0 0 20px" }}>Key accepted!</p>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim().length >= 2) onLogin({ name: name.trim(), id: Date.now(), joined: new Date().toLocaleDateString(), alphaKey: key.trim().toUpperCase(), battlesPlayed: 0, battlesWon: 0, cardsForged: 0, collection: getStarterCollection(), decks: [] }); }} placeholder="Your name..." maxLength={20} style={{ width: "100%", padding: "13px 16px", background: "#0c0a06", border: "1px solid #3a3020", borderRadius: 9, color: "#f0e8d8", fontSize: 14, fontFamily: "'Lora',serif", outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
          <button onClick={() => { if (name.trim().length >= 2) onLogin({ name: name.trim(), id: Date.now(), joined: new Date().toLocaleDateString(), alphaKey: key.trim().toUpperCase(), battlesPlayed: 0, battlesWon: 0, cardsForged: 0, collection: getStarterCollection(), decks: [] }); }} style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg,#c89010,#f0c040)", border: "none", borderRadius: 9, fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 700, letterSpacing: 2, color: "#1a1000", cursor: "pointer" }}>ENTER THE FORGE</button>
        </>)}
      </div>
    </div>
  </div>);
}

// ═══ COLLECTION ══════════════════════════════════════════════════════════════
function CollectionScreen({ user }) {
  const col = user?.collection || {}; const owned = POOL.filter((c) => (col[c.id] || 0) > 0); const locked = POOL.filter((c) => !(col[c.id] > 0));
  const [search, setSearch] = useState(""); const [regFilter, setRegFilter] = useState("all");
  const filter = (cards) => cards.filter((c) => { if (regFilter !== "all" && c.region !== regFilter) return false; if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false; return true; });
  return (<div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 60px" }}>
    <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 24, fontWeight: 700, color: "#e8c060", margin: "0 0 4px" }}>Collection ({owned.length}/{POOL.length})</h2>
    <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", marginTop: 16 }}>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." style={{ flex: 1, minWidth: 120, padding: "8px 12px", background: "#100e08", border: "1px solid #2a2010", borderRadius: 7, color: "#f0e8d8", fontSize: 12, outline: "none" }} />
      <select value={regFilter} onChange={(e) => setRegFilter(e.target.value)} style={{ padding: "8px", background: "#100e08", border: "1px solid #2a2010", borderRadius: 7, color: "#f0e8d8", fontFamily: "'Cinzel',serif", fontSize: 10, outline: "none" }}><option value="all">All</option>{[...REGIONS, "Bloodpact"].map((r) => (<option key={r} value={r}>{r}</option>))}</select>
    </div>
    <div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, color: "#c09848", marginBottom: 12, fontWeight: 600 }}>OWNED ({filter(owned).length})</div>
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}>{filter(owned).map((c, i) => (<Card key={c.id} card={c} size="sm" animDelay={i * 0.04} />))}</div>
    {filter(locked).length > 0 && (<><div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, color: "#604028", marginBottom: 12, fontWeight: 600 }}>LOCKED ({filter(locked).length})</div><div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>{filter(locked).map((c) => (<div key={c.id} style={{ opacity: 0.2, filter: "grayscale(80%)" }}><Card card={c} size="sm" /></div>))}</div></>)}
  </div>);
}

// ═══ HOME ════════════════════════════════════════════════════════════════════
function HomeScreen({ setTab, user }) {
  const [active, setActive] = useState(0);
  const [entered, setEntered] = useState(false);
  useEffect(() => { setEntered(true); const id = setInterval(() => setActive((c) => (c + 1) % HOME_CARDS.length), 4000); return () => clearInterval(id); }, []);

  return (<>
    {/* Hero section */}
    <section style={{ position: "relative", minHeight: 520, overflow: "hidden" }}>
      <FloatingParticles count={40} color="#e8c060" speed={0.8} />
      {/* Radial glows */}
      <div style={{ position: "absolute", top: -100, left: -100, width: 500, height: 500, background: "radial-gradient(circle,rgba(200,140,20,0.08),transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -100, right: -100, width: 400, height: 400, background: "radial-gradient(circle,rgba(80,40,200,0.06),transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "60px 28px 44px", display: "grid", gridTemplateColumns: "1fr 420px", gap: 48, alignItems: "center", position: "relative", zIndex: 2 }}>
        <div style={{ animation: entered ? "slideInLeft 0.8s ease-out" : undefined }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(220,160,30,0.12)", border: "1px solid #d8a02044", borderRadius: 30, padding: "5px 16px", marginBottom: 20 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#e8c060", boxShadow: "0 0 8px #e8c06088", animation: "pulse 2s infinite" }} />
            <span style={{ fontFamily: "'Cinzel',serif", fontSize: 10, color: "#d8a838", letterSpacing: 2, fontWeight: 600 }}>PATCH 1 - THE RIFT OPENS</span>
          </div>
          <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: "clamp(44px,6vw,72px)", fontWeight: 900, lineHeight: 1, color: "#e8c060", margin: "0 0 16px", textShadow: "0 0 60px #c89020aa, 0 2px 4px rgba(0,0,0,0.8)" }}>
            Forge<br />{"&"} Fable
          </h1>
          <p style={{ fontSize: 16, lineHeight: 2, color: "#c8b888", margin: "0 0 12px", maxWidth: 440 }}>32 cards across 7 regions. Real abilities. Environment cards that reshape the battlefield. Your creatures level up, bleed, and echo.</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[{ label: "32", sub: "Cards" }, { label: "7", sub: "Regions" }, { label: "7", sub: "Keywords" }].map((s) => (<div key={s.sub} style={{ background: "rgba(232,192,96,0.06)", border: "1px solid #e8c06022", borderRadius: 10, padding: "10px 16px", textAlign: "center" }}><div style={{ fontFamily: "'Cinzel',serif", fontSize: 20, fontWeight: 900, color: "#e8c060" }}>{s.label}</div><div style={{ fontSize: 8, color: "#806040", letterSpacing: 1, fontFamily: "'Cinzel',serif" }}>{s.sub}</div></div>))}
          </div>
          {user && (<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => setTab("play")} style={{ padding: "14px 26px", background: "linear-gradient(135deg,#8a1010,#c02020)", border: "none", borderRadius: 10, color: "#ffd0d0", fontFamily: "'Cinzel',serif", fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer", boxShadow: "0 6px 24px rgba(200,30,30,0.3)", transition: "all .2s" }} onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={(e) => e.currentTarget.style.transform = "none"}>BATTLE</button>
            <button onClick={() => setTab("packs")} style={{ padding: "14px 26px", background: "linear-gradient(135deg,#5a3808,#8a5810)", border: "none", borderRadius: 10, color: "#f0d880", fontFamily: "'Cinzel',serif", fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer", transition: "all .2s" }} onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={(e) => e.currentTarget.style.transform = "none"}>OPEN PACKS</button>
            <button onClick={() => setTab("collection")} style={{ padding: "14px 26px", background: "transparent", border: "1px solid #e8c06055", borderRadius: 10, color: "#e8c060", fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 2, cursor: "pointer", fontWeight: 600, transition: "all .2s" }} onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={(e) => e.currentTarget.style.transform = "none"}>COLLECTION</button>
          </div>)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, animation: entered ? "slideInRight 0.8s ease-out" : undefined }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", inset: -20, background: `radial-gradient(circle,${HOME_CARDS[active]?.border || "#e8c060"}18,transparent 70%)`, transition: "background 1s ease", pointerEvents: "none" }} />
            {HOME_CARDS[active] && <Card card={HOME_CARDS[active]} size="lg" key={HOME_CARDS[active].id + active} />}
          </div>
          <div style={{ display: "flex", gap: 10 }}>{HOME_CARDS.map((c, i) => (<button key={i} onClick={() => setActive(i)} style={{ width: 10, height: 10, borderRadius: "50%", background: active === i ? c.border : "#282010", border: `1px solid ${c.border}`, cursor: "pointer", padding: 0, transition: "all .3s", boxShadow: active === i ? `0 0 10px ${c.border}66` : "none" }} />))}</div>
        </div>
      </div>
    </section>

    {/* Region strip */}
    <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 28px 40px" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {[...REGIONS, "Bloodpact"].map((r, i) => (<div key={r} style={{ padding: "10px 18px", background: `${GLOW[r]}08`, border: `1px solid ${GLOW[r]}22`, borderRadius: 10, fontFamily: "'Cinzel',serif", fontSize: 10, color: GLOW[r], fontWeight: 600, letterSpacing: 1, animation: `cardReveal 0.4s ease-out ${i * 0.06}s both`, cursor: "pointer", transition: "all .2s" }} onMouseEnter={(e) => { e.currentTarget.style.background = GLOW[r] + "18"; e.currentTarget.style.borderColor = GLOW[r] + "55"; }} onMouseLeave={(e) => { e.currentTarget.style.background = GLOW[r] + "08"; e.currentTarget.style.borderColor = GLOW[r] + "22"; }} onClick={() => setTab("collection")}>{r}</div>))}
      </div>
    </section>
  </>);
}

// ═══ GUIDE ═══════════════════════════════════════════════════════════════════
function GuideScreen() {
  return (<div style={{ maxWidth: 860, margin: "0 auto", padding: "44px 24px 60px" }}>
    <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 26, fontWeight: 700, color: "#e8c060", textAlign: "center", margin: "0 0 30px" }}>How to Play</h2>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 26 }}>
      {[{ n: "1", t: "Opening Draw", d: "Both sides draw. Higher cost goes first.", c: "#e8c060" }, { n: "2", t: "Environments", d: "Play environment cards to reshape the battlefield with visual effects and ongoing abilities.", c: "#28a0cc" }, { n: "3", t: "Abilities", d: "Real card effects: damage, healing, buffs, draw. Spells resolve instantly.", c: "#9050d8" }, { n: "4", t: "Turn Timer", d: "45 seconds per turn. Warning at 10s. Plan fast or lose your turn!", c: "#c04810" }].map((s, i) => (<div key={s.t} style={{ background: "#121008", border: `1px solid ${s.c}28`, borderRadius: 13, padding: 22, animation: `cardReveal 0.4s ease-out ${i * 0.1}s both` }}><div style={{ fontFamily: "'Cinzel',serif", fontSize: 24, fontWeight: 900, color: s.c, marginBottom: 8 }}>{s.n}</div><div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, fontWeight: 700, color: s.c, marginBottom: 8 }}>{s.t}</div><p style={{ fontSize: 12, color: "#c8b878", lineHeight: 1.75, margin: 0 }}>{s.d}</p></div>))}
    </div>
    <div style={{ background: "#121008", border: "1px solid #242010", borderRadius: 14, padding: 24 }}>
      <h3 style={{ fontFamily: "'Cinzel',serif", fontSize: 15, color: "#e8c060", margin: "0 0 18px", fontWeight: 700 }}>Keywords</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>{KW.map((k) => (<div key={k.name} style={{ padding: 12, background: `${k.color}0e`, border: `1px solid ${k.color}28`, borderRadius: 9 }}><div style={{ fontSize: 16, marginBottom: 4 }}>{k.icon}</div><div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, color: k.color, marginBottom: 3, fontWeight: 700 }}>{k.name}</div><p style={{ fontSize: 10, color: "#c0a870", margin: 0, lineHeight: 1.6 }}>{k.desc}</p></div>))}</div>
    </div>
  </div>);
}

// ═══ APP ══════════════════════════════════════════════════════════════════════
const NAV = [{ id: "home", label: "Home" }, { id: "play", label: "Battle" }, { id: "packs", label: "Packs" }, { id: "collection", label: "Cards" }, { id: "howto", label: "Guide" }];

export default function App() {
  const [tab, setTab] = useState("home"); const { user, loading, login, logout, update } = useAuth(); const [showProfile, setShowProfile] = useState(false);
  if (loading) return (<div style={{ minHeight: "100vh", background: "#0a0806", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ fontFamily: "'Cinzel',serif", color: "#e8c060", fontSize: 16, letterSpacing: 4, animation: "pulse 1.5s ease-in-out infinite" }}>FORGING...</div></div>);
  return (<div style={{ minHeight: "100vh", background: "#0e0c0a", color: "#e8e0d0", fontFamily: "'Lora',Georgia,serif", overflowX: "hidden" }} onClick={() => setShowProfile(false)}>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');
      *{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#0e0c0a}::-webkit-scrollbar-thumb{background:#3a3018;border-radius:3px}select option{background:#1a1408}button{transition:all .18s}canvas{image-rendering:auto}
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
    `}</style>
    {!user && <LoginModal onLogin={login} />}
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at 15% 15%,rgba(200,140,20,0.06) 0%,transparent 50%),radial-gradient(ellipse at 85% 85%,rgba(30,120,200,0.04) 0%,transparent 50%)" }} />
    <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(8,6,4,0.97)", backdropFilter: "blur(16px)", borderBottom: "1px solid #2c2410", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52 }} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setTab("home")} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}><div><div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 900, color: "#e8c060", lineHeight: 1 }}>Forge {"&"} Fable</div><div style={{ fontSize: 7, color: "#806030", letterSpacing: 2, fontFamily: "'Cinzel',serif" }}>v11 THE RIFT OPENS</div></div></button>
      <div style={{ display: "flex", gap: 2 }}>{NAV.map((t) => (<button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "6px 12px", background: tab === t.id ? "rgba(232,192,96,0.12)" : "transparent", border: `1px solid ${tab === t.id ? "#e8c06044" : "transparent"}`, borderRadius: 8, cursor: "pointer" }}><span style={{ fontFamily: "'Cinzel',serif", fontSize: 9, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? "#e8c060" : "#806040" }}>{t.label}</span></button>))}</div>
      {user && (<div style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setShowProfile((p) => !p)} style={{ background: "none", border: "2px solid #e8c06044", borderRadius: "50%", padding: 0, cursor: "pointer", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cinzel',serif", fontSize: 10, fontWeight: 700, color: "#e8c060" }}>{(user.name || "?").slice(0, 2).toUpperCase()}</button>
        {showProfile && (<div style={{ position: "absolute", top: 42, right: 0, background: "linear-gradient(160deg,#1e1c10,#12100a)", border: "1px solid #3a3018", borderRadius: 14, padding: 16, width: 200, zIndex: 200, boxShadow: "0 20px 60px rgba(0,0,0,0.95)", animation: "fadeIn 0.2s ease-out" }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, color: "#e8c060", fontWeight: 700, marginBottom: 10 }}>{user.name}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>{[["Battles", user.battlesPlayed || 0], ["Wins", user.battlesWon || 0], ["Cards", Object.values(user.collection || {}).filter((v) => v > 0).length], ["Forged", user.cardsForged || 0]].map(([l, v], i) => (<div key={i} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: 6, textAlign: "center" }}><div style={{ fontSize: 7, color: "#806040" }}>{l}</div><div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, fontWeight: 700, color: "#e8c060" }}>{v}</div></div>))}</div>
          <button onClick={() => { logout(); setShowProfile(false); }} style={{ width: "100%", padding: "7px", background: "rgba(180,30,30,0.12)", border: "1px solid #5a1818", borderRadius: 6, color: "#c07060", fontFamily: "'Cinzel',serif", fontSize: 9, cursor: "pointer" }}>SIGN OUT</button>
        </div>)}
      </div>)}
    </nav>
    <div style={{ position: "relative", zIndex: 1 }} onClick={() => setShowProfile(false)}>
      {tab === "home" && <HomeScreen setTab={setTab} user={user} />}
      {tab === "play" && <GameTab user={user} onUpdateUser={update} />}
      {tab === "packs" && <PackOpening user={user} onUpdateUser={update} />}
      {tab === "collection" && <CollectionScreen user={user} />}
      {tab === "howto" && <GuideScreen />}
      <footer style={{ borderTop: "1px solid #1e1a0e", padding: 22, textAlign: "center" }}><div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 700, color: "#40301a" }}>Forge {"&"} Fable</div><p style={{ fontSize: 9, color: "#30280e", margin: "4px 0 0", letterSpacing: 1 }}>PATCH 1: THE RIFT OPENS · 32 CARDS · v11</p></footer>
    </div>
  </div>);
}
