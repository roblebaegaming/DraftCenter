export default function SocialPreviewImage({ eyebrow, title, description, accent = "#ffd23f", connections = false }) {
  const marks = ["#f9df6d", "#a0c35a", "#b0c4ef", "#ba81c5"];
  return <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "64px 72px", color: "#f7f8ff", background: "linear-gradient(135deg, #080d1c 0%, #121a38 58%, #0b1731 100%)", fontFamily: "Arial, sans-serif" }}>
    <div style={{ width: connections ? "66%" : "82%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 38 }}>
        <div style={{ width: 66, height: 66, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 20, border: `3px solid ${accent}`, borderRadius: 18, color: accent, fontSize: 27, fontWeight: 900 }}>DC</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ color: accent, fontSize: 24, fontWeight: 900, letterSpacing: 3 }}>DRAFTCENTER</span>
          <span style={{ color: "#9ca8cb", fontSize: 18 }}>draftcentral.gg</span>
        </div>
      </div>
      <span style={{ marginBottom: 14, color: "#7ce1d7", fontSize: 20, fontWeight: 800, letterSpacing: 2 }}>{eyebrow}</span>
      <div style={{ marginBottom: 20, fontSize: title.length > 34 ? 56 : 66, fontWeight: 900, lineHeight: 1.04 }}>{title}</div>
      <div style={{ maxWidth: 850, color: "#b9c3e2", fontSize: 27, lineHeight: 1.35 }}>{description}</div>
    </div>
    {connections && <div style={{ width: 292, display: "flex", flexWrap: "wrap", alignContent: "center" }}>
      {marks.flatMap((color, row) => [0, 1, 2, 3].map((column) => <span key={`${row}-${column}`} style={{ width: 61, height: 61, margin: 6, borderRadius: 13, background: color, boxShadow: "0 8px 18px rgba(0,0,0,.22)" }} />))}
    </div>}
  </div>;
}
