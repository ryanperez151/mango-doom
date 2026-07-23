# MANGO.SYS CTF product specification

Status: implemented as a deterministic static-site experience; this specification remains the normative product boundary.

## 1. Product statement

**Working title:** The Mango Keep Incident

The Mango Keep Incident is a deterministic, offline, choose-your-own-adventure CTF for intermediate SOC analysts and security engineers. It borrows only high-level defensive themes from public BRICKSTORM reporting: an already-compromised perimeter appliance, management-plane trust, gaps in appliance telemetry, virtualization-layer evidence, sensitive hosted systems, and the need for careful recovery.

The experience is a fictional learning simulation, not an exploitation lab. The edge NGFW is compromised before play begins. Players never exploit it, enter a target, run a command, collect a credential, deploy software, or contact a system. Every threat action is a symbolic choice resolved through an allowlisted state transition. All telemetry is pre-authored, inert, visibly marked `SYNTHETIC`, and uses only `.invalid` hostnames and documentation IP ranges.

Because this is a static site, scenario data and answer logic are visible in source. The experience is educational and replayable, but it is not cheat-resistant and must never claim to certify skill or protect competitive scores.

### Audience and session length

- Primary audience: intermediate SOC analysts and security engineers who can read common network, identity, and virtualization events and explain an incident hypothesis.
- Threat Simulation: 45–60 minutes.
- Incident Response: 60–75 minutes.
- Paired play: 75–90 minutes, including a 10-minute handoff/debrief.
- A resumable run should fit within one browser session; a complete no-hint playthrough should require no more than 90 minutes.

### Learning objectives

By the end, a player should be able to:

1. Map management-plane trust boundaries without treating reachability as proof of compromise.
2. Correlate synthetic NGFW, network, virtualization, identity, endpoint, and analyst-note evidence.
3. Separate observations, inferences, and confirmed scope in a written hypothesis.
4. Explain why appliance blind spots and virtualization management layers change an investigation plan.
5. Select proportionate containment that preserves evidence and avoids unnecessary service impact.
6. Build a defensible timeline and communicate confidence, gaps, scope, and recovery priorities.
7. Recognize that persistence and domain-controller impact in this simulation are abstract conditions, not procedures.

## 2. Safety boundary

The normative guardrail is [ctf-safety.md](ctf-safety.md). If this specification and the safety document differ, the safer interpretation wins.

The application must be deterministic and offline-friendly. It must not contain a shell facsimile, arbitrary command execution, free-form target entry, authentication, external network calls, `eval`, dynamic code generation, executable scenario content, usable secrets, or reusable compromise steps. Threat choices describe intent and consequence only. Persistence uses the inert marker `persistence_marker_present`; domain-controller impact uses `dc_snapshot_exposure_marker`. Neither corresponds to a file, command, payload, credential, or vendor procedure.

## 3. Play modes

### Threat Simulation

The player acts as a tabletop adversary planner after the edge compromise has already occurred. The only available actions are curated scenario choices. The goal is to reason about trust boundaries, notice evidence the defender could see, minimize unnecessary impact, and document each decision. Stealth, dwell time, destructive impact, and evasion are never rewarded.

The threat track ends when the player chooses to stop, reaches the abstract DC-impact decision, or triggers a safety stop through excessive avoidable impact. Results emphasize the quality of reasoning and documentation, not how far the simulated intrusion progressed.

### Incident Response

The player starts from an alert packet and investigates pre-authored evidence. They filter logs, bookmark evidence, submit hypotheses, define scope, contain through symbolic controls, build a timeline, and choose recovery gates. Strong play preserves evidence, distinguishes confirmed from suspected scope, and communicates uncertainty.

### Paired play

Two people share one device or exchange an exported, inert handoff summary. The first player completes Threat Simulation and produces a handoff packet containing only choice IDs, rationale summaries, disclosed evidence IDs, and abstract state markers. The second player completes Incident Response against the deterministic consequences of those choices.

Paired mode must not reveal hidden answer keys in the handoff UI. It should include a facilitator option to reveal both perspectives only after the defender submits a final report. There is no real-time networking, account system, or remote collaboration.

## 4. Fictional topology

