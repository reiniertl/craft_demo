/**
 * CRAFT - Shim Method Registry
 * Maps Java methods to TypeScript implementations.
 */

import { Value, NULL_VALUE } from '../core/types';
import { ResolvedMethod } from './types';
import { Heap } from './heap';
import { NoSuchMethodError } from './errors';

/** Interface for the interpreter to avoid circular dependencies */
export interface InterpreterRef {
  invoke(
    className: string,
    methodName: string,
    descriptor: string,
    args: Value[]
  ): Value;
  getClassLoader(): ClassLoaderRef;
}

/** Interface for class loader to avoid circular dependencies */
export interface ClassLoaderRef {
  getClassObject(descriptor: string): number;
}

/** Shim method handler signature */
export type ShimMethod = (
  interpreter: InterpreterRef,
  heap: Heap,
  thisRef: number,
  args: Value[]
) => Value;

export class ShimRegistry {
  private methods: Map<string, ShimMethod> = new Map();
  private shimClasses: Set<string> = new Set();

  /** Register a shim method implementation */
  register(
    className: string,
    methodName: string,
    descriptor: string,
    handler: ShimMethod
  ): void {
    const key = `${className}:${methodName}:${descriptor}`;
    this.methods.set(key, handler);
    this.shimClasses.add(className);
  }

  /** Check if a method has a shim implementation */
  hasMethod(
    className: string,
    methodName: string,
    descriptor: string
  ): boolean {
    const key = `${className}:${methodName}:${descriptor}`;
    return this.methods.has(key);
  }

  /** Check if a class is a shim class */
  isShimClass(className: string): boolean {
    return this.shimClasses.has(className);
  }

  /** Invoke a shim method */
  invoke(
    method: ResolvedMethod,
    interpreter: InterpreterRef,
    heap: Heap,
    args: Value[]
  ): Value {
    const key = `${method.classDescriptor}:${method.name}:${method.descriptor}`;
    const handler = this.methods.get(key);

    if (!handler) {
      throw new NoSuchMethodError(
        `No shim for ${method.classDescriptor}.${method.name}${method.descriptor}`
      );
    }

    // Extract 'this' reference for instance methods
    const isStatic = (method.accessFlags & 0x0008) !== 0;
    let thisRef = 0;
    let methodArgs = args;

    if (!isStatic && args.length > 0) {
      const firstArg = args[0];
      if (firstArg.type === 'object') {
        thisRef = firstArg.ref;
      }
      methodArgs = args.slice(1);
    }

    return handler(interpreter, heap, thisRef, methodArgs);
  }

  /** Get all registered shim classes */
  getShimClasses(): string[] {
    return Array.from(this.shimClasses);
  }
}
