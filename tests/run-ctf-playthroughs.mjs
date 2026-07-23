// Release playthrough audit for the five requested routes plus Paired Mode.
// This script uses only bundled inert data and pure state operations.

import { readFileSync } from "node:fs";
import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { mangoKeepEvidence, mangoKeepScenario } from "../data/ctf/scenario.js";
import { mangoKeepIncidentEvidence, mangoKeepIncidentScenario } from "../data/ctf/incident-response.js";
import { mangoKeepTelemetry } from "../data/ctf/telemetry.js";
import {
  applyChoice,
  getAvailableChoices,
  getVisibleEvidence,
  restoreState,
  serializeState,
  startScenario,
} from "../js/ctf/state.js";
import { getPairedConsequence } from "../js/ctf/paired.js";

const eventEvidenceMap = JSON.parse(readFileSync(new URL("../data/ctf/event-evidence-map.json", import.meta.url), "utf8"));
const mappedEvidenceIds = new Set(eventEvidenceMap.mappings.map((mapping) => mapping.evidence_id));
const telemetryEventIds = new Set(mangoKeepTelemetry.events.map((event) => event.event_id));

const routes = {
  threatSuccessful: [
    "p1_inspect_premise", "p1_document_premise", "p2_compare_typed_trust", "p2_record_management_path",
    "p3_attempt_symbolic_transition", "p3_document_transition_event", "p4_inspect_role_labels",
    "p4_classify_dc_and_decoy", "p4_document_inventory", "p5_select_durable_role",
    "p5_document_marker_evidence", "p5_confirm_abstract_only", "p6_set_policy_marker",
    "p6_document_reversibility", "p7_inspect_consequences", "p7_end_well_contained",
  ],
  threatNoisy: [
    "p1_assume_broad_trust", "p1_record_uncertainty", "p1_carry_visible_gap",
    "p2_follow_reachability_only", "p2_mark_path_uncertain", "p2_record_low_confidence_path",
    "p3_claim_full_asset_control", "p3_keep_scope_unresolved", "p3_document_transition_gap",
    "p4_follow_loud_decoy", "p4_mark_inventory_ambiguous", "p4_preserve_role_uncertainty",
    "p4_document_decoy_risk", "p5_select_service_state", "p5_skip_marker_correlation",
    "p5_carry_marker_gap", "p5_note_marker_reversible", "p6_set_broad_identity_marker",
    "p6_retain_for_debrief", "p6_document_impact_gap", "p7_assume_edge_isolation_complete",
    "p7_retain_partial_scope", "p7_end_severe",
  ],
  irStrong: [
    "ir_triage_high", "ir_edge_high", "ir_esxi_high", "ir_persistence_high", "ir_dc_access_high",
    "ir_dc_impact_high", "ir_scope_high", "ir_contain_urgent", "ir_timeline_high",
    "ir_final_scope_high", "ir_recovery_high", "ir_handoff_high",
  ],
  irPremature: [
    "ir_triage_premature", "ir_edge_premature", "ir_esxi_premature", "ir_persistence_premature",
    "ir_dc_access_premature", "ir_dc_impact_premature", "ir_scope_premature", "ir_contain_broad",
    "ir_timeline_premature", "ir_final_scope_premature", "ir_recovery_premature", "ir_handoff_lost",
  ],
  irDelayed: [
    "ir_triage_high", "ir_edge_high", "ir_esxi_high", "ir_persistence_high", "ir_dc_access_high",
    "ir_dc_impact_high", "ir_scope_high", "ir_preserve_first", "ir_timeline_high",
    "ir_final_scope_high", "ir_recovery_incomplete", "ir_handoff_partial",
  ],
};

function assertChronological(records, label) {
  let previous = "";
  records.forEach((record) => {
    ok(record.timestamp >= previous, `${label}: visible evidence is not chronological at ${record.id}`);
    previous = record.timestamp;
  });
}

