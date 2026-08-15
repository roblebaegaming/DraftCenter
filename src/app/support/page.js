export const metadata = {
  title: "Support DraftCenter",
  description: "Support DraftCenter and the Founding Collector beta with an optional one-time contribution.",
  alternates: { canonical: "/support" },
  robots: { index: false, follow: true },
};

const KOFI_URL = "https://ko-fi.com/draftcenter";

export default function SupportPage() {
  return <main className="support-shell">
    <nav className="public-page-nav">
      <a className="quiet-button" href="/">DraftCenter Home</a>
      <a className="quiet-button" href="/resources">Free resources</a>
    </nav>

    <section className="support-card">
      <span className="eyebrow">OPTIONAL COMMUNITY SUPPORT</span>
      <h1>Help keep DraftCenter running.</h1>
      <p className="support-lead">DraftCenter&apos;s core league tools are free. If the site has been useful to you, an optional one-time tip helps cover hosting and ongoing maintenance.</p>

      <aside className="support-pro-note">
        <span className="eyebrow">FOUNDING COLLECTOR BETA</span>
        <h2>Help shape Collector&apos;s convenience layer.</h2>
        <p>If private Pokédex checklists, CSV import, safe JSON restore, collection inventory, or the Collector workbook help you, the suggested founding contribution is $10—or any amount you choose. This is voluntary support, not a purchase, subscription, entitlement, or promise of future premium access.</p>
        <a className="quiet-button inline-link-button" href="/pokedex-tracker/#collector-founding-beta">Open DraftCenter Collector</a>
      </aside>

      <div className="support-promises" aria-label="What support means">
        <article><strong>No paywall</strong><span>Supporting is never required to use current league or Collector tools.</span></article>
        <article><strong>No recurring commitment</strong><span>Ko-fi offers a one-time tip option. Confirm “One time” before paying and choose only what feels comfortable.</span></article>
        <article><strong>No competitive advantage</strong><span>Support does not change drafts, rankings, league access, or community visibility.</span></article>
      </div>

      <a className="support-kofi-button" href={KOFI_URL} target="_blank" rel="noopener">
        Open the Ko-fi support page <span aria-hidden="true">↗</span>
      </a>
      <p className="support-fine-print">Ko-fi and the connected payment provider process the payment. Their terms and privacy practices apply when you leave DraftCenter.</p>
    </section>

    <section className="support-pro-note">
      <span className="eyebrow">LOOKING AHEAD</span>
      <h2>What about DraftCenter Pro?</h2>
      <p>There is no paid plan today. We&apos;re watching how commissioners, coaches, and collectors use DraftCenter before deciding whether optional convenience features would be genuinely useful. Current features will not be moved behind a paywall just to create a subscription.</p>
    </section>
  </main>;
}
