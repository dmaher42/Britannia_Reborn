# Britannia Reborn

A fresh, from-the-ground-up prototype of a top-down Britannia adventure. Movement, party management, and reagent-driven magic have
been rebuilt with clarity and testable rules.

## Quick start
- Open `index.html` in any modern browser.
- Click the canvas once if keyboard input is not captured.
- Explore with **WASD** or the arrow keys. The camera now eases around the party leader.

## Systems in this slice
- **Party trail:** the Avatar leads while companions follow with smoothed spacing.
- **Encumbrance rules:** equipment must weigh ≤ STR and backpacks ≤ STR×2. Overweight heroes move slower.
- **Spellcasting:** Fire Dart consumes Sulfur Ash + Black Pearl and MP.
- **Skirmish stub:** trigger a lightweight combat loop to test turn transitions.
- **UI panels:** party vitals, carry limits, and shared inventory totals update live.

## Developing
Install dependencies and run tests with [Vitest](https://vitest.dev/):

```bash
npm ci
npx vitest run
```

No build step is required—everything runs from ES modules.
