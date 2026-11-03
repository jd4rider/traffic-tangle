# Testing

## Vitest (`npm test`)

| Suite | Covers |
| --- | --- |
| `tests/traffic.test.ts` | two-way/one-way/closed roads, holes, shortest paths, legal routes, car following, red lights, deadlines, collisions, deterministic replay, on-board positions |
| `tests/solver.test.ts` | solving, replay of the answer, unsolvable boards, budget exhaustion returning `unknown`, hints matching current state, hints never using closed roads |
| `tests/generator.test.ts` | determinism, validation of generated levels, signals arrive in world 4, one-ways in world 3, every world buildable |
| `tests/saves.test.ts` | garbage saves, round-trip, conservative merge, completion/unlock, star thresholds, settings, storage fallback |
| `tests/campaign.test.ts` | all 1,000 levels pass schema validation, every reference plan replays, independent solves on a sample |

`npm run validate` repeats the manifest replay outside Vitest and checks par against independent solves.

## Playwright (`npm run e2e`)

Runs against the dev server in desktop Chrome and an iPhone 13 profile:

- boots to the menu without console errors
- draws routes by tapping a car and its pin, starts traffic, reaches the results card
- undo restores the previous route state
- world list → level grid → level loads
- Daily opens the shared daily board
- progress survives a reload
- 360 × 800 layout has no horizontal scrolling

No physical-device testing is claimed. Device coverage is emulated viewports only.
