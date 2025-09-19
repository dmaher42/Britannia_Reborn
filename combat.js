import { clamp } from './utils.js';

const DEFAULT_ENCOUNTER = [
  { id: 'brigand', name: 'Brigand', hp: 18, hpMax: 18, atk: 6, initiative: 12 },
  { id: 'cutpurse', name: 'Cutpurse', hp: 14, hpMax: 14, atk: 4, initiative: 9 }
];

const DEFAULT_ENEMY_DELAY = 1.2;

const SPELL_DAMAGE_TABLE = {
  fire_dart: (caster) => {
    const intellect = Number.isFinite(caster?.INT) ? caster.INT : 8;
    return Math.max(6, Math.round(intellect * 1.2 + 6));
  }
};

const roundStat = (value, fallback = 0) => {
  if (!Number.isFinite(value)) return Math.round(fallback);
  return Math.round(value);
};

export class CombatSystem {
  constructor(party, options = {}) {
    this.party = party;
    this.active = false;
    this.turn = 'player';
    this.round = 0;
    this.enemies = [];
    this._listeners = new Set();
    this._enemyTimer = 0;
    this._pendingEnemyActions = [];
    this._enemyDelay = Number.isFinite(options.enemyDelay) ? Math.max(0, options.enemyDelay) : DEFAULT_ENEMY_DELAY;
    this._rng = typeof options.rng === 'function' ? options.rng : Math.random;
    this._spellbook = options.spellbook ?? null;
  }

  setSpellbook(spellbook) {
    this._spellbook = spellbook ?? null;
  }

