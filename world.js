import { clamp } from './utils.js';

export const TILE_SIZE = 48;

export const TERRAIN_TYPES = {
  grass: { id: 'grass', name: 'Grassland', color: '#275b32', walkable: true },
  road: { id: 'road', name: 'Road', color: '#9c8560', walkable: true },
  forest: { id: 'forest', name: 'Forest', color: '#1d3f27', walkable: true },
  water: { id: 'water', name: 'Water', color: '#15476b', walkable: false },
  wall: { id: 'wall', name: 'Stone Wall', color: '#1b1d24', walkable: false },
  plaza: { id: 'plaza', name: 'Plaza', color: '#4f555d', walkable: true }
};

const CHAR_TO_TERRAIN = {
  '.': 'grass',
  '=': 'road',
  ',': 'forest',
  '~': 'water',
  '#': 'wall',
  '+': 'plaza'
};

export class World {
  constructor({ tiles, terrains = TERRAIN_TYPES, tileSize = TILE_SIZE, spawn }) {
    this.tiles = tiles;
    this.terrains = terrains;
    this.tileSize = tileSize;
    this.height = tiles.length;
    this.width = this.height > 0 ? tiles[0].length : 0;
    this.spawn = spawn ?? { x: tileSize * 2, y: tileSize * 2 };
  }

  tileAt(tx, ty) {
    if (ty < 0 || ty >= this.height || tx < 0 || tx >= this.width) return null;
    return this.tiles[ty][tx];
  }

  tileAtWorld(x, y) {
    const tx = Math.floor(x / this.tileSize);
    const ty = Math.floor(y / this.tileSize);
    return this.tileAt(tx, ty);
  }

  terrainAtWorld(x, y) {
    const tile = this.tileAtWorld(x, y);
    return tile ? this.terrains[tile] ?? null : null;
  }

  isWalkableTile(tx, ty) {
    const id = this.tileAt(tx, ty);
    const terrain = id ? this.terrains[id] : null;
    return Boolean(terrain && terrain.walkable !== false);
  }

  getPixelSize() {
    return { width: this.width * this.tileSize, height: this.height * this.tileSize };
  }

  clampPosition(x, y, radius = 0) {
    const { width, height } = this.getPixelSize();
    return {
      x: clamp(x, radius, Math.max(radius, width - radius)),
      y: clamp(y, radius, Math.max(radius, height - radius))
    };
  }

  isWalkableCircle(x, y, radius = 0) {
    const { width, height } = this.getPixelSize();
    if (x < radius || y < radius || x > width - radius || y > height - radius) return false;
    const minTx = Math.floor((x - radius) / this.tileSize);
    const maxTx = Math.floor((x + radius) / this.tileSize);
    const minTy = Math.floor((y - radius) / this.tileSize);
    const maxTy = Math.floor((y + radius) / this.tileSize);

    for (let ty = minTy; ty <= maxTy; ty += 1) {
      for (let tx = minTx; tx <= maxTx; tx += 1) {
        if (!this.isWalkableTile(tx, ty)) return false;
      }
    }
    return true;
  }
}

export function drawWorld(ctx, world, camera) {
  const { tileSize } = world;
  const startX = Math.max(0, Math.floor(camera.x / tileSize));
  const startY = Math.max(0, Math.floor(camera.y / tileSize));
  const endX = Math.min(world.width, Math.ceil((camera.x + camera.width) / tileSize));
  const endY = Math.min(world.height, Math.ceil((camera.y + camera.height) / tileSize));

  for (let ty = startY; ty < endY; ty += 1) {
    for (let tx = startX; tx < endX; tx += 1) {
      const terrainId = world.tileAt(tx, ty) ?? 'grass';
      const terrain = world.terrains[terrainId] ?? TERRAIN_TYPES.grass;
      const sx = tx * tileSize - camera.x;
      const sy = ty * tileSize - camera.y;
      ctx.fillStyle = terrain.color;
      ctx.fillRect(sx, sy, tileSize, tileSize);

      if (!terrain.walkable) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(sx, sy, tileSize, tileSize);
      }
    }
  }

  ctx.strokeStyle = 'rgba(10, 18, 28, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let tx = startX; tx <= endX; tx += 1) {
    const sx = tx * tileSize - camera.x;
    ctx.moveTo(sx, startY * tileSize - camera.y);
    ctx.lineTo(sx, endY * tileSize - camera.y);
  }
  for (let ty = startY; ty <= endY; ty += 1) {
    const sy = ty * tileSize - camera.y;
    ctx.moveTo(startX * tileSize - camera.x, sy);
    ctx.lineTo(endX * tileSize - camera.x, sy);
  }
  ctx.stroke();
}

const demoLayout = [
  '############################',
  '#======......,,,,,,....~~~~#',
  '#=....@.....,,,,,,....~~~~.#',
  '#=...........,,,,,,........#',
  '#=....######.........####..#',
  '#=....#....#.........#..#..#',
  '#=....#....#.........#..#..#',
  '#=....######.........####..#',
  '#=.........................#',
  '#=..........~~~~~~~........#',
  '#=..........~~~~~~~........#',
  '#=.........................#',
  '#=......####...............#',
  '#=......#..#....,,,........#',
  '#=......#..#....,,,........#',
  '#=......####....,,,........#',
  '#=.........................#',
  '#=..................#####..#',
  '#====================#####.#',
  '############################'
];

function parseLayout(layout, tileSize) {
  const tiles = [];
  let spawn = { x: tileSize * 2, y: tileSize * 2 };

  layout.forEach((row, ty) => {
    const tilesRow = [];
    Array.from(row).forEach((ch, tx) => {
      if (ch === '@') {
        spawn = {
          x: tx * tileSize + tileSize / 2,
          y: ty * tileSize + tileSize / 2
        };
        tilesRow.push('road');
        return;
      }
      tilesRow.push(CHAR_TO_TERRAIN[ch] ?? 'grass');
    });
    tiles.push(tilesRow);
  });

  return { tiles, spawn };
}

export function createDemoWorld() {
  const { tiles, spawn } = parseLayout(demoLayout, TILE_SIZE);
  return new World({ tiles, spawn, tileSize: TILE_SIZE });
}
