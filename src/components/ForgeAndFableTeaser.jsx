import { useState, useEffect } from "react";

// inline=true: renders as a contained element for use inside other components
// inline=false (default): full-screen overlay for logged-out landing
export default function ForgeAndFableTeaser({ inline = false }) {
  const [hovered, setHovered] = useState(false);
  const [pageTick, setPageTick] = useState(false);

  useEffect(() => {
    if (hovered) return;
    const id = setInterval(() => {
      setPageTick(p => !p);
      setTimeout(() => setPageTick(p => !p), 400);
    }, 4000);
    return () => clearInterval(id);
  }, [hovered]);

  const pageFlip = hovered || pageTick;

  // Inline mode: scaled-down book only, no overlay
  if (inline) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 0" }}>
        <div
          style={{ perspective: 900, cursor: "default", userSelect: "none" }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div style={{
            position: "relative", width: 220, height: 168,
            transformStyle: "preserve-3d",
            transition: "transform 0.6s ease",
            transform: hovered ? "rotateX(4deg) rotateY(-6deg)" : "rotateX(0deg) rotateY(0deg)",
          }}>
            {/* Spine */}
            <div style={{ position: "absolute", top: 5, left: "50%", transform: "translateX(-50%)", width: 10, height: "calc(100% - 10px)", background: "linear-gradient(180deg,#2a1a08,#1a0e04,#2a1a08)", borderRadius: 2, zIndex: 3, boxShadow: hovered ? "0 0 16px #e8c06044" : "0 0 6px rgba(0,0,0,0.8)", transition: "box-shadow 0.5s" }} />
            {/* Left page */}
            <div style={{ position: "absolute", top: 0, left: 0, width: "50%", height: "100%", background: "linear-gradient(135deg,#1e1608,#16100a,#1a1206)", border: "1px solid #3a2c12", borderRight: "none", borderRadius: "6px 0 0 6px", transformOrigin: "right center", transformStyle: "preserve-3d", transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1), box-shadow 0.55s", transform: pageFlip ? "rotateY(-22deg)" : "rotateY(0deg)", boxShadow: pageFlip ? "-6px 0 22px rgba(232,192,96,0.18)" : "-2px 0 6px rgba(0,0,0,0.6)", zIndex: 2, overflow: "hidden" }}>
              {Array.from({ length: 5 }).map((_,i) => (<div key={i} style={{ position: "absolute", top: `${20+i*13}%`, left:"12%", right:"18%", height:1, background:`rgba(232,192,96,${0.04+i*0.01})`, borderRadius:1 }} />))}
              <div style={{ position: "absolute", bottom: 8, right: 10, fontSize: 10, color: "#e8c06033", fontFamily: "Georgia,serif" }}>❧</div>
            </div>
            {/* Right page */}
            <div style={{ position: "absolute", top: 0, right: 0, width: "50%", height: "100%", background: "linear-gradient(225deg,#1e1608,#16100a,#1a1206)", border: "1px solid #3a2c12", borderLeft: "none", borderRadius: "0 6px 6px 0", transformOrigin: "left center", transformStyle: "preserve-3d", transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1), box-shadow 0.55s", transform: pageFlip ? "rotateY(22deg)" : "rotateY(0deg)", boxShadow: pageFlip ? "6px 0 22px rgba(232,192,96,0.18)" : "2px 0 6px rgba(0,0,0,0.6)", zIndex: 2, overflow: "hidden" }}>
              {Array.from({ length: 5 }).map((_,i) => (<div key={i} style={{ position: "absolute", top: `${20+i*13}%`, left:"18%", right:"12%", height:1, background:`rgba(232,192,96,${0.04+i*0.01})`, borderRadius:1 }} />))}
              <div style={{ position: "absolute", bottom: 8, left: 10, fontSize: 10, color: "#e8c06033", fontFamily: "Georgia,serif" }}>❧</div>
            </div>
            {/* Title */}
            <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ fontFamily: "'Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif", fontSize: 30, fontWeight: 400, fontStyle: "italic", letterSpacing: 3, color: hovered ? "#f0d878" : "#c8a040", textShadow: hovered ? "0 0 14px #e8c060cc, 0 0 30px #e8c06066" : "0 0 6px #e8c06033", transition: "color 0.5s,text-shadow 0.5s", lineHeight: 1 }}>The Fables</div>
              <div style={{ marginTop: 8, width: hovered ? 80 : 40, height: 1, background: "linear-gradient(90deg,transparent,#e8c060,transparent)", transition: "width 0.5s", opacity: hovered ? 0.8 : 0.3 }} />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, fontFamily: "'Cinzel',Georgia,serif", fontSize: 8, letterSpacing: 5, color: hovered ? "#806040" : "#2a1a08", textTransform: "uppercase", transition: "color 0.5s" }}>A card game of myth and war</div>
        <style>{`@keyframes teaserFloat { 0%{transform:translateY(0)} 100%{transform:translateY(-8px)} }`}</style>
      </div>
    );
  }

  // Full-screen overlay for logged-out landing
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10,
      background: "radial-gradient(ellipse at 50% 60%, #1a0e04 0%, #0a0604 50%, #050302 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)", width: 600, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(232,192,96,0.06) 0%,transparent 70%)", pointerEvents: "none", transition: "opacity 0.8s", opacity: hovered ? 1 : 0.4 }} />
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", width: i%3===0?3:2, height: i%3===0?3:2, borderRadius: "50%", background: "#e8c060", top: `${20+(i*41)%60}%`, left: `${10+(i*67)%80}%`, opacity: 0.08+(i%5)*0.04, animation: `teaserFloat ${3+(i%4)}s ease-in-out ${(i*0.4)%3}s infinite alternate`, pointerEvents: "none" }} />
      ))}
      <div style={{ perspective: 1200, cursor: "pointer", userSelect: "none" }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div style={{ position: "relative", width: 340, height: 260, transformStyle: "preserve-3d", transition: "transform 0.6s ease", transform: hovered ? "rotateX(4deg) rotateY(-6deg)" : "rotateX(0deg) rotateY(0deg)" }}>
          <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 14, height: "calc(100% - 16px)", background: "linear-gradient(180deg,#2a1a08,#1a0e04,#2a1a08)", borderRadius: 2, zIndex: 3, boxShadow: hovered ? "0 0 20px #e8c06033" : "0 0 8px rgba(0,0,0,0.8)", transition: "box-shadow 0.5s" }} />
          <div style={{ position: "absolute", top: 0, left: 0, width: "50%", height: "100%", background: "linear-gradient(135deg,#1e1608,#16100a,#1a1206)", border: "1px solid #3a2c12", borderRight: "none", borderRadius: "8px 0 0 8px", transformOrigin: "right center", transformStyle: "preserve-3d", transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1),box-shadow 0.55s", transform: pageFlip ? "rotateY(-22deg)" : "rotateY(0deg)", boxShadow: pageFlip ? "-8px 0 30px rgba(232,192,96,0.18),-2px 0 8px rgba(0,0,0,0.6)" : "-2px 0 8px rgba(0,0,0,0.6)", zIndex: 2, overflow: "hidden" }}>
            {Array.from({ length: 7 }).map((_,i) => (<div key={i} style={{ position:"absolute", top:`${18+i*11}%`, left:"12%", right:"18%", height:1, background:`rgba(232,192,96,${0.04+i*0.01})`, borderRadius:1 }} />))}
            <div style={{ position:"absolute", bottom:12, right:14, fontSize:13, color:"#e8c06033", fontFamily:"Georgia,serif" }}>❧</div>
            <div style={{ position:"absolute", top:0, right:0, width:2, height:"100%", background:"linear-gradient(180deg,transparent,rgba(232,192,96,0.15),transparent)" }} />
          </div>
          <div style={{ position: "absolute", top: 0, right: 0, width: "50%", height: "100%", background: "linear-gradient(225deg,#1e1608,#16100a,#1a1206)", border: "1px solid #3a2c12", borderLeft: "none", borderRadius: "0 8px 8px 0", transformOrigin: "left center", transformStyle: "preserve-3d", transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1),box-shadow 0.55s", transform: pageFlip ? "rotateY(22deg)" : "rotateY(0deg)", boxShadow: pageFlip ? "8px 0 30px rgba(232,192,96,0.18),2px 0 8px rgba(0,0,0,0.6)" : "2px 0 8px rgba(0,0,0,0.6)", zIndex: 2, overflow: "hidden" }}>
            {Array.from({ length: 7 }).map((_,i) => (<div key={i} style={{ position:"absolute", top:`${18+i*11}%`, left:"18%", right:"12%", height:1, background:`rgba(232,192,96,${0.04+i*0.01})`, borderRadius:1 }} />))}
            <div style={{ position:"absolute", bottom:12, left:14, fontSize:13, color:"#e8c06033", fontFamily:"Georgia,serif" }}>❧</div>
            <div style={{ position:"absolute", top:0, left:0, width:2, height:"100%", background:"linear-gradient(180deg,transparent,rgba(232,192,96,0.15),transparent)" }} />
          </div>
          <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ fontFamily: "'Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif", fontSize: 46, fontWeight: 400, fontStyle: "italic", letterSpacing: 4, color: hovered ? "#f0d878" : "#c8a040", textShadow: hovered ? "0 0 18px #e8c060cc,0 0 40px #e8c06066,0 0 80px #e8c06033" : "0 0 8px #e8c06033", transition: "color 0.5s,text-shadow 0.5s", lineHeight: 1 }}>The Fables</div>
            <div style={{ marginTop: 10, width: hovered ? 120 : 60, height: 1, background: "linear-gradient(90deg,transparent,#e8c060,transparent)", transition: "width 0.5s", opacity: hovered ? 0.8 : 0.3 }} />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 36, fontFamily: "'Cinzel',Georgia,serif", fontSize: 10, letterSpacing: 6, color: hovered ? "#806040" : "#3a2a12", textTransform: "uppercase", transition: "color 0.5s" }}>A card game of myth and war</div>
      <style>{`@keyframes teaserFloat { 0%{transform:translateY(0)} 100%{transform:translateY(-8px)} }`}</style>
    </div>
  );
}
