/**
 * CRAFT Runtime Contracts — java.lang.Class (Spec JL-5)
 *
 * TypeScript encoding of JML invariants and postconditions for Class.
 *
 * Clause index:
 *   JL-5 I1  — __classDescriptor is immutable and non-null
 *   JL-5 I3  — getName/getSimpleName derived from __classDescriptor
 *   JL-5 post:getName       — non-null, non-empty
 *   JL-5 post:getName       — correct transformation from descriptor
 *   JL-5 post:getSimpleName — non-null, non-empty
 *   JL-5 post:toString      — starts with "class "
 */

import { Heap } from '../interpreter/heap';
import { ContractViolation } from './contract_types';

export class ClassContracts {

  // ─── __classDescriptor invariant ─────────────────────────────────────────

  /** JL-5 I1 — __classDescriptor is set and non-empty. */
  static invariantDescriptorPresent(
    heap: Heap, thisRef: number
  ): ContractViolation | null {
    const field = heap.getField(thisRef, '__classDescriptor');
    if (field.type !== 'object') {
      return {
        clause: 'JL-5 I1 — __classDescriptor present',
        kind:   'invariant',
        detail: `__classDescriptor field is missing or non-object: ${JSON.stringify(field)}`,
      };
    }
    const val = heap.getStringValue((field as { type: 'object'; ref: number }).ref);
    if (!val || val.length === 0) {
      return {
        clause: 'JL-5 I1 — __classDescriptor non-empty',
        kind:   'invariant',
        detail: `__classDescriptor is empty string`,
      };
    }
    return null;
  }

  // ─── getName postconditions ───────────────────────────────────────────────

  /** JL-5 I3 / post:getName — result is non-null and non-empty. */
  static postGetNameNonEmpty(
    heap: Heap, result: { type: string; ref?: number }
  ): ContractViolation | null {
    if (result.type !== 'object' || !result.ref) {
      return {
        clause: 'JL-5 post:getName (non-null)',
        kind:   'postcondition',
        detail: `getName() returned ${JSON.stringify(result)}, expected non-null string`,
      };
    }
    const val = heap.getStringValue(result.ref);
    if (!val || val.length === 0) {
      return {
        clause: 'JL-5 post:getName (non-empty)',
        kind:   'postcondition',
        detail: `getName() returned empty string`,
      };
    }
    return null;
  }

  /** JL-5 I3 / post:getName — correct transformation from DEX descriptor. */
  static postGetNameTransformation(
    heap: Heap, thisRef: number, result: { type: string; ref?: number }
  ): ContractViolation | null {
    if (result.type !== 'object' || !result.ref) return null; // postGetNameNonEmpty covers this
    const descField = heap.getField(thisRef, '__classDescriptor');
    if (descField.type !== 'object') return null;
    const descriptor = heap.getStringValue((descField as { type: 'object'; ref: number }).ref);
    // Expected: strip leading 'L' and trailing ';', replace '/' with '.'
    const expected = descriptor.slice(1, -1).replace(/\//g, '.');
    const actual   = heap.getStringValue(result.ref);
    if (actual !== expected) {
      return {
        clause: 'JL-5 I3 / post:getName (transformation)',
        kind:   'postcondition',
        detail: `getName() returned "${actual}", expected "${expected}" from descriptor "${descriptor}"`,
      };
    }
    return null;
  }

  // ─── getSimpleName postconditions ─────────────────────────────────────────

  /** JL-5 I3 / post:getSimpleName — non-null and non-empty. */
  static postGetSimpleNameNonEmpty(
    heap: Heap, result: { type: string; ref?: number }
  ): ContractViolation | null {
    if (result.type !== 'object' || !result.ref) {
      return {
        clause: 'JL-5 post:getSimpleName (non-null)',
        kind:   'postcondition',
        detail: `getSimpleName() returned ${JSON.stringify(result)}, expected non-null string`,
      };
    }
    const val = heap.getStringValue(result.ref);
    if (!val || val.length === 0) {
      return {
        clause: 'JL-5 post:getSimpleName (non-empty)',
        kind:   'postcondition',
        detail: `getSimpleName() returned empty string`,
      };
    }
    return null;
  }

  // ─── toString postcondition ───────────────────────────────────────────────

  /** JL-5 post:toString — result starts with "class ". */
  static postToStringPrefix(
    heap: Heap, result: { type: string; ref?: number }
  ): ContractViolation | null {
    if (result.type !== 'object' || !result.ref) {
      return {
        clause: 'JL-5 post:toString',
        kind:   'postcondition',
        detail: `toString() returned ${JSON.stringify(result)}, expected string`,
      };
    }
    const val = heap.getStringValue(result.ref);
    if (!val.startsWith('class ')) {
      return {
        clause: 'JL-5 post:toString',
        kind:   'postcondition',
        detail: `toString() returned "${val}", expected prefix "class "`,
      };
    }
    return null;
  }
}
