# crocs — 3D scroll product page (unofficial fan concept)

Rebuilt from the screen recording. Not affiliated with Crocs, Inc.

## Run it
Double-click `public/index.html` (no server needed). Best in Chrome/Edge/Firefox with hardware acceleration on.

## Rebuild from source
    npm install
    npm run build      # bundles src/ -> dist/
    npm run dev        # live server on http://127.0.0.1:8000

## Stack
- three.js: procedural clog (no model files), RoomEnvironment reflections, shader color seam sweep
- Lenis: Apple-style inertial smooth scroll, one pinned stage driven by scroll progress
- Bricolage Grotesque + Inter, bundled locally (no network needed)

## Chapters (scroll order)
01 classic · 02 made of croslite™ (macro dive to the charm) · 03 sky high / bubblegum / lime punch / digital violet · 04 six colors. one shoe. · 05 after dark (mirror split, gold sole dive) · 06 out in the wild. (lookbook) · 07 pair up (pick yours) · charm portal → footer

## Editing
Copy lives in `index.html`. Scroll timing, poses and colors are the `PS`, `BG`, `SEG` tables in `src/main.js`.

## Deploy to Vercel
Import the folder/zip contents as a project. `vercel.json` already sets: build `npm run build`, output directory `public`. No other settings needed.
