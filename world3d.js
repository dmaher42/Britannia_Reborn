import * as THREE from 'three';

export const TILE_TYPES = {
  grass: 0x3a5d2a,
  road: 0x8b6e4a,
  water: 0x3a6ea5,
  town: 0xbfb398
};

let width = 0, depth = 0;
let tileMesh, hero, worldGroup;
let cameraRig = null;

const matrix = new THREE.Matrix4();
const color = new THREE.Color();
const tileColors = [];
const raycaster = new THREE.Raycaster();

export function initWorld3D(w = 32, d = 32) {
  width = w; depth = d;
  worldGroup = new THREE.Group();

  const geom = new THREE.PlaneGeometry(1,1);
  geom.rotateX(-Math.PI/2);
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

  return { world: worldGroup, tiles: tileMesh, hero };
}

export function attachCameraRig(rig){
  cameraRig = rig;
  if(cameraRig){
    cameraRig.position.set(0,0,0);
  }
}

export function updateWorld3D(dt){
  if(cameraRig && hero){
    const target = new THREE.Vector3(hero.position.x, 0, hero.position.z);
    cameraRig.position.lerp(target, Math.min(1, dt * 5));
  }
}

export function setTileColor(x, z, hex){
  if(!tileMesh) return;
  const index = z * width + x;
  tileMesh.setColorAt(index, color.setHex(hex));
  tileColors[index] = hex;
  tileMesh.instanceColor.needsUpdate = true;
}

export function getTileColor(x, z){
  const index = z * width + x;
  return tileColors[index];
}

export function raycastTile(ndcX, ndcY, camera){
  if(!tileMesh) return null;
  raycaster.setFromCamera({x:ndcX, y:ndcY}, camera);
  const hit = raycaster.intersectObject(tileMesh, true)[0];
  if(!hit) return null;
  const p = hit.point;
  const tx = Math.floor(p.x);
  const tz = Math.floor(p.z);
  if(tx<0||tz<0||tx>=width||tz>=depth) return null;
  return { x: tx, z: tz, index: tz*width + tx };
}

export function getHeroWorldPos(){
  return hero ? hero.position.clone() : new THREE.Vector3();
}

export function moveHeroToTile(x, z){
  if(!hero) return;
  hero.position.set(x + 0.5, 0.3, z + 0.5);
}
