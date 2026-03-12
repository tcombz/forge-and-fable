import { useState, useEffect } from "react";

export default function ForgeAndFableTeaser() {
  const [hovered, setHovered] = useState(false);
  const [pageTick, setPageTick] = useState(false);

  // Subtle idle page flutter every few seconds
  useEffect(() => {
    if (hovered) return;
    const id = setInterval(() => {
      setPageTick(p => !p);
      setTimeout(() => setPageTick(p => !p), 400);
    }, 4000);
    return () => clearInterval(id);
  }, [hovered]);

  const pageFlip = hovered || pageTick;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10,
      background: "radial-gradient(ellipse at 50% 60%, #1a0e04 0%, #0a0604 50%, #050302 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      overflow: "hidden",
    }}>
      {/* Ambient light glow */}
      <div style={{
        position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)",
        width: 600, height: 400, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(232,192,96,0.06) 0%, transparent 70%)",
        pointerEvents: "none", transition: "opacity 0.8s",
        opacity: hovered ? 1 : 0.4,
      }} />

      {/* Floating dust particles */}
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          width: i % 3 === 0 ? 3 : 2,
          height: i % 3 === 0 ? 3 : 2,
          borderRadius: "50%",
          background: "#e8c060",
          top: `${20 + (i * 41) % 60}%`,
          left: `${10 + (i * 67) % 80}%`,
          opacity: 0.08 + (i % 5) * 0.04,
          animation: `teaserFloat ${3 + (i % 4)}s ease-in-out ${(i * 0.4) % 3}s infinite alternate`,
          pointerEvents: "none",
        }} />
      ))}

      {/* Book container — 3D perspective */}
      <div
        style={{ perspective: 1200, cursor: "pointer", userSelect: "none" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{
          position: "relative",
          width: 340, height: 260,
          transformStyle: "preserve-3d",
          transition: "transform 0.6s ease",
          transform: hovered ? "rotateX(4deg) rotateY(-6deg)" : "rotateX(0deg) rotateY(0deg)",
        }}>
          {/* Book spine shadow */}
          <div style={{
            position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
            width: 14, height: "calc(100% - 16px)",
            background: "linear-gradient(180deg, #2a1a08 0%, #1a0e04 50%, #2a1a08 100%)",
            borderRadius: 2, zIndex: 3,
            boxShadow: hovered ? "0 0 20px #e8c06033" : "0 0 8px rgba(0,0,0,0.8)",
            transition: "box-shadow 0.5s",
          }} />

          {/* LEFT PAGE */}
          <div style={{
            position: "absolute", top: 0, left: 0,
            width: "50%", height: "100%",
            background: "linear-gradient(135deg, #1e1608 0%, #16100a 40%, #1a1206 100%)",
            border: "1px solid #3a2c12",
            borderRight: "none",
            borderRadius: "8px 0 0 8px",
            transformOrigin: "right center",
            transformStyle: "preserve-3d",
            transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1), box-shadow 0.55s",
            transform: pageFlip ? "rotateY(-22deg)" : "rotateY(0deg)",
            boxShadow: pageFlip ? "-8px 0 30px rgba(232,192,96,0.18), -2px 0 8px rgba(0,0,0,0.6)" : "-2px 0 8px rgba(0,0,0,0.6)",
            zIndex: 2,
            overflow: "hidden",
          }}>
            {/* Page lines */}
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{
                position: "absolute",
                top: `${18 + i * 11}%`, left: "12%", right: "18%", height: 1,
                background: `rgba(232,192,96,${0.04 + i * 0.01})`,
                borderRadius: 1,
              }} />
            ))}
            {/* Corner ornament */}
            <div style={{ position: "absolute", bottom: 12, right: 14, fontSize: 13, color: "#e8c06033", fontFamily: "Georgia, serif" }}>❧</div>
            {/* Page edge highlight */}
            <div style={{ position: "absolute", top: 0, right: 0, width: 2, height: "100%", background: "linear-gradient(180deg, transparent, rgba(232,192,96,0.15), transparent)" }} />
          </div>

          {/* RIGHT PAGE */}
          <div style={{
            position: "absolute", top: 0, right: 0,
            width: "50%", height: "100%",
            background: "linear-gradient(225deg, #1e1608 0%, #16100a 40%, #1a1206 100%)",
            border: "1px solid #3a2c12",
            borderLeft: "none",
            borderRadius: "0 8px 8px 0",
            transformOrigin: "left center",
            transformStyle: "preserve-3d",
            transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1), box-shadow 0.55s",
            transform: pageFlip ? "rotateY(22deg)" : "rotateY(0deg)",
            boxShadow: pageFlip ? "8px 0 30px rgba(232,192,96,0.18), 2px 0 8px rgba(0,0,0,0.6)" : "2px 0 8px rgba(0,0,0,0.6)",
            zIndex: 2,
            overflow: "hidden",
          }}>
            {/* Page lines */}
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{
                position: "absolute",
                top: `${18 + i * 11}%`, left: "18%", right: "12%", height: 1,
                background: `rgba(232,192,96,${0.04 + i * 0.01})`,
                borderRadius: 1,
              }} />
            ))}
            {/* Corner ornament */}
            <div style={{ position: "absolute", bottom: 12, left: 14, fontSize: 13, color: "#e8c06033", fontFamily: "Georgia, serif" }}>❧</div>
            {/* Page edge highlight */}
            <div style={{ position: "absolute", top: 0, left: 0, width: 2, height: "100%", background: "linear-gradient(180deg, transparent, rgba(232,192,96,0.15), transparent)" }} />
          </div>

          {/* TITLE centered over spine */}
          <div style={{
            position: "absolute", inset: 0, zIndex: 10,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <div style={{
              fontFamily: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
              fontSize: 46,
              fontWeight: 400,
              fontStyle: "italic",
              letterSpacing: 4,
              color: hovered ? "#f0d878" : "#c8a040",
              textShadow: hovered
                ? "0 0 18px #e8c060cc, 0 0 40px #e8c06066, 0 0 80px #e8c06033"
                : "0 0 8px #e8c06033",
              transition: "color 0.5s, text-shadow 0.5s",
              lineHeight: 1,
            }}>
              The Fables
            </div>
            <div style={{
              marginTop: 10,
              width: hovered ? 120 : 60,
              height: 1,
              background: "linear-gradient(90deg, transparent, #e8c060, transparent)",
              transition: "width 0.5s",
              opacity: hovered ? 0.8 : 0.3,
            }} />
          </div>
        </div>
      </div>

      {/* Tagline */}
      <div style={{
        marginTop: 36,
        fontFamily: "'Cinzel', Georgia, serif",
        fontSize: 10,
        letterSpacing: 6,
        color: hovered ? "#806040" : "#3a2a12",
        textTransform: "uppercase",
        transition: "color 0.5s",
      }}>
        A card game of myth and war
      </div>

      <style>{`
        @keyframes teaserFloat {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
