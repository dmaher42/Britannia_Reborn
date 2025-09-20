import { Item } from './WorldObject.js';

const DEFAULT_UNIT_WEIGHT = 0.1;

export class ReagentSystem {
  constructor() {
    this.reagents = {
      black_pearl: { name: 'Black Pearl', rarity: 'common', value: 5 },
      blood_moss: { name: 'Blood Moss', rarity: 'common', value: 3 },
      garlic: { name: 'Garlic', rarity: 'abundant', value: 1 },
      ginseng: { name: 'Ginseng', rarity: 'common', value: 4 },
      mandrake_root: { name: 'Mandrake Root', rarity: 'rare', value: 15 },
      nightshade: { name: 'Nightshade', rarity: 'rare', value: 12 },
      spider_silk: { name: 'Spider Silk', rarity: 'uncommon', value: 8 },
      sulfurous_ash: { name: 'Sulfurous Ash', rarity: 'uncommon', value: 6 },
    };
  }

  getReagent(type) {
    return this.reagents[type] ?? null;
  }

  listReagents() {
    return Object.keys(this.reagents).map((key) => ({
      type: key,
      ...this.reagents[key],
    }));
  }

  createReagent(type, quantity = 1, options = {}) {
    const data = this.getReagent(type);
    if (!data) {
      throw new Error(`Unknown reagent type: ${type}`);
    }
    const amount = Number.isFinite(quantity) ? Math.max(1, Math.round(quantity)) : 1;
    const unitWeight = Number.isFinite(options.unitWeight) ? Math.max(0, options.unitWeight) : DEFAULT_UNIT_WEIGHT;
    const id = options.id ?? `reagent_${type}_${Date.now()}`;
    const item = new Item(id, data.name, options.x ?? 0, options.y ?? 0, {
      description:
        options.description ?? `A measured portion of ${data.name.toLowerCase()} stored carefully for spellcraft.`,
      stackable: true,
      quantity: amount,
      weight: unitWeight * amount,
      canUse: true,
      flags: { reagentType: type, rarity: data.rarity },
    });
    item.type = 'reagent';
    item.reagentType = type;
    item.unitWeight = unitWeight;
    item.value = data.value;
    item.rarity = data.rarity;
    if (typeof item.onUse !== 'function') {
      item.onUse = () => ({
        success: true,
        message: 'You study the reagent, imagining how it might blend with others.',
      });
    }
    return item;
  }
}

export const REAGENT_TYPES = Object.freeze([
  'black_pearl',
  'blood_moss',
  'garlic',
  'ginseng',
  'mandrake_root',
  'nightshade',
  'spider_silk',
  'sulfurous_ash',
]);
