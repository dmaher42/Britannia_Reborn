import { describe, it, expect, vi, afterEach } from 'vitest';
import { ModernUI } from '../ModernUI.js';
import { LightingSystem } from '../LightingSystem.js';
import { SpellSystem } from '../SpellSystem.js';
import { RealTimeCombat } from '../RealTimeCombat.js';

const createMockContext = () => ({
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillRect: vi.fn(),
  translate: vi.fn(),
  arc: vi.fn(),
  fillText: vi.fn(),
  clearRect: vi.fn(),
  imageSmoothingEnabled: false,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ModernUI', () => {
  it('toggles inventory visibility and renders panels without roundRect support', () => {
    const ctx = createMockContext();
    const canvas = { width: 320, height: 240, getContext: () => ctx };
    const spriteRenderer = { ctx, drawSprite: vi.fn(), tileSize: 32, scale: 2 };
    const party = { members: [], sharedInventory: [] };
    const ui = new ModernUI(canvas, spriteRenderer, party);

    expect(ui.inventoryVisible).toBe(false);
    ui.toggleInventory();
    expect(ui.inventoryVisible).toBe(true);
    ui.setInventoryVisible(false);
    expect(ui.inventoryVisible).toBe(false);

    const inventoryPanel = ui.panels.get('inventory');
    expect(inventoryPanel.visible()).toBe(false);
    ui.setInventoryVisible(true);
    expect(inventoryPanel.visible()).toBe(true);

    ui.renderPanelBackground(10, 10, 60, 40);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.quadraticCurveTo).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});

describe('LightingSystem', () => {
  it('updates flickering light intensity over time', () => {
    const originalDocument = globalThis.document;
    const lightCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      globalCompositeOperation: 'source-over',
    };
    const lightCanvas = { width: 0, height: 0, getContext: () => lightCtx };
    globalThis.document = { createElement: () => lightCanvas };

    const canvas = { width: 200, height: 200, getContext: () => lightCtx };
    const worldRenderer = { worldToScreen: () => ({ x: 0, y: 0 }), tileDisplaySize: 64 };
    const lighting = new LightingSystem(canvas, worldRenderer);

    const light = {
      worldX: 0,
      worldY: 0,
      radius: 2,
      intensity: 0.5,
      color: '#ffffff',
      radiusIsPixels: false,
      flickering: true,
      flickerSpeed: 0,
      lastFlicker: 0,
    };

    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(200);
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9);

    try {
      lighting.updateFlicker(light);

      expect(light.intensity).toBeGreaterThan(0.5);
      expect(light.intensity).toBeLessThanOrEqual(1);
      expect(light.lastFlicker).toBe(200);
    } finally {
      nowSpy.mockRestore();
      randomSpy.mockRestore();
      if (typeof originalDocument === 'undefined') {
        delete globalThis.document;
      } else {
        globalThis.document = originalDocument;
      }
    }
  });
});

describe('SpellSystem', () => {
  it('creates projectile and explosion effects when casting fireball', () => {
    const world = {
      createEffect: vi.fn(),
      showMessage: vi.fn(),
      showFloatingDamage: vi.fn(),
    };
    const spellSystem = new SpellSystem({ members: [] }, {}, { world });
    const caster = { x: 5, y: 5, int: 12 };
    const target = { x: 6, y: 6 };
    const enemy = { x: 6, y: 6, health: { current: 20, max: 20 }, takeDamage: vi.fn(() => 5) };
    spellSystem.getEnemiesInArea = vi.fn(() => [enemy]);

    spellSystem.castFireball(caster, target);

    expect(world.createEffect).toHaveBeenNthCalledWith(1, 'fireball', 5, 5, 6, 6);
    expect(world.createEffect).toHaveBeenNthCalledWith(2, 'fire_explosion', 6, 6);
    expect(world.showFloatingDamage).toHaveBeenCalledWith(6, 6, 5);
    expect(world.showMessage).toHaveBeenCalled();
  });
});

describe('RealTimeCombat', () => {
  it('triggers slash effects and blood particles on hit', () => {
    const world = { createEffect: vi.fn(), spawnParticles: vi.fn() };
    const combat = new RealTimeCombat({ members: [] }, [], world);
    combat.triggerCombatEffects({ name: 'Avatar' }, { x: 4, y: 5 });

    expect(world.createEffect).toHaveBeenCalledWith('sword_slash', 4, 5);
    expect(world.spawnParticles).toHaveBeenCalledWith('blood', 4, 5);
  });
});

