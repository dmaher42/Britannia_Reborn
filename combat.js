export class CombatSystem {
  constructor(party) {
    this.party = party;
    this.active = false;
    this.turn = 'player';
    this._listeners = new Set();
    this._enemyTimer = 0;
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

  startSkirmish() {
    if (this.active) {
      this._emit('log', 'The skirmish is already underway.');
      return false;
    }
    this.active = true;
    this.turn = 'player';
    this._emit('log', 'Hostile creatures emerge from the brush!');
    return true;
  }

  endPlayerTurn() {
    if (!this.active || this.turn !== 'player') {
      this._emit('log', 'There is no active player turn to end.');
      return false;
    }
    this.turn = 'enemy';
    this._enemyTimer = 1.5;
    this._emit('log', 'The party braces as the enemy makes their move.');
    return true;
  }

  update(dt) {
    if (!this.active) return;
    if (this.turn === 'enemy') {
      this._enemyTimer -= dt;
      if (this._enemyTimer <= 0) {
        this.turn = 'player';
        this._emit('log', 'The foes regroup; the party may act again.');
      }
    }
  }

  finish(victory = true) {
    if (!this.active) return;
    this.active = false;
    this.turn = 'player';
    this._emit('log', victory ? 'The skirmish ends in victory.' : 'The party withdraws from battle.');
    this._emit('complete', { victory });
  }
}
