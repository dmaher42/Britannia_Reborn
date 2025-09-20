const parseHexColor = (hex) => {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  if (normalized.length === 3) {
    const r = parseInt(normalized[0] + normalized[0], 16);
    const g = parseInt(normalized[1] + normalized[1], 16);
    const b = parseInt(normalized[2] + normalized[2], 16);
    return { r, g, b };
  }
  if (normalized.length === 6) {
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16),
    };
  }
  return { r: 255, g: 255, b: 255 };
};

export class LightingSystem {
  constructor(canvas, worldRenderer) {
    this.canvas = canvas;
    this.worldRenderer = worldRenderer;
    this.lightSources = [];
    this.ambientLight = 0.35;
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d');
    this.setupLightCanvas();
  }

  setupLightCanvas() {
    if (!this.lightCanvas || !this.canvas) return;
    if (this.lightCanvas.width !== this.canvas.width || this.lightCanvas.height !== this.canvas.height) {
      this.lightCanvas.width = this.canvas.width;
      this.lightCanvas.height = this.canvas.height;
    }
  }

  addLightSource(x, y, radius, intensity, color = '#ffffff', options = {}) {
    this.lightSources.push({
      worldX: x,
      worldY: y,
      radius,
      intensity,
      color,
      radiusIsPixels: options.units === 'pixel' || (radius ?? 0) > 10,
      flickering: Boolean(options.flickering),
      flickerSpeed: options.flickerSpeed ?? 120,
      lastFlicker: performance.now(),
    });
  }

  addTorchLight(x, y) {
    this.addLightSource(x, y, 64, 0.85, '#ffb347', { flickering: true, units: 'pixel', flickerSpeed: 90 });
  }

  clearLights() {
    this.lightSources.length = 0;
  }

  updateLighting() {
    this.setupLightCanvas();
    if (!this.lightCtx) return;
    const ctx = this.lightCtx;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const ambient = Math.max(0, Math.min(1, 1 - this.ambientLight));
    ctx.fillStyle = `rgba(0, 0, 0, ${ambient})`;
    ctx.fillRect(0, 0, this.lightCanvas.width, this.lightCanvas.height);
    this.lightSources.forEach((light) => {
      if (light.flickering) {
        this.updateFlicker(light);
      }
      this.renderLight(light);
    });
    ctx.restore();
  }

  updateFlicker(light) {
    const now = performance.now();
    if (now - light.lastFlicker < light.flickerSpeed) {
      return;
    }
    light.lastFlicker = now;
    const variance = (Math.random() - 0.5) * 0.1;
    light.intensity = Math.max(0.2, Math.min(1, light.intensity + variance));
  }

  renderLight(light) {
    if (!this.lightCtx || !this.worldRenderer) return;
    const ctx = this.lightCtx;
    const screen = this.worldRenderer.worldToScreen(light.worldX, light.worldY, { align: 'center' });
    if (!screen) return;
    const { r, g, b } = parseHexColor(light.color ?? '#ffffff');
    const tileSize = this.worldRenderer.tileDisplaySize ?? 64;
    const radiusPixels = light.radiusIsPixels ? light.radius : light.radius * tileSize;
    const centerX = screen.x + tileSize / 2;
    const centerY = screen.y + tileSize / 2;
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radiusPixels);
    const intensity = Math.max(0, Math.min(1, light.intensity ?? 1));
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${intensity})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = gradient;
    ctx.fillRect(centerX - radiusPixels, centerY - radiusPixels, radiusPixels * 2, radiusPixels * 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  applyLighting() {
    if (!this.canvas || !this.lightCanvas) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.lightCanvas, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }
}
