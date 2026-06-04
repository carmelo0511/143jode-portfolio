/* ============================================================
   lokasasmita — intro preloader
   The number counts 0→100 while CLIMBING from the bottom-left up
   toward the top, and a thin bar on the RIGHT edge fills UPWARD in
   sync — one eased progress `p` drives the digits, the climb, AND
   the bar. At 100 the right bar DRAINS up and off the top (smooth,
   pinned at the top — not a snap), then the overlay CROSSFADES out
   and the page settles up into place. Runs only when the <head>
   gate added html.intro-run (first load of the session + reloads);
   internal navigations skip it and keep their View Transition.
   Reference: gregorylalle.com
   ============================================================ */
(function () {
  "use strict";

  var root = document.documentElement;
  if (!root.classList.contains("intro-run")) return; // not shown this load

  var intro = document.getElementById("intro");
  var count = document.getElementById("introCount");
  var bar = document.getElementById("introBar");
  if (!intro || !count) { root.classList.remove("intro-run"); return; }

  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var ended = false;
  function drop() { if (intro.parentNode) intro.parentNode.removeChild(intro); }

  /* split the ACTIVE title into per-letter clip-masks and roll each letter up
     from below its mask (staggered L→R) — the "letters rolling up" reveal from
     the ref. Only the big active title; only on an intro load (internal navs
     keep the cross-document title morph, which snapshots the whole <a>). */
  function rollTitle() {
    var title = document.querySelector(".topnav a.is-active");
    if (!title || title.querySelector(".ttl-mask")) return; // none, or already split
    var text = title.textContent;
    title.textContent = "";
    for (var i = 0; i < text.length; i++) {
      var mask = document.createElement("span");
      mask.className = "ttl-mask";
      var inner = document.createElement("span");
      inner.className = "ttl-i";
      inner.style.animation = "ttl-rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) " + (i * 0.045).toFixed(3) + "s both";
      inner.textContent = text.charAt(i) === " " ? " " : text.charAt(i);
      mask.appendChild(inner);
      title.appendChild(mask);
    }
  }

  /* ON /about, replay the work→about word morph as the reload ENTRANCE: start the
     Selected-Works names as a vertical COLUMN up-left (≈ where the /work list
     sits) and FLY each to its inline slot — a MEASURED FLIP (so the column→
     paragraph move matches the real cross-document morph, not a fixed scatter),
     staggered + fading in. No-op off /about (no .about-works on the page). */
  function assembleNames() {
    var wrap = document.querySelector(".about-works");
    if (!wrap) return;
    var names = [].slice.call(wrap.querySelectorAll(".sw"));
    if (!names.length) return;
    var rects = names.map(function (s) { return s.getBoundingClientRect(); }); // FIRST: inline slots
    var wr = wrap.getBoundingClientRect();
    // each name starts shifted LEFT to a common x but stays on its OWN line (NO
    // vertical move), then SLIDES RIGHT into its slot — "the words slide to the
    // right on the same height, one by one" (ref). Horizontal only; well staggered;
    // unhurried (the ref is a touch slower than our old pass).
    var listX = wr.left - 140;
    names.forEach(function (s, i) {            // INVERT: shift left, SAME height
      var r = rects[i];
      s.style.transition = "none";
      s.style.opacity = "0";
      s.style.transform = "translateX(" + (listX - r.left).toFixed(1) + "px)";
    });
    void wrap.offsetWidth;                     // commit the start state before animating
    names.forEach(function (s, i) {            // PLAY → slide RIGHT to the slot, one by one
      var d = (i * 0.13).toFixed(3);
      s.style.transition = "transform 1.25s cubic-bezier(0.33, 1, 0.68, 1) " + d + "s, opacity 0.6s ease " + d + "s";
      s.style.opacity = "1";
      s.style.transform = "translateX(0)";
    });
  }

  /* the reveal: drain the bar up, then crossfade the overlay + settle the page */
  function reveal() {
    if (ended) return;
    ended = true;
    clearTimeout(bail);

    // 1) the right bar DRAINS up and off the top — smooth, not a snap. Re-pinning
    //    the origin to the TOP empties the fill from the bottom UPWARD (the way the
    //    reference does it); a gentle easeOut so it glides instead of teleporting.
    if (bar) {
      bar.style.transformOrigin = "50% 0%";
      if (!reduce) bar.style.transition = "transform 0.62s cubic-bezier(0.33, 1, 0.68, 1)";
      bar.style.transform = "scaleY(0)";
    }

    // 2) a beat later — so the bar empties against the WHITE first, like the ref,
    //    not over the revealed page — crossfade the overlay away + settle the page
    var startReveal = function () {
      if (!reduce) { rollTitle(); assembleNames(); }  // title letters roll up + names fly in (morph)
      intro.classList.add("is-out");      // overlay opacity → 0
      root.classList.add("intro-done");   // page content settles up
      intro.addEventListener("transitionend", function (e) {
        // end ONLY on the overlay's own opacity transition (the bar's transform
        // transition also bubbles up to .intro — ignore it)
        if (e.target === intro && e.propertyName === "opacity") drop();
      });
    };
    if (reduce) startReveal();
    else setTimeout(startReveal, 240);

    setTimeout(drop, 1800); // failsafe if the opacity transitionend is missed
  }

  // hard failsafe — never trap the page behind the overlay
  var bail = setTimeout(reveal, 5000);

  var DURATION = reduce ? 600 : 1900;
  var bottomPad = parseFloat(getComputedStyle(count).bottom) || 18;
  var topPad = bottomPad + 6;
  // how far the number rises: from its bottom anchor up to ~topPad from the top
  var travel = reduce ? 0 : Math.max(0, window.innerHeight - count.offsetHeight - bottomPad - topPad);

  // ease-out: a quick dash off 0, then settle slow — matches the reference,
  // which hits ~55 in the first third and then crawls to 100.
  function ease(t) { return 1 - Math.pow(1 - t, 2.2); }

  var start = null;
  function frame(now) {
    if (start === null) start = now;
    var t = Math.min((now - start) / DURATION, 1);
    var p = ease(t);
    count.textContent = Math.round(p * 100);
    if (travel) count.style.transform = "translateY(" + (-p * travel).toFixed(1) + "px)";
    if (bar) bar.style.transform = "scaleY(" + p.toFixed(4) + ")"; // right bar fills upward
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      count.textContent = "100";
      if (bar) bar.style.transform = "scaleY(1)";
      setTimeout(reveal, reduce ? 140 : 300); // brief hold on 100, then reveal
    }
  }
  requestAnimationFrame(frame);
})();
