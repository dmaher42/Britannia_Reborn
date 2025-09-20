import * as THREE from 'https://esm.sh/three@0.160';
import { EffectComposer } from 'https://esm.sh/three@0.160/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.160/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.160/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'https://esm.sh/three@0.160/examples/jsm/postprocessing/OutlinePass.js';
import { ShaderPass } from 'https://esm.sh/three@0.160/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Graphics configuration shared with the host application.
 * `toneLevels` controls the cel-shading quantisation points while
 * `outlineThickness` feeds directly into the OutlinePass.
 */
export const Graphics = {
  toneLevels: [0.0, 0.55, 1.0],
  outlineThickness: 1.5,
};

let renderer = null;
let scene = null;
let camera = null;
let composer = null;
let renderPass = null;
let outlinePass = null;
let bloomPass = null;
let celPass = null;
let textureLoader = null;
let gaussianLightTexture = null;
let canvasRef = null;
let configRef = {};

const viewport = { width: 1, height: 1, dpr: 1 };
const currentCamera = { x: 0, y: 0 };
const layers = { background: null, mid: null, near: null };
let lightsGroup = null;

const CAMERA_LAYERS = Object.freeze({ background: 0, mid: 1, near: 2 });
const DEFAULT_VISIBLE_LAYERS = Object.keys(CAMERA_LAYERS);
const activeLayerMask = new Set(DEFAULT_VISIBLE_LAYERS);
const DEFAULT_CAMERA_NEAR = 0.1;
const DEFAULT_CAMERA_FAR = 5000;

function normaliseLayerName(layerName) {
  return typeof layerName === 'string' ? layerName : '';
}

function isKnownLayer(layerName) {
  return Object.prototype.hasOwnProperty.call(CAMERA_LAYERS, layerName);
}

function getLayerBit(layerName) {
  const key = normaliseLayerName(layerName);
  if (isKnownLayer(key)) {
    return CAMERA_LAYERS[key];
  }
  return CAMERA_LAYERS.mid;
}

function assignObjectToLayer(object, layerName) {
  if (!object) return;
  const key = isKnownLayer(layerName) ? layerName : 'mid';
  const bit = getLayerBit(key);
  if (object.layers && typeof object.layers.set === 'function') {
    object.layers.set(bit);
  }
  if (object.visible === false) {
    object.visible = true;
  }
  if (typeof object.traverse === 'function') {
    object.traverse((child) => {
      if (child.layers && typeof child.layers.set === 'function') {
        child.layers.set(bit);
      }
      if (child.visible === false) {
        child.visible = true;
      }
    });
  }
}

function updateGroupVisibility() {
  Object.entries(layers).forEach(([name, group]) => {
    if (!group) return;
    group.visible = activeLayerMask.has(name);
  });
  if (lightsGroup) {
    lightsGroup.visible = activeLayerMask.has('near');
  }
}

function applyCameraLayerMask() {
  if (!camera) return;
  const bits = Array.from(activeLayerMask)
    .map((name) => getLayerBit(name))
    .filter((bit, index, array) => array.indexOf(bit) === index);
  if (bits.length === 0) {
    camera.layers.set(0);
    return;
  }
  camera.layers.set(bits[0]);
  for (let i = 1; i < bits.length; i += 1) {
    camera.layers.enable(bits[i]);
  }
}

function applyVisibleLayerSet(layerNames) {
  activeLayerMask.clear();
  const desired = Array.isArray(layerNames) && layerNames.length ? layerNames : DEFAULT_VISIBLE_LAYERS;
  desired.forEach((name) => {
    const key = normaliseLayerName(name);
    if (isKnownLayer(key)) {
      activeLayerMask.add(key);
    }
  });
  if (activeLayerMask.size === 0) {
    DEFAULT_VISIBLE_LAYERS.forEach((name) => activeLayerMask.add(name));
  }
  configRef.visibleLayers = Array.from(activeLayerMask);
  updateGroupVisibility();
  applyCameraLayerMask();
}

