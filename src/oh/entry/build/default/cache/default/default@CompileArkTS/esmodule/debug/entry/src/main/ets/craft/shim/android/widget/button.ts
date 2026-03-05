import type { ShimRegistry } from '../../../interpreter/shim_registry';
import type { UIBridge } from '../../../bridge/ui_bridge';
import { NULL_VALUE, intValue, floatValue } from "@bundle:com.craft.runtime/entry/ets/craft/core/types";
const BUTTON_CLASS = 'Landroid/widget/Button;';
export function registerButtonShim(registry: ShimRegistry, uiBridge?: UIBridge): void {
    // <init>(Landroid/content/Context;)V
    registry.register(BUTTON_CLASS, '<init>', '(Landroid/content/Context;)V', (_interp, heap, thisRef, args) => {
        // Initialize View fields
        heap.setField(thisRef, 'mContext', args[0]);
        heap.setField(thisRef, 'mId', intValue(-1));
        heap.setField(thisRef, 'mVisibility', intValue(0));
        // Initialize TextView fields
        heap.setField(thisRef, 'mText', NULL_VALUE);
        heap.setField(thisRef, 'mTextSize', floatValue(14.0));
        heap.setField(thisRef, 'mTextColor', intValue(0xFF000000 | 0));
        // Register with UI bridge
        if (uiBridge) {
            uiBridge.registerView(thisRef, 'Button');
        }
        return NULL_VALUE;
    });
}
