import Link from "next/link";
import { WORLDS_2026_SCORING } from "../lib/worlds2026";
import WorldsDisciplineNav from "./WorldsDisciplineNav";

function displayDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

function sourceStatusLabel(status) {
  return ({
    "official-leaderboard-published": "Official standings published",
    "final-invite-roster-required": "Final invite roster needed",
  })[status] || status;
}

export default function WorldsTcgPickSixteenSetup({ sourceRegistry }) {
  const cpSlots = sourceRegistry.qualificationRules.championshipPointSlots;

  return <main className="worlds-shell worlds-tcg-setup">
    <WorldsDisciplineNav current="tcg" />

    <section className="worlds-hero worlds-tcg-hero">
      <div>
        <span className="eyebrow">POKÉMON TCG · MASTERS DIVISION</span>
        <h1>TCG Pick 10 is being built from the complete invite field.</h1>
        <p>The scoring and Your Champion choice are set. Before selections open, DraftCenter is reconciling every official Championship Point cutoff, direct invite, and separately managed regional program into one Masters-only roster.</p>
        <div className="worlds-hero-actions">
          <a className="primary-button inline-link-button" href="#source-audit">See the source audit</a>
          <Link className="quiet-button" href="/worlds/2026/vgc">Play VGC Pick 10</Link>
        </div>
      </div>
      <aside className="worlds-event-card worlds-tcg-build-card">
        <span>BUILD STATUS</span>
        <strong>Source reconciliation</strong>
        <p>Saving stays closed until the roster audit passes.</p>
        <dl>
          <div><dt>Division</dt><dd>TCG Masters</dd></div>
          <div><dt>Format</dt><dd>Pick 10 + Your Champion</dd></div>
          <div><dt>Sources checked</dt><dd>{displayDate(sourceRegistry.sourceCheckedAt)}</dd></div>
        </dl>
      </aside>
    </section>

    <section className="worlds-trust-note worlds-tcg-safety">
      <div><span className="eyebrow">MASTERS DIVISION ONLY</span><h2>Junior and Senior competitors stay out of this pool</h2></div>
      <p>TCG uses the official Masters division only. Masters is not an adult-only guarantee and can include people under 18. DraftCenter will not collect or infer birth dates; it will exclude every row identified by Pokémon as Junior or Senior.</p>
      <strong>Roster gate active</strong>
    </section>

    <section className="worlds-tcg-grid" id="source-audit">
      <article className="worlds-tcg-source-card">
        <span className="eyebrow">OFFICIAL 2026 QUALIFICATION RULES</span>
        <h2>425 Championship Point slots</h2>
        <p>Pokémon publishes a fixed Masters cutoff for each TPCi rating zone. These standings are only the first part of the field.</p>
        <div className="worlds-tcg-source-table">
          {cpSlots.map((zone) => <div key={zone.ratingZone}>
            <span><strong>{zone.ratingZone}</strong><small>{sourceStatusLabel(zone.status)}</small></span>
            <b>{zone.slots}</b>
          </div>)}
          <div className="is-total"><span><strong>Total CP slots</strong></span><b>{sourceRegistry.qualificationRules.championshipPointSlotTotal}</b></div>
        </div>
        <a className="quiet-button" href={sourceRegistry.qualificationRules.url} target="_blank" rel="noreferrer">Read Pokémon&apos;s qualification rules ↗</a>
      </article>

      <article className="worlds-tcg-source-card">
        <span className="eyebrow">DIRECT INVITES</span>
        <h2>Event results must be added and deduplicated</h2>
        <p>Direct invites do not pass down when a player already qualified, so event winners cannot simply be added without matching them against the standings.</p>
        <ul>{sourceRegistry.qualificationRules.directInvitePaths.map((path) => <li key={path}>{path}</li>)}</ul>
        <a className="quiet-button" href={sourceRegistry.leaderboard.url} target="_blank" rel="noreferrer">Open the official TCG Masters leaderboard ↗</a>
      </article>

      <article className="worlds-tcg-source-card">
        <span className="eyebrow">SEPARATE REGIONAL PROGRAMS</span>
        <h2>Four more invite paths need final rosters</h2>
        <p>Pokémon states that these regions award invitations through their own organized play programs rather than the Championship Point table above.</p>
        <ul className="worlds-tcg-program-list">{sourceRegistry.separatePrograms.map((item) => <li key={item.program}><strong>{item.program}</strong><span>{sourceStatusLabel(item.status)}</span></li>)}</ul>
      </article>

      <aside className="worlds-scoring-card worlds-tcg-scoring-card">
        <span className="eyebrow">SCORING LOCKED IN</span>
        <h2>Champion: 30 points. Your Champion: ×2.</h2>
        <p>Each entry will choose 10 TCG Masters competitors and designate Your Champion, whose placement score counts twice.</p>
        <ol>{WORLDS_2026_SCORING.map(([label, points]) => <li key={label}><span>{label}</span><strong>{points} pts</strong></li>)}</ol>
      </aside>
    </section>

    <section className="worlds-tcg-readiness">
      <header><span className="eyebrow">RELEASE GATES</span><h2>What remains before TCG picks open</h2></header>
      <ol>
        <li className="is-complete"><span>1</span><div><strong>Product rules</strong><p>Pick 10, 30-point champion, Your Champion ×2, Masters only.</p></div></li>
        <li className="is-active"><span>2</span><div><strong>Championship Point cutoffs</strong><p>Reconcile the five official zone leaderboards against their exact Masters slot counts.</p></div></li>
        <li><span>3</span><div><strong>Direct and separate-program invites</strong><p>Add official event earners and the Japan, South Korea, mainland China, and Asia-Pacific rosters without duplicates.</p></div></li>
        <li><span>4</span><div><strong>Isolated Preview test</strong><p>Apply a new forward-only migration, then verify saving, privacy, scoring, RLS, grants, and cleanup away from production.</p></div></li>
      </ol>
      <p className="worlds-tcg-gate-note"><strong>Fail-closed:</strong> no competitor cards, picks, or saved entries will appear until the complete Masters roster has passed the source audit.</p>
    </section>
  </main>;
}
