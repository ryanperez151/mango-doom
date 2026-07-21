# Mango DOOM Portfolio Site

A retro-terminal-boot + DOOM-style main menu site, themed as a mango-flavored
cybersecurity firewall. Two halves under one roof: a playable retro shooter
(the "game"), and a personal portfolio — resume, technical projects, blog —
skinned in the same theme.

## Stack

Vanilla HTML/CSS/JS, no frameworks until necessary. GitHub Pages or
Cloudflare hosting. No backend/database or leaderboard yet; only add persistent
scores after their product and privacy requirements are defined.

## Site map

`index.html` is the progressively enhanced hub: optional boot sequence →
professional summary, primary actions, and hash-addressable sections. Core
portfolio content must remain readable when JavaScript is disabled.

| Section | Destination |
| --- | --- |
| Character Sheet — Résumé | `#profile`, linking to the full `resume.html` |
| Missions — Security Projects | `#projects`, with full case studies under `projects/` |
| New Game — Playable Demo | `#game`, linking to `game.html` |
| Summon — Contact | `#contact` |
| Credits — About This Site | `#credits` |

## File structure

```
index.html          optional boot + portfolio hero + hash sections
game.html            the raycaster shooter — first playable version (one level, one enemy type)
resume.html          full resume/CV, linked from the CHARACTER SHEETS panel
projects/            one .html file per verified technical project write-up
blog/                one .html file per future blog post
css/style.css        shared tokens, controls, and accessibility styles
css/home.css         landing page and project index styles
css/resume.css       resume and long-form case-study styles
css/game.css         raycaster viewport, HUD, and overlay styles
js/boot.js           boot terminal typing animation (index.html only)
js/menu.js           main menu + content panel switching (index.html only)
js/raycaster.js      the game's rendering engine — map data, DDA raycasting, wall + sprite drawing (game.html only)
js/game.js           game loop, player/enemy state, input, AI, win/lose flow (game.html only)
assets/textures, assets/sounds   game assets
assets/images         portfolio images (headshot, project screenshots, etc.)
```

Keep files split by concern — no monolithic `index.html`, and no cramming
unrelated pages' logic into one shared JS file. Each page only loads the
`<script>` tags it actually needs (e.g. `game.html` never loads `menu.js`).

## Conventions

- Mango-orange/red palette: `#ff9d1f` (orange), `#ff3b3b` (red), background `#1a0f00`
- Comment code like I'm a complete beginner learning as I go
- Keep files split — no monolithic `index.html` going forward, and prefer
  dedicated pages (`resume.html`, `blog/*.html`, `projects/*.html`) over
  endlessly growing the inline content panels in `index.html`
- Classic `<script>` tags on the same page share one top-level `let`/`const`
  scope, so two files loaded on the same page can't both declare e.g.
  `const menuBtn`. Each JS file should look up its own DOM elements
  independently (even if another file on the same page already did) and use
  distinct variable names — see how `boot.js`'s `menuBtn` and `menu.js`'s
  `enterMenuBtn` point at the same element under different names. If the
  number of shared globals ever gets unwieldy, consider switching to ES
  modules (`type="module"`) rather than inventing more prefixes.

## Theme

Mango + cybersecurity puns throughout (firewall boot logs, "sw33t
protocols", etc.). Carry this voice into the portfolio content too — e.g.
blog posts framed as "LOG ###", projects framed as "missions".
