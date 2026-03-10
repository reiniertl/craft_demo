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
  viewType: string;             // 'TextView', 'ViewGroup', 'Button', 'LinearLayout'
  properties: Map<string, string | number | boolean>; // text, textSize, textColor, visibility, etc.
  children: ViewNode[];         // Child views (for ViewGroup)
  parent: ViewNode | null;      // Parent view
  arkuiId: string;              // Unique ID for ArkUI component
}

/**
 * UIBridge maps Android Views to ArkUI components
 *
 * Integration points:
 * - View shim constructors call registerView()
 * - TextView shim calls updateViewProperty() in setText/setTextSize/setTextColor
 * - Activity shim calls setRootView() in setContentView()
 * - ViewGroup shim calls addChildView() in addView()
 * - View shim calls setClickCallback() in setOnClickListener()
 */
export class UIBridge {
  private heap: Heap;
  private stateManager: StateManager;
  private viewMap: Map<number, ViewNode> = new Map();
  private clickCallbacks: Map<number, () => void> = new Map();
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
   * @param viewType View type name (e.g., 'TextView', 'Button', 'LinearLayout')
   */
  registerView(viewRef: number, viewType: string): void {
    if (this.viewMap.has(viewRef)) {
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
   */
  updateViewProperty(viewRef: number, property: string, value: string | number | boolean): void {
    const node = this.viewMap.get(viewRef);
    if (!node) {
      return;
    }

    node.properties.set(property, value);
    // Re-serialize tree so ArkUI sees the updated property
    if (this.rootView) {
      this.stateManager.setRootView(this.rootView);
    } else {
      this.stateManager.notifyUpdate();
    }
  }

  /**
   * Set click callback for a view (called by setOnClickListener shim)
   * @param viewRef Heap reference to the View object
   * @param callback Function to invoke on click
   */
  setClickCallback(viewRef: number, callback: () => void): void {
    this.clickCallbacks.set(viewRef, callback);
    console.info(`[CRAFT][UIBridge] setClickCallback: viewRef=${viewRef}, total=${this.clickCallbacks.size}`);
  }

  /**
   * Dispatch a click event to a view (entry point for ArkUI)
   * @param viewRef Heap reference to the View object
   * @returns true if a click handler was invoked
   */
  dispatchClick(viewRef: number): boolean {
    console.info(`[CRAFT][UIBridge] dispatchClick: viewRef=${viewRef}, has=${this.clickCallbacks.has(viewRef)}, keys=[${Array.from(this.clickCallbacks.keys()).join(',')}]`);
    const callback = this.clickCallbacks.get(viewRef);
    if (callback) {
      try {
        callback();
        return true;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error && error.stack ? error.stack : '';
        console.error(`[CRAFT][UIBridge] dispatchClick callback error: ${msg}`);
        console.error(`[CRAFT][UIBridge] stack: ${stack}`);
        throw error; // Re-throw so CraftPage catches it
      }
    }
    return false;
  }

  /**
   * Set content view (called by Activity.setContentView)
   */
  setRootView(viewRef: number): void {
    const node = this.viewMap.get(viewRef);
    if (!node) {
      return;
    }

    this.rootView = node;
    this.stateManager.setRootView(node);
  }

  /**
   * Add child to parent (called by ViewGroup.addView)
   */
  addChildView(parentRef: number, childRef: number): void {
    const parent = this.viewMap.get(parentRef);
    const child = this.viewMap.get(childRef);

    if (!parent || !child) {
      return;
    }

    child.parent = parent;
    parent.children.push(child);
    // Re-serialize tree so ArkUI sees the new child
    if (this.rootView) {
      this.stateManager.setRootView(this.rootView);
    } else {
      this.stateManager.notifyUpdate();
    }
  }

  /**
   * Get root view node
   */
  getRootView(): ViewNode | null {
    return this.rootView;
  }

  /**
   * Get view node by heap reference
   */
  getViewNode(viewRef: number): ViewNode | null {
    return this.viewMap.get(viewRef) || null;
  }

  /**
   * Check if a view has a click handler
   */
  hasClickCallback(viewRef: number): boolean {
    return this.clickCallbacks.has(viewRef);
  }

  /**
   * Get StateManager instance
   */
  getStateManager(): StateManager {
    return this.stateManager;
  }

  /**
   * Schedule a timer callback (used by View.postDelayed / View.post)
   * @param viewRef Heap reference to the View that posted the timer
   * @param runnableRef Heap reference to the Runnable object
   * @param callback Function to invoke when timer fires
   * @param delayMs Delay in milliseconds
   */
  scheduleTimer(viewRef: number, runnableRef: number, callback: () => void, delayMs: number): void {
    const timer: PendingTimer = {
      viewRef,
      runnableRef,
      callback,
      fireAt: Date.now() + delayMs,
    };
    this.pendingTimers.push(timer);
    this.startPolling();
  }

  /**
   * Cancel all timers for a specific Runnable on a specific View
   * (used by View.removeCallbacks)
   */
  cancelTimersForRunnable(viewRef: number, runnableRef: number): void {
    this.pendingTimers = this.pendingTimers.filter(
      (t: PendingTimer): boolean => !(t.viewRef === viewRef && t.runnableRef === runnableRef)
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
    this.pollingHandle = setInterval((): void => { this.processPendingTimers(); }, 50) as unknown as number;
  }

  private stopPolling(): void {
    if (this.pollingHandle !== -1) {
      clearInterval(this.pollingHandle);
      this.pollingHandle = -1;
    }
  }

  private processPendingTimers(): void {
    const now: number = Date.now();
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
        const msg: string = e instanceof Error ? e.message : String(e);
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
    this.clickCallbacks.clear();
    this.rootView = null;
    this.stateManager.clear();
  }
}
