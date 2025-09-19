import { clamp, lightenColor, darkenColor } from './utils.js';

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
  tree: '#2f5d31',
  water: '#2a4f66'
};

export const propFallbackColors = {
  tree: '#3f6f3b',
  crate: '#c68c45',
  tent: '#b6a374',
  lantern: '#f1c15a',
  castle: '#d1c4af',
  causeway: '#bfb19a',
  banner: '#b2352f',
  brazier: '#8c6f4a'
};

const baseTerrainSky = {
  top: '#2f4868',
  mid: '#3d6c88',
  bottom: '#a3c6c0',
  sun: '#f8e6b5',
  glow: 'rgba(255, 216, 164, 0.6)'
};

const baseTerrainGround = {
  base: '#213029',
  highlight: '#385245',
  shadow: '#111c16',
  detail: '#415a46',
  secondaryDetail: '#24392c',
  tileSize: 140,
  noiseStrength: 0.32,
  streakIntensity: 0.18
};

const baseAmbientSettings = {
  tint: 'rgba(34, 54, 46, 0.32)',
  light: 'rgba(245, 225, 186, 0.24)',
  highlight: 'rgba(255, 237, 184, 0.16)',
  origin: { x: 0.62, y: 0.28 },
  radius: 1.18
};

const baseFogSettings = {
  color: 'rgba(116, 164, 150, 0.18)',
  horizon: 'rgba(175, 210, 220, 0.18)'
};

const baseVignette = {
  strength: 0.38,
  color: 'rgba(12, 20, 18, 0.85)'
};

const baseBloom = {
  color: 'rgba(255, 220, 160, 0.18)',
  radius: 0.75
};

const createTerrainTheme = (overrides = {}) => ({
  sky: { ...baseTerrainSky, ...(overrides.sky ?? {}) },
  ground: { ...baseTerrainGround, ...(overrides.ground ?? {}) },
  ambient: { ...baseAmbientSettings, ...(overrides.ambient ?? {}) },
  fog: { ...baseFogSettings, ...(overrides.fog ?? {}) },
  vignette: { ...baseVignette, ...(overrides.vignette ?? {}) },
  bloom: { ...baseBloom, ...(overrides.bloom ?? {}) }
});

const terrainThemes = {
  default: createTerrainTheme(),
  'castle keep': createTerrainTheme({
    sky: {
      top: '#1e2741',
      mid: '#2d4f7a',
      bottom: '#8bb2da'
    },
    ground: {
      base: '#222e29',
      highlight: '#3f5446',
      shadow: '#101a15',
      detail: '#425d4c',
      secondaryDetail: '#24352b',
      tileSize: 150,
      noiseStrength: 0.28,
      streakIntensity: 0.22
    },
    ambient: {
      tint: 'rgba(28, 48, 42, 0.36)',
      light: 'rgba(255, 231, 189, 0.26)',
      origin: { x: 0.52, y: 0.32 },
      radius: 1.26
    },
    fog: {
      color: 'rgba(90, 124, 144, 0.22)',
      horizon: 'rgba(172, 204, 224, 0.22)'
    },
    bloom: {
      color: 'rgba(255, 224, 170, 0.22)',
      radius: 0.82
    }
  }),
  meadow: createTerrainTheme({
    sky: {
      top: '#284a5c',
      mid: '#3c7a8f',
      bottom: '#b7e0c6'
    },
    ground: {
      base: '#1f3325',
      highlight: '#3f6b3f',
      shadow: '#112017',
      detail: '#4a7b45',
      secondaryDetail: '#284f32',
      tileSize: 130,
      noiseStrength: 0.36,
      streakIntensity: 0.16
    },
    ambient: {
      tint: 'rgba(34, 60, 44, 0.32)',
      light: 'rgba(234, 246, 198, 0.2)',
      highlight: 'rgba(255, 255, 210, 0.2)',
      origin: { x: 0.58, y: 0.26 }
    },
    fog: {
      color: 'rgba(132, 200, 158, 0.18)',
      horizon: 'rgba(188, 232, 207, 0.2)'
    },
    vignette: {
      strength: 0.32,
      color: 'rgba(14, 24, 18, 0.75)'
    }
  }),
  'whispering forest': createTerrainTheme({
    sky: {
      top: '#121c2d',
      mid: '#223a4a',
      bottom: '#7da0b2',
      glow: 'rgba(136, 186, 222, 0.4)'
    },
    ground: {
      base: '#101b17',
      highlight: '#2f463a',
      shadow: '#080f0c',
      detail: '#375043',
      secondaryDetail: '#182824',
      tileSize: 140,
      noiseStrength: 0.42,
      streakIntensity: 0.12
    },
    ambient: {
      tint: 'rgba(20, 38, 34, 0.46)',
      light: 'rgba(152, 196, 184, 0.2)',
      highlight: 'rgba(196, 240, 220, 0.12)',
      origin: { x: 0.72, y: 0.22 },
      radius: 1.32
    },
    fog: {
      color: 'rgba(74, 112, 108, 0.25)',
      horizon: 'rgba(160, 200, 210, 0.18)'
    },
    vignette: {
      strength: 0.44,
      color: 'rgba(6, 10, 12, 0.9)'
    }
  }),
  'drowned coast': createTerrainTheme({
    sky: {
      top: '#0e1a2a',
      mid: '#183a53',
      bottom: '#5c8aa8',
      sun: '#f5f0d0'
    },
    ground: {
      base: '#142227',
      highlight: '#2b4b54',
      shadow: '#09131a',
      detail: '#2f5c5f',
      secondaryDetail: '#12272c',
      tileSize: 150,
      noiseStrength: 0.34,
      streakIntensity: 0.24
    },
    ambient: {
      tint: 'rgba(20, 40, 48, 0.42)',
      light: 'rgba(180, 224, 240, 0.22)',
      highlight: 'rgba(166, 206, 240, 0.16)',
      origin: { x: 0.54, y: 0.24 }
    },
    fog: {
      color: 'rgba(62, 116, 140, 0.28)',
      horizon: 'rgba(132, 188, 214, 0.28)'
    },
    bloom: {
      color: 'rgba(180, 220, 255, 0.22)',
      radius: 0.9
    }
  })
};

const normalizeTerrainName = (name) => {
  if (!name || typeof name !== 'string') return 'default';
  return name.trim().toLowerCase();
};

const getTerrainTheme = (terrainName) => {
  const normalized = normalizeTerrainName(terrainName);
  return terrainThemes[normalized] || terrainThemes.default;
};

const pseudoRandom = (x, y) => {
  const value = Math.sin((x * 127.1 + y * 311.7) * 43758.5453);
  return value - Math.floor(value);
};

const drawTerrainBase = (ctx, cam, theme) => {
  const { ground } = theme;
  const gradient = ctx.createLinearGradient(0, 0, 0, cam.height);
  gradient.addColorStop(0, ground.highlight);
  gradient.addColorStop(1, ground.shadow);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cam.width, cam.height);

  const tileSize = Math.max(32, ground.tileSize || 120);
  const noiseStrength = ground.noiseStrength ?? 0.3;
  const startX = Math.floor((cam.x - cam.width) / tileSize) * tileSize;
  const startY = Math.floor((cam.y - cam.height) / tileSize) * tileSize;
  const endX = cam.x + cam.width * 2;
  const endY = cam.y + cam.height * 2;

  ctx.save();
  ctx.globalAlpha = 0.55;
  for (let worldY = startY; worldY < endY; worldY += tileSize) {
    for (let worldX = startX; worldX < endX; worldX += tileSize) {
      const tileX = Math.floor(worldX / tileSize);
      const tileY = Math.floor(worldY / tileSize);
      const noise = pseudoRandom(tileX, tileY);
      const screenX = worldX - cam.x;
      const screenY = worldY - cam.y;
      const baseColor = noise > 0.55
        ? lightenColor(ground.detail, (noise - 0.55) * noiseStrength)
        : darkenColor(ground.secondaryDetail, (0.55 - noise) * noiseStrength);
      const patchSize = tileSize * 0.92;
      const inset = tileSize * 0.08;
      ctx.fillStyle = baseColor;
      ctx.fillRect(screenX + inset * 0.5, screenY + inset * 0.5, patchSize, patchSize);
    }
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = ground.streakIntensity ?? 0.15;
  ctx.strokeStyle = lightenColor(ground.detail, 0.18);
  ctx.lineWidth = Math.max(1, tileSize * 0.06);
  const stripeSpacing = tileSize * 0.75;
  for (let offset = -cam.height; offset < cam.width + cam.height; offset += stripeSpacing) {
    ctx.beginPath();
    ctx.moveTo(offset - cam.height * 0.5, cam.height);
    ctx.lineTo(offset + cam.height * 0.3, 0);
    ctx.stroke();
  }
  ctx.restore();
};

const applyAmbientLight = (ctx, cam, theme) => {
  const { ambient } = theme;
  if (!ambient) return;
  ctx.save();
  if (ambient.tint) {
    ctx.fillStyle = ambient.tint;
    ctx.fillRect(0, 0, cam.width, cam.height);
  }
  const originX = cam.width * (ambient.origin?.x ?? 0.5);
  const originY = cam.height * (ambient.origin?.y ?? 0.3);
  const radius = Math.max(cam.width, cam.height) * (ambient.radius ?? 1);
  const gradient = ctx.createRadialGradient(originX, originY, radius * 0.15, originX, originY, radius);
  gradient.addColorStop(0, ambient.highlight ?? 'rgba(255, 255, 255, 0.18)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cam.width, cam.height);
  if (ambient.light) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = ambient.light;
    ctx.fillRect(0, 0, cam.width, cam.height);
  }
  ctx.restore();
};

