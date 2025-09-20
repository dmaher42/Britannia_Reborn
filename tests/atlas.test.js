import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadAtlas, loadMeta, extractFrames, resolveAtlasUrl } from '../atlas.js';

class FakeImage {
  constructor() {
    this._listeners = new Map();
    this.decoding = 'sync';
  }

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    const pool = this._listeners.get(type);
    pool.add(handler);
  }

  removeEventListener(type, handler) {
    this._listeners.get(type)?.delete(handler);
  }

  dispatch(type, event) {
    const handlers = Array.from(this._listeners.get(type) ?? []);
    handlers.forEach((handler) => {
      handler.call(this, event);
    });
  }

  set src(value) {
    this._src = value;
    Promise.resolve().then(() => {
      this.dispatch('load');
    });
  }

  get src() {
    return this._src;
  }
}

describe('atlas loader', () => {
  const originalFetch = globalThis.fetch;
  let warnSpy;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('throws when metadata cannot be parsed', async () => {
    const badResponse = {
      ok: true,
      json: () => Promise.reject(new Error('nope')),
    };
    const fetchMock = vi.fn().mockResolvedValue(badResponse);

    await expect(loadMeta('./assets/atlas.json', { fetch: fetchMock })).rejects.toThrow(
      'Failed to parse atlas metadata: ./assets/atlas.json',
    );
  });

  it('falls back gracefully when metadata request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const result = await loadAtlas({ fetch: fetchMock });

    expect(result.ok).toBe(false);
    expect(result.metadata).toBeNull();
    expect(result.frames.size).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('parses atlas metadata and resolves frames when available', async () => {
    const metadata = {
      meta: { image: 'atlas.png', scale: '1' },
      frames: {
        'characters/avatar_idle': { frame: { x: 0, y: 0, w: 32, h: 32 } },
        'tiles/grass': {
          frame: { x: 32, y: 0, w: 16, h: 16 },
          sourceSize: { w: 32, h: 32 },
          spriteSourceSize: { x: 8, y: 8, w: 16, h: 16 },
        },
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(metadata) });

    const result = await loadAtlas({
      fetch: fetchMock,
      createImage: () => new FakeImage(),
      optional: false,
    });

    expect(result.ok).toBe(true);
    expect(result.metadata).toEqual(metadata);
    expect(result.frames.size).toBe(2);

    const frame = result.frames.get('tiles/grass');
    expect(frame).toMatchObject({
      name: 'tiles/grass',
      x: 32,
      y: 0,
      width: 16,
      height: 16,
      spriteSourceSize: { x: 8, y: 8, width: 16, height: 16 },
      sourceSize: { width: 32, height: 32 },
    });
  });

  it('extracts frames from array metadata', () => {
    const metadata = {
      frames: [
        { filename: 'effects/fire', frame: { x: 0, y: 0, w: 24, h: 24 } },
        { name: 'ui/button', frame: { x: 24, y: 0, w: 48, h: 16 } },
      ],
    };

    const frames = extractFrames(metadata);
    expect(frames.size).toBe(2);
    expect(frames.get('effects/fire')).toMatchObject({ width: 24, height: 24 });
    expect(frames.get('ui/button')).toMatchObject({ width: 48, height: 16 });
  });

  it('resolves URLs relative to module base', () => {
    const resolved = resolveAtlasUrl('./foo/bar.png', 'https://example.com/game/atlas.json');
    expect(resolved).toBe('https://example.com/game/foo/bar.png');
  });
});

