/**
 * CRAFT Runtime Contracts — android.content.Context (A-2)
 *                           android.content.ContextWrapper (A-3)
 *
 * TypeScript encoding of docs/specs/formal/android_content_context.jml.
 *
 * Clause index:
 *   A-2 I-C2   — getApplicationContext() returns non-null
 *   A-3 post:constructor(Context) — mBase == context
 *   A-3 post:getBaseContext        — returns mBase
 *   A-3 I-CW1  — getApplicationContext() returns non-null (returns this)
 */

import { Heap }      from '../interpreter/heap';
import { ContractViolation } from './contract_types';

export class ContextContracts {

  // ─── A-2 I-C2 ────────────────────────────────────────────────────────────

  /**
   * A-2 I-C2: getApplicationContext() must return a non-null ref.
   * Pass the raw Value returned by the shim.
   */
  static postGetApplicationContext(
    result: { type: string; ref?: number }
  ): ContractViolation | null {
    const isNull = result.type === 'null' || (result.type === 'object' && result.ref === 0);
    if (isNull) {
      return {
        clause: 'A-2 I-C2',
        kind:   'postcondition',
        detail: `getApplicationContext() returned null, must be non-null`,
      };
    }
    return null;
  }
}

export class ContextWrapperContracts {

  // ─── A-3 post:constructor(Context) ───────────────────────────────────────

  /**
   * A-3 post:ContextWrapper(Context) — mBase equals the passed context ref.
   * @param contextRef the object ref passed as the constructor argument
   */
  static postConstructorBase(
    heap: Heap, thisRef: number, contextRef: number
  ): ContractViolation | null {
    const v = heap.getField(thisRef, 'mBase');
    const stored = v.type === 'object' ? v.ref : null;
    if (stored !== contextRef) {
      return {
        clause: 'A-3 post:constructor (mBase)',
        kind:   'postcondition',
        detail: `mBase ref=${stored}, expected ${contextRef}`,
      };
    }
    return null;
  }

  // ─── A-3 post:getBaseContext ──────────────────────────────────────────────

  /**
   * A-3 post:getBaseContext — result equals heap mBase.
   */
  static postGetBaseContext(
    heap: Heap, thisRef: number, result: { type: string; ref?: number }
  ): ContractViolation | null {
    const v = heap.getField(thisRef, 'mBase');
    const expected = v.type === 'object' ? v.ref : null;
    const actual   = result.type === 'object' ? result.ref : null;
    if (actual !== expected) {
      return {
        clause: 'A-3 post:getBaseContext',
        kind:   'postcondition',
        detail: `returned ref=${actual}, expected mBase ref=${expected}`,
      };
    }
    return null;
  }

  // ─── A-3 I-CW1 ───────────────────────────────────────────────────────────

  /**
   * A-3 I-CW1: getApplicationContext() returns non-null.
   */
  static postGetApplicationContext(
    result: { type: string; ref?: number }
  ): ContractViolation | null {
    const isNull = result.type === 'null' || (result.type === 'object' && result.ref === 0);
    if (isNull) {
      return {
        clause: 'A-3 I-CW1',
        kind:   'postcondition',
        detail: `ContextWrapper.getApplicationContext() returned null, must be non-null`,
      };
    }
    return null;
  }
}
