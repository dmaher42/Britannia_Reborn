import { REAGENT_TYPES } from './ReagentSystem.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toCounts = (list = []) => {
  const counts = new Map();
  list.forEach((entry) => {
    const type = entry;
    if (!type) return;
    const current = counts.get(type) ?? 0;
    counts.set(type, current + 1);
  });
  return counts;
};

const reagentTypeOf = (item) => item?.reagentType ?? item?.flags?.reagentType ?? null;

const quantityOf = (item) => (Number.isFinite(item?.quantity) ? item.quantity : 1);

const distanceBetween = (a, b) => {
  if (!a || !b) return Infinity;
  const dx = (a.x ?? 0) - (b.x ?? 0);
  const dy = (a.y ?? 0) - (b.y ?? 0);
  return Math.hypot(dx, dy);
};

export class SpellSystem {
  constructor(party, reagentSystem, options = {}) {
    this.party = party;
    this.reagentSystem = reagentSystem;
    this.inventory = options.inventory ?? null;
    this.world = options.world ?? null;
    this.map = options.map ?? null;
    this.combat = options.combat ?? null;
    this.onAfterCast = typeof options.onAfterCast === 'function' ? options.onAfterCast : null;
    this.spells = this.initializeSpells();
    this.mixingInterface = null;
    this.lastPreparedSpell = null;
  }

  initializeSpells() {
    return {
      heal: {
        name: 'An Nox',
        circle: 1,
        reagents: ['garlic', 'ginseng'],
        manaCost: 5,
        target: 'ally',
        effect: this.castHeal.bind(this),
      },
      magic_missile: {
        name: 'Por Ylem',
        circle: 1,
        reagents: ['black_pearl', 'sulfurous_ash'],
        manaCost: 4,
        target: 'enemy',
        effect: this.castMagicMissile.bind(this),
      },
      cure: {
        name: 'An Nox Hur',
        circle: 2,
        reagents: ['garlic', 'ginseng', 'spider_silk'],
        manaCost: 8,
        target: 'ally',
        effect: this.castCure.bind(this),
      },
      fireball: {
        name: 'Por Flam',
        circle: 2,
        reagents: ['black_pearl', 'sulfurous_ash', 'spider_silk'],
        manaCost: 10,
        target: 'area',
        effect: this.castFireball.bind(this),
      },
      telekinesis: {
        name: 'Ort Por Ylem',
        circle: 3,
        reagents: ['blood_moss', 'spider_silk', 'mandrake_root'],
        manaCost: 15,
        target: 'object',
        effect: this.castTelekinesis.bind(this),
      },
      unlock_magic: {
        name: 'Ex Por',
        circle: 3,
        reagents: ['blood_moss', 'sulfurous_ash'],
        manaCost: 12,
        target: 'object',
        effect: this.castUnlock.bind(this),
      },
    };
  }

  setInventory(inventory) {
    this.inventory = inventory ?? null;
  }

  setWorld(world) {
    this.world = world ?? null;
  }

  setCombat(combat) {
    this.combat = combat ?? null;
  }

  setMap(map) {
    this.map = map ?? null;
  }

  setMixingInterface(ui) {
    this.mixingInterface = ui ?? null;
  }

  toJSON() {
    return {
      lastPreparedSpell: this.lastPreparedSpell ?? null,
    };
  }

  loadFrom(data = {}) {
    if (data && data.lastPreparedSpell && this.spells[data.lastPreparedSpell]) {
      this.lastPreparedSpell = data.lastPreparedSpell;
    } else {
      this.lastPreparedSpell = null;
    }
  }

  getSpell(spellName) {
    return this.spells[spellName] ?? null;
  }

  prepareSpell(spellName) {
    if (!this.spells[spellName]) return false;
    this.lastPreparedSpell = spellName;
    return true;
  }

  requiresTarget(spellName) {
    const spell = this.getSpell(spellName);
    if (!spell) return false;
    return ['ally', 'enemy', 'area', 'object'].includes(spell.target);
  }

  getTargetType(spellName) {
    return this.getSpell(spellName)?.target ?? 'self';
  }

  getReagentCounts() {
    const counts = new Map();
    const items = this.inventory?.sharedItems ?? this.party?.sharedInventory ?? [];
    items.forEach((item) => {
      if (!item || item.type !== 'reagent') return;
      const type = reagentTypeOf(item);
      if (!type) return;
      const quantity = quantityOf(item);
      counts.set(type, (counts.get(type) ?? 0) + quantity);
    });
    return counts;
  }

