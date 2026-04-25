# Britannia Reborn — Premium Art Bible

This document is the visual source of truth for **Britannia Reborn**. Use it when creating, reviewing, or integrating sprites, tiles, UI, effects, portraits, and environment assets.

The goal is not basic placeholder art. The goal is a cohesive, premium, polished retro fantasy RPG style.

---

## 1. Core Visual Direction

**Britannia Reborn** should look like a high-end retro fantasy RPG with:

- premium 32-bit-style pixel art
- crisp pixel edges
- strong silhouettes
- rich shading
- readable gameplay sprites
- medieval royal fantasy atmosphere
- cohesive asset quality across characters, environments, UI, and effects

The game should avoid looking like a collection of unrelated assets. Every asset should feel like it belongs to the same world.

---

## 2. Visual Keywords

Use these keywords when briefing or generating new assets:

```text
premium pixel art, polished 32-bit fantasy RPG, crisp sprite work, transparent background, clean silhouette, detailed shading, medieval fantasy, regal, heroic, antique gold, crimson, ivory, steel, warm torchlight, high readability, game-ready asset
```

Avoid these qualities:

```text
simple, basic, flat, cartoon, chibi, blurry, soft painting, low detail, rough sketch, generic mobile game, plastic, neon, modern clothing, inconsistent style
```

---

## 3. Palette Direction

The core palette should feel royal, ancient, heroic, and grounded.

### Royal colours

- deep crimson red
- antique gold
- ivory white
- parchment cream

### Armour and equipment colours

- polished silver
- dark steel
- charcoal black
- aged bronze
- dark leather brown

### World colours

- moss green
- forest green
- warm brown
- stone grey
- muted blue-grey

### Accent colours

- ruby red
- sapphire blue
- emerald green
- magical gold glow
- warm orange torchlight

---

## 4. Lighting Rules

Use a consistent lighting direction:

```text
main light from upper-left
```

This means:

- highlights appear on top-left edges
- shadows fall toward the lower-right
- metal should have small bright highlights
- fabric should show darker folds underneath
- props and characters should have subtle grounding shadows

### Interior lighting

Castle, throne room, dungeon, and tavern interiors should use:

- warm torchlight
- orange glow near flames
- darker corners
- subtle vignette where suitable
- rich red and gold tones

### Outdoor lighting

Town, road, forest, and wilderness areas should use:

- softer natural light
- earthy contrast
- less gold glow
- muted greens, browns, greys, and blues

---

## 5. Sprite and Asset Size Standards

### World tiles

```text
32x32 tiles
```

Use for:

- floors
- walls
- paths
- terrain
- furniture grid placement
- basic props

### Important standing characters

```text
48x64 per frame
```

Use for:

- player character
- Lord British standing/walking
- important NPCs
- royal guards
- companions
- elite enemies

This size gives enough room for premium detail while still working in a tile-based world.

### Special large assets

```text
64x80 or 64x96
```

Use for:

- seated Lord British
- thrones
- large bosses
- major statues
- magical story objects
- large decorative props

### Portraits

```text
128x128 minimum
192x192 preferred
```

Use for:

- dialogue windows
- profile panels
- inventory/status screens
- story moments

---

## 6. Character Hierarchy

Not all assets need the same level of detail. Use hierarchy to make important characters stand out.

### Tier 1 — Highest detail

Use highest polish for:

- player character
- Lord British
- major story NPCs
- main companions
- major villains

Expected quality:

- 48x64 sprites
- strong silhouette
- distinctive colour identity
- detailed shading
- portrait support
- multiple animations

### Tier 2 — Medium detail

Use polished but slightly simpler treatment for:

- royal guards
- merchants
- healers
- blacksmiths
- quest NPCs
- elite enemies

Expected quality:

- clear role identity
- consistent palette
- solid idle/walk animation
- less ornamentation than Tier 1 characters

### Tier 3 — Lower detail but still clean

Use simpler treatment for:

- villagers
- minor NPCs
- basic enemies
- filler props

Expected quality:

- still cohesive
- still sharp
- still readable
- no rough placeholders in final scenes

---

## 7. Player Character Standard

The player character is the visual benchmark for the game.

### Direction

