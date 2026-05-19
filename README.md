# Timeline — Gantt App

**[Open the app](https://timihaji.github.io/timeline/timeline.html)**

A fast, single-file Gantt chart app that runs entirely in the browser. No install, no server, no account required.

---

## Features

- **Sets & tasks** — organise work into collapsible sets with nested tasks and milestones
- **Drag to schedule** — draw task bars directly on the timeline; drag to move or resize
- **Dependencies** — link tasks with finish-to-start arrows; lock or inspect them via context menu
- **Owners** — assign tasks to team members and filter by owner
- **Themes** — Things 3 (default) and dark mode, with a clean pastel palette
- **Zoom & pan** — day / week / month / quarter / year zoom levels with smooth pan
- **Command palette** — `Cmd/Ctrl+K` to jump to any task or action
- **Saved views** — bookmark the current zoom + scroll position and recall it later
- **Auto-save** — work is saved to `localStorage` automatically; crash recovery built in
- **Export** — save and load `.gantt` JSON files; import from clipboard

## Usage

Open `timeline.html` in any modern browser. Everything is self-contained — no build step, no dependencies to install.

To run locally with live reload:

```
python -m http.server 8080
```

Then visit `http://localhost:8080/timeline.html`.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+K` | Command palette |
| `Cmd/Ctrl+S` | Save `.gantt` file |
| `Cmd/Ctrl+Z` | Undo |
| `Cmd/Ctrl+Shift+Z` | Redo |
| `?` | Shortcut help overlay |
| `Esc` | Close panel / deselect |

## File format

Projects are saved as `.gantt` JSON files. The schema is human-readable and version-tagged, so files are easy to diff or edit by hand.
