import { COMMISSIONER_RULES_LAUNCH_CHECKLIST, POKEMON_DRAFT_LEAGUE_RULES_TEMPLATE } from "./guideTemplates.js";
import { REGULATION_GROUPS, REGULATION_METADATA } from "./regulation-catalog.js";

export const GUIDE_PUBLISHED_DATE = "2026-08-03";
export const GUIDE_UPDATED_DATE = "2026-08-04";

export const GUIDES = {
  "what-is-pokemon-draft-league": {
    title: "How a Pokémon Draft League Works",
    description: "A friendly walkthrough of Pokémon draft leagues, from choosing a format and drafting unique rosters to weekly matches, transactions, standings, and playoffs.",
    answer: "A Pokémon draft league is a season in which coaches draft different Pokémon from one shared pool, build a new battle team for each weekly opponent, and compete for standings and playoff position. DraftCenter keeps the league's rules, draft, rosters, schedule, transactions, results, and archive connected.",
    intro: "If you are new to draft leagues, the easiest way to picture one is as a season with your own Pokémon roster. You and the other coaches draft from the same pool, so no two teams are alike. Then you prepare for one opponent at a time, make roster moves when you need them, and try to earn a place in the playoffs. Here is what that looks like in practice—and where DraftCenter helps along the way.",
    sections: [
      ["First, the commissioner chooses the kind of league", "Every league needs a shared answer to a few basics: Which game or generation are we using? Is this singles or doubles? Which Pokémon and special mechanics are legal? How large is each roster? These choices shape everything that follows, so they should be visible before anyone commits to a team.", "In DraftCenter, the commissioner creates the league and works through Setup. They choose a supported format or a custom pool, then review roster limits, special mechanics, access, and league-specific bans before inviting everyone."],
      ["Then everyone drafts a different roster", "This is the part that makes a draft league feel special. Once one coach selects a Pokémon, it is normally gone for everyone else. A snake draft moves through a pick order that reverses each round. An auction lets coaches decide how much of a shared budget each Pokémon is worth.", "DraftCenter's live draft room shows the available pool, whose turn it is, the timer, each roster, and the rules that still apply. Coaches can prepare a private queue beforehand; the queue helps with planning but never reserves a Pokémon."],
      ["A good roster needs jobs, not just big names", "Favorites are part of the fun, but a roster also has to function for an entire season. Coaches usually look for different speed tiers, physical and special damage, defensive answers, disruption, recovery, and Pokémon that can fill more than one role. The goal is not one perfect team—it is enough options to build a new team every week.", "Use DraftCenter's Pokédex to compare typing, base stats, abilities, versioned move pools, and format eligibility. The public profile pages also show draft rate, ADP, auction samples, and teammate patterns when enough league data exists."],
      ["Each week is a new puzzle", "You do not bring your whole roster into every battle. You study the next opponent, decide which threats matter most, and build a legal battle team from your drafted Pokémon. That opponent-by-opponent preparation is the heart of draft play: a Pokémon that barely appeared last week might be the key to this week's matchup.", "The Schedule shows the opponent and deadline. Either participating manager can report the result afterward, and the saved result updates the league record and standings. Managers can also share a Twitch or YouTube match from League Home if they want spectators."],
      ["Standings turn separate matches into a season", "Wins and losses are only part of the picture. Leagues often use game differential or remaining-Pokémon differential when records are tied. The important thing is not choosing one universal system; it is agreeing on the order before the season so nobody has to invent a rule during the playoff race.", "DraftCenter calculates the standings from reported results using the league's configured tiebreakers. Commissioners can review or correct results, while coaches can see the same current table from the league."],
      ["Transactions let a roster grow with the season", "Sometimes a draft plan does not work, a matchup exposes a hole, or another coach proposes a trade that helps both teams. Free-agent moves and trades keep the season flexible, but limits and deadlines should apply equally to everyone.", "DraftCenter keeps trades, add/drop moves, and queued claims in Transactions. The commissioner sets the limits and processing schedule; managers submit moves there so the official roster and its history stay together."],
      ["The season ends with playoffs and an archive", "The best regular-season teams advance to a bracket, where every matchup is elimination pressure. When a champion is decided, the season should become a record everyone can revisit—not a collection of messages that disappears over time.", "DraftCenter builds the playoff bracket from the league's settings and stores the champion, standings, rosters, results, awards, transactions, and bracket when the commissioner ends the season. A new season can begin without erasing the completed one."],
    ],
    links: [
      ["Compare snake and auction drafts", "/guides/snake-vs-auction-pokemon-draft"],
      ["Build a draft tier list", "/guides/pokemon-draft-tier-list-guide"],
      ["Browse supported formats", "/formats"],
      ["Explore public leagues", "/leagues"],
      ["Open commissioner manuals", "/manuals/commissioner"],
      ["Plan transactions and free agency", "/guides/pokemon-draft-league-transactions-free-agency"],
      ["Understand standings and playoffs", "/guides/pokemon-draft-standings-tiebreakers-playoffs"],
    ],
  },
  "how-to-run-pokemon-draft-league": {
    title: "How to Run a Pokémon Draft League: A Commissioner’s Walkthrough",
    seoTitle: "How to Run a Pokémon Draft League",
    description: "A practical, step-by-step walkthrough for setting up a Pokémon draft league, inviting coaches, running the draft, managing the season, and crowning a champion.",
    answer: "To run a Pokémon draft league, choose the competitive format and league rules, invite and assign coaches, test the legal pool and roster math, run the draft, publish the schedule, and apply transactions and rulings consistently through the playoffs. DraftCenter organizes those steps and provides readiness checks before the official draft begins.",
    intro: "Running a league can look intimidating because there are a lot of small decisions. You do not need to solve all of them at once. Start with the experience you want your group to have, test the setup with a few people, and use DraftCenter's readiness checks to catch the details before draft day. This walkthrough follows the same order you will use in the product.",
    updatedDate: "2026-08-18",
    sections: [
      ["Create the league before you perfect the rules", "Give the league a clear name and season label, decide whether it is private, public to watch, or open to join, and add a description that tells coaches what they are signing up for. A practice league is useful when you want to learn the controls without adding results to career statistics.", "Choose Run a league from the DraftCenter home page. A first-time commissioner can start with a private Practice league, rehearse the real controls, and adjust most settings later from Commissioner Tools and Setup."],
      ["Work through Setup in a sensible order", "Choose the format and legal pool first, then the draft method, roster size, prices or points, timers, transactions, standings, and playoffs. Test the numbers against your actual team count. A rule that works for eight teams may leave too few useful Pokémon for sixteen.", "DraftCenter offers recommended first-season, standard singles, budgeted snake, and auction presets as reviewed starting points. The five-step Commissioner Launch Checklist then tracks rules, teams, invitations, draft scheduling, and launch readiness. You remain responsible for reviewing every saved choice before the official draft."],
      ["Move an existing setup without inventing history", "If your league already lives in a spreadsheet, begin with the current teams, planning labels, rosters, and prices you can verify. Do not recreate old picks, transactions, matches, or account ownership from incomplete notes just to make the new record look older than it is.", "Pre-draft Setup provides bounded CSV and XLSX templates. Upload one file, review the parsed teams and Pokémon plus every row-level error, and confirm only a valid setup or complete-roster revision. A complete roster requires the exact league name, and the confirmed revision can be undone immediately in the same session."],
      ["Invite people and make ownership obvious", "Send each coach a manager invitation and ask them to claim the correct team well before the draft. Add a co-commissioner if someone else will help with rulings or scheduling. Spectator access should stay separate from permissions that can change league data.", "Create expiring Manager or Spectator links from Commissioner Tools. Co-commissioners can help operate the league, while only the primary commissioner can transfer ownership or delete it."],
      ["Treat draft readiness like a real preflight check", "A few minutes of checking can save an hour of draft-night confusion. Confirm the team count, claimed teams, legal pool, roster limits, budget or points, draft order, timer, and official start time. Tell everyone what happens if a coach misses a pick or loses connection.", "The draft setup screen reports readiness problems directly. Start manually when everyone is present, or use scheduled automatic start only after DraftCenter says the league is ready. Save a recovery backup before the draft."],
      ["Let the regular season run from one record", "Publish the schedule, remind coaches how to report results, and keep roster moves in the official transaction flow. Make the deadline policy clear, but leave room for reasonable extensions when both coaches communicate early.", "Schedule, reported results, standings, trades, free agency, claims, and the League Board stay connected in DraftCenter. Each signed-in member also receives one private next action for an active league. For an eligible scheduled matchup, a participating manager can analyze public Showdown replay links, map the players, review the normal result editor, and choose whether to save."],
      ["Handle problems consistently and leave a paper trail", "You will eventually face a late match, mistaken result, unavailable coach, or unclear rule. Pause, check what the published rule says, and use the same remedy you would use for another team. If the rule is genuinely missing, explain the decision and add it for the future.", "Use the League Board for durable rulings. The yellow Help button opens the commissioner manual, and Get help with this league can send a direct support request with optional safe diagnostics. Recovery history is available when a supported restore is truly needed."],
      ["Close the season before starting the next one", "Confirm the final standings and playoff results, celebrate the champion, and make sure the record is complete. Only then should you roll the league forward.", "End season freezes the champion, rosters, results, bracket, awards, transactions, and standings in the archive. Download a final spreadsheet or backup, review the archive, and then start the next season."],
    ],
    checklistTitle: "Commissioner launch path",
    checklist: [
      "Rules, legal pool, teams, roster math, deadlines, and draft style are reviewed.",
      "Every manager invitation goes to the intended person and every claimed team is correct.",
      "A spreadsheet import, if used, passed preview without unsupported or duplicate rows.",
      "Draft timing and readiness checks are clear before anyone makes an official selection.",
      "Result reporting, transactions, playoffs, export, and archive expectations are published.",
    ],
    links: [["Open the full commissioner manual", "/manuals/commissioner"], ["Compare snake and auction", "/guides/snake-vs-auction-pokemon-draft"], ["Browse formats", "/formats"], ["Move from a league spreadsheet", "/guides/pokemon-draft-manager-vs-spreadsheets"], ["Report results from Showdown replays", "/guides/pokemon-showdown-replay-results-draft-league"], ["Plan standings and playoffs", "/guides/pokemon-draft-standings-tiebreakers-playoffs"]],
  },
  "snake-vs-auction-pokemon-draft": {
    title: "Snake or Auction? Choosing Your Pokémon Draft Style",
    description: "Choose between snake and auction drafting by comparing the experience for coaches, roster strategy, draft-day pacing, budgets, and commissioner setup.",
    answer: "Choose a snake draft when your group wants clear turns, predictable pacing, and the easiest format for new coaches to follow. Choose an auction when coaches enjoy continuous bidding, budget tradeoffs, and the freedom to compete for any available Pokémon.",
    intro: "There is no universally better draft style. Snake drafts make turns and availability the main puzzle. Auctions make value and budget management the puzzle. The best choice is the one your group will enjoy understanding and playing for an entire draft night—not the one that sounds most advanced.",
    sections: [
      ["Choose snake when you want the easiest draft to follow", "Coaches take one Pokémon at a time in an order that reverses each round. The reversal helps balance early and late positions, while long gaps between turns reward backup plans. New coaches usually understand the room quickly because every turn has one clear decision.", "Select Snake in Setup, choose the roster limits and timer, and confirm the order. During the live draft, DraftCenter shows the current coach, upcoming order, available Pokémon, rosters, and each coach's private queue."],
      ["Choose auction when your group enjoys prices and tradeoffs", "Coaches nominate Pokémon and bid from equal starting budgets. Everyone can chase the same favorite, but winning an expensive star means having less to spend on the rest of the roster. Auctions create wonderfully different team shapes, though every coach has to pay attention throughout the room.", "Select Auction in Setup, then review the starting budget, roster limits, nomination flow, bid rules, and Pokémon prices. DraftCenter prevents a winning bid from leaving a coach unable to complete a legal roster."],
      ["The preparation feels different", "Snake preparation is about tiers, pick gaps, and predicting what might survive until your next turn. Auction preparation is about price ranges, fallback options, and knowing when to stop bidding. In either format, a list with several acceptable answers is safer than falling in love with one exact roster.", "Coaches can build a private queue in DraftCenter. Commissioners can use the Pricing Template for bulk auction or point values, then preview every proposed change before saving it."],
      ["Think about the people running the room", "Snake drafts tend to move faster and are easier when coaches may briefly step away between turns. Auctions need more active attention, clearer bid timing, and a commissioner who is comfortable explaining edge cases. A first-time league is often happier starting simple.", "Create a Practice league and run a short mock draft with the real settings. You can test the room without affecting career statistics or risking the official season."],
      ["Our practical recommendation", "Use snake when the group wants an approachable night with predictable turns. Use auction when most coaches enjoy valuation and want the freedom to compete for any Pokémon. If the group is split, choose the format that the least experienced coaches can confidently explain back to you.", "Whichever option you choose, do not start until the DraftCenter readiness messages are clear and every manager has claimed the correct team."],
    ],
    links: [["Read the commissioner walkthrough", "/guides/how-to-run-pokemon-draft-league"], ["Build a league tier list", "/guides/pokemon-draft-tier-list-guide"], ["Open the commissioner manual", "/manuals/commissioner"], ["Learn how to use draft ADP", "/guides/how-to-use-pokemon-draft-adp"]],
  },
  "pokemon-draft-tier-list-guide": {
    title: "How to Build a Pokémon Draft Tier List That Fits Your League",
    description: "Build and maintain a practical Pokémon draft tier list using your exact format, useful roles, scarcity, roster math, and transparent league evidence.",
    updatedDate: "2026-08-21",
    answer: "A useful Pokémon draft tier list prices one league's exact legal pool—not Pokémon in the abstract. Start with the format, value repeatable roles and scarce alternatives, test complete rosters under the real budget, and adjust slowly using transparent draft and match samples.",
    intro: "A draft tier list is really a pricing tool for one specific league. It is not a universal ranking of which Pokémon are best. The same Pokémon can be a bargain in one format and a poor fit in another because the legal pool, battle style, mechanics, roster size, and available alternatives all changed. Start with your league—not somebody else's finished list.",
    sections: [
      ["Lock the format before you rank anything", "Write down the game, generation, singles or doubles rules, legal mechanics, clauses, and excluded Pokémon. Move pools and abilities change between games. A list built for a different ruleset may look polished while being wrong for the league you are about to run.", "Choose the format in DraftCenter first and inspect the generated legal pool. League-specific bans and overrides can still be added, but the selected format should remain the starting source of truth."],
      ["Price the jobs a Pokémon can do repeatedly", "Ask what a Pokémon contributes across many opponents. Reliable speed control, defensive utility, positioning, recovery, strong neutral damage, and several believable sets tend to matter more than one spectacular matchup. Pokémon that cover several jobs can free the rest of the roster to specialize.", "Use the DraftCenter Pokédex to check stats, typing, abilities, format eligibility, and game-specific move pools without mixing data from different games."],
      ["Scarcity matters as much as raw strength", "If ten legal Pokémon can fill a role, coaches have alternatives. If only two can provide a certain speed tier, typing, redirection option, weather ability, or Restricted answer, those options may deserve a premium. Pricing should reflect what becomes difficult to replace after the draft begins.", "Filter the legal pool and compare nearby alternatives before assigning a value. On public profiles, common teammates and format-specific ADP can help you notice combinations, but only when the displayed sample is meaningful."],
      ["Check the roster math", "Multiply the league size by the minimum roster size and make sure every price band has enough choices. Then build a few sample rosters under the actual budget or point cap. If every sensible roster has the same shape, the list may be forcing coaches instead of creating decisions.", "DraftCenter's Setup warnings help catch pool, roster, and budget conflicts. Use a Practice league or mock draft to see whether viable choices remain late in the room."],
      ["Use data as evidence, not an answer key", "Draft rate, ADP, auction price, and match record can show where coaches value a Pokémon or where a price may be off. They cannot prove that one Pokémon caused a team's record. Always keep the sample size and eligible formats beside the number.", "DraftCenter profile pages display eligibility-aware draft rate and ADP, auction samples, teammate patterns, and confirmed-match results. Small samples are labeled so commissioners can combine them with judgment instead of treating them as a verdict."],
      ["Change the list slowly and explain why", "After the season, look for Pokémon that repeatedly went undrafted, disappeared much earlier than expected, or produced extreme auction prices across several rooms. Make a small adjustment, record the reason, and keep the old version. Coaches trust a list more when they can understand how it evolved.", "Export the current pricing before a major revision. For bulk updates, fill the Pricing Template's new value or rank column, upload it, review every proposed change, and confirm only when the preview matches your intention."],
    ],
    links: [["Explore the Pokémon catalog", "/pokemon"], ["Choose the legal pool in the format library", "/formats"], ["Open the commissioner manual", "/manuals/commissioner"], ["Learn how to use draft ADP", "/guides/how-to-use-pokemon-draft-adp"], ["Compare forms and stats", "/guides/compare-pokemon-forms-stats-draft-data"]],
  },
  "how-to-join-first-pokemon-draft-league": {
    title: "How to Join Your First Pokémon Draft League",
    description: "A welcoming first-season guide to finding the right Pokémon draft league, joining a team, preparing for the draft, playing weekly matches, and managing your roster.",
    answer: "Join a first Pokémon draft league by choosing one whose format, schedule, and expectations fit your experience and availability. Read the rules before claiming a team, prepare several draft alternatives, communicate early each week, and keep official results and roster moves inside the league's approved workflow.",
    intro: "Your first draft league should feel exciting, not like you accidentally signed up for a second job. The right league will tell you what it plays, how often matches happen, and what it expects from coaches before asking you to commit. You do not need to know every matchup or have a perfect draft plan. You do need enough time to communicate, prepare, and play one match at a time.",
    sections: [
      ["Look for a league that fits your real schedule", "Start with the weekly commitment. Ask when matches are due, how coaches schedule them, how long the season lasts, and whether the draft date works for you. A beginner-friendly league should welcome questions and have written rules you can read before joining.", "Browse Public Leagues to see formats, season status, open teams, and public league information. An Open to join league is recruiting; Public to watch lets you follow the season without taking a team."],
      ["Read the format before you claim a team", "Check whether the league is singles or doubles, which game or generation it uses, which special mechanics are allowed, and how large the drafted roster will be. Also read its transaction limits, weekly deadline, standings tiebreakers, and playoff rules. If a term is unfamiliar, ask now rather than guessing during a timer.", "League Home and League Info show the posted format, rules, draft time, and season details. The format library explains DraftCenter's supported pools, and the Pokédex can show whether a Pokémon belongs to a selected regulation."],
      ["Join with the account you plan to keep", "Use one account for the season so your team access, notifications, match record, and archived history stay together. Open the manager invitation from the commissioner and claim only the team assigned to you. If the link expired or the wrong team was claimed, stop and ask the commissioner to correct it.", "After accepting a Manager invite, open the league from your DraftCenter home and choose the assigned unclaimed team. Spectator access is view-only and cannot draft, report results, or manage a roster."],
      ["Prepare a flexible draft plan", "Make a short list of favorites, then give each one alternatives. Think about speed, physical and special damage, defensive options, disruption, and support. Your exact plan will change as other coaches make picks; a useful queue is a set of choices, not a script that must survive every round.", "Use the league's legal pool and the DraftCenter Pokédex to study types, stats, abilities, and versioned move pools. Build and reorder your private draft queue before the room opens. Nobody else can see it, and it does not reserve a Pokémon."],
      ["On draft night, slow down enough to confirm the right choice", "Join early, keep the league rules nearby, and watch your remaining roster requirements. In snake, plan for the gap until your next turn. In auction, protect enough budget to finish the roster. If the timer, connection, or saved pick looks wrong, tell the commissioner instead of repeatedly refreshing or clicking.", "The live draft room shows availability, your roster, the current turn or nomination, the timer, and budget or roster safeguards. A pick becomes official when the room confirms and saves it."],
      ["Treat the first matchup as one manageable puzzle", "Contact your opponent early, agree on a time, and study only the roster in front of you. Build a legal team from your drafted Pokémon and focus on having a plan for the opponent's biggest threats. Nobody expects a first-time coach to solve the whole format in week one.", "Open Schedule for the opponent and deadline. Either participating manager can report the result and eligible MVP details. Check that the saved result and standings are correct before leaving the page."],
      ["Use the official transaction and message tools", "A trade, free-agent move, or claim is not official because it was mentioned in chat. Follow the league's process so every coach sees the same roster history and deadlines. Read commissioner announcements, answer trade responses, and communicate early if a match or absence may become a problem.", "Transactions keeps trades, add/drop moves, and queued claims with the official roster. Messages and the League Board hold responses and durable league announcements. Personal Discord notifications are optional and separate from a league announcement channel."],
      ["Ask for help before a small issue becomes a forfeit", "Good commissioners would rather answer an early question than repair a missed deadline. Say something if you cannot find a setting, your opponent is unavailable, a result looks wrong, or real life changes your availability. Clear communication is one of the most valuable skills in a draft league.", "The manager manual explains each DraftCenter workflow. For a league-specific decision, contact the commissioner or co-commissioner because they control that league's rules and deadlines."],
    ],
    checklistTitle: "Before you commit to your first team",
    checklist: [
      "I understand the game, battle style, legal mechanics, and weekly deadline.",
      "I can attend the draft or have agreed on an absence procedure.",
      "I know the expected season length and can schedule one match most weeks.",
      "I have read the transaction, standings, playoff, inactivity, and conduct rules.",
      "I joined with the account I intend to use and claimed the correct team.",
      "I know where the league posts durable rules and commissioner announcements.",
      "I know who to contact if an invite, team, result, timer, or deadline looks wrong.",
    ],
    links: [["Learn how a draft league works", "/guides/what-is-pokemon-draft-league"], ["Open the manager manual", "/manuals/manager"], ["Browse public leagues", "/leagues"], ["Explore the Pokédex", "/pokemon"], ["Plan transactions and free agency", "/guides/pokemon-draft-league-transactions-free-agency"]],
  },
  "pokemon-draft-league-rules-template": {
    title: "Pokémon Draft League Rules Template and Commissioner Checklist",
    seoTitle: "Pokémon Draft League Rules Template",
    description: "Copy and customize a practical Pokémon draft league rules template covering format, rosters, drafting, matches, transactions, standings, playoffs, disputes, and inactivity.",
    answer: "A complete Pokémon draft league rules document should define the format, legal pool, roster and draft rules, weekly deadlines, result reporting, transactions, standings, playoffs, inactivity, conduct, rulings, and appeals. The copyable DraftCenter template covers each decision while leaving bracketed fields for the commissioner to customize.",
    intro: "A useful rules document answers the questions that can change a coach's decision or a match result. It does not need legal language, and it should not repeat every button in DraftCenter. Write the competitive agreement in plain language, make the saved league settings match it, and tell coaches which source wins if something differs.",
    sections: [
      ["Use the template as a conversation, not a finished rulebook", "Replace every bracketed field, delete sections your league does not use, and ask at least one other commissioner or experienced coach to review it. The goal is for a new coach to understand the season without needing private explanations that other teams never received.", "DraftCenter stores the operational settings, but your rules should explain why they were chosen and what happens in situations that software cannot decide fairly."],
      ["Make the competitive identity unmistakable", "Name the game, generation, battle style, legal pool, mechanics, special-category limits, clauses, and team-sheet rules. A coach should be able to tell whether this is the format they want before joining or drafting.", "Select the supported format or custom pool in Setup, then save league-specific bans, prices, Restricted limits, roster limits, and mechanics. Link coaches to the league's visible rules and legal pool."],
      ["Write down what happens when draft night is imperfect", "Publish the draft type, order method, timers, budget or points, and missed-pick procedure. Include what happens when a coach cannot attend or loses connection. Fair rules describe the remedy before anyone knows which team will need it.", "DraftCenter enforces the saved snake or auction structure and roster safeguards. The Commissioner Launch Checklist catches incomplete setup, while a recovery backup protects the configured state before the room begins."],
      ["Define a normal match week and its exceptions", "State the deadline, time zone, early-contact expectation, extension process, reporting responsibility, disconnect policy, evidence requirements, and forfeit standard. Leave the commissioner enough discretion for genuine emergencies without turning every late match into a negotiation.", "Schedule is the source of truth for opponents and saved results. Either participating manager can report a match, and commissioners can review corrections that affect standings."],
      ["Make roster movement and playoff qualification predictable", "Explain trades, free agency, claims, cooldowns, deadlines, tiebreakers, playoff size, and seeding. Coaches should be able to plan without asking whether a move will process differently for someone else.", "Match the written rules to Transactions, the league clock, standings tiebreakers, and Playoffs in Setup. If you change a setting, update the rules version at the same time."],
      ["Plan for inactivity, conflicts, and appeals", "Name the response-time expectation, warning steps, replacement process, conflict-of-interest reviewer, appeal window, and standard for emergency midseason changes. These sections matter most when the commissioner is personally involved in the outcome.", "Add a co-commissioner or neutral reviewer before the season. Record material rulings on the League Board so every coach receives the same durable explanation."],
      ["Publish, test, and preserve the final version", "Read the completed rules as if you were a new coach. Run a practice setup, compare every operational rule with the saved settings, and add a last-updated date. Keep the season's version after the champion is crowned so archived results retain their context.", "Use a Practice league for the rehearsal, export the final pricing or league spreadsheet when useful, and save a recovery backup before draft day. End season preserves the competitive archive when the season is complete."],
    ],
    template: {
      title: "Copyable Pokémon draft league rules",
      intro: "Copy this starting document, replace every bracketed field, and remove anything your league does not use. DraftCenter settings should match the final published version.",
      content: POKEMON_DRAFT_LEAGUE_RULES_TEMPLATE,
    },
    checklistTitle: "Commissioner rules and launch check",
    checklist: COMMISSIONER_RULES_LAUNCH_CHECKLIST,
    links: [["Read the commissioner walkthrough", "/guides/how-to-run-pokemon-draft-league"], ["Open the commissioner manual", "/manuals/commissioner"], ["Compare snake and auction", "/guides/snake-vs-auction-pokemon-draft"], ["Browse formats", "/formats"], ["Plan transactions and free agency", "/guides/pokemon-draft-league-transactions-free-agency"], ["Set standings and playoff rules", "/guides/pokemon-draft-standings-tiebreakers-playoffs"]],
  },
  "how-to-use-pokemon-draft-adp": {
    title: "How to Use Pokémon Draft League ADP",
    description: "Learn what Pokémon draft ADP measures, how eligibility and format affect it, when a sample is useful, and how to apply it without copying a ranking.",
    answer: "Pokémon draft ADP is a timing signal from completed snake drafts. DraftCenter averages a Pokémon's actual pick when selected and one position after the final pick when it was eligible but undrafted. Use that value with the eligible-draft sample, draft rate, matching format, and available alternatives—not as a universal power ranking.",
    intro: "Average draft position is useful because it turns many draft rooms into one quick planning signal. It is also easy to misuse. DraftCenter's eligibility-aware ADP summarizes both how early a Pokémon was selected and the completed drafts in which it remained available. It cannot tell you that the Pokémon must be taken at one exact pick, that it fits your roster, or that data from another legal pool applies to your room.",
    publishedDate: "2026-08-10",
    updatedDate: "2026-08-10",
    sections: [
      ["Start with the plain meaning of ADP", "ADP means average draft position. A selected Pokémon contributes its actual pick number. In DraftCenter, an eligible Pokémon that went undrafted contributes one position after that draft's final pick, so an ADP of 18 is a blended timing and availability signal rather than proof that every sample selected it around pick 18. It does not assign a tier, price, or guaranteed future pick.", "DraftCenter labels the profile value Eligibility-aware ADP and shows draft rate beside it. Auction values are kept separate because a bid price is not a pick position."],
      ["Check eligibility before comparing two numbers", "A Pokémon should only influence an ADP sample when it was actually legal in that draft. Otherwise, a popular Pokémon can look artificially rare simply because many sampled formats did not allow it. Compare format-specific numbers whenever the legal pools are meaningfully different.", "DraftCenter counts eligible completed pools, shows drafted-in and eligible-draft totals, and breaks out ADP by saved legal format when a usable sample exists."],
      ["Treat the sample size as part of the answer", "One or two drafts can move an average dramatically. A larger sample is steadier, but it can still mix different league sizes, roster needs, and coach preferences. Read the number together with how many eligible pools and actual selections produced it.", "Every DraftCenter draft percentage is paired with its current sample. Profiles say when no format-specific sample is available instead of filling the gap with an estimate."],
      ["Translate an overall pick into your own round", "Pick 18 means different things in an eight-team and a sixteen-team league. Divide the pick position by your league size to estimate the round, then account for snake order. A coach picking at the turn may need to decide two picks earlier than the average suggests.", "Use the live draft order and your private queue to turn public ADP into a room-specific plan. Queue several acceptable choices because ADP never reserves a Pokémon."],
      ["Use ranges and alternatives, not one magic number", "Build a watch range around the ADP and identify substitutes with similar roles. If a Pokémon fits your roster unusually well, taking it before the average can be sensible. If several replacements remain, waiting can be worth the risk.", "Compare typing, base stats, abilities, versioned moves, format legality, and common teammates in the Pokédex before deciding whether the public timing signal fits your team."],
      ["Do not turn ADP into a results claim", "Early selection shows demand, not causation. A low ADP does not prove that a Pokémon creates winning teams, and a high ADP does not make it a bad pick. Match results, auction prices, teammate patterns, and draft rate answer different questions and need their own samples.", "DraftCenter keeps community draft activity and confirmed-match results visibly separate. Small samples are labeled as early evidence rather than a definitive ranking."],
    ],
    checklistTitle: "Before ADP changes your pick",
    checklist: [
      "The sample comes from completed snake drafts in a compatible legal format.",
      "I checked both eligible drafts and the number of times the Pokémon was selected.",
      "I translated the overall pick into my league size and draft position.",
      "I compared the Pokémon's role and alternatives, not only the average.",
      "My queue includes fallback choices if the room moves earlier than expected.",
    ],
    links: [["Explore Pokémon draft data", "/pokemon"], ["Build a league tier list", "/guides/pokemon-draft-tier-list-guide"], ["Compare supported formats", "/formats"], ["Compare Pokémon forms and stats", "/guides/compare-pokemon-forms-stats-draft-data"]],
  },
  "pokemon-draft-league-transactions-free-agency": {
    title: "Pokémon Draft League Transactions and Free Agency",
    seoTitle: "Pokémon Draft Transactions and Free Agency",
    description: "Plan fair Pokémon draft league trades, free-agent moves, waiver claims, limits, deadlines, reversals, and roster history for an active season.",
    answer: "Pokémon draft league transactions let coaches change official rosters after the draft through trades and free-agent add/drop moves. A fair league publishes its limits, claim order or processing time, deadlines, playoff lock, and reversal policy before the season, then records every completed move in one shared roster history.",
    intro: "A transaction system should let coaches repair a roster without turning every move into a private ruling. The exact limits can vary, but everybody should know when a player is available, when a claim becomes official, how ties are resolved, and when roster movement closes. The safest rule is simple: chat can start a conversation, but only the league's official workflow changes a roster.",
    publishedDate: "2026-08-10",
    updatedDate: "2026-08-10",
    sections: [
      ["Separate trades from free agency", "A trade moves rostered Pokémon between teams after the required managers agree. Free agency adds an undrafted or released Pokémon and usually drops another roster member. These actions have different timing and consent rules, so the rulebook should not describe them as one generic transaction.", "DraftCenter keeps trade proposals, responses, add/drop moves, claims, and the official transaction log together while preserving the distinct state of each action."],
      ["Choose instant moves or scheduled claims", "Instant free agency rewards quick decisions and is easy to understand, but time zones can create an advantage. Scheduled claims collect requests until a published processing time, then apply the league's priority rule. Choose the method that matches how competitive and time-sensitive your group wants roster movement to be.", "DraftCenter can apply an eligible move immediately or queue claims for commissioner processing, according to the saved league setting. Managers see the active method before submitting."],
      ["Publish limits and deadlines before week one", "State any weekly and season-long move limits, trade deadline, last free-agency week, cooldown, roster-size rule, and postseason lock. Explain whether a reversed mistake restores a transaction and who may approve an exception. Limits should be visible before a coach needs them.", "The Transactions view shows remaining eligibility and blocks moves that conflict with saved roster, timing, and playoff rules. Commissioners configure the operational limits in Setup."],
      ["Define what makes a transaction official", "A proposed trade is not complete until every required response is accepted and the official roster is saved. A claim is not a roster spot until processing succeeds. Managers should confirm the resulting roster instead of relying on a message, reaction, or stale browser view.", "DraftCenter records accepted trades and completed add/drop moves in the league state. Pending, rejected, cancelled, and reversed actions remain distinguishable from active roster changes."],
      ["Use reversals for corrections, not secret exceptions", "Mistakes happen: the wrong Pokémon may be dropped, a result may reveal that the deadline already passed, or a commissioner may need to undo an ineligible move. Reverse the recorded action with a visible explanation and apply the same standard to every team rather than editing history out of sight.", "Authorized commissioners can reverse supported transactions while DraftCenter retains the transaction history needed to understand why the roster changed."],
      ["Keep rulings and roster history in durable places", "A chat server is useful for alerts and discussion, but messages can be missed or edited. Publish material deadline changes and disputed rulings where every coach can find the same version. The official roster and transaction record should remain the source of truth.", "Use the League Board for durable announcements, Transactions for roster movement, and optional Discord connections for selected notifications. Personal alerts remain each member's choice."],
    ],
    checklistTitle: "Transaction rules to publish",
    checklist: [
      "Trade consent, cancellation, deadline, and reversal rules are explicit.",
      "Free agency is labeled instant or claim-based with a processing time and time zone.",
      "Weekly, seasonal, roster-size, and postseason limits match the saved settings.",
      "Coaches know where to confirm that a move became official.",
      "Material exceptions and corrections receive a durable league-wide explanation.",
    ],
    links: [["Copy the rules template", "/guides/pokemon-draft-league-rules-template"], ["Open the manager manual", "/manuals/manager"], ["Open the commissioner manual", "/manuals/commissioner"], ["Understand standings and playoffs", "/guides/pokemon-draft-standings-tiebreakers-playoffs"]],
  },
  "pokemon-draft-standings-tiebreakers-playoffs": {
    title: "Pokémon Draft Standings, Tiebreakers, and Playoffs",
    seoTitle: "Pokémon Draft Standings and Playoffs",
    description: "Confirm Pokémon draft league results, publish a fair tiebreaker order, choose playoff size and seeding, and handle postseason roster locks.",
    answer: "Pokémon draft league standings rank teams from confirmed match results, usually by wins and then a published sequence such as game differential and head-to-head results. Playoffs should use the preannounced field size, seeding order, bracket type, deadlines, and roster lock so qualification cannot change through an improvised late ruling.",
    intro: "Standings turn weekly matches into a season, but the table is only trustworthy when everyone knows how it is calculated. The important decision is not finding one universal tiebreaker. It is publishing an ordered chain before the first match, saving results consistently, and carrying that same order into playoff seeding.",
    publishedDate: "2026-08-10",
    updatedDate: "2026-08-18",
    sections: [
      ["Begin with confirmed match results", "A standings row is downstream of the schedule and saved scores. Define who may report a result, what the score means, whether differential is recorded, and how corrections are approved. Fix the underlying result when it is wrong instead of manually forcing the table into the expected order.", "Either participating manager can report an eligible DraftCenter match, and commissioners can review supported corrections. A participating manager may begin with manual entry or analyze public Pokémon Showdown replay links, but the standings change only after the normal result editor is reviewed and Save is pressed."],
      ["Treat replay facts as evidence, not a complete story", "A public replay can support the players, winner, format, revealed teams, and battle counts that actually appear in its log. It cannot prove an unrevealed Pokémon was brought, and a faint does not always identify which opposing Pokémon earned a knockout. Keep the league record inside the source's real limits.", "DraftCenter accepts one to five exact public replay URLs for an eligible scheduled matchup, prevents the same canonical replay from being reused, and requires the reporter to map each Showdown player to a scheduled team. Raw logs, inferred knockout attribution, and unrevealed-team claims are not stored."],
      ["Publish the entire tiebreaker chain", "Wins commonly come first, followed by a measure such as game or remaining-Pokémon differential, head-to-head results, strength of schedule, or another declared method. Every step needs a definition, and any commissioner draw or random method should come last.", "Round-robin leagues display the commissioner-selected ranking chain. Swiss leagues use the fixed published order of wins, opponent match-win percentage, game-win percentage, opponent game-win percentage, then initial team order."],
      ["Decide how unplayed and corrected matches count", "A forfeit, extension, double loss, or erased result can affect several teams. Write the score and differential treatment for each outcome before the playoff race. If an exceptional ruling is necessary, record the reason and verify the recalculated table with the affected coaches.", "Keep the authoritative result in Schedule and post material rulings on the League Board so the table, explanation, and roster history do not diverge."],
      ["Choose a playoff field that the schedule can support", "A larger bracket includes more coaches but can weaken the value of the regular season or add extra weeks. Pick the field size, byes, qualification rule, and deadline before drafting. For divisions or connected pods, explain whether each group has automatic places and how wild cards are compared.", "DraftCenter supports configured single-elimination, double-elimination, and division postseason paths. Connected organizations can retain pod qualification rules for a shared championship."],
      ["Seed from the final published standings", "Freeze or confirm the regular-season results before generating the bracket. State whether seeds are strictly standings-based, division-based, or manually adjusted under a published rule. Do not change the criterion after seeing the matchup it creates.", "DraftCenter generates the bracket from the saved playoff settings and current standings. Commissioners can review the displayed seeds before postseason results are reported."],
      ["Set postseason deadlines and roster locks", "Clarify whether trades or free agency close before seeding, when playoff teams lock, how bracket matches are scheduled, and whether differential affects a series. The playoff rules should also cover disconnects, substitutions, corrections, and any bracket reset in double elimination.", "DraftCenter closes transactions under the configured season and playoff rules, stores postseason results in the bracket, and preserves the champion and final table in the season archive."],
    ],
    checklistTitle: "Before the playoff race begins",
    checklist: [
      "Result reporting, score meaning, and correction authority are documented.",
      "Any Showdown replay is mapped to the correct scheduled teams and reviewed before saving.",
      "The complete ordered tiebreaker chain matches the saved league settings.",
      "Forfeits, unplayed matches, and differential treatment are defined.",
      "Playoff field size, bracket type, seeding, byes, and deadlines are published.",
      "The transaction cutoff and postseason roster lock are unambiguous.",
    ],
    links: [["Report results from Showdown replays", "/guides/pokemon-showdown-replay-results-draft-league"], ["Learn how a draft season works", "/guides/what-is-pokemon-draft-league"], ["Copy the rules template", "/guides/pokemon-draft-league-rules-template"], ["Plan transactions and free agency", "/guides/pokemon-draft-league-transactions-free-agency"], ["Run a league step by step", "/guides/how-to-run-pokemon-draft-league"]],
  },
  "compare-pokemon-forms-stats-draft-data": {
    title: "How to Compare Pokémon Forms, Stats, and Draft Data",
    seoTitle: "Compare Pokémon Forms, Stats, and Draft Data",
    description: "Compare Pokémon forms without mixing species facts, battle stats, abilities, move pools, format legality, or small-sample Pokémon draft league data.",
    answer: "Compare Pokémon forms by confirming the exact battle identity first, then checking typing, base stats, abilities, legal mechanics, and version-specific moves side by side. Treat shared species traits separately, verify that each form is legal in the target format, and compare DraftCenter ADP, draft rate, auction value, and results only when the displayed samples and formats match.",
    intro: "Two pages can share a species name while describing very different battle options. Mega Evolutions, regional forms, alternate formes, fusions, and battle transformations may change stats, typing, abilities, or legality. Cosmetic appearances may change none of those. A useful comparison starts by identifying the exact form and game before looking at a single community number.",
    publishedDate: "2026-08-10",
    updatedDate: "2026-08-10",
    sections: [
      ["Confirm that both entries are distinct battle forms", "A separate name or appearance does not always mean a separate competitive profile. Ask whether the form has different battle stats, typing, abilities, moves, or legal requirements. Cosmetic appearances are useful to identify, but they should not be treated as new competitive data rows without a gameplay difference.", "DraftCenter gives materially distinct battle identities canonical profile pages and lists forms and varieties on the profile. Cosmetic appearances are labeled separately instead of being promoted into duplicate search pages."],
      ["Compare base stats by role, not only by total", "Base stat total can hide the shape of a Pokémon. The same total can describe a fast attacker, a slow wall, or a balanced utility option. Compare HP, Attack, Defense, Special Attack, Special Defense, and Speed individually, then ask what the form can do repeatedly in the target format.", "Each public profile displays all six base stats and the total. Type and generation indexes provide crawlable shortlists before you open individual profiles."],
      ["Check typing, abilities, and mechanics together", "A typing change can alter switch-in opportunities, while an ability can create immunities, weather control, speed control, or a new cost to using the form. Mega Evolution, Terastallization, Dynamax, and other mechanics may also be limited by the league even when the base species is legal.", "DraftCenter profiles show typing and abilities, while the format library and saved league regulation determine the actual legal pool and special-mechanic limits."],
      ["Keep move pools tied to the game", "A move learned in one generation or title may not exist in another. Do not merge move lists from different games and assume every option is legal at once. Choose the league's game first, then compare the versioned pool and any form-specific restriction.", "The interactive DraftCenter Pokédex keeps move sources separated by game and labels the active source. Saved league bans and overrides can still narrow the final choice."],
      ["Separate shared species traits from form-specific facts", "Pokédex color, shape, and Egg Groups are normally species-level classifications. Measurements, battle stats, abilities, and typing may be form-specific. Knowing which layer a fact belongs to prevents a shared category from being mistaken for a competitive difference.", "DraftCenter labels species-level classifications on profiles and links them to color, shape, Egg Group, type, and generation indexes for further comparison."],
      ["Compare community data only on matching terms", "Draft rate, ADP, auction price, teammate frequency, and win rate answer different questions. Compare the same legal format and look at eligible pools or confirmed matches before drawing a conclusion. A form with one early selection is not proven stronger than a form with a larger, later sample.", "DraftCenter shows sample sizes, format-specific ADP when available, completed auction samples, and confirmed-match records. The methodology page explains exclusions and why small samples remain early evidence."],
    ],
    checklistTitle: "A clean form comparison",
    checklist: [
      "I identified the exact form and the game or generation being played.",
      "I compared all six base stats, typing, abilities, and required mechanics.",
      "The move pools come from the same version context.",
      "I kept species-level classifications separate from form-specific battle facts.",
      "Any draft-data comparison uses compatible formats and visible sample sizes.",
    ],
    links: [["Open the interactive Pokédex", "/pokemon"], ["Browse all Pokémon A–Z", "/pokemon/a-z"], ["Compare Pokémon by type", "/pokemon/types"], ["Learn how to use draft ADP", "/guides/how-to-use-pokemon-draft-adp"]],
  },
  "pokemon-draft-manager-vs-spreadsheets": {
    title: "Pokémon Draft League Manager vs. Spreadsheets",
    seoTitle: "Pokémon Draft Manager vs. Spreadsheets",
    description: "Compare a Pokémon draft league manager with spreadsheets and learn how to move teams, rosters, and prices through a reviewed CSV or XLSX import.",
    answer: "Use a dedicated Pokémon draft league manager when several people need one current source for legal picks, rosters, permissions, schedules, transactions, standings, and playoffs. Keep spreadsheets for planning, bulk work, exports, and offline records. DraftCenter can preview a bounded CSV or XLSX template for an existing pre-draft setup or complete roster without fabricating account ownership or season history.",
    intro: "A spreadsheet is flexible, familiar, and excellent for planning. It also asks the commissioner to become the permissions system, transaction processor, standings formula, audit trail, and support desk. Moving to a dedicated manager should reduce that work without turning an old sheet into unreviewed league history. The safest switch starts with a documented template, a complete preview, and one intentional confirmation.",
    publishedDate: "2026-08-10",
    updatedDate: "2026-08-18",
    sections: [
      ["Spreadsheets are strongest before and around the league", "A sheet is useful for private rankings, draft notes, experimental tier lists, bulk pricing work, and an offline season record. It is easy to inspect and customize, and coaches can keep personal analysis without changing the official league state.", "DraftCenter provides pricing and league-import templates plus readable league spreadsheet exports. Commissioners preview imported changes before saving them to the official pool or roster state."],
      ["Start a migration with the product template", "A safe importer needs a known shape. Copying an arbitrary workbook with formulas, merged headers, hidden columns, or several seasons invites ambiguity. Move only the current team, manager label, Pokémon, and price information that you can verify.", "Pre-draft Setup offers both XLSX and CSV league templates and documents accepted Team, Manager, Pokémon, and Price aliases. One file may contain no more than 5 MB or 5,000 data rows, and Pokémon must use exact legal DraftCenter form names."],
      ["Make the preview the safety gate", "Do not treat a successful file upload as permission to edit the league. First compare team counts, rosters, prices, errors, duplicates, capacity, and budget totals with the source sheet. A useful error report should tell you which row to repair instead of silently skipping it.", "DraftCenter parses the upload without changing the league, displays a full preview, and offers a downloadable row-level error report. It rejects duplicates, conflicting managers or prices, unsupported data-only columns, illegal forms, roster-cap violations, budget overruns, and claimed-team changes before confirmation."],
      ["Import planning labels, not account ownership", "A manager name in a spreadsheet says who the commissioner expected to run a team; it does not prove which account owns that name or accepted an invitation. Keep authentication and team claiming in the product's real invitation flow.", "DraftCenter stores imported manager text only as a planning label. It never claims an account, creates an invitation, fabricates picks or transactions, or reconstructs match history. A complete-roster conversion also requires the exact league name before confirmation."],
      ["A manager is strongest when many people can change state", "Once coaches draft, trade, claim free agents, report matches, and qualify for playoffs, concurrent edits become the hard problem. A dedicated manager can enforce roles and roster rules while showing everyone the same saved result instead of relying on copied tabs and manual reconciliation.", "DraftCenter separates commissioner, co-commissioner, manager, pod-manager, and spectator access. The live draft, official rosters, schedule, transactions, standings, and bracket share one league record."],
      ["Look for safeguards, not only a feature checklist", "A long list of features does not matter if a missed click can corrupt a season. Evaluate draft readiness, roster and budget enforcement, confirmation states, recovery options, audit history, and how the product handles a stale or interrupted save.", "DraftCenter checks league and draft readiness, preserves transaction state, supports recovery backups, and warns before high-impact commissioner actions. A confirmed league import can be undone immediately in the same session, while durable recovery history remains available for supported restoration."],
      ["Keep public discovery separate from private operations", "A league may want public standings and schedules without exposing manager messages, private queues, support details, or account information. Check whether the tool defines that boundary rather than publishing a whole working document because one tab should be visible.", "DraftCenter exposes eligible public league pages and aggregated reference data while keeping private queues, team workspaces, protected tools, and private league content outside the public indexing surface."],
      ["Choose around the league your group will actually run", "The right platform should support the draft type, game or generation, roster rules, transaction method, standings chain, playoff format, team count, and commissioner workflow you need. Test the real settings with a small group before moving the official season.", "DraftCenter supports snake and auction drafts, supported or custom legal pools, live rosters, instant or claim-based free agency, standings, multiple playoff paths, archives, and connected multi-pod championships."],
      ["Use exports as a complement and an exit path", "A dedicated manager should not make the league afraid of losing its history. Download readable records at major milestones, keep the published rules beside them, and understand which backup restores the application versus which export is for people to read.", "DraftCenter separates spreadsheet exports from recovery JSON backups. Commissioners can save both before the draft, after major configuration changes, and when the season archive is finalized."],
    ],
    checklistTitle: "Before moving a league",
    checklist: [
      "Does it support our exact format, draft type, roster math, and playoff path?",
      "Can the current setup fit a documented CSV or XLSX template without guessing at history?",
      "Does every imported row pass preview, legal-form, duplicate, capacity, and budget checks?",
      "Can each role see and change only what it should?",
      "Will picks, transactions, results, and standings share one authoritative record?",
      "Can we rehearse the workflow and recover from a genuine mistake?",
      "Can we export a readable record without exposing private league information?",
    ],
    links: [["Run a Pokémon draft league", "/guides/how-to-run-pokemon-draft-league"], ["Report results from Showdown replays", "/guides/pokemon-showdown-replay-results-draft-league"], ["Copy the rules template", "/guides/pokemon-draft-league-rules-template"], ["Explore public leagues", "/leagues"], ["Open commissioner help", "/manuals/commissioner"]],
  },
  "pokemon-showdown-replay-results-draft-league": {
    title: "How to Report Pokémon Draft League Results from Showdown Replays",
    seoTitle: "Pokémon Showdown Replay Results for Draft Leagues",
    description: "Use public Pokémon Showdown replay links to confirm a scheduled draft league result, map players, avoid duplicates, and save only supported facts.",
    answer: "For an eligible scheduled DraftCenter matchup, a participating manager can submit one to five exact public Pokémon Showdown replay URLs, map each Showdown player to a scheduled team, review the proposed facts in the normal result editor, and press Save. Replay analysis never writes a result automatically and never invents knockout attribution or unrevealed team members.",
    intro: "A replay can reduce score-entry mistakes, but a URL should never rewrite league history just because it loads. The safe workflow keeps the scheduled matchup authoritative, checks the replay on the server, asks the reporter to resolve player identities, and still requires a normal reviewed save. This guide explains what a replay can confirm, what it cannot prove, and how DraftCenter keeps that boundary visible.",
    publishedDate: "2026-08-18",
    updatedDate: "2026-08-18",
    sections: [
      ["Start from the scheduled matchup", "Open the regular-season match that the replay belongs to. Confirm the week, teams, participants, and current result state before adding a URL. A replay from an exhibition, playoff, different opponent, or unscheduled game should not be forced into the wrong record.", "Replay analysis is available only to an authenticated member who controls one of the scheduled teams for an eligible regular-season matchup. The server rechecks the membership, team control, schedule state, rate limit, and existing result before returning any facts."],
      ["Use exact public replay URLs", "Copy the permanent public replay address after the battle is uploaded. Do not paste a live battle room, arbitrary log mirror, shortened redirect chain, or private file. For a best-of series, collect only the games that belong to the scheduled result.", "DraftCenter accepts one to five exact public Pokémon Showdown replay URLs. The server validates the host, redirects, response size, timeout, replay identity, and duplicate use instead of trusting browser-supplied text."],
      ["Map the Showdown players to the scheduled teams", "A Showdown display name is not a DraftCenter account identity. Read both player names and deliberately choose which scheduled team each one represents. If the mapping is unclear, stop and confirm it with the opponent before saving.", "The reporter must map each parsed Showdown player to one of the two scheduled teams. The result editor does not treat a similar display name as proof of account ownership or silently choose the mapping."],
      ["Review only the facts the battle supports", "A replay can support its canonical identity, format, game type, upload time, players, winner, participating sides, faint or remaining counts, and Pokémon actually revealed in battle. It cannot prove that an unrevealed roster member was brought, and a faint does not always prove which opposing Pokémon earned a knockout.", "DraftCenter rebuilds its normal result proposal from bounded parsed facts. It does not store raw replay logs, infer knockout attribution, or claim unrevealed Pokémon were part of the battle team."],
      ["Save through the normal result editor", "Read the proposed score, differential, winner, mappings, and replay list just as carefully as a manual report. If any value is wrong or unsupported, correct the source or use manual entry under the league's rules rather than saving a misleading confirmation.", "Analyzing replays never writes the league result. The reporter must review the normal editor and press Save. Manual score or differential changes clear the replay-confirmation payload so an edited result cannot keep an incompatible confirmation badge."],
      ["Keep every replay unique", "A public replay should support one recorded matchup, not several. Reusing the same game across weeks or leagues creates false evidence even if the score happens to match. Preserve the original link beside the result so a future correction can return to the same source.", "DraftCenter stores canonical replay identities with the confirmed result and rejects reuse. The server locks and revalidates the authoritative scheduled matchup when the result is saved."],
      ["Keep manual reporting available", "Cartridge games, unavailable replays, malformed logs, private battles, timeouts, and unsupported sources still need the league's ordinary reporting process. A commissioner should publish the fallback before week one so a technical failure does not become a competitive ruling invented after the match.", "Manual result entry remains available. DraftCenter does not retry a timed-out replay mutation or turn an analysis failure into an automatic score."],
    ],
    checklistTitle: "Before saving a replay-confirmed result",
    checklist: [
      "The replay belongs to this exact scheduled regular-season matchup.",
      "Every URL is an exact public Pokémon Showdown replay and appears only once.",
      "Both Showdown players are deliberately mapped to the correct scheduled teams.",
      "The winner, score, differential, and revealed Pokémon match the supported facts.",
      "No knockout attribution or unrevealed Pokémon claim was inferred from the log.",
      "I reviewed the normal result editor and intentionally chose Save.",
    ],
    links: [["Plan standings and playoffs", "/guides/pokemon-draft-standings-tiebreakers-playoffs"], ["Run a league step by step", "/guides/how-to-run-pokemon-draft-league"], ["Move from a league spreadsheet", "/guides/pokemon-draft-manager-vs-spreadsheets"], ["Open the manager manual", "/manuals/manager"], ["Browse public leagues", "/leagues"]],
  },
  "pokemon-auction-tournament-swiss-top-cut": {
    title: "How to Run a Pokémon Auction Tournament with Swiss and Top Cut",
    seoTitle: "Pokémon Auction Tournament: Swiss and Top Cut Guide",
    description: "Plan a Pokémon auction tournament from roster and budget math through Swiss standings, a Top Cut playoff, team previews, and a private organizer rehearsal.",
    answer: "Set the field size, legal pool, roster size, budget, auction clocks, Swiss rounds, tiebreakers, and Top Cut before registration opens. Rehearse the complete lifecycle privately, verify every winning bid and locked roster, then carry the final Swiss standings into the announced playoff bracket without changing the rules mid-event.",
    intro: "An auction tournament combines two demanding jobs: a live market where every manager builds a legal team and a competition where every result must lead cleanly to final standings. The safest plan treats registration, the auction, Swiss, and Top Cut as one connected event. This guide uses DraftCenter's 32-seat Regulation M-B organizer showcase as a concrete rehearsal, while keeping the real tournament's roster size, budget, publication choices, and cut structure under the organizer's control.",
    publishedDate: "2026-08-18",
    updatedDate: "2026-08-18",
    sections: [
      ["Publish the whole event structure first", "Tell entrants how many seats are available, which regulation or custom pool is legal, how many Pokémon each roster needs, the starting budget, the minimum bid, all clocks, the number of Swiss rounds, every tiebreaker, and how many players advance. Also publish whether locked rosters or team previews will be visible to spectators.", "DraftCenter supports shared snake drafts and auctions for 4–32 managers before Swiss, single elimination, or double elimination. Ordinary event settings remain configurable by the commissioner."],
      ["Make roster and budget math possible", "Every manager must be able to finish a legal roster even after an aggressive early purchase. Check that the total pool is large enough for the field and that the minimum remaining spend can fill every open slot. Explain what happens when a manager cannot place a legal bid or finish on time.", "Auction rooms preserve the winning price beside each drafted Pokémon and enforce the saved roster size and budget. The completed recap shows winning bids, total spend, and remaining budget so the market can be reviewed later."],
      ["Rehearse with synthetic seats", "Practice the parts most likely to slow a live broadcast: check-in, nominations, bids near the clock, roster lock, result reporting, corrections, standings, the cut, and the final. A rehearsal should be clearly synthetic and should never be presented as real participation or public tournament history.", "DraftCenter's private organizer demo uses the signed-in owner plus 31 clearly labeled bot seats. Its current Regulation M-B showcase creates six-Pokémon teams with one Mega and five non-Mega Pokémon, a 120-point budget, five Swiss rounds, and a Top 8 playoff. The private practice URL and workspace remain outside search discovery."],
      ["Lock and audit the auction", "Before Round 1, compare every roster with the legal pool, required size, purchase prices, and remaining budget. Resolve an unfinished nomination or missing roster slot before pairings are created. Save a human-readable auction recap for the organizer and participants.", "Roster lock carries each drafted team into tournament play. DraftCenter's auction recap keeps the winning price with every pick and provides the budget context needed to explain how each team was assembled."],
      ["Run Swiss as an announced path", "Swiss should use the published round count and tiebreakers from the start. Record each result against the correct pairing, resolve byes consistently, and review standings after every round. Do not add rounds or alter the cut because a favored entrant is outside the line.", "DraftCenter uses three Swiss rounds for 4–8 managers, four for 9–16, and five for 17–32 managers. Pairings follow score groups and avoid rematches when possible; the standings remain the source for the playoff seeds."],
      ["Create the Top Cut from final standings", "After the final Swiss result is confirmed, freeze the standings, announce the qualifiers and seeds, and build the promised bracket. Keep a record of any authorized correction and why it changed a seed. For a Top 8, quarterfinal pairings should follow the published seeding policy.", "The private 32-seat showcase promotes the final Swiss Top 8 into a permanent single-elimination playoff. DraftCenter keeps the Swiss table and playoff bracket in the same event record."],
      ["Use team previews only with permission", "Roster previews make a playoff bracket easier to read and teach, but publication is an event rule rather than an automatic entitlement. Decide whether rosters are open, closed, delayed until Top Cut, or commissioner-only, and apply the same rule to every entrant.", "When the existing authorized roster projection returns a team, DraftCenter elimination and Top Cut match cards can show a compact six-Pokémon preview with form-aware artwork. Private rosters are not exposed merely because an event has a bracket."],
      ["Preserve the organizer record", "After the final, save the bracket, final standings, roster list, auction recap, rules, and any approved corrections. Screenshots are useful for a recap or proposal, but exports and the authoritative event record should remain the source if a screenshot becomes outdated.", "DraftCenter keeps the connected event available to the authorized organizer. Private demos may be reset for another rehearsal; generated entries and results remain labeled as synthetic."],
    ],
    checklistTitle: "Before opening the real tournament",
    checklist: [
      "The legal pool, field size, roster size, budget, minimum bid, and clocks are published.",
      "Every manager can mathematically finish a legal roster from the starting budget.",
      "Swiss rounds, tiebreakers, Top Cut size, and seeding rules are fixed in advance.",
      "A private rehearsal covered registration, auction, roster lock, results, standings, and playoffs.",
      "Winning bids, spend, and remaining budget were audited before Round 1.",
      "Roster and team-preview visibility matches the published event policy.",
      "The final standings, bracket, rosters, and organizer recap can be preserved together.",
    ],
    links: [["Open the tournament organizer", "/tournaments"], ["Copy the rules template", "/guides/pokemon-draft-league-rules-template"], ["Compare snake and auction drafts", "/guides/snake-vs-auction-pokemon-draft"], ["Compare supported formats", "/formats"], ["Open the commissioner manual", "/manuals/commissioner"]],
  },
  "vgc-open-closed-team-sheet-battle-tracker": {
    title: "How to Track VGC Battles with Open or Closed Team Sheets",
    seoTitle: "VGC Battle Tracker for Open or Closed Team Sheets",
    description: "Track a fast VGC battle with four active Pokémon, moves, targets, switches, revealed sets, timed field effects, reload recovery, and private reports.",
    answer: "Keep both active Pokémon on each side visible, preload only information allowed by the team-sheet rules, and record each move, target, switch, reveal, or faint in the order it happens. Let timed effects and optional turn completion reduce taps, then export each game or the complete private battle record for review.",
    intro: "A VGC turn can be decided in 45 seconds, so a useful tracker cannot ask the coach to reopen six long set cards after every action. The live view should look like the field: two opponents above, two teammates below, saved moves one tap away, and the bench close enough for a switch. This guide explains the fast workflow while preserving the most important boundary—suggestions can speed up entry, but they never become revealed facts until the coach records them.",
    publishedDate: "2026-08-18",
    updatedDate: "2026-08-18",
    sections: [
      ["Choose the correct sheet mode", "Use open team sheet only for information the event actually publishes. In a closed team sheet match, begin with the visible species and add a move, item, or ability only when battle play reveals it. Keep private deductions separate from facts you can cite later.", "Team Lab supports open- and closed-team-sheet Battle Room workflows. Closed sheet starts from observed information; open sheet can preload published details. Opponent notes and the battle record remain private to the signed-in account."],
      ["Set the four active slots", "Put both opposing Pokémon in the top row and both of your active Pokémon in the bottom row. Confirm the leads before the first action. Keep the remaining roster in a compact bench rather than expanding every saved set into the live turn area.", "The doubles field shows two active slots per side. Your compact six-Pokémon roster marks Brought, Benched, or Out; tapping a member can reveal its saved set, and the roster collapses after leads are selected."],
      ["Record an action from the Pokémon that acted", "Select the acting Pokémon, choose Move, Ability, Item, Switch, Faint, or Note, then choose the target or replacement when the action needs one. For doubles, always distinguish the user from the target, including an ally target.", "Active cards keep saved and revealed moves one tap away. Selecting a Pokémon prepares its action, while target controls distinguish the acting side and the affected Pokémon."],
      ["Use suggestions as shortcuts, not evidence", "Type-ahead move, ability, and item lists can reduce spelling and scrolling. Common-set suggestions are useful planning context, especially in an open-sheet environment, but usage frequency does not prove the opponent's set.", "Team Lab places saved and revealed information first. Format-aware competitive suggestions remain visibly labeled, and choosing a suggestion records only what the coach intentionally confirms."],
      ["Complete switches and pivot moves", "A plain switch needs both pieces of information: who left and who came in. A pivot move such as Parting Shot, U-turn, Volt Switch, or Flip Turn also needs its move and target before the replacement is chosen. Do not leave the field showing a Pokémon that already switched out.", "Switch actions require a replacement. Supported pivot moves continue into the switch picker so the timeline and four active slots stay synchronized."],
      ["Let timed effects expire visibly", "When Tailwind, Trick Room, weather, terrain, screens, or another tracked field effect begins, record the side and duration at that turn. A turn counter is most useful when it updates automatically but still permits a correction after an unusual extension or missed turn.", "Structured battle state tracks supported field effects and their remaining turns. Advancing the turn decrements the timers and removes an effect when its recorded duration ends."],
      ["Use Auto-next only when the turn is complete", "A turn may end without four attacks because a Pokémon switched, fainted before moving, became unable to act, or the game ended. Auto-advance should recognize recorded moves and switches for every eligible active Pokémon, but the coach must keep a manual Next turn control for edge cases.", "Optional Auto-next advances only after each eligible active Pokémon has a move or switch recorded for the current turn. Manual next-turn and undo controls remain available."],
      ["Recover and export the record", "A refresh during a match should restore the active Battle tab and its local draft instead of returning to setup. After each game, download a compact record; after the set, preserve the full workbook and add the replay or result context you want to review.", "Team Lab restores the selected tab and locally autosaved Battle Room state. It provides a per-game CSV and a complete Excel or Google Sheets-ready workbook containing only the teams, turns, reveals, effects, notes, and report details the coach saved."],
    ],
    checklistTitle: "A fast turn-recording routine",
    checklist: [
      "The sheet mode matches the event's open or closed team-sheet rule.",
      "Both active Pokémon on each side match the battle field.",
      "Every recorded move has the correct user and target.",
      "Every switch identifies the Pokémon that entered, including after a pivot move.",
      "Items and abilities are recorded only after they are known or revealed.",
      "Timed effects show the correct side and remaining turns.",
      "Auto-next is enabled only if I want complete turns to advance automatically.",
      "The game CSV or complete private workbook is saved when I need a report.",
    ],
    links: [["Open Team Lab", "/team-lab"], ["Compare supported Pokémon formats", "/formats"], ["Explore Pokémon profiles", "/pokemon"], ["Report league results from Showdown replays", "/guides/pokemon-showdown-replay-results-draft-league"]],
  },
};

