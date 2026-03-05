/**
 * Tests for android.widget.Button shim and click handling.
 */

import { ShimRegistry } from '../../../src/interpreter/shim_registry';
import { Heap } from '../../../src/interpreter/heap';
import { Value, intValue, objectRef, NULL_VALUE } from '../../../src/core/types';
import { UIBridge } from '../../../src/bridge/ui_bridge';
import { StateManager } from '../../../src/bridge/state_manager';
import { createShimTestContext, ShimTestContext } from '../../helpers/shim_test_utils';

describe('android.widget.Button shim', () => {
  const BUTTON = 'Landroid/widget/Button;';
  const TEXTVIEW = 'Landroid/widget/TextView;';
  const VIEW = 'Landroid/view/View;';
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

  function createButton(contextRef: number): number {
    const ref = heap.allocate(BUTTON);
    invokeShim(BUTTON, '<init>', '(Landroid/content/Context;)V', [
      objectRef(ref), objectRef(contextRef),
    ]);
    return ref;
  }

  it('constructor initializes View fields', () => {
    const actRef = createActivity();
    const btnRef = createButton(actRef);
    expect(heap.getField(btnRef, 'mContext')).toEqual(objectRef(actRef));
    expect(heap.getField(btnRef, 'mId')).toEqual(intValue(-1));
    expect(heap.getField(btnRef, 'mVisibility')).toEqual(intValue(0));
  });

  it('constructor initializes TextView fields', () => {
    const actRef = createActivity();
    const btnRef = createButton(actRef);
    expect(heap.getField(btnRef, 'mText')).toEqual(NULL_VALUE);
    expect(heap.getField(btnRef, 'mTextSize')).toEqual({ type: 'float', value: 14.0 });
    expect(heap.getField(btnRef, 'mTextColor')).toEqual(intValue(0xFF000000 | 0));
  });

  it('inherits setText/getText from TextView via registry', () => {
    const actRef = createActivity();
    const btnRef = createButton(actRef);

    // Create a string to set as text
    const strRef = heap.internString('Click Me');
    invokeShim(TEXTVIEW, 'setText', '(Ljava/lang/CharSequence;)V', [
      objectRef(btnRef), objectRef(strRef),
    ]);

    const result = invokeShim(TEXTVIEW, 'getText', '()Ljava/lang/CharSequence;', [
      objectRef(btnRef),
    ]);
    expect(result).toEqual(objectRef(strRef));
  });

  it('inherits setId/getId from View via registry', () => {
    const actRef = createActivity();
    const btnRef = createButton(actRef);

    invokeShim(VIEW, 'setId', '(I)V', [objectRef(btnRef), intValue(42)]);
    const id = invokeShim(VIEW, 'getId', '()I', [objectRef(btnRef)]);
    expect(id).toEqual(intValue(42));
  });

  it('setOnClickListener stores listener ref', () => {
    const actRef = createActivity();
    const btnRef = createButton(actRef);

    // Create a mock listener object
    const listenerRef = heap.allocate('Landroid/view/View$OnClickListener;');

    invokeShim(VIEW, 'setOnClickListener',
      '(Landroid/view/View$OnClickListener;)V',
      [objectRef(btnRef), objectRef(listenerRef)]
    );

    expect(heap.getField(btnRef, 'mOnClickListener')).toEqual(objectRef(listenerRef));
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

    it('constructor registers view with UIBridge as Button type', () => {
      const actRef = heap.allocate(ACTIVITY);
      invokeShim(ACTIVITY, '<init>', '()V', [objectRef(actRef)]);

      const btnRef = heap.allocate(BUTTON);
      invokeShim(BUTTON, '<init>', '(Landroid/content/Context;)V', [
        objectRef(btnRef), objectRef(actRef),
      ]);

      const node = uiBridge.getViewNode(btnRef);
      expect(node).not.toBeNull();
      expect(node!.viewType).toBe('Button');
    });

    it('setOnClickListener stores onClick callback in UIBridge', () => {
      const actRef = heap.allocate(ACTIVITY);
      invokeShim(ACTIVITY, '<init>', '()V', [objectRef(actRef)]);

      const btnRef = heap.allocate(BUTTON);
      invokeShim(BUTTON, '<init>', '(Landroid/content/Context;)V', [
        objectRef(btnRef), objectRef(actRef),
      ]);

      const listenerRef = heap.allocate('Landroid/view/View$OnClickListener;');

      invokeShim(VIEW, 'setOnClickListener',
        '(Landroid/view/View$OnClickListener;)V',
        [objectRef(btnRef), objectRef(listenerRef)]
      );

      const node = uiBridge.getViewNode(btnRef);
      expect(node).not.toBeNull();
      expect(typeof node!.properties.get('onClick')).toBe('function');
    });

    it('dispatchClick invokes onClick callback', () => {
      const actRef = heap.allocate(ACTIVITY);
      invokeShim(ACTIVITY, '<init>', '()V', [objectRef(actRef)]);

      const btnRef = heap.allocate(BUTTON);
      invokeShim(BUTTON, '<init>', '(Landroid/content/Context;)V', [
        objectRef(btnRef), objectRef(actRef),
      ]);

      // Track whether callback was invoked
      let callbackInvoked = false;
      const node = uiBridge.getViewNode(btnRef);
      node!.properties.set('onClick', () => { callbackInvoked = true; });

      const result = uiBridge.dispatchClick(btnRef);
      expect(result).toBe(true);
      expect(callbackInvoked).toBe(true);
    });

    it('dispatchClick returns false when no listener', () => {
      const actRef = heap.allocate(ACTIVITY);
      invokeShim(ACTIVITY, '<init>', '()V', [objectRef(actRef)]);

      const btnRef = heap.allocate(BUTTON);
      invokeShim(BUTTON, '<init>', '(Landroid/content/Context;)V', [
        objectRef(btnRef), objectRef(actRef),
      ]);

      const result = uiBridge.dispatchClick(btnRef);
      expect(result).toBe(false);
    });

    it('dispatchClick returns false for unregistered view', () => {
      const result = uiBridge.dispatchClick(9999);
      expect(result).toBe(false);
    });

    it('setText updates UIBridge text property on Button', () => {
      const actRef = heap.allocate(ACTIVITY);
      invokeShim(ACTIVITY, '<init>', '()V', [objectRef(actRef)]);

      const btnRef = heap.allocate(BUTTON);
      invokeShim(BUTTON, '<init>', '(Landroid/content/Context;)V', [
        objectRef(btnRef), objectRef(actRef),
      ]);

      const strRef = heap.internString('OK');
      invokeShim(TEXTVIEW, 'setText', '(Ljava/lang/CharSequence;)V', [
        objectRef(btnRef), objectRef(strRef),
      ]);

      const node = uiBridge.getViewNode(btnRef);
      expect(node!.properties.get('text')).toBe('OK');
    });
  });
});
