# CTF safety and content guardrail

Status: normative for all design, content, code, tests, and reviews related to The Mango Keep Incident.

## Common guardrail

> This is a closed, fictional, data-only cybersecurity simulation. It never connects to, scans, authenticates to, or modifies a real device, VM, directory, network, or cloud service. The edge NGFW begins already compromised; its exploitation is never explained or implemented. Threat actions are symbolic scenario choices resolved only through allowlisted state transitions. Persistence and domain-controller impact are harmless abstract markers. All telemetry is visibly synthetic. The application is deterministic, offline-friendly, and contains no shell, arbitrary command execution, target entry, external network calls, `eval`, executable scenario content, usable secrets, or reusable compromise steps.

This guardrail must appear in contributor-facing CTF documentation. A concise player-facing version must appear before a run begins and remain reachable from every chapter.

## 1. Safety invariants

These requirements are release blockers:

1. **Fiction only.** Assets use `.invalid` hostnames and only `192.0.2.0/24`, `198.51.100.0/24`, or `203.0.113.0/24` addresses. Organizations, people, identifiers, and events are invented.
2. **No initial-access content.** The edge NGFW is compromised at state initialization. There is no vulnerable product/version, exploit narrative, payload, request, input, proof of concept, prerequisite, or reproduction path.
3. **No live interaction.** The application performs no scan, probe, login, upload, external request, DNS lookup, socket operation, remote storage, analytics, or target selection.
4. **No execution surface.** There is no shell or terminal facsimile, command field, arbitrary interpreter, `eval`, `Function` constructor, dynamic module/script loading, executable data, macro, template expression, or user-controlled URL/navigation.
5. **No reusable compromise guidance.** Content contains no real exploit code, working payload, credential collection, usable secret, persistence procedure, evasion or anti-forensics instruction, vendor attack command, or ordered compromise recipe.
6. **Symbolic actions only.** Players select fixed IDs. Reducers apply field-specific allowlisted changes. Unknown actions, IDs, fields, and values fail closed.
7. **Abstract sensitive effects.** Persistence is only `persistence_marker_present: true|false`. DC impact is only `dc_snapshot_exposure_marker: none|suspected|abstract_exposure_confirmed`. These markers have no mapping to a real mechanism.
8. **Synthetic evidence.** Every telemetry record has `synthetic: true` and visibly displays `[SYNTHETIC — FICTIONAL TRAINING DATA]`. A record without both is invalid.
9. **No stealth incentive.** Scoring never rewards stealth, dwell time, evasion, deletion, reduced logging, persistence duration, destructive impact, credential access, or reaching a deeper target.
10. **Proportionate learning goals.** Threat scoring rewards trust-boundary reasoning, evidence awareness, minimizing unnecessary impact, and documentation. Defender scoring rewards correlation, scope, preservation, containment, recovery, and communication.
11. **Local and deterministic.** Identical initial state and choices produce identical state, evidence, scores, and endings. No wall clock, randomness, device fingerprint, network response, or external state changes gameplay.
12. **Static-site honesty.** Source-visible answers are disclosed. The CTF is educational, not cheat-resistant, competitive, accredited, or suitable for high-stakes assessment.

## 2. Allowed content

Allowed content remains descriptive and outcome-oriented:

- Fictional asset inventories, trust diagrams, business context, and change-control records.
- Synthetic event summaries using invented identifiers and documentation addresses.
- High-level observations such as “an unexpected management relationship was observed.”
- Defensive reasoning about evidence sources, scope, preservation order, proportional containment, recovery gates, and communication.
- Symbolic scenario choices such as “inspect the management relationship,” “preserve the synthetic audit bundle,” “suspend the abstract trust,” or “stop and document uncertainty.”
- Abstract state labels such as `suspected`, `affected`, `contained`, `restored`, and the two sensitive-effect markers.
- Explanations of why evidence supports or fails to support a conclusion.

References to real platforms may appear only as audience context in documentation. Player-facing content should use the fictional “Orchard Crown” vCenter-like service and “Keep Hypervisor” ESXi host labels, with plain role descriptions. It must not reproduce vendor procedures or attack commands.

## 3. Prohibited content and controls

Do not include:

