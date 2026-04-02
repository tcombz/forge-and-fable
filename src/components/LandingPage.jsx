import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

// ─── Animated background particles ───────────────────────────────────────────
function Particles({ count = 24, color = "#e8c060" }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          position: "absolute", borderRadius: "50%", pointerEvents: "none",
          width: i % 4 === 0 ? 3 : i % 3 === 0 ? 2 : 1.5,
          height: i % 4 === 0 ? 3 : i % 3 === 0 ? 2 : 1.5,
          background: i % 5 === 0 ? "#9070ff" : color,
          top: `${5 + (i * 37) % 90}%`, left: `${3 + (i * 61) % 94}%`,
          opacity: 0.04 + (i % 6) * 0.018,
          animation: `landingFloat ${3 + (i % 5)}s ease-in-out ${(i * 0.35) % 4}s infinite alternate`,
        }} />
      ))}
    </>
  );
}

// ─── Faction badge strip ──────────────────────────────────────────────────────
const FACTIONS = [
  { name: "Thornwood",        color: "#70e830" },
  { name: "Azure Deep",       color: "#30c0ff" },
  { name: "Ashfen",           color: "#ff6820" },
  { name: "Shattered Expanse",color: "#c090ff" },
  { name: "Ironmarch",        color: "#9090ff" },
  { name: "Sunveil",          color: "#ffd030" },
  { name: "Food Fight",       color: "#ff6040" },
  { name: "Fables",           color: "#b090ff" },
];

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, body, accent }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? `rgba(14,10,5,0.95)` : "rgba(10,7,3,0.8)",
        border: `1px solid ${hov ? accent + "66" : "#2a1f0e"}`,
        borderRadius: 14,
        padding: "28px 24px",
        transition: "border-color .25s, box-shadow .25s, transform .25s",
        boxShadow: hov ? `0 0 30px ${accent}22, 0 8px 32px rgba(0,0,0,0.5)` : "0 4px 16px rgba(0,0,0,0.4)",
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        display: "flex", flexDirection: "column", gap: 12,
      }}
    >
      <div style={{ fontSize: 36, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 700, color: accent, letterSpacing: 2 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#907060", lineHeight: 1.8, fontFamily: "'Lora',serif" }}>{body}</div>
    </div>
  );
}

// ─── Step (How It Works) ──────────────────────────────────────────────────────
function Step({ num, title, body }) {
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: "center", padding: "0 12px" }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%", margin: "0 auto 16px",
        background: "linear-gradient(135deg,#1a1004,#2e1e08)",
        border: "2px solid #c89010",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Cinzel',serif", fontSize: 20, fontWeight: 900, color: "#e8c060",
        boxShadow: "0 0 20px #c8901040",
      }}>{num}</div>
      <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, fontWeight: 700, color: "#e8c060", letterSpacing: 2, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#7a6050", lineHeight: 1.8, fontFamily: "'Lora',serif" }}>{body}</div>
    </div>
  );
}

// ─── Stat counter ─────────────────────────────────────────────────────────────
function AnimatedCount({ target }) {
  const [val, setVal] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    if (!target) return;
    const dur = 1200, start = Date.now(), from = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);
  return <>{val.toLocaleString()}</>;
}

