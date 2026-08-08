# Draft Tournament concept and status

A Draft Tournament is one compact event, not a multi-pod season:

```text
Registration → one draft → roster lock → Swiss rounds → optional top cut → champion
```

Every entrant participates in the same event and draft. Their drafted roster
carries from the draft into Swiss play and, if they qualify, into the top cut.
It does not create several league pods and it does not ask organizers to
pretend a short tournament is a full league season.

## Current status

The complete Draft Tournament workflow has not been built. DraftCenter has
important reusable foundations—the existing league draft room and rosters,
standalone single-elimination tournaments, commissioner recovery, and the
double-elimination work in migration 355—but it does not yet provide the
combined Draft Tournament lifecycle.

The missing product work is:

1. a Tournament-facing registration and event setup flow;
2. a bounded way to create and run a short event draft with the existing draft
   engine without duplicating league drafting tables;
3. an explicit roster-lock transition;
4. deterministic Swiss pairings, standings, tiebreakers, byes, and rematch
   avoidance;
5. optional promotion into a single-elimination top cut;
6. interruption, replacement, correction, audit, privacy, mobile, and
   multi-account validation across the complete phase transition.

The planned primary entry point is under **Tournaments**. A later league action
may offer **Create tournament from this league** so an established league can
carry members and rosters into the same event workflow.

This remains the next broad tournament concept after the independently
reviewed double-elimination release. General-purpose standalone Swiss and
round robin are not separate parallel workstreams.
