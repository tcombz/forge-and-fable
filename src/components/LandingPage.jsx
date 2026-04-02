import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

// ─── Paste your Discord webhook URL here ─────────────────────────────────────
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1489252076415353014/trkBnUYcYDB8FPxE5d0IYrYXpDpou1zpJ617nJy1hJslMa-f6lnHd0nRLhawnr3-hvJ1";
// ─────────────────────────────────────────────────────────────────────────────

// ─── Animated background particles ───────────────────────────────────────────
function Particles({ count = 24, color = "#e8c060" }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          position: "absolute", borderRadius: "50%", pointerEvents: "none",
          width: i % 4 === 0 ? 3 : i % 3 === 0 ? 2 : 1.5,
          height: i % 4 === 0 ? 3 : i % 3 === 0 ? 2 : 1.5,
          background: i % 7 === 0 ? "#c090ff" : i % 5 === 0 ? "#60c0ff" : color,
          top: `${5 + (i * 37) % 90}%`, left: `${3 + (i * 61) % 94}%`,
          opacity: 0.05 + (i % 6) * 0.022,
          animation: `landingFloat ${3.5 + (i % 5) * 0.8}s ease-in-out ${(i * 0.35) % 4}s infinite alternate`,
        }} />
      ))}
    </>
  );
}

// ─── Faction badge strip ──────────────────────────────────────────────────────
const FACTIONS = [
  { name: "Thornwood",         color: "#70e830" },
  { name: "Azure Deep",        color: "#30c0ff" },
  { name: "Ashfen",            color: "#ff6820" },
  { name: "Shattered Expanse", color: "#c090ff" },
  { name: "Ironmarch",         color: "#9090ff" },
  { name: "Sunveil",           color: "#ffd030" },
  { name: "Food Fight",        color: "#ff6040" },
  { name: "Fables",            color: "#b090ff" },
];

