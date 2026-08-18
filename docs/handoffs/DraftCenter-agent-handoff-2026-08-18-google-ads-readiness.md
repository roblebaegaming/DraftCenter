# DraftCenter agent handoff: Google Ads readiness

- Date: August 18, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production application commit:
  `6fa9dea11aca0dacbf51142c1eb9f997578d886d`
- Production migration: 439, canonical version `20260818220437`
- Documentation pull request:
  [#325](https://github.com/roblebaegaming/DraftCenter/pull/325)
- Recommendation state: prepare only; no ad account, campaign,
  billing, tag, audience, or spend change is authorized
- Previous release handoff:
  [`DraftCenter-agent-handoff-2026-08-18-private-tournament-organizer-demo.md`](DraftCenter-agent-handoff-2026-08-18-private-tournament-organizer-demo.md)

## Recommendation

Do not start a broad Google Ads campaign yet. Prepare a small, high-intent
Google Search experiment and launch it only after the measurement, privacy,
landing-page, policy, and owner-approval gates below are complete.

DraftCenter has enough product proof to begin preparation: the commissioner
season path is released, the private maximum-size Tournament Organizer Demo is
complete, and coarse campaign attribution plus commissioner activation events
already exist in owner Operations. It does not yet have a Google Ads conversion
source, a paid-search landing page, or validated cost-per-qualified-commissioner
economics. Paying for clicks now would measure traffic more reliably than
customer acquisition.

## Current readiness

### Ready

- The home page leads with one commissioner promise and the connected
  setup-to-season workflow.
- A private 32-seat Auction Swiss organizer showcase and four presentation
  captures provide credible product proof.
- Privacy-safe UTM capture distinguishes campaign source, signup start, account
  creation, and coarse commissioner activation milestones.
- DraftCenter already records `League Created`, `First Invite Copied`, `Draft
  Scheduled`, `Draft Started`, `Draft Completed`, `First Result Recorded`, and
  `Season Completed` as aggregate Vercel events.
- The public site has an About page, Legal page, privacy explanation, contact
  route, and clear independent fan-project disclaimer.

### Not ready

- DraftCenter currently uses cookie-free Vercel Web Analytics; there is no
  Google tag, Google Analytics property integration, Google Ads conversion
  action, or verified consent-mode implementation.
- The existing signup and activation events cannot, by themselves, tell Google
  Ads which paid click produced a qualified commissioner.
- No dedicated paid-search landing page offers one focused action such as
  **Create a commissioner workspace** or **Request an organizer walkthrough**.
- The August 19 aggregate attribution review and real tournament-operator
  feedback have not happened yet.
- No Keyword Planner forecast has established relevant search volume or likely
  click cost.
- The commercial use of Pokémon names, artwork, and trademarks in paid
  promotion has not completed the qualified intellectual-property review
  already required by `docs/focused-app-monetization.md`.

## Gates before any spend

1. Complete the scheduled August 19 aggregate-only attribution review. Do not
   inspect or publish an individual's activity.
2. Show the private organizer demo and captures to the intended tournament
   operator. Record product feedback, not personal identity, in the repository.
3. Choose one primary paid outcome. The recommended primary conversion is a
   qualified commissioner action such as `League Created` or an explicit
   organizer-walkthrough request. Keep `Account Created` secondary because a
   generic signup is not proof of commissioner value.
4. Decide how Google Ads will receive that conversion. Adding a Google tag or
   Google Analytics changes the current privacy posture and requires an updated
   privacy review, consent mechanism where required, implementation tests, and
   exact owner approval before deployment.
5. Create and review one commissioner-specific landing page with the free
   promise, workflow proof, independent fan-project disclaimer, one primary
   call to action, and no claim of Nintendo or Pokémon-company affiliation.
6. Use Google Keyword Planner to review volume and forecasts before setting a
   budget. Do not infer cost-per-click from another product or market.
7. Complete qualified intellectual-property review for the proposed keywords,
   ad copy, screenshots, Pokémon references, and targeted countries.
8. Obtain explicit owner approval for the exact campaign, destination,
   countries, keyword and negative-keyword lists, copy, conversion action,
   daily budget, total cap, start and stop dates, and billing account.

## First experiment after the gates

Use one Search campaign, not Performance Max, Display, video, remarketing, or a
broad multi-feature campaign.

- Audience intent: commissioners and tournament organizers actively looking
  for draft-league or tournament-management software.
- Destination: one commissioner landing page, not the private owner showcase
  URL and not a generic feature directory.
- Initial match types: exact and phrase. Expand only from reviewed search-term
  evidence.
- Candidate themes for Keyword Planner review: `pokemon draft league manager`,
  `pokemon draft league software`, `pokemon auction draft tool`, and
  `pokemon tournament organizer software`.
- Initial negative themes: trading cards and packs, ROMs and downloads, jobs,
  unrelated sports drafts, gambling, betting, and any unsupported game or
  product intent. Review the real search-terms report frequently.
- Proposed learning cap: at most USD $10 per day and USD $150 total for a
  minimum 14-day run, but only if Keyword Planner forecasts make that capable
  of collecting useful traffic. This is a proposal, not spend authorization.
- Suggested stop rule: pause immediately for policy or tracking problems;
  otherwise stop at the cap if there is no qualified commissioner conversion.
- Suggested success rule: do not scale on clicks or generic signups. Require at
  least one verified qualified commissioner action plus evidence from the
  search-terms report that the traffic matches the intended organizer audience.

The small cap is a directional validation, not a statistically conclusive
acquisition study. If search volume is too low, prefer direct organizer
outreach, community demonstrations, and partner referrals instead of widening
to low-intent traffic.

## Google source basis

- [Create a Search campaign](https://support.google.com/google-ads/answer/9510373?hl=en)
  explains that Search reaches people actively looking for relevant products
  and requires a conversion goal.
- [Set up web conversions](https://support.google.com/google-ads/answer/16560108?hl=en)
  requires a website data source and verification that the selected conversion
  action is recording correctly.
- [About conversion measurement](https://support.google.com/google-ads/answer/1722022?hl=en)
  explains that conversion data supports ROI decisions and automated bidding.
- [Use Keyword Planner](https://support.google.com/google-ads/answer/7337243?hl=en)
  provides search-volume and cost forecasts before campaign creation.
- [Build effective keyword lists](https://support.google.com/google-ads/answer/10039665?hl=en)
  recommends starting with exact match for control and expanding only when the
  evidence supports it.
- [Negative keyword lists](https://support.google.com/google-ads/answer/7449003?hl=en_)
  exclude irrelevant searches and improve conversion relevance.
- [Set up consent mode](https://support.google.com/google-ads/answer/14009635?hl=en)
  begins with an existing user-consent mechanism and changes tag behavior based
  on consent state.
- [Google Ads trademark policy](https://support.google.com/adspolicy/answer/6118?hl=en)
  makes advertisers responsible for non-confusing, non-infringing trademark
  use and permits restrictions following a rights-holder complaint.

## Durable boundaries

- Do not create or modify a Google Ads account, payments profile, billing
  method, campaign, audience, tag, Analytics property, or consent provider
  without exact owner authorization.
- Do not use the private owner tournament URL as a public ad destination.
- Do not upload customer lists, email addresses, account identifiers, league
  identifiers, or other personal data to Google Ads.
- Do not claim official Pokémon, Nintendo, Creatures, GAME FREAK, or The
  Pokémon Company affiliation.
- Do not advertise odds, betting, cash prizes, or gambling. Worlds odds are an
  editorial prediction feature and are not part of this acquisition plan.
- Do not start Performance Max until a reliable primary conversion has enough
  clean volume to evaluate automation.
- Preserve the completed organizer showcase until the owner explicitly asks to
  reset it.

## Next-agent order

1. Run the August 19 aggregate attribution review.
2. Gather the tournament operator's response to the completed organizer demo.
3. Draft the commissioner landing page, conversion contract, privacy impact,
   Keyword Planner worksheet, and exact Search ad proposal without launching.
4. Present the complete experiment—including budget and stop rules—to the owner
   for explicit approval.
5. Only after approval, implement and verify measurement before enabling spend.
