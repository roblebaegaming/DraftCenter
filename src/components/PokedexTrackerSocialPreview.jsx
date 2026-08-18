import { pokedexArtworkUrl } from "../lib/pokedexTracker";

const pokemon = [
  [1, "Bulbasaur", "friend", 2, true],
  [25, "Pikachu", "fast", 4, true],
  [94, "Gengar", "moon", 3, true],
  [131, "Lapras", "lure", 1, true],
  [149, "Dragonite", "level", 5, true],
  [197, "Umbreon", "moon", 2, true],
  [282, "Gardevoir", "love", 6, true],
  [448, "Lucario", "beast", 3, true],
  [700, "Sylveon", "dream", 4, true],
  [887, "Dragapult", "dusk", 0, false],
];

const ballColors = {
  friend: ["#8ebf4e", "#dd6950"],
  fast: ["#d8573f", "#f0cf45"],
  moon: ["#315078", "#e8d058"],
  lure: ["#3b8fc0", "#db554f"],
  level: ["#e0a748", "#2e3338"],
  love: ["#e981a1", "#f3c0d0"],
  beast: ["#3d4c91", "#70c8cb"],
  dream: ["#db78b0", "#8b77bd"],
  dusk: ["#375842", "#dc704b"],
};

function SocialBall({ type }) {
  const colors = ballColors[type];
  return <span style={{ width: 20, height: 20, display: "flex", position: "relative", flex: "0 0 auto", overflow: "hidden", border: "1px solid #152439", borderRadius: 999, background: `linear-gradient(${colors[0]} 0 44%, #26303a 44% 56%, ${colors[1]} 56%)` }}>
    <i style={{ width: 6, height: 6, position: "absolute", top: 6, left: 6, border: "1px solid #26303a", borderRadius: 999, background: "#f8fbff" }} />
  </span>;
}

function TrackerSummary({ icon, title, subtitle, percentage, active = false }) {
  return <div style={{ width: "100%", display: "flex", alignItems: "center", padding: "13px 12px", marginBottom: 10, border: active ? "1px solid rgba(89,225,208,.52)" : "1px solid rgba(135,171,215,.16)", borderRadius: 14, background: active ? "linear-gradient(110deg, rgba(89,225,208,.14), rgba(98,168,255,.07))" : "rgba(7,18,31,.68)" }}>
    <span style={{ width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10, borderRadius: 11, color: active ? "#64e5d5" : "#8ca4bd", background: active ? "#153f49" : "#16273a", fontSize: 18 }}>{icon}</span>
    <span style={{ minWidth: 0, display: "flex", flex: 1, flexDirection: "column" }}>
      <b style={{ color: "#f5f9ff", fontSize: 14 }}>{title}</b>
      <small style={{ marginTop: 3, color: "#7f91aa", fontSize: 10 }}>{subtitle}</small>
      <i style={{ width: "100%", height: 4, display: "flex", marginTop: 8, overflow: "hidden", borderRadius: 999, background: "#1b2b3d" }}><em style={{ width: `${percentage}%`, height: "100%", display: "flex", borderRadius: 999, background: "linear-gradient(90deg, #59e1d0, #62a8ff)" }} /></i>
    </span>
    <b style={{ marginLeft: 8, color: active ? "#59e1d0" : "#9eb1c8", fontSize: 12 }}>{percentage}%</b>
  </div>;
}

