/**
 * Extended edge-case tests for java.lang.String shim.
 */

import { ShimRegistry } from '../../../src/interpreter/shim_registry';
import { Heap } from '../../../src/interpreter/heap';
import { Value, intValue, longValue, objectRef, NULL_VALUE } from '../../../src/core/types';
import { createShimTestContext, ShimTestContext } from '../../helpers/shim_test_utils';

describe('java.lang.String extended edge cases', () => {
  let registry: ShimRegistry;
  let heap: Heap;
  let invokeShim: ShimTestContext['invokeShim'];

  beforeEach(() => {
    const ctx = createShimTestContext({ javaLang: true });
    registry = ctx.registry;
    heap = ctx.heap;
    invokeShim = ctx.invokeShim;
  });

  function makeString(value: string): number {
    return heap.internString(value);
  }

  describe('charAt edge cases', () => {
    it('returns 0 on negative index (graceful degradation)', () => {
      const ref = makeString('ABC');
      const result = invokeShim('Ljava/lang/String;', 'charAt', '(I)C', [objectRef(ref), intValue(-1)]);
      expect(result).toEqual(intValue(0));
    });

    it('returns 0 on index equal to length (graceful degradation)', () => {
      const ref = makeString('AB');
      const result = invokeShim('Ljava/lang/String;', 'charAt', '(I)C', [objectRef(ref), intValue(2)]);
      expect(result).toEqual(intValue(0));
    });

    it('works at index 0', () => {
      const ref = makeString('X');
      const result = invokeShim('Ljava/lang/String;', 'charAt', '(I)C', [objectRef(ref), intValue(0)]);
      expect(result).toEqual(intValue(88)); // 'X' = 88
    });

    it('works at last valid index', () => {
      const ref = makeString('ABC');
      const result = invokeShim('Ljava/lang/String;', 'charAt', '(I)C', [objectRef(ref), intValue(2)]);
      expect(result).toEqual(intValue(67)); // 'C' = 67
    });
  });

  describe('substring edge cases', () => {
    it('returns empty string when start equals end', () => {
      const ref = makeString('hello');
      const result = invokeShim(
        'Ljava/lang/String;', 'substring', '(II)Ljava/lang/String;',
        [objectRef(ref), intValue(3), intValue(3)]
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('');
    });

    it('returns full string when start is 0 (single-arg)', () => {
      const ref = makeString('hello');
      const result = invokeShim(
        'Ljava/lang/String;', 'substring', '(I)Ljava/lang/String;',
        [objectRef(ref), intValue(0)]
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('hello');
    });

    it('returns full string when range covers entire string', () => {
      const ref = makeString('test');
      const result = invokeShim(
        'Ljava/lang/String;', 'substring', '(II)Ljava/lang/String;',
        [objectRef(ref), intValue(0), intValue(4)]
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('test');
    });

    it('returns single character when range is 1 wide', () => {
      const ref = makeString('ABCDE');
      const result = invokeShim(
        'Ljava/lang/String;', 'substring', '(II)Ljava/lang/String;',
        [objectRef(ref), intValue(2), intValue(3)]
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('C');
    });

    it('returns empty string with start at end (single-arg)', () => {
      const ref = makeString('abc');
      const result = invokeShim(
        'Ljava/lang/String;', 'substring', '(I)Ljava/lang/String;',
        [objectRef(ref), intValue(3)]
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('');
    });
  });

  describe('concat edge cases', () => {
    it('returns original content when concatenating empty string', () => {
      const ref1 = makeString('hello');
      const ref2 = makeString('');
      const result = invokeShim(
        'Ljava/lang/String;', 'concat', '(Ljava/lang/String;)Ljava/lang/String;',
        [objectRef(ref1), objectRef(ref2)]
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('hello');
    });

    it('returns argument content when this is empty', () => {
      const ref1 = makeString('');
      const ref2 = makeString('world');
      const result = invokeShim(
        'Ljava/lang/String;', 'concat', '(Ljava/lang/String;)Ljava/lang/String;',
        [objectRef(ref1), objectRef(ref2)]
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('world');
    });

    it('returns empty string when both are empty', () => {
      const ref1 = makeString('');
      const ref2 = makeString('');
      const result = invokeShim(
        'Ljava/lang/String;', 'concat', '(Ljava/lang/String;)Ljava/lang/String;',
        [objectRef(ref1), objectRef(ref2)]
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('');
    });
  });

  describe('hashCode edge cases', () => {
    it('returns 0 for empty string', () => {
      const ref = makeString('');
      const result = invokeShim('Ljava/lang/String;', 'hashCode', '()I', [objectRef(ref)]);
      expect(result).toEqual(intValue(0));
    });

    it('same string content produces same hash', () => {
      const ref1 = makeString('test');
      const ref2 = heap.allocateString('test'); // Different ref, same content
      const r1 = invokeShim('Ljava/lang/String;', 'hashCode', '()I', [objectRef(ref1)]);
      const r2 = invokeShim('Ljava/lang/String;', 'hashCode', '()I', [objectRef(ref2)]);
      expect(r1).toEqual(r2);
    });

    it('different strings produce different hashes (high probability)', () => {
      const ref1 = makeString('hello');
      const ref2 = makeString('world');
      const r1 = invokeShim('Ljava/lang/String;', 'hashCode', '()I', [objectRef(ref1)]);
      const r2 = invokeShim('Ljava/lang/String;', 'hashCode', '()I', [objectRef(ref2)]);
      expect(r1).not.toEqual(r2);
    });

    it('is stable across multiple calls', () => {
      const ref = makeString('consistency');
      const results: Value[] = [];
      for (let i = 0; i < 5; i++) {
        results.push(invokeShim('Ljava/lang/String;', 'hashCode', '()I', [objectRef(ref)]));
      }
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0]);
      }
    });
  });

  describe('valueOf edge cases', () => {
    it('valueOf(Object) with null returns "null" string', () => {
      const result = invokeShim(
        'Ljava/lang/String;', 'valueOf', '(Ljava/lang/Object;)Ljava/lang/String;',
        [NULL_VALUE], true
      );
      expect(result.type).toBe('object');
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('null');
    });

    it('valueOf(Object) with String returns that String', () => {
      const strRef = makeString('passthrough');
      const result = invokeShim(
        'Ljava/lang/String;', 'valueOf', '(Ljava/lang/Object;)Ljava/lang/String;',
        [objectRef(strRef)], true
      );
      expect(result).toEqual(objectRef(strRef));
    });

    it('valueOf(I) with zero', () => {
      const result = invokeShim(
        'Ljava/lang/String;', 'valueOf', '(I)Ljava/lang/String;',
        [intValue(0)], true
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('0');
    });

    it('valueOf(I) with negative value', () => {
      const result = invokeShim(
        'Ljava/lang/String;', 'valueOf', '(I)Ljava/lang/String;',
        [intValue(-123)], true
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('-123');
    });

    it('valueOf(I) with max int', () => {
      const result = invokeShim(
        'Ljava/lang/String;', 'valueOf', '(I)Ljava/lang/String;',
        [intValue(2147483647)], true
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('2147483647');
    });

    it('valueOf(J) with zero long', () => {
      const result = invokeShim(
        'Ljava/lang/String;', 'valueOf', '(J)Ljava/lang/String;',
        [longValue(BigInt(0))], true
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('0');
    });
  });

  describe('equals edge cases', () => {
    it('returns false when comparing with non-String object', () => {
      const strRef = makeString('test');
      const objRef = heap.allocate('Ljava/lang/Object;');
      const result = invokeShim(
        'Ljava/lang/String;', 'equals', '(Ljava/lang/Object;)Z',
        [objectRef(strRef), objectRef(objRef)]
      );
      expect(result).toEqual(intValue(0));
    });

    it('returns true for same reference', () => {
      const strRef = makeString('test');
      const result = invokeShim(
        'Ljava/lang/String;', 'equals', '(Ljava/lang/Object;)Z',
        [objectRef(strRef), objectRef(strRef)]
      );
      expect(result).toEqual(intValue(1));
    });

    it('returns false for null', () => {
      const strRef = makeString('test');
      const result = invokeShim(
        'Ljava/lang/String;', 'equals', '(Ljava/lang/Object;)Z',
        [objectRef(strRef), NULL_VALUE]
      );
      expect(result).toEqual(intValue(0));
    });

    it('empty strings are equal', () => {
      const ref1 = makeString('');
      const ref2 = heap.allocateString('');
      const result = invokeShim(
        'Ljava/lang/String;', 'equals', '(Ljava/lang/Object;)Z',
        [objectRef(ref1), objectRef(ref2)]
      );
      expect(result).toEqual(intValue(1));
    });
  });

  describe('length edge cases', () => {
    it('returns 0 for empty string', () => {
      const ref = makeString('');
      const result = invokeShim('Ljava/lang/String;', 'length', '()I', [objectRef(ref)]);
      expect(result).toEqual(intValue(0));
    });

    it('returns 1 for single character', () => {
      const ref = makeString('A');
      const result = invokeShim('Ljava/lang/String;', 'length', '()I', [objectRef(ref)]);
      expect(result).toEqual(intValue(1));
    });

    it('handles multi-byte-like characters', () => {
      const ref = makeString('café');
      const result = invokeShim('Ljava/lang/String;', 'length', '()I', [objectRef(ref)]);
      expect(result).toEqual(intValue(4));
    });
  });
});
