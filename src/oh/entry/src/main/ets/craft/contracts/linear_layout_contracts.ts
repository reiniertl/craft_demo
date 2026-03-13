/**
 * CRAFT Runtime Contracts — android.widget.LinearLayout (Spec V-4)
 *
 * TypeScript encoding of docs/specs/formal/android_widget_linear_layout.jml.
 *
 * Clause index:
 *   V-4 I-LL1   — _mOrientation in {0, 1}
 *   V-4 I-LL2   — UIBridge 'orientation' in sync with mOrientation
 *   V-4 post:constructor — mOrientation==0, node type 'LinearLayout', UIBridge synced
 *   V-4 pre:setOrientation  — orientation in {0, 1}
 *   V-4 post:setOrientation — heap and UIBridge updated
 *   V-4 post:getOrientation — returns mOrientation
 */

import { Heap }      from '../interpreter/heap';
import { UIBridge }  from '../bridge/ui_bridge';
import { ContractViolation } from './contract_types';

const HORIZONTAL = 0;
const VERTICAL   = 1;

export class LinearLayoutContracts {

  // ─── Helpers ──────────────────────────────────────────────────────────────

  static getMOrientation(heap: Heap, thisRef: number): number {
    const v = heap.getField(thisRef, 'mOrientation');
    return v.type === 'int' ? v.value : -1;
  }

  static getUIOrientation(uiBridge: UIBridge, thisRef: number): unknown {
    const node = uiBridge.getViewNode(thisRef);
    return node ? node.properties.get('orientation') : undefined;
  }

  // ─── Class invariants ─────────────────────────────────────────────────────

  /** V-4 I-LL1: mOrientation must be 0 (HORIZONTAL) or 1 (VERTICAL). */
  static invariantOrientationDomain(heap: Heap, thisRef: number): ContractViolation | null {
    const o = LinearLayoutContracts.getMOrientation(heap, thisRef);
    if (o !== HORIZONTAL && o !== VERTICAL) {
      return {
        clause: 'V-4 I-LL1',
        kind:   'invariant',
        detail: `mOrientation=${o}, must be 0 (HORIZONTAL) or 1 (VERTICAL)`,
      };
    }
    return null;
  }

  /** V-4 I-LL2: UIBridge 'orientation' in sync with heap mOrientation. */
  static invariantOrientationSync(
    heap: Heap, uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    const node = uiBridge.getViewNode(thisRef);
    if (!node) return null; // V-1 I1 covers the missing node case
    const uiOri   = LinearLayoutContracts.getUIOrientation(uiBridge, thisRef);
    const heapOri = LinearLayoutContracts.getMOrientation(heap, thisRef);
    if (uiOri !== heapOri) {
      return {
        clause: 'V-4 I-LL2',
        kind:   'invariant',
        detail: `UIBridge orientation=${uiOri} != heap mOrientation=${heapOri}`,
      };
    }
    return null;
  }

  // ─── Constructor postconditions ───────────────────────────────────────────

  /** V-4 post:constructor — mOrientation == HORIZONTAL (0). */
  static postConstructorOrientation(heap: Heap, thisRef: number): ContractViolation | null {
    const o = LinearLayoutContracts.getMOrientation(heap, thisRef);
    if (o !== HORIZONTAL) {
      return {
        clause: 'V-4 post:constructor (mOrientation)',
        kind:   'postcondition',
        detail: `mOrientation=${o}, expected 0 (HORIZONTAL)`,
      };
    }
    return null;
  }

  /** V-4 post:constructor — UIBridge node type is 'LinearLayout'. */
  static postConstructorNodeType(
    uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    const node = uiBridge.getViewNode(thisRef);
    if (!node || node.viewType !== 'LinearLayout') {
      return {
        clause: 'V-4 post:constructor (UIBridge type)',
        kind:   'postcondition',
        detail: `UIBridge viewType=${node?.viewType ?? 'missing'}, expected 'LinearLayout'`,
      };
    }
    return null;
  }

  /** V-4 post:constructor — UIBridge 'orientation' initialized to 0. */
  static postConstructorOrientationSync(
    heap: Heap, uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    return LinearLayoutContracts.invariantOrientationSync(heap, uiBridge, thisRef);
  }

  /** V-4 post:constructor — UIBridge 'visibility' initialized to 0 (I3b). */
  static postConstructorVisibilitySync(
    heap: Heap, uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    const node = uiBridge.getViewNode(thisRef);
    if (!node) return { clause: 'V-4 post:constructor (visibility)', kind: 'postcondition', detail: 'no UIBridge node' };
    const uiVis   = node.properties.get('visibility');
    const heapV   = heap.getField(thisRef, 'mVisibility');
    const heapVis = heapV.type === 'int' ? heapV.value : -1;
    if (uiVis !== heapVis) {
      return {
        clause: 'V-4 post:constructor (visibility sync)',
        kind:   'postcondition',
        detail: `UIBridge visibility=${uiVis}, heap mVisibility=${heapVis}`,
      };
    }
    return null;
  }

  // ─── setOrientation pre/postconditions ────────────────────────────────────

  /** V-4 pre:setOrientation — orientation must be 0 or 1. */
  static preSetOrientation(orientation: number): ContractViolation | null {
    if (orientation !== HORIZONTAL && orientation !== VERTICAL) {
      return {
        clause: 'V-4 pre:setOrientation',
        kind:   'precondition',
        detail: `orientation=${orientation}, must be 0 (HORIZONTAL) or 1 (VERTICAL)`,
      };
    }
    return null;
  }

  /** V-4 post:setOrientation — heap and UIBridge both updated to expected value. */
  static postSetOrientation(
    heap: Heap, uiBridge: UIBridge, thisRef: number, expected: number
  ): ContractViolation | null {
    const heapOri = LinearLayoutContracts.getMOrientation(heap, thisRef);
    if (heapOri !== expected) {
      return {
        clause: 'V-4 post:setOrientation (heap)',
        kind:   'postcondition',
        detail: `heap mOrientation=${heapOri}, expected ${expected}`,
      };
    }
    const uiOri = LinearLayoutContracts.getUIOrientation(uiBridge, thisRef);
    if (uiOri !== expected) {
      return {
        clause: 'V-4 post:setOrientation (UIBridge)',
        kind:   'postcondition',
        detail: `UIBridge orientation=${uiOri}, expected ${expected}`,
      };
    }
    return null;
  }

  // ─── getOrientation postcondition ─────────────────────────────────────────

  /** V-4 post:getOrientation — result equals heap mOrientation. */
  static postGetOrientation(
    heap: Heap, thisRef: number, result: unknown
  ): ContractViolation | null {
    const expected = LinearLayoutContracts.getMOrientation(heap, thisRef);
    if (result !== expected) {
      return {
        clause: 'V-4 post:getOrientation',
        kind:   'postcondition',
        detail: `returned ${result}, expected ${expected}`,
      };
    }
    return null;
  }
}
