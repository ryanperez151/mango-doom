// raycaster.js
// -----------------------------------------------------------------------
// The RENDERING ENGINE for the game. This file's only job is: given a map,
// a player position/angle, and a list of "sprite items" (enemies AND
// pickups), draw the first-person view onto a <canvas>. It does NOT know
// about health, ammo, keyboard input, or win/lose conditions - that's all
// game.js's job. Think of this file as "the camera + the world," and
// game.js as "everything that happens in front of the camera."
//
// The trick original DOOM (1993) used, and the trick we use here, is
// called "raycasting". We never build an actual 3D world. Instead we keep
// a flat 2D grid map (like graph paper) and, for every vertical strip of
// pixels on screen, we shoot an imaginary ray out from the player into
// that grid until it hits a wall. The distance the ray traveled tells us
// how TALL to draw that strip: a close wall fills the screen top-to-
// bottom, a far wall barely peeks up in the middle. Do that once per
// screen column and you get a convincing fake-3D view out of pure 2D math.
//
// Everything below is wrapped in one Immediately-Invoked Function
// Expression (IIFE) that returns a single object, `Raycaster`. That means
// this file only adds ONE name to the shared global scope that game.html's
// <script> tags all live in (see CLAUDE.md's note about classic <script>
// tags sharing one top-level scope) - everything else stays private to
// this file.
// -----------------------------------------------------------------------

