import * as THREE from 'three';

let renderer;
let scene;
let camera;
let cameraRig;

function resolveContainer(container) {
  if (container) return container;
  const root = document.getElementById('root');
  if (root) return root;
  if (document.body) return document.body;
  throw new Error('Renderer container element was not found.');
}

export function initRenderer(container = null) {
  const target = resolveContainer(container);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.id = 'world3d-canvas';
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.domElement.style.zIndex = '0';
  renderer.setClearColor(0x000000, 0);

  const existing = document.getElementById('world3d-canvas');
  if (existing && existing !== renderer.domElement) {
    existing.replaceWith(renderer.domElement);
  } else if (renderer.domElement.parentElement !== target) {
    renderer.domElement.remove();
  }

  target.insertBefore(renderer.domElement, target.firstChild || null);

  scene = new THREE.Scene();
  scene.background = null;

  cameraRig = new THREE.Group();
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 5);
  camera.lookAt(0, 0, 0);
  cameraRig.add(camera);
  scene.add(cameraRig);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 2);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  scene.add(dir);

  window.addEventListener('resize', onWindowResize);

  return { renderer, scene, camera, cameraRig };
}

function onWindowResize() {
  if (!renderer || !camera) return;
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

export function render() {
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

export { renderer, scene, camera, cameraRig };
