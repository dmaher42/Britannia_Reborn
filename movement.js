// Movement helpers for Britannia Reborn
// Refactored movement calculation and terrain modifier logic

import { TERRAIN, TILE } from './world.js';

/**
 * Calculate terrain speed modifier for a given terrain type
 * @param {string} terrainKey - The terrain key (e.g., 'SWAMP', 'FOREST')
 * @returns {number} Speed multiplier (0.0 - 2.0+)
 */
export function getTerrainSpeedModifier(terrainKey) {
  const modifiers = {
    'SWAMP': 0.7,
    'FOREST': 0.86,
    'ROAD': 1.22,
    'WATER': 0.5,
    'SAND': 0.92
  };
  
  return modifiers[terrainKey] || 1.0;
}

/**
 * Calculate final movement speed for a character at a position
 * @param {Object} character - Character with speed() method
 * @param {number} x - World X coordinate
 * @param {number} y - World Y coordinate
 * @returns {Object} {baseSpeed, modifier, finalSpeed, terrainKey}
 */
export function calculateMovementSpeed(character, x, y) {
  const terrain = TERRAIN.at(Math.floor(x / TILE), Math.floor(y / TILE));
  const baseSpeed = character.speed();
  const modifier = getTerrainSpeedModifier(terrain.key);
  const finalSpeed = baseSpeed * modifier;
  
  return {
    baseSpeed,
    modifier,
    finalSpeed,
    terrainKey: terrain.key,
    terrainName: terrain.name
  };
}

/**
 * Apply terrain effects to a character (poison from swamp, etc.)
 * @param {Object} character - Character to apply effects to
 * @param {string} terrainKey - Terrain key
 * @param {number} dt - Delta time for probability calculations
 */
export function applyTerrainEffects(character, terrainKey, dt) {
  if (terrainKey === 'SWAMP' && Math.random() < 0.02) {
    if (character.applyPoison) {
      character.applyPoison(1);
    }
  }
}

/**
 * Normalize movement vector to unit length
 * @param {number} mvx - X component
 * @param {number} mvy - Y component  
 * @returns {Object} {mvx, mvy} normalized
 */
export function normalizeMovement(mvx, mvy) {
  const len = Math.hypot(mvx, mvy) || 1;
  return {
    mvx: mvx / len,
    mvy: mvy / len
  };
}

/**
 * Process movement for a character including terrain effects
 * @param {Object} character - Character to move
 * @param {number} mvx - X movement input (-1 to 1)
 * @param {number} mvy - Y movement input (-1 to 1)  
 * @param {number} dt - Delta time
 * @returns {Object} Movement info for debugging
 */
export function processMovement(character, mvx, mvy, dt) {
  if (!mvx && !mvy) {
    return {moved: false};
  }
  
  const normalized = normalizeMovement(mvx, mvy);
  const speedInfo = calculateMovementSpeed(character, character.x, character.y);
  
  const deltaX = normalized.mvx * speedInfo.finalSpeed * dt;
  const deltaY = normalized.mvy * speedInfo.finalSpeed * dt;
  
  // Apply movement
  character.x += deltaX;
  character.y += deltaY;
  
  // Apply terrain effects
  applyTerrainEffects(character, speedInfo.terrainKey, dt);
  
  return {
    moved: true,
    deltaX,
    deltaY,
    speedInfo
  };
}