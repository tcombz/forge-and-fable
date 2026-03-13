import { useState, useEffect } from "react";

const FABLES_CARDS = [
  { id: "zeus_storm_father",  name: "Zeus, Storm Father", type: "Champion", cost: 5, atk: 4,    hp: 6,    img: "/cards/zeus_storm_father.jpg",  border: "#9070ff", rarity: "Legendary", keywords: ["Swift"],             ability: "On Play: Instantly fires Lightning for 2 dmg. Passive: Lightning Meter builds — at 4 charges, 2 dmg to a random enemy unit or Hero." },
  { id: "hades_soul_reaper",  name: "Hades, Soul Reaper", type: "Champion", cost: 5, atk: 3,    hp: 6,    img: "/cards/hades_soul_reaper.png",  border: "#7030c0", rarity: "Legendary", keywords: ["Shield"],            ability: "Soul Harvest: +1 Max HP whenever a friendly unit dies (cap 10). End of Turn: 1 dmg to all enemies." },
  { id: "titan_slayer",       name: "Titan-Slayer",        type: "Creature", cost: 4, atk: 5,    hp: 3,    img: "/cards/titan_slayer.jpg",       border: "#9070ff", rarity: "Uncommon",  keywords: ["Swift"],             ability: "\"Size isn't everything.\"" },
  { id: "olympus_guard",      name: "Fables Guard",        type: "Creature", cost: 3, atk: 2,    hp: 5,    img: "/cards/olympus_guard.jpg",      border: "#9070ff", rarity: "Uncommon",  keywords: ["Anchor", "Shield"],  ability: "Cannot be removed from the board by any effect. \"Not on my watch.\"" },
  { id: "cerberus_whelp",     name: "Cerberus Whelp",      type: "Creature", cost: 2, atk: 2,    hp: 2,    img: "/cards/cerberus_whelp.jpg",     border: "#9070ff", rarity: "Common",    keywords: ["Fracture", "Swift"], ability: "Spawns a fragment copy on play. \"Three times the treats!\"" },
  { id: "bolt_from_the_blue", name: "Bolt from the Blue",  type: "Spell",    cost: 2, atk: null, hp: null, img: "/cards/bolt_from_the_blue.jpg", border: "#9070ff", rarity: "Rare",      keywords: [],                   ability: "Deal 3 damage to a random enemy. If this kills a unit, +1 to the Lightning Meter." },
  { id: "medusas_gaze",       name: "Medusa's Gaze",       type: "Spell",    cost: 2, atk: null, hp: null, img: "/cards/medusas_gaze.jpg",       border: "#9070ff", rarity: "Rare",      keywords: [],                   ability: "Target an enemy unit — it cannot attack for 1 turn. Shown as ❄ FROZEN." },
];

// Fan rotation and vertical offsets
const FAN_CONFIG = [
  { rotate: -24, yOffset: 32 },
  { rotate: -16, yOffset: 16 },
  { rotate: -8,  yOffset:  5 },
  { rotate:  0,  yOffset:  0 },
  { rotate:  8,  yOffset:  5 },
  { rotate: 16,  yOffset: 16 },
  { rotate: 24,  yOffset: 32 },
];

const RARITY_COLOR = { Common: "#9a9a8a", Uncommon: "#d0a030", Rare: "#5090ff", Epic: "#b060e0", Legendary: "#f0c020" };

