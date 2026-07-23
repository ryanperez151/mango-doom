# CTF Console + SIEM UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the CTF's attacker (threat) track an operator-console interface and its defender track a mock-SIEM interface, as a presentation + interaction change over the existing allowlisted engine.

**Architecture:** `js/ctf/app.js` stays the controller (state, persistence, shared panels, timeline data) and sets a per-track skin class on `#ctf-workspace` (`ctf-skin-console` / `ctf-skin-siem`), delegating surface-specific rendering to two new ES modules — `js/ctf/console-view.js` and `js/ctf/siem-view.js`. The workspace markup is flattened so CSS `grid-template-areas` can rearrange the same panels per skin. No engine, scenario-data, storage, or safety-validator changes.

**Tech Stack:** Vanilla HTML/CSS/JS. ES modules (`type="module"`) for `js/ctf/*`. Rendering is `document.createElement` + `textContent` only. Custom offline test harness (PowerShell validators + Node headless-Chrome smoke). No `package.json`, no dependencies.

## Global Constraints

- **Seven verbs only:** inspect, choose, filter logs, bookmark evidence, submit hypothesis, contain, build timeline. No new action types.
- **No execution surface:** no shell/terminal facsimile that accepts input, no command field, no faux prompt you type into, no command autocomplete, no keyboard shortcuts that resemble execution, no "run"/"execute" labels. The console prompt glyph/cursor are decorative, non-interactive.
- **No free-text search** on the defender side. Filtering uses only structured controls: clickable field values, removable pills, the existing `datetime-local` range inputs.
- **Rendering safety:** no `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write`; no `eval` / `Function`; no dynamic import; no URL-bearing fields; no new external requests or assets. Use `createElement` + `textContent` / form values only.
- **No new player-facing scenario/telemetry content strings** (avoids triggering a new manual content review). Only structural/label UI chrome text is added.
- **Do not modify:** `js/ctf/state.js`, `js/ctf/contracts.js`, `js/ctf/storage.js`, `js/ctf/paired.js`, `js/ctf/timeline.js`, anything under `data/ctf/`, or any safety validator.
- **DOM/test contract to preserve:** `.ctf-safety-label` keeps the text `FICTIONAL, INERT SIMULATION`; `#ctf-start` visible + keyboard-reachable on launch; after Start, `#ctf-workspace` is visible and `document.activeElement.id === "node-title"`; `#ctf-reset` → `#reset-dialog` (focus `#cancel-reset`) → Escape returns focus to `#ctf-reset`; `#ctf-resume` offered after reload; a `mangoSys.ctf*` `localStorage` key is created on Start; `document.documentElement.scrollWidth === 320` at 320px under `prefers-reduced-motion: reduce`; zero non-loopback requests; zero script errors.
- **Motion/a11y:** all console/SIEM flourishes are decoration disabled under `prefers-reduced-motion`, never gate content or focus. Content renders immediately. Single column at 320px. Visible focus. Screen-reader labels on every new control. Core content readable with JS disabled.
- **Commits:** frequent, on branch `feature/ctf-console-siem-ux` (already created).

---

## File structure

- **Modify** `ctf.html` — flatten `#ctf-workspace` into direct grid children; promote the choice region into its own `#ctf-actions` panel; add persistent, skin-specific mount points (`#ctf-console-chrome`, `#ctf-scrollback`, `#ctf-blue-team` + `#ctf-blue-team-events`, `#ctf-filter-pills`, `#ctf-fields`, `#ctf-severity-bars`). The two new modules are **not** added as `<script>` tags — `app.js` imports them, and `ctf.html` keeps its single `<script type="module" src="js/ctf/app.js">`.
- **Modify** `js/ctf/app.js` — add refs for new mounts; add `applySkin()`; move choice + timeline rendering out to the view modules; compute the context object; keep shared renders (evidence/assets/codes/notebook/objective/hint/feedback/ending) and all state/persistence.
- **Create** `js/ctf/console-view.js` — attacker console surface renderer.
- **Create** `js/ctf/siem-view.js` — defender SIEM surface renderer.
- **Modify** `css/ctf.css` — add `/* ===== WORKSPACE GRID ===== */`, `/* ===== CONSOLE SKIN ===== */`, `/* ===== SIEM SKIN ===== */` sections.
- **Modify** `tests/run-site-browser-smoke.mjs` — add per-track skin-class assertions, a defender-start path, and a "no free-text/command input control" assertion.
- **Modify** `README.md` and `CLAUDE.md` — note the two view modules and the two skins.

---

## Task 1: Flatten workspace, add skin seam and view-module delegation

Behaviour-preserving refactor: same content renders, but the choice region becomes its own panel, `#ctf-workspace` becomes a grid, a per-track skin class is applied, and choice/timeline rendering is delegated to stub view modules that (for now) reproduce today's output.

**Files:**
- Modify: `ctf.html` (the `#ctf-workspace` block, lines ~83–189)
- Modify: `js/ctf/app.js`
- Create: `js/ctf/console-view.js`
- Create: `js/ctf/siem-view.js`
- Modify: `css/ctf.css`
- Test: `tests/run-site-browser-smoke.mjs`

