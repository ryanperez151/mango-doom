// Defender "mock SIEM" surface renderer. Structured controls only — no free-text
// search. Every filter/bookmark routes through the allowlisted handlers in `ctx`.

export function renderSiem(ctx) {
  const { dom, textElement, choices, events, handlers } = ctx;

  // Response playbook (stub: same rendering as the shared choice list; Task 3 restyles).
  dom.choices.replaceChildren();
  choices.forEach((choice) => {
    const card = document.createElement("article");
    card.className = `ctf-choice-card${choice.available ? "" : " choice-locked"}`;
    card.append(textElement("h4", "", choice.label));
    card.append(textElement("p", "ctf-choice-objective", choice.objective));
    card.append(textElement("p", "ctf-prerequisite", `Prerequisite: ${choice.prerequisiteSummary}`));
    if (!choice.available) card.append(textElement("p", "ctf-lock-text", "STATUS: unavailable until the listed evidence or state requirement is met."));
    const button = textElement("button", "button", choice.available ? "Choose This Action" : "Review Locked Action");
    button.type = "button";
    button.dataset.choiceId = choice.id;
    button.setAttribute("aria-disabled", String(!choice.available));
    card.append(button);
    dom.choices.append(card);
  });

  // Results (stub: reuse the existing timeline-event markup; Task 3 adds pills/fields/rows).
  dom.timelineCount.textContent = `${events.length} ${events.length === 1 ? "event" : "events"} shown`;
  dom.timelineEvents.replaceChildren();
  if (events.length === 0) {
    dom.timelineEvents.append(textElement("p", "ctf-empty", "No revealed synthetic events match these filters."));
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
    const bookmarked = ctx.eventBookmarks.includes(event.event_id);
    const button = textElement("button", "button event-bookmark", bookmarked ? "Remove Timeline Bookmark" : "Bookmark Timeline Event");
    button.type = "button";
    button.dataset.eventId = event.event_id;
    button.setAttribute("aria-pressed", String(bookmarked));
    card.append(button);
    dom.timelineEvents.append(card);
  });

  void handlers;
}
