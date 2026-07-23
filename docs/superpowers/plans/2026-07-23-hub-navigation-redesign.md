# Hub Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `index.html`'s single-panel hash-reveal with a scannable page — a scalable mission-card launch bay plus a sticky scroll-spy section nav — that fixes the blank landing, the two overlapping navs, and the missing wayfinding.

**Architecture:** The hub renders all content in normal document flow (JS-on matches JS-off). A reusable `.mission-card` grid (`#launch`) is the canonical destination chooser; a `position: sticky` `.section-nav` highlights the current section via an IntersectionObserver scroll-spy in `js/menu.js`. Game and CTF are represented by launch cards, so their standalone teaser sections are removed.

**Tech Stack:** Vanilla HTML, CSS (`css/style.css` tokens + `css/home.css` layout), classic-script JS (`js/menu.js`). No frameworks, no build step. Automated verification is the existing headless-Chrome smoke test (`tests/run-site-browser-smoke.mjs`, Node 20+, Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`).

## Global Constraints

- Progressive enhancement: all core content readable and navigable with JavaScript disabled. Scroll-spy is enhancement only.
- Accessibility: usable at 320px width with **no horizontal scroll** (`document.documentElement.scrollWidth === 320`); visible focus; `prefers-reduced-motion` honored (no smooth scroll / motion); ~44px touch targets; keyboard-reachable nav.
- CSP unchanged; zero external network requests; fully offline.
- Vanilla HTML/CSS/JS only; files stay split by concern.
- `css/style.css` `:root` is the single source of truth for the palette; prefer CSS variables over raw hex.
- Keep `id="portfolio"` on `<main>`; keep the boot screen and `js/boot.js` unchanged.
- The smoke test must pass and stay green after every task; `menu.js` must throw zero console errors.
- Do NOT build `games.html` or a CTF scenario picker (YAGNI); only keep the future path a one-line `href` change.

---

## File Structure

- `index.html` — restructure the hub body: hero (one CTA) → `#launch` mission-card bay → sticky `.section-nav` → sections (`#profile`, `#projects`, `#contact`, `#credits`) in normal flow. Remove `#game`/`#ctf` teaser sections, the old `.menu-options` list, and per-panel "Back to Top" links.
- `css/home.css` — add `.launch-bay` / `.mission-*` and sticky `.section-nav` / `.section-nav-link` styles; remove single-panel (`display:none` / `.active` / `panel-in`) and old menu-list rules.
- `css/style.css` — bump `.content-panel { scroll-margin-top }` so anchored jumps clear the sticky bar (only change to this file).
- `js/menu.js` — replace the single-panel hash router with an IntersectionObserver scroll-spy + the boot-replay hook.
- `tests/run-site-browser-smoke.mjs` — extend the hub assertions to cover the new IA and scroll-spy.
- `README.md`, `CLAUDE.md` — sync the site-map / file notes.

---

## Task 1: Launch bay + hero trim (additive)

Add the mission-card launch bay and trim the hero to a single CTA. This task is purely additive — the old menu list, single-panel sections, and `menu.js` router stay in place, so the page keeps working throughout. Deliverable: a rendered 4-card launch bay + one hero CTA, smoke test green.

**Files:**
- Modify: `index.html` (hero actions block; insert `#launch` after `</header>`)
- Modify: `css/home.css` (add launch-bay + mission-card styles)
- Modify: `tests/run-site-browser-smoke.mjs` (extend the `portfolio` inspect block)

**Interfaces:**
- Produces: a `<section class="launch-bay" id="launch">` containing exactly four `<li class="mission-card">`, each with a single primary `<a class="button button-primary">`; the CTF card's link is `<a href="ctf.html">` and the game card's is `<a href="game.html">`. Hero contains exactly one `.hero-actions .button`. Task 2 relies on `#launch` existing and on the sticky nav's `#launch` target.

- [ ] **Step 1: Add the failing smoke assertions**

In `tests/run-site-browser-smoke.mjs`, replace the existing hub `portfolio` inspect + asserts (currently the block starting `const portfolio = await inspect(` through its three `assert` lines) with:

```js
    const portfolio = await inspect(`({
      exists: Boolean(document.querySelector('#portfolio')),
      ctfLink: document.querySelector('a[href="ctf.html"]')?.textContent.trim(),
      gameLink: document.querySelector('#launch a[href="game.html"]')?.textContent.trim(),
      missionCards: document.querySelectorAll('#launch .mission-card').length,
      heroCtas: document.querySelectorAll('.hero .hero-actions .button').length,
      scrollWidth: document.documentElement.scrollWidth
    })`);
    assert.equal(portfolio.exists, true);
    assert.ok(portfolio.ctfLink, "Launch bay is missing the CTF card link");
    assert.ok(portfolio.gameLink, "Launch bay is missing the game card link");
    assert.equal(portfolio.missionCards, 4, "Launch bay should have four mission cards");
    assert.equal(portfolio.heroCtas, 1, "Hero should have a single primary CTA");
    assert.equal(portfolio.scrollWidth, 320);
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run:

```bash
node tests/run-site-browser-smoke.mjs
```

Expected: FAIL — `missionCards` is `0` (no `#launch` yet), assertion "Launch bay should have four mission cards".

- [ ] **Step 3: Trim the hero actions**

In `index.html`, replace the whole `<div class="hero-actions"> … </div>` block (the five buttons) with a single CTA:

```html
      <div class="hero-actions">
        <a class="button button-primary" href="resume.html">View Résumé</a>
      </div>
```

- [ ] **Step 4: Insert the launch bay**

In `index.html`, immediately after the closing `</header>` of `.hero`, insert:

```html
    <section class="launch-bay" id="launch" aria-labelledby="launch-title">
      <p class="panel-kicker">MANGO.SYS // SELECT MISSION</p>
      <h2 id="launch-title">Launch Bay</h2>
      <ul class="mission-grid">
        <li class="mission-card">
          <h3>Character Sheet</h3>
          <p class="mission-kind">Database // Personnel</p>
          <p class="mission-desc">The résumé — experience, certifications, and forensics focus.</p>
          <a class="button button-primary" href="#profile">▸ View Profile</a>
        </li>
        <li class="mission-card">
          <h3>Security Projects</h3>
          <p class="mission-kind">Database // Missions</p>
          <p class="mission-desc">Verified case studies from the mango orchard.</p>
          <a class="button button-primary" href="#projects">▸ View Missions</a>
        </li>
        <li class="mission-card">
          <h3>New Game</h3>
          <p class="mission-kind">Pesticide-DMZ // Live</p>
          <p class="mission-desc">Purge rotten packets in a playable firewall raycaster.</p>
          <a class="button button-primary" href="game.html">▸ Launch Game</a>
        </li>
        <li class="mission-card">
          <h3>Incident Tabletop</h3>
          <p class="mission-kind">Incident Archive // Offline</p>
          <p class="mission-desc">A fictional, inert incident-response CTF. Every record is synthetic.</p>
          <a class="button button-primary" href="ctf.html">▸ Launch CTF</a>
        </li>
      </ul>
    </section>
```

- [ ] **Step 5: Add launch-bay styles**

Append to `css/home.css`:

```css
/* Launch bay: the scalable mission-card chooser. The grid wraps to any number
   of cards and collapses to a single column on narrow screens, so adding more
   games or CTF topics later is just another <li class="mission-card">. */
.launch-bay {
  margin-block: 2rem;
  scroll-margin-top: 4rem;
}

.mission-grid {
  display: grid;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
  gap: 1rem;
  list-style: none;
}

.mission-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.5rem;
  padding: clamp(1rem, 3vw, 1.5rem);
  border: 1px solid var(--border);
  background: rgba(13, 7, 0, 0.55);
  transition: border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease;
}

.mission-card:hover,
.mission-card:focus-within {
  border-color: var(--red);
  box-shadow: var(--shadow-red);
  transform: translateY(-2px);
}

.mission-card h3 {
  margin: 0;
}

.mission-kind {
  margin: 0;
  color: var(--green);
  font-family: var(--font-display);
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.mission-desc {
  flex: 1 1 auto;
  margin: 0;
}

.mission-card .button {
  align-self: flex-start;
  margin-top: 0.25rem;
}
```

(Reduced-motion is already handled globally in `css/style.css`, which neutralizes these transitions/transforms.)

- [ ] **Step 6: Run the smoke test to verify it passes**

Run:

```bash
node tests/run-site-browser-smoke.mjs
```

Expected: PASS — "Browser smoke passed: …". `missionCards` is `4`, `heroCtas` is `1`, `scrollWidth` is `320`.

- [ ] **Step 7: Commit**

```bash
git add index.html css/home.css tests/run-site-browser-smoke.mjs
git commit -m "$(cat <<'EOF'
feat(hub): add scalable mission-card launch bay and trim hero to one CTA

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Scannable flow + sticky scroll-spy nav (model switch)

Flip the hub from single-panel reveal to scannable normal-flow: remove the single-panel CSS/JS, replace the old "SELECT DATABASE" list with a sticky scroll-spy nav, and delete the now-duplicated `#game`/`#ctf` teaser sections. This is one atomic model change. Deliverable: all sections visible in flow, sticky nav highlights the section in view, smoke test green.

**Files:**
- Modify: `index.html` (remove old nav list, `#game`/`#ctf` sections, per-panel "Back to Top"; add sticky `.section-nav`)
- Modify: `css/home.css` (remove single-panel + old-menu rules; add sticky nav rules)
- Modify: `css/style.css` (bump `.content-panel` scroll-margin-top)
- Rewrite: `js/menu.js`
- Modify: `tests/run-site-browser-smoke.mjs` (add scannable + scroll-spy assertions)

**Interfaces:**
- Consumes: `#launch` from Task 1.
- Produces: `<nav class="section-nav">` with `.section-nav-link` anchors whose `href`s are exactly `#launch`, `#profile`, `#projects`, `#contact`, `#credits`; the in-view section's link carries `aria-current="location"` (set by `js/menu.js`).

- [ ] **Step 1: Add the failing smoke assertions**

In `tests/run-site-browser-smoke.mjs`, immediately after the Task 1 hub `portfolio` assertions (after `assert.equal(portfolio.scrollWidth, 320);`), insert:

```js
    const scannable = await inspect(`({
      sectionsVisible: ['profile','projects','contact','credits'].every((id) => {
        const el = document.getElementById(id);
        return Boolean(el) && el.offsetParent !== null;
      }),
      gameSectionGone: !document.getElementById('game'),
      ctfSectionGone: !document.getElementById('ctf'),
      navLinks: Array.from(document.querySelectorAll('.section-nav-link')).map((a) => a.getAttribute('href'))
    })`);
    assert.equal(scannable.sectionsVisible, true, "All hub sections must be visible in normal flow");
    assert.equal(scannable.gameSectionGone, true, "#game teaser section should be removed");
    assert.equal(scannable.ctfSectionGone, true, "#ctf teaser section should be removed");
    assert.deepEqual(scannable.navLinks, ["#launch", "#profile", "#projects", "#contact", "#credits"]);

    await inspect("window.scrollTo(0, document.getElementById('projects').offsetTop)");
    await delay(200);
    const spy = await inspect(`document.querySelector('.section-nav-link[href="#projects"]')?.getAttribute('aria-current')`);
    assert.equal(spy, "location", "Scroll-spy did not mark the Missions link current");
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run:

```bash
node tests/run-site-browser-smoke.mjs
```

Expected: FAIL — `.section-nav-link` elements don't exist yet, so `navLinks` is `[]` and the `deepEqual` assertion fails (and/or `sectionsVisible` is false because panels are still `display:none`).

- [ ] **Step 3: Replace the old menu list with the sticky nav**

In `index.html`, replace the entire old `<nav class="section-nav" …> … </nav>` block (the "SELECT DATABASE" `.menu-options` list) with:

```html
    <nav class="section-nav" aria-label="Portfolio sections">
      <ul class="section-nav-list">
        <li><a class="section-nav-link" href="#launch">Launch</a></li>
        <li><a class="section-nav-link" href="#profile">Character Sheet</a></li>
        <li><a class="section-nav-link" href="#projects">Missions</a></li>
        <li><a class="section-nav-link" href="#contact">Contact</a></li>
        <li><a class="section-nav-link" href="#credits">Credits</a></li>
      </ul>
    </nav>
```

- [ ] **Step 4: Remove the `#game` and `#ctf` teaser sections and per-panel "Back to Top" links**

In `index.html`:
- Delete the entire `<section class="content-panel" id="game" …> … </section>` block.
- Delete the entire `<section class="content-panel" id="ctf" …> … </section>` block.
- In the remaining sections (`#profile`, `#projects`, `#contact`, `#credits`), delete each `<a class="button back-to-menu" href="#top">Back to Top</a>` link. In `#credits`, keep the `<button class="button" id="replay-boot" …>` — only remove its trailing `back-to-menu` link.

After this, `.panel-actions` in `#profile`/`#game`-gone leaves only the "View Full …" button where present; that is fine.

- [ ] **Step 5: Rewrite `js/menu.js` as a scroll-spy**

Replace the entire contents of `js/menu.js` with:

```js
// menu.js
// Sticky section-nav scroll-spy for the hub. Highlights the nav link for the
// section currently in view. This is pure enhancement: with JavaScript off the
// nav is plain in-page anchor links and every section is visible in normal
// document flow, so navigation still works.

(function () {
  "use strict";

  const navLinks = Array.from(document.querySelectorAll(".section-nav-link"));
  const replayButton = document.getElementById("replay-boot");

  // Boot-replay hook. This button only exists on the hub's Credits section.
  if (replayButton) {
    replayButton.addEventListener("click", function () {
      if (window.MangoBoot) window.MangoBoot.replay();
    });
  }

  // Scroll-spy needs the nav links and IntersectionObserver support. Bail out
  // safely otherwise — the plain anchor links keep working.
  if (navLinks.length === 0 || typeof IntersectionObserver === "undefined") {
    return;
  }

  // Pair each nav link with the section element it points at.
  const pairs = navLinks
    .map(function (link) {
      const id = link.getAttribute("href").replace(/^#/, "");
      const section = document.getElementById(id);
      return section ? { link: link, section: section } : null;
    })
    .filter(Boolean);

  // Sections currently touching the viewport.
  const visibleSections = new Set();

  function highlightTopmost() {
    // The "current" section is the topmost one still visible on screen.
    let winner = null;
    pairs.forEach(function (pair) {
      if (!visibleSections.has(pair.section)) return;
      if (!winner || pair.section.offsetTop < winner.section.offsetTop) {
        winner = pair;
      }
    });
    navLinks.forEach(function (link) {
      if (winner && link === winner.link) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        visibleSections.add(entry.target);
      } else {
        visibleSections.delete(entry.target);
      }
    });
    highlightTopmost();
  }, { threshold: 0 });

  pairs.forEach(function (pair) {
    observer.observe(pair.section);
  });
})();
```

- [ ] **Step 6: Swap single-panel CSS for sticky-nav CSS**

In `css/home.css`:

(a) **Remove** these now-dead rules:
- `.section-nav { … }` (old margin/border block) and `.section-nav-label { … }`
- `.menu-options { … }` and `.menu-option { … }` and `.menu-option:hover, .menu-option[aria-current="location"] { … }`
- `.js .content-panel { display: none; }` and `.js .content-panel.active { … }` and `@keyframes panel-in { … }`
- `#replay-boot + .back-to-menu { … }`
- Inside `@media (max-width: 48rem)`: the `.menu-options,` selector line (leave `.case-study-grid` and `.contact-list`) and the whole `#replay-boot + .back-to-menu { … }` rule.

(b) **Add** the sticky nav rules (put them where the old `.section-nav` block was):

```css
/* Sticky section nav with scroll-spy. Stays visible while scrolling and marks
   the current section (js/menu.js sets aria-current). Without JS it is just a
   row of in-page anchor links. On narrow screens it scrolls horizontally
   inside itself so the page never overflows. */
.section-nav {
  position: sticky;
  z-index: 50;
  top: 0;
  margin-block: 0 1.5rem;
  border-block: 1px solid var(--border);
  background: rgba(13, 7, 0, 0.92);
}

.section-nav-list {
  display: flex;
  margin: 0;
  padding: 0.4rem;
  gap: 0.3rem;
  list-style: none;
  overflow-x: auto;
}

.section-nav-link {
  display: inline-flex;
  min-height: 2.6rem;
  align-items: center;
  padding: 0.4rem 0.75rem;
  border-bottom: 2px solid transparent;
  color: var(--orange);
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-decoration: none;
  text-transform: uppercase;
  white-space: nowrap;
}

.section-nav-link:hover,
.section-nav-link[aria-current="location"] {
  border-bottom-color: var(--red);
  color: var(--red);
}
```

- [ ] **Step 7: Bump section scroll-margin so jumps clear the sticky bar**

In `css/style.css`, in the `.content-panel { … }` rule, change:

```css
  scroll-margin-top: 1rem;
```

to:

```css
  scroll-margin-top: 4rem;
```

- [ ] **Step 8: Run the smoke test to verify it passes**

Run:

```bash
node tests/run-site-browser-smoke.mjs
```

Expected: PASS. `sectionsVisible` true, `gameSectionGone`/`ctfSectionGone` true, `navLinks` deep-equals the five hrefs, and the Missions link reports `aria-current="location"` after scrolling.

- [ ] **Step 9: Manual accessibility spot-check**

Serve locally and verify by hand (these aren't covered by the smoke test):

```bash
python -m http.server 8000
```

- With JavaScript disabled (browser setting), load `http://localhost:8000/`: hero, launch bay, all four sections, and the nav links are all present and usable; no blank area.
- Keyboard: Tab through the sticky nav and mission-card links — each has a visible focus ring; the nav links are reachable.
- Enable "reduce motion" (OS/browser): no smooth scrolling or card motion.

- [ ] **Step 10: Commit**

```bash
git add index.html css/home.css css/style.css js/menu.js tests/run-site-browser-smoke.mjs
git commit -m "$(cat <<'EOF'
feat(hub): scannable sections with sticky scroll-spy nav

Replace the single-panel hash reveal with normal-flow sections and a sticky
section nav highlighted by an IntersectionObserver scroll-spy. Remove the
duplicated #game/#ctf teaser sections (now covered by launch cards) and the
old SELECT DATABASE menu list.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Documentation sync + final verification

Bring `README.md` and `CLAUDE.md` in line with the new IA and run the full validation set once more. Deliverable: docs match the shipped structure; smoke test green.

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: the final structure from Tasks 1–2. Produces no code.

- [ ] **Step 1: Update `README.md`**

In `README.md`:
- Change the `index.html` bullet (currently "portfolio landing page, boot sequence, and hash-addressable sections") to:

```
- `index.html` — portfolio landing page, boot sequence, mission-card launch bay, and scannable sections with a sticky scroll-spy nav
```

- Change the `js/menu.js` bullet (currently "progressive hash navigation and focus management") to:

```
- `js/menu.js` — sticky section-nav scroll-spy and boot-replay hook
```

- [ ] **Step 2: Update `CLAUDE.md`**

In `CLAUDE.md`:
- In the **Site map** table, replace the `#game` and `#ctf` section rows so Game and CTF read as launch-bay destinations, and note the launch bay. The table should read:

```
| Section | Destination |
| --- | --- |
| Character Sheet — Résumé | `#profile`, linking to the full `resume.html` |
| Missions — Security Projects | `#projects`, with full case studies under `projects/` |
| Launch Bay | `#launch` — mission cards linking to `#profile`, `#projects`, `game.html`, `ctf.html` |
| New Game — Playable Demo | `game.html` (launch card) |
| CTF — Incident Tabletop | `ctf.html` (launch card) |
| Summon — Contact | `#contact` |
| Credits — About This Site | `#credits` |
```

- In the **File structure** block, update the `index.html` and `js/menu.js` comments:

```
index.html           optional boot + portfolio hero + launch bay + scannable #-sections
```
```
js/menu.js           sticky section-nav scroll-spy + boot-replay hook (index.html only)  — classic script
```

- In the **Site map** intro sentence that says "professional summary, primary actions, and hash-addressable sections", change "hash-addressable sections" to "a mission-card launch bay and scannable sections with a sticky scroll-spy nav".

- [ ] **Step 3: Verify docs no longer describe the removed model**

Run:

```bash
grep -n "hash-addressable\|SELECT DATABASE\|single-panel\|menu-option" README.md CLAUDE.md
```

Expected: no matches (or only unrelated matches you can confirm are correct). Fix any stale wording found.

- [ ] **Step 4: Run the full validation set**

Run:

```bash
node tests/run-site-browser-smoke.mjs
```

Expected: PASS.

The CTF validators are unaffected (no CTF files changed), but run them to confirm nothing regressed:

```bash
pwsh tests/validate-ctf.ps1
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: sync site map with hub navigation redesign

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Hero → one CTA → covered (Task 1, Steps 3).
- Launch bay, 4 scalable cards → Task 1 (Steps 4–5); scalability via `auto-fit` grid + reusable `.mission-card`.
- Sticky scroll-spy nav (Launch/Character Sheet/Missions/Contact/Credits) → Task 2 (Steps 3, 5, 6).
- Sections in normal flow; remove single-panel model → Task 2 (Steps 4, 5, 6).
- Remove `#game`/`#ctf` teasers → Task 2 (Step 4).
- `scroll-margin-top` for sticky bar → Task 2 (Step 7) + `.launch-bay` (Task 1, Step 5).
- Preserve `#portfolio`, `a[href="ctf.html"]`, 320px no-overflow, zero script errors → smoke assertions across Tasks 1–2.
- JS-off / reduced-motion / keyboard → Task 2 (Step 9 manual) + `menu.js` safe bail-out.
- Docs sync (README + CLAUDE) → Task 3.
- No `games.html` / picker built → honored (not in any task).

**Placeholder scan:** No TBD/TODO; every code step shows complete content; removed-rule lists name exact selectors.

**Type/name consistency:** `.mission-card`, `#launch`, `.section-nav`, `.section-nav-list`, `.section-nav-link`, `aria-current="location"`, `MangoBoot.replay`, `#replay-boot` used consistently across HTML, CSS, JS, and smoke assertions. Nav `href` order (`#launch`,`#profile`,`#projects`,`#contact`,`#credits`) matches the `deepEqual` in Task 2 Step 1.
