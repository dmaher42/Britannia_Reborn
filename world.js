import { clamp } from './utils.js';

const DEFAULT_WORLD_WIDTH = 3000;
const DEFAULT_WORLD_HEIGHT = 2000;
const hasImageAPI = typeof Image !== 'undefined';
let activeWorld = null;

const widthOf = (rect) => rect?.width ?? rect?.w ?? 0;
const heightOf = (rect) => rect?.height ?? rect?.h ?? 0;

const aabbIntersects = (a, b) => {
  if (!a || !b) return false;
  const aw = widthOf(a);
  const ah = heightOf(a);
  const bw = widthOf(b);
  const bh = heightOf(b);
  return (
    a.x < b.x + bw &&
    a.x + aw > b.x &&
    a.y < b.y + bh &&
    a.y + ah > b.y
  );
};

const waitForImage = (img) => new Promise((resolve) => {
  if (!img) {
    resolve(false);
    return;
  }
  const finalize = (success) => resolve(success && img.naturalWidth > 0);
  if (img.complete && img.naturalWidth > 0) {
    resolve(true);
  } else {
    img.addEventListener('load', () => finalize(true), { once: true });
    img.addEventListener('error', () => finalize(false), { once: true });
  }
});

export const obstacleStyles = {
  wall: '#8d7a5b',
  rock: '#4f535d',
  stump: '#6b4b2b',
  tree: '#2f5d31'
};

export const propFallbackColors = {
  tree: '#3f6f3b',
  crate: '#c68c45',
  tent: '#b6a374',
  lantern: '#f1c15a'
};

