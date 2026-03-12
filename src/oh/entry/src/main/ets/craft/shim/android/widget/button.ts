/**
 * CRAFT - android.widget.Button Shim
 * Clickable button component - extends TextView.
 */

import { ShimRegistry } from '../../../interpreter/shim_registry';
import { UIBridge } from '../../../bridge/ui_bridge';
import { Value, NULL_VALUE, intValue, floatValue, objectRef } from '../../../core/types';

const BUTTON_CLASS = 'Landroid/widget/Button;';

export function registerButtonShim(registry: ShimRegistry, uiBridge?: UIBridge): void {

  // <init>(Landroid/content/Context;)V
  registry.register(BUTTON_CLASS, '<init>',
    '(Landroid/content/Context;)V',
    (_interp, heap, thisRef, args) => {
      // Initialize View fields
      heap.setField(thisRef, 'mContext', args[0]);
      heap.setField(thisRef, 'mId', intValue(-1));
      heap.setField(thisRef, 'mVisibility', intValue(0));
      // Initialize TextView fields — mText MUST NOT be null (spec V-3 invariant 1)
      heap.setField(thisRef, 'mText', objectRef(heap.internString('')));
      heap.setField(thisRef, 'mTextSize', floatValue(14.0));
      heap.setField(thisRef, 'mTextColor', intValue(0xFF000000 | 0));

      // Register with UI bridge
      if (uiBridge) {
        uiBridge.registerView(thisRef, 'Button');
      }

      return NULL_VALUE;
    }
  );
}
