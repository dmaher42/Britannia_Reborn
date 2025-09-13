import * as THREE from 'three';
import { scene } from './renderer.js';

const W = 64;
const H = 64;
const TILE = 1;

function getInstanceIndexForGrid(x, z) {
  return z * W + x;
}

const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const geo = new THREE.PlaneGeometry(TILE * 1.05, TILE * 1.05);
geo.rotateX(-Math.PI / 2);
const mat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff66, transparent: true, opacity: 0, depthWrite: false });
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
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;
  const gridX = Math.floor(hit.x / TILE + W / 2);
  const gridZ = Math.floor(hit.z / TILE + H / 2);
  if (gridX < 0 || gridX >= W || gridZ < 0 || gridZ >= H) return null;
  return { index: getInstanceIndexForGrid(gridX, gridZ), gridX, gridZ };
}

export { getInstanceIndexForGrid };
