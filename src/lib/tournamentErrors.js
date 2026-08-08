const SAFE_TOURNAMENT_MESSAGES = new Set([
  "Tournament settings are invalid.",
  "Registration is closed.",
  "This private registration link is invalid.",
  "Enter a display name.",
  "This tournament is full.",
  "Choose one of your own registered teams.",
  "You are already registered.",
  "Only the owner can replace a private registration link while registration is open.",
  "Only the tournament owner can seed registration.",
  "Choose a valid seed.",
  "Entrant not found.",
  "Only the tournament owner can shuffle seeds.",
  "A valid shuffle key is required.",
  "At least two entrants are required.",
  "Only the owner can lock open registration.",
  "Match not found.",
  "That match changed. Refresh before reporting.",
  "Only a participant can report this match.",
  "Enter a completed series score.",
  "Replay or MVP details are invalid.",
  "Result submission not found.",
  "That result is no longer awaiting confirmation.",
  "That match changed. Refresh before confirming.",
  "The opponent or tournament owner must confirm this result.",
  "The next bracket slot is already occupied.",
  "Only the tournament owner can correct a result.",
  "Archived tournaments are read-only.",
  "That result changed. Refresh before correcting it.",
  "The next match has already started. Its earlier result cannot be corrected safely.",
  "The next bracket slot no longer matches this result.",
  "That result is no longer awaiting review.",
  "That match changed. Refresh before rejecting.",
  "The opponent or tournament owner must review this result.",
  "Only the tournament owner can archive it.",
  "Finish active matches before archiving.",
  "Only the tournament owner can record a forfeit.",
  "Only an active tournament match can be forfeited.",
  "The tournament changed. Refresh before recording a forfeit.",
  "Tournament recovery details are invalid.",
  "That match cannot be recovered safely. Refresh and review it.",
  "The next match has already started. Recovery stopped safely.",
  "Only the tournament owner can change entrant status.",
  "Entrant recovery details are invalid.",
  "Only the tournament owner can change an active entrant.",
  "The tournament changed. Refresh before changing entrant status.",
  "That entrant is no longer active.",
  "Only the tournament owner can replace an entrant.",
  "Replacement details are invalid.",
  "Only the tournament owner can replace an active entrant.",
  "The tournament changed. Refresh before replacing an entrant.",
  "That entrant or their next opponent has already begun play. Use a drop or disqualification instead.",
  "Sign in to accept a replacement invitation.",
  "This replacement invitation is invalid or expired.",
  "This replacement invitation is no longer available.",
  "Your account is already attached to an entrant in this tournament.",
  "This replacement keeps the existing registered roster.",
]);

export function tournamentError(error) {
  if (error?.code === "PGRST202" || error?.code === "42883") {
    return "Tournaments are not enabled in this environment yet.";
  }
  const detail = typeof error?.message === "string" ? error.message.trim() : "";
  if (SAFE_TOURNAMENT_MESSAGES.has(detail)) return detail;
  if (/failed to fetch|network request failed|networkerror|load failed/i.test(detail)) {
    return "The connection was interrupted. Refresh the tournament before trying again.";
  }
  return "Tournament service is unavailable. Please try again.";
}
