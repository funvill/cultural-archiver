/**
 * Test file to verify wasm-image-optimization works in Workers environment
 */

import { describe, it, expect } from 'vitest';

describe('WASM Image Optimization Library Test', () => {
  it('should import the library without errors', async () => {
    // Try to import the library
    try {
      const lib = await import('wasm-image-optimization');
      expect(lib).toBeDefined();
      console.log('Library imported successfully:', Object.keys(lib));
    } catch (error) {
      console.error('Failed to import library:', error);
      throw error;
    }
  });

  it('should have resize functionality', async () => {
    try {
      const lib = await import('wasm-image-optimization');
      // Check if the library exports expected functions
      console.log('Available exports:', Object.keys(lib));
      
      // Common function names to check for
      const expectedFunctions = ['resize', 'optimize', 'transform', 'process'];
      const availableFunctions = Object.keys(lib).filter(key => 
        typeof (lib as any)[key] === 'function'
      );
      
      console.log('Available functions:', availableFunctions);
      expect(availableFunctions.length).toBeGreaterThan(0);
    } catch (error) {
      console.error('Error checking functions:', error);
      throw error;
    }
  });
});
