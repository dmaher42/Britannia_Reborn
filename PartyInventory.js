import { Item, WorldObject } from './WorldObject.js';

const weightOf = (item) => {
  if (!item) return 0;
  if (Number.isFinite(item.weight)) return item.weight;
  if (Number.isFinite(item?.stats?.weight)) return item.stats.weight;
  return 0;
};

const toWorldObject = (item) => {
  if (!item) return null;
  if (item instanceof WorldObject) return item;
  if (typeof item === 'object') {
    try {
      return WorldObject.fromJSON(item);
    } catch (error) {
      return null;
    }
  }
  return null;
};

const cloneItem = (item) => {
  if (!item) return null;
  if (item instanceof WorldObject) {
    return item.clone ? item.clone() : WorldObject.fromJSON(item.toJSON());
  }
  try {
    return JSON.parse(JSON.stringify(item));
  } catch (error) {
    return null;
  }
};

const getReagentType = (object) => object?.reagentType ?? object?.flags?.reagentType ?? object?.meta?.reagentType ?? null;

const isReagentObject = (object, type = null) => {
  if (!object || object.type !== 'reagent') return false;
  if (!type) return true;
  return getReagentType(object) === type;
};

const reagentQuantity = (object) => {
  const quantity = Number.isFinite(object?.quantity) ? object.quantity : 1;
  return Math.max(0, quantity);
};

export class PartyInventory {
  constructor(party, items = []) {
    this.party = party ?? null;
    this.sharedItems = [];
    this.activeMember = party?.leader ?? null;
    if (Array.isArray(items)) {
      items.forEach((item) => {
        const normalized = toWorldObject(item) ?? cloneItem(item);
        if (normalized) {
          this.sharedItems.push(normalized);
        }
      });
    }
    if (this.party) {
      this.party.sharedInventory = this.sharedItems;
      if (typeof this.party.setInventoryRef === 'function') {
        this.party.setInventoryRef(this);
      }
    }
  }

  setParty(party) {
    this.party = party;
    if (party && !this.activeMember) {
      this.activeMember = party.leader ?? party.members?.[0] ?? null;
    }
    if (party) {
      party.sharedInventory = this.sharedItems;
      if (typeof party.setInventoryRef === 'function') {
        party.setInventoryRef(this);
      }
    }
  }

  setActiveMember(member) {
    this.activeMember = member ?? this.party?.leader ?? null;
  }

  calculatePartyCapacity() {
    if (!this.party) return 0;
    return this.party.totalCarryCapacity();
  }

  getCurrentWeight() {
    return this.sharedItems.reduce((total, item) => total + weightOf(item), 0) + (this.party?.totalEquippedWeight() ?? 0);
  }

  backpackWeight() {
    return this.sharedItems.reduce((total, item) => total + weightOf(item), 0);
  }

  equippedWeight() {
    return this.activeMember?.equippedWeight?.() ?? 0;
  }

  totalWeight() {
    return this.getCurrentWeight();
  }

  canAddItem(item) {
    const object = toWorldObject(item) ?? item;
    if (!object) return false;
    const capacity = this.calculatePartyCapacity();
    const projected = this.getCurrentWeight() + weightOf(object);
    return projected <= capacity;
  }

  add(item) {
    const object = toWorldObject(item) ?? item;
    if (!object) return false;
    if (object.type === 'reagent') {
      const type = getReagentType(object);
      const quantity = reagentQuantity(object);
      const unitWeight = Number.isFinite(object.unitWeight)
        ? object.unitWeight
        : quantity > 0 && Number.isFinite(object.weight)
        ? object.weight / quantity
        : 0.1;
      return this.addReagent(type, quantity, { object, unitWeight });
    }
    if (!this.canAddItem(object)) return false;
    this.sharedItems.push(object);
    if (this.party) {
      this.party.sharedInventory = this.sharedItems;
    }
    return true;
  }

  remove(id) {
    const index = this.sharedItems.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const [removed] = this.sharedItems.splice(index, 1);
    if (this.party) {
      this.party.sharedInventory = this.sharedItems;
    }
    return removed ?? null;
  }

  has(id) {
    return Boolean(this.find(id));
  }

  find(id) {
    return this.sharedItems.find((item) => item.id === id) ?? this.findEquipped(id);
  }

