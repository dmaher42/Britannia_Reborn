export class GameLoop {
  constructor(game) {
    this.game = game;
    this.lastTime = 0;
    this.targetFPS = 60;
    this.frameTime = 1000 / this.targetFPS;
    this.running = false;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    this.running = false;
  }

  loop(currentTime) {
    if (!this.running) return;
    const deltaMs = currentTime - this.lastTime;
    if (deltaMs >= this.frameTime) {
      const deltaSeconds = deltaMs / 1000;
      this.game.update?.(deltaSeconds);
      this.game.animationSystem?.updateAnimations(deltaSeconds);
      this.game.effectsRenderer?.updateEffects(deltaSeconds);
      this.game.particleSystem?.update(deltaSeconds);

      this.game.worldRenderer?.render();
      this.game.effectsRenderer?.render();
      const ctx = this.game.spriteRenderer?.ctx;
      if (ctx) {
        this.game.particleSystem?.render(ctx);
      }

      this.game.lightingSystem?.updateLighting();
      this.game.lightingSystem?.applyLighting();
      this.game.ui?.render();
      this.lastTime = currentTime;
    }
    requestAnimationFrame((time) => this.loop(time));
  }
}
