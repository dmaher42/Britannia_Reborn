// Lightweight combat FX helpers: floaty numbers, camera shake, hit flashes.

const DEFAULT_STYLES = {
  dmg: { fill: '#ff7148', stroke: 'rgba(12,0,0,0.75)', font: '600 18px "Cinzel", "Times New Roman", serif', shadowColor: 'rgba(0,0,0,0.5)', shadowBlur: 4, rise: 36, duration: 680, critScale: 1.28 },
  heal: { fill: '#68dd88', stroke: 'rgba(8,60,20,0.55)', font: '600 17px "Inter", system-ui, sans-serif', shadowColor: 'rgba(0,0,0,0.35)', shadowBlur: 3, rise: 30, duration: 660, critScale: 1.18 },
  miss: { fill: '#b7c6d8', stroke: 'rgba(8,12,18,0.4)', font: 'italic 16px "Inter", system-ui, sans-serif', shadowColor: 'rgba(0,0,0,0.25)', shadowBlur: 2, rise: 26, duration: 600, critScale: 1 },
  block: { fill: '#d8d2c6', stroke: 'rgba(8,8,8,0.52)', font: 'small-caps 16px "Inter", system-ui, sans-serif', shadowColor: 'rgba(0,0,0,0.28)', shadowBlur: 2, rise: 24, duration: 600, critScale: 1 },
  info: { fill: '#f6eac4', stroke: 'rgba(12,6,0,0.5)', font: '600 16px "Inter", system-ui, sans-serif', shadowColor: 'rgba(0,0,0,0.3)', shadowBlur: 2, rise: 28, duration: 650, critScale: 1.1 }
};

const state = {
  getCamera: null,
  worldToScreen: null,
  floaties: [],
  shakes: [],
  styleMap: { ...DEFAULT_STYLES },
  reducedMotion: false,
  motionScale: 1,
  timeMs: 0,
  shakeOffset: { x: 0, y: 0 },
  entityBounds: new Map(),
  flashes: new Map(),
  reduceQuery: null
};

const MAX_FLOATIES = 64, FLOATY_MARGIN = 8;
const identityWorldToScreen = ({ x, y }) => ({ sx: x, sy: y });
const clamp = (value, min, max) => (!Number.isFinite(value) ? min : Math.min(Math.max(value, min), max));
const easeOutCubic = (t) => { const c = clamp(t, 0, 1); const inv = 1 - c; return 1 - inv * inv * inv; };
const scaleFontSize = (font, scale) => (typeof font !== 'string' || !Number.isFinite(scale) || scale <= 0 ? font : font.replace(/(\d+(?:\.\d+)?)px/g, (match, size) => `${Math.max(1, Math.round(Number(size) * scale))}px`));
const ensureStyle = (kind) => (state.styleMap[kind] ||= { ...DEFAULT_STYLES.info });
const currentCamera = () => {
  if (typeof state.getCamera === 'function') {
    const cam = state.getCamera();
    if (cam) return cam;
  }
  return { x: 0, y: 0, width: 0, height: 0 };
};
const toScreen = (point) => (!point ? { sx: 0, sy: 0 } : (state.worldToScreen || identityWorldToScreen)(point));

const setupMotionPreference = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function' || state.reduceQuery) return;
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  state.reduceQuery = query;
  const apply = (matches) => { state.reducedMotion = !!matches; state.motionScale = matches ? 0.4 : 1; };
  apply(query.matches);
  const handler = (event) => apply(event.matches);
  if (typeof query.addEventListener === 'function') query.addEventListener('change', handler);
  else if (typeof query.addListener === 'function') query.addListener(handler);
};

const drawFloaties = (ctx, cam) => {
  if (!state.floaties.length) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const viewW = cam.width || ctx.canvas?.width || 0;
  const viewH = cam.height || ctx.canvas?.height || 0;
  for (const f of state.floaties) {
    const progress = clamp(f.elapsed / f.duration, 0, 1);
    const alpha = (1 - progress) ** 2;
    if (alpha <= 0.001) continue;
    let { x, y } = f;
    if (f.space === 'world') ({ sx: x, sy: y } = toScreen({ x, y }));
    y -= (f.rise ?? 0) * easeOutCubic(progress);
    const font = f.crit ? scaleFontSize(f.font, f.critScale ?? 1.25) : f.font;
    ctx.font = font;
    const half = (ctx.measureText(f.text).width ?? 0) / 2;
    if (viewW) x = Math.min(Math.max(x, FLOATY_MARGIN + half), viewW - FLOATY_MARGIN - half);
    if (viewH) y = Math.min(Math.max(y, FLOATY_MARGIN), viewH - FLOATY_MARGIN);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = f.shadowColor ?? 'rgba(0,0,0,0)';
    ctx.shadowBlur = f.shadowBlur ?? 0;
    ctx.lineWidth = f.strokeWidth ?? 3;
    if (f.stroke) { ctx.strokeStyle = f.stroke; ctx.strokeText(f.text, x, y); }
    ctx.fillStyle = f.fill ?? '#fff';
    ctx.fillText(f.text, x, y);
  }
  ctx.restore();
};