**Interfaces:**
- Produces (consumed by Tasks 2 & 3):
  - `console-view.js` exports `renderConsole(ctx)`.
  - `siem-view.js` exports `renderSiem(ctx)`.
  - `ctx` shape (built in `app.js`):
    ```
    {
      dom,                 // the ctfDom refs object
      textElement,         // (tag, className, text) => HTMLElement
      node, chapter,       // current node + its chapter (threat) / node (defender)
      scenario, evidence, engineState,
      choices,             // [{ id, label, objective, prerequisiteSummary, available }] in node order
      revealedEvents,      // Event[] visible at this node (already stage-gated)
      events,              // filtered Event[] (revealed + active filters)
      fieldCounts,         // { source:{v:n}, host:{v:n}, severity:{v:n}, stage:{v:n} }
      filters,             // ctfUiState.filters
      handlers: {
        onChoose(choiceId),
        onSetFilter(key, value),   // key in source|host|severity|stage
        onClearFilter(key),        // key in source|host|severity|stage|from|to
        onClearAll(),
        onBookmarkEvent(eventId),
      }
    }
    ```

- [ ] **Step 1: Add the failing smoke assertion for the console skin class**

In `tests/run-site-browser-smoke.mjs`, inside the `workspace` inspect object (currently around line 218), add a `skin` field and assert it:

```js
    const workspace = await inspect(`({
      visible: !document.querySelector('#ctf-workspace').hidden,
      focused: document.activeElement?.id,
      scrollWidth: document.documentElement.scrollWidth,
      skin: document.querySelector('#ctf-workspace').className,
      saveKeys: Object.keys(localStorage)
    })`);
    assert.equal(workspace.visible, true);
    assert.equal(workspace.focused, "node-title");
    assert.equal(workspace.scrollWidth, 320);
    assert.ok(workspace.skin.includes("ctf-skin-console"), "Threat track did not apply the console skin class");
    assert.ok(workspace.saveKeys.some((key) => key.startsWith("mangoSys.ctf")), "Starting did not create a versioned local save");
```

- [ ] **Step 2: Run the smoke test to confirm it fails**

Run:
```bash
node tests/run-site-browser-smoke.mjs
```
Expected: FAIL with `Threat track did not apply the console skin class` (the class is not set yet).

- [ ] **Step 3: Flatten the `#ctf-workspace` markup in `ctf.html`**

Replace the current `<div id="ctf-workspace" hidden> … </div>` block (the command bar, `.ctf-dashboard`, timeline, and notebook) with this flattened structure. All existing IDs are kept; the `.ctf-dashboard` wrapper is removed; the choice region is promoted into `#ctf-actions`; new skin mounts are added. Do not remove `#node-title`, `#node-body`, `#node-objective`, `#ctf-choices`, `#timeline-events`, filter inputs, `#evidence-list`, `#asset-summary`, `#code-list`, `#case-notes`.

```html
    <div id="ctf-workspace" hidden>
      <section class="ctf-commandbar" aria-label="Simulation controls">
        <div>
          <span class="ctf-status-key">MODE</span>
          <strong id="ctf-mode-status">Not started</strong>
        </div>
        <div>
          <span class="ctf-status-key">SAVE</span>
          <span id="ctf-save-status">Not saved</span>
        </div>
        <div class="ctf-commandbar-actions">
          <button class="button" id="ctf-save-now" type="button">Save Now</button>
          <button class="button ctf-danger-button" id="ctf-reset" type="button">Reset</button>
        </div>
      </section>

      <section class="content-panel ctf-narrative" aria-labelledby="node-title">
        <!-- Console-only decorative chrome; hidden in the SIEM skin via CSS. -->
        <div id="ctf-console-chrome" aria-hidden="true"></div>
        <p class="panel-kicker" id="chapter-label">SIMULATION BRIEF</p>
        <h2 id="node-title" tabindex="-1">Loading narrative</h2>
        <p class="ctf-objective-label">Narrative</p>
        <p id="node-body"></p>
        <div class="ctf-objective-box">
          <h3>Current Objective</h3>
          <p id="node-objective"></p>
        </div>
        <p class="ctf-paired-consequence" id="paired-consequence" hidden></p>
        <div class="ctf-hint" id="ctf-hint" tabindex="-1" hidden>
          <h3>Learning Hint</h3>
          <p id="ctf-hint-text"></p>
        </div>
        <button class="button" id="ctf-show-hint" type="button">Show Learning Hint</button>
        <div class="ctf-feedback" id="choice-feedback" role="status" tabindex="-1" hidden></div>
        <!-- Console-only decision scrollback; empty (and hidden) in the SIEM skin. -->
        <div id="ctf-scrollback" aria-live="off"></div>
      </section>

      <section class="content-panel ctf-actions" aria-labelledby="choices-title">
        <h3 id="choices-title">Choose an Action</h3>
        <div id="ctf-choices" class="ctf-choice-list"></div>
      </section>

      <aside class="ctf-sidebar" aria-label="Case information">
        <details class="content-panel ctf-drawer" open>
          <summary>Evidence Drawer <span id="evidence-count">0 visible</span></summary>
          <p class="ctf-drawer-help">Bookmark decision-relevant records and keep local notes. Notes are inert text and never interpreted.</p>
          <div id="evidence-list" class="evidence-list"></div>
        </details>

        <section class="content-panel" aria-labelledby="asset-title">
          <h2 id="asset-title">Asset Health</h2>
          <p class="ctf-region-help">How each fictional asset is holding up — and whether it is contained — as the incident unfolds.</p>
          <div id="asset-summary" class="asset-summary"></div>
        </section>

        <section class="content-panel" aria-labelledby="codes-title">
          <h2 id="codes-title">Evidence Codes</h2>
          <p id="codes-empty">Codes reward reasoning and completed transitions, never command entry.</p>
          <ul id="code-list" class="code-list"></ul>
        </section>
      </aside>

      <!-- Console skin: compact, collapsed "what the blue team can see" readout. -->
      <details id="ctf-blue-team" class="content-panel ctf-blue-team">
        <summary>Blue-Team Visibility <span id="ctf-blue-team-count">0 events</span></summary>
        <p class="ctf-region-help">A read-only glimpse of the synthetic evidence a defender could correlate. Every record is fictional training data.</p>
        <div id="ctf-blue-team-events" class="timeline-events"></div>
      </details>

      <!-- SIEM skin: full structured event search. Hidden in the console skin via CSS. -->
      <section class="content-panel ctf-timeline" aria-labelledby="timeline-title">
        <div class="timeline-heading">
          <div>
            <p class="panel-kicker">SYNTHETIC EVENT CORPUS</p>
            <h2 id="timeline-title">Event Search</h2>
          </div>
          <p id="timeline-count">0 events shown</p>
        </div>

        <p class="ctf-region-help">Every record here is fictional training data. Narrow by clicking field values or removing active filters; more events appear as the incident progresses.</p>

        <div id="ctf-filter-pills" class="ctf-filter-pills" aria-label="Active filters"></div>
        <div id="ctf-severity-bars" class="ctf-severity-bars" aria-hidden="true"></div>

        <div class="ctf-siem-body">
          <div id="ctf-fields" class="ctf-fields" aria-label="Fields"></div>
          <div class="ctf-results">
            <form id="timeline-filters" class="timeline-filters" aria-label="Time range">
              <label>From time
                <input id="filter-from" name="from" type="datetime-local" step="30" />
              </label>
              <label>Through time
                <input id="filter-to" name="to" type="datetime-local" step="30" />
              </label>
              <button class="button" id="clear-filters" type="button">New Search</button>
            </form>
            <div id="timeline-events" class="timeline-events"></div>
          </div>
        </div>
      </section>

      <section class="content-panel ctf-notebook" aria-labelledby="notebook-title">
        <h2 id="notebook-title">Local Case Notes</h2>
        <label for="case-notes">Record a bounded hypothesis, uncertainty, or handoff note. Maximum 1,000 characters.</label>
        <textarea id="case-notes" maxlength="1000" rows="5"></textarea>
        <p><span id="case-note-count">0</span>/1000 characters. Stored only in the versioned local save.</p>
      </section>
    </div>
```