All assets belong to the invented `mangokeep.invalid` environment. Addresses are documentation-only and never user-editable.

| Asset ID | Display name | Fictional hostname | Address | Zone and role | Expected trust |
| --- | --- | --- | --- | --- | --- |
| `edge_ngfw` | Peel Gate NGFW | `peel-gate.mangokeep.invalid` | `192.0.2.10` | Edge; routing and remote-access policy | Already compromised; can reach only allowlisted management services |
| `mgmt_net` | Steward VLAN | `steward-net.mangokeep.invalid` | `192.0.2.16/28` | Management network | Restricted to named infrastructure administrators and managed services |
| `esxi_host` | Keep Hypervisor | `keep-esx.mangokeep.invalid` | `192.0.2.20` | Virtualization host | Managed by Orchard Crown; direct administration is exceptional |
| `vcenter_service` | Orchard Crown | `orchard-crown.mangokeep.invalid` | `192.0.2.21` | vCenter-like fictional management service | Controls VM inventory and lifecycle through abstract actions |
| `ordinary_vm` | Ledger VM | `ledger.mangokeep.invalid` | `198.51.100.30` | Server segment; ordinary line-of-business VM | Domain member; no infrastructure administration role |
| `decoy_vm` | Mimic VM | `mimic.mangokeep.invalid` | `198.51.100.31` | Server segment; decoy with conspicuous synthetic signals | No production trust; activity is designed to test evidence discipline |
| `hosted_dc_vm` | Grove Domain Controller | `grove-dc.mangokeep.invalid` | `198.51.100.10` | Hosted identity-critical VM | Tier-zero-like role; managed through Orchard Crown only under change control |
| `analyst_ws` | Lantern Workstation | `lantern.soc.mangokeep.invalid` | `203.0.113.40` | SOC segment; investigation console | Read-only access to the synthetic evidence corpus |
| `identity_service` | Saffron Identity | `saffron-id.mangokeep.invalid` | `198.51.100.11` | Identity segment; fictional authentication and authorization service | Supplies abstract identity events; no real credentials or tokens |

Trust relationships are directional and explicit in scenario data. They describe only whether a symbolic transition is eligible; they never cause network activity. The topology view must distinguish network reachability, administrative authority, identity dependency, and evidence visibility with text as well as color or line style.

## 5. Chapter design

Each chapter has an opening brief, two to four evidence cards, a decision, a consequence summary, an optional hint, and a short rationale prompt. Branches reconverge at chapter boundaries so the state space remains reviewable. No chapter may unlock an action outside the verb and transition allowlists.

The implemented Threat Simulation content revision uses seven phases: the original recovery lesson remains a future defender-track concern, while threat play ends with a separate containment-consequences phase and debrief. This seven-phase outline supersedes the earlier six-chapter count for Threat Simulation content and state ranges.

### Chapter 1 — Assumed edge compromise

- Premise: `edge_ngfw` is already compromised; the cause and method are outside scope.
- Player work: accept the assumption, inspect the asset inventory and retention gaps, and classify what is observation versus premise.
- Key lesson: lack of endpoint-style telemetry on an appliance changes confidence, not the safety boundary.
- Defender evidence: synthetic connection summaries, inventory record, and a logging-gap note.
- Threat decision: choose among inert observation priorities; no exploitation choice exists.
- Exit condition: the player records the edge as confirmed by scenario premise and identifies at least one evidence gap.

### Chapter 2 — Trust discovery

- Premise: pre-authored records expose several possible management relationships, including a decoy signal.
- Player work: inspect topology, filter identity/network events, bookmark corroborating evidence, and submit a trust-boundary hypothesis.
- Key lesson: access, authority, and evidence visibility are different relationships.
- Threat decision: select one allowlisted trust relationship to examine or stop and document uncertainty.
- Exit condition: a hypothesis names the suspected path and confidence without treating the decoy as automatically compromised.

### Chapter 3 — ESXi access

