# 143jode — portfolio

A portfolio site for **143jode**, built in vanilla HTML, CSS, and JavaScript (no framework, no build step).

## Pages
- **`index.html`** — the *Works* grid: a project index with a fixed centre name-list and thumbnails that wave in on load.
- **`work.html`** — the focus view: a scroll-driven, single-project showcase with a large looping preview.
- **`about.html`** — bio + selected works.
- **`project.html`** — project detail (currently unlinked).

## Notable details
- **Cross-document View Transitions** tie the pages together — the big active title morphs between pages, the project names slide from the list into the about prose, and a clicked grid thumbnail zooms into the focus preview.
- An **intro counter** (0→100) plays on first load and reloads.
- Tile and preview **videos loop silently**, with no controls.

## Running locally
It's static — serve the folder with any static server, e.g.:

```bash
python3 -m http.server 8124
```

then open <http://localhost:8124/index.html>.
