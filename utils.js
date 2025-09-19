export function clamp(value, min, max) {
  if (typeof min === 'number' && value < min) return min;
  if (typeof max === 'number' && value > max) return max;
  return value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const clamp01 = (value) => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const clampChannel = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
};

const normalizeHex = (hex) => {
  if (typeof hex !== 'string') return null;
  let value = hex.trim();
  if (!value) return null;
  if (value[0] === '#') {
    value = value.slice(1);
  }
  if (value.length === 3) {
    const [r, g, b] = value;
    return `${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (value.length === 6) {
    return value.toLowerCase();
  }
  return null;
};

const parseHexColor = (hex) => {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) return null;
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff
  };
};

const rgbToHex = (r, g, b) => `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;

export function mixColor(colorA, colorB, ratio = 0.5) {
  const t = clamp01(ratio);
  const a = parseHexColor(colorA);
  const b = parseHexColor(colorB);
  if (!a || !b) {
    return typeof colorA === 'string' ? colorA : '#ffffff';
  }
  const r = clampChannel(a.r + (b.r - a.r) * t);
  const g = clampChannel(a.g + (b.g - a.g) * t);
  const bChannel = clampChannel(a.b + (b.b - a.b) * t);
  return rgbToHex(r, g, bChannel);
}

export function lightenColor(color, ratio = 0.2) {
  return mixColor(color, '#ffffff', ratio);
}

export function darkenColor(color, ratio = 0.2) {
  return mixColor(color, '#000000', ratio);
}
