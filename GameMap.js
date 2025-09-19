const WALKABLE_TILES = new Set(['grass', 'cave_floor', 'cave_entrance', 'path']);

const createGrid = (rows) => rows.map((row) => row.split(' '));

const AREA_LIBRARY = {
  forest: {
    id: 'forest',
    name: 'Whispering Forest',
    level: 1,
    safe: true,
    spawn: { x: 2, y: 2 },
    tiles: createGrid([
      'tree tree tree tree tree tree tree tree tree tree tree tree tree tree tree tree tree tree tree tree',
      'tree grass grass grass grass grass grass grass grass grass grass grass grass grass grass grass grass grass grass tree',
      'tree grass path path path grass grass grass grass tree tree grass grass grass grass grass grass grass grass tree',
      'tree grass path grass path grass grass grass grass tree tree grass grass grass grass grass grass grass grass tree',
      'tree grass path grass path grass grass tree tree tree tree grass grass grass grass grass grass tree grass tree',
      'tree grass path grass path path path path path path grass grass grass grass grass grass grass tree grass tree',
      'tree grass path grass grass grass grass grass grass path grass grass grass grass grass grass grass tree grass tree',
      'tree grass path grass grass tree tree grass grass path grass grass grass tree tree grass grass tree grass tree',
      'tree grass path grass grass tree water water water water water water water tree grass grass grass tree grass tree',
      'tree grass path grass grass grass grass grass grass grass grass grass grass grass grass grass grass tree grass tree',
      'tree grass path path path path path grass grass grass grass grass grass grass grass cave_entrance tree grass tree',
      'tree grass grass grass grass grass grass grass tree tree tree grass grass grass grass grass grass tree grass tree',
      'tree grass grass grass tree tree grass grass tree tree tree grass grass tree tree grass grass grass grass tree',
      'tree grass grass grass tree tree grass grass tree grass grass grass grass tree tree grass grass grass grass tree',
      'tree grass grass grass grass grass grass grass tree grass grass grass grass grass grass grass grass grass grass tree',
      'tree grass grass grass grass tree tree grass tree grass grass tree tree tree grass grass grass grass grass tree',
      'tree grass grass grass grass tree tree grass grass grass grass tree tree tree grass grass grass grass grass tree',
      'tree grass grass grass grass grass grass grass grass grass grass grass grass grass grass grass grass grass grass tree',
      'tree grass grass grass grass grass grass grass grass grass grass grass grass grass grass grass grass grass grass tree',
      'tree tree tree tree tree tree tree tree tree tree tree tree tree tree tree tree tree tree tree tree',
    ]),
    transitions: [
      { tile: 'cave_entrance', to: 'cave', spawn: { x: 10, y: 17 } },
    ],
  },
  cave: {
    id: 'cave',
    name: 'Echoing Cave',
    level: 3,
    safe: false,
    spawn: { x: 10, y: 18 },
    tiles: createGrid([
      'wall wall wall wall wall wall wall wall wall wall wall wall wall wall wall wall wall wall wall wall',
      'wall cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor wall',
      'wall cave_floor cave_floor wall wall wall cave_floor cave_floor cave_floor wall wall wall cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor wall',
      'wall cave_floor cave_floor wall cave_floor cave_floor cave_floor wall cave_floor wall cave_floor wall cave_floor wall wall wall cave_floor wall cave_floor wall',
      'wall cave_floor cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall',
      'wall cave_floor cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall',
      'wall cave_floor cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall',
      'wall cave_floor cave_floor wall cave_floor wall cave_floor wall cave_floor cave_floor cave_floor wall cave_floor cave_floor cave_floor cave_floor cave_floor wall cave_floor wall',
      'wall cave_floor cave_floor wall cave_floor wall cave_floor wall wall wall cave_floor wall wall wall wall wall cave_floor wall cave_floor wall',
      'wall cave_floor cave_floor wall cave_floor wall cave_floor wall cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor wall cave_floor wall',
      'wall cave_floor cave_floor wall cave_floor wall cave_floor wall cave_floor wall wall wall cave_floor wall wall wall cave_floor wall cave_floor wall',
      'wall cave_floor cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall',
      'wall cave_floor cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall',
      'wall cave_floor cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall',
      'wall cave_floor cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall',
      'wall cave_floor cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall cave_floor wall',
      'wall cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor wall',
      'wall cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor wall',
      'wall cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_entrance cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor cave_floor wall',
      'wall wall wall wall wall wall wall wall wall wall wall wall wall wall wall wall wall wall wall wall',
    ]),
    transitions: [
      { tile: 'cave_entrance', to: 'forest', spawn: { x: 15, y: 10 } },
    ],
  },
};

