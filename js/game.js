// game.js
// -----------------------------------------------------------------------
// The GAME layer, sitting on top of raycaster.js's rendering engine. This
// file owns everything raycaster.js deliberately doesn't: player state
// (position, health, ammo), keyboard/mouse input, enemy AI, shooting,
// pickups, secrets, and the win/lose flow. Every frame it updates that
// state, then hands the current player + a combined list of drawable
// sprites (enemies and pickups) off to Raycaster.render().
//
// Only ONE top-level name is exposed by raycaster.js (`Raycaster`), so
// this file is free to declare its own top-level variables without
// worrying about clashing with it. Still, per CLAUDE.md's convention,
// names below are kept specific (e.g. `viewportCanvas`, not `canvas`) in
// case another script ever gets added to game.html down the line.
// -----------------------------------------------------------------------

// ----- DOM references ---------------------------------------------------
const viewportCanvas = document.getElementById("viewport");
const viewportCtx = viewportCanvas.getContext("2d");

const healthFillEl = document.getElementById("health-fill");
const healthValueEl = document.getElementById("health-value");
const chargeFillEl = document.getElementById("charge-fill");
const chargeValueEl = document.getElementById("charge-value");
const threatsValueEl = document.getElementById("threats-value");

const winScreenEl = document.getElementById("screen-win");
const winSecretNoteEl = document.getElementById("win-secret-note");
const loseScreenEl = document.getElementById("screen-lose");
const startScreenEl = document.getElementById("screen-start");
const pauseScreenEl = document.getElementById("screen-pause");
const startGameButton = document.getElementById("start-game-btn");
const resumeGameButton = document.getElementById("resume-game-btn");
const restartButtons = Array.from(document.querySelectorAll(".restart-btn"));
const gameWrapEl = document.getElementById("game-wrap");
const gameStatusEl = document.getElementById("game-status");

// ----- Tunable numbers ----------------------------------------------------
// Keeping every "magic number" up here means balancing the game later is
// just a matter of tweaking one value, not hunting through the whole file.
const PLAYER_MAX_HEALTH = 100;
const PLAYER_BASE_MAX_CHARGE = 100;
const PLAYER_RADIUS = 0.25;       // how close the player's center can get to a wall before colliding
const MOVE_SPEED = 3.2;           // world units per second
const TURN_SPEED = 2.6;           // radians per second

const CHARGE_REGEN_PER_SEC = 15;  // the "firewall capacitor" recharges on its own - no ammo pickups needed
const SHOOT_CHARGE_COST = 10;
const BASE_SHOOT_COOLDOWN_MS = 350; // minimum time between shots, so holding Space isn't a machine gun
const BASE_SHOOT_DAMAGE = 25;
const SHOOT_RANGE = 9;            // world units
const SHOOT_CONE_HALF_ANGLE = 0.14; // ~8 degrees either side of dead-center counts as "aimed at it" - generous, since turning is keyboard-only (no precision mouse-look)
const HIT_FLASH_MS = 120;

// SW33T CORE upgrade values - what the pulse cannon becomes once the one
// hidden weapon upgrade on the level is collected.
const UPGRADED_SHOOT_DAMAGE = 45;
const UPGRADED_SHOOT_COOLDOWN_MS = 230;

const PICKUP_RADIUS = 0.6;        // walk this close to a pickup to grab it
const PATCH_KIT_HEAL = 40;
const CHARGE_CELL_MAX_BONUS = 15; // each charge cell also permanently grows the capacitor

const INTERACT_REACH = 1.1;       // how far in front of the player the E key probes for secret doors
const SECRET_HINT_RANGE = 1.6;    // stand this close to the hidden door and the system drops a hint

// ----- Enemy types --------------------------------------------------------
// Three flavors of malware, each with its own stats and sprite (the art
// itself lives in raycaster.js's sprite registry - here we only say
// WHICH sprite each type uses and how it behaves).
//
//   rot   - the baseline: medium everything. The original ROT PACKET.
//   spore - fast and fragile. Dies in one upgraded shot, but closes
//           distance scarily quickly across the open halls.
//   brute - slow, tanky, and devastating up close. A wall of health that
//           forces the player to commit or retreat.
const ENEMY_TYPES = {
  rot: {
    label: "rotten packet",
    sprite: "rot",
    health: 60,
    speed: 1.3,
    damage: 8,
    attackCooldownMs: 900
  },
  spore: {
    label: "spore drone",
    sprite: "spore",
    health: 30,
    speed: 2.3,
    damage: 4,
    attackCooldownMs: 700
  },
  brute: {
    label: "wormware brute",
    sprite: "brute",
    health: 160,
    speed: 0.75,
    damage: 20,
    attackCooldownMs: 1300
  }
};

