const TWO_PI = Math.PI * 2;

class FloatingTextEffect {
  constructor(worldX, worldY, text, color = '#ffffff', duration = 1500) {
    this.worldX = worldX;
    this.worldY = worldY;
    this.text = text;
    this.color = color;
    this.duration = duration;
    this.startTime = performance.now();
    this.endTime = this.startTime + duration;
  }

  update(now) {
    return now < this.endTime;
  }

  render(ctx, worldRenderer) {
    const progress = clamp01((performance.now() - this.startTime) / this.duration);
    const screen = worldRenderer.worldToScreen(this.worldX, this.worldY - progress * 0.6, { align: 'center' });
    if (!screen) return;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = this.color;
    ctx.font = `${Math.max(12, worldRenderer.tileDisplaySize * 0.35)}px 'Press Start 2P', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(String(this.text), screen.x + worldRenderer.tileDisplaySize / 2, screen.y);
    ctx.restore();
  }
}

class ProjectileEffect {
  constructor(template, startX, startY, targetX, targetY, spriteRenderer, worldRenderer, effectsRenderer) {
    this.template = template;
    this.spriteRenderer = spriteRenderer;
    this.worldRenderer = worldRenderer;
    this.effectsRenderer = effectsRenderer;
    this.x = startX;
    this.y = startY;
    this.targetX = targetX ?? startX;
    this.targetY = targetY ?? startY;
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.max(1e-3, Math.hypot(dx, dy));
    const speedTiles = (template.speed ?? 180) / (spriteRenderer.tileSize ?? 32);
    this.vx = (dx / distance) * speedTiles;
    this.vy = (dy / distance) * speedTiles;
    this.remaining = distance;
    this.lastUpdate = performance.now();
  }

  update(now) {
    const delta = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;
    const step = Math.hypot(this.vx, this.vy) * delta;
    this.remaining -= step;
    this.x += this.vx * delta;
    this.y += this.vy * delta;
    if (this.template.trail) {
      this.effectsRenderer.spawnParticle(this.x, this.y, { color: '#a0d8ff' });
    }
    if (this.remaining <= 0) {
      if (this.template.impact) {
        this.effectsRenderer.createEffect(this.template.impact, this.targetX, this.targetY);
      }
      return false;
    }
    return true;
  }

  render(ctx, worldRenderer) {
    const sprite = this.template.sprite;
    const screen = worldRenderer.worldToScreen(this.x, this.y, { align: 'center' });
    if (!screen || !sprite) return;
    this.spriteRenderer.drawSprite(
      sprite.sheet ?? 'effects',
      sprite.x ?? 0,
      sprite.y ?? 0,
      screen.x,
      screen.y,
      sprite.width ?? 32,
      sprite.height ?? 32,
      { scale: this.spriteRenderer.scale },
    );
  }
}

class SpriteBurstEffect {
  constructor(template, worldX, worldY, spriteRenderer, worldRenderer) {
    this.template = template;
    this.worldX = worldX;
    this.worldY = worldY;
    this.spriteRenderer = spriteRenderer;
    this.worldRenderer = worldRenderer;
    this.startTime = performance.now();
    this.duration = template.duration ?? 450;
    this.frames = template.frames ?? 4;
  }

  update(now) {
    return now - this.startTime < this.duration;
  }

  render() {
    const now = performance.now();
    const progress = clamp01((now - this.startTime) / this.duration);
    const frame = Math.floor(progress * this.frames);
    const sprite = {
      sheet: this.template.sprite?.sheet ?? 'effects',
      x: (this.template.sprite?.x ?? 0) + frame * (this.template.sprite?.width ?? 32),
      y: this.template.sprite?.y ?? 0,
      width: this.template.sprite?.width ?? 32,
      height: this.template.sprite?.height ?? 32,
    };
    const screen = this.worldRenderer.worldToScreen(this.worldX, this.worldY, { align: 'center' });
    if (!screen) return;
    this.spriteRenderer.drawSprite(sprite.sheet, sprite.x, sprite.y, screen.x, screen.y, sprite.width, sprite.height, {
      scale: this.spriteRenderer.scale,
    });
  }
}

class Particle {
  constructor(x, y, options = {}) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 0.8;
    this.vy = (Math.random() - 0.5) * 0.8;
    this.life = options.life ?? 0.6;
    this.color = options.color ?? '#ffffff';
    this.scale = options.scale ?? 0.2;
    this.created = performance.now();
  }

  update(now) {
    const delta = (now - this.created) / 1000;
    this.x += this.vx * delta;
    this.y += this.vy * delta;
    this.life -= delta;
    return this.life > 0;
  }

  render(ctx, worldRenderer) {
    const screen = worldRenderer.worldToScreen(this.x, this.y, { align: 'center' });
    if (!screen) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, this.life));
    ctx.fillStyle = this.color;
    const size = worldRenderer.tileDisplaySize * this.scale;
    ctx.beginPath();
    ctx.arc(screen.x + worldRenderer.tileDisplaySize / 2, screen.y + worldRenderer.tileDisplaySize / 2, size, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }
}

const clamp01 = (value) => Math.max(0, Math.min(1, value));

export class EffectsRenderer {
  constructor(spriteRenderer, worldRenderer) {
    this.spriteRenderer = spriteRenderer;
    this.worldRenderer = worldRenderer;
    this.ctx = spriteRenderer?.ctx ?? null;
    this.effects = [];
    this.particles = [];
    this.setupEffectTemplates();
  }

  setupEffectTemplates() {
    this.effectTemplates = {
      magic_missile: {
        type: 'projectile',
        sprite: { sheet: 'effects', x: 0, y: 0, width: 32, height: 32 },
        speed: 220,
        trail: true,
        impact: 'small_explosion',
      },
      fireball: {
        type: 'projectile',
        sprite: { sheet: 'effects', x: 32, y: 0, width: 32, height: 32 },
        speed: 180,
        trail: true,
        impact: 'fire_explosion',
      },
      heal: {
        type: 'area_effect',
        particles: {
          count: 20,
          color: '#6cf9a8',
          lifetime: 1200,
        },
      },
      sword_slash: {
        type: 'melee_effect',
        sprite: { sheet: 'effects', x: 96, y: 0, width: 32, height: 32 },
        frames: 4,
        duration: 280,
      },
      small_explosion: {
        type: 'melee_effect',
        sprite: { sheet: 'effects', x: 0, y: 32, width: 32, height: 32 },
        frames: 4,
        duration: 360,
      },
      fire_explosion: {
        type: 'melee_effect',
        sprite: { sheet: 'effects', x: 32, y: 32, width: 32, height: 32 },
        frames: 4,
        duration: 420,
      },
    };
  }

  createEffect(effectName, startX, startY, targetX = null, targetY = null) {
    const template = this.effectTemplates[effectName];
    if (!template) return;
    switch (template.type) {
      case 'projectile':
        this.effects.push(
          new ProjectileEffect(template, startX, startY, targetX ?? startX, targetY ?? startY, this.spriteRenderer, this.worldRenderer, this),
        );
        break;
      case 'area_effect':
        this.createAreaEffect(template, startX, startY);
        break;
      case 'melee_effect':
        this.effects.push(new SpriteBurstEffect(template, startX, startY, this.spriteRenderer, this.worldRenderer));
        break;
      default:
        break;
    }
  }

  createAreaEffect(template, worldX, worldY) {
    const particles = template.particles ?? {};
    const count = particles.count ?? 15;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * TWO_PI;
      const radius = Math.random() * 0.6;
      const x = worldX + Math.cos(angle) * radius;
      const y = worldY + Math.sin(angle) * radius;
      this.spawnParticle(x, y, { color: particles.color ?? '#7ef3ff', life: (particles.lifetime ?? 1000) / 1000 });
    }
  }

  spawnParticle(worldX, worldY, options = {}) {
    this.particles.push(new Particle(worldX, worldY, options));
  }

  createFloatingText(x, y, text, color = '#ffffff', duration = 1500) {
    this.effects.push(new FloatingTextEffect(x, y, text, color, duration));
  }

  updateEffects(delta) {
    const now = performance.now();
    this.effects = this.effects.filter((effect) => {
      if (effect.update) {
        return effect.update(now);
      }
      return true;
    });
    this.particles = this.particles.filter((particle) => particle.update(now));
  }

  render() {
    if (!this.ctx) return;
    this.effects.forEach((effect) => {
      if (typeof effect.render === 'function') {
        effect.render(this.ctx, this.worldRenderer, this.spriteRenderer);
      }
    });
    this.particles.forEach((particle) => particle.render(this.ctx, this.worldRenderer));
  }
}
