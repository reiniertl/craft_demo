/**
 * CRAFT Runtime Contracts — java.lang.Object (Spec JL-1)
 *
 * TypeScript encoding of JML invariants and postconditions for Object.
 *
 * Clause index:
 *   JL-1 I2  — hashCode() returns heap ref of this
 *   JL-1 I3  — equals() uses reference equality
 *   JL-1 post:hashCode    — return value == thisRef
 *   JL-1 post:equals(same)  — returns 1
 *   JL-1 post:equals(diff)  — returns 0
 *   JL-1 post:equals(null)  — returns 0
 *   JL-1 post:getClass    — return value is non-null object
 */

import { Heap } from '../interpreter/heap';
import { ContractViolation } from './contract_types';

export class ObjectContracts {

  // ─── hashCode postcondition ───────────────────────────────────────────────

  /** JL-1 I2 / post:hashCode — return value equals thisRef. */
  static postHashCode(
    thisRef: number,
    result: { type: string; value?: unknown }
  ): ContractViolation | null {
    if (result.type !== 'int' || result.value !== thisRef) {
      return {
        clause: 'JL-1 post:hashCode',
        kind:   'postcondition',
        detail: `hashCode returned ${JSON.stringify(result)}, expected int ${thisRef}`,
      };
    }
    return null;
  }

  // ─── equals postconditions ────────────────────────────────────────────────

  /** JL-1 I3 / post:equals(same) — same ref returns 1. */
  static postEqualsSameRef(
    result: { type: string; value?: unknown }
  ): ContractViolation | null {
    if (result.type !== 'int' || result.value !== 1) {
      return {
        clause: 'JL-1 post:equals(same)',
        kind:   'postcondition',
        detail: `equals(same ref) returned ${JSON.stringify(result)}, expected int 1`,
      };
    }
    return null;
  }

  /** JL-1 I3 / post:equals(different) — different ref returns 0. */
  static postEqualsDifferentRef(
    result: { type: string; value?: unknown }
  ): ContractViolation | null {
    if (result.type !== 'int' || result.value !== 0) {
      return {
        clause: 'JL-1 post:equals(different)',
        kind:   'postcondition',
        detail: `equals(different ref) returned ${JSON.stringify(result)}, expected int 0`,
      };
    }
    return null;
  }

  /** JL-1 I3 / post:equals(null) — null argument returns 0. */
  static postEqualsNull(
    result: { type: string; value?: unknown }
  ): ContractViolation | null {
    if (result.type !== 'int' || result.value !== 0) {
      return {
        clause: 'JL-1 post:equals(null)',
        kind:   'postcondition',
        detail: `equals(null) returned ${JSON.stringify(result)}, expected int 0`,
      };
    }
    return null;
  }

  // ─── getClass postcondition ───────────────────────────────────────────────

  /** JL-1 post:getClass — return value is a non-null object ref. */
  static postGetClass(
    result: { type: string; ref?: number }
  ): ContractViolation | null {
    if (result.type !== 'object' || !result.ref || result.ref <= 0) {
      return {
        clause: 'JL-1 post:getClass',
        kind:   'postcondition',
        detail: `getClass() returned ${JSON.stringify(result)}, expected non-null object ref`,
      };
    }
    return null;
  }

  /** JL-1 post:getClass — __classDescriptor matches the object's class. */
  static postGetClassDescriptor(
    heap: Heap, thisRef: number, result: { type: string; ref?: number }
  ): ContractViolation | null {
    if (result.type !== 'object' || !result.ref) return null; // postGetClass catches this
    const expected  = heap.getClassDescriptor(thisRef);
    const descField = heap.getField(result.ref, '__classDescriptor');
    if (descField.type !== 'object') {
      return {
        clause: 'JL-1 post:getClass (__classDescriptor)',
        kind:   'postcondition',
        detail: `Class object has no __classDescriptor field`,
      };
    }
    const actual = heap.getStringValue((descField as { type: 'object'; ref: number }).ref);
    if (actual !== expected) {
      return {
        clause: 'JL-1 post:getClass (__classDescriptor)',
        kind:   'postcondition',
        detail: `Class.__classDescriptor="${actual}", expected "${expected}"`,
      };
    }
    return null;
  }
}
