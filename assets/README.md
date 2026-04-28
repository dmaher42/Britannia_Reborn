# Art placeholders

Binary sprite sheets are not committed. Add your artwork here with the following filenames so the renderer can find them:

## Core Sprite Sheets (Required)
These are loaded at game startup and are required for basic functionality:

- `characters.png` - Generic character sprites (32×32 tiles, classes: fighter, mage, bard, ranger)
- `monsters.png` - Generic monster sprites (32×32 tiles, types: rat, bat, skeleton, slime)
- `items.png` - Item and object sprites (32×32 tiles)
- `tiles.png` - Environment tiles (32×32 tiles)
- `effects.png` - Visual effects and particles (32×32 tiles)
- `ui.png` - User interface elements (various sizes)
- `player.png` - Player character sprite sheet (32×32 tiles)

## Specific NPC Sprite Sheets (Optional)
These are loaded on-demand when specific NPCs are encountered:

- `iolo.png` - Specific sprites for Iolo the Bard (same layout as characters.png)
- `shamino.png` - Specific sprites for Shamino the Ranger (same layout as characters.png)
- `avatar.png` - Specific sprites for the Avatar/player character (same layout as characters.png)

## Monster-Specific Sprite Sheets (Optional)
These are loaded on-demand for specific monster encounters:

- `rat.png` - Specific rat sprites (32×32 tiles)
- `bat.png` - Specific bat sprites (32×32 tiles)
- `skeleton.png` - Specific skeleton sprites (32×32 tiles)
- `slime.png` - Specific slime sprites (32×32 tiles)
- `orc.png` - Specific orc sprites (32×32 tiles)
- `troll.png` - Specific troll sprites (32×32 tiles)
- `dragon.png` - Specific dragon sprites (32×32 tiles)

## Sprite Sheet Layout

### Character Sprite Sheets
Character sprite sheets should follow this layout:
- **4 directions** (south, west, east, north) × **5 actions** (idle, walk, attack, cast, die)
- **4 classes** for generic characters: fighter (row 0), mage (row 1), bard (row 2), ranger (row 3)
- Each animation frame is **32×32 pixels**
- **4 frames per animation** laid out horizontally
- Each character class takes up multiple rows: 4 directions × 5 actions = 20 rows per class

### Monster Sprite Sheets
Monster sprite sheets use a simpler layout:
- **3 actions** (idle, walk, attack) laid out vertically
- Each monster type in the generic monsters.png corresponds to specific rows
- Monster-specific sheets use the same action layout but only for that monster type

### Technical Details
- All sprites should be **32×32 pixels** per tile
- Designed for **2× scaling** in-game (will appear as 64×64 on screen)
- Missing files trigger console warnings but do not break the game
- The game falls back to generic sprite sheets if specific ones are not available
- Use placeholder graphics (colored rectangles) when image files are missing

## Usage Examples

To add Iolo's custom sprites:
1. Create `iolo.png` with the same 20-row layout as `characters.png`
2. Place it in the `/assets/` folder
3. The game will automatically load and use it when Iolo appears

To add custom rat sprites:
1. Create `rat.png` with 3 rows (idle, walk, attack)
2. Place it in the `/assets/` folder  
3. The game will use it instead of the generic monsters.png for rats
