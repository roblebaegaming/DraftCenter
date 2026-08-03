const FALLBACK_DISPLAY_NAME = "Coach";
const MAX_DISPLAY_NAME_LENGTH = 40;

export function defaultProfileDisplayName(email) {
  const localPart = String(email || "").split("@", 1)[0].trim();
  const withoutPlusTag = localPart.split("+", 1)[0].trim();
  const displayName = withoutPlusTag.slice(0, MAX_DISPLAY_NAME_LENGTH).trim();

  return displayName.length >= 2 ? displayName : FALLBACK_DISPLAY_NAME;
}
