const BASE_STATS = ['STR', 'DEX', 'INT', 'VIT', 'LUK'];
const MIN_BASE_STAT = 10;
const MAX_BASE_STAT = 18;
const STAT_POINTS_PER_LEVEL = 3;

const clampNumber = (value, min = -Infinity, max = Infinity) =>
  Math.min(Math.max(value, min), max);

const cloneItem = (item) => (item ? JSON.parse(JSON.stringify(item)) : null);

const weightOf = (item) => {
  if (!item) return 0;
  if (Number.isFinite(item.weight)) return item.weight;
  if (Number.isFinite(item?.stats?.weight)) return item.stats.weight;
  return 0;
};

const xpForLevel = (level) => {
  if (!Number.isFinite(level) || level < 1) return 0;
  return level * level * 100;
};

const sanitizeStats = (stats = {}) => {
  const sanitized = {};
  BASE_STATS.forEach((key) => {
    const value = Number.isFinite(stats[key]) ? Math.round(stats[key]) : MIN_BASE_STAT;
    sanitized[key] = clampNumber(value, MIN_BASE_STAT, MAX_BASE_STAT);
  });
  return sanitized;
};

export class Character {
  constructor(options = {}) {
    const baseStats = sanitizeStats(options.stats ?? options);
    this.id = options.id ?? `char-${crypto.randomUUID?.() ?? Math.random().toString(16).slice(2)}`;
    this.name = options.name ?? 'Adventurer';
    this.level = clampNumber(Math.round(options.level ?? 1), 1, 99);
    this.xp = clampNumber(Math.round(options.xp ?? 0), 0);
    this.stats = baseStats;
    this.availableStatPoints = clampNumber(Math.round(options.availableStatPoints ?? 0), 0, 999);
    this.equipment = {
      weapon: options.equipment?.weapon ? cloneItem(options.equipment.weapon) : null,
      armor: options.equipment?.armor ? cloneItem(options.equipment.armor) : null,
      accessory: options.equipment?.accessory ? cloneItem(options.equipment.accessory) : null,
    };
    this.backpack = Array.isArray(options.backpack)
      ? options.backpack.map((item) => cloneItem(item)).filter(Boolean)
      : [];

    this.hpMax = this._computeHpMax();
    this.mpMax = this._computeMpMax();
    const hp = Number.isFinite(options.hp) ? options.hp : this.hpMax;
    const mp = Number.isFinite(options.mp) ? options.mp : this.mpMax;
    this.hp = clampNumber(hp, 0, this.hpMax);
    this.mp = clampNumber(mp, 0, this.mpMax);
  }

  static get MIN_BASE_STAT() {
    return MIN_BASE_STAT;
  }

  static get MAX_BASE_STAT() {
    return MAX_BASE_STAT;
  }

  static get BASE_STATS() {
    return [...BASE_STATS];
  }

  static xpForLevel(level) {
    return xpForLevel(level);
  }

  _computeHpMax() {
    return clampNumber(this.stats.VIT * 10, 1, 9999);
  }

  _computeMpMax() {
    return clampNumber(this.stats.INT * 5, 0, 9999);
  }

  _recomputeDerived() {
    const previousHpMax = this.hpMax;
    const previousMpMax = this.mpMax;
    this.hpMax = this._computeHpMax();
    this.mpMax = this._computeMpMax();
    if (this.hp > this.hpMax) {
      this.hp = this.hpMax;
    }
    if (this.mp > this.mpMax) {
      this.mp = this.mpMax;
    }
    if (previousHpMax === 0 && this.hpMax > 0) {
      this.hp = this.hpMax;
    }
    if (previousMpMax === 0 && this.mpMax > 0 && this.mp === 0) {
      this.mp = this.mpMax;
    }
  }

  get attack() {
    const weaponAttack = Number.isFinite(this.equipment.weapon?.stats?.attack)
      ? this.equipment.weapon.stats.attack
      : 0;
    return this.stats.STR + weaponAttack;
  }

  get defense() {
    const armorDefense = Number.isFinite(this.equipment.armor?.stats?.defense)
      ? this.equipment.armor.stats.defense
      : 0;
    const accessoryDefense = Number.isFinite(this.equipment.accessory?.stats?.defense)
      ? this.equipment.accessory.stats.defense
      : 0;
    return this.stats.VIT + armorDefense + accessoryDefense;
  }

  equippedWeight() {
    return weightOf(this.equipment.weapon) + weightOf(this.equipment.armor) + weightOf(this.equipment.accessory);
  }

  backpackWeight() {
    return this.backpack.reduce((total, item) => total + weightOf(item), 0);
  }

