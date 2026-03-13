import { useState } from "react";

export default function ForgeAndFableTeaser({ inline = false }) {
  const [hovered, setHovered] = useState(false);

  const book = (
    <div
      style={{ display:"flex", flexDirection:"column", alignItems:"center", gap: inline ? 12 : 28 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Book cover */}
      <div style={{
        position: "relative",
        width: inline ? 180 : 280,
        height: inline ? 230 : 360,
        cursor: "default",
        animation: hovered ? "bookShake 0.5s ease-in-out" : undefined,
        transition: "transform 0.4s ease, filter 0.4s ease",
        transform: hovered ? "translateY(-6px) scale(1.03)" : "translateY(0) scale(1)",
        filter: hovered
          ? "drop-shadow(0 0 28px #e8c060cc) drop-shadow(0 0 60px #e8c06066)"
          : "drop-shadow(0 8px 24px rgba(0,0,0,0.8))",
      }}>
        {/* Book body */}
        <div style={{
          width: "100%", height: "100%",
          background: "linear-gradient(160deg, #2a1e08 0%, #1c1408 30%, #221a08 60%, #1a1206 100%)",
          border: `2px solid ${hovered ? "#c8a040" : "#4a3418"}`,
          borderRadius: 8,
          position: "relative",
          overflow: "hidden",
          transition: "border-color 0.4s",
          boxShadow: hovered
            ? "inset 0 0 40px rgba(232,192,96,0.08), inset 0 0 80px rgba(232,192,96,0.04)"
            : "inset 0 0 20px rgba(0,0,0,0.5)",
        }}>
          {/* Spine line */}
          <div style={{ position:"absolute", top:0, left:18, width:3, height:"100%", background:"linear-gradient(180deg,#0a0804,#2a1a08,#0a0804)", zIndex:2 }} />
          {/* Page lines left */}
          {Array.from({length: inline ? 8 : 12}).map((_,i) => (
            <div key={i} style={{ position:"absolute", top:`${14+i*(inline?8:6.5)}%`, left:"15%", right:"10%", height:1, background:`rgba(232,192,96,${hovered ? 0.09+i*0.005 : 0.04+i*0.003})`, borderRadius:1, transition:"background 0.4s" }} />
          ))}
          {/* Corner ornaments */}
          <div style={{ position:"absolute", top:10, left:24, fontSize: inline?12:16, color: hovered?"#e8c06055":"#3a2810", fontFamily:"Georgia,serif", transition:"color 0.4s" }}>❧</div>
          <div style={{ position:"absolute", bottom:10, right:14, fontSize: inline?12:16, color: hovered?"#e8c06055":"#3a2810", fontFamily:"Georgia,serif", transform:"scaleX(-1)", transition:"color 0.4s" }}>❧</div>
          {/* Ambient glow overlay */}
          <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse at 50% 45%, rgba(232,192,96,${hovered?0.07:0.02}) 0%, transparent 65%)`, pointerEvents:"none", transition:"background 0.5s", borderRadius:6 }} />
          {/* Title */}
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, pointerEvents:"none" }}>
            {/* Decorative line top */}
            <div style={{ width: hovered ? (inline?80:120) : (inline?40:60), height:1, background:"linear-gradient(90deg,transparent,#e8c060,transparent)", transition:"width 0.5s, opacity 0.4s", opacity: hovered?0.7:0.2 }} />
            <div style={{
              fontFamily:"'Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif",
              fontSize: inline ? 26 : 42,
              fontWeight: 400, fontStyle:"italic",
              letterSpacing: inline ? 3 : 5,
              color: hovered ? "#f0d878" : "#b89030",
              textShadow: hovered ? "0 0 20px #e8c060cc, 0 0 50px #e8c06055" : "0 0 8px #e8c06022",
              transition:"color 0.4s, text-shadow 0.4s",
              lineHeight:1, textAlign:"center",
            }}>The Fables</div>
            {/* Decorative line bottom */}
            <div style={{ width: hovered ? (inline?80:120) : (inline?40:60), height:1, background:"linear-gradient(90deg,transparent,#e8c060,transparent)", transition:"width 0.5s, opacity 0.4s", opacity: hovered?0.7:0.2 }} />
          </div>
        </div>
        {/* Book bottom shadow */}
        <div style={{ position:"absolute", bottom:-8, left:"10%", right:"10%", height:8, background:"rgba(0,0,0,0.5)", borderRadius:"50%", filter:"blur(6px)" }} />
      </div>

      {/* Tagline */}
      <div style={{ textAlign:"center" }}>
        <div style={{ fontFamily:"'Cinzel',Georgia,serif", fontSize: inline?9:11, letterSpacing: inline?4:6, color: hovered?"#c8a040":"#3a2810", textTransform:"uppercase", transition:"color 0.4s", marginBottom:6 }}>
          A card game of myth and war
        </div>
        <div style={{ fontFamily:"'Cinzel',Georgia,serif", fontSize: inline?8:10, letterSpacing:3, color: hovered?"#806040":"#2a1808", textTransform:"uppercase", padding: inline?"2px 14px":"3px 18px", border:`1px solid ${hovered?"#60401866":"transparent"}`, borderRadius:20, display:"inline-block", background: hovered?"rgba(232,192,96,0.04)":"transparent", transition:"all 0.4s" }}>
          — Coming Soon —
        </div>
      </div>

      <style>{`
        @keyframes bookShake {
          0%   { transform: translateY(-6px) scale(1.03) rotate(0deg); }
          20%  { transform: translateY(-6px) scale(1.03) rotate(-1.5deg); }
          40%  { transform: translateY(-6px) scale(1.03) rotate(1.5deg); }
          60%  { transform: translateY(-6px) scale(1.03) rotate(-1deg); }
          80%  { transform: translateY(-6px) scale(1.03) rotate(0.5deg); }
          100% { transform: translateY(-6px) scale(1.03) rotate(0deg); }
        }
      `}</style>
    </div>
  );

  if (inline) return book;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10,
      background: "radial-gradient(ellipse at 50% 55%, #1a0e04 0%, #0a0604 50%, #050302 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden",
    }}>
      {/* Floating dust */}
      {Array.from({length:12}).map((_,i) => (
        <div key={i} style={{ position:"absolute", width:i%3===0?3:2, height:i%3===0?3:2, borderRadius:"50%", background:"#e8c060", top:`${20+(i*41)%60}%`, left:`${10+(i*67)%80}%`, opacity:0.06+(i%5)*0.03, animation:`teaserFloat ${3+(i%4)}s ease-in-out ${(i*0.4)%3}s infinite alternate`, pointerEvents:"none" }} />
      ))}
      {book}
      <style>{`@keyframes teaserFloat { 0%{transform:translateY(0)} 100%{transform:translateY(-8px)} }`}</style>
    </div>
  );
}
