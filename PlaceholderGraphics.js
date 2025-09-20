export class PlaceholderGraphics {
  constructor() {
    this.canvases = new Map();
    this.hasDOM = typeof document !== 'undefined' && typeof document.createElement === 'function';
    if (this.hasDOM) {
      this.generateAllPlaceholders();
    }
  }

  generateAllPlaceholders() {
    this.createCharacterSheet();
    this.createMonsterSheet();
    this.createItemSheet();
    this.createTileSheet();
    this.createEffectSheet();
    this.createUISheet();
  }

  createCharacterSheet() {
    const canvas = this.createCanvas(384, 128);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const classes = [
      { color: '#4169E1', name: 'fighter' },
      { color: '#9932CC', name: 'mage' },
      { color: '#228B22', name: 'ranger' },
      { color: '#FFD700', name: 'bard' },
    ];

    classes.forEach((charClass, classIndex) => {
      for (let dir = 0; dir < 4; dir += 1) {
        for (let frame = 0; frame < 3; frame += 1) {
          const x = (classIndex * 3 + frame) * 32;
          const y = dir * 32;

          ctx.fillStyle = charClass.color;
          ctx.fillRect(x + 8, y + 12, 16, 16);

          ctx.fillStyle = '#FFDBAC';
          ctx.fillRect(x + 12, y + 8, 8, 8);

          ctx.fillStyle = '#000000';
          ctx.fillRect(x + 13, y + 10, 2, 2);
          ctx.fillRect(x + 17, y + 10, 2, 2);

          if (frame === 1) {
            ctx.fillStyle = charClass.color;
            ctx.fillRect(x + 6, y + 28, 4, 4);
            ctx.fillRect(x + 22, y + 28, 4, 4);
          }
        }
      }
    });

    this.canvases.set('characters', canvas);
  }

  createMonsterSheet() {
    const canvas = this.createCanvas(256, 128);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const monsters = [
      { color: '#8B4513', name: 'rat', size: 16 },
      { color: '#2F4F4F', name: 'bat', size: 20 },
      { color: '#F5F5DC', name: 'skeleton', size: 28 },
    ];

    monsters.forEach((monster, index) => {
      const x = index * 32;
      const centerX = x + 16;
      const centerY = 16;

      ctx.fillStyle = monster.color;
      ctx.fillRect(centerX - monster.size / 2, centerY - monster.size / 2, monster.size, monster.size);

      ctx.fillStyle = '#FF0000';
      ctx.fillRect(centerX - 6, centerY - 4, 3, 3);
      ctx.fillRect(centerX + 3, centerY - 4, 3, 3);

      if (monster.name === 'skeleton') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(centerX - 2, centerY + 2, 4, 6);
      }
    });

    this.canvases.set('monsters', canvas);
  }

  createItemSheet() {
    const canvas = this.createCanvas(256, 256);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const items = [
      { color: '#C0C0C0', name: 'iron_sword', icon: 'sword' },
      { color: '#8B4513', name: 'wooden_club', icon: 'club' },
      { color: '#A0522D', name: 'leather_armor', icon: 'armor' },
      { color: '#708090', name: 'chain_mail', icon: 'armor' },
      { color: '#000000', name: 'black_pearl', icon: 'circle' },
      { color: '#8B0000', name: 'blood_moss', icon: 'organic' },
      { color: '#FFFAF0', name: 'garlic', icon: 'organic' },
      { color: '#DEB887', name: 'ginseng', icon: 'organic' },
      { color: '#9932CC', name: 'mandrake_root', icon: 'organic' },
      { color: '#483D8B', name: 'nightshade', icon: 'organic' },
      { color: '#DCDCDC', name: 'spider_silk', icon: 'thread' },
      { color: '#FFD700', name: 'sulfurous_ash', icon: 'powder' },
      { color: '#FFD700', name: 'gold', icon: 'coin' },
      { color: '#FF6347', name: 'food', icon: 'food' },
    ];

    items.forEach((item, index) => {
      const x = (index % 8) * 32;
      const y = Math.floor(index / 8) * 32;
      this.drawItemIcon(ctx, x + 4, y + 4, item.color, item.icon);
    });

    this.canvases.set('items', canvas);
  }

  drawItemIcon(ctx, x, y, color, iconType) {
    ctx.fillStyle = color;

    switch (iconType) {
      case 'sword':
        ctx.fillRect(x + 10, y + 2, 4, 20);
        ctx.fillRect(x + 8, y + 18, 8, 4);
        break;
      case 'armor':
        ctx.fillRect(x + 6, y + 4, 12, 16);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 8, y + 6, 2, 2);
        ctx.fillRect(x + 14, y + 6, 2, 2);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(x + 12, y + 12, 8, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'organic':
        ctx.fillRect(x + 8, y + 8, 8, 8);
        ctx.fillRect(x + 10, y + 6, 4, 4);
        break;
      case 'thread':
        ctx.fillRect(x + 6, y + 10, 16, 4);
        ctx.fillRect(x + 10, y + 6, 8, 12);
        break;
      case 'powder':
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 16);
        ctx.lineTo(x + 12, y + 4);
        ctx.lineTo(x + 20, y + 16);
        ctx.closePath();
        ctx.fill();
        break;
      case 'coin':
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(x + 12, y + 12, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#DAA520';
        ctx.beginPath();
        ctx.arc(x + 12, y + 12, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'food':
        ctx.fillRect(x + 6, y + 10, 12, 8);
        ctx.fillRect(x + 8, y + 8, 8, 4);
        break;
      default:
        ctx.fillRect(x + 4, y + 4, 16, 16);
        break;
    }

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 24, 24);
  }

  createTileSheet() {
    const canvas = this.createCanvas(256, 256);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tiles = [
      { color: '#228B22', pattern: 'grass' },
      { color: '#708090', pattern: 'stone' },
      { color: '#8B4513', pattern: 'wood' },
      { color: '#4169E1', pattern: 'water' },
      { color: '#696969', pattern: 'stone' },
      { color: '#654321', pattern: 'wood' },
      { color: '#8B4513', pattern: 'door' },
      { color: '#DEB887', pattern: 'door' },
    ];

    tiles.forEach((tile, index) => {
      const x = (index % 8) * 32;
      const y = Math.floor(index / 8) * 32;
      this.drawTilePattern(ctx, x, y, tile.color, tile.pattern);
    });

    this.canvases.set('tiles', canvas);
  }

  drawTilePattern(ctx, x, y, baseColor, pattern) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, 32, 32);

    ctx.fillStyle = this.adjustColor(baseColor, -20);

    switch (pattern) {
      case 'grass':
        for (let i = 0; i < 8; i += 1) {
          const dx = x + Math.random() * 30;
          const dy = y + Math.random() * 30;
          ctx.fillRect(dx, dy, 2, 4);
        }
        break;
      case 'stone':
        ctx.strokeStyle = this.adjustColor(baseColor, -40);
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 4, y + 4, 24, 24);
        ctx.strokeRect(x + 8, y + 8, 16, 16);
        break;
      case 'wood':
        for (let i = 0; i < 4; i += 1) {
          ctx.fillRect(x, y + i * 8, 32, 2);
        }
        break;
      case 'water':
        ctx.beginPath();
        ctx.moveTo(x, y + 16);
        ctx.quadraticCurveTo(x + 16, y + 8, x + 32, y + 16);
        ctx.quadraticCurveTo(x + 16, y + 24, x, y + 16);
        ctx.fill();
        break;
      case 'door':
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(x + 24, y + 14, 4, 4);
        break;
      default:
        break;
    }
  }

  createEffectSheet() {
    const canvas = this.createCanvas(128, 128);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#00FFFF';
    ctx.fillRect(2, 2, 12, 4);
    ctx.fillRect(4, 0, 8, 8);

    ctx.fillStyle = '#FF4500';
    ctx.beginPath();
    ctx.arc(40, 8, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#00FF00';
    ctx.fillRect(70, 4, 8, 2);
    ctx.fillRect(72, 0, 2, 8);

    ctx.fillStyle = '#FF6600';
    ctx.fillRect(96, 0, 16, 16);
    ctx.fillStyle = '#FFFF00';
    ctx.fillRect(100, 4, 8, 8);

    this.canvases.set('effects', canvas);
  }

  createUISheet() {
    const canvas = this.createCanvas(128, 128);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, 0, 40, 40);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 36, 36);

    ctx.fillStyle = '#2F2F2F';
    ctx.fillRect(50, 0, 32, 32);
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 0, 32, 32);

    this.canvases.set('ui', canvas);
  }

  adjustColor(hexColor, amount) {
    const color = Number.parseInt(hexColor.slice(1), 16);
    const r = Math.max(0, Math.min(255, (color >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((color >> 8) & 0x00ff) + amount));
    const b = Math.max(0, Math.min(255, (color & 0x0000ff) + amount));
    const value = (r << 16) | (g << 8) | b;
    return `#${value.toString(16).padStart(6, '0')}`;
  }

  createCanvas(width, height) {
    if (!this.hasDOM) {
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  getSheet(name) {
    return this.canvases.get(name) ?? null;
  }
}
