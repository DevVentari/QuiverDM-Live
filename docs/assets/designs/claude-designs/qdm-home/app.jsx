/* QuiverDM — Map-as-Home prototype */
const { useState, useEffect, useMemo, useRef } = React;

/* ===== Data ===== */
const PARTY = [
  { id: "brann", name: "Brann",  class: "Warden of Stone",   stats: { hp: 38, ac: 18, lv: 6 }, note: "Carries the broken oath-blade." },
  { id: "kira",  name: "Kira",   class: "Whisper of the Pact", stats: { hp: 24, ac: 14, lv: 6 }, note: "Owes the Choir a name. Hasn't said which." },
  { id: "mira",  name: "Mira",   class: "Lantern-Cleric",     stats: { hp: 31, ac: 16, lv: 6 }, note: "Faith dimming since Silverpine." },
  { id: "thom",  name: "Thom",   class: "Long-Bow Ranger",    stats: { hp: 28, ac: 15, lv: 6 }, note: "Tracking the Frostpeak Orcs personally." },
  { id: "vex",   name: "Vex",    class: "Edge-Wise Rogue",    stats: { hp: 26, ac: 16, lv: 6 }, note: "Stole the Moonlit Key. Lying about it." },
];

const NPCS = [
  { id: "ser",  name: "Seraphine Dusk",  role: "Tower-Keeper",        body: "Last attested guarding the Spire's eastern stair. Her motives have not been written. The party last heard her hum, not speak.", tags: ["needs motives", "onstage"], flag: true },
  { id: "aur",  name: "Aurelios",         role: "Itinerant Cartographer", body: "Newly added to the cast. Brann found him sketching the road they were on.", tags: ["new", "onstage"], flag: true },
  { id: "fp",   name: "The Frostpeak Orcs", role: "Faction · Offstage", body: "Riding south on a 4/6 clock. Will arrive whether the party is ready or not.", tags: ["faction", "clock 4/6"] },
  { id: "mk",   name: "The Moonlit Key",  role: "Item · in Vex's pocket", body: "Sings only when held by someone lying. Vex has not yet noticed.", tags: ["item", "onstage"] },
  { id: "rg",   name: "Rangrim",          role: "Innkeep · Silverpine",   body: "Knows the road north is closed but won't say by what.", tags: ["offstage"] },
  { id: "choir", name: "The Choir",       role: "Mystery · Voiceless",    body: "A voice the party heard underground. Three wardens remembered together.", tags: ["mystery"] },
];

const LOCATIONS = [
  { id: "spire",  name: "The Shattered Spire", sub: "Frostpeaks · Session 18", x: 84, y: 22 },
  { id: "frost",  name: "Frostpeaks",          sub: "Mountain Range · 3 days' march", x: 70, y: 38, region: true },
  { id: "silver", name: "Silverpine",          sub: "Town · last visited yesterday", x: 58, y: 50 },
  { id: "lowwood",name: "The Low Wood",        sub: "Forest · between camps", x: 78, y: 64, region: true },
  { id: "hollow", name: "Beneath the Black Hollow", sub: "Dungeon · Session 17", x: 50, y: 70 },
];

const QUESTS = [
  { id: "spire", title: "Take the Shattered Spire",   sub: "Main · 3 scenes prepped", clock: { n: 0, d: 4 }, status: "Active" },
  { id: "orcs",  title: "The Frostpeak Orcs ride south", sub: "Faction clock — will arrive on a 6",        clock: { n: 4, d: 6 }, status: "Ticking" },
  { id: "choir", title: "Three wardens, one voice",     sub: "Mystery · whose voice was that?",            clock: { n: 1, d: 3 }, status: "Cold" },
  { id: "moon",  title: "The Moonlit Key",              sub: "Item arc · Vex must confess",                clock: { n: 2, d: 4 }, status: "Active" },
  { id: "silver",title: "What Rangrim won't say",       sub: "Side · gated on a long rest",                clock: { n: 0, d: 3 }, status: "Dormant" },
];

