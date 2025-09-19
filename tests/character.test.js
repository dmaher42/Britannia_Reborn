import { describe, it, expect } from 'vitest';
import { Character, CharacterClass } from '../party.js';
import { Inventory } from '../inventory.js';

const demoItem = (overrides = {}) => ({ id: 'chain_mail', name: 'Chain Mail', weight: 6, qty: 1, equip: 'torso', ...overrides });

describe('Character MP per class', () => {
  it('Avatar and Lord British get INT*2 MP', () => {
    const avatar = new Character({ name: 'A', cls: CharacterClass.Avatar, STR: 10, DEX: 10, INT: 8 });
    const lordBritish = new Character({ name: 'LB', cls: CharacterClass.LordBritish, STR: 10, DEX: 10, INT: 8 });
    expect(avatar.mpMax).toBe(16);
    expect(lordBritish.mpMax).toBe(16);
  });
  it('Bard/Ranger get INT/2 MP', () => {
    const bard = new Character({ name: 'B', cls: CharacterClass.Bard, STR: 10, DEX: 10, INT: 8 });
    const ranger = new Character({ name: 'R', cls: CharacterClass.Ranger, STR: 10, DEX: 10, INT: 8 });
    expect(bard.mpMax).toBe(4);
    expect(ranger.mpMax).toBe(4);
  });
  it('Other classes get 0 MP', () => {
    const fighter = new Character({ name: 'F', cls: CharacterClass.Fighter, STR: 10, DEX: 10, INT: 8 });
    expect(fighter.mpMax).toBe(0);
  });
});

describe('Equipment and pack weight limits', () => {
  it('Equipped weight must not exceed STR', () => {
    const c = new Character({ name: 'A', cls: CharacterClass.Fighter, STR: 5, DEX: 5, INT: 5 });
    expect(c.equip(demoItem({ weight: 6 }))).toBe(false);
    expect(c.equip(demoItem({ weight: 5 }))).toBe(true);
    expect(c.equippedWeight()).toBe(5);
    expect(c.isOverweight()).toBe(false);
    c.equipment.torso = demoItem({ weight: 6 });
    expect(c.isOverweight()).toBe(true);
  });
  it('Retains previous gear when new item would exceed STR', () => {
    const c = new Character({ name: 'A', cls: CharacterClass.Fighter, STR: 5, DEX: 5, INT: 5 });
    const lightArmor = demoItem({ id: 'leather', name: 'Leather', weight: 4 });
    const heavyArmor = demoItem({ id: 'plate', name: 'Plate', weight: 6 });
    expect(c.equip(lightArmor)).toBe(true);
    expect(c.equipment.torso.id).toBe('leather');
    expect(c.equip(heavyArmor)).toBe(false);
    expect(c.equipment.torso.id).toBe('leather');
  });
  it('Backpack weight must not exceed STR*2', () => {
    const c = new Character({ name: 'A', cls: CharacterClass.Fighter, STR: 5, DEX: 5, INT: 5 });
    expect(c.addToBackpack({ id: 'rock', name: 'Rock', weight: 6, qty: 2 })).toBe(false);
    expect(c.addToBackpack({ id: 'rock', name: 'Rock', weight: 4, qty: 2 })).toBe(true);
    expect(c.backpackWeight()).toBe(8);
    expect(c.isOverweight()).toBe(false);
    c.backpack.push({ id: 'heavy', name: 'Heavy', weight: 3, qty: 2 });
    expect(c.isOverweight()).toBe(true);
  });
});

describe('Inventory consumables', () => {
  it('consume reduces quantity and removes entry when depleted', () => {
    const inventory = new Inventory([
      { id: 'healing_potion', name: 'Healing Potion', weight: 0.3, qty: 2, tag: 'consumable' }
    ]);

    expect(inventory.consume('healing_potion', 1)).toBe(true);
    expect(inventory.count('healing_potion')).toBe(1);

    expect(inventory.consume('healing_potion', 1)).toBe(true);
    expect(inventory.count('healing_potion')).toBe(0);
    expect(inventory.items.some((item) => item.id === 'healing_potion')).toBe(false);

    expect(inventory.consume('healing_potion', 1)).toBe(false);
  });
});

describe('Movement speed when overweight', () => {
  it('reduces speed when character is overweight', () => {
    const c = new Character({ name: 'A', cls: CharacterClass.Fighter, STR: 5, DEX: 5, INT: 5 });
    c.baseSpeed = 100;
    expect(c.speed()).toBe(100);
    c.equipment.torso = demoItem({ weight: 6 });
    expect(c.isOverweight()).toBe(true);
    expect(c.speed()).toBeCloseTo(60);
  });
});
