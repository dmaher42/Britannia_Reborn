# AGENTS.md

## Project overview
**Britannia Reborn** — a 2D, top‑down RPG slice in the browser (HTML5 Canvas, ES Modules). Systems include: terrain effects, party attributes (STR/DEX/INT), inventory weight rules, reagent‑based magic, and turn‑based combat with a tactical grid. Dialogue uses a backend AI endpoint (mocked if not connected).

## How to run
- **Full demo:** open `app/index.html` in a browser (no server).
- **If serving:** any static file server to host `/app`.

## Tests (future PRs)
Use `vitest`:
- Attribute formulas (MP per class; equip ≤ STR; pack ≤ STR×2)
- Reagent spending & casting rules
- Terrain modifiers (speed/poison in swamp; forest visibility)
- Combat turn loop (player → enemy → player)

## Code style
- ES Modules; prefer pure functions for calculations; isolate rendering side‑effects.

## Security
- No secrets in client code. For real LLMs, call a server `/api/ai` endpoint with keys stored server‑side.

## Roadmap
1. Equipment slots; enforce **equipped ≤ STR** and **pack ≤ STR×2**; UI indicators for overweight.
2. Magic expansion: move spells to `spells.json`; add Heal/Sleep/Lightning; tests.
3. Combat depth: Move/Attack/Cast/Item/Defend; line‑of‑sight & forest cover.
4. Narrative: configurable `AI_ENDPOINT`; streaming responses; prompt with persona/world/player/quest context.
5. Polish: particles, camera shake, toggles; aim 60fps on mid‑range laptops.

## CI expectations
- For every PR: run tests and linters (if configured). Attach a short demo GIF for visual changes.
