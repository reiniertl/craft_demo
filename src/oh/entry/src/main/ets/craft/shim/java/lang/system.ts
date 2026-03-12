/**
 * CRAFT - java.lang.System Shim
 * Basic system utilities.
 */

import { ShimRegistry } from '../../../interpreter/shim_registry';

const SYSTEM_CLASS = 'Ljava/lang/System;';

export function registerSystemShim(registry: ShimRegistry): void {
  // currentTimeMillis()J
  registry.register(
    SYSTEM_CLASS,
    'currentTimeMillis',
    '()J',
    (interp, heap, thisRef, args) => {
      const time = Date.now();
      return { type: 'long', value: BigInt(time) };
    }
  );

  // identityHashCode(Ljava/lang/Object;)I
  registry.register(
    SYSTEM_CLASS,
    'identityHashCode',
    '(Ljava/lang/Object;)I',
    (interp, heap, thisRef, args) => {
      if (args[0].type === 'null') {
        return { type: 'int', value: 0 };
      }
      const ref = (args[0] as { type: 'object'; ref: number }).ref;
      return { type: 'int', value: ref };
    }
  );

  // arraycopy(Ljava/lang/Object;ILjava/lang/Object;II)V
  registry.register(
    SYSTEM_CLASS,
    'arraycopy',
    '(Ljava/lang/Object;ILjava/lang/Object;II)V',
    (interp, heap, thisRef, args) => {
      if (args[0].type === 'null' || args[2].type === 'null') {
        console.warn('[CRAFT][System][WARN] arraycopy: null src or dst, skipping');
        return { type: 'null' };
      }
      const srcRef = (args[0] as { type: 'object'; ref: number }).ref;
      const srcPos = (args[1] as { type: 'int'; value: number }).value;
      const dstRef = (args[2] as { type: 'object'; ref: number }).ref;
      const dstPos = (args[3] as { type: 'int'; value: number }).value;
      const length = (args[4] as { type: 'int'; value: number }).value;

      const srcLen = heap.getArrayLength(srcRef);
      const dstLen = heap.getArrayLength(dstRef);

      if (srcPos < 0 || dstPos < 0 || length < 0 ||
          srcPos + length > srcLen || dstPos + length > dstLen) {
        console.warn(`[CRAFT][System][WARN] arraycopy: bounds violation src(${srcPos}+${length}/${srcLen}) dst(${dstPos}+${length}/${dstLen}), skipping`);
        return { type: 'null' };
      }

      // Copy direction chosen to handle overlapping ranges correctly:
      // if src and dst are the same array and dstPos > srcPos, copy right-to-left.
      if (srcRef === dstRef && dstPos > srcPos) {
        for (let i = length - 1; i >= 0; i--) {
          heap.setArrayElement(dstRef, dstPos + i, heap.getArrayElement(srcRef, srcPos + i));
        }
      } else {
        for (let i = 0; i < length; i++) {
          heap.setArrayElement(dstRef, dstPos + i, heap.getArrayElement(srcRef, srcPos + i));
        }
      }

      return { type: 'null' };
    }
  );
}