const SECTIONS = [
  { id: "home",   label: "Home",      icon: "home" },
  { id: "npcs",   label: "NPCs",      icon: "people" },
  { id: "places", label: "Locations", icon: "pin" },
  { id: "quests", label: "Quests",    icon: "compass" },
  { id: "players",label: "Party",     icon: "shield" },
];

/* ===== Accent palettes ===== */
const ACCENT_OPTIONS = [
  "#B07129", // amber
  "#3C7A4A", // verdant
  "#3A5DA8", // ink
  "#B14A3A", // crimson
];
const ACCENT_INK = {
  "#B07129": "#6E471A",
  "#3C7A4A": "#244C2D",
  "#3A5DA8": "#1F3669",
  "#B14A3A": "#732A1F",
};

function hexToRgba(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0,2), 16);
  const g = parseInt(h.slice(2,4), 16);
  const b = parseInt(h.slice(4,6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function applyAccent(hex) {
  const r = document.documentElement.style;
  r.setProperty("--accent",      hex);
  r.setProperty("--accent-soft", hexToRgba(hex, 0.10));
  r.setProperty("--accent-line", hexToRgba(hex, 0.45));
  r.setProperty("--accent-ink",  ACCENT_INK[hex] || hex);
}

/* ===== Icons ===== */
function Icon({ name, size = 18 }) {
  const s = size;
  const sw = 1.6;
  const common = { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "home":    return <svg {...common}><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/></svg>;
    case "people":  return <svg {...common}><circle cx="9" cy="9" r="3.2"/><circle cx="17" cy="11" r="2.5"/><path d="M3 19c1-3 3.5-4.5 6-4.5s5 1.5 6 4.5"/><path d="M14 19c.5-2 2-3 3-3s2.5 1 3 3"/></svg>;
    case "pin":     return <svg {...common}><path d="M12 21s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>;
    case "compass": return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>;
    case "shield":  return <svg {...common}><path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></svg>;
    case "search":  return <svg {...common}><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.5-4.5"/></svg>;
    case "plus":    return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case "spark":   return <svg {...common}><path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l4 4M14 14l4 4M6 18l4-4M14 10l4-4"/></svg>;
    case "arrow":   return <svg {...common}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case "logo":    return <svg width={s} height={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M8 12c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5"/><circle cx="16" cy="16" r="1.4" fill="currentColor"/></svg>;
    default: return null;
  }
}

/* ===== App ===== */
function App() {
  const [section, setSection] = useState("home");
  const [tweaks, setTweak] = useTweaks({ accent: "#B07129" });

  useEffect(() => { applyAccent(tweaks.accent); }, [tweaks.accent]);

  return (
    <div className="app">
      <header className="top">
        <div className="top-brand">
          <div className="brand-mark">Q</div>
          <div className="brand-text">
            <span className="b1">QuiverDM</span>
            <span className="b-sep">·</span>
            <span className="b2">The Stonewardens</span>
            <span className="b3">Chapter III</span>
          </div>
        </div>
        <div className="top-tools">
          <button className="tool"><Icon name="search" size={14}/> Search <span className="kbd">⌘K</span></button>
          <button className="tool"><Icon name="spark" size={14}/> Ask the Brain</button>
          <button className="tool primary"><Icon name="plus" size={14}/> Quick add</button>
        </div>
      </header>

      <nav className="rail">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={"rail-btn " + (section === s.id ? "active" : "")}
            onClick={() => setSection(s.id)}
            aria-label={s.label}
          >
            <Icon name={s.icon}/>
            <span className="tip">{s.label}</span>
          </button>
        ))}
        <div className="rail-divider"></div>
        <button className="rail-btn" aria-label="Search"><Icon name="search"/><span className="tip">Search</span></button>
        <button className="rail-btn" aria-label="Quick add"><Icon name="plus"/><span className="tip">Quick add</span></button>
        <span className="rail-section">Stonewardens</span>
      </nav>

      <main className="stage">
        {section === "home"    && <MapHome onJump={(id)=>setSection(id)} />}
        {section === "npcs"    && <NpcsView />}
        {section === "places"  && <LocationsView />}
        {section === "quests"  && <QuestsView />}
        {section === "players" && <PlayersView />}
      </main>

      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection label="Accent">
            <window.TweakColor
              label="Accent hue"
              value={tweaks.accent}
              onChange={(v)=>setTweak("accent", v)}
              options={ACCENT_OPTIONS}
            />
            <div style={{fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.55, marginTop: 8}}>
              Tints the session card, path on the map, and clock fills. Other surfaces stay paper/ink.
            </div>
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </div>
  );
}

