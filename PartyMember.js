import { WorldObject } from './WorldObject.js';

const DEFAULT_HEALTH = { current: 30, max: 30 };
const DEFAULT_MANA = { current: 10, max: 10 };

const clampNumber = (value, min, max) => {
  const num = Number.isFinite(value) ? Number(value) : 0;
  if (Number.isFinite(min) && num < min) return min;
  if (Number.isFinite(max) && num > max) return max;
  return num;
};

const weightOf = (item) => {
  if (!item) return 0;
  if (Number.isFinite(item.weight)) return item.weight;
  if (Number.isFinite(item?.stats?.weight)) return item.stats.weight;
  return 0;
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

const resolveStat = (value, fallback) => {
  if (Number.isFinite(value)) return Math.round(value);
  if (Number.isFinite(fallback)) return Math.round(fallback);
  return PartyMember.rollStat();
};

const generateId = (prefix = 'party') => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(16).slice(2)}`;
};

export class PartyMember {
  constructor(name, className, options = {}) {
    this.id = options.id ?? generateId('member');
    this.name = name;
    this.class = className;
    this.str = resolveStat(options.str, options?.stats?.STR);
    this.dex = resolveStat(options.dex, options?.stats?.DEX);
    this.int = resolveStat(options.int, options?.stats?.INT);
    this.level = Number.isFinite(options.level) ? Math.max(1, Math.round(options.level)) : 1;

    const health = options.health ?? {};
    const mana = options.mana ?? {};
    this.health = {
      current: clampNumber(health.current ?? health.hp ?? options.hp ?? DEFAULT_HEALTH.current, 0, Infinity),
      max: clampNumber(health.max ?? health.hpMax ?? options.hpMax ?? DEFAULT_HEALTH.max, 1, Infinity),
    };
    this.mana = {
      current: clampNumber(mana.current ?? mana.mp ?? options.mp ?? DEFAULT_MANA.current, 0, Infinity),
      max: clampNumber(mana.max ?? mana.mpMax ?? options.mpMax ?? DEFAULT_MANA.max, 0, Infinity),
    };
    if (this.health.current > this.health.max) {
      this.health.current = this.health.max;
    }
    if (this.mana.current > this.mana.max) {
      this.mana.current = this.mana.max;
    }

    this.food = Number.isFinite(options.food) ? Math.max(0, Math.round(options.food)) : 100;
    this.baseAttackSpeed = Number.isFinite(options.baseAttackSpeed)
      ? Math.max(200, Math.round(options.baseAttackSpeed))
      : 1000;
    this.attackSpeed = Number.isFinite(options.attackSpeed)
      ? Math.max(200, Math.round(options.attackSpeed))
      : this.baseAttackSpeed;
    this.lastAttackTime = Number.isFinite(options.lastAttackTime) ? options.lastAttackTime : 0;
    this.target = options.target ?? null;

    this.equipment = {
      weapon: cloneItem(options.equipment?.weapon) ?? null,
      armor: cloneItem(options.equipment?.armor) ?? null,
      shield: cloneItem(options.equipment?.shield) ?? null,
      ring: cloneItem(options.equipment?.ring) ?? null,
    };

    this.backpack = Array.isArray(options.backpack)
      ? options.backpack.map((item) => cloneItem(item)).filter(Boolean)
      : [];

    this.x = Number.isFinite(options.x) ? options.x : 0;
    this.y = Number.isFinite(options.y) ? options.y : 0;
    this.isMoving = Boolean(options.isMoving ?? false);
    this.status = options.status ?? 'active';
  }

  static rollStat() {
    return 10 + Math.floor(Math.random() * 9);
  }

  clone() {
    return new PartyMember(this.name, this.class, this.toJSON());
  }

  get alive() {
    return this.health.current > 0;
  }

  get weightCapacity() {
    return this.str * 2;
  }

  equippedWeight() {
    return weightOf(this.equipment.weapon)
      + weightOf(this.equipment.armor)
      + weightOf(this.equipment.shield)
      + weightOf(this.equipment.ring);
  }

  backpackWeight() {
    return this.backpack.reduce((total, item) => total + weightOf(item), 0);
  }

  totalWeight() {
    return this.equippedWeight() + this.backpackWeight();
  }

  canEquip(item, slot = null) {
    if (!item) return false;
    const resolvedSlot = slot ?? this.slotFor(item);
    if (!resolvedSlot) return false;
    if (resolvedSlot === 'weapon' && Number.isFinite(item?.stats?.str_req) && this.str < item.stats.str_req) {
      return false;
    }
    if (resolvedSlot === 'armor' && Number.isFinite(item?.stats?.str_req) && this.str < item.stats.str_req) {
      return false;
    }
    if (resolvedSlot === 'shield' && Number.isFinite(item?.stats?.str_req) && this.str < item.stats.str_req) {
      return false;
    }
    const current = this.equipment[resolvedSlot];
    const projected = this.equippedWeight() - weightOf(current) + weightOf(item);
    return projected <= this.str;
  }

  slotFor(item) {
    const slot = item?.flags?.slot ?? item?.equip ?? item?.type;
    if (['weapon', 'armor', 'shield', 'ring'].includes(slot)) {
      return slot;
    }
    if (slot === 'accessory') return 'ring';
    return null;
  }

  equip(item, slot = null) {
    if (!this.canEquip(item, slot)) return { success: false, message: 'Cannot equip that.' };
    const resolvedSlot = slot ?? this.slotFor(item);
    const previous = this.equipment[resolvedSlot] ?? null;
    this.equipment[resolvedSlot] = cloneItem(item);
    if (resolvedSlot === 'weapon') {
      this.updateAttackSpeed(item);
    }
    return { success: true, previous };
  }

  unequip(slot) {
    if (!['weapon', 'armor', 'shield', 'ring'].includes(slot)) {
      return { success: false, message: 'Invalid slot.' };
    }
    const item = this.equipment[slot] ?? null;
    if (!item) {
      return { success: false, message: 'Nothing equipped.' };
    }
    this.equipment[slot] = null;
    if (slot === 'weapon') {
      this.updateAttackSpeed(null);
    }
    return { success: true, item };
  }

  updateAttackSpeed(weapon) {
    if (weapon?.stats?.attackSpeed) {
      this.attackSpeed = Math.max(200, Math.round(weapon.stats.attackSpeed));
      return;
    }
    if (weapon?.stats?.speedModifier) {
      const modifier = 1 + weapon.stats.speedModifier;
      this.attackSpeed = Math.max(200, Math.round(this.baseAttackSpeed * modifier));
      return;
    }
    this.attackSpeed = this.baseAttackSpeed;
  }

  canAttack(currentTime = Date.now()) {
    if (!this.alive) return false;
    return currentTime - this.lastAttackTime >= this.attackSpeed;
  }

  recordAttack(time = Date.now()) {
    this.lastAttackTime = time;
  }

  takeDamage(amount) {
    const dmg = Math.max(0, Math.round(amount));
    if (dmg <= 0) return 0;
    this.health.current = Math.max(0, this.health.current - dmg);
    return dmg;
  }

  heal(amount) {
    const healed = Math.max(0, Math.round(amount));
    if (healed <= 0) return 0;
    const before = this.health.current;
    this.health.current = Math.min(this.health.max, before + healed);
    return this.health.current - before;
  }

  useMana(amount) {
    const cost = Math.max(0, Math.round(amount));
    if (cost <= 0) return true;
    if (this.mana.current < cost) return false;
    this.mana.current -= cost;
    return true;
  }

  restoreMana(amount) {
    const gain = Math.max(0, Math.round(amount));
    if (gain <= 0) return 0;
    const before = this.mana.current;
    this.mana.current = Math.min(this.mana.max, before + gain);
    return this.mana.current - before;
  }

  distanceTo(entity) {
    if (!entity) return Infinity;
    const dx = (entity.x ?? 0) - this.x;
    const dy = (entity.y ?? 0) - this.y;
    return Math.hypot(dx, dy);
  }

  setPosition(x, y) {
    if (Number.isFinite(x)) this.x = x;
    if (Number.isFinite(y)) this.y = y;
  }

  setTarget(target) {
    this.target = target ?? null;
  }

  attackPower() {
    const weaponDamage = Number.isFinite(this.equipment.weapon?.stats?.attack)
      ? this.equipment.weapon.stats.attack
      : 0;
    return Math.max(1, Math.floor(this.str / 2) + weaponDamage);
  }

  defensePower() {
    const armorDefense = Number.isFinite(this.equipment.armor?.stats?.defense)
      ? this.equipment.armor.stats.defense
      : 0;
    const shieldDefense = Number.isFinite(this.equipment.shield?.stats?.defense)
      ? this.equipment.shield.stats.defense
      : 0;
    return Math.max(0, Math.floor(this.dex / 4) + armorDefense + shieldDefense);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      class: this.class,
      str: this.str,
      dex: this.dex,
      int: this.int,
      level: this.level,
      health: { ...this.health },
      mana: { ...this.mana },
      food: this.food,
      baseAttackSpeed: this.baseAttackSpeed,
      attackSpeed: this.attackSpeed,
      lastAttackTime: this.lastAttackTime,
      targetId: this.target?.id ?? null,
      equipment: {
        weapon: this.equipment.weapon?.toJSON?.() ?? cloneItem(this.equipment.weapon),
        armor: this.equipment.armor?.toJSON?.() ?? cloneItem(this.equipment.armor),
        shield: this.equipment.shield?.toJSON?.() ?? cloneItem(this.equipment.shield),
        ring: this.equipment.ring?.toJSON?.() ?? cloneItem(this.equipment.ring),
      },
      backpack: this.backpack.map((item) => (item?.toJSON ? item.toJSON() : cloneItem(item))).filter(Boolean),
      x: this.x,
      y: this.y,
      isMoving: this.isMoving,
      status: this.status,
    };
  }

  static fromJSON(data) {
    if (!data) return null;
    return new PartyMember(data.name, data.class ?? data.cls ?? 'Adventurer', data);
  }
}

