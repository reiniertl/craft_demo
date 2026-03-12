/**
 * CRAFT Spec Compliance Test Suite
 *
 * Verifies that each shim implementation satisfies every JML contract clause
 * in docs/specs/formal/*.jml, via the TypeScript runtime enforcement layer
 * in src/contracts/.
 *
 * Each test corresponds to one JML clause (invariant, requires, or ensures).
 * A test failure means the shim VIOLATES its formal specification.
 *
 * Tests are grouped by spec ID. Within each group, tests are ordered:
 *   1. Constructor postconditions
 *   2. Method preconditions
 *   3. Method postconditions
 *   4. Class invariants (held after every operation)
 *   5. Cross-instance isolation invariants
 */

import { ShimRegistry }           from '../../../src/interpreter/shim_registry';
import { Heap }                   from '../../../src/interpreter/heap';
import { UIBridge }               from '../../../src/bridge/ui_bridge';
import { StateManager }           from '../../../src/bridge/state_manager';
import { registerAndroidShims }   from '../../../src/shim/android/index';
import { objectRef, intValue, floatValue, NULL_VALUE } from '../../../src/core/types';
import { makeMethod }             from '../../helpers/shim_test_utils';

import { ViewContracts }          from '../../../src/contracts/view_contracts';
import { ViewGroupContracts }     from '../../../src/contracts/view_group_contracts';
import { TextViewContracts }      from '../../../src/contracts/textview_contracts';
import { BundleContracts }        from '../../../src/contracts/bundle_contracts';
import { checkAll }               from '../../../src/contracts/contract_types';

// ─── Test harness ─────────────────────────────────────────────────────────────

function makeHarness() {
  const heap    = new Heap();
  const sm      = new StateManager();
  const bridge  = new UIBridge(heap, sm);
  const reg     = new ShimRegistry();
  registerAndroidShims(reg, bridge);

  const mockInterp = {
    invoke: (cls: string, name: string, desc: string, args: ReturnType<typeof objectRef>[]) => {
      const m = makeMethod(cls, name, desc);
      return reg.invoke(m, mockInterp, heap, args);
    },
    getClassLoader: () => ({
      getClassObject: (desc: string) => {
        const r = heap.allocate('Ljava/lang/Class;');
        heap.setField(r, '__classDescriptor', objectRef(heap.internString(desc)));
        return r;
      },
    }),
  };

  function invoke(cls: string, name: string, desc: string, args: ReturnType<typeof objectRef>[]) {
    return reg.invoke(makeMethod(cls, name, desc), mockInterp, heap, args);
  }

  function makeContext(): number {
    const r = heap.allocate('Landroid/content/Context;');
    invoke('Landroid/content/Context;', '<init>', '()V', [objectRef(r)]);
    return r;
  }

  return { heap, bridge, invoke, makeContext };
}

// ─── Spec V-1: android.view.View ─────────────────────────────────────────────

