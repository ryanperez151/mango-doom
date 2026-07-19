// boot.js
// Handles the fake "firewall booting up" terminal animation.
// When it's done, it reveals the ENTER MAIN MENU button (menu.js takes it from there).

// This is just a list of strings — one per line of the boot log.
// We'll type them out on screen one character at a time.
const bootLines = [
  "MANGO.SYS Firewall Appliance — Boot Loader v3.1.4",
  "Copyright (c) Ryan Perez Security Systems",
  "",
  "Performing POST........................ OK",
  "Checking peel integrity................ OK",
  "Checking pit density................... OK",
  "Loading kernel: mangOS-hardened.img... OK",
  "",
  "Initializing interfaces:",
  "  Eth0/JUICE-LAN......................  UP",
  "  Eth1/PIT-WAN........................  UP",
  "  Eth2/PESTICIDE-DMZ..................  DOWN (isolated)",
  "",
  "Mounting /var/orchard...................  OK",
  "Loading sw33t protocols.................  OK",
  "Loading ripeness detection engine.......  OK",
  "Applying pulp filtering rules...........  over 9000 loaded",
  "",
  "Checking license........................  VALID (Grade A Fruit)",
  "Syncing threat signatures...............  OK",
  "Bypassing pesticides.................... OK",
  "Decrypting produce access.................. OK",
  "",
  "WARNING: 1 rotten packet quarantined at Eth2",
  "",
  "System ready.",
  "Access granted. Welcome, operator. 🥭"
];

// document.getElementById grabs a reference to an element already sitting in index.html,
// so we can change what it shows / how it looks from here.
const terminalEl = document.getElementById("terminal");
const menuBtn = document.getElementById("main-menu-btn");

// Sped up base typing speed (was 35ms per character, now 12ms)
const typingSpeed = 5;
// Base pause between lines (was 400ms, now much shorter)
const linePause = 40;
// Extra pause specifically for "status" lines (OK / UP / DOWN),
// so those still feel like the system is "checking" something
const statusLinePause = 220;

let lineIndex = 0;
let charIndex = 0;
let currentLineSpan = null; // the <span> element we're currently typing into

// Decide if a line is a "status" line worth pausing on a bit longer
function isStatusLine(line) {
  return /(OK|UP|DOWN)\s*$/.test(line.trim());
}

// Decide what color class a finished line should get
function getLineClass(line) {
  if (line.startsWith("WARNING")) return "line-warning";
  if (line.startsWith("Access granted") || line.startsWith("System ready")) return "line-success";
  return ""; // default mango-orange, no special class needed
}

// This function calls itself (via setTimeout) over and over, one character
// or one pause at a time, until every line in bootLines has been typed out.
function typeLine() {
  if (lineIndex >= bootLines.length) {
    finishBoot();
    return;
  }

  const currentLine = bootLines[lineIndex];

  // Start a new line: create a fresh span to type into
  if (charIndex === 0) {
    currentLineSpan = document.createElement("span");
    terminalEl.appendChild(currentLineSpan);
  }

  if (charIndex < currentLine.length) {
    currentLineSpan.textContent += currentLine.charAt(charIndex);
    charIndex++;
    setTimeout(typeLine, typingSpeed);
  } else {
    // Line finished typing — apply color class now that we know full content
    const lineClass = getLineClass(currentLine);
    if (lineClass) currentLineSpan.classList.add(lineClass);

    // Add the line break after the span
    terminalEl.appendChild(document.createTextNode("\n"));

    lineIndex++;
    charIndex = 0;

    // Pause longer after status lines (OK/UP/DOWN), shorter otherwise
    const pause = isStatusLine(currentLine) ? statusLinePause : linePause;
    setTimeout(typeLine, pause);
  }
}

// Runs once, after the last boot line has finished typing.
function finishBoot() {
  const cursorSpan = document.createElement("span");
  cursorSpan.id = "cursor";
  cursorSpan.textContent = " ";
  terminalEl.appendChild(cursorSpan);
  menuBtn.style.display = "block"; // reveal the ENTER MAIN MENU button
}

// Kick everything off as soon as this script runs.
typeLine();
