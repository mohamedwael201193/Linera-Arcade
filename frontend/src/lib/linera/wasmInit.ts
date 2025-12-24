/**
 * Linera WASM Initialization Module
 * 
 * Ensures @linera/client WASM is initialized exactly once.
 * All other code should use ensureWasmInitialized() instead of calling initLinera() directly.
 */

// Use dynamic import to avoid module resolution issues in production
// Module-level state for singleton pattern
let initPromise: Promise<void> | null = null;
let initialized = false;
let lineraModule: typeof import('@linera/client') | null = null;

/**
 * Dynamically load the @linera/client module
 */
async function getLineraModule() {
  if (lineraModule) return lineraModule;
  try {
    lineraModule = await import('@linera/client');
    return lineraModule;
  } catch (error) {
    console.error('❌ Failed to load @linera/client module:', error);
    throw error;
  }
}

/**
 * Ensures Linera WASM modules are initialized.
 * Safe to call multiple times - will only initialize once.
 * 
 * @returns Promise that resolves when WASM is ready
 */
export async function ensureWasmInitialized(): Promise<void> {
  // Already initialized - return immediately
  if (initialized) {
    return;
  }

  // Initialization in progress - wait for it
  if (initPromise) {
    return initPromise;
  }

  // Start new initialization
  initPromise = (async () => {
    try {
      console.log('🔄 Initializing Linera WASM modules...');
      const linera = await getLineraModule();
      await linera.initialize();
      initialized = true;
      console.log('✅ Linera WASM modules initialized successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      
      // Handle "already initialized" error gracefully
      // This can happen in HMR or if another part of the app called initLinera
      if (message.includes('storage is already initialized') || 
          message.includes('already been initialized')) {
        console.warn('⚠️ Linera WASM was already initialized; continuing...');
        initialized = true;
        return;
      }
      
      // Reset state on actual failure so retry is possible
      initPromise = null;
      initialized = false;
      console.error('❌ Failed to initialize Linera WASM:', error);
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Check if WASM has been successfully initialized.
 * 
 * @returns true if WASM is ready to use
 */
export function isWasmReady(): boolean {
  return initialized;
}

/**
 * Reset initialization state (mainly for testing)
 */
export function resetWasmState(): void {
  initPromise = null;
  initialized = false;
}
