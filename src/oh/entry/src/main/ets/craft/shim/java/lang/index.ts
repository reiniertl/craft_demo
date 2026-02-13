/**
 * CRAFT - java.lang.* Shim Registration
 * Registers all java.lang base class shims.
 */

import { ShimRegistry } from '../../../interpreter/shim_registry';
import { registerObjectShim } from './object';
import { registerStringShim } from './string';
import { registerStringBuilderShim } from './string_builder';
import { registerClassShim } from './class';
import { registerSystemShim } from './system';

export function registerJavaLangShims(registry: ShimRegistry): void {
  registerObjectShim(registry);
  registerStringShim(registry);
  registerStringBuilderShim(registry);
  registerClassShim(registry);
  registerSystemShim(registry);
}
