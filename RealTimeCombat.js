const DEFAULT_INTERVAL = 100;
const ATTACK_RANGE = 1.5;

const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

export class RealTimeCombat {
  constructor(party, enemies = [], gameWorld = null, options = {}) {
    this.party = party;
    this.enemies = Array.isArray(enemies) ? enemies : [];
    this.gameWorld = gameWorld ?? null;
    this.inventory = options.inventory ?? null;
    this.interval = Number.isFinite(options.interval) ? Math.max(16, options.interval) : DEFAULT_INTERVAL;
    this.combatLoop = null;
    this.isPaused = false;
    this.onUpdate = typeof options.onUpdate === 'function' ? options.onUpdate : null;
    this.onVictory = typeof options.onVictory === 'function' ? options.onVictory : null;
    this.onDefeat = typeof options.onDefeat === 'function' ? options.onDefeat : null;
    this.onInventoryChange = typeof options.onInventoryChange === 'function' ? options.onInventoryChange : null;
  }

  setEnemies(enemies = []) {
    this.enemies = Array.isArray(enemies) ? enemies : [];
  }

  addEnemy(enemy) {
    if (enemy) {
      this.enemies.push(enemy);
    }
  }

  startCombat(enemies = null) {
    if (enemies) {
      this.setEnemies(enemies);
    }
    if (this.combatLoop) {
      clearInterval(this.combatLoop);
    }
    this.isPaused = false;
    this.combatLoop = setInterval(() => {
      if (!this.isPaused) {
        this.processCombatRound();
      }
    }, this.interval);
  }