- Premise: synthetic management events show anomalous access involving `esxi_host` and `vcenter_service`.
- Player work: correlate timestamps, actors, approved-change records, and asset roles.
- Key lesson: virtualization audit sources can reveal management-plane activity that guest telemetry cannot.
- Threat decision: choose whether to request the abstract `virtualization_access_observed` transition; choosing broad impact incurs a penalty and adds no progress.
- Defender decision: preserve relevant synthetic audit sets before applying a symbolic management isolation.
- Exit condition: the player explains whether evidence supports attempted or confirmed management-plane access.

### Chapter 4 — Abstract persistence

- Premise: a scenario card offers the harmless condition `persistence_marker_present`.
- Player work: reason about what evidence would support or refute continued access across a simulated restart.
- Key lesson: persistence claims require evidence across sources and backups; the simulation does not teach a mechanism.
- Threat decision: set or decline the allowlisted marker and document evidentiary exposure.
- Defender decision: preserve the current state, compare a synthetic known-good record, and schedule a symbolic rebuild.
- Exit condition: state contains only the boolean marker and evidence links—never a filename, command, service, payload, or procedure.

### Chapter 5 — Simulated DC impact

- Premise: the hosted DC is visible through the fictional virtualization management plane.
- Player work: assess blast radius and choose whether to set `dc_snapshot_exposure_marker`, divert to the decoy, or stop.
- Key lesson: control of a virtualization layer can affect sensitive guests even when guest telemetry is quiet.
- Threat scoring: stopping or choosing the least-impactful evidence-aware option can outscore setting the impact marker; no points are awarded for impact itself.
- Defender work: correlate VM lifecycle, identity, and change-control evidence; scope identity risk without claiming that credentials were collected.
- Exit condition: any impact is expressed only as `none`, `suspected`, or `abstract_exposure_confirmed`.

### Chapter 6 — Recovery

- Premise: both tracks converge on restoration and communication.
- Player work: contain using symbolic controls, preserve evidence, build a timeline, sequence recovery gates, and submit a final report.
- Key lesson: recovery must address trust, management infrastructure, identity assurance, monitoring gaps, and stakeholder communication.
- Recovery choices: isolate a fictional zone, revoke an abstract trust grant, preserve a synthetic evidence bundle, rebuild an abstract asset from a known-good marker, validate logging, and restore service. These are UI choices, not instructions for real systems.
- Exit condition: a final report states scope, confidence, evidence, containment, recovery validation, and remaining uncertainty.

## 6. Player interaction model

The complete verb allowlist is:

| Verb | Meaning | State mutation |
| --- | --- | --- |
| `inspect` | Open a pre-authored asset, evidence card, relationship, or consequence. | May mark an item seen; never changes scenario truth. |
| `choose` | Select one pre-authored branch choice. | Applies one allowlisted deterministic transition. |
| `filter logs` | Apply fixed field/value filters or safe text matching to the local synthetic corpus. | Changes view state only. No regex execution is required. |
| `bookmark evidence` | Add or remove an evidence ID from the case notebook. | Updates bookmark IDs only. |
| `submit hypothesis` | Select claims, confidence, scope, and linked evidence, plus a length-limited rationale. | Stores inert text after HTML-safe rendering; evaluates against a rubric. |
| `contain` | Apply a named symbolic containment card. | Changes abstract asset/relationship status only. |
| `build timeline` | Order bookmarked evidence and annotate significance. | Stores evidence IDs, order, and inert notes. |

Buttons and documentation must use these verbs consistently. There is no command prompt. Player-authored rationales are text only, constrained to 500 characters, kept local, rendered with `textContent`, and never interpreted as code, selectors, markup, paths, hostnames, or commands.

## 7. State model

Runtime state should be one plain, versioned object created from trusted bundled data. Unknown fields, values, actions, transition IDs, evidence IDs, and asset IDs must be rejected rather than interpreted.