- Any method for exploiting the edge NGFW or any other asset.
- Real CVE walkthroughs, vulnerable version matching, proof-of-concept material, or exploit parameters.
- Commands, command fragments, scripts, byte sequences, encoded payloads, web shells, malware, droppers, loaders, or runnable configuration.
- Credential names paired with passwords, tokens, cookies, keys, hashes, session material, or instructions to acquire them.
- Filesystem paths, service/unit names, startup locations, registry paths, scheduled-task recipes, or other persistence implementation details.
- Instructions for disabling, deleting, suppressing, falsifying, or bypassing logging, security tools, authentication, or monitoring.
- Vendor UI sequences or API calls that could enable remote administration, privileged access, VM cloning, snapshot extraction, account changes, or service changes.
- Real public/private targets, domains, IPs outside the documentation ranges, URL shorteners, wildcard DNS names, or user-entered host/IP/domain fields.
- `fetch`, XMLHttpRequest, WebSocket, EventSource, WebRTC data channels, beacon APIs, external forms, remote fonts/assets, analytics, or dynamic imports from a URL.
- Shell-themed free text, a faux prompt, autocomplete of commands, keyboard shortcuts that resemble execution, or “run”/“execute” labels.
- HTML-capable scenario strings, Markdown rendering of player text, template expressions, JavaScript URLs, data URLs, object-path mutation, or code evaluated from JSON.
- Upload controls. A future handoff import requires a separate design and safety review before implementation.

When an educational point seems to require prohibited detail, replace it with an abstract outcome, evidence relationship, or defensive question. If that loses the learning objective, omit the content and record the gap rather than weakening the guardrail.

## 4. Safe implementation rules

### Data boundary

- Scenario files are inert, bundled, same-origin data and contain no functions, expressions, markup, CSS, selectors, URLs, paths, or executable strings.
- Parse against a strict schema and reject unknown properties. Enforce size, count, string-length, enum, and referential-integrity limits.
- Require every transition to reference a compiled allowlist entry. Transition effects are declarative values passed to field-specific reducers; never accept a property path from data.
- Freeze validated scenario definitions where practical. Gameplay state is separate from source definitions.
- Do not derive inner HTML, event-handler attributes, styles, links, script names, module names, or storage keys from scenario or player content.

### Rendering boundary

