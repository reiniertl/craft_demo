/**
 * CRAFT Runtime Contracts — android.widget.Button (Spec V-5)
 *
 * TypeScript encoding of docs/specs/formal/android_widget_button.jml.
 *
 * Button inherits all TextView (V-3), ViewGroup (V-2), and View (V-1) contracts.
 * This file adds only the Button-specific constraint:
 *
 * Clause index:
 *   V-5 I-BT1  — UIBridge node type is 'Button'
 *   V-5 post:constructor — all properties synced (node type, text, textSize, textColor, visibility)
 */

import { UIBridge }  from '../bridge/ui_bridge';
import { Heap }      from '../interpreter/heap';
import { ContractViolation } from './contract_types';

export class ButtonContracts {

  // ─── V-5 I-BT1: UIBridge node type must be 'Button' ─────────────────────

  /** V-5 I-BT1: UIBridge node type == 'Button'. */
  static invariantNodeType(uiBridge: UIBridge, thisRef: number): ContractViolation | null {
    const node = uiBridge.getViewNode(thisRef);
    if (!node || node.viewType !== 'Button') {
      return {
        clause: 'V-5 I-BT1',
        kind:   'invariant',
        detail: `UIBridge viewType=${node?.viewType ?? 'missing'}, expected 'Button'`,
      };
    }
    return null;
  }

  // ─── Constructor postconditions ───────────────────────────────────────────

  /** V-5 post:constructor — UIBridge node registered with type 'Button'. */
  static postConstructorNodeType(
    uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    return ButtonContracts.invariantNodeType(uiBridge, thisRef);
  }

  /**
   * V-5 post:constructor — UIBridge 'text' property initialized to "".
   * (UIBridge sync inherited from V-3 I-TV3, but the node type check differs.)
   */
  static postConstructorTextSync(
    heap: Heap, uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    const node = uiBridge.getViewNode(thisRef);
    if (!node) return { clause: 'V-5 post:constructor (text)', kind: 'postcondition', detail: 'no UIBridge node' };
    const uiText = node.properties.get('text');
    const heapField = heap.getField(thisRef, 'mText');
    const heapText = heapField.type === 'object' && heapField.ref !== 0
      ? (heap.getStringValue(heapField.ref) ?? null) : null;
    if (uiText !== heapText) {
      return {
        clause: 'V-5 post:constructor (text sync)',
        kind:   'postcondition',
        detail: `UIBridge text=${JSON.stringify(uiText)}, heap mText=${JSON.stringify(heapText)}`,
      };
    }
    return null;
  }

  /**
   * V-5 post:constructor — UIBridge 'textSize' initialized to 14.0.
   */
  static postConstructorTextSizeSync(
    heap: Heap, uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    const node = uiBridge.getViewNode(thisRef);
    if (!node) return { clause: 'V-5 post:constructor (textSize)', kind: 'postcondition', detail: 'no UIBridge node' };
    const uiSize = node.properties.get('textSize');
    const heapV  = heap.getField(thisRef, 'mTextSize');
    const heapSize = heapV.type === 'float' ? heapV.value : -1;
    if (uiSize !== heapSize) {
      return {
        clause: 'V-5 post:constructor (textSize sync)',
        kind:   'postcondition',
        detail: `UIBridge textSize=${uiSize}, heap mTextSize=${heapSize}`,
      };
    }
    return null;
  }

  /**
   * V-5 post:constructor — UIBridge 'textColor' initialized to 0xFF000000.
   */
  static postConstructorTextColorSync(
    heap: Heap, uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    const node = uiBridge.getViewNode(thisRef);
    if (!node) return { clause: 'V-5 post:constructor (textColor)', kind: 'postcondition', detail: 'no UIBridge node' };
    const uiColor  = node.properties.get('textColor');
    const heapV    = heap.getField(thisRef, 'mTextColor');
    const heapColor = heapV.type === 'int' ? heapV.value : NaN;
    if (uiColor !== heapColor) {
      return {
        clause: 'V-5 post:constructor (textColor sync)',
        kind:   'postcondition',
        detail: `UIBridge textColor=${uiColor}, heap mTextColor=${heapColor}`,
      };
    }
    return null;
  }

  /**
   * V-5 post:constructor — UIBridge 'visibility' initialized to 0.
   * (I3b sync for Button, analogous to V-1 I3b.)
   */
  static postConstructorVisibilitySync(
    heap: Heap, uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    const node = uiBridge.getViewNode(thisRef);
    if (!node) return { clause: 'V-5 post:constructor (visibility)', kind: 'postcondition', detail: 'no UIBridge node' };
    const uiVis  = node.properties.get('visibility');
    const heapV  = heap.getField(thisRef, 'mVisibility');
    const heapVis = heapV.type === 'int' ? heapV.value : -1;
    if (uiVis !== heapVis) {
      return {
        clause: 'V-5 post:constructor (visibility sync)',
        kind:   'postcondition',
        detail: `UIBridge visibility=${uiVis}, heap mVisibility=${heapVis}`,
      };
    }
    return null;
  }
}
