// CTF page controller. This module only applies allowlisted engine choices and
// renders inert bundled data with DOM text properties. It performs no requests.

import { mangoKeepEvidence, mangoKeepScenario } from "../../data/ctf/scenario.js";
import { mangoKeepIncidentEvidence, mangoKeepIncidentScenario } from "../../data/ctf/incident-response.js";
import { mangoKeepTelemetry } from "../../data/ctf/telemetry.js";
import {
  applyChoice,
  getAvailableChoices,
  getCurrentNode,
  getVisibleEvidence,
  restoreState,
  serializeState,
  startScenario,
} from "./state.js";
import { CTF_UI_SAVE_VERSION, loadUiSave, removeUiSave, storeUiSave } from "./storage.js";
import { filterTimelineEvents } from "./timeline.js";
import { getPairedConsequence } from "./paired.js";

const ctfDom = {
  launch: document.querySelector("#ctf-launch"),
  workspace: document.querySelector("#ctf-workspace"),
  ending: document.querySelector("#ctf-ending"),
  start: document.querySelector("#ctf-start"),
  resume: document.querySelector("#ctf-resume"),
  resetLaunch: document.querySelector("#ctf-reset-launch"),
  reset: document.querySelector("#ctf-reset"),
  saveNow: document.querySelector("#ctf-save-now"),
  modeStatus: document.querySelector("#ctf-mode-status"),
  saveStatus: document.querySelector("#ctf-save-status"),
  storageNote: document.querySelector("#ctf-storage-note"),
  chapterLabel: document.querySelector("#chapter-label"),
  nodeTitle: document.querySelector("#node-title"),
  nodeBody: document.querySelector("#node-body"),
  nodeObjective: document.querySelector("#node-objective"),
  pairedConsequence: document.querySelector("#paired-consequence"),
  choices: document.querySelector("#ctf-choices"),
  feedback: document.querySelector("#choice-feedback"),
  showHint: document.querySelector("#ctf-show-hint"),
  hint: document.querySelector("#ctf-hint"),
  hintText: document.querySelector("#ctf-hint-text"),
  evidenceCount: document.querySelector("#evidence-count"),
  evidenceList: document.querySelector("#evidence-list"),
  assetSummary: document.querySelector("#asset-summary"),
  codesEmpty: document.querySelector("#codes-empty"),
  codeList: document.querySelector("#code-list"),
  filterForm: document.querySelector("#timeline-filters"),
  filterSource: document.querySelector("#filter-source"),
  filterHost: document.querySelector("#filter-host"),
  filterSeverity: document.querySelector("#filter-severity"),
  filterStage: document.querySelector("#filter-stage"),
  filterFrom: document.querySelector("#filter-from"),
  filterTo: document.querySelector("#filter-to"),
  clearFilters: document.querySelector("#clear-filters"),
  timelineCount: document.querySelector("#timeline-count"),
  timelineEvents: document.querySelector("#timeline-events"),
  caseNotes: document.querySelector("#case-notes"),
  caseNoteCount: document.querySelector("#case-note-count"),
  endingTitle: document.querySelector("#ending-title"),
  endingSummary: document.querySelector("#ending-summary"),
  scoreGrid: document.querySelector("#score-grid"),
  debriefList: document.querySelector("#debrief-list"),
  pairedContinue: document.querySelector("#paired-continue"),
  endingReview: document.querySelector("#ending-review"),
  endingReset: document.querySelector("#ending-reset"),
  resetDialog: document.querySelector("#reset-dialog"),
  confirmReset: document.querySelector("#confirm-reset"),
  cancelReset: document.querySelector("#cancel-reset"),
  live: document.querySelector("#ctf-live"),
};

