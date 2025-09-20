import { describe, it, expect } from 'vitest';
import { WorldObject, Item, Door, Container } from '../WorldObject.js';

describe('WorldObject.fromJSON', () => {
  it('should create Item objects without infinite recursion', () => {
    const itemData = {
      id: 'test-item',
      name: 'Test Item',
      type: 'item',
      x: 5,
      y: 10
    };
    
    const item = WorldObject.fromJSON(itemData);
    
    expect(item).toBeInstanceOf(Item);
    expect(item.id).toBe('test-item');
    expect(item.name).toBe('Test Item');
    expect(item.type).toBe('item');
    expect(item.x).toBe(5);
    expect(item.y).toBe(10);
  });

  it('should create Door objects without infinite recursion', () => {
    const doorData = {
      id: 'test-door',
      name: 'Test Door',
      type: 'door',
      x: 3,
      y: 3,
      isOpen: false
    };
    
    const door = WorldObject.fromJSON(doorData);
    
    expect(door).toBeInstanceOf(Door);
    expect(door.id).toBe('test-door');
    expect(door.name).toBe('Test Door');
    expect(door.type).toBe('door');
  });

  it('should create Container objects with nested items without infinite recursion', () => {
    const containerData = {
      id: 'test-container',
      name: 'Test Container',
      type: 'container',
      x: 0,
      y: 0,
      contains: [
        {
          id: 'nested-item',
          name: 'Nested Item',
          type: 'item',
          x: 0,
          y: 0
        }
      ]
    };
    
    const container = WorldObject.fromJSON(containerData);
    
    expect(container).toBeInstanceOf(Container);
    expect(container.id).toBe('test-container');
    expect(container.contains).toHaveLength(1);
    expect(container.contains[0]).toBeInstanceOf(Item);
    expect(container.contains[0].id).toBe('nested-item');
  });

  it('should handle cloning (which uses fromJSON internally) without infinite recursion', () => {
    const original = new Item('original-item', 'Original Item', 1, 2);
    
    const cloned = original.clone();
    
    expect(cloned).toBeInstanceOf(Item);
    expect(cloned.id).toBe('original-item');
    expect(cloned.name).toBe('Original Item');
    expect(cloned.x).toBe(1);
    expect(cloned.y).toBe(2);
    expect(cloned).not.toBe(original); // Different instances
  });

  it('should create plain WorldObject when type is not in registry', () => {
    const unknownData = {
      id: 'unknown-object',
      name: 'Unknown Object',
      type: 'unknown',
      x: 0,
      y: 0
    };
    
    const obj = WorldObject.fromJSON(unknownData);
    
    expect(obj).toBeInstanceOf(WorldObject);
    expect(obj.constructor).toBe(WorldObject);
    expect(obj.id).toBe('unknown-object');
    expect(obj.type).toBe('unknown');
  });
});