// Where each threat starts, and what kind it is. Coordinates are
// hand-picked to land on open floor cells in Raycaster's MAP (see
// raycaster.js) - each one is the center of an empty cell, spread around
// the level's rooms and halls so the player has to actually hunt through
// the whole complex. Brutes guard chokepoints and the SW33T CORE; spores
// haunt the open areas where their speed hurts most.
const ENEMY_SPAWNS = [
  { type: "rot", x: 8.5, y: 2.5 },
  { type: "rot", x: 18.5, y: 8.5 },
  { type: "rot", x: 5.5, y: 11.5 },
  { type: "rot", x: 13.5, y: 14.5 },
  { type: "rot", x: 2.5, y: 17.5 },
  { type: "spore", x: 16.5, y: 4.5 },
  { type: "spore", x: 8.5, y: 11.5 },
  { type: "spore", x: 18.5, y: 14.5 },
  { type: "spore", x: 6.5, y: 20.5 },
  { type: "brute", x: 12.5, y: 5.5 },
  { type: "brute", x: 5.5, y: 16.5 },
  { type: "brute", x: 18.5, y: 11.5 }
];

// Every collectible on the level. Like enemy spawns, each sits centered
// on an open floor cell. The SW33T CORE is parked deep in the south wing
// near two brutes on purpose; the golden mango is inside the sealed
// vault in the southeast corner (see the secret door notes in
// raycaster.js's map).
const PICKUP_SPAWNS = [
  { type: "patch", x: 12.5, y: 1.5 },
  { type: "patch", x: 1.5, y: 12.5 },
  { type: "patch", x: 10.5, y: 20.5 },
  { type: "cell", x: 19.5, y: 1.5 },
  { type: "cell", x: 4.5, y: 14.5 },
  { type: "core", x: 12.5, y: 17.5 },
  { type: "mango", x: 17.5, y: 18.5 }
];

// Where the secret door lives (must match the single '5' cell in
// raycaster.js's map) - only used for the proximity hint, since actually
// opening it goes through Raycaster.openSecretAt().
const SECRET_DOOR_CENTER = { x: 15.5, y: 18.5 };

// The cheat code. Type it anywhere mid-mission. Sw33t protocols indeed.
const SWEET_CODE = "mango";

// ----- Mutable game state -------------------------------------------------
// The player starts in the open cell near the top-left of the map, facing
// east (angle 0) down the first long corridor.
function createFreshPlayer() {
  return {
    x: 2.5,
    y: 2.5,
    angle: 0,
    health: PLAYER_MAX_HEALTH,
    charge: PLAYER_BASE_MAX_CHARGE,
    maxCharge: PLAYER_BASE_MAX_CHARGE, // grows when charge cells are collected
    damage: BASE_SHOOT_DAMAGE,         // grows once, when the SW33T CORE is collected
    cooldownMs: BASE_SHOOT_COOLDOWN_MS
  };
}

let player = createFreshPlayer();
let enemies = createEnemies();
let pickups = createPickups();
let threatsRemaining = enemies.length;

// Per-run secret/easter-egg flags.
let secretDoorOpened = false;
let secretHintGiven = false;
let mangoFound = false;
let sweetCodeUsed = false;
let sweetCodeBuffer = ""; // rolling record of recent letter keys, checked against SWEET_CODE

// "briefing" | "playing" | "paused" | "won" | "lost"
// updatePlayer/updateEnemies/etc. all check this so nothing keeps
// happening once the mission is over.
let gameState = "briefing";

let lastShotTime = 0;
let lastFrameTime = null;

// Which keys are currently held down, tracked by e.code (layout-
// independent - "KeyW" is always the key at the W position, even on a
// non-QWERTY layout).
const keys = {};

function clearHeldKeys() {
  Object.keys(keys).forEach(function (key) {
    keys[key] = false;
  });
}

function announce(message) {
  gameStatusEl.textContent = message;
}

