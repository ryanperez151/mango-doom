// Data contracts for the CTF. This module validates inert data only; it never
// turns scenario strings into code, HTML, selectors, paths, or network targets.

export const SCENARIO_SCHEMA_VERSION = 1;
export const SAVE_SCHEMA_VERSION = 1;

export const EFFECT_TYPES = Object.freeze([
  "setFlag",
  "unlockEvidence",
  "incrementMetric",
  "updateAssetState",
  "setContainmentStatus",
  "emitEvents",
]);

const PERSPECTIVE_IDS = ["threat", "defender"];
const ASSET_STATES = ["normal", "suspected", "affected", "contained", "recovering", "restored"];
const CONTAINMENT_STATUSES = ["none", "scoped", "isolated", "recovering", "released"];
const EVIDENCE_KINDS = ["evidence", "telemetry"];
const SOURCE_TYPES = [
  "ngfw",
  "network",
  "virtualization",
  "identity",
  "endpoint",
  "change_control",
  "analyst_note",
];
const SYNTHETIC_LABEL = "[SYNTHETIC — FICTIONAL TRAINING DATA]";
const INSTRUCTOR_ONLY_TEXT = /\b(?:instructor|facilitator)[ _-]?only\b/i;
const SAFE_ID = /^[a-z][a-z0-9_]{0,63}$/;
const FICTIONAL_HOSTNAME = /^(?:[a-z0-9-]+\.)+invalid$/;
const DOCUMENTATION_IP = /^(?:192\.0\.2|198\.51\.100|203\.0\.113)\.(?:0|[1-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(?:\/(?:[0-9]|[12][0-9]|3[0-2]))?$/;
const MAX_SAVE_LENGTH = 20000;

export class CtfContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "CtfContractError";
  }
}

function reject(path, message) {
  throw new CtfContractError(`${path}: ${message}`);
}

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertRecord(value, path) {
  if (!isRecord(value)) {
    reject(path, "must be a plain object");
  }
}

function assertExactKeys(value, keys, path) {
  assertRecord(value, path);
  const allowed = new Set(keys);

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      reject(path, `contains unknown field ${key}`);
    }
  }

  for (const key of keys) {
    if (!Object.hasOwn(value, key)) {
      reject(path, `is missing field ${key}`);
    }
  }
}

function assertArray(value, path, minimum = 0, maximum = 100) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    reject(path, `must contain between ${minimum} and ${maximum} items`);
  }
}

function assertBoolean(value, path) {
  if (typeof value !== "boolean") {
    reject(path, "must be a boolean");
  }
}

function assertInteger(value, path, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    reject(path, `must be an integer from ${minimum} through ${maximum}`);
  }
}

function assertEnum(value, values, path) {
  if (!values.includes(value)) {
    reject(path, `must be one of: ${values.join(", ")}`);
  }
}

function assertId(value, path) {
  if (typeof value !== "string" || !SAFE_ID.test(value)) {
    reject(path, "must be a lowercase allowlist-style ID");
  }
}

