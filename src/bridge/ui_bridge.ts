/**
 * CRAFT - UI Bridge
 * Maps Android View objects to ArkUI component tree
 * Stage 4: UI Bridge & OpenHarmony Host
 */

import { Heap } from '../interpreter/heap';
import { StateManager, ViewState } from './state_manager';
import { Value } from '../core/types';

/**
 * PendingTimer represents a scheduled callback in the timer queue.
 * Used by View.postDelayed / View.post to schedule Runnable execution.
 */
export interface PendingTimer {
  viewRef: number;         // Heap reference to the View that posted the timer
  runnableRef: number;     // Heap reference to the Runnable object
  callback: () => void;    // Function to invoke when timer fires
  fireAt: number;          // Date.now() + delayMs
}

/**
 * ViewNode represents a node in the UI tree
 * Maps Android View heap object to ArkUI component
 */
export interface ViewNode {
  viewRef: number;              // Heap reference to Android View object
  viewType: string;             // 'TextView', 'ViewGroup', etc.
  properties: Map<string, any>; // text, textSize, textColor, visibility, etc.
  children: ViewNode[];         // Child views (for ViewGroup)
  parent: ViewNode | null;      // Parent view
  arkuiId: string;              // Unique ID for ArkUI component
}

/**
 * UIBridge maps Android Views to ArkUI components
 *
 * Integration points:
 * - TextView shim calls registerView() in constructor
 * - TextView shim calls updateViewProperty() in setText/setTextSize/setTextColor
 * - Activity shim calls setRootView() in setContentView()
 * - ViewGroup shim calls addChildView() in addView()
 */
export class UIBridge {
  private heap: Heap;
  private stateManager: StateManager;
  private viewMap: Map<number, ViewNode> = new Map();
  private rootView: ViewNode | null = null;
  private pendingTimers: PendingTimer[] = [];
  private pollingHandle: number = -1;

  constructor(heap: Heap, stateManager: StateManager) {
    this.heap = heap;
    this.stateManager = stateManager;
  }

  /**
   * Register a view when created (called by View shim constructor)
   * @param viewRef Heap reference to the View object
   * @param viewType View type name (e.g., 'TextView', 'ViewGroup')
   */
  registerView(viewRef: number, viewType: string): void {
    if (this.viewMap.has(viewRef)) {
      // Already registered, skip
      return;
    }

    const node: ViewNode = {
      viewRef,
      viewType,
      properties: new Map(),
      children: [],
      parent: null,
      arkuiId: `view_${viewRef}`
    };

    this.viewMap.set(viewRef, node);
  }

  /**
   * Update view property (called by setText, setTextColor, etc.)
   * Triggers StateManager notification to re-render ArkUI
   *
   * @param viewRef Heap reference to the View object
   * @param property Property name (e.g., 'text', 'textSize', 'textColor')
   * @param value Property value
   */
  updateViewProperty(viewRef: number, property: string, value: any): void {
    const node = this.viewMap.get(viewRef);
    if (!node) {
      // View not registered, ignore
      return;
    }

    node.properties.set(property, value);
    // Re-serialize tree so the serialized state reflects the updated property
    if (this.rootView) {
      this.stateManager.setRootView(this.rootView);
    } else {
      this.stateManager.notifyUpdate();
    }
  }

  /**
   * Set content view (called by Activity.setContentView)
   * Sets the root view and triggers ArkUI rendering
   *
   * @param viewRef Heap reference to the root View object
   */
  setRootView(viewRef: number): void {
    const node = this.viewMap.get(viewRef);
    if (!node) {
      // View not registered, cannot set as root
      return;
    }

    this.rootView = node;
    this.stateManager.setRootView(node);
  }

