# Traffic Tangle

A portrait-first 2.5D traffic-routing puzzle for **Little Joy Arcade**. Draw a route for every toy car, set the lights, then press GO and watch the whole miniature city move at once.

- **Engine:** Phaser 3 (rendering only) + a pure TypeScript traffic simulation
- **Stack:** TypeScript strict, Vite, Vitest, Playwright
- **Campaign:** 1,000 solver-verified levels across 20 themed worlds
- **Modes:** Journey, Zen, Daily, Endless, Free Build (sandbox)
- **Target:** https://traffictangle.littlejoyarcade.site

## Quick start

```bash
npm install
npm run dev          # http://localhost:5175
npm test             # engine, solver, generator, saves, campaign
npm run validate     # re-validates the baked 1,000-level manifest
npm run bake         # regenerates src/data/levels.json (verified)
npm run e2e          # Playwright (desktop + portrait)
npm run build        # typecheck + production build
```

## How it plays

1. Tap a car, then tap its matching pin (or drag along the roads) to draw a route.
2. Every car needs a route before GO will start.
3. Cars drive their routes at the same time, obeying lights, queuing, and never blocking a junction they cannot clear.
4. Everyone home before the clock runs out wins. Fewer road hops and no hints earn up to three stars.

## What is actually verified

- `npm run bake` constructs each level from a working plan, then replays it through the shipped simulation before writing it. A level that deadlocks, times out or contains an illegal route is rejected and regenerated.
- `npm run validate` re-runs the stored reference plan for all 1,000 levels and independently re-solves a sample.
- CI runs validation, unit tests and the production build before deploying to GitHub Pages, and publishes the playable build at `/play/` for the arcade iframe.

## Layout

```
src/core/      pure TypeScript: graph, simulation, solver, generator, saves, audio synth
src/data/      baked campaign manifest (levels.json)
src/phaser/    scenes and the 2.5D city renderer
scripts/       bake + validate + generation debug tools
tests/         Vitest suites and Playwright specs
docs/          engine, route rules, solver, generation, arcade integration, testing, deployment
```

The simulation never reads Phaser state, and the renderer never decides a puzzle result.
