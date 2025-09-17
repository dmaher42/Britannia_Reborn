import * as THREE from 'three';
import { renderer } from './renderer.js';

const DEFAULT_WIDTH = 32;
const DEFAULT_DEPTH = 32;
const TILE_SIZE = 1;

const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const highlightGeometry = new THREE.PlaneGeometry(TILE_SIZE * 1.05, TILE_SIZE * 1.05);
highlightGeometry.rotateX(-Math.PI / 2);
const highlightMaterial = new THREE.MeshStandardMaterial({
  color: 0xffff00,
  emissive: 0xffff66,
  transparent: true,
  opacity: 0,
  depthWrite: false
});
const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
highlight.position.y = 0.01;
highlight.renderOrder = 999;
highlight.castShadow = false;
highlight.receiveShadow = false;
highlight.visible = false;

let highlightOpacityTarget = 0;

let width = DEFAULT_WIDTH;
let depth = DEFAULT_DEPTH;
let tileMesh = null;
let hero = null;
let worldGroup = null;
let cameraRig = null;

const matrix = new THREE.Matrix4();
const color = new THREE.Color();
let tileColors = [];

export const TILE_TYPES = {
  grass: 0x3a5d2a,
  road: 0x8b6e4a,
  water: 0x3a6ea5,
  town: 0xbfb398
};

function resetHighlightState() {
  highlightOpacityTarget = 0;
  highlightMaterial.opacity = 0;
  highlight.visible = false;
}

export function initWorld3D(w = DEFAULT_WIDTH, d = DEFAULT_DEPTH) {
  width = w;
  depth = d;
  tileColors = new Array(width * depth);

  worldGroup = new THREE.Group();

  const geom = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
  geom.rotateX(-Math.PI / 2);
  const tilesMaterial = new THREE.MeshStandardMaterial({ vertexColors: true });
  tileMesh = new THREE.InstancedMesh(geom, tilesMaterial, width * depth);

  let i = 0;
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      matrix.setPosition(x + 0.5, 0, z + 0.5);
      tileMesh.setMatrixAt(i, matrix);
      const defaultColor = TILE_TYPES.grass;
      tileMesh.setColorAt(i, color.setHex(defaultColor));
      tileColors[i] = defaultColor;
      i++;
    }
  }
  tileMesh.instanceMatrix.needsUpdate = true;
  tileMesh.instanceColor.needsUpdate = true;
  worldGroup.add(tileMesh);

  hero = new THREE.Object3D();
  hero.position.set(0.5, 0.3, 0.5);
  worldGroup.add(hero);

  if (highlight.parent) {
    highlight.parent.remove(highlight);
  }
  worldGroup.add(highlight);
  resetHighlightState();

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

  const currentOpacity = highlightMaterial.opacity;
  highlightMaterial.opacity += (highlightOpacityTarget - currentOpacity) * Math.min(1, dt * 10);
  highlight.visible = highlightMaterial.opacity > 0.01;
}

export function setTileColor(x, z, hex) {
  if (!tileMesh) return;
  if (x < 0 || z < 0 || x >= width || z >= depth) return;
  const index = getInstanceIndexForGrid(x, z);
  tileMesh.setColorAt(index, color.setHex(hex));
  tileColors[index] = hex;
  tileMesh.instanceColor.needsUpdate = true;
}

export function getTileColor(x, z) {
  if (x < 0 || z < 0 || x >= width || z >= depth) return undefined;
  const index = getInstanceIndexForGrid(x, z);
  return tileColors[index];
}

export function getInstanceIndexForGrid(x, z) {
  return z * width + x;
}

export function raycastTileFromScreen(clientX, clientY, camera) {
  if (!renderer || !renderer.domElement) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);

  const point = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
  if (!point) return null;

  const gridX = Math.floor(point.x);
  const gridZ = Math.floor(point.z);
  if (gridX < 0 || gridZ < 0 || gridX >= width || gridZ >= depth) {
    return null;
  }

  return { index: getInstanceIndexForGrid(gridX, gridZ), gridX, gridZ };
}

export function setHighlightGrid(x, z) {
  highlight.position.set(x + 0.5, 0.01, z + 0.5);
  highlightOpacityTarget = 0.4;
}

export function hideHighlight() {
  highlightOpacityTarget = 0;
}

export function getHeroWorldPos() {
  return hero ? hero.position.clone() : new THREE.Vector3();
}

export function moveHeroToTile(x, z) {
  if (!hero) return;
  hero.position.set(x + 0.5, 0.3, z + 0.5);
}