function assertText(value, path, maximum = 500) {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum) {
    reject(path, `must be text between 1 and ${maximum} characters`);
  }

  if (/[<>]/.test(value) || /\$\{|\{\{|\}\}/.test(value) || /[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    reject(path, "must be inert text without markup, templates, or URLs");
  }
  if (INSTRUCTOR_ONLY_TEXT.test(value)) {
    reject(path, "must not expose instructor-only narrative to the learner data model");
  }
}

function assertNullableId(value, path) {
  if (value !== null) {
    assertId(value, path);
  }
}

function assertUniqueIds(items, path) {
  const ids = new Set();
  items.forEach((item, index) => {
    assertId(item.id, `${path}[${index}].id`);
    if (ids.has(item.id)) {
      reject(path, `contains duplicate ID ${item.id}`);
    }
    ids.add(item.id);
  });
  return ids;
}

function assertIdArray(value, path, knownIds = null) {
  assertArray(value, path);
  const seen = new Set();

  value.forEach((id, index) => {
    assertId(id, `${path}[${index}]`);
    if (seen.has(id)) {
      reject(path, `contains duplicate ID ${id}`);
    }
    if (knownIds && !knownIds.has(id)) {
      reject(path, `references unknown ID ${id}`);
    }
    seen.add(id);
  });
}

function assertScalar(value, path) {
  if (typeof value === "boolean" || typeof value === "string") {
    if (typeof value === "string") {
      assertText(value, path, 80);
    }
    return;
  }

  reject(path, "must be a boolean or short inert string");
}

function assertInertTree(value, path = "data") {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertInertTree(item, `${path}[${index}]`));
    return;
  }
  if (isRecord(value)) {
    Object.entries(value).forEach(([key, item]) => {
      if (key === "__proto__" || key === "prototype" || key === "constructor") {
        reject(path, `contains unsafe key ${key}`);
      }
      assertInertTree(item, `${path}.${key}`);
    });
    return;
  }
  reject(path, "contains a non-data value");
}

function assertPrerequisite(prerequisite, path, references) {
  assertRecord(prerequisite, path);
  assertEnum(
    prerequisite.type,
    ["flagEquals", "metricAtLeast", "evidenceUnlocked", "assetStateEquals", "containmentStatusEquals", "choiceApplied"],
    `${path}.type`,
  );

  if (prerequisite.type === "flagEquals") {
    assertExactKeys(prerequisite, ["type", "flagId", "value"], path);
    assertId(prerequisite.flagId, `${path}.flagId`);
    if (!references.flagIds.has(prerequisite.flagId)) reject(path, "references an unknown flag");
    const definition = references.flagDefinitions.get(prerequisite.flagId);
    if (!definition.allowedValues.includes(prerequisite.value)) reject(path, "uses a disallowed flag value");
  } else if (prerequisite.type === "metricAtLeast") {
    assertExactKeys(prerequisite, ["type", "metricId", "value"], path);
    assertId(prerequisite.metricId, `${path}.metricId`);
    if (!references.metricIds.has(prerequisite.metricId)) reject(path, "references an unknown metric");
    assertInteger(prerequisite.value, `${path}.value`, -1000, 1000);
  } else if (prerequisite.type === "evidenceUnlocked") {
    assertExactKeys(prerequisite, ["type", "evidenceId"], path);
    assertId(prerequisite.evidenceId, `${path}.evidenceId`);
    if (!references.evidenceIds.has(prerequisite.evidenceId)) reject(path, "references unknown evidence");
  } else if (prerequisite.type === "assetStateEquals") {
    assertExactKeys(prerequisite, ["type", "assetId", "state"], path);
    assertId(prerequisite.assetId, `${path}.assetId`);
    if (!references.assetIds.has(prerequisite.assetId)) reject(path, "references an unknown asset");
    assertEnum(prerequisite.state, ASSET_STATES, `${path}.state`);
  } else if (prerequisite.type === "containmentStatusEquals") {
    assertExactKeys(prerequisite, ["type", "assetId", "status"], path);
    assertId(prerequisite.assetId, `${path}.assetId`);
    if (!references.assetIds.has(prerequisite.assetId)) reject(path, "references an unknown asset");
    assertEnum(prerequisite.status, CONTAINMENT_STATUSES, `${path}.status`);
  } else {
    assertExactKeys(prerequisite, ["type", "choiceId"], path);
    assertId(prerequisite.choiceId, `${path}.choiceId`);
    if (!references.choiceIds.has(prerequisite.choiceId)) reject(path, "references an unknown choice");
  }
}

