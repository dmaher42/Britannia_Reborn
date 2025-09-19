import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../Character.js';
import { Player } from '../Player.js';
import { Inventory } from '../inventory.js';
import { CombatEngine } from '../CombatEngine.js';

const createCombat = (overrides = {}) => {
  const character = new Character({ stats: { STR: 12, DEX: 10, INT: 10, VIT: 12, LUK: 10 } });
  const player = new Player(character, { x: 2, y: 2, area: 'forest' });
  const inventory = new Inventory();
  const combat = new CombatEngine({
    player,
    inventory,
    rng: () => 0, // deterministic damage multiplier (0.8)
    onRespawn: () => {},
    ...overrides,
  });
  return { combat, character, player, inventory };
};

const basicEnemy = () => ({
  id: 'goblin',
  name: 'Goblin',
  hp: 24,
  hpMax: 24,
  attack: 8,
  defense: 4,
  level: 1,
});

describe('CombatEngine', () => {
  let combat;
  let character;
  let inventory;

  beforeEach(() => {
    ({ combat, character, inventory } = createCombat());
  });

  it('applies damage when the player attacks', () => {
    combat.start([basicEnemy()]);
    const result = combat.attack('goblin');
    expect(result.success).toBe(true);
    const state = combat.getState();
    const enemy = state.enemies[0];
    // Base damage: (attack 12 - defense 4) * 0.8 = 6.4 -> 6
    expect(enemy.hp).toBe(18);
  });

  it('reduces incoming damage when defending', () => {
    const enemy = basicEnemy();
    enemy.attack = 20;
    combat.start([enemy]);
    const hpBefore = character.hp;
    combat.defend();
    const hpAfter = character.hp;
    expect(hpBefore - hpAfter).toBeLessThan(3);
  });

  it('allows using consumables during combat', () => {
    inventory.add({
      id: 'potion',
      name: 'Potion',
      type: 'consumable',
      stackable: true,
      quantity: 1,
      stats: { hp_restore: 40 },
    });
    combat.start([basicEnemy()]);
    character.takeDamage(30);
    const hpBefore = character.hp;
    const result = combat.useItem('potion');
    expect(result.success).toBe(true);
    expect(character.hp).toBeGreaterThan(hpBefore);
    expect(inventory.count('potion')).toBe(0);
  });
});

