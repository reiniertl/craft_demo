/**
 * CRAFT - StateManager Unit Tests
 * Stage 4: UI Bridge & OpenHarmony Host
 */

import { StateManager } from '../../../src/bridge/state_manager';
import { ViewNode } from '../../../src/bridge/ui_bridge';

describe('StateManager', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager();
  });

  describe('initial state', () => {
    it('should start with version 0 and null root', () => {
      const state = stateManager.getState();
      expect(state.version).toBe(0);
      expect(state.root).toBeNull();
    });
  });

  describe('setRootView', () => {
    it('should set root view and increment version', () => {
      const viewNode: ViewNode = {
        viewRef: 1,
        viewType: 'TextView',
        properties: new Map([['text', 'Hello World']]),
        children: [],
        parent: null,
        arkuiId: 'view_1'
      };

      stateManager.setRootView(viewNode);

      const state = stateManager.getState();
      expect(state.version).toBe(1);
      expect(state.root).not.toBeNull();
      expect(state.root!.type).toBe('TextView');
      expect(state.root!.props['text']).toBe('Hello World');
    });

    it('should serialize view tree correctly', () => {
      const childNode: ViewNode = {
        viewRef: 2,
        viewType: 'TextView',
        properties: new Map([['text', 'Child']]),
        children: [],
        parent: null,
        arkuiId: 'view_2'
      };

      const parentNode: ViewNode = {
        viewRef: 1,
        viewType: 'ViewGroup',
        properties: new Map(),
        children: [childNode],
        parent: null,
        arkuiId: 'view_1'
      };

      stateManager.setRootView(parentNode);

      const state = stateManager.getState();
      expect(state.root).not.toBeNull();
      expect(state.root!.type).toBe('ViewGroup');
      expect(state.root!.children).toHaveLength(1);
      expect(state.root!.children[0].type).toBe('TextView');
      expect(state.root!.children[0].props['text']).toBe('Child');
    });

    it('should call all subscribers', () => {
      const viewNode: ViewNode = {
        viewRef: 1,
        viewType: 'TextView',
        properties: new Map(),
        children: [],
        parent: null,
        arkuiId: 'view_1'
      };

      let callback1Called = false;
      let callback2Called = false;

      stateManager.subscribe(() => {
        callback1Called = true;
      });
      stateManager.subscribe(() => {
        callback2Called = true;
      });

      stateManager.setRootView(viewNode);

      expect(callback1Called).toBe(true);
      expect(callback2Called).toBe(true);
    });

    it('should increment version on each call', () => {
      const viewNode: ViewNode = {
        viewRef: 1,
        viewType: 'TextView',
        properties: new Map(),
        children: [],
        parent: null,
        arkuiId: 'view_1'
      };

      expect(stateManager.getState().version).toBe(0);

      stateManager.setRootView(viewNode);
      expect(stateManager.getState().version).toBe(1);

      stateManager.setRootView(viewNode);
      expect(stateManager.getState().version).toBe(2);
    });
  });

  describe('notifyUpdate', () => {
    it('should increment version', () => {
      expect(stateManager.getState().version).toBe(0);

      stateManager.notifyUpdate();
      expect(stateManager.getState().version).toBe(1);

      stateManager.notifyUpdate();
      expect(stateManager.getState().version).toBe(2);
    });

    it('should call all subscribers', () => {
      let callCount1 = 0;
      let callCount2 = 0;

      stateManager.subscribe(() => {
        callCount1++;
      });
      stateManager.subscribe(() => {
        callCount2++;
      });

      stateManager.notifyUpdate();
      expect(callCount1).toBe(1);
      expect(callCount2).toBe(1);

      stateManager.notifyUpdate();
      expect(callCount1).toBe(2);
      expect(callCount2).toBe(2);
    });

    it('should not modify root view', () => {
      const viewNode: ViewNode = {
        viewRef: 1,
        viewType: 'TextView',
        properties: new Map([['text', 'Hello']]),
        children: [],
        parent: null,
        arkuiId: 'view_1'
      };

      stateManager.setRootView(viewNode);
      const rootBefore = stateManager.getState().root;

      stateManager.notifyUpdate();
      const rootAfter = stateManager.getState().root;

      expect(rootAfter).toEqual(rootBefore);
    });
  });

  describe('subscribe/unsubscribe', () => {
    it('should add callback to subscribers', () => {
      let called = false;
      const callback = () => {
        called = true;
      };

      stateManager.subscribe(callback);
      stateManager.notifyUpdate();

      expect(called).toBe(true);
    });

    it('should remove callback from subscribers', () => {
      let callCount = 0;
      const callback = () => {
        callCount++;
      };

      stateManager.subscribe(callback);
      stateManager.notifyUpdate();
      expect(callCount).toBe(1);

      stateManager.unsubscribe(callback);
      stateManager.notifyUpdate();
      expect(callCount).toBe(1); // Should not increment
    });

    it('should handle multiple subscribers', () => {
      const callbacks: (() => void)[] = [];
      const callCounts: number[] = [];

      for (let i = 0; i < 5; i++) {
        callCounts.push(0);
        const callback = ((index: number) => () => {
          callCounts[index]++;
        })(i);
        callbacks.push(callback);
        stateManager.subscribe(callback);
      }

      stateManager.notifyUpdate();
      expect(callCounts).toEqual([1, 1, 1, 1, 1]);

      stateManager.unsubscribe(callbacks[2]);
      stateManager.notifyUpdate();
      expect(callCounts).toEqual([2, 2, 1, 2, 2]);
    });

    it('should handle callback errors gracefully', () => {
      let goodCallbackCalled = false;

      stateManager.subscribe(() => {
        throw new Error('Test error');
      });
      stateManager.subscribe(() => {
        goodCallbackCalled = true;
      });

      // Should not throw
      expect(() => stateManager.notifyUpdate()).not.toThrow();
      expect(goodCallbackCalled).toBe(true);
    });
  });

  describe('clear', () => {
    it('should reset state to initial', () => {
      const viewNode: ViewNode = {
        viewRef: 1,
        viewType: 'TextView',
        properties: new Map([['text', 'Hello']]),
        children: [],
        parent: null,
        arkuiId: 'view_1'
      };

      stateManager.setRootView(viewNode);
      stateManager.notifyUpdate();
      stateManager.notifyUpdate();

      expect(stateManager.getState().version).toBe(3);
      expect(stateManager.getState().root).not.toBeNull();

      stateManager.clear();

      const state = stateManager.getState();
      expect(state.version).toBe(0);
      expect(state.root).toBeNull();
    });

    it('should notify subscribers', () => {
      let notified = false;
      stateManager.subscribe(() => {
        notified = true;
      });

      stateManager.clear();

      expect(notified).toBe(true);
    });
  });

  describe('serialization', () => {
    it('should serialize empty properties', () => {
      const viewNode: ViewNode = {
        viewRef: 1,
        viewType: 'TextView',
        properties: new Map(),
        children: [],
        parent: null,
        arkuiId: 'view_1'
      };

      stateManager.setRootView(viewNode);

      const state = stateManager.getState();
      expect(state.root!.props).toEqual({});
    });

    it('should serialize various property types', () => {
      const propsMap = new Map<string, any>();
      propsMap.set('text', 'Hello World');
      propsMap.set('textSize', 16);
      propsMap.set('textColor', 0xFF000000);
      propsMap.set('visible', true);
      propsMap.set('data', { foo: 'bar' });

      const viewNode: ViewNode = {
        viewRef: 1,
        viewType: 'TextView',
        properties: propsMap,
        children: [],
        parent: null,
        arkuiId: 'view_1'
      };

      stateManager.setRootView(viewNode);

      const state = stateManager.getState();
      expect(state.root!.props['text']).toBe('Hello World');
      expect(state.root!.props['textSize']).toBe(16);
      expect(state.root!.props['textColor']).toBe(0xFF000000);
      expect(state.root!.props['visible']).toBe(true);
      expect(state.root!.props['data']).toEqual({ foo: 'bar' });
    });

    it('should serialize nested children', () => {
      const grandChild: ViewNode = {
        viewRef: 3,
        viewType: 'TextView',
        properties: new Map([['text', 'GrandChild']]),
        children: [],
        parent: null,
        arkuiId: 'view_3'
      };

      const child: ViewNode = {
        viewRef: 2,
        viewType: 'ViewGroup',
        properties: new Map(),
        children: [grandChild],
        parent: null,
        arkuiId: 'view_2'
      };

      const root: ViewNode = {
        viewRef: 1,
        viewType: 'ViewGroup',
        properties: new Map(),
        children: [child],
        parent: null,
        arkuiId: 'view_1'
      };

      stateManager.setRootView(root);

      const state = stateManager.getState();
      expect(state.root!.children).toHaveLength(1);
      expect(state.root!.children[0].children).toHaveLength(1);
      expect(state.root!.children[0].children[0].props['text']).toBe('GrandChild');
    });
  });
});