/* ===== Map (Home) ===== */
function MapHome({ onJump }) {
  const [activePin, setActivePin] = useState("spire");
  const [layers, setLayers] = useState({ sessions: true, npcs: true, quests: false });

  return (
    <div className="map-wrap">
      <div className="map-bg"></div>
      <TopoMap />
      <div className="map-grid"></div>
      <div className="map-noise"></div>

      <div className="compass">N</div>

      <SessionCard onContinue={() => onJump("quests")} />

      {/* Pins */}
      {LOCATIONS.filter(l => !l.region).map(loc => (
        <button
          key={loc.id}
          className={"pin " + (activePin === loc.id ? "active" : "")}
          style={{ left: loc.x + "%", top: loc.y + "%" }}
          onClick={() => setActivePin(loc.id)}
        >
          <span className="pin-head">{loc.id === "spire" ? "18" : loc.id === "hollow" ? "17" : "·"}</span>
          <span className="pin-label">{loc.name}</span>
          {loc.sub && <span className="pin-sub">{loc.sub.split("·")[0].trim()}</span>}
        </button>
      ))}

      {/* Region labels */}
      <div className="region" style={{ left: "68%", top: "36%" }}>Frostpeaks</div>
      <div className="region" style={{ left: "75%", top: "63%" }}>The Low Wood</div>

      <Dock layers={layers} setLayers={setLayers} onJump={onJump} />
    </div>
  );
}

function SessionCard({ onContinue }) {
  return (
    <aside className="session-card">
      <div className="eyebrow">Next session · tomorrow 7:00 pm</div>
      <h1>The Shattered Spire</h1>
      <p className="blurb">A storm-bent tower split by lightning. Smoke still curling from its peak. The Stonewardens approach from the south.</p>
      <div className="meta-row">
        <span className="chip accent"><span className="dot"></span> prep 62%</span>
        <span className="chip">3 scenes</span>
        <span className="chip">6 players expected</span>
      </div>
      <div className="cta-row">
        <button className="cta" onClick={onContinue}>Continue prep <Icon name="arrow" size={14}/></button>
        <button className="cta-secondary">Open room</button>
      </div>
      <div className="below">
        <strong>3 days' march from current camp</strong> · via the Stoneway · expect weather
      </div>
    </aside>
  );
}

