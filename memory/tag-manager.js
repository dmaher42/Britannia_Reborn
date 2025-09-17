const DEFAULT_TAGS = ['math', 'science', 'grade-3', 'urgent', 'parent-meeting'];
const STORAGE_KEY = 'memoryCueTagPrefs';

function readStorage(key) {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('[Memory Cue] Unable to read storage', error);
    return null;
  }
}

function writeStorage(key, value) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('[Memory Cue] Unable to write storage', error);
  }
}

export function normalizeTag(rawTag) {
  if (!rawTag && rawTag !== 0) return '';
  const str = String(rawTag)
    .trim()
    .replace(/^#+/, '')
    .replace(/[^\p{L}\p{N}-\s]/gu, ' ')
    .replace(/\s+/g, '-');
  const normalized = str.replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return normalized;
}

export function formatTag(rawTag) {
  const normalized = normalizeTag(rawTag);
  return normalized ? `#${normalized}` : '';
}

function computeColor(tag) {
  // Deterministic hash -> hue for consistent colours between sessions
  const normalized = normalizeTag(tag);
  if (!normalized) {
    return 'hsl(210, 60%, 55%)';
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  const saturation = 65;
  const lightness = 48;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export class TagManager {
  constructor({ storageKey = STORAGE_KEY, defaults = DEFAULT_TAGS } = {}) {
    this.storageKey = storageKey;
    this.defaults = defaults;
    this.tags = new Map();
    this.load();
  }

  load() {
    const stored = readStorage(this.storageKey);
    if (stored && typeof stored === 'object' && stored.colorMap) {
      Object.entries(stored.colorMap).forEach(([tag, color]) => {
        if (typeof tag === 'string' && typeof color === 'string') {
          this.tags.set(tag, { color });
        }
      });
    }
    this.defaults.forEach((tag) => this.ensureTag(tag));
    this.persist();
  }

  persist() {
    const colorMap = {};
    this.tags.forEach((value, key) => {
      colorMap[key] = value.color;
    });
    writeStorage(this.storageKey, { colorMap });
  }

  ensureTag(rawTag) {
    const tag = normalizeTag(rawTag);
    if (!tag) return null;
    if (!this.tags.has(tag)) {
      this.tags.set(tag, { color: computeColor(tag) });
      this.persist();
    }
    return tag;
  }

  registerTags(tags = []) {
    let changed = false;
    tags.forEach((raw) => {
      const tag = normalizeTag(raw);
      if (tag && !this.tags.has(tag)) {
        this.tags.set(tag, { color: computeColor(tag) });
        changed = true;
      }
    });
    if (changed) {
      this.persist();
    }
  }

  getTagColor(rawTag) {
    const tag = normalizeTag(rawTag);
    if (!tag) {
      return 'hsl(210, 60%, 55%)';
    }
    const entry = this.tags.get(tag);
    if (entry) {
      return entry.color;
    }
    const color = computeColor(tag);
    this.tags.set(tag, { color });
    this.persist();
    return color;
  }

  getAllTags() {
    return Array.from(this.tags.keys()).sort((a, b) => a.localeCompare(b));
  }

  getSuggestions(inputValue = '', limit = 8) {
    const query = normalizeTag(inputValue);
    const suggestions = [];
    const seen = new Set();
    const tags = this.getAllTags();
    tags.forEach((tag) => {
      if (!query || tag.includes(query)) {
        if (!seen.has(tag)) {
          suggestions.push({ tag, isNew: false });
          seen.add(tag);
        }
      }
    });
    if (query && !seen.has(query)) {
      suggestions.push({ tag: query, isNew: !this.tags.has(query) });
    }
    return suggestions.slice(0, limit);
  }

  hasTag(rawTag) {
    const tag = normalizeTag(rawTag);
    return !!tag && this.tags.has(tag);
  }

  describePreferences() {
    const tags = this.getAllTags();
    const top = tags.slice(0, 3).map((tag) => formatTag(tag));
    if (!top.length) {
      return 'No tags yet. Add some to start organising!';
    }
    return `Favourite tags ready: ${top.join(', ')}`;
  }
}

export const presetTags = DEFAULT_TAGS.slice();
