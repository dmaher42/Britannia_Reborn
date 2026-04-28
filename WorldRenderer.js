const FLOOR_TILES = new Set([
  'grass',
  'path',
  'water',
  'sand',
  'floor',
  'stone_floor',
  'wood_floor',
  'carpet',
  'cave_floor',
  'gate',
]);
const WALL_TILES = new Set(['wall', 'stone_wall', 'wood_wall', 'cave_wall', 'tree']);
const OVERLAY_TILES = new Set(['gate', 'cave_entrance']);

const TILE_MAPPINGS = {
  grass: { sheet: 'tiles', x: 0, y: 0 },
  path: { sheet: 'tiles', x: 32, y: 0 },
  water: { sheet: 'tiles', x: 64, y: 0, animated: true, frames: 4, frameTime: 180 },
  sand: { sheet: 'tiles', x: 96, y: 0 },
  stone_floor: { sheet: 'tiles', x: 0, y: 32 },
  wood_floor: { sheet: 'tiles', x: 32, y: 32 },
  carpet: { sheet: 'tiles', x: 32, y: 32 },
  cave_floor: { sheet: 'tiles', x: 64, y: 32 },
  gate: { sheet: 'tiles', x: 96, y: 32 },
  floor: { sheet: 'tiles', x: 0, y: 32 },
  wall: { sheet: 'tiles', x: 0, y: 64 },
  stone_wall: { sheet: 'tiles', x: 0, y: 64 },
  wood_wall: { sheet: 'tiles', x: 32, y: 64 },
  cave_wall: { sheet: 'tiles', x: 64, y: 64 },
  tree: { sheet: 'tiles', x: 96, y: 64 },
  cave_entrance: { sheet: 'tiles', x: 32, y: 160 },
  void: { sheet: 'tiles', x: 32, y: 128 },
};

const OBJECT_SPRITES = {
  door_closed: { sheet: 'tiles', x: 32, y: 96 },
  door_open: { sheet: 'tiles', x: 64, y: 96 },
  chest_closed: { sheet: 'tiles', x: 96, y: 96 },
  chest_open: { sheet: 'tiles', x: 0, y: 128 },
  lever: { sheet: 'effects', x: 0, y: 96 },
  item: { sheet: 'items', x: 0, y: 0 },
  reagent: { sheet: 'items', x: 64, y: 0 },
  container: { sheet: 'tiles', x: 96, y: 96 },
};

const NPC_CLASS_BY_PROFESSION = {
  healer: 'mage',
  bard: 'bard',
  ranger: 'ranger',
  blacksmith: 'fighter',
};