  onEvent(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _emit(event, payload) {
    for (const listener of this._listeners) {
      listener(event, payload);
    }
  }

  _fxIdFor(side, entity) {
    if (!entity) return null;
    if (typeof entity.id === 'string' && entity.id.length > 0) return entity.id;
    if (side === 'party' && Array.isArray(this.party?.members)) {
      const index = this.party.members.indexOf(entity);
      if (index >= 0) return entity.name ?? `party-${index}`;
    }
    if (side === 'enemy' && Array.isArray(this.enemies)) {
      const index = this.enemies.indexOf(entity);
      if (index >= 0) return entity.name ?? `enemy-${index + 1}`;
    }
    return entity.name ?? null;
  }

  _positionOf(entity) {
    const x = entity?.x;
    const y = entity?.y;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y };
    }
    return null;
  }

  _emitHitEvent({ amount = 0, target = null, attacker = null, source = 'party', targetSide = 'enemy', cause = 'attack', spellId = null, crit = false, kind = 'damage', result = null } = {}) {
    const cleaned = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    const payload = {
      amount: Math.round(cleaned),
      cause,
      source,
      targetSide,
      targetId: target?.id ?? null,
      targetName: target?.name ?? target?.id ?? '',
      attackerId: attacker?.id ?? null,
      attackerName: attacker?.name ?? attacker?.id ?? '',
      targetEntityId: this._fxIdFor(targetSide, target),
      attackerEntityId: this._fxIdFor(source === 'party' ? 'party' : 'enemy', attacker),
      targetPosition: this._positionOf(target),
      attackerPosition: this._positionOf(attacker),
      target: target
        ? { id: target.id, name: target.name, hp: roundStat(target.hp, target.hpMax), hpMax: roundStat(target.hpMax, target.hp), x: target.x, y: target.y }
        : null,
      attacker: attacker
        ? { id: attacker.id, name: attacker.name, hp: roundStat(attacker.hp, attacker.hpMax), hpMax: roundStat(attacker.hpMax, attacker.hp), x: attacker.x, y: attacker.y }
        : null,
      spellId: spellId ?? null,
      crit: !!crit,
      kind,
      result: result ?? (cleaned > 0 ? 'hit' : 'block')
    };
    this._emit('hit', payload);
  }

  getState() {
    return {
      active: this.active,
      turn: this.turn,
      round: this.round,
      enemies: this.enemies.map((enemy) => ({
        id: enemy.id,
        name: enemy.name,
        hp: roundStat(enemy.hp),
        hpMax: roundStat(enemy.hpMax),
        atk: enemy.atk,
        initiative: enemy.initiative,
        alive: enemy.hp > 0
      })),
      party: Array.isArray(this.party?.members)
        ? this.party.members.map((member, index) => ({
            id: member.id ?? `party-${index}`,
            name: member.name ?? `Member ${index + 1}`,
            hp: roundStat(member.hp),
            hpMax: roundStat(member.hpMax ?? member.hp),
            mp: roundStat(member.mp ?? 0),
            mpMax: roundStat(member.mpMax ?? member.mp ?? 0),
            alive: (member.hp ?? 0) > 0
          }))
        : []
    };
  }

  isPlayerTurn() {
    return this.active && this.turn === 'player';
  }

  startSkirmish(roster = DEFAULT_ENCOUNTER) {
    if (this.active) {
      this._emit('log', 'The skirmish is already underway.');
      return false;
    }

    if (!this._hasReadyPartyMember()) {
      this._emit('log', 'The party is in no shape to fight.');
      return false;
    }

    const sanitized = this._prepareRoster(Array.isArray(roster) && roster.length > 0 ? roster : DEFAULT_ENCOUNTER);
    if (sanitized.length === 0) {
      this._emit('log', 'There are no foes to engage.');
      return false;
    }

    this.enemies = sanitized;
    this.active = true;
    this.turn = 'player';
    this.round = 1;
    this._enemyTimer = 0;
    this._pendingEnemyActions = [];
    this._emit('log', 'Hostile creatures emerge from the brush!');
    this._emit('state', this.getState());
    this._emit('turn', { turn: 'player' });
    return true;
  }

  endPlayerTurn() {
    if (!this.isPlayerTurn()) {
      this._emit('log', this.active ? 'It is not the party\'s turn.' : 'There is no active skirmish.');
      return false;
    }
    this._prepareEnemyTurn();
    return true;
  }

  update(dt) {
    if (!this.active || this.turn !== 'enemy') return;
    this._enemyTimer -= dt;
    if (this._enemyTimer <= 0) {
      this._resolveEnemyTurn();
    }
  }

  playerAttack(targetId) {
    if (!this.isPlayerTurn()) {
      const message = this.active ? 'It is not the party\'s turn to act.' : 'No combat is underway.';
      return { success: false, message };
    }

    const attacker = this._selectAttacker();
    if (!attacker) {
      const message = 'No conscious party members remain to strike.';
      this._emit('log', message);
      return { success: false, message };
    }

    const target = this._selectEnemy(targetId);
    if (!target) {
      const message = 'There are no valid targets.';
      this._emit('log', message);
      return { success: false, message };
    }

    const damage = this._computePhysicalDamage(attacker);
    const actualDamage = this._applyEnemyDamage(target, damage);
    this._emit('log', `${attacker.name} attacks ${target.name} for ${actualDamage} damage.`);
    if (target.hp <= 0) {
      this._emit('log', `${target.name} is defeated!`);
    }

    this._emitHitEvent({ amount: actualDamage, target, attacker, source: 'party', targetSide: 'enemy', cause: 'attack', kind: 'damage' });
    this._emit('state', this.getState());
    if (this._checkVictory()) {
      return { success: true, damage: actualDamage, targetId: target.id, defeated: true };
    }

    if (this.active) {
      this._prepareEnemyTurn();
    }

    return { success: true, damage: actualDamage, targetId: target.id, defeated: target.hp <= 0 };
  }

  playerCast(spellId, targetId) {
    if (!this.isPlayerTurn()) {
      const message = this.active ? 'It is not the party\'s turn to act.' : 'No combat is underway.';
      return { success: false, message };
    }

    if (!this._spellbook) {
      const message = 'No spellbook is available for casting.';
      this._emit('log', message);
      return { success: false, message };
    }

    const caster = this._selectAttacker();
    if (!caster) {
      const message = 'No conscious caster remains.';
      this._emit('log', message);
      return { success: false, message };
    }

    const spell = this._spellbook.get(spellId);
    if (!spell) {
      const message = 'That incantation is unknown.';
      this._emit('log', message);
      return { success: false, message };
    }

    if (!this._spellbook.canCast(spellId, caster)) {
      const message = `${caster.name} lacks the means to cast ${spell.name}.`;
      this._emit('log', message);
      return { success: false, message };
    }

    const target = this._selectEnemy(targetId);
    if (!target) {
      const message = 'There are no valid targets.';
      this._emit('log', message);
      return { success: false, message };
    }

    if (!this._spellbook.cast(spellId, caster)) {
      const message = `${caster.name} cannot complete the casting of ${spell.name}.`;
      this._emit('log', message);
      return { success: false, message };
    }

    const damage = this._computeSpellDamage(caster, spellId);
    const actualDamage = this._applyEnemyDamage(target, damage);
    this._emit('log', `${caster.name} casts ${spell.name} at ${target.name} for ${actualDamage} damage.`);
    if (target.hp <= 0) {
      this._emit('log', `${target.name} is reduced to smoldering embers.`);
    }

    this._emitHitEvent({ amount: actualDamage, target, attacker: caster, source: 'party', targetSide: 'enemy', cause: 'spell', spellId, kind: 'damage' });
    this._emit('state', this.getState());
    if (this._checkVictory()) {
      return { success: true, damage: actualDamage, targetId: target.id, defeated: true, spell: spellId };
    }

    if (this.active) {
      this._prepareEnemyTurn();
    }

    return { success: true, damage: actualDamage, targetId: target.id, defeated: target.hp <= 0, spell: spellId };
  }

  finish(victory = true) {
    if (!this.active) return;
    this.active = false;
    this.turn = 'player';
    this._enemyTimer = 0;
    this._pendingEnemyActions = [];
    const rewards = victory ? this._calculateRewards() : { xp: 0, gold: 0 };
    const summary = {
      victory,
      rewards,
      enemies: this.enemies.map((enemy) => ({
        id: enemy.id,
        name: enemy.name,
        defeated: enemy.hp <= 0
      }))
    };
    this._emit('log', victory ? 'The skirmish ends in victory.' : 'The party withdraws from battle.');
    this._emit('complete', summary);
    this._emit('state', this.getState());
  }

  _prepareRoster(roster) {
    return roster
      .map((enemy, index) => this._sanitizeEnemy(enemy, index))
      .filter((enemy) => enemy.hp > 0 && enemy.hpMax > 0);
  }

  _sanitizeEnemy(enemy, index) {
    const id = typeof enemy?.id === 'string' && enemy.id.length > 0 ? enemy.id : `enemy-${index + 1}`;
    const name = enemy?.name ?? id;
    const hpMaxCandidate = Number.isFinite(enemy?.hpMax) ? enemy.hpMax : Number.isFinite(enemy?.hp) ? enemy.hp : 12;
    const hpMax = Math.max(1, Math.round(hpMaxCandidate));
    const hpCandidate = Number.isFinite(enemy?.hp) ? enemy.hp : hpMax;
    const hp = clamp(Math.round(hpCandidate), 0, hpMax);
    const atk = Number.isFinite(enemy?.atk) ? enemy.atk : 4;
    const initiative = Number.isFinite(enemy?.initiative) ? enemy.initiative : Math.max(1, 12 - index * 2);
    return {
      id,
      name,
      hp,
      hpMax,
      atk,
      initiative
    };
  }

  _prepareEnemyTurn() {
    this.turn = 'enemy';
    this._enemyTimer = this._enemyDelay;
    this._pendingEnemyActions = this.enemies
      .filter((enemy) => enemy.hp > 0)
      .sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
    this._emit('log', 'The party braces as the enemy makes their move.');
    this._emit('state', this.getState());
    this._emit('turn', { turn: 'enemy' });
  }

  _resolveEnemyTurn() {
    if (!this.active) return;
    for (const enemy of this._pendingEnemyActions) {
      if (enemy.hp <= 0) continue;
      const target = this._selectPartyTarget();
      if (!target) break;
      const damage = this._computeEnemyDamage(enemy);
      const actualDamage = this._applyPartyDamage(target, damage);
      this._emit('log', `${enemy.name} strikes ${target.name} for ${actualDamage} damage.`);
      if (target.hp <= 0) {
        this._emit('log', `${target.name} falls unconscious!`);
      }
      this._emitHitEvent({ amount: actualDamage, target, attacker: enemy, source: 'enemy', targetSide: 'party', cause: 'attack', kind: 'damage' });
      if (this._checkDefeat()) {
        this._pendingEnemyActions = [];
        return;
      }
    }

    if (this.active) {
      this.turn = 'player';
      this._pendingEnemyActions = [];
      this._enemyTimer = 0;
      this.round += 1;
      this._emit('log', 'The foes regroup; the party may act again.');
      this._emit('state', this.getState());
      this._emit('turn', { turn: 'player' });
    }
  }

  _selectAttacker() {
    if (!Array.isArray(this.party?.members)) return null;
    const leaderIndex = Number.isInteger(this.party.leaderIndex) ? this.party.leaderIndex : 0;
    const leader = this.party.members[leaderIndex];
    if (leader && (leader.hp ?? 0) > 0) {
      return leader;
    }
    return this.party.members.find((member) => (member?.hp ?? 0) > 0) ?? null;
  }

  _selectEnemy(targetId) {
    if (!Array.isArray(this.enemies) || this.enemies.length === 0) return null;
    if (targetId) {
      const found = this.enemies.find((enemy) => enemy.id === targetId && enemy.hp > 0);
      if (found) return found;
    }
    return this.enemies.find((enemy) => enemy.hp > 0) ?? null;
  }

  _selectPartyTarget() {
    if (!Array.isArray(this.party?.members)) return null;
    const byInitiative = this.party.members
      .map((member, index) => ({ member, index }))
      .filter(({ member }) => (member?.hp ?? 0) > 0)
      .sort((a, b) => a.index - b.index);
    return byInitiative.length > 0 ? byInitiative[0].member : null;
  }

  _applyEnemyDamage(enemy, amount) {
    const before = enemy.hp;
    enemy.hp = clamp(enemy.hp - amount, 0, enemy.hpMax);
    return Math.max(0, before - enemy.hp);
  }

  _applyPartyDamage(member, amount) {
    const before = member.hp ?? 0;
    member.hp = clamp(before - amount, 0, member.hpMax ?? before);
    return Math.max(0, before - member.hp);
  }

  _computePhysicalDamage(attacker) {
    const strength = Number.isFinite(attacker?.STR) ? attacker.STR : 8;
    const dexterity = Number.isFinite(attacker?.DEX) ? attacker.DEX : strength;
    const base = strength * 0.75 + dexterity * 0.25;
    return Math.max(1, Math.round(base * 0.75));
  }

  _computeSpellDamage(caster, spellId) {
    const formula = SPELL_DAMAGE_TABLE[spellId];
    if (typeof formula === 'function') {
      return Math.max(1, Math.round(formula(caster)));
    }
    return this._computePhysicalDamage(caster) + 4;
  }

  _computeEnemyDamage(enemy) {
    const atk = Number.isFinite(enemy?.atk) ? enemy.atk : 4;
    return Math.max(1, Math.round(atk));
  }

  _checkVictory() {
    if (!this.active) return false;
    const hasLivingEnemy = this.enemies.some((enemy) => enemy.hp > 0);
    if (!hasLivingEnemy) {
      this.finish(true);
      return true;
    }
    return false;
  }

  _checkDefeat() {
    if (!this.active) return false;
    const members = Array.isArray(this.party?.members) ? this.party.members : [];
    const allDown = members.length > 0 && members.every((member) => (member?.hp ?? 0) <= 0);
    if (allDown) {
      this.finish(false);
      return true;
    }
    this._emit('state', this.getState());
    return false;
  }

  _calculateRewards() {
    const defeated = this.enemies.filter((enemy) => enemy.hp <= 0).length;
    if (defeated === 0) {
      return { xp: 0, gold: 0 };
    }
    const xp = defeated * 12;
    const gold = defeated * 8;
    return { xp, gold };
  }

  _hasReadyPartyMember() {
    if (!Array.isArray(this.party?.members)) return false;
    return this.party.members.some((member) => (member?.hp ?? 0) > 0);
  }
}
