/**
 * CRAFT - android.widget.TextView Shim
 * Text display component - the critical UI element for Hello World.
 */

import { ShimRegistry } from '../../../interpreter/shim_registry';
import { UIBridge } from '../../../bridge/ui_bridge';
import { Value, NULL_VALUE, intValue, floatValue, objectRef } from '../../../core/types';

const TEXTVIEW_CLASS = 'Landroid/widget/TextView;';

export function registerTextViewShim(registry: ShimRegistry, uiBridge?: UIBridge): void {

  // <init>(Landroid/content/Context;)V
  registry.register(TEXTVIEW_CLASS, '<init>',
    '(Landroid/content/Context;)V',
    (_interp, heap, thisRef, args) => {
      // Initialize View fields
      heap.setField(thisRef, 'mContext', args[0]);
      heap.setField(thisRef, 'mId', intValue(-1));
      heap.setField(thisRef, 'mVisibility', intValue(0));
      // Initialize ViewGroup fields (spec V-2) — TextView extends ViewGroup
      heap.setField(thisRef, '__childCount', intValue(0));
      // Initialize TextView fields — mText MUST NOT be null (spec V-3 invariant 1)
      heap.setField(thisRef, 'mText', objectRef(heap.internString('')));
      heap.setField(thisRef, 'mTextSize', floatValue(14.0));
      heap.setField(thisRef, 'mTextColor', intValue(0xFF000000 | 0));

      // Register with UI bridge and initialise all ViewNode properties (JML I-TV3/4/5)
      if (uiBridge) {
        uiBridge.registerView(thisRef, 'TextView');
        uiBridge.updateViewProperty(thisRef, 'visibility', 0);
        uiBridge.updateViewProperty(thisRef, 'text', '');
        uiBridge.updateViewProperty(thisRef, 'textSize', 14.0);
        uiBridge.updateViewProperty(thisRef, 'textColor', 0xFF000000 | 0);
      }

      return NULL_VALUE;
    }
  );

  // setText(Ljava/lang/CharSequence;)V
  registry.register(TEXTVIEW_CLASS, 'setText',
    '(Ljava/lang/CharSequence;)V',
    (_interp, heap, thisRef, args) => {
      heap.setField(thisRef, 'mText', args[0]);

      if (uiBridge) {
        const textRef = args[0];
        const textValue = (textRef.type === 'object' && textRef.ref !== 0)
          ? heap.getStringValue(textRef.ref)
          : '';
        uiBridge.updateViewProperty(thisRef, 'text', textValue);
      }

      return NULL_VALUE;
    }
  );

  // getText()Ljava/lang/CharSequence;
  registry.register(TEXTVIEW_CLASS, 'getText',
    '()Ljava/lang/CharSequence;',
    (_interp, heap, thisRef, _args) => {
      return heap.getField(thisRef, 'mText');
    }
  );

  // setTextSize(F)V
  registry.register(TEXTVIEW_CLASS, 'setTextSize', '(F)V',
    (_interp, heap, thisRef, args) => {
      heap.setField(thisRef, 'mTextSize', args[0]);

      // Notify UI bridge of text size change
      if (uiBridge) {
        const textSizeValue = args[0].type === 'float' ? args[0].value : 14.0;
        uiBridge.updateViewProperty(thisRef, 'textSize', textSizeValue);
      }

      return NULL_VALUE;
    }
  );

  // setTextColor(I)V
  registry.register(TEXTVIEW_CLASS, 'setTextColor', '(I)V',
    (_interp, heap, thisRef, args) => {
      heap.setField(thisRef, 'mTextColor', args[0]);

      // Notify UI bridge of text color change
      if (uiBridge) {
        const textColorValue = args[0].type === 'int' ? args[0].value : 0xFF000000;
        uiBridge.updateViewProperty(thisRef, 'textColor', textColorValue);
      }

      return NULL_VALUE;
    }
  );
}
