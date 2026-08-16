export const metadata = {
  title: "Team Lab offline",
  robots: { index: false, follow: false },
};

export default function TeamLabOfflinePage() {
  return <main className="team-lab-offline">
    <article>
      <img src="/draftcenter-logo.png" alt="" />
      <span className="eyebrow">TEAM LAB IS OFFLINE</span>
      <h1>Your private teams stayed in your account.</h1>
      <p>Reconnect, then reopen Team Lab. Matchup-local Battle Room recovery may still be available in the browser where you were recording, but account saves require a connection.</p>
      <div><a className="primary-button inline-link-button" href="/team-lab/">Try Team Lab again</a><a className="quiet-button inline-link-button" href="/">DraftCenter</a></div>
    </article>
  </main>;
}
