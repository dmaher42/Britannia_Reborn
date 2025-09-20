const TILE_COLORS = {
  grass: '#2f6f3d',
  tree: '#173b26',
  water: '#1b3a66',
  path: '#8a744a',
  cave_entrance: '#b19862',
  cave_floor: '#6a5b52',
  wall: '#1f1b24',
  floor: '#6b6254',
  void: '#020409',
};

const PARTY_COLORS = ['#ffd76f', '#f9a825', '#81d4fa', '#ff8a80', '#a5d6a7', '#ce93d8', '#ffcc80', '#90a4ae'];
const ENEMY_COLOR = '#f44336';
const HEALTH_BAR_BG = 'rgba(0, 0, 0, 0.7)';
const HEALTH_BAR_COLOR = '#66bb6a';
const MANA_BAR_COLOR = '#4fc3f7';

export class MapRenderer {
  constructor() {
    this.padding = 1.5;
  }

  draw(ctx, map, party, enemies = [], options = {}) {
    if (!ctx || !map) return;
    const width = map.currentWidth;
    const height = map.currentHeight;
    if (width === 0 || height === 0) return;

    const tileWidth = ctx.canvas.width / width;
    const tileHeight = ctx.canvas.height / height;

    ctx.save();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const tile = map.tileAt(x, y);
        ctx.fillStyle = TILE_COLORS[tile] ?? TILE_COLORS.void;
        ctx.fillRect(x * tileWidth, y * tileHeight, tileWidth + 1, tileHeight + 1);
      }
    }

    this.drawEnemies(ctx, enemies, tileWidth, tileHeight);
    this.drawParty(ctx, party, tileWidth, tileHeight);
    this.drawFloatingEffects(ctx, options.effects ?? [], tileWidth, tileHeight);

    ctx.restore();
  }

  drawMinimap(ctx, map, player) {
    if (!ctx || !map) return;
    const width = map.currentWidth;
    const height = map.currentHeight;
    if (width === 0 || height === 0) return;

    const tileWidth = ctx.canvas.width / width;
    const tileHeight = ctx.canvas.height / height;
    ctx.save();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const tile = map.tileAt(x, y);
        ctx.fillStyle = TILE_COLORS[tile] ?? TILE_COLORS.void;
        ctx.fillRect(x * tileWidth, y * tileHeight, tileWidth + this.padding, tileHeight + this.padding);
      }
    }

    if (player) {
      const px = player.position.x * tileWidth;
      const py = player.position.y * tileHeight;
      const radius = Math.min(tileWidth, tileHeight) * 0.2;
      ctx.fillStyle = '#ffef99';
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawParty(ctx, party, tileWidth, tileHeight) {
    if (!party?.members) return;
    party.members.forEach((member, index) => {
      const px = (member.x ?? 0) * tileWidth;
      const py = (member.y ?? 0) * tileHeight;
      const radius = Math.min(tileWidth, tileHeight) * 0.28;
      const color = PARTY_COLORS[index % PARTY_COLORS.length];
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = member === party.leader ? 3 : 1.5;
      ctx.strokeStyle = member === party.leader ? '#ffffff' : '#1f1206';
      ctx.stroke();
      this.drawEntityBars(ctx, px, py, tileWidth, tileHeight, member.health, member.mana);
      ctx.restore();
    });
  }

  drawEnemies(ctx, enemies, tileWidth, tileHeight) {
    if (!Array.isArray(enemies)) return;
    enemies.forEach((enemy) => {
      const px = (enemy.x ?? 0) * tileWidth;
      const py = (enemy.y ?? 0) * tileHeight;
      const radius = Math.min(tileWidth, tileHeight) * 0.26;
      ctx.save();
      ctx.fillStyle = ENEMY_COLOR;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3e0d0d';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      this.drawEntityBars(ctx, px, py, tileWidth, tileHeight, enemy.health, null);
      ctx.restore();
    });
  }

  drawEntityBars(ctx, px, py, tileWidth, tileHeight, health = null, mana = null) {
    const barWidth = Math.min(tileWidth, tileHeight) * 0.7;
    const barHeight = Math.min(tileWidth, tileHeight) * 0.12;
    const x = px - barWidth / 2;
    let y = py - Math.min(tileWidth, tileHeight) * 0.45;
    if (health) {
      ctx.fillStyle = HEALTH_BAR_BG;
      ctx.fillRect(x, y, barWidth, barHeight);
      const healthPercent = Math.max(0, Math.min(1, (health.current ?? 0) / (health.max || 1)));
      ctx.fillStyle = HEALTH_BAR_COLOR;
      ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
      y -= barHeight + 2;
    }
    if (mana) {
      ctx.fillStyle = HEALTH_BAR_BG;
      ctx.fillRect(x, y, barWidth, barHeight);
      const manaPercent = Math.max(0, Math.min(1, (mana.current ?? 0) / (mana.max || 1)));
      ctx.fillStyle = MANA_BAR_COLOR;
      ctx.fillRect(x, y, barWidth * manaPercent, barHeight);
    }
  }

  drawFloatingEffects(ctx, effects, tileWidth, tileHeight) {
    if (!Array.isArray(effects) || effects.length === 0) return;
    ctx.save();
    ctx.font = `${Math.max(tileHeight * 0.5, 12)}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    effects.forEach((effect) => {
      const alpha = effect.alpha ?? 1;
      if (alpha <= 0) return;
      const x = (effect.x ?? 0) * tileWidth;
      const y = (effect.y ?? 0) * tileHeight - (effect.offset ?? 0);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillText(String(effect.text ?? ''), x, y);
    });
    ctx.restore();
  }
}

