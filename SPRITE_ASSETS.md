# Sprite Asset Reference Guide

This document provides a complete reference for all sprite sheet files that the Britannia Reborn game can load, along with their expected locations and naming conventions.

## File Locations

All sprite sheets should be placed in the `/assets/` directory relative to the game root.

## Core Sprite Sheets (Required)

These sprite sheets are loaded at game startup and are essential for basic functionality:

| Filename | Location | Purpose | Fallback Behavior |
|----------|----------|---------|-------------------|
| `characters.png` | `/assets/characters.png` | Generic character sprites for all classes | Colored placeholder (blue) |
| `monsters.png` | `/assets/monsters.png` | Generic monster sprites for all types | Colored placeholder (red) |
| `player.png` | `/assets/player.png` | Player character sprite sheet | Colored placeholder (purple) |
| `items.png` | `/assets/items.png` | Item and object sprites | Colored placeholder (gold) |
| `tiles.png` | `/assets/tiles.png` | Environment and terrain tiles | Colored placeholder (green) |
| `effects.png` | `/assets/effects.png` | Visual effects and particles | Colored placeholder (magenta) |
| `ui.png` | `/assets/ui.png` | User interface elements | Colored placeholder (gray) |

## NPC-Specific Sprite Sheets (Optional)

These are loaded on-demand when specific NPCs are encountered:

| Filename | Location | Purpose | Fallback Behavior |
|----------|----------|---------|-------------------|
| `iolo.png` | `/assets/iolo.png` | Specific sprites for Iolo the Bard | Falls back to `characters.png` |
| `shamino.png` | `/assets/shamino.png` | Specific sprites for Shamino the Ranger | Falls back to `characters.png` |
| `avatar.png` | `/assets/avatar.png` | Specific sprites for the Avatar/player | Falls back to `player.png` |

## Monster-Specific Sprite Sheets (Optional)

These are loaded on-demand for specific monster encounters:

| Filename | Location | Purpose | Fallback Behavior |
|----------|----------|---------|-------------------|
| `rat.png` | `/assets/rat.png` | Specific rat sprites | Falls back to `monsters.png` |
| `bat.png` | `/assets/bat.png` | Specific bat sprites | Falls back to `monsters.png` |
| `skeleton.png` | `/assets/skeleton.png` | Specific skeleton sprites | Falls back to `monsters.png` |
| `slime.png` | `/assets/slime.png` | Specific slime sprites | Falls back to `monsters.png` |
| `orc.png` | `/assets/orc.png` | Specific orc sprites | Falls back to `monsters.png` |
| `troll.png` | `/assets/troll.png` | Specific troll sprites | Falls back to `monsters.png` |
| `dragon.png` | `/assets/dragon.png` | Specific dragon sprites | Falls back to `monsters.png` |

## Sprite Sheet Specifications

### Technical Requirements
- **Tile Size**: 32×32 pixels per sprite
- **Scaling**: Designed for 2× scaling in-game (appears as 64×64 on screen)
- **Format**: PNG with transparency support recommended

### Character Sprite Layout
Character sprite sheets (including NPC-specific ones) should follow this layout:
- **4 directions**: south, west, east, north (rows 0-3 for each action)
- **5 actions**: idle, walk, attack, cast, die (columns representing frame sequences)
- **4 classes** (for generic characters): fighter, mage, bard, ranger (separate row sets)
- **4 frames per animation** laid out horizontally
- **Total dimensions**: 128×640 pixels (4 frames × 32px × 20 rows)

### Monster Sprite Layout
Monster sprite sheets use a simpler layout:
- **3 actions**: idle, walk, attack (rows 0-2)
- **4 frames per animation** laid out horizontally
- **Total dimensions**: 128×96 pixels (4 frames × 32px × 3 rows)

## Code References

The sprite loading system is implemented across several files:

### SpriteRenderer.js
- `CORE_SPRITE_SHEETS`: Array of required sprite sheets
- `NPC_SPRITE_SHEETS`: Array of optional NPC-specific sheets
- `MONSTER_SPRITE_SHEETS`: Array of optional monster-specific sheets
- `loadSpecificSpriteSheet(name)`: Method to load optional sheets on-demand
- `getPreferredSpriteSheet(character)`: Method to select appropriate sheet for a character

### WorldRenderer.js
- `resolveNpcAnimation(npc)`: Determines animation name and loads specific NPC sheets
- `resolveEnemyAnimation(enemy)`: Determines animation name and loads specific monster sheets

### AnimationSystem.js
- `setupSpecificNPCAnimations()`: Creates animations for specific NPCs
- Animation naming convention: `{name}_{direction}_{action}` (e.g., `iolo_south_walk`)

## Console Output

The game provides helpful console messages about sprite loading:

### Success Messages
- `✅ Loaded sprite sheet: {name}` - Image file loaded successfully
- `✅ Placeholder ready for: {name}` - Using placeholder graphics (file missing)

### Warning Messages
- `⚠️ Using placeholder for: {name}` - Could not load image, using placeholder
- `Unknown sprite sheet requested: {name}` - Invalid sprite sheet name

### Testing
Use `spriteRenderer.testPlaceholders()` in the browser console to check the status of all loaded sprite sheets.

## Adding Custom Sprites

### Step-by-Step Guide

1. **Create your sprite sheet** following the layout specifications above
2. **Name the file** according to the table (e.g., `iolo.png` for Iolo's sprites)
3. **Place the file** in the `/assets/` directory
4. **Restart the game** - the sprites will be loaded automatically when needed
5. **Verify loading** by checking the browser console for success messages

### Example: Adding Iolo's Custom Sprites
```
1. Create iolo.png (128×640 pixels)
2. Layout sprites in the standard character format:
   - Rows 0-3: south-facing (idle, walk, attack, cast, die)
   - Rows 4-7: west-facing (idle, walk, attack, cast, die)
   - Rows 8-11: east-facing (idle, walk, attack, cast, die)
   - Rows 12-15: north-facing (idle, walk, attack, cast, die)
   - Each animation has 4 frames horizontally
3. Save as /assets/iolo.png
4. Game will automatically use it when Iolo appears
```

## Troubleshooting

### Common Issues
- **404 errors in console**: Normal when sprite files are missing, game uses placeholders
- **Sprites not loading**: Check file path and name match exactly (case-sensitive)
- **Wrong sprites showing**: Verify the character/monster name matches the expected trigger

### Debug Commands
```javascript
// In browser console:
spriteRenderer.testPlaceholders();                    // Show all sprite sheet status
spriteRenderer.loadSpecificSpriteSheet('iolo');       // Force load specific sheet
spriteRenderer.getPreferredSpriteSheet({name: 'Iolo'}); // Check preferred sheet for character
```

This system provides complete flexibility for customizing character and monster appearances while maintaining full backward compatibility with the existing sprite system.