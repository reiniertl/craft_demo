/**
 * CRAFT Runtime Contracts — android.view.ViewGroup (Spec V-2)
 *
 * TypeScript encoding of docs/specs/formal/android_view_view_group.jml.
 *
 * Clause index:
 *   V-2 I-VG1  — _childCount >= 0
 *   V-2 I-VG2  — _childCount == children.length
 *   V-2 I-VG3  — no duplicate children
 *   V-2 post:constructor — _childCount == 0
 *   V-2 post:addView     — count increased by 1, child appended
 */

import { Heap }      from '../interpreter/heap';
import { UIBridge }  from '../bridge/ui_bridge';
import { ContractViolation } from './contract_types';

export class ViewGroupContracts {

  // ─── Class invariants ─────────────────────────────────────────────────────

  /** V-2 I-VG1: _childCount >= 0. */
  static invariantChildCountNonNegative(
    heap: Heap, uiBridge: UIBridge | undefined, thisRef: number
  ): ContractViolation | null {
    const count = ViewGroupContracts.getChildCount(heap, uiBridge, thisRef);
    if (count < 0) {
      return {
        clause: 'V-2 I-VG1',
        kind:   'invariant',
        detail: `_childCount=${count}, must be >= 0`,
      };
    }
    return null;
  }

  /**
   * V-2 I-VG2: __childCount (heap) must equal UIBridge children.length when
   * UIBridge is present. When absent, the heap counter is authoritative.
   */
  static invariantCountConsistency(
    heap: Heap, uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    const heapCount = ViewGroupContracts.getHeapChildCount(heap, thisRef);
    const node = uiBridge.getViewNode(thisRef);
    if (node) {
      const uiCount = node.children.length;
      if (heapCount !== uiCount) {
        return {
          clause: 'V-2 I-VG2',
          kind:   'invariant',
          detail: `heap __childCount=${heapCount} != UIBridge children.length=${uiCount}`,
        };
      }
    }
    return null;
  }

  // ─── Constructor postconditions ──────────────────────────────────────────

  /** V-2 post:constructor — _childCount == 0. */
  static postConstructorChildCount(
    heap: Heap, uiBridge: UIBridge | undefined, thisRef: number
  ): ContractViolation | null {
    const count = ViewGroupContracts.getChildCount(heap, uiBridge, thisRef);
    if (count !== 0) {
      return {
        clause: 'V-2 post:constructor',
        kind:   'postcondition',
        detail: `_childCount=${count} after construction, expected 0`,
      };
    }
    return null;
  }

  // ─── addView postconditions ──────────────────────────────────────────────

  /**
   * V-2 post:addView — child count increased by exactly 1.
   * @param countBefore getChildCount() recorded before the addView call
   */
  static postAddViewCount(
    heap: Heap, uiBridge: UIBridge | undefined,
    thisRef: number, countBefore: number
  ): ContractViolation | null {
    const countAfter = ViewGroupContracts.getChildCount(heap, uiBridge, thisRef);
    if (countAfter !== countBefore + 1) {
      return {
        clause: 'V-2 post:addView (count)',
        kind:   'postcondition',
        detail: `count went from ${countBefore} to ${countAfter}, expected ${countBefore + 1}`,
      };
    }
    return null;
  }

  /**
   * V-2 post:addView — child's ViewNode appears as last child in UIBridge.
   */
  static postAddViewUIBridge(
    uiBridge: UIBridge, parentRef: number, childRef: number
  ): ContractViolation | null {
    const node = uiBridge.getViewNode(parentRef);
    if (!node) {
      return {
        clause: 'V-2 post:addView (UIBridge)',
        kind:   'postcondition',
        detail: `No UIBridge node for parent ref ${parentRef}`,
      };
    }
    const last = node.children[node.children.length - 1];
    if (!last || last.viewRef !== childRef) {
      return {
        clause: 'V-2 post:addView (UIBridge)',
        kind:   'postcondition',
        detail: `Last UIBridge child ref=${last?.viewRef}, expected ${childRef}`,
      };
    }
    return null;
  }

  // ─── Per-instance isolation ──────────────────────────────────────────────

  /**
   * V-2 I-VG-ISOLATION: adding a child to one ViewGroup must NOT change the
   * child count of a different ViewGroup (detects singleton-store bug).
   * @param countBefore child count of secondRef recorded BEFORE addView on firstRef
   */
  static invariantAddViewDoesNotAffectOtherInstance(
    heap: Heap, uiBridge: UIBridge | undefined,
    otherRef: number, countBefore: number
  ): ContractViolation | null {
    const countAfter = ViewGroupContracts.getChildCount(heap, uiBridge, otherRef);
    if (countAfter !== countBefore) {
      return {
        clause: 'V-2 I-VG-ISOLATION',
        kind:   'invariant',
        detail: `addView on a different ViewGroup changed child count of ref=${otherRef} ` +
                `from ${countBefore} to ${countAfter} (singleton bug)`,
      };
    }
    return null;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  static getHeapChildCount(heap: Heap, thisRef: number): number {
    const v = heap.getField(thisRef, '__childCount');
    return v.type === 'int' ? v.value : 0;
  }

  static getChildCount(
    heap: Heap, uiBridge: UIBridge | undefined, thisRef: number
  ): number {
    if (uiBridge) {
      const node = uiBridge.getViewNode(thisRef);
      if (node) return node.children.length;
    }
    return ViewGroupContracts.getHeapChildCount(heap, thisRef);
  }
}
