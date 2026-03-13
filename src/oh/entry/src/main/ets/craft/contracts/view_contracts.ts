/**
 * CRAFT Runtime Contracts — android.view.View (Spec V-1)
 *
 * TypeScript encoding of docs/specs/formal/android_view_view.jml.
 * Each method corresponds to exactly one JML invariant, requires, or ensures clause.
 *
 * Clause index:
 *   V-1 I1  — _isRegistered
 *   V-1 I3  — _mVisibility ∈ {0, 4, 8}
 *   V-1 I3b — UIBridge visibility in sync with heap
 *   V-1 pre:setVisibility  — visibility ∈ {0, 4, 8}
 *   V-1 post:setVisibility — heap and UIBridge updated
 *   V-1 post:constructor   — mId=-1, mVisibility=0, registered
 *   V-1 post:setOnClickListener(null)    — callback removed from UIBridge
 *   V-1 post:setOnClickListener(non-null)— callback present in UIBridge
 */

import { Heap }      from '../interpreter/heap';
import { UIBridge }  from '../bridge/ui_bridge';
import { ContractViolation } from './contract_types';

export const VISIBILITY_VALUES = new Set([0, 4, 8]);

export class ViewContracts {

  // ─── Class invariants ─────────────────────────────────────────────────────

  /** V-1 I1: Every View must have a UIBridge node registered. */
  static invariantRegistered(
    uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    if (!uiBridge.getViewNode(thisRef)) {
      return {
        clause: 'V-1 I1',
        kind:   'invariant',
        detail: `No UIBridge node for ref ${thisRef}`,
      };
    }
    return null;
  }

  /** V-1 I3: mVisibility ∈ {0, 4, 8}. */
  static invariantVisibilityDomain(
    heap: Heap, thisRef: number
  ): ContractViolation | null {
    const v = heap.getField(thisRef, 'mVisibility');
    if (v.type !== 'int' || !VISIBILITY_VALUES.has(v.value)) {
      return {
        clause: 'V-1 I3',
        kind:   'invariant',
        detail: `mVisibility = ${JSON.stringify(v)}, expected one of {0, 4, 8}`,
      };
    }
    return null;
  }

  /** V-1 I3b: UIBridge visibility equals heap mVisibility. */
  static invariantVisibilitySync(
    heap: Heap, uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    const heapV = heap.getField(thisRef, 'mVisibility');
    const node  = uiBridge.getViewNode(thisRef);
    if (!node) return null; // I1 already covers this case
    const uiV = node.properties.get('visibility');
    const heapVal = heapV.type === 'int' ? heapV.value : -1;
    if (uiV !== heapVal) {
      return {
        clause: 'V-1 I3b',
        kind:   'invariant',
        detail: `UIBridge visibility=${uiV} != heap mVisibility=${heapVal}`,
      };
    }
    return null;
  }

  // ─── setVisibility precondition ──────────────────────────────────────────

  /** V-1 pre:setVisibility — visibility ∈ {0, 4, 8}. */
  static preSetVisibility(visibility: number): ContractViolation | null {
    if (!VISIBILITY_VALUES.has(visibility)) {
      return {
        clause: 'V-1 pre:setVisibility',
        kind:   'precondition',
        detail: `visibility=${visibility} not in {0, 4, 8}`,
      };
    }
    return null;
  }

  // ─── setVisibility postconditions ────────────────────────────────────────

  /** V-1 post:setVisibility — heap mVisibility == expected. */
  static postSetVisibilityHeap(
    heap: Heap, thisRef: number, expected: number
  ): ContractViolation | null {
    const v = heap.getField(thisRef, 'mVisibility');
    if (v.type !== 'int' || v.value !== expected) {
      return {
        clause: 'V-1 post:setVisibility (heap)',
        kind:   'postcondition',
        detail: `heap mVisibility=${JSON.stringify(v)}, expected ${expected}`,
      };
    }
    return null;
  }

  /** V-1 post:setVisibility — UIBridge visibility == expected. */
  static postSetVisibilityUI(
    uiBridge: UIBridge, thisRef: number, expected: number
  ): ContractViolation | null {
    const node = uiBridge.getViewNode(thisRef);
    if (!node) {
      return {
        clause: 'V-1 post:setVisibility (UIBridge)',
        kind:   'postcondition',
        detail: `No UIBridge node for ref ${thisRef}`,
      };
    }
    const uiV = node.properties.get('visibility');
    if (uiV !== expected) {
      return {
        clause: 'V-1 post:setVisibility (UIBridge)',
        kind:   'postcondition',
        detail: `UIBridge visibility=${uiV}, expected ${expected}`,
      };
    }
    return null;
  }

  // ─── Constructor postconditions ──────────────────────────────────────────

  /** V-1 post:constructor — mId defaults to -1. */
  static postConstructorId(heap: Heap, thisRef: number): ContractViolation | null {
    const v = heap.getField(thisRef, 'mId');
    if (v.type !== 'int' || v.value !== -1) {
      return {
        clause: 'V-1 post:constructor (mId)',
        kind:   'postcondition',
        detail: `mId=${JSON.stringify(v)}, expected -1`,
      };
    }
    return null;
  }

  /** V-1 post:constructor — mVisibility defaults to 0 (VISIBLE). */
  static postConstructorVisibility(heap: Heap, thisRef: number): ContractViolation | null {
    const v = heap.getField(thisRef, 'mVisibility');
    if (v.type !== 'int' || v.value !== 0) {
      return {
        clause: 'V-1 post:constructor (mVisibility)',
        kind:   'postcondition',
        detail: `mVisibility=${JSON.stringify(v)}, expected 0`,
      };
    }
    return null;
  }

  /** V-1 post:constructor — UIBridge node registered. */
  static postConstructorRegistered(
    uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    return ViewContracts.invariantRegistered(uiBridge, thisRef);
  }

  // ─── setOnClickListener postconditions ───────────────────────────────────

  /** V-1 post:setOnClickListener(null) — no stale callback in UIBridge. */
  static postRemoveClickListener(
    uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    // Access private clickCallbacks via cast — for test use only
    const bridge = uiBridge as unknown as { clickCallbacks: Map<number, unknown> };
    if (bridge.clickCallbacks && bridge.clickCallbacks.has(thisRef)) {
      return {
        clause: 'V-1 post:setOnClickListener(null)',
        kind:   'postcondition',
        detail: `Stale click callback still present in UIBridge for ref ${thisRef}`,
      };
    }
    return null;
  }

  /** V-1 post:setOnClickListener(non-null) — callback present in UIBridge. */
  static postInstallClickListener(
    uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    const bridge = uiBridge as unknown as { clickCallbacks: Map<number, unknown> };
    if (!bridge.clickCallbacks || !bridge.clickCallbacks.has(thisRef)) {
      return {
        clause: 'V-1 post:setOnClickListener(non-null)',
        kind:   'postcondition',
        detail: `Click callback NOT present in UIBridge for ref ${thisRef}`,
      };
    }
    return null;
  }
}