const EMPTY_FILTERS = Object.freeze({ source: "", host: "", severity: "", stage: "", from: "", to: "" });
const THREAT_STAGES = ["edge_context", "trust_discovery", "esxi_transition", "inventory_review", "persistence_marker", "dc_marker", "containment"];
const DEFENDER_NODE_STAGES = Object.freeze({
  ir_edge_triage: ["edge_context"],
  ir_edge_finding: ["edge_context", "trust_discovery"],
  ir_esxi_finding: ["edge_context", "trust_discovery", "esxi_transition"],
  ir_persistence_finding: ["edge_context", "trust_discovery", "esxi_transition", "persistence_marker"],
  ir_dc_access_finding: ["edge_context", "trust_discovery", "esxi_transition", "persistence_marker", "inventory_review"],
  ir_dc_impact_finding: ["edge_context", "trust_discovery", "esxi_transition", "persistence_marker", "inventory_review", "dc_marker"],
  ir_wider_scope: ["edge_context", "trust_discovery", "esxi_transition", "persistence_marker", "inventory_review", "dc_marker"],
  ir_preserve_contain: THREAT_STAGES,
  ir_timeline: THREAT_STAGES,
  ir_scope_assessment: THREAT_STAGES,
  ir_recovery: THREAT_STAGES,
  ir_handoff: THREAT_STAGES,
});
const MODE_LABELS = Object.freeze({ threat: "Threat Simulation", defender: "Incident Response", paired: "Paired Mode" });

const allEvidenceIds = new Set([
  ...mangoKeepEvidence.records.map((record) => record.id),
  ...mangoKeepIncidentEvidence.records.map((record) => record.id),
]);
const allEventIds = new Set(mangoKeepTelemetry.events.map((event) => event.event_id));
const filterValues = {
  source: new Set(mangoKeepTelemetry.events.map((event) => event.dataset)),
  host: new Set(mangoKeepTelemetry.events.map((event) => event.hostname)),
  severity: new Set(mangoKeepTelemetry.events.map((event) => event.severity)),
  stage: new Set(mangoKeepTelemetry.events.map((event) => event.scenario_stage)),
};
const uiAllowlists = { evidenceIds: allEvidenceIds, eventIds: allEventIds, filterValues };

let ctfUiState = null;
let cachedSave = null;
let lastResetTrigger = null;

function announce(message) {
  ctfDom.live.textContent = "";
  window.requestAnimationFrame(() => { ctfDom.live.textContent = message; });
}

function activeBundle() {
  if (ctfUiState.activeTrack === "threat") return { scenario: mangoKeepScenario, evidence: mangoKeepEvidence };
  return { scenario: mangoKeepIncidentScenario, evidence: mangoKeepIncidentEvidence };
}

function activeEngineState() {
  return ctfUiState.activeTrack === "threat" ? ctfUiState.threatState : ctfUiState.defenderState;
}

function setActiveEngineState(state) {
  if (ctfUiState.activeTrack === "threat") ctfUiState.threatState = state;
  else ctfUiState.defenderState = state;
}

function createFreshUiState(mode) {
  const startsWithThreat = mode === "threat" || mode === "paired";
  return {
    mode,
    activeTrack: startsWithThreat ? "threat" : "defender",
    threatState: startsWithThreat ? startScenario(mangoKeepScenario, mangoKeepEvidence, "threat") : null,
    defenderState: startsWithThreat ? null : startScenario(mangoKeepIncidentScenario, mangoKeepIncidentEvidence, "defender"),
    evidenceBookmarks: [],
    eventBookmarks: [],
    evidenceNotes: {},
    caseNotes: "",
    filters: { ...EMPTY_FILTERS },
    hintShown: false,
  };
}

function saveCandidate() {
  return {
    uiSaveVersion: CTF_UI_SAVE_VERSION,
    mode: ctfUiState.mode,
    activeTrack: ctfUiState.activeTrack,
    threatState: ctfUiState.threatState === null ? null : serializeState(mangoKeepScenario, mangoKeepEvidence, ctfUiState.threatState),
    defenderState: ctfUiState.defenderState === null ? null : serializeState(mangoKeepIncidentScenario, mangoKeepIncidentEvidence, ctfUiState.defenderState),
    evidenceBookmarks: [...ctfUiState.evidenceBookmarks],
    eventBookmarks: [...ctfUiState.eventBookmarks],
    evidenceNotes: { ...ctfUiState.evidenceNotes },
    caseNotes: ctfUiState.caseNotes,
    filters: { ...ctfUiState.filters },
    hintShown: ctfUiState.hintShown,
  };
}

function persist(message = "Saved locally") {
  const stored = storeUiSave(saveCandidate(), uiAllowlists);
  ctfDom.saveStatus.textContent = stored ? message : "Local save unavailable";
  return stored;
}

