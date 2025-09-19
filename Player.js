const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export class Player {
  constructor(character, options = {}) {
    this.character = character;
    this.position = {
      x: Number.isFinite(options.x) ? options.x : 1.5,
      y: Number.isFinite(options.y) ? options.y : 1.5,
    };
    this.area = options.area ?? 'forest';
    this.speed = Number.isFinite(options.speed) ? options.speed : 3.5;
    this.radius = Number.isFinite(options.radius) ? options.radius : 0.3;
  }

  setArea(areaId, spawn) {
    this.area = areaId;
    if (spawn) {
      this.position.x = spawn.x + 0.5;
      this.position.y = spawn.y + 0.5;
    }
  }

  setPosition(tileX, tileY) {
    this.position.x = tileX + 0.5;
    this.position.y = tileY + 0.5;
  }

  update(dt, input, map) {
    if (!dt || !input || !map) return;
    const direction = input.getDirection ? input.getDirection() : input;
    const dx = direction.x ?? 0;
    const dy = direction.y ?? 0;
    if (dx === 0 && dy === 0) return;

    const moveDistance = this.speed * dt;
    const nextX = this.position.x + dx * moveDistance;
    const nextY = this.position.y + dy * moveDistance;

    if (map.isWalkableCircle(nextX, this.position.y, this.radius)) {
      this.position.x = clamp(nextX, 0, map.currentWidth - 0.01);
    }

    if (map.isWalkableCircle(this.position.x, nextY, this.radius)) {
      this.position.y = clamp(nextY, 0, map.currentHeight - 0.01);
    }
  }

  toJSON() {
    return {
      position: { ...this.position },
      area: this.area,
    };
  }
}