| Field | Type / allowed values | Purpose |
| --- | --- | --- |
| `schemaVersion` | fixed integer | Invalidates incompatible local saves. |
| `scenarioId` | allowlisted string | Selects one bundled scenario only. |
| `mode` | `threat`, `defender`, `paired` | Determines rubric and presentation. |
| `seed` | fixed scenario label, not random input | Documents deterministic variant selection. |
| `chapter` | integer `1`–`7` | Current Threat Simulation chapter. |
| `completedChapters` | unique allowlisted chapter IDs | Progress. |
| `choiceIds` | ordered allowlisted IDs | Decision history. |
| `seenEvidenceIds` | unique allowlisted IDs | Inspection progress. |
| `bookmarkedEvidenceIds` | unique allowlisted IDs | Notebook contents. |
| `activeFilters` | allowlisted fields and bundled values | View state only. |
| `hypotheses` | chapter ID, claim IDs, confidence, scope IDs, rationale text, evidence IDs | Reasoning submissions. |
| `timeline` | ordered evidence IDs plus inert notes | Player-built chronology. |
| `containmentIds` | ordered allowlisted IDs | Symbolic containment history. |
| `assetStates` | asset ID → `normal`, `suspected`, `affected`, `contained`, `recovering`, `restored` | Abstract status only. |
| `trustStates` | relationship ID → `allowed`, `suspended`, `revoked` | Abstract relationship status. |
| `persistence_marker_present` | boolean | Harmless persistence condition. |
| `dc_snapshot_exposure_marker` | `none`, `suspected`, `abstract_exposure_confirmed` | Harmless DC-impact condition. |
| `hintLevelByChapter` | integer `0`–`3` | Progressive hint use. |
| `scoreEvents` | allowlisted rubric event IDs and points | Auditable scoring ledger. |
| `endingId` | null or allowlisted ending ID | Final narrative result. |
| `startedAtLabel` | fixed fictional scenario timestamp label | Display only; not wall-clock tracking. |

Transitions are declared as data with an ID, required current chapter/state, effects limited to the fields above, evidence disclosures, score event IDs, and next chapter/choice IDs. The engine must implement field-specific reducers; it must never execute functions, expressions, URLs, HTML, code strings, or arbitrary object paths from scenario data.

## 8. Evidence and telemetry model

Every record must include a visible synthetic marker and structured provenance:

- `synthetic: true` (required and immutable)
- display prefix: `[SYNTHETIC — FICTIONAL TRAINING DATA]`
- allowlisted `sourceType`: `ngfw`, `network`, `virtualization`, `identity`, `endpoint`, `change_control`, or `analyst_note`
- fictional timestamp, event ID, asset IDs, summary, and classification tags
- optional correlation IDs that are invented and have no operational meaning

A build-time validation must fail if a record lacks `synthetic: true`, includes a hostname outside `.invalid`, includes an IP outside the three documentation ranges, includes a URL with a network scheme, or contains a disallowed operational-content pattern. Evidence text should favor outcomes such as “management relationship observed” over procedural detail.

## 9. Scoring

Scores are deterministic, explanation-first, and capped at 100 per track. The UI displays category scores and the event ledger so players can understand the rubric. No category awards stealth, persistence duration, destruction, evasion, credential access, or depth of compromise.

### Threat track — 100 points

| Category | Points | Rewarded behavior |
| --- | ---: | --- |
| Trust-boundary reasoning | 30 | Correctly distinguishes reachability, authority, dependency, and evidence visibility; avoids unsupported leaps. |
| Evidence awareness | 25 | Anticipates observable artifacts, references disclosed evidence, and records uncertainty. |
| Minimize unnecessary impact | 25 | Stops when objectives are met, selects narrow symbolic effects, avoids decoy or broad-impact options, and preserves recoverability. |
| Document decisions | 20 | Gives concise rationale, confidence, expected consequence, and evidence exposure. |

Impact never grants points. Unnecessary broad impact subtracts up to 15 points within the impact category but cannot make the total negative. Choosing to stop with a strong rationale remains a valid high-scoring path.

### Defender track — 100 points

| Category | Points | Rewarded behavior |
| --- | ---: | --- |
| Correlation | 20 | Links evidence across at least three relevant source types and orders it correctly. |
| Scope | 15 | Separates confirmed, suspected, and cleared assets/relationships. |
| Preservation | 15 | Bookmarks volatile or decision-relevant evidence before containment and records provenance. |
| Containment | 20 | Applies proportionate symbolic controls in a safe order and considers business impact. |
| Recovery | 15 | Uses known-good markers, validates identity and logging, and defines restoration gates. |
| Communication | 15 | Reports evidence, confidence, gaps, actions, owner, and next update. |

