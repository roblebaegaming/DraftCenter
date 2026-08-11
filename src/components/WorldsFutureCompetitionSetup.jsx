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
        <span className="eyebrow">FORMAT BOUNDARY</span>
        <h2>Pick 10, Your Champion, no invented Worlds bracket</h2>
        <p>The individual prediction format is set: choose 10 Trainers and name Your Champion for double placement points. The current handbook confirms Great League play but does not publish the exact 2026 Worlds phase size or pairings.</p>
        <ul>{sourceRegistry.predictionDesign.doNotAssume.map((item) => <li key={item}>{item}</li>)}</ul>
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
      ["complete", "Prediction choice", "Use Pick 10 with one Your Champion choice worth double placement points."],
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
        <h2>{qualificationCount} modeled team awards</h2>
        <p>This total comes from the published qualification paths. It is not a final registered roster, and DraftCenter will not turn it into one without named, reviewed teams.</p>
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
        <span className="eyebrow">TOURNAMENT SHAPE</span>
        <h2>Groups first, bracket only when published</h2>
        <p>Pokémon confirms 5-on-5 team play. DraftCenter can reuse the complete-bracket privacy and scoring safeguards after the official Worlds groups, advancing teams, pairings, and deadline are reviewed.</p>
        <ul>
          <li>Never derive Worlds seeds from Regional League standings.</li>
          <li>Keep every user bracket private before the owner-set lock.</li>
          <li>Record team results with explicit upstream and downstream match dependencies.</li>
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
      ["active", "Final team roster", "Review every qualified and registered team name, source path, region, and organization alias."],
      ["pending", "Groups and pairings", "Load the official Worlds structure without inventing seeds, byes, or matches."],
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
          ? "The individual qualification rules and Pick 10 format are set. DraftCenter is waiting for a complete, deduplicated Worlds roster before exposing names or opening entries."
          : "The qualification paths and 5-on-5 team unit are known. DraftCenter is waiting for the final registered teams and official Worlds groups before opening a team bracket."}</p>
        <div className="worlds-hero-actions">
          <a className="primary-button inline-link-button" href="#source-audit">See the source audit</a>
          <Link className="quiet-button" href="/worlds/2026">Back to Worlds Predictions</Link>
        </div>
      </div>
      <aside className="worlds-event-card worlds-tcg-build-card worlds-future-build-card">
        <span>BUILD STATUS</span>
        <strong>Waiting for official roster</strong>
        <p>Saving and polling stay closed.</p>
        <dl>
          <div><dt>Entry unit</dt><dd>{isGo ? "Individual Trainer" : "5-on-5 team"}</dd></div>
          <div><dt>Known base</dt><dd>{validation.qualificationCount} {isGo ? "CP slots" : "awards"}</dd></div>
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
