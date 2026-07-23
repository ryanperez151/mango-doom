import { mangoKeepEvidence, mangoKeepScenario } from "../data/ctf/scenario.js";
import { mangoKeepIncidentEvidence, mangoKeepIncidentScenario } from "../data/ctf/incident-response.js";
import { mangoKeepTelemetry } from "../data/ctf/telemetry.js";
import { CtfContractError, validateScenario } from "../js/ctf/contracts.js";
import {
  applyChoice,
  getAvailableChoices,
  getCurrentNode,
  getVisibleEvidence,
  restoreState,
  serializeState,
  startScenario,
} from "../js/ctf/state.js";
import { CTF_STORAGE_KEY, CTF_UI_SAVE_VERSION, loadUiSave, removeUiSave, validateUiSave } from "../js/ctf/storage.js";
import { filterTimelineEvents, TimelineFilterError } from "../js/ctf/timeline.js";
import { getPairedConsequence } from "../js/ctf/paired.js";

const results = document.querySelector("#test-results");
let passed = 0;
let failed = 0;

function addResult(name, success, detail = "") {
  const item = document.createElement("li");
  item.textContent = `${success ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`;
  item.dataset.result = success ? "pass" : "fail";
  results.append(item);
  success ? passed += 1 : failed += 1;
}

