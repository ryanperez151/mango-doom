# Hub Navigation Redesign — Design

**Date:** 2026-07-23
**Status:** Approved (ready for implementation planning)
**Scope:** Front-end navigation and information architecture of `index.html` (the hub). No changes to `game.html`, `ctf.html`, `resume.html`, project pages, or the CTF engine/data.

## Problem

The hub's current JS-on model hides all content panels and reveals exactly one
at a time based on the URL hash. This produces three navigation problems:

1. **Blank landing.** On first load (no hash) the content area is empty — the
   visitor must click a menu item before any content appears.
2. **Two overlapping navs.** The 5-button hero action row and the 6-item
   "SELECT DATABASE" menu duplicate each other (Projects, Game, CTF, Contact
   appear in both) but behave differently — some jump to other pages, some
   reveal in-page panels. Mixed mental model.
3. **No persistent wayfinding.** Once inside a panel, switching requires
   scrolling back up to the menu; the only "you are here" signal
   (`aria-current` on a menu link) scrolls out of view.

## Goals

- Optimize the hub for a **balanced** audience: a recruiter reaches
  résumé/experience fast, *and* the interactive Game/CTF get equal prominence.
- Replace the single-panel reveal with a **scannable page** where JS-on matches
  the already-good JS-off experience.
- Provide **persistent wayfinding** that highlights the current section.
- Collapse the two overlapping navs into one clear model.
- Structure the launch area so it **scales** to more games and more CTF
  topics/themes later, without rework.

## Non-goals / constraints (must be preserved)

- Progressive enhancement: all core content readable and navigable with
  JavaScript disabled. Scroll-spy is enhancement only.
- Accessibility: usable at 320px width, no horizontal scroll; visible focus;
  `prefers-reduced-motion` honored (no smooth scroll / animation); ~44px touch
  targets; keyboard-reachable nav.
- CSP unchanged; site stays offline with zero external network requests.
- Vanilla HTML/CSS/JS, no frameworks. Files stay split by concern.
- `css/style.css` `:root` remains the single source of truth for the palette.
- The browser smoke test's hub assertions stay satisfied (see Testing).
- Do **not** build future index pages (`games.html`, a CTF scenario picker)
  now — YAGNI. Only make the future path cheap.

## Approach

A blend of "scannable page + sticky scroll-spy nav" (A) and "launch-bay cards"
(C). The boot sequence and the mock-console launch vibe carry the terminal
feel, freeing the hub to be clean and scannable.

## Information architecture

New top-to-bottom structure of `index.html` (JS-on and JS-off render the same
order):

1. **Hero** — eyebrow, name, role, summary, credential strip. Trim the action
   row to a **single primary CTA** (`View Résumé`). This removes the
   overlapping-navs problem: the launch bay below is the destination chooser.

2. **Launch Bay** (`id="launch"`) — a responsive, reusable **card grid**. This
   is the canonical "where do I go" chooser, giving résumé and the interactive
   work equal weight. Four cards today:

   | Card | Destination | Kind | Label |
   | --- | --- | --- | --- |
   | Character Sheet — Résumé | `#profile` (on-page) | in-page | ▸ VIEW |
   | Missions — Security Projects | `#projects` (on-page) | in-page | ▸ VIEW |
   | New Game — Playable Demo | `game.html` (full page) | launch | ▸ LAUNCH |
   | Incident Tabletop — CTF | `ctf.html` (full page) | launch | ▸ LAUNCH |

   Each card is a **non-interactive container** with a title, a one-line
   description, a status/kind label, and a **single primary `<a>` action link**
   (styled as a button, e.g. "Launch CTF"). The accessible target is that link
   — no whole-card `<a>` wrapper, to avoid nested interactive elements. The card
   may show a hover/focus-within affordance visually, but only the link is
   focusable/clickable.

3. **Sticky section nav** (`position: sticky; top: 0`) — a slim bar that stays
   visible while scrolling and highlights the current section via scroll-spy.
   Links: **Launch · Character Sheet · Missions · Contact · Credits**. On 320px
   it becomes a horizontal-scroll strip (no wrapping overflow of the page).

4. **Sections in normal flow** (no hide-all-but-one):
   - `#profile` — character card + "View Full Résumé" button to `resume.html`.
   - `#projects` — case studies (unchanged content).
   - `#contact` — contact list (unchanged content).
   - `#credits` — credits + "Replay Boot Sequence" button.

### Structural change

The standalone `#game` and `#ctf` **text teaser sections are removed**; Game and
CTF are represented solely by their **launch cards** in the bay (each card's
one-line description replaces the teaser copy). This is what eliminates the
duplication rather than reintroducing it.

