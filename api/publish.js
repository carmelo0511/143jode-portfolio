/* ============================================================
   POST /api/publish — the inline editor's save endpoint.

   { action: "verify", password }            → 200 / 401
   { password, content: <SITE_CONTENT> }     → validates, then
     commits content.js to the GitHub repo on BRANCH. Vercel's
     git integration redeploys, so the edit is live in ~1 min.

   Env: EDIT_PASSWORD, GITHUB_TOKEN,
        GITHUB_REPO  (default carmelo0511/143jode-portfolio),
        GITHUB_BRANCH (default main)
   ============================================================ */
import { timingSafeEqual } from "node:crypto";

const REPO = process.env.GITHUB_REPO || "carmelo0511/143jode-portfolio";
const BRANCH = process.env.GITHUB_BRANCH || "main";

function safeEqual(a, b) {
  const A = Buffer.from(String(a ?? ""));
  const B = Buffer.from(String(b ?? ""));
  if (A.length !== B.length) {
    // compare against self to keep timing flat, then fail
    timingSafeEqual(A, A);
    return false;
  }
  return timingSafeEqual(A, B);
}

const str = (v, max) => {
  if (typeof v !== "string") throw new Error("Invalid content");
  if (v.length > max) throw new Error("A text is too long");
  return v;
};

const SRC_OK = /^(media\/[\w.\-]+|https:\/\/[\w.\-]+\.public\.blob\.vercel-storage\.com\/[^\s"']+)$/;

function mediaSrc(v) {
  const s = str(v, 500);
  if (!SRC_OK.test(s)) throw new Error("A media file wasn't uploaded correctly — please try again");
  return s;
}

/* whitelist-rebuild the content object so nothing unexpected is committed */
function validate(c) {
  if (!c || typeof c !== "object" || !Array.isArray(c.projects)) throw new Error("Invalid content");
  if (c.projects.length === 0 || c.projects.length > 20) throw new Error("Invalid content");
  const social = {};
  for (const k of ["linkedin", "behance", "instagram"]) {
    social[k] = str(c.social?.[k] ?? "#", 500);
  }
  return {
    email: str(c.email, 160),
    bio: str(c.bio, 4000),
    status: str(c.status, 400),
    social,
    projects: c.projects.map((p) => {
      const media = Array.isArray(p.media) ? p.media : [];
      if (media.length > 12) throw new Error("Invalid content");
      return {
        name: str(p.name, 160),
        meta: str(p.meta, 240),
        url: str(p.url, 500),
        desc: str(p.desc, 800),
        aboutDesc: str(p.aboutDesc, 800),
        media: media.map((m) => {
          const out = { src: mediaSrc(m.src), type: m.type === "video" ? "video" : "image" };
          if (m.poster) out.poster = mediaSrc(m.poster);
          return out;
        }),
      };
    }),
  };
}

const HEADER = `/* ============================================================
   143jode — SITE CONTENT (single source of truth)
   Published by the inline site editor (api/publish.js).
   Hand-edits are fine too — keep it valid JSON inside the
   assignment.
   ============================================================ */
`;

async function gh(path, init = {}) {
  const res = await fetch("https://api.github.com" + path, {
    ...init,
    headers: {
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "user-agent": "143jode-inline-editor",
      ...init.headers,
    },
  });
  return res;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, password, content } = req.body || {};

  if (!process.env.EDIT_PASSWORD) {
    return res.status(500).json({ error: "Editing isn't set up yet (EDIT_PASSWORD missing)" });
  }
  if (!safeEqual(password, process.env.EDIT_PASSWORD)) {
    return res.status(401).json({ error: "Wrong password" });
  }
  if (action === "verify") return res.status(200).json({ ok: true });

  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({ error: "Publishing isn't set up yet (GITHUB_TOKEN missing)" });
  }

  let clean;
  try {
    clean = validate(content);
  } catch (e) {
    return res.status(400).json({ error: e.message || "Invalid content" });
  }

  // <-escape so a "</script>" inside a string can never break the page
  const js =
    HEADER +
    "window.SITE_CONTENT = " +
    JSON.stringify(clean, null, 2).replace(/</g, "\\u003c") +
    ";\n";

  try {
    // current sha is required to update an existing file
    let sha;
    const cur = await gh(`/repos/${REPO}/contents/content.js?ref=${BRANCH}`);
    if (cur.ok) sha = (await cur.json()).sha;

    const put = await gh(`/repos/${REPO}/contents/content.js`, {
      method: "PUT",
      body: JSON.stringify({
        message: "content: site edits published from the inline editor",
        content: Buffer.from(js, "utf8").toString("base64"),
        branch: BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!put.ok) {
      const detail = await put.text();
      console.error("GitHub commit failed:", put.status, detail);
      return res.status(502).json({ error: "Couldn't save to the site repository" });
    }
  } catch (e) {
    console.error("Publish error:", e);
    return res.status(502).json({ error: "Couldn't reach the site repository" });
  }

  return res.status(200).json({ ok: true });
}