function triggerFeedback(className, duration) {
  gameWrapEl.classList.remove(className);
  // Reading offsetWidth restarts a short CSS animation when events happen rapidly.
  void gameWrapEl.offsetWidth;
  gameWrapEl.classList.add(className);
  window.setTimeout(function () {
    gameWrapEl.classList.remove(className);
  }, duration);
}

function createEnemies() {
  return ENEMY_SPAWNS.map(function (spawn, index) {
    const stats = ENEMY_TYPES[spawn.type];
    return {
      type: spawn.type,
      x: spawn.x,
      y: spawn.y,
      health: stats.health,
      alive: true,
      hit: false,        // true for a brief moment right after being shot, for the white hit-flash
      hitTimer: 0,
      lastAttackTime: 0,
      wallBias: index % 2 === 0 ? 1 : -1
    };
  });
}

function createPickups() {
  return PICKUP_SPAWNS.map(function (spawn) {
    return {
      type: spawn.type,
      x: spawn.x,
      y: spawn.y,
      taken: false
    };
  });
}

// ----- Input handling ------------------------------------------------------
// WASD moves/strafes, arrow keys turn, Space or a mouse click fires, and
// E interacts with whatever wall the player is facing (spoiler: one of
// them is not really a wall). All tracked as simple booleans in `keys`
// and read every frame in updatePlayer() - that keeps movement smooth
// (held keys keep moving you) while still letting a single keydown
// trigger a one-shot action (firing, interacting).
const MOVEMENT_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowLeft", "ArrowRight", "Space"];