function test(name, operation) {
  try {
    operation();
    addResult(name, true);
  } catch (error) {
    addResult(name, false, error instanceof Error ? error.message : String(error));
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertThrows(operation, message) {
  let error = null;
  try {
    operation();
  } catch (caught) {
    error = caught;
  }
  assert(error instanceof CtfContractError, message);
}

function dataClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function playChoices(choiceIds, perspective = "threat") {
  let state = startScenario(mangoKeepScenario, mangoKeepEvidence, perspective);
  choiceIds.forEach((choiceId) => {
    state = applyChoice(mangoKeepScenario, mangoKeepEvidence, state, choiceId);
  });
  return state;
}

function playIncidentChoices(choiceIds, perspective = "defender") {
  let state = startScenario(mangoKeepIncidentScenario, mangoKeepIncidentEvidence, perspective);
  choiceIds.forEach((choiceId) => {
    state = applyChoice(mangoKeepIncidentScenario, mangoKeepIncidentEvidence, state, choiceId);
  });
  return state;
}

const goldenPath = [
  "p1_inspect_premise",
  "p1_document_premise",
  "p2_compare_typed_trust",
  "p2_record_management_path",
  "p3_attempt_symbolic_transition",
  "p3_document_transition_event",
  "p4_inspect_role_labels",
  "p4_classify_dc_and_decoy",
  "p4_document_inventory",
  "p5_select_durable_role",
  "p5_document_marker_evidence",
  "p5_confirm_abstract_only",
  "p6_set_policy_marker",
  "p6_document_reversibility",
  "p7_inspect_consequences",
  "p7_end_well_contained",
];

test("complete scenario contracts validate", () => {
  assert(validateScenario(mangoKeepScenario, mangoKeepEvidence) === true, "scenario was not accepted");
});

test("scenario contains 24 nodes across seven threat chapters", () => {
  assert(mangoKeepScenario.nodes.length === 24, "node count is not 24");
  assert(mangoKeepScenario.nodes.filter((node) => node.perspectiveId === "threat").length === 23, "threat node count differs");
  assert(mangoKeepScenario.chapters.length === 7, "chapter count differs");
});

test("every node declares two or three meaningful choices", () => {
  mangoKeepScenario.nodes.forEach((node) => {
    assert(node.choiceIds.length >= 2 && node.choiceIds.length <= 3, `${node.id} has an invalid choice count`);
  });
});

test("every threat choice declares synthetic emitted events", () => {
  const nodes = new Map(mangoKeepScenario.nodes.map((node) => [node.id, node]));
  mangoKeepScenario.choices.forEach((choice) => {
    if (nodes.get(choice.nodeId).perspectiveId !== "threat") return;
    const eventEffects = choice.effects.filter((effect) => effect.type === "emitEvents");
    assert(eventEffects.length >= 1, `${choice.id} emits no events`);
    eventEffects.forEach((effect) => effect.eventIds.forEach((eventId) => {
      assert(eventId.startsWith("syn_evt_"), `${choice.id} emits a non-synthetic event ID`);
    }));
  });
});

test("every threat action carries a complete learning brief and state footprint", () => {
  const nodes = new Map(mangoKeepScenario.nodes.map((node) => [node.id, node]));
  mangoKeepScenario.choices.forEach((choice) => {
    if (nodes.get(choice.nodeId).perspectiveId !== "threat") return;
    assert(choice.objective.length > 0, `${choice.id} lacks an objective`);
    assert(choice.prerequisiteSummary.length > 0, `${choice.id} lacks a prerequisite summary`);
    assert(choice.outcomeText.length > 0, `${choice.id} lacks a conceptual outcome`);
    assert(choice.learningConsequence.length > 0, `${choice.id} lacks a learning consequence`);
    assert(choice.effects.some((effect) => effect.type === "updateAssetState"), `${choice.id} lacks an asset update`);
    assert(choice.effects.some((effect) => effect.type === "incrementMetric" && effect.metricId === "elapsed_minutes" && effect.amount > 0), `${choice.id} lacks elapsed time`);
    assert(choice.effects.some((effect) => effect.type === "incrementMetric" && effect.metricId === "evidence_footprint" && effect.amount > 0), `${choice.id} lacks an evidence footprint`);
  });
});

test("campaign exposes every requested symbolic action category", () => {
  const labels = [
    ...mangoKeepScenario.choices.map((choice) => choice.label),
    ...mangoKeepScenario.nodes.map((node) => node.title),
  ].join(" | ").toLowerCase();
  [
    "fictional topology",
    "sanitized trust clue",
    "simulated management-plane transition",
    "fictional vm inventory",
    "interact with the decoy",
    "persistence",
    "harmless vm role marker",
    "reversible fictional directory-policy",
    "document",
  ].forEach((phrase) => assert(labels.includes(phrase), `missing action category: ${phrase}`));
});

test("all telemetry is visibly synthetic", () => {
  mangoKeepEvidence.records.forEach((record) => {
    assert(record.synthetic === true, `${record.id} is not marked synthetic`);
    assert(record.syntheticLabel === "[SYNTHETIC — FICTIONAL TRAINING DATA]", `${record.id} lacks the visible label`);
  });
});

test("three persistence choices set only the approved abstract marker", () => {
  const markerNode = mangoKeepScenario.nodes.find((node) => node.id === "p5_marker_select");
  assert(markerNode.choiceIds.length === 3, "marker choice count differs");
  markerNode.choiceIds.forEach((choiceId) => {
    const choice = mangoKeepScenario.choices.find((item) => item.id === choiceId);
    const stateEffects = choice.effects.filter((effect) => effect.type === "setFlag");
    assert(stateEffects.length === 1, `${choiceId} changes an extra flag`);
    assert(stateEffects[0].flagId === "persistence_marker_present" && stateEffects[0].value === true, `${choiceId} uses the wrong marker`);
  });
});

test("each phase has a recoverable poor decision", () => {
  const recoveries = [
    ["p1_assume_broad_trust", "p1_correct_scope", "p1_checkpoint", "p1_poor"],
    ["p2_follow_reachability_only", "p2_correct_trust_model", "p2_checkpoint", "p2_poor"],
    ["p3_claim_full_asset_control", "p3_correct_transition_scope", "p3_checkpoint", "p3_poor"],
    ["p4_follow_loud_decoy", "p4_correct_decoy_scope", "p4_compare_roles", "p4_poor"],
    ["p5_skip_marker_correlation", "p5_restore_marker_context", "p5_checkpoint", "p5_poor"],
    ["p6_set_broad_identity_marker", "p6_reverse_broad_marker", "p6_checkpoint", "p6_poor"],
    ["p7_assume_edge_isolation_complete", "p7_correct_containment_scope", "p7_checkpoint", "p7_poor"],
  ];
  recoveries.forEach(([poorId, recoveryId, reconvergedNodeId, flagId]) => {
    const poor = mangoKeepScenario.choices.find((choice) => choice.id === poorId);
    const recovery = mangoKeepScenario.choices.find((choice) => choice.id === recoveryId);
    assert(poor.effects.some((effect) => effect.type === "setFlag" && effect.flagId === flagId && effect.value === true), `${poorId} lacks a poor-decision marker`);
    assert(recovery.effects.some((effect) => effect.type === "setFlag" && effect.flagId === flagId && effect.value === false), `${recoveryId} does not recover the marker`);
    assert(recovery.nextNodeId === reconvergedNodeId, `${recoveryId} does not reconverge`);
  });
});

test("required threat endings are defined", () => {
  const endingIds = new Set(mangoKeepScenario.endings.map((ending) => ending.id));
  assert(endingIds.has("ending_well_contained"), "well-contained ending is missing");
  assert(endingIds.has("ending_partially_contained"), "partial ending is missing");
  assert(endingIds.has("ending_severe_debrief"), "severe debrief ending is missing");
});

test("startScenario remains deterministic", () => {
  const first = startScenario(mangoKeepScenario, mangoKeepEvidence, "threat");
  const second = startScenario(mangoKeepScenario, mangoKeepEvidence, "threat");
  assert(JSON.stringify(first) === JSON.stringify(second), "fresh states differ");
});

test("golden path reaches the well-contained ending", () => {
  const state = playChoices(goldenPath);
  assert(state.endingId === "ending_well_contained", "golden ending differs");
  assert(state.flags.persistence_marker_present === true, "persistence marker is absent");
  assert(state.flags.dc_snapshot_exposure_marker === "suspected", "DC marker differs");
  assert(state.flags.severe_impact === false, "golden path has severe impact");
  assert(state.metrics.elapsed_minutes > 0, "elapsed time did not advance");
  assert(state.metrics.evidence_footprint > 0, "evidence footprint did not grow");
  mangoKeepScenario.evidenceCodes.forEach((code) => {
    assert(state.flags[code.flagId] === true, `${code.id} was not awarded on the reasoning path`);
  });
});

test("severe path reaches severe-impact debrief", () => {
  const prefix = goldenPath.slice(0, 12);
  const state = playChoices([
    ...prefix,
    "p6_set_broad_identity_marker",
    "p6_retain_for_debrief",
    "p6_document_reversibility",
    "p7_inspect_consequences",
    "p7_end_severe",
  ]);
  assert(state.endingId === "ending_severe_debrief", "severe ending differs");
  assert(state.flags.severe_impact === true, "severe marker was not retained");
});

test("partial-containment ending remains available", () => {
  const state = playChoices([...goldenPath.slice(0, -1), "p7_end_partial"]);
  assert(state.endingId === "ending_partially_contained", "partial ending differs");
});

test("applyChoice is pure and expands visible evidence", () => {
  const before = startScenario(mangoKeepScenario, mangoKeepEvidence, "threat");
  const snapshot = JSON.stringify(before);
  const inspected = applyChoice(mangoKeepScenario, mangoKeepEvidence, before, "p1_inspect_premise");
  const after = applyChoice(mangoKeepScenario, mangoKeepEvidence, inspected, "p1_document_premise");
  assert(JSON.stringify(before) === snapshot, "input state was mutated");
  assert(getVisibleEvidence(mangoKeepScenario, mangoKeepEvidence, before).length === 2, "initial evidence count differs");
  assert(getVisibleEvidence(mangoKeepScenario, mangoKeepEvidence, after).length === 4, "new evidence was not unlocked");
});

test("current node and available choices track reconvergence", () => {
  const state = playChoices(["p1_assume_broad_trust", "p1_correct_scope"]);
  assert(getCurrentNode(mangoKeepScenario, mangoKeepEvidence, state).id === "p1_checkpoint", "poor branch did not reconverge");
  assert(getAvailableChoices(mangoKeepScenario, mangoKeepEvidence, state).length === 2, "checkpoint choices differ");
});

test("complete state serializes and restores by deterministic replay", () => {
  const complete = playChoices(goldenPath);
  const serialized = serializeState(mangoKeepScenario, mangoKeepEvidence, complete);
  const restored = restoreState(mangoKeepScenario, mangoKeepEvidence, serialized);
  assert(JSON.stringify(restored) === JSON.stringify(complete), "restored state differs");
});

test("unknown effect and broken references fail validation", () => {
  const unknownEffect = dataClone(mangoKeepScenario);
  unknownEffect.choices[0].effects[0] = { type: "unknownEffect", value: true };
  assertThrows(() => validateScenario(unknownEffect, mangoKeepEvidence), "unknown effect was accepted");

  const brokenReference = dataClone(mangoKeepScenario);
  brokenReference.nodes[0].evidenceIds = ["ev_missing"];
  assertThrows(() => validateScenario(brokenReference, mangoKeepEvidence), "broken reference was accepted");
});

test("schema versions and non-data content fail validation", () => {
  const obsoleteScenario = dataClone(mangoKeepScenario);
  obsoleteScenario.schemaVersion = 0;
  assertThrows(() => validateScenario(obsoleteScenario, mangoKeepEvidence), "obsolete scenario schema was accepted");

  const obsoleteEvidence = dataClone(mangoKeepEvidence);
  obsoleteEvidence.schemaVersion = 0;
  assertThrows(() => validateScenario(mangoKeepScenario, obsoleteEvidence), "obsolete evidence schema was accepted");

  const executableContent = dataClone(mangoKeepScenario);
  executableContent.nodes[0].body = () => "not inert data";
  assertThrows(() => validateScenario(executableContent, mangoKeepEvidence), "non-data scenario content was accepted");
});

test("duplicate and dangling IDs fail validation", () => {
  const duplicate = dataClone(mangoKeepScenario);
  duplicate.nodes.push(dataClone(duplicate.nodes[0]));
  assertThrows(() => validateScenario(duplicate, mangoKeepEvidence), "duplicate node ID was accepted");

  const dangling = dataClone(mangoKeepScenario);
  dangling.choices[0].nextNodeId = "missing_node";
  assertThrows(() => validateScenario(dangling, mangoKeepEvidence), "dangling next-node ID was accepted");
});

test("unreachable nodes and nonterminal dead ends fail validation", () => {
  const unreachable = dataClone(mangoKeepScenario);
  const isolatedChoice = dataClone(unreachable.choices[0]);
  isolatedChoice.id = "isolated_choice";
  isolatedChoice.nodeId = "isolated_node";
  isolatedChoice.nextNodeId = null;
  isolatedChoice.endingId = "ending_well_contained";
  const isolatedNode = dataClone(unreachable.nodes[0]);
  isolatedNode.id = "isolated_node";
  isolatedNode.choiceIds = [isolatedChoice.id];
  unreachable.nodes.push(isolatedNode);
  unreachable.choices.push(isolatedChoice);
  unreachable.chapters[0].nodeIds.push(isolatedNode.id);
  assertThrows(() => validateScenario(unreachable, mangoKeepEvidence), "unreachable node was accepted");

  const deadEnd = dataClone(mangoKeepScenario);
  const startNode = deadEnd.nodes.find((node) => node.id === "p1_edge_context");
  startNode.choiceIds.forEach((choiceId) => {
    deadEnd.choices.find((choice) => choice.id === choiceId).prerequisites = [{ type: "evidenceUnlocked", evidenceId: "ev_recovery_note" }];
  });
  assertThrows(() => validateScenario(deadEnd, mangoKeepEvidence), "fully gated nonterminal node was accepted");
});

test("unreachable endings fail validation", () => {
  const unreachableEnding = dataClone(mangoKeepScenario);
  unreachableEnding.endings.push({ id: "ending_never_referenced", perspectiveId: "threat", title: "Unreachable fixture", summary: "Harmless negative validation fixture.", prerequisites: [] });
  assertThrows(() => validateScenario(unreachableEnding, mangoKeepEvidence), "unreachable ending was accepted");
});

test("instructor-only learner narrative fails validation", () => {
  const leakedNarrative = dataClone(mangoKeepScenario);
  leakedNarrative.nodes[0].body = "Instructor-only fixture that must never enter learner content.";
  assertThrows(() => validateScenario(leakedNarrative, mangoKeepEvidence), "instructor-only narrative was accepted");
});

test("missing defender observables for a threat action fail validation", () => {
  const missingObservable = dataClone(mangoKeepScenario);
  missingObservable.choices[0].effects = missingObservable.choices[0].effects.filter((effect) => effect.type !== "emitEvents");
  assertThrows(() => validateScenario(missingObservable, mangoKeepEvidence), "threat action without observable events was accepted");
});

test("nonfictional domains and non-documentation addresses fail validation", () => {
  const badDomain = dataClone(mangoKeepScenario);
  badDomain.assets[0].hostname = "edge.example.com";
  assertThrows(() => validateScenario(badDomain, mangoKeepEvidence), "nonfictional domain was accepted");
  const badAddress = dataClone(mangoKeepScenario);
  badAddress.assets[0].address = "127.0.0.1";
  assertThrows(() => validateScenario(badAddress, mangoKeepEvidence), "non-documentation address was accepted");
});

test("bad choice fails without mutating state", () => {
  const state = startScenario(mangoKeepScenario, mangoKeepEvidence, "threat");
  const snapshot = JSON.stringify(state);
  assertThrows(() => applyChoice(mangoKeepScenario, mangoKeepEvidence, state, "choice_missing"), "bad choice was accepted");
  assert(JSON.stringify(state) === snapshot, "state changed after rejected choice");
});

test("obsolete, malformed, and unknown-field saves fail safely", () => {
  const obsolete = startScenario(mangoKeepScenario, mangoKeepEvidence, "threat");
  obsolete.saveVersion = 0;
  assertThrows(() => restoreState(mangoKeepScenario, mangoKeepEvidence, JSON.stringify(obsolete)), "obsolete save was accepted");
  assertThrows(() => restoreState(mangoKeepScenario, mangoKeepEvidence, "{not valid json"), "malformed save was accepted");

  const unknownField = startScenario(mangoKeepScenario, mangoKeepEvidence, "threat");
  unknownField.unexpected = true;
  assertThrows(() => restoreState(mangoKeepScenario, mangoKeepEvidence, JSON.stringify(unknownField)), "unknown field was accepted");
});

test("tampered state fails deterministic replay", () => {
  const complete = playChoices(goldenPath);
  complete.metrics.trust_reasoning += 1;
  assertThrows(() => restoreState(mangoKeepScenario, mangoKeepEvidence, JSON.stringify(complete)), "tampered score was accepted");
});

const incidentGoldenPath = [
  "ir_triage_high",
  "ir_edge_high",
  "ir_esxi_high",
  "ir_persistence_high",
  "ir_dc_access_high",
  "ir_dc_impact_high",
  "ir_scope_high",
  "ir_contain_urgent",
  "ir_timeline_high",
  "ir_final_scope_high",
  "ir_recovery_high",
  "ir_handoff_high",
];

test("linked Incident Response campaign validates", () => {
  assert(validateScenario(mangoKeepIncidentScenario, mangoKeepIncidentEvidence) === true, "incident campaign was not accepted");
  assert(mangoKeepIncidentScenario.nodes.filter((node) => node.perspectiveId === "defender").length === 12, "defender node count differs");
});

test("defender begins with only the initial edge alert", () => {
  const state = startScenario(mangoKeepIncidentScenario, mangoKeepIncidentEvidence, "defender");
  const visibleIds = getVisibleEvidence(mangoKeepIncidentScenario, mangoKeepIncidentEvidence, state).map((record) => record.id);
  assert(JSON.stringify(visibleIds) === JSON.stringify(["ir_initial_edge_alert"]), "later evidence is visible at start");
});

test("high-confidence findings require every named evidence pair", () => {
  const requiredPairs = {
    ir_edge_high: ["ir_edge_admin_session", "ir_edge_config_change"],
    ir_esxi_high: ["ir_esxi_flow", "ir_esxi_auth"],
    ir_persistence_high: ["ir_persistence_marker", "ir_restart_survival"],
    ir_dc_access_high: ["ir_vcenter_task", "ir_vm_uuid_map"],
    ir_dc_impact_high: ["ir_guest_operation", "ir_identity_change"],
    ir_scope_high: ["ir_shared_indicator", "ir_additional_identity"],
  };
  Object.entries(requiredPairs).forEach(([choiceId, evidenceIds]) => {
    const choice = mangoKeepIncidentScenario.choices.find((item) => item.id === choiceId);
    const actual = choice.prerequisites.filter((item) => item.type === "evidenceUnlocked").map((item) => item.evidenceId);
    assert(JSON.stringify(actual) === JSON.stringify(evidenceIds), `${choiceId} has the wrong dependency pair`);
  });
});

test("each defender stage offers high-value, incomplete, and premature decisions", () => {
  mangoKeepIncidentScenario.nodes.filter((node) => node.perspectiveId === "defender").forEach((node) => {
    const labels = node.choiceIds.map((choiceId) => mangoKeepIncidentScenario.choices.find((choice) => choice.id === choiceId).label.toLowerCase());
    assert(labels.length === 3, `${node.id} does not have three decisions`);
    assert(labels.some((label) => label.startsWith("high-value:")), `${node.id} lacks a high-value decision`);
    assert(labels.some((label) => label.startsWith("incomplete:")), `${node.id} lacks an incomplete decision`);
    assert(labels.some((label) => label.startsWith("premature:")), `${node.id} lacks a premature decision`);
  });
});

test("golden incident path reaches validated recovery and complete handoff", () => {
  const state = playIncidentChoices(incidentGoldenPath);
  ["edge_confirmed", "esxi_confirmed", "persistence_confirmed", "dc_access_confirmed", "dc_impact_confirmed", "wider_scope_confirmed", "timeline_complete", "scope_complete", "containment_complete", "recovery_validated", "handoff_complete"].forEach((flagId) => {
    assert(state.flags[flagId] === true, `${flagId} was not completed`);
  });
  assert(state.endingId === "ir_ending_confident", "confident ending differs");
  assert(state.flags.ir_evidence_code_awarded === true, "reasoning evidence code was not awarded");
});

test("urgent containment is rewarded when ongoing harm is clear", () => {
  const state = playIncidentChoices(incidentGoldenPath.slice(0, 8));
  assert(state.flags.ongoing_harm_clear === true, "ongoing harm was not established");
  assert(state.flags.evidence_preserved === true && state.flags.evidence_loss === false, "urgent path did not preserve evidence");
  assert(state.metrics.containment > 0 && state.metrics.preservation > 0, "urgent containment was penalized");
  assert(state.flags.business_effect === "moderate", "urgent containment tradeoff is not recorded");
});

test("premature choices still reach an evidence-limited debrief", () => {
  const state = playIncidentChoices([
    "ir_triage_premature", "ir_edge_premature", "ir_esxi_premature", "ir_persistence_premature",
    "ir_dc_access_premature", "ir_dc_impact_premature", "ir_scope_premature", "ir_contain_broad",
    "ir_timeline_premature", "ir_final_scope_premature", "ir_recovery_premature", "ir_handoff_lost",
  ]);
  assert(state.endingId === "ir_ending_evidence_lost", "evidence-limited ending differs");
  assert(state.flags.evidence_loss === true, "evidence loss was not recorded");
});

const uiSaveAllowlists = {
  evidenceIds: new Set(["ir_initial_edge_alert"]),
  eventIds: new Set(["tel_0001"]),
  filterValues: {
    source: new Set(["ngfw.audit"]),
    host: new Set(["peel-gate.mangokeep.invalid"]),
    severity: new Set(["high"]),
    stage: new Set(["edge_context"]),
  },
};

const validUiSave = {
  uiSaveVersion: CTF_UI_SAVE_VERSION,
  mode: "defender",
  activeTrack: "defender",
  threatState: null,
  defenderState: "{}",
  evidenceBookmarks: ["ir_initial_edge_alert"],
  eventBookmarks: ["tel_0001"],
  evidenceNotes: { ir_initial_edge_alert: "Preserve before containment." },
  caseNotes: "Initial fictional edge alert requires corroboration.",
  filters: { source: "ngfw.audit", host: "peel-gate.mangokeep.invalid", severity: "high", stage: "edge_context", from: "2088-03-14T09:00", to: "2088-03-14T09:10" },
  hintShown: false,
};

test("versioned local UI save accepts only allowlisted inert fields", () => {
  assert(validateUiSave(validUiSave, uiSaveAllowlists) === true, "valid UI save was rejected");
});

test("obsolete and expanded local UI saves fail safely", () => {
  const obsolete = dataClone(validUiSave);
  obsolete.uiSaveVersion = 0;
  assert(validateUiSave(obsolete, uiSaveAllowlists) === false, "obsolete UI save was accepted");
  const expanded = dataClone(validUiSave);
  expanded.command = "unexpected";
  assert(validateUiSave(expanded, uiSaveAllowlists) === false, "unknown UI save field was accepted");
  const unknownEvidence = dataClone(validUiSave);
  unknownEvidence.evidenceBookmarks = ["unknown_evidence"];
  assert(validateUiSave(unknownEvidence, uiSaveAllowlists) === false, "unknown bookmark was accepted");
});

test("choice prerequisites gate high-confidence findings", () => {
  let incomplete = startScenario(mangoKeepIncidentScenario, mangoKeepIncidentEvidence, "defender");
  incomplete = applyChoice(mangoKeepIncidentScenario, mangoKeepIncidentEvidence, incomplete, "ir_triage_incomplete");
  assert(!getAvailableChoices(mangoKeepIncidentScenario, mangoKeepIncidentEvidence, incomplete).some((choice) => choice.id === "ir_edge_high"), "paired-evidence choice unlocked early");

  let complete = startScenario(mangoKeepIncidentScenario, mangoKeepIncidentEvidence, "defender");
  complete = applyChoice(mangoKeepIncidentScenario, mangoKeepIncidentEvidence, complete, "ir_triage_high");
  assert(getAvailableChoices(mangoKeepIncidentScenario, mangoKeepIncidentEvidence, complete).some((choice) => choice.id === "ir_edge_high"), "paired-evidence choice stayed locked");
});

test("evidence unlocking exposes only declared records", () => {
  const initial = startScenario(mangoKeepIncidentScenario, mangoKeepIncidentEvidence, "defender");
  const incomplete = applyChoice(mangoKeepIncidentScenario, mangoKeepIncidentEvidence, initial, "ir_triage_incomplete");
  const visibleIds = getVisibleEvidence(mangoKeepIncidentScenario, mangoKeepIncidentEvidence, incomplete).map((record) => record.id);
  assert(visibleIds.includes("ir_initial_edge_alert") && visibleIds.includes("ir_edge_admin_session"), "declared evidence did not unlock");
  assert(!visibleIds.includes("ir_edge_config_change"), "undeclared evidence unlocked");
});

test("corrupt local save recovery preserves unrelated storage", () => {
  const unrelatedKey = "mangoSys.validation.unrelated";
  try {
    localStorage.setItem(unrelatedKey, "preserve-me");
    localStorage.setItem(CTF_STORAGE_KEY, "{malformed");
    assert(loadUiSave(uiSaveAllowlists).status === "invalid", "corrupt UI save was not rejected");
    assert(removeUiSave() === true, "CTF reset failed");
    assert(loadUiSave(uiSaveAllowlists).status === "empty", "CTF save remained after reset");
    assert(localStorage.getItem(unrelatedKey) === "preserve-me", "reset removed unrelated storage");
  } finally {
    localStorage.removeItem(CTF_STORAGE_KEY);
    localStorage.removeItem(unrelatedKey);
  }
});

test("timeline filters are deterministic and allowlisted", () => {
  const filters = { source: "identity.auth", host: "", severity: "", stage: "dc_marker", from: "2088-03-14T09:50", to: "2088-03-14T10:00" };
  const first = filterTimelineEvents(mangoKeepTelemetry.events, filters);
  const second = filterTimelineEvents(mangoKeepTelemetry.events, filters);
  assert(JSON.stringify(first) === JSON.stringify(second), "identical timeline filters produced different results");
  assert(first.length > 0, "valid timeline filter returned no fixture events");
  first.forEach((event) => {
    assert(event.dataset === "identity.auth" && event.scenario_stage === "dc_marker", "timeline filter leaked another source or stage");
    assert(event.synthetic === true, "timeline filter returned a nonsynthetic event");
  });

  let rejected = null;
  try {
    filterTimelineEvents(mangoKeepTelemetry.events, { ...filters, host: "unlisted.invalid" });
  } catch (error) {
    rejected = error;
  }
  assert(rejected instanceof TimelineFilterError, "unknown timeline filter was accepted");
});

test("paired mode derives one bounded cross-perspective consequence", () => {
  const standard = playChoices(goldenPath);
  const severe = playChoices([
    ...goldenPath.slice(0, 12),
    "p6_set_broad_identity_marker",
    "p6_retain_for_debrief",
    "p6_document_reversibility",
    "p7_inspect_consequences",
    "p7_end_severe",
  ]);
  assert(getPairedConsequence(standard).id === "paired_alert_standard", "bounded threat ending produced the wrong handoff consequence");
  assert(getPairedConsequence(severe).id === "paired_alert_elevated", "unresolved abstract impact did not change the defender handoff");
});

const summary = document.querySelector("#test-summary");
summary.textContent = `${passed} passed, ${failed} failed`;
summary.dataset.status = failed === 0 ? "pass" : "fail";
document.title = failed === 0 ? "PASS — CTF engine validation" : "FAIL — CTF engine validation";
