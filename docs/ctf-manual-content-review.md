# CTF manual operational-content review

Automated pattern scans are review aids, not safety certification. A human reviewer must inspect every learner-visible scenario, choice, outcome, hint, ending, evidence record, telemetry message, and paired consequence before release. Any unchecked category is a release blocker.

## Review record

- Reviewer: ______________________________
- Review date: ____________________________
- Content revision or commit reviewed: ____________________________
- Files reviewed: `ctf.html`, `data/ctf/scenario.js`, `data/ctf/incident-response.js`, `data/ctf/telemetry.json`, `data/ctf/event-evidence-map.json`, and learner-visible strings in `js/ctf/paired.js`
- Automated review-aid output attached: Yes / No
- Unresolved finding IDs: ____________________________

## Required content checks

- [ ] **Exploit steps:** The edge compromise remains an unexplained premise. No content provides exploitation steps, vulnerable-version matching, parameters, proof-of-concept material, or a reproducible compromise sequence.
- [ ] **Commands:** No learner-visible string contains a runnable command, command fragment, vendor administration sequence, shell prompt, execution shortcut, or ordered instruction that can be transferred to a real system.
- [ ] **Payloads and executable material:** No content contains payload text, scripts, byte sequences, encoded executable material, macros, loaders, droppers, web shells, or executable configuration.
- [ ] **Real identifiers and targets:** All hostnames end in `.invalid`; all addresses use the approved documentation ranges; no real organization, tenant, account, device, public target, URL, filesystem path, service name, or live identifier appears.
- [ ] **Credential material:** No passwords, tokens, cookies, private keys, access keys, usable hashes, session material, credential pairs, or instructions for acquiring identity material appear.
- [ ] **Persistence implementation:** Every persistence reference describes only the harmless abstract marker and its synthetic evidence. No file, path, service, registry location, startup mechanism, scheduled action, maintenance procedure, or implementation sequence appears.
- [ ] **Evasion and anti-forensics advice:** No content advises hiding activity, suppressing or deleting evidence, bypassing controls, disabling monitoring, avoiding detection, falsifying logs, or extending dwell time.
- [ ] **Domain-controller impact:** DC effects remain reversible fictional policy or identity markers. No guest command, identity-operation procedure, snapshot extraction method, credential access, or destructive action appears.
- [ ] **Scoring and narrative incentives:** No score, code, ending, hint, or consequence rewards stealth, evasion, persistence duration, credential access, destruction, or unnecessary impact.
- [ ] **Instructor separation:** No facilitator answer, instructor-only narrative, scoring key, or hidden explanation appears in the learner UI before the final debrief.

## Review-aid triage

Run `tests/validate-ctf.ps1` and inspect every reported operational-language occurrence in context.

- [ ] Each occurrence of command-related language is a prohibition, safety statement, or non-operational explanation.
- [ ] Each occurrence of persistence-related language refers only to abstract state, evidence, scoring, or defensive review.
- [ ] Any new exploit-, payload-, credential-, evasion-, or logging-bypass language has a recorded disposition.
- [ ] False positives are documented by content ID without reproducing unsafe material.

## Disposition

- [ ] Approved for learner release with no unresolved guardrail findings.
- [ ] Blocked pending the following safe rewrite or removal: ____________________________

Reviewer signature: ______________________________

