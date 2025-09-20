const clamp01 = (value) => Math.min(1, Math.max(0, value));

const defaultDirection = { x: 0, y: 0 };

export class PartyMovement {
  constructor(party, gameWorld, options = {}) {
    this.party = party;
    this.gameWorld = gameWorld ?? null;
    this.followSpacing = Number.isFinite(options.followSpacing) ? Math.max(0.2, options.followSpacing) : 0.8;
    this.collisionRadius = Number.isFinite(options.collisionRadius) ? Math.max(0.1, options.collisionRadius) : 0.35;
    this.baseSpeed = Number.isFinite(options.speed) ? Math.max(0.5, options.speed) : 3.5;
    this.scatteredOffsets = new Map();
    this.formations = {
      line: (leader) => this.getLineFormation(leader),
      box: (leader) => this.getBoxFormation(leader),
      scattered: (leader) => this.getScatteredFormation(leader),
    };
    if (this.party) {
      this.party.setMovementController(this);
    }
  }

  setFormation(name) {
    if (!this.party) return;
    this.party.formation = name;
    if (name === 'scattered') {
      this.scatteredOffsets.clear();
    }
  }

  moveParty(direction = defaultDirection, dt = 0.016, worldOverride = null) {
    const world = worldOverride ?? this.gameWorld;
    const leader = this.party?.leader;
    if (!leader) return;
    const velocity = direction ?? defaultDirection;
    const next = this.calculateNewPosition(leader, velocity, dt, world);
    if (next) {
      leader.setPosition(next.x, next.y);
      leader.isMoving = Math.hypot(velocity.x ?? 0, velocity.y ?? 0) > 0;
    } else {
      leader.isMoving = false;
    }
    this.updateFollowerPositions(dt, world);
  }

  calculateNewPosition(member, direction, dt, world) {
    if (!member) return null;
    const vx = direction?.x ?? 0;
    const vy = direction?.y ?? 0;
    if (vx === 0 && vy === 0) {
      return { x: member.x, y: member.y };
    }
    const length = Math.hypot(vx, vy) || 1;
    const speed = direction?.speed ?? this.memberSpeed(member);
    const step = speed * dt;
    const nextX = member.x + (vx / length) * step;
    const nextY = member.y + (vy / length) * step;
    if (this.canOccupy(world, nextX, nextY)) {
      return { x: nextX, y: nextY };
    }
    return null;
  }

  updateFollowerPositions(dt, world) {
    if (!this.party) return;
    const leader = this.party.leader;
    if (!leader) return;
    const formation = this.formations[this.party.formation] ?? this.formations.line;
    const targets = formation(leader) ?? [];
    this.party.members.forEach((member, index) => {
      if (member === leader) return;
      const fallback = targets.length > 0 ? targets[targets.length - 1] : null;
      const target = targets[index] ?? fallback;
      if (!target) return;
      this.moveFollower(member, target, dt, world);
    });
  }

  moveFollower(member, target, dt, world) {
    const dx = target.x - member.x;
    const dy = target.y - member.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1e-3) {
      member.isMoving = false;
      return;
    }
    const desired = this.followSpacing * Math.max(1, this.party?.members?.length ?? 1) * 0.5;
    if (distance <= desired) {
      member.isMoving = false;
      return;
    }
    const move = Math.min(distance - desired * clamp01(distance / (desired * 2)), this.memberSpeed(member) * dt);
    const nx = dx / distance;
    const ny = dy / distance;
    const nextX = member.x + nx * move;
    const nextY = member.y + ny * move;
    if (this.canOccupy(world, nextX, nextY)) {
      member.setPosition(nextX, nextY);
      member.isMoving = true;
    } else {
      member.isMoving = false;
    }
  }

  memberSpeed(member) {
    if (!member) return this.baseSpeed;
    const modifier = member.dex ? 1 + (member.dex - 10) * 0.02 : 1;
    return this.baseSpeed * modifier;
  }

  canOccupy(world, x, y) {
    if (!world) return true;
    if (typeof world.canMoveTo === 'function') {
      return world.canMoveTo(x, y, this.collisionRadius);
    }
    if (typeof world.isWalkableCircle === 'function') {
      return world.isWalkableCircle(x, y, this.collisionRadius);
    }
    return true;
  }

  getLineFormation(leader) {
    if (!this.party) return [];
    return this.party.members.map((member, index) => ({
      x: leader.x - index * this.followSpacing,
      y: leader.y + index * 0.05,
      member,
    }));
  }

  getBoxFormation(leader) {
    if (!this.party) return [];
    const columns = 2;
    return this.party.members.map((member, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      return {
        x: leader.x - col * this.followSpacing + (row % 2) * 0.3,
        y: leader.y + row * (this.followSpacing * 0.8),
        member,
      };
    });
  }

  getScatteredFormation(leader) {
    if (!this.party) return [];
    return this.party.members.map((member) => {
      if (!this.scatteredOffsets.has(member.id)) {
        const angle = Math.random() * Math.PI * 2;
        const radius = this.followSpacing * (0.6 + Math.random() * 0.8);
        this.scatteredOffsets.set(member.id, {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        });
      }
      const offset = this.scatteredOffsets.get(member.id);
      return {
        x: leader.x + offset.x,
        y: leader.y + offset.y,
        member,
      };
    });
  }
}

