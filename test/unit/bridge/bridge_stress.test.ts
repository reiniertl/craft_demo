/**
 * Bridge layer stress and extended lifecycle tests.
 * Tests UIBridge under load, StateManager rapid updates,
 * and LifecycleBridge full cycle edge cases.
 */

import { Heap } from '../../../src/interpreter/heap';
import { UIBridge, ViewNode } from '../../../src/bridge/ui_bridge';
import { StateManager } from '../../../src/bridge/state_manager';
import { LifecycleBridge } from '../../../src/bridge/lifecycle_bridge';
import { Interpreter } from '../../../src/interpreter/interpreter';
import { DexParser } from '../../../src/parser/dex_parser';
import { initializeShimRegistry } from '../../../src/interpreter/shim_init';
import { objectRef } from '../../../src/core/types';
import * as fs from 'fs';
import * as path from 'path';

describe('UIBridge stress tests', () => {
  let heap: Heap;
  let stateManager: StateManager;
  let uiBridge: UIBridge;

  beforeEach(() => {
    heap = new Heap();
    stateManager = new StateManager();
    uiBridge = new UIBridge(heap, stateManager);
  });

  it('registers 100 views with unique IDs', () => {
    const refs: number[] = [];
    for (let i = 0; i < 100; i++) {
      const ref = heap.allocate('Landroid/widget/TextView;');
      uiBridge.registerView(ref, 'TextView');
      refs.push(ref);
    }

    // Verify all are registered with unique arkuiIds
    const arkuiIds = new Set<string>();
    for (const ref of refs) {
      const node = uiBridge.getViewNode(ref);
      expect(node).not.toBeNull();
      expect(node!.viewType).toBe('TextView');
      arkuiIds.add(node!.arkuiId);
    }
    expect(arkuiIds.size).toBe(100);
  });

  it('handles 100 rapid property updates on same view', () => {
    const ref = heap.allocate('Landroid/widget/TextView;');
    uiBridge.registerView(ref, 'TextView');

    for (let i = 0; i < 100; i++) {
      uiBridge.updateViewProperty(ref, 'text', `Update ${i}`);
    }

    const node = uiBridge.getViewNode(ref);
    expect(node!.properties.get('text')).toBe('Update 99');
  });

  it('builds a deep parent-child hierarchy (10 levels)', () => {
    let parentRef = heap.allocate('Landroid/view/ViewGroup;');
    uiBridge.registerView(parentRef, 'ViewGroup');
    const rootRef = parentRef;

    for (let i = 0; i < 10; i++) {
      const childRef = heap.allocate('Landroid/view/ViewGroup;');
      uiBridge.registerView(childRef, 'ViewGroup');
      uiBridge.addChildView(parentRef, childRef);
      parentRef = childRef;
    }

    // Add a leaf TextView at the bottom
    const leafRef = heap.allocate('Landroid/widget/TextView;');
    uiBridge.registerView(leafRef, 'TextView');
    uiBridge.updateViewProperty(leafRef, 'text', 'Deep leaf');
    uiBridge.addChildView(parentRef, leafRef);

    // Verify root has correct nested structure
    uiBridge.setRootView(rootRef);
    const state = stateManager.getState();
    expect(state.root).not.toBeNull();

    // Walk down the tree
    let current = state.root!;
    for (let i = 0; i < 10; i++) {
      expect(current.children.length).toBe(1);
      expect(current.type).toBe('ViewGroup');
      current = current.children[0];
    }
    // Deepest level has the leaf
    expect(current.children.length).toBe(1);
    expect(current.children[0].type).toBe('TextView');
    expect(current.children[0].props['text']).toBe('Deep leaf');
  });

  it('handles wide hierarchy (50 children)', () => {
    const parentRef = heap.allocate('Landroid/view/ViewGroup;');
    uiBridge.registerView(parentRef, 'ViewGroup');

    for (let i = 0; i < 50; i++) {
      const childRef = heap.allocate('Landroid/widget/TextView;');
      uiBridge.registerView(childRef, 'TextView');
      uiBridge.updateViewProperty(childRef, 'text', `Child ${i}`);
      uiBridge.addChildView(parentRef, childRef);
    }

    const parentNode = uiBridge.getViewNode(parentRef);
    expect(parentNode!.children.length).toBe(50);

    // Verify ordering preserved
    for (let i = 0; i < 50; i++) {
      expect(parentNode!.children[i].properties.get('text')).toBe(`Child ${i}`);
    }
  });

  it('clear resets all 100 views', () => {
    const refs: number[] = [];
    for (let i = 0; i < 100; i++) {
      const ref = heap.allocate('Landroid/widget/TextView;');
      uiBridge.registerView(ref, 'TextView');
      refs.push(ref);
    }
    uiBridge.setRootView(refs[0]);

    uiBridge.clear();

    for (const ref of refs) {
      expect(uiBridge.getViewNode(ref)).toBeNull();
    }
    expect(uiBridge.getRootView()).toBeNull();
  });
});

