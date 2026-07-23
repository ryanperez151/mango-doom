// menu.js
// Sticky section-nav scroll-spy for the hub. Highlights the nav link for the
// section currently in view. This is pure enhancement: with JavaScript off the
// nav is plain in-page anchor links and every section is visible in normal
// document flow, so navigation still works.

(function () {
  "use strict";

  const navLinks = Array.from(document.querySelectorAll(".section-nav-link"));
  const replayButton = document.getElementById("replay-boot");

  // Boot-replay hook. This button only exists on the hub's Credits section.
  if (replayButton) {
    replayButton.addEventListener("click", function () {
      if (window.MangoBoot) window.MangoBoot.replay();
    });
  }

  // Scroll-spy needs the nav links and IntersectionObserver support. Bail out
  // safely otherwise — the plain anchor links keep working.
  if (navLinks.length === 0 || typeof IntersectionObserver === "undefined") {
    return;
  }

  // Pair each nav link with the section element it points at.
  const pairs = navLinks
    .map(function (link) {
      const id = link.getAttribute("href").replace(/^#/, "");
      const section = document.getElementById(id);
      return section ? { link: link, section: section } : null;
    })
    .filter(Boolean);

  // Sections currently touching the viewport.
  const visibleSections = new Set();

  function highlightTopmost() {
    // The "current" section is the topmost one still visible on screen.
    let winner = null;
    pairs.forEach(function (pair) {
      if (!visibleSections.has(pair.section)) return;
      if (!winner || pair.section.offsetTop < winner.section.offsetTop) {
        winner = pair;
      }
    });
    navLinks.forEach(function (link) {
      if (winner && link === winner.link) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        visibleSections.add(entry.target);
      } else {
        visibleSections.delete(entry.target);
      }
    });
    highlightTopmost();
  }, { threshold: 0 });

  pairs.forEach(function (pair) {
    observer.observe(pair.section);
  });
})();
