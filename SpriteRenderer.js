import { PlaceholderGraphics } from './PlaceholderGraphics.js';

const SPRITE_SHEETS = ['characters', 'monsters', 'items', 'tiles', 'effects', 'ui'];

export class SpriteRenderer {
  constructor(canvas, context, options = {}) {
    this.canvas = canvas;
    this.ctx = context ?? canvas?.getContext?.('2d') ?? null;
    this.spriteSheets = new Map();
    this.tileSize = 32;
    this.scale = 2;
    this.loadingPromises = [];
    this.ready = false;
    this.loadingAttempts = new Map();

    const { placeholderGraphics = null } = options ?? {};
    this.placeholderGraphics =
      placeholderGraphics ??
      (typeof document !== 'undefined' ? new PlaceholderGraphics() : null);

    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
    }
    this.loadSpriteSheets();
  }

  loadSpriteSheets() {
    SPRITE_SHEETS.forEach((sheetName) => this.loadSpriteSheet(sheetName));
  }

  loadSpriteSheet(name) {
    const placeholder = this.placeholderGraphics?.getSheet?.(name) ?? null;
    const record = {
      image: placeholder,
      loaded: Boolean(placeholder),
      isPlaceholder: Boolean(placeholder),
      error: null,
    };
    this.spriteSheets.set(name, record);
    this.updateReadyState();

    const canLoadImages = typeof Image !== 'undefined';
    if (!canLoadImages) {
      return;
    }

    const image = new Image();
    image.decoding = 'async';
    const src = new URL(`./assets/${name}.png`, import.meta.url).href;

    const promise = new Promise((resolve) => {
      image.addEventListener('load', () => {
        record.image = image;
        record.loaded = true;
        record.isPlaceholder = false;
        record.error = null;
        this.loadingAttempts.set(name, (this.loadingAttempts.get(name) ?? 0) + 1);
        this.updateReadyState();
        console.log(`✅ Loaded sprite sheet: ${name}`);
        resolve(image);
      });

      image.addEventListener('error', (event) => {
        record.error = event?.error ?? new Error(`Failed to load ${name}.png`);
        this.loadingAttempts.set(name, (this.loadingAttempts.get(name) ?? 0) + 1);
        if (placeholder) {
          record.image = placeholder;
          record.loaded = true;
          record.isPlaceholder = true;
          console.log(`⚠️ Using placeholder for: ${name}`);
          console.log(`✅ Placeholder ready for: ${name}`);
        } else {
          record.loaded = false;
          record.isPlaceholder = false;
          console.error(`❌ No placeholder available for: ${name}`);
        }
        this.updateReadyState();
        resolve(null);
      });
    });

    this.loadingPromises.push(promise);
    image.src = src;
  }

  updateReadyState() {
    this.ready = SPRITE_SHEETS.every((sheetName) => this.spriteSheets.get(sheetName)?.loaded);
  }

  setScale(scale) {
    const resolved = Number.isFinite(scale) ? Math.max(1, scale) : 1;
    this.scale = resolved;
  }

  whenReady() {
    if (this.loadingPromises.length === 0) {
      return Promise.resolve(this.ready);
    }
    return Promise.all(this.loadingPromises).then(() => this.ready);
  }

  getSheet(name) {
    const record = this.spriteSheets.get(name);
    if (!record) {
      return null;
    }
    if (record.loaded && record.image) {
      return record.image;
    }
    if (record.image) {
      return record.image;
    }
    return null;
  }

  drawSprite(
    sheetName,
    sourceX,
    sourceY,
    destX,
    destY,
    width = this.tileSize,
    height = this.tileSize,
    options = {},
  ) {
    if (!this.ctx) return;
    const sheet = this.getSheet(sheetName);
    const scale = Number.isFinite(options.scale) ? options.scale : this.scale;
    const destWidth = (options.destWidth ?? width) * scale;
    const destHeight = (options.destHeight ?? height) * scale;
    const dx = Math.round(destX);
    const dy = Math.round(destY);

    if (sheet) {
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
      return;
    }

    this.drawPlaceholderRect(dx, dy, sheetName, destWidth, destHeight);
  }

  drawPlaceholderRect(destX, destY, sheetName, destWidth, destHeight) {
    if (!this.ctx) return;
    const colors = {
      characters: '#4169E1',
      monsters: '#DC143C',
      items: '#FFD700',
      tiles: '#228B22',
      effects: '#FF1493',
      ui: '#708090',
    };

    this.ctx.save();
    this.ctx.fillStyle = colors[sheetName] ?? '#FF00FF';
    this.ctx.fillRect(destX, destY, destWidth, destHeight);
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(destX, destY, destWidth, destHeight);
    this.ctx.restore();
  }

  testPlaceholders() {
    const testSheets = ['characters', 'monsters', 'items', 'tiles', 'effects', 'ui'];
    console.log('Testing placeholder graphics...');
    testSheets.forEach((sheet) => {
      if (this.spriteSheets.has(sheet)) {
        console.log(`✅ ${sheet}: Ready`);
      } else {
        console.log(`❌ ${sheet}: Missing`);
      }
    });
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
