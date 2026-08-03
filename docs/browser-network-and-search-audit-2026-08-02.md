# DraftCenter browser, network, and Search audit — August 2, 2026

## Production baseline

- Production commit tested: `37fd599` (`Protect public auth with Turnstile (#10)`)
- Vercel deployment: `5fHJaJ9NG5WZXWEa3v48jj2mdB8h` — Ready
- Canonical site: https://www.draftcentral.gg
- The signed-out production smoke test passed 14 public routes with HTTP 200
  and five protected account/owner APIs with HTTP 401.
- Required browser headers were present, including CSP, two-year HSTS,
  frame denial, MIME sniffing protection, restrictive permissions, and
  same-origin opener/resource policies.

## Throttled Lighthouse results

Google PageSpeed Insights ran a fresh Lighthouse 13.4.1 test on the public home
page at 9:05 PM Pacific time.

| Profile | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mobile, emulated Moto G Power, slow 4G | 89 | 96 | 96 | 100 | 1.1 s | 3.6 s | 130 ms | 0.021 |
| Desktop, custom throttling | 95 | 96 | 96 | 100 | 0.3 s | 1.0 s | 160 ms | 0.018 |

These are healthy launch results. The mobile run identified oversized image
delivery as the main practical opportunity. Commit `d09ce76` reduced the shared
logo from 1,573,505 bytes to 58,545 bytes, preferred PokeAPI's compact Home
sprites on the landing cards, and gave the Turnstile container an explicit
accessibility role.

A fresh production audit after that deployment recorded:

| Profile | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mobile, emulated Moto G Power, slow 4G | 91 | 100 | 96 | 100 | 1.1 s | 3.5 s | 40 ms | 0.021 |
| Desktop, custom throttling | 99 | 100 | 96 | 100 | 0.3 s | 0.9 s | 40 ms | 0.013 |

Lighthouse values vary between runs, but the post-release audit confirms the
smaller payload, removes the automated ARIA finding, and materially reduces
blocking time.

The automated browser cannot prove real Cloudflare Turnstile completion because
Cloudflare may reject automated browsers. The client deliberately remains
fail-open until a normal human browser passes the live widget. The official
Cloudflare test key passed sign-in, signup, password-reset, expiration, renewal,
and mode-switch behavior locally.

## Responsive and network behavior

- The current unauthenticated auth experience was checked at 390 × 844.
- Sign-in, signup, and password-reset controls remained visible and usable.
- When the automated environment could not complete Turnstile, the page showed
  recovery guidance and kept authentication usable because strict enforcement
  is not yet enabled.
- A normal Chromium desktop session and the production API smoke sweep passed.
- Independent Firefox and Safari rendering remains a manual breadth check; no
  current failure is known.

## Google Search Console

- The `draftcentral.gg` domain property remains verified.
- `https://www.draftcentral.gg/sitemap.xml` is **Success**, was last read on
  August 2, 2026, and reports 1,059 discovered pages.
- Search Console reports no detected security issues and no manual actions.
- The property currently reports zero web-search clicks and is still processing
  initial indexing and experience data. Recheck after Google has had at least a
  day to process the new property; this is not an application failure.

## Remaining human checks

1. Complete the live Turnstile widget once in a normal signed-out browser.
2. Complete signup and password-reset email rendering in a second major email
   client.
3. Run a quick Firefox or Safari visual pass when one is available.