  /**
   * Add child to parent (called by ViewGroup.addView)
   * Updates the view tree hierarchy
   *
   * @param parentRef Heap reference to parent ViewGroup
   * @param childRef Heap reference to child View
   */
  addChildView(parentRef: number, childRef: number): void {
    const parent = this.viewMap.get(parentRef);
    const child = this.viewMap.get(childRef);

    if (!parent || !child) {
      // Either parent or child not registered, ignore
      return;
    }

    child.parent = parent;
    parent.children.push(child);
    // Re-serialize tree so the serialized state reflects the new child
    if (this.rootView) {
      this.stateManager.setRootView(this.rootView);
    } else {
      this.stateManager.notifyUpdate();
    }
  }

  /**
   * Get root view node
   * @returns Root ViewNode or null if not set
   */
  getRootView(): ViewNode | null {
    return this.rootView;
  }

  /**
   * Get view node by heap reference
   * @param viewRef Heap reference to the View object
   * @returns ViewNode or null if not found
   */
  getViewNode(viewRef: number): ViewNode | null {
    return this.viewMap.get(viewRef) || null;
  }

  /**
   * Get StateManager instance
   * @returns StateManager
   */
  getStateManager(): StateManager {
    return this.stateManager;
  }

  /**
   * Dispatch a click event to a view (entry point for ArkUI)
   * @param viewRef Heap reference to the View object
   * @returns true if a click handler was invoked
   */
  dispatchClick(viewRef: number): boolean {
    const node = this.viewMap.get(viewRef);
    if (!node) return false;

    const onClick = node.properties.get('onClick');
    if (typeof onClick === 'function') {
      onClick();
      return true;
    }
    return false;
  }

  /**
   * Schedule a timer callback (used by View.postDelayed / View.post)
   * @param viewRef Heap reference to the View that posted the timer
   * @param runnableRef Heap reference to the Runnable object
   * @param callback Function to invoke when timer fires
   * @param delayMs Delay in milliseconds
   */
  scheduleTimer(viewRef: number, runnableRef: number, callback: () => void, delayMs: number): void {
    this.pendingTimers.push({
      viewRef,
      runnableRef,
      callback,
      fireAt: Date.now() + delayMs,
    });
    this.startPolling();
  }

  /**
   * Cancel all timers for a specific Runnable on a specific View
   * (used by View.removeCallbacks)
   */
  cancelTimersForRunnable(viewRef: number, runnableRef: number): void {
    this.pendingTimers = this.pendingTimers.filter(
      (t) => !(t.viewRef === viewRef && t.runnableRef === runnableRef)
    );
    if (this.pendingTimers.length === 0) {
      this.stopPolling();
    }
  }

  /**
   * Cancel all pending timers and stop the polling loop
   */
  cancelAllTimers(): void {
    this.pendingTimers = [];
    this.stopPolling();
  }

  /**
   * Get the number of pending timers (for testing)
   */
  getPendingTimerCount(): number {
    return this.pendingTimers.length;
  }

  private startPolling(): void {
    if (this.pollingHandle !== -1) {
      return; // Already polling
    }
    this.pollingHandle = setInterval(() => this.processPendingTimers(), 50) as unknown as number;
  }

  private stopPolling(): void {
    if (this.pollingHandle !== -1) {
      clearInterval(this.pollingHandle);
      this.pollingHandle = -1;
    }
  }

  private processPendingTimers(): void {
    const now = Date.now();
    const ready: PendingTimer[] = [];
    const remaining: PendingTimer[] = [];

    for (const timer of this.pendingTimers) {
      if (timer.fireAt <= now) {
        ready.push(timer);
      } else {
        remaining.push(timer);
      }
    }

    this.pendingTimers = remaining;

    for (const timer of ready) {
      try {
        timer.callback();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[CRAFT][UIBridge][ERROR] Timer callback failed: ${msg}`);
      }
    }

    if (this.pendingTimers.length === 0) {
      this.stopPolling();
    }
  }

  /**
   * Clear all views (for cleanup/reset)
   */
  clear(): void {
    this.cancelAllTimers();
    this.viewMap.clear();
    this.rootView = null;
    this.stateManager.clear();
  }
}
