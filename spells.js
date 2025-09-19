import { clamp } from './utils.js';

export const spells = {
  fire_dart: {
    id: 'fire_dart',
    name: 'Fire Dart',
    mpCost: 6,
    reagents: [
      { id: 'sulfur_ash', qty: 1 },
      { id: 'black_pearl', qty: 1 }
    ],
    minInt: 5,
    description: 'Launches a dart of flame at a distant foe.'
  }
};

export class Spellbook {
  constructor(inventory, party) {
    this.inventory = inventory;
    this.party = party;
  }

  get(spellId) {
    return spells[spellId] || null;
  }

  canCast(spellId, caster) {
    const spell = this.get(spellId);
    if (!spell || !caster) return false;
    if (caster.mp < spell.mpCost) return false;
    if (typeof spell.minInt === 'number' && caster.INT < spell.minInt) return false;
    return spell.reagents.every(({ id, qty }) => this.inventory.count(id) >= qty);
  }

  cast(spellId, caster) {
    const spell = this.get(spellId);
    if (!spell) return false;
    if (!this.canCast(spellId, caster)) return false;

    for (const { id, qty } of spell.reagents) {
      if (!this.inventory.consume(id, qty)) {
        return false;
      }
    }

    caster.mp = clamp(caster.mp - spell.mpCost, 0, caster.mpMax ?? spell.mpCost);
    return true;
  }
}

export function castFireDart(caster, spellbook) {
  return spellbook.cast('fire_dart', caster);
}
