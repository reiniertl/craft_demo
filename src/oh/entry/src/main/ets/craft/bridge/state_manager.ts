/**
 * CRAFT - State Manager
 * Reactive state management for ArkUI rendering
 * Stage 4: UI Bridge & OpenHarmony Host
 */

import { ViewNode } from './ui_bridge';

/**
 * Serialized view for ArkUI consumption
 * Simple POJO structure that can be passed to ArkUI @State
 */
export interface SerializedView {
  id: string;
  type: string;
  props: Record<string, any>;
  children: SerializedView[];
}

/**
 * ViewState represents the current UI state
 * Version counter triggers ArkUI re-renders when incremented
 */
export interface ViewState {
  version: number;              // Increment on any change (triggers re-render)
  root: SerializedView | null;  // Serialized view tree
}

/**
 * StateManager manages reactive state for ArkUI
 *
 * Uses observable pattern to notify ArkUI of view changes:
 * 1. Android code calls textView.setText("Hello")
 * 2. TextView shim calls uiBridge.updateViewProperty()
 * 3. UIBridge calls stateManager.notifyUpdate()
 * 4. StateManager increments version and calls all callbacks
 * 5. CraftPage's @State variable updates
 * 6. ArkUI triggers re-render of build() function
 */
export class StateManager {
  private viewState: ViewState = { version: 0, root: null };
  private updateCallbacks: Set<() => void> = new Set();

  /**
   * Set root view and notify observers
   * @param node Root ViewNode
   */
  setRootView(node: ViewNode): void {
    this.viewState = {
      version: this.viewState.version + 1,
      root: this.serializeViewTree(node)
    };
    this.notifyCallbacks();
  }

  /**
   * Notify that a view property changed
   * Increments version counter to trigger re-render
   */
  notifyUpdate(): void {
    this.viewState = {
      ...this.viewState,
      version: this.viewState.version + 1
    };
    this.notifyCallbacks();
  }

  /**
   * Subscribe to state changes (called by CraftPage)
   * @param callback Function to call on state update
   */
  subscribe(callback: () => void): void {
    this.updateCallbacks.add(callback);
  }

  /**
   * Unsubscribe from state changes
   * @param callback Function to remove
   */
  unsubscribe(callback: () => void): void {
    this.updateCallbacks.delete(callback);
  }

  /**
   * Get current state (called by CraftPage)
   * @returns Current ViewState
   */
  getState(): ViewState {
    return this.viewState;
  }

  /**
   * Clear state (for cleanup/reset)
   */
  clear(): void {
    this.viewState = { version: 0, root: null };
    this.notifyCallbacks();
  }

  /**
   * Notify all subscribed callbacks
   * @private
   */
  private notifyCallbacks(): void {
    this.updateCallbacks.forEach(cb => {
      try {
        cb();
      } catch (error) {
        console.error('[CRAFT][StateManager][ERROR] Callback error:', error);
      }
    });
  }

  /**
   * Serialize ViewNode tree to plain object for ArkUI
   * Converts ViewNode with Map properties to POJO with Record properties
   *
   * @param node ViewNode to serialize
   * @returns Serialized view tree
   * @private
   */
  private serializeViewTree(node: ViewNode | null): SerializedView | null {
    if (!node) {
      return null;
    }

    return {
      id: node.arkuiId,
      type: node.viewType,
      props: Object.fromEntries(node.properties),
      children: node.children.map(c => this.serializeViewTree(c)!).filter(Boolean)
    };
  }
}
