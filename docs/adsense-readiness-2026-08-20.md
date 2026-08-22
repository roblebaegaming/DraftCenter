# DraftCenter AdSense readiness

- Date: August 20, 2026 Pacific
- Scope: publisher display advertising through Google AdSense
- Current state: the AdSense account was reactivated and `draftcentral.gg` was
  added on August 21; Google reports **Requires review** and `ads.txt` **Not
  found** because the verification release is not deployed. There is no ad
  serving, personalized advertising, consent message, account review request,
  or Production configuration change.
- Intended first inventory: selected original English guide articles only

## Decision boundary

DraftCenter may prepare and verify the site now. Ad serving remains blocked
until the traffic baseline, privacy/consent configuration, age-treatment
decision, and qualified intellectual-property review are complete.

This plan is separate from Google Ads customer-acquisition campaigns. It does
not authorize ad spend, billing changes, a payments profile, or promotion of
DraftCenter through paid search.

## Updated traffic baseline

The owner-only Operations dashboard supplies an aggregate rolling 30-day
production-traffic view from Vercel Web Analytics. The August 20 snapshot is:

- Snapshot time: August 20, 2026 at 11:41 PM Pacific
- Window: July 22 through August 20, 2026 UTC; August 20 was still in progress
- Visitors: 8,172, summed from daily anonymized visitor counts; this is not a
  deduplicated 30-day unique-user count because visitor identifiers reset daily
- Page views: 20,915
- Views per visitor: 2.56
- Seven-day daily average: 827.9 visitors
- Yesterday: 581 visitors and 982 page views
- Today at snapshot time: 613 visitors and 1,883 page views
- Top five pages: `/` (5,744 views), `/manuals` (2,921),
  `/worlds/2026/vgc` (2,464), `/tournaments` (1,365), and
  `/resources/daily-games` (1,248)

The August 1 baseline of 51 visitors and 206 page views covered only the first
short collection period and is not the decision baseline for AdSense. The new
totals are roughly 160 times the old visitor count and 102 times the old page
view count, but that is a scale comparison rather than a growth rate because
the collection windows differ.

Traffic rose sharply beginning August 11, reached 1,128 daily visitors on
August 14, and recorded 581 to 695 daily visitors from August 18 through the
partial August 20 snapshot. This is enough activity to justify AdSense site
preparation and an application review. It does not yet prove that the proposed
guide-only inventory is large enough for a useful experiment: none of the top
five pages is a guide, so eligible guide traffic must be measured before ads
are activated.

## Repository readiness

The first code slice is deliberately inert:

- `GOOGLE_ADSENSE_ACCOUNT` accepts only a public `ca-pub-` identifier with 16
  digits;
- configured builds emit the `google-adsense-account` verification meta tag;
- `/ads.txt` returns Google's exact direct-seller record only when that valid
  identifier is configured and otherwise returns HTTP 404; and
- no AdSense script, ad unit, cookie, consent message, CSP relaxation, or route
  placement is present.

The account identifier is public by design in verification metadata and
`ads.txt`. Payment, tax, identity, recovery, and authentication information
must never enter Git, documentation, screenshots, or browser-visible runtime
configuration.

## Account connection sequence

1. **Completed August 21:** Reactivate the inactive AdSense account.
2. **Completed August 21:** Add `draftcentral.gg`, select Google's meta-tag
   ownership method, and copy only the public `ca-pub-...` identifier.
3. **Completed August 21:** Add `GOOGLE_ADSENSE_ACCOUNT` to the branch-scoped
   Vercel Preview environment and redeploy the readiness branch.
4. **Completed August 21:** Confirm through Vercel's authenticated preview
   request path that the ownership meta tag and `/ads.txt` return the exact
   identifier without exposing any other account information. Confirm that the
   homepage and a representative guide contain no AdSense script or ad unit.
5. **Completed August 21:** Review the hosted Preview and confirm the protected
   dependency, security, secret-scan, CodeQL, JavaScript-analysis, and Vercel
   checks pass on pull request 374.
6. Add the same identifier to Production only after the protected release is
   approved, confirm the exact deployed commit, verify ownership in AdSense,
   and separately request AdSense site review after the remaining policy gates.

