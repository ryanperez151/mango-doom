// Pure deterministic state operations. Inputs are validated before use and
// every update returns a new state object instead of mutating the old one.

import {
  CtfContractError,
  SAVE_SCHEMA_VERSION,
  assertSaveText,
  validateScenario,
  validateStateShape,
} from "./contracts.js";

function uniqueAppend(items, value) {
  return items.includes(value) ? items : [...items, value];
}

function cloneState(state) {
  return {
    saveVersion: state.saveVersion,
    schemaVersion: state.schemaVersion,
    scenarioId: state.scenarioId,
    perspective: state.perspective,
    currentNodeId: state.currentNodeId,
    flags: { ...state.flags },
    metrics: { ...state.metrics },
    assetStates: { ...state.assetStates },
    containmentStatuses: { ...state.containmentStatuses },
    unlockedEvidenceIds: [...state.unlockedEvidenceIds],
    emittedEventIds: [...state.emittedEventIds],
    choiceIds: [...state.choiceIds],
    endingId: state.endingId,
  };
}

function prerequisiteIsMet(prerequisite, state) {
  if (prerequisite.type === "flagEquals") return state.flags[prerequisite.flagId] === prerequisite.value;
  if (prerequisite.type === "metricAtLeast") return state.metrics[prerequisite.metricId] >= prerequisite.value;
  if (prerequisite.type === "evidenceUnlocked") return state.unlockedEvidenceIds.includes(prerequisite.evidenceId);
  if (prerequisite.type === "assetStateEquals") return state.assetStates[prerequisite.assetId] === prerequisite.state;
  if (prerequisite.type === "containmentStatusEquals") return state.containmentStatuses[prerequisite.assetId] === prerequisite.status;
  if (prerequisite.type === "choiceApplied") return state.choiceIds.includes(prerequisite.choiceId);
  return false;
}

function prerequisitesAreMet(prerequisites, state) {
  return prerequisites.every((prerequisite) => prerequisiteIsMet(prerequisite, state));
}

function applyEffect(state, effect) {
  const nextState = cloneState(state);

  if (effect.type === "setFlag") {
    nextState.flags[effect.flagId] = effect.value;
  } else if (effect.type === "unlockEvidence") {
    nextState.unlockedEvidenceIds = uniqueAppend(nextState.unlockedEvidenceIds, effect.evidenceId);
  } else if (effect.type === "incrementMetric") {
    nextState.metrics[effect.metricId] += effect.amount;
  } else if (effect.type === "updateAssetState") {
    nextState.assetStates[effect.assetId] = effect.state;
  } else if (effect.type === "setContainmentStatus") {
    nextState.containmentStatuses[effect.assetId] = effect.status;
  } else if (effect.type === "emitEvents") {
    effect.eventIds.forEach((eventId) => {
      nextState.emittedEventIds = uniqueAppend(nextState.emittedEventIds, eventId);
    });
  } else {
    throw new CtfContractError(`effect: unknown effect type ${String(effect.type)}`);
  }

  return nextState;
}

export function startScenario(scenario, evidenceCatalog, perspectiveId) {
  validateScenario(scenario, evidenceCatalog);
  const perspective = scenario.perspectives.find((item) => item.id === perspectiveId);
  if (!perspective) throw new CtfContractError(`perspective: unknown perspective ${String(perspectiveId)}`);

  const state = {
    saveVersion: SAVE_SCHEMA_VERSION,
    schemaVersion: scenario.schemaVersion,
    scenarioId: scenario.scenarioId,
    perspective: perspective.id,
    currentNodeId: perspective.initialNodeId,
    flags: Object.fromEntries(scenario.flagDefinitions.map((definition) => [definition.id, definition.initialValue])),
    metrics: Object.fromEntries(scenario.metricIds.map((metricId) => [metricId, 0])),
    assetStates: Object.fromEntries(scenario.assets.map((asset) => [asset.id, asset.initialState])),
    containmentStatuses: Object.fromEntries(scenario.assets.map((asset) => [asset.id, asset.initialContainmentStatus])),
    unlockedEvidenceIds: [...perspective.initialEvidenceIds],
    emittedEventIds: [],
    choiceIds: [],
    endingId: null,
  };

  validateStateShape(state, scenario, evidenceCatalog);
  return state;
}

export function getCurrentNode(scenario, evidenceCatalog, state) {
  validateStateShape(state, scenario, evidenceCatalog);
  return scenario.nodes.find((node) => node.id === state.currentNodeId);
}

export function getAvailableChoices(scenario, evidenceCatalog, state) {
  validateStateShape(state, scenario, evidenceCatalog);
  if (state.endingId !== null) return [];

  const node = getCurrentNode(scenario, evidenceCatalog, state);
  return node.choiceIds
    .map((choiceId) => scenario.choices.find((choice) => choice.id === choiceId))
    .filter((choice) => choice && prerequisitesAreMet(choice.prerequisites, state));
}

export function applyChoice(scenario, evidenceCatalog, state, choiceId) {
  validateStateShape(state, scenario, evidenceCatalog);
  if (state.endingId !== null) throw new CtfContractError("choice: the scenario has already ended");

  const choice = getAvailableChoices(scenario, evidenceCatalog, state).find((item) => item.id === choiceId);
  if (!choice) throw new CtfContractError(`choice: unavailable or unknown choice ${String(choiceId)}`);

  let nextState = cloneState(state);
  choice.effects.forEach((effect) => {
    nextState = applyEffect(nextState, effect);
  });
  nextState.choiceIds = [...nextState.choiceIds, choice.id];

  if (choice.nextNodeId !== null) {
    nextState.currentNodeId = choice.nextNodeId;
  } else {
    const ending = scenario.endings.find((item) => item.id === choice.endingId);
    if (!ending || !prerequisitesAreMet(ending.prerequisites, nextState)) {
      throw new CtfContractError("choice: ending prerequisites were not met");
    }
    nextState.endingId = ending.id;
  }

  validateStateShape(nextState, scenario, evidenceCatalog);
  return nextState;
}

export function getVisibleEvidence(scenario, evidenceCatalog, state) {
  validateStateShape(state, scenario, evidenceCatalog);
  const visibleIds = new Set(state.unlockedEvidenceIds);
  return evidenceCatalog.records.filter((record) => visibleIds.has(record.id));
}

export function serializeState(scenario, evidenceCatalog, state) {
  validateStateShape(state, scenario, evidenceCatalog);
  return JSON.stringify(cloneState(state));
}

export function restoreState(scenario, evidenceCatalog, serialized) {
  validateScenario(scenario, evidenceCatalog);
  assertSaveText(serialized);

  let candidate;
  try {
    candidate = JSON.parse(serialized);
  } catch {
    throw new CtfContractError("save: malformed JSON");
  }

  validateStateShape(candidate, scenario, evidenceCatalog);

  // Rebuild the save from its choice history. This rejects impossible or
  // manually altered states rather than partially trusting them.
  let replayed = startScenario(scenario, evidenceCatalog, candidate.perspective);
  candidate.choiceIds.forEach((choiceId) => {
    replayed = applyChoice(scenario, evidenceCatalog, replayed, choiceId);
  });

  if (JSON.stringify(replayed) !== JSON.stringify(candidate)) {
    throw new CtfContractError("save: state does not match its deterministic choice history");
  }

  return replayed;
}

