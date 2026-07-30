export const metadata = {
  title: "Support DraftCenter",
  description: "Help cover DraftCenter's operating costs with an optional one-time tip.",
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

      <div className="support-promises" aria-label="What support means">
        <article><strong>No paywall</strong><span>Supporting is never required to use the current league tools.</span></article>
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
      <p>There is no paid plan today. We&apos;re watching how commissioners and coaches use DraftCenter before deciding whether optional Pro features would be genuinely useful. Current features will not be moved behind a paywall just to create a subscription.</p>
    </section>
  </main>;
}
