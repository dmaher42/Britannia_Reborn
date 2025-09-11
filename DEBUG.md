# Debug System Documentation

This document describes the comprehensive debug instrumentation system for Britannia Reborn.

## Quick Start

### Enable Debug Mode
1. **URL Parameter**: Add `?debug=1` to the URL (e.g., `index.html?debug=1`)
2. **Runtime Toggle**: Press backtick (`` ` ``) to toggle debug mode on/off
3. **Console**: Use `window.enableDebug()` or `window.disableDebug()`

### Basic Commands
```javascript
// Toggle debug mode
window.enableDebug()
window.disableDebug()

// Force movement (moves leader steadily right)
window.forceMove(true)   // Enable
window.forceMove(false)  // Disable

// Force camera scrolling (scrolls background horizontally)
window.forceCamera(true)   // Enable  
window.forceCamera(false)  // Disable

// Access debug data
window.__DBG                    // Debug flags and counters
window.__DBG_REFS              // Core game objects (party, combat, keys, etc.)
window.__DBG.lastSnapshot      // Latest snapshot data
```

## Debug Object (`window.__DBG`)

The debug system exposes a global object with the following properties:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `ENABLED` | boolean | false | Main debug toggle (true if `?debug=1` in URL) |
| `FORCE_MOVE` | boolean | false | Forces leader to move steadily right |
| `FORCE_CAMERA` | boolean | false | Forces camera to scroll horizontally |
| `TEST_SPEED` | number | 120 | Speed for forced camera movement (pixels/second) |
| `PRINT_FREQ` | number | 30 | Snapshot logging frequency (every N frames) |
| `lastSnapshot` | object | null | Most recent snapshot data |
| `frameCounter` | number | 0 | Total frames rendered since start |

## Core References (`window.__DBG_REFS`)

When debug mode is active, core game objects are exposed for inspection:

- `party` - Party object with members, leader, methods
- `combat` - Combat system with active state, turn info, enemies
- `keys` - Current pressed keys object
- `inventory` - Shared inventory with items and gold
- `spells` - Spellbook with reagent tracking

## Snapshot Logging

When debug is enabled or any force flag is active, the system logs detailed snapshots every `PRINT_FREQ` frames:

```javascript
{
  frame: 1200,                           // Frame number
  leader: { x: 245, y: 156 },           // Leader world coordinates  
  camera: { camX: 123, camY: 31 },      // Camera position
  combat: { active: false, turn: "player" }, // Combat state
  pressedKeys: ["ArrowRight", "w"],     // Currently pressed keys
  dt: "0.016"                           // Delta time (seconds)
}
```

## Visual Debug Features

### Red Crosshair
When `ENABLED` is true, a small red crosshair appears at screen center to help verify:
- Camera positioning accuracy
- Screen center calculations
- Potential camera drift issues

### Console Logging
Debug actions are logged with `[DEBUG]` prefix:
- Mode changes: "Debug toggled: ON/OFF"
- Force flags: "Force move: ON/OFF", "Force camera: ON/OFF"  
- System init: "Debug system initialized. ENABLED: true"

## Diagnostic Decision Table

Use this table to diagnose common movement and camera issues:

| Issue | Test Procedure | Expected Result | Debug Command |
|-------|---------------|-----------------|---------------|
| Leader not moving | Enable force move | Leader moves steadily right | `window.forceMove(true)` |
| Camera not following | Check normal movement first, then force camera | Camera scrolls independent of leader | `window.forceCamera(true)` |
| Input lag/response | Check snapshot pressed keys vs actual input | Keys appear in snapshot when pressed | Monitor `lastSnapshot.pressedKeys` |
| Frame rate issues | Monitor snapshot dt values | dt should be ~0.016 (60fps) | Check `lastSnapshot.dt` |
| Combat turn bugs | Enable debug during combat | Combat state logged each snapshot | Monitor `lastSnapshot.combat` |
| Coordinate drift | Enable crosshair, check leader vs camera math | Leader should stay centered when moving | Visual crosshair + snapshot coords |

## Implementation Details

### Minimal Overhead
- All debug code is guarded with `if (!window.__DBG) return`
- Forced movement only runs when flags are set
- Snapshot logging early-returns when not needed
- No performance impact when debug disabled

### Integration Points
- **Bootstrap**: Debug system initializes immediately after imports
- **URL Parsing**: `?debug=1` parameter checked at startup
- **Loop Integration**: Forced movement happens BEFORE normal input processing
- **Helper Export**: Functions attached to window after objects are created

### Keyboard Handling
- Backtick (`` ` ``) toggles `ENABLED` flag
- Compatible with existing key handlers (H for hero marker)
- No interference with normal game input

## Example Usage Scenarios

### Isolate Movement Issues
```javascript
// Disable normal input, test forced movement only
window.forceMove(true)
// Observe if leader moves steadily right
// Check snapshot: leader coordinates should increase
```

### Test Camera System
```javascript  
// Test camera independent of leader movement
window.forceCamera(true)
// Background should scroll horizontally
// Leader should appear to move left relative to world
```

### Debug Combat Turn Logic
```javascript
// Enable debug, start combat, monitor state changes
window.enableDebug()
// Start combat via UI
// Check snapshot.combat.turn transitions: "player" -> "enemy" -> "player"
```

### Monitor Performance
```javascript
// Check frame timing consistency
window.enableDebug()
// Monitor console for snapshot dt values
// Look for spikes > 0.020 (under 50fps)
```

## Safety Notes

- Debug system only activates with explicit flags or URL parameter
- Core game logic unchanged when debug disabled
- All debug code designed to be removable without affecting game
- No secrets or sensitive data exposed in debug objects
- Debug helpers validate `window.__DBG` exists before operation

## Troubleshooting

**Debug not working:**
- Verify `window.__DBG` exists in console
- Check browser console for `[DEBUG]` initialization message
- Try `window.enableDebug()` manually

**Force movement not working:**
- Ensure `window.__DBG.FORCE_MOVE` is `true`
- Check if in combat with enemy turn (movement disabled)
- Verify leader object exists: `window.__DBG_REFS.party.leader`

**Snapshots not logging:**
- Enable debug: `window.enableDebug()` OR set any force flag
- Check frame counter advancing: `window.__DBG.frameCounter`
- Adjust frequency: `window.__DBG.PRINT_FREQ = 10` (every 10 frames)

**Crosshair not visible:**
- Ensure `window.__DBG.ENABLED` is `true`
- Check if crosshair obscured by other UI elements
- Try `window.enableDebug()` if using force flags only