function CardModal({ card, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const bc = card.border;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(2,1,8,0.92)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
        backdropFilter: "blur(10px)",
        animation: "modalFadeIn 0.18s ease-out",
        padding: 24,
      }}
    >
      {/* Card frame — mimics in-game card at enlarged size */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative", width: 260, borderRadius: 14,
          border: `2px solid ${bc}`,
          background: "linear-gradient(180deg,#12091e 0%,#0a0414 100%)",
          boxShadow: `0 0 50px ${bc}44, 0 0 100px ${bc}18, 0 28px 80px rgba(0,0,0,0.96)`,
          overflow: "hidden",
          animation: "modalSlideUp 0.22s cubic-bezier(0.25,0.46,0.45,0.94)",
        }}
      >
        {/* Art */}
        <div style={{ position: "relative", width: "100%", height: 240 }}>
          <img src={card.img} alt={card.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 55%, ${bc}22 80%, #0a0414 100%)` }} />
          {/* Cost */}
          <div style={{ position:"absolute", top:10, left:10, width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,#1a0a50,#3a1890)", border:`2px solid ${bc}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',serif", fontSize:15, fontWeight:700, color:"#d0b0ff", boxShadow:`0 0 12px ${bc}88` }}>{card.cost}</div>
          {/* Rarity */}
          <div style={{ position:"absolute", top:10, right:10, padding:"3px 10px", borderRadius:20, background:"rgba(0,0,0,0.75)", border:`1px solid ${RARITY_COLOR[card.rarity]}55`, fontFamily:"'Cinzel',serif", fontSize:8, fontWeight:700, color:RARITY_COLOR[card.rarity], letterSpacing:1 }}>{card.rarity}</div>
          {card.rarity === "Legendary" && <div style={{ position:"absolute", inset:0, boxShadow:"inset 0 0 40px rgba(240,200,30,0.12)", pointerEvents:"none" }} />}
        </div>
        {/* Name bar */}
        <div style={{ padding:"12px 16px 8px", borderBottom:`1px solid ${bc}22` }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:17, fontWeight:700, color:"#f0e8ff", lineHeight:1.2 }}>{card.name}</div>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:bc, letterSpacing:3, marginTop:3 }}>{card.type.toUpperCase()} · <span style={{ color:"#9070ff" }}>FABLES</span></div>
        </div>
        {/* Stats */}
        {card.atk != null && (
          <div style={{ display:"flex", gap:14, padding:"8px 16px 0", marginBottom:2 }}>
            <div style={{ display:"flex", alignItems:"baseline", gap:4 }}><span style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:700, color:"#ff9070" }}>{card.atk}</span><span style={{ fontSize:8, color:"#a06050", letterSpacing:2 }}>ATK</span></div>
            <div style={{ display:"flex", alignItems:"baseline", gap:4 }}><span style={{ fontFamily:"'Cinzel',serif", fontSize:22, fontWeight:700, color:"#70e890" }}>{card.hp}</span><span style={{ fontSize:8, color:"#408050", letterSpacing:2 }}>HP</span></div>
          </div>
        )}
        {/* Keywords */}
        {card.keywords.length > 0 && (
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", padding:"6px 16px 0" }}>
            {card.keywords.map(kw => <span key={kw} style={{ fontSize:8, padding:"2px 9px", background:`${bc}22`, border:`1px solid ${bc}55`, borderRadius:20, color:"#d0c0ff", fontFamily:"'Cinzel',serif", letterSpacing:1, fontWeight:600 }}>{kw}</span>)}
          </div>
        )}
        {/* Ability */}
        <div style={{ fontSize:11, color:"#c8bcdc", lineHeight:1.75, padding:"10px 16px 14px", background:`${bc}08` }}>
          {card.ability}
        </div>
      </div>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:8, color:"#40304a", letterSpacing:3 }}>CLICK ANYWHERE TO CLOSE · ESC</div>
      <style>{`
        @keyframes modalFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes modalSlideUp { from{transform:translateY(20px) scale(0.97);opacity:0} to{transform:translateY(0) scale(1);opacity:1} }
      `}</style>
    </div>
  );
}