- Create DOM elements explicitly and assign untrusted text with `textContent` or form values.
- Do not use `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, unsafe Markdown rendering, or template compilation for scenario/player content.
- Fixed internal navigation uses authored relative links only. Scenario data cannot create links.
- Player rationales and timeline notes are inert local text, capped at 500 characters each and bounded in count.

### Action boundary

- The UI exposes exactly seven semantic verbs: inspect, choose, filter logs, bookmark evidence, submit hypothesis, contain, and build timeline.
- Event handlers map a fixed UI action to a fixed reducer. They do not dispatch by evaluating a string or dynamically resolving a global function.
- A rejected action produces a safe error and no partial mutation.
- Containment and recovery update only abstract state. They never invoke browser, operating-system, network, clipboard, authentication, or device APIs.

### Storage boundary

- Use a fixed CTF namespace. Session storage is default; local storage requires explicit opt-in.
- Validate restored state as strictly as fresh input. Reject unknown versions and IDs, oversize content, prototype-related keys, and impossible transitions.
- Reset only explicit CTF keys after confirmation. Never clear all origin storage.
- Store no secrets, personal data, device data, real timestamps, analytics identifiers, or answer keys.

### Network boundary

- All CTF assets ship locally. Do not add remote fonts, images, scripts, styles, embeds, trackers, source maps, or APIs.
- The app initiates no runtime external request. Development preview may serve local static files but must not proxy or contact targets.
- A Content Security Policy should be planned for static deployment: disallow object/embed/base behavior and network connections, and allow scripts/styles/images only as narrowly as the existing site architecture permits. Exact policy belongs to the implementation security review.

## 5. Content review rubric

Review every player-visible and data string before release. For each item, answer:

1. Is it visibly fictional and, if telemetry, visibly synthetic?
2. Does it use only approved names and documentation addresses?
3. Does it state an observation, choice, or consequence without teaching a mechanism?
4. Could a reader transfer it into a real command, request, payload, credential workflow, persistence method, evasion method, or vendor attack sequence? If yes, reject it.
5. Does it imply that deeper access, stealth, disruption, or evidence suppression is desirable? If yes, rewrite or reject it.
6. Does it reward reasoning, evidence awareness, proportionality, preservation, recovery, or communication?
7. Can it be rendered as inert text and resolved through an allowlisted transition?
8. Does it preserve the distinction among premise, observation, inference, and confirmed state?

Ambiguous content fails review until rewritten. Safety review notes should cite the content ID, reviewer decision, and replacement rationale without restating prohibited operational detail.

## 6. Automated safety gates

Later implementation must include a repeatable validator that fails on:

- missing or false synthetic markers;
- hostnames not ending in `.invalid`;
- IP literals outside the three documentation ranges;
- network-scheme URLs, remote asset references, or external form actions;
- unknown schema fields, IDs, transition targets, state fields, or enum values;
- HTML/script-like markup, event-handler attributes, template expressions, or executable data types;
- disallowed browser/network/execution APIs in CTF code;
- sensitive-effect language or fields other than the two approved markers;
- score events related to stealth, evasion, dwell, destruction, credential acquisition, persistence duration, or compromise depth;
- prohibited operational-content terms/patterns, followed by mandatory human review to handle context and false positives.

Pattern scanning supplements human review; it does not certify safety by itself. Test fixtures designed to trigger gates must use harmless placeholders and must not embed real exploit or persistence content.

## 7. Threat model for the static application

| Risk | Required control | Verification |
| --- | --- | --- |
| Scenario data interpreted as code | Strict inert schema; field-specific reducers; no evaluation or dynamic loading | Invalid-action and executable-string fixtures fail closed |
| Player text becomes markup/script | Length limits; `textContent`; no Markdown/HTML renderer | Special-character and common injection-string tests render literally |
| Data causes external contact | No URL-bearing fields; local assets; connect-denying policy where deployable | Browser network log shows no external requests |
| Save-state tampering unlocks arbitrary behavior | Full validation, allowlisted IDs, versioning, impossible-state rejection | Mutated/corrupt saves do not partially restore |
| Fiction mistaken for real telemetry | Required structured flag and persistent visible banner | 100% record assertion plus UI snapshot review |
| Source exposes answers | Explicit educational-use disclosure; no competitive claims | Disclosure present before play and in debrief |
| Theme hides security meaning | Plain-language role/state paired with themed labels | Content review and screen-reader inspection |
| Overbroad reset harms unrelated data | Exact key list and confirmation | Unrelated-storage preservation test |

## 8. Safety acceptance criteria by implementation milestone

These criteria complement the product acceptance criteria in [ctf-spec.md](ctf-spec.md) and are measurable release gates.

### Data/content milestone

- 100% of telemetry records pass the synthetic marker assertion.
- 100% of hostnames and IP literals pass the fictional-address validator.
- 100% of choice, consequence, hint, ending, and evidence strings receive recorded manual review.
- Zero scenario fields can contain code, markup, URLs, filesystem paths, credentials, or reducer property paths.
- Exactly two sensitive-effect fields exist, with exactly the approved values.

### UI/engine milestone

- DOM inspection finds only the seven allowed player verbs and zero command/target/authentication/upload controls.
- Static analysis finds zero evaluation, command execution, dynamic script, remote request, user-controlled navigation, or unsafe HTML-rendering API in `js/ctf/`.
- Fuzzing unknown IDs/fields/actions produces zero state changes and zero uncaught exceptions.
- Special characters in every player text field render literally in all views and restored saves.

### Save/paired milestone

- Storage tests demonstrate CTF namespace isolation and preserve unrelated keys on reset.
- Corrupt, oversize, unknown-version, and unknown-field states fail closed in 100% of fixtures.
- Any handoff export contains only approved IDs, abstract markers, score-free rationale summaries, and bounded inert notes; it contains zero answer keys or operational detail.

### Release milestone

- A repository scan reports zero real targets, non-documentation IPs, usable secrets, exploit/payload code, credential collection, persistence procedures, evasion instructions, or vendor attack commands introduced by CTF files.
- Browser inspection across all modes reports zero application-initiated external network requests.
- Manual playthrough confirms the NGFW compromise is only an initial premise and cannot be selected, expanded, or explained.
- Threat scoring regression tests prove that stealth and added impact yield zero reward.
- A named reviewer signs off the full content inventory and unresolved findings are either fixed or listed as release blockers.

## 9. Incident response for a guardrail failure

If prohibited content or behavior is found during development:

1. Stop the affected milestone and mark it blocked from release.
2. Remove the content or disable the path using a reversible repository edit; do not exercise or elaborate the prohibited behavior.
3. Search the CTF file set for related instances using non-executing text inspection.
4. Add a harmless regression fixture that detects the category without preserving the unsafe detail.
5. Re-run all automated gates and complete manual content review for the affected chapter/component.
6. Record the affected content IDs/files, the guardrail category, the safe remediation, and any remaining limitation.

Do not connect to a system or reproduce real-world behavior to validate a fix.

## 10. Contributor and release checklist

- [ ] The common guardrail is present and unchanged in meaning.
- [ ] Only fictional `.invalid` hosts and documentation addresses are present.
- [ ] Every telemetry record is visibly marked synthetic.
- [ ] The edge compromise remains an unexplained starting premise.
- [ ] Persistence and DC impact use only approved abstract markers.
- [ ] Choices and transitions are allowlisted, deterministic, and data-only.
- [ ] No prohibited content, execution surface, target entry, or external request exists.
- [ ] Scoring rewards the defined reasoning and response categories and never rewards stealth.
- [ ] Accessibility and non-JavaScript content meet the repository baseline.
- [ ] Source-visible answers and educational-only limitations are disclosed.
- [ ] Validation evidence, assumptions, changed files, and remaining issues are documented.
- [ ] No commit or deployment occurs without separate authorization.