describe('Spec V-1 — android.view.View', () => {
  const VIEW = 'Landroid/view/View;';

  function makeView() {
    const h = makeHarness();
    const ctx = h.makeContext();
    const ref = h.heap.allocate(VIEW);
    h.invoke(VIEW, '<init>', '(Landroid/content/Context;)V', [objectRef(ref), objectRef(ctx)]);
    return { ...h, ref };
  }

  // --- Constructor postconditions ---

  test('V-1 post:constructor — mId defaults to -1', () => {
    const { heap, ref } = makeView();
    const v = ViewContracts.postConstructorId(heap, ref);
    expect(v).toBeNull();
  });

  test('V-1 post:constructor — mVisibility defaults to 0 (VISIBLE)', () => {
    const { heap, ref } = makeView();
    const v = ViewContracts.postConstructorVisibility(heap, ref);
    expect(v).toBeNull();
  });

  test('V-1 post:constructor — UIBridge node registered', () => {
    const { bridge, ref } = makeView();
    const v = ViewContracts.postConstructorRegistered(bridge, ref);
    expect(v).toBeNull();
  });

  // --- I1: UIBridge registration invariant ---

  test('V-1 I1 — registration invariant holds after construction', () => {
    const { bridge, ref } = makeView();
    expect(ViewContracts.invariantRegistered(bridge, ref)).toBeNull();
  });

  // --- I3: visibility domain invariant ---

  test('V-1 I3 — visibility domain invariant holds initially', () => {
    const { heap, ref } = makeView();
    expect(ViewContracts.invariantVisibilityDomain(heap, ref)).toBeNull();
  });

  // --- I3b: visibility sync invariant ---

  test('V-1 I3b — visibility sync invariant holds after construction', () => {
    const { heap, bridge, ref } = makeView();
    expect(ViewContracts.invariantVisibilitySync(heap, bridge, ref)).toBeNull();
  });

  // --- setVisibility precondition ---

  test('V-1 pre:setVisibility — accepts 0 (VISIBLE)', () => {
    expect(ViewContracts.preSetVisibility(0)).toBeNull();
  });

  test('V-1 pre:setVisibility — accepts 4 (INVISIBLE)', () => {
    expect(ViewContracts.preSetVisibility(4)).toBeNull();
  });

  test('V-1 pre:setVisibility — accepts 8 (GONE)', () => {
    expect(ViewContracts.preSetVisibility(8)).toBeNull();
  });

  test('V-1 pre:setVisibility — rejects 1 (invalid)', () => {
    expect(ViewContracts.preSetVisibility(1)).not.toBeNull();
  });

  // --- setVisibility postconditions ---

  test('V-1 post:setVisibility — heap mVisibility updated', () => {
    const { heap, ref, invoke } = makeView();
    invoke(VIEW, 'setVisibility', '(I)V', [objectRef(ref), intValue(4)]);
    expect(ViewContracts.postSetVisibilityHeap(heap, ref, 4)).toBeNull();
  });

  test('V-1 post:setVisibility — UIBridge visibility updated', () => {
    const { bridge, ref, invoke } = makeView();
    invoke(VIEW, 'setVisibility', '(I)V', [objectRef(ref), intValue(8)]);
    expect(ViewContracts.postSetVisibilityUI(bridge, ref, 8)).toBeNull();
  });

  test('V-1 I3b — sync invariant holds after setVisibility', () => {
    const { heap, bridge, ref, invoke } = makeView();
    invoke(VIEW, 'setVisibility', '(I)V', [objectRef(ref), intValue(4)]);
    expect(ViewContracts.invariantVisibilitySync(heap, bridge, ref)).toBeNull();
  });

  // --- setOnClickListener postconditions ---

  test('V-1 post:setOnClickListener(null) — no stale callback', () => {
    const { bridge, heap, ref, invoke } = makeView();
    // First install a listener, then remove it
    const listenerRef = heap.allocate('Landroid/view/View$OnClickListener;');
    invoke(VIEW, 'setOnClickListener',
      '(Landroid/view/View$OnClickListener;)V',
      [objectRef(ref), objectRef(listenerRef)]);
    // Now remove with null
    invoke(VIEW, 'setOnClickListener',
      '(Landroid/view/View$OnClickListener;)V',
      [objectRef(ref), NULL_VALUE]);
    expect(ViewContracts.postRemoveClickListener(bridge, ref)).toBeNull();
  });

  test('V-1 post:setOnClickListener(non-null) — callback present', () => {
    const { bridge, heap, ref, invoke } = makeView();
    const listenerRef = heap.allocate('Landroid/view/View$OnClickListener;');
    invoke(VIEW, 'setOnClickListener',
      '(Landroid/view/View$OnClickListener;)V',
      [objectRef(ref), objectRef(listenerRef)]);
    expect(ViewContracts.postInstallClickListener(bridge, ref)).toBeNull();
  });
});

// ─── Spec V-2: android.view.ViewGroup ────────────────────────────────────────