const drawFlashes = (ctx) => {
  if (!state.flashes.size) return;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  const now = state.timeMs;
  for (const [entityId, flash] of state.flashes) {
    const bounds = state.entityBounds.get(entityId);
    if (!flash || !bounds) continue;
    const progress = clamp((now - flash.start) / flash.duration, 0, 1);
    if (progress >= 1) { state.flashes.delete(entityId); continue; }
    const fade = (1 - progress) ** 2 * (flash.alpha ?? 1);
    if (fade <= 0.001) continue;
    ctx.globalAlpha = fade;
    ctx.strokeStyle = flash.color ?? 'rgba(255,255,255,0.9)';
    ctx.lineWidth = flash.lineWidth ?? 3;
    if (Number.isFinite(bounds.radius)) {
      const { sx, sy } = toScreen({ x: bounds.x, y: bounds.y });
      ctx.beginPath();
      ctx.arc(sx, sy, bounds.radius, 0, Math.PI * 2);
      ctx.stroke();
      if (flash.fill) { ctx.fillStyle = flash.fill; ctx.fill(); }
    } else if (Number.isFinite(bounds.width) && Number.isFinite(bounds.height)) {
      const topLeft = toScreen({ x: bounds.x, y: bounds.y });
      const bottomRight = toScreen({ x: bounds.x + bounds.width, y: bounds.y + bounds.height });
      const w = bottomRight.sx - topLeft.sx;
      const h = bottomRight.sy - topLeft.sy;
      ctx.strokeRect(topLeft.sx, topLeft.sy, w, h);
      if (flash.fill) { ctx.fillStyle = flash.fill; ctx.fillRect(topLeft.sx, topLeft.sy, w, h); }
    }
  }
  ctx.restore();
};

const updateFloaties = (dtMs) => {
  for (let i = state.floaties.length - 1; i >= 0; i -= 1) {
    const f = state.floaties[i];
    f.elapsed += dtMs;
    if (f.elapsed >= f.duration) state.floaties.splice(i, 1);
  }
};

const updateShakes = (dtMs) => {
  if (!state.shakes.length) { state.shakeOffset.x = 0; state.shakeOffset.y = 0; return; }
  let totalX = 0;
  let totalY = 0;
  for (let i = state.shakes.length - 1; i >= 0; i -= 1) {
    const shake = state.shakes[i];
    shake.elapsed += dtMs;
    const progress = clamp(shake.elapsed / shake.duration, 0, 1);
    if (progress >= 1) { state.shakes.splice(i, 1); continue; }
    const fade = Math.pow(1 - progress, shake.falloff ?? 1);
    const time = (shake.elapsed + shake.seedTime) / 1000;
    const angle = time * (shake.frequency ?? 20) * Math.PI * 2;
    totalX += Math.sin(angle + shake.phaseX) * shake.amplitude * fade;
    totalY += Math.cos(angle + shake.phaseY) * shake.amplitude * fade;
  }
  state.shakeOffset.x = totalX;
  state.shakeOffset.y = totalY;
};

const normalizeBounds = (bounds) => {
  if (!bounds) return null;
  if (Number.isFinite(bounds.radius)) return { x: bounds.x ?? 0, y: bounds.y ?? 0, radius: Math.max(0, bounds.radius) };
  if (Number.isFinite(bounds.width) && Number.isFinite(bounds.height)) return { x: bounds.x ?? 0, y: bounds.y ?? 0, width: Math.max(0, bounds.width), height: Math.max(0, bounds.height) };
  return null;
};

