"""Insert Food Fight teaser section before the Bottom info bar comment in HomeScreen."""

FF_TEASER = r"""    {/* ── FOOD FIGHT TEASER SECTION ───────────────────────────────────────── */}
    {(() => {
      const FF_CARDS = POOL.filter(c => c.region === "Food Fight");
      const STRAWBERRY_SVG = (<svg viewBox="0 0 80 90" xmlns="http://www.w3.org/2000/svg" style={{ width:90, height:100, filter:"drop-shadow(0 0 18px rgba(220,50,50,0.7)) drop-shadow(0 6px 14px rgba(0,0,0,0.8))", animation:"berryBounceFF 1.2s ease-in-out infinite" }}>
        <path d="M40 14 Q44 4 48 0" stroke="#2e7d32" strokeWidth="3" strokeLinecap="round" fill="none"/>
        <ellipse cx="49" cy="6" rx="9" ry="5" fill="#388e3c" transform="rotate(-25 49 6)"/>
        <ellipse cx="34" cy="8" rx="7" ry="4" fill="#2e7d32" transform="rotate(20 34 8)"/>
        <path d="M40 18 C20 16,4 34,4 52 C4 72,20 88,40 88 C60 88,76 72,76 52 C76 34,60 16,40 18 Z" fill="url(#ffBerryGrad)"/>
        {[{x:28,y:34},{x:44,y:30},{x:58,y:38},{x:22,y:50},{x:38,y:52},{x:54,y:52},{x:30,y:66},{x:48,y:64},{x:62,y:56}].map((s,i)=>(<ellipse key={i} cx={s.x} cy={s.y} rx="2.2" ry="3" fill="rgba(255,240,180,0.7)" transform={`rotate(${-15+i*5} ${s.x} ${s.y})`}/>))}
        <ellipse cx="30" cy="36" rx="9" ry="6" fill="rgba(255,255,255,0.25)" transform="rotate(-20 30 36)"/>
        <defs>
          <radialGradient id="ffBerryGrad" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#ff7070"/>
            <stop offset="45%" stopColor="#dd1111"/>
            <stop offset="100%" stopColor="#6b0000"/>
          </radialGradient>
        </defs>
      </svg>);
      return (
      <section style={{ position:"relative", overflow:"hidden", background:"linear-gradient(180deg,#080406 0%,#100508 50%,#080406 100%)", borderTop:"1px solid rgba(180,30,30,0.2)", padding:"60px 28px 64px" }}>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 50% 50%,rgba(160,20,20,0.14),transparent 60%)", pointerEvents:"none" }} />
        <style>{`@keyframes berryBounceFF{0%,100%{transform:scaleY(1) scaleX(1) translateY(0)}38%{transform:scaleY(1.09) scaleX(0.93) translateY(-18px)}58%{transform:scaleY(0.88) scaleX(1.1) translateY(5px)}74%{transform:scaleY(1.04) scaleX(0.97) translateY(-6px)}}`}</style>
        <div style={{ maxWidth:1100, margin:"0 auto", position:"relative", zIndex:2 }}>
          {/* Header row */}
          <div style={{ display:"flex", alignItems:"center", gap:32, marginBottom:44, flexWrap:"wrap" }}>
            <div style={{ flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", width:120, height:120, borderRadius:"50%", background:"radial-gradient(circle,rgba(180,20,20,0.18),transparent 70%)" }}>
              {STRAWBERRY_SVG}
            </div>
            <div>
              <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(200,40,40,0.15)", border:"1px solid rgba(200,40,40,0.35)", borderRadius:20, padding:"4px 14px", marginBottom:10 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#ff5050", boxShadow:"0 0 8px #ff5050", animation:"pulse 2s infinite" }} />
                <span style={{ fontFamily:"'Cinzel',serif", fontSize:9, color:"#ff7070", letterSpacing:3, fontWeight:700 }}>COMING NEXT SEASON</span>
              </div>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:36, fontWeight:900, color:"#ff5050", letterSpacing:1, marginBottom:6, textShadow:"0 0 40px rgba(220,50,50,0.5)" }}>Food Fight</div>
              <p style={{ fontSize:13, color:"rgba(220,150,150,0.7)", lineHeight:1.8, maxWidth:480, margin:0 }}>13 culinary warriors bringing chaos to the kitchen — new Sauced & Gilded keywords, environment cards that reshape the battlefield, and enough flavor to feed the whole tavern.</p>
            </div>
          </div>
          {/* 13 card showcase strip */}
          <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:12, scrollbarWidth:"thin", scrollbarColor:"rgba(200,50,50,0.3) transparent", justifyContent: FF_CARDS.length < 8 ? "center" : "flex-start" }}>
            {FF_CARDS.length > 0 ? FF_CARDS.map((c,i) => (
              <div key={c.id} style={{ flexShrink:0, animation:`cardReveal 0.5s ease-out ${i*0.07}s both`, filter:`drop-shadow(0 6px 20px ${c.border}55)` }}>
                <Card card={c} size="sm" hideCost />
              </div>
            )) : Array.from({length:13}).map((_,i) => (
              <div key={i} style={{ flexShrink:0, width:116, height:162, borderRadius:12, background:"linear-gradient(160deg,#1a0808,#270c0c)", border:"2px solid rgba(180,30,30,0.22)", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:6, animation:`cardReveal 0.5s ease-out ${i*0.07}s both` }}>
                <div style={{ fontSize:22, filter:"grayscale(80%) brightness(0.6)" }}>{"🍓🌮🍕🥦🍩🌶🍦🥑🍜🥕🍄🍋🧄".split("").filter((_,j)=>j%2===0)[i]||"🍓"}</div>
                <div style={{ fontSize:7, color:"rgba(180,60,60,0.35)", fontFamily:"'Cinzel',serif", letterSpacing:2 }}>???</div>
              </div>
            ))}
          </div>
          {/* New keywords badge strip */}
          <div style={{ display:"flex", gap:10, marginTop:24, flexWrap:"wrap" }}>
            {[{ kw:"Sauced", desc:"Splashes 1 damage to a random enemy each turn", color:"#e05020" }, { kw:"Gilded", desc:"+1 ATK every time you cast a spell", color:"#c8a020" }].map(({kw,desc,color}) => (
              <div key={kw} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 14px", background:`${color}18`, border:`1px solid ${color}44`, borderRadius:20 }}>
                <span style={{ fontFamily:"'Cinzel',serif", fontSize:10, color, fontWeight:700, letterSpacing:1 }}>{kw}</span>
                <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)", letterSpacing:0.5 }}>{desc}</span>
              </div>
            ))}
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 14px", background:"rgba(144,112,255,0.12)", border:"1px solid rgba(144,112,255,0.3)", borderRadius:20 }}>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:10, color:"#9070ff", fontWeight:700, letterSpacing:1 }}>Fables</span>
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>+13 fairy tale cards also incoming</span>
            </div>
          </div>
        </div>
      </section>
      );
    })()}
"""

MARKER = '    {/* Bottom info bar */}\n'

path = 'src/App.jsx'
lines = open(path, encoding='utf-8').readlines()

# Find the Bottom info bar line in HomeScreen (should be around line 3258)
idx = None
for i, l in enumerate(lines):
    if l == MARKER:
        idx = i
        break

if idx is None:
    print('ERROR: could not find Bottom info bar marker')
else:
    print(f'Found marker at line {idx+1}')
    lines.insert(idx, FF_TEASER)
    open(path, 'w', encoding='utf-8').writelines(lines)
    print('Done')
