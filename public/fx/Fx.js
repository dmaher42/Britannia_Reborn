// Lightweight canvas FX helpers: floaties, camera shake, outline flashes.
const FONT_FAMILY = '"IBM Plex Sans", "Inter", "Segoe UI", system-ui, sans-serif';
const STYLE_PRESETS = {
  dmg: { fill: '#ff6b4a', stroke: 'rgba(10,0,0,0.75)', size: 20, weight: '700', shadow: 'rgba(0,0,0,0.35)', blur: 6, rise: [28, 36], alpha: 1 },
  heal: { fill: '#67e58f', stroke: 'rgba(10,40,10,0.55)', size: 18, weight: '600', shadow: 'rgba(8,44,12,0.25)', blur: 5, rise: [26, 34], alpha: 0.95 },
  miss: { fill: '#c5d4e4', stroke: 'rgba(0,0,0,0.4)', size: 16, weight: '500', style: 'italic', shadow: 'rgba(0,0,0,0.2)', blur: 4, rise: [22, 30], alpha: 0.85 },
  block: { fill: '#d9d9d9', stroke: 'rgba(0,0,0,0.55)', size: 17, weight: '700', variant: 'small-caps', shadow: 'rgba(0,0,0,0.3)', blur: 5, rise: [22, 28], alpha: 0.9 },
  info: { fill: '#ffeaa7', stroke: 'rgba(0,0,0,0.5)', size: 18, weight: '600', shadow: 'rgba(0,0,0,0.3)', blur: 5, rise: [26, 34], alpha: 0.95 }
};
const floaties = [], shakes = [], flashes = new Map(), bounds = new Map();
let getCameraFn = () => ({ x: 0, y: 0, width: 0, height: 0 });
let worldToScreenFn = null, worldToScreenIncludesShake = false, reduceMotion = false, motionQuery = null, motionListener = null;
const shakeOffset = { x: 0, y: 0 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (lo, hi) => lo + (hi - lo) * Math.random();
const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
function detachMotionListener() {
  if (!motionQuery || !motionListener) return;
  if (typeof motionQuery.removeEventListener === 'function') motionQuery.removeEventListener('change', motionListener);
  else if (typeof motionQuery.removeListener === 'function') motionQuery.removeListener(motionListener);
  motionQuery = motionListener = null;
}
function getCameraSafe() {
  try {
    const cam = getCameraFn?.();
    if (cam && typeof cam === 'object') {
      return {
        x: Number(cam.x) || 0,
        y: Number(cam.y) || 0,
        width: Number.isFinite(cam.width) ? cam.width : 0,
        height: Number.isFinite(cam.height) ? cam.height : 0
      };
    }
  } catch (error) {
    // ignore camera lookups that throw
  }
  return { x: 0, y: 0, width: 0, height: 0 };
}
export function init(opts = {}) {
  if (typeof opts.getCamera === 'function') getCameraFn = opts.getCamera;
  if (typeof opts.worldToScreen === 'function') worldToScreenFn = opts.worldToScreen;
  worldToScreenIncludesShake = !!opts.worldToScreenIncludesShake;
  detachMotionListener();
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      reduceMotion = !!query.matches;
      const handler = (event) => { reduceMotion = !!event.matches; };
      if (typeof query.addEventListener === 'function') query.addEventListener('change', handler);
      else if (typeof query.addListener === 'function') query.addListener(handler);
      motionQuery = query;
      motionListener = handler;
    } catch (error) {
      // unsupported environment
    }
  }
}
export function setStyle(kind, overrides = {}) {
  if (!kind || typeof overrides !== 'object') return;
  STYLE_PRESETS[kind] = { ...(STYLE_PRESETS[kind] || STYLE_PRESETS.info), ...overrides };
}
export function spawnFloaty(opts = {}) {
  const kind = STYLE_PRESETS[opts.kind] ? opts.kind : 'info';
  const textValue = opts.text ?? (kind === 'miss' ? 'Miss' : kind === 'block' ? 'Block' : kind === 'heal' ? '+0' : '');
  if (textValue === undefined || textValue === null || textValue === '') return null;
  const style = { ...(STYLE_PRESETS[kind] || STYLE_PRESETS.info) };
  const space = opts.space === 'ui' || opts.space === 'screen' || opts.ui ? 'ui' : 'world';
  const baseRise = Array.isArray(style.rise) ? rand(style.rise[0], style.rise[1]) : style.rise ?? rand(24, 40);
  let rise = Number.isFinite(opts.rise) ? opts.rise : baseRise;
  let duration = Number.isFinite(opts.duration) ? opts.duration : rand(550, 750);
  duration = Math.max(80, duration) / 1000;
  if (reduceMotion) {
    rise = Math.min(rise, 12);
    duration = Math.min(duration, 0.35);
  }
  const floaty = {
    x: Number(opts.x) || 0,
    y: Number(opts.y) || 0,
    sx: space === 'ui' ? Number(opts.sx ?? opts.x ?? 0) : 0,
    sy: space === 'ui' ? Number(opts.sy ?? opts.y ?? 0) : 0,
    text: String(textValue),
    kind,
    crit: !!opts.crit,
    style,
    duration,
    elapsed: 0,
    rise,
    jitter: reduceMotion ? 0 : rand(-4, 4),
    align: opts.align || 'center',
    space
  };
  floaties.push(floaty);
  return floaty;
}
function worldPointToScreen(point) {
  if (!point) return { sx: 0, sy: 0 };
  if (typeof worldToScreenFn === 'function') {
    const result = worldToScreenFn(point) || { sx: 0, sy: 0 };
    const sx = Number(result.sx) || 0;
    const sy = Number(result.sy) || 0;
    return worldToScreenIncludesShake ? { sx, sy } : { sx: sx - shakeOffset.x, sy: sy - shakeOffset.y };
  }
  const cam = getCameraSafe();
  return { sx: (Number(point.x) || 0) - cam.x - shakeOffset.x, sy: (Number(point.y) || 0) - cam.y - shakeOffset.y };
}
export const worldToScreen = (point) => worldPointToScreen(point);
export function update(dt) {
  const safeDt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
  if (!safeDt) return;
  for (let i = floaties.length - 1; i >= 0; i -= 1) {
    const f = floaties[i];
    f.elapsed = Math.min(f.elapsed + safeDt, f.duration);
    if (f.elapsed >= f.duration - 1e-4) floaties.splice(i, 1);
  }
  shakeOffset.x = shakeOffset.y = 0;
  for (let i = shakes.length - 1; i >= 0; i -= 1) {
    const s = shakes[i];
    s.elapsed += safeDt;
    if (s.elapsed >= s.duration) {
      shakes.splice(i, 1);
      continue;
    }
    const progress = clamp(s.elapsed / s.duration, 0, 1);
    const envelope = Math.pow(1 - progress, s.falloff);
    s.phaseX += s.angularVelocityX * safeDt;
    s.phaseY += s.angularVelocityY * safeDt;
    const amplitude = s.amplitude * envelope * (reduceMotion ? 0.25 : 1);
    shakeOffset.x += Math.sin(s.phaseX) * amplitude;
    shakeOffset.y += Math.cos(s.phaseY) * amplitude;
  }
  for (const [id, flash] of flashes) {
    flash.remaining -= safeDt;
    if (flash.remaining <= 0) flashes.delete(id);
  }
}
function drawFloaties(ctx) {
  const margin = 8;
  const cam = getCameraSafe();
  let width = cam.width;
  let height = cam.height;
  if ((!width || !height) && ctx?.canvas) {
    const t = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
    const sx = t?.a || 1;
    const sy = t?.d || 1;
    width = width || (sx !== 0 ? ctx.canvas.width / sx : ctx.canvas.width);
    height = height || (sy !== 0 ? ctx.canvas.height / sy : ctx.canvas.height);
  }
  for (const f of floaties) {
    const t = f.duration > 0 ? clamp(f.elapsed / f.duration, 0, 1) : 1;
    const alpha = easeOutCubic(1 - t) * (f.style.alpha ?? 1);
    if (alpha <= 0.02) continue;
    const pos = f.space === 'world' ? worldPointToScreen({ x: f.x, y: f.y }) : { sx: f.sx, sy: f.sy };
    if (!Number.isFinite(pos.sx) || !Number.isFinite(pos.sy)) continue;
    const offsetY = -f.rise * easeOutQuad(t);
    const x = clamp(pos.sx + f.jitter, margin, Math.max(margin, width - margin));
    const y = clamp(pos.sy + offsetY, margin, Math.max(margin, height - margin));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = f.align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const size = Math.round(f.style.size * (f.crit ? 1.25 : 1)), weight = f.crit ? '800' : f.style.weight || '600';
    ctx.font = [f.style.style || '', f.style.variant || '', weight, `${size}px`, FONT_FAMILY].filter(Boolean).join(' ');
    if (f.style.shadow) {
      ctx.shadowColor = f.style.shadow;
      ctx.shadowBlur = f.style.blur ?? 4;
      ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
    }
    if (f.style.stroke) {
      ctx.strokeStyle = f.style.stroke;
      ctx.lineWidth = f.crit ? 4 : 3;
      ctx.strokeText(f.text, x, y);
    }
    ctx.fillStyle = f.style.fill || '#ffffff';
    ctx.fillText(f.text, x, y);
    ctx.restore();
  }
}
function drawFlashes(ctx) {
  for (const [id, flash] of flashes) {
    const b = bounds.get(id);
    if (!b) continue;
    const t = flash.duration > 0 ? clamp(flash.remaining / flash.duration, 0, 1) : 0;
    if (t <= 0) continue;
    const intensity = (flash.intensity ?? 1) * (reduceMotion ? 0.7 : 1), strokeAlpha = easeOutQuad(t) * intensity, fillAlpha = Math.min(0.35, strokeAlpha * 0.35), color = flash.color || 'rgba(255,224,160,1)';
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 * intensity;
    ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
    const shape = b.shape || (b.radius ? 'circle' : 'rect');
    if (shape === 'circle') {
      const c = b.space === 'ui' ? { sx: b.x, sy: b.y } : worldPointToScreen({ x: b.x, y: b.y });
      const radius = Math.max(4, b.radius || 0);
      ctx.beginPath();
      ctx.globalAlpha = fillAlpha;
      ctx.fillStyle = color;
      ctx.arc(c.sx, c.sy, radius + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.globalAlpha = strokeAlpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.arc(c.sx, c.sy, radius + 1.5, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const tl = b.space === 'ui' ? { sx: b.x, sy: b.y } : worldPointToScreen({ x: b.x, y: b.y });
      const w = Math.max(4, b.w || b.width || 0);
      const h = Math.max(4, b.h || b.height || 0);
      ctx.globalAlpha = fillAlpha;
      ctx.fillStyle = color;
      ctx.fillRect(tl.sx - 1, tl.sy - 1, w + 2, h + 2);
      ctx.globalAlpha = strokeAlpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(tl.sx - 1, tl.sy - 1, w + 2, h + 2);
    }
    ctx.restore();
  }
}
export function draw(ctx) {
  if (!ctx) return;
  ctx.save();
  drawFloaties(ctx);
  drawFlashes(ctx);
  ctx.restore();
}
export function shake(opts = {}) {
  const duration = Math.max(0, Number.isFinite(opts.duration) ? opts.duration : 160) / 1000;
  const amplitude = Math.max(0, Number.isFinite(opts.amplitude) ? opts.amplitude : 4);
  if (!(duration > 0) || amplitude <= 0) return;
  const frequency = Math.max(0.1, Number.isFinite(opts.frequency) ? opts.frequency : 18);
  const falloff = Math.max(0.1, Number.isFinite(opts.falloff) ? opts.falloff : 1);
  const angular = Math.PI * 2 * frequency;
  shakes.push({ duration, elapsed: 0, amplitude, frequency, falloff, phaseX: Math.random() * Math.PI * 2, phaseY: Math.random() * Math.PI * 2, angularVelocityX: angular, angularVelocityY: angular * 1.37 });
}
export const getShakeOffset = () => ({ x: shakeOffset.x, y: shakeOffset.y });
export function flashTarget(id, opts = {}) {
  if (!id) return;
  const duration = Math.max(40, Number.isFinite(opts.ms ?? opts.duration) ? opts.ms ?? opts.duration : 120) / 1000;
  flashes.set(id, { remaining: duration, duration, color: opts.color || 'rgba(255,220,160,0.95)', intensity: clamp(Number.isFinite(opts.intensity) ? opts.intensity : 1, 0.1, 2) });
}
export function registerEntityBounds(id, box) {
  if (!id) return;
  if (!box) return void bounds.delete(id);
  bounds.set(id, { x: Number(box.x ?? box.cx ?? 0) || 0, y: Number(box.y ?? box.cy ?? 0) || 0, w: Number(box.w ?? box.width ?? 0) || 0, h: Number(box.h ?? box.height ?? 0) || 0, radius: Number(box.radius ?? box.r ?? 0) || 0, shape: box.shape, space: box.space === 'ui' || box.space === 'screen' ? 'ui' : 'world' });
}
export default { init, update, draw, spawnFloaty, shake, getShakeOffset, flashTarget, registerEntityBounds, setStyle, worldToScreen };
