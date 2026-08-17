# 2026 VGC Worlds champion outlook

The champion outlook is a transparent editorial model for the 2026 VGC
Masters field. It is not a betting market, does not accept wagers, and should
not be described as a prediction of certainty. The public card shows the ten
highest modeled probabilities, while the calculation retains all 438 players
in the invite-earned snapshot and always totals 100 percent.

## Frozen pre-event contract

The initial model weights are:

- season standing and form: 35 percent
- wins at Regional and equivalent events: 20 percent
- wins at International Championships: 15 percent
- past Worlds titles: 15 percent
- aggregate DraftCenter Pick 10 and Your Champion support: 15 percent

No player may exceed five percent before Worlds begins. The cap is applied
while redistributing the remaining probability across the complete field, not
by deleting long-shot players. Tests verify the field count, 100-percent sum,
five-percent cap, and one-total weight vector.

The model uses the invite tracker's published qualification path and season
result summary. The North America, Europe, Latin America, Oceania, and Middle
East and South Africa Championship Point paths are compared through their
published standings and event results. Japan, South Korea, and Asia-Pacific
use their published JCS, Trainers Cup, and MBL equivalents because their 2026
qualification systems do not use the same global Championship Point table.
This equivalence is deliberately approximate and is disclosed rather than
presented as an official Pokémon ranking.

Sources:

- official VGC Masters Championship Point standings:
  <https://www.pokemon.com/us/play-pokemon/leaderboards/vg-masters/>
- official 2026 qualification structure:
  <https://championships.pokemon.com/en-us/about/>
- reviewed VGC Masters invite tracker and result summaries:
  <https://victoryroad.pro/2026-worlds-invites/>

The static roster snapshot stores the reviewed result summary in each player's
seasonResults field. The roster builder preserves that field on future reviewed
snapshots, while a source-count change still fails closed for manual review.

The invite snapshot was rechecked on 16 August 2026. The source still lists
438 Masters invitees across the expected eight regional groupings and labels
its latest content update as 5 August 2026. It does not publish a confirmed
attendance roster or mark any listed player as withdrawn or declined. Until a
reliable public source says otherwise, DraftCenter therefore retains all 438
players with the status “invite earned, attendance not confirmed” and does not
infer withdrawals from absence, registration chatter, or private reports.

## Community privacy

Migration 413 adds get_worlds_pick_popularity(text). It returns only per-player
pick and Champion counts and never returns a user ID, display-name mapping, or
individual lineup. Before event lock, every count remains zero until at least
25 entries exist. After lock, aggregates may be returned even for a smaller
sample because the underlying saved lineups are already public.

The client uses community data only when the RPC marks the sample ready. A
sample of 25 does not receive full strength immediately: reliability grows as
entry count / (entry count + 25), which prevents a small early cohort from
overwhelming the performance inputs.

The isolated Preview matrix is
supabase/tests/413-worlds-champion-odds-popularity-preview-regression.sql. It
verifies zeroed counts at 24 entries, aggregate activation at 25, post-lock
behavior below the threshold, identity omission, RLS, grants, and transactional
fixture cleanup.

## Updates and corrections

Do not silently change weights after publishing them. A material methodology
change needs a documented code change and a new release. Roster corrections,
withdrawals, or newly published season results may update the input snapshot,
but the invite-earned versus confirmed-attendance distinction must remain
visible.

The probabilities are pre-event editorial estimates. Once official Worlds
results exist, the champion outlook should be frozen or clearly labeled as a
historical pre-event snapshot rather than allowed to drift toward known
outcomes.

The same model inputs and output order must be used on the English and Italian
pages. Localization changes visible qualification labels only; it must not
change the original English model inputs or probabilities.
