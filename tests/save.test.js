import { describe, it, expect } from 'vitest';
import { SaveManager, buildSaveData } from '../SaveManager.js';
import { Character } from '../Character.js';
import { Player } from '../Player.js';
import { GameMap } from '../GameMap.js';
import { Inventory } from '../inventory.js';
import { ItemGenerator } from '../ItemGenerator.js';

describe('SaveManager', () => {
  it('stores and retrieves serialized game data', () => {
    const storage = new Map();
    const fakeStorage = {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    };
    const manager = new SaveManager('test-slot', fakeStorage);

    const character = new Character();
    const player = new Player(character, { x: 3, y: 4, area: 'forest' });
    const map = new GameMap();
    const inventory = new Inventory();
    inventory.gold = 25;

    manager.save(buildSaveData({ character, player, map, inventory }));
    const loaded = manager.load();

    expect(loaded).toBeTruthy();
    expect(loaded.inventoryGold).toBe(25);
    expect(loaded.character.name).toBe(character.name);
  });
});

describe('ItemGenerator', () => {
  it('creates loot appropriate for the requested level', () => {
    const generator = new ItemGenerator(() => 0.9); // deterministic high roll
    const loot = generator.rollLoot(3);
    expect(Array.isArray(loot)).toBe(true);
    expect(loot.length).toBeGreaterThan(0);
    const item = loot[0];
    expect(['weapon', 'armor', 'consumable']).toContain(item.type);
  });
});

