// Movement system tests for Britannia Reborn
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getTerrainSpeedModifier,
  calculateMovementSpeed,
  normalizeMovement,
  processMovement
} from '../movement.js';

describe('Movement System', () => {
  describe('getTerrainSpeedModifier', () => {
    it('should return correct modifiers for different terrain types', () => {
      expect(getTerrainSpeedModifier('SWAMP')).toBe(0.7);
      expect(getTerrainSpeedModifier('FOREST')).toBe(0.86);
      expect(getTerrainSpeedModifier('ROAD')).toBe(1.22);
      expect(getTerrainSpeedModifier('WATER')).toBe(0.5);
      expect(getTerrainSpeedModifier('SAND')).toBe(0.92);
    });
    
    it('should return 1.0 for unknown terrain types', () => {
      expect(getTerrainSpeedModifier('UNKNOWN')).toBe(1.0);
      expect(getTerrainSpeedModifier('GRASS')).toBe(1.0);
    });
  });
  
  describe('normalizeMovement', () => {
    it('should normalize diagonal movement correctly', () => {
      const result = normalizeMovement(1, 1);
      expect(result.mvx).toBeCloseTo(0.7071, 3);
      expect(result.mvy).toBeCloseTo(0.7071, 3);
    });
    
    it('should handle cardinal directions', () => {
      expect(normalizeMovement(1, 0)).toEqual({ mvx: 1, mvy: 0 });
      expect(normalizeMovement(0, 1)).toEqual({ mvx: 0, mvy: 1 });
      expect(normalizeMovement(-1, 0)).toEqual({ mvx: -1, mvy: 0 });
    });
    
    it('should handle zero movement', () => {
      const result = normalizeMovement(0, 0);
      expect(result.mvx).toBe(0);
      expect(result.mvy).toBe(0);
    });
  });
});