  hasRequiredReagents(requiredList = []) {
    const counts = this.getReagentCounts();
    const required = toCounts(requiredList);
    for (const [type, amount] of required.entries()) {
      if ((counts.get(type) ?? 0) < amount) {
        return false;
      }
    }
    return true;
  }

  consumeReagents(requiredList = []) {
    if (!requiredList || requiredList.length === 0) return true;
    const required = toCounts(requiredList);
    for (const [type, amount] of required.entries()) {
      if (this.inventory && typeof this.inventory.consumeReagent === 'function') {
        if (!this.inventory.consumeReagent(type, amount)) {
          return false;
        }
      } else if (this.party && typeof this.party.consumeReagent === 'function') {
        if (!this.party.consumeReagent(type, amount)) {
          return false;
        }
      }
    }
    this.mixingInterface?.refreshReagents?.();
    return true;
  }

  matchSpellByReagents(reagentList = []) {
    const inputCounts = toCounts(reagentList);
    for (const [name, spell] of Object.entries(this.spells)) {
      const spellCounts = toCounts(spell.reagents);
      if (spellCounts.size !== inputCounts.size) continue;
      let matches = true;
      for (const [type, amount] of spellCounts.entries()) {
        if (inputCounts.get(type) !== amount) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return name;
      }
    }
    return null;
  }

  canCastSpell(spellName, caster, target = null) {
    const spell = this.getSpell(spellName);
    if (!spell || !caster) return false;
    if (!caster.mana || caster.mana.current < spell.manaCost) return false;
    if (!this.hasRequiredReagents(spell.reagents)) return false;
    if (this.requiresTarget(spellName)) {
      const resolved = this.resolveTarget(spell, caster, target);
      return Boolean(resolved);
    }
    return true;
  }

  castSpell(spellName, caster, target = null) {
    const spell = this.getSpell(spellName);
    if (!spell || !caster) {
      this.showMessage('The spell fizzles before it can form.');
      return false;
    }
    const resolvedTarget = this.resolveTarget(spell, caster, target);
    if (this.requiresTarget(spellName) && !resolvedTarget) {
      this.showMessage('No suitable target presents itself.');
      return false;
    }
    if (!this.canCastSpell(spellName, caster, resolvedTarget)) {
      this.showMessage('The spell fails. Perhaps more power or reagents are needed.');
      return false;
    }
    if (!this.consumeReagents(spell.reagents)) {
      this.showMessage('You lack the necessary reagents.');
      return false;
    }
    caster.mana.current = clamp((caster.mana?.current ?? 0) - spell.manaCost, 0, caster.mana?.max ?? spell.manaCost);
    spell.effect(caster, resolvedTarget);
    this.prepareSpell(spellName);
    if (this.combat?.onUpdate) {
      this.combat.onUpdate({ party: this.party, enemies: this.combat.enemies });
    }
    if (this.onAfterCast) {
      this.onAfterCast({ spell: spellName, caster, target: resolvedTarget });
    }
    return true;
  }

  castPreparedSpell(caster, target = null) {
    if (!this.lastPreparedSpell) {
      this.showMessage('No spell is currently prepared. Mix reagents first.');
      return false;
    }
    return this.castSpell(this.lastPreparedSpell, caster, target);
  }

  resolveTarget(spell, caster, providedTarget) {
    if (!spell) return null;
    const targetType = spell.target ?? 'self';
    if (targetType === 'self') {
      return caster;
    }
    if (providedTarget) {
      return providedTarget;
    }
    if (targetType === 'ally') {
      const allies = this.getAllies();
      if (!allies || allies.length === 0) return caster;
      const wounded = allies
        .filter((ally) => ally.health && ally.health.current < ally.health.max)
        .sort((a, b) => a.health.current / a.health.max - b.health.current / b.health.max);
      return wounded[0] ?? caster;
    }
    if (targetType === 'enemy' || targetType === 'area') {
      if (caster?.target && caster.target.alive) {
        return caster.target;
      }
      const enemies = this.getEnemies();
      return enemies.find((enemy) => enemy.alive) ?? null;
    }
    if (targetType === 'object') {
      const objects = this.getNearbyObjects(caster, () => true, 6);
      return objects[0] ?? null;
    }
    return providedTarget ?? null;
  }

  getAllies() {
    return this.party?.members?.filter((member) => member?.alive) ?? [];
  }

