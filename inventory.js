const normalizeItem = (item) => ({
  id: item.id,
  name: item.name ?? item.id,
  weight: typeof item.weight === 'number' ? item.weight : 0,
  qty: typeof item.qty === 'number' ? item.qty : 1,
  tag: item.tag,
  equip: item.equip,
  restricted: Array.isArray(item.restricted) ? [...item.restricted] : undefined
});

export class Inventory {
  constructor(items = []) {
    this.items = [];
    this.gold = 0;
    items.forEach((item) => this.add(item));
  }

  add(item) {
    const normalized = normalizeItem(item);
    const existing = this.items.find((it) => it.id === normalized.id && it.equip === normalized.equip);
    if (existing && !normalized.equip) {
      existing.qty += normalized.qty;
      existing.weight = normalized.weight; // assume consistent weight per unit
      return existing;
    }

    this.items.push({ ...normalized });
    return normalized;
  }

  remove(id, qty = 1) {
    const idx = this.items.findIndex((item) => item.id === id);
    if (idx === -1) return false;
    const item = this.items[idx];
    if (item.qty > qty) {
      item.qty -= qty;
      return true;
    }
    this.items.splice(idx, 1);
    return true;
  }

  count(id) {
    return this.items
      .filter((item) => item.id === id)
      .reduce((total, item) => total + item.qty, 0);
  }

  consume(id, qty = 1) {
    if (this.count(id) < qty) return false;
    let remaining = qty;
    for (const item of this.items) {
      if (item.id !== id) continue;
      const take = Math.min(item.qty, remaining);
      item.qty -= take;
      remaining -= take;
      if (item.qty <= 0) {
        const index = this.items.indexOf(item);
        if (index !== -1) this.items.splice(index, 1);
      }
      if (remaining <= 0) break;
    }
    return true;
  }

  totalWeight() {
    return this.items.reduce((total, item) => total + item.weight * item.qty, 0);
  }

  summary() {
    return this.items.map((item) => ({ id: item.id, name: item.name, qty: item.qty }));
  }
}
