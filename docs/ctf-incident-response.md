# Incident Response campaign

This campaign is the defender-side companion to the Mango Keep Threat Simulation. It applies the common guardrail in [ctf-safety.md](ctf-safety.md): all content is fictional, deterministic, synthetic, data-only, and offline. It contains no command input, executable scenario content, target entry, external request, credential, exploit, payload, or implementation procedure.

The campaign is exported from `data/ctf/incident-response.js` as a standalone validated scenario for the existing pure state engine. Its small Threat Simulation perspective is only a terminal link back to the complete companion campaign; it does not duplicate or extend threat actions.

## Investigation model

The defender begins with exactly one visible artifact: `ir_initial_edge_alert`. Later evidence appears only when an investigation choice unlocks it. A high-confidence finding is unavailable until all its prerequisites are visible.

| Finding | Required primary signal | Required corroboration |
| --- | --- | --- |
| Edge compromise | Unusual edge administration session | Unauthorized abstract configuration change |
| ESXi movement | Correlated network-flow summary | Abnormal ESXi authentication context |
| Abstract persistence | Configuration or service-state marker | Simulated restart-survival observation |
| Hosted DC VM access | vCenter-like task record | Sanitized VM UUID-to-role mapping |
| Reversible DC impact | Synthetic guest-operation record | Synthetic identity-change record |
| Wider scope | Shared endpoint indicator | Related identity activity from an additional source |

Each investigation stage provides three categories of decision:

- **High-value** choices preserve and correlate the complete evidence dependency. They set the corresponding confirmed finding and unlock the next evidence pair.
- **Incomplete** choices preserve a reasonable subset, retain an explicit uncertainty, and continue with fewer later high-confidence choices available.
- **Premature** choices model broad conclusions or response actions. Their text records the preservation and business tradeoff; they never block the debrief or replay path.

Every stage states an alternative hypothesis in the node text and revisits it in the choice consequence. Examples include approved maintenance, ordinary management traffic, baseline drift, a noncritical VM mapping, an approved policy test, and benign background activity.

## Preservation and containment

The containment stage separates three defensible lessons:

- Targeted urgent containment becomes available after the paired DC-impact evidence sets `ongoing_harm_clear`. It preserves essential evidence, scopes affected trust boundaries, records moderate fictional business impact, and awards positive preservation and containment points. It is not penalized.
- Preservation-first remains available when harm is not established, but records that containment is incomplete.
- Broad premature isolation records evidence loss and high fictional business impact while still allowing closeout.

Evidence loss is represented only by a harmless Boolean flag and by evidence that was never unlocked. Records are never deleted or modified.

## Closeout

The final five stages cover targeted containment, cross-source UTC timeline reconstruction, confidence-based scope assessment, abstract-marker eradication and recovery validation, and a short incident handoff. The complete handoff includes:

- timeline and confidence;
- confirmed, suspected, and unaffected scope;
- preservation and containment decisions;
- abstract eradication and recovery validation;
- business effects and remaining uncertainty.

The `MANGO-IR-EVIDENCE` evidence code is awarded only after the required reasoning and state transitions reach validated recovery. No player-entered command or answer string exists. Partial and evidence-limited endings identify open work and provide a safe debrief or replay path.

## Deterministic scoring

The campaign uses the defender metrics defined in [ctf-spec.md](ctf-spec.md): `correlation`, `scope`, `preservation`, `containment`, `recovery`, and `communication`. `elapsed_minutes` and `evidence_footprint` remain compatible with the shared engine and linked threat node. Scores reward defensible evidence use, proportionate response, recovery proof, and communication; they do not reward stealth.

## Validation

Use the dependency-free browser harness described in [ctf-engine.md](ctf-engine.md). The Incident Response tests verify:

- strict scenario-contract validation;
- initial-alert-only visibility;
- all six evidence dependency pairs;
- three decision categories at every defender stage;
- deterministic completion of the high-confidence path;
- positive scoring for urgent containment after clear ongoing harm;
- deterministic arrival at an evidence-limited debrief after premature choices.

Because this is a static site, scenario choices, prerequisites, evidence codes, and endings are source-visible. The campaign is educational rather than cheat-resistant.
