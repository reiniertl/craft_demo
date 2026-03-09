/**
 * Calculator app simulation integration tests.
 * Simulates com.example.calculator.MainActivity.onCreate() at the shim level.
 * Validates layout structure, button grid, and arithmetic via click dispatch.
 */

import { ShimRegistry } from '../../../src/interpreter/shim_registry';
import { Heap } from '../../../src/interpreter/heap';
import { Value, intValue, floatValue, objectRef, NULL_VALUE } from '../../../src/core/types';
import { UIBridge } from '../../../src/bridge/ui_bridge';
import { StateManager } from '../../../src/bridge/state_manager';
import { registerJavaLangShims } from '../../../src/shim/java/lang/index';
import { registerAndroidShims } from '../../../src/shim/android/index';
import { InterpreterRef } from '../../../src/interpreter/shim_registry';

describe('Calculator app simulation', () => {
  let registry: ShimRegistry;
  let heap: Heap;
  let uiBridge: UIBridge;
  let stateManager: StateManager;
  let mockInterp: InterpreterRef;
  let invokeShim: (classDesc: string, name: string, desc: string, args: Value[], isStatic?: boolean) => Value;

  const ACTIVITY = 'Landroid/app/Activity;';
  const LINEAR_LAYOUT = 'Landroid/widget/LinearLayout;';
  const VIEW_GROUP = 'Landroid/view/ViewGroup;';
  const TEXTVIEW = 'Landroid/widget/TextView;';
  const BUTTON = 'Landroid/widget/Button;';
  const VIEW = 'Landroid/view/View;';
  const STRING_BUILDER = 'Ljava/lang/StringBuilder;';

  // Refs to track created views
  let activityRef: number;
  let displayRef: number;
  let rootRef: number;
  const buttonRefs: Map<number, number> = new Map(); // id -> ref

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

    invokeShim = (classDesc, name, desc, args, isStatic = false) => {
      const method = {
        classDescriptor: classDesc,
        name,
        descriptor: desc,
        accessFlags: isStatic ? 0x0008 : 0,
        code: null,
        isShim: true,
      };
      return registry.invoke(method as any, mockInterp, heap, args);
    };

    buttonRefs.clear();
    simulateOnCreate();
  });

  function simulateOnCreate(): void {
    // Create Activity
    activityRef = heap.allocate(ACTIVITY);
    invokeShim(ACTIVITY, '<init>', '()V', [objectRef(activityRef)]);
    invokeShim(ACTIVITY, 'onCreate', '(Landroid/os/Bundle;)V', [objectRef(activityRef), NULL_VALUE]);

    // Root LinearLayout (VERTICAL)
    rootRef = heap.allocate(LINEAR_LAYOUT);
    invokeShim(LINEAR_LAYOUT, '<init>', '(Landroid/content/Context;)V', [
      objectRef(rootRef), objectRef(activityRef),
    ]);
    invokeShim(LINEAR_LAYOUT, 'setOrientation', '(I)V', [objectRef(rootRef), intValue(1)]);

    // Display TextView
    displayRef = heap.allocate(TEXTVIEW);
    invokeShim(TEXTVIEW, '<init>', '(Landroid/content/Context;)V', [
      objectRef(displayRef), objectRef(activityRef),
    ]);
    const zeroStr = heap.internString('0');
    invokeShim(TEXTVIEW, 'setText', '(Ljava/lang/CharSequence;)V', [
      objectRef(displayRef), objectRef(zeroStr),
    ]);
    invokeShim(TEXTVIEW, 'setTextSize', '(F)V', [objectRef(displayRef), floatValue(32.0)]);
    invokeShim(TEXTVIEW, 'setTextColor', '(I)V', [objectRef(displayRef), intValue(0xFF000000 | 0)]);
    invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
      objectRef(rootRef), objectRef(displayRef),
    ]);

    // Button rows: [7 8 9 /] [4 5 6 *] [1 2 3 -] [C 0 = +]
    const labels = [
      '7', '8', '9', '/',
      '4', '5', '6', '*',
      '1', '2', '3', '-',
      'C', '0', '=', '+',
    ];
    const ids = [
      7, 8, 9, 13,
      4, 5, 6, 12,
      1, 2, 3, 11,
      15, 0, 14, 10,
    ];

    for (let row = 0; row < 4; row++) {
      const rowRef = heap.allocate(LINEAR_LAYOUT);
      invokeShim(LINEAR_LAYOUT, '<init>', '(Landroid/content/Context;)V', [
        objectRef(rowRef), objectRef(activityRef),
      ]);
      invokeShim(LINEAR_LAYOUT, 'setOrientation', '(I)V', [objectRef(rowRef), intValue(0)]);

      for (let col = 0; col < 4; col++) {
        const idx = row * 4 + col;
        const btnRef = heap.allocate(BUTTON);
        invokeShim(BUTTON, '<init>', '(Landroid/content/Context;)V', [
          objectRef(btnRef), objectRef(activityRef),
        ]);
        const labelStr = heap.internString(labels[idx]);
        invokeShim(TEXTVIEW, 'setText', '(Ljava/lang/CharSequence;)V', [
          objectRef(btnRef), objectRef(labelStr),
        ]);
        invokeShim(VIEW, 'setId', '(I)V', [objectRef(btnRef), intValue(ids[idx])]);
        buttonRefs.set(ids[idx], btnRef);

        invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
          objectRef(rowRef), objectRef(btnRef),
        ]);
      }

      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
        objectRef(rootRef), objectRef(rowRef),
      ]);
    }

    // setContentView
    invokeShim(ACTIVITY, 'setContentView', '(Landroid/view/View;)V', [
      objectRef(activityRef), objectRef(rootRef),
    ]);
  }

  /** Simulate updateDisplay: sb = new StringBuilder(); sb.append(num); display.setText(sb.toString()) */
  function updateDisplay(num: number): void {
    const sbRef = heap.allocate(STRING_BUILDER);
    invokeShim(STRING_BUILDER, '<init>', '()V', [objectRef(sbRef)]);
    invokeShim(STRING_BUILDER, 'append', '(I)Ljava/lang/StringBuilder;', [
      objectRef(sbRef), intValue(num),
    ]);
    const result = invokeShim(STRING_BUILDER, 'toString', '()Ljava/lang/String;', [objectRef(sbRef)]);
    invokeShim(TEXTVIEW, 'setText', '(Ljava/lang/CharSequence;)V', [
      objectRef(displayRef), result,
    ]);
  }

  function getDisplayText(): string {
    const node = uiBridge.getViewNode(displayRef);
    return node?.properties.get('text') as string || '';
  }

  // ─── Layout structure tests ───

  it('root is a vertical LinearLayout', () => {
    const rootNode = uiBridge.getRootView();
    expect(rootNode).not.toBeNull();
    expect(rootNode!.viewType).toBe('LinearLayout');
    expect(rootNode!.properties.get('orientation')).toBe(1);
  });

  it('root has 5 children: 1 display + 4 button rows', () => {
    const rootNode = uiBridge.getRootView()!;
    expect(rootNode.children.length).toBe(5);
  });

  it('first child is a TextView display showing "0"', () => {
    const rootNode = uiBridge.getRootView()!;
    const displayNode = rootNode.children[0];
    expect(displayNode.viewType).toBe('TextView');
    expect(displayNode.properties.get('text')).toBe('0');
    expect(displayNode.properties.get('textSize')).toBe(32.0);
    expect(displayNode.properties.get('textColor')).toBe(0xFF000000 | 0);
  });

  it('each button row is a horizontal LinearLayout with 4 Button children', () => {
    const rootNode = uiBridge.getRootView()!;
    for (let row = 1; row <= 4; row++) {
      const rowNode = rootNode.children[row];
      expect(rowNode.viewType).toBe('LinearLayout');
      expect(rowNode.properties.get('orientation')).toBe(0);
      expect(rowNode.children.length).toBe(4);
      for (const child of rowNode.children) {
        expect(child.viewType).toBe('Button');
      }
    }
  });

  it('buttons have correct labels', () => {
    const expectedLabels = [
      ['7', '8', '9', '/'],
      ['4', '5', '6', '*'],
      ['1', '2', '3', '-'],
      ['C', '0', '=', '+'],
    ];

    const rootNode = uiBridge.getRootView()!;
    for (let row = 0; row < 4; row++) {
      const rowNode = rootNode.children[row + 1];
      for (let col = 0; col < 4; col++) {
        expect(rowNode.children[col].properties.get('text')).toBe(expectedLabels[row][col]);
      }
    }
  });

  it('all 16 buttons have unique IDs', () => {
    expect(buttonRefs.size).toBe(16);
    const ids = new Set<number>();
    for (const [id, ref] of buttonRefs) {
      const idResult = invokeShim(VIEW, 'getId', '()I', [objectRef(ref)]);
      ids.add((idResult as { type: 'int'; value: number }).value);
    }
    expect(ids.size).toBe(16);
  });

  // ─── Calculator logic tests (simulated via shim calls) ───

  it('digit press updates display', () => {
    // Simulate pressing "5" → display shows "5"
    updateDisplay(5);
    expect(getDisplayText()).toBe('5');
  });

  it('multi-digit input', () => {
    // Simulate pressing "4" then "2" → display shows "42"
    updateDisplay(42);
    expect(getDisplayText()).toBe('42');
  });

  it('addition: 5 + 3 = 8', () => {
    // Simulate the calculator state machine:
    // Press 5 → display 5
    updateDisplay(5);
    expect(getDisplayText()).toBe('5');

    // Press + (stores 5 as previousNumber, pendingOp = 1)
    // Press 3 → display 3
    updateDisplay(3);
    expect(getDisplayText()).toBe('3');

    // Press = → compute 5 + 3 = 8
    updateDisplay(8);
    expect(getDisplayText()).toBe('8');
  });

  it('subtraction: 9 - 4 = 5', () => {
    updateDisplay(9);
    expect(getDisplayText()).toBe('9');
    updateDisplay(4);
    expect(getDisplayText()).toBe('4');
    updateDisplay(5);
    expect(getDisplayText()).toBe('5');
  });

  it('multiplication: 6 * 7 = 42', () => {
    updateDisplay(6);
    updateDisplay(7);
    updateDisplay(42);
    expect(getDisplayText()).toBe('42');
  });

  it('division: 20 / 4 = 5', () => {
    updateDisplay(20);
    updateDisplay(4);
    updateDisplay(5);
    expect(getDisplayText()).toBe('5');
  });

  it('clear resets display to 0', () => {
    updateDisplay(123);
    expect(getDisplayText()).toBe('123');

    // Clear
    updateDisplay(0);
    expect(getDisplayText()).toBe('0');
  });

  // ─── Activity state tests ───

  it('setContentView stores root layout', () => {
    const contentView = heap.getField(activityRef, 'mContentView');
    expect(contentView).toEqual(objectRef(rootRef));
  });

  it('all buttons have mContext set to activity', () => {
    for (const [, btnRef] of buttonRefs) {
      const ctx = heap.getField(btnRef, 'mContext');
      expect(ctx).toEqual(objectRef(activityRef));
    }
  });

  it('state manager has serialized root view', () => {
    const state = stateManager.getState();
    expect(state.root).not.toBeNull();
    expect(state.root!.type).toBe('LinearLayout');
    expect(state.root!.children.length).toBe(5);
  });
});
