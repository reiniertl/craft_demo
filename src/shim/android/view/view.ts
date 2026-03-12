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
      if (uiBridge) {
        uiBridge.registerView(thisRef, 'View');
      }
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
      if (uiBridge) {
        const visibility = args[0].type === 'int' ? args[0].value : VISIBLE;
        uiBridge.updateViewProperty(thisRef, 'visibility', visibility);
      }
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

      if (uiBridge) {
        if (listenerRef.type === 'object' && listenerRef.ref !== 0) {
          const capturedListenerRef = listenerRef;
          const capturedThisRef = thisRef;
          const callback = (): void => {
            const listenerClass = heap.getClassDescriptor(capturedListenerRef.ref);
            if (listenerClass) {
              interp.invoke(
                listenerClass,
                'onClick',
                '(Landroid/view/View;)V',
                [capturedListenerRef, objectRef(capturedThisRef)]
              );
            }
          };
          uiBridge.setClickCallback(thisRef, callback);
        } else {
          // null listener — remove any previously registered callback
          uiBridge.removeClickCallback(thisRef);
        }
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

  // postDelayed(Ljava/lang/Runnable;J)Z
  registry.register(VIEW_CLASS, 'postDelayed',
    '(Ljava/lang/Runnable;J)Z',
    (interp, heap, thisRef, args) => {
      const runnableRef = args[0];
      const delayMs = Number(
        args[1].type === 'long'
          ? (args[1] as { type: 'long'; value: bigint }).value
          : (args[1] as { type: 'int'; value: number }).value
      );

      if (runnableRef.type !== 'object' || runnableRef.ref === 0) {
        return intValue(0);
      }

      const callback = () => {
        const runnableClass = heap.getClassDescriptor(runnableRef.ref);
        if (runnableClass) {
          interp.invoke(
            runnableClass,
            'run',
            '()V',
            [runnableRef]
          );
        }
      };

      if (uiBridge) {
        uiBridge.scheduleTimer(thisRef, runnableRef.ref, callback, delayMs);
      } else {
        setTimeout(() => {
          try {
            callback();
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`[CRAFT][View][ERROR] postDelayed callback failed: ${msg}`);
          }
        }, delayMs);
      }

      return intValue(1);
    }
  );

  // post(Ljava/lang/Runnable;)Z
  registry.register(VIEW_CLASS, 'post',
    '(Ljava/lang/Runnable;)Z',
    (interp, heap, thisRef, args) => {
      const runnableRef = args[0];

      if (runnableRef.type !== 'object' || runnableRef.ref === 0) {
        return intValue(0);
      }

      const callback = () => {
        const runnableClass = heap.getClassDescriptor(runnableRef.ref);
        if (runnableClass) {
          interp.invoke(
            runnableClass,
            'run',
            '()V',
            [runnableRef]
          );
        }
      };

      if (uiBridge) {
        uiBridge.scheduleTimer(thisRef, runnableRef.ref, callback, 0);
      } else {
        setTimeout(() => {
          try {
            callback();
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`[CRAFT][View][ERROR] post callback failed: ${msg}`);
          }
        }, 0);
      }

      return intValue(1);
    }
  );

  // removeCallbacks(Ljava/lang/Runnable;)Z
  registry.register(VIEW_CLASS, 'removeCallbacks',
    '(Ljava/lang/Runnable;)Z',
    (_interp, _heap, thisRef, args) => {
      const runnableRef = args[0];

      if (runnableRef.type !== 'object' || runnableRef.ref === 0) {
        return intValue(0);
      }

      if (uiBridge) {
        uiBridge.cancelTimersForRunnable(thisRef, runnableRef.ref);
      }

      return intValue(1);
    }
  );
}
