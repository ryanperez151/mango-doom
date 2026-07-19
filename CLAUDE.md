# Mango DOOM Portfolio Site

A retro-terminal-boot + DOOM-style main menu site, themed as a mango-flavored
cybersecurity firewall. Two halves under one roof: a playable retro shooter
(the "game"), and a personal portfolio — resume, technical projects, blog —
skinned in the same theme.

## Stack

Vanilla HTML/CSS/JS, no frameworks until necessary. GitHub Pages or
Cloudflare hosting. No backend/database yet — LEADERBOARD is static
placeholder data for now; only add a real backend (or serverless function)
once persistent scores are actually needed.

## Site map

`index.html` is the hub: boot sequence → main menu. Each menu option leads
somewhere:

| Menu option      | Destination                                                                                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NEW GAME         | `game.html` — the raycaster shooter                                                                                                                                                                                                 |
| CREDITS          | inline content panel in `index.html`                                                                                                                                                                                                |
| CHARACTER SHEETS | inline panel in `index.html` (short version) — doubles as the resume/bio ("operator profile"); links out to `resume.html` for the full version                                                                                      |
| LEADERBOARD      | inline content panel in `index.html` — game high scores                                                                                                                                                                             |
| EXTRAS           | inline content panel in `index.html` — catch-all index for everything outside the game: blog posts (`blog/`), technical project write-ups (`projects/`), and whatever else doesn't have its own menu slot, each its own linked page |

This mapping is a starting point, not locked in — CHARACTER SHEETS = resume
and EXTRAS = the everything-else bucket. Revisit if it stops making sense as
content grows.

## File structure

```
index.html          boot sequence + main menu + inline sections
game.html            the raycaster shooter (in progress)
resume.html          full resume/CV, linked from the CHARACTER SHEETS panel
projects/            one .html file per technical project write-up, indexed from EXTRAS
blog/                one .html file per blog post, indexed from EXTRAS
css/style.css        shared styles across all pages
js/boot.js           boot terminal typing animation (index.html only)
js/menu.js           main menu + content panel switching (index.html only)
js/raycaster.js      the game's rendering engine (game.html)
js/game.js           game loop, state, entities (game.html) — add once the game takes shape
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
