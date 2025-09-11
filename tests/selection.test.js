import { describe, it, expect } from 'vitest';
import { getSelectedText } from '../selection.js';

describe('getSelectedText', () => {
  it('returns selectedText when available', () => {
    const sel = { selectedText: 'Hello' };
    expect(getSelectedText(sel)).toBe('Hello');
  });

  it('falls back to toString if selectedText missing', () => {
    const sel = { toString: () => 'World' };
    expect(getSelectedText(sel)).toBe('World');
  });

  it('returns empty string for null or undefined', () => {
    expect(getSelectedText(null)).toBe('');
    expect(getSelectedText(undefined)).toBe('');
  });
});