  findEquipped(id) {
    if (!this.activeMember) return null;
    const slots = ['weapon', 'armor', 'shield', 'ring'];
    for (const slot of slots) {
      if (this.activeMember.equipment?.[slot]?.id === id) {
        return this.activeMember.equipment[slot];
      }
    }
    return null;
  }

  slotFor(item) {
    const slot = item?.flags?.slot ?? item?.equip ?? item?.type;
    if (['weapon', 'armor', 'shield', 'ring'].includes(slot)) {
      return slot;
    }
    if (slot === 'accessory') return 'ring';
    return null;
  }

  equip(id, member = this.activeMember, forcedSlot = null) {
    if (!member) {
      return { success: false, message: 'No companion selected.' };
    }
    const index = this.sharedItems.findIndex((item) => item.id === id);
    if (index === -1) {
      return { success: false, message: 'That item is not in the packs.' };
    }
    const item = this.sharedItems[index];
    const slot = forcedSlot ?? this.slotFor(item);
    if (!slot) {
      return { success: false, message: 'That cannot be equipped.' };
    }
    if (!member.canEquip?.(item, slot)) {
      return { success: false, message: 'They lack the skill or strength to wield that.' };
    }
    this.sharedItems.splice(index, 1);
    const result = member.equip(item, slot);
    if (!result.success) {
      this.sharedItems.splice(index, 0, item);
      return result;
    }
    if (result.previous) {
      this.sharedItems.push(result.previous);
    }
    if (this.party) {
      this.party.sharedInventory = this.sharedItems;
    }
    return { success: true, previous: result.previous ?? null };
  }

  unequip(slot, member = this.activeMember) {
    if (!member) {
      return { success: false, message: 'No companion selected.' };
    }
    if (!['weapon', 'armor', 'shield', 'ring'].includes(slot)) {
      return { success: false, message: 'Invalid slot.' };
    }
    const result = member.unequip(slot);
    if (!result.success) return result;
    const item = result.item;
    if (item && !this.canAddItem(item)) {
      member.equip(item, slot);
      return { success: false, message: 'The packs are too heavy to stow that.' };
    }
    if (item) {
      this.sharedItems.push(item);
      if (this.party) {
        this.party.sharedInventory = this.sharedItems;
      }
    }
    return { success: true, item };
  }

  drop(id) {
    const item = this.remove(id);
    if (item) return item;
    const slots = ['weapon', 'armor', 'shield', 'ring'];
    if (this.activeMember) {
      for (const slot of slots) {
        if (this.activeMember.equipment?.[slot]?.id === id) {
          const removed = this.activeMember.equipment[slot];
          this.activeMember.equipment[slot] = null;
          return removed;
        }
      }
    }
    return null;
  }

  use(id, context = {}) {
    const item = this.find(id);
    if (!item || typeof item.onUse !== 'function') {
      return { success: false, message: 'That cannot be used.' };
    }
    const selected = this.activeMember ?? null;
    const result = item.onUse({ ...context, inventory: this, character: selected });
    if (result?.consumed) {
      this.remove(id);
    }
    return result ?? { success: true };
  }

  listBackpack() {
    return [...this.sharedItems];
  }

  listEquipped() {
    const member = this.activeMember;
    if (!member) return { weapon: null, armor: null, shield: null, ring: null };
    return {
      weapon: member.equipment.weapon ?? null,
      armor: member.equipment.armor ?? null,
      shield: member.equipment.shield ?? null,
      ring: member.equipment.ring ?? null,
    };
  }

  toJSON() {
    return this.sharedItems.map((item) => (item?.toJSON ? item.toJSON() : cloneItem(item)));
  }

  loadFrom(data = []) {
    this.sharedItems = [];
    if (!Array.isArray(data)) return;
    data.forEach((entry) => {
      const item = toWorldObject(entry) ?? cloneItem(entry);
      if (item) {
        this.sharedItems.push(item);
      }
    });
    if (this.party) {
      this.party.sharedInventory = this.sharedItems;
      if (typeof this.party.setInventoryRef === 'function') {
        this.party.setInventoryRef(this);
      }
    }
  }