function restoreCachedSave() {
  if (!cachedSave) return false;
  try {
    const restored = {
      mode: cachedSave.mode,
      activeTrack: cachedSave.activeTrack,
      threatState: cachedSave.threatState === null ? null : restoreState(mangoKeepScenario, mangoKeepEvidence, cachedSave.threatState),
      defenderState: cachedSave.defenderState === null ? null : restoreState(mangoKeepIncidentScenario, mangoKeepIncidentEvidence, cachedSave.defenderState),
      evidenceBookmarks: [...cachedSave.evidenceBookmarks],
      eventBookmarks: [...cachedSave.eventBookmarks],
      evidenceNotes: { ...cachedSave.evidenceNotes },
      caseNotes: cachedSave.caseNotes,
      filters: { ...cachedSave.filters },
      hintShown: cachedSave.hintShown,
    };
    if ((restored.activeTrack === "threat" && restored.threatState === null) || (restored.activeTrack === "defender" && restored.defenderState === null)) return false;
    ctfUiState = restored;
    return true;
  } catch {
    return false;
  }
}

function textElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function setSelectOptions(select, values, firstLabel) {
  const selected = select.value;
  select.replaceChildren();
  const first = document.createElement("option");
  first.value = "";
  first.textContent = firstLabel;
  select.append(first);
  [...values].sort().forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
  select.value = values.has(selected) ? selected : "";
}

function initializeFilterControls() {
  setSelectOptions(ctfDom.filterSource, filterValues.source, "All sources");
  setSelectOptions(ctfDom.filterHost, filterValues.host, "All hosts");
  setSelectOptions(ctfDom.filterSeverity, filterValues.severity, "All severities");
  ctfDom.filterFrom.min = "2088-03-14T09:00:00";
  ctfDom.filterFrom.max = "2088-03-14T10:11:30";
  ctfDom.filterTo.min = "2088-03-14T09:00:00";
  ctfDom.filterTo.max = "2088-03-14T10:11:30";
}

function revealedStages() {
  const engineState = activeEngineState();
  const { scenario, evidence } = activeBundle();
  const node = getCurrentNode(scenario, evidence, engineState);
  if (ctfUiState.activeTrack === "threat") {
    const chapter = scenario.chapters.find((item) => item.id === node.chapterId);
    return new Set(THREAT_STAGES.slice(0, chapter.order));
  }
  return new Set(DEFENDER_NODE_STAGES[node.id] ?? ["edge_context"]);
}

function revealedEvents() {
  const engineState = activeEngineState();
  const { scenario, evidence } = activeBundle();
  const node = getCurrentNode(scenario, evidence, engineState);
  if (ctfUiState.activeTrack === "defender" && node.id === "ir_edge_triage") {
    return mangoKeepTelemetry.events.filter((event) => event.event_id === "tel_0001" && event.synthetic === true);
  }
  const stages = revealedStages();
  return mangoKeepTelemetry.events.filter((event) => event.synthetic === true && stages.has(event.scenario_stage));
}

function filteredEvents() {
  return filterTimelineEvents(revealedEvents(), ctfUiState.filters, mangoKeepTelemetry.events);
}

function renderChoices(node, scenario, evidence, engineState) {
  const availableIds = new Set(getAvailableChoices(scenario, evidence, engineState).map((choice) => choice.id));
  ctfDom.choices.replaceChildren();

  node.choiceIds.forEach((choiceId) => {
    const choice = scenario.choices.find((item) => item.id === choiceId);
    const available = availableIds.has(choice.id);
    const card = document.createElement("article");
    card.className = `ctf-choice-card${available ? "" : " choice-locked"}`;
    card.append(textElement("h4", "", choice.label));
    card.append(textElement("p", "ctf-choice-objective", choice.objective));
    card.append(textElement("p", "ctf-prerequisite", `Prerequisite: ${choice.prerequisiteSummary}`));
    if (!available) card.append(textElement("p", "ctf-lock-text", "STATUS: unavailable until the listed evidence or state requirement is met."));
    const button = textElement("button", "button", available ? "Choose This Action" : "Review Locked Action");
    button.type = "button";
    button.dataset.choiceId = choice.id;
    button.setAttribute("aria-disabled", String(!available));
    card.append(button);
    ctfDom.choices.append(card);
  });
}

