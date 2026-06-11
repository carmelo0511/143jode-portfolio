/* ============================================================
   143jode — 3D LOGO
   Renders the client's 3D logo mark (media/logo-143.glb) with a
   studio look: dark polished metal under a generated room
   environment (soft HDRI-style reflections), ACES tone mapping,
   and a restrained animation — a slow idle coin-spin (~35s per
   turn) and a subtle pointer-follow tilt. Deliberately quiet: a
   refined mark, not a spinning attention magnet.

   HOVER = SWORD CUT: the model is rendered twice with opposite
   diagonal clipping planes, so it exists as two halves that
   normally sit flush. Hovering the mark slides the halves apart
   ALONG the cut line (a katana slice: fast strike, slow rejoin).
   Sliding parallel to a clipping plane keeps every point's
   distance to the plane constant, so the cut edge stays perfect
   while the pieces move.

   PAGE CHANGE = CHARACTER FLIGHT: the outgoing page saves the
   mark's screen rect + spin angle + last frame; the incoming page
   parks the live canvas in a fixed-position "flight proxy" at the
   OLD spot and spring-animates it to its new home — anticipation
   pull-back, dash, overshoot, settle — with squash & stretch along
   the direction of travel (the Pixar recipe). The 3D spin keeps
   running mid-flight and resumes at the exact saved angle, so it
   reads as one living object hopping across pages.

   Mount points: <span id="logo3d" class="logo3d"> (index + work
   headers, about's bio heading).
   Fallbacks: no WebGL / load error → inline SVG logo; reduced
   motion → a single static 3/4 pose, no flight, re-rendered only
   on resize.
   ============================================================ */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const mount = document.getElementById("logo3d");
if (mount) init(mount);

function svgFallback(el) {
  const img = document.createElement("img");
  img.src = "media/logo-143.svg";
  img.alt = "";
  el.appendChild(img);
  el.classList.add("is-on");
}

