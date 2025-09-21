import { PlaceholderGraphics } from './PlaceholderGraphics.js';

// Core sprite sheets that are always loaded
const CORE_SPRITE_SHEETS = ['characters', 'monsters', 'items', 'tiles', 'effects', 'ui', 'player'];

// Specific NPC sprite sheets - loaded on demand or as fallbacks
const NPC_SPRITE_SHEETS = ['iolo', 'shamino', 'avatar'];

// Monster-specific sprite sheets - loaded on demand for specific monster types
const MONSTER_SPRITE_SHEETS = ['rat', 'bat', 'skeleton', 'slime', 'orc', 'troll', 'dragon'];

// All sprite sheets that may be loaded
const ALL_SPRITE_SHEETS = [...CORE_SPRITE_SHEETS, ...NPC_SPRITE_SHEETS, ...MONSTER_SPRITE_SHEETS];

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
    // Load core sprite sheets first
    CORE_SPRITE_SHEETS.forEach((sheetName) => this.loadSpriteSheet(sheetName));
  }

  /**
   * Load specific sprite sheets on demand (e.g., for specific NPCs or monsters)
   * @param {string} sheetName - Name of the sprite sheet to load
   * @returns {Promise<boolean>} - Whether the sheet was loaded successfully
   */
  loadSpecificSpriteSheet(sheetName) {
    if (this.spriteSheets.has(sheetName)) {
      return Promise.resolve(this.spriteSheets.get(sheetName).loaded);
    }
    
    if (!ALL_SPRITE_SHEETS.includes(sheetName)) {
      console.warn(`Unknown sprite sheet requested: ${sheetName}`);
      return Promise.resolve(false);
    }
    
    this.loadSpriteSheet(sheetName);
    return this.whenSheetReady(sheetName);
  }

  /**
   * Wait for a specific sprite sheet to be loaded
   * @param {string} sheetName - Name of the sprite sheet
   * @returns {Promise<boolean>} - Whether the sheet loaded successfully
   */
  whenSheetReady(sheetName) {
    const record = this.spriteSheets.get(sheetName);
    if (!record) {
      return Promise.resolve(false);
    }
    if (record.loaded) {
      return Promise.resolve(true);
    }
    
    // Wait for the loading promise to complete
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const currentRecord = this.spriteSheets.get(sheetName);
        if (currentRecord && currentRecord.loaded) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 50);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 5000);
    });
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
    // Only consider core sprite sheets for ready state
    this.ready = CORE_SPRITE_SHEETS.every((sheetName) => this.spriteSheets.get(sheetName)?.loaded);
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
      // Core sprite sheets
      characters: '#4169E1',
      monsters: '#DC143C',
      items: '#FFD700',
      tiles: '#228B22',
      effects: '#FF1493',
      ui: '#708090',
      player: '#9370DB',
      // NPC-specific sprite sheets
      iolo: '#32CD32',      // Lime green for Iolo the Bard
      shamino: '#8B4513',   // Saddle brown for Shamino the Ranger
      avatar: '#FFD700',    // Gold for the Avatar
      // Monster-specific sprite sheets
      rat: '#8B4513',       // Brown for rats
      bat: '#2F4F4F',       // Dark slate gray for bats
      skeleton: '#F5F5DC',  // Beige for skeletons
      slime: '#32CD32',     // Lime green for slimes
      orc: '#556B2F',       // Dark olive green for orcs
      troll: '#696969',     // Dim gray for trolls
      dragon: '#B22222',    // Fire brick for dragons
    };

    this.ctx.save();
    this.ctx.fillStyle = colors[sheetName] ?? '#FF00FF';
    this.ctx.fillRect(destX, destY, destWidth, destHeight);
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(destX, destY, destWidth, destHeight);
    this.ctx.restore();
  }

  /**
   * Get the preferred sprite sheet for a character or NPC
   * Falls back to generic sheets if specific ones aren't available
   * @param {Object} character - Character or NPC object
   * @returns {string} - Sprite sheet name to use
   */
  getPreferredSpriteSheet(character) {
    if (!character) return 'characters';
    
    const name = (character.name || '').toLowerCase();
    const type = (character.type || '').toLowerCase();
    
    // Check for specific NPC sprite sheets
    if (name === 'iolo' && this.spriteSheets.has('iolo') && this.spriteSheets.get('iolo').loaded) {
      return 'iolo';
    }
    if (name === 'shamino' && this.spriteSheets.has('shamino') && this.spriteSheets.get('shamino').loaded) {
      return 'shamino';
    }
    if (name === 'avatar' && this.spriteSheets.has('avatar') && this.spriteSheets.get('avatar').loaded) {
      return 'avatar';
    }
    
    // Check for monster-specific sprite sheets
    if (type === 'enemy' || type === 'monster') {
      const monsterType = character.monsterType || character.enemyType || name;
      if (MONSTER_SPRITE_SHEETS.includes(monsterType) && 
          this.spriteSheets.has(monsterType) && 
          this.spriteSheets.get(monsterType).loaded) {
        return monsterType;
      }
      return 'monsters'; // Fallback to generic monsters sheet
    }
    
    // For party members, check if they have specific sheets
    if (character.isPlayer || name === 'avatar') {
      return this.spriteSheets.has('avatar') && this.spriteSheets.get('avatar').loaded ? 'avatar' : 'player';
    }
    
    // Default fallback
    return 'characters';
  }

  testPlaceholders() {
    const testSheets = [...CORE_SPRITE_SHEETS];
    console.log('Testing placeholder graphics...');
    testSheets.forEach((sheet) => {
      if (this.spriteSheets.has(sheet)) {
        const record = this.spriteSheets.get(sheet);
        if (record.loaded) {
          const status = record.isPlaceholder ? '🟡 Placeholder' : '✅ Loaded';
          console.log(`${status}: ${sheet}`);
        } else {
          console.log(`❌ ${sheet}: Missing`);
        }
      } else {
        console.log(`❌ ${sheet}: Not initialized`);
      }
    });
    
    // Also report on any loaded specific sprite sheets
    const loadedSpecific = [];
    [...NPC_SPRITE_SHEETS, ...MONSTER_SPRITE_SHEETS].forEach((sheet) => {
      if (this.spriteSheets.has(sheet) && this.spriteSheets.get(sheet).loaded) {
        const record = this.spriteSheets.get(sheet);
        const status = record.isPlaceholder ? '🟡 Placeholder' : '✅ Loaded';
        loadedSpecific.push(`${status}: ${sheet}`);
      }
    });
    
    if (loadedSpecific.length > 0) {
      console.log('Specific sprite sheets loaded:');
      loadedSpecific.forEach(msg => console.log(msg));
    }
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