  getEnemies() {
    if (this.combat?.enemies) {
      return this.combat.enemies;
    }
    if (this.map?.getObjects) {
      return this.map.getObjects().filter((object) => object?.type === 'enemy');
    }
    return [];
  }

  getPotentialTargets(spellName, caster) {
    const spell = this.getSpell(spellName);
    if (!spell) return [];
    const targetType = spell.target ?? 'self';
    if (targetType === 'ally') {
      return this.getAllies().map((ally) => ({ label: ally.name, entity: ally }));
    }
    if (targetType === 'enemy' || targetType === 'area') {
      return this.getEnemies()
        .filter((enemy) => enemy.alive)
        .map((enemy) => ({ label: enemy.name, entity: enemy }));
    }
    if (targetType === 'object') {
      return this.getNearbyObjects(caster, (object) => this.isValidObjectTarget(object, spellName), 8).map((object) => ({
        label: object.name,
        entity: object,
      }));
    }
    return [];
  }

  getNearbyObjects(origin, predicate, radius = 6) {
    if (!this.map?.getObjects) return [];
    const objects = this.map.getObjects();
    const results = [];
    objects.forEach((object) => {
      if (object?.type === 'enemy' || object?.type === 'npc') return;
      if (typeof predicate === 'function' && !predicate(object)) return;
      if (distanceBetween(origin, object) <= radius) {
        results.push(object);
      }
    });
    return results;
  }

  isValidObjectTarget(object, spellName) {
    if (!object) return false;
    if (spellName === 'unlock_magic') {
      if (object.type === 'door') {
        return Boolean(object.locked);
      }
      if (object.type === 'container') {
        return Boolean(object.locked);
      }
      return false;
    }
    if (spellName === 'telekinesis') {
      return ['item', 'container', 'door'].includes(object.type) && !object.fixed;
    }
    return true;
  }

  getEnemiesInArea(x, y, radius = 1) {
    const enemies = this.getEnemies();
    return enemies.filter((enemy) => enemy.alive && Math.abs((enemy.x ?? 0) - x) <= radius + 0.5 && Math.abs((enemy.y ?? 0) - y) <= radius + 0.5);
  }

  showMessage(text) {
    if (!text) return;
    if (this.world?.showMessage) {
      this.world.showMessage(text);
    } else {
      console.log(text);
    }
  }

  showFloatingDamage(x, y, amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (this.world?.showFloatingDamage) {
      this.world.showFloatingDamage(x ?? 0, y ?? 0, amount);
    }
  }

  showExplosionEffect(x, y) {
    this.showMessage('A burst of flame erupts!');
    this.world?.createEffect?.('fire_explosion', x ?? 0, y ?? 0);
  }