```text
Regal Avatar / Chosen Champion
```

The player should feel:

- heroic
- active
- important
- noble but not royal
- ready for adventure
- visually distinct from Lord British and generic guards

### Visual features

The player should include:

- detailed armour
- layered cloak or mantle
- visible boots and gloves
- belt and pouch details
- signature colour accent
- readable face or helmet
- weapon-ready silhouette

### Suggested colours

- steel or silver armour
- deep blue, crimson, or forest green cloak
- gold trim
- dark leather
- ivory highlights

The player should not look like Lord British. Lord British represents royal authority. The player represents heroic action.

---

## 8. Lord British Standard

Lord British should be treated as a major story character and royal visual anchor.

### Direction

He should feel:

- wise
- powerful
- benevolent
- regal
- older
- calm
- iconic

### Required features

- golden crown
- grey beard
- red royal cloak
- white fur trim
- silver armour
- gold details
- throne association
- strong facial presence

### Required future asset set

Lord British should eventually have:

1. seated throne sprite
2. standing/walking sprite sheet
3. dialogue portrait
4. talking or hand-raise gesture
5. blessing or magical aura animation

---

## 9. Royal Guard Standard

Royal guards should support the throne room and Lord British visually.

They should feel:

- disciplined
- loyal
- armoured
- formal
- royal, but less important than Lord British

### Features

- silver armour
- red/gold accents
- helmet
- shield, spear, or sword
- clean stance
- strong silhouette

### Future variants

- spear guard
- shield guard
- captain guard
- elite royal guard

---

## 10. Animation Standards

### Player character

Recommended animation set:

```text
idle
walk
attack
interact
cast/special
hurt
downed/death
```

### Major NPCs

Recommended animation set:

```text
idle
walk
talk gesture
special gesture
```

### Basic NPCs

Recommended animation set:

```text
idle
walk
```

### Enemies

Recommended animation set:

```text
idle
walk
attack
hurt/death
```

---

## 11. Frame Standards

### Basic animation

```text
4 frames per direction
```

Use for:

- idle
- basic walk
- simple NPC movement

### Better animation

```text
6 frames per direction
```

Use for:

- player walk
- attack
- spell casting
- boss movement

### Direction standard

Start with 4 directions:

```text
south/front
west/left
east/right
north/back
```

Diagonal directions can be added later if the engine and asset pipeline support them.

---

## 12. Environment Asset Rules

### Floors

Floors should not be flat single-colour surfaces. Use:

- cracks
- scuffs
- worn edges
- subtle colour shifts
- chipped stone
- occasional stains
- tile variation

### Walls

Walls should have:

- depth
- brick variation
- decorative trim
- shadows near the floor
- banners, panels, or carvings where appropriate

### Props

Props should have:

- clear silhouette
- correct perspective
- subtle shadow
- matching palette
- believable material detail

---

## 13. Throne Room Standard

The throne room is a showcase environment.

It should communicate:

```text
power, history, royalty, order, and mystery
```

### Required throne room assets

- polished stone floor tiles
- red carpet
- gold/red throne
- seated Lord British
- royal banners
- marble columns
- wall torches
- braziers
- pedestal
- royal crest
- floor cracks and wear
- subtle glow and shadows

### Composition

The room should be:

- symmetrical
- throne at top centre
- player enters from bottom
- carpet leads to throne
- guards placed left and right
- torches balanced on both sides

---

## 14. UI Art Direction

The UI should match the premium fantasy style.

Use:

- dark wood
- parchment
- antique gold borders
- subtle red accents
- clean readable text
- jewel-like icons
- elegant dialogue boxes

Avoid:

- plain modern boxes
- bright flat web colours
- generic UI panels
- mismatched fonts
- overly busy screens

A premium character will look unfinished if the UI remains basic, so UI polish is part of the art direction.

---

## 15. Portrait Rules

Portraits should feel like higher-detail versions of the sprites.

Portraits should use:

- polished pixel-art or retro illustration style
- matching sprite colours
- readable facial expression
- clean background or transparent background
- consistent fantasy frame style

Portraits needed first:

1. player character
2. Lord British
3. royal guard captain
4. first major companion
5. first villain

---