function assignGroupLayers() {
  Object.entries(layers).forEach(([name, group]) => {
    if (!group) return;
    assignObjectToLayer(group, name);
  });
  if (lightsGroup) {
    assignObjectToLayer(lightsGroup, 'near');
  }
}

function sanitiseClippingValues(near, far) {
  const resolvedNear = Number.isFinite(near) ? Math.max(0.01, near) : DEFAULT_CAMERA_NEAR;
  const farCandidate = Number.isFinite(far) ? far : DEFAULT_CAMERA_FAR;
  const resolvedFar = Math.max(resolvedNear + 1, farCandidate);
  return { near: resolvedNear, far: resolvedFar };
}

const PARALLAX_FACTORS = {
  background: 0.2,
  mid: 0.5,
  near: 0.8,
};
let parallaxEnabled = true;
let parallaxOrigin = null;

const textureCache = new Map();
const textureSubscribers = new Map();
const meshRegistry = new Map();
const outlineSelection = new Set();
let pixelArtMode = false;
let lastFrameTime = performance.now();

/**
 * Ensure filters honour the current pixel art toggle.
 */
function applyTextureFilters(texture) {
  if (!texture) return;
  texture.magFilter = pixelArtMode ? THREE.NearestFilter : THREE.LinearFilter;
  texture.minFilter = pixelArtMode ? THREE.NearestFilter : THREE.LinearFilter;
  texture.generateMipmaps = !pixelArtMode;
  texture.needsUpdate = true;
}

