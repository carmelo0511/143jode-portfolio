/* ============================================================
   143jode — /about
   - flips the no-js gate
   - NAVIGATION ENTRANCE: on a cross-document nav INTO /about there's no intro
     loader, so the <head> gate set html.enter (prose + columns held hidden). Here
     we fade them in with a top-to-bottom STAGGER once the word-morph View
     Transition has FINISHED (pagereveal → viewTransition.finished) — matching the
     ref's "section load" reveal. The morphing NAMES (.sw) are left to the VT.
   ============================================================ */
(function () {
  "use strict";
  var r = document.documentElement;
  r.classList.remove("no-js");
  r.classList.add("js");

  if (!r.classList.contains("enter")) return; // intro load / reduced-motion → nothing staged

  /* per-line stagger for the Selected-Works prose (top → bottom), as a CSS var the
     entrance rule reads via transition-delay: var(--rd). Set right before reveal. */
  function setStagger() {
    var nums = document.querySelectorAll(".about-works .sw-num");
    var descs = document.querySelectorAll(".about-works .sw-desc");
    var i;
    for (i = 0; i < nums.length; i++) nums[i].style.setProperty("--rd", (0.12 + i * 0.09).toFixed(3) + "s");
    for (i = 0; i < descs.length; i++) descs[i].style.setProperty("--rd", (0.12 + i * 0.09).toFixed(3) + "s");
  }

  var done = false, vtPending = false;
  function reveal() {
    if (done) return;
    done = true;
    setStagger();
    r.classList.add("entered");
  }

  /* Play the stagger AFTER the cross-document View Transition's word morph. The
     pagereveal event hands us the live viewTransition; wait for it to finish. If
     there's no VT (direct load / engine without pagereveal), reveal right away. */
  window.addEventListener("pagereveal", function (e) {
    if (e && e.viewTransition && e.viewTransition.finished && e.viewTransition.finished.then) {
      vtPending = true; // reveal AFTER the morph — don't let the fallback preempt it
      e.viewTransition.finished.then(reveal, reveal);
    } else {
      requestAnimationFrame(reveal);
    }
  }, { once: true });

  /* Fallback (no pagereveal support): reveal after load, but only if no VT is
     pending, so the content is never stuck hidden and the morph isn't cut short. */
  window.addEventListener("load", function () { setTimeout(function () { if (!vtPending) reveal(); }, 80); });
  setTimeout(reveal, 2500); // ultimate failsafe (the <head> gate also has one)
})();
