// Versioned, local-only UI save handling for the CTF page.
// Saved strings are validated as inert data before the state engine sees them.

export const CTF_UI_SAVE_VERSION = 1;
export const CTF_STORAGE_KEY = "mangoSys.ctf.save.v1";

const SAVE_KEYS = [
  "uiSaveVersion",
  "mode",
  "activeTrack",
  "threatState",
  "defenderState",
  "evidenceBookmarks",
  "eventBookmarks",
  "evidenceNotes",
  "caseNotes",
  "filters",
  "hintShown",
];

const FILTER_KEYS = ["source", "host", "severity", "stage", "from", "to"];
const SAFE_ID = /^[a-z][a-z0-9_]{0,63}$/;

function hasExactKeys(value, expectedKeys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length && expectedKeys.every((key) => Object.hasOwn(value, key));
}

function validIdArray(value, allowlist, maximum) {
  if (!Array.isArray(value) || value.length > maximum || new Set(value).size !== value.length) return false;
  return value.every((id) => typeof id === "string" && SAFE_ID.test(id) && allowlist.has(id));
}

function validFilters(filters, allowedFilterValues) {
  if (!hasExactKeys(filters, FILTER_KEYS)) return false;
  return FILTER_KEYS.every((key) => {
    const value = filters[key];
    if (typeof value !== "string" || value.length > 100) return false;
    if (key === "from" || key === "to") return value === "" || /^2088-03-14T\d{2}:\d{2}(?::\d{2})?$/.test(value);
    return value === "" || allowedFilterValues[key].has(value);
  });
}

export function validateUiSave(candidate, allowlists) {
  if (!hasExactKeys(candidate, SAVE_KEYS)) return false;
  if (candidate.uiSaveVersion !== CTF_UI_SAVE_VERSION) return false;
  if (!["threat", "defender", "paired"].includes(candidate.mode)) return false;
  if (!["threat", "defender"].includes(candidate.activeTrack)) return false;
  if (candidate.mode === "threat" && candidate.activeTrack !== "threat") return false;
  if (candidate.mode === "defender" && candidate.activeTrack !== "defender") return false;
  if (candidate.threatState !== null && (typeof candidate.threatState !== "string" || candidate.threatState.length > 20000)) return false;
  if (candidate.defenderState !== null && (typeof candidate.defenderState !== "string" || candidate.defenderState.length > 20000)) return false;
  if (candidate.mode === "paired" && candidate.activeTrack === "defender" && (candidate.threatState === null || candidate.defenderState === null)) return false;
  if (!validIdArray(candidate.evidenceBookmarks, allowlists.evidenceIds, 100)) return false;
  if (!validIdArray(candidate.eventBookmarks, allowlists.eventIds, 200)) return false;
  if (!hasExactKeys(candidate.filters, FILTER_KEYS) || !validFilters(candidate.filters, allowlists.filterValues)) return false;
  if (typeof candidate.caseNotes !== "string" || candidate.caseNotes.length > 1000) return false;
  if (typeof candidate.hintShown !== "boolean") return false;

  if (candidate.evidenceNotes === null || typeof candidate.evidenceNotes !== "object" || Array.isArray(candidate.evidenceNotes)) return false;
  for (const [evidenceId, note] of Object.entries(candidate.evidenceNotes)) {
    if (!allowlists.evidenceIds.has(evidenceId) || typeof note !== "string" || note.length > 500) return false;
  }

  return true;
}

export function loadUiSave(allowlists) {
  let raw;
  try {
    raw = localStorage.getItem(CTF_STORAGE_KEY);
  } catch {
    return { status: "unavailable", value: null };
  }
  if (raw === null) return { status: "empty", value: null };
  if (raw.length > 60000) return { status: "invalid", value: null };

  try {
    const candidate = JSON.parse(raw);
    return validateUiSave(candidate, allowlists)
      ? { status: "valid", value: candidate }
      : { status: "invalid", value: null };
  } catch {
    return { status: "invalid", value: null };
  }
}

export function storeUiSave(value, allowlists) {
  if (!validateUiSave(value, allowlists)) return false;
  try {
    localStorage.setItem(CTF_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeUiSave() {
  try {
    localStorage.removeItem(CTF_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
