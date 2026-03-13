/**
 * CRAFT Runtime Contracts — java.lang.StringBuilder (Spec JL-3)
 *
 * TypeScript encoding of JML invariants and postconditions for StringBuilder.
 *
 * Clause index:
 *   JL-3 I1  — mutating methods return this
 *   JL-3 I2  — buffer initialised to "" at construction
 *   JL-3 I3  — length() == toString().length()
 *   JL-3 post:constructor()       — buffer is ""
 *   JL-3 post:constructor(String) — buffer equals source string
 *   JL-3 post:append — returns this
 *   JL-3 post:append — buffer updated
 *   JL-3 post:length — return value >= 0
 *   JL-3 post:toString — distinct ref from this
 */

import { Heap } from '../interpreter/heap';
import { ContractViolation } from './contract_types';

const BUILDER_VALUE_FIELD = '__builderValue';

/** Helper: read the current builder buffer from the heap. */
function getBuilderValue(heap: Heap, thisRef: number): string {
  const field = heap.getField(thisRef, BUILDER_VALUE_FIELD);
  if (field.type !== 'object') return '';
  return heap.getStringValue((field as { type: 'object'; ref: number }).ref);
}

export class StringBuilderContracts {

  // ─── Constructor postconditions ───────────────────────────────────────────

  /** JL-3 I2 / post:constructor() — buffer is "". */
  static postConstructorEmpty(
    heap: Heap, thisRef: number
  ): ContractViolation | null {
    const val = getBuilderValue(heap, thisRef);
    if (val !== '') {
      return {
        clause: 'JL-3 I2 / post:constructor()',
        kind:   'postcondition',
        detail: `Expected empty buffer, got "${val}"`,
      };
    }
    return null;
  }

  /** JL-3 post:constructor(String) — buffer equals source string. */
  static postConstructorFromString(
    heap: Heap, thisRef: number, expectedValue: string
  ): ContractViolation | null {
    const val = getBuilderValue(heap, thisRef);
    if (val !== expectedValue) {
      return {
        clause: 'JL-3 post:constructor(String)',
        kind:   'postcondition',
        detail: `Expected buffer "${expectedValue}", got "${val}"`,
      };
    }
    return null;
  }

  // ─── append postconditions ────────────────────────────────────────────────

  /** JL-3 I1 / post:append — returns this (same heap ref). */
  static postAppendReturnsThis(
    thisRef: number,
    result: { type: string; ref?: number }
  ): ContractViolation | null {
    if (result.type !== 'object' || result.ref !== thisRef) {
      return {
        clause: 'JL-3 I1 / post:append',
        kind:   'postcondition',
        detail: `append() returned ref ${result.ref}, expected this (ref ${thisRef})`,
      };
    }
    return null;
  }

  /** JL-3 post:append — buffer updated with appended content. */
  static postAppendBuffer(
    heap: Heap, thisRef: number, expectedBuffer: string
  ): ContractViolation | null {
    const val = getBuilderValue(heap, thisRef);
    if (val !== expectedBuffer) {
      return {
        clause: 'JL-3 post:append (buffer)',
        kind:   'postcondition',
        detail: `Expected buffer "${expectedBuffer}", got "${val}"`,
      };
    }
    return null;
  }

  // ─── length postcondition ─────────────────────────────────────────────────

  /** JL-3 post:length — return value >= 0. */
  static postLengthNonNegative(
    result: { type: string; value?: unknown }
  ): ContractViolation | null {
    if (result.type !== 'int' || (result.value as number) < 0) {
      return {
        clause: 'JL-3 post:length',
        kind:   'postcondition',
        detail: `length() returned ${JSON.stringify(result)}, expected non-negative int`,
      };
    }
    return null;
  }

  // ─── I3: length() == toString().length() ─────────────────────────────────

  /** JL-3 I3 — length() equals current buffer length. */
  static invariantLengthConsistency(
    heap: Heap, thisRef: number, lengthResult: { type: string; value?: unknown }
  ): ContractViolation | null {
    const buffer  = getBuilderValue(heap, thisRef);
    const expected = buffer.length;
    if (lengthResult.type !== 'int' || lengthResult.value !== expected) {
      return {
        clause: 'JL-3 I3 — length consistency',
        kind:   'invariant',
        detail: `length() returned ${JSON.stringify(lengthResult)}, buffer has ${expected} chars`,
      };
    }
    return null;
  }

  // ─── toString postcondition ───────────────────────────────────────────────

  /** JL-3 post:toString — result is a distinct heap ref from this. */
  static postToStringDistinct(
    thisRef: number,
    result: { type: string; ref?: number }
  ): ContractViolation | null {
    if (result.type !== 'object' || result.ref === thisRef) {
      return {
        clause: 'JL-3 post:toString',
        kind:   'postcondition',
        detail: `toString() must return a distinct ref from this (ref ${thisRef})`,
      };
    }
    return null;
  }
}
