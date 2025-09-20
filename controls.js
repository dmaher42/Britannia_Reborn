const KEYBOARD_EVENTS = ['keydown', 'keyup'];

const KEY_MAP = new Map([
  ['ArrowUp', 'arrowup'],
  ['Up', 'arrowup'],
  ['arrowup', 'arrowup'],
  ['up', 'arrowup'],
  ['ArrowDown', 'arrowdown'],
  ['Down', 'arrowdown'],
  ['arrowdown', 'arrowdown'],
  ['down', 'arrowdown'],
  ['ArrowLeft', 'arrowleft'],
  ['Left', 'arrowleft'],
  ['arrowleft', 'arrowleft'],
  ['left', 'arrowleft'],
  ['ArrowRight', 'arrowright'],
  ['Right', 'arrowright'],
  ['arrowright', 'arrowright'],
  ['right', 'arrowright'],
  [' ', 'space'],
  ['Spacebar', 'space'],
  ['Space', 'space'],
  ['space', 'space'],
]);

const normalizeKey = (key) => {
  if (typeof key !== 'string') return '';
  const direct = KEY_MAP.get(key);
  if (direct) return direct;
  const lower = key.toLowerCase();
  return KEY_MAP.get(lower) ?? lower;
};

const PREVENT_DEFAULT_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'space']);

const KEY_BINDINGS = {
  left: ['arrowleft', 'a'],
  right: ['arrowright', 'd'],
  up: ['arrowup', 'w'],
  down: ['arrowdown', 's'],
};

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
        const normalized = normalizeKey(event.key);
        if (!normalized) return;
        if (event.type === 'keydown') {
          this.keys.add(normalized);
          if (PREVENT_DEFAULT_KEYS.has(normalized) && typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
        } else if (event.type === 'keyup') {
          this.keys.delete(normalized);
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
    return this.keys.has(normalizeKey(key));
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
    return keys.some((key) => this.keys.has(normalizeKey(key)));
  }
}