function renderEvidence(scenario, evidence, engineState) {
  const records = getVisibleEvidence(scenario, evidence, engineState);
  ctfDom.evidenceCount.textContent = `${records.length} visible`;
  ctfDom.evidenceList.replaceChildren();

  records.forEach((record) => {
    const card = document.createElement("article");
    card.className = "evidence-card";
    card.append(textElement("p", "synthetic-tag", "SYNTHETIC — FICTIONAL TRAINING DATA"));
    card.append(textElement("h3", "", record.summary));
    card.append(textElement("p", "evidence-meta", `${record.timestamp} · ${record.sourceType} · ${record.kind}`));
    const bookmarked = ctfUiState.evidenceBookmarks.includes(record.id);
    const button = textElement("button", "button evidence-bookmark", bookmarked ? "Remove Evidence Bookmark" : "Bookmark Evidence");
    button.type = "button";
    button.dataset.evidenceId = record.id;
    button.setAttribute("aria-pressed", String(bookmarked));
    card.append(button);
    const label = textElement("label", "evidence-note-label", "Local evidence note");
    const note = document.createElement("textarea");
    note.rows = 3;
    note.maxLength = 500;
    note.dataset.evidenceNote = record.id;
    note.value = ctfUiState.evidenceNotes[record.id] ?? "";
    label.append(note);
    card.append(label);
    ctfDom.evidenceList.append(card);
  });
}

function renderAssets(scenario, engineState) {
  ctfDom.assetSummary.replaceChildren();
  scenario.assets.forEach((asset) => {
    const item = document.createElement("article");
    item.className = "asset-card";
    item.append(textElement("h3", "", asset.label));
    item.append(textElement("p", "asset-address", `${asset.hostname} · ${asset.address}`));
    const list = document.createElement("dl");
    const stateTerm = textElement("dt", "", "Health");
    const stateValue = textElement("dd", `state-${engineState.assetStates[asset.id]}`, engineState.assetStates[asset.id]);
    const containmentTerm = textElement("dt", "", "Containment");
    const containmentValue = textElement("dd", "", engineState.containmentStatuses[asset.id]);
    list.append(stateTerm, stateValue, containmentTerm, containmentValue);
    item.append(list);
    ctfDom.assetSummary.append(item);
  });
}

function awardedCodesFor(scenario, engineState) {
  if (engineState === null) return [];
  return scenario.evidenceCodes.filter((code) => engineState.flags[code.flagId] === true);
}

function renderCodes() {
  const pairedDefenderInProgress = ctfUiState.mode === "paired"
    && ctfUiState.activeTrack === "defender"
    && ctfUiState.defenderState?.endingId === null;
  const awarded = [
    ...(pairedDefenderInProgress ? [] : awardedCodesFor(mangoKeepScenario, ctfUiState.threatState)),
    ...awardedCodesFor(mangoKeepIncidentScenario, ctfUiState.defenderState),
  ];
  ctfDom.codeList.replaceChildren();
  ctfDom.codesEmpty.hidden = awarded.length > 0;
  awarded.forEach((code) => {
    const item = document.createElement("li");
    item.append(textElement("strong", "", code.displayCode));
    item.append(document.createTextNode(` — ${code.title}`));
    ctfDom.codeList.append(item);
  });
}

function renderTimeline() {
  const stages = revealedStages();
  setSelectOptions(ctfDom.filterStage, stages, "All revealed stages");
  Object.entries(ctfUiState.filters).forEach(([key, value]) => {
    const control = ctfDom.filterForm.elements.namedItem(key);
    if (control) control.value = value;
  });

  const events = filteredEvents();
  ctfDom.timelineCount.textContent = `${events.length} ${events.length === 1 ? "event" : "events"} shown`;
  ctfDom.timelineEvents.replaceChildren();
  if (events.length === 0) {
    ctfDom.timelineEvents.append(textElement("p", "ctf-empty", "No revealed synthetic events match these filters."));
    return;
  }

  events.forEach((event) => {
    const card = document.createElement("article");
    card.className = "timeline-event";
    const heading = document.createElement("div");
    heading.className = "timeline-event-heading";
    heading.append(textElement("h3", "", `${event.event_id} · ${event.action}`));
    heading.append(textElement("span", `severity severity-${event.severity}`, `Severity: ${event.severity}`));
    card.append(heading);
    card.append(textElement("p", "synthetic-tag", "SYNTHETIC — FICTIONAL TRAINING DATA"));
    card.append(textElement("p", "", event.message));
    const details = document.createElement("dl");
    [["Time", event.timestamp], ["Source", event.dataset], ["Host", event.hostname], ["Stage", event.scenario_stage], ["Outcome", event.outcome]].forEach(([term, value]) => {
      details.append(textElement("dt", "", term), textElement("dd", "", value));
    });
    card.append(details);
    const bookmarked = ctfUiState.eventBookmarks.includes(event.event_id);
    const button = textElement("button", "button event-bookmark", bookmarked ? "Remove Timeline Bookmark" : "Bookmark Timeline Event");
    button.type = "button";
    button.dataset.eventId = event.event_id;
    button.setAttribute("aria-pressed", String(bookmarked));
    card.append(button);
    ctfDom.timelineEvents.append(card);
  });
}

