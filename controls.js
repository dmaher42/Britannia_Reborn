const KEY_BINDINGS = {
  left: ['ArrowLeft', 'a', 'A'],
  right: ['ArrowRight', 'd', 'D'],
  up: ['ArrowUp', 'w', 'W'],
  down: ['ArrowDown', 's', 'S']
};

const KEYBOARD_EVENTS = ['keydown', 'keyup'];

export class InputController {
  constructor(target = window) {
    this.target = target;
    this.keys = new Set();
    this._handlers = new Map();
    this._install();
  }

  _install() {
    KEYBOARD_EVENTS.forEach((type) => {
      const handler = (event) => {
        if (event.type === 'keydown') {
          this.keys.add(event.key);
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
            event.preventDefault();
          }
        } else if (event.type === 'keyup') {
          this.keys.delete(event.key);
        }
      };
      this._handlers.set(type, handler);
      this.target.addEventListener(type, handler);
    });
  }

  destroy() {
    KEYBOARD_EVENTS.forEach((type) => {
      const handler = this._handlers.get(type);
      if (handler) {
        this.target.removeEventListener(type, handler);
      }
    });
    this._handlers.clear();
    this.keys.clear();
  }

  isKeyDown(key) {
    return this.keys.has(key);
  }

  getDirection() {
    let dx = 0;
    let dy = 0;

    if (this._anyDown(KEY_BINDINGS.left)) dx -= 1;
    if (this._anyDown(KEY_BINDINGS.right)) dx += 1;
    if (this._anyDown(KEY_BINDINGS.up)) dy -= 1;
    if (this._anyDown(KEY_BINDINGS.down)) dy += 1;

    if (dx === 0 && dy === 0) {
      return { x: 0, y: 0 };
    }

    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
  }

  _anyDown(keys) {
    return keys.some((key) => this.keys.has(key));
  }
}
