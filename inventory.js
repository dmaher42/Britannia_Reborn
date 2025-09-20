import { WorldObject } from './WorldObject.js';

const normalizeItem = (item) => {
  if (!item || typeof item !== 'object') {
    throw new TypeError('Invalid item provided to inventory.');
  }

  const quantity = Number.isFinite(item.quantity)
    ? Math.max(0, Math.round(item.quantity))
    : Number.isFinite(item.qty)
    ? Math.max(0, Math.round(item.qty))
    : 1;

  const weight = Number.isFinite(item.weight)
    ? item.weight
    : Number.isFinite(item?.stats?.weight)
    ? item.stats.weight
    : 0;

  const stats = { ...(item.stats ?? {}) };
  if (!Number.isFinite(stats.weight)) {
    stats.weight = weight;
  }

  return {
    id: item.id,
    name: item.name ?? item.id,
    type: item.type ?? item.tag ?? 'material',
    stats,
    value: Number.isFinite(item.value) ? item.value : 0,
    stackable: item.stackable ?? !item.equip,
    quantity,
    weight,
    description: item.description ?? '',
    meta: item.meta ? { ...item.meta } : undefined,
  };
};

const cloneItem = (item) => JSON.parse(JSON.stringify(item));

export class Inventory {
  constructor(items = []) {
    this.items = [];
    this.gold = 0;
    items.forEach((item) => this.add(item));
  }

  _findIndex(id) {
    return this.items.findIndex((entry) => entry.id === id);
  }

  get(id) {
    return this.items[this._findIndex(id)] ?? null;
  }

  add(item) {
    const normalized = normalizeItem(item);
    if (!normalized.id) throw new Error('Inventory items require an id.');

    const existingIndex = this._findIndex(normalized.id);
    if (existingIndex !== -1 && this.items[existingIndex].stackable && normalized.stackable) {
      this.items[existingIndex].quantity += normalized.quantity;
      this.items[existingIndex].weight = normalized.weight;
      this.items[existingIndex].stats = { ...normalized.stats };
      return cloneItem(this.items[existingIndex]);
    }

    this.items.push(cloneItem(normalized));
    return cloneItem(normalized);
  }

  remove(id, quantity = 1) {
    const index = this._findIndex(id);
    if (index === -1) return false;
    const entry = this.items[index];
    const amount = Number.isFinite(quantity) ? Math.max(0, Math.round(quantity)) : 0;
    if (amount <= 0) return true;

    if (entry.quantity > amount) {
      entry.quantity -= amount;
      return true;
    }

    this.items.splice(index, 1);
    return true;
  }

  consume(id, quantity = 1) {
    const entry = this.get(id);
    if (!entry || entry.quantity < quantity) return false;
    return this.remove(id, quantity);
  }

  count(id) {
    const entry = this.get(id);
    return entry ? entry.quantity : 0;
  }

  listByType(type) {
    return this.items.filter((item) => item.type === type).map((item) => cloneItem(item));
  }

  totalWeight() {
    return this.items.reduce((total, item) => total + item.weight * item.quantity, 0);
  }

  toJSON() {
    return this.items.map((item) => cloneItem(item));
  }

  loadFrom(data = []) {
    this.items = [];
    if (!Array.isArray(data)) return;
    data.forEach((item) => {
      try {
        this.add(item);
      } catch (error) {
        console.warn('Failed to load item', item, error);
      }
    });
  }
}

export const ItemHelpers = {
  weightOf: (item) => (item ? item.weight ?? item?.stats?.weight ?? 0 : 0),
  isEquippable: (item) => item?.type === 'weapon' || item?.type === 'armor' || item?.type === 'accessory',
  isConsumable: (item) => item?.type === 'consumable',
};

const weightOfWorld = (object) => (object instanceof WorldObject ? object.weight ?? 0 : 0);

export class WorldInventory {
  constructor(character = null, data = null) {
    this.character = character ?? null;
    this.equipped = {
      weapon: null,
      armor: null,
      accessory: null,
    };
    this.backpack = [];
    if (data) {
      this.loadFrom(data);
    }
  }

  setCharacter(character) {
    this.character = character;
  }

  _strength() {
    return this.character?.stats?.STR ?? 10;
  }

  equippedWeight() {
    return ['weapon', 'armor', 'accessory'].reduce(
      (total, slot) => total + weightOfWorld(this.equipped[slot]),
      0
    );
  }

  backpackWeight() {
    return this.backpack.reduce((total, item) => total + weightOfWorld(item), 0);
  }

  totalWeight() {
    return this.equippedWeight() + this.backpackWeight();
  }

