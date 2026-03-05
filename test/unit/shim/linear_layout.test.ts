/**
 * Tests for android.widget.LinearLayout shim.
 */

import { ShimRegistry } from '../../../src/interpreter/shim_registry';
import { Heap } from '../../../src/interpreter/heap';
import { Value, intValue, objectRef, NULL_VALUE } from '../../../src/core/types';
import { UIBridge } from '../../../src/bridge/ui_bridge';
import { StateManager } from '../../../src/bridge/state_manager';
import { createShimTestContext, ShimTestContext } from '../../helpers/shim_test_utils';

describe('android.widget.LinearLayout shim', () => {
  const LINEAR_LAYOUT = 'Landroid/widget/LinearLayout;';
  const ACTIVITY = 'Landroid/app/Activity;';
  let registry: ShimRegistry;
  let heap: Heap;
  let invokeShim: ShimTestContext['invokeShim'];

  beforeEach(() => {
    const ctx = createShimTestContext({ javaLang: true, android: true });
    registry = ctx.registry;
    heap = ctx.heap;
    invokeShim = ctx.invokeShim;
  });

  function createActivity(): number {
    const ref = heap.allocate(ACTIVITY);
    invokeShim(ACTIVITY, '<init>', '()V', [objectRef(ref)]);
    return ref;
  }

  function createLinearLayout(contextRef: number): number {
    const ref = heap.allocate(LINEAR_LAYOUT);
    invokeShim(LINEAR_LAYOUT, '<init>', '(Landroid/content/Context;)V', [
      objectRef(ref), objectRef(contextRef),
    ]);
    return ref;
  }

  it('constructor initializes View fields', () => {
    const actRef = createActivity();
    const llRef = createLinearLayout(actRef);
    expect(heap.getField(llRef, 'mContext')).toEqual(objectRef(actRef));
    expect(heap.getField(llRef, 'mId')).toEqual(intValue(-1));
    expect(heap.getField(llRef, 'mVisibility')).toEqual(intValue(0));
  });

  it('constructor defaults orientation to HORIZONTAL (0)', () => {
    const actRef = createActivity();
    const llRef = createLinearLayout(actRef);
    const orientation = invokeShim(LINEAR_LAYOUT, 'getOrientation', '()I', [objectRef(llRef)]);
    expect(orientation).toEqual(intValue(0));
  });

  it('setOrientation stores VERTICAL (1)', () => {
    const actRef = createActivity();
    const llRef = createLinearLayout(actRef);
    invokeShim(LINEAR_LAYOUT, 'setOrientation', '(I)V', [objectRef(llRef), intValue(1)]);
    const orientation = invokeShim(LINEAR_LAYOUT, 'getOrientation', '()I', [objectRef(llRef)]);
    expect(orientation).toEqual(intValue(1));
  });

  it('setOrientation stores HORIZONTAL (0)', () => {
    const actRef = createActivity();
    const llRef = createLinearLayout(actRef);
    invokeShim(LINEAR_LAYOUT, 'setOrientation', '(I)V', [objectRef(llRef), intValue(1)]);
    invokeShim(LINEAR_LAYOUT, 'setOrientation', '(I)V', [objectRef(llRef), intValue(0)]);
    const orientation = invokeShim(LINEAR_LAYOUT, 'getOrientation', '()I', [objectRef(llRef)]);
    expect(orientation).toEqual(intValue(0));
  });

  it('inherits addView from ViewGroup via registry', () => {
    const actRef = createActivity();
    const llRef = createLinearLayout(actRef);
    const tvRef = heap.allocate('Landroid/widget/TextView;');
    invokeShim('Landroid/widget/TextView;', '<init>', '(Landroid/content/Context;)V', [
      objectRef(tvRef), objectRef(actRef),
    ]);

    // addView is registered on ViewGroup, not LinearLayout
    // But we can invoke it directly on ViewGroup for the same ref
    invokeShim('Landroid/view/ViewGroup;', 'addView', '(Landroid/view/View;)V', [
      objectRef(llRef), objectRef(tvRef),
    ]);

    const childCount = invokeShim('Landroid/view/ViewGroup;', 'getChildCount', '()I', [objectRef(llRef)]);
    expect(childCount).toEqual(intValue(1));
  });

  describe('with UIBridge', () => {
    let uiBridge: UIBridge;
    let stateManager: StateManager;

    beforeEach(() => {
      const bridgeHeap = new Heap();
      stateManager = new StateManager();
      uiBridge = new UIBridge(bridgeHeap, stateManager);

      const bridgeRegistry = new ShimRegistry();
      const { registerJavaLangShims } = require('../../../src/shim/java/lang/index');
      const { registerAndroidShims } = require('../../../src/shim/android/index');
      registerJavaLangShims(bridgeRegistry);
      registerAndroidShims(bridgeRegistry, uiBridge);

      heap = bridgeHeap;
      registry = bridgeRegistry;

      const mockInterp = {
        invoke: (className: string, methodName: string, descriptor: string, args: Value[]) => {
          const method = { classDescriptor: className, name: methodName, descriptor, accessFlags: 0, code: null, isShim: true };
          return bridgeRegistry.invoke(method as any, mockInterp as any, heap, args);
        },
        getClassLoader: () => ({
          getClassObject: (desc: string) => heap.allocate('Ljava/lang/Class;'),
        }),
      };

      invokeShim = (classDesc: string, name: string, desc: string, args: Value[], isStatic = false) => {
        const method = { classDescriptor: classDesc, name, descriptor: desc, accessFlags: isStatic ? 0x0008 : 0, code: null, isShim: true };
        return bridgeRegistry.invoke(method as any, mockInterp as any, heap, args);
      };
    });

    it('constructor registers view with UIBridge', () => {
      const actRef = heap.allocate('Landroid/app/Activity;');
      invokeShim('Landroid/app/Activity;', '<init>', '()V', [objectRef(actRef)]);

      const llRef = heap.allocate(LINEAR_LAYOUT);
      invokeShim(LINEAR_LAYOUT, '<init>', '(Landroid/content/Context;)V', [
        objectRef(llRef), objectRef(actRef),
      ]);

      const node = uiBridge.getViewNode(llRef);
      expect(node).not.toBeNull();
      expect(node!.viewType).toBe('LinearLayout');
    });

    it('setOrientation updates UIBridge property', () => {
      const actRef = heap.allocate('Landroid/app/Activity;');
      invokeShim('Landroid/app/Activity;', '<init>', '()V', [objectRef(actRef)]);

      const llRef = heap.allocate(LINEAR_LAYOUT);
      invokeShim(LINEAR_LAYOUT, '<init>', '(Landroid/content/Context;)V', [
        objectRef(llRef), objectRef(actRef),
      ]);

      invokeShim(LINEAR_LAYOUT, 'setOrientation', '(I)V', [objectRef(llRef), intValue(1)]);

      const node = uiBridge.getViewNode(llRef);
      expect(node!.properties.get('orientation')).toBe(1);
    });

    it('ViewGroup.addView wires children in UIBridge', () => {
      const actRef = heap.allocate('Landroid/app/Activity;');
      invokeShim('Landroid/app/Activity;', '<init>', '()V', [objectRef(actRef)]);

      const llRef = heap.allocate(LINEAR_LAYOUT);
      invokeShim(LINEAR_LAYOUT, '<init>', '(Landroid/content/Context;)V', [
        objectRef(llRef), objectRef(actRef),
      ]);

      const tvRef = heap.allocate('Landroid/widget/TextView;');
      invokeShim('Landroid/widget/TextView;', '<init>', '(Landroid/content/Context;)V', [
        objectRef(tvRef), objectRef(actRef),
      ]);

      invokeShim('Landroid/view/ViewGroup;', 'addView', '(Landroid/view/View;)V', [
        objectRef(llRef), objectRef(tvRef),
      ]);

      const parentNode = uiBridge.getViewNode(llRef);
      expect(parentNode!.children.length).toBe(1);
      expect(parentNode!.children[0].viewRef).toBe(tvRef);
    });
  });
});