const Raycaster = (function () {

  // ----- THE MAP --------------------------------------------------------
  // A grid of numbers - our whole "level". Each number is a cell type:
  //   0 = empty floor, walkable
  //   1 = QUARANTINE WALL (rendered mango-red)
  //   2 = PULP FILTER BLOCK (rendered rust brown)
  //   3 = PERIMETER FENCE (the outer border, rendered darkest)
  //   4 = GOLDEN VAULT WALL (only found around the... well, you'll see)
  //   5 = SECRET DOOR (solid until opened - looks ALMOST like a type-2
  //       pulp filter block, just a shade brighter, as a subtle hint for
  //       observant players. game.js can open it via openSecretAt().)
  //
  // The map is written as strings (one character per cell) instead of
  // arrays of numbers, purely because a string is way easier for a human
  // to eyeball and edit - each row reads like a little ASCII picture, and
  // it's impossible to accidentally have rows of different lengths without
  // it being visually obvious.
  //
  // Row = position "down" the grid (world Y). Col = position "across"
  // (world X). World coordinates line up directly with grid coordinates:
  // cell [row][col] covers the square from (col, row) to (col+1, row+1).
  // So a player standing at world x=2.5, y=2.5 is standing dead-center in
  // cell [2][2].
  const MAP_TEMPLATE = [
    "3333333333333333333333",
    "3000000000010000000003",
    "3000000000010000000003",
    "3001100200010022001103",
    "3001100200000022000003",
    "3000000200010000001103",
    "3000000000010000000003",
    "3111011110111101111103",
    "3000000000000000000003",
    "3002200100220010022003",
    "3002200100220010022003",
    "3000000000000000000003",
    "3000000000000000000003",
    "3111101111011110111103",
    "3000000000000000000003",
    "3002001000200100000003",
    "3002001000200104444443",
    "3000000000000004000043",
    "3001100022001005000043",
    "3001100022001004000043",
    "3000000000000004444443",
    "3333333333333333333333"
  ];

  // Parse the string rows into arrays of numbers we can index (and, for
  // the secret door, MUTATE - opening the door just turns its cell into
  // floor). We keep MAP_TEMPLATE pristine so resetMap() can restore
  // everything - including a re-closed secret door - when a run restarts.
  function buildMapFromTemplate() {
    return MAP_TEMPLATE.map(function (rowText) {
      return rowText.split("").map(function (ch) { return Number(ch); });
    });
  }

  let MAP = buildMapFromTemplate();

  const MAP_HEIGHT = MAP.length;
  const MAP_WIDTH = MAP[0].length;

  // Field of view, in radians. ~66 degrees is the classic DOOM-ish FOV.
  const FOV = 66 * (Math.PI / 180);
  // Half-width of the "camera plane" relative to a facing vector of
  // length 1. tan(FOV/2) is the standard formula that spreads our rays
  // out to exactly cover the chosen field of view - see render() below
  // for how it's actually used.
  const FOV_SCALE = Math.tan(FOV / 2);

  // Base color for each wall type, before distance/side shading is
  // applied. Stored as [r, g, b] so we can darken them with plain math.
  // Note how the secret door (5) is deliberately CLOSE to the pulp filter
  // block (2) but not identical - that slight brightness difference is
  // the only visual clue that a wall is more than it seems.
  const WALL_COLORS = {
    1: [255, 61, 61],   // quarantine wall -> mango red
    2: [200, 110, 40],  // pulp filter block -> rust brown
    3: [120, 70, 20],   // perimeter fence -> dark rust border
    4: [255, 198, 64],  // golden vault wall -> unmistakably special
    5: [244, 158, 70]   // secret door -> "pulp filter, but... brighter?" (bumped a touch, plus the shimmer in shadeWallColor)
  };

  // ----- SPRITE ART ------------------------------------------------------
  // Every creature and pickup is a tiny hand-drawn bitmap. Each character
  // maps to a palette slot (or "transparent"). This is our stand-in for
  // real sprite art (there isn't any yet - see CLAUDE.md's assets/ notes)
  // - blocky, chunky retro shapes drawn entirely out of colored
  // rectangles.
  //   '.' = transparent (see through to the wall/floor behind it)
  //   '#' / '+' / '*' / '%' = palette slots 1-4, whose actual colors are
  //   defined per-sprite below (so '#' can be moldy green on one sprite
  //   and gold on another).
  const SPRITE_CHAR_TO_PALETTE = { ".": 0, "#": 1, "+": 2, "*": 3, "%": 4 };

  function buildBitmap(rows) {
    return rows.map(function (rowText) {
      return rowText.split("").map(function (ch) { return SPRITE_CHAR_TO_PALETTE[ch]; });
    });
  }

  // The sprite registry. Each entry bundles everything the renderer needs
  // to draw one KIND of thing:
  //   bitmap - the pixel grid parsed from the ASCII art above it
  //   colors - what each palette slot means for THIS sprite
  //   scale  - how tall it is relative to a full wall (1.0 = floor to
  //            ceiling). Creatures ~0.4-0.85, small pickups ~0.3.
  //   vShift - pushes the sprite DOWN the screen by this fraction of its
  //            own height, so pickups sit on the floor instead of
  //            floating at eye level. 0 = vertically centered.
  const SPRITES = {

    // ROT PACKET - the original basic enemy. Average speed, average
    // health, the "zombieman" of this game.
    rot: {
      bitmap: buildBitmap([
        ".########.",
        "##++++++##",
        "#++*++*++#",
        "#++*++*++#",
        "#++++++++#",
        "#++++++++#",
        "##++++++##",
        ".########.",
        "..#....#..",
        ".#......#."
      ]),
      colors: {
        1: "rgb(70, 90, 35)",    // outer body: dark moldy rot
        2: "rgb(150, 170, 60)",  // inner body: sickly rot glow
        3: "#ff3b3b"             // eyes: glowing red, matches the site accent
      },
      scale: 0.65,
      vShift: 0
    },

    // SPORE DRONE - small, fast, fragile. Alone it's a nuisance; in the
    // open middle of the map, a pack of them will flank you while you're
    // busy lining up a shot on something bigger.
    spore: {
      bitmap: buildBitmap([
        "..........",
        "...####...",
        "..#++++#..",
        ".#+*++*+#.",
        ".#++++++#.",
        "..#++++#..",
        "...####...",
        "..#..#....",
        "....#..#..",
        ".........."
      ]),
      colors: {
        1: "rgb(110, 110, 20)",  // outer husk: dried-out yellow rot
        2: "rgb(200, 190, 70)",  // inner glow: fermented and angry
        3: "#ff3b3b"             // eyes
      },
      scale: 0.42,
      vShift: 0.12               // small creature, hovers a bit below eye level
    },

    // WORMWARE BRUTE - big, slow, hits like a truck. Its health means it
    // can't be casually strafed past; you either commit to burning it
    // down or route around it entirely.
    brute: {
      bitmap: buildBitmap([
        "#..####..#",
        "##########",
        "#+++##+++#",
        "#+**++**+#",
        "#++++++++#",
        "#+++##+++#",
        "##########",
        ".##....##.",
        ".#......#.",
        "##......##"
      ]),
      colors: {
        1: "rgb(80, 25, 60)",    // outer plating: bruised worm purple
        2: "rgb(160, 60, 90)",   // inner mass: raw and pulpy
        3: "#ff9d1f"             // eyes: burning orange - reads as "elite"
      },
      scale: 0.85,
      vShift: 0
    },

    // PATCH KIT - restores integrity (health). Drawn as a classic
    // med-cross, in green so it can't be confused with any enemy.
    patch: {
      bitmap: buildBitmap([
        "..........",
        ".########.",
        ".#..++..#.",
        ".#..++..#.",
        ".#++++++#.",
        ".#++++++#.",
        ".#..++..#.",
        ".#..++..#.",
        ".########.",
        ".........."
      ]),
      colors: {
        1: "rgb(20, 90, 40)",    // kit casing: dark green
        2: "rgb(80, 230, 120)"   // the cross: bright healing green
      },
      scale: 0.3,
      vShift: 0.5                // sits on the floor like a dropped item
    },

    // CHARGE CELL - refills (and permanently boosts) the firewall
    // capacitor. A jagged bolt in capacitor-red.
    cell: {
      bitmap: buildBitmap([
        "..........",
        "....###...",
        "...###....",
        "..####....",
        ".#####+...",
        "...###....",
        "..###.....",
        ".###......",
        ".#........",
        ".........."
      ]),
      colors: {
        1: "#ff3b3b",            // the bolt itself
        2: "#ffd9a0"             // one bright spark pixel at the bolt's heart
      },
      scale: 0.3,
      vShift: 0.5
    },

    // SW33T CORE - the weapon upgrade. A golden orb with a glint. There
    // is exactly one per mission, and it is deliberately guarded.
    core: {
      bitmap: buildBitmap([
        "..........",
        "...####...",
        "..#++++#..",
        ".#+*+++++.",
        ".#++++++#.",
        ".#++++++#.",
        "..#++++#..",
        "...####...",
        "..........",
        ".........."
      ]),
      colors: {
        1: "rgb(180, 120, 20)",  // outer shell: deep gold
        2: "rgb(255, 198, 64)",  // inner energy: bright gold
        3: "#fff5e0"             // the glint
      },
      scale: 0.34,
      vShift: 0.42
    },

    // THE GOLDEN MANGO. If you're reading the source: yes, it's real,
    // and yes, it's behind the wall that looks slightly wrong.
    mango: {
      bitmap: buildBitmap([
        ".......%..",
        "....%%%...",
        "...####...",
        "..#++++#..",
        ".#++++++#.",
        ".#+*++++#.",
        ".#++++++#.",
        "..#++++#..",
        "...####...",
        ".........."
      ]),
      colors: {
        1: "rgb(200, 140, 20)",  // rind: deep mango gold
        2: "rgb(255, 198, 64)",  // flesh: radiant gold
        3: "#fff5e0",            // the glint
        4: "rgb(80, 200, 90)"    // the little leaf on its stem
      },
      scale: 0.45,
      vShift: 0.3
    }
  };

  // Color used when an enemy has just been shot (a quick white-ish flash
  // so a hit actually feels like it landed).
  const HIT_FLASH_COLOR = "#fff5e0";

  // Looks up a cell, treating anything outside the map's edges as solid
  // wall (type 3, same as the border). That way a ray or a moving
  // player/enemy can never "escape" the level - there's always a wall
  // there to stop them, even at the very edges.
  function getCell(col, row) {
    if (row < 0 || row >= MAP_HEIGHT || col < 0 || col >= MAP_WIDTH) return 3;
    return MAP[row][col];
  }

  // Is the given WORLD position (floating point x/y) inside a solid wall
  // cell? game.js uses this constantly for movement collision, enemy AI,
  // and line-of-sight checks for shooting. Note the secret door (5)
  // counts as a wall until game.js opens it.
  function isWall(x, y) {
    return getCell(Math.floor(x), Math.floor(y)) !== 0;
  }

  // What TYPE of cell is at this world position? game.js uses this for
  // the interact key ("is the wall in front of me a secret door?").
  function cellAt(x, y) {
    return getCell(Math.floor(x), Math.floor(y));
  }

  // If the cell at this world position is a SECRET DOOR (type 5), open it
  // by turning it into plain floor. Returns true if a door was actually
  // opened (so game.js knows whether to celebrate).
  function openSecretAt(x, y) {
    const col = Math.floor(x);
    const row = Math.floor(y);
    if (getCell(col, row) !== 5) return false;
    MAP[row][col] = 0;
    return true;
  }

  // Restores the map to its original state - most importantly, re-seals
  // the secret door. Called by game.js on every restart.
  function resetMap() {
    MAP = buildMapFromTemplate();
  }

  // ----- DDA RAYCASTING --------------------------------------------------
  // Casts a single ray from (originX, originY) in the direction of the
  // vector (dirX, dirY) and walks it through the grid until it hits a
  // wall. This is the "Digital Differential Analysis" algorithm: instead
  // of nudging the ray forward in lots of tiny fixed steps (slow, and can
  // skip clean through a wall if the step is too big), we jump straight
  // from grid-line to grid-line, always taking whichever axis (X or Y)
  // the ray reaches next. It's the same core algorithm the original
  // Wolfenstein 3D / DOOM-era engines used.
  function castRay(originX, originY, dirX, dirY) {
    // Which cell are we starting inside?
    let mapX = Math.floor(originX);
    let mapY = Math.floor(originY);

    // "How far along the ray do we travel to cross one full grid cell in
    // X (or Y)?" A huge number if the ray runs (almost) parallel to that
    // axis, so we effectively never step that way.
    const deltaDistX = dirX === 0 ? 1e30 : Math.abs(1 / dirX);
    const deltaDistY = dirY === 0 ? 1e30 : Math.abs(1 / dirY);

    // Which direction do we step in each axis (+1 or -1 cell), and how
    // far do we have to travel to hit the FIRST grid line in that axis?
    let stepX, sideDistX;
    if (dirX < 0) {
      stepX = -1;
      sideDistX = (originX - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1 - originX) * deltaDistX;
    }

    let stepY, sideDistY;
    if (dirY < 0) {
      stepY = -1;
      sideDistY = (originY - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1 - originY) * deltaDistY;
    }

    // Walk the ray one grid line at a time until it lands on a solid
    // cell. `side` tells us whether we hit an EAST/WEST-facing wall face
    // (0) or a NORTH/SOUTH-facing one (1) - we use that later to shade
    // one a little darker than the other, which is a cheap but
    // surprisingly effective trick for making corners readable.
    // The safety counter just guards against an infinite loop if the map
    // ever had a hole in its border (it doesn't - MAP is fully enclosed -
    // but the insurance is free).
    let side = 0;
    let hitType = 0;
    let safety = 0;
    while (hitType === 0 && safety < 1000) {
      safety++;
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }
      hitType = getCell(mapX, mapY);
    }

    // A ray's raw travel distance would make walls bulge outward near the
    // edges of the screen (the classic "fisheye" bug), because rays angled
    // away from dead-center have to travel further to reach a wall that's
    // actually the same distance away. The fix is to measure the
    // PERPENDICULAR distance from the camera plane instead of the ray's
    // own length - this formula (straight from the standard DDA
    // raycasting derivation) does exactly that.
    let perpDist;
    if (side === 0) {
      perpDist = (mapX - originX + (1 - stepX) / 2) / dirX;
    } else {
      perpDist = (mapY - originY + (1 - stepY) / 2) / dirY;
    }

    // Clamp away from 0 so a wall right in the player's face can't
    // produce a divide-by-zero later when we turn distance into height.
    return { distance: Math.max(perpDist, 0.0001), side: side, wallType: hitType };
  }

  // Turns a wall type + which face got hit + how far away it is into an
  // actual CSS color string, darkening for distance (far = dim, like fog)
  // and for side (one face of every wall is drawn a bit darker than the
  // other, purely so corners are visually distinguishable).
  function shadeWallColor(wallType, side, distance, time) {
    const base = WALL_COLORS[wallType] || [255, 255, 255];
    const sideFactor = side === 1 ? 0.7 : 1.0;
    // Fades to 15% brightness by the time something is ~20 tiles away -
    // tuned for this level's ~20x20 interior so the far side of the big
    // central halls is dim and moody but never pitch black.
    const distFactor = Math.max(0.15, Math.min(1, 1 - distance / 20));
    let shade = sideFactor * distFactor;

    // The SECRET DOOR (type 5) gets a faint, slow golden shimmer - just
    // enough that an observant player notices this one block gently
    // "breathing" while the real pulp-filter blocks around it sit dead
    // still. Still an easter egg, not a neon sign, so the swing is small.
    if (wallType === 5) {
      shade *= 1 + 0.14 * Math.sin(time * 0.004);
    }

    // Clamp each channel to 255 - the shimmer above can push a bright,
    // close-up secret door past full brightness, and rgb() needs 0-255.
    const r = Math.min(255, Math.round(base[0] * shade));
    const g = Math.min(255, Math.round(base[1] * shade));
    const b = Math.min(255, Math.round(base[2] * shade));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  // Paints the ceiling (top half) and floor (bottom half) as flat shaded
  // rectangles. Real DOOM does per-pixel floor/ceiling casting, but flat
  // fills are a perfectly fine - and much cheaper - stand-in for this
  // project's scope, and still read fine once walls are on top of them.
  function drawCeilingAndFloor(ctx, canvasW, canvasH) {
    const horizon = canvasH / 2;
    ctx.fillStyle = "#140b00"; // ceiling: near-black brown, like a dim vent shaft
    ctx.fillRect(0, 0, canvasW, horizon);
    ctx.fillStyle = "#241400"; // floor: slightly warmer, so it doesn't blend into the ceiling
    ctx.fillRect(0, horizon, canvasW, canvasH - horizon);
  }

  // ----- WALL FIRE -------------------------------------------------------
  // A purely cosmetic layer: flames that lick UP off the top edge of every
  // wall into the dark ceiling, so the whole DMZ reads as a place that's
  // actively burning down. Like everything else in this engine it's drawn
  // one screen-column at a time, right after that column's wall.

  // The flame gradient, hottest at the base to wispiest at the tip. Written
  // as rgba so the tips fade out instead of ending in a hard edge - that
  // soft top is most of what sells it as fire rather than a colored bar.
  const FIRE_COLORS = [
    "rgba(255, 244, 200, 0.95)", // hot base: near-white gold
    "rgba(255, 180, 60, 0.9)",   // body: mango orange
    "rgba(255, 106, 31, 0.7)",   // upper body: deep ember orange
    "rgba(255, 59, 59, 0.45)"    // tip: red, and see-through so it wisps out
  ];

  // A cheap flickering value in [0, 1]. We add three sine waves at
  // different frequencies so it never looks like an obvious repeating
  // pattern: `col` makes neighbouring flames different heights (the jagged
  // silhouette your eye reads as "fire"), and `time` makes them dance.
  function fireNoise(col, time) {
    const a = Math.sin(col * 0.7 + time * 0.009);
    const b = Math.sin(col * 0.23 - time * 0.013);
    const c = Math.sin(col * 1.9 + time * 0.021);
    // Three values in [-1, 1] -> average is in [-0.5, 0.5] -> shift to [0, 1].
    return (a + b + c) / 6 + 0.5;
  }

  // Draws the flame for a single wall column, rising from `wallTop` (the
  // UNCLAMPED top edge of the wall on screen) up into the ceiling area.
  function drawWallFire(ctx, col, wallTop, lineHeight, distance, canvasH, time) {
    // Nothing to do if the wall already reaches the top of the screen (no
    // ceiling left to draw flames on) or it's so far off that flames would
    // just be flickering noise - skipping distant walls keeps this cheap.
    if (wallTop <= 0 || distance > 12) return;

    const flicker = fireNoise(col, time);
    // Flame height scales with the wall's on-screen height (near walls get
    // bigger flames), then wobbles with the flicker.
    let flameHeight = lineHeight * 0.22 * (0.4 + 0.6 * flicker);
    const cap = canvasH * 0.2; // never let a close-up wall's flames swallow the whole ceiling
    if (flameHeight > cap) flameHeight = cap;
    if (flameHeight > wallTop) flameHeight = wallTop; // don't draw above the screen
    if (flameHeight < 2) return;

    // Farther walls -> fainter flames, so depth still reads clearly.
    const distFade = Math.max(0.3, 1 - distance / 14);
    ctx.globalAlpha = distFade;

    // Stack the gradient bands from the wall top upward: FIRE_COLORS[0]
    // (hot) sits right on the wall, the red wispy tip ends up highest.
    const bands = FIRE_COLORS.length;
    for (let bandIndex = 0; bandIndex < bands; bandIndex++) {
      const segTop = wallTop - flameHeight * ((bandIndex + 1) / bands);
      const segBottom = wallTop - flameHeight * (bandIndex / bands);
      ctx.fillStyle = FIRE_COLORS[bandIndex];
      ctx.fillRect(col, Math.floor(segTop), 1, Math.ceil(segBottom - segTop) + 1);
    }

    ctx.globalAlpha = 1; // reset, so the next wall column and the sprites draw fully opaque
  }

  // Draws every wall column for this frame and fills `zBuffer` (one
  // perpendicular distance per screen column) so drawSprites() below
  // knows how to correctly hide sprites behind nearer walls.
  function drawWalls(ctx, canvasW, canvasH, playerX, playerY, dirX, dirY, planeX, planeY, zBuffer, time) {
    for (let col = 0; col < canvasW; col++) {
      // Map this screen column to a position across the camera plane,
      // from -1 (left edge) to +1 (right edge), then bend the player's
      // facing direction toward it by that much. This is what spreads a
      // single "facing direction" out into a full fan of rays.
      const cameraX = (2 * col) / canvasW - 1;
      const rayDirX = dirX + planeX * cameraX;
      const rayDirY = dirY + planeY * cameraX;

      const hit = castRay(playerX, playerY, rayDirX, rayDirY);
      zBuffer[col] = hit.distance;

      // Closer walls -> taller line. This is the entire "3D" illusion:
      // we're not drawing a wall, we're drawing a single stretched
      // vertical strip of color whose height is inversely proportional
      // to distance.
      const lineHeight = Math.floor(canvasH / hit.distance);
      // The true (unclamped) top edge of the wall - the flames start here.
      // We keep it before clamping because a very close wall's top can sit
      // above the screen (negative), which drawWallFire needs to know.
      const wallTop = Math.floor(-lineHeight / 2 + canvasH / 2);
      let drawStart = wallTop;
      let drawEnd = Math.floor(lineHeight / 2 + canvasH / 2);
      if (drawStart < 0) drawStart = 0;
      if (drawEnd >= canvasH) drawEnd = canvasH - 1;

      ctx.fillStyle = shadeWallColor(hit.wallType, hit.side, hit.distance, time);
      ctx.fillRect(col, drawStart, 1, drawEnd - drawStart + 1);

      // Flames go on AFTER the wall (so they sit on top of its edge) but
      // still before sprites, which are drawn lower on screen and won't
      // overlap the ceiling where the flames live.
      drawWallFire(ctx, col, wallTop, lineHeight, hit.distance, canvasH, time);
    }
  }

  // Draws every sprite item as a "billboard" - a flat image that always
  // faces the camera no matter which way the player is looking, the same
  // trick original DOOM used for all its monsters and items.
  //
  // Each item in `items` is a plain object game.js builds every frame:
  //   { x, y,            world position
  //     sprite,          key into the SPRITES registry ("rot", "patch"...)
  //     hit,             optional - true = draw in the white hit-flash color
  //     bobOffset }      optional - extra vertical shift (fraction of the
  //                      sprite's height) so pickups can gently bob
  function drawSprites(ctx, canvasW, canvasH, playerX, playerY, dirX, dirY, planeX, planeY, zBuffer, items) {
    // The camera transform below needs the inverse of the matrix formed
    // by [planeX, dirX; planeY, dirY]. We compute that determinant once
    // per frame rather than once per item.
    const invDet = 1.0 / (planeX * dirY - dirX * planeY);

    // Painter's algorithm: sort far-to-near so a closer sprite correctly
    // draws on top of a farther one where they overlap on screen.
    const sorted = items.slice();
    sorted.sort(function (a, b) {
      const distA = (a.x - playerX) * (a.x - playerX) + (a.y - playerY) * (a.y - playerY);
      const distB = (b.x - playerX) * (b.x - playerX) + (b.y - playerY) * (b.y - playerY);
      return distB - distA;
    });

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      const def = SPRITES[item.sprite];
      if (!def) continue; // unknown sprite name - skip rather than crash

      const relX = item.x - playerX;
      const relY = item.y - playerY;

      // Transform the item's world position into camera space.
      // transformY comes out measured on the same scale as our wall
      // distances, so we can compare it straight against the zBuffer.
      const transformX = invDet * (dirY * relX - dirX * relY);
      const transformY = invDet * (-planeY * relX + planeX * relY);

      if (transformY < 0.15) continue; // behind (or right on top of) the camera - nothing to draw

      const spriteScreenX = Math.floor((canvasW / 2) * (1 + transformX / transformY));

      // Sprites are drawn as a square billboard, sized the same way walls
      // are (canvasH / distance) and then shrunk by the sprite's own
      // scale so a creature reads as creature-sized and a pickup reads
      // as pickup-sized next to the corridor walls.
      const spriteSize = Math.abs(Math.floor((canvasH / transformY) * def.scale));

      // vShift (plus any per-frame bobOffset) slides the billboard down
      // the screen so floor items actually sit near the floor.
      const totalShift = def.vShift + (item.bobOffset || 0);
      const drawStartY = Math.floor(-spriteSize / 2 + canvasH / 2 + spriteSize * totalShift);
      const drawStartX = Math.floor(spriteScreenX - spriteSize / 2);

      const bitmap = def.bitmap;
      const bitmapSize = bitmap.length;
      const pixelScale = spriteSize / bitmapSize; // screen pixels per bitmap "pixel"

      for (let bx = 0; bx < bitmapSize; bx++) {
        const columnStartX = Math.floor(drawStartX + bx * pixelScale);
        const columnEndX = Math.floor(drawStartX + (bx + 1) * pixelScale);
        if (columnEndX < 0 || columnStartX >= canvasW) continue;

        // Occlusion check: if the nearest WALL at this screen column is
        // closer than this sprite, a wall is standing in front of it, so
        // skip drawing the sprite here. This is what lets enemies duck
        // in and out of view behind the maze's pillars correctly.
        const sampleCol = Math.max(0, Math.min(canvasW - 1, columnStartX));
        if (transformY >= zBuffer[sampleCol]) continue;

        for (let by = 0; by < bitmapSize; by++) {
          const paletteIndex = bitmap[by][bx];
          if (paletteIndex === 0) continue; // transparent pixel - see through to wall/floor

          const rowStartY = Math.floor(drawStartY + by * pixelScale);
          const rowEndY = Math.floor(drawStartY + (by + 1) * pixelScale);
          if (rowEndY < 0 || rowStartY >= canvasH) continue;

          ctx.fillStyle = item.hit ? HIT_FLASH_COLOR : def.colors[paletteIndex];
          ctx.fillRect(
            Math.max(0, columnStartX),
            Math.max(0, rowStartY),
            Math.max(1, columnEndX - columnStartX),
            Math.max(1, rowEndY - rowStartY)
          );
        }
      }
    }
  }

  // The one function game.js actually calls every frame: clears the
  // canvas and redraws the whole scene (floor/ceiling, walls, sprites)
  // from the given player's point of view. `spriteItems` is the combined
  // list of everything billboard-shaped: living enemies AND uncollected
  // pickups - the renderer doesn't care which is which.
  function render(ctx, canvasW, canvasH, player, spriteItems, time) {
    // `time` (the frame timestamp, in ms) drives the animated wall fire and
    // the secret door's shimmer. Default to 0 so a call without it still
    // renders a valid (just non-animated) frame instead of NaN-ing out.
    if (typeof time !== "number") time = 0;

    ctx.clearRect(0, 0, canvasW, canvasH);
    drawCeilingAndFloor(ctx, canvasW, canvasH);

    // The player's facing direction as a unit vector, plus a
    // perpendicular "camera plane" vector scaled to match our field of
    // view. Together, dir +/- plane sweep out exactly the FOV on either
    // side of straight-ahead. NOTE: perpX/perpY here (rotate dir by +90
    // degrees) must use the same formula game.js uses for its "strafe
    // right" direction, or turning/strafing/rendering would all disagree
    // about which way is "right". See game.js's updatePlayer().
    const dirX = Math.cos(player.angle);
    const dirY = Math.sin(player.angle);
    const perpX = -dirY;
    const perpY = dirX;
    const planeX = perpX * FOV_SCALE;
    const planeY = perpY * FOV_SCALE;

    const zBuffer = new Array(canvasW);
    drawWalls(ctx, canvasW, canvasH, player.x, player.y, dirX, dirY, planeX, planeY, zBuffer, time);
    drawSprites(ctx, canvasW, canvasH, player.x, player.y, dirX, dirY, planeX, planeY, zBuffer, spriteItems);
  }

  // Public API - this is the only thing exposed to the rest of the page.
  return {
    MAP_WIDTH: MAP_WIDTH,
    MAP_HEIGHT: MAP_HEIGHT,
    isWall: isWall,
    cellAt: cellAt,
    openSecretAt: openSecretAt,
    resetMap: resetMap,
    render: render
  };

})();