Paired play reports both scores separately plus up to 10 non-competitive “handoff quality” badges for clarity, completeness, and uncertainty labeling. It does not combine them into a winner/loser score.

## 10. Endings

Endings are narrative summaries produced by allowlisted state combinations, not by arbitrary score expressions:

- `measured_guardian`: narrow choices, strong evidence awareness, low unnecessary impact, complete rationale.
- `noisy_siege`: unnecessary symbolic impact or decoy fixation; debrief emphasizes proportionality.
- `evidence_lost`: defender contains before preserving critical evidence; recovery succeeds with reduced confidence.
- `partial_containment`: immediate risk reduced, but a management or identity trust remains unresolved.
- `restored_with_confidence`: evidence preserved, scope supported, proportional containment applied, and recovery gates passed.
- `premature_all_clear`: player restores service while material uncertainty remains undocumented.
- `paired_shared_picture`: handoff and defender findings align on scope while explicitly retaining uncertainty.

No ending celebrates compromise, stealth, disruption, or data access. Every ending includes what the player did well, what evidence was missed, a safer alternative, and a link to replay or debrief.

## 11. Hint behavior

- Hints are optional, progressive, chapter-specific, and available from the keyboard.
- Level 1 restates the objective and relevant evidence source; no score cost.
- Level 2 points to one relationship or filter and deducts 1 point from the applicable reasoning/correlation category.
- Level 3 explains the missing reasoning step, reveals the relevant evidence IDs, and deducts 2 additional points.
- Hints never reveal or describe an exploitation, persistence, evasion, credential, or vendor procedure.
- Hint penalties cannot reduce a category below zero and do not block any ending.
- Reduced-score messaging must avoid shame; the debrief should say exactly what the hint taught.

## 12. Save-state and privacy policy

- Default: session-only save in `sessionStorage`, versioned and scoped to the fictional scenario.
- Optional explicit “Remember on this device” control: stores the same minimal state in `localStorage`; it is off by default.
- No cookies, accounts, analytics, telemetry upload, cloud sync, remote leaderboard, or external request.
- Player rationale text remains on the device. The UI explains this before enabling remembered saves.
- “Reset run” previews exactly which CTF keys will be deleted and requires confirmation. It must not clear unrelated site or browser storage.
- Import is not planned for the first release. Export, if later added for paired handoff, is a downloaded inert JSON summary with a strict schema, no secrets, no HTML, and no scenario answer data; import would require a separate safety review.
- Corrupt, unknown-version, oversized, or non-allowlisted save data fails closed and offers a fresh run.
- Save restoration never navigates to a URL, inserts HTML, selects a target, or changes scenario definitions.

## 13. Accessibility requirements

The CTF inherits all repository requirements and adds the following:

- Complete keyboard operation with logical focus order, visible focus, a skip link, and no keyboard traps.
- Semantic headings, landmarks, lists, tables, buttons, forms, fieldsets, legends, labels, and native dialog behavior where practical.
- Chapter and score changes announced through a concise, non-interrupting status region; critical validation errors receive appropriate focus.
- Topology and timelines have structured HTML equivalents. Meaning never depends on canvas, position, color, icon, line style, audio, or animation alone.
- All relationships and asset states include text labels; palette combinations meet WCAG 2.2 AA contrast targets.
- Filtering reports the number of matching synthetic records and provides a clear-all control.
- Timed decisions are prohibited. Fictional timestamps do not create a countdown.
- Motion is non-essential and respects `prefers-reduced-motion`; optional audio is off by default and has captions/text equivalents.
- The page reflows at 320 CSS pixels without two-dimensional scrolling except genuinely tabular data, which receives an accessible small-screen alternative.
- JavaScript-disabled users can read the premise, topology, safety notice, learning objectives, chapter summaries, and static evidence primer, plus a clear explanation that interactive play requires JavaScript.
- Screen reader checks cover names/roles/values, status announcements, hypothesis errors, filter results, evidence bookmarks, timeline reordering, modal focus return, and ending summaries.
- Timeline reordering supports buttons (“Move earlier/later”) in addition to any pointer interaction.

## 14. Planned file architecture

