/**
 * Integration tests for multi-view layout with arithmetic.
 * Simulates the new MainActivity: LinearLayout with 4 TextViews,
 * StringBuilder chaining, arithmetic, and conditional branching.
 */

import { ShimRegistry } from '../../../src/interpreter/shim_registry';
import { Heap } from '../../../src/interpreter/heap';
import { Value, intValue, floatValue, objectRef, NULL_VALUE } from '../../../src/core/types';
import { UIBridge, ViewNode } from '../../../src/bridge/ui_bridge';
import { StateManager } from '../../../src/bridge/state_manager';
import { registerJavaLangShims } from '../../../src/shim/java/lang/index';
import { registerAndroidShims } from '../../../src/shim/android/index';
import { InterpreterRef } from '../../../src/interpreter/shim_registry';

describe('Multi-view layout integration', () => {
  let registry: ShimRegistry;
  let heap: Heap;
  let uiBridge: UIBridge;
  let stateManager: StateManager;
  let mockInterp: InterpreterRef;
  let invokeShim: (classDesc: string, name: string, desc: string, args: Value[]) => Value;

  const ACTIVITY = 'Landroid/app/Activity;';
  const LINEAR_LAYOUT = 'Landroid/widget/LinearLayout;';
  const VIEW_GROUP = 'Landroid/view/ViewGroup;';
  const TEXTVIEW = 'Landroid/widget/TextView;';
  const STRING_BUILDER = 'Ljava/lang/StringBuilder;';

  beforeEach(() => {
    heap = new Heap();
    stateManager = new StateManager();
    uiBridge = new UIBridge(heap, stateManager);
    registry = new ShimRegistry();

    mockInterp = {
      invoke: (className: string, methodName: string, descriptor: string, args: Value[]) => {
        const method = {
          classDescriptor: className,
          name: methodName,
          descriptor,
          accessFlags: 0,
          code: null,
          isShim: true,
        };
        return registry.invoke(method as any, mockInterp, heap, args);
      },
      getClassLoader: () => ({
        getClassObject: (desc: string) => {
          const ref = heap.allocate('Ljava/lang/Class;');
          heap.setField(ref, '__classDescriptor', {
            type: 'object',
            ref: heap.internString(desc),
          });
          return ref;
        },
      }),
    };

    registerJavaLangShims(registry);
    registerAndroidShims(registry, uiBridge);

    invokeShim = (classDesc, name, desc, args) => {
      const method = {
        classDescriptor: classDesc,
        name,
        descriptor: desc,
        accessFlags: 0,
        code: null,
        isShim: true,
      };
      return registry.invoke(method as any, mockInterp, heap, args);
    };
  });

  function simulateOnCreate(): { activityRef: number; layoutRef: number } {
    // Create Activity
    const activityRef = heap.allocate(ACTIVITY);
    invokeShim(ACTIVITY, '<init>', '()V', [objectRef(activityRef)]);
    invokeShim(ACTIVITY, 'onCreate', '(Landroid/os/Bundle;)V', [objectRef(activityRef), NULL_VALUE]);

    // Create LinearLayout
    const layoutRef = heap.allocate(LINEAR_LAYOUT);
    invokeShim(LINEAR_LAYOUT, '<init>', '(Landroid/content/Context;)V', [
      objectRef(layoutRef), objectRef(activityRef),
    ]);
    invokeShim(LINEAR_LAYOUT, 'setOrientation', '(I)V', [objectRef(layoutRef), intValue(1)]);

    // 1. Title TextView
    const titleRef = heap.allocate(TEXTVIEW);
    invokeShim(TEXTVIEW, '<init>', '(Landroid/content/Context;)V', [
      objectRef(titleRef), objectRef(activityRef),
    ]);
    const titleStr = heap.internString('CRAFT Demo');
    invokeShim(TEXTVIEW, 'setText', '(Ljava/lang/CharSequence;)V', [
      objectRef(titleRef), objectRef(titleStr),
    ]);
    invokeShim(TEXTVIEW, 'setTextSize', '(F)V', [objectRef(titleRef), floatValue(28.0)]);
    invokeShim(TEXTVIEW, 'setTextColor', '(I)V', [objectRef(titleRef), intValue(0xFF1A237E | 0)]);
    invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
      objectRef(layoutRef), objectRef(titleRef),
    ]);

    // 2. Version via StringBuilder
    const sbRef = heap.allocate(STRING_BUILDER);
    invokeShim(STRING_BUILDER, '<init>', '()V', [objectRef(sbRef)]);
    const versionPrefix = heap.internString('Version ');
    invokeShim(STRING_BUILDER, 'append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;', [
      objectRef(sbRef), objectRef(versionPrefix),
    ]);
    invokeShim(STRING_BUILDER, 'append', '(I)Ljava/lang/StringBuilder;', [
      objectRef(sbRef), intValue(1),
    ]);
    const dot = heap.internString('.');
    invokeShim(STRING_BUILDER, 'append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;', [
      objectRef(sbRef), objectRef(dot),
    ]);
    invokeShim(STRING_BUILDER, 'append', '(I)Ljava/lang/StringBuilder;', [
      objectRef(sbRef), intValue(0),
    ]);
    const versionResult = invokeShim(STRING_BUILDER, 'toString', '()Ljava/lang/String;', [objectRef(sbRef)]);

    const versionRef = heap.allocate(TEXTVIEW);
    invokeShim(TEXTVIEW, '<init>', '(Landroid/content/Context;)V', [
      objectRef(versionRef), objectRef(activityRef),
    ]);
    invokeShim(TEXTVIEW, 'setText', '(Ljava/lang/CharSequence;)V', [
      objectRef(versionRef), versionResult,
    ]);
    invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
      objectRef(layoutRef), objectRef(versionRef),
    ]);

    // 3. Arithmetic
    const a = 42;
    const b = 13;
    const sum = a + b;

    const calcSbRef = heap.allocate(STRING_BUILDER);
    invokeShim(STRING_BUILDER, '<init>', '()V', [objectRef(calcSbRef)]);
    invokeShim(STRING_BUILDER, 'append', '(I)Ljava/lang/StringBuilder;', [
      objectRef(calcSbRef), intValue(a),
    ]);
    const plusStr = heap.internString(' + ');
    invokeShim(STRING_BUILDER, 'append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;', [
      objectRef(calcSbRef), objectRef(plusStr),
    ]);
    invokeShim(STRING_BUILDER, 'append', '(I)Ljava/lang/StringBuilder;', [
      objectRef(calcSbRef), intValue(b),
    ]);
    const eqStr = heap.internString(' = ');
    invokeShim(STRING_BUILDER, 'append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;', [
      objectRef(calcSbRef), objectRef(eqStr),
    ]);
    invokeShim(STRING_BUILDER, 'append', '(I)Ljava/lang/StringBuilder;', [
      objectRef(calcSbRef), intValue(sum),
    ]);
    const calcResult = invokeShim(STRING_BUILDER, 'toString', '()Ljava/lang/String;', [objectRef(calcSbRef)]);

    const calcRef = heap.allocate(TEXTVIEW);
    invokeShim(TEXTVIEW, '<init>', '(Landroid/content/Context;)V', [
      objectRef(calcRef), objectRef(activityRef),
    ]);
    invokeShim(TEXTVIEW, 'setText', '(Ljava/lang/CharSequence;)V', [
      objectRef(calcRef), calcResult,
    ]);
    invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
      objectRef(layoutRef), objectRef(calcRef),
    ]);

    // 4. Conditional
    const statusRef = heap.allocate(TEXTVIEW);
    invokeShim(TEXTVIEW, '<init>', '(Landroid/content/Context;)V', [
      objectRef(statusRef), objectRef(activityRef),
    ]);
    const statusText = sum > 50 ? 'Sum > 50: true' : 'Sum > 50: false';
    const statusStr = heap.internString(statusText);
    invokeShim(TEXTVIEW, 'setText', '(Ljava/lang/CharSequence;)V', [
      objectRef(statusRef), objectRef(statusStr),
    ]);
    invokeShim(TEXTVIEW, 'setTextColor', '(I)V', [objectRef(statusRef), intValue(0xFF388E3C | 0)]);
    invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
      objectRef(layoutRef), objectRef(statusRef),
    ]);

    // setContentView
    invokeShim(ACTIVITY, 'setContentView', '(Landroid/view/View;)V', [
      objectRef(activityRef), objectRef(layoutRef),
    ]);

    return { activityRef, layoutRef };
  }

  it('creates a LinearLayout with 4 child TextViews', () => {
    simulateOnCreate();
    const rootNode = uiBridge.getRootView();
    expect(rootNode).not.toBeNull();
    expect(rootNode!.viewType).toBe('LinearLayout');
    expect(rootNode!.children.length).toBe(4);
  });

  it('all children are TextViews', () => {
    simulateOnCreate();
    const rootNode = uiBridge.getRootView()!;
    for (const child of rootNode.children) {
      expect(child.viewType).toBe('TextView');
    }
  });

  it('title TextView shows "CRAFT Demo" with correct styling', () => {
    simulateOnCreate();
    const titleNode = uiBridge.getRootView()!.children[0];
    expect(titleNode.properties.get('text')).toBe('CRAFT Demo');
    expect(titleNode.properties.get('textSize')).toBe(28.0);
    expect(titleNode.properties.get('textColor')).toBe(0xFF1A237E | 0);
  });

  it('version TextView shows "Version 1.0"', () => {
    simulateOnCreate();
    const versionNode = uiBridge.getRootView()!.children[1];
    expect(versionNode.properties.get('text')).toBe('Version 1.0');
  });

  it('arithmetic TextView shows "42 + 13 = 55"', () => {
    simulateOnCreate();
    const calcNode = uiBridge.getRootView()!.children[2];
    expect(calcNode.properties.get('text')).toBe('42 + 13 = 55');
  });

  it('conditional TextView shows "Sum > 50: true" (55 > 50)', () => {
    simulateOnCreate();
    const statusNode = uiBridge.getRootView()!.children[3];
    expect(statusNode.properties.get('text')).toBe('Sum > 50: true');
    expect(statusNode.properties.get('textColor')).toBe(0xFF388E3C | 0);
  });

  it('LinearLayout orientation is VERTICAL', () => {
    simulateOnCreate();
    const rootNode = uiBridge.getRootView()!;
    expect(rootNode.properties.get('orientation')).toBe(1);
  });

  it('all children have correct parent reference', () => {
    simulateOnCreate();
    const rootNode = uiBridge.getRootView()!;
    for (const child of rootNode.children) {
      expect(child.parent).toBe(rootNode);
    }
  });
});
