# Threat Simulation campaign content

The complete Mango Keep Threat Simulation uses only the symbolic, deterministic reducers documented in [ctf-engine.md](ctf-engine.md). It remains governed by the common guardrail in [ctf-safety.md](ctf-safety.md).

## Action contract

Every authored threat action contains:

- an objective;
- a plain-language prerequisite summary plus structured allowlisted prerequisites;
- a conceptual outcome that explicitly excludes an implementation mechanism;
- a learning-focused consequence;
- one or more defender-visible synthetic event IDs;
- an allowlisted asset-state update;
- a positive deterministic `elapsed_minutes` increment;
- a positive `evidence_footprint` increment;
- an optional educational evidence-code award.

No action accepts player commands or target input. All effects use the existing `setFlag`, `unlockEvidence`, `incrementMetric`, `updateAssetState`, `setContainmentStatus`, and `emitEvents` reducers.

## Campaign coverage

The 23-node threat path lets the player inspect the fictional topology, examine a sanitized trust clue, attempt a symbolic management transition, query VM roles, interact with a decoy, request a harmless VM marker operation, select an abstract persistence marker, cause a reversible directory-policy marker, observe containment, and end or document the operation.

Poor choices enter bounded correction nodes and reconverge after the lesson. If the player retains uncertainty or severe abstract impact, the campaign still offers a partial or severe-impact debrief ending rather than a dead end.

## Evidence codes

Evidence codes are fixed, source-visible educational acknowledgements. They are awarded by boolean state transitions for correct reasoning or completion, never by entering commands:

- `MANGO-EDGE-REASON`
- `MANGO-TRUST-MAP`
- `MANGO-MGMT-BOUND`
- `MANGO-VM-ROLES`
- `MANGO-MARKER-NOTE`
- `MANGO-DIR-RESTRAINT`
- `MANGO-CONTAINMENT`

They are not secrets, credentials, competitive flags, or proof of certification. The static-site source-visible-answer limitation still applies.