const FEATURED_FORMATS = [
  ["national-dex", "National Dex", "All supported generations, forms, and Mega Evolutions", "A complete DraftCenter pool for cross-generation draft leagues, with commissioner-controlled bans, costs, Restricted Pokémon limits, and Mega limits."],
  ...Array.from({ length: 9 }, (_, index) => 9 - index).map((generation) => [
    `national-gen${generation}`,
    `National Dex through Generation ${generation}`,
    `Cross-generation draft pool capped at Generation ${generation}`,
    `A historical National Dex pool containing Pokémon introduced through Generation ${generation}, with commissioner-controlled bans, costs, and roster restrictions.`,
  ]),
  ["reg-mb", "Regulation M-B", "Pokémon Champions VGC · June 17–September 2, 2026", "The current Pokémon Champions regulation with Mega Evolution available and a curated DraftCenter legal pool."],
  ["reg-ma", "Regulation M-A", "Pokémon Champions VGC · April 8–June 17, 2026", "The opening Pokémon Champions regulation and its original competitive legal pool."],
  ["reg-a", "Regulation A", "Scarlet & Violet VGC · January 2023", "The initial Paldea format, excluding Paradox Pokémon, Treasures of Ruin, and box legends."],
  ["reg-b", "Regulation B", "Scarlet & Violet VGC · February–March 2023", "Expanded Regulation A with Paradox Pokémon joining the legal pool."],
  ["reg-c", "Regulation C", "Scarlet & Violet VGC · April–June 2023", "Added the Treasures of Ruin while keeping box legends unavailable."],
  ["reg-d", "Regulation D", "Scarlet & Violet VGC · July–September 2023", "Opened the format to many Pokémon transferred through Pokémon HOME."],
  ["reg-e", "Regulation E", "Scarlet & Violet VGC · October 2023–January 2024", "Added the Kitakami Pokédex and Teal Mask options."],
  ["reg-f", "Regulation F", "Scarlet & Violet VGC · January–April 2024", "Added the Indigo Disk and Blueberry Pokédex pool without Restricted legends."],
  ["reg-g", "Regulation G", "Scarlet & Violet VGC · May–August 2024", "Introduced one Restricted Pokémon per team."],
  ["reg-h", "Regulation H", "Scarlet & Violet VGC · September 2024–January 2025", "A lower-power format excluding most Legendary and Paradox Pokémon."],
  ["reg-i", "Regulation I", "Scarlet & Violet VGC · May–August 2025", "Allowed up to two Restricted Pokémon per team."],
  ["reg-j", "Regulation J", "Scarlet & Violet VGC · September 2025–January 2026", "Expanded the two-slot Restricted category to include Mythical Pokémon."],
  ["swsh-series9", "Sword & Shield Series 9", "Sword & Shield VGC · May–July 2021", "A broad Generation 8 pool without Restricted or Mythical Pokémon."],
  ["swsh-series13", "Sword & Shield Series 13", "Sword & Shield VGC · September–October 2022", "The final Generation 8 ruleset with unrestricted Legendary and Mythical access."],
  ["sm-vgc2018", "VGC 2018", "Ultra Sun & Ultra Moon VGC", "A Generation 7 National Pokédex-style pool without Restricted or Mythical Pokémon."],
  ["custom", "Custom Draft Format", "Commissioner-defined legality and pricing", "Build a legal pool, bans, costs, mechanics, and roster restrictions for a bespoke league."],
].map(([slug, name, subtitle, summary]) => ({ slug, name, subtitle, summary }));

