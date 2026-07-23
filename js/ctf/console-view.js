// Attacker "operator console" surface renderer. Presentation only: every action
// still routes back through the allowlisted handlers passed in `ctx`. No input
// fields, no command execution — the console glyphs are decoration.

export function renderConsole(ctx) {
  const { dom, textElement, choices, revealedEvents, handlers } = ctx;

  // Choice list (stub: same rendering as the shared list; Task 2 restyles it).
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

  // Blue-team readout (stub read-only list).
  dom.blueTeamEvents.replaceChildren();
  dom.blueTeamCount.textContent = `${revealedEvents.length} ${revealedEvents.length === 1 ? "event" : "events"}`;
  revealedEvents.forEach((event) => {
    const row = document.createElement("p");
    row.className = "ctf-blue-team-row";
    row.append(textElement("span", "synthetic-tag", "SYNTHETIC"));
    row.append(document.createTextNode(` ${event.timestamp} · ${event.hostname} · ${event.action}`));
    dom.blueTeamEvents.append(row);
  });

  void handlers; // handlers used by delegated click listeners in app.js
}