window.addEventListener("keydown", function (e) {
  keys[e.code] = true;

  const visibleDialog = document.querySelector(".overlay-screen.visible");
  if (e.key === "Tab" && visibleDialog) {
    const controls = Array.from(visibleDialog.querySelectorAll("button, a[href]"));
    if (controls.length > 0) {
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  if (MOVEMENT_KEYS.indexOf(e.code) !== -1) {
    e.preventDefault(); // stop the page itself from scrolling on arrows/space
  }

  if (e.code === "Space") {
    attemptShoot(performance.now());
  }

  if (e.code === "KeyE") {
    attemptInteract();
  }

  if (e.code === "Enter" && (gameState === "won" || gameState === "lost")) {
    restartGame(); // quick keyboard restart from the win/lose screen
  }

  if (e.key === "Escape" && gameState === "playing") {
    clearHeldKeys();
    gameState = "paused";
    showOverlay(pauseScreenEl);
    announce("Mission paused.");
  }

  trackSweetCode(e.key);
});

window.addEventListener("keyup", function (e) {
  keys[e.code] = false;
});

window.addEventListener("blur", clearHeldKeys);

document.addEventListener("visibilitychange", function () {
  clearHeldKeys();
  if (document.hidden && gameState === "playing") {
    gameState = "paused";
    showOverlay(pauseScreenEl);
    announce("Mission paused because the tab became inactive.");
  }
});

// A mouse click also fires - handy since aiming is done by turning with
// the keyboard, so a hand can stay on the mouse for quick trigger taps.
viewportCanvas.addEventListener("mousedown", function () {
  attemptShoot(performance.now());
});

restartButtons.forEach(function (btn) {
  btn.addEventListener("click", restartGame);
});

startGameButton.addEventListener("click", startGame);
resumeGameButton.addEventListener("click", resumeGame);

// ----- The "mango" cheat code ----------------------------------------------
// Keep a small rolling buffer of the letters typed and check whether it
// ends with the magic word. Works once per mission - the sw33t protocol
// does not do encores.
function trackSweetCode(key) {
  if (typeof key !== "string" || key.length !== 1) return; // ignore Shift, arrows, etc.
  sweetCodeBuffer = (sweetCodeBuffer + key.toLowerCase()).slice(-SWEET_CODE.length);
  if (sweetCodeBuffer !== SWEET_CODE) return;
  if (gameState !== "playing" || sweetCodeUsed) return;

  sweetCodeUsed = true;
  player.health = PLAYER_MAX_HEALTH;
  player.charge = player.maxCharge;
  triggerFeedback("sweet", 700);
  announce("SW33T PROTOCOL ACCEPTED. Integrity and charge fully restored. The orchard provides.");
}

// ----- Player movement -----------------------------------------------------
function updatePlayer(dt) {
  if (keys.ArrowLeft) player.angle -= TURN_SPEED * dt;
  if (keys.ArrowRight) player.angle += TURN_SPEED * dt;

  const dirX = Math.cos(player.angle);
  const dirY = Math.sin(player.angle);
  // "Right" is dir rotated 90 degrees - this exact formula (-dirY, dirX)
  // has to match the perpX/perpY raycaster.js uses to build its camera
  // plane, or strafing right would visually drift the wrong way relative
  // to what the camera shows. See the comment in Raycaster.render().
  const rightX = -dirY;
  const rightY = dirX;

  let moveX = 0;
  let moveY = 0;
  if (keys.KeyW) { moveX += dirX; moveY += dirY; }
  if (keys.KeyS) { moveX -= dirX; moveY -= dirY; }
  if (keys.KeyD) { moveX += rightX; moveY += rightY; }
  if (keys.KeyA) { moveX -= rightX; moveY -= rightY; }

  const moveLen = Math.sqrt(moveX * moveX + moveY * moveY);
  if (moveLen > 0) {
    // Normalize first so, e.g., holding W+D (diagonal) doesn't move the
    // player faster than holding W alone.
    moveX = (moveX / moveLen) * MOVE_SPEED * dt;
    moveY = (moveY / moveLen) * MOVE_SPEED * dt;

    // Axis-separated collision: try the X move and Y move independently,
    // each padded a little (PLAYER_RADIUS) in the direction of travel.
    // Doing them separately (instead of testing the combined new
    // position) is what lets the player slide smoothly along a wall
    // instead of stopping dead when moving diagonally into it.
    const testX = player.x + moveX + Math.sign(moveX) * PLAYER_RADIUS;
    if (!Raycaster.isWall(testX, player.y)) {
      player.x += moveX;
    }

    const testY = player.y + moveY + Math.sign(moveY) * PLAYER_RADIUS;
    if (!Raycaster.isWall(player.x, testY)) {
      player.y += moveY;
    }
  }

  if (player.charge < player.maxCharge) {
    player.charge = Math.min(player.maxCharge, player.charge + CHARGE_REGEN_PER_SEC * dt);
  }
}

// ----- Interacting (secret doors) ------------------------------------------
// Probes the cell about one tile in front of the player's face. If it's
// the secret door, ask the raycaster to open it. Any other wall just
// gets a flat "nothing happens" - classic adventure-game manners.
function attemptInteract() {
  if (gameState !== "playing") return;

  const probeX = player.x + Math.cos(player.angle) * INTERACT_REACH;
  const probeY = player.y + Math.sin(player.angle) * INTERACT_REACH;

  if (Raycaster.openSecretAt(probeX, probeY)) {
    secretDoorOpened = true;
    triggerFeedback("secret", 700);
    announce("SECRET FOUND. The pulp filter slides aside. Something golden glows within.");
  } else if (Raycaster.cellAt(probeX, probeY) !== 0) {
    announce("Solid. Nothing happens.");
  }
}

// If the player wanders close to the hidden door without knowing it's
// there, drop a one-time hint. Rewards exploration without requiring the
// player to E-spam every wall in the level.
function maybeHintSecret() {
  if (secretHintGiven || secretDoorOpened) return;
  const dx = player.x - SECRET_DOOR_CENTER.x;
  const dy = player.y - SECRET_DOOR_CENTER.y;
  if (dx * dx + dy * dy < SECRET_HINT_RANGE * SECRET_HINT_RANGE) {
    secretHintGiven = true;
    announce("Anomaly: this pulp filter block reads a few shades too bright. Press E to probe it.");
  }
}

// ----- Pickups -------------------------------------------------------------
// Walk near a pickup and it's yours. Each type applies its effect
// immediately - no inventory to manage in a game this size.
function updatePickups() {
  for (let i = 0; i < pickups.length; i++) {
    const pickup = pickups[i];
    if (pickup.taken) continue;

    const dx = player.x - pickup.x;
    const dy = player.y - pickup.y;
    if (dx * dx + dy * dy > PICKUP_RADIUS * PICKUP_RADIUS) continue;

    pickup.taken = true;

    if (pickup.type === "patch") {
      player.health = Math.min(PLAYER_MAX_HEALTH, player.health + PATCH_KIT_HEAL);
      triggerFeedback("pickup", 400);
      announce("Patch kit applied. Integrity restored to " + Math.ceil(player.health) + " percent.");
    } else if (pickup.type === "cell") {
      player.maxCharge += CHARGE_CELL_MAX_BONUS;
      player.charge = player.maxCharge;
      triggerFeedback("pickup", 400);
      announce("Charge cell absorbed. Capacitor expanded to " + player.maxCharge + " units and fully charged.");
    } else if (pickup.type === "core") {
      player.damage = UPGRADED_SHOOT_DAMAGE;
      player.cooldownMs = UPGRADED_SHOOT_COOLDOWN_MS;
      triggerFeedback("sweet", 700);
      announce("SW33T CORE integrated. Pulse cannon overclocked: more damage, faster cycling.");
    } else if (pickup.type === "mango") {
      mangoFound = true;
      player.health = PLAYER_MAX_HEALTH;
      triggerFeedback("sweet", 900);
      announce("THE GOLDEN MANGO. Legends were true. Integrity fully restored. You feel unstoppable.");
    }
  }
}

// ----- Shooting --------------------------------------------------------
// Marches in small steps along the straight line from (x0,y0) to (x1,y1)
// and bails out if any step lands inside a wall. Good enough resolution
// (checking every 0.1 world units, against 1-unit-wide grid cells) to
// never "tunnel" through a wall between samples.
function hasClearShot(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(dist / 0.1));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (Raycaster.isWall(x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

// Hitscan shot: instantly checks every living enemy that's within range,
// roughly in front of the player, and not hidden behind a wall, then
// damages the closest one. No visible projectile - this is a laser/EMP
// "pulse", not a physical bullet, so instant hit fits the theme fine.
function attemptShoot(now) {
  if (gameState !== "playing") return;
  if (now - lastShotTime < player.cooldownMs) return;
  if (player.charge < SHOOT_CHARGE_COST) {
    triggerFeedback("low-charge", 900);
    announce("Firewall charge is too low. Wait for the capacitor to regenerate.");
    return;
  }

  lastShotTime = now;
  player.charge -= SHOOT_CHARGE_COST;
  triggerFeedback("shot", 120);

  let bestEnemy = null;
  let bestDist = Infinity;

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy.alive) continue;

    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > SHOOT_RANGE) continue;

    const angleToEnemy = Math.atan2(dy, dx);
    let angleDiff = angleToEnemy - player.angle;
    // Normalize into [-PI, PI] so, e.g., an angle difference that wrapped
    // around past 180 degrees doesn't look like a huge miss.
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    if (Math.abs(angleDiff) > SHOOT_CONE_HALF_ANGLE) continue;

    if (!hasClearShot(player.x, player.y, enemy.x, enemy.y)) continue;

    if (dist < bestDist) {
      bestDist = dist;
      bestEnemy = enemy;
    }
  }

  if (bestEnemy) {
    const label = ENEMY_TYPES[bestEnemy.type].label;
    bestEnemy.health -= player.damage;
    bestEnemy.hit = true;
    bestEnemy.hitTimer = HIT_FLASH_MS;
    if (bestEnemy.health <= 0) {
      bestEnemy.alive = false;
      announce("A " + label + " was purged. " + countLivingEnemies() + " threats remain.");
    } else {
      announce("Direct hit on a " + label + ".");
    }
  } else {
    announce("Pulse missed.");
  }
}

function countLivingEnemies() {
  return enemies.filter(function (enemy) { return enemy.alive; }).length;
}

// ----- Enemy AI ----------------------------------------------------------
// Simple "chase the player" behavior: every threat always knows exactly
// where the player is and walks straight toward them (at its own type's
// speed), using the same axis-separated wall collision as the player so
// they can't cut through maze pillars. Once close enough, it deals its
// type's contact damage on a cooldown instead of moving further.
const ENEMY_CONTACT_RANGE = 0.6;
// Collision radius for enemies. This needs to be reasonably close to how
// wide the sprites actually LOOK (the widest, the brute, draws about 0.425
// units from center to edge) - when this was much smaller than the art,
// enemies could legally stand so close to a wall that their sprite drew
// halfway inside it, which read as "an enemy spawned in the wall".
const ENEMY_RADIUS = 0.3;

// Can an enemy's body (a square of ENEMY_RADIUS around its center) sit at
// this spot without poking into a wall? We probe the four edge midpoints
// AND the four corners. The corners matter: with only the edge probes, an
// enemy sliding diagonally could wedge itself exactly into a wall corner
// (all four edge probes in open cells, but the corner of a wall block
// inside its body) and get permanently stuck there, half-buried in the
// wall - which is exactly what the old version of this check allowed.
function enemyCanOccupy(x, y) {
  return !Raycaster.isWall(x - ENEMY_RADIUS, y) &&
    !Raycaster.isWall(x + ENEMY_RADIUS, y) &&
    !Raycaster.isWall(x, y - ENEMY_RADIUS) &&
    !Raycaster.isWall(x, y + ENEMY_RADIUS) &&
    !Raycaster.isWall(x - ENEMY_RADIUS, y - ENEMY_RADIUS) &&
    !Raycaster.isWall(x + ENEMY_RADIUS, y - ENEMY_RADIUS) &&
    !Raycaster.isWall(x - ENEMY_RADIUS, y + ENEMY_RADIUS) &&
    !Raycaster.isWall(x + ENEMY_RADIUS, y + ENEMY_RADIUS);
}

function moveEnemyTowardPlayer(enemy, dx, dy, dist, dt) {
  const step = ENEMY_TYPES[enemy.type].speed * dt;
  const towardX = (dx / dist) * step;
  const towardY = (dy / dist) * step;
  const candidates = [
    { x: towardX, y: towardY },
    { x: towardX, y: 0 },
    { x: 0, y: towardY },
    { x: (-dy / dist) * step * enemy.wallBias, y: (dx / dist) * step * enemy.wallBias },
    { x: (dy / dist) * step * enemy.wallBias, y: (-dx / dist) * step * enemy.wallBias }
  ];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    // Skip do-nothing candidates. When the enemy is exactly lined up with
    // the player on one axis (dx or dy is 0 - common, since every spawn
    // sits on a cell center), the "slide along one axis" candidates above
    // collapse to a zero-length move. That move always "succeeds", which
    // used to freeze the enemy in place against a wall forever instead of
    // letting the wall-following candidates below take over.
    if (candidate.x === 0 && candidate.y === 0) continue;
    if (enemyCanOccupy(enemy.x + candidate.x, enemy.y + candidate.y)) {
      enemy.x += candidate.x;
      enemy.y += candidate.y;
      return;
    }
  }

  // Switch wall-following direction if this side of an obstacle is blocked.
  enemy.wallBias *= -1;
}

