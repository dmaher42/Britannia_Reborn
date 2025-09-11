# Debug Utilities for Britannia Reborn

This document describes the developer debug utilities available in Britannia Reborn to help diagnose movement and camera issues.

## Overview

The debug system provides utilities to force player movement and camera panning independent of normal input and game state, along with detailed logging to help diagnose issues like "player does not move" or "camera is static".

## Enabling Debug Mode

### URL Parameter
Add `?debug=1` to the URL to automatically enable debug mode:
```
index.html?debug=1
```

### Manual Activation
Debug features can be enabled at any time through the browser console using the convenience functions described below.

## Debug Features

### Force Movement
When enabled, the player character will move continuously to the right at a fixed speed, bypassing all normal input handling and combat turn restrictions.

**Console Commands:**
- `enableForceMove()` - Start forced rightward movement
- `disableForceMove()` - Stop forced movement

**Behavior:**
- Player moves right at 200 pixels/second
- Camera follows the player automatically
- Terrain effects (swamp slowdown, road speedup) still apply
- Combat turn restrictions are bypassed
- Normal keyboard input is ignored while active

### Force Camera Panning
When enabled, the camera will pan continuously to the right independent of player position.

**Console Commands:**
- `enableForceCamera()` - Start forced camera panning
- `disableForceCamera()` - Stop camera panning

**Behavior:**
- Camera pans right at 100 pixels/second
- Player position remains unchanged
- Works simultaneously with normal movement or force movement
- Creates a scrolling background effect

### Debug Logging
Provides detailed console output about game state every N frames.

**Console Commands:**
- `enableDebugLogging()` - Enable periodic debug output
- `disableDebugLogging()` - Disable debug output
- `setDebugPrintFreq(n)` - Set logging frequency (default: every 30 frames)

**Log Information:**
- Frame count and delta time
- Player position coordinates
- Camera position
- Combat state (active/inactive, current turn)
- Currently pressed keys
- Player movement speed and overweight status
- Active debug flags

### Visual Debug Indicator
When any debug feature is active, a red crosshair appears at the center of the screen to help visualize camera position and scrolling.

## Debug Object

All debug state is stored in `window.__DBG`:

```javascript
window.__DBG = {
  ENABLED: false,      // Master debug flag
  FORCE_MOVE: false,   // Force movement active
  FORCE_CAMERA: false, // Force camera panning active
  PRINT_FREQ: 30,      // Frames between debug logs
  _frameCount: 0       // Internal frame counter
}
```

## Usage Examples

### Diagnosing "Player Won't Move"
1. Enable debug mode: `?debug=1` or `enableDebugLogging()`
2. Try normal movement (WASD/arrows)
3. Check debug logs for:
   - Are keys being registered?
   - Is combat blocking movement?
   - Is player speed correct?
   - Are coordinates changing?
4. Test with force movement: `enableForceMove()`
   - If this works, the issue is with input/game logic
   - If this doesn't work, the issue is with rendering/camera

### Diagnosing "Camera Is Static"
1. Enable force camera: `enableForceCamera()`
2. Check if background scrolls
   - If yes: camera logic works, issue is with camera-following-player
   - If no: camera rendering issue
3. Check debug logs for camera coordinates changing

### Testing Camera Following
1. Enable force movement: `enableForceMove()`
2. Watch red crosshair and player position
3. Camera should keep player centered on screen

## Implementation Notes

- Debug features are designed to have no impact on normal gameplay when disabled
- All debug code is guarded by conditional checks to minimize performance impact
- Debug logging is throttled to prevent console spam
- Force movement uses fixed speeds for predictable testing
- Debug state is exposed globally for easy console access

## Safety

- Game functions normally with all debug flags false
- No debug state persists between page reloads
- Debug features cannot break save data or game progression
- All changes are runtime-only and reversible

## Troubleshooting Debug Tools

If debug commands don't work:
1. Check browser console for errors
2. Verify `window.__DBG` object exists
3. Try refreshing with `?debug=1` parameter
4. Ensure you're calling functions from the main window context

## Development Notes

The debug system was implemented to help diagnose reported issues with player movement and camera positioning. It provides both automated testing capabilities (force movement/camera) and detailed logging for manual investigation.

Key implementation details:
- Debug initialization happens early in main.js
- Force movement bypasses normal input processing
- Force camera operates independently of player position
- Red crosshair helps visualize camera center
- Logging is configurable and non-intrusive