Note: the source/host/severity/stage `<select>` elements are removed from the markup (replaced by the `#ctf-fields` sidebar). Their filter state is now driven by field-value clicks and pills. The `from`/`to` datetime inputs remain.

- [ ] **Step 4: Create `js/ctf/console-view.js` as a behaviour-preserving stub**

For this task the console view just reproduces today's choice list and (into the blue-team readout) today's revealed-events list. Tasks 2 will replace the internals.

```js
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
```

- [ ] **Step 5: Create `js/ctf/siem-view.js` as a behaviour-preserving stub**

```js
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
    const bookmarked = ctx.dom.eventBookmarks?.includes?.(event.event_id) ?? false;
    const button = textElement("button", "button event-bookmark", bookmarked ? "Remove Timeline Bookmark" : "Bookmark Timeline Event");
    button.type = "button";
    button.dataset.eventId = event.event_id;
    button.setAttribute("aria-pressed", String(bookmarked));
    card.append(button);
    dom.timelineEvents.append(card);
  });

  void handlers;
}
```

- [ ] **Step 6: Wire `app.js` — imports, new refs, skin class, delegation**

In `js/ctf/app.js`:

(a) Add imports at the top, after the existing `getPairedConsequence` import:
```js
import { renderConsole } from "./console-view.js";
import { renderSiem } from "./siem-view.js";
```

(b) Add refs to the `ctfDom` object (new mounts + a couple already present):
```js
  consoleChrome: document.querySelector("#ctf-console-chrome"),
  scrollback: document.querySelector("#ctf-scrollback"),
  actionsTitle: document.querySelector("#choices-title"),
  blueTeam: document.querySelector("#ctf-blue-team"),
  blueTeamEvents: document.querySelector("#ctf-blue-team-events"),
  blueTeamCount: document.querySelector("#ctf-blue-team-count"),
  filterPills: document.querySelector("#ctf-filter-pills"),
  fields: document.querySelector("#ctf-fields"),
  severityBars: document.querySelector("#ctf-severity-bars"),
```
(Keep the existing `filterFrom`, `filterTo`, `clearFilters`, `timelineCount`, `timelineEvents`, `choices` refs. Remove the now-deleted `filterSource`, `filterHost`, `filterSeverity`, `filterStage` refs.)

(c) Remove the four deleted selects from `initializeFilterControls()` — it becomes only the datetime bounds:
```js
function initializeFilterControls() {
  ctfDom.filterFrom.min = "2088-03-14T09:00:00";
  ctfDom.filterFrom.max = "2088-03-14T10:11:30";
  ctfDom.filterTo.min = "2088-03-14T09:00:00";
  ctfDom.filterTo.max = "2088-03-14T10:11:30";
}
```

(d) Add a `computeFieldCounts` helper and a `resolveChoices` helper near the other render helpers:
```js
function resolveChoices(node, scenario, engineState, evidence) {
  const availableIds = new Set(getAvailableChoices(scenario, evidence, engineState).map((choice) => choice.id));
  return node.choiceIds.map((choiceId) => {
    const choice = scenario.choices.find((item) => item.id === choiceId);
    return {
      id: choice.id,
      label: choice.label,
      objective: choice.objective,
      prerequisiteSummary: choice.prerequisiteSummary,
      available: availableIds.has(choice.id),
    };
  });
}

function computeFieldCounts(events) {
  const counts = { source: {}, host: {}, severity: {}, stage: {} };
  const fieldOf = { source: "dataset", host: "hostname", severity: "severity", stage: "scenario_stage" };
  events.forEach((event) => {
    Object.entries(fieldOf).forEach(([bucket, field]) => {
      const value = event[field];
      counts[bucket][value] = (counts[bucket][value] ?? 0) + 1;
    });
  });
  return counts;
}
```

