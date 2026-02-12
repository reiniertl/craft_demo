/**
 * CRAFT - android.app.Activity Shim
 * Main lifecycle class for Android applications.
 */

import { ShimRegistry } from '../../../interpreter/shim_registry';
import { Value, NULL_VALUE, intValue, objectRef } from '../../../core/types';

const ACTIVITY_CLASS = 'Landroid/app/Activity;';

export function registerActivityShim(registry: ShimRegistry): void {

  // <init>()V
  registry.register(ACTIVITY_CLASS, '<init>', '()V',
    (_interp, heap, thisRef, _args) => {
      heap.setField(thisRef, 'mContentView', NULL_VALUE);
      heap.setField(thisRef, 'mFinished', intValue(0));
      return NULL_VALUE;
    }
  );

  // onCreate(Landroid/os/Bundle;)V
  registry.register(ACTIVITY_CLASS, 'onCreate',
    '(Landroid/os/Bundle;)V',
    (_interp, _heap, _thisRef, _args) => {
      // Base Activity.onCreate does nothing.
      // Subclass overrides call super.onCreate() which lands here.
      return NULL_VALUE;
    }
  );

  // onStart()V
  registry.register(ACTIVITY_CLASS, 'onStart', '()V',
    (_interp, _heap, _thisRef, _args) => {
      return NULL_VALUE;
    }
  );

  // onResume()V
  registry.register(ACTIVITY_CLASS, 'onResume', '()V',
    (_interp, _heap, _thisRef, _args) => {
      return NULL_VALUE;
    }
  );

  // onPause()V
  registry.register(ACTIVITY_CLASS, 'onPause', '()V',
    (_interp, _heap, _thisRef, _args) => {
      return NULL_VALUE;
    }
  );

  // onStop()V
  registry.register(ACTIVITY_CLASS, 'onStop', '()V',
    (_interp, _heap, _thisRef, _args) => {
      return NULL_VALUE;
    }
  );

  // onDestroy()V
  registry.register(ACTIVITY_CLASS, 'onDestroy', '()V',
    (_interp, _heap, _thisRef, _args) => {
      return NULL_VALUE;
    }
  );

  // setContentView(Landroid/view/View;)V
  registry.register(ACTIVITY_CLASS, 'setContentView',
    '(Landroid/view/View;)V',
    (_interp, heap, thisRef, args) => {
      heap.setField(thisRef, 'mContentView', args[0]);
      return NULL_VALUE;
    }
  );

  // findViewById(I)Landroid/view/View;
  registry.register(ACTIVITY_CLASS, 'findViewById',
    '(I)Landroid/view/View;',
    (_interp, _heap, _thisRef, _args) => {
      // Stub: return null (full implementation requires view tree traversal)
      return NULL_VALUE;
    }
  );

  // finish()V
  registry.register(ACTIVITY_CLASS, 'finish', '()V',
    (_interp, heap, thisRef, _args) => {
      heap.setField(thisRef, 'mFinished', intValue(1));
      return NULL_VALUE;
    }
  );

  // getIntent()Landroid/content/Intent;
  registry.register(ACTIVITY_CLASS, 'getIntent',
    '()Landroid/content/Intent;',
    (_interp, _heap, _thisRef, _args) => {
      // Stub: return null
      return NULL_VALUE;
    }
  );
}
