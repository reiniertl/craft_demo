/**
 * CRAFT - UIBridge Unit Tests
 * Stage 4: UI Bridge & OpenHarmony Host
 */

import { Heap } from '../../../src/interpreter/heap';
import { UIBridge, ViewNode } from '../../../src/bridge/ui_bridge';
import { StateManager } from '../../../src/bridge/state_manager';

describe('UIBridge', () => {
  let heap: Heap;
  let stateManager: StateManager;
  let uiBridge: UIBridge;

  beforeEach(() => {
    heap = new Heap();
    stateManager = new StateManager();
    uiBridge = new UIBridge(heap, stateManager);
  });

  describe('registerView', () => {
    it('should create ViewNode for a view', () => {
      const viewRef = heap.allocate('Landroid/widget/TextView;');

      uiBridge.registerView(viewRef, 'TextView');

      const node = uiBridge.getViewNode(viewRef);
      expect(node).not.toBeNull();
      expect(node!.viewRef).toBe(viewRef);
      expect(node!.viewType).toBe('TextView');
      expect(node!.properties).toBeInstanceOf(Map);
      expect(node!.properties.size).toBe(0);
      expect(node!.children).toEqual([]);
      expect(node!.parent).toBeNull();
      expect(node!.arkuiId).toBe(`view_${viewRef}`);
    });

    it('should skip registration if view already registered', () => {
      const viewRef = heap.allocate('Landroid/widget/TextView;');

      uiBridge.registerView(viewRef, 'TextView');
      const node1 = uiBridge.getViewNode(viewRef);

      uiBridge.registerView(viewRef, 'TextView');
      const node2 = uiBridge.getViewNode(viewRef);

      expect(node1).toBe(node2);
    });

    it('should handle multiple views', () => {
      const view1 = heap.allocate('Landroid/widget/TextView;');
      const view2 = heap.allocate('Landroid/widget/TextView;');
      const view3 = heap.allocate('Landroid/view/ViewGroup;');

      uiBridge.registerView(view1, 'TextView');
      uiBridge.registerView(view2, 'TextView');
      uiBridge.registerView(view3, 'ViewGroup');

      expect(uiBridge.getViewNode(view1)).not.toBeNull();
      expect(uiBridge.getViewNode(view2)).not.toBeNull();
      expect(uiBridge.getViewNode(view3)).not.toBeNull();
      expect(uiBridge.getViewNode(view1)!.viewType).toBe('TextView');
      expect(uiBridge.getViewNode(view3)!.viewType).toBe('ViewGroup');
    });
  });

  describe('updateViewProperty', () => {
    it('should update view properties', () => {
      const viewRef = heap.allocate('Landroid/widget/TextView;');
      uiBridge.registerView(viewRef, 'TextView');

      uiBridge.updateViewProperty(viewRef, 'text', 'Hello World');
      uiBridge.updateViewProperty(viewRef, 'textSize', 16);
      uiBridge.updateViewProperty(viewRef, 'textColor', 0xFF000000);

      const node = uiBridge.getViewNode(viewRef);
      expect(node!.properties.get('text')).toBe('Hello World');
      expect(node!.properties.get('textSize')).toBe(16);
      expect(node!.properties.get('textColor')).toBe(0xFF000000);
    });

    it('should trigger state manager notification', () => {
      const viewRef = heap.allocate('Landroid/widget/TextView;');
      uiBridge.registerView(viewRef, 'TextView');

      let notified = false;
      stateManager.subscribe(() => {
        notified = true;
      });

      uiBridge.updateViewProperty(viewRef, 'text', 'Test');

      expect(notified).toBe(true);
    });

    it('should ignore updates for unregistered views', () => {
      const viewRef = heap.allocate('Landroid/widget/TextView;');

      // Should not throw
      uiBridge.updateViewProperty(viewRef, 'text', 'Test');

      expect(uiBridge.getViewNode(viewRef)).toBeNull();
    });

    it('should update existing properties', () => {
      const viewRef = heap.allocate('Landroid/widget/TextView;');
      uiBridge.registerView(viewRef, 'TextView');

      uiBridge.updateViewProperty(viewRef, 'text', 'First');
      expect(uiBridge.getViewNode(viewRef)!.properties.get('text')).toBe('First');

      uiBridge.updateViewProperty(viewRef, 'text', 'Second');
      expect(uiBridge.getViewNode(viewRef)!.properties.get('text')).toBe('Second');
    });
  });

  describe('setRootView', () => {
    it('should set root view and notify state manager', () => {
      const viewRef = heap.allocate('Landroid/widget/TextView;');
      uiBridge.registerView(viewRef, 'TextView');
      uiBridge.updateViewProperty(viewRef, 'text', 'Hello World');

      let notified = false;
      stateManager.subscribe(() => {
        notified = true;
      });

      uiBridge.setRootView(viewRef);

      expect(uiBridge.getRootView()).not.toBeNull();
      expect(uiBridge.getRootView()!.viewRef).toBe(viewRef);
      expect(notified).toBe(true);
    });

    it('should update state manager with serialized view', () => {
      const viewRef = heap.allocate('Landroid/widget/TextView;');
      uiBridge.registerView(viewRef, 'TextView');
      uiBridge.updateViewProperty(viewRef, 'text', 'Hello World');

      uiBridge.setRootView(viewRef);

      const state = stateManager.getState();
      expect(state.root).not.toBeNull();
      expect(state.root!.type).toBe('TextView');
      expect(state.root!.props['text']).toBe('Hello World');
    });

    it('should ignore if view not registered', () => {
      const viewRef = heap.allocate('Landroid/widget/TextView;');

      uiBridge.setRootView(viewRef);

      expect(uiBridge.getRootView()).toBeNull();
    });
  });

  describe('addChildView', () => {
    it('should add child to parent view', () => {
      const parentRef = heap.allocate('Landroid/view/ViewGroup;');
      const childRef = heap.allocate('Landroid/widget/TextView;');

      uiBridge.registerView(parentRef, 'ViewGroup');
      uiBridge.registerView(childRef, 'TextView');

      uiBridge.addChildView(parentRef, childRef);

      const parent = uiBridge.getViewNode(parentRef);
      const child = uiBridge.getViewNode(childRef);

      expect(parent!.children).toHaveLength(1);
      expect(parent!.children[0]).toBe(child);
      expect(child!.parent).toBe(parent);
    });

    it('should trigger state manager notification', () => {
      const parentRef = heap.allocate('Landroid/view/ViewGroup;');
      const childRef = heap.allocate('Landroid/widget/TextView;');

      uiBridge.registerView(parentRef, 'ViewGroup');
      uiBridge.registerView(childRef, 'TextView');

      let notified = false;
      stateManager.subscribe(() => {
        notified = true;
      });

      uiBridge.addChildView(parentRef, childRef);

      expect(notified).toBe(true);
    });

    it('should ignore if parent not registered', () => {
      const parentRef = heap.allocate('Landroid/view/ViewGroup;');
      const childRef = heap.allocate('Landroid/widget/TextView;');

      uiBridge.registerView(childRef, 'TextView');

      uiBridge.addChildView(parentRef, childRef);

      expect(uiBridge.getViewNode(childRef)!.parent).toBeNull();
    });

    it('should ignore if child not registered', () => {
      const parentRef = heap.allocate('Landroid/view/ViewGroup;');
      const childRef = heap.allocate('Landroid/widget/TextView;');

      uiBridge.registerView(parentRef, 'ViewGroup');

      uiBridge.addChildView(parentRef, childRef);

      expect(uiBridge.getViewNode(parentRef)!.children).toHaveLength(0);
    });

    it('should handle multiple children', () => {
      const parentRef = heap.allocate('Landroid/view/ViewGroup;');
      const child1 = heap.allocate('Landroid/widget/TextView;');
      const child2 = heap.allocate('Landroid/widget/TextView;');
      const child3 = heap.allocate('Landroid/widget/TextView;');

      uiBridge.registerView(parentRef, 'ViewGroup');
      uiBridge.registerView(child1, 'TextView');
      uiBridge.registerView(child2, 'TextView');
      uiBridge.registerView(child3, 'TextView');

      uiBridge.addChildView(parentRef, child1);
      uiBridge.addChildView(parentRef, child2);
      uiBridge.addChildView(parentRef, child3);

      const parent = uiBridge.getViewNode(parentRef);
      expect(parent!.children).toHaveLength(3);
    });
  });

  describe('clear', () => {
    it('should clear all views and root', () => {
      const view1 = heap.allocate('Landroid/widget/TextView;');
      const view2 = heap.allocate('Landroid/widget/TextView;');

      uiBridge.registerView(view1, 'TextView');
      uiBridge.registerView(view2, 'TextView');
      uiBridge.setRootView(view1);

      uiBridge.clear();

      expect(uiBridge.getViewNode(view1)).toBeNull();
      expect(uiBridge.getViewNode(view2)).toBeNull();
      expect(uiBridge.getRootView()).toBeNull();
    });

    it('should clear state manager', () => {
      const viewRef = heap.allocate('Landroid/widget/TextView;');
      uiBridge.registerView(viewRef, 'TextView');
      uiBridge.setRootView(viewRef);

      uiBridge.clear();

      const state = stateManager.getState();
      expect(state.root).toBeNull();
    });
  });
});
