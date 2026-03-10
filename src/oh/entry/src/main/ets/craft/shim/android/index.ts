/**
 * CRAFT - Android API Shim Registration
 * Registers all android.* shim classes.
 */

import { ShimRegistry } from '../../interpreter/shim_registry';
import { UIBridge } from '../../bridge/ui_bridge';
import { registerBundleShim } from './os/bundle';
import { registerContextShim, registerContextWrapperShim } from './content/context';
import { registerViewShim } from './view/view';
import { registerViewGroupShim } from './view/view_group';
import { registerTextViewShim } from './widget/textview';
import { registerLinearLayoutShim } from './widget/linear_layout';
import { registerButtonShim } from './widget/button';
import { registerActivityShim } from './app/activity';

export function registerAndroidShims(registry: ShimRegistry, uiBridge?: UIBridge): void {
  registerBundleShim(registry);
  registerContextShim(registry);
  registerContextWrapperShim(registry);
  registerViewShim(registry, uiBridge);
  registerViewGroupShim(registry, uiBridge);
  registerTextViewShim(registry, uiBridge);
  registerLinearLayoutShim(registry, uiBridge);
  registerButtonShim(registry, uiBridge);
  registerActivityShim(registry, uiBridge);
}
