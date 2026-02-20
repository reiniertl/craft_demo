import { ShimRegistry } from "@bundle:com.craft.runtime/entry/ets/craft/interpreter/shim_registry";
import { registerJavaLangShims } from "@bundle:com.craft.runtime/entry/ets/craft/shim/java/lang/index";
import { registerAndroidShims } from "@bundle:com.craft.runtime/entry/ets/craft/shim/android/index";
import type { UIBridge } from '../bridge/ui_bridge';
export function initializeShimRegistry(uiBridge?: UIBridge): ShimRegistry {
    const registry = new ShimRegistry();
    registerJavaLangShims(registry);
    registerAndroidShims(registry, uiBridge);
    return registry;
}