const applyFog = (ctx, cam, theme) => {
  const { fog } = theme;
  if (!fog) return;
  ctx.save();
  const gradient = ctx.createLinearGradient(0, 0, 0, cam.height);
  gradient.addColorStop(0, fog.horizon ?? 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(1, fog.color ?? 'rgba(0, 0, 0, 0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cam.width, cam.height);
  ctx.restore();
};

const applyBloom = (ctx, cam, theme) => {
  const { bloom } = theme;
  if (!bloom) return;
  ctx.save();
  const radius = Math.max(cam.width, cam.height) * (bloom.radius ?? 0.75);
  const gradient = ctx.createRadialGradient(
    cam.width * 0.6,
    cam.height * 0.35,
    radius * 0.1,
    cam.width * 0.6,
    cam.height * 0.35,
    radius
  );
  gradient.addColorStop(0, bloom.color ?? 'rgba(255, 220, 170, 0.16)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cam.width, cam.height);
  ctx.restore();
};

const applyVignette = (ctx, cam, theme) => {
  const { vignette } = theme;
  if (!vignette || vignette.strength <= 0) return;
  ctx.save();
  const gradient = ctx.createRadialGradient(
    cam.width / 2,
    cam.height * 0.58,
    Math.min(cam.width, cam.height) * 0.3,
    cam.width / 2,
    cam.height * 0.6,
    Math.max(cam.width, cam.height) * 0.9
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, vignette.color ?? 'rgba(12, 20, 18, 0.85)');
  ctx.globalAlpha = vignette.strength;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cam.width, cam.height);
  ctx.restore();
};

const drawRoundedRectPath = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const drawBattlements = (ctx, x, y, width, height, fillColor, shadowColor) => {
  ctx.save();
  ctx.fillStyle = shadowColor;
  ctx.fillRect(x, y - height, width, height);
  const notchCount = Math.max(3, Math.round(width / 80));
  const notchWidth = Math.max(14, width / (notchCount * 1.35));
  const gap = notchWidth * 0.6;
  ctx.fillStyle = fillColor;
  for (let px = x + gap; px < x + width - notchWidth; px += notchWidth + gap) {
    ctx.fillRect(px, y - height, notchWidth, height);
  }
  ctx.restore();
};

const drawCastleProp = (ctx, prop, cam) => {
  const screenX = prop.x - cam.x;
  const screenY = prop.y - cam.y;
  const { width, height } = prop;
  ctx.save();
  ctx.translate(screenX, screenY);

  const palette = {
    stoneLight: '#f0e5d2',
    stoneMid: '#d4c4ab',
    stoneShadow: '#b19f86',
    roofLight: '#8a2e2b',
    roofShadow: '#56201d',
    windowGlow: '#f8e1b2',
    windowDark: '#1b2734',
    bannerPrimary: prop.primaryColor || '#b2352f',
    bannerSecondary: prop.secondaryColor || '#f3cf6b',
    bannerAccent: prop.accentColor || '#fef2c6'
  };

  const hallThemes = [
    { name: 'Great Hall', type: 'banquet', ambient: '#2b1d13' },
    { name: 'War Room', type: 'war', ambient: '#1e262f' },
    { name: "Royal Chapel", type: 'chapel', ambient: '#22192b' },
    { name: 'Scholars\' Library', type: 'library', ambient: '#1c1913' },
    { name: 'Guard Barracks', type: 'barracks', ambient: '#1f2324' },
    { name: 'Solar Study', type: 'study', ambient: '#1c2028' },
    { name: 'Crystal Observatory', type: 'observatory', ambient: '#141e2c' },
    { name: 'Indoor Garden', type: 'garden', ambient: '#15221a' }
  ];
  const keepThemes = [
    { name: 'Throne Room', type: 'throne', ambient: '#2b1810' },
    { name: 'Royal Chambers', type: 'royal', ambient: '#1e1a24' },
    { name: 'Arcane Laboratory', type: 'alchemy', ambient: '#161d23' },
    { name: 'Vaulted Observatory', type: 'observatory', ambient: '#101827' }
  ];
  const towerThemes = [
    { name: 'Armory', type: 'armory', ambient: '#1c2126' },
    { name: 'Guard Quarters', type: 'barracks', ambient: '#1b2527' },
    { name: 'Signal Room', type: 'war', ambient: '#121b26' },
    { name: 'Aerie Study', type: 'study', ambient: '#1c212b' }
  ];
  const lowerThemes = [
    { name: 'Gatehouse', type: 'armory', ambient: '#1c1f24' },
    { name: 'Stables', type: 'stable', ambient: '#201d14' },
    { name: 'Servants\' Hall', type: 'banquet', ambient: '#241c14' },
    { name: 'Cellars', type: 'storage', ambient: '#161513' },
    { name: 'Ready Barracks', type: 'barracks', ambient: '#1f2324' }
  ];

  const drawRoomInterior = (x, y, w, h, theme) => {
    if (!theme) return;
    ctx.save();
    const centerX = x + w / 2;

    switch (theme.type) {
      case 'throne': {
        ctx.fillStyle = '#3b1f1b';
        ctx.fillRect(centerX - w * 0.32, y + h * 0.82, w * 0.64, h * 0.08);
        ctx.fillStyle = '#a3713c';
        drawRoundedRectPath(ctx, centerX - w * 0.18, y + h * 0.56, w * 0.36, h * 0.28, w * 0.08);
        ctx.fill();
        ctx.fillStyle = '#d6be7a';
        drawRoundedRectPath(ctx, centerX - w * 0.12, y + h * 0.46, w * 0.24, h * 0.18, w * 0.12);
        ctx.fill();
        ctx.fillStyle = '#f7e4b6';
        ctx.beginPath();
        ctx.moveTo(centerX, y + h * 0.32);
        ctx.lineTo(centerX + w * 0.09, y + h * 0.46);
        ctx.lineTo(centerX - w * 0.09, y + h * 0.46);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'banquet': {
        ctx.fillStyle = '#6d4a28';
        drawRoundedRectPath(ctx, x + w * 0.1, y + h * 0.58, w * 0.8, h * 0.2, h * 0.08);
        ctx.fill();
        ctx.fillStyle = '#c59a58';
        for (let i = 0; i < 4; i += 1) {
          const seatX = x + w * 0.16 + i * w * 0.18;
          ctx.fillRect(seatX, y + h * 0.5, w * 0.12, h * 0.08);
          ctx.fillRect(seatX, y + h * 0.78, w * 0.12, h * 0.08);
        }
        ctx.fillStyle = '#f4dfac';
        ctx.beginPath();
        ctx.arc(centerX, y + h * 0.62, w * 0.04, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'war': {
        const tableW = w * 0.62;
        const tableH = h * 0.2;
        const tableX = centerX - tableW / 2;
        const tableY = y + h * 0.6;
        ctx.fillStyle = '#374051';
        drawRoundedRectPath(ctx, tableX, tableY, tableW, tableH, tableH * 0.25);
        ctx.fill();
        ctx.strokeStyle = '#6d8bb8';
        ctx.lineWidth = Math.max(1, w * 0.02);
        ctx.strokeRect(tableX + tableW * 0.12, tableY + tableH * 0.15, tableW * 0.76, tableH * 0.6);
        ctx.fillStyle = '#b04e3a';
        ctx.beginPath();
        ctx.arc(tableX + tableW * 0.25, tableY + tableH * 0.52, w * 0.03, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c5b567';
        ctx.beginPath();
        ctx.moveTo(tableX + tableW * 0.7, tableY + tableH * 0.3);
        ctx.lineTo(tableX + tableW * 0.8, tableY + tableH * 0.6);
        ctx.lineTo(tableX + tableW * 0.6, tableY + tableH * 0.6);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'chapel': {
        ctx.fillStyle = '#bda98a';
        drawRoundedRectPath(ctx, centerX - w * 0.14, y + h * 0.62, w * 0.28, h * 0.2, w * 0.1);
        ctx.fill();
        ctx.fillStyle = '#f1e1c2';
        ctx.fillRect(centerX - w * 0.03, y + h * 0.42, w * 0.06, h * 0.2);
        ctx.strokeStyle = '#f8e8c8';
        ctx.lineWidth = Math.max(1, w * 0.03);
        ctx.beginPath();
        ctx.moveTo(centerX, y + h * 0.38);
        ctx.lineTo(centerX, y + h * 0.55);
        ctx.moveTo(centerX - w * 0.06, y + h * 0.46);
        ctx.lineTo(centerX + w * 0.06, y + h * 0.46);
        ctx.stroke();
        ctx.fillStyle = '#7c5a3a';
        for (let i = 0; i < 2; i += 1) {
          ctx.fillRect(x + w * 0.12, y + h * (0.66 + i * 0.1), w * 0.28, h * 0.08);
          ctx.fillRect(x + w * 0.6, y + h * (0.66 + i * 0.1), w * 0.28, h * 0.08);
        }
        break;
      }
      case 'library': {
        ctx.fillStyle = '#4c3521';
        const shelfW = w * 0.18;
        const shelfH = h * 0.68;
        ctx.fillRect(x + w * 0.08, y + h * 0.18, shelfW, shelfH);
        ctx.fillRect(x + w * 0.74, y + h * 0.18, shelfW, shelfH);
        ctx.strokeStyle = '#d0a45c';
        ctx.lineWidth = Math.max(1, w * 0.02);
        for (let i = 1; i < 4; i += 1) {
          const shelfY = y + h * (0.22 + i * 0.14);
          ctx.beginPath();
          ctx.moveTo(x + w * 0.08, shelfY);
          ctx.lineTo(x + w * 0.26, shelfY);
          ctx.moveTo(x + w * 0.74, shelfY);
          ctx.lineTo(x + w * 0.92, shelfY);
          ctx.stroke();
        }
        ctx.fillStyle = '#6e4321';
        drawRoundedRectPath(ctx, centerX - w * 0.2, y + h * 0.64, w * 0.4, h * 0.16, h * 0.06);
        ctx.fill();
        ctx.fillStyle = '#d9c38b';
        ctx.fillRect(centerX - w * 0.06, y + h * 0.62, w * 0.12, h * 0.06);
        break;
      }
      case 'barracks': {
        const bunkWidth = w * 0.32;
        const bunkHeight = h * 0.16;
        for (let side = 0; side < 2; side += 1) {
          const baseX = side === 0 ? x + w * 0.12 : x + w * 0.56;
          ctx.fillStyle = '#3c464f';
          ctx.fillRect(baseX, y + h * 0.58, bunkWidth, bunkHeight);
          ctx.fillRect(baseX, y + h * 0.74, bunkWidth, bunkHeight);
          ctx.fillStyle = '#9bb4c8';
          ctx.fillRect(baseX + w * 0.02, y + h * 0.61, bunkWidth - w * 0.04, bunkHeight * 0.35);
          ctx.fillRect(baseX + w * 0.02, y + h * 0.77, bunkWidth - w * 0.04, bunkHeight * 0.35);
        }
        ctx.fillStyle = '#7b5a32';
        ctx.fillRect(centerX - w * 0.05, y + h * 0.62, w * 0.1, h * 0.25);
        break;
      }
      case 'study': {
        ctx.fillStyle = '#463421';
        ctx.fillRect(x + w * 0.18, y + h * 0.2, w * 0.64, h * 0.3);
        ctx.fillStyle = '#70472d';
        drawRoundedRectPath(ctx, centerX - w * 0.22, y + h * 0.6, w * 0.44, h * 0.2, h * 0.08);
        ctx.fill();
        ctx.fillStyle = '#cdbd8a';
        ctx.fillRect(centerX - w * 0.08, y + h * 0.62, w * 0.16, h * 0.08);
        ctx.fillStyle = '#e8d5aa';
        ctx.beginPath();
        ctx.moveTo(centerX + w * 0.05, y + h * 0.62);
        ctx.lineTo(centerX + w * 0.12, y + h * 0.48);
        ctx.lineTo(centerX + w * 0.14, y + h * 0.66);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'observatory': {
        ctx.strokeStyle = 'rgba(176, 208, 255, 0.65)';
        ctx.lineWidth = Math.max(1, w * 0.015);
        for (let i = 0; i < 3; i += 1) {
          ctx.beginPath();
          const angle = (Math.PI * (i + 2)) / 6;
          ctx.arc(centerX, y + h * 0.35, w * 0.4, angle, angle + Math.PI * 0.25);
          ctx.stroke();
        }
        ctx.fillStyle = '#526c9c';
        ctx.beginPath();
        ctx.moveTo(centerX - w * 0.24, y + h * 0.68);
        ctx.lineTo(centerX + w * 0.1, y + h * 0.58);
        ctx.lineTo(centerX + w * 0.22, y + h * 0.78);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#b4c7f5';
        ctx.beginPath();
        ctx.arc(centerX + w * 0.05, y + h * 0.64, w * 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'garden': {
        ctx.fillStyle = '#345b34';
        ctx.fillRect(x + w * 0.12, y + h * 0.7, w * 0.76, h * 0.16);
        ctx.fillStyle = '#2f6f3a';
        ctx.beginPath();
        ctx.arc(centerX, y + h * 0.55, w * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8c5e2f';
        ctx.fillRect(centerX - w * 0.03, y + h * 0.6, w * 0.06, h * 0.2);
        ctx.fillStyle = '#d1e4a5';
        ctx.beginPath();
        ctx.arc(x + w * 0.24, y + h * 0.62, w * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + w * 0.76, y + h * 0.62, w * 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'royal': {
        ctx.fillStyle = '#6d3e3b';
        drawRoundedRectPath(ctx, centerX - w * 0.28, y + h * 0.62, w * 0.56, h * 0.24, w * 0.12);
        ctx.fill();
        ctx.fillStyle = '#d7b9b0';
        ctx.fillRect(centerX - w * 0.26, y + h * 0.64, w * 0.52, h * 0.12);
        ctx.fillStyle = '#eadfc4';
        ctx.beginPath();
        ctx.moveTo(centerX - w * 0.28, y + h * 0.62);
        ctx.lineTo(centerX, y + h * 0.4);
        ctx.lineTo(centerX + w * 0.28, y + h * 0.62);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'alchemy': {
        ctx.fillStyle = '#3f3e5c';
        drawRoundedRectPath(ctx, centerX - w * 0.22, y + h * 0.62, w * 0.44, h * 0.18, h * 0.08);
        ctx.fill();
        const flaskPositions = [-0.14, 0, 0.16];
        const flaskColors = ['#6ad4f4', '#ef72b5', '#f5f1a1'];
        flaskPositions.forEach((offset, index) => {
          ctx.fillStyle = flaskColors[index];
          ctx.beginPath();
          const baseX = centerX + w * offset;
          const baseY = y + h * 0.62;
          ctx.moveTo(baseX - w * 0.03, baseY);
          ctx.lineTo(baseX + w * 0.03, baseY);
          ctx.lineTo(baseX + w * 0.02, baseY - h * 0.18);
          ctx.arc(baseX, baseY - h * 0.2, w * 0.02, 0, Math.PI * 2);
          ctx.lineTo(baseX - w * 0.02, baseY - h * 0.18);
          ctx.closePath();
          ctx.fill();
        });
        ctx.fillStyle = '#b8d0f2';
        ctx.fillRect(centerX - w * 0.12, y + h * 0.46, w * 0.24, h * 0.05);
        break;
      }
      case 'armory': {
        ctx.fillStyle = '#5a3d26';
        ctx.fillRect(x + w * 0.18, y + h * 0.6, w * 0.64, h * 0.22);
        ctx.strokeStyle = '#cfcac0';
        ctx.lineWidth = Math.max(1, w * 0.025);
        for (let i = 0; i < 3; i += 1) {
          const px = x + w * (0.26 + i * 0.18);
          ctx.beginPath();
          ctx.moveTo(px, y + h * 0.3);
          ctx.lineTo(px, y + h * 0.6);
          ctx.stroke();
          ctx.fillStyle = '#bbb7aa';
          ctx.beginPath();
          ctx.moveTo(px - w * 0.05, y + h * 0.45);
          ctx.lineTo(px + w * 0.05, y + h * 0.45);
          ctx.lineTo(px, y + h * 0.34);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#5a3d26';
        }
        break;
      }
      case 'stable': {
        ctx.fillStyle = '#8b6529';
        ctx.fillRect(x + w * 0.12, y + h * 0.68, w * 0.76, h * 0.18);
        ctx.fillStyle = '#d8bb66';
        ctx.fillRect(x + w * 0.16, y + h * 0.64, w * 0.28, h * 0.1);
        ctx.fillRect(x + w * 0.56, y + h * 0.64, w * 0.28, h * 0.1);
        ctx.fillStyle = '#c4983b';
        ctx.beginPath();
        ctx.arc(centerX, y + h * 0.58, w * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3d2a16';
        ctx.fillRect(centerX - w * 0.02, y + h * 0.6, w * 0.04, h * 0.26);
        break;
      }
      case 'storage': {
        ctx.fillStyle = '#7c5130';
        ctx.fillRect(x + w * 0.18, y + h * 0.66, w * 0.28, h * 0.22);
        ctx.fillRect(x + w * 0.56, y + h * 0.66, w * 0.24, h * 0.22);
        ctx.fillStyle = '#b9864e';
        ctx.beginPath();
        ctx.arc(centerX, y + h * 0.62, w * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#311f12';
        ctx.lineWidth = Math.max(1, w * 0.02);
        ctx.strokeRect(x + w * 0.18, y + h * 0.66, w * 0.28, h * 0.22);
        ctx.strokeRect(x + w * 0.56, y + h * 0.66, w * 0.24, h * 0.22);
        break;
      }
      default: {
        ctx.fillStyle = '#2a2f38';
        ctx.fillRect(x + w * 0.2, y + h * 0.6, w * 0.6, h * 0.2);
        break;
      }
    }

    ctx.restore();
  };

  const drawWindow = (wx, wy, ww, wh, theme, options = {}) => {
    const { bars = true, radius = Math.min(ww, wh) * 0.35 } = options;
    ctx.save();
    drawRoundedRectPath(ctx, wx, wy, ww, wh, radius);
    ctx.fillStyle = theme?.ambient ?? palette.windowDark;
    ctx.fill();
    ctx.clip();
    drawRoomInterior(wx, wy, ww, wh, theme);
    const gradient = ctx.createLinearGradient(0, wy, 0, wy + wh);
    gradient.addColorStop(0, lightenColor(palette.windowGlow, 0.15));
    gradient.addColorStop(1, palette.windowDark);
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = gradient;
    ctx.fillRect(wx, wy, ww, wh);
    ctx.restore();

    ctx.save();
    ctx.lineWidth = Math.max(1.2, ww * 0.08);
    ctx.strokeStyle = 'rgba(15, 22, 33, 0.6)';
    drawRoundedRectPath(ctx, wx, wy, ww, wh, radius);
    ctx.stroke();
    if (bars) {
      ctx.lineWidth = Math.max(1, ww * 0.05);
      ctx.strokeStyle = 'rgba(246, 238, 210, 0.35)';
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy + radius * 0.35);
      ctx.lineTo(wx + ww / 2, wy + wh - radius * 0.35);
      ctx.moveTo(wx + ww * 0.12, wy + wh / 2);
      ctx.lineTo(wx + ww - ww * 0.12, wy + wh / 2);
      ctx.stroke();
    }
    ctx.restore();
  };

  const hallHeight = height * 0.62;
  const hallY = height - hallHeight;
  const towerWidth = Math.min(width * 0.18, 260);
  const towerHeight = hallHeight + height * 0.22;
  const battlementHeight = Math.max(18, height * 0.07);

  const towerGradient = ctx.createLinearGradient(0, hallY - height * 0.08, 0, height);
  towerGradient.addColorStop(0, lightenColor(palette.stoneLight, 0.12));
  towerGradient.addColorStop(1, palette.stoneShadow);

  const towerShade = ctx.createLinearGradient(0, 0, towerWidth, 0);
  towerShade.addColorStop(0, 'rgba(0, 0, 0, 0.18)');
  towerShade.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  towerShade.addColorStop(1, 'rgba(0, 0, 0, 0.18)');

  const towerPositions = [
    { x: 0, y: height - towerHeight },
    { x: width - towerWidth, y: height - towerHeight }
  ];

  towerPositions.forEach((pos, index) => {
    ctx.fillStyle = towerGradient;
    ctx.fillRect(pos.x, pos.y, towerWidth, towerHeight);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = towerShade;
    ctx.fillRect(pos.x, pos.y, towerWidth, towerHeight);
    ctx.restore();
    drawBattlements(
      ctx,
      pos.x,
      pos.y,
      towerWidth,
      battlementHeight,
      lightenColor(palette.stoneLight, 0.18),
      darkenColor(palette.stoneShadow, 0.1)
    );

    const windowWidth = towerWidth * 0.28;
    const windowHeight = towerWidth * 0.34;
    const windowX = pos.x + towerWidth * 0.36;
    let windowY = pos.y + towerHeight * 0.26;
    for (let i = 0; i < 3; i += 1) {
      const theme = towerThemes[(index * 2 + i) % towerThemes.length];
      drawWindow(windowX, windowY, windowWidth, windowHeight, theme, {
        bars: false,
        radius: windowWidth * 0.45
      });
      windowY += windowHeight * 1.3;
    }
  });

  const hallX = towerWidth * 0.9;
  const hallWidth = width - hallX * 2;
  const hallGradient = ctx.createLinearGradient(0, hallY, 0, hallY + hallHeight);
  hallGradient.addColorStop(0, lightenColor(palette.stoneLight, 0.22));
  hallGradient.addColorStop(1, palette.stoneMid);
  ctx.fillStyle = hallGradient;
  ctx.fillRect(hallX, hallY, hallWidth, hallHeight);
  drawBattlements(
    ctx,
    hallX,
    hallY,
    hallWidth,
    battlementHeight,
    lightenColor(palette.stoneLight, 0.25),
    darkenColor(palette.stoneShadow, 0.12)
  );

  const hallShade = ctx.createLinearGradient(hallX, 0, hallX + hallWidth, 0);
  hallShade.addColorStop(0, 'rgba(0, 0, 0, 0.12)');
  hallShade.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  hallShade.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = hallShade;
  ctx.fillRect(hallX, hallY, hallWidth, hallHeight);
  ctx.restore();

  const windowRows = 3;
  const windowCols = 5;
  const windowSpacingX = hallWidth / (windowCols + 1);
  const windowSpacingY = hallHeight / (windowRows + 3);
  const hallWindowWidth = windowSpacingX * 0.48;
  const hallWindowHeight = windowSpacingY * 0.9;
  for (let row = 0; row < windowRows; row += 1) {
    for (let col = 0; col < windowCols; col += 1) {
      const wx = hallX + windowSpacingX * (col + 1) - hallWindowWidth / 2;
      const wy = hallY + windowSpacingY * (row + 1.3);
      const theme = hallThemes[(row * windowCols + col) % hallThemes.length];
      drawWindow(wx, wy, hallWindowWidth, hallWindowHeight, theme);
    }
  }

  const keepWidth = hallWidth * 0.4;
  const keepHeight = hallHeight * 0.86;
  const keepX = hallX + hallWidth / 2 - keepWidth / 2;
  const keepY = hallY - keepHeight * 0.1;
  const keepGradient = ctx.createLinearGradient(0, keepY, 0, keepY + keepHeight);
  keepGradient.addColorStop(0, lightenColor(palette.stoneLight, 0.26));
  keepGradient.addColorStop(1, palette.stoneShadow);
  ctx.fillStyle = keepGradient;
  ctx.fillRect(keepX, keepY, keepWidth, keepHeight);
  drawBattlements(
    ctx,
    keepX,
    keepY,
    keepWidth,
    battlementHeight,
    lightenColor(palette.stoneLight, 0.28),
    darkenColor(palette.stoneShadow, 0.1)
  );

  const keepShade = ctx.createLinearGradient(keepX, 0, keepX + keepWidth, 0);
  keepShade.addColorStop(0, 'rgba(0, 0, 0, 0.15)');
  keepShade.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  keepShade.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = keepShade;
  ctx.fillRect(keepX, keepY, keepWidth, keepHeight);
  ctx.restore();

  const keepWindowWidth = keepWidth * 0.22;
  const keepWindowHeight = keepHeight * 0.16;
  const keepWindowX = keepX + keepWidth / 2 - keepWindowWidth / 2;
  let keepWindowY = keepY + keepHeight * 0.18;
  for (let i = 0; i < keepThemes.length; i += 1) {
    const theme = keepThemes[i % keepThemes.length];
    drawWindow(keepWindowX, keepWindowY, keepWindowWidth, keepWindowHeight, theme);
    keepWindowY += keepWindowHeight * 1.28;
  }

  const roofHeight = battlementHeight * 1.8;
  const roofGradient = ctx.createLinearGradient(0, keepY - roofHeight, 0, keepY);
  roofGradient.addColorStop(0, lightenColor(palette.roofLight, 0.2));
  roofGradient.addColorStop(1, palette.roofShadow);
  ctx.beginPath();
  ctx.moveTo(keepX - keepWidth * 0.14, keepY);
  ctx.lineTo(keepX + keepWidth / 2, keepY - roofHeight);
  ctx.lineTo(keepX + keepWidth + keepWidth * 0.14, keepY);
  ctx.closePath();
  ctx.fillStyle = roofGradient;
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 22, 22, 0.55)';
  ctx.lineWidth = Math.max(2, keepWidth * 0.02);
  ctx.stroke();

  const gateWidth = prop.detail?.gateWidth ?? hallWidth * 0.26;
  const gateHeight = hallHeight * 0.55;
  const gateX = width / 2 - gateWidth / 2;
  const gateY = hallY + hallHeight - gateHeight;

  const lowerWingHeight = hallHeight * 0.26;
  const lowerWingY = hallY + hallHeight - lowerWingHeight;
  const lowerWingGradient = ctx.createLinearGradient(0, lowerWingY, 0, lowerWingY + lowerWingHeight);
  lowerWingGradient.addColorStop(0, lightenColor(palette.stoneLight, 0.12));
  lowerWingGradient.addColorStop(1, palette.stoneShadow);
  ctx.fillStyle = lowerWingGradient;
  ctx.fillRect(hallX, lowerWingY, hallWidth, lowerWingHeight);

  const lowerWindowWidth = hallWindowWidth * 0.82;
  const lowerWindowHeight = hallWindowHeight * 0.95;
  const lowerY = lowerWingY + lowerWingHeight * 0.12;
  for (let col = 0; col < windowCols; col += 1) {
    if (col === Math.floor(windowCols / 2)) {
      continue;
    }
    const wx = hallX + windowSpacingX * (col + 1) - lowerWindowWidth / 2;
    const theme = lowerThemes[col % lowerThemes.length];
    drawWindow(wx, lowerY, lowerWindowWidth, lowerWindowHeight, theme, {
      bars: true,
      radius: lowerWindowWidth * 0.35
    });
  }

  const gateGradient = ctx.createLinearGradient(0, gateY, 0, gateY + gateHeight);
  gateGradient.addColorStop(0, '#4f3a2d');
  gateGradient.addColorStop(1, '#2c211a');
  ctx.beginPath();
  ctx.moveTo(gateX, gateY + gateHeight);
  ctx.lineTo(gateX, gateY + gateHeight * 0.35);
  ctx.quadraticCurveTo(gateX + gateWidth / 2, gateY - gateHeight * 0.22, gateX + gateWidth, gateY + gateHeight * 0.35);
  ctx.lineTo(gateX + gateWidth, gateY + gateHeight);
  ctx.closePath();
  ctx.fillStyle = gateGradient;
  ctx.fill();

  ctx.strokeStyle = 'rgba(232, 210, 180, 0.45)';
  ctx.lineWidth = Math.max(2, gateWidth * 0.05);
  ctx.beginPath();
  ctx.moveTo(gateX, gateY + gateHeight * 0.5);
  ctx.lineTo(gateX + gateWidth, gateY + gateHeight * 0.5);
  ctx.stroke();

  ctx.lineWidth = Math.max(2, gateWidth * 0.04);
  for (let i = 1; i < 4; i += 1) {
    const px = gateX + (gateWidth / 4) * i;
    ctx.beginPath();
    ctx.moveTo(px, gateY + gateHeight * 0.2);
    ctx.lineTo(px, gateY + gateHeight - gateHeight * 0.08);
    ctx.stroke();
  }

  const stepHeight = hallHeight * 0.08;
  const stepY = hallY + hallHeight - stepHeight;
  const stepGradient = ctx.createLinearGradient(0, stepY, 0, stepY + stepHeight);
  stepGradient.addColorStop(0, lightenColor(palette.stoneLight, 0.15));
  stepGradient.addColorStop(1, palette.stoneShadow);
  ctx.fillStyle = stepGradient;
  ctx.fillRect(gateX - hallWidth * 0.05, stepY, gateWidth + hallWidth * 0.1, stepHeight);

  const lowerStepHeight = stepHeight * 0.55;
  ctx.fillStyle = lightenColor(palette.stoneLight, 0.08);
  ctx.fillRect(gateX - hallWidth * 0.08, stepY + stepHeight * 0.6, gateWidth + hallWidth * 0.16, lowerStepHeight);

  const glowGradient = ctx.createRadialGradient(width / 2, gateY + gateHeight, gateWidth * 0.18, width / 2, gateY + gateHeight * 1.05, gateWidth * 1.1);
  glowGradient.addColorStop(0, 'rgba(255, 214, 160, 0.3)');
  glowGradient.addColorStop(1, 'rgba(255, 214, 160, 0)');
  ctx.fillStyle = glowGradient;
  ctx.fillRect(gateX - gateWidth, gateY + gateHeight * 0.2, gateWidth * 2, gateHeight);

  const bannerWidth = hallWidth * 0.08;
  const bannerHeight = hallHeight * 0.65;
  const bannerY = hallY + hallHeight * 0.16;
  const leftBannerX = gateX - bannerWidth - hallWidth * 0.05;
  const rightBannerX = gateX + gateWidth + hallWidth * 0.05 - bannerWidth;

  const bannerGradient = ctx.createLinearGradient(0, bannerY, 0, bannerY + bannerHeight);
  bannerGradient.addColorStop(0, lightenColor(palette.bannerPrimary, 0.2));
  bannerGradient.addColorStop(1, palette.bannerPrimary);

  const drawCrestBanner = (bx) => {
    ctx.beginPath();
    ctx.moveTo(bx, bannerY);
    ctx.lineTo(bx + bannerWidth, bannerY);
    ctx.lineTo(bx + bannerWidth, bannerY + bannerHeight * 0.72);
    ctx.lineTo(bx + bannerWidth / 2, bannerY + bannerHeight);
    ctx.lineTo(bx, bannerY + bannerHeight * 0.72);
    ctx.closePath();
    ctx.fillStyle = bannerGradient;
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, bannerWidth * 0.18);
    ctx.strokeStyle = palette.bannerSecondary;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(bx + bannerWidth / 2, bannerY + bannerHeight * 0.35, bannerWidth * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = palette.bannerAccent;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(bx + bannerWidth / 2, bannerY + bannerHeight * 0.25);
    ctx.lineTo(bx + bannerWidth / 2 + bannerWidth * 0.18, bannerY + bannerHeight * 0.45);
    ctx.lineTo(bx + bannerWidth / 2, bannerY + bannerHeight * 0.56);
    ctx.lineTo(bx + bannerWidth / 2 - bannerWidth * 0.18, bannerY + bannerHeight * 0.45);
    ctx.closePath();
    ctx.fillStyle = palette.bannerSecondary;
    ctx.fill();
  };

  drawCrestBanner(leftBannerX);
  drawCrestBanner(rightBannerX);

  ctx.restore();
};

const drawCausewayProp = (ctx, prop, cam) => {
  const x = prop.x - cam.x;
  const y = prop.y - cam.y;
  const { width, height } = prop;
  ctx.save();
  ctx.translate(x, y);

  const baseGradient = ctx.createLinearGradient(0, 0, 0, height);
  baseGradient.addColorStop(0, '#d8ccb7');
  baseGradient.addColorStop(1, '#b6a891');
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(70, 60, 50, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, height);

  const tileHeight = Math.max(18, height / 12);
  const tileWidth = Math.max(18, width / 5);
  ctx.strokeStyle = 'rgba(70, 60, 50, 0.25)';
  ctx.lineWidth = 1;
  for (let ty = tileHeight; ty < height; ty += tileHeight) {
    ctx.beginPath();
    ctx.moveTo(0, ty);
    ctx.lineTo(width, ty);
    ctx.stroke();
  }
  for (let tx = tileWidth; tx < width; tx += tileWidth) {
    ctx.beginPath();
    ctx.moveTo(tx, 0);
    ctx.lineTo(tx, height);
    ctx.stroke();
  }

  const centerGlow = ctx.createRadialGradient(width / 2, height * 0.3, Math.min(width, height) * 0.15, width / 2, height * 0.7, Math.max(width, height));
  centerGlow.addColorStop(0, 'rgba(255, 232, 180, 0.3)');
  centerGlow.addColorStop(1, 'rgba(255, 232, 180, 0)');
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
};

const drawBannerProp = (ctx, prop, cam) => {
  const x = prop.x - cam.x;
  const y = prop.y - cam.y;
  const { width, height } = prop;
  const primary = prop.primaryColor || propFallbackColors.banner;
  const secondary = prop.secondaryColor || '#f5d16a';
  const accent = prop.accentColor || '#fef2c6';

  ctx.save();
  ctx.translate(x, y);

  const poleWidth = Math.max(4, width * 0.12);
  ctx.fillStyle = '#2f2a24';
  ctx.fillRect(width * 0.45, 0, poleWidth, height);
  ctx.fillRect(width * 0.1, height * 0.14, width * 0.35, poleWidth * 0.6);

  const clothWidth = width * 0.78;
  const clothHeight = height * 0.76;
  const clothX = width * 0.05;
  const clothY = height * 0.18;
  const clothGradient = ctx.createLinearGradient(0, clothY, 0, clothY + clothHeight);
  clothGradient.addColorStop(0, lightenColor(primary, 0.2));
  clothGradient.addColorStop(1, primary);

  ctx.beginPath();
  ctx.moveTo(clothX, clothY);
  ctx.lineTo(clothX + clothWidth, clothY);
  ctx.lineTo(clothX + clothWidth, clothY + clothHeight * 0.72);
  ctx.lineTo(clothX + clothWidth * 0.5, clothY + clothHeight);
  ctx.lineTo(clothX, clothY + clothHeight * 0.72);
  ctx.closePath();
  ctx.fillStyle = clothGradient;
  ctx.fill();
  ctx.lineWidth = Math.max(2, width * 0.05);
  ctx.strokeStyle = secondary;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(clothX + clothWidth / 2, clothY + clothHeight * 0.38, clothWidth * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(clothX + clothWidth / 2, clothY + clothHeight * 0.24);
  ctx.lineTo(clothX + clothWidth / 2 + clothWidth * 0.16, clothY + clothHeight * 0.48);
  ctx.lineTo(clothX + clothWidth / 2, clothY + clothHeight * 0.6);
  ctx.lineTo(clothX + clothWidth / 2 - clothWidth * 0.16, clothY + clothHeight * 0.48);
  ctx.closePath();
  ctx.fillStyle = secondary;
  ctx.fill();

  ctx.restore();
};

const drawBrazierProp = (ctx, prop, cam) => {
  const x = prop.x - cam.x;
  const y = prop.y - cam.y;
  const { width, height } = prop;
  ctx.save();
  ctx.translate(x, y);

  const baseHeight = height * 0.35;
  const bowlHeight = height * 0.3;
  const flameHeight = height - baseHeight - bowlHeight;

  const pedestalGradient = ctx.createLinearGradient(0, height - baseHeight, 0, height);
  pedestalGradient.addColorStop(0, '#5b4a3d');
  pedestalGradient.addColorStop(1, '#2f2620');
  ctx.fillStyle = pedestalGradient;
  ctx.beginPath();
  ctx.moveTo(width * 0.32, height);
  ctx.lineTo(width * 0.68, height);
  ctx.lineTo(width * 0.56, height - baseHeight);
  ctx.lineTo(width * 0.44, height - baseHeight);
  ctx.closePath();
  ctx.fill();

  const bowlY = height - baseHeight - bowlHeight * 0.7;
  const bowlGradient = ctx.createLinearGradient(0, bowlY, 0, bowlY + bowlHeight);
  bowlGradient.addColorStop(0, '#6b5b4f');
  bowlGradient.addColorStop(1, '#3a3028');
  ctx.fillStyle = bowlGradient;
  drawRoundedRectPath(ctx, width * 0.2, bowlY, width * 0.6, bowlHeight, bowlHeight * 0.35);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(width / 2, bowlY + bowlHeight * 0.2, width * 0.42, bowlHeight * 0.28, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#2f2721';
  ctx.fill();

  const flameGradient = ctx.createRadialGradient(width / 2, bowlY, width * 0.12, width / 2, bowlY - flameHeight, Math.max(width, flameHeight) * 0.9);
  flameGradient.addColorStop(0, 'rgba(255, 243, 209, 0.95)');
  flameGradient.addColorStop(0.45, 'rgba(255, 187, 92, 0.9)');
  flameGradient.addColorStop(1, 'rgba(255, 110, 0, 0)');
  ctx.fillStyle = flameGradient;
  ctx.beginPath();
  ctx.moveTo(width / 2, bowlY - flameHeight);
  ctx.bezierCurveTo(width * 0.1, bowlY + flameHeight * 0.2, width * 0.22, bowlY + flameHeight * 0.7, width / 2, bowlY + flameHeight * 0.5);
  ctx.bezierCurveTo(width * 0.78, bowlY + flameHeight * 0.7, width * 0.9, bowlY + flameHeight * 0.2, width / 2, bowlY - flameHeight);
  ctx.closePath();
  ctx.fill();

  const glowGradient = ctx.createRadialGradient(width / 2, height, width * 0.3, width / 2, height, Math.max(width, height) * 1.2);
  glowGradient.addColorStop(0, 'rgba(255, 182, 64, 0.35)');
  glowGradient.addColorStop(1, 'rgba(255, 182, 64, 0)');
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.ellipse(width / 2, height, width * 1.2, height * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

const customPropRenderers = {
  castle: drawCastleProp,
  causeway: drawCausewayProp,
  banner: drawBannerProp,
  brazier: drawBrazierProp
};

const drawGenericProp = (ctx, prop, cam) => {
  const screenX = prop.x - cam.x;
  const screenY = prop.y - cam.y;
  const { width, height } = prop;
  ctx.save();
  ctx.translate(screenX, screenY);

  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(width / 2, height + height * 0.12, width * 0.45, height * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const baseColor = prop.color || 'rgba(200, 210, 220, 0.85)';
  const radius = Math.min(width, height) * 0.14;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, lightenColor(baseColor, 0.22));
  gradient.addColorStop(0.5, baseColor);
  gradient.addColorStop(1, darkenColor(baseColor, 0.28));
  ctx.fillStyle = gradient;
  drawRoundedRectPath(ctx, 0, 0, width, height, radius);
  ctx.fill();

  ctx.strokeStyle = 'rgba(8, 12, 16, 0.4)';
  ctx.lineWidth = Math.max(1, radius * 0.4);
  drawRoundedRectPath(ctx, 0, 0, width, height, radius);
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  drawRoundedRectPath(ctx, width * 0.08, height * 0.1, width * 0.5, height * 0.22, radius * 0.6);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  drawRoundedRectPath(ctx, width * 0.08, height * 0.65, width * 0.84, height * 0.28, radius * 0.5);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = lightenColor(baseColor, 0.3);
  ctx.lineWidth = Math.max(1, height * 0.04);
  ctx.beginPath();
  ctx.moveTo(width * 0.12, height * 0.32);
  ctx.lineTo(width * 0.88, height * 0.24);
  ctx.stroke();

  ctx.restore();
};

const parallaxLayers = [
  {
    name: 'sky',
    factor: 0.08,
    draw(ctx, scrollX, scrollY, cam, theme) {
      const { sky } = theme;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.85;
      const gradient = ctx.createLinearGradient(0, 0, 0, cam.height);
      gradient.addColorStop(0, sky.top);
      gradient.addColorStop(0.45, sky.mid);
      gradient.addColorStop(1, sky.bottom);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, cam.width, cam.height);
      ctx.restore();
    }
  },
  {
    name: 'sun',
    factor: 0.12,
    draw(ctx, scrollX, scrollY, cam, theme) {
      const { sky } = theme;
      const cycle = ((scrollX / (cam.width * 4)) % 1 + 1) % 1;
      const sunX = cam.width * (0.82 - cycle * 0.64);
      const sunY = cam.height * (0.22 + Math.sin(cycle * Math.PI * 2) * 0.06) + scrollY * 0.04;
      ctx.save();
      const glowRadius = Math.max(cam.width, cam.height) * 0.55;
      const radial = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, glowRadius);
      radial.addColorStop(0, sky.sun || '#f8e6b5');
      radial.addColorStop(0.28, sky.glow || 'rgba(255, 216, 164, 0.55)');
      radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, cam.width, cam.height);
      ctx.restore();
    }
  },
  {
    name: 'clouds',
    factor: 0.18,
    draw(ctx, scrollX, scrollY, cam, theme) {
      const { sky } = theme;
      const cloudColor = lightenColor(sky.bottom, 0.18);
      const shadowColor = darkenColor(sky.mid, 0.12);
      ctx.save();
      ctx.globalAlpha = 0.65;
      const baseY = cam.height * (0.18 + Math.sin(scrollY * 0.0004) * 0.04);
      const width = 220;
      const offset = -((scrollX * 0.4) % (width * 2)) - width * 2;
      for (let x = offset; x < cam.width + width * 2; x += width) {
        const cloudHeight = 50 + ((x / width) % 3) * 12;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.bezierCurveTo(x + width * 0.2, baseY - cloudHeight, x + width * 0.6, baseY - cloudHeight * 0.6, x + width, baseY);
        ctx.bezierCurveTo(x + width * 0.6, baseY + cloudHeight * 0.6, x + width * 0.2, baseY + cloudHeight * 0.25, x, baseY);
        ctx.closePath();
        const gradient = ctx.createLinearGradient(x, baseY - cloudHeight, x, baseY + cloudHeight);
        gradient.addColorStop(0, lightenColor(cloudColor, 0.1));
        gradient.addColorStop(1, shadowColor);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
      ctx.restore();
    }
  },
  {
    name: 'mountains',
    factor: 0.32,
    draw(ctx, scrollX, scrollY, cam, theme) {
      const { sky } = theme;
      const baseY = cam.height * 0.7 + scrollY * 0.08;
      const peakHeight = 160;
      const width = 300;
      const startX = -((scrollX) % width) - width;
      ctx.save();
      ctx.globalAlpha = 0.7;
      for (let x = startX; x < cam.width + width; x += width) {
        const gradient = ctx.createLinearGradient(0, baseY - peakHeight, 0, baseY + peakHeight * 0.2);
        gradient.addColorStop(0, lightenColor(sky.mid, 0.05));
        gradient.addColorStop(1, darkenColor(sky.mid, 0.25));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.lineTo(x + width * 0.5, baseY - peakHeight);
        ctx.lineTo(x + width, baseY);
        ctx.lineTo(x + width * 0.82, baseY + peakHeight * 0.2);
        ctx.lineTo(x + width * 0.18, baseY + peakHeight * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + width * 0.5, baseY - peakHeight);
        ctx.lineTo(x + width * 0.6, baseY - peakHeight * 0.45);
        ctx.stroke();
      }
      ctx.restore();
    }
  },
  {
    name: 'distant-forest',
    factor: 0.48,
    draw(ctx, scrollX, scrollY, cam, theme) {
      const { ground } = theme;
      const baseY = cam.height * 0.88 + scrollY * 0.06;
      const width = 120;
      const startX = -((scrollX) % width) - width;
      ctx.save();
      ctx.globalAlpha = 0.75;
      for (let x = startX; x < cam.width + width; x += width) {
        const treeHeight = 120 + (x % 3) * 18;
        const trunkGradient = ctx.createLinearGradient(0, baseY - treeHeight, 0, baseY);
        trunkGradient.addColorStop(0, lightenColor(ground.detail, 0.3));
        trunkGradient.addColorStop(1, darkenColor(ground.detail, 0.2));
        ctx.fillStyle = trunkGradient;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.lineTo(x + width * 0.5, baseY - treeHeight);
        ctx.lineTo(x + width, baseY);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = darkenColor(ground.secondaryDetail, 0.2);
        ctx.fillRect(x + width * 0.45, baseY - treeHeight * 0.25, width * 0.1, treeHeight * 0.25);
      }
      ctx.restore();
    }
  },
  {
    name: 'ground-mist',
    factor: 0.52,
    draw(ctx, scrollX, scrollY, cam, theme) {
      const { fog } = theme;
      ctx.save();
      const mist = ctx.createLinearGradient(0, cam.height * 0.4, 0, cam.height);
      mist.addColorStop(0, 'rgba(0, 0, 0, 0)');
      mist.addColorStop(1, fog?.color ?? 'rgba(160, 190, 190, 0.28)');
      ctx.globalAlpha = 0.6;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = mist;
      ctx.fillRect(0, 0, cam.width, cam.height);
      ctx.restore();
    }
  }
];

const drawParallax = (ctx, cam, theme) => {
  parallaxLayers.forEach((layer) => {
    const scrollX = cam.x * layer.factor;
    const scrollY = cam.y * layer.factor;
    layer.draw(ctx, scrollX, scrollY, cam, theme);
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
    variant: def.variant ?? null,
    primaryColor: def.primaryColor ?? null,
    secondaryColor: def.secondaryColor ?? null,
    accentColor: def.accentColor ?? null,
    detail: def.detail ? { ...def.detail } : null,
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

const drawWallObstacle = (ctx, obstacle, cam) => {
  const x = obstacle.x - cam.x;
  const y = obstacle.y - cam.y;
  const { width, height } = obstacle;
  const baseColor = obstacleStyles.wall || '#8d7a5b';
  ctx.save();
  ctx.translate(x, y);

  const radius = Math.min(width, height) * 0.08;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, lightenColor(baseColor, 0.32));
  gradient.addColorStop(0.5, baseColor);
  gradient.addColorStop(1, darkenColor(baseColor, 0.3));
  ctx.fillStyle = gradient;
  drawRoundedRectPath(ctx, 0, 0, width, height, radius);
  ctx.fill();

  ctx.fillStyle = lightenColor(baseColor, 0.45);
  ctx.fillRect(0, 0, width, Math.max(3, height * 0.12));
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(0, height - Math.max(4, height * 0.15), width, Math.max(4, height * 0.15));

  const brickHeight = Math.max(12, height / 6);
  const brickWidth = Math.max(30, width / 5);
  ctx.strokeStyle = 'rgba(30, 22, 16, 0.25)';
  ctx.lineWidth = 1.2;
  for (let by = brickHeight; by < height; by += brickHeight) {
    ctx.beginPath();
    ctx.moveTo(radius, by);
    ctx.lineTo(width - radius, by);
    ctx.stroke();
  }
  for (let row = 0; row < height; row += brickHeight) {
    const offset = (row / brickHeight) % 2 === 0 ? 0 : brickWidth / 2;
    for (let bx = offset; bx < width; bx += brickWidth) {
      ctx.beginPath();
      ctx.moveTo(bx, row);
      ctx.lineTo(bx, Math.min(height, row + brickHeight));
      ctx.stroke();
    }
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(radius * 0.5, height * 0.35);
  ctx.lineTo(width * 0.25, height * 0.18);
  ctx.moveTo(width * 0.65, height * 0.22);
  ctx.lineTo(width - radius * 0.5, height * 0.4);
  ctx.stroke();

  ctx.restore();
};

const drawRockObstacle = (ctx, obstacle, cam) => {
  const x = obstacle.x - cam.x;
  const y = obstacle.y - cam.y;
  const { width, height } = obstacle;
  const baseColor = obstacleStyles.rock || '#4f535d';
  ctx.save();
  ctx.translate(x, y);

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.ellipse(width * 0.5, height, width * 0.55, height * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, lightenColor(baseColor, 0.35));
  gradient.addColorStop(0.5, baseColor);
  gradient.addColorStop(1, darkenColor(baseColor, 0.35));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(width * 0.1, height * 0.85);
  ctx.lineTo(width * 0.22, height * 0.25);
  ctx.lineTo(width * 0.52, height * 0.05);
  ctx.lineTo(width * 0.9, height * 0.3);
  ctx.lineTo(width * 0.78, height * 0.88);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i += 1) {
    const t = (i + 1) / 4;
    ctx.beginPath();
    ctx.moveTo(width * (0.2 + t * 0.5), height * (0.2 + t * 0.3));
    ctx.lineTo(width * (0.15 + t * 0.6), height * (0.6 + t * 0.2));
    ctx.stroke();
  }

  ctx.restore();
};

const drawTreeObstacle = (ctx, obstacle, cam) => {
  const x = obstacle.x - cam.x;
  const y = obstacle.y - cam.y;
  const { width, height } = obstacle;
  const canopyColor = obstacleStyles.tree || '#2f5d31';
  ctx.save();
  ctx.translate(x, y);

  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(width / 2, height * 0.88, width * 0.48, height * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#5c3b21';
  const trunkWidth = Math.max(6, width * 0.18);
  ctx.fillRect(width / 2 - trunkWidth / 2, height * 0.5, trunkWidth, height * 0.45);

  const radial = ctx.createRadialGradient(width / 2, height * 0.35, width * 0.2, width / 2, height * 0.35, width * 0.6);
  radial.addColorStop(0, lightenColor(canopyColor, 0.38));
  radial.addColorStop(0.6, canopyColor);
  radial.addColorStop(1, darkenColor(canopyColor, 0.4));
  ctx.fillStyle = radial;
  ctx.beginPath();
  ctx.ellipse(width / 2, height * 0.38, width * 0.55, height * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(width / 2, height * 0.35, width * 0.28, 0.4, Math.PI);
  ctx.stroke();

  ctx.fillStyle = lightenColor(canopyColor, 0.5);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const leafX = width / 2 + Math.cos(angle) * width * 0.22;
    const leafY = height * 0.38 + Math.sin(angle) * height * 0.2;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(leafX, leafY, width * 0.16, height * 0.12, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore();
};

const drawStumpObstacle = (ctx, obstacle, cam) => {
  const x = obstacle.x - cam.x;
  const y = obstacle.y - cam.y;
  const { width, height } = obstacle;
  const baseColor = obstacleStyles.stump || '#6b4b2b';
  ctx.save();
  ctx.translate(x, y);

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(width / 2, height * 0.95, width * 0.45, height * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, lightenColor(baseColor, 0.25));
  gradient.addColorStop(1, darkenColor(baseColor, 0.3));
  ctx.fillStyle = gradient;
  drawRoundedRectPath(ctx, 0, height * 0.3, width, height * 0.7, Math.min(width, height) * 0.2);
  ctx.fill();

  const topGradient = ctx.createRadialGradient(width / 2, height * 0.3, width * 0.1, width / 2, height * 0.3, width * 0.4);
  topGradient.addColorStop(0, lightenColor(baseColor, 0.4));
  topGradient.addColorStop(1, darkenColor(baseColor, 0.25));
  ctx.fillStyle = topGradient;
  ctx.beginPath();
  ctx.ellipse(width / 2, height * 0.3, width * 0.45, height * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(92, 58, 28, 0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(width / 2, height * 0.3, width * 0.36, height * 0.18, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(width / 2, height * 0.3, width * 0.22, height * 0.1, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
};

const drawWaterObstacle = (ctx, obstacle, cam) => {
  const x = obstacle.x - cam.x;
  const y = obstacle.y - cam.y;
  const { width, height } = obstacle;
  const baseColor = obstacleStyles.water || '#2a4f66';
  ctx.save();
  ctx.translate(x, y);

  const radius = Math.min(width, height) * 0.12;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, lightenColor(baseColor, 0.3));
  gradient.addColorStop(0.5, baseColor);
  gradient.addColorStop(1, darkenColor(baseColor, 0.4));
  ctx.fillStyle = gradient;
  drawRoundedRectPath(ctx, 0, 0, width, height, radius);
  ctx.fill();

  ctx.strokeStyle = 'rgba(18, 30, 42, 0.4)';
  ctx.lineWidth = Math.max(2, radius * 0.35);
  drawRoundedRectPath(ctx, 0, 0, width, height, radius);
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = lightenColor(baseColor, 0.5);
  ctx.lineWidth = 1.8;
  const waveSpacing = Math.max(12, height / 8);
  for (let waveY = waveSpacing * 0.5; waveY < height; waveY += waveSpacing) {
    ctx.beginPath();
    ctx.moveTo(radius, waveY);
    ctx.bezierCurveTo(width * 0.35, waveY - waveSpacing * 0.35, width * 0.65, waveY + waveSpacing * 0.35, width - radius, waveY);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  for (let i = 0; i < 4; i += 1) {
    const t = i / 4;
    ctx.beginPath();
    ctx.ellipse(width * (0.2 + t * 0.6), height * (0.2 + Math.sin((t + 1) * 3) * 0.05), width * 0.08, height * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
};

const drawDefaultObstacle = (ctx, obstacle, cam) => {
  const screenX = obstacle.x - cam.x;
  const screenY = obstacle.y - cam.y;
  const { width, height } = obstacle;
  const baseColor = obstacleStyles[obstacle.type] || '#6b6b6b';
  const gradient = ctx.createLinearGradient(0, screenY, 0, screenY + height);
  gradient.addColorStop(0, lightenColor(baseColor, 0.2));
  gradient.addColorStop(1, darkenColor(baseColor, 0.25));
  ctx.fillStyle = gradient;
  ctx.fillRect(screenX, screenY, width, height);
  ctx.strokeStyle = 'rgba(12, 18, 22, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(screenX, screenY, width, height);
};

const obstacleRenderers = {
  wall: drawWallObstacle,
  rock: drawRockObstacle,
  tree: drawTreeObstacle,
  stump: drawStumpObstacle,
  water: drawWaterObstacle
};

const drawObstacle = (ctx, obstacle, cam) => {
  const renderer = obstacleRenderers[obstacle.type];
  if (renderer) {
    renderer(ctx, obstacle, cam);
    return;
  }
  drawDefaultObstacle(ctx, obstacle, cam);
};

const drawProp = (ctx, prop, cam) => {
  const renderer = customPropRenderers[prop.type];
  if (renderer) {
    renderer(ctx, prop, cam);
    return;
  }
  const screenX = prop.x - cam.x;
  const screenY = prop.y - cam.y;
  if (prop.sprite && prop.spriteReady) {
    ctx.drawImage(prop.sprite, screenX, screenY, prop.width, prop.height);
  } else {
    drawGenericProp(ctx, prop, cam);
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
  lordBritishCastle: {
    name: 'Castle Britannia Grand Courtyard',
    terrain: 'Castle Grounds',
    bounds: { width: 5200, height: 3200 },
    spawn: { x: 1640, y: 2320 },
    obstacles: [
      { x: 420, y: 280, w: 180, h: 1560, type: 'wall' },
      { x: 2660, y: 280, w: 180, h: 1560, type: 'wall' },
      { x: 600, y: 240, w: 820, h: 160, type: 'wall' },
      { x: 1820, y: 240, w: 820, h: 160, type: 'wall' },
      { x: 1080, y: 120, w: 1240, h: 140, type: 'wall' },
      { x: 620, y: 480, w: 320, h: 260, type: 'rock' },
      { x: 2140, y: 480, w: 320, h: 260, type: 'rock' },
      { x: 760, y: 640, w: 620, h: 720, type: 'wall' },
      { x: 1380, y: 560, w: 720, h: 560, type: 'wall' },
      { x: 2080, y: 640, w: 620, h: 720, type: 'wall' },
      { x: 1100, y: 1080, w: 960, h: 160, type: 'wall' },
      { x: 1100, y: 1320, w: 440, h: 140, type: 'wall' },
      { x: 1620, y: 1320, w: 440, h: 140, type: 'wall' },
      { x: 760, y: 1380, w: 620, h: 180, type: 'wall' },
      { x: 2080, y: 1380, w: 620, h: 180, type: 'wall' },
      { x: 1100, y: 1540, w: 460, h: 140, type: 'wall' },
      { x: 1680, y: 1540, w: 460, h: 140, type: 'wall' }
    ],
    props: [
      {
        x: 520,
        y: 320,
        w: 2240,
        h: 1180,
        type: 'castle',
        primaryColor: '#2d4f8f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0',
        detail: { gateWidth: 520 }
      },
      { x: 1380, y: 1500, w: 520, h: 780, type: 'causeway' },
      {
        x: 1080,
        y: 1540,
        w: 120,
        h: 360,
        type: 'banner',
        primaryColor: '#2d4f8f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0'
      },
      {
        x: 1960,
        y: 1540,
        w: 120,
        h: 360,
        type: 'banner',
        primaryColor: '#8d2f2f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0'
      },
      {
        x: 740,
        y: 700,
        w: 110,
        h: 320,
        type: 'banner',
        primaryColor: '#2d4f8f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0'
      },
      {
        x: 2240,
        y: 700,
        w: 110,
        h: 320,
        type: 'banner',
        primaryColor: '#8d2f2f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0'
      },
      {
        x: 1240,
        y: 980,
        w: 110,
        h: 320,
        type: 'banner',
        primaryColor: '#2d4f8f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0'
      },
      {
        x: 1860,
        y: 980,
        w: 110,
        h: 320,
        type: 'banner',
        primaryColor: '#8d2f2f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0'
      },
      { x: 1300, y: 1820, w: 110, h: 180, type: 'brazier' },
      { x: 1820, y: 1820, w: 110, h: 180, type: 'brazier' },
      { x: 1500, y: 1620, w: 110, h: 180, type: 'brazier' },
      { x: 1480, y: 2040, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 1620, y: 2040, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 1480, y: 2220, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 1620, y: 2220, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 240, y: 760, w: 180, h: 240, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 420, y: 940, w: 180, h: 240, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 320, y: 1180, w: 180, h: 240, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 520, y: 1360, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 260, y: 1560, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 420, y: 1740, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 360, y: 1420, w: 60, h: 60, type: 'lantern', color: '#f3d16f' },
      { x: 520, y: 1600, w: 60, h: 60, type: 'lantern', color: '#f3d16f' },
      { x: 320, y: 1280, w: 100, h: 80, type: 'crate', color: '#c58f49' },
      { x: 120, y: 900, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 140, y: 1320, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 2840, y: 780, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 3040, y: 860, w: 100, h: 100, type: 'crate', color: '#c58f49' },
      { x: 3280, y: 920, w: 120, h: 120, type: 'crate', color: '#c58f49' },
      { x: 3400, y: 1100, w: 110, h: 140, type: 'tent', spriteURL: '/assets/tent.png' },
      {
        x: 2980,
        y: 1200,
        w: 110,
        h: 320,
        type: 'banner',
        primaryColor: '#2d4f8f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0'
      },
      {
        x: 3500,
        y: 1200,
        w: 110,
        h: 320,
        type: 'banner',
        primaryColor: '#8d2f2f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0'
      },
      { x: 3100, y: 1400, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 3340, y: 1400, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 1180, y: 260, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 1760, y: 260, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 1420, y: 220, w: 100, h: 140, type: 'brazier' },
      { x: 900, y: 1700, w: 180, h: 240, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 2340, y: 1700, w: 180, h: 240, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 2600, y: 1980, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 2200, y: 2100, w: 90, h: 90, type: 'crate', color: '#c68c45' },
      { x: 1080, y: 2120, w: 90, h: 90, type: 'crate', color: '#c68c45' },
      { x: 1200, y: 2440, w: 110, h: 140, type: 'tent', spriteURL: '/assets/tent.png' },
      { x: 2080, y: 2440, w: 110, h: 140, type: 'tent', spriteURL: '/assets/tent.png' },
      { x: 1520, y: 2480, w: 90, h: 90, type: 'crate', color: '#c68c45' },
      { x: 1760, y: 2480, w: 90, h: 90, type: 'crate', color: '#c68c45' },
      { x: 1640, y: 2680, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 1500, y: 2840, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 1780, y: 2840, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 1640, y: 3000, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 1360, y: 2920, w: 90, h: 90, type: 'crate', color: '#c68c45' },
      { x: 1920, y: 2920, w: 90, h: 90, type: 'crate', color: '#c68c45' },
      { x: 3780, y: 840, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 3940, y: 1100, w: 110, h: 140, type: 'tent', spriteURL: '/assets/tent.png' },
      { x: 4140, y: 1220, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 80, y: 1440, w: 90, h: 90, type: 'crate', color: '#c68c45' }
    ]
  },
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
  },
  whisperingForest: {
    name: 'Whispering Forest Glade',
    terrain: 'Whispering Forest',
    bounds: { width: 4200, height: 2600 },
    spawn: { x: 720, y: 640 },
    obstacles: [
      { x: 240, y: 320, w: 380, h: 240, type: 'tree' },
      { x: 760, y: 260, w: 320, h: 260, type: 'tree' },
      { x: 1180, y: 300, w: 300, h: 240, type: 'tree' },
      { x: 540, y: 800, w: 320, h: 240, type: 'tree' },
      { x: 980, y: 780, w: 320, h: 240, type: 'tree' },
      { x: 1440, y: 760, w: 320, h: 260, type: 'tree' },
      { x: 1880, y: 820, w: 320, h: 240, type: 'tree' },
      { x: 320, y: 1200, w: 320, h: 260, type: 'tree' },
      { x: 780, y: 1180, w: 320, h: 260, type: 'tree' },
      { x: 1240, y: 1180, w: 320, h: 260, type: 'tree' },
      { x: 1700, y: 1160, w: 320, h: 260, type: 'tree' },
      { x: 2140, y: 1120, w: 320, h: 260, type: 'tree' },
      { x: 2580, y: 1100, w: 320, h: 260, type: 'tree' },
      { x: 3020, y: 1080, w: 320, h: 260, type: 'tree' },
      { x: 3460, y: 1100, w: 320, h: 260, type: 'tree' },
      { x: 560, y: 1580, w: 320, h: 260, type: 'tree' },
      { x: 1020, y: 1560, w: 320, h: 260, type: 'tree' },
      { x: 1480, y: 1540, w: 320, h: 260, type: 'tree' },
      { x: 1940, y: 1520, w: 320, h: 260, type: 'tree' },
      { x: 2380, y: 1500, w: 320, h: 260, type: 'tree' },
      { x: 2820, y: 1480, w: 320, h: 260, type: 'tree' },
      { x: 3260, y: 1460, w: 320, h: 260, type: 'tree' },
      { x: 3700, y: 1440, w: 320, h: 260, type: 'tree' },
      { x: 600, y: 1960, w: 320, h: 260, type: 'tree' },
      { x: 1040, y: 1940, w: 320, h: 260, type: 'tree' },
      { x: 1480, y: 1920, w: 320, h: 260, type: 'tree' },
      { x: 1920, y: 1900, w: 320, h: 260, type: 'tree' },
      { x: 2360, y: 1880, w: 320, h: 260, type: 'tree' },
      { x: 2800, y: 1860, w: 320, h: 260, type: 'tree' },
      { x: 3240, y: 1840, w: 320, h: 260, type: 'tree' },
      { x: 3680, y: 1820, w: 320, h: 260, type: 'tree' }
    ],
    props: [
      { x: 440, y: 560, w: 180, h: 240, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 720, y: 560, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 980, y: 540, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 1220, y: 560, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 900, y: 840, w: 60, h: 60, type: 'lantern', color: '#f3d16f' },
      { x: 1040, y: 840, w: 60, h: 60, type: 'lantern', color: '#f3d16f' },
      { x: 980, y: 940, w: 110, h: 140, type: 'tent', spriteURL: '/assets/tent.png' },
      { x: 1160, y: 940, w: 90, h: 90, type: 'crate', color: '#c68c45' },
      { x: 680, y: 1040, w: 60, h: 60, type: 'lantern', color: '#f3d16f' },
      { x: 820, y: 1200, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 1140, y: 1240, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 1460, y: 1260, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 1760, y: 1320, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 2080, y: 1360, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 2380, y: 1260, w: 90, h: 90, type: 'crate', color: '#c68c45' },
      { x: 2460, y: 1320, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 2760, y: 1240, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 3080, y: 1300, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 3260, y: 1400, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 3400, y: 1220, w: 110, h: 140, type: 'tent', spriteURL: '/assets/tent.png' },
      { x: 3000, y: 1620, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 2640, y: 1600, w: 110, h: 140, type: 'tent', spriteURL: '/assets/tent.png' },
      { x: 2360, y: 1680, w: 110, h: 140, type: 'tent', spriteURL: '/assets/tent.png' },
      { x: 2120, y: 1700, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 1860, y: 1760, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 1540, y: 1760, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 1220, y: 1760, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 900, y: 1760, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 600, y: 1760, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 460, y: 2000, w: 60, h: 60, type: 'lantern', color: '#f3d16f' },
      { x: 720, y: 2080, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 980, y: 2100, w: 90, h: 90, type: 'crate', color: '#c68c45' },
      { x: 1200, y: 2120, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 1520, y: 2140, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 1780, y: 2120, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 2100, y: 2100, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 2420, y: 2120, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 2700, y: 2140, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 2940, y: 2100, w: 110, h: 140, type: 'tent', spriteURL: '/assets/tent.png' },
      { x: 3180, y: 2080, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 3440, y: 2060, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 3660, y: 2040, w: 60, h: 60, type: 'lantern', color: '#f6c35f' }
    ]
  },
  drownedCoast: {
    name: 'Stormlit Drowned Coast',
    terrain: 'Drowned Coast',
    bounds: { width: 4600, height: 2600 },
    spawn: { x: 380, y: 560 },
    obstacles: [
      { x: 200, y: 260, w: 520, h: 240, type: 'water' },
      { x: 900, y: 220, w: 520, h: 260, type: 'water' },
      { x: 1620, y: 280, w: 460, h: 220, type: 'water' },
      { x: 2140, y: 240, w: 520, h: 260, type: 'water' },
      { x: 2820, y: 260, w: 520, h: 240, type: 'water' },
      { x: 3440, y: 300, w: 520, h: 240, type: 'water' },
      { x: 520, y: 760, w: 520, h: 260, type: 'water' },
      { x: 1220, y: 720, w: 520, h: 260, type: 'water' },
      { x: 1920, y: 720, w: 520, h: 260, type: 'water' },
      { x: 2620, y: 720, w: 520, h: 260, type: 'water' },
      { x: 3320, y: 720, w: 520, h: 260, type: 'water' },
      { x: 4020, y: 760, w: 520, h: 260, type: 'water' },
      { x: 280, y: 1180, w: 520, h: 260, type: 'water' },
      { x: 980, y: 1160, w: 520, h: 260, type: 'water' },
      { x: 1680, y: 1160, w: 520, h: 260, type: 'water' },
      { x: 2380, y: 1160, w: 520, h: 260, type: 'water' },
      { x: 3080, y: 1160, w: 520, h: 260, type: 'water' },
      { x: 3780, y: 1160, w: 520, h: 260, type: 'water' },
      { x: 460, y: 1600, w: 520, h: 260, type: 'water' },
      { x: 1160, y: 1580, w: 520, h: 260, type: 'water' },
      { x: 1860, y: 1580, w: 520, h: 260, type: 'water' },
      { x: 2560, y: 1580, w: 520, h: 260, type: 'water' },
      { x: 3260, y: 1580, w: 520, h: 260, type: 'water' },
      { x: 3960, y: 1580, w: 520, h: 260, type: 'water' },
      { x: 640, y: 2040, w: 520, h: 260, type: 'water' },
      { x: 1340, y: 2020, w: 520, h: 260, type: 'water' },
      { x: 2040, y: 2020, w: 520, h: 260, type: 'water' },
      { x: 2740, y: 2020, w: 520, h: 260, type: 'water' },
      { x: 3440, y: 2020, w: 520, h: 260, type: 'water' }
    ],
    props: [
      { x: 360, y: 560, w: 680, h: 160, type: 'causeway' },
      { x: 1280, y: 520, w: 680, h: 160, type: 'causeway' },
      { x: 2200, y: 520, w: 680, h: 160, type: 'causeway' },
      { x: 3120, y: 520, w: 680, h: 160, type: 'causeway' },
      { x: 4040, y: 560, w: 520, h: 160, type: 'causeway' },
      { x: 720, y: 860, w: 110, h: 140, type: 'tent', spriteURL: '/assets/tent.png' },
      { x: 2040, y: 880, w: 90, h: 90, type: 'crate', color: '#c68c45' },
      { x: 3500, y: 900, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 880, y: 1260, w: 110, h: 140, type: 'tent', spriteURL: '/assets/tent.png' },
      { x: 2220, y: 1280, w: 90, h: 90, type: 'crate', color: '#c68c45' },
      { x: 3640, y: 1300, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 1040, y: 1700, w: 110, h: 140, type: 'tent', spriteURL: '/assets/tent.png' },
      { x: 2400, y: 1720, w: 90, h: 90, type: 'crate', color: '#c68c45' },
      { x: 3800, y: 1740, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 1200, y: 2120, w: 110, h: 140, type: 'tent', spriteURL: '/assets/tent.png' },
      { x: 2580, y: 2140, w: 90, h: 90, type: 'crate', color: '#c68c45' },
      { x: 3940, y: 2160, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 520, y: 900, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 4120, y: 900, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 540, y: 2160, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 4140, y: 2140, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 1880, y: 2360, w: 100, h: 140, type: 'brazier' },
      { x: 2320, y: 2360, w: 100, h: 140, type: 'brazier' }
    ]
  }
};

export function createDemoWorld() {
  const world = new World();
  activeWorld = world;
  const startingRoom = RoomLibrary.lordBritishCastle ?? RoomLibrary.meadow;
  world.ready = world.loadRoom(startingRoom);
  return world;
}

export function drawWorld(ctx, world, camera) {
  const terrainName = world?.currentRoom?.terrain;
  const theme = getTerrainTheme(terrainName);

  drawTerrainBase(ctx, camera, theme);
  drawParallax(ctx, camera, theme);

  if (!world.currentRoom) {
    applyAmbientLight(ctx, camera, theme);
    applyFog(ctx, camera, theme);
    applyBloom(ctx, camera, theme);
    applyVignette(ctx, camera, theme);
    return;
  }

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

  applyAmbientLight(ctx, camera, theme);
  applyFog(ctx, camera, theme);
  applyBloom(ctx, camera, theme);
  applyVignette(ctx, camera, theme);
}

export function loadRoom(roomData, worldInstance = activeWorld) {
  if (!worldInstance || typeof worldInstance.loadRoom !== 'function') {
    throw new Error('Expected a World instance to load rooms into.');
  }
  return worldInstance.loadRoom(roomData);
}

export { World };
