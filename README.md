# Mango DOOM / MANGO.SYS

Ryan Perez's cybersecurity portfolio, presented as a retro MANGO.SYS firewall
interface with an optional playable browser raycaster.

## Local preview

The site has no runtime dependencies. Serve the repository over HTTP so browser
navigation and storage behave like production:

```powershell
py -m http.server 8000
```

Then open `http://localhost:8000/`. Opening the HTML files directly also works
for quick visual checks.

## Site structure

- `index.html` — portfolio landing page, boot sequence, mission-card launch bay, and scannable sections with a sticky scroll-spy nav
- `resume.html` — complete résumé and contact information
- `projects/mango-sys.html` — verified MANGO.SYS project case study
- `game.html` — playable PESTICIDE-DMZ raycaster
- `ctf.html` — deterministic, offline Mango Keep security tabletop. The threat
  track renders as an operator console and the defender track as a structured
  mock SIEM; both are pure presentation over the same allowlisted engine, with
  no command entry or free-text search.
- `css/style.css` — shared tokens, typography, controls, and accessibility styles
- `css/ctf.css` — responsive CTF workspace, evidence, timeline, and debrief styles
- `css/home.css`, `css/resume.css`, `css/game.css` — page-specific layouts
- `js/boot.js` — optional boot animation and `mangoSys.bootSeen` session flag
- `js/menu.js` — sticky section-nav scroll-spy and boot-replay hook
- `js/raycaster.js`, `js/game.js` — rendering engine and game state
- `js/ctf/` — validated CTF engine, local-save contract, and page controller
  - `app.js` — single entry point / page controller
  - `console-view.js` — attacker "operator console" surface (numbered menu + scrollback) — presentation only
  - `siem-view.js` — defender "mock SIEM" surface (pills, fields sidebar, expandable results) — presentation only

## Content rules

Project case studies use the following structure: problem, constraints,
investigation/implementation, tools, outcome, and verified links. Do not publish
invented metrics, confidential employer information, or screenshots without
permission. Mark incomplete material as pending until the owner verifies it.

A résumé PDF should only be linked after a current, verified file is added.

## Accessibility expectations

- Every page must work at 320 CSS pixels without horizontal scrolling.
- Portfolio content and navigation must remain usable without JavaScript.
- All controls need a visible keyboard focus indicator.
- Animations must respect `prefers-reduced-motion`.
- New dialogs must manage focus and expose an accessible name.
- Canvas-only information needs an HTML label or status equivalent.

## Validation checklist

Run the CTF's dependency-free static validators with:

```powershell
.\tests\validate-ctf.ps1
```

With Node.js 20 or newer, run the deterministic engine and route audits with:

```powershell
node .\tests\run-ctf-engine.mjs
node .\tests\run-ctf-playthroughs.mjs
```

Serve the repository and open `tests/ctf-engine.html` to run the same engine
suite in a browser. On Windows with Chrome installed in its standard location,
`node .\tests\run-site-browser-smoke.mjs` performs a loopback-only 320 CSS-pixel,
keyboard, save/resume, portfolio, and raycaster smoke check. It creates and
removes an isolated temporary browser profile.

CTF documentation:

- [Product specification](docs/ctf-spec.md) and [safety boundary](docs/ctf-safety.md)
- [Learner guide](docs/ctf-learner-guide.md)
- [Facilitator guide and blank answer-key template](docs/ctf-facilitator-guide.md)
- [Content authoring guide](docs/ctf-authoring-guide.md)
- [Latest release audit](docs/ctf-release-audit.md)

Do not place a completed facilitator answer key in the deployed repository.
Keep completed answers in an access-controlled location outside the public site.

Before deployment:

1. Check internal links and validate HTML.
2. Test keyboard navigation, Escape behavior, and browser Back/Forward.
3. Test with JavaScript disabled and reduced motion enabled.
4. Inspect 320×568, 390×844, 768×1024, 1440×900, and 1920×1080.
5. Play through win, loss, restart, pause/resume, and focus-loss scenarios.
6. Run Lighthouse and an automated accessibility scanner when those tools are available.

## Deployment

The repository is suitable for GitHub Pages, Cloudflare Pages, or another static
host. Configure the host to publish the repository root. `robots.txt` and
`sitemap.xml` currently use `https://mangosec.xyz`; update those URLs if the
production domain changes.

No backend, analytics, or persistent leaderboard is included.
