/**
 * Linera Module - Re-exports for clean imports
 */

// WASM initialization
export { ensureWasmInitialized, isWasmReady } from './wasmInit';

// Dynamic wallet signer
export { DynamicSigner } from './dynamicSigner';

// Linera adapter singleton
export { 
  lineraAdapter, 
  LineraAdapterClass,
  type LineraConnection,
  type ApplicationConnection,
} from './lineraAdapter';