  stopCombat() {
    if (this.combatLoop) {
      clearInterval(this.combatLoop);
      this.combatLoop = null;
    }
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  processCombatRound() {
    const now = Date.now();
    if (this.party?.members) {
      this.party.members.forEach((member) => {
        if (!member?.alive) return;
        if (!member.target || !member.target?.health || member.target.health.current <= 0) {
          member.setTarget(this.findClosestEnemy(member));
        }
        if (!member.target || !member.canAttack(now)) return;
        if (!this.withinRange(member, member.target)) return;
        const damage = this.executeAttack(member, member.target);
        member.recordAttack(now);
        if (damage > 0 && member.target?.takeDamage && member.target.health.current <= 0) {
          member.setTarget(this.findClosestEnemy(member));
        }
      });
    }

    this.enemies.forEach((enemy) => {
      if (!enemy?.alive) return;
      if (enemy.ai && typeof enemy.ai.update === 'function') {
        enemy.ai.update(enemy, this.party, this.gameWorld);
      }
      if (!enemy.target || !enemy.target?.alive) {
        enemy.target = this.findClosestPartyMember(enemy);
      }
      if (!enemy.target || !enemy.canAttack?.(now)) return;
      if (!this.withinRange(enemy, enemy.target)) return;
      this.executeAttack(enemy, enemy.target);
      enemy.lastAttackTime = now;
    });

    this.removeDeadEntities();
    this.onUpdate?.({ party: this.party, enemies: this.enemies });
  }

  withinRange(attacker, target) {
    if (!attacker || !target) return false;
    const dx = (target.x ?? 0) - (attacker.x ?? 0);
    const dy = (target.y ?? 0) - (attacker.y ?? 0);
    return Math.hypot(dx, dy) <= ATTACK_RANGE;
  }

  executeAttack(attacker, target) {
    if (!attacker || !target) return 0;
    const damage = this.calculateDamage(attacker, target);
    if (damage <= 0) return 0;
    let actual = 0;
    if (typeof target.takeDamage === 'function') {
      actual = target.takeDamage(damage);
    } else if (target.health) {
      const before = target.health.current;
      target.health.current = Math.max(0, before - damage);
      actual = before - target.health.current;
    }
    if (actual <= 0) return 0;
    this.showFloatingDamage(target, actual);
    this.triggerCombatEffects(attacker, target);
    this.showMessage(`${attacker.name} hits ${target.name} for ${actual} damage!`);
    return actual;
  }

  calculateDamage(attacker, target) {
    const attack = typeof attacker.attackPower === 'function'
      ? attacker.attackPower()
      : Number.isFinite(attacker.attackPower)
      ? attacker.attackPower
      : Number.isFinite(attacker.attack)
      ? attacker.attack
      : Number.isFinite(attacker.str)
      ? attacker.str
      : 1;
    const defense = typeof target.defensePower === 'function'
      ? target.defensePower()
      : Number.isFinite(target.defense)
      ? target.defense
      : Number.isFinite(target.dex)
      ? target.dex / 4
      : 0;
    const variance = 0.8 + Math.random() * 0.4;
    const raw = (attack - defense * 0.5) * variance;
    return Math.max(1, Math.round(raw));
  }

  findClosestEnemy(member) {
    if (!member) return null;
    let closest = null;
    let minDistance = Infinity;
    this.enemies.forEach((enemy) => {
      if (!enemy?.alive) return;
      const dx = (enemy.x ?? 0) - (member.x ?? 0);
      const dy = (enemy.y ?? 0) - (member.y ?? 0);
      const dist = Math.hypot(dx, dy);
      if (dist < minDistance) {
        minDistance = dist;
        closest = enemy;
      }
    });
    return closest;
  }

  findClosestPartyMember(enemy) {
    if (!enemy || !this.party?.members) return null;
    let closest = null;
    let minDistance = Infinity;
    this.party.members.forEach((member) => {
      if (!member?.alive) return;
      const dx = (member.x ?? 0) - (enemy.x ?? 0);
      const dy = (member.y ?? 0) - (enemy.y ?? 0);
      const dist = Math.hypot(dx, dy);
      if (dist < minDistance) {
        minDistance = dist;
        closest = member;
      }
    });
    return closest;
  }

  showFloatingDamage(target, amount) {
    if (!target || amount <= 0) return;
    if (this.gameWorld?.showFloatingDamage) {
      this.gameWorld.showFloatingDamage(target.x ?? 0, target.y ?? 0, amount);
    }
  }

  triggerCombatEffects(attacker, target) {
    if (!target) return;
    if (this.gameWorld?.createEffect) {
      this.gameWorld.createEffect('sword_slash', target.x ?? 0, target.y ?? 0);
    }
    if (this.gameWorld?.spawnParticles) {
      this.gameWorld.spawnParticles('blood', target.x ?? 0, target.y ?? 0);
    }
  }

  showMessage(text) {
    if (!text) return;
    if (this.gameWorld?.showMessage) {
      this.gameWorld.showMessage(text);
    }
  }

  removeDeadEntities() {
    const fallen = [];
    if (this.party?.members) {
      this.party.members.forEach((member) => {
        if (member.alive) return;
        if (member.status !== 'down') {
          member.status = 'down';
          fallen.push(member);
          this.showMessage(`${member.name} collapses!`);
        }
      });
    }

    const loot = [];
    let inventoryChanged = false;
    const survivors = [];
    this.enemies.forEach((enemy) => {
      if (enemy.alive) {
        survivors.push(enemy);
        return;
      }
      this.showMessage(`${enemy.name} is vanquished!`);
      const drops = asArray(enemy.dropLoot?.());
      drops.forEach((item) => {
        if (!item) return;
        if (this.inventory && this.inventory.canAddItem?.(item) && this.inventory.add?.(item)) {
          this.showMessage(`${item.name ?? 'Treasure'} is added to the packs.`);
          inventoryChanged = true;
        } else if (this.gameWorld?.map?.addObject) {
          const clone = item.clone ? item.clone() : item;
          if (typeof clone.setPosition === 'function') {
            clone.setPosition(Math.floor(enemy.x ?? 0), Math.floor(enemy.y ?? 0));
          } else {
            clone.x = Math.floor(enemy.x ?? 0);
            clone.y = Math.floor(enemy.y ?? 0);
          }
          this.gameWorld.map.addObject(clone);
          this.showMessage(`${enemy.name} drops ${item.name ?? 'something of value'}.`);
        } else {
          loot.push(item);
        }
      });
      if (this.gameWorld?.map?.removeObject) {
        this.gameWorld.map.removeObject(enemy.id);
      }
    });
    this.enemies = survivors;

    if (this.enemies.length === 0) {
      this.stopCombat();
      this.showMessage('The battle is won!');
      this.onVictory?.({ loot, fallen });
    }
    if (fallen.length === this.party?.members?.length) {
      this.stopCombat();
      this.showMessage('All party members have fallen...');
      this.onDefeat?.();
    }
    if (inventoryChanged) {
      this.onInventoryChange?.();
    }
  }

  setPartyTarget(member, enemy) {
    if (!member || !enemy) return;
    member.setTarget(enemy);
    this.showMessage(`${member.name} now targets ${enemy.name}.`);
  }
}

