import Link from "next/link";
import { validateWorldsSourceRegistry } from "../lib/worldsSourceRegistry";
import WorldsDisciplineNav from "./WorldsDisciplineNav";

function displayDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

function SourceLinks({ sources }) {
  return <ul className="worlds-future-source-list">
    {sources.map((source) => <li key={source.url}>
      <a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>
    </li>)}
  </ul>;
}

function GoSetup({ sourceRegistry, qualificationCount }) {
  const rules = sourceRegistry.qualificationRules;
  return <>
    <section className="worlds-future-grid" id="source-audit">
      <article className="worlds-tcg-source-card">
        <span className="eyebrow">VERIFIED 2026 QUALIFICATION BASE</span>
        <h2>{qualificationCount} Championship Point slots</h2>
        <p>This is the known TPCi-managed qualification base—not the final Worlds attendance list. Direct invites and separately managed regions still have to be added and deduplicated.</p>
        <div className="worlds-tcg-source-table">
          {rules.championshipPointSlots.map((zone) => <div key={zone.ratingZone}>
            <span><strong>{zone.ratingZone}</strong><small>Official CP cutoff</small></span>
            <b>{zone.slots}</b>
          </div>)}
          <div className="is-total"><span><strong>Known CP slots</strong></span><b>{qualificationCount}</b></div>
        </div>
      </article>

      <article className="worlds-tcg-source-card">
        <span className="eyebrow">ROSTER RECONCILIATION</span>
        <h2>The leaderboard is not the final field</h2>
        <p>GO has one individual competition, but its complete invite-earned pool requires more than a Championship Point cutoff.</p>
        <ul>
          {rules.directInvitePaths.map((path) => <li key={path}>{path}</li>)}
          <li>{rules.separatePrograms.join(", ")} program invites</li>
          <li>Deduplication and official registration changes</li>
        </ul>
      </article>

      <article className="worlds-tcg-source-card">
        <span className="eyebrow">OFFICIAL TOURNAMENT FORMAT</span>
        <h2>32 pools feed a double-elimination final stage</h2>
        <p>The official competitor page and organizer bracket shell now publish the three-day shape. The shell still contained zero players at the August 11 source check, so it is structure evidence—not a final roster.</p>
        <ul>
          <li>Friday: 32 double-elimination pools, with two Trainers advancing from each pool.</li>
          <li>Saturday: the Final Phase stays double elimination until two Trainers remain.</li>
          <li>Sunday: the Grand Final determines the Champion.</li>
          <li>Matches are best-of-three except the Winners Final, Losers Final, and Grand Final, which are best-of-five.</li>
        </ul>
      </article>

      <article className="worlds-tcg-source-card worlds-future-automation-card">
        <span className="eyebrow">AUTOMATION READY POINTS</span>
        <h2>One reviewed roster can drive picks and scoring</h2>
        <p>The source registry now defines the exact gates for a future importer. Polling remains off until a structured feed and permission are confirmed.</p>
        <ul>{sourceRegistry.resultAutomation.requirements.map((item) => <li key={item}>{item}</li>)}</ul>
      </article>
    </section>

    <ReadinessSteps game="GO" steps={[
      ["complete", "Entry unit", "Use individual Pokémon GO Trainers; do not split into age divisions or infer private ages."],
      ["active", "Roster audit", "Reconcile 220 CP slots, direct invites, regional programs, duplicates, and registration changes."],
      ["complete", "Published format", "Use the reviewed 32-pool, two-advancer, double-elimination structure without inventing entrants or pairings."],
      ["pending", "Preview activation", "Add a forward-only migration, then test privacy, saving, result mapping, and cleanup in an isolated Preview."],
    ]} />
  </>;
}

function UniteSetup({ sourceRegistry, qualificationCount }) {
  const rules = sourceRegistry.qualificationRules;
  return <>
    <section className="worlds-future-grid" id="source-audit">
      <article className="worlds-tcg-source-card">
        <span className="eyebrow">VERIFIED 2026 QUALIFICATION MODEL</span>
        <h2>{qualificationCount} modeled TPCi team awards</h2>
        <p>This subtotal comes from TPCi&apos;s published qualification paths. Separately managed regional programs and the final registered roster still require review, so DraftCenter will not turn this subtotal into a field.</p>
        <div className="worlds-tcg-source-table worlds-unite-source-table">
          {rules.qualificationAwards.map((award) => <div key={award.path}>
            <span><strong>{award.path}</strong><small>Qualification award</small></span>
            <b>{award.teams}</b>
          </div>)}
          <div className="is-total"><span><strong>Modeled awards</strong></span><b>{qualificationCount}</b></div>
        </div>
      </article>

      <article className="worlds-tcg-source-card">
        <span className="eyebrow">TEAM IDENTITY</span>
        <h2>Predictions belong to teams, not five player picks</h2>
        <p>Organizations can rename, transfer slots, or change eligible players. The stable competition unit is the qualified team, backed by reviewed aliases and an audit trail.</p>
        <ul>{sourceRegistry.predictionDesign.doNotAssume.map((item) => <li key={item}>{item}</li>)}</ul>
      </article>

      <article className="worlds-tcg-source-card">
        <span className="eyebrow">OFFICIAL TOURNAMENT FORMAT</span>
        <h2>Round-robin groups feed single-elimination playoffs</h2>
        <p>Pokémon now confirms the three-day phase structure. The registered teams, group sizes, group assignments, advancement count, pairings, and prediction deadline are still unpublished.</p>
        <ul>
          <li>Friday: single round-robin groups; the top teams advance.</li>
          <li>Saturday: a single-elimination bracket, with the Top Four played best-of-five.</li>
          <li>Sunday: a best-of-five Final determines the Champion.</li>
          <li>Other matches are best-of-three; group size and group match length will be announced on-site.</li>
        </ul>
      </article>

      <article className="worlds-tcg-source-card worlds-future-automation-card">
        <span className="eyebrow">AUTOMATION READY POINTS</span>
        <h2>Team aliases are the critical importer boundary</h2>
        <p>UNITE is the smaller build, but organization and roster-name changes make silent fuzzy matching unsafe.</p>
        <ul>{sourceRegistry.resultAutomation.requirements.map((item) => <li key={item}>{item}</li>)}</ul>
      </article>
    </section>

    <ReadinessSteps game="UNITE" steps={[
      ["complete", "Entry unit", "Use qualified 5-on-5 teams; player rosters are supporting attribution, not prediction entries."],
      ["complete", "Published format", "Use round-robin groups followed by single-elimination playoffs; Top Four and Finals are best-of-five."],
      ["active", "Teams and assignments", "Review every registered team, alias, group assignment, advancement rule, pairing, and deadline."],
      ["pending", "Preview activation", "Add a forward-only migration, then test bracket privacy, progression, corrections, scoring, and cleanup."],
    ]} />
  </>;
}