function scoreItemsFor(scenario, engineState) {
  if (engineState === null) return [];
  const excluded = new Set(["elapsed_minutes", "evidence_footprint"]);
  return scenario.metricIds.filter((metricId) => !excluded.has(metricId)).map((metricId) => ({
    label: metricId.replaceAll("_", " "),
    value: engineState.metrics[metricId],
  }));
}

function appendScoreCard(title, items) {
  const card = document.createElement("article");
  card.className = "score-card";
  card.append(textElement("h3", "", title));
  const total = items.reduce((sum, item) => sum + item.value, 0);
  card.append(textElement("p", "score-total", `Recorded score: ${total}`));
  const list = document.createElement("dl");
  items.forEach((item) => list.append(textElement("dt", "", item.label), textElement("dd", "", String(item.value))));
  card.append(list);
  ctfDom.scoreGrid.append(card);
}

function renderEnding() {
  const { scenario } = activeBundle();
  const engineState = activeEngineState();
  const ending = scenario.endings.find((item) => item.id === engineState.endingId);
  ctfDom.endingTitle.textContent = ending.title;
  ctfDom.endingSummary.textContent = ending.summary;
  ctfDom.scoreGrid.replaceChildren();
  if (ctfUiState.mode === "paired" && ctfUiState.defenderState?.endingId) {
    appendScoreCard("Threat Simulation", scoreItemsFor(mangoKeepScenario, ctfUiState.threatState));
    appendScoreCard("Incident Response", scoreItemsFor(mangoKeepIncidentScenario, ctfUiState.defenderState));
  } else {
    appendScoreCard(MODE_LABELS[ctfUiState.activeTrack], scoreItemsFor(scenario, engineState));
  }

  ctfDom.debriefList.replaceChildren();
  const debrief = [
    `${engineState.choiceIds.length} allowlisted decisions recorded for this track.`,
    `${ctfUiState.evidenceBookmarks.length} evidence bookmarks and ${ctfUiState.eventBookmarks.length} timeline bookmarks preserved.`,
    `${Object.values(ctfUiState.evidenceNotes).filter(Boolean).length} evidence notes plus ${ctfUiState.caseNotes ? "a local case note" : "no general case note"}.`,
    `Ending state: ${ending.id}. Review the workspace to inspect remaining uncertainty and business effects.`,
  ];
  debrief.forEach((text) => ctfDom.debriefList.append(textElement("li", "", text)));
  const needsPairedHandoff = ctfUiState.mode === "paired" && ctfUiState.activeTrack === "threat";
  ctfDom.pairedContinue.hidden = !needsPairedHandoff;
  ctfDom.workspace.hidden = true;
  ctfDom.ending.hidden = false;
  ctfDom.endingTitle.focus();
}

function renderWorkspace() {
  const { scenario, evidence } = activeBundle();
  const engineState = activeEngineState();
  const node = getCurrentNode(scenario, evidence, engineState);
  const chapter = scenario.chapters.find((item) => item.id === node.chapterId);
  ctfDom.launch.hidden = true;
  ctfDom.workspace.hidden = false;
  ctfDom.ending.hidden = true;
  ctfDom.modeStatus.textContent = `${MODE_LABELS[ctfUiState.mode]} · ${ctfUiState.activeTrack === "threat" ? "Threat track" : "Defender track"}`;
  ctfDom.chapterLabel.textContent = `CHAPTER ${chapter.order}: ${chapter.title}`;
  ctfDom.nodeTitle.textContent = node.title;
  ctfDom.nodeBody.textContent = node.body;
  const firstChoice = scenario.choices.find((choice) => choice.id === node.choiceIds[0]);
  ctfDom.nodeObjective.textContent = firstChoice.objective;
  const showPairedConsequence = ctfUiState.mode === "paired"
    && ctfUiState.activeTrack === "defender"
    && typeof ctfUiState.threatState?.endingId === "string";
  ctfDom.pairedConsequence.hidden = !showPairedConsequence;
  ctfDom.pairedConsequence.textContent = showPairedConsequence
    ? getPairedConsequence(ctfUiState.threatState).summary
    : "";
  ctfDom.hint.hidden = !ctfUiState.hintShown;
  ctfDom.showHint.hidden = ctfUiState.hintShown || node.hintIds.length === 0;
  ctfDom.hintText.textContent = ctfUiState.hintShown
    ? scenario.hints.find((hint) => hint.id === node.hintIds[0])?.text ?? "No additional hint is available."
    : "";
  renderChoices(node, scenario, evidence, engineState);
  renderEvidence(scenario, evidence, engineState);
  renderAssets(scenario, engineState);
  renderCodes();
  renderTimeline();
  ctfDom.caseNotes.value = ctfUiState.caseNotes;
  ctfDom.caseNoteCount.textContent = String(ctfUiState.caseNotes.length);
  if (engineState.endingId !== null) renderEnding();
}

