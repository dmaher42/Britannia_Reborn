const PORTRAIT_MARGIN = 48;
const PANEL_PADDING = 12;

const ITEM_SPRITES = {
  weapon: { sheet: 'items', x: 0, y: 0 },
  armor: { sheet: 'items', x: 32, y: 0 },
  shield: { sheet: 'items', x: 64, y: 0 },
  reagent: { sheet: 'items', x: 96, y: 0 },
  potion: { sheet: 'items', x: 128, y: 0 },
  default: { sheet: 'items', x: 0, y: 64 },
};

const TILE_COLORS = {
  grass: '#3b7a4a',
  path: '#a68452',
  floor: '#6d6554',
  wall: '#202020',
  water: '#1f4b8c',
  cave_floor: '#5a4b41',
  tree: '#264b2a',
  gate: '#997b48',
};

const drawRoundedRectPath = (ctx, x, y, width, height, radius = 0) => {
  if (!ctx) return;
  const drawWithRoundRect = typeof ctx.roundRect === 'function';
  if (drawWithRoundRect) {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  const clampRadius = (value) => {
    if (!Number.isFinite(value)) return 0;
    const limit = Math.min(width, height) / 2;
    return Math.max(0, Math.min(limit, value));
  };

  const radii = Array.isArray(radius)
    ? [radius[0], radius[1], radius[2], radius[3]].map((value) => clampRadius(value ?? 0))
    : [radius, radius, radius, radius].map((value) => clampRadius(value ?? 0));

  const [topLeft, topRight, bottomRight, bottomLeft] = radii;

  ctx.moveTo(x + topLeft, y);
  ctx.lineTo(x + width - topRight, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + topRight);
  ctx.lineTo(x + width, y + height - bottomRight);
  ctx.quadraticCurveTo(x + width, y + height, x + width - bottomRight, y + height);
  ctx.lineTo(x + bottomLeft, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - bottomLeft);
  ctx.lineTo(x, y + topLeft);
  ctx.quadraticCurveTo(x, y, x + topLeft, y);
  ctx.closePath();
};

export class ModernUI {
  constructor(canvas, spriteRenderer, party, options = {}) {
    this.canvas = canvas;
    this.spriteRenderer = spriteRenderer;
    this.party = party;
    this.map = options.map ?? null;
    this.inventoryManager = options.inventory ?? null;
    this.messageDisplay = options.messageDisplay ?? null;
    this.selectedPanel = 'inventory';
    this.ctx = spriteRenderer?.ctx ?? null;
    this.panels = new Map();
    this.inventoryVisible = false;
    this.setupUIPanels();
  }

  setupUIPanels() {
    this.panels.set('party_portraits', {
      x: 16,
      y: 16,
      width: 240,
      height: 90,
      render: () => this.renderPartyPortraits(),
    });

    this.panels.set('message_log', {
      x: 16,
      y: () => this.canvas.height - 180,
      width: () => Math.min(480, this.canvas.width - 32),
      height: 150,
      render: () => this.renderMessageLog(),
    });

    this.panels.set('minimap', {
      x: () => this.canvas.width - 200,
      y: 16,
      width: 180,
      height: 180,
      render: () => this.renderMinimap(),
    });

    this.panels.set('inventory', {
      x: () => this.canvas.width - 320,
      y: 210,
      width: 300,
      height: 360,
      visible: () => this.inventoryVisible,
      render: () => this.renderInventory(),
    });
  }

  setInventoryVisible(visible) {
    this.inventoryVisible = Boolean(visible);
  }

  toggleInventory() {
    this.inventoryVisible = !this.inventoryVisible;
  }

  setInventoryManager(manager) {
    this.inventoryManager = manager;
  }

  render() {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.imageSmoothingEnabled = false;
    this.panels.forEach((panel, key) => {
      const visible = typeof panel.visible === 'function' ? panel.visible() : panel.visible !== false;
      if (!visible) return;
      const x = typeof panel.x === 'function' ? panel.x() : panel.x;
      const y = typeof panel.y === 'function' ? panel.y() : panel.y;
      const width = typeof panel.width === 'function' ? panel.width() : panel.width;
      const height = typeof panel.height === 'function' ? panel.height() : panel.height;
      if (!Number.isFinite(width) || !Number.isFinite(height)) return;
      this.renderPanelBackground(x, y, width, height);
      panel.render?.(x, y, width, height, key);
    });
    this.ctx.restore();
  }

  renderPanelBackground(x, y, width, height) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 22, 0.72)';
    ctx.strokeStyle = 'rgba(120, 150, 220, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    drawRoundedRectPath(ctx, x, y, width, height, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  renderPartyPortraits() {
    const ctx = this.ctx;
    if (!ctx || !this.party?.members) return;
    this.party.members.forEach((member, index) => {
      const px = 24 + index * PORTRAIT_MARGIN;
      const py = 28;
      this.drawPortraitFrame(px, py, member);
      const sprite = this.getPortraitSprite(member);
      if (sprite) {
        this.spriteRenderer.drawSprite('characters', sprite.x, sprite.y, px + 4, py + 4, 32, 32, { scale: 1.25 });
      }
      this.renderBar(px + 4, py + 40, 36, 6, member.health?.current ?? 0, member.health?.max ?? 1, '#e95b5b');
      this.renderBar(px + 4, py + 48, 36, 6, member.mana?.current ?? 0, member.mana?.max ?? 1, '#6aa8ff');
      this.renderText(px + 4, py + 58, member.name, '#f7f9ff', 11);
    });
  }

  drawPortraitFrame(x, y, member) {
    const ctx = this.ctx;
    const isLeader = member === this.party?.leader;
    ctx.save();
    ctx.strokeStyle = isLeader ? '#ffd789' : 'rgba(140, 160, 210, 0.9)';
    ctx.lineWidth = isLeader ? 3 : 2;
    ctx.fillStyle = 'rgba(10, 16, 28, 0.8)';
    ctx.beginPath();
    drawRoundedRectPath(ctx, x, y, 44, 66, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  renderBar(x, y, width, height, current, max, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(20, 26, 36, 0.9)';
    ctx.fillRect(x, y, width, height);
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, (width - 2) * ratio, height - 2);
    ctx.restore();
  }

  renderMessageLog() {
    const ctx = this.ctx;
    if (!ctx) return;
    const messages = this.messageDisplay?.messages ?? [];
    const panel = this.panels.get('message_log');
    const baseX = (typeof panel.x === 'function' ? panel.x() : panel.x) + PANEL_PADDING;
    const baseY = (typeof panel.y === 'function' ? panel.y() : panel.y) + PANEL_PADDING;
    ctx.save();
    ctx.fillStyle = '#b9c8e0';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textBaseline = 'top';
    const maxLines = Math.min(6, messages.length);
    for (let i = 0; i < maxLines; i += 1) {
      const message = messages[messages.length - 1 - i];
      ctx.fillText(message ?? '', baseX, baseY + i * 22);
    }
    ctx.restore();
  }

  renderMinimap() {
    if (!this.map) return;
    const ctx = this.ctx;
    const area = this.map.currentArea;
    if (!area) return;
    const tiles = area.tiles ?? [];
    const width = tiles[0]?.length ?? 0;
    const height = tiles.length;
    if (!width || !height) return;
    const panel = this.panels.get('minimap');
    const x = typeof panel.x === 'function' ? panel.x() : panel.x;
    const y = typeof panel.y === 'function' ? panel.y() : panel.y;
    const size = Math.min(panel.width, panel.height) - PANEL_PADDING * 2;
    const cellSize = size / Math.max(width, height);
    ctx.save();
    ctx.translate(x + PANEL_PADDING, y + PANEL_PADDING);
    tiles.forEach((row, rowIndex) => {
      row.forEach((tile, colIndex) => {
        ctx.fillStyle = TILE_COLORS[tile] ?? '#262b38';
        ctx.fillRect(colIndex * cellSize, rowIndex * cellSize, cellSize + 0.5, cellSize + 0.5);
      });
    });
    const leader = this.party?.leader;
    if (leader) {
      ctx.fillStyle = '#ffd36f';
      ctx.beginPath();
      ctx.arc(leader.x * cellSize, leader.y * cellSize, Math.max(2, cellSize * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderInventory() {
    const ctx = this.ctx;
    if (!ctx || !this.party) return;
    const inventory = this.party.sharedInventory ?? [];
    const panel = this.panels.get('inventory');
    const baseX = (typeof panel.x === 'function' ? panel.x() : panel.x) + PANEL_PADDING;
    const baseY = (typeof panel.y === 'function' ? panel.y() : panel.y) + PANEL_PADDING + 20;
    ctx.save();
    ctx.fillStyle = '#cfd9ef';
    ctx.font = '13px "Press Start 2P", monospace';
    ctx.fillText('Inventory', baseX, baseY - 24);
    const slotSize = 40;
    const slotsPerRow = 6;
    inventory.forEach((item, index) => {
      const row = Math.floor(index / slotsPerRow);
      const col = index % slotsPerRow;
      const slotX = baseX + col * (slotSize + 6);
      const slotY = baseY + row * (slotSize + 6);
      this.drawInventorySlot(slotX, slotY, slotSize, item);
    });
    ctx.restore();
  }

  drawInventorySlot(x, y, size, item) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(12, 18, 28, 0.9)';
    ctx.strokeStyle = 'rgba(120, 150, 220, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    drawRoundedRectPath(ctx, x, y, size, size, 8);
    ctx.fill();
    ctx.stroke();
    if (item) {
      const sprite = this.getItemSprite(item);
      this.spriteRenderer.drawSprite(sprite.sheet, sprite.x, sprite.y, x + 4, y + 4, 32, 32, {
        scale: (size - 8) / 32,
      });
      if (item.quantity && item.quantity > 1) {
        ctx.fillStyle = '#f8f9ff';
        ctx.font = '11px "Press Start 2P", monospace';
        ctx.fillText(`x${item.quantity}`, x + 6, y + size - 16);
      }
    }
    ctx.restore();
  }

  getPortraitSprite(member) {
    const className = (member?.class ?? 'fighter').toLowerCase();
    const classIndex = ['fighter', 'mage', 'bard', 'ranger'].indexOf(className);
    const tileSize = this.spriteRenderer.tileSize ?? 32;
    const rowIndex = Math.max(0, classIndex) * (4 * 5); // class * directions * actions
    const y = rowIndex * tileSize;
    return { x: 0, y };
  }

  getItemSprite(item) {
    if (!item) return ITEM_SPRITES.default;
    if (item.type === 'reagent' || item.flags?.reagentType) {
      return ITEM_SPRITES.reagent;
    }
    if (item.type && ITEM_SPRITES[item.type]) {
      return ITEM_SPRITES[item.type];
    }
    if (item.flags?.slot === 'weapon') {
      return ITEM_SPRITES.weapon;
    }
    return ITEM_SPRITES.default;
  }

  renderText(x, y, text, color = '#ffffff', size = 12) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${size}px "Press Start 2P", monospace`;
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
    ctx.restore();
  }
}
