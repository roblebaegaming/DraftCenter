export function isMatchSchedulingFeatureEnabled(
  value = process.env.NEXT_PUBLIC_MATCH_SCHEDULING_ENABLED,
) {
  return value === "true";
}

export const MATCH_SCHEDULING_ENABLED = isMatchSchedulingFeatureEnabled();
