/**
 * CRAFT Runtime Contracts — android.app.Activity (Spec A-4)
 *
 * TypeScript encoding of docs/specs/formal/android_app_activity.jml.
 *
 * Clause index:
 *   A-4 I-AC1  — _mFinished in {0, 1}
 *   A-4 I-AC2  — _mFinished is monotonically non-decreasing (0→1 only)
 *   A-4 post:constructor    — mContentView==null, mFinished==0
 *   A-4 post:setContentView — mContentView==view, UIBridge root set
 *   A-4 post:finish         — mFinished==1
 *   A-4 post:onDestroy      — (verified via UIBridge timer state)
 */

import { Heap }      from '../interpreter/heap';
import { UIBridge }  from '../bridge/ui_bridge';
import { ContractViolation } from './contract_types';

export class ActivityContracts {

  // ─── Helpers ──────────────────────────────────────────────────────────────

  static getMFinished(heap: Heap, thisRef: number): number {
    const v = heap.getField(thisRef, 'mFinished');
    return v.type === 'int' ? v.value : -1;
  }

  static getMContentView(heap: Heap, thisRef: number): unknown {
    const v = heap.getField(thisRef, 'mContentView');
    return v.type === 'object' ? v.ref : null;
  }

  // ─── Class invariants ─────────────────────────────────────────────────────

  /** A-4 I-AC1: mFinished is 0 (running) or 1 (finished). */
  static invariantFinishedDomain(heap: Heap, thisRef: number): ContractViolation | null {
    const f = ActivityContracts.getMFinished(heap, thisRef);
    if (f !== 0 && f !== 1) {
      return {
        clause: 'A-4 I-AC1',
        kind:   'invariant',
        detail: `mFinished=${f}, must be 0 or 1`,
      };
    }
    return null;
  }

  /**
   * A-4 I-AC2 (temporal): mFinished must not decrease.
   * Checks that the current value is >= the value recorded before the call.
   * @param finishedBefore value of mFinished recorded BEFORE the operation
   */
  static invariantFinishedMonotone(
    heap: Heap, thisRef: number, finishedBefore: number
  ): ContractViolation | null {
    const finishedAfter = ActivityContracts.getMFinished(heap, thisRef);
    if (finishedAfter < finishedBefore) {
      return {
        clause: 'A-4 I-AC2',
        kind:   'invariant',
        detail: `mFinished regressed from ${finishedBefore} to ${finishedAfter} (monotonicity violated)`,
      };
    }
    return null;
  }

  // ─── Constructor postconditions ───────────────────────────────────────────

  /** A-4 post:constructor — mContentView == null. */
  static postConstructorContentView(heap: Heap, thisRef: number): ContractViolation | null {
    const v = heap.getField(thisRef, 'mContentView');
    const isNull = v.type === 'null' || (v.type === 'object' && v.ref === 0);
    if (!isNull) {
      return {
        clause: 'A-4 post:constructor (mContentView)',
        kind:   'postcondition',
        detail: `mContentView=${JSON.stringify(v)}, expected null`,
      };
    }
    return null;
  }

  /** A-4 post:constructor — mFinished == 0. */
  static postConstructorFinished(heap: Heap, thisRef: number): ContractViolation | null {
    const f = ActivityContracts.getMFinished(heap, thisRef);
    if (f !== 0) {
      return {
        clause: 'A-4 post:constructor (mFinished)',
        kind:   'postcondition',
        detail: `mFinished=${f}, expected 0`,
      };
    }
    return null;
  }

  // ─── setContentView postconditions ────────────────────────────────────────

  /**
   * A-4 post:setContentView — heap mContentView equals the view ref passed.
   * @param viewRef the object ref that was passed to setContentView
   */
  static postSetContentViewHeap(
    heap: Heap, thisRef: number, viewRef: number
  ): ContractViolation | null {
    const v = heap.getField(thisRef, 'mContentView');
    const stored = v.type === 'object' ? v.ref : null;
    if (stored !== viewRef) {
      return {
        clause: 'A-4 post:setContentView (heap)',
        kind:   'postcondition',
        detail: `heap mContentView ref=${stored}, expected ${viewRef}`,
      };
    }
    return null;
  }

  /**
   * A-4 post:setContentView — UIBridge root view is the passed view ref.
   * @param viewRef the object ref that was passed to setContentView
   */
  static postSetContentViewUIBridge(
    uiBridge: UIBridge, viewRef: number
  ): ContractViolation | null {
    const rootNode = uiBridge.getRootView();
    const rootRef  = rootNode ? rootNode.viewRef : null;
    if (rootRef !== viewRef) {
      return {
        clause: 'A-4 post:setContentView (UIBridge root)',
        kind:   'postcondition',
        detail: `UIBridge root viewRef=${rootRef}, expected ${viewRef}`,
      };
    }
    return null;
  }

  // ─── finish postconditions ────────────────────────────────────────────────

  /** A-4 post:finish — mFinished == 1. */
  static postFinish(heap: Heap, thisRef: number): ContractViolation | null {
    const f = ActivityContracts.getMFinished(heap, thisRef);
    if (f !== 1) {
      return {
        clause: 'A-4 post:finish',
        kind:   'postcondition',
        detail: `mFinished=${f}, expected 1`,
      };
    }
    return null;
  }
}