function startNewSimulation() {
  const mode = document.querySelector('input[name="ctf-mode"]:checked').value;
  ctfUiState = createFreshUiState(mode);
  ctfDom.feedback.hidden = true;
  persist("New save created");
  renderWorkspace();
  ctfDom.nodeTitle.focus();
  announce(`${MODE_LABELS[mode]} started. ${ctfDom.nodeTitle.textContent}`);
}

function toggleId(list, id) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function applySelectedChoice(choiceId) {
  const { scenario, evidence } = activeBundle();
  const engineState = activeEngineState();
  const choice = scenario.choices.find((item) => item.id === choiceId);
  const available = getAvailableChoices(scenario, evidence, engineState).some((item) => item.id === choiceId);
  if (!choice || !available) {
    announce("That action is unavailable. Review its prerequisite explanation.");
    return;
  }
  try {
    const nextState = applyChoice(scenario, evidence, engineState, choiceId);
    setActiveEngineState(nextState);
    ctfUiState.hintShown = false;
    ctfDom.feedback.hidden = false;
    ctfDom.feedback.replaceChildren(
      textElement("h3", "", "Decision Recorded"),
      textElement("p", "", choice.outcomeText),
      textElement("p", "", choice.learningConsequence),
    );
    persist();
    renderWorkspace();
    if (nextState.endingId === null) {
      ctfDom.nodeTitle.focus();
      announce(`Decision recorded. ${ctfDom.nodeTitle.textContent}`);
    }
  } catch {
    announce("The deterministic engine rejected that state change. The current state is unchanged.");
  }
}

function continuePairedMode() {
  ctfUiState.activeTrack = "defender";
  ctfUiState.defenderState = startScenario(mangoKeepIncidentScenario, mangoKeepIncidentEvidence, "defender");
  ctfUiState.filters = { ...EMPTY_FILTERS };
  ctfUiState.hintShown = false;
  ctfDom.feedback.hidden = true;
  persist("Paired handoff saved");
  renderWorkspace();
  ctfDom.nodeTitle.focus();
  announce("Paired handoff complete. Incident Response begins with the initial synthetic edge alert.");
}

function openResetDialog(trigger) {
  lastResetTrigger = trigger;
  ctfDom.resetDialog.showModal();
  ctfDom.cancelReset.focus();
}

function resetSimulation() {
  removeUiSave();
  cachedSave = null;
  ctfUiState = null;
  ctfDom.resetDialog.close();
  ctfDom.workspace.hidden = true;
  ctfDom.ending.hidden = true;
  ctfDom.launch.hidden = false;
  ctfDom.resume.hidden = true;
  ctfDom.resetLaunch.hidden = true;
  ctfDom.storageNote.textContent = "No local CTF save is present. Starting creates a new versioned browser save.";
  ctfDom.start.focus();
  announce("Local CTF save, bookmarks, and notes were removed.");
}

function initializeSavedState() {
  const loaded = loadUiSave(uiAllowlists);
  if (loaded.status === "valid") {
    cachedSave = loaded.value;
    ctfDom.resume.hidden = false;
    ctfDom.resetLaunch.hidden = false;
    ctfDom.storageNote.textContent = `A valid ${MODE_LABELS[cachedSave.mode]} save is available in this browser.`;
  } else if (loaded.status === "invalid") {
    ctfDom.storageNote.textContent = "A local save exists but is malformed or obsolete. Reset it before starting a replacement.";
    ctfDom.resetLaunch.hidden = false;
  } else if (loaded.status === "unavailable") {
    ctfDom.storageNote.textContent = "Browser storage is unavailable. Play remains deterministic, but progress cannot persist.";
  }
}

