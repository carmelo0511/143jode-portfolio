/**
 * Build-time content fetch + bake.
 *
 * Pulls the projects from Sanity (public dataset → no token) and:
 *   1. writes `data.js` (window.SITE_PROJECTS) — the GRID reads it synchronously.
 *   2. injects the focus-view rail + list (work.html) and the About "Selected
 *      Works" list (about.html) between <!-- SANITY:* --> markers, so work.js /
 *      about.js keep reading the same static DOM (no runtime refactor).
 *
 * Everything stays synchronous at first paint → cross-document name morphs, the
 * intro, and SEO all keep working. Runs locally (`node build/fetch-content.mjs`)
 * and on every Vercel build. Node 18+ (global fetch); NO dependencies.
 *
 * Resilient: if Sanity is unreachable or returns nothing, it logs a warning and
 * leaves the committed files untouched (last-good snapshot) — a Sanity hiccup
 * can never blank the site or break a deploy.
 */
import {readFileSync, writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

const PROJECT = 'rix2lzom'
const DATASET = 'production'
const API = '2024-01-01'

const QUERY = `*[_type == "project" && defined(order)] | order(order asc){
  "name": title, order, context, description, visitUrl,
  "video": video.asset->url, "poster": poster.asset->url,
  "images": images[].asset->url
}`

const root = (rel) => fileURLToPath(new URL('../' + rel, import.meta.url))
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const attr = (s) => esc(s).replace(/"/g, '&quot;')
const pad2 = (n) => String(n).padStart(2, '0')

function injectBetween(html, tag, inner) {
  const re = new RegExp(`(<!--\\s*SANITY:${tag}\\s*-->)[\\s\\S]*?(<!--\\s*/SANITY:${tag}\\s*-->)`)
  if (!re.test(html)) {
    console.warn(`⚠  marker SANITY:${tag} not found — skipped`)
    return html
  }
  return html.replace(re, `$1\n${inner}\n$2`)
}

// ---- HTML generators (match the existing hand-written structure exactly) ----

function railHTML(projects) {
  return projects
    .map((p, i) => {
      const imgs = p.images.length ? p.images : ['']
      const t = (n) => imgs[n] || imgs[0]
      const video = p.video
        ? `<span class="thumb thumb--video" style="background-image:url('${attr(p.poster || imgs[0])}')" data-src="${attr(p.video)}" data-type="video"></span>`
        : `<span class="thumb" style="background-image:url('${attr(t(3))}')" data-src="${attr(t(3))}" data-type="image"></span>`
      return `        <section class="proj" data-i="${i}">
          <div class="proj__num"><span class="proj__num-i">${pad2(i + 1)}</span></div>
          <div class="proj__thumbs">
            <span class="thumb" style="background-image:url('${attr(t(0))}')" data-src="${attr(t(0))}" data-type="image"></span>
            <span class="thumb" style="background-image:url('${attr(t(1))}')" data-src="${attr(t(1))}" data-type="image"></span>
            <span class="thumb" style="background-image:url('${attr(t(2))}')" data-src="${attr(t(2))}" data-type="image"></span>
            ${video}
          </div>
        </section>`
    })
    .join('\n')
}

function listHTML(projects) {
  return projects
    .map((p, i) => `            <li data-i="${i}"${i === 0 ? ' class="is-active"' : ''}><span class="wl">${esc(p.name)}</span></li>`)
    .join('\n')
}

function selectedHTML(projects) {
  return projects
    .map((p, i) => {
      const num = `<span class="sw-num">(${pad2(i + 1)})</span> `
      const name = `<span class="sw" data-i="${i}">${esc(p.name)}</span>`
      const trail = i < projects.length - 1 ? ' ' : ''
      const desc = `<span class="sw-desc"> ${esc(p.description)}${trail}</span>`
      return num + name + desc
    })
    .join('')
}

// ---- fetch ----------------------------------------------------------------

let result
try {
  const endpoint = `https://${PROJECT}.apicdn.sanity.io/v${API}/data/query/${DATASET}?query=${encodeURIComponent(QUERY)}`
  const res = await fetch(endpoint)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  result = (await res.json()).result
} catch (err) {
  console.warn(`⚠  Sanity fetch failed (${err.message}); keeping committed content (data.js / work.html / about.html).`)
  process.exit(0) // non-fatal: never break a deploy or blank the site
}

const projects = (Array.isArray(result) ? result : []).map((p) => ({
  name: p.name || 'Untitled',
  context: p.context || '',
  description: p.description || '',
  visitUrl: p.visitUrl || '',
  video: p.video || null,
  poster: p.poster || null,
  images: (p.images || []).filter(Boolean),
}))

if (projects.length === 0) {
  console.warn('⚠  Sanity returned 0 projects; keeping committed content.')
  process.exit(0)
}

// ---- 1. data.js (the grid) ----
writeFileSync(
  root('data.js'),
  `/* AUTO-GENERATED from Sanity (${PROJECT}/${DATASET}); built ${process.env.VERCEL ? 'on Vercel' : 'locally'}. Do not edit by hand. */\n` +
    `window.SITE_PROJECTS = ${JSON.stringify(projects, null, 2)};\n`,
)

// ---- 2. inject the focus view (work.html) + About list (about.html) ----
let work = readFileSync(root('work.html'), 'utf8')
work = injectBetween(work, 'rail', railHTML(projects))
work = injectBetween(work, 'list', listHTML(projects))
writeFileSync(root('work.html'), work)

let about = readFileSync(root('about.html'), 'utf8')
about = injectBetween(about, 'selected', selectedHTML(projects))
writeFileSync(root('about.html'), about)

console.log(`✓ baked ${projects.length} projects → data.js + work.html (rail/list) + about.html (selected)`)
console.log(`  ${projects.map((p) => p.name).join(', ')}`)
