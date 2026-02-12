/**
 * Tests for Heap - object allocation, field access, arrays, strings.
 */

import { Heap } from '../../../src/interpreter/heap';
import { Value, NULL_VALUE, intValue, objectRef } from '../../../src/core/types';
import { ArrayIndexOutOfBoundsException, NullPointerException } from '../../../src/interpreter/errors';

describe('Heap', () => {
  let heap: Heap;

  beforeEach(() => {
    heap = new Heap();
  });

  describe('Object Allocation', () => {
    it('allocates object with correct descriptor', () => {
      const ref = heap.allocate('Lcom/example/Test;');
      expect(ref).toBeGreaterThan(0);
      expect(heap.getClassDescriptor(ref)).toBe('Lcom/example/Test;');
    });

    it('allocates multiple objects with unique refs', () => {
      const ref1 = heap.allocate('Lcom/example/A;');
      const ref2 = heap.allocate('Lcom/example/B;');
      expect(ref1).not.toBe(ref2);
    });

    it('returns null for invalid ref', () => {
      expect(heap.getObject(999)).toBeNull();
      expect(heap.getClassDescriptor(999)).toBeNull();
    });
  });

  describe('Field Access', () => {
    it('set/get returns correct values', () => {
      const ref = heap.allocate('Lcom/example/Test;');
      heap.setField(ref, 'count', intValue(42));
      const val = heap.getField(ref, 'count');
      expect(val).toEqual(intValue(42));
    });

    it('returns null for unset fields', () => {
      const ref = heap.allocate('Lcom/example/Test;');
      const val = heap.getField(ref, 'missing');
      expect(val).toEqual(NULL_VALUE);
    });

    it('handles object reference fields', () => {
      const obj1 = heap.allocate('Lcom/example/A;');
      const obj2 = heap.allocate('Lcom/example/B;');
      heap.setField(obj1, 'child', objectRef(obj2));
      const val = heap.getField(obj1, 'child');
      expect(val).toEqual(objectRef(obj2));
    });

    it('throws on field access for invalid ref', () => {
      expect(() => heap.getField(999, 'x')).toThrow(NullPointerException);
      expect(() => heap.setField(999, 'x', intValue(0))).toThrow(NullPointerException);
    });
  });

  describe('Array Support', () => {
    it('allocates array with correct length', () => {
      const ref = heap.allocateArray('I', 5);
      expect(heap.getArrayLength(ref)).toBe(5);
    });

    it('initializes int array elements to 0', () => {
      const ref = heap.allocateArray('I', 3);
      expect(heap.getArrayElement(ref, 0)).toEqual(intValue(0));
      expect(heap.getArrayElement(ref, 1)).toEqual(intValue(0));
      expect(heap.getArrayElement(ref, 2)).toEqual(intValue(0));
    });

    it('initializes object array elements to null', () => {
      const ref = heap.allocateArray('Ljava/lang/Object;', 2);
      expect(heap.getArrayElement(ref, 0)).toEqual(NULL_VALUE);
      expect(heap.getArrayElement(ref, 1)).toEqual(NULL_VALUE);
    });

    it('set/get array elements', () => {
      const ref = heap.allocateArray('I', 3);
      heap.setArrayElement(ref, 1, intValue(99));
      expect(heap.getArrayElement(ref, 1)).toEqual(intValue(99));
    });

    it('throws on out of bounds access', () => {
      const ref = heap.allocateArray('I', 3);
      expect(() => heap.getArrayElement(ref, -1)).toThrow(ArrayIndexOutOfBoundsException);
      expect(() => heap.getArrayElement(ref, 3)).toThrow(ArrayIndexOutOfBoundsException);
    });
  });

  describe('String Support', () => {
    it('allocates string with value', () => {
      const ref = heap.allocateString('hello');
      expect(heap.getStringValue(ref)).toBe('hello');
      expect(heap.getClassDescriptor(ref)).toBe('Ljava/lang/String;');
    });

    it('interns strings - same content returns same ref', () => {
      const ref1 = heap.internString('test');
      const ref2 = heap.internString('test');
      expect(ref1).toBe(ref2);
    });

    it('interns strings - different content returns different ref', () => {
      const ref1 = heap.internString('hello');
      const ref2 = heap.internString('world');
      expect(ref1).not.toBe(ref2);
    });

    it('set/get string value', () => {
      const ref = heap.allocateString('original');
      heap.setStringValue(ref, 'modified');
      expect(heap.getStringValue(ref)).toBe('modified');
    });
  });

  describe('Type Checking', () => {
    it('isInstanceOf returns true for matching type', () => {
      const ref = heap.allocate('Lcom/example/Foo;');
      expect(heap.isInstanceOf(ref, 'Lcom/example/Foo;')).toBe(true);
    });

    it('isInstanceOf returns false for non-matching type', () => {
      const ref = heap.allocate('Lcom/example/Foo;');
      expect(heap.isInstanceOf(ref, 'Lcom/example/Bar;')).toBe(false);
    });

    it('isInstanceOf returns false for invalid ref', () => {
      expect(heap.isInstanceOf(999, 'Lcom/example/Foo;')).toBe(false);
    });
  });
});
