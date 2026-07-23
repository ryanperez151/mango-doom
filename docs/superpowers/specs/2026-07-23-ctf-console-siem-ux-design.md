# CTF Console + SIEM UX — Design Spec

Date: 2026-07-23
Component: `ctf.html` — The Mango Keep Incident (offline incident-response tabletop)
Status: Approved for planning

## 1. Goal

Give the two CTF perspectives distinct, genre-appropriate interfaces:

- **Attacker (threat track)** — an operator **console** aesthetic, where the
  choose-your-own-adventure options are presented as a numbered terminal menu
  and outcomes accrete as console scrollback.
- **Defender (defender track)** — a mock **SIEM** (Splunk-like) event-review
  surface, where synthetic log events are searched via structured controls,
  browsed as expandable result rows, and acted on through a response playbook.

This is a **presentation + interaction** change. It reskins and rearranges the
existing workspace and refines interactions within the existing action model.
It does **not** change the engine, scenario data, storage, safety validators,
or the set of allowed actions.

## 2. Binding constraints

### 2.1 Safety contract (`docs/ctf-safety.md` — release blockers)

- Exactly the **seven allowed verbs** remain: inspect, choose, filter logs,
  bookmark evidence, submit hypothesis, contain, build timeline.
- **No execution surface** (invariant #4): no shell/terminal facsimile that
  accepts input, no command field, no faux prompt you type into, no
  autocomplete of commands, no keyboard shortcuts that resemble execution, and
  no "run"/"execute" labels. The console prompt glyph and cursor are **purely
  decorative, non-interactive** styling.
- **No free-text search** on the defender side. All filtering uses fixed,
  structured, allowlisted controls (dropdown values, clickable field values,
  removable filter pills, the existing datetime range).
- No new external requests, `eval`/`Function`, dynamic import, `innerHTML`, or
  URL-bearing fields. Rendering stays `createElement` + `textContent`.
- When spec and safety doc disagree, the safer interpretation wins.

### 2.2 Test / DOM contract (must remain green)

`tests/run-site-browser-smoke.mjs` asserts, and this design preserves:

- `.ctf-safety-label` text still contains `FICTIONAL, INERT SIMULATION`.
- `#ctf-start` visible and keyboard-reachable on launch; `#ctf-resume` and
  `#ctf-reset-launch` hidden until relevant.
- After Start: `#ctf-workspace` becomes visible and `document.activeElement.id`
  is `node-title` (so `#node-title` must exist in **both** skins and receive
  focus).
- `#ctf-reset` opens `#reset-dialog` with focus on `#cancel-reset`; Escape
  closes it and returns focus to `#ctf-reset`.
- After reload with a valid save, `#ctf-resume` is offered.
- A `localStorage` key starting with `mangoSys.ctf` is created on Start.
- `document.documentElement.scrollWidth === 320` at 320px width (no horizontal
  scroll), under `prefers-reduced-motion: reduce`.
- Zero non-loopback network requests; zero browser script errors.

`tests/ctf-engine.html` must still report **42 passed / 0 failed**. The engine
and playthrough runners must still pass unchanged.

### 2.3 Untouched by this work

`js/ctf/state.js`, `js/ctf/contracts.js`, `js/ctf/storage.js`,
`js/ctf/paired.js`, `js/ctf/timeline.js`, every file under `data/ctf/`, and all
safety validators. No new player-facing scenario/telemetry content strings are
introduced (this avoids triggering a new manual content review).

## 3. Architecture

Chosen approach: **CSS skin class + small per-surface view modules.**

### 3.1 Controller / module split

`js/ctf/app.js` remains the controller and owns everything shared:

- state, persistence, save / resume / reset, the reset dialog;
- the live-region announcer;
- timeline **data selection** (`revealedStages`, `revealedEvents`,
  `filteredEvents`) and filter state;
- evidence drawer, asset health, evidence codes, local case notes;
- ending / debrief;
- setting the skin class on `#ctf-workspace`
  (`ctf-skin-console` when `activeTrack === "threat"`, `ctf-skin-siem` when
  `activeTrack === "defender"`) and delegating the surface-specific chrome to
  the active view module.

Two new ES modules (same `type="module"` scope model, create no globals):

- `js/ctf/console-view.js` — renders the attacker console surface: the
  decorative banner + prompt line, node brief/objective as console output, the
  numbered choice menu, and the decision scrollback.
- `js/ctf/siem-view.js` — renders the defender SIEM surface: the active-filter
  pills, the fields sidebar with value counts, the results list with expandable
  rows and the inert severity bar readout, and the response-playbook panel.

Each view module exposes a small, documented render function that app.js calls
with a context object (current node, available choices, filtered events,
handlers to invoke for the allowlisted verbs). The view modules own only the
parts that differ between surfaces; they call back into app.js handlers for
every state change so there is a single mutation path.

### 3.2 CSS

Extend `css/ctf.css` with two clearly-bannered sections
(`/* ===== CONSOLE SKIN ===== */`, `/* ===== SIEM SKIN ===== */`) gated under
`#ctf-workspace.ctf-skin-console` and `#ctf-workspace.ctf-skin-siem`. Use
`grid-template-areas` to rearrange the same panels per track. Reuse the
existing `:root` tokens; add no new colors unless a token already covers it.
Preserve single-column layout and no horizontal scroll at 320px.

## 4. Attacker console surface (threat track)

- **Dominant** panel is the console. A decorative banner
  (`MANGO.SYS FIREWALL // OPERATOR CONSOLE`) and a static, non-interactive
  prompt line (`operator@mangokeep:~$`). Neither accepts input.
- Node brief and current objective print as monospace console output lines.
  `#node-title` is the console's current heading and remains the post-Start
  focus target.
- **Choices as a numbered console menu**: full-width clickable rows rendered as
  `[1] INSPECT THE MANAGEMENT RELATIONSHIP`, `[2] …`. Locked choices render
  dimmed as `[-] LOCKED — prerequisite: <prerequisiteSummary>` and stay
  `aria-disabled`. The action verb is "SELECT"; never "run"/"execute". Click to
  select; no number-key shortcut.
- **Decision scrollback**: below the menu, each recorded decision appends its
  `outcomeText` and `learningConsequence` as console output (oldest to newest),
  reconstructed deterministically from `engineState.choiceIds` on each render —
  no new persisted state.
- The SIEM timeline is demoted to a compact, collapsible **"BLUE-TEAM
  VISIBILITY"** readout, reinforcing the attacker's evidence-awareness learning
  goal. Evidence drawer, asset health, and evidence codes render as console
  side readouts.

## 5. Defender SIEM surface (defender track)

- **Dominant** area is event search + results, Splunk-style, **structured
  controls only**:
  - **Active-filter pills** across the top — one removable pill per active
    filter (source / host / severity / stage / from / through). Removing a pill
    clears that one filter. The existing "Clear Filters" reads as "New Search".
  - **Fields sidebar** — Source, Host, Severity, Stage — each listing its
    values with **counts** across the currently revealed corpus. Clicking a
    value applies that filter (the "filter logs" verb, writing the same
    `ctfUiState.filters`). The datetime range inputs are presented as a "Time
    range" control.
  - **Results**: the event count, a small **inert per-severity bar readout**
    (CSS-width bars derived from counts — no animation dependency), then events
    as **expandable rows** (native `<details>`): collapsed summary =
    time · host · action · severity; expanded = full field table + the
    `[SYNTHETIC — FICTIONAL TRAINING DATA]` tag + the bookmark control.
- The defender's allowlisted choices render as a **"RESPONSE PLAYBOOK"** panel
  (inspect / contain / submit-hypothesis), same cards, SIEM-styled, with locked
  states shown.
- A compact **incident header strip** (case id + current objective) sits above
  search; `#node-title` lives here and is the focus target.
- Evidence drawer, asset health, and evidence codes render as SIEM side panels.

## 6. Shared elements, motion, accessibility

- Both tracks keep: the safety label, the command bar (mode / save / reset),
  local case notes, the ending / debrief screen, and the reset dialog.
- Console/SIEM flourishes (cursor blink, etc.) are **pure decoration, disabled
  under `prefers-reduced-motion`**, and never gate content or focus — content
  renders immediately. No per-character typing that delays content.
- Single column at 320px with no horizontal scroll. Visible focus indicators.
  Screen-reader labels on every new control (pills, field-value buttons,
  expandable rows, menu rows). Core content remains readable with JavaScript
  disabled (the existing `<noscript>` note still applies).

## 7. Interaction changes (all within the seven verbs)

- Console: clicking a menu row = **choose** (existing `applyChoice`). Scrollback
  is derived, not newly stored.
- SIEM: clicking a field value = **filter logs** (sets `ctfUiState.filters`,
  same persist path); removing a pill clears one filter; expandable rows are
  native `<details>` (**inspect**); bookmark buttons unchanged
  (**bookmark evidence** / build timeline).
- Every handler continues to route through the existing app.js functions and
  engine reducers. A rejected action still produces a safe announcement and no
  partial mutation.

## 8. Non-goals

- No new scenario content, telemetry fields, endings, hints, or evidence.
- No engine, contracts, storage, `paired`, or `timeline` logic changes.
- No free-text search or query language; no command/target/authentication/
  upload controls; no keyboard execution shortcuts.
- No new external assets or requests.

## 9. Verification plan

- `pwsh tests/validate-ctf.ps1` — static safety validators.
- `node tests/run-ctf-engine.mjs` and `node tests/run-ctf-playthroughs.mjs`.
- `tests/ctf-engine.html` in a browser — expect 42 passed / 0 failed.
- `node tests/run-site-browser-smoke.mjs` — extend it to also assert (a) the
  per-track skin class is present on `#ctf-workspace`, and (b) the workspace
  contains **zero** free-text/command/target input controls (only the allowed
  structured controls, textareas for inert notes, and datetime range inputs).
- Manual: 320px layout, full keyboard navigation, `prefers-reduced-motion`,
  screen-reader labels, and JavaScript-disabled core content.

## 10. Documentation updates

- `README.md` — file structure + site map: note `js/ctf/console-view.js`,
  `js/ctf/siem-view.js`, and the two per-track skins.
- `CLAUDE.md` — mirror the same structure notes (README wins on conflict).

## 11. Open items (deferred, adjustable later)

- Exact visual density of the SIEM severity bar readout.
- Whether the attacker's "blue-team visibility" readout defaults open or
  collapsed on first render.

These do not block planning and can be tuned during implementation.
