// Attacker "operator console" surface renderer. Presentation only: every action
// still routes back through the allowlisted handlers passed in `ctx`. There is
// no input field and no command execution — the prompt glyph and cursor are
// decoration, and choices are a fixed, selectable menu.

function buildChrome(textElement) {
  const chrome = document.createElement("div");
  chrome.className = "ctf-console-banner";
  chrome.append(textElement("span", "ctf-console-title", "MANGO.SYS FIREWALL // OPERATOR CONSOLE"));
  const prompt = document.createElement("p");
  prompt.className = "ctf-console-prompt";
  prompt.append(textElement("span", "ctf-console-user", "operator@mangokeep:~$"));
  prompt.append(textElement("span", "ctf-console-cursor", "█")); // decorative block cursor
  chrome.append(prompt);
  return chrome;
}

export function renderConsole(ctx) {
  const { dom, textElement, node, choices, revealedEvents, engineState, scenario } = ctx;

  // Decorative, non-interactive console chrome.
  dom.consoleChrome.replaceChildren(buildChrome(textElement));

  // Numbered operation menu.
  dom.choices.replaceChildren();
  choices.forEach((choice, index) => {
    const row = document.createElement("article");
    row.className = `ctf-menu-row${choice.available ? "" : " choice-locked"}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ctf-menu-button";
    button.dataset.choiceId = choice.id;
    button.setAttribute("aria-disabled", String(!choice.available));
    button.append(textElement("span", "ctf-menu-index", choice.available ? `[${index + 1}]` : "[-]"));
    const labelWrap = document.createElement("span");
    labelWrap.className = "ctf-menu-label";
    labelWrap.append(textElement("span", "ctf-menu-verb", "SELECT"));
    labelWrap.append(textElement("span", "ctf-menu-title", choice.label));
    labelWrap.append(textElement("span", "ctf-menu-objective", choice.objective));
    if (!choice.available) {
      labelWrap.append(textElement("span", "ctf-menu-lock", `LOCKED — prerequisite: ${choice.prerequisiteSummary}`));
    }
    button.append(labelWrap);
    row.append(button);
    dom.choices.append(row);
  });

  // Decision scrollback, reconstructed deterministically from recorded history.
  dom.scrollback.replaceChildren();
  engineState.choiceIds.forEach((choiceId, index) => {
    const past = scenario.choices.find((item) => item.id === choiceId);
    if (!past) return;
    const entry = document.createElement("div");
    entry.className = "ctf-scrollback-entry";
    entry.append(textElement("p", "ctf-scrollback-cmd", `> op ${String(index + 1).padStart(2, "0")}: ${past.label}`));
    entry.append(textElement("p", "ctf-scrollback-out", past.outcomeText));
    entry.append(textElement("p", "ctf-scrollback-note", past.learningConsequence));
    dom.scrollback.append(entry);
  });

  // Blue-team visibility readout (read-only; collapsed by default via markup).
  dom.blueTeamEvents.replaceChildren();
  dom.blueTeamCount.textContent = `${revealedEvents.length} ${revealedEvents.length === 1 ? "event" : "events"}`;
  revealedEvents.forEach((event) => {
    const line = document.createElement("p");
    line.className = "ctf-blue-team-row";
    line.append(textElement("span", "synthetic-tag", "SYNTHETIC"));
    line.append(document.createTextNode(` ${event.timestamp} · ${event.hostname} · ${event.action} · ${event.severity}`));
    dom.blueTeamEvents.append(line);
  });

  void node;
}
