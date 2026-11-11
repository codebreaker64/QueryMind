# Design

The visual system behind the QueryMind redesign. Tokens live in `frontend/src/index.css` as `--qm-*` custom properties; the landing page styles are in `frontend/src/landing/landing.css` and the research app in `frontend/src/app.css`.

## World

A deep-teal night lit by one warm source: Mote, the mascot. Everything cool is background and structure; everything warm means "the agent is doing something" (searching, asking, citing). As the visitor scrolls towards the answer, a warmth overlay rises so the page literally brightens when the result arrives.

## Colour

| Token | Value | Use |
| --- | --- | --- |
| `--qm-ink` | `#08191d` | Deepest background, text on paper |
| `--qm-night` | `#0d262b` | Page background |
| `--qm-night-2` / `-3` | `#13323a` / `#1a3d45` | Raised surfaces, borders |
| `--qm-tide` | `#2a535a` | Hairlines, inactive chips |
| `--qm-mist` | `#a9c4c1` | Secondary text |
| `--qm-foam` | `#eef6f3` | Primary text on night |
| `--qm-glow` / `-2` | `#ffb357` / `#ffd27a` | Mote, primary actions, citations |
| `--qm-ember` | `#c4561c` | Pressed and hover states of warm actions |
| `--qm-paper` | `#fff6e8` | Cards that hold agent output (question, answer) |

Text pairs meet WCAG AA: foam and mist on night, ink on paper and on glow.

## Type

Display: Bricolage Grotesque Variable (headlines, wordmark). Body and UI: Geist. Both are self-hosted through Fontsource, so there is no Google Fonts request.

## Mote

A soft apricot droplet with a little antenna, built from Three.js primitives in `frontend/src/landing/mote.js` (no external model is loaded at runtime). A rim-glow shader and an inner point light give the "thought" glow. Mote splits into four minis to show parallel search, peeks over the clarifying-question card, and waves at the call to action. `MoteGlyph.jsx` is the 2D SVG version used inside the app. Concept art: `docs/design/mote-concept.jpg`. An exported model is at `frontend/public/models/mote.glb`, and `frontend/mote-lab.html` renders Mote on its own for tweaking or re-exporting.

## Motion

GSAP ScrollTrigger scrubs Mote between section presets; on wide screens the parallel, ask and answer sections pin and drive their beats from pin progress. On narrow screens nothing pins and Mote retreats to a corner so it never covers text. With `prefers-reduced-motion`, every section shows its final state and Mote jumps instead of gliding. Without WebGL, a still render (`public/mote.png`) stands in.

## Principles

Show the mechanism, not adjectives. Warm means the agent. Friendly, never childish. No invented numbers, logos or testimonials.
