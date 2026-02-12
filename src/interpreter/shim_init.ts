/**
 * CRAFT - Shim Initialization
 * Creates and populates the ShimRegistry with all registered shims.
 */

import { ShimRegistry } from './shim_registry';
import { registerJavaLangShims } from '../shim/java/lang/index';
import { registerAndroidShims } from '../shim/android/index';

export function initializeShimRegistry(): ShimRegistry {
  const registry = new ShimRegistry();
  registerJavaLangShims(registry);
  registerAndroidShims(registry);
  return registry;
}
