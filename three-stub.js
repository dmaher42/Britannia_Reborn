// Three.js stub for testing without external dependencies
export class WebGLRenderer {
  constructor(options) {
    this.domElement = document.createElement('canvas');
    this.domElement.id = 'three-stub';
  }
  setSize() {}
  render() {}
  setPixelRatio() {}
  setClearColor() {}
}

export class Scene {}
export class Group {}
export class PerspectiveCamera {
  constructor() {
    this.aspect = 1;
  }
  updateProjectionMatrix() {}
  position = { set() {} };
  lookAt() {}
}
export class Object3D {
  constructor() {
    this.position = { set() {}, clone: () => ({ x: 0, y: 0, z: 0 }) };
  }
}
export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
}
export class Matrix4 {
  setPosition() { return this; }
}
export class Color {
  setHex() { return this; }
}
export class Raycaster {
  setFromCamera() {}
  ray = { intersectPlane: () => null };
}
export class Plane {}
export class PlaneGeometry {
  rotateX() {}
}
export class MeshStandardMaterial {}
export class Mesh {}
export class InstancedMesh {
  setMatrixAt() {}
  setColorAt() {}
  instanceMatrix = { needsUpdate: false };
  instanceColor = { needsUpdate: false };
}
export class HemisphereLight {}
export class DirectionalLight {
  constructor() {
    this.position = { set() {} };
    this.shadow = { mapSize: { set() {} } };
  }
}

export const SRGBColorSpace = 'srgb';
export const ACESFilmicToneMapping = 'aces';
export const PCFSoftShadowMap = 'pcf';