  findAdjacentTile(caster) {
    if (!caster || !this.map) return null;
    const baseX = Math.floor(caster.x ?? 0);
    const baseY = Math.floor(caster.y ?? 0);
    const offsets = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
      { x: 1, y: -1 },
      { x: -1, y: -1 },
    ];
    for (const offset of offsets) {
      const tx = baseX + offset.x;
      const ty = baseY + offset.y;
      if (this.isTileFree(tx, ty)) {
        return { x: tx + 0.5, y: ty + 0.5 };
      }
    }
    return null;
  }

  isTileFree(tileX, tileY) {
    if (!this.map) return false;
    if (!this.map.isWalkableTile?.(this.map.tileAt(tileX, tileY))) {
      return false;
    }
    const blockers = this.map.objectsAt?.(tileX, tileY) ?? [];
    return !blockers.some((object) => typeof object.blocksMovement === 'function' && object.blocksMovement());
  }

  castHeal(caster, target) {
    const recipient = target ?? caster;
    if (!recipient?.health) {
      this.showMessage('The spell finds no flesh to mend.');
      return;
    }
    const healAmount = 10 + Math.floor((caster?.int ?? 0) / 3);
    const before = recipient.health.current;
    recipient.health.current = clamp(recipient.health.current + healAmount, 0, recipient.health.max);
    const restored = recipient.health.current - before;
    this.world?.createEffect?.('heal', recipient.x ?? caster?.x ?? 0, recipient.y ?? caster?.y ?? 0);
    this.showMessage(`${recipient.name} is healed for ${restored} points!`);
  }

  castMagicMissile(caster, target) {
    if (!target || !target.health) {
      this.showMessage('Select a target for Magic Missile!');
      return;
    }
    if (caster) {
      this.world?.createEffect?.('magic_missile', caster.x ?? 0, caster.y ?? 0, target.x ?? caster.x ?? 0, target.y ?? caster.y ?? 0);
    }
    const damage = Math.max(1, 3 + Math.floor((caster?.int ?? 0) / 4));
    const dealt = target.takeDamage ? target.takeDamage(damage) : Math.min(damage, target.health.current);
    if (!target.takeDamage) {
      target.health.current = Math.max(0, target.health.current - damage);
    }
    this.showFloatingDamage(target.x, target.y, dealt);
    this.showMessage(`Magic Missile hits ${target.name} for ${dealt} damage!`);
  }

  castCure(caster, target) {
    const recipient = target ?? caster;
    if (!recipient) {
      this.showMessage('There is no one to cure.');
      return;
    }
    let cleansed = false;
    if (Array.isArray(recipient.conditions)) {
      const before = recipient.conditions.length;
      recipient.conditions = recipient.conditions.filter((condition) => condition !== 'poisoned' && condition !== 'diseased');
      cleansed = recipient.conditions.length < before;
    } else if (recipient.status === 'poisoned') {
      recipient.status = 'active';
      cleansed = true;
    }
    const relief = 4 + Math.floor((caster?.int ?? 0) / 5);
    if (recipient.health) {
      recipient.health.current = clamp(recipient.health.current + relief, 0, recipient.health.max);
    }
    this.showMessage(`${recipient.name} is cleansed${cleansed ? ' of ailment' : ''}!`);
  }

  castFireball(caster, target) {
    let targetX;
    let targetY;
    if (target && Number.isFinite(target.x) && Number.isFinite(target.y)) {
      targetX = target.x;
      targetY = target.y;
    } else if (target?.entity && Number.isFinite(target.entity.x)) {
      targetX = target.entity.x;
      targetY = target.entity.y;
    } else {
      targetX = caster?.target?.x ?? caster?.x ?? 0;
      targetY = caster?.target?.y ?? caster?.y ?? 0;
    }
    this.world?.createEffect?.('fireball', caster?.x ?? 0, caster?.y ?? 0, targetX, targetY);
    const damage = 8 + Math.floor((caster?.int ?? 0) / 2);
    const enemies = this.getEnemiesInArea(targetX, targetY, 1);
    enemies.forEach((enemy) => {
      const dealt = enemy.takeDamage ? enemy.takeDamage(damage) : Math.min(damage, enemy.health.current);
      if (!enemy.takeDamage) {
        enemy.health.current = Math.max(0, enemy.health.current - damage);
      }
      this.showFloatingDamage(enemy.x, enemy.y, dealt);
    });
    this.showExplosionEffect(targetX, targetY);
    this.showMessage(`Fireball explodes for ${damage} damage!`);
  }

  castTelekinesis(caster, target) {
    if (!target) {
      this.showMessage('The spell grasps at nothing.');
      return;
    }
    if (target.fixed) {
      this.showMessage('The object refuses to budge.');
      return;
    }
    if (distanceBetween(caster, target) > 6) {
      this.showMessage('The object is too distant to move.');
      return;
    }
    const destination = this.findAdjacentTile(caster);
    if (!destination) {
      this.showMessage('No room nearby to guide the object.');
      return;
    }
    if (typeof target.setPosition === 'function') {
      target.setPosition(destination.x, destination.y);
    } else {
      target.x = destination.x;
      target.y = destination.y;
    }
    this.showMessage(`Invisible forces lift ${target.name} to ${caster.name}'s side!`);
  }

  castUnlock(caster, target) {
    if (!target) {
      this.showMessage('There is nothing to unlock.');
      return;
    }
    if (target.type === 'door') {
      if (!target.locked) {
        this.showMessage('The door is already free to open.');
        return;
      }
      target.locked = false;
      if (typeof target.setOpen === 'function') {
        target.setOpen(true);
      }
      this.showMessage('A shimmer surrounds the door as its lock clicks open!');
      return;
    }
    if (target.type === 'container') {
      if (!target.locked) {
        this.showMessage('The container is not locked.');
        return;
      }
      target.locked = false;
      this.showMessage('Mystic energy releases the container latch.');
      return;
    }
    this.showMessage('The magic finds no lock to unbind.');
  }
}

export const KNOWN_REAGENTS = Object.freeze(REAGENT_TYPES);
