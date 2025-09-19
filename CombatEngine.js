import { ItemHelpers } from './inventory.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export class CombatEngine {
  constructor({ player, inventory, itemGenerator, rng = Math.random, onRespawn } = {}) {
    this.player = player;
    this.inventory = inventory;
    this.itemGenerator = itemGenerator;
    this.rng = rng;
    this.onRespawn = typeof onRespawn === 'function' ? onRespawn : () => {};
    this.active = false;
    this.enemies = [];
    this.turn = 'player';
    this.listeners = new Map();
    this.playerStance = 'neutral';
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit(event, payload) {
    const bucket = this.listeners.get(event);
    if (!bucket) return;
    bucket.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error('Combat listener error', error);
      }
    });
  }

  start(enemies = [], level = 1) {
    if (!this.player?.character) return false;
    if (!Array.isArray(enemies) || enemies.length === 0) return false;
    this.enemies = enemies.map((enemy) => ({ ...enemy, hp: enemy.hp ?? enemy.hpMax ?? 1 }));
    this.enemies.forEach((enemy, index) => {
      enemy.id = enemy.id ?? `enemy-${index}`;
    });
    this.active = true;
    this.turn = 'player';
    this.playerStance = 'neutral';
    this.encounterLevel = Math.max(1, Math.round(level));
    this.emit('start', this.getState());
    this.log('Enemies block your path!');
    return true;
  }

  isPlayerTurn() {
    return this.active && this.turn === 'player';
  }

  getState() {
    return {
      active: this.active,
      turn: this.turn,
      player: {
        hp: this.player?.character?.hp ?? 0,
        hpMax: this.player?.character?.hpMax ?? 0,
        mp: this.player?.character?.mp ?? 0,
        mpMax: this.player?.character?.mpMax ?? 0,
        stance: this.playerStance,
      },
      enemies: this.enemies.map((enemy) => ({
        id: enemy.id,
        name: enemy.name,
        hp: Math.round(enemy.hp),
        hpMax: Math.round(enemy.hpMax ?? enemy.hp),
        level: enemy.level ?? 1,
        attack: enemy.attack,
        defense: enemy.defense,
        alive: enemy.hp > 0,
      })),
    };
  }

  log(message) {
    this.emit('log', message);
  }

  attack(targetId) {
    if (!this.isPlayerTurn()) return { success: false, message: 'It is not your turn.' };
    const target = this._selectEnemy(targetId);
    if (!target) return { success: false, message: 'No target selected.' };

    const character = this.player.character;
    const stancePenalty = this.playerStance === 'defend' ? 0.5 : 1;
    const attackStat = Math.max(1, character.attack * stancePenalty);
    const damage = this._computeDamage(attackStat, target.defense);
    const dealt = this._applyEnemyDamage(target, damage);
    this.log(`${character.name} strikes ${target.name} for ${dealt} damage.`);
    this._checkBattleState();
    if (this.active) {
      this._endPlayerTurn();
    }
    return { success: true, damage: dealt, targetId: target.id };
  }

  defend() {
    if (!this.isPlayerTurn()) return { success: false, message: 'It is not your turn.' };
    this.playerStance = 'defend';
    this.log(`${this.player.character.name} braces for impact.`);
    this._endPlayerTurn();
    return { success: true };
  }

  useItem(itemId) {
    if (!this.isPlayerTurn()) return { success: false, message: 'It is not your turn.' };
    const item = this.inventory?.get(itemId);
    if (!item) return { success: false, message: 'Item not found.' };
    if (!ItemHelpers.isConsumable(item)) {
      return { success: false, message: 'That item cannot be used now.' };
    }

    const character = this.player.character;
    let effectApplied = false;
    const details = [];
    if (item.stats?.hp_restore) {
      const restored = character.heal(item.stats.hp_restore);
      if (restored > 0) {
        effectApplied = true;
        details.push(`restores ${restored} HP`);
      }
    }
    if (item.stats?.mp_restore) {
      const restored = character.restoreMana(item.stats.mp_restore);
      if (restored > 0) {
        effectApplied = true;
        details.push(`restores ${restored} MP`);
      }
    }

    if (!effectApplied) {
      return { success: false, message: 'The item has no effect.' };
    }

    this.inventory.remove(item.id, 1);
    this.log(`${character.name} uses ${item.name} and ${details.join(' and ')}.`);
    this.emit('state', this.getState());
    this._endPlayerTurn();
    return { success: true };
  }

  _selectEnemy(targetId) {
    if (targetId) {
      return this.enemies.find((enemy) => enemy.id === targetId && enemy.hp > 0) ?? null;
    }
    return this.enemies.find((enemy) => enemy.hp > 0) ?? null;
  }

  _computeDamage(attack, defense) {
    const base = Math.max(1, attack - (defense ?? 0));
    const variation = 0.8 + this.rng() * 0.4;
    return Math.max(1, Math.round(base * variation));
  }

  _applyEnemyDamage(enemy, amount) {
    enemy.hp = Math.max(0, enemy.hp - amount);
    this.emit('state', this.getState());
    return amount;
  }

  _applyPlayerDamage(amount) {
    const character = this.player.character;
    const damage = Math.max(0, Math.round(amount));
    if (damage <= 0) return 0;
    character.takeDamage(damage);
    this.emit('state', this.getState());
    return damage;
  }

  _endPlayerTurn() {
    this.turn = 'enemy';
    this._enemyPhase();
  }

  _enemyPhase() {
    const character = this.player.character;
    if (!character || !this.active) return;

    for (const enemy of this.enemies) {
      if (!this.active) break;
      if (enemy.hp <= 0) continue;
      const defense = character.defense * (this.playerStance === 'defend' ? 1.5 : 1);
      let damage = this._computeDamage(enemy.attack, defense);
      if (this.playerStance === 'defend') {
        damage = Math.round(damage * 0.5);
      }
      damage = clamp(damage, 0, 999);
      const applied = this._applyPlayerDamage(damage);
      this.log(`${enemy.name} strikes for ${applied} damage.`);
      if (character.hp <= 0) {
        this.log(`${character.name} collapses!`);
        this._handleDefeat();
        break;
      }
    }

    this.playerStance = 'neutral';
    if (this.active) {
      this.turn = 'player';
      this.emit('state', this.getState());
    }
  }

  _checkBattleState() {
    const alive = this.enemies.some((enemy) => enemy.hp > 0);
    if (!alive) {
      this._handleVictory();
    }
  }

  _handleVictory() {
    if (!this.active) return;
    this.active = false;
    this.turn = 'player';
    const totalXp = this.enemies.reduce((sum, enemy) => sum + (enemy.xpValue ?? enemy.level * 25), 0);
    const character = this.player.character;
    const { leveled, levels } = character.gainXp(totalXp);
    if (totalXp > 0) {
      this.log(`${character.name} gains ${totalXp} XP.`);
    }
    if (leveled) {
      this.log(`${character.name} reaches level ${character.level}!`);
      this.emit('level-up', { level: character.level, levels });
    }
    const loot = this.itemGenerator?.rollLoot(this.encounterLevel ?? 1) ?? [];
    loot.forEach((item) => this.inventory?.add(item));
    if (loot.length > 0) {
      this.log('You recover spoils from the fallen.');
    }
    this.emit('victory', { xp: totalXp, loot });
    this.emit('state', this.getState());
  }

  _handleDefeat() {
    if (!this.active) return;
    this.active = false;
    const character = this.player.character;
    const lostXp = Math.round(character.xp * 0.1);
    if (lostXp > 0) {
      character.xp = Math.max(0, character.xp - lostXp);
      this.log(`${character.name} loses ${lostXp} XP in the chaos.`);
    }
    character.hp = Math.max(1, Math.round(character.hpMax * 0.5));
    character.mp = Math.round(character.mpMax * 0.5);
    this.emit('defeat');
    this.onRespawn();
    this.emit('state', this.getState());
  }
}

