import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const getHtmlContent = (filePath) => {
  return fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');
};

const setupDOM = (htmlContent) => {
  const dom = new JSDOM(htmlContent);
  global.document = dom.window.document;
  global.window = dom.window;
  return dom.window.document;
};

describe('Form field validation', () => {
  describe('Static HTML forms', () => {
    it('memory/index.html form fields have unique IDs or names', () => {
      const htmlContent = getHtmlContent('memory/index.html');
      const document = setupDOM(htmlContent);
      
      const formFields = document.querySelectorAll('input, textarea, select');
      
      formFields.forEach((field) => {
        const hasId = field.id && field.id.trim() !== '';
        const hasName = field.name && field.name.trim() !== '';
        
        expect(hasId || hasName).toBe(true);
        
        // If it has an ID, verify it's unique
        if (hasId) {
          const elementsWithSameId = document.querySelectorAll(`#${field.id}`);
          expect(elementsWithSameId.length).toBe(1);
        }
      });
    });

    it('public/index.html form fields have unique IDs or names', () => {
      const htmlContent = getHtmlContent('public/index.html');
      const document = setupDOM(htmlContent);
      
      const formFields = document.querySelectorAll('input, textarea, select');
      
      formFields.forEach((field) => {
        const hasId = field.id && field.id.trim() !== '';
        const hasName = field.name && field.name.trim() !== '';
        
        expect(hasId || hasName).toBe(true);
        
        // If it has an ID, verify it's unique
        if (hasId) {
          const elementsWithSameId = document.querySelectorAll(`#${field.id}`);
          expect(elementsWithSameId.length).toBe(1);
        }
      });
    });
  });

  describe('Dynamically created forms', () => {
    it('CharacterCreator form fields have unique IDs or names', async () => {
      // Set up DOM environment for ES modules
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
      });
      global.document = dom.window.document;
      global.window = dom.window;
      
      // Mock Character and CharacterStats for testing
      const CharacterStats = { 
        KEYS: ['STR', 'DEX', 'INT'],
        MIN: 10,
        MAX: 18
      };
      
      // Dynamically import and test the CharacterCreator
      const { createCharacterCreator } = await import('../CharacterCreator.js');
      
      // Mock the Character import
      global.Character = class {
        constructor(data) {
          this.name = data.name;
          this.stats = data.stats;
        }
      };
      global.CharacterStats = CharacterStats;
      
      const creator = createCharacterCreator();
      document.body.appendChild(creator.element);
      
      const formFields = creator.element.querySelectorAll('input, textarea, select');
      
      formFields.forEach((field) => {
        const hasId = field.id && field.id.trim() !== '';
        const hasName = field.name && field.name.trim() !== '';
        
        expect(hasId || hasName).toBe(true);
        
        // If it has an ID, verify it's unique within the creator
        if (hasId) {
          const elementsWithSameId = creator.element.querySelectorAll(`#${field.id}`);
          expect(elementsWithSameId.length).toBe(1);
        }
      });
      
      creator.destroy();
    });
  });

  describe('Label-to-field associations', () => {
    it('labels in memory/index.html properly reference form fields', () => {
      const htmlContent = getHtmlContent('memory/index.html');
      const document = setupDOM(htmlContent);
      
      const labels = document.querySelectorAll('label[for]');
      
      labels.forEach((label) => {
        const forValue = label.getAttribute('for');
        const targetField = document.getElementById(forValue);
        
        expect(targetField).toBeTruthy();
        expect(['input', 'textarea', 'select'].includes(targetField.tagName.toLowerCase())).toBe(true);
      });
    });
  });
});