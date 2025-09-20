export class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.particles = [];
    this.emitters = [];
  }

  createFireParticles(x, y, count = 15) {
    for (let i = 0; i < count; i += 1) {
      this.particles.push(new FireParticle(x, y));
    }
  }

  createMagicSparkles(x, y, color = '#00ffff', count = 20) {
    for (let i = 0; i < count; i += 1) {
      this.particles.push(new SparkleParticle(x, y, color));
    }
  }

  createBloodSplatter(x, y, count = 10) {
    for (let i = 0; i < count; i += 1) {
      this.particles.push(new BloodParticle(x, y));
    }
  }

  update() {
    this.particles = this.particles.filter((particle) => {
      particle.update();
      return particle.life > 0;
    });
    this.emitters.forEach((emitter) => emitter.update?.());
  }

  render(ctx) {
    this.particles.forEach((particle) => particle.render(ctx));
  }
}

class FireParticle {
  constructor(x, y) {
    this.x = x + (Math.random() - 0.5) * 10;
    this.y = y + (Math.random() - 0.5) * 10;
    this.vx = (Math.random() - 0.5) * 20;
    this.vy = -20 - Math.random() * 30;
    this.life = 1.0;
    this.decay = 0.02;
    this.color = `hsl(${Math.random() * 60}, 100%, 50%)`;
  }

  update() {
    this.x += this.vx * 0.016;
    this.y += this.vy * 0.016;
    this.vy += 0.5;
    this.life -= this.decay;
  }

  render(ctx) {
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class SparkleParticle {
  constructor(x, y, color) {
    this.x = x + (Math.random() - 0.5) * 15;
    this.y = y + (Math.random() - 0.5) * 15;
    this.vx = (Math.random() - 0.5) * 10;
    this.vy = (Math.random() - 0.5) * 10;
    this.life = 1.2;
    this.decay = 0.015;
    this.color = color;
    this.size = 2 + Math.random() * 2;
  }

  update() {
    this.x += this.vx * 0.016;
    this.y += this.vy * 0.016;
    this.life -= this.decay;
  }

  render(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.restore();
  }
}

class BloodParticle {
  constructor(x, y) {
    this.x = x + (Math.random() - 0.5) * 8;
    this.y = y + (Math.random() - 0.5) * 8;
    this.vx = (Math.random() - 0.5) * 30;
    this.vy = -Math.random() * 40;
    this.life = 0.8;
    this.decay = 0.03;
    this.gravity = 60;
    this.radius = 1 + Math.random() * 2;
  }

  update() {
    this.vy += this.gravity * 0.016;
    this.x += this.vx * 0.016;
    this.y += this.vy * 0.016;
    this.life -= this.decay;
  }

  render(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = '#8b1a1a';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
