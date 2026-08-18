function isStaff(role) {
  return role === "commissioner" || role === "co_commissioner";
}

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function teamOwnedBy(team, userId, identity) {
  if (team?.claimedByUserId) return team.claimedByUserId === userId;
  return Boolean(identity && normalized(team?.claimedBy) === normalized(identity));
}

function draftIsComplete(state) {
  if (!state?.locked) return false;
  if (state.settings?.draftType === "auction") return Boolean(state.auctionEnded || !state.pool?.length);
  return Array.isArray(state.snakeOrder) && Number(state.pickIndex || 0) >= state.snakeOrder.length;
}

function nextUnreportedMatch(state, teamIndex) {
  if (!Number.isInteger(teamIndex) || teamIndex < 0) return null;
  for (let week = 0; week < (state.schedule || []).length; week += 1) {
    for (let match = 0; match < (state.schedule[week] || []).length; match += 1) {
      const pair = state.schedule[week][match] || [];
      if (!pair.includes(teamIndex) || state.matchResults?.[`${week}-${match}`]) continue;
      const opponentIndex = pair[0] === teamIndex ? pair[1] : pair[0];
      return { week, opponent: state.teams?.[opponentIndex]?.name || "your opponent" };
    }
  }
  return null;
}

function action(title, detail, href, priority, stage) {
  return { title, detail, href, priority, stage };
}

export function nextLeagueAction(entry, state, { userId = "", identity = "" } = {}) {
  const league = entry?.league || {};
  const role = entry?.role || "coach";
  const href = `/?league=${encodeURIComponent(league.slug || league.id || "")}`;
  const teams = Array.isArray(state?.teams) ? state.teams : [];
  const ownedTeamIndex = teams.findIndex((team) => teamOwnedBy(team, userId, identity));

  if (league.on_clock) return action("Make your draft pick", `${league.name} is waiting for you.`, href, 0, "draft");
  if (!state) return action("Open your league", "Review the latest league status.", href, 8, "open");

  if (role === "coach" && ownedTeamIndex < 0 && !state.locked) {
    return action("Choose your team", `Claim an open team in ${league.name}.`, href, 1, "join");
  }

  if (isStaff(role) && !state.locked) {
    const expected = Number(state.settings?.leagueSize || teams.length || 0);
    const claimed = teams.filter((team) => team?.claimedBy || team?.claimedByUserId).length;
    if (!state.homepage?.rules?.trim()) return action("Post the league rules", `Give ${league.name}'s managers one source of truth.`, href, 2, "setup");
    if (expected > 0 && claimed < expected) return action("Invite the remaining managers", `${claimed} of ${expected} teams are claimed.`, href, 3, "invite");
    if (!state.settings?.draftScheduledAt) return action("Schedule the draft", "Set the shared date or confirm a manual start.", href, 4, "schedule");
    return action("Finish the launch checklist", "Review readiness and start the draft when everyone is ready.", href, 5, "setup");
  }

  if (state.locked && !draftIsComplete(state)) {
    return action("Follow the live draft", `See the board and whose turn is next in ${league.name}.`, href, 2, "draft");
  }

  if (draftIsComplete(state) && !(state.schedule || []).length) {
    return isStaff(role)
      ? action("Create the season schedule", "Turn completed rosters into the first matchups.", href, 2, "schedule")
      : action("Review your completed roster", "The commissioner is preparing the season schedule.", href, 6, "roster");
  }

  const nextMatch = nextUnreportedMatch(state, ownedTeamIndex);
  if (nextMatch) return action("Prepare for your next match", `Week ${nextMatch.week + 1} against ${nextMatch.opponent}.`, href, 3, "match");

  if (isStaff(role) && (state.schedule || []).length && Object.keys(state.matchResults || {}).length === 0) {
    return action("Record the first result", "Help the season move from scheduled to active.", href, 3, "result");
  }

  return action("Check league progress", "Review standings, transactions, and upcoming deadlines.", href, 9, "review");
}

export function buildWeeklyLeagueAgenda(memberships, states, context = {}) {
  const stateByLeague = states instanceof Map ? states : new Map(Object.entries(states || {}));
  return (memberships || [])
    .filter((entry) => entry?.league && !entry.archived_at && entry.league.status !== "archived")
    .map((entry) => ({
      leagueId: entry.league.id,
      leagueName: entry.league.name,
      updatedAt: entry.league.updated_at || null,
      ...nextLeagueAction(entry, stateByLeague.get(entry.league.id), context),
    }))
    .sort((a, b) => a.priority - b.priority || a.leagueName.localeCompare(b.leagueName));
}
