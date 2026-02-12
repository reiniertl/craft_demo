/**
 * Tests for ShimRegistry - method registration and invocation.
 */

import { ShimRegistry, InterpreterRef, ClassLoaderRef } from '../../../src/interpreter/shim_registry';
import { Heap } from '../../../src/interpreter/heap';
import { Value, intValue, objectRef, NULL_VALUE } from '../../../src/core/types';
import { ResolvedMethod } from '../../../src/interpreter/types';
import { NoSuchMethodError } from '../../../src/interpreter/errors';

const mockInterp: InterpreterRef = {
  invoke: () => NULL_VALUE,
  getClassLoader: () => ({ getClassObject: () => 0 }),
};

describe('ShimRegistry', () => {
  let registry: ShimRegistry;
  let heap: Heap;

  beforeEach(() => {
    registry = new ShimRegistry();
    heap = new Heap();
  });

  it('registers and checks method presence', () => {
    registry.register('Ljava/lang/Object;', '<init>', '()V', () => NULL_VALUE);
    expect(registry.hasMethod('Ljava/lang/Object;', '<init>', '()V')).toBe(true);
    expect(registry.hasMethod('Ljava/lang/Object;', 'missing', '()V')).toBe(false);
  });

  it('tracks shim classes', () => {
    registry.register('Ljava/lang/Object;', '<init>', '()V', () => NULL_VALUE);
    expect(registry.isShimClass('Ljava/lang/Object;')).toBe(true);
    expect(registry.isShimClass('Lcom/example/Foo;')).toBe(false);
  });

  it('invokes instance method with this ref extracted', () => {
    let capturedThis = -1;
    let capturedArgs: Value[] = [];

    registry.register('Lcom/example/Foo;', 'bar', '(I)V', (interp, h, thisRef, args) => {
      capturedThis = thisRef;
      capturedArgs = args;
      return NULL_VALUE;
    });

    const method: ResolvedMethod = {
      classDescriptor: 'Lcom/example/Foo;',
      name: 'bar',
      descriptor: '(I)V',
      accessFlags: 0, // not static
      code: null,
      isShim: true,
    };

    registry.invoke(method, mockInterp, heap, [objectRef(5), intValue(42)]);
    expect(capturedThis).toBe(5);
    expect(capturedArgs).toEqual([intValue(42)]);
  });

  it('invokes static method without this extraction', () => {
    let capturedThis = -1;
    let capturedArgs: Value[] = [];

    registry.register('Lcom/example/Foo;', 'bar', '(I)V', (interp, h, thisRef, args) => {
      capturedThis = thisRef;
      capturedArgs = args;
      return NULL_VALUE;
    });

    const method: ResolvedMethod = {
      classDescriptor: 'Lcom/example/Foo;',
      name: 'bar',
      descriptor: '(I)V',
      accessFlags: 0x0008, // ACC_STATIC
      code: null,
      isShim: true,
    };

    registry.invoke(method, mockInterp, heap, [intValue(42)]);
    expect(capturedThis).toBe(0);
    expect(capturedArgs).toEqual([intValue(42)]);
  });

  it('throws NoSuchMethodError for unregistered method', () => {
    const method: ResolvedMethod = {
      classDescriptor: 'Lcom/example/Foo;',
      name: 'missing',
      descriptor: '()V',
      accessFlags: 0,
      code: null,
      isShim: true,
    };
    expect(() => registry.invoke(method, mockInterp, heap, [])).toThrow(NoSuchMethodError);
  });

  it('getShimClasses returns all registered classes', () => {
    registry.register('Ljava/lang/Object;', '<init>', '()V', () => NULL_VALUE);
    registry.register('Ljava/lang/String;', '<init>', '()V', () => NULL_VALUE);
    const classes = registry.getShimClasses();
    expect(classes).toContain('Ljava/lang/Object;');
    expect(classes).toContain('Ljava/lang/String;');
  });
});