function playRoute(label, scenario, evidence, perspective, choiceIds) {
  let state = startScenario(scenario, evidence, perspective);
  const evidenceSeen = new Set();
  choiceIds.forEach((choiceId) => {
    const visible = getVisibleEvidence(scenario, evidence, state);
    assertChronological(visible, label);
    visible.forEach((record) => {
      evidenceSeen.add(record.id);
      ok(mappedEvidenceIds.has(record.id), `${label}: ${record.id} lacks an event mapping`);
    });
    const available = getAvailableChoices(scenario, evidence, state);
    const choice = available.find((item) => item.id === choiceId);
    ok(choice, `${label}: ${choiceId} is unavailable at ${state.currentNodeId}`);
    choice.prerequisites.filter((item) => item.type === "evidenceUnlocked").forEach((prerequisite) => {
      ok(state.unlockedEvidenceIds.includes(prerequisite.evidenceId), `${label}: ${choiceId} lacks visible evidence ${prerequisite.evidenceId}`);
    });
    state = applyChoice(scenario, evidence, state, choiceId);
  });
  const serialized = serializeState(scenario, evidence, state);
  const restored = restoreState(scenario, evidence, serialized);
  deepStrictEqual(restored, state, `${label}: save/restore changed final state`);
  state.emittedEventIds.forEach((eventId) => ok(eventId.startsWith("syn_evt_"), `${label}: emitted event is not synthetic`));
  return { label, state, evidenceSeen: evidenceSeen.size };
}

const successful = playRoute("successful Threat Simulation", mangoKeepScenario, mangoKeepEvidence, "threat", routes.threatSuccessful);
const noisy = playRoute("noisy Threat Simulation", mangoKeepScenario, mangoKeepEvidence, "threat", routes.threatNoisy);
const strong = playRoute("strong Incident Response", mangoKeepIncidentScenario, mangoKeepIncidentEvidence, "defender", routes.irStrong);
const premature = playRoute("premature-containment Incident Response", mangoKeepIncidentScenario, mangoKeepIncidentEvidence, "defender", routes.irPremature);
const delayed = playRoute("delayed-containment Incident Response", mangoKeepIncidentScenario, mangoKeepIncidentEvidence, "defender", routes.irDelayed);

equal(successful.state.endingId, "ending_well_contained");
equal(noisy.state.endingId, "ending_severe_debrief");
ok(successful.state.metrics.trust_reasoning > noisy.state.metrics.trust_reasoning, "successful threat reasoning did not outscore noisy reasoning");
ok(successful.state.metrics.minimize_impact > noisy.state.metrics.minimize_impact, "successful threat restraint did not outscore noisy impact");

equal(strong.state.endingId, "ir_ending_confident");
equal(strong.state.flags.evidence_loss, false);
equal(strong.state.flags.recovery_validated, true);
ok(strong.state.metrics.containment > 0 && strong.state.metrics.preservation > 0, "strong urgent containment was penalized");

equal(premature.state.endingId, "ir_ending_evidence_lost");
equal(premature.state.flags.evidence_loss, true);
equal(premature.state.flags.business_effect, "moderate");
ok(strong.state.metrics.correlation > premature.state.metrics.correlation, "strong IR correlation did not outscore premature response");

equal(delayed.state.endingId, "ir_ending_partial");
equal(delayed.state.flags.evidence_preserved, true);
equal(delayed.state.flags.containment_complete, false);
equal(delayed.state.flags.recovery_validated, false);
ok(delayed.state.metrics.preservation > 0 && delayed.state.metrics.containment < strong.state.metrics.containment, "delayed-containment tradeoff was not recorded");

const pairedThreatSave = serializeState(mangoKeepScenario, mangoKeepEvidence, successful.state);
const pairedThreat = restoreState(mangoKeepScenario, mangoKeepEvidence, pairedThreatSave);
const pairedConsequence = getPairedConsequence(pairedThreat);
equal(pairedConsequence.id, "paired_alert_standard");
const pairedDefender = playRoute("Paired Mode defender", mangoKeepIncidentScenario, mangoKeepIncidentEvidence, "defender", routes.irStrong);
equal(pairedDefender.state.endingId, "ir_ending_confident");

for (let index = 1; index < mangoKeepTelemetry.events.length; index += 1) {
  ok(mangoKeepTelemetry.events[index].timestamp >= mangoKeepTelemetry.events[index - 1].timestamp, "telemetry chronology regressed");
}
eventEvidenceMap.mappings.forEach((mapping) => {
  mapping.event_ids.forEach((eventId) => ok(telemetryEventIds.has(eventId), `${mapping.evidence_id}: dangling telemetry event ${eventId}`));
});

[successful, noisy, strong, premature, delayed, pairedDefender].forEach((result) => {
  console.log(`${result.label}: ending=${result.state.endingId}; choices=${result.state.choiceIds.length}; visibleEvidence=${result.evidenceSeen}; metrics=${JSON.stringify(result.state.metrics)}`);
});
console.log(`Paired Mode: threat=${successful.state.endingId}; consequence=${pairedConsequence.id}; defender=${pairedDefender.state.endingId}`);
console.log("Playthrough audit passed: 6 routes.");
