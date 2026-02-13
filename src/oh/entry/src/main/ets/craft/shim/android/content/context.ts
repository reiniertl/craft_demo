/**
 * CRAFT - android.content.Context and ContextWrapper Shims
 * Base context classes for the Android framework.
 */

import { ShimRegistry } from '../../../interpreter/shim_registry';
import { Value, NULL_VALUE, objectRef } from '../../../core/types';

const CONTEXT_CLASS = 'Landroid/content/Context;';
const CONTEXT_WRAPPER_CLASS = 'Landroid/content/ContextWrapper;';

export function registerContextShim(registry: ShimRegistry): void {

  // Context.<init>()V
  registry.register(CONTEXT_CLASS, '<init>', '()V',
    (_interp, _heap, _thisRef, _args) => {
      return NULL_VALUE;
    }
  );

  // Context.getApplicationContext()Landroid/content/Context;
  registry.register(CONTEXT_CLASS, 'getApplicationContext',
    '()Landroid/content/Context;',
    (_interp, _heap, thisRef, _args) => {
      // Return self as application context
      return objectRef(thisRef);
    }
  );
}

export function registerContextWrapperShim(registry: ShimRegistry): void {

  // ContextWrapper.<init>()V - no-arg constructor (used by Activity super chain)
  registry.register(CONTEXT_WRAPPER_CLASS, '<init>', '()V',
    (_interp, _heap, _thisRef, _args) => {
      return NULL_VALUE;
    }
  );

  // ContextWrapper.<init>(Landroid/content/Context;)V
  registry.register(CONTEXT_WRAPPER_CLASS, '<init>',
    '(Landroid/content/Context;)V',
    (_interp, heap, thisRef, args) => {
      heap.setField(thisRef, 'mBase', args[0]);
      return NULL_VALUE;
    }
  );

  // ContextWrapper.getBaseContext()Landroid/content/Context;
  registry.register(CONTEXT_WRAPPER_CLASS, 'getBaseContext',
    '()Landroid/content/Context;',
    (_interp, heap, thisRef, _args) => {
      return heap.getField(thisRef, 'mBase');
    }
  );

  // ContextWrapper.getApplicationContext()Landroid/content/Context;
  registry.register(CONTEXT_WRAPPER_CLASS, 'getApplicationContext',
    '()Landroid/content/Context;',
    (_interp, _heap, thisRef, _args) => {
      return objectRef(thisRef);
    }
  );
}
