// menu.js
// Enhances ordinary hash links into focused, history-aware content panels.
// Without JavaScript every section remains visible in normal document flow.

(function () {
  "use strict";

  const panelIds = ["profile", "projects", "game", "contact", "credits"];
  const panels = Array.from(document.querySelectorAll(".content-panel"));
  const menuLinks = Array.from(document.querySelectorAll(".menu-option"));
  const replayButton = document.getElementById("replay-boot");
  let lastMenuTrigger = null;

  function currentPanelId() {
    const id = window.location.hash.replace(/^#/, "");
    return panelIds.indexOf(id) === -1 ? "" : id;
  }

  function renderRoute(options) {
    const settings = options || {};
    const id = currentPanelId();

    panels.forEach(function (panel) {
      const active = panel.id === id;
      panel.classList.toggle("active", active);
      panel.setAttribute("aria-hidden", active ? "false" : "true");
    });

    menuLinks.forEach(function (link) {
      const active = link.getAttribute("href") === "#" + id;
      if (active) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (settings.focus && id) {
      const activePanel = document.getElementById(id);
      activePanel.focus({ preventScroll: true });
    } else if (settings.focus && !id && lastMenuTrigger) {
      lastMenuTrigger.focus({ preventScroll: true });
    }
  }

  menuLinks.forEach(function (link) {
    link.addEventListener("click", function () {
      lastMenuTrigger = link;
    });
  });

  document.querySelectorAll(".back-to-menu").forEach(function (link) {
    link.addEventListener("click", function () {
      if (!lastMenuTrigger) {
        lastMenuTrigger = menuLinks.find(function (item) {
          return item.getAttribute("href") === window.location.hash;
        }) || menuLinks[0];
      }
    });
  });

  window.addEventListener("hashchange", function () {
    renderRoute({ focus: true });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && currentPanelId()) {
      event.preventDefault();
      window.location.hash = "top";
    }
  });

  if (replayButton) {
    replayButton.addEventListener("click", function () {
      if (window.MangoBoot) window.MangoBoot.replay();
    });
  }

  renderRoute({ focus: false });
})();
