# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

No build step. Open directly or serve statically:

```bash
open index.html
# or
python3 -m http.server 8000
```

## Architecture

Three files, no dependencies:

- **`index.html`** — DOM structure: `<canvas id="board">` (300×600px), side panel with score/lines/level/next-piece preview (`<canvas id="next-canvas">`), and a shared overlay div for pause and game over states.
- **`style.css`** — Dark/retro theme. Overlay uses `backdrop-filter: blur`.
- **`game.js`** — All game logic (~305 lines, `'use strict'`).

### game.js key concepts

**State** — single mutable globals: `board` (ROWS×COLS matrix, `0` = empty, `1–7` = piece color index), `current`/`next` piece objects `{type, shape, x, y}`, plus `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `animId`.

**Game loop** — `requestAnimationFrame`-based `loop(ts)`: accumulates `dt` into `dropAccum`; when `dropAccum >= dropInterval` it gravity-drops or calls `lockPiece()` → `merge()` + `clearLines()` + `spawn()`.

**Rotation** — `rotateCW` does transpose+row-reverse. `tryRotate` applies wall kicks `[0, -1, 1, -2, 2]` until one doesn't collide.

**Rendering** — `draw()` clears canvas, draws grid, locked board, ghost piece (alpha 0.2 at `ghostY()`), then current piece. `drawNext()` renders on the second canvas.

**Speed formula** — `dropInterval = max(100, 1000 − (level − 1) × 90)` ms; level increments every 10 lines.

### Tunable constants (top of game.js)

| Constant | Default | Note |
|---|---|---|
| `COLS` / `ROWS` | 10 / 20 | Must match canvas `width`/`height` in HTML |
| `BLOCK` | 30px | Canvas size = `COLS×BLOCK` × `ROWS×BLOCK` |
| `COLORS` | 7 colors | Index 0 = null (empty) |
| `LINE_SCORES` | `[0,100,300,500,800]` | Multiplied by current level |
