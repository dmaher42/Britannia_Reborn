const TYPE_COLORS = {
  item: '#d4b574',
  door: '#8b5a2b',
  container: '#b48a68',
  lever: '#5c6673',
  npc: '#8fa7c9',
};

const HIGHLIGHT_COLOR = 'rgba(255, 255, 160, 0.55)';
const OUTLINE_COLOR = '#2b1c04';

export class ObjectRenderer {
  constructor() {
    this.mode = null;
    this.highlightedId = null;
    this.highlightTile = null;
  }

  setMode(mode) {
    this.mode = mode;
  }

  setHighlight(object = null, tile = null) {
    this.highlightedId = object?.id ?? null;
    this.highlightTile = tile ?? (object ? { x: object.x, y: object.y } : null);
  }

  clearHighlight() {
    this.highlightedId = null;
    this.highlightTile = null;
  }

  draw(ctx, map, objects = []) {
    if (!ctx || !map) return;
    const width = map.currentWidth;
    const height = map.currentHeight;
    if (width <= 0 || height <= 0) return;

    const tileWidth = ctx.canvas.width / width;
    const tileHeight = ctx.canvas.height / height;

    if (this.highlightTile) {
      ctx.save();
      ctx.fillStyle = HIGHLIGHT_COLOR;
      ctx.fillRect(
        this.highlightTile.x * tileWidth,
        this.highlightTile.y * tileHeight,
        tileWidth,
        tileHeight
      );
      ctx.restore();
    }

    const tiles = new Map();
    objects.forEach((object) => {
      const key = `${object.x},${object.y}`;
      if (!tiles.has(key)) {
        tiles.set(key, []);
      }
      tiles.get(key).push(object);
    });

    tiles.forEach((list, key) => {
      const [xStr, yStr] = key.split(',');
      const tileX = Number(xStr);
      const tileY = Number(yStr);
      const cx = tileX * tileWidth + tileWidth / 2;
      const cy = tileY * tileHeight + tileHeight / 2;
      const step = Math.min(tileWidth, tileHeight) * 0.2;
      const start = -((list.length - 1) * step) / 2;
      list.forEach((object, index) => {
        const offset = start + index * step;
        this.drawObject(ctx, object, cx + offset, cy + offset, tileWidth, tileHeight);
      });
    });
  }

  drawObject(ctx, object, centerX, centerY, tileWidth, tileHeight) {
    const color = TYPE_COLORS[object.type] ?? '#c4c4c4';
    const radius = Math.min(tileWidth, tileHeight) * 0.3;
    ctx.save();
    if (object.type === 'door') {
      const doorWidth = this.doorWidth(object, tileWidth);
      const doorHeight = tileHeight * 0.8;
      ctx.fillStyle = color;
      ctx.fillRect(centerX - doorWidth / 2, centerY - doorHeight / 2, doorWidth, doorHeight);
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.lineWidth = 2;
      ctx.strokeRect(centerX - doorWidth / 2, centerY - doorHeight / 2, doorWidth, doorHeight);
    } else if (object.type === 'container') {
      const size = Math.min(tileWidth, tileHeight) * 0.6;
      ctx.fillStyle = color;
      ctx.fillRect(centerX - size / 2, centerY - size / 2, size, size);
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.lineWidth = 2;
      ctx.strokeRect(centerX - size / 2, centerY - size / 2, size, size);
    } else if (object.type === 'lever') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      const length = Math.min(tileWidth, tileHeight) * 0.35;
      const angle = object.state ? Math.PI * 0.75 : Math.PI * 0.25;
      const x2 = centerX + Math.cos(angle) * length;
      const y2 = centerY + Math.sin(angle) * length;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = '#a8aab0';
      ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (this.highlightedId && this.highlightedId === object.id) {
      ctx.strokeStyle = '#ffffb0';
      ctx.lineWidth = 3;
      if (object.type === 'door') {
        const doorWidth = this.doorWidth(object, tileWidth) + 4;
        const doorHeight = tileHeight * 0.8 + 4;
        ctx.strokeRect(
          centerX - doorWidth / 2,
          centerY - doorHeight / 2,
          doorWidth,
          doorHeight
        );
      } else if (object.type === 'container') {
        const size = Math.min(tileWidth, tileHeight) * 0.6 + 4;
        ctx.strokeRect(
          centerX - size / 2,
          centerY - size / 2,
          size,
          size
        );
      } else {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  doorWidth(object, tileWidth) {
    if (object.isOpen) {
      return tileWidth * 0.15;
    }
    return tileWidth * 0.6;
  }
}

