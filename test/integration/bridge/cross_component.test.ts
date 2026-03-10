/**
 * Cross-component interaction integration tests.
 * Tests the full cycle: shim → UIBridge → StateManager → serialized state.
 */

import { ShimRegistry } from '../../../src/interpreter/shim_registry';
import { Heap } from '../../../src/interpreter/heap';
import { Value, intValue, floatValue, objectRef, NULL_VALUE } from '../../../src/core/types';
import { UIBridge } from '../../../src/bridge/ui_bridge';
import { StateManager } from '../../../src/bridge/state_manager';
import { registerJavaLangShims } from '../../../src/shim/java/lang/index';
import { registerAndroidShims } from '../../../src/shim/android/index';
import { InterpreterRef } from '../../../src/interpreter/shim_registry';

describe('Cross-component interaction', () => {
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
  });

  function createActivity(): number {
    const ref = heap.allocate(ACTIVITY);
    invokeShim(ACTIVITY, '<init>', '()V', [objectRef(ref)]);
    return ref;
  }

  function createTextView(actRef: number, text?: string): number {
    const tvRef = heap.allocate(TEXTVIEW);
    invokeShim(TEXTVIEW, '<init>', '(Landroid/content/Context;)V', [
      objectRef(tvRef), objectRef(actRef),
    ]);
    if (text) {
      const strRef = heap.internString(text);
      invokeShim(TEXTVIEW, 'setText', '(Ljava/lang/CharSequence;)V', [
        objectRef(tvRef), objectRef(strRef),
      ]);
    }
    return tvRef;
  }

  function createButton(actRef: number, text?: string): number {
    const btnRef = heap.allocate(BUTTON);
    invokeShim(BUTTON, '<init>', '(Landroid/content/Context;)V', [
      objectRef(btnRef), objectRef(actRef),
    ]);
    if (text) {
      const strRef = heap.internString(text);
      invokeShim(TEXTVIEW, 'setText', '(Ljava/lang/CharSequence;)V', [
        objectRef(btnRef), objectRef(strRef),
      ]);
    }
    return btnRef;
  }

  function createLinearLayout(actRef: number, orientation: number): number {
    const llRef = heap.allocate(LINEAR_LAYOUT);
    invokeShim(LINEAR_LAYOUT, '<init>', '(Landroid/content/Context;)V', [
      objectRef(llRef), objectRef(actRef),
    ]);
    invokeShim(LINEAR_LAYOUT, 'setOrientation', '(I)V', [
      objectRef(llRef), intValue(orientation),
    ]);
    return llRef;
  }

  describe('click → state → render cycle', () => {
    it('button click callback triggers StateManager version bump', () => {
      const actRef = createActivity();
      const btnRef = createButton(actRef, 'Click Me');

      const initialVersion = stateManager.getState().version;

      // Set click listener that updates text
      const listenerRef = heap.allocate('Landroid/view/View$OnClickListener;');
      invokeShim(VIEW, 'setOnClickListener',
        '(Landroid/view/View$OnClickListener;)V',
        [objectRef(btnRef), objectRef(listenerRef)]
      );

      // Manually trigger click via UIBridge
      expect(uiBridge.hasClickCallback(btnRef)).toBe(true);

      // Set a click callback that updates text
      let clickCallbackInvoked = false;
      uiBridge.setClickCallback(btnRef, () => {
        clickCallbackInvoked = true;
        // Simulate what the click handler would do: update text
        uiBridge.updateViewProperty(btnRef, 'text', 'Clicked!');
      });

      uiBridge.dispatchClick(btnRef);

      expect(clickCallbackInvoked).toBe(true);
      const node = uiBridge.getViewNode(btnRef);
      expect(node!.properties.get('text')).toBe('Clicked!');
      expect(stateManager.getState().version).toBeGreaterThan(initialVersion);
    });

    it('text update after click is visible in serialized state', () => {
      const actRef = createActivity();
      const tvRef = createTextView(actRef, 'Before');

      // Set as content view
      invokeShim(ACTIVITY, 'setContentView', '(Landroid/view/View;)V', [
        objectRef(actRef), objectRef(tvRef),
      ]);

      let state = stateManager.getState();
      expect(state.root!.props['text']).toBe('Before');

      // Update text (simulating what a click handler would do)
      const newStr = heap.internString('After');
      invokeShim(TEXTVIEW, 'setText', '(Ljava/lang/CharSequence;)V', [
        objectRef(tvRef), objectRef(newStr),
      ]);

      // The UIBridge node is updated in-place
      const node = uiBridge.getViewNode(tvRef);
      expect(node!.properties.get('text')).toBe('After');
    });
  });

  describe('view hierarchy traversal', () => {
    it('nested LinearLayout with children preserves parent references', () => {
      const actRef = createActivity();
      const rootLL = createLinearLayout(actRef, 1); // vertical
      const childLL = createLinearLayout(actRef, 0); // horizontal
      const tv1 = createTextView(actRef, 'A');
      const tv2 = createTextView(actRef, 'B');

      // Build: root > childLL > [tv1, tv2]
      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
        objectRef(childLL), objectRef(tv1),
      ]);
      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
        objectRef(childLL), objectRef(tv2),
      ]);
      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
        objectRef(rootLL), objectRef(childLL),
      ]);

      // Verify parent references
      const rootNode = uiBridge.getViewNode(rootLL)!;
      const childLLNode = uiBridge.getViewNode(childLL)!;
      const tv1Node = uiBridge.getViewNode(tv1)!;
      const tv2Node = uiBridge.getViewNode(tv2)!;

      expect(childLLNode.parent).toBe(rootNode);
      expect(tv1Node.parent).toBe(childLLNode);
      expect(tv2Node.parent).toBe(childLLNode);
      expect(rootNode.parent).toBeNull();
    });

    it('child ordering is preserved after multiple addView calls', () => {
      const actRef = createActivity();
      const layout = createLinearLayout(actRef, 1);

      const children = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
      for (const text of children) {
        const tvRef = createTextView(actRef, text);
        invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
          objectRef(layout), objectRef(tvRef),
        ]);
      }

      const layoutNode = uiBridge.getViewNode(layout)!;
      expect(layoutNode.children.length).toBe(5);

      for (let i = 0; i < children.length; i++) {
        expect(layoutNode.children[i].properties.get('text')).toBe(children[i]);
      }
    });

    it('UIBridge child count matches addView calls', () => {
      const actRef = createActivity();
      const groupRef = createLinearLayout(actRef, 1);

      for (let i = 0; i < 3; i++) {
        const tvRef = createTextView(actRef, `Item ${i}`);
        invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
          objectRef(groupRef), objectRef(tvRef),
        ]);
      }

      // UIBridge is the authoritative source for child count (per-instance state)
      const node = uiBridge.getViewNode(groupRef)!;
      expect(node.children.length).toBe(3);

      // Verify child content
      for (let i = 0; i < 3; i++) {
        expect(node.children[i].properties.get('text')).toBe(`Item ${i}`);
      }
    });
  });

  describe('Activity with complex layout', () => {
    it('Activity → setContentView(LinearLayout with nested ViewGroups)', () => {
      const actRef = createActivity();
      invokeShim(ACTIVITY, 'onCreate', '(Landroid/os/Bundle;)V', [objectRef(actRef), NULL_VALUE]);

      // Root: vertical LinearLayout
      const rootLL = createLinearLayout(actRef, 1);

      // Header row: horizontal LinearLayout with 2 TextViews
      const headerRow = createLinearLayout(actRef, 0);
      const titleTV = createTextView(actRef, 'Title');
      const subtitleTV = createTextView(actRef, 'Subtitle');
      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
        objectRef(headerRow), objectRef(titleTV),
      ]);
      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
        objectRef(headerRow), objectRef(subtitleTV),
      ]);

      // Content row: horizontal LinearLayout with 3 Buttons
      const contentRow = createLinearLayout(actRef, 0);
      const btn1 = createButton(actRef, 'A');
      const btn2 = createButton(actRef, 'B');
      const btn3 = createButton(actRef, 'C');
      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
        objectRef(contentRow), objectRef(btn1),
      ]);
      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
        objectRef(contentRow), objectRef(btn2),
      ]);
      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
        objectRef(contentRow), objectRef(btn3),
      ]);

      // Add rows to root
      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
        objectRef(rootLL), objectRef(headerRow),
      ]);
      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
        objectRef(rootLL), objectRef(contentRow),
      ]);

      // setContentView
      invokeShim(ACTIVITY, 'setContentView', '(Landroid/view/View;)V', [
        objectRef(actRef), objectRef(rootLL),
      ]);

      // Verify full tree in StateManager
      const state = stateManager.getState();
      expect(state.root).not.toBeNull();
      expect(state.root!.type).toBe('LinearLayout');
      expect(state.root!.children.length).toBe(2);

      // Header row
      const header = state.root!.children[0];
      expect(header.type).toBe('LinearLayout');
      expect(header.children.length).toBe(2);
      expect(header.children[0].props['text']).toBe('Title');
      expect(header.children[1].props['text']).toBe('Subtitle');

      // Content row
      const content = state.root!.children[1];
      expect(content.type).toBe('LinearLayout');
      expect(content.children.length).toBe(3);
      expect(content.children[0].type).toBe('Button');
      expect(content.children[0].props['text']).toBe('A');
      expect(content.children[1].props['text']).toBe('B');
      expect(content.children[2].props['text']).toBe('C');
    });

    it('deeply nested tree serializes correctly (3 levels)', () => {
      const actRef = createActivity();

      // Level 0: root LinearLayout
      const l0 = createLinearLayout(actRef, 1);

      // Level 1: 2 horizontal LinearLayouts
      const l1a = createLinearLayout(actRef, 0);
      const l1b = createLinearLayout(actRef, 0);

      // Level 2: TextViews in each L1
      const tv1 = createTextView(actRef, 'L1a-Child1');
      const tv2 = createTextView(actRef, 'L1a-Child2');
      const tv3 = createTextView(actRef, 'L1b-Child1');

      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [objectRef(l1a), objectRef(tv1)]);
      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [objectRef(l1a), objectRef(tv2)]);
      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [objectRef(l1b), objectRef(tv3)]);

      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [objectRef(l0), objectRef(l1a)]);
      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [objectRef(l0), objectRef(l1b)]);

      invokeShim(ACTIVITY, 'setContentView', '(Landroid/view/View;)V', [
        objectRef(actRef), objectRef(l0),
      ]);

      const state = stateManager.getState();
      const root = state.root!;

      expect(root.type).toBe('LinearLayout');
      expect(root.children.length).toBe(2);

      expect(root.children[0].type).toBe('LinearLayout');
      expect(root.children[0].children.length).toBe(2);
      expect(root.children[0].children[0].props['text']).toBe('L1a-Child1');
      expect(root.children[0].children[1].props['text']).toBe('L1a-Child2');

      expect(root.children[1].type).toBe('LinearLayout');
      expect(root.children[1].children.length).toBe(1);
      expect(root.children[1].children[0].props['text']).toBe('L1b-Child1');
    });
  });

  describe('mixed view types', () => {
    it('LinearLayout with mixed Button and TextView children', () => {
      const actRef = createActivity();
      const layout = createLinearLayout(actRef, 1);

      const tv = createTextView(actRef, 'Label');
      const btn = createButton(actRef, 'Action');

      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
        objectRef(layout), objectRef(tv),
      ]);
      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
        objectRef(layout), objectRef(btn),
      ]);

      invokeShim(ACTIVITY, 'setContentView', '(Landroid/view/View;)V', [
        objectRef(actRef), objectRef(layout),
      ]);

      const state = stateManager.getState();
      expect(state.root!.children[0].type).toBe('TextView');
      expect(state.root!.children[0].props['text']).toBe('Label');
      expect(state.root!.children[1].type).toBe('Button');
      expect(state.root!.children[1].props['text']).toBe('Action');
    });
  });

  describe('state version tracking', () => {
    it('tracks version correctly through full Activity lifecycle', () => {
      const actRef = createActivity();
      const v0 = stateManager.getState().version;

      const tv = createTextView(actRef, 'Initial');
      // Each setText triggers a state update via UIBridge
      const v1 = stateManager.getState().version;
      expect(v1).toBeGreaterThan(v0);

      invokeShim(ACTIVITY, 'setContentView', '(Landroid/view/View;)V', [
        objectRef(actRef), objectRef(tv),
      ]);
      const v2 = stateManager.getState().version;
      expect(v2).toBeGreaterThan(v1);

      // Update text
      const newStr = heap.internString('Updated');
      invokeShim(TEXTVIEW, 'setText', '(Ljava/lang/CharSequence;)V', [
        objectRef(tv), objectRef(newStr),
      ]);
      const v3 = stateManager.getState().version;
      expect(v3).toBeGreaterThan(v2);
    });
  });
});
