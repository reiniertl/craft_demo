import type { ShimRegistry } from '../../../interpreter/shim_registry';
import { NULL_VALUE, intValue } from "@bundle:com.craft.runtime/entry/ets/craft/core/types";
import type { Value } from "@bundle:com.craft.runtime/entry/ets/craft/core/types";
const BUNDLE_CLASS = 'Landroid/os/Bundle;';
/** Internal storage for Bundle data, keyed by heap reference */
const bundleDataMap = new Map<number, Map<string, Value>>();
/** Get or create bundle data for a given heap ref */
function getBundleData(ref: number): Map<string, Value> {
    let data = bundleDataMap.get(ref);
    if (!data) {
        data = new Map();
        bundleDataMap.set(ref, data);
    }
    return data;
}
export function registerBundleShim(registry: ShimRegistry): void {
    // <init>()V
    registry.register(BUNDLE_CLASS, '<init>', '()V', (_interp, _heap, thisRef, _args) => {
        getBundleData(thisRef);
        return NULL_VALUE;
    });
    // putString(Ljava/lang/String;Ljava/lang/String;)V
    registry.register(BUNDLE_CLASS, 'putString', '(Ljava/lang/String;Ljava/lang/String;)V', (_interp, heap, thisRef, args) => {
        const keyRef = (args[0] as {
            type: 'object';
            ref: number;
        }).ref;
        const key = heap.getStringValue(keyRef);
        const data = getBundleData(thisRef);
        data.set(key, args[1]);
        return NULL_VALUE;
    });
    // getString(Ljava/lang/String;)Ljava/lang/String;
    registry.register(BUNDLE_CLASS, 'getString', '(Ljava/lang/String;)Ljava/lang/String;', (_interp, heap, thisRef, args) => {
        const keyRef = (args[0] as {
            type: 'object';
            ref: number;
        }).ref;
        const key = heap.getStringValue(keyRef);
        const data = getBundleData(thisRef);
        return data.get(key) ?? NULL_VALUE;
    });
    // containsKey(Ljava/lang/String;)Z
    registry.register(BUNDLE_CLASS, 'containsKey', '(Ljava/lang/String;)Z', (_interp, heap, thisRef, args) => {
        const keyRef = (args[0] as {
            type: 'object';
            ref: number;
        }).ref;
        const key = heap.getStringValue(keyRef);
        const data = getBundleData(thisRef);
        return intValue(data.has(key) ? 1 : 0);
    });
}
