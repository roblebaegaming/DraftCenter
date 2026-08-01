export const MANUALS = {
  commissioner: {
    label: "Commissioner manual",
    title: "Create and run a league in DraftCenter",
    description: "A start-to-finish DraftCenter manual for creating a league, inviting managers, configuring the draft, running the season, and archiving a champion.",
    intro: "Use this manual as your operating checklist. You can change most choices later, so begin with the league basics, invite a small test group, and confirm the draft room before opening the league to everyone.",
    audience: "For commissioners and co-commissioners",
    chapters: [
      { title: "1. Create the league", summary: "Sign in, open Start a new league, and enter a name, season label, optional draft time, description, image, and access level.", steps: [
        "Choose Private for invite-only setup, Public to watch for a visible league that is closed to new managers, or Open to join for recruiting.",
        "Use Practice league while testing. Practice results stay out of career statistics.",
        "Choose what should happen to visibility when the draft starts. You can still change access later in Commissioner Tools.",
        "Select Create league. DraftCenter opens the new league and gives you commissioner access.",
      ]},
      { title: "2. Set rules and teams", summary: "Open Setup and work through the commissioner workspace before anyone drafts.", steps: [
        "Choose the supported format or custom legal pool, draft type, league size, roster limits, budget or point rules, timers, and special mechanics.",
        "For bulk pricing, download the Pricing Template under Legality & Values. Fill New Price or Rank, upload it, review every proposed change, and confirm the import.",
        "Name teams and divisions if needed. Confirm that the legal pool is large and balanced enough for every roster.",
        "Set transaction limits, standings tiebreakers, schedule style, playoff size, and the league clock for match and claim deadlines.",
        "Save a recovery backup after major setup milestones. Use the spreadsheet export when you need a readable offline record.",
      ]},
      { title: "3. Invite people and share responsibility", summary: "Use Commissioner Tools or Setup to distribute secure links.", steps: [
        "Copy a Manager invite for someone who will claim and run a team. Invite links expire, so create a new one if an old link no longer works.",
        "Use a Spectator link for view-only access. Spectators cannot draft, report results, or manage a roster.",
        "Invite a co-commissioner by email or promote an existing league member. Co-commissioners can help operate the league; only the primary commissioner can delete it.",
        "Ask every manager to sign in, accept the invite, and claim the correct team before draft day.",
      ]},
      { title: "4. Prepare and run the draft", summary: "Treat the Draft Setup readiness messages as the final preflight check.", steps: [
        "Set the official draft date and time. For an unattended snake draft, wait until DraftCenter shows Automatic Start Ready before closing the site.",
        "Resolve every readiness warning: team count, legal pool, roster minimums and maximums, budgets, draft order, and claimed-team assignments.",
        "Use Start Draft Now when everyone is ready, or let a prepared scheduled draft start from the server clock. Auction drafts may still require commissioner action shown in the room.",
        "Pause only when necessary. If the draft happened elsewhere, use the manual roster entry and finalization tools instead of replaying every pick.",
      ]},
      { title: "5. Operate the regular season", summary: "DraftCenter connects the schedule, reported results, standings, transactions, and league communication.", steps: [
        "Generate or edit the schedule, then have either participating manager report each result. Review corrections consistently.",
        "Use Transactions for trades and free-agent activity. Claims process on the configured league clock, or a commissioner can process them early when appropriate.",
        "Use the League Board for durable league-wide messages. Managers can share their own Twitch or YouTube battle from League Home without commissioner approval.",
        "Optionally connect a league Discord channel in Setup and choose which announcements it receives. Personal Discord notifications are configured separately by each member.",
      ]},
      { title: "6. Run playoffs and close the season", summary: "Finish the competitive record before starting a new season.", steps: [
        "Confirm regular-season results and standings, generate the playoff bracket, and report each playoff result and award selection.",
        "After the final, choose End season. This freezes the champion, standings, rosters, bracket, awards, transactions, and history in the archive.",
        "Review the archived season before choosing Start next season. Starting the next season resets active competitive state but keeps the completed archive.",
        "Download a final spreadsheet and recovery backup for your records.",
      ]},
    ],
    checklist: ["League access and draft-start visibility are intentional", "All managers joined and claimed the right teams", "Rules, pool, roster limits, schedule, and playoffs are configured", "Draft readiness has no unresolved warning", "Recovery backup downloaded before the draft"],
  },
  manager: {
    label: "Manager manual",
    title: "Join and manage your DraftCenter team",
    description: "A practical DraftCenter manual for accepting a league invite, claiming a team, drafting, reporting matches, and managing transactions.",
    intro: "Your commissioner controls league-wide rules. Your job is to claim the correct team, prepare your draft queue, make legal selections, report matches, and keep your roster activity current.",
    audience: "For managers and coaches",
    chapters: [
      { title: "1. Join and claim your team", summary: "Open the manager invite from your commissioner and sign in with the account you intend to keep using.", steps: ["Create or sign in to your DraftCenter account, accept the invitation, and open the league from your home page.", "Claim the team assigned to you. If the wrong team is claimed or the invite expired, contact the commissioner rather than creating a second account.", "Review League Home, League Info, the posted rules, draft time, schedule clock, and transaction limits before making changes."]},
      { title: "2. Prepare for the draft", summary: "Use the scouting and queue tools so you are ready before your clock begins.", steps: ["Check the exact legal pool, prices or tiers, roster minimum and maximum, budget, draft type, and enabled mechanics.", "Build and reorder your private draft queue. Queue choices are preparation aids; they do not reserve a Pokémon.", "Join the draft room early. A scheduled draft may open before its start time, but selections begin only when the league clock allows it."]},
      { title: "3. Draft your roster", summary: "Follow the on-screen clock and confirmation prompts for your draft type.", steps: ["In a snake draft, select an available legal Pokémon on your turn. In an auction, nominate and bid without exceeding your remaining roster budget.", "Use auto-draft only when you understand how it will use your queue and available legal choices.", "If a pick, timer, or connection looks wrong, stop and message the commissioner. Avoid refreshing repeatedly while a selection is saving."]},
      { title: "4. Play and report matches", summary: "Use Schedule as the source of truth for opponents, deadlines, and results.", steps: ["Coordinate the battle with your opponent, build only from your current legal roster, and play under the league rules.", "Either participating manager can report the result and eligible MVP information. Check the saved result and standings after submitting.", "Share a live Twitch or YouTube match from League Home if desired. Choose the audience carefully; private leagues never appear in public discovery."]},
      { title: "5. Manage transactions and messages", summary: "Use DraftCenter so roster history and league decisions stay in one place.", steps: ["Propose and respond to trades in Transactions. A trade is not complete until the required response is accepted and saved.", "Use free agency for add/drop moves or claims. Some leagues queue claims until a scheduled processing time instead of applying them immediately.", "Check Messages and the League Board for trade responses, commissioner notices, and league discussion.", "Open your profile to opt into personal Discord notifications. These are separate from the league's Discord announcement channel."]},
      { title: "6. Finish the season", summary: "Playoff qualification and roster locks follow the league's configured rules.", steps: ["Check the Playoffs tab for the official bracket and report eligible postseason matches the same way as regular-season results.", "Review your completed team and history after the commissioner ends the season. Archived seasons remain available when the league rolls over.", "Use My Teams for personal planning workspaces; it is separate from the official roster controlled inside a league."]},
    ],
    checklist: ["Invite accepted with the correct account", "Correct team claimed", "Rules and league clock reviewed", "Draft queue prepared", "Commissioner contacted about any mismatch before draft day"],
  },
};

export function manualByRole(role) { return MANUALS[role]; }