(e) Add the skin toggle and a context builder, and rewrite the tail of `renderWorkspace()` to delegate. Replace the existing `renderChoices(...)`/`renderTimeline()` calls inside `renderWorkspace` with a skin dispatch. The new `renderWorkspace` tail (from where it currently calls `renderChoices`) becomes:
```js
  applySkin();
  const ctx = buildViewContext(node, chapter, scenario, evidence, engineState);
  if (ctfUiState.activeTrack === "threat") {
    ctfDom.actionsTitle.textContent = "Select an Operation";
    renderConsole(ctx);
  } else {
    ctfDom.actionsTitle.textContent = "Response Playbook";
    renderSiem(ctx);
  }
  renderEvidence(scenario, evidence, engineState);
  renderAssets(scenario, engineState);
  renderCodes();
  renderTimelineFilterState();
  ctfDom.caseNotes.value = ctfUiState.caseNotes;
  ctfDom.caseNoteCount.textContent = String(ctfUiState.caseNotes.length);
  if (engineState.endingId !== null) renderEnding();
}

function applySkin() {
  const isConsole = ctfUiState.activeTrack === "threat";
  ctfDom.workspace.classList.toggle("ctf-skin-console", isConsole);
  ctfDom.workspace.classList.toggle("ctf-skin-siem", !isConsole);
}

function buildViewContext(node, chapter, scenario, evidence, engineState) {
  return {
    dom: ctfDom,
    textElement,
    node,
    chapter,
    scenario,
    evidence,
    engineState,
    choices: resolveChoices(node, scenario, engineState, evidence),
    revealedEvents: revealedEvents(),
    events: filteredEvents(),
    fieldCounts: computeFieldCounts(filteredEvents()),
    filters: ctfUiState.filters,
    handlers: {
      onChoose: applySelectedChoice,
      onSetFilter: setFilterValue,
      onClearFilter: clearFilterValue,
      onClearAll: clearAllFilters,
      onBookmarkEvent: toggleEventBookmark,
    },
  };
}
```

(f) The old `renderChoices` and `renderTimeline` functions are superseded. Delete both, and delete `setSelectOptions` (its only callers were the four removed selects and the removed stage select). Keep `revealedStages`, `revealedEvents`, `filteredEvents`, and `filterValues` — they are still used by event revealing and by the save allowlist. Add a small `renderTimelineFilterState()` that only syncs the datetime inputs (the selects are gone):
```js
function renderTimelineFilterState() {
  ctfDom.filterFrom.value = ctfUiState.filters.from;
  ctfDom.filterTo.value = ctfUiState.filters.to;
}
```

(g) Add the three filter mutators + the extracted bookmark handler used by the context, near `applySelectedChoice`:
```js
function setFilterValue(key, value) {
  ctfUiState.filters = { ...ctfUiState.filters, [key]: value };
  persist();
  renderWorkspace();
  announce(ctfDom.timelineCount.textContent);
}

function clearFilterValue(key) {
  ctfUiState.filters = { ...ctfUiState.filters, [key]: "" };
  persist();
  renderWorkspace();
  announce("Filter removed.");
}

function clearAllFilters() {
  ctfUiState.filters = { ...EMPTY_FILTERS };
  persist();
  renderWorkspace();
  announce("Search reset.");
}

function toggleEventBookmark(eventId) {
  ctfUiState.eventBookmarks = toggleId(ctfUiState.eventBookmarks, eventId);
  const isBookmarked = ctfUiState.eventBookmarks.includes(eventId);
  persist();
  renderWorkspace();
  ctfDom.timelineEvents.querySelector(`[data-event-id="${eventId}"]`)?.focus();
  announce(isBookmarked ? "Timeline event bookmarked." : "Timeline bookmark removed.");
}
```

(h) Update the existing event listeners near the bottom of `app.js`:
- Delete the old `ctfDom.filterForm.addEventListener("change", …)` block that read the four removed selects, and replace it with a change listener that only handles the datetime inputs:
```js
ctfDom.filterForm.addEventListener("change", () => {
  ctfUiState.filters = { ...ctfUiState.filters, from: ctfDom.filterFrom.value, to: ctfDom.filterTo.value };
  persist();
  renderWorkspace();
  announce(ctfDom.timelineCount.textContent);
});
```
- Keep `ctfDom.clearFilters` wired, but point it at the shared reset:
```js
ctfDom.clearFilters.addEventListener("click", clearAllFilters);
```
- Replace the body of the existing `ctfDom.timelineEvents` click listener — it currently calls the now-deleted `renderTimeline()`, so route it through the extracted handler instead:
```js
ctfDom.timelineEvents.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-event-id]");
  if (button) toggleEventBookmark(button.dataset.eventId);
});
```
- Add a delegated click listener on the fields sidebar and the pills bar (implemented fully in Task 3, but add the wiring now so the seam is complete):
```js
ctfDom.fields.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter-key]");
  if (button) setFilterValue(button.dataset.filterKey, button.dataset.filterValue);
});
ctfDom.filterPills.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-clear-key]");
  if (button) clearFilterValue(button.dataset.clearKey);
});
```

- [ ] **Step 7: Add the workspace grid CSS (structural only) to `css/ctf.css`**

Append a new section. This makes `#ctf-workspace` a grid, assigns areas, and defines the two per-skin templates. It also hides the opposite skin's surfaces.