describe('Spec V-2 — android.view.ViewGroup', () => {
  const VG   = 'Landroid/view/ViewGroup;';
  const VIEW = 'Landroid/view/View;';

  function makeViewGroup() {
    const h = makeHarness();
    const ctx = h.makeContext();
    const ref = h.heap.allocate(VG);
    h.invoke(VG, '<init>', '(Landroid/content/Context;)V', [objectRef(ref), objectRef(ctx)]);
    return { ...h, ref, ctx };
  }

  // --- Constructor postconditions ---

  test('V-2 post:constructor — _childCount == 0', () => {
    const { heap, bridge, ref } = makeViewGroup();
    expect(ViewGroupContracts.postConstructorChildCount(heap, bridge, ref)).toBeNull();
  });

  // --- I-VG1: non-negative count ---

  test('V-2 I-VG1 — childCount non-negative after construction', () => {
    const { heap, bridge, ref } = makeViewGroup();
    expect(ViewGroupContracts.invariantChildCountNonNegative(heap, bridge, ref)).toBeNull();
  });

  // --- I-VG2: count consistency ---

  test('V-2 I-VG2 — count consistency after construction', () => {
    const { heap, bridge, ref } = makeViewGroup();
    expect(ViewGroupContracts.invariantCountConsistency(heap, bridge, ref)).toBeNull();
  });

  // --- addView postconditions ---

  test('V-2 post:addView — count increases by 1', () => {
    const { heap, bridge, ref, ctx, invoke } = makeViewGroup();
    const countBefore = ViewGroupContracts.getChildCount(heap, bridge, ref);
    const childRef = heap.allocate(VIEW);
    invoke(VIEW, '<init>', '(Landroid/content/Context;)V', [objectRef(childRef), objectRef(ctx)]);
    invoke(VG,   'addView', '(Landroid/view/View;)V', [objectRef(ref), objectRef(childRef)]);
    expect(ViewGroupContracts.postAddViewCount(heap, bridge, ref, countBefore)).toBeNull();
  });

  test('V-2 post:addView — child is last in UIBridge', () => {
    const { heap, bridge, ref, ctx, invoke } = makeViewGroup();
    const childRef = heap.allocate(VIEW);
    invoke(VIEW, '<init>', '(Landroid/content/Context;)V', [objectRef(childRef), objectRef(ctx)]);
    invoke(VG,   'addView', '(Landroid/view/View;)V', [objectRef(ref), objectRef(childRef)]);
    expect(ViewGroupContracts.postAddViewUIBridge(bridge, ref, childRef)).toBeNull();
  });

  test('V-2 I-VG2 — count consistency maintained after addView', () => {
    const { heap, bridge, ref, ctx, invoke } = makeViewGroup();
    const childRef = heap.allocate(VIEW);
    invoke(VIEW, '<init>', '(Landroid/content/Context;)V', [objectRef(childRef), objectRef(ctx)]);
    invoke(VG,   'addView', '(Landroid/view/View;)V', [objectRef(ref), objectRef(childRef)]);
    expect(ViewGroupContracts.invariantCountConsistency(heap, bridge, ref)).toBeNull();
  });

  // --- Cross-instance isolation (I-VG-ISOLATION) ---

  test('V-2 I-VG-ISOLATION — addView on vg1 does not affect vg2', () => {
    const { heap, bridge, ctx, invoke } = makeViewGroup();
    // Create two independent ViewGroup instances
    const vg1 = heap.allocate(VG);
    const vg2 = heap.allocate(VG);
    invoke(VG, '<init>', '(Landroid/content/Context;)V', [objectRef(vg1), objectRef(ctx)]);
    invoke(VG, '<init>', '(Landroid/content/Context;)V', [objectRef(vg2), objectRef(ctx)]);

    const countBefore = ViewGroupContracts.getChildCount(heap, bridge, vg2);

    // Add a child to vg1 only
    const childRef = heap.allocate(VIEW);
    invoke(VIEW, '<init>', '(Landroid/content/Context;)V', [objectRef(childRef), objectRef(ctx)]);
    invoke(VG, 'addView', '(Landroid/view/View;)V', [objectRef(vg1), objectRef(childRef)]);

    // vg2 must be unaffected
    expect(ViewGroupContracts.invariantAddViewDoesNotAffectOtherInstance(
      heap, bridge, vg2, countBefore
    )).toBeNull();
  });
});

