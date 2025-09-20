import { WorldObject, Item, registerWorldObjectType } from './WorldObject.js';

const uniqueId = (prefix) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(16).slice(2)}`;
};

const createLootEntry = (chance, factory) => ({ chance, factory });

const ENEMY_PROFILES = {
  rat: {
    name: 'Giant Rat',
    health: 5,
    attackPower: 1,
    attackSpeed: 800,
    description: 'A filthy rat with beady eyes and a hunger for grain.',
    loot: [
      createLootEntry(0.6, (enemy) => new Item(uniqueId('rat_meat'), 'chunk of meat', enemy.x, enemy.y, {
        description: 'It is edible if one is desperate.',
        weight: 0.2,
        food: true,
      })),
      createLootEntry(0.3, (enemy) => new Item(uniqueId('rat_gold'), 'handful of gold', enemy.x, enemy.y, {
        description: 'A few tarnished coins.',
        weight: 0.1,
        stats: { value: 5 },
      })),
    ],
  },
  bat: {
    name: 'Cave Bat',
    health: 8,
    attackPower: 2,
    attackSpeed: 600,
    description: 'A screeching bat darts through the air.',
    loot: [
      createLootEntry(0.5, (enemy) => new Item(uniqueId('bat_wing'), 'bat wing', enemy.x, enemy.y, {
        description: 'Useful to alchemists and curious cooks alike.',
        weight: 0.05,
      })),
      createLootEntry(0.4, (enemy) => new Item(uniqueId('bat_gold'), 'small pouch of gold', enemy.x, enemy.y, {
        description: 'A tiny pouch with a few coins.',
        weight: 0.15,
        stats: { value: 8 },
      })),
    ],
  },
  skeleton: {
    name: 'Restless Skeleton',
    health: 15,
    attackPower: 4,
    attackSpeed: 1200,
    description: 'Bones clatter as the undead warrior advances.',
    loot: [
      createLootEntry(0.8, (enemy) => new Item(uniqueId('rusty_blade'), 'rusty blade', enemy.x, enemy.y, {
        description: 'A battered sword of dubious quality.',
        weight: 3,
        stats: { attack: 3, attackSpeed: 1100, str_req: 8 },
        flags: { slot: 'weapon' },
      })),
      createLootEntry(0.5, (enemy) => new Item(uniqueId('ske_gold'), 'pouch of gold', enemy.x, enemy.y, {
        description: 'Coins clink within the pouch.',
        weight: 0.2,
        stats: { value: 15 },
      })),
    ],
  },
};

const fallbackProfile = {
  name: 'Foe',
  health: 10,
  attackPower: 2,
  attackSpeed: 1000,
  description: 'A hostile creature.',
  loot: [],
};

const weightless = 0;

export class Enemy extends WorldObject {
  constructor(type, x, y, options = {}) {
    const profile = ENEMY_PROFILES[type] ?? fallbackProfile;
    super(options.id ?? uniqueId('enemy'), options.name ?? profile.name, 'enemy', x, y, {
      description: options.description ?? profile.description,
      canGet: false,
      canUse: false,
      weight: weightless,
    });
    this.type = type;
    this.health = {
      current: Number.isFinite(options.health?.current) ? options.health.current : profile.health,
      max: Number.isFinite(options.health?.max) ? options.health.max : profile.health,
    };
    if (this.health.current > this.health.max) {
      this.health.current = this.health.max;
    }
    this.attackPower = Number.isFinite(options.attackPower) ? options.attackPower : profile.attackPower;
    this.attackSpeed = Number.isFinite(options.attackSpeed) ? options.attackSpeed : profile.attackSpeed;
    this.lastAttackTime = Number.isFinite(options.lastAttackTime) ? options.lastAttackTime : 0;
    this.target = options.target ?? null;
    this.ai = options.ai ?? new BasicEnemyAI(this);
    this.lootTable = Array.isArray(options.lootTable) ? options.lootTable : profile.loot;
  }

  get alive() {
    return this.health.current > 0;
  }

  canAttack(now = Date.now()) {
    return now - this.lastAttackTime >= this.attackSpeed;
  }

  takeDamage(amount) {
    const damage = Math.max(0, Math.round(amount));
    if (damage <= 0) return 0;
    this.health.current = Math.max(0, this.health.current - damage);
    return damage;
  }

  attackPowerValue() {
    return this.attackPower;
  }

  distanceTo(entity) {
    if (!entity) return Infinity;
    const dx = (entity.x ?? 0) - (this.x ?? 0);
    const dy = (entity.y ?? 0) - (this.y ?? 0);
    return Math.hypot(dx, dy);
  }

  dropLoot() {
    if (!this.lootTable) return [];
    return this.lootTable
      .map((entry) => {
        const chance = Number.isFinite(entry?.chance) ? entry.chance : 1;
        if (Math.random() > chance) return null;
        try {
          return entry.factory?.(this) ?? null;
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean);
  }

  blocksMovement() {
    return true;
  }

  onLook() {
    return this.description ?? `A hostile ${this.name.toLowerCase()}.`;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      type: this.type,
      health: { ...this.health },
      attackPower: this.attackPower,
      attackSpeed: this.attackSpeed,
      lastAttackTime: this.lastAttackTime,
    };
  }

  static fromJSON(data) {
    if (!data) return null;
    return new Enemy(data.type ?? 'rat', data.x ?? 0, data.y ?? 0, data);
  }
}

export class BasicEnemyAI {
  constructor(enemy) {
    this.enemy = enemy;
    this.speed = 2.6;
  }

  update(enemy, party, gameWorld) {
    const target = this.findClosestPartyMember(enemy, party);
    if (!target) {
      enemy.target = null;
      enemy.isMoving = false;
      return;
    }
    const distance = this.getDistance(enemy, target);
    if (distance <= 1.2) {
      enemy.target = target;
      enemy.isMoving = false;
      return;
    }
    if (distance <= 5) {
      this.moveToward(enemy, target, gameWorld);
      enemy.target = distance <= 1.2 ? target : enemy.target;
    } else {
      enemy.target = null;
      enemy.isMoving = false;
    }
  }

  findClosestPartyMember(enemy, party) {
    if (!party?.members) return null;
    let closest = null;
    let minDistance = Infinity;
    party.members.forEach((member) => {
      if (!member?.alive) return;
      const dist = this.getDistance(enemy, member);
      if (dist < minDistance) {
        minDistance = dist;
        closest = member;
      }
    });
    return closest;
  }

  getDistance(enemy, target) {
    if (!enemy || !target) return Infinity;
    const dx = (target.x ?? 0) - (enemy.x ?? 0);
    const dy = (target.y ?? 0) - (enemy.y ?? 0);
    return Math.hypot(dx, dy);
  }

  moveToward(enemy, target, gameWorld) {
    if (!enemy || !target) return;
    const dx = (target.x ?? 0) - (enemy.x ?? 0);
    const dy = (target.y ?? 0) - (enemy.y ?? 0);
    const distance = Math.hypot(dx, dy) || 1;
    const nx = dx / distance;
    const ny = dy / distance;
    const step = this.speed * 0.05;
    const nextX = enemy.x + nx * step;
    const nextY = enemy.y + ny * step;
    if (this.canMoveTo(gameWorld, nextX, nextY)) {
      enemy.x = nextX;
      enemy.y = nextY;
      enemy.isMoving = true;
      enemy.facing = this.resolveFacing(nx, ny, enemy.facing);
    } else {
      enemy.isMoving = false;
    }
  }

  canMoveTo(gameWorld, x, y) {
    if (!gameWorld) return true;
    if (typeof gameWorld.canMoveTo === 'function') {
      return gameWorld.canMoveTo(x, y, 0.3);
    }
    if (typeof gameWorld.isWalkableCircle === 'function') {
      return gameWorld.isWalkableCircle(x, y, 0.3);
    }
    return true;
  }

  resolveFacing(dx, dy, fallback = 'south') {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < 0.05 && absY < 0.05) {
      return fallback;
    }
    if (absX > absY) {
      return dx > 0 ? 'east' : 'west';
    }
    return dy > 0 ? 'south' : 'north';
  }
}

registerWorldObjectType('enemy', Enemy);

