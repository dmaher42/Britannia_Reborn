const MODE_CURSOR = {
  look: 'crosshair',
  get: 'grab',
  use: 'pointer',
  talk: 'alias',
};

const MODE_STATUS = {
  look: 'Looking. Click a tile or hold Shift with arrows to inspect.',
  get: 'Ready to take. Click an item or container.',
  use: 'Using. Click something to operate it.',
  talk: 'Talk mode. Click a person to speak (coming soon).',
};

export class InteractionSystem {
  constructor({
    canvas,
    map,
    player,
    inventory,
    character,
    messageDisplay,
    objectRenderer,
    onInventoryChange,
  }) {
    this.canvas = canvas;
    this.map = map;
    this.player = player;
    this.inventory = inventory;
    this.character = character;
    this.messageDisplay = messageDisplay;
    this.objectRenderer = objectRenderer;
    this.onInventoryChange = typeof onInventoryChange === 'function' ? onInventoryChange : null;
    this.mode = null;
    this._onKeyDown = (event) => this.handleKeyDown(event);
    this._onKeyUp = (event) => this.handleKeyUp(event);
    this._onClick = (event) => this.handleCanvasClick(event);
    this._onMove = (event) => this.handlePointerMove(event);
    this.setupKeyboardHandlers();
  }

