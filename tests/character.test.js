import { describe, it, expect } from 'vitest';
import { Character } from '../Character.js';
import { Inventory } from '../inventory.js';

const createCharacter = (overrides = {}) => new Character({
  name: 'Test Hero',
  stats: { STR: 12, DEX: 11, INT: 10, VIT: 12, LUK: 10 },
  ...overrides,
});

describe('Character basics', () => {
  it('clamps base stats within allowed range', () => {
    const hero = new Character({ stats: { STR: 25, DEX: 2, INT: 18, VIT: 9, LUK: 22 } });
    expect(hero.stats.STR).toBeLessThanOrEqual(18);
    expect(hero.stats.DEX).toBeGreaterThanOrEqual(10);
    expect(hero.stats.VIT).toBeGreaterThanOrEqual(10);
  });

  it('computes derived stats from base values', () => {
    const hero = createCharacter({ stats: { STR: 14, DEX: 12, INT: 11, VIT: 13, LUK: 10 } });
    expect(hero.hpMax).toBe(130);
    expect(hero.mpMax).toBe(55);
    expect(hero.attack).toBe(hero.stats.STR);
    expect(hero.defense).toBe(hero.stats.VIT);
  });
});

describe('Character progression', () => {
  it('levels up when reaching xp thresholds and grants stat points', () => {
    const hero = createCharacter();
    const requiredXp = Character.xpForLevel(hero.level + 1);
    const result = hero.gainXp(requiredXp);
    expect(result.leveled).toBe(true);
    expect(hero.level).toBe(2);
    expect(hero.availableStatPoints).toBeGreaterThan(0);
  });

  it('allows allocating stat points and updates derived stats', () => {
    const hero = createCharacter({ availableStatPoints: 2 });
    expect(hero.allocateStat('STR')).toBe(true);
    expect(hero.stats.STR).toBe(13);
    expect(hero.availableStatPoints).toBe(1);
    expect(hero.attack).toBe(hero.stats.STR);
  });
});

describe('Equipment rules', () => {
  const sword = {
    id: 'iron_blade',
    name: 'Iron Blade',
    type: 'weapon',
    stats: { attack: 6, str_req: 12, weight: 3 },
    stackable: false,
    weight: 3,
  };

  it('prevents equipping items when strength requirement is not met', () => {
    const hero = createCharacter({ stats: { STR: 10, DEX: 11, INT: 10, VIT: 12, LUK: 10 } });
    expect(hero.canEquip(sword)).toBe(false);
  });

  it('tracks equipment and backpack weight limits', () => {
    const hero = createCharacter();
    expect(hero.canEquip(sword)).toBe(true);
    expect(hero.equip(sword)).toBe(true);
    expect(hero.equippedWeight()).toBeCloseTo(3);
    expect(hero.addToBackpack({ id: 'ore', name: 'Ore', weight: 30 })).toBe(false);
    expect(hero.addToBackpack({ id: 'ore', name: 'Ore', weight: 4 })).toBe(true);
    expect(hero.backpackWeight()).toBeCloseTo(4);
  });
});

describe('Inventory system', () => {
  it('stacks consumables and removes them when used', () => {
    const inventory = new Inventory();
    inventory.add({ id: 'potion', name: 'Potion', type: 'consumable', stackable: true, quantity: 2, stats: { hp_restore: 20 } });
    expect(inventory.count('potion')).toBe(2);
    expect(inventory.consume('potion', 1)).toBe(true);
    expect(inventory.count('potion')).toBe(1);
    expect(inventory.consume('potion', 1)).toBe(true);
    expect(inventory.count('potion')).toBe(0);
  });
});

