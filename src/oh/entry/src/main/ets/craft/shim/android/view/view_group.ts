/**
 * CRAFT - android.view.ViewGroup Shim
 * Container for child views.
 */

import { ShimRegistry } from '../../../interpreter/shim_registry';
import { UIBridge } from '../../../bridge/ui_bridge';
import { NULL_VALUE, intValue } from '../../../core/types';

const VIEW_GROUP_CLASS = 'Landroid/view/ViewGroup;';

export function registerViewGroupShim(registry: ShimRegistry, uiBridge?: UIBridge): void {

  // <init>(Landroid/content/Context;)V
  registry.register(VIEW_GROUP_CLASS, '<init>',
    '(Landroid/content/Context;)V',
    (_interp, heap, thisRef, args) => {
      heap.setField(thisRef, 'mContext', args[0]);
      heap.setField(thisRef, 'mId', intValue(-1));
      heap.setField(thisRef, 'mVisibility', intValue(0));
      heap.setField(thisRef, '__childCount', intValue(0));
      if (uiBridge) {
        uiBridge.registerView(thisRef, 'ViewGroup');
      }
      return NULL_VALUE;
    }
  );

  // addView(Landroid/view/View;)V
  registry.register(VIEW_GROUP_CLASS, 'addView',
    '(Landroid/view/View;)V',
    (_interp, heap, thisRef, args) => {
      const childRef = (args[0] as { type: 'object'; ref: number }).ref;
      // Increment heap counter (used when UIBridge is absent, e.g. in unit tests)
      const prev = heap.getField(thisRef, '__childCount');
      const prevCount = prev.type === 'int' ? prev.value : 0;
      heap.setField(thisRef, '__childCount', intValue(prevCount + 1));
      if (uiBridge) {
        uiBridge.addChildView(thisRef, childRef);
      }
      return NULL_VALUE;
    }
  );

  // getChildCount()I
  // Authoritative source is the UIBridge ViewNode when available; falls back to
  // the heap counter for test contexts that run without UIBridge.
  registry.register(VIEW_GROUP_CLASS, 'getChildCount', '()I',
    (_interp, heap, thisRef, _args) => {
      if (uiBridge) {
        const node = uiBridge.getViewNode(thisRef);
        if (node) return intValue(node.children.length);
      }
      const cnt = heap.getField(thisRef, '__childCount');
      return intValue(cnt.type === 'int' ? cnt.value : 0);
    }
  );
}
