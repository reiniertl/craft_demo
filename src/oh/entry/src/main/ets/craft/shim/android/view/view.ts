/**
 * CRAFT - android.view.View Shim
 * Base class for all UI components.
 */

import { ShimRegistry } from '../../../interpreter/shim_registry';
import { UIBridge } from '../../../bridge/ui_bridge';
import { Value, NULL_VALUE, intValue, objectRef } from '../../../core/types';

const VIEW_CLASS = 'Landroid/view/View;';

/** Visibility constants matching Android */
export const VISIBLE = 0;
export const INVISIBLE = 4;
export const GONE = 8;

export function registerViewShim(registry: ShimRegistry, uiBridge?: UIBridge): void {

  // <init>(Landroid/content/Context;)V
  registry.register(VIEW_CLASS, '<init>',
    '(Landroid/content/Context;)V',
    (_interp, heap, thisRef, args) => {
      heap.setField(thisRef, 'mContext', args[0]);
      heap.setField(thisRef, 'mId', intValue(-1));
      heap.setField(thisRef, 'mVisibility', intValue(VISIBLE));
      return NULL_VALUE;
    }
  );

  // getContext()Landroid/content/Context;
  registry.register(VIEW_CLASS, 'getContext',
    '()Landroid/content/Context;',
    (_interp, heap, thisRef, _args) => {
      return heap.getField(thisRef, 'mContext');
    }
  );

  // setId(I)V
  registry.register(VIEW_CLASS, 'setId', '(I)V',
    (_interp, heap, thisRef, args) => {
      heap.setField(thisRef, 'mId', args[0]);
      return NULL_VALUE;
    }
  );

  // getId()I
  registry.register(VIEW_CLASS, 'getId', '()I',
    (_interp, heap, thisRef, _args) => {
      return heap.getField(thisRef, 'mId');
    }
  );

  // setVisibility(I)V
  registry.register(VIEW_CLASS, 'setVisibility', '(I)V',
    (_interp, heap, thisRef, args) => {
      heap.setField(thisRef, 'mVisibility', args[0]);
      return NULL_VALUE;
    }
  );

  // getVisibility()I
  registry.register(VIEW_CLASS, 'getVisibility', '()I',
    (_interp, heap, thisRef, _args) => {
      return heap.getField(thisRef, 'mVisibility');
    }
  );

  // setOnClickListener(Landroid/view/View$OnClickListener;)V
  registry.register(VIEW_CLASS, 'setOnClickListener',
    '(Landroid/view/View$OnClickListener;)V',
    (interp, heap, thisRef, args) => {
      const listenerRef = args[0];
      heap.setField(thisRef, 'mOnClickListener', listenerRef);

      if (uiBridge && listenerRef.type === 'object' && listenerRef.ref !== 0) {
        const capturedListenerRef = listenerRef;
        const capturedThisRef = thisRef;
        const callback = (): void => {
          const listenerClass = heap.getClassDescriptor(capturedListenerRef.ref);
          console.info(`[CRAFT][View] onClick callback: listenerRef=${capturedListenerRef.ref}, listenerClass=${listenerClass}, viewRef=${capturedThisRef}`);
          if (listenerClass) {
            interp.invoke(
              listenerClass,
              'onClick',
              '(Landroid/view/View;)V',
              [capturedListenerRef, objectRef(capturedThisRef)]
            );
            console.info(`[CRAFT][View] onClick completed successfully`);
          } else {
            console.error(`[CRAFT][View] onClick: listenerClass is null for ref=${capturedListenerRef.ref}`);
          }
        };
        uiBridge.setClickCallback(thisRef, callback);
      }

      return NULL_VALUE;
    }
  );

  // performClick()Z
  registry.register(VIEW_CLASS, 'performClick', '()Z',
    (interp, heap, thisRef, _args) => {
      const listenerRef = heap.getField(thisRef, 'mOnClickListener');
      if (listenerRef.type === 'object' && listenerRef.ref !== 0) {
        const listenerClass = heap.getClassDescriptor(listenerRef.ref);
        if (listenerClass) {
          interp.invoke(
            listenerClass,
            'onClick',
            '(Landroid/view/View;)V',
            [listenerRef, objectRef(thisRef)]
          );
          return intValue(1);
        }
      }
      return intValue(0);
    }
  );
}