  canCarry(object) {
    if (!(object instanceof WorldObject)) return false;
    const weight = weightOfWorld(object);
    const carryLimit = this._strength() * 2;
    return this.backpackWeight() + weight <= carryLimit;
  }

  add(object) {
    if (!(object instanceof WorldObject)) {
      try {
        const created = WorldObject.fromJSON(object);
        return this.add(created);
      } catch (error) {
        console.warn('Failed to add non-world object to inventory', object, error);
        return false;
      }
    }
    if (!this.canCarry(object)) {
      return false;
    }
    this.backpack.push(object);
    return true;
  }

  remove(id) {
    const index = this.backpack.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const [removed] = this.backpack.splice(index, 1);
    return removed ?? null;
  }

  has(id) {
    return Boolean(this.backpack.find((item) => item.id === id) || this.findEquipped(id));
  }

  find(id) {
    return this.backpack.find((item) => item.id === id) ?? this.findEquipped(id);
  }

  findEquipped(id) {
    return (
      this.equipped.weapon?.id === id
        ? this.equipped.weapon
        : this.equipped.armor?.id === id
        ? this.equipped.armor
        : this.equipped.accessory?.id === id
        ? this.equipped.accessory
        : null
    );
  }

  equip(id) {
    const index = this.backpack.findIndex((item) => item.id === id);
    if (index === -1) {
      return { success: false, message: 'That is not in the packs.' };
    }
    const item = this.backpack[index];
    const slot = this.slotFor(item);
    if (!slot) {
      return { success: false, message: 'That cannot be equipped.' };
    }
    const current = this.equipped[slot];
    const projected = this.equippedWeight() - weightOfWorld(current) + weightOfWorld(item);
    if (projected > this._strength()) {
      return { success: false, message: 'You lack the strength to equip that.' };
    }
    this.backpack.splice(index, 1);
    this.equipped[slot] = item;
    if (current) {
      this.backpack.push(current);
    }
    return { success: true, previous: current };
  }

  unequip(slot) {
    if (!['weapon', 'armor', 'accessory'].includes(slot)) {
      return { success: false, message: 'Invalid slot.' };
    }
    const item = this.equipped[slot];
    if (!item) {
      return { success: false, message: 'Nothing equipped there.' };
    }
    if (!this.canCarry(item)) {
      return { success: false, message: 'Your packs are too heavy.' };
    }
    this.equipped[slot] = null;
    this.backpack.push(item);
    return { success: true, item };
  }

  drop(id) {
    const item = this.remove(id);
    if (item) return item;
    const slots = ['weapon', 'armor', 'accessory'];
    for (const slot of slots) {
      if (this.equipped[slot]?.id === id) {
        const removed = this.equipped[slot];
        this.equipped[slot] = null;
        return removed;
      }
    }
    return null;
  }

  use(id, context = {}) {
    const item = this.find(id);
    if (!item || typeof item.onUse !== 'function') {
      return { success: false, message: 'That cannot be used.' };
    }
    const result = item.onUse({ ...context, inventory: this });
    if (result?.consumed) {
      const removed = this.remove(id);
      if (!removed) {
        const slots = ['weapon', 'armor', 'accessory'];
        slots.forEach((slot) => {
          if (this.equipped[slot]?.id === id) {
            this.equipped[slot] = null;
          }
        });
      }
    }
    return result ?? { success: true };
  }

  slotFor(item) {
    const slot = item?.flags?.slot ?? item?.type;
    if (['weapon', 'armor', 'accessory'].includes(slot)) {
      return slot;
    }
    return null;
  }

  listBackpack() {
    return [...this.backpack];
  }

  listEquipped() {
    return { ...this.equipped };
  }

  toJSON() {
    return {
      equipped: {
        weapon: this.equipped.weapon ? this.equipped.weapon.toJSON() : null,
        armor: this.equipped.armor ? this.equipped.armor.toJSON() : null,
        accessory: this.equipped.accessory ? this.equipped.accessory.toJSON() : null,
      },
      backpack: this.backpack.map((item) => item.toJSON()),
    };
  }

  loadFrom(data = {}) {
    const equippedData = data.equipped ?? {};
    this.equipped.weapon = equippedData.weapon ? WorldObject.fromJSON(equippedData.weapon) : null;
    this.equipped.armor = equippedData.armor ? WorldObject.fromJSON(equippedData.armor) : null;
    this.equipped.accessory = equippedData.accessory
      ? WorldObject.fromJSON(equippedData.accessory)
      : null;
    this.backpack = Array.isArray(data.backpack)
      ? data.backpack.map((entry) => WorldObject.fromJSON(entry))
      : [];
  }
}