  isOverweight() {
    return this.equippedWeight() > this.stats.STR || this.backpackWeight() > this.stats.STR * 2;
  }

  canEquip(item) {
    if (!item || typeof item !== 'object') return false;
    const type = item.type ?? item.equip ?? '';
    if (type === 'weapon' && item.stats?.str_req && this.stats.STR < item.stats.str_req) {
      return false;
    }
    if (type === 'armor' && item.stats?.str_req && this.stats.STR < item.stats.str_req) {
      return false;
    }
    const projectedWeight = this.equippedWeight() - weightOf(this.equipment[type]) + weightOf(item);
    if (projectedWeight > this.stats.STR) return false;
    return true;
  }

  equip(item) {
    if (!item || typeof item !== 'object') return false;
    const slot = item.type ?? item.equip;
    if (!['weapon', 'armor', 'accessory'].includes(slot)) return false;
    if (!this.canEquip(item)) return false;
    this.equipment[slot] = cloneItem(item);
    return true;
  }

  unequip(slot) {
    if (!['weapon', 'armor', 'accessory'].includes(slot)) return null;
    const removed = this.equipment[slot] ? cloneItem(this.equipment[slot]) : null;
    this.equipment[slot] = null;
    return removed;
  }

  addToBackpack(item) {
    if (!item) return false;
    const nextWeight = this.backpackWeight() + weightOf(item);
    if (nextWeight > this.stats.STR * 2) return false;
    this.backpack.push(cloneItem(item));
    return true;
  }

  removeFromBackpack(predicate) {
    const index = this.backpack.findIndex((item, idx) =>
      typeof predicate === 'function' ? predicate(item, idx) : item.id === predicate
    );
    if (index === -1) return null;
    const [removed] = this.backpack.splice(index, 1);
    return removed ?? null;
  }

  gainXp(amount) {
    const gain = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
    if (gain <= 0) return { leveled: false, levels: 0 };
    this.xp += gain;
    let levels = 0;
    let leveled = false;
    while (this.xp >= xpForLevel(this.level + 1)) {
      this.xp -= xpForLevel(this.level + 1);
      this.level += 1;
      this.availableStatPoints += STAT_POINTS_PER_LEVEL;
      this._recomputeDerived();
      this.hp = this.hpMax;
      this.mp = this.mpMax;
      levels += 1;
      leveled = true;
    }
    return { leveled, levels };
  }

  allocateStat(stat, amount = 1) {
    const normalizedStat = typeof stat === 'string' ? stat.toUpperCase() : '';
    if (!BASE_STATS.includes(normalizedStat)) return false;
    const points = Number.isFinite(amount) ? Math.round(amount) : 0;
    if (points <= 0) return false;
    if (this.availableStatPoints < points) return false;
    this.stats[normalizedStat] += points;
    this.availableStatPoints -= points;
    this._recomputeDerived();
    return true;
  }

  takeDamage(amount) {
    const dmg = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
    if (dmg <= 0) return 0;
    this.hp = clampNumber(this.hp - dmg, 0, this.hpMax);
    return dmg;
  }

  heal(amount) {
    const healAmount = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
    if (healAmount <= 0) return 0;
    const before = this.hp;
    this.hp = clampNumber(this.hp + healAmount, 0, this.hpMax);
    return this.hp - before;
  }

  useMana(amount) {
    const cost = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
    if (cost <= 0) return true;
    if (this.mp < cost) return false;
    this.mp -= cost;
    return true;
  }

  restoreMana(amount) {
    const gain = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
    if (gain <= 0) return 0;
    const before = this.mp;
    this.mp = clampNumber(this.mp + gain, 0, this.mpMax);
    return this.mp - before;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      level: this.level,
      xp: this.xp,
      stats: { ...this.stats },
      availableStatPoints: this.availableStatPoints,
      hp: this.hp,
      hpMax: this.hpMax,
      mp: this.mp,
      mpMax: this.mpMax,
      equipment: {
        weapon: this.equipment.weapon ? cloneItem(this.equipment.weapon) : null,
        armor: this.equipment.armor ? cloneItem(this.equipment.armor) : null,
        accessory: this.equipment.accessory ? cloneItem(this.equipment.accessory) : null,
      },
      backpack: this.backpack.map((item) => cloneItem(item)),
    };
  }

  static from(data) {
    if (!data) return null;
    return new Character(data);
  }
}

export const CharacterStats = Object.freeze({
  MIN: MIN_BASE_STAT,
  MAX: MAX_BASE_STAT,
  KEYS: Character.BASE_STATS,
  STAT_POINTS_PER_LEVEL,
});

