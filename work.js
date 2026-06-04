/* ============================================================
   lokasasmita — /work
   1. reveal: the covering black recedes up on arrival
   2. scroll-driven showcase: the active project (list marker, blurb,
      preview) tracks the scroll position
   3. numbers: each project carries its own sticky number, so at a
      hand-off you see both — the outgoing one scrolls up and, driven
      by scroll, rotates + shrinks + fades away
   ============================================================ */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var narrow = window.matchMedia("(max-width: 860px)");

  /* ---- project data (order matches the rail + list) --------
     meta = the short date/context line shown next to Contact in the header
     (ref style, one line); url = "Visit site" target ("#" until a real one
     is wired); desc = the longer blurb (kept for future use). */
  var PROJECTS = [
    { name: "Holidays",     meta: "Holiday-themed side projects",  url: "#", desc: "Small, holiday themed side project websites" },
    { name: "No Moss",      meta: "'25, final-year capstone",      url: "#", desc: "Capstone project for final year of university. Fullstack web app built with Nuxt 4." },
    { name: "Mtech",        meta: "'25, MTech Consulting Club",    url: "#", desc: "Developed and launched the official website for MTech Consulting Club at The University of Melbourne" },
    { name: "Kora",         meta: "'24, co-founded AI startup",    url: "#", desc: "Co-founded a startup developing an AI model tailored for VCE. Scaled to 6,000+ users with 200 MAU." },
    { name: "Portfolio V1", meta: "Mar. '25, first portfolio",    url: "#", desc: "First portfolio website built in March 2025" }
  ];

  var shot = document.getElementById("workShot");
  var marker = document.getElementById("workMarker");
  var progressBar = document.getElementById("workProgress");
  var focusDesc = document.getElementById("focusDesc");   // header context line
  var focusVisit = document.getElementById("focusVisit"); // header "Visit site"
  var listEls = [].slice.call(document.querySelectorAll("#workList li"));
  var projEls = [].slice.call(document.querySelectorAll(".proj"));
  var numWraps = [].slice.call(document.querySelectorAll(".proj__num"));

  /* ---- preview media: shows the IMAGE or VIDEO you hover (or, while
     scrolling, each project's first item). ------------------- */
  var shotImg = shot.querySelector(".work-shot__img");
  var shotVid = shot.querySelector(".work-shot__vid");
  var hovering = false;
  function showMedia(src, type, label, poster) {
    if (label) shot.setAttribute("data-label", label);
    if (type === "video") {
      if (poster) shotVid.setAttribute("poster", poster); // still frame while it loads / if autoplay is blocked
      if (shotVid.getAttribute("src") !== src) shotVid.setAttribute("src", src);
      shotImg.style.display = "none";
      shotVid.style.display = "block";
      shotVid.muted = true; // Safari only auto-plays muted video
      var pr = shotVid.play();
      if (pr && pr.catch) pr.catch(function () {});
    } else {
      if (shotImg.getAttribute("src") !== src) shotImg.setAttribute("src", src);
      shotVid.pause();
      shotVid.style.display = "none";
      shotImg.style.display = "block";
    }
  }
  // the preview follows the THUMBNAIL nearest the viewport centre as you scroll
  // ("the image or video you are on"); hovering a thumb overrides that.
  var allThumbs = [].slice.call(document.querySelectorAll("#workRail .thumb"));
  // video THUMBNAILS play the clip too so the left rail's video item MOVES like
  // the big preview, instead of a static poster. They must ALWAYS be playing and
  // NEVER show a play/pause icon: muted + playsinline + autoplay + loop, and we
  // re-kick play() on load + whenever the tab refocuses (autoplay fires once; a
  // backgrounded load pauses) + on the first interaction (Low Power Mode etc.).
  var thumbVids = [];
  function kick(v) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
  allThumbs.forEach(function (t) {
    if (t.getAttribute("data-type") !== "video") return;
    var v = document.createElement("video");
    v.className = "thumb__vid";
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.autoplay = true;
    v.setAttribute("muted", "");
    v.setAttribute("autoplay", "");
    v.setAttribute("loop", "");
    v.setAttribute("playsinline", "");
    v.setAttribute("preload", "auto");
    try { v.disablePictureInPicture = true; } catch (_) {}
    v.src = t.getAttribute("data-src");
    t.appendChild(v);
    thumbVids.push(v);
    kick(v);
    v.addEventListener("loadeddata", function () { kick(v); });
    v.addEventListener("canplay", function () { kick(v); });
    // ALWAYS playing + on repeat: resume instantly if the browser pauses it while
    // the tab is visible; rewind + replay if a loop ever slips.
    v.addEventListener("pause", function () { if (!document.hidden) kick(v); });
    v.addEventListener("ended", function () { try { v.currentTime = 0; } catch (_) {} kick(v); });
  });
  // the BIG preview video must keep playing too (both sides loop). showMedia may
  // call play() before the file is ready, so re-kick it on its readiness events.
  function kickShot() { if (shotVid && shotVid.style.display !== "none" && shotVid.getAttribute("src")) kick(shotVid); }
  shotVid.addEventListener("loadeddata", kickShot);
  shotVid.addEventListener("canplay", kickShot);
  // the big preview also stays playing + on repeat
  shotVid.addEventListener("pause", function () { if (!document.hidden) kickShot(); });
  shotVid.addEventListener("ended", function () { try { shotVid.currentTime = 0; } catch (_) {} kickShot(); });
  function kickAll() { thumbVids.forEach(kick); kickShot(); }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) kickAll(); });
  window.addEventListener("pageshow", kickAll);   // back/forward cache restore
  window.addEventListener("focus", function () { if (!document.hidden) kickAll(); });
  // backstop: resume anything paused while the tab is visible (cheap — paused-only)
  function resumeAll() {
    if (document.hidden) return;
    for (var i = 0; i < thumbVids.length; i++) { if (thumbVids[i].paused) kick(thumbVids[i]); }
    if (shotVid && shotVid.style.display !== "none" && shotVid.getAttribute("src") && shotVid.paused) kick(shotVid);
  }
  setInterval(resumeAll, 2000);
  // Safari DEFERS muted autoplay and BLOCKS it under Low Power Mode / a per-site
  // "Never Auto-Play" setting — play() is only honoured from a USER GESTURE. Re-kick
  // on EVERY interaction, PERSISTENTLY: a first gesture that fires during load (or is
  // refused under LPM) must NOT disable the later click/tap/key that finally works.
  ["pointerdown", "touchstart", "keydown", "wheel"].forEach(function (ev) {
    window.addEventListener(ev, resumeAll, { passive: true });
  });
  function showThumb(t) {
    if (!t) return;
    var pe = t.closest(".proj");
    var nm = pe ? (PROJECTS[+pe.getAttribute("data-i")] || {}).name : "";
    // the video thumb carries its own still as a background-image — reuse it as
    // the <video> poster so the preview never flashes black before playback
    var poster = (t.style.backgroundImage || "").replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
    showMedia(t.getAttribute("data-src"), t.getAttribute("data-type"), nm, poster);
  }
  function showNearest() {
    var line = window.innerHeight * 0.5;
    var best = null, bestDist = Infinity;
    for (var i = 0; i < allThumbs.length; i++) {
      var r = allThumbs[i].getBoundingClientRect();
      var d = Math.abs(r.top + r.height / 2 - line);
      if (d < bestDist) { bestDist = d; best = allThumbs[i]; }
    }
    showThumb(best);
  }
  // hovering a thumbnail shows THAT one; leaving the rail reverts to the scroll
  // position (the thumbnail nearest the viewport centre)
  var rail = document.getElementById("workRail");
  if (rail) {
    rail.addEventListener("pointerover", function (e) {
      var t = e.target.closest && e.target.closest(".thumb");
      if (!t) return;
      hovering = true;
      showThumb(t);
    });
    rail.addEventListener("pointerout", function (e) {
      var t = e.target.closest && e.target.closest(".thumb");
      var to = e.relatedTarget;
      if (t && (!to || !(to.closest && to.closest(".thumb")))) {
        hovering = false;
        showNearest();
      }
    });
  }

  /* slide the single ◀ marker to a row's vertical centre (CSS transitions the
     transform, so it glides from project to project instead of teleporting) */
  function moveMarker(i) {
    if (!marker || !listEls[i]) return;
    var li = listEls[i];
    var y = li.offsetTop + (li.offsetHeight - marker.offsetHeight) / 2;
    marker.style.transform = "translateY(" + y.toFixed(1) + "px)";
  }

  /* ---- active project -> list marker. The PREVIEW follows the nearest
     thumbnail (handled in update()), so it can change WITHIN a project. ----- */
  var active = -1;
  function setActive(i) {
    if (i === active) return;
    active = i;
    for (var k = 0; k < listEls.length; k++) {
      listEls[k].classList.toggle("is-active", k === i);
    }
    // header line + Visit-site target track the active project
    var p = PROJECTS[i];
    if (p) {
      if (focusDesc) focusDesc.textContent = p.meta || "";
      if (focusVisit) focusVisit.href = p.url || "#";
    }
  }

  /* ---- scroll-linked number flourish ----------------------- */
  // the sticky number pins at the band (--band: 30vh). While pinned its
  // top == band; once its project scrolls away it un-pins and its top
  // drops below band — the further past, the more it rotates / shrinks / fades.
  var BAND = 0.5; // matches --band (sticky block low in the viewport)
  var LEAVE = 0.16; // viewport fraction over which it fully disappears
  function clearNum(inner) {
    if (inner.style.transform) {
      inner.style.transform = "";
      inner.style.opacity = "";
    }
  }
  function updateNums() {
    var band = window.innerHeight * BAND;
    var dist = window.innerHeight * LEAVE;
    for (var i = 0; i < numWraps.length; i++) {
      var inner = numWraps[i].firstElementChild;
      if (reduce || narrow.matches) {
        clearNum(inner);
        continue;
      }
      var top = numWraps[i].getBoundingClientRect().top;
      if (top < band - 0.5) {
        var p = Math.min((band - top) / dist, 1);
        // slot-machine roll: lift up while rolling back around the horizontal
        // axis (top recedes -> the glyph foreshortens), then fade out
        inner.style.transform =
          "perspective(480px) translateY(" + (-p * 0.55).toFixed(2) + "em) rotateX(" + (p * 95).toFixed(1) + "deg)";
        // fade fully (and a touch early) so the old number is gone by the time
        // the next one reaches the band — no lingering ghost
        inner.style.opacity = Math.max(0, 1 - p * 1.35).toFixed(3);
      } else {
        clearNum(inner);
      }
    }
  }

  // active project = the last one whose section has reached the band
  function update() {
    var line = window.innerHeight * 0.54; // just below the band
    var best = 0;
    for (var i = 0; i < projEls.length; i++) {
      if (projEls[i].getBoundingClientRect().top <= line) best = i;
    }
    setActive(best);
    moveMarker(best); // keeps the marker aligned (slides on change; also re-aligns on resize)
    updateNums();
    if (!hovering) showNearest(); // preview = the thumbnail you're scrolled onto
    // keep both sides alive: if Safari paused a clip (deferred autoplay / refocus),
    // scrolling re-kicks it — play() on an already-playing video is a no-op
    for (var v = 0; v < thumbVids.length; v++) { if (thumbVids[v].paused) kick(thumbVids[v]); }
    kickShot();
    // right-edge progress bar: grows downward (scaleY from top) with scroll
    if (progressBar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var prog = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
      progressBar.style.transform = "scaleY(" + prog.toFixed(4) + ")";
    }
  }

  // rAF-throttle scroll: scroll events can fire several times per frame, and update()
  // reads a rect for every project / thumb / number. Coalesce to AT MOST ONCE PER
  // FRAME — identical result, far less main-thread work + no layout thrash from
  // redundant reads. (resize stays direct; it's rare and needs an immediate re-layout.)
  var scrollTick = false;
  function onScroll() {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(function () { scrollTick = false; update(); });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", update);

  // clicking a project name jumps to its segment
  listEls.forEach(function (li) {
    li.addEventListener("click", function () {
      var i = +li.getAttribute("data-i");
      var top = projEls[i].getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.5;
      window.scrollTo({ top: top, behavior: reduce ? "auto" : "smooth" });
    });
  });

  // WORK (current page) -> back to top
  var current = document.querySelector(".nav a.is-active");
  if (current) {
    current.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });
  }

  // arriving from the Works grid: focus the project the user clicked (grid.js
  // stored its index in sessionStorage) so the hero thumbnail morphing in lands
  // on the matching preview. The old click-through to project.html is removed —
  // that page is unlinked for now.
  (function focusFromGrid() {
    var i = -1;
    try {
      i = parseInt(sessionStorage.getItem("focusProj"), 10);
      sessionStorage.removeItem("focusProj");
      sessionStorage.removeItem("focusSrc");
      sessionStorage.removeItem("focusType");
    } catch (_) {}
    if (isNaN(i) || i < 0 || i >= projEls.length) { update(); return; }
    var top = projEls[i].getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.5;
    window.scrollTo({ top: top, behavior: "auto" });
    update();
  })();
})();