No runtime file is implemented in this milestone.

```text
ctf.html                       semantic shell, safety notice, static fallback content
css/ctf.css                   CTF layout and components; shared tokens remain in css/style.css
js/ctf/
  app.js                      initialization and top-level view coordination
  state.js                    versioned state factory and field-specific allowlisted reducers
  scenario.js                 bundled-data loading, validation, and ID lookup
  evidence.js                 fixed filtering, inspection, and bookmarking
  scoring.js                  category rubric and auditable score events
  timeline.js                 accessible ordering and annotations
  save.js                     narrowly scoped session/local storage adapter
  views.js                    safe DOM rendering with textContent and element creation
data/ctf/
  scenario.json               chapters, choices, allowlisted transitions, endings
  topology.json               fictional assets and typed relationships
  evidence.json               synthetic telemetry and evidence cards
  rubric.json                 score event IDs, caps, and feedback copy
```

Each page loads only the files it needs. The existing raycaster files remain untouched; a future milestone may add only an optional navigation link. Runtime data remains non-executable JSON. If browser/file-origin constraints make JSON loading unreliable offline, the implementation may use a generated inert data assignment file only after documenting the tradeoff; it must still pass the same schema and content validation and may not contain functions or expressions.

The Mango/retro D&D presentation should frame assets as a keep, evidence as scrolls, bookmarks as the case satchel, and recovery as restoring the realm. Plain security terminology must always accompany the themed label so tone never obscures meaning.

## 15. Milestones and measurable acceptance criteria

Every later milestone is gated by [ctf-safety.md](ctf-safety.md). A milestone is incomplete unless all its criteria pass and the result is recorded in a validation note.

### M1 — Content and data foundation

- All nine required topology assets exist with unique allowlisted IDs, `.invalid` hostnames, and addresses exclusively in `192.0.2.0/24`, `198.51.100.0/24`, or `203.0.113.0/24`.
- Exactly seven ordered Threat Simulation phases exist and each has an objective, at least two evidence cards, at least two safe choices, an exit condition, and progressive hint content; defender recovery content remains a later milestone.
- All telemetry records contain `synthetic: true` and visibly render `[SYNTHETIC — FICTIONAL TRAINING DATA]`.
- Every transition mutates only fields listed in section 7 and references only allowlisted IDs.
- Automated validation reports zero URLs with network schemes, zero non-documentation IPs, zero non-`.invalid` hostnames, zero functions/expressions/HTML in data, and zero prohibited operational-content fixtures.
- Persistence and DC impact appear only as the two abstract markers defined in sections 2 and 7.
- A manual safety review samples 100% of choice and consequence text and finds no executable procedure, real secret, vendor attack command, or edge exploitation content.

### M2 — Semantic shell and visual system

- `ctf.html` loads shared `css/style.css` plus `css/ctf.css`, and does not load raycaster scripts or styles.
- With JavaScript disabled, all static content listed in section 13 remains readable and navigation works.
- At 320×568, 390×844, 768×1024, 1440×900, and 1920×1080, there is no page-level horizontal scrolling and no obscured control.
- All interactive controls have a visible focus style; automated accessibility checks report zero serious or critical issues.
- Normal and forced-colors modes expose asset status and focus without color alone; tested text/control contrast meets WCAG 2.2 AA.
- Reduced-motion mode removes non-essential transitions and contains no flashing content.
- Theme copy always pairs metaphorical names with plain-language roles on first use.

### M3 — Deterministic engine and chapter play

- Fresh runs in each mode begin in the same documented state, and the same ordered choices produce byte-equivalent normalized state and the same ending.
- Only the seven verbs in section 6 appear as player actions; an automated DOM inventory finds zero shell, terminal, command, target, host-entry, URL-entry, authentication, upload, or arbitrary-action controls.
- Attempts to invoke unknown action, choice, transition, field, asset, or evidence IDs are rejected without state mutation.
- All seven Threat Simulation phases are completable by keyboard alone; defender and paired completion criteria apply when those tracks are implemented.
- Branches reconverge at documented chapter boundaries and no valid path dead-ends before an ending or explicit safe stop.
- Player text is length-limited, rendered as text, survives special-character tests, and is never interpreted as HTML or code.
- Browser network inspection during all playthroughs shows zero application-initiated external requests after initial static file load.

