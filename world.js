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
  tree: '#2f5d31'
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
  lordBritishCastle: {
    name: 'Castle Britannia Courtyard',
    terrain: 'Castle Grounds',
    bounds: { width: 4200, height: 2800 },
    spawn: { x: 1500, y: 2120 },
    obstacles: [
      { x: 520, y: 360, w: 140, h: 1160, type: 'wall' },
      { x: 2310, y: 360, w: 140, h: 1160, type: 'wall' },
      { x: 660, y: 360, w: 560, h: 140, type: 'wall' },
      { x: 1700, y: 360, w: 560, h: 140, type: 'wall' },
      { x: 860, y: 620, w: 1180, h: 540, type: 'wall' },
      { x: 660, y: 520, w: 220, h: 220, type: 'rock' },
      { x: 1980, y: 520, w: 220, h: 220, type: 'rock' },
      { x: 660, y: 1240, w: 520, h: 120, type: 'wall' },
      { x: 1680, y: 1240, w: 520, h: 120, type: 'wall' },
      { x: 960, y: 1100, w: 1020, h: 120, type: 'wall' }
    ],
    props: [
      {
        x: 570,
        y: 400,
        w: 1860,
        h: 980,
        type: 'castle',
        primaryColor: '#2d4f8f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0',
        detail: { gateWidth: 420 }
      },
      { x: 1270, y: 1380, w: 460, h: 620, type: 'causeway' },
      {
        x: 1080,
        y: 1360,
        w: 110,
        h: 320,
        type: 'banner',
        primaryColor: '#2d4f8f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0'
      },
      {
        x: 1820,
        y: 1360,
        w: 110,
        h: 320,
        type: 'banner',
        primaryColor: '#8d2f2f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0'
      },
      {
        x: 700,
        y: 520,
        w: 100,
        h: 300,
        type: 'banner',
        primaryColor: '#2d4f8f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0'
      },
      {
        x: 2050,
        y: 520,
        w: 100,
        h: 300,
        type: 'banner',
        primaryColor: '#8d2f2f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0'
      },
      { x: 1220, y: 1720, w: 100, h: 160, type: 'brazier' },
      { x: 1780, y: 1720, w: 100, h: 160, type: 'brazier' },
      { x: 880, y: 1580, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 1980, y: 1580, w: 160, h: 220, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 1400, y: 1880, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 1600, y: 1880, w: 60, h: 60, type: 'lantern', color: '#f6c35f' }
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