const parallaxLayers = [
  {
    name: 'sky',
    factor: 0.15,
    draw(ctx, scrollX, scrollY, cam) {
      const gradient = ctx.createLinearGradient(0, 0, 0, cam.height);
      gradient.addColorStop(0, '#7fb1ff');
      gradient.addColorStop(1, '#e6f0ff');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, cam.width, cam.height);
    }
  },
  {
    name: 'mountains',
    factor: 0.35,
    draw(ctx, scrollX, scrollY, cam) {
      const baseY = cam.height * 0.65 + scrollY * 0.05;
      const peakHeight = 140;
      const width = 240;
      const startX = -((scrollX) % width) - width;
      for (let x = startX; x < cam.width + width; x += width) {
        ctx.fillStyle = '#5a769a';
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.lineTo(x + width * 0.5, baseY - peakHeight);
        ctx.lineTo(x + width, baseY);
        ctx.closePath();
        ctx.fill();
      }
    }
  },
  {
    name: 'near-forest',
    factor: 0.55,
    draw(ctx, scrollX, scrollY, cam) {
      const baseY = cam.height * 0.85 + scrollY * 0.08;
      const width = 80;
      const startX = -((scrollX) % width) - width;
      for (let x = startX; x < cam.width + width; x += width) {
        ctx.fillStyle = '#284b32';
        ctx.fillRect(x, baseY - 120, width * 0.6, 120);
        ctx.fillStyle = '#1d3a25';
        ctx.beginPath();
        ctx.moveTo(x + width * 0.3, baseY - 120);
        ctx.lineTo(x + width * 0.5, baseY - 160);
        ctx.lineTo(x + width * 0.7, baseY - 120);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
];

const drawParallax = (ctx, cam) => {
  parallaxLayers.forEach((layer) => {
    const scrollX = cam.x * layer.factor;
    const scrollY = cam.y * layer.factor;
    layer.draw(ctx, scrollX, scrollY, cam);
  });
};

const cloneObstacle = (def) => {
  const width = def.w ?? def.width ?? 0;
  const height = def.h ?? def.height ?? 0;
  return {
    x: def.x ?? 0,
    y: def.y ?? 0,
    width,
    height,
    w: width,
    h: height,
    type: def.type || 'rock'
  };
};

const createProp = (def) => {
  const width = def.w ?? def.width ?? 0;
  const height = def.h ?? def.height ?? 0;
  const prop = {
    x: def.x ?? 0,
    y: def.y ?? 0,
    width,
    height,
    w: width,
    h: height,
    type: def.type || 'prop',
    color: def.color || propFallbackColors[def.type] || 'rgba(200, 210, 220, 0.85)',
    spriteURL: def.spriteURL || null,
    sprite: null,
    spriteReady: false
  };

  let loadPromise = Promise.resolve(false);
  if (prop.spriteURL && hasImageAPI) {
    const img = new Image();
    prop.sprite = img;
    loadPromise = waitForImage(img).then((success) => {
      prop.spriteReady = success;
      if (!success) {
        prop.sprite = null;
      }
      return success;
    });
    img.src = prop.spriteURL;
  }

  return { prop, loadPromise };
};

const isVisible = (rect, cam) => {
  const width = widthOf(rect);
  const height = heightOf(rect);
  return (
    rect.x + width >= cam.x &&
    rect.x <= cam.x + cam.width &&
    rect.y + height >= cam.y &&
    rect.y <= cam.y + cam.height
  );
};

const drawObstacle = (ctx, obstacle, cam) => {
  const screenX = obstacle.x - cam.x;
  const screenY = obstacle.y - cam.y;
  const width = obstacle.width;
  const height = obstacle.height;
  ctx.fillStyle = obstacleStyles[obstacle.type] || '#6b6b6b';
  ctx.fillRect(screenX, screenY, width, height);
  ctx.strokeStyle = 'rgba(12, 18, 22, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(screenX, screenY, width, height);
};

const drawProp = (ctx, prop, cam) => {
  const screenX = prop.x - cam.x;
  const screenY = prop.y - cam.y;
  if (prop.sprite && prop.spriteReady) {
    ctx.drawImage(prop.sprite, screenX, screenY, prop.width, prop.height);
  } else {
    ctx.fillStyle = prop.color;
    ctx.fillRect(screenX, screenY, prop.width, prop.height);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.strokeRect(screenX, screenY, prop.width, prop.height);
  }
};

class World {
  constructor() {
    this.width = DEFAULT_WORLD_WIDTH;
    this.height = DEFAULT_WORLD_HEIGHT;
    this.spawn = { x: this.width / 2, y: this.height / 2 };
    this.currentRoom = null;
    this.ready = Promise.resolve();
  }

  async loadRoom(roomData) {
    const room = {
      name: roomData.name || 'Room',
      terrain: roomData.terrain || roomData.name || 'Wilds',
      bounds: {
        width: roomData.bounds?.width ?? DEFAULT_WORLD_WIDTH,
        height: roomData.bounds?.height ?? DEFAULT_WORLD_HEIGHT
      },
      spawn: {
        x: roomData.spawn?.x ?? 0,
        y: roomData.spawn?.y ?? 0
      },
      obstacles: (roomData.obstacles || []).map(cloneObstacle),
      props: []
    };

    const propPromises = [];
    for (const def of roomData.props || []) {
      const { prop, loadPromise } = createProp(def);
      room.props.push(prop);
      propPromises.push(loadPromise);
    }

    this.width = room.bounds.width;
    this.height = room.bounds.height;
    this.spawn = { ...room.spawn };
    this.currentRoom = room;

    this.ready = Promise.all(propPromises).then(() => room);
    const loadedRoom = await this.ready;
    return loadedRoom;
  }

  getPixelSize() {
    return { width: this.width, height: this.height };
  }

  clampPosition(x, y, radius = 0) {
    return {
      x: clamp(x, radius, Math.max(radius, this.width - radius)),
      y: clamp(y, radius, Math.max(radius, this.height - radius))
    };
  }

  terrainAtWorld() {
    if (!this.currentRoom) return null;
    const terrain = this.currentRoom.terrain;
    if (terrain && typeof terrain === 'string') {
      return { id: terrain.toLowerCase(), name: terrain };
    }
    return terrain ?? { id: 'wilds', name: this.currentRoom.name ?? 'Wilds' };
  }

  resolveMovement(entity, dx, dy) {
    if (!entity) return { dx: 0, dy: 0 };
    const startX = entity.x;
    const startY = entity.y;
    const obstacles = this.currentRoom?.obstacles ?? [];

    if (dx !== 0) {
      entity.x += dx;
      for (const obstacle of obstacles) {
        if (!aabbIntersects(entity, obstacle)) continue;
        if (dx > 0) {
          entity.x = obstacle.x - widthOf(entity);
        } else if (dx < 0) {
          entity.x = obstacle.x + widthOf(obstacle);
        }
      }
    }

    if (dy !== 0) {
      entity.y += dy;
      for (const obstacle of obstacles) {
        if (!aabbIntersects(entity, obstacle)) continue;
        if (dy > 0) {
          entity.y = obstacle.y - heightOf(entity);
        } else if (dy < 0) {
          entity.y = obstacle.y + heightOf(obstacle);
        }
      }
    }

    entity.x = clamp(entity.x, 0, Math.max(0, this.width - widthOf(entity)));
    entity.y = clamp(entity.y, 0, Math.max(0, this.height - heightOf(entity)));

    return { dx: entity.x - startX, dy: entity.y - startY };
  }
}

export const RoomLibrary = {
  meadow: {
    name: 'Outskirts Meadow',
    terrain: 'Meadow',
    bounds: { width: 3000, height: 2000 },
    spawn: { x: 520, y: 460 },
    obstacles: [
      { x: 180, y: 620, w: 460, h: 80, type: 'wall' },
      { x: 760, y: 320, w: 140, h: 220, type: 'tree' },
      { x: 1080, y: 780, w: 320, h: 90, type: 'rock' },
      { x: 1320, y: 500, w: 180, h: 160, type: 'rock' },
      { x: 420, y: 1040, w: 520, h: 90, type: 'wall' },
      { x: 1720, y: 360, w: 380, h: 110, type: 'wall' },
      { x: 1980, y: 920, w: 460, h: 120, type: 'rock' }
    ],
    props: [
      { x: 260, y: 540, w: 120, h: 150, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 690, y: 610, w: 90, h: 90, type: 'crate', color: '#c58f49' },
      { x: 980, y: 520, w: 110, h: 140, type: 'tent', spriteURL: '/assets/tent.png' },
      { x: 1420, y: 680, w: 70, h: 70, type: 'lantern', color: '#f3d16f' },
      { x: 1820, y: 520, w: 140, h: 180, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 2200, y: 860, w: 96, h: 96, type: 'crate' },
      { x: 2480, y: 640, w: 160, h: 200, type: 'tree', spriteURL: '/assets/tree.png' }
    ]
  }
};

export function createDemoWorld() {
  const world = new World();
  activeWorld = world;
  world.ready = world.loadRoom(RoomLibrary.meadow);
  return world;
}

export function drawWorld(ctx, world, camera) {
  ctx.fillStyle = '#244534';
  ctx.fillRect(0, 0, camera.width, camera.height);
  drawParallax(ctx, camera);

  if (!world.currentRoom) return;

  const drawables = [];
  for (const obstacle of world.currentRoom.obstacles) {
    if (isVisible(obstacle, camera)) {
      drawables.push({ kind: 'obstacle', ref: obstacle, depth: obstacle.y + obstacle.height });
    }
  }

  for (const prop of world.currentRoom.props) {
    if (isVisible(prop, camera)) {
      drawables.push({ kind: 'prop', ref: prop, depth: prop.y + prop.height });
    }
  }

  drawables.sort((a, b) => a.depth - b.depth);

  for (const item of drawables) {
    if (item.kind === 'obstacle') {
      drawObstacle(ctx, item.ref, camera);
    } else if (item.kind === 'prop') {
      drawProp(ctx, item.ref, camera);
    }
  }
}

export function loadRoom(roomData, worldInstance = activeWorld) {
  if (!worldInstance || typeof worldInstance.loadRoom !== 'function') {
    throw new Error('Expected a World instance to load rooms into.');
  }
  return worldInstance.loadRoom(roomData);
}

export { World };
