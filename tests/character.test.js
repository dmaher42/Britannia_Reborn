import { describe, it, expect } from 'vitest';
import { Character, CharacterClass } from '../party.js';

const demoItem = (overrides = {}) => ({ id: 'chain_mail', name: 'Chain Mail', weight: 6, qty: 1, equip: 'torso', ...overrides });

describe('Character MP per class', () => {
  it('Avatar gets INT*2 MP', () => {
    const c = new Character({ name: 'A', cls: CharacterClass.Avatar, STR: 10, DEX: 10, INT: 8 });
    expect(c.mpMax).toBe(16);
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
