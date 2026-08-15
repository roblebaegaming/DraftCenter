export const metadata = {
  title: "Collector offline | DraftCenter",
  robots: { index: false, follow: false },
};

export default function CollectorOfflinePage() {
  return <main className="dex-tracker-shell">
    <section className="dex-tracker-signin">
      <img className="dex-collector-offline-icon" src="/pokedex-collector-icon-192.png" alt="" />
      <span className="dex-kicker">COLLECTOR IS OFFLINE</span>
      <h1>Your private collection stayed on the server.</h1>
      <p>Reconnect to the internet, then reload and sign in. DraftCenter does not cache tracker pages, private notes, individual records, or account responses for offline use.</p>
      <div><a className="dex-primary-button" href="/pokedex-tracker/">Try Collector again</a><a className="dex-secondary-button" href="/">DraftCenter home</a></div>
    </section>
  </main>;
}