function updateEnemies(dt, now) {
  let aliveCount = 0;

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];

    if (enemy.hitTimer > 0) {
      enemy.hitTimer -= dt * 1000;
      if (enemy.hitTimer <= 0) {
        enemy.hitTimer = 0;
        enemy.hit = false;
      }
    }

    if (!enemy.alive) continue;
    aliveCount++;

    const stats = ENEMY_TYPES[enemy.type];
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > ENEMY_CONTACT_RANGE) {
      moveEnemyTowardPlayer(enemy, dx, dy, dist, dt);
    } else if (now - enemy.lastAttackTime > stats.attackCooldownMs) {
      enemy.lastAttackTime = now;
      player.health = Math.max(0, player.health - stats.damage);
      triggerFeedback("damaged", 240);
      announce("Hit by a " + stats.label + ". " + Math.ceil(player.health) + " percent integrity remains.");
    }
  }

  return aliveCount;
}

// ----- Building the frame's sprite list ------------------------------------
// The raycaster just wants one flat list of billboard things to draw.
// Living enemies pass along their hit-flash state; uncollected pickups
// get a gentle sine-wave bob (driven by the clock, offset per pickup so
// they don't all bounce in unison) to make them read as "grab me".
function buildSpriteList(now) {
  const items = [];

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy.alive) continue;
    items.push({
      x: enemy.x,
      y: enemy.y,
      sprite: ENEMY_TYPES[enemy.type].sprite,
      hit: enemy.hit
    });
  }

  for (let i = 0; i < pickups.length; i++) {
    const pickup = pickups[i];
    if (pickup.taken) continue;
    items.push({
      x: pickup.x,
      y: pickup.y,
      sprite: pickup.type,
      bobOffset: Math.sin(now / 300 + i * 1.7) * 0.05
    });
  }

  return items;
}

