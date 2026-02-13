/**
 * CRAFT - UI Bridge Integration Tests
 * Stage 4: UI Bridge & OpenHarmony Host
 *
 * Tests the full integration of UI Bridge with Android API shims
 */

import { Heap } from '../../../src/interpreter/heap';
import { Interpreter } from '../../../src/interpreter/interpreter';
import { DexParser } from '../../../src/parser/dex_parser';
import { ClassLoader } from '../../../src/interpreter/class_loader';
import { ShimRegistry } from '../../../src/interpreter/shim_registry';
import { initializeShimRegistry } from '../../../src/interpreter/shim_init';
import { UIBridge } from '../../../src/bridge/ui_bridge';
import { StateManager } from '../../../src/bridge/state_manager';
import { LifecycleBridge } from '../../../src/bridge/lifecycle_bridge';
import { NULL_VALUE, objectRef } from '../../../src/core/types';
import * as fs from 'fs';
import * as path from 'path';

describe('UI Bridge Integration', () => {
  let heap: Heap;
  let dexParser: DexParser;
  let classLoader: ClassLoader;
  let stateManager: StateManager;
  let uiBridge: UIBridge;
  let shimRegistry: ShimRegistry;
  let interpreter: Interpreter;
  let lifecycleBridge: LifecycleBridge;

  beforeEach(() => {
    // Load test DEX file
    const dexPath = path.join(__dirname, '../../fixtures/hello_world.dex');
    const dexData = fs.readFileSync(dexPath);
    dexParser = new DexParser(dexData);

    heap = new Heap();
    stateManager = new StateManager();
    uiBridge = new UIBridge(heap, stateManager);
    shimRegistry = initializeShimRegistry(uiBridge);
    interpreter = new Interpreter(dexParser, heap, shimRegistry);
    classLoader = interpreter.getClassLoader();
    lifecycleBridge = new LifecycleBridge(interpreter, heap);
  });

  describe('TextView integration', () => {
    it('should register TextView when created', () => {
      // Create Activity (needed as context)
      const activityRef = heap.allocate('Landroid/app/Activity;');
      interpreter.invoke('Landroid/app/Activity;', '<init>', '()V', [objectRef(activityRef)]);

      // Create TextView
      const textViewRef = heap.allocate('Landroid/widget/TextView;');
      interpreter.invoke('Landroid/widget/TextView;', '<init>', '(Landroid/content/Context;)V', [
        objectRef(textViewRef),
        objectRef(activityRef)
      ]);

      // Verify it's registered with UIBridge
      const viewNode = uiBridge.getViewNode(textViewRef);
      expect(viewNode).not.toBeNull();
      expect(viewNode!.viewType).toBe('TextView');
    });

    it('should update UIBridge when setText is called', () => {
      const activityRef = heap.allocate('Landroid/app/Activity;');
      interpreter.invoke('Landroid/app/Activity;', '<init>', '()V', [objectRef(activityRef)]);

      const textViewRef = heap.allocate('Landroid/widget/TextView;');
      interpreter.invoke('Landroid/widget/TextView;', '<init>', '(Landroid/content/Context;)V', [
        objectRef(textViewRef),
        objectRef(activityRef)
      ]);

      // Create string "Hello World"
      const stringRef = heap.internString('Hello World');

      // Call setText
      interpreter.invoke(
        'Landroid/widget/TextView;',
        'setText',
        '(Ljava/lang/CharSequence;)V',
        [objectRef(textViewRef), objectRef(stringRef)]
      );

      // Verify property updated
      const viewNode = uiBridge.getViewNode(textViewRef);
      expect(viewNode!.properties.get('text')).toBe('Hello World');
    });

    it('should trigger state updates on property changes', () => {
      const activityRef = heap.allocate('Landroid/app/Activity;');
      interpreter.invoke('Landroid/app/Activity;', '<init>', '()V', [objectRef(activityRef)]);

      const textViewRef = heap.allocate('Landroid/widget/TextView;');
      interpreter.invoke('Landroid/widget/TextView;', '<init>', '(Landroid/content/Context;)V', [
        objectRef(textViewRef),
        objectRef(activityRef)
      ]);

      let updateCount = 0;
      stateManager.subscribe(() => {
        updateCount++;
      });

      const stringRef = heap.internString('Test');

      // setText should trigger update
      interpreter.invoke(
        'Landroid/widget/TextView;',
        'setText',
        '(Ljava/lang/CharSequence;)V',
        [objectRef(textViewRef), objectRef(stringRef)]
      );

      expect(updateCount).toBeGreaterThan(0);
    });
  });

  describe('Activity integration', () => {
    it('should set root view when setContentView is called', () => {
      // Create Activity and TextView
      const activityRef = heap.allocate('Landroid/app/Activity;');
      interpreter.invoke('Landroid/app/Activity;', '<init>', '()V', [objectRef(activityRef)]);

      const textViewRef = heap.allocate('Landroid/widget/TextView;');
      interpreter.invoke('Landroid/widget/TextView;', '<init>', '(Landroid/content/Context;)V', [
        objectRef(textViewRef),
        objectRef(activityRef)
      ]);

      // Call setContentView
      interpreter.invoke(
        'Landroid/app/Activity;',
        'setContentView',
        '(Landroid/view/View;)V',
        [objectRef(activityRef), objectRef(textViewRef)]
      );

      // Verify root view set
      const rootView = uiBridge.getRootView();
      expect(rootView).not.toBeNull();
      expect(rootView!.viewRef).toBe(textViewRef);
    });

    it('should update state when setContentView is called', () => {
      const activityRef = heap.allocate('Landroid/app/Activity;');
      interpreter.invoke('Landroid/app/Activity;', '<init>', '()V', [objectRef(activityRef)]);

      const textViewRef = heap.allocate('Landroid/widget/TextView;');
      interpreter.invoke('Landroid/widget/TextView;', '<init>', '(Landroid/content/Context;)V', [
        objectRef(textViewRef),
        objectRef(activityRef)
      ]);

      // Set text before setContentView
      const stringRef = heap.internString('Hello World');
      interpreter.invoke(
        'Landroid/widget/TextView;',
        'setText',
        '(Ljava/lang/CharSequence;)V',
        [objectRef(textViewRef), objectRef(stringRef)]
      );

      // Call setContentView
      interpreter.invoke(
        'Landroid/app/Activity;',
        'setContentView',
        '(Landroid/view/View;)V',
        [objectRef(activityRef), objectRef(textViewRef)]
      );

      // Verify state has root view with text
      const state = stateManager.getState();
      expect(state.root).not.toBeNull();
      expect(state.root!.type).toBe('TextView');
      expect(state.root!.props['text']).toBe('Hello World');
    });
  });

  describe('Full Hello World flow', () => {
    it('should handle complete Hello World sequence with shims', () => {
      // Track state updates
      let updateCount = 0;
      stateManager.subscribe(() => {
        updateCount++;
      });

      // Manually create Activity and TextView using shims (simulating MainActivity.onCreate)
      const activityRef = heap.allocate('Landroid/app/Activity;');
      interpreter.invoke('Landroid/app/Activity;', '<init>', '()V', [objectRef(activityRef)]);

      // Call onCreate
      interpreter.invoke('Landroid/app/Activity;', 'onCreate', '(Landroid/os/Bundle;)V', [
        objectRef(activityRef), NULL_VALUE
      ]);

      // Create TextView
      const textViewRef = heap.allocate('Landroid/widget/TextView;');
      interpreter.invoke('Landroid/widget/TextView;', '<init>', '(Landroid/content/Context;)V', [
        objectRef(textViewRef), objectRef(activityRef)
      ]);

      // Set text "Hello World"
      const stringRef = heap.internString('Hello World');
      interpreter.invoke('Landroid/widget/TextView;', 'setText', '(Ljava/lang/CharSequence;)V', [
        objectRef(textViewRef), objectRef(stringRef)
      ]);

      // Call setContentView
      interpreter.invoke('Landroid/app/Activity;', 'setContentView', '(Landroid/view/View;)V', [
        objectRef(activityRef), objectRef(textViewRef)
      ]);

      // Verify root view was set
      const rootView = uiBridge.getRootView();
      expect(rootView).not.toBeNull();

      // Verify it's a TextView
      expect(rootView!.viewType).toBe('TextView');

      // Verify text is "Hello World"
      expect(rootView!.properties.get('text')).toBe('Hello World');

      // Verify state was updated
      const state = stateManager.getState();
      expect(state.root).not.toBeNull();
      expect(state.root!.type).toBe('TextView');
      expect(state.root!.props['text']).toBe('Hello World');

      // Verify updates were triggered
      expect(updateCount).toBeGreaterThan(0);
    });

    it('should maintain view state when updated', () => {
      // Create Activity and TextView
      const activityRef = heap.allocate('Landroid/app/Activity;');
      interpreter.invoke('Landroid/app/Activity;', '<init>', '()V', [objectRef(activityRef)]);

      const textViewRef = heap.allocate('Landroid/widget/TextView;');
      interpreter.invoke('Landroid/widget/TextView;', '<init>', '(Landroid/content/Context;)V', [
        objectRef(textViewRef), objectRef(activityRef)
      ]);

      // Set initial text
      let stringRef = heap.internString('Hello');
      interpreter.invoke('Landroid/widget/TextView;', 'setText', '(Ljava/lang/CharSequence;)V', [
        objectRef(textViewRef), objectRef(stringRef)
      ]);

      interpreter.invoke('Landroid/app/Activity;', 'setContentView', '(Landroid/view/View;)V', [
        objectRef(activityRef), objectRef(textViewRef)
      ]);

      const rootView1 = uiBridge.getRootView();
      const text1 = rootView1!.properties.get('text');
      expect(text1).toBe('Hello');

      // Update text
      stringRef = heap.internString('Hello World');
      interpreter.invoke('Landroid/widget/TextView;', 'setText', '(Ljava/lang/CharSequence;)V', [
        objectRef(textViewRef), objectRef(stringRef)
      ]);

      const rootView2 = uiBridge.getRootView();
      const text2 = rootView2!.properties.get('text');

      // Text should be updated
      expect(text2).toBe('Hello World');
    });
  });

  describe('CraftRuntime API', () => {
    it('should provide high-level runtime API', () => {
      const { CraftRuntime } = require('../../../src/runtime');

      // Create runtime
      const runtime = new CraftRuntime();

      // Verify components are initialized
      expect(runtime.getHeap()).toBeDefined();
      expect(runtime.getUIBridge()).toBeDefined();
      expect(runtime.getStateManager()).toBeDefined();

      // Test state subscription
      let notified = false;
      runtime.subscribeToViewUpdates(() => {
        notified = true;
      });

      // Manually trigger an update (simulating view change)
      runtime.getStateManager().notifyUpdate();
      expect(notified).toBe(true);

      // Cleanup
      runtime.shutdown();
    });
  });
});
