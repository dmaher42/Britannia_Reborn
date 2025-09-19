# Britannia Reborn

A fresh prototype of a top-down Britannia adventure. This build focuses on a single hero, stat-driven combat, and a connected overworld that can be saved and resumed.

## Quick start
- Open `index.html` in any modern browser (no server required).
- Click the canvas once if keyboard input is not captured.
- Explore with **WASD** or the arrow keys. Hold **Shift + arrows** to peek.
- Tap **C** / **I** / **J** to focus the character sheet, inventory, or journal panels.

## Systems in this slice
- **Character creator:** roll or tune STR/DEX/INT/VIT/LUK (10‑18) and begin with bespoke stats.
- **Derived combat stats:** HP = VIT×10, MP = INT×5, Attack = STR + weapon, Defense = VIT + armor.
- **Inventory + encumbrance:** equipment ≤ STR and backpack ≤ STR×2 with weight readouts and STR requirements on gear.
- **Turn-based combat:** Attack, Defend (+50% defense/−50% damage), or Use Item. Enemies scale with the current area.
- **Loot and leveling:** Item generator produces weapons, armor, reagents, and consumables. XP awards follow level²×100 and grant stat points on level-up.
- **Tile overworld:** a 20×20 forest transitions into a cave dungeon with collision, minimap, and random encounters.
- **Save system:** autosave on area transitions and level ups; manual save/load via the World panel (localStorage backed).

## Developing
Install dependencies and run tests with [Vitest](https://vitest.dev/):

```bash
npm ci
npx vitest run
```

No build step is required—everything runs from ES modules.