function assertEffect(effect, path, references) {
  assertRecord(effect, path);
  assertEnum(effect.type, EFFECT_TYPES, `${path}.type`);

  if (effect.type === "setFlag") {
    assertExactKeys(effect, ["type", "flagId", "value"], path);
    assertId(effect.flagId, `${path}.flagId`);
    if (!references.flagIds.has(effect.flagId)) reject(path, "references an unknown flag");
    const definition = references.flagDefinitions.get(effect.flagId);
    if (!definition.allowedValues.includes(effect.value)) reject(path, "uses a disallowed flag value");
  } else if (effect.type === "unlockEvidence") {
    assertExactKeys(effect, ["type", "evidenceId"], path);
    assertId(effect.evidenceId, `${path}.evidenceId`);
    if (!references.evidenceIds.has(effect.evidenceId)) reject(path, "references unknown evidence");
  } else if (effect.type === "incrementMetric") {
    assertExactKeys(effect, ["type", "metricId", "amount"], path);
    assertId(effect.metricId, `${path}.metricId`);
    if (!references.metricIds.has(effect.metricId)) reject(path, "references an unknown metric");
    assertInteger(effect.amount, `${path}.amount`, -100, 100);
  } else if (effect.type === "updateAssetState") {
    assertExactKeys(effect, ["type", "assetId", "state"], path);
    assertId(effect.assetId, `${path}.assetId`);
    if (!references.assetIds.has(effect.assetId)) reject(path, "references an unknown asset");
    assertEnum(effect.state, ASSET_STATES, `${path}.state`);
  } else if (effect.type === "setContainmentStatus") {
    assertExactKeys(effect, ["type", "assetId", "status"], path);
    assertId(effect.assetId, `${path}.assetId`);
    if (!references.assetIds.has(effect.assetId)) reject(path, "references an unknown asset");
    assertEnum(effect.status, CONTAINMENT_STATUSES, `${path}.status`);
  } else {
    assertExactKeys(effect, ["type", "eventIds"], path);
    assertIdArray(effect.eventIds, `${path}.eventIds`, references.eventIds);
  }
}

export function validateEvidenceCatalog(catalog, expectedScenarioId = null) {
  assertInertTree(catalog, "evidenceCatalog");
  assertExactKeys(catalog, ["schemaVersion", "scenarioId", "records"], "evidenceCatalog");
  if (catalog.schemaVersion !== SCENARIO_SCHEMA_VERSION) reject("evidenceCatalog.schemaVersion", "is unsupported");
  assertId(catalog.scenarioId, "evidenceCatalog.scenarioId");
  if (expectedScenarioId !== null && catalog.scenarioId !== expectedScenarioId) {
    reject("evidenceCatalog.scenarioId", "does not match the scenario");
  }
  assertArray(catalog.records, "evidenceCatalog.records", 1);
  const evidenceIds = assertUniqueIds(catalog.records, "evidenceCatalog.records");

  catalog.records.forEach((record, index) => {
    const path = `evidenceCatalog.records[${index}]`;
    assertExactKeys(record, ["id", "kind", "synthetic", "syntheticLabel", "sourceType", "timestamp", "assetIds", "summary", "tags"], path);
    assertEnum(record.kind, EVIDENCE_KINDS, `${path}.kind`);
    if (record.synthetic !== true) reject(`${path}.synthetic`, "must be true");
    if (record.syntheticLabel !== SYNTHETIC_LABEL) reject(`${path}.syntheticLabel`, "must use the required visible label");
    assertEnum(record.sourceType, SOURCE_TYPES, `${path}.sourceType`);
    assertText(record.timestamp, `${path}.timestamp`, 40);
    assertIdArray(record.assetIds, `${path}.assetIds`);
    assertText(record.summary, `${path}.summary`);
    assertArray(record.tags, `${path}.tags`, 0, 20);
    record.tags.forEach((tag, tagIndex) => assertId(tag, `${path}.tags[${tagIndex}]`));
  });

  return { evidenceIds };
}

