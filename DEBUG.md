# Debug System Documentation

Britannia Reborn includes a comprehensive debug instrumentation system designed to help developers diagnose movement, camera, terrain, and performance issues during development while maintaining zero impact on production builds.

## Quick Start

### Enable Debug Mode

1. **URL Parameter**: Add `?debug=1` to the URL
   ```
   http://localhost:8080/index.html?debug=1
   ```

2. **Console Functions**: Use helper functions in browser console
   ```javascript
   window.enableDebug();   // Enable debug mode
   window.disableDebug();  // Disable debug mode
   ```

3. **Keyboard Toggle**: Press backtick (`` ` ``) to toggle debug overlay

### Auto-Disable in Production

Debug mode is automatically disabled unless:
- Running on localhost/127.0.0.1 **OR**
- URL contains `?debug=1` parameter

## Debug Features

### 1. Real-Time Debug Overlay

Press `` ` `` (backtick) to toggle the debug overlay showing:

- **FPS Counter**: Real-time frames per second and frame time
- **Frame Counter**: Current frame number  
- **Terrain Info**: Current terrain type and key
- **Speed Calculation**: Base speed × terrain modifier = final speed
- **Overweight Status**: Equipment and pack weight warnings
- **Camera Position**: Current camera coordinates
- **Leader Position**: Party leader world coordinates
- **Input Log**: Last 5 input events with timestamps
- **Force Flags**: Status of forced movement/camera

### 2. FPS and Performance Tracking

The system continuously tracks:
- Frame time (milliseconds per frame)
- Rolling 60-frame average for smooth FPS calculation
- Updates every 10 frames to reduce overhead

### 3. Collision Box / Tile Overlay

When debug overlay is visible:
- **Yellow grid**: Shows tile boundaries
- **Red highlight**: Current leader's tile
- **Transparent overlay**: Minimal visual interference

### 4. Input Event Logging

Ring buffer captures last 50 input events:
```javascript
{
  t: 12345.6,      // Timestamp (performance.now())
  type: 'down',    // 'down' or 'up'
  key: 'ArrowUp'   // Key identifier
}
```

### 5. Live Terrain & Status Panel

Real-time display of:
- **Terrain Type**: Name and key (e.g., "Swamp (SWAMP)")
- **Speed Modifiers**: 
  - SWAMP: 0.7× (70% speed)
  - FOREST: 0.86× (86% speed) 
  - ROAD: 1.22× (122% speed)
  - WATER: 0.5× (50% speed)
  - SAND: 0.92× (92% speed)
- **Overweight Flags**: 
  - `[EQUIP OVERWEIGHT]`: Equipped weight > STR
  - `[PACK OVERWEIGHT]`: Pack weight > STR × 2

### 6. Forced Movement Testing

Isolate movement and camera systems:

```javascript
window.forceMove(true);    // Leader moves right continuously
window.forceCamera(true);  // Camera scrolls horizontally

// Configure forced camera speed (default: 120px/s)
window.__DBG.TEST_SPEED = 200;
```

### 7. Diagnostic Snapshot Logging

Every 30 frames (configurable), logs detailed snapshots:
```javascript
{
  frame: 630,
  leader: { x: 612, y: 352 },
  camera: { camX: 123, camY: 31 },
  combat: { active: false, turn: "player" },
  pressedKeys: ["ArrowRight", "w"],
  dt: "0.016"
}
```

## Debug Object Reference

### `window.__DBG` Properties

```javascript
window.__DBG = {
  ENABLED: boolean,           // Main debug toggle
  FORCE_MOVE: boolean,        // Force rightward movement
  FORCE_CAMERA: boolean,      // Force camera scrolling
  TEST_SPEED: number,         // Forced camera speed (px/s)
  PRINT_FREQ: number,         // Snapshot frequency (frames)
  _frame: number,             // Current frame count
  last: number,               // Last frame time (ms)
  fps: number,                // Current FPS
  frameTimes: Array,          // Frame time history (60 frames)
  fpsSamples: Array,          // FPS samples for averaging
  inputLog: Array,            // Input event ring buffer
  MAX_INPUT_LOG: number,      // Max input events (50)
  AUTO_DISABLED: boolean,     // True if auto-disabled in production
  overlayVisible: boolean,    // Debug overlay visibility
  crosshairVisible: boolean   // Debug crosshair visibility
}
```

### `window.__DBG_REFS` (Debug Mode Only)

Core game object references for console inspection:
```javascript
window.__DBG_REFS = {
  party,      // Party system
  combat,     // Combat system
  keys,       // Input state
  inventory,  // Inventory system
  spells      // Spell system
}
```

## Helper Functions

### Core Debug Functions
```javascript
window.enableDebug()        // Enable debug mode and overlay
window.disableDebug()       // Disable debug mode completely  
window.forceMove(boolean)   // Toggle forced movement
window.forceCamera(boolean) // Toggle forced camera
```

### Example Usage
```javascript
// Enable debug and test movement isolation
window.enableDebug();
window.forceMove(true);

// Test camera movement without player input
window.forceCamera(true);
window.__DBG.TEST_SPEED = 300; // Faster camera

// Check current terrain effects
const leader = window.__DBG_REFS.party.leader;
console.log('Leader position:', leader.x, leader.y);
console.log('Current speed:', leader.speed());
```

## Diagnostic Decision Table

| Symptom | Likely Cause | Debug Steps |
|---------|-------------|-------------|
| Character not moving | Input not reaching movement | Check input log, verify key events |
| Slow movement | Terrain speed penalty | Check terrain panel, verify modifiers |
| Camera drift | Camera update logic | Use forced camera, check camera coords |
| Performance issues | Rendering bottleneck | Monitor FPS counter, check frame times |
| Collision issues | Tile boundary problems | Enable tile overlay, check collision boxes |
| Overweight penalties | Equipment/pack limits | Check overweight flags in status panel |

## Troubleshooting Guide

### Debug Not Working
1. Check if auto-disabled: `window.__DBG.AUTO_DISABLED`
2. Manually enable: `window.enableDebug()`
3. Verify URL parameter: `?debug=1`

### Performance Issues
1. Monitor FPS counter for drops
2. Check if frame times are consistent
3. Disable debug overlay if needed: press `` ` ``

### Movement Problems
1. Enable tile overlay to see boundaries
2. Use `forceMove(true)` to isolate input issues
3. Check terrain modifiers in status panel
4. Verify input log shows key events

### Camera Issues  
1. Use `forceCamera(true)` to test camera logic
2. Check camera coordinates in overlay
3. Adjust `TEST_SPEED` for different test scenarios

## Performance Impact

### Debug Disabled
- **Zero overhead**: All debug code paths use early returns
- **No DOM updates**: Overlay elements remain hidden
- **Minimal memory**: Debug objects exist but aren't populated

### Debug Enabled
- **Negligible impact**: < 1ms per frame overhead
- **Efficient rendering**: Debug overlays use simple drawing operations
- **Bounded memory**: Input log and frame history have fixed limits

## Integration Notes

The debug system is designed to:
- **Non-intrusive**: No changes to core game logic
- **Additive**: Can be safely removed without affecting gameplay
- **Modular**: Each feature can be independently enabled/disabled
- **Safe**: Auto-disables in production environments

## Example Debugging Session

```javascript
// 1. Enable debug mode
window.enableDebug();

// 2. Check if character is overweight
const refs = window.__DBG_REFS;
const leader = refs.party.leader;
console.log('STR:', leader.STR, 'Equipped:', leader.equippedWeight);

// 3. Test movement in isolation
window.forceMove(true);

// 4. Monitor terrain changes
// (Watch debug overlay as character moves through different terrain)

// 5. Test camera independently  
window.forceMove(false);
window.forceCamera(true);

// 6. Review input log for missed events
console.log('Recent inputs:', window.__DBG.inputLog.slice(0, 10));

// 7. Clean up
window.disableDebug();
```

This debug system provides comprehensive tools for diagnosing complex movement, camera, and performance issues while maintaining production performance and code cleanliness.