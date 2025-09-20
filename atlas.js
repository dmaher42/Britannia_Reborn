const MODULE_BASE_URL = typeof import.meta !== 'undefined' ? import.meta.url : undefined;

const DEFAULT_META_PATH = './assets/atlas.json';

function defaultFetch(url, options) {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('Global fetch is not available to load the texture atlas.');
  }
  return globalThis.fetch(url, options);
}

function resolveUrl(target, base = MODULE_BASE_URL) {
  if (!target) {
    return '';
  }

  try {
    // Absolute URLs and data URIs should be returned unchanged.
    if (/^([a-zA-Z][a-zA-Z\d+.-]*:|\/\/)/.test(target)) {
      return target;
    }
  } catch (error) {
    // If the regex test fails, fall through to the URL constructor logic.
  }

  const basesToTry = [base];

  if (typeof document !== 'undefined' && document.baseURI) {
    basesToTry.push(document.baseURI);
  }

  if (typeof location !== 'undefined' && location.href) {
    basesToTry.push(location.href);
  }

  for (const candidate of basesToTry) {
    if (!candidate) continue;
    try {
      return new URL(target, candidate).href;
    } catch (error) {
      // Try the next candidate.
    }
  }

  return target;
}

function normaliseSize(value, fallbackWidth, fallbackHeight) {
  if (!value || typeof value !== 'object') {
    return {
      width: fallbackWidth,
      height: fallbackHeight,
    };
  }

  const width = Number(value.w ?? value.width);
  const height = Number(value.h ?? value.height);

  return {
    width: Number.isFinite(width) ? width : fallbackWidth,
    height: Number.isFinite(height) ? height : fallbackHeight,
  };
}

function normaliseRect(value, fallbackWidth, fallbackHeight) {
  if (!value || typeof value !== 'object') {
    return {
      x: 0,
      y: 0,
      width: fallbackWidth,
      height: fallbackHeight,
    };
  }

  const x = Number(value.x ?? value.left);
  const y = Number(value.y ?? value.top);
  const width = Number(value.w ?? value.width);
  const height = Number(value.h ?? value.height);

  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    width: Number.isFinite(width) ? width : fallbackWidth,
    height: Number.isFinite(height) ? height : fallbackHeight,
  };
}

function normalisePivot(value) {
  if (!value || typeof value !== 'object') {
    return { x: 0, y: 0 };
  }
  const x = Number(value.x);
  const y = Number(value.y);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

function toFrameRecord(name, entry) {
  if (!entry) {
    return null;
  }

  const source = entry.frame ?? entry.bounds ?? entry;
  if (!source || typeof source !== 'object') {
    return null;
  }

  const x = Number(source.x ?? source.left);
  const y = Number(source.y ?? source.top);
  const width = Number(source.w ?? source.width);
  const height = Number(source.h ?? source.height);

  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }

  if (width <= 0 || height <= 0) {
    return null;
  }

  const frameName = entry.filename ?? entry.name ?? name;

  const frame = {
    name: frameName,
    x,
    y,
    width,
    height,
    frame: { x, y, w: width, h: height },
    rotated: Boolean(entry.rotated),
    trimmed: Boolean(entry.trimmed),
    sheet: entry.sheet ?? null,
    sourceSize: normaliseSize(entry.sourceSize, width, height),
    spriteSourceSize: normaliseRect(entry.spriteSourceSize, width, height),
    anchor: normalisePivot(entry.pivot ?? entry.anchor),
  };

  return frame;
}

function buildFrameMap(metadata) {
  const frames = new Map();
  const entries = metadata?.frames;

  if (!entries) {
    return frames;
  }

  if (Array.isArray(entries)) {
    entries.forEach((entry) => {
      const name = entry?.filename ?? entry?.name ?? null;
      const record = toFrameRecord(name, entry);
      if (record && record.name) {
        frames.set(record.name, record);
      }
    });
    return frames;
  }

  if (typeof entries === 'object') {
    Object.entries(entries).forEach(([key, entry]) => {
      const record = toFrameRecord(key, entry);
      if (record && record.name) {
        frames.set(record.name, record);
      }
    });
  }

  return frames;
}

