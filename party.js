import { PartyMember } from './PartyMember.js';

export const CharacterClass = Object.freeze({
  Avatar: 'Avatar',
  LordBritish: 'LordBritish',
  Fighter: 'Fighter',
  Bard: 'Bard',
  Ranger: 'Ranger',
  Mage: 'Mage',
  Druid: 'Druid',
  Tinker: 'Tinker',
  Shepherd: 'Shepherd',
});

const asMember = (entry) => {
  if (!entry) return null;
  if (entry instanceof PartyMember) return entry;
  if (typeof entry === 'string') {
    return new PartyMember(entry, CharacterClass.Avatar);
  }
  if (typeof entry === 'object' && entry.name) {
    return PartyMember.fromJSON(entry) ?? new PartyMember(entry.name, entry.class ?? CharacterClass.Avatar, entry);
  }
  return null;
};

const FORMATIONS = ['line', 'box', 'scattered'];

export class Party {
  constructor(options = {}) {
    this.members = Array.isArray(options.members)
      ? options.members.map((member) => asMember(member)).filter(Boolean)
      : [];
    this.maxMembers = Number.isFinite(options.maxMembers) ? Math.max(1, Math.round(options.maxMembers)) : 8;
    this.formation = FORMATIONS.includes(options.formation) ? options.formation : 'line';
    this.sharedInventory = Array.isArray(options.sharedInventory)
      ? [...options.sharedInventory]
      : [];
    this.movementController = null;
    this.leaderIndex = 0;
    this.gold = Number.isFinite(options.gold) ? Math.max(0, Math.round(options.gold)) : 50;
    this.inventoryRef = null;
    if (Number.isFinite(options.leaderIndex)) {
      this.setLeader(options.leaderIndex);
    } else if (this.members.length > 0) {
      this.leaderIndex = 0;
    }
  }

  get leader() {
    return this.members[this.leaderIndex] ?? null;
  }

  get size() {
    return this.members.length;
  }

  setMovementController(controller) {
    this.movementController = controller ?? null;
  }

  setInventoryRef(inventory) {
    this.inventoryRef = inventory ?? null;
  }

  addMember(entry) {
    if (this.members.length >= this.maxMembers) {
      return { success: false, message: 'The party cannot grow any larger.' };
    }
    const member = asMember(entry);
    if (!member) {
      return { success: false, message: 'That companion cannot join.' };
    }
    this.members.push(member);
    if (!this.leader) {
      this.leaderIndex = this.members.length - 1;
    }
    return { success: true, member };
  }

  removeMember(id) {
    const index = this.members.findIndex((member) => member.id === id || member.name === id);
    if (index === -1) return null;
    const [removed] = this.members.splice(index, 1);
    if (this.leaderIndex >= this.members.length) {
      this.leaderIndex = Math.max(0, this.members.length - 1);
    }
    return removed ?? null;
  }

  setLeader(index) {
    const normalized = Number.isFinite(index) ? Math.max(0, Math.min(this.members.length - 1, Math.round(index))) : 0;
    if (!this.members[normalized]) return false;
    this.leaderIndex = normalized;
    return true;
  }

  cycleLeader(step = 1) {
    if (this.members.length === 0) return this.leaderIndex;
    const next = (this.leaderIndex + step + this.members.length) % this.members.length;
    this.setLeader(next);
    return this.leaderIndex;
  }

  setFormation(name) {
    if (!FORMATIONS.includes(name)) return false;
    this.formation = name;
    if (this.movementController && typeof this.movementController.setFormation === 'function') {
      this.movementController.setFormation(name);
    }
    return true;
  }

  cycleFormation() {
    const index = FORMATIONS.indexOf(this.formation);
    const nextIndex = index === -1 ? 0 : (index + 1) % FORMATIONS.length;
    this.setFormation(FORMATIONS[nextIndex]);
    return this.formation;
  }

  addGold(amount = 0) {
    const value = Number.isFinite(amount) ? Math.round(amount) : 0;
    if (value <= 0) return this.gold;
    this.gold += value;
    return this.gold;
  }

  spendGold(amount = 0) {
    const cost = Number.isFinite(amount) ? Math.round(amount) : 0;
    if (cost <= 0) return true;
    if (this.gold < cost) return false;
    this.gold -= cost;
    return true;
  }

  addReagent(type, quantity = 1, options = {}) {
    if (!this.inventoryRef || typeof this.inventoryRef.addReagent !== 'function') return false;
    return this.inventoryRef.addReagent(type, quantity, options);
  }

  getReagentCount(type) {
    if (!this.inventoryRef || typeof this.inventoryRef.getReagentCount !== 'function') return 0;
    return this.inventoryRef.getReagentCount(type);
  }

  consumeReagent(type, quantity = 1) {
    if (!this.inventoryRef || typeof this.inventoryRef.consumeReagent !== 'function') return false;
    return this.inventoryRef.consumeReagent(type, quantity);
  }

  moveParty(direction, dt = 0.016, gameWorld = null) {
    if (this.movementController && typeof this.movementController.moveParty === 'function') {
      this.movementController.moveParty(direction, dt, gameWorld);
      return;
    }
    const leader = this.leader;
    if (!leader) return;
    const speed = Number.isFinite(direction?.speed) ? direction.speed : 3.5;
    const vx = direction?.x ?? 0;
    const vy = direction?.y ?? 0;
    if (vx === 0 && vy === 0) return;
    const length = Math.hypot(vx, vy) || 1;
    const step = speed * dt;
    const nextX = leader.x + (vx / length) * step;
    const nextY = leader.y + (vy / length) * step;
    if (!gameWorld || gameWorld.canMoveTo?.(nextX, nextY) || gameWorld.isWalkableCircle?.(nextX, nextY, 0.3)) {
      leader.setPosition(nextX, nextY);
    }
  }

  totalCarryCapacity() {
    return this.members.reduce((total, member) => total + member.weightCapacity, 0);
  }

  totalEquippedWeight() {
    return this.members.reduce((total, member) => total + member.equippedWeight(), 0);
  }

  getSharedWeight() {
    return this.sharedInventory.reduce((total, item) => {
      const weight = Number.isFinite(item?.weight)
        ? item.weight
        : Number.isFinite(item?.stats?.weight)
        ? item.stats.weight
        : 0;
      return total + weight;
    }, 0);
  }

  getAvailableInventorySpace() {
    const capacity = this.totalCarryCapacity();
    const carried = this.totalEquippedWeight() + this.getSharedWeight();
    return Math.max(0, capacity - carried);
  }

  toJSON() {
    return {
      members: this.members.map((member) => member.toJSON()),
      maxMembers: this.maxMembers,
      leaderIndex: this.leaderIndex,
      formation: this.formation,
      sharedInventory: this.sharedInventory.map((item) => (item?.toJSON ? item.toJSON() : item)),
      gold: this.gold,
    };
  }

  static fromJSON(data) {
    if (!data || typeof data !== 'object') return new Party();
    return new Party({
      members: Array.isArray(data.members) ? data.members : [],
      maxMembers: data.maxMembers,
      leaderIndex: data.leaderIndex,
      formation: data.formation,
      sharedInventory: data.sharedInventory,
      gold: data.gold,
    });
  }
}

