import { describe, it, expect, vi } from 'vitest';
import { InputController } from '../controls.js';

describe('InputController', () => {
  const createMockTarget = () => {
    const listeners = new Map();
    return {
      addEventListener: (type, handler) => {
        listeners.set(type, handler);
      },
      removeEventListener: (type) => {
        listeners.delete(type);
      },
      listeners,
    };
  };

  it('recognises Down key aliases as downward movement', () => {
    const target = createMockTarget();
    const input = new InputController(target);
    const keydown = target.listeners.get('keydown');
    const keyup = target.listeners.get('keyup');
    expect(typeof keydown).toBe('function');
    expect(typeof keyup).toBe('function');

    const preventDefault = vi.fn();
    keydown?.({ type: 'keydown', key: 'Down', preventDefault });

    const direction = input.getDirection();
    expect(direction).toEqual({ x: 0, y: 1 });
    expect(preventDefault).toHaveBeenCalled();

    keyup?.({ type: 'keyup', key: 'Down', preventDefault });
    expect(input.getDirection()).toEqual({ x: 0, y: 0 });

    input.destroy();
  });
});