function init(el) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
      preserveDrawingBuffer: true, // keeps the last frame readable for the page-change snapshot
    });
  } catch (_) {
    svgFallback(el);
    return;
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true; // the sword cut is two clip planes
  el.appendChild(renderer.domElement);

  /* ---- page-change continuity --------------------------------
     Read the baton the previous page left (rect + angle + frame).
     Only trust it if the hop was quick — a stale rect from minutes
     ago shouldn't launch a flight. */
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem("logoState") || "null"); } catch (_) {}
  if (saved && (typeof saved.t !== "number" || Date.now() - saved.t > 30000)) saved = null;

  let snapImg = null;
  if (saved && saved.img) {
    snapImg = document.createElement("img");
    snapImg.src = saved.img;
    snapImg.className = "logo3d__snap";
    snapImg.alt = "";
    el.appendChild(snapImg);
    el.classList.add("is-on"); // visible from the very first frame
  }

  /* ---- the flight proxy --------------------------------------
     A fixed-position div at body level (so no header/column can
     clip or hide it) that carries the canvas during the hop. */
  let flight = null;
  if (!reduced && saved && saved.rect && saved.rect.w > 4) {
    const proxy = document.createElement("div");
    proxy.className = "logo3d-flight";
    const r = saved.rect;
    // park at the OLD spot from the very first paint (it sits exactly
    // under the old page's fading snapshot — seamless)
    proxy.style.left = r.x + "px";
    proxy.style.top = r.y + "px";
    proxy.style.width = r.w + "px";
    proxy.style.height = r.h + "px";
    document.body.appendChild(proxy);
    proxy.appendChild(renderer.domElement);
    if (snapImg) proxy.appendChild(snapImg);
    flight = {
      proxy,
      // spring state: centre x/y + size, starting at the OLD spot…
      cx: r.x + r.w / 2, cy: r.y + r.h / 2, w: r.w,
      // …with an initial kick AWAY from the target = anticipation
      vx: 0, vy: 0, vw: 0,
      kicked: false,
      landT: 0,
      /* HOLD before the hop: the cross-document View Transition
         crossfades the whole page for ~0.3s — anything the logo does
         under it is invisible. Wait it out at the old spot (reads as
         a beat of anticipation), THEN make the move where everyone
         can see it. pagereveal lets us sync to the real transition. */
      holdUntil: performance.now() + 600,
    };
    addEventListener("pagereveal", (e) => {
      if (!flight) return;
      if (e.viewTransition) {
        e.viewTransition.finished.then(() => {
          if (flight) flight.holdUntil = Math.min(flight.holdUntil, performance.now() + 120);
        });
      } else {
        flight.holdUntil = Math.min(flight.holdUntil, performance.now() + 250);
      }
    }, { once: true });
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 3.4);

  /* studio: a generated room env gives the metal its soft white
     reflections; one key + one rim light add directional sparkle */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(2.5, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.9);
  rim.position.set(-3, -1.5, -2.5);
  scene.add(rim);

  const baseMat = new THREE.MeshPhysicalMaterial({
    color: 0x161616, // near the site's --ink
    metalness: 0.92,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.22,
    envMapIntensity: 1.15,
    side: THREE.DoubleSide, // the open cross-section shows the inside
  });

  /* ---- the cut: a diagonal slash through the centre ----------
     BLADE is the cut-line direction (the slash), CUTN its normal.
     Half A keeps CUTN·p > 0 (upper side), half B the opposite.
     The planes are WORLD-space and never move; the halves only
     ever translate parallel to the cut, so the edge stays exact. */
  const slash = -0.6; // ~-34°, upper-left → lower-right
  const BLADE = new THREE.Vector3(Math.cos(slash), Math.sin(slash), 0);
  const CUTN = new THREE.Vector3(-Math.sin(slash), Math.cos(slash), 0);
  const matA = baseMat.clone();
  matA.clippingPlanes = [new THREE.Plane(CUTN.clone(), 0)];
  const matB = baseMat.clone();
  matB.clippingPlanes = [new THREE.Plane(CUTN.clone().negate(), 0)];

  /* two pivots, rotated in lockstep — they read as ONE mark until
     the hover slides them apart */
  const pivots = [new THREE.Group(), new THREE.Group()];
  pivots.forEach((p) => scene.add(p));

  /* ---- the swordsman ------------------------------------------
     A tiny original pixel-art nod to a certain green-haired,
     three-sword stylist: on hover he dashes along the cut diagonal,
     and the mark splits in his wake (the cut waits for him to pass
     centre). Two frames: mid-lunge with the blade out, then a
     standing beat before he fades. Drawn from a pixel map — no
     external image, ~1KB of strings. */
  const ZPAL = {
    k: "#1a1d22", // outline / dark detail / closed-eye slit
    h: "#4cc173", // hair bright green
    H: "#2f8551", // hair shadow
    s: "#dba56c", // tan skin
    S: "#b97f4a", // skin shadow
    r: "#9c5b3e", // eye scar
    e: "#e0bd4a", // earrings
    t: "#f4f4f0", // shirt white
    T: "#d6d6cd", // shirt shadow
    G: "#3f9655", // haramaki green
    F: "#2f7340", // haramaki shadow
    p: "#2b2e35", // pants charcoal
    P: "#1d2026", // pants shadow
    R: "#c03a2e", // hilt red accent
    w: "#aab8c4", // blade
    W: "#dfe7ee", // blade glint
    g: "#4a4f57", // hilt
    b: "#15181c", // boots
    // — Goku (Super Saiyan) —
    y: "#cdd3da", // Ultra Instinct silver hair
    Y: "#99a2ae", // silver hair shadow
    o: "#f08c1e", // orange gi
    O: "#c96d12", // gi shadow
    u: "#2b4fd0", // blue belt / boots / wristbands
    B: "#6ec3ff", // ki / beam blue
  };
  /* four frames matched to the client's second reference (original
     art, not copied pixels): spiky green hair, tan skin, open-collar
     white shirt, green haramaki, charcoal pants, red-accented hilts.
     One scar-closed eye. The cut still lands ON the sheathing. */
  const Z_RUN1 = [
    ".....k.kkk.k................",
    "....kkhhhhkkk...............",
    "....khhhhhhhk...............",
    "...khhhhhhhhhk..............",
    "...kHhhhhhhhhk..............",
    "...kHshhhhhssk..............",
    "...kHsssssssrsk.............",
    "...kHsesssssksk.............",
    "....kSSsssskwwwwwW..........",
    "...kktttstkkkssgkwwwwwwwwW..",
    "..kttttsttttkssk............",
    "..kGGGGGGGGk................",
    "..kpppppkkpppk..............",
    ".kppPk....kpppk.............",
    ".kpk........kppk............",
    "kbbk.........kbbk...........",
    "kbk...........kbbk..........",
    "............................",
    "............................",
  ];
  const Z_RUN2 = [
    ".....k.kkk.k................",
    "....kkhhhhkkk...............",
    "....khhhhhhhk...............",
    "...khhhhhhhhhk..............",
    "...kHhhhhhhhhk..............",
    "...kHshhhhhssk..............",
    "...kHsssssssrsk.............",
    "...kHsesssssksk.............",
    "....kSSsssskwwwwwW..........",
    "...kktttstkkkssgkwwwwwwwwW..",
    "..kttttsttttkssk............",
    "..kGGGGGGGGk................",
    "..kppppppppk................",
    "...kppPpppk.................",
    "....kppbbk..................",
    "....kbbbk...................",
    ".....kbk....................",
    "............................",
    "............................",
  ];
  const Z_FOLLOW = [
    "...k.kkk.k.................",
    "..kkhhhhkkk................",
    "..khhhhhhhk................",
    ".khhhhhhhhhk...............",
    ".kHhhhhhhhhk...............",
    ".kHshhhhhssk...............",
    ".kHsssssssrsk..............",
    ".kHsesssssksk..............",
    ".kHseSsssrskwwwwwwW........",
    "..kSsssssk.................",
    "..ktttssttkkkssgkwwwwwwwwW.",
    ".kttttstttttkssk...........",
    ".kttTttttTtkgwwwwwW........",
    ".kGGGGGGGGk................",
    ".kGGFGGFGGk................",
    ".kpppppppk.................",
    "..kpppppk..................",
    "..kpk.kpk..................",
    "..kPk.kPk..................",
    "..kbk.kbk..................",
    ".kkbkkkbkk.................",
  ];
  const Z_SHEATH = [
    "...k.kkk.k.......",
    "..kkhhhhkkk......",
    "..khhhhhhhk......",
    ".khhhhhhhhhk.....",
    ".kHhhhhhhhhk.....",
    ".kHshhhhhssk.....",
    ".kHsssssssrsk....",
    ".kHsesssssksk....",
    ".kHseSsssrsk.....",
    "..kSsssssk.......",
    "..ktttssttk......",
    ".kttttstttttk....",
    ".kttTttttTttk....",
    ".kGGGGGGGGk......",
    ".kGGFGGFGGkkk....",
    ".kpppppppkttk....",
    "..kpppppkRRk.....",
    "..kpk..kpkggk....",
    "..kPk..kPk.......",
    "..kbk..kbk.......",
    ".kkbkkkkbkk......",
  ];
  function zSprite(map) {
    const cv = document.createElement("canvas");
    cv.width = map[0].length;
    cv.height = map.length;
    const ctx = cv.getContext("2d");
    map.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = ZPAL[row[x]];
        if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
      }
    });
    return cv;
  }
  const zFrames = [Z_RUN1, Z_RUN2, Z_FOLLOW, Z_SHEATH].map(zSprite);
  const zMaps = [Z_RUN1, Z_RUN2, Z_FOLLOW, Z_SHEATH];
  const zoro = document.createElement("div");
  zoro.className = "logo3d__zoro";
  zFrames.forEach((c) => zoro.appendChild(c));
  zoro.style.opacity = "0";
  el.appendChild(zoro);
  /* sprint afterimages: same run frame, trailing along the path */
  const ghostURL = zFrames[0].toDataURL();
  const ghosts = [0, 1, 2].map(() => {
    const im = new Image();
    im.src = ghostURL;
    im.className = "logo3d__zoro-ghost";
    im.style.opacity = "0";
    el.appendChild(im);
    return im;
  });

  /* ---- the saiyan --------------------------------------------
     Hovers ALTERNATE between the swordsman and an Ultra-Instinct
     fighter (silver hair, bare torso, orange gi pants) (original art): he pops in with instant transmission
     (two fingers to the brow, flickering), drops into a kamehameha
     charge, then FIRES a beam along the cut diagonal — the mark
     splits as the beam crosses it, and the beam keeps blasting for
     as long as the hover holds. Three frames + a stretchable beam. */
  const G_TELE = [
    "..k.k.kk.k......",
    ".kykykyykyk.....",
    ".kyyyyyyyyk.....",
    "..kyyyyyyyk.....",
    ".kYyyyyyyyk.....",
    ".kYsyyyyssk.....",
    ".kYssssssskss...",
    ".kYsskkssksk....",
    "..kSsssssk......",
    "..kssssssk......",
    ".kssssssssk.....",
    ".ksSssssSsk.....",
    ".kuuuuuuuuk.....",
    ".koooooook......",
    "..kooook........",
    "..kok..kok......",
    "..kok..kok......",
    "..kuk..kuk......",
    ".kkukkkkukk.....",
  ];
  const G_CHARGE = [
    "..k.k.kk.k......",
    ".kykykyykyk.....",
    ".kyyyyyyyyk.....",
    "..kyyyyyyyk.....",
    ".kYyyyyyyyk.....",
    ".kYsyyyyssk.....",
    ".kYsssssssk.....",
    ".kYsskksssk.....",
    "..kSsssssk......",
    "..kssssssk......",
    ".kssssssssk.....",
    ".ksSssssSssskBB.",
    ".kuuuuuuuusskBB.",
    ".koooooook......",
    "..kooook........",
    "..kok..kok......",
    "..kok..kok......",
    "..kuk..kuk......",
    ".kkukkkkukk.....",
  ];
  const G_FIRE = [
    "..k.k.kk.k......",
    ".kykykyykyk.....",
    ".kyyyyyyyyk.....",
    "..kyyyyyyyk.....",
    ".kYyyyyyyyk.....",
    ".kYsyyyyssk.....",
    ".kYsssssssk.....",
    ".kYsskksssk.....",
    "..kSsssssk......",
    "..ksssssskuss...",
    ".kssssssssukss..",
    ".ksSssssSsk.....",
    ".kuuuuuuuuk.....",
    ".koooooook......",
    "..kooook........",
    "..kok..kok......",
    "..kok..kok......",
    "..kuk..kuk......",
    ".kkukkkkukk.....",
  ];
  const G_BEAM = [
    "kkkkkkkk",
    "kBBBBBBk",
    "BWWWWWWB",
    "WWWWWWWW",
    "BWWWWWWB",
    "kBBBBBBk",
    "kkkkkkkk",
  ];
  const gFrames = [G_TELE, G_CHARGE, G_FIRE].map(zSprite);
  const gMaps = [G_TELE, G_CHARGE, G_FIRE];
  const goku = document.createElement("div");
  goku.className = "logo3d__zoro"; // same positioning rules
  gFrames.forEach((c) => goku.appendChild(c));
  goku.style.opacity = "0";
  el.appendChild(goku);
  const beam = zSprite(G_BEAM);
  beam.className = "logo3d__beam";
  beam.style.opacity = "0";
  el.appendChild(beam);

  /* ---- sizing: render at the mount's CSS size, DPR-capped ----
     (the canvas CSS-fills whatever box carries it — mount or
     flight proxy — so the render resolution tracks the mount) */
  function resize() {
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // the fighters scale with the mark (≈42% of its height)
    const zh = Math.max(9, h * 0.42);
    zFrames.forEach((c, i) => {
      c.style.height = zh + "px";
      c.style.width = (zh * zMaps[i][0].length) / zMaps[i].length + "px";
    });
    ghosts.forEach((g) => (g.style.height = zh + "px"));
    gFrames.forEach((c, i) => {
      c.style.height = zh + "px";
      c.style.width = (zh * gMaps[i][0].length) / gMaps[i].length + "px";
    });
    beam.style.height = Math.max(5, h * 0.13) + "px";
    if (reduced && ready) renderer.render(scene, camera);
  }
  new ResizeObserver(resize).observe(el);
  resize();

  /* ---- load + center + fit the mark, once per half ----------- */
  let ready = false;
  let born = 0;
  new GLTFLoader().load(
    "media/logo-143.glb",
    (gltf) => {
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const fit = 1.62 / Math.max(size.x, size.y); // fill the frustum at z=3.4

      [matA, matB].forEach((mat, i) => {
        const half = gltf.scene.clone(true); // shares geometry, clones nodes
        half.traverse((o) => {
          if (o.isMesh) o.material = mat;
        });
        half.position.copy(center).multiplyScalar(-1);
        const holder = new THREE.Group();
        holder.add(half);
        holder.scale.setScalar(fit);
        pivots[i].add(holder);
      });

      ready = true;
      /* arriving from a navigation: no entrance pop — the mark is
         already on screen (snapshot/flight); just take over */
      born = saved ? performance.now() - 1100 : performance.now();
      el.classList.add("is-on");
      if (reduced) {
        // a fixed 3/4 studio pose — no animation
        pivots.forEach((p) => p.rotation.set(0.14, 0.55, 0));
        renderer.render(scene, camera);
        if (snapImg) { snapImg.remove(); snapImg = null; }
      } else if (snapImg) {
        // let the live canvas paint a frame or two, then drop the still
        const drop = snapImg;
        snapImg = null;
        requestAnimationFrame(() => requestAnimationFrame(() => drop.remove()));
      }
    },
    undefined,
    () => {
      if (flight) { flight.proxy.remove(); flight = null; }
      renderer.dispose();
      el.textContent = "";
      svgFallback(el);
    }
  );

  if (reduced) return; // no loop, no listeners

  /* ---- animation state --------------------------------------
     ry: accumulated idle spin · tilt: pointer-follow, lerped ·
     cut: 0 = whole, 1 = sliced apart (driven by hover) */
  /* fresh visit: start a touch wound-back so the entrance settles
     ~face-on — at this slow spin speed the first impression IS the
     pose. Arriving from another page: resume the EXACT angle the
     last page left off (advanced by the time the hop took). */
  let ry = saved && typeof saved.ry === "number"
    ? saved.ry + Math.min((Date.now() - saved.t) / 1000, 2) * 0.18
    : -0.55;
  let tiltX = 0, tiltY = 0, curTX = 0, curTY = 0;
  let hover = false;
  let cut = 0;
  let zoroT = 0;  // ms since the hover started — drives whichever fighter is up
  let actor = 0;  // hovers alternate: 0 = the swordsman, 1 = the saiyan
  let hovers = 0;
  let prevHover = false;

  /* the swordsman's scene, anime-staged:
     0–200ms   SPRINT through the mark along the cut diagonal — two
               alternating run frames + afterimage ghosts
     200–760ms FOLLOW-THROUGH: dead still at the far side, blade
               still out. The mark is UNTOUCHED. Tension.
     760ms     SHEATHES — and the mark falls apart in that instant
               (the loop fires the cut + a jolt at Z_SHEATH_MS)
     1500ms+   fades out, scene over */
  const Z_SPRINT_MS = 200, Z_SHEATH_MS = 760, Z_FADE_MS = 1500, Z_END_MS = 1800;
  const zPath = (q) => [-25 + 110 * q, -18 + 90 * q]; // % of the mount, along the blade
  function zShow(idx) {
    zFrames.forEach((c, i) => (c.style.display = i === idx ? "block" : "none"));
  }
  function updateZoro(t) {
    if (t <= 0 || t > Z_END_MS) {
      zoro.style.opacity = "0";
      ghosts.forEach((g) => (g.style.opacity = "0"));
      return;
    }
    const p = Math.min(t / Z_SPRINT_MS, 1);
    const sprinting = p < 1;
    // frame: alternate run poses every ~55ms, then follow-through, then sheathed
    zShow(sprinting ? (Math.floor(t / 55) % 2) : t < Z_SHEATH_MS ? 2 : 3);
    const [x, y] = zPath(p);
    zoro.style.left = x + "%";
    zoro.style.top = y + "%";
    zoro.style.transform =
      "translate(-50%,-50%)" + (sprinting ? " rotate(33deg)" : "");
    zoro.style.opacity =
      t > Z_FADE_MS ? String(Math.max(0, 1 - (t - Z_FADE_MS) / 300)) : "1";
    // afterimages chase him along the path, then evaporate
    ghosts.forEach((g, i) => {
      const q = p - (i + 1) * 0.2;
      if (!sprinting && t > Z_SPRINT_MS + 140) { g.style.opacity = "0"; return; }
      if (q <= 0) { g.style.opacity = "0"; return; }
      const [gx, gy] = zPath(q);
      g.style.left = gx + "%";
      g.style.top = gy + "%";
      g.style.transform = "translate(-50%,-50%) rotate(33deg)";
      g.style.opacity = String([0.3, 0.18, 0.1][i] * (sprinting ? 1 : 1 - (t - Z_SPRINT_MS) / 140));
    });
  }

  /* the saiyan's scene:
     0–160ms     blinks into existence ABOVE the mark (instant
                 transmission flicker), two fingers to the brow
     160–260ms   gone — the hop
     260–420ms   reappears DOWN at the firing spot on the cut line
     420–700ms   KAMEHAMEHA CHARGE — hands cupped, ki glowing
     700ms       FIRES from the bottom-right, UP the cut diagonal;
                 the mark splits as the beam crosses (G_CUT_MS)
     700–1700ms  blasts for one second
     1700–2000ms beam dies, he flickers back out of existence */
  const G_FIRE_MS = 700, G_CUT_MS = 780, G_BEAM_END = 1700, G_GONE = 2000;
  const G_TOP = [46, -24]; // first blink-in: above the mark
  const G_SPOT = [96, 82]; // firing spot: the cut line's BOTTOM-RIGHT
  function gShow(idx) {
    gFrames.forEach((c, i) => (c.style.display = i === idx ? "block" : "none"));
  }
  function updateGoku(t) {
    if (t <= 0 || t > G_GONE) {
      goku.style.opacity = "0";
      beam.style.opacity = "0";
      return;
    }
    const blink = Math.floor(t / 45) % 2 ? "1" : "0.15";
    let pos = G_SPOT, op = "1", frame = 1;
    if (t < 160) { pos = G_TOP; op = blink; frame = 0; }          // appear up top
    else if (t < 260) { op = "0"; frame = 0; }                    // mid-hop
    else if (t < 420) { op = blink; frame = 0; }                  // re-appear below
    else if (t < G_FIRE_MS) { frame = 1; }                        // charge
    else if (t < G_BEAM_END) { frame = 2; }                       // FIRE
    else { frame = 0; op = blink; }                               // vanish flicker
    gShow(frame);
    goku.style.left = pos[0] + "%";
    goku.style.top = pos[1] + "%";
    // mirrored at the firing spot: he faces LEFT to shoot up the diagonal
    goku.style.transform =
      "translate(-50%,-50%)" + (t >= 160 ? " scaleX(-1)" : "");
    goku.style.opacity = op;
    if (t > G_FIRE_MS && t < G_BEAM_END + 130) {
      const ext = Math.min((t - G_FIRE_MS) / 110, 1); // beam races out
      beam.style.left = G_SPOT[0] - 9 + "%";
      beam.style.top = G_SPOT[1] - 7 + "%";
      beam.style.width = ext * 110 + "%";
      beam.style.transform = "translateY(-50%) rotate(213deg)"; // up-left, along the cut
      // dies fast once the two seconds are up
      beam.style.opacity = t > G_BEAM_END ? String(Math.max(0, 1 - (t - G_BEAM_END) / 130)) : "1";
    } else {
      beam.style.opacity = "0";
      beam.style.width = "0%";
    }
  }

  /* hand the baton to the next page — the rect comes from the
     CANVAS (it's wherever the mark visually is, mount or proxy) */
  addEventListener("pagehide", () => {
    try {
      const r = renderer.domElement.getBoundingClientRect();
      sessionStorage.setItem(
        "logoState",
        JSON.stringify({
          ry,
          t: Date.now(),
          img: renderer.domElement.toDataURL(),
          rect: { x: r.left, y: r.top, w: r.width, h: r.height },
        })
      );
    } catch (_) {}
  });

  /* the cut scenes (Zoro / Goku) play ONLY on /about's bio mark —
     the header marks on the other pages stay calm: spin + tilt only */
  const cutEnabled = document.body.classList.contains("about");

  addEventListener(
    "pointermove",
    (e) => {
      tiltY = (e.clientX / innerWidth - 0.5) * 0.3;
      tiltX = (e.clientY / innerHeight - 0.5) * 0.16;
      /* the mount is pointer-events:none (it must never block nav
         clicks), so hover is a bounding-box check instead */
      if (!cutEnabled) return;
      const r = (flight ? flight.proxy : el).getBoundingClientRect();
      hover =
        e.clientX > r.left - 8 && e.clientX < r.right + 8 &&
        e.clientY > r.top - 8 && e.clientY < r.bottom + 8;
    },
    { passive: true }
  );

  /* ---- the flight: an underdamped spring with squash & stretch */
  function updateFlight(dt, now) {
    const f = flight;
    if (now < f.holdUntil) return; // wait out the page crossfade first
    const t = el.getBoundingClientRect(); // home may shift while loading
    const tx = t.left + t.width / 2, ty = t.top + t.height / 2, tw = t.width || 1;

    if (!f.kicked) {
      /* anticipation: launch with velocity AWAY from home — the
         spring turns that into a wind-up before the dash */
      f.kicked = true;
      f.vx = (f.cx - tx) * 1.1;
      f.vy = (f.cy - ty) * 1.1;
    }

    const K = 16, C = 4.8; // stiffness / damping → ζ=0.6; a real journey:
                           // ~0.7s of visible travel, overshoot, settle ≈1.6s
    f.vx += (-K * (f.cx - tx) - C * f.vx) * dt; f.cx += f.vx * dt;
    f.vy += (-K * (f.cy - ty) - C * f.vy) * dt; f.cy += f.vy * dt;
    f.vw += (-K * (f.w - tw) - C * f.vw) * dt;  f.w += f.vw * dt;

    /* squash & stretch follows the velocity vector; capped so the
       mark deforms like rubber, not taffy */
    const speed = Math.hypot(f.vx, f.vy);
    const st = Math.min(0.38, speed * 0.0013);
    const ang = speed > 1 ? Math.atan2(f.vy, f.vx) : 0;

    const s = f.proxy.style;
    s.left = f.cx - f.w / 2 + "px";
    s.top = f.cy - f.w / 2 + "px";
    s.width = f.w + "px";
    s.height = f.w + "px";
    s.transform =
      "rotate(" + ang + "rad) scale(" + (1 + st) + "," + (1 - st * 0.55) +
      ") rotate(" + -ang + "rad)";

    /* landed? close + slow + home is actually visible (about holds
       its bio column hidden for the entrance stagger — hover at the
       doorstep until it shows, max ~3s) */
    const settled =
      Math.abs(f.cx - tx) < 0.6 && Math.abs(f.cy - ty) < 0.6 &&
      speed < 8 && Math.abs(f.w - tw) < 0.6;
    if (settled) {
      f.landT = f.landT || now;
      let visible = true;
      try {
        if (el.checkVisibility) visible = el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      } catch (_) {}
      if (visible || now - f.landT > 3000) {
        el.appendChild(renderer.domElement);
        if (snapImg) el.appendChild(snapImg);
        f.proxy.remove();
        flight = null;
      }
    }
  }

  const easeOutBack = (p) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
  };

  let prev = performance.now();
  (function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;

    if (flight) updateFlight(dt, now);
    if (!ready) return;

    // entrance: 1.1s scale-up with overshoot while the spin settles in
    const p = Math.min((now - born) / 1100, 1);
    const enter = p < 1 ? Math.max(easeOutBack(p), 0.001) : 1;

    // one quiet turn every ~35s, plus a little extra during the entrance
    ry += 0.18 * dt + (p < 1 ? (1 - p) * 0.05 : 0);

    curTX += (tiltX - curTX) * Math.min(dt * 4, 1);
    curTY += (tiltY - curTY) * Math.min(dt * 4, 1);

    // the fighter's scene runs first; the mark only falls apart on
    // the killing beat (sheath / beam crossing) — with a little jolt
    if (hover && !prevHover) actor = hovers++ % 2; // alternate fighters
    prevHover = hover;
    zoroT = hover ? zoroT + dt * 1000 : 0;
    if (actor === 0) { updateZoro(zoroT); updateGoku(0); }
    else { updateGoku(zoroT); updateZoro(0); }

    const cutOn = hover && zoroT > (actor === 0 ? Z_SHEATH_MS : G_CUT_MS);
    cut += ((cutOn ? 1 : 0) - cut) * Math.min(dt * (cutOn ? 16 : 3.2), 1);
    let jolt = 0;
    if (cutOn) {
      const ts = zoroT - (actor === 0 ? Z_SHEATH_MS : G_CUT_MS);
      jolt = Math.exp(-ts / 110) * Math.sin(ts * 0.18) * 0.02;
    }
    const slide = 0.13 * cut; // along the blade — the slice shear
    const gap = 0.045 * cut;  // a hair of daylight across the cut
    const shrink = 1 - 0.1 * cut; // keep both pieces inside the frame

    pivots.forEach((pv, i) => {
      const sgn = i === 0 ? 1 : -1;
      pv.position
        .copy(BLADE).multiplyScalar(slide * sgn)
        .addScaledVector(CUTN, gap * sgn + jolt); // jolt shakes the WHOLE mark
      pv.rotation.set(
        0.1 + Math.sin(now * 0.0006) * 0.07 + curTX,
        ry + curTY,
        Math.sin(now * 0.0004) * 0.04 + sgn * 0.05 * cut
      );
      pv.scale.setScalar(enter * shrink);
    });

    renderer.render(scene, camera);
  })(prev);
}