const tileName = {
  grass: 'Grass',
  tree: 'Trees',
  water: 'Water',
  path: 'Trail',
  cave_entrance: 'Cave Entrance',
  cave_floor: 'Cavern Floor',
  wall: 'Stone Wall',
};

export class GameMap {
  constructor(options = {}) {
    this.areas = options.areas ? { ...AREA_LIBRARY, ...options.areas } : AREA_LIBRARY;
    this.currentAreaId = options.startArea ?? 'forest';
    this.discoveredAreas = new Set([this.currentAreaId]);
    this.currentTileType = 'grass';
  }

  get currentArea() {
    return this.areas[this.currentAreaId];
  }

  get currentWidth() {
    return this.currentArea?.tiles?.[0]?.length ?? 0;
  }

  get currentHeight() {
    return this.currentArea?.tiles?.length ?? 0;
  }

  getAreaLevel() {
    return this.currentArea?.level ?? 1;
  }

  getAreaName() {
    return this.currentArea?.name ?? 'Unknown';
  }

  tileAt(tileX, tileY) {
    const area = this.currentArea;
    if (!area || tileX < 0 || tileY < 0) return 'void';
    return area.tiles?.[tileY]?.[tileX] ?? 'void';
  }

  tileNameAt(tileX, tileY) {
    return tileName[this.tileAt(tileX, tileY)] ?? 'Unknown';
  }

  tileAtWorld(x, y) {
    return this.tileAt(Math.floor(x), Math.floor(y));
  }

  isWalkableTile(tile) {
    return WALKABLE_TILES.has(tile);
  }

  isWalkableCircle(x, y, radius = 0.3) {
    const minX = Math.floor(x - radius);
    const maxX = Math.floor(x + radius);
    const minY = Math.floor(y - radius);
    const maxY = Math.floor(y + radius);
    for (let ty = minY; ty <= maxY; ty += 1) {
      for (let tx = minX; tx <= maxX; tx += 1) {
        if (!this.isWalkableTile(this.tileAt(tx, ty))) {
          return false;
        }
      }
    }
    return true;
  }

  setArea(id, spawn) {
    if (!this.areas[id]) return false;
    this.currentAreaId = id;
    this.discoveredAreas.add(id);
    this.currentTileType = this.tileAt(spawn?.x ?? 0, spawn?.y ?? 0);
    return true;
  }

  checkTransition(tileX, tileY) {
    const tile = this.tileAt(tileX, tileY);
    const transitions = this.currentArea?.transitions ?? [];
    const match = transitions.find((transition) => transition.tile === tile);
    if (!match) return null;
    return match;
  }

  updateTileInfo(x, y) {
    this.currentTileType = this.tileAtWorld(x, y);
    return this.currentTileType;
  }

  toJSON() {
    return {
      currentAreaId: this.currentAreaId,
      discoveredAreas: Array.from(this.discoveredAreas),
    };
  }

  load(data) {
    if (!data) return;
    if (data.currentAreaId && this.areas[data.currentAreaId]) {
      this.currentAreaId = data.currentAreaId;
    }
    if (Array.isArray(data.discoveredAreas)) {
      this.discoveredAreas = new Set(data.discoveredAreas.filter((id) => this.areas[id]));
    }
  }
}

