/**
 * CRAFT Runtime Contracts — java.lang.String (Spec JL-2)
 *
 * TypeScript encoding of JML invariants and postconditions for String.
 *
 * Clause index:
 *   JL-2 I1  — string value is immutable (verified structurally)
 *   JL-2 I2  — equals() compares by value, not reference
 *   JL-2 I3  — hashCode() uses Java polynomial hash
 *   JL-2 I4  — toString() returns this
 *   JL-2 post:constructor (empty)
 *   JL-2 post:constructor (copy)
 *   JL-2 post:length      — return value >= 0
 *   JL-2 post:toString    — same heap ref as this
 *   JL-2 post:equals(same value)  — returns 1
 *   JL-2 post:equals(diff value)  — returns 0
 *   JL-2 post:hashCode    — matches Java polynomial hash
 */

import { Heap } from '../interpreter/heap';
import { ContractViolation } from './contract_types';

/** Compute the Java polynomial hash for a host string. */
function javaStringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}

export class StringContracts {

  // ─── Constructor postconditions ───────────────────────────────────────────

  /** JL-2 post:constructor() — string value is "". */
  static postConstructorEmpty(
    heap: Heap, thisRef: number
  ): ContractViolation | null {
    const val = heap.getStringValue(thisRef);
    if (val !== '') {
      return {
        clause: 'JL-2 post:constructor()',
        kind:   'postcondition',
        detail: `Expected empty string, got "${val}"`,
      };
    }
    return null;
  }

  /** JL-2 post:constructor(String) — value copied from source. */
  static postConstructorCopy(
    heap: Heap, thisRef: number, expectedValue: string
  ): ContractViolation | null {
    const val = heap.getStringValue(thisRef);
    if (val !== expectedValue) {
      return {
        clause: 'JL-2 post:constructor(String)',
        kind:   'postcondition',
        detail: `Expected "${expectedValue}", got "${val}"`,
      };
    }
    return null;
  }

  // ─── length postcondition ─────────────────────────────────────────────────

  /** JL-2 post:length — return value >= 0. */
  static postLengthNonNegative(
    result: { type: string; value?: unknown }
  ): ContractViolation | null {
    if (result.type !== 'int' || (result.value as number) < 0) {
      return {
        clause: 'JL-2 post:length',
        kind:   'postcondition',
        detail: `length() returned ${JSON.stringify(result)}, expected non-negative int`,
      };
    }
    return null;
  }

  // ─── toString postcondition ───────────────────────────────────────────────

  /** JL-2 I4 / post:toString — returns this (same heap ref). */
  static postToStringIdentity(
    thisRef: number,
    result: { type: string; ref?: number }
  ): ContractViolation | null {
    if (result.type !== 'object' || result.ref !== thisRef) {
      return {
        clause: 'JL-2 I4 / post:toString',
        kind:   'postcondition',
        detail: `toString() returned ref ${result.ref}, expected this (ref ${thisRef})`,
      };
    }
    return null;
  }

  // ─── equals postconditions ────────────────────────────────────────────────

  /** JL-2 I2 / post:equals(same value) — returns 1. */
  static postEqualsSameValue(
    result: { type: string; value?: unknown }
  ): ContractViolation | null {
    if (result.type !== 'int' || result.value !== 1) {
      return {
        clause: 'JL-2 I2 / post:equals(same value)',
        kind:   'postcondition',
        detail: `equals(same content) returned ${JSON.stringify(result)}, expected 1`,
      };
    }
    return null;
  }

  /** JL-2 I2 / post:equals(different value) — returns 0. */
  static postEqualsDifferentValue(
    result: { type: string; value?: unknown }
  ): ContractViolation | null {
    if (result.type !== 'int' || result.value !== 0) {
      return {
        clause: 'JL-2 I2 / post:equals(different value)',
        kind:   'postcondition',
        detail: `equals(different content) returned ${JSON.stringify(result)}, expected 0`,
      };
    }
    return null;
  }

  /** JL-2 / post:equals(null) — returns 0. */
  static postEqualsNull(
    result: { type: string; value?: unknown }
  ): ContractViolation | null {
    if (result.type !== 'int' || result.value !== 0) {
      return {
        clause: 'JL-2 post:equals(null)',
        kind:   'postcondition',
        detail: `equals(null) returned ${JSON.stringify(result)}, expected 0`,
      };
    }
    return null;
  }

  // ─── hashCode postcondition ───────────────────────────────────────────────

  /** JL-2 I3 / post:hashCode — matches Java polynomial hash. */
  static postHashCode(
    heap: Heap, thisRef: number,
    result: { type: string; value?: unknown }
  ): ContractViolation | null {
    const str      = heap.getStringValue(thisRef);
    const expected = javaStringHash(str);
    if (result.type !== 'int' || result.value !== expected) {
      return {
        clause: 'JL-2 I3 / post:hashCode',
        kind:   'postcondition',
        detail: `hashCode() returned ${JSON.stringify(result)}, expected ${expected} for "${str}"`,
      };
    }
    return null;
  }
}