function loadAtlasImage(url, { createImage, signal } = {}) {
  const imageFactory = typeof createImage === 'function' ? createImage : null;
  const ImageCtor = imageFactory ? null : globalThis.Image;

  if (!imageFactory && typeof ImageCtor !== 'function') {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const image = imageFactory ? imageFactory() : new ImageCtor();

    if (!image || typeof image.addEventListener !== 'function') {
      resolve(null);
      return;
    }

    let aborted = false;

    const cleanup = () => {
      image.removeEventListener?.('load', handleLoad);
      image.removeEventListener?.('error', handleError);
      if (signal && typeof signal.removeEventListener === 'function') {
        signal.removeEventListener('abort', handleAbort);
      }
    };

    const handleLoad = () => {
      cleanup();
      resolve(image);
    };

    const handleError = (event) => {
      cleanup();
      const reason = event?.error instanceof Error ? event.error : new Error(`Failed to load atlas image: ${url}`);
      reject(reason);
    };

    const handleAbort = () => {
      aborted = true;
      cleanup();
      reject(new Error('Loading the atlas image was aborted.'));
    };

    if (signal) {
      if (signal.aborted) {
        handleAbort();
        return;
      }
      if (typeof signal.addEventListener === 'function') {
        signal.addEventListener('abort', handleAbort, { once: true });
      }
    }

    image.addEventListener('load', handleLoad, { once: true });
    image.addEventListener('error', handleError, { once: true });

    try {
      if ('decoding' in image) {
        image.decoding = 'async';
      }
      image.src = url;
      if (aborted) {
        cleanup();
      }
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export async function loadMeta(metaUrl = DEFAULT_META_PATH, options = {}) {
  const fetchImpl = options.fetch ?? defaultFetch;
  const targetUrl = resolveUrl(metaUrl, options.baseUrl ?? MODULE_BASE_URL);
  const response = await fetchImpl(targetUrl, { signal: options.signal });

  if (!response || !response.ok) {
    throw new Error(`Failed to load atlas metadata: ${metaUrl}`);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to parse atlas metadata: ${metaUrl}`);
  }
}

export async function loadAtlas(options = {}) {
  const {
    metaUrl = DEFAULT_META_PATH,
    imageUrl = null,
    signal = undefined,
    fetch: fetchImpl,
    createImage = undefined,
    optional = true,
  } = options ?? {};

  try {
    const metadata = await loadMeta(metaUrl, { fetch: fetchImpl, signal, baseUrl: options.baseUrl });
    const atlasImagePath = imageUrl ?? metadata?.image ?? metadata?.meta?.image ?? 'atlas.png';
    const absoluteMetaUrl = resolveUrl(metaUrl, options.baseUrl ?? MODULE_BASE_URL);
    const resolvedImageUrl = resolveUrl(atlasImagePath, absoluteMetaUrl);

    let image = null;
    try {
      image = await loadAtlasImage(resolvedImageUrl, { createImage, signal });
    } catch (error) {
      if (!optional) {
        throw error;
      }
      console.warn('[TextureAtlas] Atlas image unavailable, using sprite sheets instead.', error);
      image = null;
    }

    const frames = buildFrameMap(metadata);
    return {
      ok: Boolean(image),
      image,
      metadata,
      frames,
    };
  } catch (error) {
    if (!optional) {
      throw error;
    }

    console.warn('[TextureAtlas] Failed to load atlas metadata, falling back to sprite sheets.', error);
    return {
      ok: false,
      image: null,
      metadata: null,
      frames: new Map(),
      error,
    };
  }
}

export function extractFrames(metadata) {
  return buildFrameMap(metadata);
}

export function resolveAtlasUrl(path, base) {
  return resolveUrl(path, base);
}

export function createAtlasImageLoader(url, options = {}) {
  return loadAtlasImage(url, options);
}

