import * as THREE from 'three';
import { renderer, scene } from './renderer.js';

// --- Highlight Utilities ---
const W = 64;
const H = 64;
const TILE = 1;

function getInstanceIndexForGrid(x, z) {
  return z * W + x;
}

// Raycaster and plane for screen-to-world projection
const raycaster = new THREE.Raycaster();
const groundNormal = new THREE.Vector3(0, 1, 0);
const groundPlane = new THREE.Plane(groundNormal, 0);

// Highlight mesh for hover/click feedback
const geo = new THREE.PlaneGeometry(TILE * 1.05, TILE * 1.05);
geo.rotateX(-Math.PI / 2);
const mat = new THREE.MeshStandardMaterial({
  color: 0xffff00,
  emissive: 0xffff66,
  transparent: true,
  opacity: 0,
  depthWrite: false
});
const highlight = new THREE.Mesh(geo, mat);
highlight.position.y = 0.01;
highlight.renderOrder = 999;
highlight.castShadow = false;
highlight.receiveShadow = false;
scene.add(highlight);

let targetOpacity = 0;
export function setHighlightGrid(x, z) {
  highlight.position.set((x - W / 2 + 0.5) * TILE, 0.01, (z - H / 2 + 0.5) * TILE);
  targetOpacity = 0.6;
}
export function hideHighlight() {
  targetOpacity = 0;
}
export function updateHighlight() {
  mat.opacity += (targetOpacity - mat.opacity) * 0.2;
  highlight.visible = mat.opacity > 0.01;
}
export function raycastTileFromScreen(x, y, camera) {
  raycaster.setFromCamera({ x, y }, camera);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null;
  const gridX = Math.floor(hit.x / TILE + W / 2);
  const gridZ = Math.floor(hit.z / TILE + H / 2);
  if (gridX < 0 || gridX >= W || gridZ < 0 || gridZ >= H) return null;
  return { index: getInstanceIndexForGrid(gridX, gridZ), gridX, gridZ };
}

// --- World Management Utilities ---
export const TILE_TYPES = {
  grass: 0x3a5d2a,
  road: 0x8b6e4a,
  water: 0x3a6ea5,
  town: 0xbfb398
};

let width = 0, depth = 0;
let tileMesh, hero, worldGroup;
let cameraRig = null;
let highlightTarget = 0;

const matrix = new THREE.Matrix4();
const color = new THREE.Color();
const tileColors = [];

export function initWorld3D(w = 32, d = 32) {
  width = w; depth = d;
  worldGroup = new THREE.Group();

  const geom = new THREE.PlaneGeometry(1, 1);
  geom.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true });
  tileMesh = new THREE.InstancedMesh(geom, mat, w * d);

  let i = 0;
  for (let z = 0; z < d; z++) {
    for (let x = 0; x < w; x++) {
      matrix.setPosition(x + 0.5, 0, z + 0.5);
      tileMesh.setMatrixAt(i, matrix);
      const col = TILE_TYPES.grass;
      tileMesh.setColorAt(i, color.setHex(col));
      tileColors[i] = col;
      i++;
    }
  }
  tileMesh.instanceMatrix.needsUpdate = true;
  tileMesh.instanceColor.needsUpdate = true;
  worldGroup.add(tileMesh);

  const heroGeo = new THREE.SphereGeometry(0.3, 16, 16);
  const heroMat = new THREE.MeshStandardMaterial({ color: 0xffee00 });
  hero = new THREE.Mesh(heroGeo, heroMat);
  hero.castShadow = true;
  hero.position.set(0.5, 0.3, 0.5);
  worldGroup.add(hero);

  // Highlight mesh for selection (already added to scene above)
  // highlight is managed globally for now

  return { world: worldGroup, tiles: tileMesh, hero };
}

export function attachCameraRig(rig) {
  cameraRig = rig;
  if (cameraRig) {
    cameraRig.position.set(0, 0, 0);
  }
}

export function updateWorld3D(dt) {
  if (cameraRig && hero) {
    const target = new THREE.Vector3(hero.position.x, 0, hero.position.z);
    cameraRig.position.lerp(target, Math.min(1, dt * 5));
  }
  if (highlight) {
    const mat = highlight.material;
    mat.opacity += (highlightTarget - mat.opacity) * Math.min(1, dt * 10);
    highlight.visible = mat.opacity > 0.01;
  }
}

export function setTileColor(x, z, hex) {
  if (!tileMesh) return;
  const index = z * width + x;
  tileMesh.setColorAt(index, color.setHex(hex));
  tileColors[index] = hex;
  tileMesh.instanceColor.needsUpdate = true;
}

export function getTileColor(x, z) {
  const index = z * width + x;
  return tileColors[index];
}

export function getInstanceIndexForGrid(x, z) {
  return z * width + x;
}

export function raycastTileFromScreen(x, y, camera) {
  if (!renderer) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  const ndcX = (x - rect.left) / rect.width * 2 - 1;
  const ndcY = -(y - rect.top) / rect.height * 2 + 1;
  raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
  const p = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
  if (!p) return null;
  const gridX = Math.floor(p.x);
  const gridZ = Math.floor(p.z);
  if (gridX < 0 || gridZ < 0 || gridX >= width || gridZ >= depth) return null;
  return { index: getInstanceIndexForGrid(gridX, gridZ), gridX, gridZ };
}

export function setHighlightGrid(x, z) {
  if (!highlight) return;
  highlight.position.set(x + 0.5, 0.01, z + 0.5);
  highlightTarget = 0.4;
}

export function hideHighlight() {
  highlightTarget = 0;
}

export function getHeroWorldPos() {
  return hero ? hero.position.clone() : new THREE.Vector3();
}

export function moveHeroToTile(x, z) {
  if (!hero) return;
  hero.position.set(x + 0.5, 0.3, z + 0.5);
}