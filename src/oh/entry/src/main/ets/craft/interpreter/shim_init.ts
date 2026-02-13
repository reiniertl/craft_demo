/**
 * CRAFT - Shim Initialization
 * Creates and populates the ShimRegistry with all registered shims.
 */

import { ShimRegistry } from './shim_registry';
import { registerJavaLangShims } from '../shim/java/lang/index';
import { registerAndroidShims } from '../shim/android/index';
import { UIBridge } from '../bridge/ui_bridge';

export function initializeShimRegistry(uiBridge?: UIBridge): ShimRegistry {
  const registry = new ShimRegistry();
  registerJavaLangShims(registry);
  registerAndroidShims(registry, uiBridge);
  return registry;
}
