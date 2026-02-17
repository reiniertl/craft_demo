/**
 * CRAFT - Custom Jest Value Matchers
 * Ergonomic matchers for CRAFT Value type assertions.
 */

import { Value } from '../../src/core/types';
import { Heap } from '../../src/interpreter/heap';

declare global {
  namespace jest {
    interface Matchers<R> {
      /** Assert value is { type: 'int', value: n } */
      toBeInt(n: number): R;
      /** Assert value is { type: 'float', value: n } (approximate) */
      toBeFloat(n: number): R;
      /** Assert value is { type: 'null' } */
      toBeNullValue(): R;
      /** Assert value is { type: 'object', ref: n } */
      toBeObjectRef(n: number): R;
      /** Assert value is an object ref and its string value equals s */
      toHaveStringValue(heap: Heap, s: string): R;
    }
  }
}

export const craftMatchers: jest.ExpectExtendMap = {
  toBeInt(received: Value, expected: number) {
    const pass =
      received.type === 'int' &&
      (received as { type: 'int'; value: number }).value === (expected | 0);
    return {
      pass,
      message: () =>
        pass
          ? `expected value not to be int(${expected}), but it was`
          : `expected int(${expected}), got ${JSON.stringify(received)}`,
    };
  },

  toBeFloat(received: Value, expected: number) {
    const pass =
      received.type === 'float' &&
      Math.abs(
        (received as { type: 'float'; value: number }).value - expected
      ) < 1e-6;
    return {
      pass,
      message: () =>
        pass
          ? `expected value not to be float(${expected}), but it was`
          : `expected float(${expected}), got ${JSON.stringify(received)}`,
    };
  },

  toBeNullValue(received: Value) {
    const pass = received.type === 'null';
    return {
      pass,
      message: () =>
        pass
          ? `expected value not to be null, but it was`
          : `expected null value, got ${JSON.stringify(received)}`,
    };
  },

  toBeObjectRef(received: Value, expected: number) {
    const pass =
      received.type === 'object' &&
      (received as { type: 'object'; ref: number }).ref === expected;
    return {
      pass,
      message: () =>
        pass
          ? `expected value not to be objectRef(${expected}), but it was`
          : `expected objectRef(${expected}), got ${JSON.stringify(received)}`,
    };
  },

  toHaveStringValue(received: Value, heap: Heap, expected: string) {
    if (received.type !== 'object') {
      return {
        pass: false,
        message: () =>
          `expected an object ref with string value "${expected}", got ${JSON.stringify(received)}`,
      };
    }
    const ref = (received as { type: 'object'; ref: number }).ref;
    let actual: string;
    try {
      actual = heap.getStringValue(ref);
    } catch {
      return {
        pass: false,
        message: () =>
          `expected string value "${expected}", but ref ${ref} has no string value`,
      };
    }
    const pass = actual === expected;
    return {
      pass,
      message: () =>
        pass
          ? `expected string not to be "${expected}", but it was`
          : `expected string "${expected}", got "${actual}"`,
    };
  },
};

// Auto-register matchers
expect.extend(craftMatchers);