function configureTexture(texture) {
  if (!texture) return;
  texture.encoding = THREE.sRGBEncoding;
  if ('colorSpace' in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  if (renderer) {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  applyTextureFilters(texture);
}

function createFallbackTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#cc00ff';
  ctx.fillRect(0, 0, 2, 2);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillRect(1, 1, 1, 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  if ('colorSpace' in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 1;
  return texture;
}

function subscribeToTexture(url, callback) {
  if (!textureSubscribers.has(url)) {
    textureSubscribers.set(url, new Set());
  }
  const pool = textureSubscribers.get(url);
  pool.add(callback);
  const texture = textureCache.get(url);
  if (texture && texture.image && texture.image.width) {
    callback(texture.image);
  }
  return () => {
    pool.delete(callback);
  };
}

function notifyTextureReady(url) {
  const texture = textureCache.get(url);
  if (!texture || !texture.image || !texture.image.width) return;
  const pool = textureSubscribers.get(url);
  if (!pool) return;
  pool.forEach((cb) => {
    try {
      cb(texture.image);
    } catch (err) {
      console.warn('[world3d] Texture subscriber error', err);
    }
  });
}

function loadTexture(url) {
  if (textureCache.has(url)) {
    return textureCache.get(url);
  }
  if (!textureLoader) {
    textureLoader = new THREE.TextureLoader();
  }
  const texture = textureLoader.load(
    url,
    () => {
      configureTexture(texture);
      notifyTextureReady(url);
    },
    undefined,
    (err) => {
      console.warn(`[world3d] Missing texture at ${url}`, err);
      const fallback = createFallbackTexture();
      texture.image = fallback.image;
      texture.needsUpdate = true;
      configureTexture(texture);
      notifyTextureReady(url);
    }
  );
  configureTexture(texture);
  textureCache.set(url, texture);
  if (texture.image && texture.image.width) {
    notifyTextureReady(url);
  }
  return texture;
}

function updateSpriteWorldTransform(mesh) {
  if (!mesh || !mesh.userData) return;
  const world = mesh.userData.world || { x: 0, y: 0, z: 0 };
  const size = mesh.userData.size || { width: 1, height: 1 };
  const centerX = world.x + size.width / 2;
  const centerY = world.y + size.height / 2;
  mesh.position.set(centerX, -centerY, world.z || 0);
}

function loadSpritePlane(url, opts = {}) {
  const texture = loadTexture(url);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = opts.name || `sprite:${url}`;
  mesh.frustumCulled = false;
  mesh.userData = mesh.userData || {};
  mesh.userData.url = url;
  mesh.userData.layer = opts.layer || 'mid';
  mesh.userData.size = {
    width: opts.width || (texture.image && texture.image.width) || 1,
    height: opts.height || (texture.image && texture.image.height) || 1,
  };
  mesh.userData.world = {
    x: opts.x || 0,
    y: opts.y || 0,
    z: opts.z || 0,
  };

  assignObjectToLayer(mesh, mesh.userData.layer);

  const refresh = (image) => {
    const width = opts.width || image.width || 1;
    const height = opts.height || image.height || 1;
    mesh.userData.size.width = width;
    mesh.userData.size.height = height;
    mesh.scale.set(width, height, 1);
    updateSpriteWorldTransform(mesh);
  };

  subscribeToTexture(url, refresh);
  refresh(mesh.userData.size);
  return mesh;
}

function createInstancedSpritePlane(url, count, opts = {}) {
  const texture = loadTexture(url);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const geometry = new THREE.PlaneGeometry(1, 1);
  const instanced = new THREE.InstancedMesh(geometry, material, count);
  instanced.name = opts.name || `instanced:${url}`;
  instanced.frustumCulled = false;
  instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instanced.userData.size = {
    width: opts.width || (texture.image && texture.image.width) || 1,
    height: opts.height || (texture.image && texture.image.height) || 1,
  };
  instanced.userData.instances = new Array(count).fill(null);
  assignObjectToLayer(instanced, opts.layer || 'mid');

  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3(instanced.userData.size.width, instanced.userData.size.height, 1);
  const position = new THREE.Vector3();

  const applyInstance = (index) => {
    const data = instanced.userData.instances[index];
    if (!data) return;
    const size = instanced.userData.size;
    position.set(data.x + size.width / 2, -(data.y + size.height / 2), data.z || 0);
    scale.set(size.width, size.height, 1);
    quat.identity();
    matrix.compose(position, quat, scale);
    instanced.setMatrixAt(index, matrix);
  };

  instanced.userData.setInstance = (index, x, y, z = 0) => {
    if (index < 0 || index >= count) return;
    instanced.userData.instances[index] = { x, y, z };
    applyInstance(index);
    instanced.instanceMatrix.needsUpdate = true;
  };

  const refresh = (image) => {
    const width = opts.width || image.width || 1;
    const height = opts.height || image.height || 1;
    instanced.userData.size.width = width;
    instanced.userData.size.height = height;
    for (let i = 0; i < count; i += 1) {
      if (instanced.userData.instances[i]) {
        applyInstance(i);
      }
    }
    instanced.instanceMatrix.needsUpdate = true;
  };
  subscribeToTexture(url, refresh);
  refresh(instanced.userData.size);
  return instanced;
}

function computeViewport() {
  if (!canvasRef) {
    return { width: 1, height: 1 };
  }
  const rect = canvasRef.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width || canvasRef.clientWidth || window.innerWidth || 1));
  const height = Math.max(1, Math.floor(rect.height || canvasRef.clientHeight || window.innerHeight || 1));
  return { width, height };
}

function handleResize() {
  if (!renderer || !camera || !canvasRef) return;
  const { width, height } = computeViewport();
  viewport.width = width;
  viewport.height = height;
  viewport.dpr = Math.min(window.devicePixelRatio || 1, configRef.maxDpr || 2);
  renderer.setPixelRatio(viewport.dpr);
  renderer.setSize(width, height, false);

  const halfWidth = width / 2;
  const halfHeight = height / 2;
  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();

  const resolutionX = width * viewport.dpr;
  const resolutionY = height * viewport.dpr;
  outlinePass.resolution.set(resolutionX, resolutionY);
  bloomPass.setSize(resolutionX, resolutionY);
  composer.setSize(resolutionX, resolutionY);

  // Re-apply camera position to keep view anchored when resizing.
  setCamera(currentCamera.x, currentCamera.y);
}

function ensureRenderer(canvas) {
  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: false,
  });
  renderer.autoClear = true;
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
}

