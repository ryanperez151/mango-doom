// Defender "mock SIEM" surface renderer. Structured controls only — no free-text
// search. Field-value clicks and pill removals route through the allowlisted
// filter handlers in `ctx`; nothing here executes, navigates, or fetches.

const FIELD_LABELS = [
  ["source", "Source"],
  ["host", "Host"],
  ["severity", "Severity"],
  ["stage", "Stage"],
];
const PILL_LABELS = {
  source: "source", host: "host", severity: "severity",
  stage: "stage", from: "from", to: "through",
};

function renderPlaybook(ctx) {
  const { dom, textElement, choices } = ctx;
  dom.choices.replaceChildren();
  choices.forEach((choice) => {
    const card = document.createElement("article");
    card.className = `ctf-choice-card${choice.available ? "" : " choice-locked"}`;
    card.append(textElement("h4", "", choice.label));
    card.append(textElement("p", "ctf-choice-objective", choice.objective));
    card.append(textElement("p", "ctf-prerequisite", `Prerequisite: ${choice.prerequisiteSummary}`));
    if (!choice.available) card.append(textElement("p", "ctf-lock-text", "STATUS: unavailable until the listed evidence or state requirement is met."));
    // Never "run"/"execute" — the safety guardrail bans those labels. This is a
    // symbolic response selection, not command execution.
    const button = textElement("button", "button", choice.available ? "Select Response Step" : "Review Locked Step");
    button.type = "button";
    button.dataset.choiceId = choice.id;
    button.setAttribute("aria-disabled", String(!choice.available));
    card.append(button);
    dom.choices.append(card);
  });
}

function renderPills(ctx) {
  const { dom, textElement, filters } = ctx;
  dom.filterPills.replaceChildren();
  const active = Object.entries(filters).filter(([, value]) => value !== "");
  if (active.length === 0) {
    dom.filterPills.append(textElement("span", "ctf-pill-empty", "No active filters — showing all revealed events."));
    return;
  }
  active.forEach(([key, value]) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "ctf-pill";
    pill.dataset.clearKey = key;
    pill.append(textElement("span", "ctf-pill-text", `${PILL_LABELS[key]} = ${value}`));
    pill.append(textElement("span", "ctf-pill-x", "×"));
    pill.setAttribute("aria-label", `Remove filter ${PILL_LABELS[key]} = ${value}`);
    dom.filterPills.append(pill);
  });
}

function renderFields(ctx) {
  const { dom, textElement, fieldCounts, filters } = ctx;
  dom.fields.replaceChildren();
  FIELD_LABELS.forEach(([key, label]) => {
    const group = document.createElement("section");
    group.className = "ctf-field-group";
    group.append(textElement("h3", "ctf-field-name", label));
    const entries = Object.entries(fieldCounts[key]).sort((a, b) => a[0].localeCompare(b[0]));
    entries.forEach(([value, count]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ctf-field-value";
      button.dataset.filterKey = key;
      button.dataset.filterValue = value;
      button.setAttribute("aria-pressed", String(filters[key] === value));
      button.append(textElement("span", "ctf-field-label", value));
      button.append(textElement("span", "ctf-field-count", String(count)));
      group.append(button);
    });
    dom.fields.append(group);
  });
}

function renderSeverityBars(ctx) {
  const { dom, textElement, fieldCounts, events } = ctx;
  dom.severityBars.replaceChildren();
  const order = ["high", "medium", "low", "info"];
  const total = events.length || 1;
  order.forEach((severity) => {
    const count = fieldCounts.severity[severity] ?? 0;
    if (count === 0) return;
    const row = document.createElement("div");
    row.className = "ctf-sev-row";
    row.append(textElement("span", `ctf-sev-key severity severity-${severity}`, severity));
    const track = document.createElement("span");
    track.className = "ctf-sev-track";
    const fill = document.createElement("span");
    fill.className = `ctf-sev-fill ctf-sev-${severity}`;
    fill.style.width = `${Math.round((count / total) * 100)}%`;
    track.append(fill);
    row.append(track);
    row.append(textElement("span", "ctf-sev-count", String(count)));
    dom.severityBars.append(row);
  });
}

function renderResults(ctx) {
  const { dom, textElement, events } = ctx;
  dom.timelineCount.textContent = `${events.length} ${events.length === 1 ? "event" : "events"} shown`;
  dom.timelineEvents.replaceChildren();
  if (events.length === 0) {
    dom.timelineEvents.append(textElement("p", "ctf-empty", "No revealed synthetic events match these filters."));
    return;
  }
  const bookmarks = ctx.eventBookmarks;
  events.forEach((event) => {
    const row = document.createElement("details");
    row.className = "ctf-result";
    const summary = document.createElement("summary");
    summary.append(textElement("span", "ctf-result-time", event.timestamp));
    summary.append(textElement("span", "ctf-result-host", event.hostname));
    summary.append(textElement("span", "ctf-result-action", event.action));
    summary.append(textElement("span", `severity severity-${event.severity}`, event.severity));
    row.append(summary);
    row.append(textElement("p", "synthetic-tag", "SYNTHETIC — FICTIONAL TRAINING DATA"));
    row.append(textElement("p", "ctf-result-message", event.message));
    const dl = document.createElement("dl");
    [["Event", event.event_id], ["Source", event.dataset], ["Host", event.hostname], ["Stage", event.scenario_stage], ["Outcome", event.outcome]].forEach(([term, value]) => {
      dl.append(textElement("dt", "", term), textElement("dd", "", value));
    });
    row.append(dl);
    const bookmarked = bookmarks.includes(event.event_id);
    const button = textElement("button", "button event-bookmark", bookmarked ? "Remove Timeline Bookmark" : "Bookmark Timeline Event");
    button.type = "button";
    button.dataset.eventId = event.event_id;
    button.setAttribute("aria-pressed", String(bookmarked));
    row.append(button);
    dom.timelineEvents.append(row);
  });
}

export function renderSiem(ctx) {
  renderPills(ctx);
  renderFields(ctx);
  renderSeverityBars(ctx);
  renderResults(ctx);
  renderPlaybook(ctx);
}
