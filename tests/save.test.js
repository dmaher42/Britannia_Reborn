import { describe, it, expect } from 'vitest';
import { SaveManager, buildSaveData } from '../SaveManager.js';
import { Character } from '../Character.js';
import { Player } from '../Player.js';
import { GameMap } from '../GameMap.js';
import { Inventory } from '../inventory.js';
import { ItemGenerator } from '../ItemGenerator.js';
import { WorldObject } from '../WorldObject.js';
import { ReagentSystem } from '../ReagentSystem.js';
import { NPC } from '../DialogueEngine.js';

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

describe('WorldObject.fromJSON', () => {
  it('rehydrates reagent stacks with metadata intact', () => {
    const reagents = new ReagentSystem();
    const reagent = reagents.createReagent('ginseng', 3, { x: 5, y: 7 });
    reagent.flags = { ...reagent.flags, infused: true };
    const serialized = reagent.toJSON();

    const roundTrip = WorldObject.fromJSON(serialized);
    expect(roundTrip).not.toBe(reagent);
    expect(roundTrip).toBeInstanceOf(WorldObject);
    expect(roundTrip.type).toBe('reagent');
    expect(roundTrip.x).toBe(5);
    expect(roundTrip.y).toBe(7);
    expect(roundTrip.quantity).toBe(3);
    expect(roundTrip.stackable).toBe(true);
    expect(roundTrip.flags.reagentType).toBe('ginseng');
    expect(roundTrip.flags.infused).toBe(true);

    const stashJSON = {
      id: 'stash_1',
      name: 'Secret Stash',
      type: 'stash',
      x: 1,
      y: 2,
      contains: [serialized],
    };

    const stash = WorldObject.fromJSON(stashJSON);
    expect(stash.type).toBe('stash');
    expect(Array.isArray(stash.contains)).toBe(true);
    expect(stash.contains).toHaveLength(1);
    const nested = stash.contains[0];
    expect(nested).toBeInstanceOf(WorldObject);
    expect(nested.type).toBe('reagent');
    expect(nested.quantity).toBe(3);
    expect(nested.flags.reagentType).toBe('ginseng');
  });

  it('rehydrates NPCs through class-specific factories', () => {
    const npc = new NPC('Iolo', 12, 6, {
      id: 'npc_iolo',
      profession: 'bard',
      schedule: { morning: 'tavern' },
      canTalk: true,
      dialogues: {
        job: {
          responses: ['I sing tales of valor.'],
          hints: ['ask about music'],
        },
      },
      defaultResponses: ['Perhaps another time.'],
    });
    npc.flags = { alignment: 'friendly' };
    npc.weight = 0;
    npc.canGet = true;
    npc.canUse = true;

    const serialized = npc.toJSON();
    const restored = WorldObject.fromJSON(serialized);

    expect(restored).toBeInstanceOf(NPC);
    expect(restored.id).toBe('npc_iolo');
    expect(restored.name).toBe('Iolo');
    expect(restored.x).toBe(12);
    expect(restored.y).toBe(6);
    expect(restored.profession).toBe('bard');
    expect(restored.schedule).toEqual({ morning: 'tavern' });
    expect(restored.defaultResponses).toEqual(['Perhaps another time.']);
    expect(restored.dialogues.job.responses).toEqual(['I sing tales of valor.']);
    expect(restored.dialogues.job.hints).toEqual(['ask about music']);
    expect(restored.flags.alignment).toBe('friendly');
    expect(restored.weight).toBe(0);
    expect(restored.canGet).toBe(true);
    expect(restored.canUse).toBe(true);
  });
});