function ensureSceneGraph() {
  scene = new THREE.Scene();
  layers.background = new THREE.Group();
  layers.mid = new THREE.Group();
  layers.near = new THREE.Group();

  layers.background.position.z = -15;
  layers.mid.position.z = 0;
  layers.near.position.z = 15;

  lightsGroup = new THREE.Group();
  lightsGroup.name = 'lights';
  layers.near.add(lightsGroup);

  scene.add(layers.background);
  scene.add(layers.mid);
  scene.add(layers.near);
  assignGroupLayers();
  updateGroupVisibility();
}

function ensureCamera() {
  const { width, height } = computeViewport();
  viewport.width = width;
  viewport.height = height;
  viewport.dpr = Math.min(window.devicePixelRatio || 1, configRef.maxDpr || 2);

  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const { near, far } = sanitiseClippingValues(configRef.cameraNear, configRef.cameraFar);
  camera = new THREE.OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, near, far);
  camera.position.set(0, 0, 100);
  camera.lookAt(new THREE.Vector3(0, 0, 0));
  configRef.cameraNear = near;
  configRef.cameraFar = far;
  applyCameraLayerMask();
}

function ensureComposer() {
  composer = new EffectComposer(renderer);
  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  outlinePass = new OutlinePass(new THREE.Vector2(viewport.width, viewport.height), scene, camera);
  outlinePass.edgeStrength = 2.5;
  outlinePass.edgeGlow = 0.0;
  outlinePass.edgeThickness = Graphics.outlineThickness;
  outlinePass.visibleEdgeColor.setRGB(0.08, 0.05, 0.12);
  outlinePass.hiddenEdgeColor.setRGB(0, 0, 0);
  outlinePass.selectedObjects = Array.from(outlineSelection);
  composer.addPass(outlinePass);

  bloomPass = new UnrealBloomPass(new THREE.Vector2(viewport.width, viewport.height), 0.35, 0.45, 0.2);
  composer.addPass(bloomPass);

  const midThreshold = (Graphics.toneLevels[0] + Graphics.toneLevels[1]) * 0.5;
  const highThreshold = (Graphics.toneLevels[1] + Graphics.toneLevels[2]) * 0.5;
  const celShader = {
    uniforms: {
      tDiffuse: { value: null },
      toneLevels: {
        value: new THREE.Vector3(
          Graphics.toneLevels[0],
          Graphics.toneLevels[1],
          Graphics.toneLevels[2]
        ),
      },
      toneThresholds: { value: new THREE.Vector2(midThreshold, highThreshold) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec3 toneLevels;
      uniform vec2 toneThresholds;
      varying vec2 vUv;
      void main() {
        vec4 color = texture2D(tDiffuse, vUv);
        float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        float band = toneLevels.x;
        if (luminance > toneThresholds.x) {
          band = toneLevels.y;
        }
        if (luminance > toneThresholds.y) {
          band = toneLevels.z;
        }
        if (luminance > 0.0) {
          float ratio = band / max(luminance, 1e-4);
          color.rgb *= ratio;
        }
        gl_FragColor = color;
      }
    `,
  };
  celPass = new ShaderPass(celShader);
  celPass.renderToScreen = true;
  composer.addPass(celPass);
}

function loadParallaxBackdrops() {
  const spacing = configRef.backgroundSpacing || 1024;
  const sets = [
    {
      key: 'bakery',
      entries: [
        { file: 'sky.png', layer: 'background', z: -5 },
        { file: 'walls.png', layer: 'mid', z: 0 },
        { file: 'details.png', layer: 'near', z: 4 },
      ],
    },
    {
      key: 'plaza',
      entries: [
        { file: 'stars.png', layer: 'background', z: -5 },
        { file: 'treeline.png', layer: 'mid', z: 0 },
        { file: 'market.png', layer: 'near', z: 4 },
      ],
    },
  ];

  sets.forEach((set, setIndex) => {
    const offsetX = setIndex * spacing;
    set.entries.forEach((entry) => {
      const url = `/assets/backgrounds/${set.key}/${entry.file}`;
      const sprite = loadSpritePlane(url, {
        x: offsetX,
        y: 0,
        z: entry.z,
        layer: entry.layer,
        name: `${set.key}:${entry.file}`,
      });
      addSprite(`${set.key}-${entry.file}`, sprite, {
        layer: entry.layer,
        x: offsetX,
        y: 0,
        z: entry.z,
        outlined: false,
      });
    });
  });
}

function buildDemoInstancing() {
  const count = 20;
  const barrels = createInstancedSpritePlane('/assets/props/barrel.png', count, {
    name: 'demo:barrels',
  });
  const startX = 64;
  const spacing = 48;
  const baseY = 384;
  for (let i = 0; i < count; i += 1) {
    const x = startX + spacing * i;
    barrels.userData.setInstance(i, x, baseY, 2);
  }
  layers.mid.add(barrels);
}

function getGaussianLightTexture() {
  if (gaussianLightTexture) return gaussianLightTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  gaussianLightTexture = new THREE.CanvasTexture(canvas);
  gaussianLightTexture.encoding = THREE.sRGBEncoding;
  if ('colorSpace' in gaussianLightTexture) {
    gaussianLightTexture.colorSpace = THREE.SRGBColorSpace;
  }
  gaussianLightTexture.needsUpdate = true;
  gaussianLightTexture.wrapS = THREE.ClampToEdgeWrapping;
  gaussianLightTexture.wrapT = THREE.ClampToEdgeWrapping;
  gaussianLightTexture.magFilter = THREE.LinearFilter;
  gaussianLightTexture.minFilter = THREE.LinearFilter;
  gaussianLightTexture.generateMipmaps = false;
  gaussianLightTexture.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 1;
  return gaussianLightTexture;
}

function disposeLights() {
  if (!lightsGroup) return;
  while (lightsGroup.children.length) {
    const child = lightsGroup.children.pop();
    if (child.material) child.material.dispose();
    if (child.geometry) child.geometry.dispose();
  }
}

function setLights(lights = []) {
  if (!lightsGroup) return;
  disposeLights();
  const texture = getGaussianLightTexture();
  lights.forEach((light, index) => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      color: new THREE.Color(1, 1, 1),
    });
    material.opacity = THREE.MathUtils.clamp(light.intensity ?? 1, 0, 2);
    const mesh = new THREE.Mesh(geometry, material);
    const radius = light.radius ?? 96;
    mesh.scale.set(radius * 2, radius * 2, 1);
    const z = (light.z ?? 0) + 12 + index * 0.01;
    mesh.position.set(light.x ?? 0, -(light.y ?? 0), z);
    mesh.name = `light:${index}`;
    assignObjectToLayer(mesh, 'near');
    lightsGroup.add(mesh);
  });
}

function resetParallax() {
  Object.values(layers).forEach((group) => {
    if (group) {
      group.position.x = 0;
      group.position.y = 0;
    }
  });
}

function setParallax(cameraPos) {
  if (!parallaxEnabled) {
    resetParallax();
    return;
  }
  if (!parallaxOrigin) {
    parallaxOrigin = { x: cameraPos.x, y: cameraPos.y };
  }
  const dx = cameraPos.x - parallaxOrigin.x;
  const dy = cameraPos.y - parallaxOrigin.y;
  const apply = (group, factor) => {
    if (!group) return;
    group.position.x = dx * (1 - factor);
    group.position.y = -dy * (1 - factor);
  };
  apply(layers.background, PARALLAX_FACTORS.background);
  apply(layers.mid, PARALLAX_FACTORS.mid);
  apply(layers.near, PARALLAX_FACTORS.near);
}

function setCamera(x = 0, y = 0) {
  if (!camera) return;
  currentCamera.x = x;
  currentCamera.y = y;
  const centerX = x + viewport.width / 2;
  const centerY = y + viewport.height / 2;
  camera.position.set(centerX, -centerY, camera.position.z);
  camera.updateMatrixWorld();
  camera.lookAt(centerX, -centerY, 0);
  setParallax(currentCamera);
}

function setCameraClipping(options = {}) {
  if (!camera) return;
  const targetNear = Number.isFinite(options.near) ? options.near : camera.near;
  const targetFar = Number.isFinite(options.far) ? options.far : camera.far;
  const { near, far } = sanitiseClippingValues(targetNear, targetFar);
  camera.near = near;
  camera.far = far;
  camera.updateProjectionMatrix();
  configRef.cameraNear = near;
  configRef.cameraFar = far;
}

function addSprite(name, mesh, options = {}) {
  if (!mesh) return null;
  const layerName = options.layer || mesh.userData.layer || 'mid';
  const layer = layers[layerName] || layers.mid;
  const worldX = options.x ?? mesh.userData.world?.x ?? 0;
  const worldY = options.y ?? mesh.userData.world?.y ?? 0;
  const worldZ = options.z ?? mesh.userData.world?.z ?? 0;
  mesh.userData.layer = layerName;
  mesh.userData.world = { x: worldX, y: worldY, z: worldZ };
  assignObjectToLayer(mesh, layerName);
  updateSpriteWorldTransform(mesh);
  layer.add(mesh);
  meshRegistry.set(name, mesh);

  const shouldOutline = options.outlined ?? true;
  if (shouldOutline && mesh.isMesh) {
    outlineSelection.add(mesh);
    outlinePass.selectedObjects = Array.from(outlineSelection);
  }
  return mesh;
}

function setParallaxEnabled(flag) {
  const enabled = Boolean(flag);
  if (enabled === parallaxEnabled) return;
  parallaxEnabled = enabled;
  if (!enabled) {
    parallaxOrigin = null;
    resetParallax();
  } else {
    parallaxOrigin = { x: currentCamera.x, y: currentCamera.y };
    setParallax(currentCamera);
  }
}

function setVisibleLayers(layerNames) {
  applyVisibleLayerSet(layerNames);
}

function setLayerVisibility(layerName, visible = true) {
  const key = normaliseLayerName(layerName);
  if (!isKnownLayer(key)) {
    console.warn(`[world3d] Unknown layer "${layerName}"`);
    return;
  }
  const next = new Set(activeLayerMask);
  if (visible) {
    next.add(key);
  } else {
    next.delete(key);
  }
  if (next.size === 0) {
    next.add('mid');
  }
  applyVisibleLayerSet(Array.from(next));
}

function initThreeWorld(canvas, config = {}) {
  if (!canvas) {
    throw new Error('initThreeWorld requires a canvas element');
  }
  canvasRef = canvas;
  configRef = config;

  ensureRenderer(canvasRef);
  ensureSceneGraph();
  ensureCamera();
  ensureComposer();
  setPixelArtMode(Boolean(config.pixelArtMode));
  applyVisibleLayerSet(config.visibleLayers);

  loadParallaxBackdrops();
  buildDemoInstancing();
  if (Array.isArray(config.initialLights)) {
    setLights(config.initialLights);
  }

  handleResize();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize);
  }

  return {
    addSprite,
    setCamera,
    setCameraClipping,
    setParallaxEnabled,
    setLayerVisibility,
    setVisibleLayers,
    loadSpritePlane,
    createInstancedSpritePlane,
    getScene: () => scene,
    getRenderer: () => renderer,
  };
}

function renderThreeWorld(state = {}) {
  if (!renderer || !composer) return;
  const now = performance.now();
  const delta = Math.min((now - lastFrameTime) / 1000, 1 / 15);
  lastFrameTime = now;
  void delta; // reserved for future frame-dependent work (animations, easing).

  if (typeof state.pixelArtMode === 'boolean' && state.pixelArtMode !== pixelArtMode) {
    setPixelArtMode(state.pixelArtMode);
  }
  if (state.camera) {
    setCamera(state.camera.x || 0, state.camera.y || 0);
  }

  composer.render();
}

function setPixelArtMode(flag) {
  const desired = Boolean(flag);
  if (desired === pixelArtMode) return;
  pixelArtMode = desired;
  textureCache.forEach((texture) => applyTextureFilters(texture));
  if (gaussianLightTexture) {
    gaussianLightTexture.magFilter = THREE.LinearFilter;
    gaussianLightTexture.minFilter = THREE.LinearFilter;
  }
}

export {
  initThreeWorld,
  renderThreeWorld,
  setLights,
  setPixelArtMode,
  setLayerVisibility,
  setVisibleLayers,
  setCameraClipping,
};
