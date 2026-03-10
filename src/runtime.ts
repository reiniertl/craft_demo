/**
 * CRAFT Runtime
 * High-level wrapper combining all CRAFT components
 * Stage 4: UI Bridge & OpenHarmony Host
 */

import { DexParser } from './parser/dex_parser';
import { ManifestParser, ManifestInfo } from './parser/manifest_parser';
import { Heap } from './interpreter/heap';
import { Interpreter } from './interpreter/interpreter';
import { ClassLoader } from './interpreter/class_loader';
import { ShimRegistry } from './interpreter/shim_registry';
import { initializeShimRegistry } from './interpreter/shim_init';
import { UIBridge } from './bridge/ui_bridge';
import { StateManager, ViewState } from './bridge/state_manager';
import { LifecycleBridge } from './bridge/lifecycle_bridge';
import { APKParser, APKContents } from './parser/apk_parser';

/**
 * CraftRuntime integrates all CRAFT components
 *
 * Usage:
 * ```typescript
 * const runtime = new CraftRuntime();
 * await runtime.loadAPK(apkPath);
 * runtime.createActivity('Lcom/example/MainActivity;');
 * runtime.resumeActivity();
 * const state = runtime.getViewState();
 * ```
 */
export class CraftRuntime {
  // Core components
  private heap: Heap;
  private stateManager: StateManager;
  private uiBridge: UIBridge;
  private shimRegistry: ShimRegistry;
  private interpreter: Interpreter | null = null;
  private classLoader: ClassLoader | null = null;
  private lifecycleBridge: LifecycleBridge | null = null;

  // APK data
  private dexParser: DexParser | null = null;
  private manifest: ManifestInfo | null = null;
  private mainActivityClass: string | null = null;

  constructor() {
    // Initialize in correct order
    this.heap = new Heap();
    this.stateManager = new StateManager();
    this.uiBridge = new UIBridge(this.heap, this.stateManager);
    this.shimRegistry = initializeShimRegistry(this.uiBridge);
  }

  /**
   * Load APK from byte array
   * @param apkData APK file bytes
   */
  loadAPK(apkData: Uint8Array): void {
    const parser = new APKParser();
    const apkContents = parser.parse(apkData);
    this.loadAPKContents(apkContents);
  }

  /**
   * Load APK contents (internal)
   * @param apkContents Parsed APK contents
   */
  private loadAPKContents(apkContents: APKContents): void {
    // Parse DEX file
    const dexFiles = Array.from(apkContents.dexFiles.values());
    if (dexFiles.length === 0) {
      throw new Error('No DEX files found in APK');
    }
    this.dexParser = new DexParser(dexFiles[0]);

    // Parse manifest
    const manifestParser = new ManifestParser(apkContents.manifest);
    this.manifest = manifestParser.parse();

    // Convert class name from Java format (com.example.MainActivity)
    // to DEX format (Lcom/example/MainActivity;)
    const javaClassName = this.manifest.mainActivityClass;
    this.mainActivityClass = 'L' + javaClassName.replace(/\./g, '/') + ';';

    // Initialize interpreter components
    this.interpreter = new Interpreter(
      this.dexParser,
      this.heap,
      this.shimRegistry
    );
    this.classLoader = this.interpreter.getClassLoader();
    this.lifecycleBridge = new LifecycleBridge(this.interpreter, this.heap);
  }

  /**
   * Create and initialize Activity
   * Calls Activity.<init>() and Activity.onCreate(null)
   *
   * @param activityClass Activity class name (optional, uses main activity from manifest if not provided)
   * @returns Activity heap reference
   */
  createActivity(activityClass?: string): number {
    if (!this.lifecycleBridge) {
      throw new Error('APK not loaded. Call loadAPK() first.');
    }

    const className = activityClass || this.mainActivityClass;
    if (!className) {
      throw new Error('No Activity class specified and no main activity found in manifest');
    }

    return this.lifecycleBridge.createActivity(className);
  }

  /**
   * Resume Activity lifecycle
   * Calls Activity.onStart() and Activity.onResume()
   */
  resumeActivity(): void {
    if (!this.lifecycleBridge) {
      throw new Error('APK not loaded. Call loadAPK() first.');
    }
    this.lifecycleBridge.resumeActivity();
  }

  /**
   * Pause Activity lifecycle
   * Calls Activity.onPause() and Activity.onStop()
   */
  pauseActivity(): void {
    if (!this.lifecycleBridge) {
      throw new Error('APK not loaded. Call loadAPK() first.');
    }
    this.lifecycleBridge.pauseActivity();
  }

  /**
   * Destroy Activity lifecycle
   * Calls Activity.onDestroy()
   */
  destroyActivity(): void {
    if (!this.lifecycleBridge) {
      throw new Error('APK not loaded. Call loadAPK() first.');
    }
    this.lifecycleBridge.destroyActivity();
  }

  /**
   * Get current view state for ArkUI rendering
   * @returns ViewState
   */
  getViewState(): ViewState {
    return this.stateManager.getState();
  }

  /**
   * Subscribe to view state changes
   * @param callback Function to call on state update
   */
  subscribeToViewUpdates(callback: () => void): void {
    this.stateManager.subscribe(callback);
  }

  /**
   * Unsubscribe from view state changes
   * @param callback Function to remove
   */
  unsubscribeFromViewUpdates(callback: () => void): void {
    this.stateManager.unsubscribe(callback);
  }

  /**
   * Get UIBridge instance
   * @returns UIBridge
   */
  getUIBridge(): UIBridge {
    return this.uiBridge;
  }

  /**
   * Get StateManager instance
   * @returns StateManager
   */
  getStateManager(): StateManager {
    return this.stateManager;
  }

  /**
   * Get LifecycleBridge instance
   * @returns LifecycleBridge or null if APK not loaded
   */
  getLifecycleBridge(): LifecycleBridge | null {
    return this.lifecycleBridge;
  }

  /**
   * Get Interpreter instance
   * @returns Interpreter or null if APK not loaded
   */
  getInterpreter(): Interpreter | null {
    return this.interpreter;
  }

  /**
   * Get Heap instance
   * @returns Heap
   */
  getHeap(): Heap {
    return this.heap;
  }

  /**
   * Get manifest info
   * @returns ManifestInfo or null if APK not loaded
   */
  getManifest(): ManifestInfo | null {
    return this.manifest;
  }

  /**
   * Get main activity class name
   * @returns Main activity class name or null if APK not loaded
   */
  getMainActivityClass(): string | null {
    return this.mainActivityClass;
  }

  /**
   * Shutdown runtime and clean up resources
   */
  shutdown(): void {
    this.uiBridge.clear();
    this.stateManager.clear();
    this.interpreter = null;
    this.classLoader = null;
    this.lifecycleBridge = null;
    this.dexParser = null;
    this.manifest = null;
    this.mainActivityClass = null;
  }
}