describe('StateManager stress tests', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager();
  });

  it('version is monotonically increasing under 200 rapid updates', () => {
    let prevVersion = stateManager.getState().version;

    for (let i = 0; i < 200; i++) {
      stateManager.notifyUpdate();
      const newVersion = stateManager.getState().version;
      expect(newVersion).toBe(prevVersion + 1);
      prevVersion = newVersion;
    }
    expect(stateManager.getState().version).toBe(200);
  });

  it('all subscribers are notified on every update', () => {
    const callCounts = [0, 0, 0, 0, 0];
    for (let i = 0; i < 5; i++) {
      const idx = i;
      stateManager.subscribe(() => { callCounts[idx]++; });
    }

    for (let i = 0; i < 50; i++) {
      stateManager.notifyUpdate();
    }

    for (const count of callCounts) {
      expect(count).toBe(50);
    }
  });

  it('setRootView then multiple notifyUpdate preserves root', () => {
    const viewNode: ViewNode = {
      viewRef: 1,
      viewType: 'TextView',
      properties: new Map([['text', 'Stable']]),
      children: [],
      parent: null,
      arkuiId: 'view_1',
    };

    stateManager.setRootView(viewNode);

    for (let i = 0; i < 100; i++) {
      stateManager.notifyUpdate();
    }

    const state = stateManager.getState();
    expect(state.version).toBe(101); // 1 from setRootView + 100 notifyUpdate
    expect(state.root).not.toBeNull();
    expect(state.root!.props['text']).toBe('Stable');
  });
});

describe('LifecycleBridge extended tests', () => {
  let heap: Heap;
  let interpreter: Interpreter;
  let lifecycleBridge: LifecycleBridge;

  beforeEach(() => {
    const dexPath = path.join(__dirname, '../../fixtures/hello_world.dex');
    const dexData = fs.readFileSync(dexPath);
    const dexParser = new DexParser(dexData);

    heap = new Heap();
    const shimRegistry = initializeShimRegistry();
    interpreter = new Interpreter(dexParser, heap, shimRegistry);
    lifecycleBridge = new LifecycleBridge(interpreter, heap);
  });

  it('full lifecycle cycle: create → resume → pause → resume → pause → destroy', () => {
    lifecycleBridge.createActivity('Lcom/example/hello/MainActivity;');
    expect(lifecycleBridge.isActivityCreated()).toBe(true);

    lifecycleBridge.resumeActivity();
    expect(lifecycleBridge.isActivityCreated()).toBe(true);

    lifecycleBridge.pauseActivity();
    expect(lifecycleBridge.isActivityCreated()).toBe(true);

    // Second resume-pause cycle
    lifecycleBridge.resumeActivity();
    expect(lifecycleBridge.isActivityCreated()).toBe(true);

    lifecycleBridge.pauseActivity();
    expect(lifecycleBridge.isActivityCreated()).toBe(true);

    lifecycleBridge.destroyActivity();
    expect(lifecycleBridge.isActivityCreated()).toBe(false);
    expect(lifecycleBridge.getActivityRef()).toBeNull();
    expect(lifecycleBridge.getMainClassName()).toBeNull();
  });

  it('double-destroy is safe', () => {
    lifecycleBridge.createActivity('Lcom/example/hello/MainActivity;');
    lifecycleBridge.destroyActivity();
    expect(lifecycleBridge.isActivityCreated()).toBe(false);

    // Second destroy should not throw
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    expect(() => lifecycleBridge.destroyActivity()).not.toThrow();
    consoleSpy.mockRestore();
  });

  it('resume without create warns but does not throw', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    expect(() => lifecycleBridge.resumeActivity()).not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('pause without create warns but does not throw', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    expect(() => lifecycleBridge.pauseActivity()).not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('create new activity after full lifecycle completes', () => {
    // First lifecycle
    lifecycleBridge.createActivity('Lcom/example/hello/MainActivity;');
    lifecycleBridge.resumeActivity();
    lifecycleBridge.pauseActivity();
    lifecycleBridge.destroyActivity();

    // Second lifecycle
    const newRef = lifecycleBridge.createActivity('Lcom/example/hello/MainActivity;');
    expect(newRef).toBeGreaterThan(0);
    expect(lifecycleBridge.isActivityCreated()).toBe(true);

    lifecycleBridge.resumeActivity();
    lifecycleBridge.destroyActivity();
    expect(lifecycleBridge.isActivityCreated()).toBe(false);
  });
});
