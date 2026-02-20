import type { ShimRegistry } from '../../../interpreter/shim_registry';
import { NULL_VALUE, intValue } from "@bundle:com.craft.runtime/entry/ets/craft/core/types";
const VIEW_GROUP_CLASS = 'Landroid/view/ViewGroup;';
/** Internal storage for ViewGroup children, keyed by heap reference */
const childrenMap = new Map<number, number[]>();
function getChildren(ref: number): number[] {
    let children = childrenMap.get(ref);
    if (!children) {
        children = [];
        childrenMap.set(ref, children);
    }
    return children;
}
export function registerViewGroupShim(registry: ShimRegistry): void {
    // <init>(Landroid/content/Context;)V
    registry.register(VIEW_GROUP_CLASS, '<init>', '(Landroid/content/Context;)V', (_interp, heap, thisRef, args) => {
        // Initialize View fields
        heap.setField(thisRef, 'mContext', args[0]);
        heap.setField(thisRef, 'mId', intValue(-1));
        heap.setField(thisRef, 'mVisibility', intValue(0));
        getChildren(thisRef);
        return NULL_VALUE;
    });
    // addView(Landroid/view/View;)V
    registry.register(VIEW_GROUP_CLASS, 'addView', '(Landroid/view/View;)V', (_interp, _heap, thisRef, args) => {
        const childRef = (args[0] as {
            type: 'object';
            ref: number;
        }).ref;
        const children = getChildren(thisRef);
        children.push(childRef);
        return NULL_VALUE;
    });
    // getChildCount()I
    registry.register(VIEW_GROUP_CLASS, 'getChildCount', '()I', (_interp, _heap, thisRef, _args) => {
        const children = getChildren(thisRef);
        return intValue(children.length);
    });
}