// ----- HUD + overlays ------------------------------------------------------
function updateHud() {
  healthValueEl.textContent = Math.ceil(player.health);
  healthFillEl.style.width = (Math.max(0, player.health) / PLAYER_MAX_HEALTH) * 100 + "%";

  chargeValueEl.textContent = Math.ceil(player.charge);
  chargeFillEl.style.width = (Math.max(0, player.charge) / player.maxCharge) * 100 + "%";

  threatsValueEl.textContent = threatsRemaining;
}

function showOverlay(el) {
  el.classList.add("visible");
  el.setAttribute("aria-hidden", "false");
  const firstControl = el.querySelector("button, a[href]");
  if (firstControl) firstControl.focus({ preventScroll: true });
}

function hideOverlays() {
  startScreenEl.classList.remove("visible");
  pauseScreenEl.classList.remove("visible");
  winScreenEl.classList.remove("visible");
  loseScreenEl.classList.remove("visible");
  [startScreenEl, pauseScreenEl, winScreenEl, loseScreenEl].forEach(function (screen) {
    screen.setAttribute("aria-hidden", "true");
  });
}

function startGame() {
  hideOverlays();
  gameState = "playing";
  lastFrameTime = null;
  announce("Mission started. " + enemies.length + " threats detected across the complex.");
  gameWrapEl.focus({ preventScroll: true });
}

