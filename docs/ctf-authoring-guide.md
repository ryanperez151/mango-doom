# Mango Keep authoring guide

The CTF is a vanilla HTML/CSS/JavaScript static application. Scenario modules are inert data, the engine is pure and deterministic, and the page controller is an ES module scoped to `ctf.html`. Preserve that separation. Do not add dependencies, callbacks in content, executable expressions, target entry, external requests, or changes to the raycaster.

The normative boundaries are [ctf-spec.md](ctf-spec.md) and [ctf-safety.md](ctf-safety.md). When documents differ, the safer interpretation wins.

## File responsibilities

- `ctf.html` provides semantic controls, persistent safety labeling, panels, and the reset dialog.
- `css/ctf.css` owns only the CTF layout and state presentation; shared tokens and focus styles remain in `css/style.css`.
- `js/ctf/contracts.js` validates exact schemas, inert values, references, graph reachability, and allowed effects.
- `js/ctf/state.js` implements pure start, query, transition, serialization, and restore operations.
- `js/ctf/storage.js` validates the versioned UI envelope and touches only the fixed CTF storage key.
- `js/ctf/timeline.js` performs pure allowlisted filtering.
- `js/ctf/paired.js` derives the bounded cross-perspective consequence.
- `js/ctf/app.js` renders with DOM text properties and maps semantic controls to engine operations.
- `data/ctf/scenario.js` and `incident-response.js` contain learner campaigns.
- `data/ctf/telemetry.json` is the canonical telemetry pack; `telemetry.js` is its exact static module wrapper.
- `data/ctf/evidence-manifest.json` and `event-evidence-map.json` connect artifacts, evidence, events, and learner nodes.

## Authoring a node and choice

Use unique lower-case IDs accepted by the contract. A node belongs to one existing chapter and perspective, lists its evidence and hints by ID, and supplies two or three bounded choices where practical. Every nonterminal node must have at least one unconditional recovery choice so malformed or incomplete state cannot create a dead end. Branches should reconverge after the intended lesson.

Each choice must state:

- a learner-facing objective;
- a plain-language prerequisite summary;
- structured prerequisites using only the supported prerequisite types;
- an outcome that describes what the fictional simulation records, not how an action would be implemented;
- a learning consequence;
- an allowlisted next node or ending;
- declared synthetic event IDs for each major threat action;
- effects drawn only from the engine allowlist.

Supported effects are `setFlag`, `unlockEvidence`, `incrementMetric`, `updateAssetState`, `setContainmentStatus`, and `emitEvents`. Never add a property-path effect, callback, function, URL, selector, markup string, or expression. Unknown effects must continue to fail closed.

Prerequisites may check an allowlisted flag/value, minimum metric, unlocked evidence ID, asset state, containment state, or prior choice. Do not hide the reason a choice is unavailable; the learner UI displays the authored summary.

## Evidence and telemetry

Every telemetry record must set `synthetic: true`, use one shared UTC chronology, and include all normalized fields. Hostnames must end in `.invalid`; addresses must stay in `192.0.2.0/24`, `198.51.100.0/24`, or `203.0.113.0/24`. Messages remain conceptual and contain no command lines, executable contents, secrets, real identifiers, or implementation detail.

For each major finding, provide a primary event and corroboration from a different dataset. A plausible benign distractor is optional. Add or update the evidence manifest and event-to-evidence map in the same change. Every mapped event, evidence ID, and learner node must exist; every evidence record must be mapped.

Threat actions that change fictional asset state, elapsed time, evidence footprint, persistence markers, DC markers, or containment consequences must emit defender-visible synthetic events. Scoring should reward reasoning and documentation; added impact or noise must not produce a better result merely because it reaches deeper state.

## Safe language review

Keep the edge compromise as a premise and describe only objectives, observations, outcomes, evidence relationships, and recovery decisions. Persistence and DC impact use harmless abstract markers. Do not author real exploit details, commands, payloads, credentials, reusable administration steps, persistence mechanisms, evasion advice, vendor sequences, real paths, CVEs, API calls, usable hashes, tokens, or secrets.

The automated operational-content scan is only a review aid. A human must complete [ctf-manual-content-review.md](ctf-manual-content-review.md) for every learner-visible revision. Automated success does not certify prose safety.

Do not add instructor-only strings to learner data or UI. The public facilitator guide contains only a blank template. Completed answers must remain outside the deployed site and public repository.

## Validation workflow

From the repository root:

```powershell
.\tests\validate-ctf.ps1
node .\tests\run-ctf-engine.mjs
node .\tests\run-ctf-playthroughs.mjs
node .\tests\run-site-browser-smoke.mjs
```

The first command validates telemetry, mappings, safety patterns, inert runtime behavior, fictional identifiers, and source parity. The engine suite covers contracts, references, effects, graph reachability, saves, replay, evidence, filtering, and perspective paths. The route audit plays the six release paths. The Windows browser smoke requires Chrome in its standard installation path and checks the CTF at 320 CSS pixels, keyboard/dialog focus, save/resume, portfolio load, raycaster initialization, script errors, and non-loopback requests.

Also open `tests/ctf-engine.html` from a local static server to run the engine suite in the target browser. Inspect the responsive layout at additional widths and with assistive technology when available. Record commands, results, assumptions, and limitations in `docs/ctf-release-audit.md`.

## Change checklist

- [ ] Content remains fictional, inert, deterministic, and offline-friendly.
- [ ] The NGFW begins compromised and no initial-access mechanism appears.
- [ ] IDs are unique; references resolve; nodes and endings are reachable; nonterminals have recovery choices.
- [ ] Every major threat choice declares defender-visible events.
- [ ] Evidence is revealed only when its dependency is met and supports the conclusion shown.
- [ ] Scores favor the documented learning dimensions and never stealth or unnecessary harm.
- [ ] Save schema/version changes intentionally reject obsolete saves.
- [ ] All controls remain keyboard operable, visibly focused, and usable at 320 CSS pixels.
- [ ] No completed answer key or instructor-only narrative is deployed.
- [ ] Automated validation passes and manual content review is signed.
- [ ] No commit or deployment occurs without separate authorization.
