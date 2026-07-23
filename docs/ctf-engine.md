# CTF data contracts and deterministic engine

This implementation applies the common guardrail from [ctf-safety.md](ctf-safety.md). It contains a complete 24-node Threat Simulation campaign, a linked 13-node Incident Response campaign, and the standalone `ctf.html` experience.

## Files

- `data/ctf/scenario.js` contains inert scenario objects. They use scalar values, arrays, and plain objects only—no callbacks, expressions, HTML, URLs, commands, credentials, or procedures.
- `data/ctf/incident-response.js` contains the linked evidence-led defender campaign, including high-confidence dependencies, proportionate containment choices, recovery, and handoff endings.
- `data/ctf/telemetry.js` is an offline ES-module wrapper around the validated 144-event JSON telemetry pack; the records are unchanged.
- `data/ctf/event-evidence-map.json` links every learner evidence ID to synthetic event IDs and learner node IDs.
- `js/ctf/contracts.js` validates schema versions, exact object fields, IDs, references, fictional hosts and addresses, visibly synthetic evidence, prerequisites, effects, and save-state shapes.
- `js/ctf/state.js` provides pure deterministic operations: `startScenario`, `getCurrentNode`, `getAvailableChoices`, `applyChoice`, `getVisibleEvidence`, `serializeState`, and `restoreState`.
- `js/ctf/storage.js` validates versioned local UI saves before localStorage write or deterministic engine replay.
- `js/ctf/app.js` renders choices, evidence, filters, bookmarks, notes, assets, scores, codes, paired handoff, and debrief without network requests or executable content.
- `ctf.html` and `css/ctf.css` provide the semantic, keyboard-operable, responsive player experience.
- `tests/ctf-engine.html` and `tests/ctf-engine.test.js` provide a dependency-free browser test harness.
- `tests/run-ctf-playthroughs.mjs` audits the six required release routes and their evidence, chronology, scores, saves, and endings.
- `tests/run-site-browser-smoke.mjs` performs the loopback-only 320 CSS-pixel, keyboard, save/resume, portfolio, and raycaster smoke check on Windows Chrome.
- `tests/validate-ctf.ps1` runs the static telemetry, mapping, content, and runtime-safety checks.

All CTF JavaScript files are ES modules. They do not create globals, and `ctf.html` loads only its dedicated module entry point.

## Run validation

From the repository root, start the same local static preview described in the main README:

```powershell
.\tests\validate-ctf.ps1
```

Then start the same local static preview described in the main README:

```powershell
py -m http.server 8000
```

Open `http://localhost:8000/tests/ctf-engine.html` in a browser. A successful run reports `42 passed, 0 failed` and changes the page title to `PASS — CTF engine validation`.

When a local Node.js runtime is already available, the same test module can run without a browser or added packages:

```powershell
node .\tests\run-ctf-engine.mjs
node .\tests\run-ctf-playthroughs.mjs
node .\tests\run-site-browser-smoke.mjs
```

The browser page remains the canonical compatibility check for the static site; the Node host supplies only the result-reporting DOM and localStorage shims needed by the shared tests.

The harness has no packages, build step, test framework, external assets, or application-initiated network calls. The local server is needed only because browsers intentionally restrict ES-module imports from `file:` pages.

## Contract behavior

- Objects use exact keys; unknown fields are rejected.
- Scenario and evidence schema versions must match the engine's supported version.
- Assets require `.invalid` hostnames and documentation-range addresses.
- Every evidence and telemetry record requires `synthetic: true` and the visible synthetic label.
- Prerequisites and effects use fixed discriminated object shapes and allowlisted IDs.
- Effect reducers update only named state fields; scenario data cannot supply property paths.
- Unknown effects, unavailable choices, broken references, malformed JSON, obsolete saves, oversized saves, and impossible/tampered states throw `CtfContractError` before returning a new state.
- Restore validates a save, replays its choice history from a clean state, and accepts it only if the reconstructed state is identical.
- Operations do not mutate the scenario, evidence catalog, or input state.
- Graph validation rejects unreachable nodes, fully gated nonterminal dead ends, and endings with no reachable choice.
- Learner content rejects instructor-only labels, and every threat action requires a synthetic defender-observable event effect.
- Operational-language pattern results require completion of [ctf-manual-content-review.md](ctf-manual-content-review.md); the scan is not a substitute for human review.

## Deliberate limitations

The static application supports local notes and timeline construction through bookmarks, but it has no accounts, remote collaboration, backend, leaderboard, or competitive-score integrity. Paired mode is a same-device handoff. Source-visible scenario logic makes the experience educational rather than cheat-resistant.

Scenario content is an ES-module data assignment instead of JSON so the same dependency-free browser harness can import it without runtime fetching. The exported values remain inert plain data and pass the same strict validation expected of future bundled scenario data. Production content format remains a later milestone decision under the specification's offline constraint.
