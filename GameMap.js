import { WorldObject } from './WorldObject.js';

const WALKABLE_TILES = new Set(['grass', 'cave_floor', 'cave_entrance', 'path', 'floor', 'gate']);

const createGrid = (rows) => rows.map((row) => row.split(' '));

const parseAsciiMap = (rows, mapping) =>
  rows.map((row) =>
    row
      .split('')
      .map((symbol) => mapping[symbol] ?? mapping['.'])
      .join(' ')
  );

const STARTER_ROOM_LAYOUT = [
  '##########',
  '#........#',
  '#..A.....#',
  '#........#',
  '#........#',
  'D..G.L..S#',
  '#........#',
  '#........#',
  '#.......C#',
  '##########',
];

const STARTER_ROOM_MAP = parseAsciiMap(STARTER_ROOM_LAYOUT, {
  '#': 'wall',
  '.': 'floor',
  'D': 'floor',
  'L': 'floor',
  'A': 'floor',
  'C': 'floor',
  'G': 'gate',
  'S': 'floor',
});

const AREA_LIBRARY = {
  'starter-room': {
    id: 'starter-room',
    name: 'Starter Chamber',
    level: 1,
    safe: true,
    spawn: { x: 2, y: 5 },
    tiles: createGrid(STARTER_ROOM_MAP),
    transitions: [{ tile: 'gate', to: 'forest', spawn: { x: 10, y: 10 } }],
  },
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
      'tree grass gate path path path path grass grass grass grass grass grass grass grass cave_entrance tree grass tree',
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
      { tile: 'gate', to: 'starter-room', spawn: { x: 3, y: 5 } },
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
  floor: 'Stone Floor',
  wall: 'Stone Wall',
  grass: 'Grass',
  tree: 'Trees',
  water: 'Water',
  path: 'Trail',
  cave_entrance: 'Cave Entrance',
  cave_floor: 'Cavern Floor',
  gate: 'City Gate',
};

export class GameMap {
  constructor(options = {}) {
    this.areas = options.areas ? { ...AREA_LIBRARY, ...options.areas } : AREA_LIBRARY;
    this.currentAreaId = options.startArea ?? 'starter-room';
    this.discoveredAreas = new Set([this.currentAreaId]);
    this.currentTileType = this.tileAt(
      this.currentArea?.spawn?.x ?? 0,
      this.currentArea?.spawn?.y ?? 0
    );
    this.areaObjects = new Map();
    const objects = options.objects ?? {};
    Object.keys(this.areas).forEach((areaId) => {
      const entries = objects[areaId];
      if (Array.isArray(entries)) {
        this.areaObjects.set(
          areaId,
          entries.map((entry) => (entry instanceof WorldObject ? entry : WorldObject.fromJSON(entry)))
        );
      } else {
        this.areaObjects.set(areaId, []);
      }
    });
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
        const blockers = this.objectsAt(tx, ty);
        if (blockers.some((object) => typeof object.blocksMovement === 'function' && object.blocksMovement())) {
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
    this.ensureAreaObjects(id);
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
    const objects = {};
    this.areaObjects.forEach((list, areaId) => {
      objects[areaId] = list.map((object) => object.toJSON());
    });
    return {
      currentAreaId: this.currentAreaId,
      discoveredAreas: Array.from(this.discoveredAreas),
      objects,
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
    this.areaObjects = new Map();
    Object.keys(this.areas).forEach((areaId) => {
      const entries = data.objects?.[areaId];
      if (Array.isArray(entries)) {
        this.areaObjects.set(areaId, entries.map((entry) => WorldObject.fromJSON(entry)));
      } else {
        this.areaObjects.set(areaId, []);
      }
    });
  }

  ensureAreaObjects(areaId) {
    if (!this.areaObjects.has(areaId)) {
      this.areaObjects.set(areaId, []);
    }
    return this.areaObjects.get(areaId);
  }

  getObjects(areaId = this.currentAreaId) {
    return this.areaObjects.get(areaId) ?? [];
  }

  setObjects(areaId, objects = []) {
    this.areaObjects.set(
      areaId,
      objects.map((object) => (object instanceof WorldObject ? object : WorldObject.fromJSON(object)))
    );
  }

  addObject(object, areaId = this.currentAreaId) {
    if (!(object instanceof WorldObject)) {
      throw new TypeError('Only WorldObject instances can be added to the map.');
    }
    const list = this.ensureAreaObjects(areaId);
    list.push(object);
    return object;
  }

  removeObject(id, areaId = this.currentAreaId) {
    const list = this.ensureAreaObjects(areaId);
    const index = list.findIndex((object) => object.id === id);
    if (index === -1) return null;
    const [removed] = list.splice(index, 1);
    return removed ?? null;
  }

  findObjectById(id, areaId = this.currentAreaId) {
    const list = this.ensureAreaObjects(areaId);
    return list.find((object) => object.id === id) ?? null;
  }

  objectsAt(tileX, tileY, areaId = this.currentAreaId) {
    if (tileX < 0 || tileY < 0) return [];
    const list = this.ensureAreaObjects(areaId);
    return list.filter((object) => object.x === tileX && object.y === tileY);
  }

  describeTile(tileX, tileY) {
    const base = this.tileNameAt(tileX, tileY);
    const objects = this.objectsAt(tileX, tileY);
    if (objects.length === 0) {
      return `You see ${base.toLowerCase()}.`;
    }
    const names = objects.map((object) => object.name).join(', ');
    return `You see ${names} on the ${base.toLowerCase()}.`;
  }
}

