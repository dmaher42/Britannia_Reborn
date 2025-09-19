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

  const hallHeight = height * 0.62;
  const hallY = height - hallHeight;
  const towerWidth = Math.min(width * 0.18, 220);
  const towerHeight = hallHeight + height * 0.18;
  const battlementHeight = Math.max(18, height * 0.07);

  const drawWindow = (wx, wy, ww, wh) => {
    drawRoundedRectPath(ctx, wx, wy, ww, wh, Math.min(ww, wh) * 0.35);
    const gradient = ctx.createLinearGradient(0, wy, 0, wy + wh);
    gradient.addColorStop(0, palette.windowGlow);
    gradient.addColorStop(1, palette.windowDark);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = 'rgba(12, 18, 28, 0.45)';
    ctx.lineWidth = Math.max(1, ww * 0.12);
    ctx.stroke();
  };

  const towerGradient = ctx.createLinearGradient(0, hallY - height * 0.1, 0, height);
  towerGradient.addColorStop(0, lightenColor(palette.stoneLight, 0.1));
  towerGradient.addColorStop(1, palette.stoneShadow);

  const towerShade = ctx.createLinearGradient(0, 0, towerWidth, 0);
  towerShade.addColorStop(0, 'rgba(0, 0, 0, 0.18)');
  towerShade.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  towerShade.addColorStop(1, 'rgba(0, 0, 0, 0.18)');

  const towerPositions = [
    { x: 0, y: height - towerHeight },
    { x: width - towerWidth, y: height - towerHeight }
  ];

  for (const pos of towerPositions) {
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

    const windowWidth = towerWidth * 0.3;
    const windowHeight = towerWidth * 0.38;
    const windowX = pos.x + towerWidth * 0.35;
    let windowY = pos.y + towerHeight * 0.32;
    for (let i = 0; i < 3; i += 1) {
      drawWindow(windowX, windowY, windowWidth, windowHeight);
      windowY += windowHeight * 1.25;
    }
  }

  const hallX = towerWidth;
  const hallWidth = width - towerWidth * 2;
  const hallGradient = ctx.createLinearGradient(0, hallY, 0, hallY + hallHeight);
  hallGradient.addColorStop(0, lightenColor(palette.stoneLight, 0.18));
  hallGradient.addColorStop(1, palette.stoneMid);
  ctx.fillStyle = hallGradient;
  ctx.fillRect(hallX, hallY, hallWidth, hallHeight);
  drawBattlements(
    ctx,
    hallX,
    hallY,
    hallWidth,
    battlementHeight,
    lightenColor(palette.stoneLight, 0.22),
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

  const windowRows = 2;
  const windowCols = 4;
  const windowSpacingX = hallWidth / (windowCols + 1);
  const windowSpacingY = hallHeight / (windowRows + 2);
  const hallWindowWidth = windowSpacingX * 0.5;
  const hallWindowHeight = windowSpacingY * 0.9;
  for (let row = 0; row < windowRows; row += 1) {
    for (let col = 0; col < windowCols; col += 1) {
      const wx = hallX + windowSpacingX * (col + 1) - hallWindowWidth / 2;
      const wy = hallY + windowSpacingY * (row + 1);
      drawWindow(wx, wy, hallWindowWidth, hallWindowHeight);
    }
  }

  const keepWidth = hallWidth * 0.38;
  const keepHeight = hallHeight * 0.82;
  const keepX = hallX + hallWidth / 2 - keepWidth / 2;
  const keepY = hallY - keepHeight * 0.1;
  const keepGradient = ctx.createLinearGradient(0, keepY, 0, keepY + keepHeight);
  keepGradient.addColorStop(0, lightenColor(palette.stoneLight, 0.22));
  keepGradient.addColorStop(1, palette.stoneShadow);
  ctx.fillStyle = keepGradient;
  ctx.fillRect(keepX, keepY, keepWidth, keepHeight);
  drawBattlements(
    ctx,
    keepX,
    keepY,
    keepWidth,
    battlementHeight,
    lightenColor(palette.stoneLight, 0.25),
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

  const keepWindowWidth = keepWidth * 0.24;
  const keepWindowHeight = keepHeight * 0.18;
  const keepWindowX = keepX + keepWidth / 2 - keepWindowWidth / 2;
  let keepWindowY = keepY + keepHeight * 0.2;
  for (let i = 0; i < 3; i += 1) {
    drawWindow(keepWindowX, keepWindowY, keepWindowWidth, keepWindowHeight);
    keepWindowY += keepWindowHeight * 1.35;
  }

  const roofHeight = battlementHeight * 1.6;
  const roofGradient = ctx.createLinearGradient(0, keepY - roofHeight, 0, keepY);
  roofGradient.addColorStop(0, lightenColor(palette.roofLight, 0.2));
  roofGradient.addColorStop(1, palette.roofShadow);
  ctx.beginPath();
  ctx.moveTo(keepX - keepWidth * 0.12, keepY);
  ctx.lineTo(keepX + keepWidth / 2, keepY - roofHeight);
  ctx.lineTo(keepX + keepWidth + keepWidth * 0.12, keepY);
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
    bounds: { width: 3200, height: 2200 },
    spawn: { x: 1500, y: 1860 },
    obstacles: [
      { x: 680, y: 520, w: 90, h: 900, type: 'wall' },
      { x: 2200, y: 520, w: 90, h: 900, type: 'wall' },
      { x: 760, y: 520, w: 440, h: 110, type: 'wall' },
      { x: 1760, y: 520, w: 440, h: 110, type: 'wall' },
      { x: 760, y: 1180, w: 1440, h: 90, type: 'wall' },
      { x: 940, y: 700, w: 1100, h: 420, type: 'wall' },
      { x: 760, y: 640, w: 180, h: 180, type: 'rock' },
      { x: 2020, y: 640, w: 180, h: 180, type: 'rock' }
    ],
    props: [
      {
        x: 760,
        y: 540,
        w: 1440,
        h: 820,
        type: 'castle',
        primaryColor: '#2d4f8f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0',
        detail: { gateWidth: 360 }
      },
      { x: 1290, y: 1300, w: 420, h: 520, type: 'causeway' },
      {
        x: 1180,
        y: 1320,
        w: 90,
        h: 260,
        type: 'banner',
        primaryColor: '#2d4f8f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0'
      },
      {
        x: 1720,
        y: 1320,
        w: 90,
        h: 260,
        type: 'banner',
        primaryColor: '#8d2f2f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0'
      },
      {
        x: 820,
        y: 600,
        w: 90,
        h: 260,
        type: 'banner',
        primaryColor: '#2d4f8f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0'
      },
      {
        x: 2040,
        y: 600,
        w: 90,
        h: 260,
        type: 'banner',
        primaryColor: '#8d2f2f',
        secondaryColor: '#f3cf6b',
        accentColor: '#fef2d0'
      },
      { x: 1260, y: 1620, w: 90, h: 140, type: 'brazier' },
      { x: 1730, y: 1620, w: 90, h: 140, type: 'brazier' },
      { x: 980, y: 1480, w: 140, h: 200, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 1820, y: 1480, w: 140, h: 200, type: 'tree', spriteURL: '/assets/tree.png' },
      { x: 1400, y: 1700, w: 60, h: 60, type: 'lantern', color: '#f6c35f' },
      { x: 1560, y: 1700, w: 60, h: 60, type: 'lantern', color: '#f6c35f' }
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