  addReagent(type, quantity = 1, options = {}) {
    if (!type) return false;
    const amount = Number.isFinite(quantity) ? Math.max(1, Math.round(quantity)) : 0;
    if (amount <= 0) return false;
    const unitWeight = Number.isFinite(options.unitWeight) ? Math.max(0, options.unitWeight) : 0.1;
    const capacity = this.calculatePartyCapacity();
    const projected = this.getCurrentWeight() + unitWeight * amount;
    if (projected > capacity) {
      return false;
    }
    const existing = this.sharedItems.find((item) => isReagentObject(item, type));
    if (existing) {
      const current = reagentQuantity(existing);
      existing.quantity = current + amount;
      existing.reagentType = getReagentType(existing) ?? type;
      existing.flags = { ...(existing.flags ?? {}), reagentType: existing.reagentType };
      existing.unitWeight = Number.isFinite(existing.unitWeight) ? existing.unitWeight : unitWeight;
      if (existing.unitWeight <= 0) {
        existing.unitWeight = unitWeight;
      }
      existing.weight = existing.unitWeight * existing.quantity;
      if (this.party) {
        this.party.sharedInventory = this.sharedItems;
      }
      return true;
    }

    let item = options.object ?? null;
    if (item) {
      item.quantity = amount;
      item.unitWeight = Number.isFinite(item.unitWeight)
        ? item.unitWeight
        : Number.isFinite(unitWeight)
        ? unitWeight
        : 0.1;
      item.weight = item.unitWeight * amount;
    } else if (options.reagentSystem && typeof options.reagentSystem.createReagent === 'function') {
      item = options.reagentSystem.createReagent(type, amount);
    } else {
      item = new Item(`reagent_${type}_${Date.now()}`, type, 0, 0, {
        description: `A small quantity of ${type.replace(/_/g, ' ')}.`,
        stackable: true,
        quantity: amount,
        weight: unitWeight * amount,
      });
      item.type = 'reagent';
    }
    if (!item) return false;
    item.type = 'reagent';
    item.reagentType = type;
    item.flags = { ...(item.flags ?? {}), reagentType: type };
    item.stackable = true;
    item.quantity = reagentQuantity(item) || amount;
    item.unitWeight = Number.isFinite(item.unitWeight) ? item.unitWeight : unitWeight;
    if (!Number.isFinite(item.unitWeight) || item.unitWeight <= 0) {
      item.unitWeight = 0.1;
    }
    item.weight = item.unitWeight * item.quantity;
    if (typeof item.onUse !== 'function') {
      item.onUse = () => ({
        success: true,
        message: 'You ponder how best to combine the reagent.',
      });
    }
    this.sharedItems.push(item);
    if (this.party) {
      this.party.sharedInventory = this.sharedItems;
    }
    return true;
  }

  getReagentCount(type) {
    if (!type) return 0;
    return this.sharedItems.reduce((total, item) => {
      if (!isReagentObject(item, type)) return total;
      return total + reagentQuantity(item);
    }, 0);
  }

  consumeReagent(type, quantity = 1) {
    if (!type) return false;
    const amount = Number.isFinite(quantity) ? Math.max(1, Math.round(quantity)) : 0;
    if (amount <= 0) return true;
    if (this.getReagentCount(type) < amount) {
      return false;
    }
    let remaining = amount;
    for (let index = 0; index < this.sharedItems.length && remaining > 0; index += 1) {
      const item = this.sharedItems[index];
      if (!isReagentObject(item, type)) continue;
      const stackQty = reagentQuantity(item);
      if (stackQty <= 0) continue;
      const consume = Math.min(stackQty, remaining);
      const unitWeight = Number.isFinite(item.unitWeight)
        ? item.unitWeight
        : stackQty > 0 && Number.isFinite(item.weight)
        ? item.weight / stackQty
        : 0.1;
      item.unitWeight = unitWeight;
      item.quantity = stackQty - consume;
      item.weight = item.unitWeight * item.quantity;
      remaining -= consume;
      if (item.quantity <= 0) {
        this.sharedItems.splice(index, 1);
        index -= 1;
      }
    }
    if (remaining > 0) {
      return false;
    }
    if (this.party) {
      this.party.sharedInventory = this.sharedItems;
    }
    return true;
  }

  listReagents() {
    return this.sharedItems
      .filter((item) => isReagentObject(item))
      .map((item) => ({
        id: item.id,
        type: getReagentType(item),
        name: item.name,
        quantity: reagentQuantity(item),
        rarity: item.rarity ?? item.flags?.rarity ?? null,
        value: item.value ?? item.stats?.value ?? 0,
      }));
  }
}

