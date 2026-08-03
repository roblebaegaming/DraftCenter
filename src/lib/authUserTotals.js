export function summarizeAuthUsers(users = []) {
  let email = 0; let discord = 0; let both = 0; let other = 0;
  for (const user of users) {
    const providers = new Set((user.identities || []).map((identity) => identity.provider).filter(Boolean));
    const hasEmail = providers.has("email");
    const hasDiscord = providers.has("discord");
    if (hasEmail) email += 1;
    if (hasDiscord) discord += 1;
    if (hasEmail && hasDiscord) both += 1;
    if (!hasEmail && !hasDiscord) other += 1;
  }
  return { total: users.length, email, discord, both, other };
}
