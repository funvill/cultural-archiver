/**
 * Simple test version of mass import endpoint
 */
import type { Context } from 'hono';

export async function processMassImportPhotos(c: Context): Promise<Response> {
  try {
    console.log('[MASS_IMPORT] Test endpoint called');
    
    // Simple JSON response for testing
    return c.json({
      success: true,
      message: 'Mass import endpoint is working',
      data: { test: true }
    });
  } catch (error) {
    console.error('[MASS_IMPORT] Error:', error);
    return c.json({
      success: false,
      error: 'MASS_IMPORT_TEST_ERROR',
      message: 'Test endpoint failed'
    }, 500);
  }
}