// ─── Main Landing Page ────────────────────────────────────────────────────────
export default function LandingPage({ onPlayNow, onSignIn }) {
  const [stats, setStats]   = useState(null);
  const [statsVis, setStatsVis] = useState(false);
  const statsRef = useRef(null);

  // Fetch global activity stats (anon-accessible SECURITY DEFINER RPC)
  useEffect(() => {
    supabase.rpc("get_activity_stats").then(({ data }) => {
      if (data) setStats(data);
    });
  }, []);

  // Trigger count animation when stats section scrolls into view
  useEffect(() => {
    if (!statsRef.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVis(true); }, { threshold: 0.3 });
    obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  const divider = (
    <div style={{ width: 60, height: 1, background: "linear-gradient(90deg,transparent,#e8c06044,transparent)", margin: "0 auto" }} />
  );

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10, overflowY: "auto", overflowX: "hidden",
      background: "radial-gradient(ellipse at 50% 0%, #14100a 0%, #0a0804 40%, #060402 100%)",
      fontFamily: "'Cinzel',serif",
    }}>
      <style>{`
        @keyframes landingFloat { 0%{transform:translateY(0)} 100%{transform:translateY(-10px)} }
        @keyframes landingFadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cardGlow { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        .landing-cta {
          padding: 16px 52px;
          background: linear-gradient(135deg, #c89010, #f0c040);
          border: none; border-radius: 10px;
          font-family: 'Cinzel',serif; font-size: 15px; font-weight: 700;
          color: #1a1000; letter-spacing: 2px; cursor: pointer;
          box-shadow: 0 0 32px #f0c04044, 0 4px 20px rgba(0,0,0,0.5);
          transition: transform .15s, box-shadow .15s, opacity .15s;
        }
        .landing-cta:hover { transform: translateY(-2px); box-shadow: 0 0 48px #f0c04066, 0 8px 32px rgba(0,0,0,0.6); }
        .landing-cta:active { transform: translateY(0); }
        .landing-signin-link {
          background: transparent; border: 1px solid #3a2810; border-radius: 8px;
          padding: 10px 24px; font-family: 'Cinzel',serif; font-size: 11px;
          color: #806040; cursor: pointer; letter-spacing: 1px; transition: border-color .2s, color .2s;
        }
        .landing-signin-link:hover { border-color: #e8c06066; color: #c8a060; }
      `}</style>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "80px 24px 60px", position: "relative", overflow: "hidden",
        textAlign: "center",
      }}>
        <Particles count={28} />

        {/* Glow orb behind logo */}
        <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 500, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse,#c8901018 0%,transparent 70%)", pointerEvents: "none" }} />

        {/* Logo */}
        <div style={{ animation: "landingFadeUp .7s ease-out both", position: "relative", zIndex: 1 }}>
          <div style={{
            fontFamily: "'Cinzel',serif", fontSize: "clamp(40px, 7vw, 72px)",
            fontWeight: 900, color: "#e8c060", letterSpacing: "clamp(4px, 1vw, 10px)",
            textShadow: "0 0 60px #c8901066, 0 0 120px #c8901022",
            lineHeight: 1, marginBottom: 4,
          }}>
            FORGE {"&"} FABLE
          </div>
          <div style={{ fontFamily: "'Lora',serif", fontStyle: "italic", fontSize: "clamp(12px, 2vw, 16px)", color: "#c0a060", letterSpacing: 2, marginBottom: 32 }}>
            A free competitive card game — all cards unlocked, no paywalls.
          </div>
        </div>

        {/* Faction badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 40, animation: "landingFadeUp .7s .15s ease-out both", position: "relative", zIndex: 1 }}>
          {FACTIONS.map(f => (
            <span key={f.name} style={{
              padding: "4px 14px", borderRadius: 20,
              border: `1px solid ${f.color}44`,
              background: `${f.color}0d`,
              fontFamily: "'Cinzel',serif", fontSize: 9, letterSpacing: 1,
              color: f.color, fontWeight: 600,
            }}>{f.name}</span>
          ))}
        </div>

        {/* Card fan visual */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 0, marginBottom: 48, animation: "landingFadeUp .7s .25s ease-out both", position: "relative", zIndex: 1 }}>
          {[
            { rot: -18, y: 18, color: "#70e830", src: "/cards/druid.jpg",  label: "Rootcaller Druid",  sub: "Thornwood" },
            { rot:  -6, y:  5, color: "#9070ff", src: "/cards/zeus_storm_father.jpg", label: "Zeus, Storm Father", sub: "Fables" },
            { rot:   0, y:  0, color: "#c89010", src: "/cards/guard.jpg",  label: "Thornwood Guard",   sub: "Thornwood" },
            { rot:   6, y:  5, color: "#ff6820", src: "/cards/pyro.jpg",   label: "Ashfen Pyromancer", sub: "Ashfen" },
            { rot:  18, y: 18, color: "#30c0ff", src: "/cards/tide.jpg",   label: "Tideweave Siren",  sub: "Azure Deep" },
          ].map((c, i) => (
            <div key={i} style={{
              width: 90, height: 126, flexShrink: 0, position: "relative",
              transform: `rotate(${c.rot}deg) translateY(${c.y}px)`,
              transformOrigin: "bottom center",
              zIndex: i === 2 ? 5 : i === 1 || i === 3 ? 4 : 3,
              filter: `drop-shadow(0 4px 12px ${c.color}55) drop-shadow(0 0 20px rgba(0,0,0,0.8))`,
              transition: "filter .2s",
            }}>
              <div style={{ width: "100%", height: "100%", borderRadius: 8, border: `2px solid ${c.color}99`, overflow: "hidden", background: "#0a0810" }}>
                <img src={c.src} alt={c.label} style={{ width: "100%", height: "72%", objectFit: "cover", objectPosition: "center", display: "block" }}
                  onError={e => { e.target.style.display = "none"; }} />
                <div style={{ height: "28%", background: "linear-gradient(180deg,#0a0810,#060410)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 3px", gap: 2 }}>
                  <div style={{ fontFamily: "'Cinzel',serif", fontSize: 6.5, color: "#f0e4ff", fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>{c.label}</div>
                  <div style={{ fontFamily: "'Cinzel',serif", fontSize: 5.5, color: c.color, letterSpacing: 1 }}>{c.sub}</div>
                </div>
                {/* Glow rim */}
                <div style={{ position: "absolute", inset: 0, borderRadius: 7, boxShadow: `inset 0 0 12px ${c.color}22`, pointerEvents: "none" }} />
              </div>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", justifyContent: "center", animation: "landingFadeUp .7s .35s ease-out both", position: "relative", zIndex: 1 }}>
          <button className="landing-cta" onClick={onPlayNow}>PLAY NOW — FREE</button>
          <button className="landing-signin-link" onClick={onSignIn}>Already have an account</button>
        </div>

        {/* Alpha note */}
        <div style={{ marginTop: 20, fontSize: 9, color: "#3a2810", letterSpacing: 2, animation: "landingFadeUp .7s .45s ease-out both", position: "relative", zIndex: 1 }}>
          ALPHA ACCESS · INVITE KEY REQUIRED
        </div>

        {/* Scroll hint */}
        <div style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.3, animation: "landingFloat 2s ease-in-out infinite" }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#e8c060" }}>SCROLL</div>
          <div style={{ width: 1, height: 28, background: "linear-gradient(180deg,#e8c060,transparent)" }} />
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 24px", maxWidth: 900, margin: "0 auto" }}>
        {divider}
        <div style={{ textAlign: "center", margin: "32px 0 48px" }}>
          <div style={{ fontSize: "clamp(18px,3vw,26px)", fontWeight: 700, color: "#e8c060", letterSpacing: 3, marginBottom: 10 }}>WHY FORGE {"&"} FABLE</div>
          <div style={{ fontSize: 12, color: "#6a5040", fontFamily: "'Lora',serif", letterSpacing: 1 }}>No subscriptions. No card packs. No pay-to-win. Just the game.</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <FeatureCard
            icon="🃏"
            accent="#e8c060"
            title="ALL CARDS FREE"
            body="Every card in the game — over 100 across 8 factions — is unlocked the moment you create an account. No packs, no grind, no wallet required."
          />
          <FeatureCard
            icon="⚔️"
            accent="#ff7050"
            title="RANKED PvP"
            body="Queue for rated matches, track your ELO, and climb the global leaderboard. Challenge a friend directly with a shareable link — no matchmaking queue needed."
          />
          <FeatureCard
            icon="🏰"
            accent="#c090ff"
            title="8 FACTIONS"
            body="Thornwood's nature magic, Ashfen's wildfire aggro, Azure Deep's control, Shattered Expanse's cursed power, and more. Each faction plays completely differently."
          />
          <FeatureCard
            icon="📜"
            accent="#40c090"
            title="THE CHRONICLER"
            body="Train against our built-in AI opponent anytime, offline, at your own pace. Perfect for testing new deck builds before taking them to ranked play."
          />
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────────── */}
      <section style={{ padding: "60px 24px 80px", maxWidth: 800, margin: "0 auto" }}>
        {divider}
        <div style={{ textAlign: "center", margin: "32px 0 52px" }}>
          <div style={{ fontSize: "clamp(18px,3vw,26px)", fontWeight: 700, color: "#e8c060", letterSpacing: 3, marginBottom: 10 }}>HOW IT WORKS</div>
          <div style={{ fontSize: 12, color: "#6a5040", fontFamily: "'Lora',serif" }}>You're three steps from your first match.</div>
        </div>

        <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
          <Step
            num="1"
            title="GET ACCESS"
            body="Request an alpha key from the community discord. Create your account in under a minute — just email, password, and your invite key."
          />
          {/* Connector line */}
          <div style={{ display: "flex", alignItems: "center", padding: "0 8px", flexShrink: 0, opacity: 0.2 }}>
            <div style={{ width: 32, height: 1, background: "#e8c060" }} />
          </div>
          <Step
            num="2"
            title="BUILD YOUR DECK"
            body="Browse your full collection — every card unlocked. Filter by faction, type, or keyword. Build up to five custom decks or jump straight in with a random one."
          />
          <div style={{ display: "flex", alignItems: "center", padding: "0 8px", flexShrink: 0, opacity: 0.2 }}>
            <div style={{ width: 32, height: 1, background: "#e8c060" }} />
          </div>
          <Step
            num="3"
            title="BATTLE & RANK UP"
            body="Queue for ranked PvP, challenge a friend with a link, or spar against the AI. Earn shards, complete daily quests, and climb the leaderboard."
          />
        </div>
      </section>

      {/* ── LIVE STATS ────────────────────────────────────────────────────────── */}
      <section ref={statsRef} style={{ padding: "60px 24px 80px", maxWidth: 700, margin: "0 auto" }}>
        {divider}
        <div style={{ textAlign: "center", margin: "32px 0 44px" }}>
          <div style={{ fontSize: "clamp(18px,3vw,24px)", fontWeight: 700, color: "#e8c060", letterSpacing: 3, marginBottom: 8 }}>LIVE ACTIVITY</div>
          <div style={{ fontSize: 12, color: "#6a5040", fontFamily: "'Lora',serif" }}>Real-time counts from the server.</div>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {[
            {
              label: "ACTIVE BATTLES NOW",
              value: statsVis && stats ? stats.active_matches : null,
              icon: "⚔️", color: "#e8c060",
            },
            {
              label: "MATCHES TODAY",
              value: statsVis && stats ? stats.today_matches : null,
              icon: "📅", color: "#78cc45",
            },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, minWidth: 180,
              background: "rgba(10,7,3,0.8)", border: `1px solid ${s.color}22`,
              borderRadius: 14, padding: "28px 32px", textAlign: "center",
              boxShadow: `0 0 40px ${s.color}0a`,
            }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{s.icon}</div>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 40, fontWeight: 900, color: s.color, lineHeight: 1, marginBottom: 8, minHeight: 48 }}>
                {s.value !== null && s.value !== undefined
                  ? <AnimatedCount target={s.value} />
                  : <span style={{ opacity: 0.2 }}>—</span>
                }
              </div>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 9, letterSpacing: 3, color: "#403020" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Recent battles ticker */}
        {stats?.recent_matches?.length > 0 && (
          <div style={{ marginTop: 32, background: "rgba(10,7,3,0.6)", border: "1px solid #2a1a08", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 8, color: "#403020", letterSpacing: 3, marginBottom: 12 }}>RECENT BATTLES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {stats.recent_matches.map((m, i) => {
                const winnerName = m.winner === "p1" ? m.p1_name : m.p2_name;
                const loserName  = m.winner === "p1" ? m.p2_name : m.p1_name;
                return (
                  <div key={m.id || i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: "'Cinzel',serif" }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#78cc4555", flexShrink: 0 }} />
                    <span style={{ color: "#78cc45", fontWeight: 700 }}>{winnerName || "Adventurer"}</span>
                    <span style={{ color: "#4a3020" }}>defeated</span>
                    <span style={{ color: "#7a5030" }}>{loserName || "Adventurer"}</span>
                    {m.ranked && <span style={{ fontSize: 7, color: "#8060c0", background: "rgba(128,96,192,0.1)", border: "1px solid #40306044", borderRadius: 3, padding: "1px 5px", letterSpacing: 1 }}>RANKED</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── BOTTOM CTA ────────────────────────────────────────────────────────── */}
      <section style={{
        padding: "80px 24px 100px", textAlign: "center",
        borderTop: "1px solid #1a1208",
        background: "linear-gradient(180deg, transparent 0%, rgba(8,5,2,0.95) 100%)",
        position: "relative", overflow: "hidden",
      }}>
        <Particles count={16} color="#c89010" />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: "clamp(22px,4vw,38px)", fontWeight: 900, color: "#e8c060", letterSpacing: "clamp(2px,0.5vw,6px)", marginBottom: 12, textShadow: "0 0 40px #c8901044" }}>
            READY TO FORGE YOUR LEGEND?
          </div>
          <div style={{ fontSize: 13, color: "#7a6050", fontFamily: "'Lora',serif", marginBottom: 40, maxWidth: 480, margin: "0 auto 40px" }}>
            Free forever. All cards unlocked. Ranked PvP and AI training available from day one.
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
            <button className="landing-cta" onClick={onPlayNow}>CREATE FREE ACCOUNT</button>
            <button className="landing-signin-link" onClick={onSignIn}>Sign In</button>
          </div>
          <div style={{ marginTop: 24, fontSize: 9, color: "#2a1c0a", letterSpacing: 2 }}>
            ALPHA · INVITE KEY REQUIRED · v19
          </div>
        </div>
      </section>
    </div>
  );
}
