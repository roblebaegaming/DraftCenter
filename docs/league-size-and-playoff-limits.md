# League size and playoff limits

DraftCenter uses explicit scale modes so an ordinary commissioner cannot accidentally create an oversized league.

- **Standard:** 2–16 teams. Every new league starts here.
- **Expanded:** 2–32 teams. A commissioner must click the size-unlock control in Setup before choosing 17–32.
- **Massive multi-pod:** 2–128 teams. Setup requires at least two populated pods or divisions and a second explicit unlock before choosing 33–128.

Draft start remains conditional on the legal Pokémon pool. The readiness check counts every roster slot still required after keepers and blocks the draft unless at least that many unique legal Pokémon remain. Large leagues may need a broader format, smaller rosters, fewer keepers, or commissioner-added custom Pokémon.

## Playoffs

A standard or expanded league can place every team in one single- or double-elimination bracket. The largest combined bracket is therefore 32 teams, which produces five rounds: Top 32, Top 16, Quarterfinals, Semifinals, and Final. Non-power-of-two fields are placed in the next power-of-two bracket and receive first-round byes.

A multi-pod league uses a scalable two-stage postseason. Each pod can qualify as many teams as that pod contains; each pod runs its own bracket, and the pod champions enter a league championship bracket. With the current 128-team ceiling, all 128 teams can participate in the postseason when each pod advances its full membership. The championship bracket itself scales with the number of pods.

Pod round-robin schedules use the largest pod—not the entire league—to calculate the automatic regular-season length. A league that does not enable pod-only scheduling uses the full league size for its round robin.

## Enforcement

The browser and hosted database both enforce the selected scale mode. A snapshot trigger covers manual auctions and ordinary saves, rejects one-team states, and requires every team above 32 to belong to exactly one of at least two populated pods. Scheduled auctions and hosted snake provisioning also validate the selected limit directly. Hosted snake provisioning allows a larger bounded pick order for massive leagues. Database migration `384-expanded-and-multi-pod-league-limits.sql` changes no league rows and introduces no new public data access; its helper is executable only by the server role.
