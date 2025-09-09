import { describe, it, expect } from 'vitest';
import { Spellbook, spells } from '../spells.js';

const makeInventory = (items = []) => ({
  count: id => items.find(i => i.id === id)?.qty || 0,
  consume: (id, n) => {
    const it = items.find(i => i.id === id);
    if (!it || it.qty < n) return false;
    it.qty -= n;
    return true;
  }
});

describe('Spellbook reagent casting rules', () => {
  it('Cannot cast if missing reagents', () => {
    const inv = makeInventory([{ id: 'sulfur_ash', qty: 0 }, { id: 'black_pearl', qty: 1 }]);
    const sb = new Spellbook(inv, { members: [] });
    const caster = { mp: 10, INT: 10 };
    expect(sb.canCast('fire_dart', caster)).toBe(false);
  });
  it('Cannot cast if missing MP', () => {
    const inv = makeInventory([{ id: 'sulfur_ash', qty: 1 }, { id: 'black_pearl', qty: 1 }]);
    const sb = new Spellbook(inv, { members: [] });
    const caster = { mp: 2, INT: 10 };
    expect(sb.canCast('fire_dart', caster)).toBe(false);
  });
  it('Can cast if all costs met', () => {
    const inv = makeInventory([{ id: 'sulfur_ash', qty: 1 }, { id: 'black_pearl', qty: 1 }]);
    const sb = new Spellbook(inv, { members: [] });
    const caster = { mp: 10, INT: 10 };
    expect(sb.canCast('fire_dart', caster)).toBe(true);
  });
});