```css
/* ===== WORKSPACE GRID ===== */

#ctf-workspace {
  display: grid;
  gap: 1rem;
  align-items: start;
}

.ctf-commandbar { grid-area: bar; }
.ctf-narrative  { grid-area: brief; }
.ctf-actions    { grid-area: actions; }
.ctf-sidebar    { grid-area: aside; }
.ctf-blue-team  { grid-area: blueteam; }
.ctf-timeline   { grid-area: siem; }
.ctf-notebook   { grid-area: notebook; }

/* Console skin: brief + operation menu dominant; SIEM search hidden. */
#ctf-workspace.ctf-skin-console {
  grid-template-columns: minmax(0, 1.6fr) minmax(18rem, 0.8fr);
  grid-template-areas:
    "bar bar"
    "brief aside"
    "actions aside"
    "blueteam aside"
    "notebook notebook";
}
#ctf-workspace.ctf-skin-console .ctf-timeline { display: none; }

/* SIEM skin: event search dominant; playbook right rail; blue-team readout hidden. */
#ctf-workspace.ctf-skin-siem {
  grid-template-columns: minmax(0, 1.7fr) minmax(20rem, 0.9fr);
  grid-template-areas:
    "bar bar"
    "brief brief"
    "siem actions"
    "siem aside"
    "notebook notebook";
}
#ctf-workspace.ctf-skin-siem .ctf-blue-team { display: none; }

@media (max-width: 64rem) {
  #ctf-workspace.ctf-skin-console,
  #ctf-workspace.ctf-skin-siem {
    grid-template-columns: 1fr;
    grid-template-areas:
      "bar"
      "brief"
      "actions"
      "aside"
      "siem"
      "blueteam"
      "notebook";
  }
}
```

Also delete the now-unused `.ctf-dashboard` rule (and its responsive override) from `css/ctf.css`, since that wrapper no longer exists.

- [ ] **Step 8: Run the smoke test — console-skin assertion passes**

Run:
```bash
node tests/run-site-browser-smoke.mjs
```
Expected: PASS — including `ctf-skin-console` present, focus on `node-title`, `scrollWidth === 320`, zero external requests, zero script errors.

- [ ] **Step 9: Run the CTF engine + validators to confirm no regressions**

Run:
```bash
node tests/run-ctf-engine.mjs
node tests/run-ctf-playthroughs.mjs
pwsh tests/validate-ctf.ps1
```
Expected: all pass (no engine/data/validator files were touched).

- [ ] **Step 10: Commit**

```bash
git add ctf.html js/ctf/app.js js/ctf/console-view.js js/ctf/siem-view.js css/ctf.css tests/run-site-browser-smoke.mjs
git commit -m "refactor(ctf): flatten workspace grid and add per-track view-module seam

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Attacker operator-console surface

Turn the stub console into the real thing: decorative banner + non-interactive prompt, brief/objective as console output, choices as a numbered menu, a decision scrollback reconstructed from history, and the collapsed blue-team readout. Plus the console CSS skin.

**Files:**
- Modify: `js/ctf/console-view.js`
- Modify: `css/ctf.css` (CONSOLE SKIN section)
- Test: `tests/run-site-browser-smoke.mjs`

**Interfaces:**
- Consumes: `renderConsole(ctx)` and the `ctx` shape from Task 1.
- Produces: numbered menu buttons keep `data-choice-id` (so the existing `ctfDom.choices` click listener in `app.js` still dispatches `applySelectedChoice`). No new exports.

- [ ] **Step 1: Add a smoke assertion for the numbered menu**

In `tests/run-site-browser-smoke.mjs`, right after the `workspace` assertions from Task 1, add:

```js
    const consoleMenu = await inspect(`({
      hasBanner: Boolean(document.querySelector('#ctf-console-chrome .ctf-console-banner')),
      firstMenuIndex: document.querySelector('#ctf-choices .ctf-menu-row .ctf-menu-index')?.textContent || '',
      menuButtons: document.querySelectorAll('#ctf-choices button[data-choice-id]').length,
      verbLabel: document.querySelector('#ctf-choices .ctf-menu-verb')?.textContent || ''
    })`);
    assert.equal(consoleMenu.hasBanner, true, "Console banner missing");
    assert.equal(consoleMenu.firstMenuIndex, "[1]", "First operation is not numbered [1]");
    assert.ok(consoleMenu.menuButtons >= 1, "No selectable operations rendered");
    assert.equal(consoleMenu.verbLabel, "SELECT", "Console operation verb must be SELECT, never run/execute");
```

- [ ] **Step 2: Run the smoke test to confirm it fails**

Run:
```bash
node tests/run-site-browser-smoke.mjs
```
Expected: FAIL with `Console banner missing` (stub has no banner/menu markup yet).

- [ ] **Step 3: Rewrite `js/ctf/console-view.js` with the real surface**

```js
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
```

- [ ] **Step 4: Add the CONSOLE SKIN CSS to `css/ctf.css`**

Append a new section (the SIEM skin also hides the console-only chrome, which is included here):

```css
/* ===== CONSOLE SKIN ===== */

#ctf-workspace.ctf-skin-console .ctf-narrative {
  font-family: var(--font-mono, ui-monospace, "Cascadia Code", "Consolas", monospace);
  border-left: 0.35rem solid var(--green);
}

.ctf-console-banner {
  margin-bottom: 1rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--green);
  background: rgba(82, 255, 122, 0.06);
}

