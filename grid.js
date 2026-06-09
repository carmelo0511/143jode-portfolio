/* ============================================================
   143jode — Works GRID (main /works index)
   Builds the centre name-list + a band of thumbnails per project,
   tracks the centred project on scroll, keeps the video tiles
   looping, and on click flies the chosen tile into the focus view
   (work.html) via a cross-document View Transition (vt-hero).
   ============================================================ */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* project order matches the focus view (work.html) + About's Selected Works */
  var PROJECTS = [
    { name: "TIF AFTERPARTY" },
    { name: "Vybz x Citadium" },
    { name: "Mamacita" },
    { name: "BigKid" },
    { name: "Blankk" },
    { name: "Project 06" },   // placeholders — rename + add a MEDIA[] entry as real assets land
    { name: "Project 07" },
    { name: "Project 08" },
    { name: "Project 09" },
    { name: "Project 10" }
  ];
  /* media PER PROJECT — indices are referenced by LAYOUTS below. Real assets land
     here as they're delivered; projects without them yet fall back to PLACEHOLDER. */
  var PLACEHOLDER = [
    { src: "media/img-1.jpg", type: "image" },
    { src: "media/img-2.jpg", type: "image" },
    { src: "media/img-3.jpg", type: "image" },
    { src: "media/0.mp4", type: "video", poster: "media/img-1.jpg" }
  ];
  var MEDIA = [
    /* 0 — TIF AFTERPARTY: 3 screen stills (landscape) + the teaser (vertical, so it
       fills the PORTRAIT accent tile) + the SNES cartridge render */
    [
      { src: "media/tif-1.jpg", type: "image" },
      { src: "media/tif-2.jpg", type: "image" },
      { src: "media/tif-3.jpg", type: "image" },
      { src: "media/tif.mp4", type: "video", poster: "media/tif-1.jpg" },
      { src: "media/tif-cartridge.jpg", type: "image" }
    ],
    /* 1 — Vybz x Citadium: the vertical STORY still fills the PORTRAIT accent (idx3);
       the landscape teaser (idx1) + screen stills fill the row */
    [
      { src: "media/vybz-1.jpg", type: "image" },
      { src: "media/vybz.mp4", type: "video", poster: "media/vybz-2.jpg" },
      { src: "media/vybz-2.jpg", type: "image" },
      { src: "media/vybz-3.jpg", type: "image" }
    ],
    /* 2 — Mamacita (Bad Bunny): the vertical teaser (idx3) fills the accent; frames row */
    [
      { src: "media/mama-1.jpg", type: "image" },
      { src: "media/mama-2.jpg", type: "image" },
      { src: "media/mama-3.jpg", type: "image" },
      { src: "media/mama.mp4", type: "video", poster: "media/mama-1.jpg" }
    ],
    /* 3 — BigKid: the ultrawide scene clip (idx1) sits in a wide tile; the BigKid logo accents */
    [
      { src: "media/bigkid-1.jpg", type: "image" },
      { src: "media/bigkid.mp4", type: "video", poster: "media/bigkid-1.jpg" },
      { src: "media/bigkid-2.jpg", type: "image" },
      { src: "media/bigkid-3.jpg", type: "image" }
    ],
    /* 4 — Blankk anniversary: the KK-club display loop (idx2) + stills */
    [
      { src: "media/blankk-1.jpg", type: "image" },
      { src: "media/blankk-2.jpg", type: "image" },
      { src: "media/blankk.mp4", type: "video", poster: "media/blankk-2.jpg" },
      { src: "media/blankk-3.jpg", type: "image" }
    ]
  ];
  /* per-project tile layout: each entry = [media index into MEDIA, SHAPE class],
     split into LEFT and RIGHT zones. Rotated per project so the shapes/sizes
     differ band to band (the ref mixes landscape / portrait / square tiles). */
  var LAYOUTS = [
    { left: [[1, "sm"], [0, "lg"]], right: [[2, "land"], [3, "port"], [0, "land"], [4, "land"]] },   // TIF — screens + teaser(accent) + cartridge
    { left: [[0, "sm"], [2, "lg"]], right: [[1, "land"], [3, "port"], [0, "land"], [2, "land"]] },
    { left: [[1, "sm"], [2, "lg"]], right: [[0, "land"], [1, "land"], [3, "port"], [2, "land"]] },
    { left: [[2, "sm"], [1, "lg"]], right: [[0, "land"], [3, "port"], [2, "land"], [0, "land"]] },
    { left: [[3, "sm"], [0, "lg"]], right: [[2, "land"], [1, "port"], [0, "land"], [1, "land"]] },
    /* 5–9 placeholders draw from the PLACEHOLDER pool (4 items: idx 0–3) */
    { left: [[1, "sm"], [0, "lg"]], right: [[2, "land"], [3, "port"], [0, "land"], [1, "land"]] },   // 5
    { left: [[0, "sm"], [2, "lg"]], right: [[1, "land"], [3, "port"], [2, "land"], [0, "land"]] },   // 6
    { left: [[2, "sm"], [1, "lg"]], right: [[0, "land"], [1, "land"], [3, "port"], [2, "land"]] },   // 7
    { left: [[3, "sm"], [0, "lg"]], right: [[2, "land"], [3, "port"], [1, "land"], [0, "land"]] },   // 8
    { left: [[1, "sm"], [2, "lg"]], right: [[0, "land"], [1, "port"], [3, "land"], [2, "land"]] }    // 9
  ];
  /* each project number sits at its OWN scattered [left, top] within the band.
     Tops are in VH (a FIXED offset from the band's top line) — NOT % of the band —
     so they stay put when the band's trailing padding changes. Each sits in a
     genuinely clear spot: far-left / left-centre drop below the left cluster
     (~16vh), the mid ones sit just under a right LANDSCAPE tile (~14vh) — all
     kept clear of the tall accent (a right PORTRAIT tile, reaching ~36vh). */
  var NUM_POS = [
    ["3vw", "20vh"],                                         // 0 TIF AFTERPARTY — far-left, below the left cluster
    ["17vw", "22vh"],                                       // 1 Vybz x Citadium — left-centre, below the lg tile
    ["51vw", "18vh"],                                        // 2 Mamacita — right slot-1, below the landscape
    ["3vw", "27vh"],                                         // 3 BigKid — far-left, lower
    ["88vw", "20vh"],                                        // 4 Blankk — far-right, below the slot-4 tile
    ["88vw", "26vh"],                                        // 5 — far-right, lower
    ["3vw", "24vh"],                                         // 6 — far-left
    ["51vw", "26vh"],                                        // 7 — right-of-centre, lower
    ["17vw", "19vh"],                                        // 8 — left-centre, high
    ["88vw", "17vh"]                                         // 9 — far-right, high
  ];

  var listEl = document.getElementById("gridList");
  var bandsEl = document.getElementById("gridBands");
  var marker = document.getElementById("gridMarker");

  /* ---- centre name list (each name morphs to/from About + focus) ---- */
  var listLis = [];
  PROJECTS.forEach(function (p, i) {
    var li = document.createElement("li");
    li.setAttribute("data-i", String(i));
    if (i === 0) li.className = "is-active";
    var wl = document.createElement("span");
    wl.className = "wl";
    wl.textContent = p.name;
    li.appendChild(wl);
    li.addEventListener("click", function () { focusProject(i, null); });
    listEl.appendChild(li);
    listLis.push(li);
  });

  /* ---- video tiles: muted + looping, never a play button ----------- */
  var thumbVids = [];
  function kick(v) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }

  function srcFromBg(el) {
    var bg = (el.style.backgroundImage || "");
    var m = bg.match(/url\(["']?(.*?)["']?\)/);   // String.match (NOT .exec — hook-safe)
    return m ? m[1] : "";
  }

  function makeThumb(media, sizeClass, projIndex) {
    var a = document.createElement("a");
    a.className = "gthumb " + sizeClass;
    a.href = "work.html";
    a.setAttribute("aria-label", PROJECTS[projIndex].name);
    if (media.type === "video") {
      a.style.backgroundImage = "url('" + media.poster + "')";
      var v = document.createElement("video");
      v.className = "gthumb__vid";
      v.muted = true; v.defaultMuted = true; v.loop = true; v.autoplay = true;
      v.setAttribute("muted", ""); v.setAttribute("autoplay", "");
      v.setAttribute("loop", ""); v.setAttribute("playsinline", "");
      v.setAttribute("preload", "auto");
      try { v.disablePictureInPicture = true; } catch (_) {}
      v.src = media.src;
      a.appendChild(v);
      thumbVids.push(v);
      kick(v);
      v.addEventListener("loadeddata", function () { kick(v); });
      v.addEventListener("canplay", function () { kick(v); });
      // ALWAYS playing + on repeat: if the browser ever pauses it (off-screen power
      // saving, Low Power Mode, etc.), resume immediately while the tab is visible;
      // and if a loop ever slips, rewind and replay.
      v.addEventListener("pause", function () { if (!document.hidden) kick(v); });
      v.addEventListener("ended", function () { try { v.currentTime = 0; } catch (_) {} kick(v); });
    } else {
      a.style.backgroundImage = "url('" + media.src + "')";
    }
    a.addEventListener("click", function (e) { e.preventDefault(); focusProject(projIndex, a); });
    return a;
  }

  /* ---- one band per project: number + thumbnails left & right ------- */
  var bandEls = [];
  PROJECTS.forEach(function (p, i) {
    var band = document.createElement("section");
    band.className = "gband";
    band.setAttribute("data-i", String(i));
    band.id = "g" + i;

    var num = document.createElement("span");
    num.className = "gband__num";
    num.textContent = (i + 1 < 10 ? "0" : "") + (i + 1);
    if (NUM_POS[i]) { num.style.left = NUM_POS[i][0]; num.style.top = NUM_POS[i][1]; }
    band.appendChild(num);

    // project NAME per band — hidden on desktop (the fixed centre list shows names
    // there); revealed on narrow screens so mobile users get titles. Opens the focus view.
    var nm = document.createElement("a");
    nm.className = "gband__name";
    nm.href = "work.html";
    nm.textContent = p.name;
    nm.addEventListener("click", function (e) { e.preventDefault(); focusProject(i, null); });
    band.appendChild(nm);

    var lay = LAYOUTS[i] || LAYOUTS[0];
    var pm = MEDIA[i] || PLACEHOLDER;   // this project's media pool (real assets, or the placeholder fallback)
    var ti = 0;   // tile order within the band → drives the reveal WAVE (CSS --ti)
    var left = document.createElement("div");
    left.className = "gband__zone gband__zone--left";
    lay.left.forEach(function (pair) {
      var t = makeThumb(pm[pair[0]] || pm[0], "gthumb--" + pair[1], i);
      t.style.setProperty("--ti", String(ti++));
      left.appendChild(t);
    });
    band.appendChild(left);

    var right = document.createElement("div");
    right.className = "gband__zone gband__zone--right";
    lay.right.forEach(function (pair) {
      var t = makeThumb(pm[pair[0]] || pm[0], "gthumb--" + pair[1], i);
      t.style.setProperty("--ti", String(ti++));
      right.appendChild(t);
    });
    band.appendChild(right);

    num.style.setProperty("--ti", String(ti + 1));   // the number lands a beat AFTER the last tile

    bandsEl.appendChild(band);
    bandEls.push(band);
  });

  /* REVEAL on load: the ref shows EVERY project's tiles on LOAD — they all rise +
     wave in together, NOT one band at a time as you scroll. So reveal ALL bands
     here (no IntersectionObserver — nothing waits for scroll); each band runs its
     own internal left→right tile wave (CSS --ti). A tiny per-band cascade lets
     them flow in top-to-bottom, but every band is revealed within ~1s of load, so
     by the time you scroll the lower projects are already fully in place. */
  function startReveal() {
    if (reduce) { bandEls.forEach(function (b) { b.classList.add("is-in"); }); return; }
    bandEls.forEach(function (b, i) {
      setTimeout(function () { b.classList.add("is-in"); }, i * 60);
    });
  }

  /* Hold the thumbnail/number reveal until AFTER the cross-document word-morph
     View Transition (ref: title + names settle on a near-empty page, THEN the
     tiles fly in). Without this the reveal plays behind the VT's frozen snapshot
     and is never seen — the tiles "just appear". On a direct load (no VT) it runs
     right away. A load fallback + failsafe guarantee it always runs. */
  var revealStarted = false, vtPending = false;
  function kickReveal() { if (revealStarted) return; revealStarted = true; startReveal(); }

  if (root.classList.contains("intro-run")) {
    /* RELOAD / first load: the counting-number loader runs (intro.js). HOLD the tile
       reveal until the loader finishes (it adds html.intro-done) so the tiles rise in
       AFTER the overlay lifts — not hidden behind it. */
    var mo = ("MutationObserver" in window) ? new MutationObserver(function () {
      if (root.classList.contains("intro-done")) { mo.disconnect(); kickReveal(); }
    }) : null;
    if (root.classList.contains("intro-done")) { kickReveal(); }
    else if (mo) { mo.observe(root, { attributes: true, attributeFilter: ["class"] }); }
    setTimeout(kickReveal, 6000); // failsafe if intro-done never arrives
  } else {
    /* NAVIGATION / direct: reveal AFTER the cross-document word-morph View Transition
       (ref: title + names settle, THEN the tiles fly in); immediately if there's no VT. */
    window.addEventListener("pagereveal", function (e) {
      if (e && e.viewTransition && e.viewTransition.finished && e.viewTransition.finished.then) {
        vtPending = true; // a VT is running → reveal AFTER it, don't let the fallback preempt
        e.viewTransition.finished.then(kickReveal, kickReveal);
      } else {
        kickReveal(); // no VT → reveal now
      }
    }, { once: true });
    // fallback (no pagereveal support): reveal after load, but only if no VT is pending
    window.addEventListener("load", function () { setTimeout(function () { if (!vtPending) kickReveal(); }, 80); });
    setTimeout(kickReveal, 2500); // ultimate failsafe (covers a VT that never settles)
  }

  /* keep the tiles playing (deferred autoplay / refocus / Low Power Mode) */
  function kickAll() { if (document.hidden) return; thumbVids.forEach(function (v) { if (v.paused) kick(v); }); }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) thumbVids.forEach(kick); });
  window.addEventListener("pageshow", function () { thumbVids.forEach(kick); });  // back/forward cache restore
  window.addEventListener("focus", kickAll);
  setInterval(kickAll, 2000);  // backstop: nothing stays paused while the tab is visible
  // Safari DEFERS muted autoplay and BLOCKS it under Low Power Mode / a per-site
  // "Never Auto-Play" setting — play() is only honoured from a USER GESTURE. Re-kick
  // on EVERY interaction, PERSISTENTLY: a first gesture that fires during load (or is
  // refused under LPM) must NOT disable the later click/tap/key that finally works.
  // kickAll only touches PAUSED tiles while the tab is visible, so this stays cheap.
  ["pointerdown", "touchstart", "keydown", "wheel"].forEach(function (ev) {
    window.addEventListener(ev, kickAll, { passive: true });
  });

  /* ---- open the FOCUS view, flying the chosen tile into the preview -- */
  function focusProject(i, el) {
    try {
      sessionStorage.setItem("focusProj", String(i));
      if (el) {
        var v = el.querySelector("video");
        sessionStorage.setItem("focusType", v ? "video" : "image");
        sessionStorage.setItem("focusSrc", v ? v.getAttribute("src") : srcFromBg(el));
      } else {
        sessionStorage.removeItem("focusType");
        sessionStorage.removeItem("focusSrc");
      }
    } catch (_) {}
    var hero = el || bandEls[i].querySelector(".gthumb");
    if (hero && !reduce) hero.style.viewTransitionName = "vt-hero"; // shared element → morphs into work.html's preview
    window.location.href = "work.html";
  }

  /* ---- scroll tracking: highlight the centred project --------------- */
  function moveMarker(i) {
    if (!marker || !listLis[i]) return;
    var li = listLis[i];
    marker.style.transform = "translateY(" + (li.offsetTop + (li.offsetHeight - marker.offsetHeight) / 2).toFixed(1) + "px)";
  }
  var activeIdx = -1;
  function setActive(i) {
    for (var k = 0; k < listLis.length; k++) listLis[k].classList.toggle("is-active", k === i);
    moveMarker(i);
  }
  function onScroll() {
    // bands TOP-align at the list line and scroll up through it: the active one is
    // the LAST whose top has reached the line (mirrors the focus view's update())
    var line = window.innerHeight * 0.5;
    var best = 0;
    for (var i = 0; i < bandEls.length; i++) {
      if (bandEls[i].getBoundingClientRect().top <= line) best = i;
    }
    // At the very bottom the LAST band's top can sit just shy of the line (its tall
    // accent eats the remaining scroll), so its arrow would be unreachable on short
    // windows. Clamp to the last project once we're at max scroll — it's always
    // selectable however the window is proportioned.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      best = bandEls.length - 1;
    }
    if (best !== activeIdx) { activeIdx = best; setActive(best); }
    for (var v = 0; v < thumbVids.length; v++) { if (thumbVids[v].paused) kick(thumbVids[v]); }
  }
  // rAF-throttle scroll: coalesce the per-event band-rect reads to once per frame
  // (same active-project result, less main-thread work). Init + resize stay direct.
  var gScrollTick = false;
  function onScrollThrottled() {
    if (gScrollTick) return;
    gScrollTick = true;
    requestAnimationFrame(function () { gScrollTick = false; onScroll(); });
  }
  window.addEventListener("scroll", onScrollThrottled, { passive: true });
  window.addEventListener("resize", function () { moveMarker(activeIdx); });

  /* active "Works," title → back to top */
  var current = document.querySelector(".topnav a.is-active");
  if (current) {
    current.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });
  }

  setActive(0);
  onScroll();
})();
