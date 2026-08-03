import { notFound } from "next/navigation";
import { MANUALS, manualByRole } from "../../../lib/manualContent";

export function generateStaticParams() { return Object.keys(MANUALS).map((role) => ({ role })); }
export async function generateMetadata({ params }) { const { role } = await params; const manual = manualByRole(role); if (!manual) return { title: "Manual Not Found", robots: { index: false, follow: true } }; return { title: manual.label, description: manual.description, alternates: { canonical: `/manuals/${role}` } }; }

export default async function ManualPage({ params }) {
  const { role } = await params; const manual = manualByRole(role); if (!manual) notFound(); const otherRole = role === "commissioner" ? "manager" : "commissioner";
  return <main className="manual-shell">
    <nav className="public-page-nav"><a className="quiet-button" href="/manuals">← All manuals</a><a className="quiet-button" href={`/manuals/${otherRole}`}>{MANUALS[otherRole].label}</a><a className="quiet-button" href="/">DraftCenter Home</a></nav>
    <article>
      <header className="manual-hero"><span className="eyebrow">{manual.audience}</span><h1>{manual.title}</h1><p>{manual.intro}</p></header>
      {role === "commissioner" && <aside className="manual-fast-path" aria-label="Commissioner quick help">
        <div><span className="eyebrow">START HERE</span><h2>Find the answer quickly</h2><p>Use the chapter links for step-by-step instructions. Inside any league, the yellow <strong>Help</strong> button is beside <strong>Commissioner Tools</strong>.</p></div>
        <div className="manual-fast-actions"><a href="#chapter-2">Set up a league</a><a href="#chapter-4">Prepare the draft</a><a href="#before-draft-day">Draft-day checklist</a></div>
        <p className="manual-support-direction"><strong>Need a person?</strong> Open <strong>Commissioner Tools → Get help with this league → Create support request</strong>.</p>
      </aside>}
      <nav className="manual-contents" aria-label="Manual contents"><strong>In this manual</strong><ol>{manual.chapters.map((chapter, index) => <li key={chapter.title}><a href={`#chapter-${index + 1}`}>{chapter.title}</a></li>)}</ol></nav>
      {manual.chapters.map((chapter, index) => <section id={`chapter-${index + 1}`} className="manual-chapter" key={chapter.title}><span className="manual-step-number">{String(index + 1).padStart(2, "0")}</span><div><h2>{chapter.title}</h2><p>{chapter.summary}</p><ol>{chapter.steps.map((step) => <li key={step}>{step}</li>)}</ol></div></section>)}
      <section id="before-draft-day" className="manual-checklist"><h2>Before draft day</h2>{manual.checklist.map((item) => <label key={item}><input type="checkbox" /> <span>{item}</span></label>)}</section>
      <aside className="seo-next-step"><h2>{role === "commissioner" ? "Ready to build your league?" : "Ready to open your team?"}</h2><p>{role === "commissioner" ? "Sign in and open Start a new league. Keep this checklist nearby while you configure Setup." : "Sign in with the account that accepted your invitation, then open the league from your DraftCenter home."}</p><a className="primary-button inline-link-button" href="/">Go to DraftCenter</a></aside>
    </article>
  </main>;
}