export const init = (options = {}) => {
  state.getCamera = typeof options.getCamera === 'function' ? options.getCamera : null;
  if (typeof options.worldToScreen === 'function') state.worldToScreen = options.worldToScreen;
  else if (state.getCamera) state.worldToScreen = ({ x, y }) => ({ sx: x - currentCamera().x, sy: y - currentCamera().y });
  else state.worldToScreen = identityWorldToScreen;
  setupMotionPreference();
};

export const update = (dtSeconds = 0) => {
  const dtMs = Number.isFinite(dtSeconds) ? Math.max(0, dtSeconds * 1000) : 16;
  state.timeMs += dtMs;
  updateFloaties(dtMs);
  updateShakes(dtMs);
};

export const draw = (ctx) => {
  if (!ctx) return;
  drawFlashes(ctx);
  drawFloaties(ctx, currentCamera());
};

export const spawnFloaty = (options = {}) => {
  const text = options.text ?? '';
  if (typeof text !== 'string' || text.length === 0) return null;
  const style = { ...ensureStyle(options.kind ?? 'info') };
  const overrides = options.style ?? {};
  const durationBase = Number.isFinite(options.duration) ? options.duration : overrides.duration ?? style.duration ?? 650;
  const riseBase = Number.isFinite(options.rise) ? options.rise : overrides.rise ?? style.rise ?? 32;
  const floaty = {
    x: Number.isFinite(options.x) ? options.x : 0,
    y: Number.isFinite(options.y) ? options.y : 0,
    text,
    kind: options.kind ?? 'info',
    space: options.space === 'screen' || options.space === 'ui' ? 'screen' : 'world',
    crit: !!options.crit,
    critScale: style.critScale ?? 1.25,
    fill: overrides.fill ?? style.fill,
    stroke: overrides.stroke ?? style.stroke,
    shadowColor: overrides.shadowColor ?? style.shadowColor,
    shadowBlur: overrides.shadowBlur ?? style.shadowBlur ?? 0,
    font: overrides.font ?? style.font ?? '600 16px sans-serif',
    strokeWidth: overrides.strokeWidth ?? options.strokeWidth ?? 3,
    duration: state.reducedMotion ? Math.min(durationBase, 320) : clamp(durationBase, 180, 2000),
    rise: Math.max(0, riseBase * state.motionScale),
    elapsed: 0
  };
  state.floaties.push(floaty);
  if (state.floaties.length > MAX_FLOATIES) state.floaties.splice(0, state.floaties.length - MAX_FLOATIES);
  return floaty;
};

export const setStyle = (kind, overrides = {}) => {
  if (!kind) return;
  state.styleMap[kind] = { ...ensureStyle(kind), ...overrides };
};

export const shake = (options = {}) => {
  const duration = clamp(Number(options.duration) || 0, 0, 2000);
  const amplitude = Math.max(0, (Number(options.amplitude) || 0) * state.motionScale);
  if (!(duration > 0) || !(amplitude > 0)) return;
  state.shakes.push({
    duration,
    amplitude,
    frequency: Math.max(1, Number(options.frequency) || 18),
    falloff: Math.max(0.1, Number(options.falloff) || 1),
    elapsed: 0,
    seedTime: Math.random() * 1000,
    phaseX: Math.random() * Math.PI * 2,
    phaseY: Math.random() * Math.PI * 2
  });
};

export const getShakeOffset = () => ({ x: state.shakeOffset.x, y: state.shakeOffset.y });

export const applyCameraShake = (baseCamera = null) => {
  const offset = getShakeOffset();
  return baseCamera ? { ...baseCamera, x: (baseCamera.x ?? 0) + offset.x, y: (baseCamera.y ?? 0) + offset.y } : offset;
};

export const flashTarget = (entityId, options = {}) => {
  if (!entityId) return;
  const duration = clamp(Number(options.ms) || Number(options.duration) || 120, 40, 600);
  state.flashes.set(entityId, {
    start: state.timeMs,
    duration,
    color: options.color ?? 'rgba(255,236,150,0.9)',
    fill: options.fill ?? null,
    lineWidth: options.lineWidth ?? 3,
    alpha: Number.isFinite(options.alpha) ? clamp(options.alpha, 0, 1) : 1
  });
};

export const registerEntityBounds = (entityId, bounds) => {
  if (!entityId) return;
  if (!bounds) state.entityBounds.delete(entityId);
  else {
    const normalized = normalizeBounds(bounds);
    if (normalized) state.entityBounds.set(entityId, normalized);
  }
};