function PokemonTile({ item }) {
  const [id, name, ball, ribbons, caught] = item;
  return <div style={{ width: 148, height: 152, display: "flex", flexDirection: "column", position: "relative", padding: "9px 10px 8px", margin: "0 8px 9px 0", overflow: "hidden", border: caught ? "1px solid rgba(89,225,208,.45)" : "1px solid #293d52", borderRadius: 14, background: caught ? "linear-gradient(155deg, rgba(33,93,96,.31), rgba(7,20,32,.96))" : "linear-gradient(155deg, #13283a, #081522)" }}>
    <span style={{ color: "#7890a7", fontFamily: "monospace", fontSize: 10 }}>#{String(id).padStart(3, "0")}</span>
    <span style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", position: "absolute", top: 8, right: 8, border: caught ? "1px solid #59e1d0" : "1px solid #40546a", borderRadius: 999, color: caught ? "#05201d" : "#71879d", background: caught ? "#59e1d0" : "#101e2d", fontSize: 12, fontWeight: 900 }}>{caught ? "✓" : "+"}</span>
    <span style={{ width: "100%", height: 72, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}><img src={pokedexArtworkUrl(id)} alt="" width={72} height={72} style={{ objectFit: "contain", opacity: caught ? 1 : .24 }} /></span>
    <b style={{ overflow: "hidden", color: caught ? "#eef8ff" : "#8293a5", fontSize: 13, whiteSpace: "nowrap" }}>{name}</b>
    <span style={{ display: "flex", alignItems: "center", marginTop: 7, color: "#a8b8ca", fontSize: 10 }}><SocialBall type={ball} /><i style={{ display: "flex", marginLeft: 7, color: ribbons ? "#ffe079" : "#62758b", fontStyle: "normal" }}>◇ {ribbons || "—"}</i>{id === 282 && <i style={{ display: "flex", marginLeft: "auto", color: "#a9baff", fontStyle: "normal" }}>✎</i>}</span>
  </div>;
}

export default function PokedexTrackerSocialPreview() {
  return <div style={{ width: "100%", height: "100%", display: "flex", padding: 28, color: "#f7fbff", background: "radial-gradient(circle at 9% 4%, #173c57 0%, transparent 30%), radial-gradient(circle at 91% 0%, #163f5a 0%, transparent 30%), linear-gradient(155deg, #07121f, #050b13)", fontFamily: "Arial, sans-serif" }}>
    <aside style={{ width: 264, height: "100%", display: "flex", flexDirection: "column", padding: 17, marginRight: 16, border: "1px solid rgba(135,171,215,.2)", borderRadius: 22, background: "rgba(8,21,37,.9)" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}><span style={{ width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 11, border: "2px solid #59e1d0", borderRadius: 14, color: "#59e1d0", fontSize: 18, fontWeight: 900 }}>DC</span><span style={{ display: "flex", flexDirection: "column" }}><b style={{ fontSize: 17, letterSpacing: 1.5 }}>DRAFTCENTER</b><small style={{ marginTop: 3, color: "#8093ab", fontSize: 11 }}>draftcentral.gg</small></span></div>
      <span style={{ marginBottom: 7, color: "#59e1d0", fontSize: 10, fontWeight: 900, letterSpacing: 2 }}>MY TRACKERS</span>
      <b style={{ marginBottom: 15, fontSize: 19 }}>3 collections</b>
      <TrackerSummary icon="⌂" title="My Living Dex" subtitle="Pokémon HOME" percentage={90} active />
      <TrackerSummary icon="◉" title="Paldea Complete" subtitle="Pokémon Scarlet" percentage={100} />
      <TrackerSummary icon="✦" title="Shiny Favorites" subtitle="Pokémon HOME" percentage={62} />
      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", padding: 14, border: "1px solid rgba(255,213,89,.22)", borderRadius: 14, background: "rgba(255,213,89,.06)" }}><span style={{ color: "#ffe079", fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>COLLECT YOUR WAY</span><span style={{ marginTop: 6, color: "#9caec3", fontSize: 11, lineHeight: 1.35 }}>Catches, shinies, balls, ribbons, and private notes.</span></div>
    </aside>

    <main style={{ minWidth: 0, height: "100%", display: "flex", flex: 1, flexDirection: "column", padding: "7px 8px 0" }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}><span style={{ display: "flex", flexDirection: "column" }}><small style={{ color: "#59e1d0", fontSize: 11, fontWeight: 900, letterSpacing: 2 }}>POKÉMON HOME NATIONAL DEX</small><b style={{ marginTop: 5, fontSize: 34, letterSpacing: -1.4 }}>My Living Dex</b><span style={{ marginTop: 4, color: "#9eb0c6", fontSize: 14 }}>921 of 1,025 registered · 214 shinies found</span></span><span style={{ display: "flex", alignItems: "center", padding: "10px 13px", border: "1px solid #344f67", borderRadius: 11, color: "#dce8f4", background: "#102338", fontSize: 11, fontWeight: 900 }}>Private account saving</span></header>
      <section style={{ display: "flex", alignItems: "center", padding: 13, marginBottom: 13, border: "1px solid rgba(135,171,215,.18)", borderRadius: 17, background: "linear-gradient(105deg, rgba(34,87,107,.28), rgba(6,16,30,.86))" }}>
        <span style={{ width: 72, height: 72, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 14, border: "7px solid #59e1d0", borderRadius: 999, background: "#0a1725", fontSize: 21, fontWeight: 900 }}>90%</span>
        <span style={{ display: "flex", flexDirection: "column" }}><small style={{ color: "#59e1d0", fontSize: 10, fontWeight: 900, letterSpacing: 1.2 }}>NEXT MILESTONE</small><b style={{ marginTop: 5, fontSize: 22 }}>925 registered</b><span style={{ marginTop: 4, color: "#8799ae", fontSize: 11 }}>Every detail stays private to your account.</span></span>
        <span style={{ display: "flex", marginLeft: "auto" }}><b style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginRight: 24, fontSize: 23 }}>921<small style={{ marginTop: 2, color: "#8699af", fontSize: 9, letterSpacing: 1 }}>STANDARD</small></b><b style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", color: "#ffe079", fontSize: 23 }}>214<small style={{ marginTop: 2, color: "#ad9a66", fontSize: 9, letterSpacing: 1 }}>SHINY</small></b></span>
      </section>
      <section style={{ display: "flex", alignItems: "center", marginBottom: 12 }}><span style={{ width: 360, display: "flex", padding: "10px 13px", border: "1px solid #30485f", borderRadius: 11, color: "#6f8198", background: "#091725", fontSize: 11 }}>⌕&nbsp;&nbsp; Search by name or number…</span><span style={{ display: "flex", marginLeft: 9, padding: "10px 13px", borderRadius: 10, color: "#07191b", background: "#59e1d0", fontSize: 10, fontWeight: 900 }}>REGISTERED</span><span style={{ display: "flex", marginLeft: 7, padding: "10px 13px", border: "1px solid #30485f", borderRadius: 10, color: "#8da0b5", background: "#0b1928", fontSize: 10, fontWeight: 900 }}>ALL</span><span style={{ display: "flex", marginLeft: "auto", color: "#8295aa", fontSize: 11 }}>Forms · Balls · Ribbons · Marks</span></section>
      <section style={{ display: "flex", flexWrap: "wrap", overflow: "hidden" }}>{pokemon.map((item) => <PokemonTile key={item[0]} item={item} />)}</section>
    </main>
  </div>;
}
