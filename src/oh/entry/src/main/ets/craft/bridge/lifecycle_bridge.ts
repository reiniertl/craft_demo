/**
 * CRAFT - Lifecycle Bridge
 * Maps Android Activity lifecycle to OpenHarmony Ability lifecycle
 * Stage 4: UI Bridge & OpenHarmony Host
 */

import { Interpreter } from '../interpreter/interpreter';
import { Heap } from '../interpreter/heap';
import { NULL_VALUE, objectRef } from '../core/types';

/**
 * Lifecycle Mapping:
 *
 * OpenHarmony Ability          Android Activity         Action
 * ─────────────────────        ────────────────        ────────
 * onCreate(want)            →  <init> + onCreate()     Create Activity instance, call onCreate
 * onForeground()            →  onStart() + onResume()  Call onStart, then onResume
 * onBackground()            →  onPause() + onStop()    Call onPause, then onStop
 * onDestroy()               →  onDestroy()             Call onDestroy
 */
export class LifecycleBridge {
  private interpreter: Interpreter;
  private heap: Heap;
  private activityRef: number | null = null;
  private mainClassName: string | null = null;

  constructor(interpreter: Interpreter, heap: Heap) {
    this.interpreter = interpreter;
    this.heap = heap;
  }

  /**
   * Create Activity instance and call onCreate(Bundle)
   * Called by CraftAbility.onCreate()
   *
   * @param mainClass Fully qualified main Activity class name (e.g., 'Lcom/example/MainActivity;')
   * @returns Activity heap reference
   */
  createActivity(mainClass: string): number {
    this.mainClassName = mainClass;

    // Load the class (this will load it from DEX or shim)
    this.interpreter.getClassLoader().loadClass(mainClass);

    // Create Activity instance (allocate on heap)
    this.activityRef = this.heap.allocate(mainClass);

    // Call Activity.<init>()
    this.interpreter.invoke(
      mainClass,
      '<init>',
      '()V',
      [{ type: 'object', ref: this.activityRef }]
    );

    // Call Activity.onCreate(Bundle.EMPTY) — spec A-4 requires a non-null Bundle
    const bundleRef = this.heap.allocate('Landroid/os/Bundle;');
    this.interpreter.invoke(
      'Landroid/os/Bundle;',
      '<init>',
      '()V',
      [objectRef(bundleRef)]
    );
    this.interpreter.invoke(
      mainClass,
      'onCreate',
      '(Landroid/os/Bundle;)V',
      [{ type: 'object', ref: this.activityRef }, objectRef(bundleRef)]
    );

    return this.activityRef;
  }

  /**
   * Resume Activity lifecycle
   * Called by CraftAbility.onForeground()
   *
   * Calls:
   * 1. Activity.onStart()
   * 2. Activity.onResume()
   */
  resumeActivity(): void {
    if (!this.activityRef || !this.mainClassName) {
      console.warn('[CRAFT][LifecycleBridge][WARN] resumeActivity: Activity not created');
      return;
    }

    // Call onStart()
    this.interpreter.invoke(
      this.mainClassName,
      'onStart',
      '()V',
      [{ type: 'object', ref: this.activityRef }]
    );

    // Call onResume()
    this.interpreter.invoke(
      this.mainClassName,
      'onResume',
      '()V',
      [{ type: 'object', ref: this.activityRef }]
    );
  }

  /**
   * Pause Activity lifecycle
   * Called by CraftAbility.onBackground()
   *
   * Calls:
   * 1. Activity.onPause()
   * 2. Activity.onStop()
   */
  pauseActivity(): void {
    if (!this.activityRef || !this.mainClassName) {
      console.warn('[CRAFT][LifecycleBridge][WARN] pauseActivity: Activity not created');
      return;
    }

    // Call onPause()
    this.interpreter.invoke(
      this.mainClassName,
      'onPause',
      '()V',
      [{ type: 'object', ref: this.activityRef }]
    );

    // Call onStop()
    this.interpreter.invoke(
      this.mainClassName,
      'onStop',
      '()V',
      [{ type: 'object', ref: this.activityRef }]
    );
  }

  /**
   * Destroy Activity lifecycle
   * Called by CraftAbility.onDestroy()
   *
   * Calls:
   * 1. Activity.onDestroy()
   */
  destroyActivity(): void {
    if (!this.activityRef || !this.mainClassName) {
      console.warn('[CRAFT][LifecycleBridge][WARN] destroyActivity: Activity not created');
      return;
    }

    // Call onDestroy()
    this.interpreter.invoke(
      this.mainClassName,
      'onDestroy',
      '()V',
      [{ type: 'object', ref: this.activityRef }]
    );

    // Clear references
    this.activityRef = null;
    this.mainClassName = null;
  }

  /**
   * Get current Activity heap reference
   * @returns Activity reference or null if not created
   */
  getActivityRef(): number | null {
    return this.activityRef;
  }

  /**
   * Get main Activity class name
   * @returns Main Activity class name or null if not created
   */
  getMainClassName(): string | null {
    return this.mainClassName;
  }

  /**
   * Check if Activity is created
   * @returns true if Activity is created
   */
  isActivityCreated(): boolean {
    return this.activityRef !== null;
  }
}
