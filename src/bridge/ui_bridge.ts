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
    this.stateManager.notifyUpdate();
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
    this.stateManager.notifyUpdate();
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
   * Clear all views (for cleanup/reset)
   */
  clear(): void {
    this.viewMap.clear();
    this.rootView = null;
    this.stateManager.clear();
  }
}
