/* ============================================================
   143jode — APPLY CONTENT
   Patches the static HTML from window.SITE_CONTENT so edits made
   through the inline editor show up everywhere without touching
   the page markup by hand:
   - every mailto: link (all pages)
   - about: bio, selected-works names + blurbs, status, socials
   - work: list names + each project's rail thumbnails
   grid.js / work.js read SITE_CONTENT directly for the rest.

   MUST run BEFORE work.js (it reads the thumbs' data-src to build
   the looping <video> tiles) — script order in the HTML does that.

   Also the EDIT-MODE gate: visiting any page with ?edit (or after
   unlocking once this session) loads the inline editor on top.
   ============================================================ */
(function () {
  "use strict";

  var C = window.SITE_CONTENT;
  if (!C) return;
  var all = function (sel) { return [].slice.call(document.querySelectorAll(sel)); };

  /* ---- email: every mailto link, and any visible email text ------- */
  if (C.email) {
    all('a[href^="mailto:"]').forEach(function (a) {
      a.setAttribute("href", "mailto:" + C.email);
      if (a.textContent.indexOf("@") !== -1) a.textContent = C.email;
    });
  }

  /* ---- about page ------------------------------------------------- */
  var bioEl = document.querySelector(".about-col--bio p");
  if (bioEl && C.bio) bioEl.textContent = C.bio;

  var statusEl = document.querySelector(".about-foot__status");
  if (statusEl && C.status) statusEl.textContent = C.status;

  if (C.social) {
    all(".about-social a").forEach(function (a) {
      var key = a.textContent.replace(/\W/g, "").toLowerCase();
      if (C.social[key]) a.setAttribute("href", C.social[key]);
    });
  }

  /* selected-works prose: each name span carries data-i; its blurb is
     the very next .sw-desc span */
  all(".sw[data-i]").forEach(function (sw) {
    var p = (C.projects || [])[+sw.getAttribute("data-i")];
    if (!p) return;
    sw.textContent = p.name;
    var d = sw.nextElementSibling;
    if (d && d.classList.contains("sw-desc") && p.aboutDesc) d.textContent = p.aboutDesc;
  });

  /* ---- work page: list names + rail thumbnails --------------------- */
  all("#workList li[data-i]").forEach(function (li) {
    var p = (C.projects || [])[+li.getAttribute("data-i")];
    var wl = li.querySelector(".wl");
    if (p && wl) wl.textContent = p.name;
  });

  all(".proj[data-i]").forEach(function (sec) {
    var p = (C.projects || [])[+sec.getAttribute("data-i")];
    if (!p || !p.media) return;
    var thumbs = [].slice.call(sec.querySelectorAll(".thumb"));
    thumbs.forEach(function (t, j) {
      var m = p.media[j];
      if (!m) return;
      t.setAttribute("data-src", m.src);
      t.setAttribute("data-type", m.type);
      t.classList.toggle("thumb--video", m.type === "video");
      var still = m.type === "video" ? (m.poster || "") : m.src;
      if (still) t.style.backgroundImage = "url('" + still + "')";
    });
  });

  /* ---- edit mode gate ---------------------------------------------
     ?edit on any URL (or an already-unlocked session) loads the editor.
     Visitors never download a byte of editor code. */
  function loadEditor() {
    var css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "editor.css?v=2";
    document.head.appendChild(css);
    var js = document.createElement("script");
    js.src = "editor.js?v=3";
    js.type = "module";
    document.head.appendChild(js);
  }

  var wantsEdit = false;
  try {
    wantsEdit =
      /[?&]edit/.test(location.search) ||
      sessionStorage.getItem("editorOn") === "1";
  } catch (_) {}
  if (wantsEdit) loadEditor();

  /* hidden trigger: one CLICK on "All rights reserved ®" in the
     About footer opens the editor — no special URL needed. A stray
     click just shows the password box; Cancel backs out. */
  if (!wantsEdit) {
    var rights = document.querySelector(".about-foot__rights");
    if (rights) {
      rights.style.cursor = "pointer";
      rights.addEventListener("click", function () {
        try { sessionStorage.setItem("editorOn", "1"); } catch (_) {}
        loadEditor();
      });
    }
  }
})();