export function validateScenario(scenario, evidenceCatalog) {
  assertInertTree(scenario, "scenario");
  assertExactKeys(
    scenario,
    [
      "schemaVersion", "scenarioId", "title", "summary", "syntheticLabel", "perspectives", "assets",
      "metricIds", "flagDefinitions", "evidenceCodes", "eventIds", "chapters", "nodes", "choices", "hints",
      "learningNotes", "endings",
    ],
    "scenario",
  );
  if (scenario.schemaVersion !== SCENARIO_SCHEMA_VERSION) reject("scenario.schemaVersion", "is unsupported");
  assertId(scenario.scenarioId, "scenario.scenarioId");
  assertText(scenario.title, "scenario.title", 120);
  assertText(scenario.summary, "scenario.summary");
  if (scenario.syntheticLabel !== SYNTHETIC_LABEL) reject("scenario.syntheticLabel", "must use the required visible label");

  const { evidenceIds } = validateEvidenceCatalog(evidenceCatalog, scenario.scenarioId);

  assertArray(scenario.assets, "scenario.assets", 1, 30);
  const assetIds = assertUniqueIds(scenario.assets, "scenario.assets");
  scenario.assets.forEach((asset, index) => {
    const path = `scenario.assets[${index}]`;
    assertExactKeys(asset, ["id", "label", "hostname", "address", "initialState", "initialContainmentStatus"], path);
    assertText(asset.label, `${path}.label`, 100);
    if (typeof asset.hostname !== "string" || !FICTIONAL_HOSTNAME.test(asset.hostname)) reject(`${path}.hostname`, "must end in .invalid");
    if (typeof asset.address !== "string" || !DOCUMENTATION_IP.test(asset.address)) reject(`${path}.address`, "must use a documentation address");
    assertEnum(asset.initialState, ASSET_STATES, `${path}.initialState`);
    assertEnum(asset.initialContainmentStatus, CONTAINMENT_STATUSES, `${path}.initialContainmentStatus`);
  });

  assertIdArray(scenario.metricIds, "scenario.metricIds");
  const metricIds = new Set(scenario.metricIds);
  assertArray(scenario.flagDefinitions, "scenario.flagDefinitions", 1, 50);
  const flagIds = assertUniqueIds(scenario.flagDefinitions, "scenario.flagDefinitions");
  const flagDefinitions = new Map();
  scenario.flagDefinitions.forEach((definition, index) => {
    const path = `scenario.flagDefinitions[${index}]`;
    assertExactKeys(definition, ["id", "initialValue", "allowedValues"], path);
    assertArray(definition.allowedValues, `${path}.allowedValues`, 1, 10);
    definition.allowedValues.forEach((value, valueIndex) => assertScalar(value, `${path}.allowedValues[${valueIndex}]`));
    const allowedKeys = definition.allowedValues.map((value) => `${typeof value}:${String(value)}`);
    if (new Set(allowedKeys).size !== allowedKeys.length) reject(path, "contains duplicate allowed values");
    if (!definition.allowedValues.includes(definition.initialValue)) reject(`${path}.initialValue`, "is not in allowedValues");
    flagDefinitions.set(definition.id, definition);
  });

  assertArray(scenario.evidenceCodes, "scenario.evidenceCodes", 1, 30);
  const evidenceCodeIds = assertUniqueIds(scenario.evidenceCodes, "scenario.evidenceCodes");
  const evidenceCodeById = new Map();
  scenario.evidenceCodes.forEach((code, index) => {
    const path = `scenario.evidenceCodes[${index}]`;
    assertExactKeys(code, ["id", "displayCode", "title", "flagId"], path);
    assertText(code.displayCode, `${path}.displayCode`, 80);
    assertText(code.title, `${path}.title`, 120);
    assertId(code.flagId, `${path}.flagId`);
    if (!flagIds.has(code.flagId)) reject(`${path}.flagId`, "references an unknown flag");
    const definition = flagDefinitions.get(code.flagId);
    if (!definition.allowedValues.includes(true)) reject(`${path}.flagId`, "must reference a boolean award flag");
    evidenceCodeById.set(code.id, code);
  });

  assertIdArray(scenario.eventIds, "scenario.eventIds");
  const eventIds = new Set(scenario.eventIds);
  scenario.eventIds.forEach((eventId, index) => {
    if (!eventId.startsWith("syn_evt_")) {
      reject(`scenario.eventIds[${index}]`, "must use the synthetic event ID prefix syn_evt_");
    }
  });
  assertArray(scenario.choices, "scenario.choices", 1, 100);
  const choiceIds = assertUniqueIds(scenario.choices, "scenario.choices");
  assertArray(scenario.nodes, "scenario.nodes", 1, 100);
  const nodeIds = assertUniqueIds(scenario.nodes, "scenario.nodes");
  assertArray(scenario.chapters, "scenario.chapters", 1, 20);
  const chapterIds = assertUniqueIds(scenario.chapters, "scenario.chapters");
  assertArray(scenario.hints, "scenario.hints", 1, 100);
  const hintIds = assertUniqueIds(scenario.hints, "scenario.hints");
  assertArray(scenario.learningNotes, "scenario.learningNotes", 1, 100);
  const learningNoteIds = assertUniqueIds(scenario.learningNotes, "scenario.learningNotes");
  assertArray(scenario.endings, "scenario.endings", 1, 30);
  const endingIds = assertUniqueIds(scenario.endings, "scenario.endings");

  const references = { assetIds, metricIds, flagIds, flagDefinitions, evidenceCodeIds, eventIds, choiceIds, evidenceIds };

  assertArray(scenario.perspectives, "scenario.perspectives", 2, 2);
  const perspectiveIds = assertUniqueIds(scenario.perspectives, "scenario.perspectives");
  if (perspectiveIds.size !== PERSPECTIVE_IDS.length || PERSPECTIVE_IDS.some((id) => !perspectiveIds.has(id))) {
    reject("scenario.perspectives", "must define exactly threat and defender");
  }
  scenario.perspectives.forEach((perspective, index) => {
    const path = `scenario.perspectives[${index}]`;
    assertExactKeys(perspective, ["id", "title", "initialNodeId", "initialEvidenceIds"], path);
    assertText(perspective.title, `${path}.title`, 100);
    if (!nodeIds.has(perspective.initialNodeId)) reject(`${path}.initialNodeId`, "references an unknown node");
    assertIdArray(perspective.initialEvidenceIds, `${path}.initialEvidenceIds`, evidenceIds);
  });

  scenario.hints.forEach((hint, index) => {
    const path = `scenario.hints[${index}]`;
    assertExactKeys(hint, ["id", "level", "text"], path);
    assertInteger(hint.level, `${path}.level`, 1, 3);
    assertText(hint.text, `${path}.text`);
  });

  scenario.learningNotes.forEach((note, index) => {
    const path = `scenario.learningNotes[${index}]`;
    assertExactKeys(note, ["id", "title", "text"], path);
    assertText(note.title, `${path}.title`, 100);
    assertText(note.text, `${path}.text`);
  });

  const nodeById = new Map(scenario.nodes.map((node) => [node.id, node]));
  const chapterById = new Map(scenario.chapters.map((chapter) => [chapter.id, chapter]));
  const chapterOrders = new Set();
  scenario.chapters.forEach((chapter, index) => {
    const path = `scenario.chapters[${index}]`;
    assertExactKeys(chapter, ["id", "order", "title", "perspectiveIds", "nodeIds", "learningNoteIds"], path);
    assertInteger(chapter.order, `${path}.order`, 1, 20);
    if (chapterOrders.has(chapter.order)) reject(`${path}.order`, "duplicates another chapter order");
    chapterOrders.add(chapter.order);
    assertText(chapter.title, `${path}.title`, 120);
    assertIdArray(chapter.perspectiveIds, `${path}.perspectiveIds`, perspectiveIds);
    assertIdArray(chapter.nodeIds, `${path}.nodeIds`, nodeIds);
    assertIdArray(chapter.learningNoteIds, `${path}.learningNoteIds`, learningNoteIds);
    chapter.nodeIds.forEach((nodeId) => {
      const node = nodeById.get(nodeId);
      if (node.chapterId !== chapter.id) reject(`${path}.nodeIds`, `node ${nodeId} belongs to another chapter`);
      if (!chapter.perspectiveIds.includes(node.perspectiveId)) reject(`${path}.perspectiveIds`, `does not include node ${nodeId}'s perspective`);
    });
  });

  const choiceById = new Map(scenario.choices.map((choice) => [choice.id, choice]));
  scenario.nodes.forEach((node, index) => {
    const path = `scenario.nodes[${index}]`;
    assertExactKeys(node, ["id", "chapterId", "perspectiveId", "title", "body", "evidenceIds", "hintIds", "choiceIds"], path);
    if (!chapterIds.has(node.chapterId)) reject(`${path}.chapterId`, "references an unknown chapter");
    assertEnum(node.perspectiveId, PERSPECTIVE_IDS, `${path}.perspectiveId`);
    assertText(node.title, `${path}.title`, 120);
    assertText(node.body, `${path}.body`);
    assertIdArray(node.evidenceIds, `${path}.evidenceIds`, evidenceIds);
    assertIdArray(node.hintIds, `${path}.hintIds`, hintIds);
    assertIdArray(node.choiceIds, `${path}.choiceIds`, choiceIds);
    if (node.choiceIds.length === 0) reject(`${path}.choiceIds`, "must provide at least one bounded action");
    if (!chapterById.get(node.chapterId).nodeIds.includes(node.id)) reject(path, "is not listed by its chapter");
    if (!chapterById.get(node.chapterId).perspectiveIds.includes(node.perspectiveId)) reject(path, "uses a perspective not listed by its chapter");
    node.choiceIds.forEach((choiceId) => {
      if (choiceById.get(choiceId).nodeId !== node.id) reject(`${path}.choiceIds`, `choice ${choiceId} belongs to another node`);
    });
    if (!node.choiceIds.some((choiceId) => choiceById.get(choiceId).prerequisites.length === 0)) {
      reject(`${path}.choiceIds`, "creates a possible nonterminal dead end because every action is gated");
    }
  });

  scenario.perspectives.forEach((perspective) => {
    if (nodeById.get(perspective.initialNodeId).perspectiveId !== perspective.id) {
      reject(`scenario.perspectives.${perspective.id}.initialNodeId`, "points to another perspective");
    }
  });

  const endingById = new Map(scenario.endings.map((ending) => [ending.id, ending]));
  scenario.choices.forEach((choice, index) => {
    const path = `scenario.choices[${index}]`;
    assertExactKeys(choice, ["id", "nodeId", "label", "objective", "prerequisiteSummary", "outcomeText", "learningConsequence", "awardCodeId", "prerequisites", "effects", "nextNodeId", "endingId"], path);
    if (!nodeIds.has(choice.nodeId)) reject(`${path}.nodeId`, "references an unknown node");
    assertText(choice.label, `${path}.label`, 160);
    assertText(choice.objective, `${path}.objective`);
    assertText(choice.prerequisiteSummary, `${path}.prerequisiteSummary`);
    assertText(choice.outcomeText, `${path}.outcomeText`);
    assertText(choice.learningConsequence, `${path}.learningConsequence`);
    assertNullableId(choice.awardCodeId, `${path}.awardCodeId`);
    if (choice.awardCodeId !== null && !evidenceCodeIds.has(choice.awardCodeId)) reject(`${path}.awardCodeId`, "references an unknown evidence code");
    assertArray(choice.prerequisites, `${path}.prerequisites`, 0, 20);
    choice.prerequisites.forEach((item, itemIndex) => assertPrerequisite(item, `${path}.prerequisites[${itemIndex}]`, references));
    assertArray(choice.effects, `${path}.effects`, 0, 20);
    choice.effects.forEach((item, itemIndex) => assertEffect(item, `${path}.effects[${itemIndex}]`, references));
    if (choice.awardCodeId !== null) {
      const award = evidenceCodeById.get(choice.awardCodeId);
      if (!choice.effects.some((effect) => effect.type === "setFlag" && effect.flagId === award.flagId && effect.value === true)) {
        reject(`${path}.effects`, "does not set the flag for its awarded evidence code");
      }
    }
    if (nodeById.get(choice.nodeId).perspectiveId === "threat") {
      if (!choice.effects.some((effect) => effect.type === "emitEvents")) {
        reject(`${path}.effects`, "every threat choice must declare at least one synthetic emitted event");
      }
      if (!choice.effects.some((effect) => effect.type === "updateAssetState")) {
        reject(`${path}.effects`, "every threat choice must declare an asset-state update");
      }
      if (!choice.effects.some((effect) => effect.type === "incrementMetric" && effect.metricId === "elapsed_minutes" && effect.amount > 0)) {
        reject(`${path}.effects`, "every threat choice must advance deterministic elapsed time");
      }
      if (!choice.effects.some((effect) => effect.type === "incrementMetric" && effect.metricId === "evidence_footprint" && effect.amount > 0)) {
        reject(`${path}.effects`, "every threat choice must increase the defender-visible evidence footprint");
      }
    }
    assertNullableId(choice.nextNodeId, `${path}.nextNodeId`);
    assertNullableId(choice.endingId, `${path}.endingId`);
    if ((choice.nextNodeId === null) === (choice.endingId === null)) reject(path, "must select exactly one next node or ending");
    if (choice.nextNodeId !== null) {
      if (!nodeIds.has(choice.nextNodeId)) reject(`${path}.nextNodeId`, "references an unknown node");
      if (nodeById.get(choice.nextNodeId).perspectiveId !== nodeById.get(choice.nodeId).perspectiveId) reject(path, "crosses perspectives");
    }
    if (choice.endingId !== null) {
      if (!endingIds.has(choice.endingId)) reject(`${path}.endingId`, "references an unknown ending");
      if (endingById.get(choice.endingId).perspectiveId !== nodeById.get(choice.nodeId).perspectiveId) reject(path, "uses another perspective's ending");
    }
    if (!nodeById.get(choice.nodeId).choiceIds.includes(choice.id)) reject(path, "is not listed by its node");
  });

  scenario.endings.forEach((ending, index) => {
    const path = `scenario.endings[${index}]`;
    assertExactKeys(ending, ["id", "perspectiveId", "title", "summary", "prerequisites"], path);
    assertEnum(ending.perspectiveId, PERSPECTIVE_IDS, `${path}.perspectiveId`);
    assertText(ending.title, `${path}.title`, 120);
    assertText(ending.summary, `${path}.summary`);
    assertArray(ending.prerequisites, `${path}.prerequisites`, 0, 20);
    ending.prerequisites.forEach((item, itemIndex) => assertPrerequisite(item, `${path}.prerequisites[${itemIndex}]`, references));
  });

  const reachableNodeIds = new Set();
  const reachableEndingIds = new Set();
  scenario.perspectives.forEach((perspective) => {
    const queue = [perspective.initialNodeId];
    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (reachableNodeIds.has(nodeId)) continue;
      reachableNodeIds.add(nodeId);
      const node = nodeById.get(nodeId);
      node.choiceIds.forEach((choiceId) => {
        const choice = choiceById.get(choiceId);
        if (choice.nextNodeId !== null && !reachableNodeIds.has(choice.nextNodeId)) queue.push(choice.nextNodeId);
        if (choice.endingId !== null) reachableEndingIds.add(choice.endingId);
      });
    }
  });
  scenario.nodes.forEach((node, index) => {
    if (!reachableNodeIds.has(node.id)) reject(`scenario.nodes[${index}]`, "is unreachable from its perspective start");
  });
  scenario.endings.forEach((ending, index) => {
    if (!reachableEndingIds.has(ending.id)) reject(`scenario.endings[${index}]`, "is unreachable from every perspective start");
  });

  evidenceCatalog.records.forEach((record, index) => {
    record.assetIds.forEach((assetId) => {
      if (!assetIds.has(assetId)) reject(`evidenceCatalog.records[${index}].assetIds`, `references unknown asset ${assetId}`);
    });
  });

  return true;
}