// ─── Spec V-3: android.widget.TextView ───────────────────────────────────────

describe('Spec V-3 — android.widget.TextView', () => {
  const TV = 'Landroid/widget/TextView;';

  function makeTextView() {
    const h = makeHarness();
    const ctx = h.makeContext();
    const ref = h.heap.allocate(TV);
    h.invoke(TV, '<init>', '(Landroid/content/Context;)V', [objectRef(ref), objectRef(ctx)]);
    return { ...h, ref };
  }

  // --- Constructor postconditions ---

  test('V-3 post:constructor — mText == ""', () => {
    const { heap, ref } = makeTextView();
    expect(TextViewContracts.postConstructorText(heap, ref)).toBeNull();
  });

  test('V-3 post:constructor — mTextSize == 14.0', () => {
    const { heap, ref } = makeTextView();
    expect(TextViewContracts.postConstructorTextSize(heap, ref)).toBeNull();
  });

  test('V-3 post:constructor — mTextColor == 0xFF000000', () => {
    const { heap, ref } = makeTextView();
    expect(TextViewContracts.postConstructorTextColor(heap, ref)).toBeNull();
  });

  test('V-3 post:constructor — UIBridge node type is "TextView"', () => {
    const { bridge, ref } = makeTextView();
    expect(TextViewContracts.postConstructorNodeType(bridge, ref)).toBeNull();
  });

  // --- Inherited V-2 invariant: __childCount initialized ---

  test('V-3 (inherits V-2) — __childCount == 0 after construction', () => {
    const { heap, bridge, ref } = makeTextView();
    expect(ViewGroupContracts.postConstructorChildCount(heap, bridge, ref)).toBeNull();
  });

  // --- Class invariants after construction ---

  test('V-3 I-TV1 — mText not null after construction', () => {
    const { heap, ref } = makeTextView();
    expect(TextViewContracts.invariantTextNotNull(heap, ref)).toBeNull();
  });

  test('V-3 I-TV2 — mTextSize > 0 after construction', () => {
    const { heap, ref } = makeTextView();
    expect(TextViewContracts.invariantTextSizePositive(heap, ref)).toBeNull();
  });

  test('V-3 I-TV3 — UIBridge text in sync after construction', () => {
    const { heap, bridge, ref } = makeTextView();
    expect(TextViewContracts.invariantTextSync(heap, bridge, ref)).toBeNull();
  });

  test('V-3 I-TV4 — UIBridge textSize in sync after construction', () => {
    const { heap, bridge, ref } = makeTextView();
    expect(TextViewContracts.invariantTextSizeSync(heap, bridge, ref)).toBeNull();
  });

  test('V-3 I-TV5 — UIBridge textColor in sync after construction', () => {
    const { heap, bridge, ref } = makeTextView();
    expect(TextViewContracts.invariantTextColorSync(heap, bridge, ref)).toBeNull();
  });

  // --- setText postconditions ---

  test('V-3 post:setText — heap and UIBridge updated', () => {
    const { heap, bridge, ref, invoke } = makeTextView();
    const textRef = heap.internString('Hello World');
    invoke(TV, 'setText', '(Ljava/lang/CharSequence;)V', [objectRef(ref), objectRef(textRef)]);
    expect(TextViewContracts.postSetText(heap, bridge, ref, 'Hello World')).toBeNull();
  });

  test('V-3 I-TV1 — mText not null after setText', () => {
    const { heap, ref, invoke } = makeTextView();
    const textRef = heap.internString('test');
    invoke(TV, 'setText', '(Ljava/lang/CharSequence;)V', [objectRef(ref), objectRef(textRef)]);
    expect(TextViewContracts.invariantTextNotNull(heap, ref)).toBeNull();
  });

  test('V-3 I-TV3 — UIBridge text in sync after setText', () => {
    const { heap, bridge, ref, invoke } = makeTextView();
    const textRef = heap.internString('synced');
    invoke(TV, 'setText', '(Ljava/lang/CharSequence;)V', [objectRef(ref), objectRef(textRef)]);
    expect(TextViewContracts.invariantTextSync(heap, bridge, ref)).toBeNull();
  });

  // --- setTextSize pre/postconditions ---

  test('V-3 pre:setTextSize — accepts positive size', () => {
    expect(TextViewContracts.preSetTextSize(16.0)).toBeNull();
  });

  test('V-3 pre:setTextSize — rejects zero', () => {
    expect(TextViewContracts.preSetTextSize(0)).not.toBeNull();
  });

  test('V-3 pre:setTextSize — rejects negative', () => {
    expect(TextViewContracts.preSetTextSize(-1)).not.toBeNull();
  });

  test('V-3 post:setTextSize — heap and UIBridge updated', () => {
    const { heap, bridge, ref, invoke } = makeTextView();
    invoke(TV, 'setTextSize', '(F)V', [objectRef(ref), floatValue(18.0)]);
    expect(TextViewContracts.postSetTextSize(heap, bridge, ref, 18.0)).toBeNull();
  });

  test('V-3 I-TV4 — UIBridge textSize in sync after setTextSize', () => {
    const { heap, bridge, ref, invoke } = makeTextView();
    invoke(TV, 'setTextSize', '(F)V', [objectRef(ref), floatValue(20.0)]);
    expect(TextViewContracts.invariantTextSizeSync(heap, bridge, ref)).toBeNull();
  });

  // --- setTextColor postconditions ---

  test('V-3 post:setTextColor — heap and UIBridge updated', () => {
    const { heap, bridge, ref, invoke } = makeTextView();
    const color = 0xFF0000FF | 0; // blue, signed
    invoke(TV, 'setTextColor', '(I)V', [objectRef(ref), intValue(color)]);
    expect(TextViewContracts.postSetTextColor(heap, bridge, ref, color)).toBeNull();
  });

  test('V-3 I-TV5 — UIBridge textColor in sync after setTextColor', () => {
    const { heap, bridge, ref, invoke } = makeTextView();
    const color = 0xFFFF0000 | 0;
    invoke(TV, 'setTextColor', '(I)V', [objectRef(ref), intValue(color)]);
    expect(TextViewContracts.invariantTextColorSync(heap, bridge, ref)).toBeNull();
  });

  // --- All invariants held together (full invariant sweep) ---

  test('V-3 all invariants — pass comprehensive sweep after construction', () => {
    const { heap, bridge, ref } = makeTextView();
    const violations = checkAll([
      () => TextViewContracts.invariantTextNotNull(heap, ref),
      () => TextViewContracts.invariantTextSizePositive(heap, ref),
      () => TextViewContracts.invariantTextSync(heap, bridge, ref),
      () => TextViewContracts.invariantTextSizeSync(heap, bridge, ref),
      () => TextViewContracts.invariantTextColorSync(heap, bridge, ref),
      () => ViewGroupContracts.invariantChildCountNonNegative(heap, bridge, ref),
      () => ViewGroupContracts.invariantCountConsistency(heap, bridge, ref),
      () => ViewContracts.invariantRegistered(bridge, ref),
      () => ViewContracts.invariantVisibilityDomain(heap, ref),
      () => ViewContracts.invariantVisibilitySync(heap, bridge, ref),
    ]);
    expect(violations).toEqual([]);
  });
});