function ReadinessSteps({ game, steps }) {
  return <section className="worlds-tcg-readiness worlds-future-readiness">
    <header><span className="eyebrow">RELEASE GATES</span><h2>What remains before {game} predictions open</h2></header>
    <ol>{steps.map(([status, title, copy], index) => <li className={status === "pending" ? undefined : `is-${status}`} key={title}>
      <span>{index + 1}</span><div><strong>{title}</strong><p>{copy}</p></div>
    </li>)}</ol>
    <p className="worlds-tcg-gate-note"><strong>Fail-closed:</strong> no names, prediction controls, saved entries, or results polling will appear until these gates pass.</p>
  </section>;
}

export default function WorldsFutureCompetitionSetup({ sourceRegistry }) {
  const validation = validateWorldsSourceRegistry(sourceRegistry);
  const isGo = sourceRegistry.eventId === "2026-pokemon-go";
  const gameLabel = isGo ? "Pokémon GO" : "Pokémon UNITE";

  return <main className={`worlds-shell worlds-future-setup is-${isGo ? "go" : "unite"}`}>
    <WorldsDisciplineNav current={isGo ? "go" : "unite"} />

    <section className="worlds-hero worlds-future-hero">
      <div>
        <span className="eyebrow">{gameLabel.toUpperCase()} · 2026 WORLD CHAMPIONSHIPS</span>
        <h1>{gameLabel} predictions are staged, not guessed.</h1>
        <p>{isGo
          ? "The individual qualification rules, Pick 10 design, and 32-pool tournament format are set. DraftCenter is waiting for a complete, deduplicated Worlds roster before exposing names or opening entries."
          : "The 5-on-5 team unit and round-robin-to-single-elimination format are known. DraftCenter is waiting for the registered teams, group assignments, advancement details, and pairings before opening a team bracket."}</p>
        <div className="worlds-hero-actions">
          <a className="primary-button inline-link-button" href="#source-audit">See the source audit</a>
          <Link className="quiet-button" href="/worlds/2026">Back to Worlds Predictions</Link>
        </div>
      </div>
      <aside className="worlds-event-card worlds-tcg-build-card worlds-future-build-card">
        <span>BUILD STATUS</span>
        <strong>Format published · roster pending</strong>
        <p>Saving and polling stay closed.</p>
        <dl>
          <div><dt>Entry unit</dt><dd>{isGo ? "Individual Trainer" : "5-on-5 team"}</dd></div>
          <div><dt>{isGo ? "Known base" : "Known TPCi base"}</dt><dd>{validation.qualificationCount} {isGo ? "CP slots" : "awards"}</dd></div>
          <div><dt>Sources checked</dt><dd>{displayDate(sourceRegistry.sourceCheckedAt)}</dd></div>
        </dl>
      </aside>
    </section>

    <section className="worlds-trust-note worlds-future-safety">
      <div><span className="eyebrow">SOURCE-FIRST BUILD</span><h2>No fictional roster and no silent identity matching</h2></div>
      <p>{isGo
        ? "GO is an individual competition, but official eligibility is not permission to collect or infer private age data. DraftCenter needs only the published competitor identity and qualification path."
        : "UNITE remains team-based end to end. Player handles may support attribution, but predictions and scoring attach to reviewed team identities and aliases."}</p>
      <strong>Roster gate active</strong>
    </section>

    {isGo
      ? <GoSetup sourceRegistry={sourceRegistry} qualificationCount={validation.qualificationCount} />
      : <UniteSetup sourceRegistry={sourceRegistry} qualificationCount={validation.qualificationCount} />}

    <section className="worlds-future-sources">
      <div><span className="eyebrow">REVIEWED REFERENCES</span><h2>Current source registry</h2></div>
      <SourceLinks sources={sourceRegistry.sources} />
    </section>
  </main>;
}
