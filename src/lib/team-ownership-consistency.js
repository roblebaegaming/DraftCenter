export function classifyTeamOwnership({ snapshotUserId, relationalUserId }) {
  const snapshot = String(snapshotUserId || "").trim();
  const relational = String(relationalUserId || "").trim();

  if (!snapshot && !relational) return "open";
  if (snapshot && relational && snapshot === relational) return "consistent";
  return "mismatch";
}

export function summarizeTeamOwnership(rows = []) {
  return rows.reduce(
    (summary, row) => {
      const status = classifyTeamOwnership(row);
      summary[status] += 1;
      if (status === "mismatch") {
        summary.mismatches.push({
          teamIndex: row.teamIndex,
          teamName: row.teamName,
          snapshotUserId: row.snapshotUserId || null,
          relationalUserId: row.relationalUserId || null,
        });
      }
      return summary;
    },
    { consistent: 0, open: 0, mismatch: 0, mismatches: [] },
  );
}
