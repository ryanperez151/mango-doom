# CTF synthetic telemetry pack

The Mango Keep telemetry pack is a deterministic, offline set of fictional training records for the validated scenario. It follows the common guardrail in [ctf-safety.md](ctf-safety.md). It contains no command lines, executable contents, paths, API calls, usable hashes, tokens, credentials, real targets, or real network interaction.

## Contents

- `data/ctf/telemetry.json` contains 144 normalized events across 12 datasets.
- `data/ctf/evidence-manifest.json` maps 10 major findings to primary, corroborating, and optional benign-distractor events.
- `tests/validate-ctf-telemetry.ps1` performs dependency-free schema, safety, ordering, reference, and identifier-consistency checks.

The pack contains 94 benign events and 50 scenario signals, making benign background activity 65.3% of the timeline. Every record is marked `synthetic: true`. Events are stored in normalized timestamp order from `2088-03-14T09:00:00Z` through `2088-03-14T10:11:30Z`.

## Datasets

- `ngfw.audit`
- `ngfw.config`
- `identity.auth`
- `network.flow`
- `esxi.auth`
- `esxi.host-management`
- `vcenter.tasks`
- `vm.lifecycle`
- `windows.security`
- `edr.alert`
- `dns.query`
- `case.change-record`

Every event contains the required normalized fields: `event_id`, `timestamp`, `scenario_stage`, `synthetic`, `dataset`, `hostname`, `actor_alias`, `action`, `outcome`, `source_ip`, `destination_ip`, `severity`, `session_id`, `task_id`, `vm_id`, `correlation_id`, `node_refs`, and `message`. The additional `activity_class` and `finding_role` fields make the benign ratio and evidence role independently testable.

## Shared UTC timeline and clock skew

All packaged timestamps use UTC and include a trailing `Z`. Two fictional sources intentionally model source-clock skew:

- `keep-esx.mangokeep.invalid` was 90 seconds ahead.
- `grove-dc.mangokeep.invalid` was 30 seconds behind.

Those offsets are metadata only. They were removed before packaging, so event timestamps are already normalized and globally ordered. No consumer should apply the offsets again.

## Evidence design

Each manifest artifact has at least one primary signal and one corroborating signal from a different dataset. Most also include one plausible benign distractor. Shared correlation IDs connect supporting records without embedding secrets or operational details.

The ten findings cover:

1. Edge premise and appliance visibility.
2. Management trust-path reasoning.
3. Symbolic hypervisor management transition.
4. Unexpected conceptual host-management state.
5. Domain-controller and decoy classification.
6. Harmless abstract persistence marker.
7. Reversible abstract DC-impact marker.
8. Fictional management-zone DNS pattern.
9. Containment-boundary change.
10. Recovery and debrief documentation.

## Run validation

From the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests\validate-ctf-telemetry.ps1
```

The validator reads local files only. It checks:

- event and artifact ID uniqueness;
- required fields and dataset coverage;
- normalized UTC timestamp ordering;
- synthetic markers and the approximate 65% benign ratio;
- `.invalid` hostnames and documentation-only addresses;
- dangling event and scenario-node references;
- primary and cross-source corroborating evidence;
- benign distractor classification;
- session, task, VM, and correlation consistency;
- prohibited URL, markup, and operational-message patterns.
