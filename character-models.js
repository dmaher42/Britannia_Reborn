import { CharacterClass } from './party.js';
import { lightenColor, darkenColor, mixColor } from './utils.js';

const BASE_MODEL = {
  cloakLight: '#3a4a61',
  cloakShadow: '#1f2a3a',
  cloakTrim: '#c9a25d',
  armorLight: '#e4d9c4',
  armorShadow: '#b9aa91',
  accent: '#c76b3b',
  accentSecondary: '#f4e3b8',
  belt: '#5a3c2e',
  medallion: '#f0c567',
  skin: '#f5d7bc',
  hair: '#7a5b3a',
  icon: 'sword',
  iconColor: '#ede7de',
  iconSecondary: '#7b6a54',
  sashColor: '#d04f3f',
  auraInner: 'rgba(255, 219, 112, 0.75)',
  auraOuter: 'rgba(255, 170, 32, 0)'
};

const createModel = (overrides = {}) => ({ ...BASE_MODEL, ...overrides });

const CLASS_MODELS = {
  default: createModel(),
  [CharacterClass.Avatar]: createModel({
    cloakLight: '#20315e',
    cloakShadow: '#0f1c3c',
    cloakTrim: '#f6d487',
    armorLight: '#f4e3c1',
    armorShadow: '#c7a973',
    accent: '#b43a2f',
    accentSecondary: '#f6e7b6',
    belt: '#62412a',
    medallion: '#f7cd54',
    hair: '#6e4322',
    icon: 'sword',
    iconColor: '#f6efe2',
    iconSecondary: '#9a7a43',
    sashColor: '#d55440'
  }),
  [CharacterClass.Bard]: createModel({
    cloakLight: '#28504d',
    cloakShadow: '#173333',
    cloakTrim: '#f1c76d',
    armorLight: '#e4cc9e',
    armorShadow: '#b99563',
    accent: '#844c8a',
    accentSecondary: '#d6b6df',
    belt: '#5d3b2a',
    medallion: '#d0a2ff',
    hair: '#d0b078',
    icon: 'lute',
    iconColor: '#f8e2b1',
    iconSecondary: '#8d6b38',
    sashColor: '#9b5cb4'
  }),
  [CharacterClass.Ranger]: createModel({
    cloakLight: '#3c6b3b',
    cloakShadow: '#213f20',
    cloakTrim: '#9dc276',
    armorLight: '#d2d9c1',
    armorShadow: '#96a484',
    accent: '#5d7c3f',
    accentSecondary: '#cbe190',
    belt: '#4b3b2a',
    medallion: '#a4ce67',
    hair: '#3e2c1c',
    icon: 'bow',
    iconColor: '#e1dbc8',
    iconSecondary: '#775a37',
    sashColor: '#6a8b47'
  })
};

const getModel = (member) => {
  if (!member) return CLASS_MODELS.default;
  if (member.cls && CLASS_MODELS[member.cls]) return CLASS_MODELS[member.cls];
  return CLASS_MODELS.default;
};

function drawRoundedRectPath(ctx, x, y, width, height, radius) {
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
}

