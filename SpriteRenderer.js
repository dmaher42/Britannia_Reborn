const SPRITE_SHEETS = [
  { key: 'characters', file: 'characters.png' },
  { key: 'monsters', file: 'monsters.png' },
  { key: 'items', file: 'items.png' },
  { key: 'tiles', file: 'tiles.png' },
  { key: 'effects', file: 'effects.png' },
  { key: 'ui', file: 'ui.png' },
];

export class SpriteRenderer {
  constructor(canvas, context) {
    this.canvas = canvas;
    this.ctx = context ?? canvas?.getContext?.('2d') ?? null;
    this.spriteSheets = new Map();
    this.tileSize = 32;
    this.scale = 2;
    this.loadingPromises = [];
    this.ready = false;
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
    }
    this.loadSpriteSheets();
  }

  loadSpriteSheets() {
    SPRITE_SHEETS.forEach((sheet) => this.loadSpriteSheet(sheet.key, sheet.file));
  }

  loadSpriteSheet(name, file) {
    if (!this.canvas) return;
    const image = new Image();
    image.decoding = 'async';
    const src = new URL(`./assets/${file}`, import.meta.url).href;
    const record = { image, loaded: false };
    this.spriteSheets.set(name, record);
    const promise = new Promise((resolve, reject) => {
      image.addEventListener('load', () => {
        record.loaded = true;
        this.ready = SPRITE_SHEETS.every((sheet) => this.spriteSheets.get(sheet.key)?.loaded);
        resolve(image);
      });
      image.addEventListener('error', (event) => {
        console.warn(`Failed to load sprite sheet ${name} from ${file}`, event);
        record.error = event?.error ?? new Error(`Failed to load ${file}`);
        resolve(null);
      });
    });
    this.loadingPromises.push(promise);
    image.src = src;
  }

  setScale(scale) {
    const resolved = Number.isFinite(scale) ? Math.max(1, scale) : 1;
    this.scale = resolved;
  }

  whenReady() {
    return Promise.all(this.loadingPromises);
  }

  getSheet(name) {
    const record = this.spriteSheets.get(name);
    if (record?.loaded) {
      return record.image;
    }
    return null;
  }

  drawSprite(sheetName, sourceX, sourceY, destX, destY, width = this.tileSize, height = this.tileSize, options = {}) {
    if (!this.ctx) return;
    const sheet = this.getSheet(sheetName);
    if (!sheet) return;
    const scale = Number.isFinite(options.scale) ? options.scale : this.scale;
    const destWidth = (options.destWidth ?? width) * scale;
    const destHeight = (options.destHeight ?? height) * scale;
    const dx = Math.round(destX);
    const dy = Math.round(destY);
    this.ctx.save();
    this.ctx.imageSmoothingEnabled = false;
    if (options.flipX || options.flipY) {
      this.ctx.translate(dx + destWidth / 2, dy + destHeight / 2);
      this.ctx.scale(options.flipX ? -1 : 1, options.flipY ? -1 : 1);
      this.ctx.drawImage(
        sheet,
        sourceX,
        sourceY,
        width,
        height,
        -destWidth / 2,
        -destHeight / 2,
        destWidth,
        destHeight,
      );
    } else {
      this.ctx.drawImage(sheet, sourceX, sourceY, width, height, dx, dy, destWidth, destHeight);
    }
    this.ctx.restore();
  }

  drawAnimatedSprite(animation, frameIndex, destX, destY, options = {}) {
    if (!animation || !animation.frames || animation.frames.length === 0) return;
    const index = Math.max(0, Math.min(animation.frames.length - 1, frameIndex));
    const sprite = animation.frames[index];
    if (!sprite) return;
    this.drawSprite(
      sprite.sheet ?? animation.sheet,
      sprite.x,
      sprite.y,
      destX,
      destY,
      sprite.width ?? animation.frameWidth ?? this.tileSize,
      sprite.height ?? animation.frameHeight ?? this.tileSize,
      options,
    );
  }

  clear() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
