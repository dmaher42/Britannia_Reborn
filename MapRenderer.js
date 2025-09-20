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

export class MapRenderer {
  constructor() {
    this.padding = 1.5;
  }

  draw(ctx, map, player) {
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

    if (player) {
      const px = player.position.x * tileWidth;
      const py = player.position.y * tileHeight;
      const radius = Math.min(tileWidth, tileHeight) * 0.3;
      ctx.fillStyle = '#ffd76f';
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1f1206';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

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
}

