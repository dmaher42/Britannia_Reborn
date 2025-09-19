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

