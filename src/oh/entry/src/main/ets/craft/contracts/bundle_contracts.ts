/**
 * CRAFT Runtime Contracts — android.os.Bundle (Spec A-1)
 *
 * TypeScript encoding of docs/specs/formal/android_os_bundle.jml.
 *
 * Clause index:
 *   A-1 I-B3   — _exists == store.keySet()
 *   A-1 I-B4   — per-instance isolation (no shared store)
 *   A-1 post:constructor  — store empty, exists empty
 *   A-1 post:putString    — key in exists, value stored, frame preserved
 *   A-1 post:getString    — returns stored value or null
 *   A-1 post:containsKey  — returns 1 iff key in exists
 *   A-1 isolation         — addView on instance A does not affect instance B
 */

import { Heap }      from '../interpreter/heap';
import { ContractViolation } from './contract_types';

const KEY_PREFIX    = '__bundle_';
const EXISTS_PREFIX = '__bundleExists_';

export class BundleContracts {

  // ─── Helpers ──────────────────────────────────────────────────────────────

  static isKeyPresent(heap: Heap, thisRef: number, key: string): boolean {
    const sentinel = heap.getField(thisRef, EXISTS_PREFIX + key);
    return sentinel !== undefined && sentinel.type === 'int' && sentinel.value === 1;
  }

  static getStoredValue(heap: Heap, thisRef: number, key: string): unknown {
    return heap.getField(thisRef, KEY_PREFIX + key);
  }

  // ─── Class invariants ─────────────────────────────────────────────────────

  /**
   * A-1 I-B4 ISOLATION: putting a key into one Bundle must not affect
   * another Bundle. This checks that the second bundle's key count did NOT
   * change as a side effect of an operation on the first bundle.
   *
   * Usage:
   *   const before = countKeys(heap, otherRef, knownKeys);
   *   // perform putString on thisRef
   *   invariantIsolation(heap, otherRef, knownKeys, before)
   */
  static invariantIsolation(
    heap: Heap, otherRef: number, keysToCheck: string[], countBefore: number
  ): ContractViolation | null {
    const countAfter = keysToCheck.filter(
      k => BundleContracts.isKeyPresent(heap, otherRef, k)
    ).length;
    if (countAfter !== countBefore) {
      return {
        clause: 'A-1 I-B4',
        kind:   'invariant',
        detail: `putString on one Bundle affected another: key count of otherRef changed ` +
                `from ${countBefore} to ${countAfter} (singleton store bug)`,
      };
    }
    return null;
  }

  // ─── Constructor postconditions ──────────────────────────────────────────

  /**
   * A-1 post:constructor — a freshly-constructed Bundle has no keys.
   * Checks a representative set of keys to verify the store is empty.
   */
  static postConstructorEmpty(
    heap: Heap, thisRef: number, keysToCheck: string[]
  ): ContractViolation | null {
    for (const key of keysToCheck) {
      if (BundleContracts.isKeyPresent(heap, thisRef, key)) {
        return {
          clause: 'A-1 post:constructor',
          kind:   'postcondition',
          detail: `Freshly-constructed Bundle already contains key "${key}"`,
        };
      }
    }
    return null;
  }

  // ─── putString postconditions ─────────────────────────────────────────────

  /** A-1 post:putString — key is in exists after the call. */
  static postPutStringExists(
    heap: Heap, thisRef: number, key: string
  ): ContractViolation | null {
    if (!BundleContracts.isKeyPresent(heap, thisRef, key)) {
      return {
        clause: 'A-1 post:putString (exists)',
        kind:   'postcondition',
        detail: `Key "${key}" not in exists after putString`,
      };
    }
    return null;
  }

  /**
   * A-1 post:putString — value is stored (existence sentinel set).
   * We check that containsKey returns 1, which proves the existence flag was set.
   */
  static postPutStringContainsKey(
    heap: Heap, thisRef: number, key: string
  ): ContractViolation | null {
    return BundleContracts.postPutStringExists(heap, thisRef, key);
  }

  /**
   * A-1 post:putString frame — other keys unchanged.
   * @param otherKey a key different from the one just put
   * @param presentBefore whether otherKey was present before the putString call
   */
  static postPutStringFrame(
    heap: Heap, thisRef: number, otherKey: string, presentBefore: boolean
  ): ContractViolation | null {
    const presentAfter = BundleContracts.isKeyPresent(heap, thisRef, otherKey);
    if (presentAfter !== presentBefore) {
      return {
        clause: 'A-1 post:putString (frame)',
        kind:   'postcondition',
        detail: `putString changed presence of unrelated key "${otherKey}": ` +
                `was ${presentBefore}, now ${presentAfter}`,
      };
    }
    return null;
  }

  // ─── containsKey postconditions ──────────────────────────────────────────

  /** A-1 post:containsKey — returns 1 iff key was previously put. */
  static postContainsKey(
    result: { type: string; value: unknown },
    key: string,
    wasPut: boolean
  ): ContractViolation | null {
    const got = result.type === 'int' ? result.value : -1;
    const expected = wasPut ? 1 : 0;
    if (got !== expected) {
      return {
        clause: 'A-1 post:containsKey',
        kind:   'postcondition',
        detail: `containsKey("${key}") returned ${got}, expected ${expected} (wasPut=${wasPut})`,
      };
    }
    return null;
  }

  // ─── getString postconditions ─────────────────────────────────────────────

  /**
   * A-1 post:getString — returns null for absent keys.
   * @param result the Value returned by getString
   */
  static postGetStringAbsent(
    result: { type: string },
    key: string
  ): ContractViolation | null {
    if (result.type !== 'null' && !(result.type === 'object' && (result as { ref?: number }).ref === 0)) {
      return {
        clause: 'A-1 post:getString (absent)',
        kind:   'postcondition',
        detail: `getString("${key}") returned ${JSON.stringify(result)} for absent key, expected null`,
      };
    }
    return null;
  }
}
