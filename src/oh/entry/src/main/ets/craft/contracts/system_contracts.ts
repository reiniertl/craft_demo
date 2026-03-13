/**
 * CRAFT Runtime Contracts — java.lang.System (Spec JL-4)
 *
 * TypeScript encoding of JML postconditions for System static methods.
 *
 * Clause index:
 *   JL-4 I2  — currentTimeMillis is non-decreasing across calls
 *   JL-4 post:currentTimeMillis — return value > 0
 *   JL-4 post:identityHashCode(null) — returns 0
 *   JL-4 post:identityHashCode(obj)  — returns heap ref of obj
 */

import { ContractViolation } from './contract_types';

export class SystemContracts {

  // ─── currentTimeMillis postcondition ─────────────────────────────────────

  /** JL-4 post:currentTimeMillis — return value > 0. */
  static postCurrentTimeMillisPositive(
    result: { type: string; value?: unknown }
  ): ContractViolation | null {
    if (result.type !== 'long' || (result.value as bigint) <= 0n) {
      return {
        clause: 'JL-4 post:currentTimeMillis',
        kind:   'postcondition',
        detail: `currentTimeMillis() returned ${JSON.stringify(result)}, expected long > 0`,
      };
    }
    return null;
  }

  /** JL-4 I2 — currentTimeMillis is non-decreasing across calls. */
  static invariantCurrentTimeNonDecreasing(
    firstResult: bigint, secondResult: bigint
  ): ContractViolation | null {
    if (secondResult < firstResult) {
      return {
        clause: 'JL-4 I2 — currentTimeMillis non-decreasing',
        kind:   'invariant',
        detail: `Second call (${secondResult}) < first call (${firstResult})`,
      };
    }
    return null;
  }

  // ─── identityHashCode postconditions ─────────────────────────────────────

  /** JL-4 post:identityHashCode(null) — returns 0. */
  static postIdentityHashCodeNull(
    result: { type: string; value?: unknown }
  ): ContractViolation | null {
    if (result.type !== 'int' || result.value !== 0) {
      return {
        clause: 'JL-4 post:identityHashCode(null)',
        kind:   'postcondition',
        detail: `identityHashCode(null) returned ${JSON.stringify(result)}, expected 0`,
      };
    }
    return null;
  }

  /** JL-4 post:identityHashCode(obj) — returns heap ref of obj. */
  static postIdentityHashCode(
    objRef: number,
    result: { type: string; value?: unknown }
  ): ContractViolation | null {
    if (result.type !== 'int' || result.value !== objRef) {
      return {
        clause: 'JL-4 post:identityHashCode(obj)',
        kind:   'postcondition',
        detail: `identityHashCode returned ${JSON.stringify(result)}, expected ${objRef}`,
      };
    }
    return null;
  }
}
