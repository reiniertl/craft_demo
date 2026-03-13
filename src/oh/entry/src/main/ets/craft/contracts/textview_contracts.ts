/**
 * CRAFT Runtime Contracts — android.widget.TextView (Spec V-3)
 *
 * TypeScript encoding of docs/specs/formal/android_widget_text_view.jml.
 *
 * Clause index:
 *   V-3 I-TV1  — _mText != null
 *   V-3 I-TV2  — _mTextSize > 0
 *   V-3 I-TV3  — UIBridge 'text' in sync with mText
 *   V-3 I-TV4  — UIBridge 'textSize' in sync with mTextSize
 *   V-3 I-TV5  — UIBridge 'textColor' in sync with mTextColor
 *   V-3 post:constructor  — all fields and UIBridge initialised
 *   V-3 post:setText      — heap and UIBridge updated, mText != null
 *   V-3 pre:setTextSize   — size > 0
 *   V-3 post:setTextSize  — heap and UIBridge updated
 *   V-3 post:setTextColor — heap and UIBridge updated
 */

import { Heap }      from '../interpreter/heap';
import { UIBridge }  from '../bridge/ui_bridge';
import { ContractViolation } from './contract_types';

export class TextViewContracts {

  // ─── Helpers ──────────────────────────────────────────────────────────────

  static getMText(heap: Heap, thisRef: number): string | null {
    const v = heap.getField(thisRef, 'mText');
    if (v.type === 'object' && v.ref !== 0) {
      return heap.getStringValue(v.ref) ?? null;
    }
    return null; // null or 0-ref = violation of I-TV1
  }

  static getMTextSize(heap: Heap, thisRef: number): number {
    const v = heap.getField(thisRef, 'mTextSize');
    return v.type === 'float' ? v.value : -1;
  }

  static getMTextColor(heap: Heap, thisRef: number): number {
    const v = heap.getField(thisRef, 'mTextColor');
    return v.type === 'int' ? v.value : NaN;
  }

  static getUIProp(uiBridge: UIBridge, thisRef: number, key: string): unknown {
    const node = uiBridge.getViewNode(thisRef);
    if (!node) return undefined;
    return node.properties.get(key);
  }

  // ─── Class invariants ─────────────────────────────────────────────────────

  /** V-3 I-TV1: mText is never null. */
  static invariantTextNotNull(heap: Heap, thisRef: number): ContractViolation | null {
    const t = TextViewContracts.getMText(heap, thisRef);
    if (t === null) {
      return {
        clause: 'V-3 I-TV1',
        kind:   'invariant',
        detail: `mText is null (heap ref=${JSON.stringify(heap.getField(thisRef, 'mText'))})`,
      };
    }
    return null;
  }

  /** V-3 I-TV2: mTextSize > 0. */
  static invariantTextSizePositive(heap: Heap, thisRef: number): ContractViolation | null {
    const s = TextViewContracts.getMTextSize(heap, thisRef);
    if (s <= 0) {
      return {
        clause: 'V-3 I-TV2',
        kind:   'invariant',
        detail: `mTextSize=${s}, must be > 0`,
      };
    }
    return null;
  }

  /** V-3 I-TV3: UIBridge 'text' in sync with heap mText. */
  static invariantTextSync(
    heap: Heap, uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    const node = uiBridge.getViewNode(thisRef);
    if (!node) return null; // V-1 I1 covers the missing node case
    const uiText  = TextViewContracts.getUIProp(uiBridge, thisRef, 'text');
    const heapText = TextViewContracts.getMText(heap, thisRef);
    if (uiText !== heapText) {
      return {
        clause: 'V-3 I-TV3',
        kind:   'invariant',
        detail: `UIBridge text=${JSON.stringify(uiText)} != heap mText=${JSON.stringify(heapText)}`,
      };
    }
    return null;
  }

  /** V-3 I-TV4: UIBridge 'textSize' in sync with heap mTextSize. */
  static invariantTextSizeSync(
    heap: Heap, uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    const node = uiBridge.getViewNode(thisRef);
    if (!node) return null;
    const uiSize   = TextViewContracts.getUIProp(uiBridge, thisRef, 'textSize');
    const heapSize = TextViewContracts.getMTextSize(heap, thisRef);
    if (uiSize !== heapSize) {
      return {
        clause: 'V-3 I-TV4',
        kind:   'invariant',
        detail: `UIBridge textSize=${uiSize} != heap mTextSize=${heapSize}`,
      };
    }
    return null;
  }

  /** V-3 I-TV5: UIBridge 'textColor' in sync with heap mTextColor. */
  static invariantTextColorSync(
    heap: Heap, uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    const node = uiBridge.getViewNode(thisRef);
    if (!node) return null;
    const uiColor   = TextViewContracts.getUIProp(uiBridge, thisRef, 'textColor');
    const heapColor = TextViewContracts.getMTextColor(heap, thisRef);
    if (uiColor !== heapColor) {
      return {
        clause: 'V-3 I-TV5',
        kind:   'invariant',
        detail: `UIBridge textColor=${uiColor} != heap mTextColor=${heapColor}`,
      };
    }
    return null;
  }

  // ─── Constructor postconditions ──────────────────────────────────────────

