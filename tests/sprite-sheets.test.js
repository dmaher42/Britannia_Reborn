import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpriteRenderer } from '../SpriteRenderer.js';
import { PlaceholderGraphics } from '../PlaceholderGraphics.js';

// Mock canvas and context
const mockCanvas = {
  getContext: vi.fn(() => mockContext),
  width: 800,
  height: 600,
};

const mockContext = {
  imageSmoothingEnabled: false,
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  clearRect: vi.fn(),
};

// Mock Image constructor
global.Image = class MockImage {
  constructor() {
    this.src = '';
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.decoding = 'async';
    this._listeners = {};
  }
  
  addEventListener(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
  }
  
  // Simulate successful loading
  _triggerLoad() {
    this.complete = true;
    this.naturalWidth = 128;
    this.naturalHeight = 640;
    if (this._listeners.load) {
      this._listeners.load.forEach(callback => callback());
    }
  }
  
  // Simulate failed loading
  _triggerError() {
    if (this._listeners.error) {
      this._listeners.error.forEach(callback => callback(new Error('Load failed')));
    }
  }
};

describe('SpriteRenderer specific sprite sheet support', () => {
  let spriteRenderer;
  let placeholderGraphics;

  beforeEach(() => {
    vi.clearAllMocks();
    placeholderGraphics = new PlaceholderGraphics();
    spriteRenderer = new SpriteRenderer(mockCanvas, mockContext, {
      placeholderGraphics
    });
  });

  it('should define correct sprite sheet categories', () => {
    // Test that our new sprite sheet categories are properly defined
    expect(spriteRenderer).toBeDefined();
    
    // Test that core sprite sheets are loaded by default
    expect(spriteRenderer.spriteSheets.has('characters')).toBe(true);
    expect(spriteRenderer.spriteSheets.has('monsters')).toBe(true);
    expect(spriteRenderer.spriteSheets.has('player')).toBe(true);
    expect(spriteRenderer.spriteSheets.has('items')).toBe(true);
    expect(spriteRenderer.spriteSheets.has('tiles')).toBe(true);
    expect(spriteRenderer.spriteSheets.has('effects')).toBe(true);
    expect(spriteRenderer.spriteSheets.has('ui')).toBe(true);
  });

  it('should load specific sprite sheets on demand', () => {
    // Test that loading a specific sprite sheet creates the entry
    spriteRenderer.loadSpecificSpriteSheet('iolo');
    
    // The sprite sheet should be tracked even if not yet loaded
    expect(spriteRenderer.spriteSheets.has('iolo')).toBe(true);
    
    // The sheet record should exist
    const record = spriteRenderer.spriteSheets.get('iolo');
    expect(record).toBeDefined();
    expect(record.error).toBeNull();
  });

  it('should return correct preferred sprite sheet for NPCs', () => {
    // Test NPC preference without specific sheets loaded
    const ioloNPC = { name: 'Iolo', type: 'npc' };
    let preferred = spriteRenderer.getPreferredSpriteSheet(ioloNPC);
    expect(preferred).toBe('characters'); // Should fallback to generic
    
    // Test monster preference
    const ratMonster = { type: 'enemy', monsterType: 'rat' };
    preferred = spriteRenderer.getPreferredSpriteSheet(ratMonster);
    expect(preferred).toBe('monsters'); // Should fallback to generic monsters
    
    // Test player preference
    const player = { isPlayer: true };
    preferred = spriteRenderer.getPreferredSpriteSheet(player);
    expect(preferred).toBe('player'); // Should use player sheet
  });

  it('should handle placeholder colors for specific sprite sheets', () => {
    // Test that specific sprite sheets have defined placeholder colors
    spriteRenderer.drawPlaceholderRect(0, 0, 'iolo', 32, 32);
    expect(mockContext.fillRect).toHaveBeenCalled();
    
    spriteRenderer.drawPlaceholderRect(0, 0, 'shamino', 32, 32);
    expect(mockContext.fillRect).toHaveBeenCalled();
    
    spriteRenderer.drawPlaceholderRect(0, 0, 'rat', 32, 32);
    expect(mockContext.fillRect).toHaveBeenCalled();
  });

  it('should validate sprite sheet names', async () => {
    // Test that invalid sprite sheet names are rejected
    const result = await spriteRenderer.loadSpecificSpriteSheet('invalid_sheet_name');
    expect(result).toBe(false);
  });
});