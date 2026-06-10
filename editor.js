/* ============================================================
   143jode — INLINE EDITOR
   Loaded only with ?edit (see apply-content.js). Lets the owner
   click any text or media ON the real site, change it, and
   Publish:
     1. new photos/videos upload to Vercel Blob (api/upload.js)
     2. the content is committed to GitHub as content.js
        (api/publish.js) → Vercel redeploys → live in ~1 min.

   Text edits survive page navigation within the session
   (sessionStorage); media replacements are per-page until
   published (a navigation guard warns about pending ones).

   All UI is built with createElement/textContent — never
   innerHTML — so server text can't inject markup.
   ============================================================ */
(function () {
  "use strict";

  var C = window.SITE_CONTENT;
  if (!C || window.__ED_LOADED__) return;
  window.__ED_LOADED__ = true;

  var $$ = function (sel, el) { return [].slice.call((el || document).querySelectorAll(sel)); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var draft = clone(C);
  var pending = [];          // [{ pi, mi, file, tempUrl }]
  var bindings = {};         // key -> [elements]
  var demo = false;          // true when no /api (local preview): full UX, no publish

  /* ---------- session-persisted TEXT draft ---------- */
  function textsOf(c) {
    return {
      email: c.email, bio: c.bio, status: c.status, social: clone(c.social || {}),
      projects: c.projects.map(function (p) {
        return { name: p.name, meta: p.meta, url: p.url, desc: p.desc, aboutDesc: p.aboutDesc };
      })
    };
  }
  function saveTexts() {
    try { sessionStorage.setItem("editTexts", JSON.stringify(textsOf(draft))); } catch (_) {}
  }
  function loadTexts() {
    try {
      var t = JSON.parse(sessionStorage.getItem("editTexts") || "null");
      if (!t) return;
      ["email", "bio", "status"].forEach(function (k) { if (typeof t[k] === "string") draft[k] = t[k]; });
      if (t.social) Object.keys(draft.social || {}).forEach(function (k) {
        if (typeof t.social[k] === "string") draft.social[k] = t.social[k];
      });
      (t.projects || []).forEach(function (tp, i) {
        if (!draft.projects[i]) return;
        ["name", "meta", "url", "desc", "aboutDesc"].forEach(function (k) {
          if (typeof tp[k] === "string") draft.projects[i][k] = tp[k];
        });
      });
    } catch (_) {}
  }

  function changeCount() {
    var n = pending.length;
    var t = textsOf(draft), o = textsOf(C);
    if (t.email !== o.email) n++;
    if (t.bio !== o.bio) n++;
    if (t.status !== o.status) n++;
    Object.keys(o.social || {}).forEach(function (k) { if (t.social[k] !== o.social[k]) n++; });
    o.projects.forEach(function (op, i) {
      ["name", "meta", "url", "desc", "aboutDesc"].forEach(function (k) {
        if (t.projects[i] && t.projects[i][k] !== op[k]) n++;
      });
    });
    return n;
  }

  /* ---------- URL helpers ---------- */
  function tail(u) {
    if (!u) return "";
    if (u.indexOf("blob:") === 0) return u;
    try { return new URL(u, location.href).pathname.replace(/^\//, ""); } catch (_) { return u; }
  }
  function bgUrl(node) {
    var m = (node.style.backgroundImage || "").match(/url\(["']?(.*?)["']?\)/);
    return m ? m[1] : "";
  }

  /* ---------- text bindings: key -> all DOM instances ---------- */
  function bind(key, node) {
    (bindings[key] = bindings[key] || []).push(node);
    node.classList.add("ed-text");
    node.setAttribute("data-ed-key", key);
  }
  function valueOf(key) {
    var p = key.split(":");
    if (p[0] === "bio") return draft.bio;
    if (p[0] === "status") return draft.status;
    return draft.projects[+p[1]] ? draft.projects[+p[1]][p[0]] : "";
  }
  function commitValue(key, v) {
    var p = key.split(":");
    if (p[0] === "bio") draft.bio = v;
    else if (p[0] === "status") draft.status = v;
    else if (draft.projects[+p[1]]) draft.projects[+p[1]][p[0]] = v;
    (bindings[key] || []).forEach(function (node) { node.textContent = v; });
    saveTexts();
    updateBar();
  }

  function registerTextTargets() {
    $$("#gridList li[data-i] .wl").forEach(function (node) {
      bind("name:" + node.parentElement.getAttribute("data-i"), node);
    });
    $$("#workList li[data-i] .wl").forEach(function (node) {
      bind("name:" + node.parentElement.getAttribute("data-i"), node);
    });
    $$(".gband[data-i] .gband__name").forEach(function (node) {
      bind("name:" + node.closest(".gband").getAttribute("data-i"), node);
    });
    $$(".sw[data-i]").forEach(function (node) {
      bind("name:" + node.getAttribute("data-i"), node);
      var d = node.nextElementSibling;
      if (d && d.classList.contains("sw-desc")) bind("aboutDesc:" + node.getAttribute("data-i"), d);
    });
    var bio = document.querySelector(".about-col--bio p");
    if (bio) bind("bio", bio);
    var st = document.querySelector(".about-foot__status");
    if (st) bind("status", st);
    var fd = document.getElementById("focusDesc");
    if (fd) { fd.classList.add("ed-text"); fd.setAttribute("data-ed-key", "meta:active"); }

    /* links edited via a small dialog (not contentEditable) */
    $$('a[href^="mailto:"]').forEach(function (a) { a.classList.add("ed-link"); a.setAttribute("data-ed-link", "email"); });
    $$(".about-social a").forEach(function (a) {
      a.classList.add("ed-link");
      a.setAttribute("data-ed-link", "social:" + a.textContent.replace(/\W/g, "").toLowerCase());
    });
    var visit = document.getElementById("focusVisit");
    if (visit) { visit.classList.add("ed-link"); visit.setAttribute("data-ed-link", "url:active"); }
  }

  /* apply any session-draft text differences to the page */
  function applyDraftTexts() {
    Object.keys(bindings).forEach(function (key) {
      var v = valueOf(key);
      (bindings[key] || []).forEach(function (node) {
        if (node.textContent !== v) node.textContent = v;
      });
    });
    if (draft.email !== C.email) {
      $$('a[href^="mailto:"]').forEach(function (a) {
        a.setAttribute("href", "mailto:" + draft.email);
        if (a.textContent.indexOf("@") !== -1) a.textContent = draft.email;
      });
    }
  }

  /* ---------- media targets ---------- */
  function findMedia(pi, src) {
    var media = (draft.projects[pi] || {}).media || [];
    for (var i = 0; i < media.length; i++) {
      if (tail(media[i].src) === tail(src)) return i;
    }
    return -1;
  }
  function tagMedia() {
    $$(".gband[data-i] .gthumb").forEach(function (tile) {
      var pi = +tile.closest(".gband").getAttribute("data-i");
      var vid = tile.querySelector("video");
      var mi = findMedia(pi, vid ? vid.getAttribute("src") : bgUrl(tile));
      if (mi < 0) return;
      tile.classList.add("ed-media");
      tile.setAttribute("data-ed-pi", pi);
      tile.setAttribute("data-ed-mi", mi);
      tile.title = vid ? "Click to replace this video" : "Click to replace this image";
    });
    $$(".proj[data-i] .thumb").forEach(function (tile) {
      var pi = +tile.closest(".proj").getAttribute("data-i");
      var mi = findMedia(pi, tile.getAttribute("data-src"));
      if (mi < 0) return;
      tile.classList.add("ed-media");
      tile.setAttribute("data-ed-pi", pi);
      tile.setAttribute("data-ed-mi", mi);
      tile.title = tile.getAttribute("data-type") === "video" ? "Click to replace this video" : "Click to replace this image";
    });
  }

  function refreshMediaDom(pi, mi) {
    var m = draft.projects[pi].media[mi];
    $$('[data-ed-pi="' + pi + '"][data-ed-mi="' + mi + '"]').forEach(function (tile) {
      var vid = tile.querySelector("video");
      if (m.type === "video") {
        if (vid) {
          vid.setAttribute("src", m.src);
          vid.load();
          var pr = vid.play();
          if (pr && pr.catch) pr.catch(function () {});
        }
        if (tile.hasAttribute("data-src")) tile.setAttribute("data-src", m.src);
        if (m.poster) tile.style.backgroundImage = "url('" + m.poster + "')";
      } else {
        tile.style.backgroundImage = "url('" + m.src + "')";
        if (tile.hasAttribute("data-src")) tile.setAttribute("data-src", m.src);
      }
    });
  }

  function replaceMedia(pi, mi) {
    var m = draft.projects[pi].media[mi];
    var input = document.createElement("input");
    input.type = "file";
    input.accept = m.type === "video" ? "video/mp4,video/webm,video/quicktime" : "image/*";
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var tempUrl = URL.createObjectURL(file);
      var oldSrc = m.src;
      m.src = tempUrl;
      /* keep video posters in sync when their still image is replaced */
      draft.projects[pi].media.forEach(function (mm) {
        if (mm.poster && tail(mm.poster) === tail(oldSrc)) mm.poster = tempUrl;
      });
      pending.push({ pi: pi, mi: mi, file: file, tempUrl: tempUrl });
      refreshMediaDom(pi, mi);
      updateBar();
    };
    input.click();
  }

  /* ---------- inline text editing ---------- */
  var editingEl = null, editingOld = "";
  function startEdit(node) {
    if (editingEl === node) return;
    stopEdit(true);
    editingEl = node;
    editingOld = node.textContent;
    node.classList.add("ed-editing");
    node.setAttribute("contenteditable", "plaintext-only");
    node.focus();
    try { document.execCommand("selectAll", false, null); } catch (_) {}
  }
  function stopEdit(commit) {
    if (!editingEl) return;
    var node = editingEl, key = node.getAttribute("data-ed-key");
    editingEl = null;
    node.classList.remove("ed-editing");
    node.removeAttribute("contenteditable");
    var v = node.textContent.replace(/\n+/g, " ");
    if (!commit || v === editingOld) { node.textContent = editingOld; return; }
    if (key === "meta:active") {
      var li = document.querySelector("#workList li.is-active");
      var i = li ? +li.getAttribute("data-i") : 0;
      draft.projects[i].meta = v;
      node.textContent = v;
      saveTexts(); updateBar();
    } else if (key) {
      commitValue(key, v);
    }
  }
  document.addEventListener("focusout", function (e) {
    if (editingEl && e.target === editingEl) stopEdit(true);
  });
  document.addEventListener("keydown", function (e) {
    if (!editingEl) return;
    if (e.key === "Enter") { e.preventDefault(); stopEdit(true); }
    if (e.key === "Escape") { e.preventDefault(); stopEdit(false); }
  });

  /* ---------- dialogs (safe DOM building, no innerHTML) ---------- */
  function dialog(opts) {
    return new Promise(function (resolve) {
      var ov = el("div", "ed-overlay");
      var panel = el("div", "ed-panel");
      panel.appendChild(el("h2", null, opts.title));
      panel.appendChild(el("p", null, opts.intro || ""));
      var input = el("input", "ed-input");
      input.value = opts.value || "";
      input.type = opts.password ? "password" : "text";
      input.placeholder = opts.placeholder || "";
      panel.appendChild(input);
      panel.appendChild(el("div", "ed-err", opts.error || ""));
      var row = el("div", "ed-panel__row");
      var cancel = el("button", "ed-btn ed-btn--ghost", "Cancel");
      var ok = el("button", "ed-btn", opts.ok || "OK");
      row.appendChild(cancel);
      row.appendChild(ok);
      panel.appendChild(row);
      ov.appendChild(panel);
      function close(v) { ov.remove(); resolve(v); }
      ok.onclick = function () { close(input.value); };
      cancel.onclick = function () { close(null); };
      input.onkeydown = function (e) {
        if (e.key === "Enter") close(input.value);
        if (e.key === "Escape") close(null);
        e.stopPropagation();
      };
      document.body.appendChild(ov);
      input.focus();
    });
  }

  function editLink(kind) {
    var p = kind.split(":");
    if (p[0] === "email") {
      dialog({ title: "Contact email", intro: "Used by every Contact link on the site.", value: draft.email }).then(function (v) {
        if (v == null || v.indexOf("@") === -1) return;
        draft.email = v.trim();
        $$('a[href^="mailto:"]').forEach(function (a) {
          a.setAttribute("href", "mailto:" + draft.email);
          if (a.textContent.indexOf("@") !== -1) a.textContent = draft.email;
        });
        saveTexts(); updateBar();
      });
    } else if (p[0] === "social") {
      dialog({ title: p[1] + " link", intro: "Full address, starting with https://", value: draft.social[p[1]] || "" }).then(function (v) {
        if (v == null) return;
        draft.social[p[1]] = v.trim();
        $$(".about-social a").forEach(function (a) {
          if (a.textContent.replace(/\W/g, "").toLowerCase() === p[1]) a.setAttribute("href", draft.social[p[1]]);
        });
        saveTexts(); updateBar();
      });
    } else if (p[0] === "url") {
      var li = document.querySelector("#workList li.is-active");
      var i = li ? +li.getAttribute("data-i") : 0;
      dialog({
        title: "“Visit site” link — " + draft.projects[i].name,
        intro: "Where the Visit site button sends people for this project. Use # for nowhere.",
        value: draft.projects[i].url || "#"
      }).then(function (v) {
        if (v == null) return;
        draft.projects[i].url = v.trim() || "#";
        var visit = document.getElementById("focusVisit");
        if (visit) visit.setAttribute("href", draft.projects[i].url);
        saveTexts(); updateBar();
      });
    }
  }

  /* ---------- intercept clicks while editing ---------- */
  document.addEventListener("click", function (e) {
    if (editingEl && (editingEl === e.target || editingEl.contains(e.target))) return;
    var media = e.target.closest && e.target.closest(".ed-media");
    if (media) {
      e.preventDefault(); e.stopPropagation();
      replaceMedia(+media.getAttribute("data-ed-pi"), +media.getAttribute("data-ed-mi"));
      return;
    }
    var txt = e.target.closest && e.target.closest(".ed-text");
    if (txt) {
      e.preventDefault(); e.stopPropagation();
      startEdit(txt);
      return;
    }
    var link = e.target.closest && e.target.closest(".ed-link");
    if (link) {
      e.preventDefault(); e.stopPropagation();
      editLink(link.getAttribute("data-ed-link"));
      return;
    }
    /* clicking elsewhere commits any open edit; normal links (nav) still work */
    stopEdit(true);
  }, true);

  /* ---------- bottom bar ---------- */
  var bar, barMsg, barStrong, barRest, btnPublish, btnExit, dot;
  function buildBar() {
    bar = el("div", "ed-bar");
    dot = el("span", "ed-dot");
    dot.style.display = "none";
    barMsg = el("span", "ed-bar__msg");
    barStrong = el("b");
    barRest = document.createTextNode("");
    barMsg.appendChild(barStrong);
    barMsg.appendChild(barRest);
    btnPublish = el("button", "ed-btn", "Publish");
    btnPublish.onclick = publish;
    btnExit = el("button", "ed-btn ed-btn--ghost", "Exit");
    btnExit.onclick = exitEdit;
    bar.appendChild(dot);
    bar.appendChild(barMsg);
    bar.appendChild(btnPublish);
    bar.appendChild(btnExit);
    document.body.appendChild(bar);
    updateBar();
  }
  function setMsg(strong, rest) {
    barStrong.textContent = strong;
    barRest.textContent = rest;
  }
  function updateBar(strong, rest) {
    if (!bar) return;
    var n = changeCount();
    btnPublish.disabled = n === 0 || demo;
    if (strong != null) { setMsg(strong, rest || ""); return; }
    if (demo) setMsg("Preview editing", " — publishing only works on the live site");
    else if (n === 0) setMsg("Editing", " — click any text or image to change it");
    else setMsg(n + " change" + (n > 1 ? "s" : ""), " ready to publish");
  }

  function exitEdit() {
    try {
      sessionStorage.removeItem("editorOn");
      sessionStorage.removeItem("editKey");
      sessionStorage.removeItem("editTexts");
    } catch (_) {}
    var u = new URL(location.href);
    u.searchParams.delete("edit");
    location.replace(u.pathname + u.search + u.hash);
  }

  window.addEventListener("beforeunload", function (e) {
    if (pending.length > 0) e.preventDefault();
  });

  /* ---------- publish ---------- */
  function api(body) {
    return fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  async function publish() {
    var key = sessionStorage.getItem("editKey") || "";
    btnPublish.disabled = true;
    btnExit.disabled = true;
    dot.style.display = "";
    try {
      /* 1 — upload any new media to Vercel Blob (direct from the browser) */
      if (pending.length) {
        var mod = await import("https://esm.sh/@vercel/blob/client");
        for (var i = 0; i < pending.length; i++) {
          var p = pending[i];
          updateBar("Uploading " + (i + 1) + " of " + pending.length + "…", "");
          var safe = (p.file.name || "upload").replace(/[^\w.\-]+/g, "-").slice(-60);
          var blob = await mod.upload("media-uploads/" + safe, p.file, {
            access: "public",
            handleUploadUrl: "/api/upload",
            clientPayload: JSON.stringify({ password: key })
          });
          /* swap the temporary preview URL for the real one everywhere */
          draft.projects.forEach(function (proj) {
            (proj.media || []).forEach(function (m) {
              if (m.src === p.tempUrl) m.src = blob.url;
              if (m.poster === p.tempUrl) m.poster = blob.url;
            });
          });
        }
      }
      /* 2 — commit the content file to GitHub → Vercel redeploys */
      updateBar("Saving…", "");
      var res = await api({ password: key, content: draft });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || "Save failed");
      pending = [];
      window.SITE_CONTENT = clone(draft);
      C = window.SITE_CONTENT;
      try { sessionStorage.removeItem("editTexts"); } catch (_) {}
      dot.style.display = "none";
      updateBar("✓ Published!", " Live for everyone in about a minute.");
      setTimeout(function () { updateBar(); }, 6000);
    } catch (err) {
      dot.style.display = "none";
      updateBar("⚠ Couldn't publish", " — " + (err && err.message ? err.message : "something went wrong") + ". Please try again.");
    } finally {
      btnPublish.disabled = changeCount() === 0;
      btnExit.disabled = false;
    }
  }

  /* ---------- auth gate, then boot ---------- */
  async function verify(pw) {
    try {
      var r = await api({ action: "verify", password: pw });
      /* static-only host (local preview): no API at all → demo mode */
      if (r.status === 404 || r.status === 405 || r.status === 501) return "demo";
      return r.ok;
    } catch (_) {
      return "demo";
    }
  }

  async function boot() {
    var key = sessionStorage.getItem("editKey");
    if (key) {
      var ok = await verify(key);
      if (ok === "demo") demo = true;
      if (ok === false) { sessionStorage.removeItem("editKey"); key = null; }
    }
    if (!key) {
      var error = "";
      for (;;) {
        var pw = await dialog({
          title: "Edit your website",
          intro: "Enter your editing password. You'll then be able to click any text or image on the site to change it.",
          password: true,
          ok: "Start editing",
          error: error
        });
        if (pw == null) { exitEdit(); return; }
        var v = await verify(pw);
        if (v === "demo") { demo = true; key = pw; break; }
        if (v) { key = pw; break; }
        error = "That password isn't right — try again.";
      }
      try {
        sessionStorage.setItem("editKey", key);
        sessionStorage.setItem("editorOn", "1");
      } catch (_) {}
    }

    loadTexts();
    registerTextTargets();
    applyDraftTexts();
    tagMedia();
    buildBar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { boot(); });
  } else {
    boot();
  }
})();