  /** V-3 post:constructor — mText == "" */
  static postConstructorText(heap: Heap, thisRef: number): ContractViolation | null {
    const t = TextViewContracts.getMText(heap, thisRef);
    if (t !== '') {
      return {
        clause: 'V-3 post:constructor (mText)',
        kind:   'postcondition',
        detail: `mText=${JSON.stringify(t)}, expected ""`,
      };
    }
    return null;
  }

  /** V-3 post:constructor — mTextSize == 14.0 */
  static postConstructorTextSize(heap: Heap, thisRef: number): ContractViolation | null {
    const s = TextViewContracts.getMTextSize(heap, thisRef);
    if (s !== 14.0) {
      return {
        clause: 'V-3 post:constructor (mTextSize)',
        kind:   'postcondition',
        detail: `mTextSize=${s}, expected 14.0`,
      };
    }
    return null;
  }

  /** V-3 post:constructor — mTextColor == 0xFF000000 */
  static postConstructorTextColor(heap: Heap, thisRef: number): ContractViolation | null {
    const c = TextViewContracts.getMTextColor(heap, thisRef);
    const expected = 0xFF000000 | 0; // -16777216 as signed int
    if (c !== expected) {
      return {
        clause: 'V-3 post:constructor (mTextColor)',
        kind:   'postcondition',
        detail: `mTextColor=0x${(c >>> 0).toString(16)}, expected 0xFF000000`,
      };
    }
    return null;
  }

  /** V-3 post:constructor — UIBridge node type is 'TextView'. */
  static postConstructorNodeType(
    uiBridge: UIBridge, thisRef: number
  ): ContractViolation | null {
    const node = uiBridge.getViewNode(thisRef);
    if (!node || node.viewType !== 'TextView') {
      return {
        clause: 'V-3 post:constructor (UIBridge type)',
        kind:   'postcondition',
        detail: `UIBridge viewType=${node?.viewType ?? 'missing'}, expected 'TextView'`,
      };
    }
    return null;
  }

  // ─── setText postconditions ───────────────────────────────────────────────

  /** V-3 post:setText — mText is not null after the call. */
  static postSetTextNotNull(heap: Heap, thisRef: number): ContractViolation | null {
    return TextViewContracts.invariantTextNotNull(heap, thisRef);
  }

  /**
   * V-3 post:setText — mText and UIBridge 'text' equal the expected string.
   * @param expected The string value that was set (host-side string)
   */
  static postSetText(
    heap: Heap, uiBridge: UIBridge, thisRef: number, expected: string
  ): ContractViolation | null {
    const heapText = TextViewContracts.getMText(heap, thisRef);
    if (heapText !== expected) {
      return {
        clause: 'V-3 post:setText (heap)',
        kind:   'postcondition',
        detail: `heap mText=${JSON.stringify(heapText)}, expected ${JSON.stringify(expected)}`,
      };
    }
    const uiText = TextViewContracts.getUIProp(uiBridge, thisRef, 'text');
    if (uiText !== expected) {
      return {
        clause: 'V-3 post:setText (UIBridge)',
        kind:   'postcondition',
        detail: `UIBridge text=${JSON.stringify(uiText)}, expected ${JSON.stringify(expected)}`,
      };
    }
    return null;
  }

  // ─── setTextSize pre/post ─────────────────────────────────────────────────

  /** V-3 pre:setTextSize — size > 0. */
  static preSetTextSize(size: number): ContractViolation | null {
    if (size <= 0) {
      return {
        clause: 'V-3 pre:setTextSize',
        kind:   'precondition',
        detail: `size=${size}, must be > 0`,
      };
    }
    return null;
  }

  /** V-3 post:setTextSize — heap and UIBridge updated to new size. */
  static postSetTextSize(
    heap: Heap, uiBridge: UIBridge, thisRef: number, expected: number
  ): ContractViolation | null {
    const heapSize = TextViewContracts.getMTextSize(heap, thisRef);
    if (heapSize !== expected) {
      return {
        clause: 'V-3 post:setTextSize (heap)',
        kind:   'postcondition',
        detail: `heap mTextSize=${heapSize}, expected ${expected}`,
      };
    }
    const uiSize = TextViewContracts.getUIProp(uiBridge, thisRef, 'textSize');
    if (uiSize !== expected) {
      return {
        clause: 'V-3 post:setTextSize (UIBridge)',
        kind:   'postcondition',
        detail: `UIBridge textSize=${uiSize}, expected ${expected}`,
      };
    }
    return null;
  }

  // ─── setTextColor post ────────────────────────────────────────────────────

  /** V-3 post:setTextColor — heap and UIBridge updated to new color. */
  static postSetTextColor(
    heap: Heap, uiBridge: UIBridge, thisRef: number, expected: number
  ): ContractViolation | null {
    const heapColor = TextViewContracts.getMTextColor(heap, thisRef);
    if (heapColor !== expected) {
      return {
        clause: 'V-3 post:setTextColor (heap)',
        kind:   'postcondition',
        detail: `heap mTextColor=0x${(heapColor >>> 0).toString(16)}, expected 0x${(expected >>> 0).toString(16)}`,
      };
    }
    const uiColor = TextViewContracts.getUIProp(uiBridge, thisRef, 'textColor');
    if (uiColor !== expected) {
      return {
        clause: 'V-3 post:setTextColor (UIBridge)',
        kind:   'postcondition',
        detail: `UIBridge textColor=${uiColor}, expected ${expected}`,
      };
    }
    return null;
  }
}
