import type { ShimRegistry } from '../../../interpreter/shim_registry';
import { registerObjectShim } from "@bundle:com.craft.runtime/entry/ets/craft/shim/java/lang/object";
import { registerStringShim } from "@bundle:com.craft.runtime/entry/ets/craft/shim/java/lang/string";
import { registerStringBuilderShim } from "@bundle:com.craft.runtime/entry/ets/craft/shim/java/lang/string_builder";
import { registerClassShim } from "@bundle:com.craft.runtime/entry/ets/craft/shim/java/lang/class";
import { registerSystemShim } from "@bundle:com.craft.runtime/entry/ets/craft/shim/java/lang/system";
export function registerJavaLangShims(registry: ShimRegistry): void {
    registerObjectShim(registry);
    registerStringShim(registry);
    registerStringBuilderShim(registry);
    registerClassShim(registry);
    registerSystemShim(registry);
}
