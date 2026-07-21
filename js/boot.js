// boot.js
// Runs the decorative MANGO.SYS startup sequence. The portfolio itself is
// ordinary HTML and does not depend on this animation.

(function () {
  "use strict";

  const STORAGE_KEY = "mangoSys.bootSeen";
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
    "Mounting /var/orchard................... OK",
    "Loading sw33t protocols................. OK",
    "Loading ripeness detection engine....... OK",
    "Applying pulp filtering rules........... over 9000 loaded",
    "",
    "Checking license........................ VALID (Grade A Fruit)",
    "Syncing threat signatures............... OK",
    "Bypassing pesticides.................... OK",
    "Decrypting produce access............... OK",
    "",
    "WARNING: 1 rotten packet quarantined at Eth2",
    "",
    "System ready.",
    "Access granted. Welcome, operator. 🥭"
  ];

  const terminalEl = document.getElementById("terminal");
  const skipButton = document.getElementById("main-menu-btn");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let cancelled = false;
  let lineIndex = 0;
  let charIndex = 0;
  let currentLineSpan = null;

  function storageSetSeen(value) {
    try {
      if (value) {
        sessionStorage.setItem(STORAGE_KEY, "true");
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      // Storage can be disabled; skipping still works for this page load.
    }
  }

  function completeBoot() {
    storageSetSeen(true);
    if (document.documentElement.classList.contains("boot-complete")) return;
    cancelled = true;
    document.documentElement.classList.add("boot-complete");
    const portfolio = document.getElementById("portfolio");
    if (portfolio) {
      portfolio.setAttribute("tabindex", "-1");
      portfolio.focus({ preventScroll: true });
      portfolio.removeAttribute("tabindex");
    }
  }

  function getLineClass(line) {
    if (line.startsWith("WARNING")) return "line-warning";
    if (line.startsWith("Access granted") || line.startsWith("System ready")) return "line-success";
    return "";
  }

  function finishTyping() {
    if (cancelled) return;
    const cursor = document.createElement("span");
    cursor.id = "cursor";
    cursor.textContent = " ";
    terminalEl.appendChild(cursor);
    window.setTimeout(completeBoot, 500);
  }

  function typeLine() {
    if (cancelled) return;
    if (lineIndex >= bootLines.length) {
      finishTyping();
      return;
    }

    const currentLine = bootLines[lineIndex];
    if (charIndex === 0) {
      currentLineSpan = document.createElement("span");
      terminalEl.appendChild(currentLineSpan);
    }

    if (charIndex < currentLine.length) {
      currentLineSpan.textContent += currentLine.charAt(charIndex);
      charIndex += 1;
      window.setTimeout(typeLine, 5);
      return;
    }

    const lineClass = getLineClass(currentLine);
    if (lineClass) currentLineSpan.classList.add(lineClass);
    terminalEl.appendChild(document.createTextNode("\n"));
    lineIndex += 1;
    charIndex = 0;
    const isStatusLine = /(OK|UP|DOWN)\s*$/.test(currentLine.trim());
    window.setTimeout(typeLine, isStatusLine ? 180 : 35);
  }

  skipButton.addEventListener("click", completeBoot);

  if (document.documentElement.classList.contains("boot-complete") || reducedMotion) {
    completeBoot();
  } else {
    typeLine();
  }

  window.MangoBoot = {
    replay: function () {
      storageSetSeen(false);
      window.location.hash = "";
      window.location.reload();
    }
  };
})();
