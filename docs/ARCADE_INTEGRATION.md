# Little Joy Arcade integration

Traffic Tangle follows the same drop-in pattern as the other arcade titles.

## Client

`index.html` loads `./arcade-client.js` with `data-game-id="traffic-tangle"`. The client is provided by the portal: it handles shared sign-in, mirrors `localStorage` to the player's arcade account and exposes `window.LittleJoyArcade`.

`src/core/arcade.ts` is the adapter layer:

| Need | Behaviour |
| --- | --- |
| Status / user | Reads the client when present, otherwise reports "Playing locally" |
| Sync | Calls `syncNow('traffic-tangle')`; failures are ignored |
| Entitlements | Reads the cached `lja:entitlements` list; no ads ship, so this is readiness only |
| Return to arcade | Opens https://littlejoyarcade.site |

There is no invented backend endpoint: if the platform services are missing, the game runs fully offline with local saves.

## Saves

`traffic-tangle-save-v1` is versioned, sanitised on load, and merged conservatively (best stars, fewest hops, fastest time, union of achievements, furthest unlock). A stale cloud copy can never erase progress. In-progress Journey routes are kept in `traffic-tangle-session-v1`.

## Catalogue

The portal entry lives in the arcade repository (`src/data/games.ts`) and is applied to Supabase with `supabase/migrations/0008_traffic_tangle.sql` using the Supabase CLI. The manifest points at `https://jd4rider.github.io/traffic-tangle/play/` with `https://traffictangle.littlejoyarcade.site/play/` preferred once that subdomain resolves; the portal probes the subdomain and falls back to the github.io build.
