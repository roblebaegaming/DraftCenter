# Focused-app monetization decision

- Decision date: August 16, 2026 Pacific
- Products: Pokédex Tracker and Team Lab
- Status: validation plan, not a public offer or billing authorization

## Decision

Do not add a paywall, advertising, payment processor, subscription entitlement,
public price page, or native-store billing yet. Keep every released Pokédex
Tracker, Rescue, Team Lab, and Battle Mode capability free while the products
establish real use.

The existing voluntary Ko-fi contribution may remain available as support. It
is not a purchase, subscription, entitlement, promised roadmap, or substitute
for a commercial-use review.

If paid software is later justified, prefer one shared **DraftCenter Plus**
entitlement across DraftCenter, Pokédex Tracker, and Team Lab. Do not make
people buy two focused-app subscriptions while the products use one account and
one shared platform.

## Why billing is gated

The focused apps are technically ready for web-first billing, but the business
and rights questions are not ready:

- the Instagram launches are less than one day old and the first aggregate
  attribution review is August 19;
- no Founding Collector tester candidates have been identified or invited;
- there is no demonstrated willingness-to-pay evidence yet;
- the products use Pokémon names, data, and visual material, so commercial use
  requires qualified intellectual-property review before a paywall, ads,
  sponsorship, or native-store release;
- payment processing would add tax, refund, cancellation, support, privacy,
  account-deletion, and webhook-security obligations.

Pokémon Support currently asks projects not to use or associate Pokémon
characters, names, or designs without permission. Its streaming guidelines
also say that their limited streaming permission does not cover other Pokémon
products and services and does not permit commercial derivative apps under
that policy. Those pages are caution signals, not a license determination for
DraftCenter. Review the latest versions and obtain advice from a qualified IP
attorney before commercial activation:

- [Pokémon Support: Can I use Pokémon images or materials?](https://support.pokemon.com/hc/en-us/articles/360000634094-Can-I-use-Pok%C3%A9mon-images-or-materials)
- [Pokémon content guidelines for online streaming platforms](https://support.pokemon.com/hc/en-us/articles/17715339053972-Pok%C3%A9mon-Content-Guidelines-for-Online-Streaming-Platforms)

This record is product and engineering guidance, not legal advice.

## Free-core promise for the validation period

Keep these released workflows free:

- species checklist and collection inventory;
- guided Bank Rescue, owner-entered access map, intentions, and archive;
- portable JSON, CSV, and workbook exports and restore-as-new-copy recovery;
- My Teams, public Team Builder, matchup plans, and current Battle Mode;
- account export and deletion paths;
- reviewed public Pokémon guidance and source provenance.

Do not retroactively gate a user-created tracker, collection record, team,
matchup, battle note, export, or recovery capability.

## Commercial hypotheses to test later

These prices are internal hypotheses only. Do not publish or implement them
without the owner approving a defined experiment after all activation gates
below pass.

| Offer | Starting hypothesis | What it would test |
| --- | ---: | --- |
| Voluntary supporter | $10 one time | Whether active users want to support development without receiving an entitlement |
| DraftCenter Plus | $2.99 monthly or $24.99 yearly | Whether cross-product convenience and advanced planning justify recurring value |
| Tournament pass | $7.99 for 90 days | Whether occasional competitive players prefer temporary access |
| Club or coach plan | $9.99 monthly or $79 yearly | Whether shared preparation and reporting solve an organizational problem |

Possible Plus value should be original workflow value, not access to Pokémon
facts or official artwork. Candidate areas include:

- Pokédex Tracker: advanced multi-box planning, explainable owned-game routing,
  reusable collection projects, duplicate review, history, and enhanced reports;
- Team Lab: reusable opponent libraries, rematch plans, collaborative coaching,
  tournament workspaces, and advanced post-set reports;
- shared platform: cross-product dashboards, higher convenience limits, and
  priority support.

The existing Rescue and Battle Mode foundations must remain usable without
Plus. Paid value should save time, coordinate people, or add original analysis.

## Activation gates

Do not implement payment code until all of these are recorded:

1. Complete the August 19, August 23, and September 15 aggregate-only launch
   reviews, keeping Pokédex Tracker and Team Lab attribution separate.
2. Recruit 5-8 owner-approved, opt-in testers from existing followers, known
   collectors, or organically engaged users. Do not invite random people.
3. Observe real Rescue and closed-sheet Battle Mode sessions and identify a
   repeated problem users value enough to solve.
4. Conduct at least eight structured discovery conversations, with at least
   five explicit statements of willingness to pay for the same defined outcome.
5. Obtain qualified IP counsel on naming, Pokémon data, artwork, attribution,
   disclaimers, ads, sponsorship, subscriptions, and native distribution.
6. Approve a written offer, free-versus-paid boundary, support promise, refund
   and cancellation policy, tax approach, privacy update, and success/stop
   criteria.

The owner must approve the exact tester audience and any commercial experiment.
Names, handles, emails, and other audience identifiers do not belong in the
repository.

## First experiment after the gates

Start with a manual, reversible offer test before building billing:

1. show a small owner-approved group one clearly defined advanced workflow;
2. ask for a real purchase commitment at one price, without charging anyone;
3. record only aggregate accept, decline, and reason categories;
4. proceed to a limited web checkout only if the success threshold and legal
   review pass;
5. stop or revise the offer if the threshold fails.

Do not use deceptive countdowns, artificial scarcity, prechecked upgrades, or
feature loss. Do not sell a lifetime plan while hosting and source-maintenance
costs are still unknown.

## Technical sequence after authorization

If the owner later authorizes billing, implement it as a shared platform slice:

1. choose the processor and exact web offer;
2. add a server-owned shared account entitlement through a new forward-only
   migration, with focused RLS, grants, and two-account regression coverage;
3. verify webhook signatures server-side and never place billing secrets in a
   public environment variable or browser bundle;
4. make checkout, renewal, cancellation, grace period, refund, account export,
   and account deletion behavior explicit;
5. launch to a small cohort with aggregate conversion, retention, refund, and
   support measures;
6. add App Store or Play Store billing only after the installable web products
   prove sustained demand and store-policy review is complete.

No part of this document authorizes a Production database, provider,
environment-variable, payment, tester-message, or customer-entitlement change.
