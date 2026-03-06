/**
 * CRAFT - UI Bridge
 * Maps Android View objects to ArkUI component tree
 * Stage 4: UI Bridge & OpenHarmony Host
 */

import { Heap } from '../interpreter/heap';
import { StateManager, ViewState } from './state_manager';
import { Value } from '../core/types';

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
   * Clear all views (for cleanup/reset)
   */
  clear(): void {
    this.viewMap.clear();
    this.clickCallbacks.clear();
    this.rootView = null;
    this.stateManager.clear();
  }
}