const MONSTER_TYPES = ['rat', 'bat', 'skeleton', 'slime'];
const MONSTER_ACTIONS = ['idle', 'walk', 'attack'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class WorldRenderer {
  constructor(spriteRenderer, gameWorld, options = {}) {
    this.spriteRenderer = spriteRenderer;
    this.gameWorld = gameWorld;
    this.camera = {
      width: options.cameraWidth ?? 25,
      height: options.cameraHeight ?? 19,
      left: 0,
      top: 0,
      tileStartX: 0,
      tileStartY: 0,
      tileEndX: 0,
      tileEndY: 0,
    };
    this.layers = options.layers ?? ['floor', 'walls', 'objects', 'characters'];
    this.tileAnimations = new Map();
    this.highlightedObject = null;
    this.highlightedTile = null;
    this.highlightMode = null;
    this.party = options.party ?? null;
    this.combat = options.combat ?? null;
    this.animationSystem = options.animationSystem ?? null;
    this.getCameraTarget = options.getCameraTarget ?? (() => this.party?.leader ?? null);
    this.viewportOffsetX = 0;
    this.viewportOffsetY = 0;
    this.tileDisplaySize = (this.spriteRenderer?.tileSize ?? 32) * (this.spriteRenderer?.scale ?? 2);
  }

  setParty(party) {
    this.party = party;
  }

  setCombat(combat) {
    this.combat = combat;
  }

  setAnimationSystem(animationSystem) {
    this.animationSystem = animationSystem;
  }

  setCameraTargetResolver(resolver) {
    if (typeof resolver === 'function') {
      this.getCameraTarget = resolver;
    }
  }

  setMode(mode) {
    this.highlightMode = mode;
  }

  setHighlight(object = null, tile = null) {
    this.highlightedObject = object ?? null;
    this.highlightedTile = tile ?? (object ? { x: object.x, y: object.y } : null);
  }

  clearHighlight() {
    this.highlightedObject = null;
    this.highlightedTile = null;
  }

  clearCanvas() {
    this.spriteRenderer?.clear();
  }

  updateCamera() {
    const mapWidth = this.gameWorld?.currentWidth ?? 0;
    const mapHeight = this.gameWorld?.currentHeight ?? 0;
    if (mapWidth === 0 || mapHeight === 0) return;
    const target = this.getCameraTarget?.() ?? { x: this.camera.width / 2, y: this.camera.height / 2 };
    const halfWidth = this.camera.width / 2;
    const halfHeight = this.camera.height / 2;
    const centerX = clamp(target.x ?? halfWidth, halfWidth, Math.max(halfWidth, mapWidth - halfWidth));
    const centerY = clamp(target.y ?? halfHeight, halfHeight, Math.max(halfHeight, mapHeight - halfHeight));
    this.camera.left = clamp(centerX - halfWidth, 0, Math.max(0, mapWidth - this.camera.width));
    this.camera.top = clamp(centerY - halfHeight, 0, Math.max(0, mapHeight - this.camera.height));
    const baseTile = this.spriteRenderer?.tileSize ?? 32;
    const availableWidth = this.spriteRenderer?.canvas?.width ?? baseTile * this.camera.width;
    const availableHeight = this.spriteRenderer?.canvas?.height ?? baseTile * this.camera.height;
    const scaleX = availableWidth / (baseTile * this.camera.width);
    const scaleY = availableHeight / (baseTile * this.camera.height);
    const scale = Math.max(1, Math.floor(Math.min(scaleX, scaleY)));
    this.spriteRenderer?.setScale(scale);
    this.tileDisplaySize = baseTile * scale;
    const viewportWidth = this.camera.width * this.tileDisplaySize;
    const viewportHeight = this.camera.height * this.tileDisplaySize;
    this.viewportOffsetX = Math.floor((availableWidth - viewportWidth) / 2);
    this.viewportOffsetY = Math.floor((availableHeight - viewportHeight) / 2);
    this.camera.tileStartX = Math.max(0, Math.floor(this.camera.left));
    this.camera.tileStartY = Math.max(0, Math.floor(this.camera.top));
    this.camera.tileEndX = Math.min(mapWidth - 1, Math.ceil(this.camera.left + this.camera.width));
    this.camera.tileEndY = Math.min(mapHeight - 1, Math.ceil(this.camera.top + this.camera.height));
    this.camera.pixelOffsetX = this.viewportOffsetX - (this.camera.left - this.camera.tileStartX) * this.tileDisplaySize;
    this.camera.pixelOffsetY = this.viewportOffsetY - (this.camera.top - this.camera.tileStartY) * this.tileDisplaySize;
  }

  getVisibleArea() {
    return {
      startX: this.camera.tileStartX,
      endX: this.camera.tileEndX,
      startY: this.camera.tileStartY,
      endY: this.camera.tileEndY,
    };
  }

  render() {
    if (!this.spriteRenderer?.ctx) return;
    this.clearCanvas();
    this.updateCamera();
    this.layers.forEach((layer) => this.renderLayer(layer));
    this.renderHighlight();
  }

  renderLayer(layerName) {
    switch (layerName) {
      case 'floor':
        this.renderFloorLayer();
        break;
      case 'walls':
        this.renderWallLayer();
        break;
      case 'objects':
        this.renderObjectsLayer();
        break;
      case 'characters':
        this.renderCharactersLayer();
        break;
      default:
        break;
    }
  }

  forEachVisibleTile(callback) {
    const area = this.getVisibleArea();
    for (let y = area.startY; y <= area.endY; y += 1) {
      for (let x = area.startX; x <= area.endX; x += 1) {
        callback(x, y);
      }
    }
  }

  renderFloorLayer() {
    this.forEachVisibleTile((tileX, tileY) => {
      const tile = this.gameWorld.tileAt(tileX, tileY);
      const definition = this.resolveFloorTile(tile);
      this.drawTile(definition, tileX, tileY);
      if (tile === 'carpet') {
        this.drawCarpetOverlay(tileX, tileY);
      }
      if (tile === 'water') {
        this.drawAnimatedTile('water', tileX, tileY);
      }
      if (tile === 'cave_entrance') {
        const overlay = TILE_MAPPINGS.cave_entrance;
        this.drawTile(overlay, tileX, tileY);
      }
    });
  }

  renderWallLayer() {
    this.forEachVisibleTile((tileX, tileY) => {
      const tile = this.gameWorld.tileAt(tileX, tileY);
      if (!WALL_TILES.has(tile)) return;
      const definition = TILE_MAPPINGS[tile] ?? TILE_MAPPINGS.wall;
      this.drawTile(definition, tileX, tileY);
    });
  }

  renderObjectsLayer() {
    const objects = this.gameWorld?.getObjects?.() ?? [];
    objects.forEach((object) => {
      if (!object) return;
      if (object.type === 'enemy' || object.type === 'npc') return;
      const sprite = this.resolveObjectSprite(object);
      if (!sprite) return;
      const screen = this.worldToScreen(object.x + 0.5, object.y + 0.5, { align: 'center' });
      if (!screen) return;
      this.spriteRenderer.drawSprite(sprite.sheet, sprite.x, sprite.y, screen.x, screen.y, sprite.width ?? 32, sprite.height ?? 32, {
        scale: sprite.scale ?? this.spriteRenderer.scale,
      });
    });
  }

  renderCharactersLayer() {
    const scale = this.spriteRenderer.scale;
    const partyMembers = this.party?.members ?? [];
    partyMembers.forEach((member) => {
      if (!member) return;
      const action = member.isMoving ? 'walk' : 'idle';
      const animationName = this.animationSystem?.getCharacterAnimationName(member, action);
      if (animationName) {
        this.animationSystem.ensureAnimation(member.id, animationName);
      }
      const screen = this.worldToScreen(member.x, member.y, { align: 'center' });
      if (!screen) return;
      if (animationName) {
        this.animationSystem.renderEntity(member.id, screen.x, screen.y, { scale });
      } else {
        this.drawFallbackCircle(screen.x, screen.y, '#ffd76f');
      }
    });

    const enemies = this.combat?.enemies ?? [];
    enemies.forEach((enemy) => {
      if (!enemy?.alive) return;
      const animationName = this.resolveEnemyAnimation(enemy);
      if (animationName) {
        this.animationSystem.ensureAnimation(enemy.id ?? enemy.name ?? `enemy-${enemy.type}`, animationName);
      }
      const screen = this.worldToScreen(enemy.x, enemy.y, { align: 'center' });
      if (!screen) return;
      if (animationName) {
        const id = enemy.id ?? enemy.name ?? `enemy-${enemy.type}`;
        this.animationSystem.renderEntity(id, screen.x, screen.y, { scale });
      } else {
        this.drawFallbackCircle(screen.x, screen.y, '#e55b5b');
      }
    });

    const objects = this.gameWorld?.getObjects?.() ?? [];
    objects
      .filter((object) => object?.type === 'npc')
      .forEach((npc) => {
        const animationName = this.resolveNpcAnimation(npc);
        if (animationName) {
          const id = npc.id ?? `npc-${npc.name}`;
          this.animationSystem.ensureAnimation(id, animationName);
          const screen = this.worldToScreen(npc.x, npc.y, { align: 'center' });
          if (screen) {
            this.animationSystem.renderEntity(id, screen.x, screen.y, { scale });
          }
        }
      });
  }

  drawTile(definition, tileX, tileY) {
    if (!definition) return;
    const screen = this.worldToScreen(tileX, tileY, { align: 'top-left' });
    if (!screen) return;
    this.spriteRenderer.drawSprite(
      definition.sheet,
      definition.x,
      definition.y,
      screen.x,
      screen.y,
      definition.width ?? 32,
      definition.height ?? 32,
      { scale: this.spriteRenderer.scale },
    );
  }

  drawCarpetOverlay(tileX, tileY) {
    const ctx = this.spriteRenderer?.ctx;
    if (!ctx) return;
    const screen = this.worldToScreen(tileX, tileY, { align: 'top-left' });
    if (!screen) return;
    const size = this.tileDisplaySize;
    const border = Math.max(1, Math.round(size * 0.1));
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#7c0a02';
    ctx.fillRect(screen.x, screen.y, size, size);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(screen.x, screen.y, size, border);
    ctx.fillRect(screen.x, screen.y + size - border, size, border);
    ctx.fillStyle = 'rgba(255, 220, 200, 0.18)';
    const highlightHeight = Math.max(1, Math.floor(border / 2));
    ctx.fillRect(screen.x + border, screen.y + border, size - border * 2, highlightHeight);
    ctx.restore();
  }

  drawAnimatedTile(tileKey, tileX, tileY) {
    const definition = TILE_MAPPINGS[tileKey];
    if (!definition?.animated) return;
    const animationState = this.tileAnimations.get(tileKey) ?? {
      frame: 0,
      lastUpdate: performance.now(),
    };
    const now = performance.now();
    const frameTime = definition.frameTime ?? 200;
    if (now - animationState.lastUpdate > frameTime) {
      animationState.frame = (animationState.frame + 1) % (definition.frames ?? 4);
      animationState.lastUpdate = now;
      this.tileAnimations.set(tileKey, animationState);
    }
    const frameWidth = definition.width ?? 32;
    const sprite = {
      sheet: definition.sheet,
      x: definition.x + animationState.frame * frameWidth,
      y: definition.y,
      width: frameWidth,
      height: definition.height ?? 32,
    };
    this.drawTile(sprite, tileX, tileY);
  }

  resolveFloorTile(tile) {
    if (TILE_MAPPINGS[tile]) {
      return TILE_MAPPINGS[tile];
    }
    if (tile === 'void') {
      return TILE_MAPPINGS.void;
    }
    if (tile === 'cave_entrance') {
      return TILE_MAPPINGS.cave_floor;
    }
    if (FLOOR_TILES.has(tile)) {
      return TILE_MAPPINGS.floor;
    }
    return TILE_MAPPINGS.grass;
  }

  resolveObjectSprite(object) {
    if (!object) return null;
    if (object.type === 'door') {
      return object.isOpen ? OBJECT_SPRITES.door_open : OBJECT_SPRITES.door_closed;
    }
    if (object.type === 'container') {
      return object.isOpen ? OBJECT_SPRITES.chest_open : OBJECT_SPRITES.chest_closed;
    }
    if (object.type === 'lever') {
      return OBJECT_SPRITES.lever;
    }
    if (object.type === 'item' && object.flags?.reagentType) {
      return OBJECT_SPRITES.reagent;
    }
    if (object.type === 'item') {
      return OBJECT_SPRITES.item;
    }
    if (OBJECT_SPRITES[object.type]) {
      return OBJECT_SPRITES[object.type];
    }
    return null;
  }

  resolveEnemyAnimation(enemy) {
    if (!enemy) return null;
    const base = enemy.type ?? 'enemy';
    const direction = (enemy.facing ?? 'south').toLowerCase();
    const action = enemy.isMoving ? 'walk' : 'idle';
    const actionIndex = MONSTER_ACTIONS.indexOf(action);
    const monsterIndex = MONSTER_TYPES.indexOf(base);
    if (monsterIndex === -1) {
      return null;
    }
    
    // Check if we should use a specific sprite sheet for this monster
    const monsterType = base.toLowerCase();
    let spriteSheet = 'monsters';
    let key = `${base}_${direction}_${action}`;
    
    if (['rat', 'bat', 'skeleton', 'slime'].includes(monsterType)) {
      // Try to load monster-specific sprite sheet
      this.spriteRenderer?.loadSpecificSpriteSheet(monsterType);
      const preferredSheet = this.spriteRenderer?.getPreferredSpriteSheet(enemy);
      if (preferredSheet === monsterType) {
        // Use monster-specific animation naming and sprite sheet
        spriteSheet = monsterType;
        key = `${monsterType}_${direction}_${action}`;
      }
    }
    
    if (!this.animationSystem?.animations?.has(key)) {
      const frameHeight = this.spriteRenderer.tileSize;
      const rowIndex = monsterIndex * MONSTER_ACTIONS.length + (actionIndex === -1 ? 0 : actionIndex);
      const startY = rowIndex * frameHeight;
      this.animationSystem?.registerAnimation(key, {
        sheet: spriteSheet,
        startX: 0,
        startY,
        frames: 4,
        frameTime: action === 'walk' ? 140 : 260,
        loop: true,
      });
    }
    return key;
  }

  resolveNpcAnimation(npc) {
    const profession = (npc?.profession ?? '').toLowerCase();
    const className = NPC_CLASS_BY_PROFESSION[profession] ?? 'bard';
    const direction = (npc?.facing ?? 'south').toLowerCase();
    const action = npc?.isMoving ? 'walk' : 'idle';
    
    // Check if we should use a specific sprite sheet for this NPC
    const npcName = (npc?.name || '').toLowerCase();
    let prefix = className;
    
    // Use specific sprite sheet names for key NPCs if available
    if (npcName === 'iolo') {
      // Try to load Iolo's specific sprite sheet
      this.spriteRenderer?.loadSpecificSpriteSheet('iolo');
      const preferredSheet = this.spriteRenderer?.getPreferredSpriteSheet(npc);
      if (preferredSheet === 'iolo') {
        prefix = 'iolo';
      }
    } else if (npcName === 'shamino') {
      // Try to load Shamino's specific sprite sheet
      this.spriteRenderer?.loadSpecificSpriteSheet('shamino');
      const preferredSheet = this.spriteRenderer?.getPreferredSpriteSheet(npc);
      if (preferredSheet === 'shamino') {
        prefix = 'shamino';
      }
    }
    
    return `${prefix}_${direction}_${action}`;
  }

  drawFallbackCircle(x, y, color) {
    const ctx = this.spriteRenderer?.ctx;
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + (this.tileDisplaySize / 2), y + (this.tileDisplaySize / 2), this.tileDisplaySize * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderHighlight() {
    if (!this.highlightedTile) return;
    const screen = this.worldToScreen(this.highlightedTile.x, this.highlightedTile.y, { align: 'top-left' });
    if (!screen) return;
    const ctx = this.spriteRenderer?.ctx;
    if (!ctx) return;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = 'rgba(255, 240, 128, 0.6)';
    ctx.fillRect(screen.x, screen.y, this.tileDisplaySize, this.tileDisplaySize);
    ctx.restore();
  }

  worldToScreen(worldX, worldY, options = {}) {
    const mapWidth = this.gameWorld?.currentWidth ?? 0;
    const mapHeight = this.gameWorld?.currentHeight ?? 0;
    if (mapWidth === 0 || mapHeight === 0) return null;
    const screenX = this.camera.pixelOffsetX + (worldX - this.camera.tileStartX) * this.tileDisplaySize;
    const screenY = this.camera.pixelOffsetY + (worldY - this.camera.tileStartY) * this.tileDisplaySize;
    let adjustedX = screenX;
    let adjustedY = screenY;
    if (options.align === 'center') {
      adjustedX -= this.tileDisplaySize / 2;
      adjustedY -= this.tileDisplaySize / 2;
    }
    return { x: adjustedX, y: adjustedY };
  }

  screenToTile(canvasX, canvasY) {
    const worldX = (canvasX - this.camera.pixelOffsetX) / this.tileDisplaySize + this.camera.tileStartX;
    const worldY = (canvasY - this.camera.pixelOffsetY) / this.tileDisplaySize + this.camera.tileStartY;
    return {
      x: Math.floor(worldX),
      y: Math.floor(worldY),
      preciseX: worldX,
      preciseY: worldY,
    };
  }
}
