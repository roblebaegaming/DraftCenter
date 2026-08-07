export default function SiteLegalFooter() {
  return <footer className="site-legal-footer">
    <div className="site-footer-links">
      <section className="site-footer-group">
        <h2>Explore</h2>
        <nav aria-label="Explore DraftCenter">
          <a href="/pokemon">Pokédex</a>
          <a href="/formats">Formats</a>
          <a href="/guides">Guides</a>
          <a href="/resources/daily-games">Daily Games</a>
        </nav>
      </section>
      <section className="site-footer-group">
        <h2>DraftCenter</h2>
        <nav aria-label="DraftCenter information and help">
          <a href="/about">About &amp; Data</a>
          <a href="/resources">Resources</a>
          <a href="/manuals">Manuals &amp; Help</a>
          <a href="/support">Support</a>
        </nav>
      </section>
      <section className="site-footer-group">
        <h2>Policies</h2>
        <nav aria-label="Policies and legal information">
          <a href="/legal">Legal, Privacy &amp; Community Rules</a>
          <a href="/legal#intellectual-property">Intellectual Property</a>
          <a href="/legal#third-party-services">Connected Services</a>
        </nav>
      </section>
    </div>
    <div className="site-footer-notes">
      <p>DraftCenter is an independent fan project and is not affiliated with or endorsed by Nintendo, Creatures Inc., GAME FREAK inc., or The Pokémon Company.</p>
      <p>Pokémon names, characters, artwork, and trademarks belong to their respective owners.</p>
    </div>
  </footer>;
}
