import type { ShimRegistry } from '../../interpreter/shim_registry';
import type { UIBridge } from '../../bridge/ui_bridge';
import { registerBundleShim } from "@bundle:com.craft.runtime/entry/ets/craft/shim/android/os/bundle";
import { registerContextShim, registerContextWrapperShim } from "@bundle:com.craft.runtime/entry/ets/craft/shim/android/content/context";
import { registerViewShim } from "@bundle:com.craft.runtime/entry/ets/craft/shim/android/view/view";
import { registerViewGroupShim } from "@bundle:com.craft.runtime/entry/ets/craft/shim/android/view/view_group";
import { registerTextViewShim } from "@bundle:com.craft.runtime/entry/ets/craft/shim/android/widget/textview";
import { registerLinearLayoutShim } from "@bundle:com.craft.runtime/entry/ets/craft/shim/android/widget/linear_layout";
import { registerButtonShim } from "@bundle:com.craft.runtime/entry/ets/craft/shim/android/widget/button";
import { registerActivityShim } from "@bundle:com.craft.runtime/entry/ets/craft/shim/android/app/activity";
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
