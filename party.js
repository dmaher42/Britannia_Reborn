import { clamp } from './utils.js';

export const CharacterClass = Object.freeze({
  Avatar: 'Avatar',
  Fighter: 'Fighter',
  Bard: 'Bard',
  Ranger: 'Ranger',
  Mage: 'Mage',
  Druid: 'Druid',
  Tinker: 'Tinker',
  Shepherd: 'Shepherd'
});

const MP_RULES = {
  [CharacterClass.Avatar]: (INT) => INT * 2,
  [CharacterClass.Bard]: (INT) => Math.floor(INT / 2),
  [CharacterClass.Ranger]: (INT) => Math.floor(INT / 2)
};

const EQUIP_SLOTS = ['head', 'torso', 'hands', 'weapon', 'shield', 'ring'];

const weightOf = (item) => {
  if (!item) return 0;
  const qty = typeof item.qty === 'number' ? item.qty : 1;
  const weight = typeof item.weight === 'number' ? item.weight : 0;
  return weight * qty;
};

export class Character {
  constructor(options = {}) {
    this.name = options.name ?? 'Adventurer';
    this.cls = options.cls ?? CharacterClass.Avatar;
    this.STR = options.STR ?? 8;
    this.DEX = options.DEX ?? 8;
    this.INT = options.INT ?? 8;
    this.hpMax = typeof options.hpMax === 'number' ? options.hpMax : 20 + this.STR;
    this.mpMax = this._computeMpMax();
    this.hp = clamp(options.hp ?? this.hpMax, 0, this.hpMax);
    this.mp = clamp(options.mp ?? this.mpMax, 0, this.mpMax);
    this.baseSpeed = options.baseSpeed ?? 96;
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.equipment = {};
    EQUIP_SLOTS.forEach((slot) => {
      this.equipment[slot] = null;
    });
    this.backpack = [];
  }

  _computeMpMax() {
    const rule = MP_RULES[this.cls];
    if (!rule) return 0;
    const mp = rule(this.INT);
    return Math.max(0, Math.floor(mp));
  }

  equippedWeight() {
    return EQUIP_SLOTS.reduce((total, slot) => total + weightOf(this.equipment[slot]), 0);
  }

  backpackWeight() {
    return this.backpack.reduce((total, item) => total + weightOf(item), 0);
  }

  equip(item) {
    if (!item || !item.equip) return false;
    const slot = item.equip;
    if (!Object.prototype.hasOwnProperty.call(this.equipment, slot)) return false;
    const itemWeight = weightOf(item);
    const currentWeight = weightOf(this.equipment[slot]);
    const newTotal = this.equippedWeight() - currentWeight + itemWeight;
    if (newTotal > this.STR) return false;
    this.equipment[slot] = { ...item };
    return true;
  }

  addToBackpack(item) {
    if (!item) return false;
    const itemWeight = weightOf(item);
    if (this.backpackWeight() + itemWeight > this.STR * 2) return false;
    this.backpack.push({ ...item });
    return true;
  }

  isOverweight() {
    return this.equippedWeight() > this.STR || this.backpackWeight() > this.STR * 2;
  }

  speed() {
    return this.isOverweight() ? this.baseSpeed * 0.6 : this.baseSpeed;
  }
}

export class Party {
  constructor(members = [], options = {}) {
    this.members = members.map((member) => (member instanceof Character ? member : new Character(member)));
    this.leaderIndex = 0;
    this.followSpacing = options.followSpacing ?? 36;
    this.collisionRadius = options.collisionRadius ?? 14;
  }

  get size() {
    return this.members.length;
  }

  get leader() {
    return this.members[this.leaderIndex] ?? null;
  }

  setLeader(index) {
    if (index >= 0 && index < this.members.length) {
      this.leaderIndex = index;
    }
  }

  placeAt(x, y) {
    if (!this.leader) return;
    this.members.forEach((member, index) => {
      member.x = x - index * (this.followSpacing * 0.8);
      member.y = y + index * 6;
    });
  }

  update(dt, world, direction = { x: 0, y: 0 }) {
    this.moveLeader(dt, world, direction);
    this.followMembers(dt, world);
  }

  moveLeader(dt, world, direction = { x: 0, y: 0 }) {
    const leader = this.leader;
    if (!leader) return;
    const speed = leader.speed();
    const vx = direction.x ?? 0;
    const vy = direction.y ?? 0;
    if (vx === 0 && vy === 0) return;

    const stepX = vx * speed * dt;
    const stepY = vy * speed * dt;
    const radius = this.collisionRadius;

    if (!world || world.isWalkableCircle(leader.x + stepX, leader.y, radius)) {
      leader.x += stepX;
    }
    if (!world || world.isWalkableCircle(leader.x, leader.y + stepY, radius)) {
      leader.y += stepY;
    }

    if (world) {
      const clamped = world.clampPosition(leader.x, leader.y, radius);
      leader.x = clamped.x;
      leader.y = clamped.y;
    }
  }

  followMembers(dt, world) {
    const radius = this.collisionRadius;
    for (let i = 1; i < this.members.length; i += 1) {
      const prev = this.members[i - 1];
      const follower = this.members[i];
      const dx = prev.x - follower.x;
      const dy = prev.y - follower.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1e-3) continue;

      const desired = this.followSpacing;
      if (dist > desired) {
        const move = Math.min(dist - desired, follower.speed() * dt);
        const nx = dx / dist;
        const ny = dy / dist;
        let nextX = follower.x + nx * move;
        let nextY = follower.y + ny * move;

        if (world && !world.isWalkableCircle(nextX, nextY, radius)) {
          if (world.isWalkableCircle(follower.x + nx * move, follower.y, radius)) {
            nextX = follower.x + nx * move;
          } else {
            nextX = follower.x;
          }
          if (world.isWalkableCircle(follower.x, follower.y + ny * move, radius)) {
            nextY = follower.y + ny * move;
          } else {
            nextY = follower.y;
          }
        }

        if (world) {
          const clamped = world.clampPosition(nextX, nextY, radius);
          nextX = clamped.x;
          nextY = clamped.y;
        }

        follower.x = nextX;
        follower.y = nextY;
      }
    }
  }
}