No Auto ads setting should be enabled during connection or review.

## Privacy and consent configuration

Before any ad code is deployed:

1. Update the Legal page to disclose Google advertising, advertising cookies
   or other identifiers, personalized and non-personalized advertising,
   Google's and participating vendors' data use, opt-out choices, and the
   applicable privacy-policy links.
2. In AdSense Privacy & messaging, create a European regulations message using
   Google's certified CMP. Keep a first-screen **Do not consent** choice and
   provide **Manage options** and a durable revocation path.
3. Configure the US state regulations message for all current and future states
   supported by Google, including a visible opt-out path.
4. Do not enable ad-blocking recovery, Offerwall, or another monetization
   message in the first experiment.
5. Test consent, refusal, option management, revocation, and regional display
   on a hosted Preview before Production.

The current cookie-free Vercel Web Analytics disclosure stays accurate for
that product. AdSense must be disclosed separately because its advertising
technology changes the site's privacy posture.

## Age-treatment decision

DraftCenter currently describes itself as not intended for children under 13,
but Pokémon subject matter may attract children and teens. A qualified review
must classify the service and the selected guide inventory as general,
mixed-audience, child-directed, or teen-restricted where applicable. Record the
decision and required Google age-treatment signal before ad requests begin.

Do not infer a visitor's age from a Pokémon choice, league activity, public
profile, prediction, or private account data. Do not upload user or account
data to AdSense.

## Intellectual-property review brief

Ask qualified counsel to review:

- the use of Pokémon names and factual game references in original editorial
  guides that may carry ads;
- the DraftCenter name, logo, disclaimers, About page, and rights-holder contact
  route;
- whether any image, sprite, official artwork, screenshot, logo, character
  design, or third-party embedded material may appear on a monetized page;
- AdSense site-review implications for linked but unmonetized Pokémon catalog
  and application pages; and
- the countries in which the first experiment may serve.

Engineering's proposed first boundary is more conservative than the full
public site: monetize original English guide prose only, with no Pokémon
artwork, screenshots, user-generated content, public profiles, predictions,
or embedded streams in or adjacent to the ad inventory. This is a risk-control
proposal, not a legal conclusion.

## Placement and security contract after approval

The first ad-serving implementation must be a separate reviewed code slice:

- manual responsive units on a small allowlist of original `/guides/[slug]`
  pages;
- at most two reserved-size placements per guide, after meaningful article
  content and away from buttons, copy controls, navigation, and calls to action;
- no Auto ads, anchor ads, vignette ads, interstitials, or additional triggers;
- no ads on home/authentication, leagues, drafts, team workspaces, Team Lab,
  Pokédex Tracker, Nuzlocke tools, tournaments, Worlds predictions,
  Operations, Support, legal pages, public user content, or localized Pokémon
  profiles; and
- a nonce-based strict Content Security Policy on the exact ad-enabled routes.

The current CSP blocks Google ad scripts. Do not weaken it with a permanent
rolling domain allowlist. Google supports strict CSP for AdSense because its
serving domains can change. Test a report-only policy first, then enforce it on
the narrow route scope.

## Review and experiment gates

Request Google site review only after the verification release is live and the
privacy, audience, and IP gates are recorded. Google may review the full site,
not only the proposed guide placements.

If Google approves the site, begin with three to five reviewed guides for 14
days. Record:

- eligible guide page views and ad impressions;
- viewability and revenue per thousand eligible page views;
- consent and opt-out outcomes where available;
- mobile and desktop layout shift and Core Web Vitals;
- guide engagement and downstream product visits; and
- support complaints or accidental-click concerns.

Stop immediately for a policy, rights, privacy, security, layout, or misleading
placement issue. Do not expand based on gross impressions alone.

## Production and release boundary

Use a short-lived branch, protected pull request, hosted Preview, full required
checks, exact deployed-commit confirmation, and signed-out Production smoke
sweep. Provider settings, Production environment variables, Google consent
message publication, site-review submission, and ad activation each require
the owner's exact approval at the point of change.
