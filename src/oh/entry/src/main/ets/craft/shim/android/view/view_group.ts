/**
 * CRAFT - android.view.ViewGroup Shim
 * Container for child views.
 */

import { ShimRegistry } from '../../../interpreter/shim_registry';
import { UIBridge } from '../../../bridge/ui_bridge';
import { Value, NULL_VALUE, intValue, objectRef } from '../../../core/types';

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

export function registerViewGroupShim(registry: ShimRegistry, uiBridge?: UIBridge): void {

  // <init>(Landroid/content/Context;)V
  registry.register(VIEW_GROUP_CLASS, '<init>',
    '(Landroid/content/Context;)V',
    (_interp, heap, thisRef, args) => {
      // Initialize View fields
      heap.setField(thisRef, 'mContext', args[0]);
      heap.setField(thisRef, 'mId', intValue(-1));
      heap.setField(thisRef, 'mVisibility', intValue(0));
      getChildren(thisRef);

      // Register with UI bridge
      if (uiBridge) {
        uiBridge.registerView(thisRef, 'ViewGroup');
      }

      return NULL_VALUE;
    }
  );

  // addView(Landroid/view/View;)V
  registry.register(VIEW_GROUP_CLASS, 'addView',
    '(Landroid/view/View;)V',
    (_interp, _heap, thisRef, args) => {
      const childRef = (args[0] as { type: 'object'; ref: number }).ref;
      const children = getChildren(thisRef);
      children.push(childRef);

      // Notify UI bridge of hierarchy change
      if (uiBridge) {
        uiBridge.addChildView(thisRef, childRef);
      }

      return NULL_VALUE;
    }
  );

  // getChildCount()I
  registry.register(VIEW_GROUP_CLASS, 'getChildCount', '()I',
    (_interp, _heap, thisRef, _args) => {
      const children = getChildren(thisRef);
      return intValue(children.length);
    }
  );
}