// Hover jitter fix: outer div stays static in flex layout (handles events, holds fan rotation).
// Only the inner visual div lifts on hover — cursor never chases the card.
function FanCard({ card, fanCfg, isHovered, baseZ, onHover, onLeave, onClick, inline }) {
  const W = inline ? 100 : 120;
  const H = inline ? 140 : 168;
  const liftY  = inline ? 60 : 76;
  const liftScale = inline ? 1.42 : 1.52;

  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{
        position: "relative",
        width: W, height: H,
        flexShrink: 0,
        cursor: "pointer",
        // Fan rotation lives here — this div never moves, preventing jitter
        transform: `rotate(${fanCfg.rotate}deg) translateY(${fanCfg.yOffset}px)`,
        transformOrigin: "bottom center",
        zIndex: isHovered ? 100 : baseZ,
      }}
    >
      {/* Inner visual — lifts smoothly on hover, pointer-events off so it doesn't steal events */}
      <div style={{
        position: "absolute", inset: 0,
        transform: isHovered
          ? `translateY(-${liftY}px) scale(${liftScale})`
          : "translateY(0) scale(1)",
        transformOrigin: "bottom center",
        transition: "transform 0.26s ease-out, filter 0.2s ease",
        filter: isHovered
          ? `drop-shadow(0 0 18px ${card.border}cc) drop-shadow(0 0 36px ${card.border}66)`
          : "drop-shadow(0 4px 14px rgba(0,0,0,0.75))",
        pointerEvents: "none",
      }}>
        <div style={{
          width: "100%", height: "100%", borderRadius: 10,
          border: `2px solid ${isHovered ? card.border : card.border + "99"}`,
          overflow: "hidden", background: "#0a0810",
          boxShadow: isHovered ? `inset 0 0 24px ${card.border}33` : "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
          position: "relative",
        }}>
          {/* Art — objectPosition top so faces/heads show */}
          <img
            src={card.img} alt={card.name}
            style={{ width:"100%", height:"72%", objectFit:"cover", objectPosition:"center", display:"block" }}
          />
          {/* Name bar */}
          <div style={{
            position:"absolute", bottom:0, left:0, right:0, height:"30%",
            background:"linear-gradient(180deg,rgba(6,2,14,0.9) 0%,rgba(6,2,14,1) 100%)",
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
            padding:"0 5px", gap:2,
          }}>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize: inline ? 7.5 : 8.5, color:"#f0e4ff", fontWeight:700, textAlign:"center", lineHeight:1.15, letterSpacing:0.3 }}>{card.name}</div>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize: inline ? 6 : 7, color:card.border, letterSpacing:1 }}>{card.type}</div>
          </div>
          {/* Cost gem */}
          <div style={{
            position:"absolute", top:5, left:5,
            width: inline ? 18 : 22, height: inline ? 18 : 22, borderRadius:"50%",
            background:"linear-gradient(135deg,#2a1a6a,#4a2a9a)",
            border:`1px solid ${card.border}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"'Cinzel',serif", fontSize: inline ? 9 : 11, fontWeight:700, color:"#e0c8ff",
            boxShadow:`0 0 8px ${card.border}88`,
          }}>{card.cost}</div>
          {/* Stats */}
          {card.atk != null && (<>
            <div style={{ position:"absolute", bottom:"30%", left:4, fontFamily:"'Cinzel',serif", fontSize: inline ? 8 : 9.5, fontWeight:700, color:"#ff9070", textShadow:"0 1px 3px rgba(0,0,0,0.9)" }}>{card.atk}</div>
            <div style={{ position:"absolute", bottom:"30%", right:4, fontFamily:"'Cinzel',serif", fontSize: inline ? 8 : 9.5, fontWeight:700, color:"#70e890", textShadow:"0 1px 3px rgba(0,0,0,0.9)" }}>{card.hp}</div>
          </>)}
          {/* Champion glow */}
          {card.rarity === "Legendary" && (
            <div style={{ position:"absolute", inset:0, borderRadius:8, boxShadow:"inset 0 0 18px rgba(240,200,30,0.2), 0 0 24px rgba(240,200,30,0.18)", pointerEvents:"none" }} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForgeAndFableTeaser({ inline = false }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [modalCard, setModalCard] = useState(null);

  const fan = (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap: inline ? 12 : 22, userSelect:"none" }}>
      <div style={{
        position:"relative", display:"flex", alignItems:"flex-end", justifyContent:"center",
        paddingBottom: inline ? 36 : 50,
        paddingTop:    inline ? 72 : 104,
        paddingLeft:   inline ? 16 : 20,
        paddingRight:  inline ? 16 : 20,
      }}>
        {FABLES_CARDS.map((card, i) => (
          <FanCard
            key={card.id}
            card={card}
            fanCfg={FAN_CONFIG[i] || { rotate: 0, yOffset: 0 }}
            isHovered={hoveredId === card.id}
            // Center card highest base z so it sits on top by default
            baseZ={7 - Math.abs(i - 3)}
            onHover={() => setHoveredId(card.id)}
            onLeave={() => setHoveredId(null)}
            onClick={() => setModalCard(card)}
            inline={inline}
          />
        ))}
      </div>

      {/* Title / tagline */}
      <div style={{ textAlign:"center", marginTop: inline ? -10 : -6 }}>
        <div style={{
          fontFamily:"'Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif",
          fontSize: inline ? 22 : 34, fontStyle:"italic",
          letterSpacing: inline ? 3 : 5,
          color: hoveredId ? "#d4b0f0" : "#a070d0",
          textShadow: hoveredId ? "0 0 28px #9070ffbb, 0 0 56px #9070ff44" : "0 0 10px #9070ff33",
          transition:"color 0.4s, text-shadow 0.4s", lineHeight:1,
        }}>The Fables</div>
        <div style={{
          fontFamily:"'Cinzel',Georgia,serif", fontSize: inline ? 11 : 13,
          letterSpacing: inline ? 4 : 6, color:"#ffffff", textTransform:"uppercase",
          marginTop:8, fontWeight:700,
          textShadow:"0 1px 6px rgba(0,0,0,0.95), 0 0 16px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
        }}>A card game of myth and war</div>
        <div style={{
          fontFamily:"'Cinzel',Georgia,serif", fontSize: inline ? 10 : 12,
          letterSpacing:4, color:"#ffffff", textTransform:"uppercase",
          marginTop:8, fontWeight:700,
          padding: inline ? "4px 16px" : "5px 20px",
          border:"1px solid rgba(255,255,255,0.3)", borderRadius:20,
          display:"inline-block", background:"rgba(0,0,0,0.5)",
          textShadow:"0 1px 4px rgba(0,0,0,0.9)",
        }}>— Coming Soon —</div>
      </div>

      {modalCard && <CardModal card={modalCard} onClose={() => setModalCard(null)} />}
    </div>
  );

  if (inline) return fan;

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:10,
      background:"radial-gradient(ellipse at 50% 55%, #120a24 0%, #080412 50%, #040208 100%)",
      display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden",
    }}>
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} style={{
          position:"absolute", borderRadius:"50%",
          width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
          background: i % 4 === 0 ? "#e8c060" : "#9070ff",
          top:`${20 + (i * 41) % 60}%`, left:`${10 + (i * 67) % 80}%`,
          opacity: 0.05 + (i % 5) * 0.025,
          animation:`teaserFloat ${3 + (i % 4)}s ease-in-out ${(i * 0.4) % 3}s infinite alternate`,
          pointerEvents:"none",
        }} />
      ))}
      {fan}
      <style>{`@keyframes teaserFloat { 0%{transform:translateY(0)} 100%{transform:translateY(-8px)} }`}</style>
    </div>
  );
}
