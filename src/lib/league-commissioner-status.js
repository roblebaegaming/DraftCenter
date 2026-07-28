export function commissionerClaimAvailable({
  role,
  commissionerStatusLoaded,
  hasCommissioner,
  snapshotCommissioner,
}) {
  return Boolean(
    commissionerStatusLoaded
    && !["commissioner", "viewer"].includes(role)
    && !hasCommissioner
    && !snapshotCommissioner,
  );
}
