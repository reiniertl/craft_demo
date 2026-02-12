/**
 * CRAFT - android.widget.TextView Shim
 * Text display component - the critical UI element for Hello World.
 */

import { ShimRegistry } from '../../../interpreter/shim_registry';
import { Value, NULL_VALUE, intValue, floatValue, objectRef } from '../../../core/types';

const TEXTVIEW_CLASS = 'Landroid/widget/TextView;';

export function registerTextViewShim(registry: ShimRegistry): void {

  // <init>(Landroid/content/Context;)V
  registry.register(TEXTVIEW_CLASS, '<init>',
    '(Landroid/content/Context;)V',
    (_interp, heap, thisRef, args) => {
      // Initialize View fields
      heap.setField(thisRef, 'mContext', args[0]);
      heap.setField(thisRef, 'mId', intValue(-1));
      heap.setField(thisRef, 'mVisibility', intValue(0));
      // Initialize TextView fields
      heap.setField(thisRef, 'mText', NULL_VALUE);
      heap.setField(thisRef, 'mTextSize', floatValue(14.0));
      heap.setField(thisRef, 'mTextColor', intValue(0xFF000000 | 0));
      return NULL_VALUE;
    }
  );

  // setText(Ljava/lang/CharSequence;)V
  registry.register(TEXTVIEW_CLASS, 'setText',
    '(Ljava/lang/CharSequence;)V',
    (_interp, heap, thisRef, args) => {
      heap.setField(thisRef, 'mText', args[0]);
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
      return NULL_VALUE;
    }
  );

  // setTextColor(I)V
  registry.register(TEXTVIEW_CLASS, 'setTextColor', '(I)V',
    (_interp, heap, thisRef, args) => {
      heap.setField(thisRef, 'mTextColor', args[0]);
      return NULL_VALUE;
    }
  );
}