function resumeGame() {
  pauseScreenEl.classList.remove("visible");
  pauseScreenEl.setAttribute("aria-hidden", "true");
  gameState = "playing";
  lastFrameTime = null;
  announce("Mission resumed.");
  gameWrapEl.focus({ preventScroll: true });
}

// Resets every piece of run state back to the start and drops the player
// right back into a fresh mission - used by both the win and lose screens'
// restart button (and the Enter key shortcut). Also re-seals the secret
// door via Raycaster.resetMap(), since opening it mutates the map.
function restartGame() {
  Raycaster.resetMap();
  player = createFreshPlayer();
  enemies = createEnemies();
  pickups = createPickups();
  threatsRemaining = enemies.length;
  secretDoorOpened = false;
  secretHintGiven = false;
  mangoFound = false;
  sweetCodeUsed = false;
  sweetCodeBuffer = "";
  gameState = "playing";
  lastShotTime = 0;
  lastFrameTime = null;
  clearHeldKeys();
  hideOverlays();
  announce("Mission restarted. " + enemies.length + " threats detected across the complex.");
  gameWrapEl.focus({ preventScroll: true });
}

// The win screen's flavor line changes depending on whether the player
// found the vault - a small nudge to go looking on the next run.
function updateWinSecretNote() {
  if (mangoFound) {
    winSecretNoteEl.textContent = "GOLDEN MANGO RECOVERED. Full clearance achieved. The orchard remembers.";
  } else {
    winSecretNoteEl.textContent = "Post-mission intel: an asset codenamed GOLDEN MANGO was never located. Some walls are not what they seem.";
  }
}

// ----- Main loop -----------------------------------------------------------
function gameLoop(timestamp) {
  if (lastFrameTime === null) lastFrameTime = timestamp;
  let dt = (timestamp - lastFrameTime) / 1000; // seconds since last frame
  lastFrameTime = timestamp;
  // Clamp dt so, e.g., switching browser tabs for a while and coming back
  // doesn't teleport the player through a wall or let a dozen enemy
  // attacks all land in a single catch-up frame.
  if (dt > 0.1) dt = 0.1;

  if (gameState === "playing") {
    updatePlayer(dt);
    updatePickups();
    maybeHintSecret();
    threatsRemaining = updateEnemies(dt, timestamp);

    if (player.health <= 0) {
      gameState = "lost";
      announce("System compromised. Mission failed.");
      showOverlay(loseScreenEl);
    } else if (threatsRemaining === 0) {
      gameState = "won";
      announce("Perimeter secured. All threats purged.");
      updateWinSecretNote();
      showOverlay(winScreenEl);
    }
  }

  Raycaster.render(viewportCtx, viewportCanvas.width, viewportCanvas.height, player, buildSpriteList(timestamp), timestamp);
  updateHud();

  requestAnimationFrame(gameLoop);
}

// Kick everything off.
threatsValueEl.textContent = enemies.length;
[pauseScreenEl, winScreenEl, loseScreenEl].forEach(function (screen) {
  screen.setAttribute("aria-hidden", "true");
});
startScreenEl.setAttribute("aria-hidden", "false");
startGameButton.focus({ preventScroll: true });
requestAnimationFrame(gameLoop);