// ─── Animated section wrapper (fade-up on scroll) ────────────────────────────
function FadeSection({ children, delay = 0, style = {} }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.12 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      opacity: vis ? 1 : 0,
      transform: vis ? "translateY(0)" : "translateY(28px)",
      transition: `opacity 0.65s ${delay}s ease-out, transform 0.65s ${delay}s ease-out`,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, body, accent, delay = 0 }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  const [hov, setHov] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.15 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.55s ${delay}s ease-out, transform 0.55s ${delay}s ease-out, border-color .25s, box-shadow .25s`,
        background: hov ? "rgba(16,11,5,0.98)" : "rgba(10,7,3,0.85)",
        border: `1px solid ${hov ? accent + "77" : "#2a1f0e"}`,
        borderRadius: 14, padding: "28px 24px",
        boxShadow: hov ? `0 0 40px ${accent}22, 0 8px 40px rgba(0,0,0,0.6)` : "0 4px 20px rgba(0,0,0,0.4)",
        display: "flex", flexDirection: "column", gap: 12,
        cursor: "default",
      }}
    >
      <div style={{ fontSize: 36, lineHeight: 1, filter: hov ? `drop-shadow(0 0 10px ${accent}99)` : "none", transition: "filter .25s" }}>{icon}</div>
      <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 700, color: accent, letterSpacing: 2 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#907060", lineHeight: 1.85, fontFamily: "'Lora',serif" }}>{body}</div>
    </div>
  );
}

// ─── Step (How It Works) ──────────────────────────────────────────────────────
function Step({ num, title, body }) {
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: "center", padding: "0 12px" }}>
      <div style={{
        width: 52, height: 52, borderRadius: "50%", margin: "0 auto 16px",
        background: "linear-gradient(135deg,#1a1004,#2e1e08)",
        border: "2px solid #c89010",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 900, color: "#e8c060",
        boxShadow: "0 0 24px #c8901040",
      }}>{num}</div>
      <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, fontWeight: 700, color: "#e8c060", letterSpacing: 2, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#7a6050", lineHeight: 1.85, fontFamily: "'Lora',serif" }}>{body}</div>
    </div>
  );
}

// ─── Stat counter ─────────────────────────────────────────────────────────────
function AnimatedCount({ target }) {
  const [val, setVal] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    if (!target) return;
    const dur = 1400, start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);
  return <>{val.toLocaleString()}</>;
}

// ─── Interest form (no alpha key needed) ─────────────────────────────────────
function InterestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [how, setHow] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const inp = { width: "100%", padding: "11px 14px", background: "rgba(6,4,2,0.95)", border: "1px solid #2e2010", borderRadius: 9, color: "#f0e8d8", fontSize: 13, fontFamily: "'Lora',serif", outline: "none", boxSizing: "border-box", marginBottom: 10 };

  const submit = async () => {
    if (!name.trim() || !email.trim()) { setErr("Name and email are required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr("Please enter a valid email."); return; }
    setBusy(true); setErr("");

    // Store in Supabase (best-effort — table may not exist yet)
    try {
      await supabase.from("waitlist").insert({ name: name.trim(), email: email.trim().toLowerCase(), how_heard: how.trim() || null });
    } catch (_) { /* non-fatal */ }

    // Send to Discord webhook
    if (DISCORD_WEBHOOK_URL) {
      try {
        await fetch(DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{
              title: "🔮 New Forge & Fable Interest",
              color: 0xc89010,
              fields: [
                { name: "Name",  value: name.trim(),                      inline: true },
                { name: "Email", value: email.trim(),                     inline: true },
                { name: "How they heard", value: how.trim() || "Not specified", inline: false },
              ],
              timestamp: new Date().toISOString(),
              footer: { text: "Forge & Fable Alpha Waitlist" },
            }],
          }),
        });
      } catch (_) { /* non-fatal — still mark done */ }
    }

    setBusy(false);
    setDone(true);
  };

  if (done) return (
    <div style={{ textAlign: "center", padding: "32px 24px", animation: "landingFadeUp .5s ease-out" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
      <div style={{ fontFamily: "'Cinzel',serif", fontSize: 16, fontWeight: 700, color: "#e8c060", letterSpacing: 2, marginBottom: 10 }}>YOU'RE ON THE LIST</div>
      <div style={{ fontSize: 13, color: "#806050", fontFamily: "'Lora',serif", lineHeight: 1.8 }}>We'll reach out with your alpha key soon.<br/>Follow along for updates.</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <input value={name}  onChange={e => setName(e.target.value)}  placeholder="Your name" style={inp} />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" type="email" style={inp} />
      </div>
      <input value={how} onChange={e => setHow(e.target.value)} placeholder="How did you hear about Forge & Fable? (optional)" style={inp} />
      {err && <div style={{ fontSize: 11, color: "#e05050", marginBottom: 10, padding: "6px 10px", background: "rgba(200,30,30,0.1)", borderRadius: 6 }}>{err}</div>}
      <button onClick={submit} disabled={busy} style={{
        width: "100%", padding: "13px",
        background: busy ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#c89010,#f0c040)",
        border: "none", borderRadius: 9,
        fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 700, letterSpacing: 2,
        color: busy ? "#806040" : "#1a1000", cursor: busy ? "not-allowed" : "pointer",
        transition: "opacity .15s",
      }}>{busy ? "SENDING..." : "REQUEST EARLY ACCESS"}</button>
    </div>
  );
}

// ─── Animated card (card fan) ─────────────────────────────────────────────────
function FanCard({ rot, y, color, src, label, sub, zIdx, delay }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 110, height: 154, flexShrink: 0, position: "relative",
        transform: hov
          ? `rotate(${rot * 0.4}deg) translateY(${y - 20}px) scale(1.08)`
          : `rotate(${rot}deg) translateY(${y}px)`,
        transformOrigin: "bottom center",
        zIndex: hov ? 10 : zIdx,
        filter: `drop-shadow(0 6px 16px ${color}66) drop-shadow(0 0 28px rgba(0,0,0,0.9))`,
        transition: "transform .3s cubic-bezier(.34,1.56,.64,1), filter .3s, z-index 0s",
        animation: `cardBob ${3.2 + delay * 0.6}s ease-in-out ${delay * 0.4}s infinite alternate`,
        cursor: "default",
      }}
    >
      <div style={{
        width: "100%", height: "100%", borderRadius: 10,
        border: `2px solid ${hov ? color + "ee" : color + "88"}`,
        overflow: "hidden", background: "#0a0810",
        boxShadow: hov ? `inset 0 0 20px ${color}33, 0 0 0 1px ${color}44` : "none",
        transition: "border-color .3s, box-shadow .3s",
      }}>
        <img
          src={src} alt={label}
          style={{ width: "100%", height: "78%", objectFit: "cover", objectPosition: "top center", display: "block" }}
          onError={e => { e.target.style.display = "none"; }}
        />
        <div style={{
          height: "22%",
          background: `linear-gradient(180deg, rgba(10,8,16,0.9) 0%, rgba(6,4,10,1) 100%)`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "0 4px", gap: 2,
        }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 7, color: "#f0e4ff", fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>{label}</div>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 6, color: color, letterSpacing: 1 }}>{sub}</div>
        </div>
        {/* Foil shimmer on hover */}
        {hov && <div style={{ position: "absolute", inset: 0, borderRadius: 9, background: `linear-gradient(135deg, ${color}11 0%, transparent 40%, ${color}0a 60%, transparent 100%)`, pointerEvents: "none", animation: "foilShift 1.5s ease-in-out infinite alternate" }} />}
        {/* Glow rim */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 9, boxShadow: `inset 0 0 14px ${color}22`, pointerEvents: "none" }} />
      </div>
    </div>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────────────
export default function LandingPage({ onPlayNow, onSignIn }) {
  const [stats, setStats]   = useState(null);
  const [statsVis, setStatsVis] = useState(false);
  const statsRef = useRef(null);

  useEffect(() => {
    supabase.rpc("get_activity_stats").then(({ data }) => {
      if (data) setStats(data);
    });
  }, []);

  useEffect(() => {
    if (!statsRef.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVis(true); }, { threshold: 0.3 });
    obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  const divider = (
    <div style={{ width: 80, height: 1, background: "linear-gradient(90deg,transparent,#e8c06055,transparent)", margin: "0 auto" }} />
  );

  const FAN_CARDS = [
    { rot: -20, y: 22, color: "#70e830", src: "/cards/druid.jpg",             label: "Rootcaller Druid",   sub: "Thornwood",    zIdx: 3, delay: 0 },
    { rot:  -7, y:  7, color: "#9070ff", src: "/cards/zeus_storm_father.jpg", label: "Zeus, Storm Father", sub: "Fables",       zIdx: 4, delay: 1 },
    { rot:   0, y:  0, color: "#c89010", src: "/cards/guard.jpg",             label: "Thornwood Guard",    sub: "Thornwood",    zIdx: 5, delay: 2 },
    { rot:   7, y:  7, color: "#ff6820", src: "/cards/pyro.jpg",              label: "Ashfen Pyromancer",  sub: "Ashfen",       zIdx: 4, delay: 3 },
    { rot:  20, y: 22, color: "#30c0ff", src: "/cards/tide.jpg",              label: "Tideweave Siren",    sub: "Azure Deep",   zIdx: 3, delay: 4 },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10, overflowY: "auto", overflowX: "hidden",
      background: "radial-gradient(ellipse at 50% 0%, #18120a 0%, #0c0804 40%, #060402 100%)",
      fontFamily: "'Cinzel',serif",
    }}>
      <style>{`
        @keyframes landingFloat   { 0%{transform:translateY(0)} 100%{transform:translateY(-12px)} }
        @keyframes landingFadeUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cardBob        { 0%{margin-bottom:0} 100%{margin-bottom:8px} }
        @keyframes foilShift      { 0%{opacity:0.4;background-position:0% 50%} 100%{opacity:0.9;background-position:100% 50%} }
        @keyframes logoGlow       { 0%,100%{text-shadow:0 0 40px #c8901055,0 0 80px #c8901018} 50%{text-shadow:0 0 60px #c8901099,0 0 120px #c8901040,0 0 200px #c8901018} }
        @keyframes badgePulse     { 0%,100%{opacity:0.7} 50%{opacity:1} }
        @keyframes shimmerGold    { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes scanLine       { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        .landing-cta {
          padding: 16px 52px;
          background: linear-gradient(135deg, #c89010, #f0c040, #e8b818, #f0c040);
          background-size: 300% 100%;
          animation: shimmerGold 3s linear infinite;
          border: none; border-radius: 10px;
          font-family: 'Cinzel',serif; font-size: 15px; font-weight: 700;
          color: #1a1000; letter-spacing: 2px; cursor: pointer;
          box-shadow: 0 0 32px #f0c04044, 0 4px 20px rgba(0,0,0,0.5);
          transition: transform .15s, box-shadow .15s;
        }
        .landing-cta:hover { transform: translateY(-3px); box-shadow: 0 0 56px #f0c04077, 0 10px 40px rgba(0,0,0,0.7); }
        .landing-cta:active { transform: translateY(0); }
        .landing-signin-link {
          background: transparent; border: 1px solid #3a2810; border-radius: 8px;
          padding: 11px 26px; font-family: 'Cinzel',serif; font-size: 11px;
          color: #806040; cursor: pointer; letter-spacing: 1px; transition: border-color .2s, color .2s, background .2s;
        }
        .landing-signin-link:hover { border-color: #e8c06066; color: #c8a060; background: rgba(232,192,96,0.05); }
      `}</style>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "80px 24px 60px", position: "relative", overflow: "hidden",
        textAlign: "center",
      }}>
        <Particles count={36} />

        {/* Ambient glow orbs */}
        <div style={{ position: "absolute", top: "20%", left: "20%",  width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,#c8901010 0%,transparent 65%)", pointerEvents: "none", animation: "landingFloat 6s ease-in-out infinite alternate" }} />
        <div style={{ position: "absolute", top: "60%", right: "15%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,#9070ff0c 0%,transparent 65%)", pointerEvents: "none", animation: "landingFloat 8s ease-in-out 2s infinite alternate" }} />
        <div style={{ position: "absolute", top: "40%", left: "60%",  width: 250, height: 250, borderRadius: "50%", background: "radial-gradient(circle,#30c0ff08 0%,transparent 65%)", pointerEvents: "none", animation: "landingFloat 5s ease-in-out 1s infinite alternate" }} />

        {/* Logo */}
        <div style={{ animation: "landingFadeUp .7s ease-out both", position: "relative", zIndex: 1, marginBottom: 24 }}>
          <div style={{
            fontFamily: "'Cinzel',serif", fontSize: "clamp(44px, 7.5vw, 78px)",
            fontWeight: 900, letterSpacing: "clamp(4px, 1vw, 12px)",
            lineHeight: 1, marginBottom: 6,
            background: "linear-gradient(135deg, #e8c060 0%, #f0d880 25%, #c89010 50%, #f0d880 75%, #e8c060 100%)",
            backgroundSize: "300% 100%",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            animation: "shimmerGold 4s linear infinite",
          }}>
            FORGE {"&"} FABLE
          </div>
          <div style={{ fontFamily: "'Lora',serif", fontStyle: "italic", fontSize: "clamp(12px, 2vw, 16px)", color: "#b09050", letterSpacing: 2 }}>
            A free competitive card game — all cards unlocked, no paywalls.
          </div>
        </div>

        {/* Faction badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 44, animation: "landingFadeUp .7s .18s ease-out both", position: "relative", zIndex: 1 }}>
          {FACTIONS.map((f, i) => (
            <span key={f.name} style={{
              padding: "5px 15px", borderRadius: 20,
              border: `1px solid ${f.color}44`, background: `${f.color}0e`,
              fontFamily: "'Cinzel',serif", fontSize: 9, letterSpacing: 1,
              color: f.color, fontWeight: 600,
              animation: `badgePulse ${2.5 + (i % 4) * 0.5}s ease-in-out ${i * 0.12}s infinite`,
              cursor: "default",
            }}>{f.name}</span>
          ))}
        </div>

        {/* Card fan */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 4, marginBottom: 52, animation: "landingFadeUp .7s .28s ease-out both", position: "relative", zIndex: 1 }}>
          {FAN_CARDS.map((c, i) => (
            <FanCard key={i} {...c} />
          ))}
        </div>

        {/* Scroll hint — replaces CTAs in the hero */}
        <div style={{ animation: "landingFadeUp .7s .42s ease-out both", position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: "'Lora',serif", fontStyle: "italic", fontSize: 13, color: "#6a4e2e", letterSpacing: 1 }}>Discover what awaits below</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.4, animation: "landingFloat 2s ease-in-out infinite" }}>
            <div style={{ width: 1, height: 32, background: "linear-gradient(180deg,#e8c060,transparent)" }} />
            <div style={{ fontSize: 9, letterSpacing: 4, color: "#e8c060" }}>SCROLL</div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 24px", maxWidth: 920, margin: "0 auto" }}>
        <FadeSection>
          {divider}
          <div style={{ textAlign: "center", margin: "32px 0 48px" }}>
            <div style={{ fontSize: "clamp(18px,3vw,26px)", fontWeight: 700, color: "#e8c060", letterSpacing: 3, marginBottom: 10 }}>WHY FORGE {"&"} FABLE</div>
            <div style={{ fontSize: 12, color: "#6a5040", fontFamily: "'Lora',serif", letterSpacing: 1 }}>No subscriptions. No card packs. No pay-to-win. Just the game.</div>
          </div>
        </FadeSection>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <FeatureCard icon="🃏" accent="#e8c060" title="ALL CARDS FREE"    delay={0}    body="Every card in the game — over 100 across 8 factions — is unlocked the moment you create an account. No packs, no grind, no wallet required." />
          <FeatureCard icon="⚔️" accent="#ff7050" title="RANKED PvP"        delay={0.1}  body="Queue for rated matches, track your ELO, and climb the global leaderboard. Challenge a friend directly with a shareable link — no matchmaking queue needed." />
          <FeatureCard icon="🏰" accent="#c090ff" title="8 FACTIONS"        delay={0.2}  body="Thornwood's nature magic, Ashfen's wildfire aggro, Azure Deep's control, Shattered Expanse's cursed power, and more. Each faction plays completely differently." />
          <FeatureCard icon="📜" accent="#40c090" title="THE CHRONICLER"    delay={0.3}  body="Train against our built-in AI opponent anytime, offline, at your own pace. Perfect for testing new deck builds before taking them to ranked play." />
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────────── */}
      <section style={{ padding: "60px 24px 80px", maxWidth: 820, margin: "0 auto" }}>
        <FadeSection>
          {divider}
          <div style={{ textAlign: "center", margin: "32px 0 52px" }}>
            <div style={{ fontSize: "clamp(18px,3vw,26px)", fontWeight: 700, color: "#e8c060", letterSpacing: 3, marginBottom: 10 }}>HOW IT WORKS</div>
            <div style={{ fontSize: 12, color: "#6a5040", fontFamily: "'Lora',serif" }}>You're three steps from your first match.</div>
          </div>
        </FadeSection>

        <FadeSection delay={0.1}>
          <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
            <Step num="1" title="GET ACCESS"      body="Request an alpha key from the community or fill out an interest form below. Create your account in under a minute — email, password, and invite key." />
            <div style={{ display: "flex", alignItems: "center", padding: "0 8px", flexShrink: 0, opacity: 0.2 }}>
              <div style={{ width: 32, height: 1, background: "#e8c060" }} />
            </div>
            <Step num="2" title="BUILD YOUR DECK" body="Browse your full collection — every card unlocked. Filter by faction, type, or keyword. Build up to five custom decks or jump straight in with a starter deck." />
            <div style={{ display: "flex", alignItems: "center", padding: "0 8px", flexShrink: 0, opacity: 0.2 }}>
              <div style={{ width: 32, height: 1, background: "#e8c060" }} />
            </div>
            <Step num="3" title="BATTLE & RANK UP" body="Queue for ranked PvP, challenge a friend with a link, or spar against the AI. Earn shards, complete daily quests, and climb the leaderboard." />
          </div>
        </FadeSection>
      </section>

      {/* ── LIVE STATS ────────────────────────────────────────────────────────── */}
      <section ref={statsRef} style={{ padding: "60px 24px 80px", maxWidth: 720, margin: "0 auto" }}>
        <FadeSection>
          {divider}
          <div style={{ textAlign: "center", margin: "32px 0 44px" }}>
            <div style={{ fontSize: "clamp(18px,3vw,24px)", fontWeight: 700, color: "#e8c060", letterSpacing: 3, marginBottom: 8 }}>LIVE ACTIVITY</div>
            <div style={{ fontSize: 12, color: "#6a5040", fontFamily: "'Lora',serif" }}>Real-time counts from the server.</div>
          </div>
        </FadeSection>

        <FadeSection delay={0.1}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { label: "ACTIVE BATTLES NOW", value: statsVis && stats ? stats.active_matches : null, icon: "⚔️", color: "#e8c060" },
              { label: "MATCHES TODAY",      value: statsVis && stats ? stats.today_matches  : null, icon: "📅", color: "#78cc45" },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, minWidth: 200,
                background: "rgba(10,7,3,0.8)", border: `1px solid ${s.color}22`,
                borderRadius: 14, padding: "28px 32px", textAlign: "center",
                boxShadow: `0 0 40px ${s.color}0a`,
              }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{s.icon}</div>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 44, fontWeight: 900, color: s.color, lineHeight: 1, marginBottom: 8, minHeight: 52 }}>
                  {s.value !== null && s.value !== undefined
                    ? <AnimatedCount target={s.value} />
                    : <span style={{ opacity: 0.15 }}>—</span>
                  }
                </div>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 9, letterSpacing: 3, color: "#403020" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {stats?.recent_matches?.length > 0 && (
            <div style={{ marginTop: 28, background: "rgba(10,7,3,0.6)", border: "1px solid #2a1a08", borderRadius: 12, padding: "16px 20px" }}>
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
        </FadeSection>
      </section>

      {/* ── GET ACCESS ────────────────────────────────────────────────────────── */}
      <section style={{
        padding: "80px 24px 110px",
        borderTop: "1px solid #1a1208",
        background: "linear-gradient(180deg, transparent 0%, rgba(8,5,2,0.97) 100%)",
        position: "relative", overflow: "hidden",
      }}>
        <Particles count={18} color="#c89010" />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 620, margin: "0 auto" }}>

          <FadeSection>
            {divider}
            <div style={{ textAlign: "center", margin: "32px 0 48px" }}>
              <div style={{
                fontFamily: "'Cinzel',serif", fontSize: "clamp(22px,4vw,40px)",
                fontWeight: 900, letterSpacing: "clamp(2px,0.5vw,6px)", marginBottom: 14,
                background: "linear-gradient(135deg, #e8c060 0%, #f0d880 30%, #c89010 60%, #e8c060 100%)",
                backgroundSize: "300% 100%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                animation: "shimmerGold 4s linear infinite",
              }}>
                READY TO PLAY?
              </div>
              <div style={{ fontSize: 13, color: "#7a6050", fontFamily: "'Lora',serif", lineHeight: 1.85, maxWidth: 460, margin: "0 auto" }}>
                Free forever. All cards unlocked from day one. If you have an alpha key, create your account now. No key? Leave your details and we'll reach out when a spot opens.
              </div>
            </div>
          </FadeSection>

          {/* ── Have a key → sign up / sign in ── */}
          <FadeSection delay={0.1}>
            <div style={{
              background: "rgba(10,7,3,0.95)", border: "1px solid #3a2810",
              borderRadius: 16, padding: "32px 28px", marginBottom: 20,
              boxShadow: "0 0 60px rgba(200,144,16,0.06), inset 0 1px 0 rgba(255,255,255,0.03)",
            }}>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, color: "#c89010", letterSpacing: 3, marginBottom: 20, textAlign: "center" }}>I HAVE AN ALPHA KEY</div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="landing-cta" style={{ padding: "14px 44px", fontSize: 13 }} onClick={onPlayNow}>CREATE ACCOUNT</button>
                <button className="landing-signin-link" onClick={onSignIn}>Sign In</button>
              </div>
            </div>
          </FadeSection>

          {/* ── Divider ── */}
          <FadeSection delay={0.15}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "4px 0 20px" }}>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,transparent,#2a1a0a)" }} />
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 9, color: "#3a2510", letterSpacing: 3 }}>OR</div>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#2a1a0a,transparent)" }} />
            </div>
          </FadeSection>

          {/* ── No key → interest form ── */}
          <FadeSection delay={0.2}>
            <div style={{
              background: "rgba(10,7,3,0.9)", border: "1px solid #2a1a08",
              borderRadius: 16, padding: "32px 28px",
              boxShadow: "0 0 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
            }}>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, color: "#806040", letterSpacing: 3, marginBottom: 6, textAlign: "center" }}>I DON'T HAVE A KEY YET</div>
              <div style={{ fontFamily: "'Lora',serif", fontSize: 12, color: "#5a3a20", textAlign: "center", marginBottom: 24, lineHeight: 1.7 }}>Drop your info and we'll send you access when a spot opens.</div>
              <InterestForm />
            </div>
          </FadeSection>

          <FadeSection delay={0.25}>
            <div style={{ textAlign: "center", marginTop: 28, fontSize: 9, color: "#2a1c0a", letterSpacing: 2 }}>ALPHA · INVITE KEY REQUIRED · v19</div>
          </FadeSection>

        </div>
      </section>
    </div>
  );
}