### M4 — Evidence workspace, hypotheses, and timeline

- Every evidence view displays the synthetic banner, source type, fictional timestamp, asset, and evidence ID.
- Each allowlisted filter returns the expected fixture count; clear-all restores the complete chapter-visible set.
- Bookmark add/remove is keyboard operable and announced; duplicate evidence IDs cannot enter state.
- Hypotheses require at least one claim, confidence value, scope classification, rationale, and linked evidence item; errors are programmatically associated with fields.
- Timeline ordering supports keyboard buttons and pointer input, announces moves, rejects duplicate/unknown evidence, and yields the same scored order for equivalent timelines.
- A complete defender golden-path fixture correlates at least three source types and receives the documented correlation score; a decoy-only fixture does not receive confirmed-scope credit.

### M5 — Scoring, hints, endings, and debrief

- Automated fixtures cover every scoring event, category cap, hint deduction, penalty floor, and ending predicate.
- Threat fixtures prove that additional impact never increases score and that a well-reasoned stop can achieve at least 85/100.
- Defender fixtures independently exercise correlation, scope, preservation, containment, recovery, and communication.
- Hint levels reveal only their documented content, deduct exactly `0`, `1`, and `2` cumulative points as specified, and never block completion.
- Every ending lists strengths, missed evidence, safer alternative, score ledger, uncertainty, and replay/debrief action.
- No UI string praises stealth, persistence duration, evasion, destructive impact, credential access, or maximum compromise.
- Paired mode keeps track scores separate and reveals cross-perspective material only after the final defender report.

### M6 — Save, reset, and paired handoff

- Default saves exist only under a namespaced session key; local persistence occurs only after explicit opt-in.
- Reset confirmation names the exact CTF keys and deletes only those keys; an automated fixture proves unrelated storage survives.
- Unknown version, malformed JSON, unknown IDs/fields, and over-size saves fail closed without partial restoration.
- Reload at every chapter boundary restores the same normalized state, focus target, bookmarks, hints, score ledger, and timeline.
- No save contains answer keys, executable strings, credentials, browser/environment data, or non-CTF site state.
- If handoff export is implemented, schema validation accepts the golden fixture and rejects HTML, URLs, unknown fields, oversized notes, and scenario-answer data; the export remains inert and local.

### M7 — Full validation and release readiness

- Golden-path, cautious-path, decoy-path, evidence-lost, and premature-restoration playthroughs reach their documented endings in each applicable mode.
- Keyboard, screen-reader smoke, 200% zoom, forced colors, reduced motion, and JavaScript-disabled checks satisfy section 13 with no critical blocker.
- Static analysis finds zero `eval`, `Function` constructor, dynamic script insertion, command execution API, WebSocket, `fetch`, XMLHttpRequest, EventSource, form action to an external origin, or user-controlled navigation.
- Repository-wide content scanning finds no real hostname, non-documentation IP, usable secret, exploit/payload code, credential collection instruction, persistence procedure, evasion instruction, or vendor attack command introduced by the CTF.
- Internal links and HTML validate; existing index, résumé, project case study, and raycaster smoke tests show no regression.
- A clean offline playthrough completes after assets are locally available, with no console errors and no external requests.
- Documentation states that answers are source-visible, the exercise is educational rather than cheat-resistant, data is synthetic, and the edge compromise is assumed.
- Release notes record changed files, test evidence, assumptions, known limitations, and unresolved issues. No commit or deployment is performed as part of implementation unless separately authorized.

## 16. Source framing

Public reporting informs defensive themes only and is not scenario content:

- CISA, [AR25-338A](https://www.cisa.gov/news-events/analysis-reports/ar25-338a)
- Google Threat Intelligence Group/Mandiant, [Another BRICKSTORM: Stealthy Backdoor Enabling Espionage into Tech and Legal Sectors](https://cloud.google.com/blog/topics/threat-intelligence/brickstorm-espionage-campaign)

The fictional topology, characters, evidence, choices, markers, scores, and endings must not be represented as facts from either source.