.ctf-console-title {
  display: block;
  color: var(--green);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.ctf-console-prompt {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  margin: 0.35rem 0 0;
}

.ctf-console-user { color: var(--orange-soft); }

.ctf-console-cursor {
  color: var(--green);
  animation: ctf-cursor-blink 1s steps(2, start) infinite;
}

@keyframes ctf-cursor-blink { to { opacity: 0; } }

/* Numbered operation menu. */
.ctf-menu-row { min-width: 0; }

.ctf-menu-button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(255, 157, 31, 0.26);
  background: rgba(13, 7, 0, 0.56);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.ctf-menu-button:hover,
.ctf-menu-button:focus-visible {
  border-color: var(--red);
  box-shadow: inset 0.3rem 0 0 var(--red);
}

.ctf-menu-index { color: var(--green); font-weight: 900; }
.ctf-menu-label { display: grid; gap: 0.2rem; min-width: 0; }
.ctf-menu-verb { color: var(--muted); font-size: 0.7rem; font-weight: 900; letter-spacing: 0.12em; }
.ctf-menu-title { color: var(--orange-soft); font-family: var(--font-display); text-transform: uppercase; }
.ctf-menu-objective { color: var(--orange); font-size: 0.85rem; }
.ctf-menu-lock { color: #ffb7b7; font-size: 0.8rem; font-weight: 900; }

.ctf-menu-row.choice-locked .ctf-menu-button {
  border-style: dashed;
  opacity: 0.78;
  cursor: not-allowed;
}

/* Decision scrollback. */
#ctf-scrollback {
  display: grid;
  gap: 0.75rem;
  margin-top: 1.25rem;
}
#ctf-workspace.ctf-skin-siem #ctf-scrollback,
#ctf-workspace.ctf-skin-siem #ctf-console-chrome { display: none; }

.ctf-scrollback-entry {
  padding: 0.6rem 0.8rem;
  border-left: 0.2rem solid var(--muted);
  background: rgba(13, 7, 0, 0.5);
  font-family: var(--font-mono, ui-monospace, "Cascadia Code", "Consolas", monospace);
}
.ctf-scrollback-cmd { margin: 0 0 0.35rem; color: var(--green); }
.ctf-scrollback-out { margin: 0 0 0.35rem; color: var(--orange); font-size: 0.9rem; }
.ctf-scrollback-note { margin: 0; color: var(--muted); font-size: 0.82rem; }

.ctf-blue-team summary {
  color: var(--orange-soft);
  font-family: var(--font-display);
  font-weight: 900;
  text-transform: uppercase;
  cursor: pointer;
}
.ctf-blue-team-row { margin: 0.25rem 0; font-size: 0.82rem; overflow-wrap: anywhere; }

@media (prefers-reduced-motion: reduce) {
  .ctf-console-cursor { animation: none; }
}
```

Note: `--font-mono` and `--font-display` may not exist as tokens; the `var(..., fallback)` form keeps it safe. If `--font-mono` is absent the fallback monospace stack applies. (Do not add new `:root` tokens in this task; a follow-up may promote `--font-mono` into `css/style.css`.)

- [ ] **Step 5: Run the smoke test — console assertions pass**

Run:
```bash
node tests/run-site-browser-smoke.mjs
```
Expected: PASS, including `hasBanner`, `firstMenuIndex === "[1]"`, and `noExecuteLabel`.

- [ ] **Step 6: Manual verification**

Serve locally and eyeball the threat track:
```bash
python -m http.server 8000
```
Open `http://localhost:8000/ctf.html`, Start with **Threat Simulation**, and confirm: banner + blinking cursor (steady under OS "reduce motion"), numbered `[1]/[2]…` operations, locked rows show `[-] LOCKED — prerequisite: …`, choosing appends a scrollback entry, and the Blue-Team Visibility readout is collapsed by default. Check 320px width has no horizontal scroll.

- [ ] **Step 7: Commit**

```bash
git add js/ctf/console-view.js css/ctf.css tests/run-site-browser-smoke.mjs
git commit -m "feat(ctf): operator-console surface for the attacker track

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Defender mock-SIEM surface

Turn the stub SIEM into the real thing: active-filter pills, a fields sidebar with value counts, an inert per-severity bar readout, expandable event rows, and the response-playbook styling. Structured controls only. Plus the SIEM CSS skin and the defender-start smoke path.

**Files:**
- Modify: `js/ctf/siem-view.js`
- Modify: `css/ctf.css` (SIEM SKIN section)
- Test: `tests/run-site-browser-smoke.mjs`

**Interfaces:**
- Consumes: `renderSiem(ctx)` and the `ctx` shape from Task 1 — including `events`, `fieldCounts`, `filters`, and `handlers.onSetFilter/onClearFilter/onClearAll/onBookmarkEvent`.
- Produces: field-value buttons carry `data-filter-key` + `data-filter-value`; pill buttons carry `data-clear-key`; event bookmark buttons keep `data-event-id`. (These match the delegated listeners wired in Task 1 Step 6h.)

- [ ] **Step 1: Add the defender-start smoke path and SIEM assertions**

In `tests/run-site-browser-smoke.mjs`, after the console block (and before the `#ctf-reset` dialog checks), add a reset + defender start, then assert the SIEM surface and the no-free-text-control invariant. Use the existing reset dialog to return to launch first:

```js
    // Switch to the defender track and verify the SIEM surface.
    await inspect("document.querySelector('#ctf-reset').click(); document.querySelector('#confirm-reset').click()");
    await delay(50);
    await inspect(`document.querySelector('input[name="ctf-mode"][value="defender"]').click()`);
    await inspect("document.querySelector('#ctf-start').click()");
    await delay(100);
    const siem = await inspect(`({
      skin: document.querySelector('#ctf-workspace').className,
      focused: document.activeElement?.id,
      fieldButtons: document.querySelectorAll('#ctf-fields button[data-filter-key]').length,
      results: document.querySelectorAll('#timeline-events details.ctf-result').length,
      freeTextInputs: document.querySelectorAll('#ctf-workspace input:not([type=datetime-local]):not([type=radio]):not([type=checkbox]), #ctf-workspace input[type=text], #ctf-workspace input[type=search]').length,
      noExecuteLabel: Array.from(document.querySelectorAll('#ctf-choices .ctf-choice-card > button')).every((b) => !/\\b(run|execute)\\b/i.test(b.textContent || '')),
      scrollWidth: document.documentElement.scrollWidth
    })`);
    assert.ok(siem.skin.includes("ctf-skin-siem"), "Defender track did not apply the SIEM skin class");
    assert.equal(siem.focused, "node-title", "Defender start did not focus the incident header");
    assert.ok(siem.fieldButtons >= 1, "SIEM fields sidebar rendered no clickable values");
    assert.ok(siem.results >= 1, "SIEM rendered no expandable result rows");
    assert.equal(siem.freeTextInputs, 0, "Workspace must expose no free-text/command input controls");
    assert.equal(siem.noExecuteLabel, true, "Workspace must not use run/execute labels anywhere");
    assert.equal(siem.scrollWidth, 320, "SIEM skin caused horizontal overflow at 320px");
```

- [ ] **Step 2: Run the smoke test to confirm it fails**

Run:
```bash
node tests/run-site-browser-smoke.mjs
```
Expected: FAIL with `SIEM fields sidebar rendered no clickable values` (stub renders none).

- [ ] **Step 3: Rewrite `js/ctf/siem-view.js` with the real surface**

```js
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
      dom.fields.append(button === null ? document.createComment("") : button);
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
  const { dom, textElement, events, engineState } = ctx;
  dom.timelineCount.textContent = `${events.length} ${events.length === 1 ? "event" : "events"} shown`;
  dom.timelineEvents.replaceChildren();
  if (events.length === 0) {
    dom.timelineEvents.append(textElement("p", "ctf-empty", "No revealed synthetic events match these filters."));
    return;
  }
  const bookmarks = engineState.__bookmarks ?? [];
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
```

Correction to keep bookmark highlighting correct: `engineState` does not hold bookmarks. In Task 1 Step 6e, add `eventBookmarks: [...ctfUiState.eventBookmarks]` to the `ctx` object, and in `renderResults` read `ctx.eventBookmarks` instead of `engineState.__bookmarks`. Apply that now:
- In `app.js` `buildViewContext`, add: `eventBookmarks: [...ctfUiState.eventBookmarks],`
- In `siem-view.js` `renderResults`, replace `const bookmarks = engineState.__bookmarks ?? [];` with `const bookmarks = ctx.eventBookmarks;` and drop the unused `engineState` destructure.

Also remove the stray defensive `dom.fields.append(button === null ? … )` line in `renderFields` — it is dead; the loop already appends `button` to `group`. Final `renderFields` inner loop appends only to `group`:
```js
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
```

- [ ] **Step 4: Add the SIEM SKIN CSS to `css/ctf.css`**

```css
/* ===== SIEM SKIN ===== */

#ctf-workspace.ctf-skin-siem .ctf-narrative {
  border-left: 0.35rem solid var(--red);
}

.ctf-filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.ctf-pill {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  min-height: 2.75rem;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--orange-soft);
  background: rgba(255, 157, 31, 0.08);
  color: var(--orange-soft);
  font-size: 0.8rem;
  cursor: pointer;
}
.ctf-pill:hover,
.ctf-pill:focus-visible { border-color: var(--red); color: var(--red); }
.ctf-pill-x { font-weight: 900; }
.ctf-pill-empty { color: var(--muted); font-size: 0.85rem; }

.ctf-severity-bars { display: grid; gap: 0.35rem; margin-bottom: 1rem; }
.ctf-sev-row { display: grid; grid-template-columns: 5rem minmax(0, 1fr) 2rem; gap: 0.5rem; align-items: center; }
.ctf-sev-key { justify-self: start; }
.ctf-sev-track { height: 0.75rem; background: rgba(255, 157, 31, 0.12); }
.ctf-sev-fill { display: block; height: 100%; background: var(--orange); }
.ctf-sev-high { background: #ff9292; }
.ctf-sev-medium { background: #ffe66d; }
.ctf-sev-low, .ctf-sev-info { background: var(--green); }
.ctf-sev-count { text-align: right; color: var(--muted); }

.ctf-siem-body {
  display: grid;
  grid-template-columns: minmax(10rem, 0.5fr) minmax(0, 1.5fr);
  gap: 1rem;
  align-items: start;
}
.ctf-fields { display: grid; gap: 1rem; min-width: 0; }
.ctf-field-group { display: grid; gap: 0.25rem; }
.ctf-field-name {
  margin: 0;
  color: var(--orange-soft);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ctf-field-value {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  min-height: 2.5rem;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--border);
  background: rgba(13, 7, 0, 0.5);
  color: #ffe3bb;
  font-size: 0.82rem;
  text-align: left;
  cursor: pointer;
}
.ctf-field-value[aria-pressed="true"] { border-color: var(--red); color: var(--red); }
.ctf-field-value:hover,
.ctf-field-value:focus-visible { border-color: var(--orange-soft); }
.ctf-field-count { color: var(--green); font-weight: 900; }

.ctf-result { border: 1px solid rgba(255, 157, 31, 0.26); background: rgba(13, 7, 0, 0.56); }
.ctf-result summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  align-items: center;
  padding: 0.6rem 0.8rem;
  cursor: pointer;
  font-family: var(--font-mono, ui-monospace, "Cascadia Code", "Consolas", monospace);
  font-size: 0.82rem;
}
.ctf-result[open] summary { border-bottom: 1px solid var(--border); }
.ctf-result-time { color: var(--muted); }
.ctf-result-host { color: var(--orange-soft); }
.ctf-result-action { color: var(--orange); }
.ctf-result > *:not(summary) { margin: 0.5rem 0.8rem; }
.ctf-result dl {
  display: grid;
  grid-template-columns: minmax(6rem, auto) minmax(0, 1fr);
  gap: 0.3rem 0.7rem;
}
.ctf-result dt { color: var(--muted); }
.ctf-result dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }

@media (max-width: 48rem) {
  .ctf-siem-body { grid-template-columns: 1fr; }
}
@media (max-width: 22rem) {
  .ctf-sev-row { grid-template-columns: 4rem minmax(0, 1fr) 1.5rem; }
}
```

- [ ] **Step 5: Run the smoke test — SIEM assertions pass**

Run:
```bash
node tests/run-site-browser-smoke.mjs
```
Expected: PASS, including `ctf-skin-siem`, `fieldButtons >= 1`, `results >= 1`, `freeTextInputs === 0`, and `scrollWidth === 320`.

- [ ] **Step 6: Manual verification**

```bash
python -m http.server 8000
```
Open `http://localhost:8000/ctf.html`, Start with **Incident Response**. Confirm: fields sidebar lists values with counts; clicking a value adds a pill and narrows results; removing a pill restores; results are expandable rows with the synthetic tag inside; severity bars reflect counts; the response playbook sits in the right rail. Then test **Paired Mode**: finish the threat console, hand off, and confirm the surface switches from console to SIEM. Check 320px.

- [ ] **Step 7: Commit**

```bash
git add js/ctf/siem-view.js js/ctf/app.js css/ctf.css tests/run-site-browser-smoke.mjs
git commit -m "feat(ctf): mock-SIEM surface for the defender track

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Full validation sweep and documentation

Run every gate, confirm the engine harness in a browser, and update the two structure docs.

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Register the new view modules in the safety content scanner**

The safety content scanner walks a fixed file list; the two new view modules must be added so the forbidden-pattern / synthetic / `.invalid` / documentation-IP / secret checks actually cover the new rendering code. In `tests/validate-ctf-content.ps1`, in the `$relativeRuntimeFiles` array (around lines 27–42), add these two entries immediately after the `'js\ctf\app.js',` line (note backslash separators to match the existing entries):

```powershell
    'js\ctf\console-view.js',
    'js\ctf\siem-view.js',
```

This only ADDS files to the scan set — it strengthens safety coverage and changes no check. Then run the full validator (which invokes the content scanner) to confirm the two modules pass:

```bash
powershell -ExecutionPolicy Bypass -File tests/validate-ctf.ps1
```

Expected: PASS. The modules use only `createElement` + `textContent`, reference no hosts/IPs, and contain no forbidden patterns or secrets, so they satisfy every content check. Commit this on its own:

```bash
git add tests/validate-ctf-content.ps1
git commit -m "test(ctf): scan console-view and siem-view in the safety content validator

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 2: Run the complete offline validation suite**

Run each and confirm success:
```bash
pwsh tests/validate-ctf.ps1
node tests/run-ctf-engine.mjs
node tests/run-ctf-playthroughs.mjs
node tests/run-site-browser-smoke.mjs
```
Expected: all pass. `validate-ctf.ps1` must still report clean (no data/content changed). The smoke test prints its pass line including the keyboard focus sequence.

- [ ] **Step 3: Confirm the engine harness in a browser**

Open `tests/ctf-engine.html` in a browser and confirm it reads **42 passed / 0 failed** (this plan changed no engine code, so the count is unchanged).

- [ ] **Step 4: Update `README.md`**

In the file-structure/site-map section, under the `js/ctf/` listing, add the two new modules and note the skins. Add these lines alongside the existing `app.js` entry:
```
  console-view.js      attacker "operator console" surface (numbered menu + scrollback) — presentation only
  siem-view.js         defender "mock SIEM" surface (pills, fields sidebar, expandable results) — presentation only
```
And add one sentence to the CTF description: "The threat track renders as an operator console and the defender track as a structured mock SIEM; both are pure presentation over the same allowlisted engine, with no command entry or free-text search."

- [ ] **Step 5: Update `CLAUDE.md`**

Mirror the same two-line addition under the `js/ctf/` block in the File structure section, and add `console-view.js` / `siem-view.js` to the "single entry point app.js" note so the module map stays accurate. (README wins on any conflict.)

- [ ] **Step 6: Commit the docs**

```bash
git add README.md CLAUDE.md
git commit -m "docs(ctf): record console + SIEM per-track surfaces

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 7: Final safety self-check against `docs/ctf-safety.md`**

Confirm by inspection (no code change expected): the workspace exposes zero command/target/free-text inputs (only radios, the two `datetime-local` inputs, and the inert note textareas); no `innerHTML`/`eval`/dynamic import/`fetch` was introduced in `console-view.js`, `siem-view.js`, or `app.js`; every telemetry row still shows its synthetic tag; and no new scenario/telemetry content strings were added. Record the result in the PR description when the branch is finished.

---

## Notes for the implementer

- The engine, contracts, storage, and data files are off-limits — if a task seems to need them, stop and re-check the design; it almost certainly doesn't.
- `ctx.handlers` is the only path to state mutation from a view module. View modules never call `persist()` or touch `ctfUiState` directly.
- Keep every user-visible string inert text set via `textContent`; never build DOM from scenario/player strings with `innerHTML`.
- The blinking cursor and any transition must vanish under `prefers-reduced-motion: reduce` — the smoke test runs in that mode and asserts immediate focus.
