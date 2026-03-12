/**
 * CRAFT - android.os.Bundle Shim
 * Minimal key-value container for passing data between components.
 *
 * State is stored directly on the heap object using prefixed field names
 * (__bundle_<key>) so it is automatically scoped to the object's lifetime
 * and requires no module-level cleanup.
 */

import { ShimRegistry } from '../../../interpreter/shim_registry';
import { Value, NULL_VALUE, intValue } from '../../../core/types';

const BUNDLE_CLASS = 'Landroid/os/Bundle;';
const KEY_PREFIX = '__bundle_';
const EXISTS_PREFIX = '__bundleExists_';

export function registerBundleShim(registry: ShimRegistry): void {

  // <init>()V
  registry.register(BUNDLE_CLASS, '<init>', '()V',
    (_interp, _heap, _thisRef, _args) => {
      return NULL_VALUE;
    }
  );

  // putString(Ljava/lang/String;Ljava/lang/String;)V
  registry.register(BUNDLE_CLASS, 'putString',
    '(Ljava/lang/String;Ljava/lang/String;)V',
    (_interp, heap, thisRef, args) => {
      const keyRef = (args[0] as { type: 'object'; ref: number }).ref;
      const key = heap.getStringValue(keyRef);
      heap.setField(thisRef, KEY_PREFIX + key, args[1]);
      heap.setField(thisRef, EXISTS_PREFIX + key, intValue(1));
      return NULL_VALUE;
    }
  );

  // getString(Ljava/lang/String;)Ljava/lang/String;
  registry.register(BUNDLE_CLASS, 'getString',
    '(Ljava/lang/String;)Ljava/lang/String;',
    (_interp, heap, thisRef, args) => {
      const keyRef = (args[0] as { type: 'object'; ref: number }).ref;
      const key = heap.getStringValue(keyRef);
      const val = heap.getField(thisRef, KEY_PREFIX + key);
      return val ?? NULL_VALUE;
    }
  );

  // containsKey(Ljava/lang/String;)Z
  registry.register(BUNDLE_CLASS, 'containsKey',
    '(Ljava/lang/String;)Z',
    (_interp, heap, thisRef, args) => {
      const keyRef = (args[0] as { type: 'object'; ref: number }).ref;
      const key = heap.getStringValue(keyRef);
      const sentinel = heap.getField(thisRef, EXISTS_PREFIX + key);
      return intValue(sentinel && sentinel.type === 'int' ? 1 : 0);
    }
  );
}
