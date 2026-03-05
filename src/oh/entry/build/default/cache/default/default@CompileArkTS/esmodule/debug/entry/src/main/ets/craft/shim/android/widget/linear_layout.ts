import type { ShimRegistry } from '../../../interpreter/shim_registry';
import type { UIBridge } from '../../../bridge/ui_bridge';
import { NULL_VALUE, intValue } from "@bundle:com.craft.runtime/entry/ets/craft/core/types";
const LINEAR_LAYOUT_CLASS = 'Landroid/widget/LinearLayout;';
export const HORIZONTAL = 0;
export const VERTICAL = 1;
export function registerLinearLayoutShim(registry: ShimRegistry, uiBridge?: UIBridge): void {
    // <init>(Landroid/content/Context;)V
    registry.register(LINEAR_LAYOUT_CLASS, '<init>', '(Landroid/content/Context;)V', (_interp, heap, thisRef, args) => {
        // Initialize View fields
        heap.setField(thisRef, 'mContext', args[0]);
        heap.setField(thisRef, 'mId', intValue(-1));
        heap.setField(thisRef, 'mVisibility', intValue(0));
        // Initialize LinearLayout fields
        heap.setField(thisRef, 'mOrientation', intValue(HORIZONTAL));
        // Register with UI bridge
        if (uiBridge) {
            uiBridge.registerView(thisRef, 'LinearLayout');
        }
        return NULL_VALUE;
    });
    // setOrientation(I)V
    registry.register(LINEAR_LAYOUT_CLASS, 'setOrientation', '(I)V', (_interp, heap, thisRef, args) => {
        heap.setField(thisRef, 'mOrientation', args[0]);
        if (uiBridge) {
            const orientation = args[0].type === 'int' ? args[0].value : HORIZONTAL;
            uiBridge.updateViewProperty(thisRef, 'orientation', orientation);
        }
        return NULL_VALUE;
    });
    // getOrientation()I
    registry.register(LINEAR_LAYOUT_CLASS, 'getOrientation', '()I', (_interp, heap, thisRef, _args) => {
        return heap.getField(thisRef, 'mOrientation');
    });
}
