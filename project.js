/* ============================================================
   143jode — project detail page
   1. populate from ?p=<index>
   2. sliding 0->100 scroll-progress counter
   (Page transition/loader removed — links navigate instantly.)
   ============================================================ */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- project data (index matches the /work list) -------- */
  var PROJECTS = [
    {
      title: "Holidays", year: "2025—2026", category: "Self-Initiated", shot: 0,
      tags: ["Hobby", "Web Development", "Holidays"],
      headline: "Holiday Themed Websites",
      desc: "Made these websites for big holidays like Christmas, New Year's, Valentines, etc. Experimental + fun; made only if I have free time.",
      media: ["shot", "shot", "shot", "video", "shot"]
    },
    {
      title: "No Moss", year: "2025", category: "University", shot: 1,
      tags: ["Purpose Discovery", "Fullstack Development", "Nuxt 4"],
      headline: "Discovering Purpose With Technology",
      desc: "Capstone project for final year of university. Worked in a team of 5 and partnered with a company called No Moss: a purpose centric organisation who promotes purpose centric work practices such as purpose reflection and career alignment. Built a fullstack web app using Nuxt 4 to help users track their purpose and goals.",
      media: ["shot", "shot", "shot", "video", "shot", "shot"]
    },
    {
      title: "Mtech", year: "2024", category: "Club Website", shot: 2,
      tags: ["Web Development", "Branding", "Launch"],
      headline: "The Official MTech Consulting Club Site",
      desc: "Developed and launched the official website for MTech Consulting Club at The University of Melbourne.",
      media: ["shot", "shot", "video", "shot"]
    },
    {
      title: "Kora", year: "2024", category: "Startup", shot: 3,
      tags: ["AI / ML", "EdTech", "Co-Founder"],
      headline: "An AI Tutor For VCE Students",
      desc: "Co-founded a startup developing an AI model tailored for VCE. Scaled to 6,000+ users with 200 monthly active users.",
      media: ["shot", "shot", "shot", "video"]
    },
    {
      title: "Portfolio V1", year: "2025", category: "Personal", shot: 4,
      tags: ["Web Design", "Frontend", "Personal"],
      headline: "My First Portfolio Website",
      desc: "First portfolio website built in March 2025.",
      media: ["shot", "shot", "video"]
    }
  ];

  function param(name) {
    var re = new RegExp("[?&]" + name + "=([^&]+)");
    var m = window.location.search.match(re);
    return m ? decodeURIComponent(m[1]) : null;
  }
  var idx = parseInt(param("p"), 10);
  if (isNaN(idx) || idx < 0 || idx >= PROJECTS.length) idx = 0;
  var P = PROJECTS[idx];

  /* ---- populate ------------------------------------------- */
  function el(id) { return document.getElementById(id); }
  document.title = P.title + " — 143jode";
  el("projTitle").textContent = P.title;
  el("projYear").textContent = P.year;
  el("projCat").textContent = P.category;
  el("projHeadline").textContent = P.headline;
  el("projDesc").textContent = P.desc;

  var tagsEl = el("projTags");
  P.tags.forEach(function (t) {
    var li = document.createElement("li");
    li.textContent = t;
    tagsEl.appendChild(li);
  });

  // real media: a pool of stills (frames pulled from the sample clip) + the clip
  // itself. each gallery slot gets a DIFFERENT still, so a project no longer
  // repeats one screenshot; "video" slots embed the actual looping clip — so the
  // preview genuinely plays here, just like on /work.
  // only 3 stills + 1 clip across the whole site (work + project)
  var IMGS = ["media/img-1.jpg", "media/img-2.jpg", "media/img-3.jpg"];
  var VIDEO = "media/0.mp4";
  var imgCursor = idx * 3; // offset per project so each shows a different set
  function nextImg() {
    var src = IMGS[imgCursor % IMGS.length];
    imgCursor++;
    return src;
  }

  function makeMedia(kind) {
    var wrap = document.createElement("div");
    wrap.className = "proj-media" + (kind === "video" ? " proj-media--video" : "");
    var inner = document.createElement("div");
    inner.className = "proj-media__inner";
    if (kind === "video") {
      var v = document.createElement("video");
      v.className = "proj-media__vid";
      v.src = VIDEO;
      v.muted = true;
      v.loop = true;
      v.autoplay = true;
      v.setAttribute("muted", "");
      v.setAttribute("playsinline", "");
      inner.appendChild(v);
      var pr = v.play();
      if (pr && pr.catch) pr.catch(function () {});
    } else {
      inner.style.backgroundImage = "url('" + nextImg() + "')";
      inner.setAttribute("data-label", P.title);
    }
    wrap.appendChild(inner);
    return wrap;
  }
  // first media = hero, the rest = gallery
  el("projHero").appendChild(makeMedia(P.media[0] || "shot"));
  var gallery = el("projGallery");
  P.media.slice(1).forEach(function (k) { gallery.appendChild(makeMedia(k)); });

  // "(More Projects)" -> the next project's name, linking to it
  var next = (idx + 1) % PROJECTS.length;
  el("projNextName").textContent = PROJECTS[next].title;
  el("projNext").setAttribute("href", "project.html?p=" + next);

  /* ---- sliding scroll-progress counter -------------------- */
  var counterEl = el("projCounter");
  var counterN = el("counterN");
  function pad() { return parseFloat(getComputedStyle(counterEl).left) || 22; }
  var T = 0.82; // past this point the counter leaves the screen
  var gals = document.querySelectorAll(".proj-gallery .proj-media");
  var firstGal = gals[0];
  var lastGal = gals[gals.length - 1];
  function onScroll() {
    var vh = window.innerHeight;
    // progress through the IMAGE section, NOT the whole page: 0 when the first
    // image is centred, 100 at the last — so the counter starts at a LOW number
    // when it appears (instead of jumping to ~30 after the airy intro)
    var a = firstGal ? firstGal.getBoundingClientRect().top + window.scrollY : 0;
    var b = lastGal ? lastGal.getBoundingClientRect().bottom + window.scrollY : a + 1;
    var gp = b > a ? Math.min(Math.max((window.scrollY + vh * 0.5 - a) / (b - a), 0), 1) : 0;
    counterN.textContent = Math.round(gp * 100);
    var pd = pad();
    var ch = counterEl.offsetHeight;
    var ceiling = vh - ch - pd;
    var bottom, exitFade;
    if (gp <= T) {
      bottom = pd + (gp / T) * (ceiling - pd);
      exitFade = 1;
    } else {
      // ...then slide off the top and fade, leaving the footer clean
      var q = (gp - T) / (1 - T);
      bottom = ceiling + q * (vh + ch * 1.3 - ceiling);
      exitFade = Math.max(0, 1 - q * 1.15);
    }
    // fade IN only once the first image comes into view (never over the intro)
    var galTop = firstGal ? firstGal.getBoundingClientRect().top : 0;
    var fadeIn = Math.min(Math.max((vh * 0.88 - galTop) / (vh * 0.28), 0), 1);
    counterEl.style.bottom = bottom.toFixed(1) + "px";
    counterEl.style.opacity = (fadeIn * exitFade).toFixed(2);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();
})();