const FEATURED_FORMAT_BY_SLUG = Object.fromEntries(FEATURED_FORMATS.map((format) => [format.slug, format]));
const CATEGORY_LABELS = { official: "official competitive rules", pokedex: "regional Pokédex pool", generation: "historical National Dex pool", custom: "commissioner-defined pool" };

export const FORMATS = [
  { ...FEATURED_FORMAT_BY_SLUG["national-dex"], gameId: "national-dex", category: "generation", order: 0 },
  ...Object.values(REGULATION_METADATA).map((metadata) => {
    const featured = FEATURED_FORMAT_BY_SLUG[metadata.id];
    const group = REGULATION_GROUPS.find(({ id }) => id === metadata.gameId);
    return { slug: metadata.id, name: featured?.name || metadata.label, subtitle: featured?.subtitle || `${group?.label || "DraftCenter"} · ${CATEGORY_LABELS[metadata.category]}`, summary: featured?.summary || `${metadata.label} uses DraftCenter's supported ${group?.label || "custom"} legal pool, with league-specific bans, prices, and roster settings controlled by the commissioner.`, ...metadata };
  }),
];

export function formatBySlug(slug) {
  return FORMATS.find((format) => format.slug === slug);
}

function formatFamily(slug) {
  if (slug.startsWith("national-")) return "national";
  if (slug.startsWith("reg-")) return "regulation";
  if (slug.startsWith("swsh-")) return "sword-shield";
  if (slug.startsWith("sm-")) return "sun-moon";
  return slug;
}

export function relatedFormatsBySlug(slug, limit = 3) {
  const currentIndex = FORMATS.findIndex((format) => format.slug === slug);
  if (currentIndex < 0 || limit < 1) return [];
  const family = formatFamily(slug);
  return FORMATS
    .filter((format) => format.slug !== slug)
    .map((format) => ({
      format,
      familyRank: formatFamily(format.slug) === family ? 0 : 1,
      distance: Math.abs(FORMATS.findIndex((item) => item.slug === format.slug) - currentIndex),
    }))
    .sort((a, b) => a.familyRank - b.familyRank || a.distance - b.distance)
    .slice(0, limit)
    .map(({ format }) => format);
}
