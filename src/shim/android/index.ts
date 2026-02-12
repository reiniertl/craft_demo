/**
 * CRAFT - Android API Shim Registration
 * Registers all android.* shim classes.
 */

import { ShimRegistry } from '../../interpreter/shim_registry';
import { registerBundleShim } from './os/bundle';
import { registerContextShim, registerContextWrapperShim } from './content/context';
import { registerViewShim } from './view/view';
import { registerViewGroupShim } from './view/view_group';
import { registerTextViewShim } from './widget/textview';
import { registerActivityShim } from './app/activity';

export function registerAndroidShims(registry: ShimRegistry): void {
  registerBundleShim(registry);
  registerContextShim(registry);
  registerContextWrapperShim(registry);
  registerViewShim(registry);
  registerViewGroupShim(registry);
  registerTextViewShim(registry);
  registerActivityShim(registry);
}