function drawClassIcon(ctx, model, radius) {
  ctx.save();
  ctx.translate(0, radius * 0.55);
  const icon = model.icon || 'sword';

  if (icon === 'bow') {
    ctx.save();
    ctx.translate(-radius * 0.05, 0);
    ctx.strokeStyle = darkenColor(model.iconColor, 0.15);
    ctx.lineWidth = radius * 0.12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-radius * 0.7, -radius * 0.9);
    ctx.quadraticCurveTo(-radius, 0, -radius * 0.7, radius * 0.9);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(245, 245, 245, 0.75)';
    ctx.lineWidth = radius * 0.05;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.7, -radius * 0.88);
    ctx.lineTo(-radius * 0.7, radius * 0.88);
    ctx.stroke();

    ctx.strokeStyle = model.iconSecondary;
    ctx.lineWidth = radius * 0.08;
    ctx.beginPath();
    ctx.moveTo(radius * 0.35, -radius * 0.65);
    ctx.lineTo(-radius * 0.7, -radius * 0.1);
    ctx.stroke();

    ctx.fillStyle = model.iconSecondary;
    ctx.beginPath();
    ctx.moveTo(radius * 0.35, -radius * 0.65);
    ctx.lineTo(radius * 0.18, -radius * 0.82);
    ctx.lineTo(radius * 0.45, -radius * 0.78);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (icon === 'lute') {
    ctx.save();
    ctx.translate(-radius * 0.05, radius * 0.05);
    ctx.fillStyle = darkenColor(model.iconSecondary, 0.1);
    ctx.fillRect(-radius * 0.05, -radius * 0.8, radius * 0.1, radius * 0.65);

    const bodyGradient = ctx.createLinearGradient(-radius * 0.35, -radius * 0.1, radius * 0.1, radius * 0.6);
    bodyGradient.addColorStop(0, lightenColor(model.iconColor, 0.2));
    bodyGradient.addColorStop(1, darkenColor(model.iconColor, 0.15));
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.ellipse(-radius * 0.25, radius * 0.2, radius * 0.38, radius * 0.48, -Math.PI / 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(30, 20, 12, 0.6)';
    ctx.beginPath();
    ctx.arc(-radius * 0.32, radius * 0.25, radius * 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(245, 245, 245, 0.7)';
    ctx.lineWidth = radius * 0.015;
    for (let i = -2; i <= 2; i += 1) {
      const offset = i * radius * 0.02;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.05 + offset, -radius * 0.78);
      ctx.lineTo(-radius * 0.32 + offset, radius * 0.45);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    ctx.save();
    ctx.rotate(-Math.PI / 12);
    const bladeGradient = ctx.createLinearGradient(0, -radius * 1.1, 0, radius * 0.55);
    bladeGradient.addColorStop(0, lightenColor(model.iconColor, 0.18));
    bladeGradient.addColorStop(1, darkenColor(model.iconColor, 0.2));
    ctx.fillStyle = bladeGradient;
    ctx.fillRect(-radius * 0.06, -radius * 1.05, radius * 0.12, radius * 1.25);

    ctx.beginPath();
    ctx.moveTo(0, -radius * 1.25);
    ctx.lineTo(radius * 0.18, -radius * 0.95);
    ctx.lineTo(-radius * 0.18, -radius * 0.95);
    ctx.closePath();
    ctx.fill();

    const guardWidth = radius * 0.55;
    const guardHeight = radius * 0.16;
    ctx.fillStyle = model.accentSecondary;
    drawRoundedRectPath(ctx, -guardWidth / 2, -radius * 0.35, guardWidth, guardHeight, guardHeight * 0.4);
    ctx.fill();

    ctx.fillStyle = darkenColor(model.accentSecondary, 0.25);
    drawRoundedRectPath(ctx, -radius * 0.14, -radius * 0.18, radius * 0.28, radius * 0.35, radius * 0.1);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(-radius * 0.55, radius * 0.1);
    const shieldGradient = ctx.createLinearGradient(-radius * 0.45, -radius * 0.6, radius * 0.45, radius * 0.7);
    shieldGradient.addColorStop(0, lightenColor(model.accentSecondary, 0.25));
    shieldGradient.addColorStop(1, darkenColor(model.accentSecondary, 0.35));
    ctx.fillStyle = shieldGradient;
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.65);
    ctx.quadraticCurveTo(radius * 0.55, -radius * 0.1, 0, radius * 0.75);
    ctx.quadraticCurveTo(-radius * 0.55, -radius * 0.1, 0, -radius * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = radius * 0.05;
    ctx.strokeStyle = 'rgba(15, 20, 28, 0.45)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, radius * 0.1, radius * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = model.accent;
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawLeaderAura(ctx, radius, model) {
  const auraRadius = radius * 1.8;
  const gradient = ctx.createRadialGradient(0, -radius * 0.2, radius * 0.2, 0, -radius * 0.2, auraRadius);
  gradient.addColorStop(0, model.auraInner || 'rgba(255, 214, 92, 0.85)');
  gradient.addColorStop(0.55, 'rgba(255, 214, 92, 0.4)');
  gradient.addColorStop(1, model.auraOuter || 'rgba(255, 214, 92, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, -radius * 0.2, auraRadius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawCharacterModel(ctx, member, options = {}) {
  if (!ctx || typeof ctx.save !== 'function' || !member) return;

  const { x = member.x || 0, y = member.y || 0, radius = 18, isLeader = false } = options;
  const model = getModel(member);

  ctx.save();
  ctx.translate(x, y);

  const shadowY = radius * 0.75;
  const shadowGradient = ctx.createRadialGradient(0, shadowY, radius * 0.2, 0, shadowY, radius * 1.05);
  shadowGradient.addColorStop(0, 'rgba(10, 16, 24, 0.45)');
  shadowGradient.addColorStop(0.7, 'rgba(10, 16, 24, 0.18)');
  shadowGradient.addColorStop(1, 'rgba(10, 16, 24, 0)');
  ctx.fillStyle = shadowGradient;
  ctx.beginPath();
  ctx.ellipse(0, shadowY, radius * 0.95, radius * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isLeader) {
    drawLeaderAura(ctx, radius, model);
  }

  const cloakWidth = radius * 1.9;
  const cloakHeight = radius * 2.1;
  ctx.beginPath();
  ctx.moveTo(-cloakWidth / 2, -radius * 0.35);
  ctx.quadraticCurveTo(-cloakWidth * 0.55, cloakHeight * 0.1, -cloakWidth * 0.35, cloakHeight * 0.75);
  ctx.quadraticCurveTo(0, cloakHeight * 1.05, cloakWidth * 0.35, cloakHeight * 0.75);
  ctx.quadraticCurveTo(cloakWidth * 0.55, cloakHeight * 0.1, cloakWidth / 2, -radius * 0.35);
  ctx.closePath();
  const cloakGradient = ctx.createLinearGradient(0, -radius, 0, cloakHeight);
  cloakGradient.addColorStop(0, model.cloakLight);
  cloakGradient.addColorStop(1, model.cloakShadow);
  ctx.fillStyle = cloakGradient;
  ctx.fill();

  if (model.cloakTrim) {
    ctx.strokeStyle = model.cloakTrim;
    ctx.lineWidth = Math.max(1.5, radius * 0.12);
    ctx.stroke();
  }

  const bodyWidth = radius * 1.35;
  const bodyHeight = radius * 1.6;
  const bodyX = -bodyWidth / 2;
  const bodyY = -radius * 0.35;
  drawRoundedRectPath(ctx, bodyX, bodyY, bodyWidth, bodyHeight, radius * 0.35);
  const bodyGradient = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyHeight);
  bodyGradient.addColorStop(0, model.armorLight);
  bodyGradient.addColorStop(1, model.armorShadow);
  ctx.fillStyle = bodyGradient;
  ctx.fill();
  ctx.lineWidth = radius * 0.08;
  ctx.strokeStyle = 'rgba(9, 15, 24, 0.4)';
  ctx.stroke();

  const chestHighlight = ctx.createLinearGradient(-bodyWidth / 2, 0, bodyWidth / 2, 0);
  chestHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
  chestHighlight.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
  chestHighlight.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
  ctx.fillStyle = chestHighlight;
  drawRoundedRectPath(ctx, -bodyWidth / 2 + radius * 0.08, bodyY + radius * 0.1, bodyWidth - radius * 0.16, bodyHeight * 0.55, radius * 0.25);
  ctx.fill();

  ctx.fillStyle = model.accentSecondary;
  ctx.beginPath();
  ctx.ellipse(-bodyWidth / 2, -radius * 0.15, radius * 0.42, radius * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(bodyWidth / 2, -radius * 0.15, radius * 0.42, radius * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = model.accent;
  drawRoundedRectPath(ctx, -bodyWidth * 0.28, -radius * 0.05, bodyWidth * 0.56, radius * 0.45, radius * 0.15);
  ctx.fill();
  ctx.lineWidth = radius * 0.04;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.stroke();

  if (model.medallion) {
    ctx.beginPath();
    ctx.arc(0, radius * 0.2, radius * 0.18, 0, Math.PI * 2);
    const medallionGradient = ctx.createRadialGradient(0, radius * 0.1, radius * 0.05, 0, radius * 0.2, radius * 0.18);
    medallionGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    medallionGradient.addColorStop(0.5, model.medallion);
    medallionGradient.addColorStop(1, darkenColor(model.medallion, 0.3));
    ctx.fillStyle = medallionGradient;
    ctx.fill();
  }

  ctx.fillStyle = model.belt;
  drawRoundedRectPath(ctx, -bodyWidth / 2 + radius * 0.1, radius * 0.45, bodyWidth - radius * 0.2, radius * 0.25, radius * 0.12);
  ctx.fill();

  if (model.sashColor) {
    ctx.fillStyle = mixColor(model.sashColor, '#000000', 0.1);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(-bodyWidth * 0.38, -radius * 0.18);
    ctx.lineTo(-bodyWidth * 0.06, radius * 0.75);
    ctx.lineTo(bodyWidth * 0.12, radius * 0.75);
    ctx.lineTo(bodyWidth * 0.38, -radius * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.beginPath();
  ctx.arc(0, -radius * 1.15, radius * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = model.skin;
  ctx.fill();
  ctx.lineWidth = radius * 0.05;
  ctx.strokeStyle = 'rgba(12, 18, 28, 0.45)';
  ctx.stroke();

  if (model.hair) {
    ctx.beginPath();
    ctx.moveTo(-radius * 0.6, -radius * 1.25);
    ctx.bezierCurveTo(-radius * 0.78, -radius * 1.7, radius * 0.78, -radius * 1.7, radius * 0.6, -radius * 1.25);
    ctx.quadraticCurveTo(radius * 0.7, -radius * 0.95, 0, -radius * 0.82);
    ctx.quadraticCurveTo(-radius * 0.7, -radius * 0.95, -radius * 0.6, -radius * 1.25);
    ctx.closePath();
    const hairGradient = ctx.createLinearGradient(-radius * 0.6, -radius * 1.6, radius * 0.6, -radius * 0.7);
    hairGradient.addColorStop(0, lightenColor(model.hair, 0.15));
    hairGradient.addColorStop(1, darkenColor(model.hair, 0.1));
    ctx.fillStyle = hairGradient;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(-radius * 0.15, -radius * 1.2, radius * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = radius * 0.08;
  ctx.beginPath();
  ctx.moveTo(-cloakWidth / 2 + radius * 0.15, -radius * 0.3);
  ctx.quadraticCurveTo(-cloakWidth * 0.3, cloakHeight * 0.45, -cloakWidth * 0.1, cloakHeight * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cloakWidth / 2 - radius * 0.15, -radius * 0.3);
  ctx.quadraticCurveTo(cloakWidth * 0.3, cloakHeight * 0.45, cloakWidth * 0.1, cloakHeight * 0.8);
  ctx.stroke();

  drawClassIcon(ctx, model, radius);

  ctx.restore();
}
