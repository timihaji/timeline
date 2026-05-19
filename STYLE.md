# Style guide — Timeline / Gantt app

**Read this and `style.html` before adding any new UI.**

## The rule
All new UI must look like **Things 3** (Cultured Code's task app): clean, soft, pastel, rounded, generous spacing. The active theme lives in `timeline.html` under `body[data-theme="things"]{…}`. Aurora backup at `timeline-aurora-backup.html`.

## Where to find what

- **[style.html](style.html)** — the **live implementation guide**. Open in a browser to see every component rendered with its CSS visible. Copy patterns directly from here. This is the source of truth for tokens, components, and interaction states.
- **timeline.html** — the running app. The Things theme block (search `body[data-theme="things"]`) contains the production CSS.
- **This file** — the short written rules + anti-patterns that don't fit naturally inside the HTML guide.

## Anti-patterns (do NOT do)

- ❌ Hardcoded hex anywhere — always `var(--…)`. If a needed colour doesn't exist, add a token first.
- ❌ Sharp 2–4px radii. Pick from 8 / 12 / 14 / 999.
- ❌ Glow or neon shadows (`box-shadow: 0 0 14px var(--accent-2)`) — those are Aurora-theme, not Things.
- ❌ White text on a light background. Always check contrast.
- ❌ Dark gradients (the old welcome overlay) and dark surfaces from the legacy theme — `#0c1c19`, `#021412`, `#05100e`.
- ❌ Saturated brand-style status pills (full-strength red / green). Use the 12–20% opacity recipe in `style.html` §7.
- ❌ Inline `style={{}}` colour values in JSX — add a class and use tokens.
- ❌ Harsh `outline: 2px solid` for selection. Use `var(--accent-dim)` background instead.

## Adding a new component

1. Open `style.html`. Find the closest existing analogue (button, pill, row, card, bar).
2. Copy its CSS rule and adapt — same radius, padding, hover/selected treatment.
3. Use `var(--…)` tokens only. Add new tokens to the Things block in `timeline.html` if needed.
4. Scope theme overrides under `body[data-theme="things"]` so the Aurora backup stays clean.
5. Verify visually next to the Welcome / List / Calendar / Gantt views.
