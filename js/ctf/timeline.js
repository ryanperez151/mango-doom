// Pure filtering for already-bundled synthetic events. No filter value is
// interpreted as code, a selector, a URL, or a network target.

const FILTER_KEYS = ["source", "host", "severity", "stage", "from", "to"];
const SYNTHETIC_TIME = /^2088-03-14T\d{2}:\d{2}(?::\d{2})?$/;

export class TimelineFilterError extends Error {
  constructor(message) {
    super(message);
    this.name = "TimelineFilterError";
  }
}

function reject(message) {
  throw new TimelineFilterError(message);
}

export function validateTimelineFilters(filters, events, allowedEvents = events) {
  if (filters === null || typeof filters !== "object" || Array.isArray(filters)) reject("filters must be a plain object");
  const keys = Object.keys(filters);
  if (keys.length !== FILTER_KEYS.length || FILTER_KEYS.some((key) => !Object.hasOwn(filters, key))) reject("filters must use the exact allowlisted fields");
  if (!Array.isArray(events)) reject("events must be an array");
  if (!Array.isArray(allowedEvents)) reject("allowed events must be an array");

  const values = {
    source: new Set(allowedEvents.map((event) => event.dataset)),
    host: new Set(allowedEvents.map((event) => event.hostname)),
    severity: new Set(allowedEvents.map((event) => event.severity)),
    stage: new Set(allowedEvents.map((event) => event.scenario_stage)),
  };
  FILTER_KEYS.forEach((key) => {
    const value = filters[key];
    if (typeof value !== "string" || value.length > 100) reject(`${key} filter must be bounded text`);
    if (key === "from" || key === "to") {
      if (value !== "" && !SYNTHETIC_TIME.test(value)) reject(`${key} filter must use the fictional UTC timeline`);
    } else if (value !== "" && !values[key].has(value)) {
      reject(`${key} filter is not present in the bundled event set`);
    }
  });
  if (filters.from && filters.to && filters.from > filters.to) reject("time filter start must not follow its end");
  return true;
}

export function filterTimelineEvents(events, filters, allowedEvents = events) {
  validateTimelineFilters(filters, events, allowedEvents);
  return events.filter((event) => {
    if (event.synthetic !== true) return false;
    if (filters.source && event.dataset !== filters.source) return false;
    if (filters.host && event.hostname !== filters.host) return false;
    if (filters.severity && event.severity !== filters.severity) return false;
    if (filters.stage && event.scenario_stage !== filters.stage) return false;
    const localTimestamp = event.timestamp.slice(0, 19);
    if (filters.from && localTimestamp < filters.from) return false;
    if (filters.to && localTimestamp > filters.to) return false;
    return true;
  });
}