// ─── Spec A-1: android.os.Bundle ─────────────────────────────────────────────

describe('Spec A-1 — android.os.Bundle', () => {
  const BUNDLE = 'Landroid/os/Bundle;';

  function makeBundle() {
    const h = makeHarness();
    const ref = h.heap.allocate(BUNDLE);
    h.invoke(BUNDLE, '<init>', '()V', [objectRef(ref)]);
    return { ...h, ref };
  }

  const TEST_KEYS = ['foo', 'bar', 'baz'];

  // --- Constructor postconditions ---

  test('A-1 post:constructor — store is empty', () => {
    const { heap, ref } = makeBundle();
    expect(BundleContracts.postConstructorEmpty(heap, ref, TEST_KEYS)).toBeNull();
  });

  // --- putString postconditions ---

  test('A-1 post:putString — key appears in exists', () => {
    const { heap, ref, invoke } = makeBundle();
    const keyRef = heap.internString('name');
    const valRef = heap.internString('Alice');
    invoke(BUNDLE, 'putString',
      '(Ljava/lang/String;Ljava/lang/String;)V',
      [objectRef(ref), objectRef(keyRef), objectRef(valRef)]);
    expect(BundleContracts.postPutStringExists(heap, ref, 'name')).toBeNull();
  });

  test('A-1 post:putString frame — other keys unchanged', () => {
    const { heap, ref, invoke } = makeBundle();
    const key1 = heap.internString('k1');
    const key2 = heap.internString('k2');
    const val1 = heap.internString('v1');

    // k2 absent before
    const presentBefore = BundleContracts.isKeyPresent(heap, ref, 'k2');

    invoke(BUNDLE, 'putString',
      '(Ljava/lang/String;Ljava/lang/String;)V',
      [objectRef(ref), objectRef(key1), objectRef(val1)]);

    expect(BundleContracts.postPutStringFrame(heap, ref, 'k2', presentBefore)).toBeNull();
  });

  // --- containsKey postconditions ---

  test('A-1 post:containsKey — returns 0 for absent key', () => {
    const { heap, ref, invoke } = makeBundle();
    const keyRef = heap.internString('missing');
    const result = invoke(BUNDLE, 'containsKey',
      '(Ljava/lang/String;)Z',
      [objectRef(ref), objectRef(keyRef)]);
    expect(BundleContracts.postContainsKey(
      result as { type: string; value: unknown }, 'missing', false
    )).toBeNull();
  });

  test('A-1 post:containsKey — returns 1 after putString', () => {
    const { heap, ref, invoke } = makeBundle();
    const keyRef = heap.internString('present');
    const valRef = heap.internString('yes');
    invoke(BUNDLE, 'putString',
      '(Ljava/lang/String;Ljava/lang/String;)V',
      [objectRef(ref), objectRef(keyRef), objectRef(valRef)]);
    const result = invoke(BUNDLE, 'containsKey',
      '(Ljava/lang/String;)Z',
      [objectRef(ref), objectRef(keyRef)]);
    expect(BundleContracts.postContainsKey(
      result as { type: string; value: unknown }, 'present', true
    )).toBeNull();
  });

  // --- getString postconditions ---

  test('A-1 post:getString — returns null for absent key', () => {
    const { heap, ref, invoke } = makeBundle();
    const keyRef = heap.internString('ghost');
    const result = invoke(BUNDLE, 'getString',
      '(Ljava/lang/String;)Ljava/lang/String;',
      [objectRef(ref), objectRef(keyRef)]);
    expect(BundleContracts.postGetStringAbsent(result as { type: string }, 'ghost')).toBeNull();
  });

  // --- Cross-instance isolation (I-B4) ---

  test('A-1 I-B4 — putString on bundle1 does not affect bundle2', () => {
    const { heap, invoke } = makeBundle();

    const b1 = heap.allocate(BUNDLE);
    const b2 = heap.allocate(BUNDLE);
    invoke(BUNDLE, '<init>', '()V', [objectRef(b1)]);
    invoke(BUNDLE, '<init>', '()V', [objectRef(b2)]);

    const countBefore = TEST_KEYS.filter(
      k => BundleContracts.isKeyPresent(heap, b2, k)
    ).length;

    // Put into b1 only
    const keyRef = heap.internString('foo');
    const valRef = heap.internString('bar');
    invoke(BUNDLE, 'putString',
      '(Ljava/lang/String;Ljava/lang/String;)V',
      [objectRef(b1), objectRef(keyRef), objectRef(valRef)]);

    // b2 must be unaffected
    expect(BundleContracts.invariantIsolation(heap, b2, TEST_KEYS, countBefore)).toBeNull();
  });
});
