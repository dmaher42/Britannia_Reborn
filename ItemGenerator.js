const weaponBases = [
  { id: 'rusted_blade', name: 'Rusted Blade', attack: 3, weight: 2.5, strReq: 10 },
  { id: 'longsword', name: 'Longsword', attack: 6, weight: 3.2, strReq: 12 },
  { id: 'warhammer', name: 'Warhammer', attack: 9, weight: 5, strReq: 14 },
];

const armorBases = [
  { id: 'leather_coat', name: 'Leather Coat', defense: 4, weight: 4.2, strReq: 10 },
  { id: 'chain_mail', name: 'Chain Mail', defense: 6, weight: 5.5, strReq: 12 },
  { id: 'plate_mail', name: 'Plate Mail', defense: 8, weight: 7.2, strReq: 14 },
];

const consumables = [
  {
    id: 'health_potion',
    name: 'Health Draught',
    type: 'consumable',
    stats: { hp_restore: 40, weight: 0.4 },
    value: 25,
    stackable: true,
  },
  {
    id: 'mana_potion',
    name: 'Mana Tonic',
    type: 'consumable',
    stats: { mp_restore: 30, weight: 0.3 },
    value: 32,
    stackable: true,
  },
];

const materials = [
  { id: 'silver_ore', name: 'Silver Ore', type: 'material', value: 18, weight: 1.4, stackable: true },
  { id: 'spider_silk', name: 'Spider Silk', type: 'material', value: 22, weight: 0.2, stackable: true },
];

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

const scaleValue = (base, level) => Math.round(base + level * 1.25);

export class ItemGenerator {
  constructor(rng = Math.random) {
    this.rng = rng;
  }

  weapon(level = 1) {
    const base = pick(weaponBases, this.rng);
    const scaledAttack = scaleValue(base.attack, level * 0.8);
    return {
      id: `${base.id}_${level}`,
      name: base.name,
      type: 'weapon',
      stats: { attack: scaledAttack, str_req: base.strReq, weight: base.weight },
      value: 50 + level * 20,
      stackable: false,
      weight: base.weight,
    };
  }

  armor(level = 1) {
    const base = pick(armorBases, this.rng);
    const scaledDefense = scaleValue(base.defense, level * 0.6);
    return {
      id: `${base.id}_${level}`,
      name: base.name,
      type: 'armor',
      stats: { defense: scaledDefense, str_req: base.strReq, weight: base.weight },
      value: 40 + level * 18,
      stackable: false,
      weight: base.weight,
    };
  }

  consumable(level = 1) {
    const base = pick(consumables, this.rng);
    const bonus = level > 1 ? Math.round(level * 10) : 0;
    const stats = { ...base.stats };
    if (stats.hp_restore) stats.hp_restore += bonus;
    if (stats.mp_restore) stats.mp_restore += bonus;
    return {
      ...base,
      quantity: 1,
      value: base.value + level * 4,
    };
  }

  material(level = 1) {
    const base = pick(materials, this.rng);
    return {
      ...base,
      quantity: 1,
      value: base.value + level * 3,
    };
  }

  rollLoot(level = 1) {
    const loot = [];
    const roll = this.rng();
    if (roll > 0.7) {
      loot.push(this.weapon(level));
    } else if (roll > 0.4) {
      loot.push(this.armor(level));
    } else {
      loot.push(this.consumable(level));
    }
    if (this.rng() > 0.6) {
      loot.push(this.material(level));
    }
    return loot;
  }
}

