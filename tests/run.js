#!/usr/bin/env node
// Test runner for Britannia Reborn
// Simple test harness for movement and debug functionality

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

console.log('🧪 Britannia Reborn Test Runner');
console.log('================================');

// Check if vitest is available
let useVitest = true;
try {
  execSync('npx vitest --version', { cwd: rootDir, stdio: 'pipe' });
} catch (e) {
  console.warn('⚠️  Vitest not found, falling back to node-based tests');
  useVitest = false;
}

if (useVitest) {
  console.log('🚀 Running tests with Vitest...');
  try {
    execSync('npx vitest run', { cwd: rootDir, stdio: 'inherit' });
    console.log('✅ All tests passed!');
  } catch (e) {
    console.error('❌ Some tests failed');
    process.exit(1);
  }
} else {
  // Fallback: run basic node tests
  console.log('🚀 Running basic node tests...');
  
  try {
    // Test movement.js module
    console.log('📦 Testing movement.js...');
    const movement = await import(join(rootDir, 'movement.js'));
    
    // Basic movement calculations test
    const mockCharacter = {
      x: 100,
      y: 100,
      speed: () => 120
    };
    
    const speedInfo = movement.calculateMovementSpeed(mockCharacter, 100, 100);
    console.log('  ✓ calculateMovementSpeed works');
    
    const normalized = movement.normalizeMovement(1, 1);
    if (Math.abs(normalized.mvx - 0.7071) < 0.001 && Math.abs(normalized.mvy - 0.7071) < 0.001) {
      console.log('  ✓ normalizeMovement works');
    } else {
      throw new Error('normalizeMovement failed');
    }
    
    const modifier = movement.getTerrainSpeedModifier('SWAMP');
    if (modifier === 0.7) {
      console.log('  ✓ getTerrainSpeedModifier works');
    } else {
      throw new Error('getTerrainSpeedModifier failed');
    }
    
    console.log('✅ Basic tests passed!');
    
  } catch (e) {
    console.error('❌ Test failed:', e.message);
    process.exit(1);
  }
}

console.log('\n🎉 Test run complete!');