function Dock({ layers, setLayers, onJump }) {
  return (
    <div className="dock">
      <div className="dock-card">
        <div className="label">The Party · 3 days' rest</div>
        <div className="party-row">
          <div className="party-avatars">
            {PARTY.map(p => <span key={p.id} className="avatar">{p.name[0]}</span>)}
          </div>
          <div className="party-meta">
            <div className="names">Brann · Kira · Mira · Thom · Vex</div>
            <div className="rest">Long rest · morale +1 · 0 conditions</div>
          </div>
        </div>
      </div>
      <div className="dock-card">
        <div className="label">World Activity · today</div>
        <div className="activity-list">
          <div className="a"><span className="glyph">◆</span> Aurelios added to the cast</div>
          <div className="a"><span className="glyph">◆</span> Frostpeak Orcs · clock advanced to 4 / 6</div>
          <div className="a"><span className="glyph">◆</span> Silverpine notes refreshed</div>
        </div>
      </div>
      <div className="dock-card">
        <div className="label">Layers</div>
        <div className="layers">
          {Object.entries(layers).map(([k, on]) => (
            <button
              key={k}
              className={"layer-pill " + (on ? "on" : "")}
              onClick={() => setLayers({ ...layers, [k]: !on })}
            >{k}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===== Topographic map SVG ===== */
function TopoMap() {
  return (
    <svg className="map-canvas" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      {/* Contour lines around Frostpeaks (mountains, top-right) */}
      <g>
        {[0,1,2,3,4,5,6].map(i => (
          <path key={i} className={"topo-line " + (i % 2 === 0 ? "bold" : "")}
                d={`M ${800 + i*22} ${360 - i*8}
                    C ${950 + i*20} ${260 - i*10}, ${1150 + i*18} ${280 - i*8}, ${1280 - i*12} ${340 - i*6}
                    S ${1500 - i*10} ${520 - i*6}, ${1380 - i*16} ${600 - i*4}
                    S ${1000 + i*8} ${640 + i*4}, ${860 + i*14} ${540 + i*6}
                    S ${780 + i*20} ${420 - i*4}, ${800 + i*22} ${360 - i*8} Z`}/>
        ))}
      </g>
      {/* Contours around Low Wood (bottom-mid) */}
      <g>
        {[0,1,2,3,4].map(i => (
          <path key={i} className={"topo-line " + (i % 2 === 0 ? "bold" : "")}
                d={`M ${720 + i*14} ${720 - i*6}
                    C ${820 + i*10} ${660 - i*6}, ${1020 + i*8} ${680 - i*4}, ${1080 - i*10} ${740 - i*2}
                    S ${980 - i*8} ${840 - i*2}, ${820 + i*8} ${820 - i*2}
                    S ${700 + i*14} ${770 - i*4}, ${720 + i*14} ${720 - i*6} Z`}/>
        ))}
      </g>
      {/* Contours around Hollow (bottom-left) */}
      <g>
        {[0,1,2,3].map(i => (
          <circle key={i} className={"topo-line " + (i % 2 === 0 ? "bold" : "")}
                  cx={340 + i*4} cy={720 - i*2} r={70 + i*14} />
        ))}
      </g>

      {/* Mountain symbols (Frostpeaks) */}
      <g className="mountain">
        <path d="M 980 360 L 1040 250 L 1100 360 Z" />
        <path d="M 1070 380 L 1140 230 L 1210 380 Z" />
        <path d="M 1190 360 L 1250 270 L 1310 360 Z" />
        {/* snow caps */}
        <path d="M 1024 280 L 1040 250 L 1058 280" />
        <path d="M 1124 260 L 1140 230 L 1158 260" />
        <path d="M 1234 296 L 1250 270 L 1266 296" />
      </g>

      {/* Low Wood — cluster of small triangles */}
      <g className="forest">
        {Array.from({length: 28}).map((_, i) => {
          const x = 760 + (i % 7) * 50 + (i % 3) * 8;
          const y = 720 + Math.floor(i / 7) * 28 + (i % 2) * 6;
          return <polygon key={i} points={`${x},${y} ${x+8},${y-14} ${x+16},${y}`} />;
        })}
      </g>

      {/* River through Stoneway valley */}
      <path className="river" d="M 100 540 C 220 520, 320 580, 440 560 S 640 480, 760 520" />

      {/* The campaign's path (dashed amber) — Hollow → Silverpine → Spire */}
      <path className="path-line"
            d="M 360 720
               C 420 660, 540 640, 680 600
               S 820 480, 940 420
               S 1140 320, 1240 260" />
    </svg>
  );
}

/* ===== Other views ===== */
function NpcsView() {
  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="eyebrow">The Cast · Chapter III</div>
          <h2>NPCs in play</h2>
          <p>Everyone the Stonewardens have met, are about to meet, or are about to be hunted by. Sorted by stage presence.</p>
        </div>
        <div className="view-tools">
          <button className="tool"><Icon name="search" size={14}/> Filter</button>
          <button className="tool primary"><Icon name="plus" size={14}/> New NPC</button>
        </div>
      </div>

      <div className="section-rule">Onstage <span className="count">— in front of the players right now</span></div>
      <div className="npc-grid">
        {NPCS.filter(n => n.tags.includes("onstage")).map(n => <NpcCard key={n.id} n={n} />)}
      </div>

      <div className="section-rule">Offstage & factions</div>
      <div className="npc-grid">
        {NPCS.filter(n => !n.tags.includes("onstage")).map(n => <NpcCard key={n.id} n={n} />)}
      </div>
    </div>
  );
}

function NpcCard({ n }) {
  return (
    <div className="npc-card">
      <div className="npc-head">
        <div className="npc-portrait">{n.name[0]}</div>
        <div>
          <div className="npc-name">{n.name}</div>
          <div className="npc-role">{n.role}</div>
        </div>
      </div>
      <div className="npc-body">{n.body}</div>
      <div className="npc-foot">
        {n.tags.map(t => <span key={t} className={"tag " + (n.flag && t.includes("needs") ? "flag" : "")}>{t}</span>)}
      </div>
    </div>
  );
}

function LocationsView() {
  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="eyebrow">The World · 6 mapped places</div>
          <h2>Locations</h2>
          <p>Every place the Stonewardens have stood, will stand, or have heard rumored. Click to drop a pin on the world map.</p>
        </div>
        <div className="view-tools">
          <button className="tool"><Icon name="search" size={14}/> Filter</button>
          <button className="tool primary"><Icon name="plus" size={14}/> New location</button>
        </div>
      </div>

      <div className="loc-grid">
        {LOCATIONS.map(l => (
          <div className="loc-card" key={l.id}>
            <div className="loc-thumb">
              <span className="glyph">{l.region ? "region" : "site"} · drop art</span>
            </div>
            <div className="loc-meta">
              <div className="loc-name">{l.name}</div>
              <div className="loc-sub">{l.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestsView() {
  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="eyebrow">Threads · Chapter III</div>
          <h2>Quests & clocks</h2>
          <p>Five threads pulling at the party. Some they're chasing; some are chasing them.</p>
        </div>
        <div className="view-tools">
          <button className="tool"><Icon name="search" size={14}/> Filter</button>
          <button className="tool primary"><Icon name="plus" size={14}/> New thread</button>
        </div>
      </div>

      <div className="quest-list">
        {QUESTS.map(q => (
          <div className="quest" key={q.id}>
            <Clock n={q.clock.n} d={q.clock.d} />
            <div>
              <div className="quest-title">{q.title}</div>
              <div className="quest-sub">{q.sub}</div>
            </div>
            <div className="quest-status">{q.status}</div>
            <div className="quest-arrow"><Icon name="arrow" size={16}/></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Clock({ n, d }) {
  const r = 18;
  const cx = 24, cy = 24;
  const segments = [];
  for (let i = 0; i < d; i++) {
    const a1 = (i / d) * Math.PI * 2;
    const a2 = ((i + 1) / d) * Math.PI * 2;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy + r * Math.sin(a2);
    const large = (a2 - a1) > Math.PI ? 1 : 0;
    const filled = i < n;
    segments.push(
      <path key={i}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
            fill={filled ? "var(--accent)" : "transparent"}
            stroke="var(--ink-3)"
            strokeWidth="1" />
    );
  }
  return (
    <div className="clock">
      <svg viewBox="0 0 48 48">{segments}</svg>
      <div className="clock-text">{n}/{d}</div>
    </div>
  );
}

function PlayersView() {
  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="eyebrow">The Stonewardens · five at the table</div>
          <h2>Party roster</h2>
          <p>Brann, Kira, Mira, Thom, and Vex. Currently 3 days' rest in from the road; one of them is lying.</p>
        </div>
        <div className="view-tools">
          <button className="tool primary"><Icon name="plus" size={14}/> Add seat</button>
        </div>
      </div>

      <div className="player-grid">
        {PARTY.map(p => (
          <div className="player-card" key={p.id}>
            <div className="player-head">
              <div className="player-portrait">{p.name[0]}</div>
              <div>
                <div className="player-name">{p.name}</div>
                <div className="player-class">{p.class}</div>
              </div>
            </div>
            <div className="stat-row">
              <div className="stat"><div className="v">{p.stats.hp}</div><div className="k">hp</div></div>
              <div className="stat"><div className="v">{p.stats.ac}</div><div className="k">ac</div></div>
              <div className="stat"><div className="v">{p.stats.lv}</div><div className="k">lv</div></div>
            </div>
            <div className="player-foot"><strong>Note —</strong> {p.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
