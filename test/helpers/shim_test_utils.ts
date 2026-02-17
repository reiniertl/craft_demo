/**
 * CRAFT - Shared Shim Test Utilities
 * Reusable helpers for shim unit and integration tests.
 */

import { ShimRegistry, InterpreterRef } from '../../src/interpreter/shim_registry';
import { Heap } from '../../src/interpreter/heap';
import { registerJavaLangShims } from '../../src/shim/java/lang/index';
import { registerAndroidShims } from '../../src/shim/android/index';
import { Value } from '../../src/core/types';
import { ResolvedMethod } from '../../src/interpreter/types';

/** Create a ResolvedMethod stub for shim invocation */
export function makeMethod(
  classDesc: string,
  name: string,
  desc: string,
  isStatic: boolean = false
): ResolvedMethod {
  return {
    classDescriptor: classDesc,
    name,
    descriptor: desc,
    accessFlags: isStatic ? 0x0008 : 0,
    code: null,
    isShim: true,
  };
}

/** Invoke a shim method directly via registry */
export function invokeShim(
  registry: ShimRegistry,
  interpreter: InterpreterRef,
  heap: Heap,
  classDesc: string,
  name: string,
  desc: string,
  args: Value[],
  isStatic: boolean = false
): Value {
  const method = makeMethod(classDesc, name, desc, isStatic);
  return registry.invoke(method, interpreter, heap, args);
}

/** Options for creating a shim test context */
export interface ShimTestContextOptions {
  /** Register java.lang.* shims (default: true) */
  javaLang?: boolean;
  /** Register android.* shims (default: false) */
  android?: boolean;
}

/** A fully wired shim test context */
export interface ShimTestContext {
  registry: ShimRegistry;
  heap: Heap;
  mockInterp: InterpreterRef;
  /** Convenience: invoke a shim method */
  invokeShim: (
    classDesc: string,
    name: string,
    desc: string,
    args: Value[],
    isStatic?: boolean
  ) => Value;
}

/** Create a complete shim test context with registry, heap, and mock interpreter */
export function createShimTestContext(
  opts: ShimTestContextOptions = {}
): ShimTestContext {
  const { javaLang = true, android = false } = opts;

  const registry = new ShimRegistry();
  const heap = new Heap();

  const mockInterp: InterpreterRef = {
    invoke: (className, methodName, descriptor, args) => {
      const method = makeMethod(className, methodName, descriptor);
      return registry.invoke(method, mockInterp, heap, args);
    },
    getClassLoader: () => ({
      getClassObject: (desc: string) => {
        const ref = heap.allocate('Ljava/lang/Class;');
        heap.setField(ref, '__classDescriptor', {
          type: 'object',
          ref: heap.internString(desc),
        });
        return ref;
      },
    }),
  };

  if (javaLang) {
    registerJavaLangShims(registry);
  }
  if (android) {
    registerAndroidShims(registry);
  }

  const invoke = (
    classDesc: string,
    name: string,
    desc: string,
    args: Value[],
    isStatic: boolean = false
  ): Value => {
    return invokeShim(registry, mockInterp, heap, classDesc, name, desc, args, isStatic);
  };

  return { registry, heap, mockInterp, invokeShim: invoke };
}
