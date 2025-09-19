import { describe, it, expect, beforeEach } from 'vitest';
import { Party } from '../party.js';
import { CombatSystem } from '../combat.js';
import { Inventory } from '../inventory.js';
import { Spellbook } from '../spells.js';

const createParty = (overrides = {}) => {
  const baseMember = {
    name: 'Avatar',
    STR: 12,
    DEX: 10,
    INT: 10,
    hpMax: 32,
    hp: 32,
    mp: 20
  };
  return new Party([{ ...baseMember, ...overrides }]);
};

describe('CombatSystem', () => {
  let inventory;
  let party;

  beforeEach(() => {
    inventory = new Inventory();
    party = createParty();
  });

  it('resolves victory when a player attack defeats the last enemy', () => {
    const spellbook = new Spellbook(inventory, party);
    const combat = new CombatSystem(party, { spellbook, enemyDelay: 0 });
    const completions = [];
    combat.onEvent((event, payload) => {
      if (event === 'complete') {
        completions.push(payload);
      }
    });

    expect(
      combat.startSkirmish([
        { id: 'wolf', name: 'Dire Wolf', hp: 9, hpMax: 9, atk: 4, initiative: 11 }
      ])
    ).toBe(true);

    const result = combat.playerAttack('wolf');
    expect(result.success).toBe(true);
    expect(result.defeated).toBe(true);
    expect(combat.getState().active).toBe(false);
    expect(completions).toHaveLength(1);
    expect(completions[0].victory).toBe(true);
  });

  it('processes enemy retaliation that can defeat the party', () => {
    party = createParty({ hpMax: 16, hp: 16 });
    const combat = new CombatSystem(party, { enemyDelay: 0 });
    const completions = [];
    combat.onEvent((event, payload) => {
      if (event === 'complete') {
        completions.push(payload);
      }
    });

    expect(
      combat.startSkirmish([
        { id: 'ogre', name: 'Ogre', hp: 28, hpMax: 28, atk: 24, initiative: 12 }
      ])
    ).toBe(true);

    const result = combat.playerAttack('ogre');
    expect(result.success).toBe(true);
    expect(combat.active).toBe(true);

    combat.update(0.01);

    expect(party.members[0].hp).toBe(0);
    expect(combat.active).toBe(false);
    expect(completions).toHaveLength(1);
    expect(completions[0].victory).toBe(false);
  });

  it('executes enemy actions according to initiative order', () => {
    const combat = new CombatSystem(party, { enemyDelay: 0 });
    const logs = [];
    combat.onEvent((event, payload) => {
      if (event === 'log') {
        logs.push(payload);
      }
    });

    expect(
      combat.startSkirmish([
        { id: 'mage', name: 'Shadow Mage', hp: 24, hpMax: 24, atk: 7, initiative: 16 },
        { id: 'brute', name: 'Orc Brute', hp: 30, hpMax: 30, atk: 9, initiative: 8 }
      ])
    ).toBe(true);

    const attackResult = combat.playerAttack('mage');
    expect(attackResult.success).toBe(true);

    combat.update(0.01);

    const strikeLogs = logs.filter((entry) =>
      typeof entry === 'string' && entry.includes('strikes Avatar')
    );
    expect(strikeLogs.length).toBeGreaterThanOrEqual(2);
    expect(strikeLogs[0]).toContain('Shadow Mage');
    expect(strikeLogs[1]).toContain('Orc Brute');
  });

  it('allows spellcasting to end a skirmish and consume resources', () => {
    inventory.add({ id: 'sulfur_ash', name: 'Sulfur Ash', weight: 0.1, qty: 2, tag: 'reagent' });
    inventory.add({ id: 'black_pearl', name: 'Black Pearl', weight: 0.1, qty: 2, tag: 'reagent' });
    const spellbook = new Spellbook(inventory, party);
    const combat = new CombatSystem(party, { spellbook, enemyDelay: 0 });
    const completions = [];
    combat.onEvent((event, payload) => {
      if (event === 'complete') {
        completions.push(payload);
      }
    });

    expect(
      combat.startSkirmish([
        { id: 'imp', name: 'Lesser Imp', hp: 12, hpMax: 12, atk: 3, initiative: 10 }
      ])
    ).toBe(true);

    const leader = party.leader;
    const mpBefore = leader.mp;

    const castResult = combat.playerCast('fire_dart', 'imp');
    expect(castResult.success).toBe(true);
    expect(combat.getState().active).toBe(false);
    expect(leader.mp).toBe(mpBefore - 6);
    expect(inventory.count('sulfur_ash')).toBe(1);
    expect(inventory.count('black_pearl')).toBe(1);
    expect(completions).toHaveLength(1);
    expect(completions[0].victory).toBe(true);
  });
});