  setupKeyboardHandlers() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    if (this.canvas) {
      this.canvas.addEventListener('click', this._onClick);
      this.canvas.addEventListener('mousemove', this._onMove);
      this.canvas.addEventListener('mouseleave', () => this.objectRenderer?.clearHighlight());
    }
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    if (this.canvas) {
      this.canvas.removeEventListener('click', this._onClick);
      this.canvas.removeEventListener('mousemove', this._onMove);
    }
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.objectRenderer?.setMode(mode);
    if (this.canvas) {
      this.canvas.dataset.mode = mode ?? '';
      this.canvas.style.cursor = MODE_CURSOR[mode] ?? 'default';
    }
    if (this.messageDisplay) {
      this.messageDisplay.setMode(mode);
      const status = mode ? MODE_STATUS[mode] ?? '' : 'Moving freely. Use L/G/U/T to interact.';
      this.messageDisplay.setStatus(status);
    }
  }

  clearMode() {
    this.setMode(null);
    this.objectRenderer?.clearHighlight();
  }

  handleKeyDown(event) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }
    switch (event.key) {
      case 'L':
      case 'l':
        this.setMode('look');
        break;
      case 'G':
      case 'g':
        this.setMode('get');
        break;
      case 'U':
      case 'u':
        this.setMode('use');
        break;
      case 'T':
      case 't':
        this.setMode('talk');
        break;
      case 'Escape':
        this.clearMode();
        break;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        if (event.shiftKey) {
          event.preventDefault();
          this.lookInDirection(event.key);
        }
        break;
      default:
        break;
    }
  }

  handleKeyUp(event) {
    if (event.key === 'Shift') {
      this.objectRenderer?.clearHighlight();
    }
  }

  handlePointerMove(event) {
    if (!this.mode) {
      this.objectRenderer?.clearHighlight();
      return;
    }
    const tile = this.tileFromEvent(event);
    if (!tile) {
      this.objectRenderer?.clearHighlight();
      return;
    }
    const objects = this.map.objectsAt(tile.x, tile.y);
    const focus = objects[objects.length - 1] ?? null;
    this.objectRenderer?.setHighlight(focus, tile);
  }

  handleCanvasClick(event) {
    const tile = this.tileFromEvent(event);
    if (!tile) return;
    const objects = this.map.objectsAt(tile.x, tile.y);
    const target = objects[objects.length - 1] ?? null;
    this.handleObjectClick(target, tile);
  }

  tileFromEvent(event) {
    if (!this.canvas || !this.map) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      return null;
    }
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const tileWidth = this.canvas.width / this.map.currentWidth;
    const tileHeight = this.canvas.height / this.map.currentHeight;
    const tileX = Math.floor((x * scaleX) / tileWidth);
    const tileY = Math.floor((y * scaleY) / tileHeight);
    if (tileX < 0 || tileY < 0 || tileX >= this.map.currentWidth || tileY >= this.map.currentHeight) {
      return null;
    }
    return { x: tileX, y: tileY };
  }

  handleObjectClick(object, tile) {
    if (!this.mode) {
      if (object) {
        this.messageDisplay?.log(object.onLook(this.createContext()));
      } else {
        this.lookAtTile(tile);
      }
      return;
    }
    switch (this.mode) {
      case 'look':
        if (object) {
          this.messageDisplay?.log(object.onLook(this.createContext()));
        } else {
          this.lookAtTile(tile);
        }
        break;
      case 'get':
        if (object) {
          this.getObject(object);
        } else {
          this.messageDisplay?.log('There is nothing here to take.');
        }
        break;
      case 'use':
        if (object) {
          this.useObject(object);
        } else {
          this.messageDisplay?.log('There is nothing here to use.');
        }
        break;
      case 'talk':
        if (object) {
          this.talkTo(object);
        } else {
          this.messageDisplay?.log('Only silence answers.');
        }
        break;
      default:
        break;
    }
  }

  lookAtTile(tile) {
    if (!tile) return;
    const description = this.map.describeTile(tile.x, tile.y);
    this.messageDisplay?.log(description);
  }

  getObject(object) {
    if (!object) return;
    const context = this.createContext();
    if (object.type === 'container' && object.take) {
      const result = object.take();
      this.messageDisplay?.log(result.message);
      if (result.success && result.item) {
        if (!this.inventory.add(result.item)) {
          this.messageDisplay?.log("You can't carry any more.");
          // Put item back
          object.contains.unshift(result.item);
        } else {
          this.onInventoryChange?.();
        }
      }
      return;
    }
    const response = object.onGet(context);
    if (!response.success) {
      this.messageDisplay?.log(response.message);
      return;
    }
    if (!this.inventory.add(object)) {
      this.messageDisplay?.log("You cannot lift that.");
      return;
    }
    this.map.removeObject(object.id);
    this.messageDisplay?.log(response.message);
    this.onInventoryChange?.();
  }

  useObject(object) {
    if (!object) return;
    const context = this.createContext();
    const result = object.onUse(context);
    if (result?.message) {
      this.messageDisplay?.log(result.message);
    }
    if (result?.item) {
      if (!this.inventory.add(result.item)) {
        this.messageDisplay?.log("You cannot carry that.");
        this.map.addObject(result.item);
      } else {
        this.onInventoryChange?.();
      }
    }
  }

  talkTo(object) {
    if (object.type === 'npc') {
      const line = object.dialogue?.[0] ?? `${object.name} has nothing to say yet.`;
      this.messageDisplay?.log(line);
    } else {
      this.messageDisplay?.log('No one responds.');
    }
  }

  lookInDirection(key) {
    const direction = this.directionFromKey(key);
    if (!direction) return;
    const tileX = Math.floor(this.player.position.x) + direction.x;
    const tileY = Math.floor(this.player.position.y) + direction.y;
    if (tileX < 0 || tileY < 0 || tileX >= this.map.currentWidth || tileY >= this.map.currentHeight) {
      this.messageDisplay?.log('Beyond the wall you see nothing.');
      return;
    }
    const objects = this.map.objectsAt(tileX, tileY);
    const target = objects[objects.length - 1] ?? null;
    if (target) {
      this.messageDisplay?.log(target.onLook(this.createContext()));
    } else {
      this.lookAtTile({ x: tileX, y: tileY });
    }
    this.objectRenderer?.setHighlight(target, { x: tileX, y: tileY });
  }

  directionFromKey(key) {
    switch (key) {
      case 'ArrowUp':
        return { x: 0, y: -1 };
      case 'ArrowDown':
        return { x: 0, y: 1 };
      case 'ArrowLeft':
        return { x: -1, y: 0 };
      case 'ArrowRight':
        return { x: 1, y: 0 };
      default:
        return null;
    }
  }

  createContext() {
    return {
      map: this.map,
      world: this.map,
      inventory: this.inventory,
      player: this.player,
      character: this.character,
      messageDisplay: this.messageDisplay,
    };
  }
}

