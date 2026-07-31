import { MANUALS } from "../../lib/manualContent";

export const metadata = { title: "DraftCenter Manuals", description: "Step-by-step DraftCenter manuals for league commissioners and team managers.", alternates: { canonical: "/manuals" } };

export default function ManualsPage() {
  return <main className="resources-shell"><nav className="public-page-nav"><a className="quiet-button" href="/">DraftCenter</a><a className="quiet-button" href="/guides">Draft guides</a><a className="quiet-button" href="/resources">Resources</a></nav><header className="resources-hero"><span className="eyebrow">DRAFTCENTER HELP</span><h1>Choose your manual.</h1><p>Follow the actual DraftCenter workflow from joining or creating a league through the final match of the season.</p></header><section className="manual-choice-grid">{Object.entries(MANUALS).map(([role, manual]) => <a key={role} href={`/manuals/${role}`}><span className="eyebrow">{manual.audience}</span><h2>{manual.label}</h2><p>{manual.description}</p><strong>Open manual →</strong></a>)}</section><aside className="manual-help-note"><h2>League rules come first</h2><p>These manuals explain how DraftCenter works. Your league’s published rules decide its battle format, deadlines, transaction policy, and remedies for missed matches or disputed results.</p></aside></main>;
}
