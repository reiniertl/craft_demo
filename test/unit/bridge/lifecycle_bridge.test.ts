/**
 * CRAFT - LifecycleBridge Unit Tests
 * Stage 4: UI Bridge & OpenHarmony Host
 */

import { Heap } from '../../../src/interpreter/heap';
import { Interpreter } from '../../../src/interpreter/interpreter';
import { DexParser } from '../../../src/parser/dex_parser';
import { ClassLoader } from '../../../src/interpreter/class_loader';
import { ShimRegistry } from '../../../src/interpreter/shim_registry';
import { initializeShimRegistry } from '../../../src/interpreter/shim_init';
import { LifecycleBridge } from '../../../src/bridge/lifecycle_bridge';
import { NULL_VALUE } from '../../../src/core/types';
import * as fs from 'fs';
import * as path from 'path';

describe('LifecycleBridge', () => {
  let heap: Heap;
  let dexParser: DexParser;
  let classLoader: ClassLoader;
  let shimRegistry: ShimRegistry;
  let interpreter: Interpreter;
  let lifecycleBridge: LifecycleBridge;

  beforeEach(() => {
    // Load test DEX file
    const dexPath = path.join(__dirname, '../../fixtures/hello_world.dex');
    const dexData = fs.readFileSync(dexPath);
    dexParser = new DexParser(dexData);

    heap = new Heap();
    shimRegistry = initializeShimRegistry();
    interpreter = new Interpreter(dexParser, heap, shimRegistry);
    classLoader = interpreter.getClassLoader();
    lifecycleBridge = new LifecycleBridge(interpreter, heap);
  });

  describe('createActivity', () => {
    it('should create Activity instance and call onCreate', () => {
      const activityRef = lifecycleBridge.createActivity('Lcom/example/hello/MainActivity;');

      expect(activityRef).toBeGreaterThan(0);
      expect(lifecycleBridge.getActivityRef()).toBe(activityRef);
      expect(lifecycleBridge.getMainClassName()).toBe('Lcom/example/hello/MainActivity;');
      expect(lifecycleBridge.isActivityCreated()).toBe(true);
    });

    it('should initialize Activity fields', () => {
      const activityRef = lifecycleBridge.createActivity('Lcom/example/hello/MainActivity;');

      const obj = heap.getObject(activityRef);
      expect(obj).not.toBeNull();
      expect(obj!.classDescriptor).toBe('Lcom/example/hello/MainActivity;');
    });

    it('should store main class name', () => {
      lifecycleBridge.createActivity('Lcom/example/hello/MainActivity;');

      expect(lifecycleBridge.getMainClassName()).toBe('Lcom/example/hello/MainActivity;');
    });
  });

  describe('resumeActivity', () => {
    it('should call onStart and onResume', () => {
      lifecycleBridge.createActivity('Lcom/example/hello/MainActivity;');

      // Should not throw
      expect(() => lifecycleBridge.resumeActivity()).not.toThrow();
    });

    it('should warn if Activity not created', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      lifecycleBridge.resumeActivity();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('resumeActivity: Activity not created')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('pauseActivity', () => {
    it('should call onPause and onStop', () => {
      lifecycleBridge.createActivity('Lcom/example/hello/MainActivity;');

      // Should not throw
      expect(() => lifecycleBridge.pauseActivity()).not.toThrow();
    });

    it('should warn if Activity not created', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      lifecycleBridge.pauseActivity();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('pauseActivity: Activity not created')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('destroyActivity', () => {
    it('should call onDestroy and clear references', () => {
      lifecycleBridge.createActivity('Lcom/example/hello/MainActivity;');

      expect(lifecycleBridge.isActivityCreated()).toBe(true);

      lifecycleBridge.destroyActivity();

      expect(lifecycleBridge.getActivityRef()).toBeNull();
      expect(lifecycleBridge.getMainClassName()).toBeNull();
      expect(lifecycleBridge.isActivityCreated()).toBe(false);
    });

    it('should warn if Activity not created', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      lifecycleBridge.destroyActivity();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('destroyActivity: Activity not created')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('lifecycle sequence', () => {
    it('should handle full lifecycle', () => {
      // Create
      const activityRef = lifecycleBridge.createActivity('Lcom/example/hello/MainActivity;');
      expect(lifecycleBridge.isActivityCreated()).toBe(true);

      // Resume
      lifecycleBridge.resumeActivity();
      expect(lifecycleBridge.isActivityCreated()).toBe(true);

      // Pause
      lifecycleBridge.pauseActivity();
      expect(lifecycleBridge.isActivityCreated()).toBe(true);

      // Resume again
      lifecycleBridge.resumeActivity();
      expect(lifecycleBridge.isActivityCreated()).toBe(true);

      // Destroy
      lifecycleBridge.destroyActivity();
      expect(lifecycleBridge.isActivityCreated()).toBe(false);
    });

    it('should allow creating new Activity after destroy', () => {
      lifecycleBridge.createActivity('Lcom/example/hello/MainActivity;');
      lifecycleBridge.destroyActivity();

      const newActivityRef = lifecycleBridge.createActivity('Lcom/example/hello/MainActivity;');
      expect(newActivityRef).toBeGreaterThan(0);
      expect(lifecycleBridge.isActivityCreated()).toBe(true);
    });
  });

  describe('getters', () => {
    it('should return null before Activity created', () => {
      expect(lifecycleBridge.getActivityRef()).toBeNull();
      expect(lifecycleBridge.getMainClassName()).toBeNull();
      expect(lifecycleBridge.isActivityCreated()).toBe(false);
    });

    it('should return correct values after Activity created', () => {
      const activityRef = lifecycleBridge.createActivity('Lcom/example/hello/MainActivity;');

      expect(lifecycleBridge.getActivityRef()).toBe(activityRef);
      expect(lifecycleBridge.getMainClassName()).toBe('Lcom/example/hello/MainActivity;');
      expect(lifecycleBridge.isActivityCreated()).toBe(true);
    });
  });
});
