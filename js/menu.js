// menu.js
// Handles everything that happens AFTER the boot sequence: showing the
// main menu, letting the player pick an option (mouse or arrow keys),
// and swapping in the matching content section.
//
// Note: this file looks up its own elements with document.getElementById,
// even though boot.js already looked some of them up too. That's on
// purpose — it keeps this file readable on its own, without having to
// know what variable names boot.js happens to use.

const bootTerminalEl = document.getElementById("terminal");
const enterMenuBtn = document.getElementById("main-menu-btn");
const mainMenu = document.getElementById("main-menu");
const contentView = document.getElementById("content-view");

// Array.from turns the NodeList that querySelectorAll gives us into a real
// array, so we can use array methods like .forEach on it.
const menuOptions = Array.from(document.querySelectorAll(".menu-option"));
const panels = Array.from(document.querySelectorAll(".content-panel"));
const backButtons = Array.from(document.querySelectorAll(".back-btn"));

// Which menu option is currently highlighted. Starts at 0 (NEW GAME) to
// match the "selected" class already sitting on the first <li> in index.html.
let selectedIndex = 0;

// Moves the highlighted ("selected") menu option to a new index.
// Wraps around with the % (modulo) trick so pressing Up on the first
// option jumps to the last one, and vice versa.
function selectOption(index) {
  menuOptions[selectedIndex].classList.remove("selected");
  selectedIndex = (index + menuOptions.length) % menuOptions.length;
  menuOptions[selectedIndex].classList.add("selected");
}

// Hides the menu and shows one content section (by its data-section name,
// e.g. "credits" shows the <section id="section-credits">).
function showSection(name) {
  panels.forEach((panel) => panel.classList.toggle("active", panel.id === "section-" + name));
  mainMenu.classList.remove("visible");
  mainMenu.style.display = "none";
  contentView.style.display = "flex";
  contentView.classList.add("visible");
}

// Hides whichever content section is showing and brings the menu back.
function showMainMenu() {
  contentView.classList.remove("visible");
  contentView.style.display = "none";
  mainMenu.style.display = "flex";
  mainMenu.classList.add("visible");
}

// Wire up each menu option: hovering with the mouse selects it,
// clicking it opens its section.
menuOptions.forEach((option, index) => {
  option.addEventListener("mouseenter", () => selectOption(index));
  option.addEventListener("click", () => showSection(option.dataset.section));
});

// Every "◄ BACK TO MENU" button does the same thing, so we can loop over them.
backButtons.forEach((btn) => btn.addEventListener("click", showMainMenu));

// Keyboard support: Up/Down move the selection, Enter opens the selected
// section, Escape backs out of a section to the menu.
document.addEventListener("keydown", (e) => {
  if (mainMenu.classList.contains("visible")) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectOption(selectedIndex + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectOption(selectedIndex - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      showSection(menuOptions[selectedIndex].dataset.section);
    }
  } else if (contentView.classList.contains("visible")) {
    if (e.key === "Escape") {
      showMainMenu();
    }
  }
});

// The handoff from boot.js: once the player clicks ENTER MAIN MENU,
// hide the boot terminal and its button, then reveal the main menu.
enterMenuBtn.addEventListener("click", () => {
  bootTerminalEl.style.display = "none";
  enterMenuBtn.style.display = "none";
  showMainMenu();
});