ctfDom.start.addEventListener("click", startNewSimulation);
ctfDom.resume.addEventListener("click", () => {
  if (!restoreCachedSave()) {
    announce("The saved state failed deterministic replay and was not loaded.");
    ctfDom.storageNote.textContent = "The save failed deterministic replay. Reset it before starting a replacement.";
    return;
  }
  renderWorkspace();
  if (activeEngineState().endingId === null) ctfDom.nodeTitle.focus();
  announce(`${MODE_LABELS[ctfUiState.mode]} resumed.`);
});
ctfDom.choices.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-choice-id]");
  if (button) applySelectedChoice(button.dataset.choiceId);
});
ctfDom.showHint.addEventListener("click", () => {
  ctfUiState.hintShown = true;
  persist();
  renderWorkspace();
  ctfDom.hint.focus?.();
  announce("Learning hint revealed. Hints do not change the deterministic scenario state.");
});
ctfDom.evidenceList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-evidence-id]");
  if (!button) return;
  ctfUiState.evidenceBookmarks = toggleId(ctfUiState.evidenceBookmarks, button.dataset.evidenceId);
  const isBookmarked = ctfUiState.evidenceBookmarks.includes(button.dataset.evidenceId);
  const evidenceId = button.dataset.evidenceId;
  persist();
  const { scenario, evidence } = activeBundle();
  renderEvidence(scenario, evidence, activeEngineState());
  ctfDom.evidenceList.querySelector(`[data-evidence-id="${evidenceId}"]`)?.focus();
  announce(isBookmarked ? "Evidence bookmarked." : "Evidence bookmark removed.");
});
ctfDom.evidenceList.addEventListener("input", (event) => {
  const note = event.target.closest("textarea[data-evidence-note]");
  if (!note) return;
  ctfUiState.evidenceNotes[note.dataset.evidenceNote] = note.value;
  persist();
});
ctfDom.timelineEvents.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-event-id]");
  if (!button) return;
  ctfUiState.eventBookmarks = toggleId(ctfUiState.eventBookmarks, button.dataset.eventId);
  const isBookmarked = ctfUiState.eventBookmarks.includes(button.dataset.eventId);
  const eventId = button.dataset.eventId;
  persist();
  renderTimeline();
  ctfDom.timelineEvents.querySelector(`[data-event-id="${eventId}"]`)?.focus();
  announce(isBookmarked ? "Timeline event bookmarked." : "Timeline bookmark removed.");
});
ctfDom.filterForm.addEventListener("change", () => {
  ctfUiState.filters = {
    source: ctfDom.filterSource.value,
    host: ctfDom.filterHost.value,
    severity: ctfDom.filterSeverity.value,
    stage: ctfDom.filterStage.value,
    from: ctfDom.filterFrom.value,
    to: ctfDom.filterTo.value,
  };
  persist();
  renderTimeline();
  announce(ctfDom.timelineCount.textContent);
});
ctfDom.clearFilters.addEventListener("click", () => {
  ctfUiState.filters = { ...EMPTY_FILTERS };
  persist();
  renderTimeline();
  announce("Timeline filters cleared.");
});
ctfDom.caseNotes.addEventListener("input", () => {
  ctfUiState.caseNotes = ctfDom.caseNotes.value;
  ctfDom.caseNoteCount.textContent = String(ctfUiState.caseNotes.length);
  persist();
});
ctfDom.saveNow.addEventListener("click", () => announce(persist("Saved by player") ? "Simulation saved locally." : "Local save is unavailable."));
ctfDom.pairedContinue.addEventListener("click", continuePairedMode);
ctfDom.endingReview.addEventListener("click", () => {
  ctfDom.workspace.hidden = false;
  ctfDom.nodeTitle.focus();
});
[ctfDom.reset, ctfDom.resetLaunch, ctfDom.endingReset].forEach((button) => button.addEventListener("click", () => openResetDialog(button)));
ctfDom.confirmReset.addEventListener("click", resetSimulation);
ctfDom.cancelReset.addEventListener("click", () => ctfDom.resetDialog.close());
ctfDom.resetDialog.addEventListener("close", () => {
  if (lastResetTrigger && document.body.contains(lastResetTrigger)) lastResetTrigger.focus();
});

initializeFilterControls();
initializeSavedState();
