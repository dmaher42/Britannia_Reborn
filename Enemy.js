const ENEMY_BLUEPRINTS = [
  {
    id: 'forest_wolf',
    name: 'Forest Wolf',
    base: { attack: 6, defense: 3, hp: 32 },
  },
  {
    id: 'rogue',
    name: 'Highway Rogue',
    base: { attack: 8, defense: 5, hp: 40 },
  },
  {
    id: 'cave_spider',
    name: 'Cave Spider',
    base: { attack: 7, defense: 4, hp: 36 },
  },
  {
    id: 'shadow_imp',
    name: 'Shadow Imp',
    base: { attack: 9, defense: 6, hp: 44 },
  },
];

const pickBlueprint = (rng = Math.random) => {
  const index = Math.floor(rng() * ENEMY_BLUEPRINTS.length);
  return ENEMY_BLUEPRINTS[index];
};

export class Enemy {
  constructor({ id, name, level, attack, defense, hp, xpValue }) {
    this.id = id;
    this.name = name;
    this.level = level;
    this.attack = attack;
    this.defense = defense;
    this.hpMax = hp;
    this.hp = hp;
    this.xpValue = xpValue;
  }

  takeDamage(amount) {
    const dmg = Math.max(0, Math.round(amount));
    if (dmg <= 0) return 0;
    this.hp = Math.max(0, this.hp - dmg);
    return dmg;
  }

  get alive() {
    return this.hp > 0;
  }

  static create(areaLevel = 1, rng = Math.random) {
    const blueprint = pickBlueprint(rng);
    const level = Math.max(1, Math.round(areaLevel + rng() * 1.5));
    const attack = Math.round(blueprint.base.attack + level * 1.5);
    const defense = Math.round(blueprint.base.defense + level * 1.25);
    const hp = Math.round(blueprint.base.hp + level * 8);
    const xpValue = level * 25;
    return new Enemy({
      id: `${blueprint.id}_${Date.now().toString(16)}_${Math.floor(rng() * 999)}`,
      name: blueprint.name,
      level,
      attack,
      defense,
      hp,
      xpValue,
    });
  }
}