## 16. Asset File Naming Rules

Use clear names so asset integration is predictable.

### Characters

```text
player_champion_sheet_48x64.png
player_champion_portrait_192.png
lord_british_walk_sheet_48x64.png
lord_british_seated_throne_64x96.png
royal_guard_spear_sheet_48x64.png
```

### Props

```text
throne_gold_red_64x96.png
banner_crimson_gold_32x64.png
brazier_lit_32x32.png
column_marble_32x64.png
pedestal_stone_32x32.png
```

### UI

```text
ui_dialogue_frame_gold.png
ui_inventory_frame_wood.png
ui_heart_icon.png
ui_gold_icon.png
```

---

## 17. Suggested Long-Term Folder Structure

Use this as a long-term target only. Do not force a restructure if the current code expects a simpler structure.

```text
assets/
  characters/
    player/
    lord-british/
    guards/
    npcs/
    companions/
    enemies/
  props/
    throne-room/
    dungeon/
    town/
    forest/
  tiles/
    castle/
    town/
    wilderness/
    dungeon/
  fx/
    magic/
    fire/
    hit/
    aura/
  ui/
    portraits/
    icons/
    frames/
```

Important: extend the current canonical asset-loading system. Do not create parallel asset systems.

---

## 18. Quality Checklist

Every new asset should pass this checklist.

### Visual quality

- Does it look premium?
- Does it match the palette?
- Does it have clean pixel edges?
- Is it readable at gameplay scale?
- Does it have a strong silhouette?
- Does the lighting match upper-left lighting?

### Technical quality

- Is the background transparent?
- Is the sprite aligned correctly?
- Are frames evenly spaced?
- Is the frame size clear?
- Is image smoothing disabled in game?
- Does the asset avoid blur?
- Does it load without console errors?

### Game quality

- Does it improve the scene visually?
- Does it fit the world?
- Does it avoid breaking movement/collision?
- Does it feel worth keeping?

---

## 19. Immediate Asset Roadmap

### 1. Player Character — Regal Avatar / Chosen Champion

Deliverables:

```text
player_champion_sheet_48x64.png
player_champion_portrait_192.png
```

Animations:

```text
idle
walk
attack
interact/cast
```

### 2. Lord British Complete Pack

Deliverables:

```text
lord_british_seated_throne_64x96.png
lord_british_walk_sheet_48x64.png
lord_british_portrait_192.png
```

### 3. Royal Guard Pack

Deliverables:

```text
royal_guard_spear_sheet_48x64.png
royal_guard_shield_sheet_48x64.png
```

### 4. Throne Room Prop Pack

Deliverables:

```text
throne_gold_red_64x96.png
banner_crimson_gold_32x64.png
brazier_lit_32x32.png
column_marble_32x64.png
pedestal_stone_32x32.png
```

### 5. UI Fantasy Frame Pack

Deliverables:

```text
ui_dialogue_frame_gold.png
ui_character_portrait_frame.png
ui_inventory_panel.png
ui_heart_icon.png
ui_gold_icon.png
```

---

## 20. Short Source-of-Truth Summary

```text
Britannia Reborn uses premium 32-bit-style fantasy pixel art with crisp edges, strong silhouettes, rich shading, and a cohesive medieval royal fantasy palette. Major characters use 48x64 sprites, special seated/throne assets use 64x80 or 64x96, and portraits use 128x128 or 192x192. The main lighting direction is upper-left, with warm torchlit interiors and subtle shadows.

Core palette: crimson red, antique gold, ivory, steel/silver, dark leather, charcoal, parchment, ruby, sapphire, emerald, and warm orange torchlight.

Asset hierarchy: Tier 1 = player, Lord British, major story NPCs, major villains. Tier 2 = guards, companions, named NPCs, elite enemies. Tier 3 = villagers, basic enemies, filler props.

Main player direction: Regal Avatar / Chosen Champion. Lord British direction: wise, benevolent royal ruler with crown, grey beard, red cloak, white fur trim, silver armour, and gold details.

All future assets should be transparent PNGs, game-ready, sharply pixelated, consistently aligned, and visually cohesive. Avoid basic, flat, blurry, cartoon, or mismatched assets.
```