export function validateStateShape(state, scenario, evidenceCatalog) {
  validateScenario(scenario, evidenceCatalog);
  assertInertTree(state, "state");
  assertExactKeys(
    state,
    [
      "saveVersion", "schemaVersion", "scenarioId", "perspective", "currentNodeId", "flags", "metrics",
      "assetStates", "containmentStatuses", "unlockedEvidenceIds", "emittedEventIds", "choiceIds", "endingId",
    ],
    "state",
  );
  if (state.saveVersion !== SAVE_SCHEMA_VERSION) reject("state.saveVersion", "is obsolete or unsupported");
  if (state.schemaVersion !== scenario.schemaVersion) reject("state.schemaVersion", "does not match the scenario");
  if (state.scenarioId !== scenario.scenarioId) reject("state.scenarioId", "does not match the scenario");
  assertEnum(state.perspective, PERSPECTIVE_IDS, "state.perspective");

  const nodes = new Map(scenario.nodes.map((node) => [node.id, node]));
  if (!nodes.has(state.currentNodeId) || nodes.get(state.currentNodeId).perspectiveId !== state.perspective) {
    reject("state.currentNodeId", "is not a node for this perspective");
  }

  assertRecord(state.flags, "state.flags");
  const definitions = new Map(scenario.flagDefinitions.map((definition) => [definition.id, definition]));
  assertExactKeys(state.flags, [...definitions.keys()], "state.flags");
  definitions.forEach((definition, flagId) => {
    if (!definition.allowedValues.includes(state.flags[flagId])) reject(`state.flags.${flagId}`, "uses a disallowed value");
  });

  assertRecord(state.metrics, "state.metrics");
  assertExactKeys(state.metrics, scenario.metricIds, "state.metrics");
  scenario.metricIds.forEach((metricId) => assertInteger(state.metrics[metricId], `state.metrics.${metricId}`, -1000, 1000));

  assertRecord(state.assetStates, "state.assetStates");
  assertRecord(state.containmentStatuses, "state.containmentStatuses");
  const assetIds = scenario.assets.map((asset) => asset.id);
  assertExactKeys(state.assetStates, assetIds, "state.assetStates");
  assertExactKeys(state.containmentStatuses, assetIds, "state.containmentStatuses");
  assetIds.forEach((assetId) => {
    assertEnum(state.assetStates[assetId], ASSET_STATES, `state.assetStates.${assetId}`);
    assertEnum(state.containmentStatuses[assetId], CONTAINMENT_STATUSES, `state.containmentStatuses.${assetId}`);
  });

  const evidenceIds = new Set(evidenceCatalog.records.map((record) => record.id));
  assertIdArray(state.unlockedEvidenceIds, "state.unlockedEvidenceIds", evidenceIds);
  assertIdArray(state.emittedEventIds, "state.emittedEventIds", new Set(scenario.eventIds));
  assertIdArray(state.choiceIds, "state.choiceIds", new Set(scenario.choices.map((choice) => choice.id)));
  assertNullableId(state.endingId, "state.endingId");
  if (state.endingId !== null) {
    const ending = scenario.endings.find((item) => item.id === state.endingId);
    if (!ending || ending.perspectiveId !== state.perspective) reject("state.endingId", "is invalid for this perspective");
  }

  return true;
}

export function assertSaveText(serialized) {
  if (typeof serialized !== "string" || serialized.length < 2 || serialized.length > MAX_SAVE_LENGTH) {
    reject("save", `must be JSON text no longer than ${MAX_SAVE_LENGTH} characters`);
  }
}