- Verified: no internal link points at `index.html#game` or `index.html#ctf`.
  The only cross-page hub links are `index.html#projects` and
  `index.html#contact` (from `game.html`, `resume.html`,
  `projects/mango-sys.html`), which remain valid.
- `README.md` and `CLAUDE.md` site maps are updated in sync: replace the
  `#game`/`#ctf` section rows with the launch-bay cards and add `#launch`.
  README wins if they disagree.

## Scalability (future growth)

The launch bay is designed to grow to more games and CTF topics without rework:

- The mission card is **one reusable pattern** (`.mission-card`); adding a card
  is copy-paste, and the grid wraps responsively to N items.
- When a second game or CTF topic exists, the cheap path is either (a) add more
  cards, or (b) repoint the "New Game" / "CTF" card `href` at a future index
  page (`games.html`) or an in-`ctf.html` scenario picker that lists them — a
  one-line change, no restructuring.
- The sticky nav and section IA are unaffected by this growth, since games/CTF
  live behind their cards, not as hub sections.

Those index pages are **not built now**.

## Components / files

- **`index.html`** — restructure per the IA above: trim hero to one CTA; add
  `#launch` bay with four `.mission-card`s; add sticky `.section-nav`; keep
  sections in normal flow; remove `#game`/`#ctf` teaser sections, the old
  single-panel `.section-nav` menu list, and the per-panel "Back to Top"
  plumbing. Keep `id="portfolio"` on `<main>` and the boot screen unchanged.

- **`css/home.css`** — add `.launch-bay` grid and reusable `.mission-card`
  styles; add sticky `.section-nav` styles and a scroll-spy active state
  (`[aria-current="location"]`); remove the single-panel `display:none` /
  `.active` / `panel-in` rules; add 320px handling (single-column grid,
  horizontal-scroll nav strip); increase section `scroll-margin-top` so
  anchored jumps clear the sticky bar.

- **`js/menu.js`** — replace the single-panel hash router with an
  **IntersectionObserver scroll-spy** that toggles `aria-current="location"` on
  the sticky nav links for the section currently in view. Keep the replay-boot
  hook. Guard every lookup so the script is a safe no-op when its elements are
  absent (JS-off is handled by not running; other pages don't load it).

- **`css/style.css`** — palette/tokens remain the source of truth; add a shared
  token only if genuinely reused. Prefer existing CSS variables over raw hex.

- **`README.md`, `CLAUDE.md`** — sync the site-map tables/file notes.

## Data flow / interaction

- No data, no backend. Pure static markup + progressive enhancement.
- **Scroll-spy:** an IntersectionObserver watches the sections; the section
  most in view gets its nav link marked `aria-current="location"` + an active
  class. Anchor clicks use the browser's native smooth scroll (already
  disabled under reduced-motion via existing `scroll-behavior: auto`).
- **Sticky nav:** `position: sticky; top: 0`. Sections carry
  `scroll-margin-top` equal to the bar height so jump targets aren't hidden.

## Error handling / edge cases

- **JS disabled:** everything renders in normal flow; the sticky nav is plain
  anchor links (works; simply no active-highlight). No blank landing.
- **No hash on load:** hero → launch bay → sticky nav → sections; content is
  immediately present.
- **Reduced motion:** no smooth scroll, no panel/entry animation; sticky nav is
  motionless.
- **Old bookmarks to `#game`/`#ctf`:** those ids no longer exist; the page
  still loads at top (no error). No internal links depend on them.
- **320px:** launch grid → 1 column; sticky nav → horizontal-scroll strip; page
  has no horizontal overflow (`scrollWidth === clientWidth`).

## Testing / validation

- **Automated:** `node tests/run-site-browser-smoke.mjs` must pass. Its hub
  assertions require, and this design preserves:
  - `#portfolio` exists on the hub,
  - an `<a href="ctf.html">` with non-empty text exists (the CTF launch card),
  - `document.documentElement.scrollWidth === 320` at 320px (no overflow),
  - zero thrown script errors / error-level logs (menu.js rewrite must not
    throw).
- **Manual:** keyboard tab-through of sticky nav + cards with visible focus;
  JS-off load (all content reachable); reduced-motion (no motion); 320px layout
  (no horizontal scroll); scroll-spy highlights the correct section.
- CTF validators (`tests/validate-ctf.ps1`, engine/playthrough runners) are
  **not affected** — no CTF files change — but will still pass.

## Out of scope

- Visual restyle beyond what the new components need (no palette change,
  no type-system overhaul).
- Any change to `game.html`, `ctf.html`, `resume.html`, project pages, the
  raycaster, or the CTF engine/data.
- Building `games.html` or a CTF scenario picker.
