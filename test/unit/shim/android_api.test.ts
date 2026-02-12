/**
 * Tests for Android API shim implementations (Stage 3).
 */

import { ShimRegistry, InterpreterRef } from '../../../src/interpreter/shim_registry';
import { Heap } from '../../../src/interpreter/heap';
import { registerJavaLangShims } from '../../../src/shim/java/lang/index';
import { registerAndroidShims } from '../../../src/shim/android/index';
import { Value, intValue, floatValue, objectRef, NULL_VALUE } from '../../../src/core/types';
import { ResolvedMethod } from '../../../src/interpreter/types';

function makeMethod(
  classDesc: string,
  name: string,
  desc: string,
  isStatic: boolean = false
): ResolvedMethod {
  return {
    classDescriptor: classDesc,
    name,
    descriptor: desc,
    accessFlags: isStatic ? 0x0008 : 0,
    code: null,
    isShim: true,
  };
}

describe('Android API shims', () => {
  let registry: ShimRegistry;
  let heap: Heap;
  let mockInterp: InterpreterRef;

  beforeEach(() => {
    registry = new ShimRegistry();
    heap = new Heap();
    registerJavaLangShims(registry);
    registerAndroidShims(registry);

    mockInterp = {
      invoke: (className, methodName, descriptor, args) => {
        const method = makeMethod(className, methodName, descriptor);
        return registry.invoke(method, mockInterp, heap, args);
      },
      getClassLoader: () => ({
        getClassObject: (desc: string) => {
          const ref = heap.allocate('Ljava/lang/Class;');
          heap.setField(ref, '__classDescriptor', {
            type: 'object',
            ref: heap.internString(desc),
          });
          return ref;
        },
      }),
    };
  });

  function invokeShim(
    classDesc: string,
    name: string,
    desc: string,
    args: Value[],
    isStatic: boolean = false
  ): Value {
    const method = makeMethod(classDesc, name, desc, isStatic);
    return registry.invoke(method, mockInterp, heap, args);
  }

  // ─── android.os.Bundle ───

  describe('android.os.Bundle', () => {
    const BUNDLE = 'Landroid/os/Bundle;';

    function createBundle(): number {
      const ref = heap.allocate(BUNDLE);
      invokeShim(BUNDLE, '<init>', '()V', [objectRef(ref)]);
      return ref;
    }

    it('constructor creates empty bundle with no keys', () => {
      const ref = createBundle();
      // Verify bundle is empty by checking a key does not exist
      const keyRef = heap.internString('anyKey');
      const result = invokeShim(BUNDLE, 'containsKey', '(Ljava/lang/String;)Z', [
        objectRef(ref), objectRef(keyRef),
      ]);
      expect((result as { type: 'int'; value: number }).value).toBe(0);
    });

    it('putString stores value', () => {
      const ref = createBundle();
      const keyRef = heap.internString('name');
      const valRef = heap.internString('Alice');
      invokeShim(BUNDLE, 'putString', '(Ljava/lang/String;Ljava/lang/String;)V', [
        objectRef(ref), objectRef(keyRef), objectRef(valRef),
      ]);
      // Verify via getString
      const result = invokeShim(BUNDLE, 'getString', '(Ljava/lang/String;)Ljava/lang/String;', [
        objectRef(ref), objectRef(keyRef),
      ]);
      expect(result.type).toBe('object');
      const strVal = heap.getStringValue((result as { type: 'object'; ref: number }).ref);
      expect(strVal).toBe('Alice');
    });

    it('getString returns null for missing key', () => {
      const ref = createBundle();
      const keyRef = heap.internString('missing');
      const result = invokeShim(BUNDLE, 'getString', '(Ljava/lang/String;)Ljava/lang/String;', [
        objectRef(ref), objectRef(keyRef),
      ]);
      expect(result.type).toBe('null');
    });

    it('containsKey returns correct boolean', () => {
      const ref = createBundle();
      const keyRef = heap.internString('key1');
      const valRef = heap.internString('value1');

      // Before put
      const before = invokeShim(BUNDLE, 'containsKey', '(Ljava/lang/String;)Z', [
        objectRef(ref), objectRef(keyRef),
      ]);
      expect((before as { type: 'int'; value: number }).value).toBe(0);

      // Put and check
      invokeShim(BUNDLE, 'putString', '(Ljava/lang/String;Ljava/lang/String;)V', [
        objectRef(ref), objectRef(keyRef), objectRef(valRef),
      ]);
      const after = invokeShim(BUNDLE, 'containsKey', '(Ljava/lang/String;)Z', [
        objectRef(ref), objectRef(keyRef),
      ]);
      expect((after as { type: 'int'; value: number }).value).toBe(1);
    });
  });

  // ─── android.content.Context ───

  describe('android.content.Context', () => {
    const CONTEXT = 'Landroid/content/Context;';

    it('constructor succeeds', () => {
      const ref = heap.allocate(CONTEXT);
      const result = invokeShim(CONTEXT, '<init>', '()V', [objectRef(ref)]);
      expect(result.type).toBe('null');
    });

    it('getApplicationContext returns self', () => {
      const ref = heap.allocate(CONTEXT);
      invokeShim(CONTEXT, '<init>', '()V', [objectRef(ref)]);
      const result = invokeShim(CONTEXT, 'getApplicationContext', '()Landroid/content/Context;', [
        objectRef(ref),
      ]);
      expect(result).toEqual(objectRef(ref));
    });
  });

  // ─── android.content.ContextWrapper ───

  describe('android.content.ContextWrapper', () => {
    const WRAPPER = 'Landroid/content/ContextWrapper;';
    const CONTEXT = 'Landroid/content/Context;';

    it('constructor stores base context', () => {
      const baseRef = heap.allocate(CONTEXT);
      const wrapperRef = heap.allocate(WRAPPER);
      invokeShim(WRAPPER, '<init>', '(Landroid/content/Context;)V', [
        objectRef(wrapperRef), objectRef(baseRef),
      ]);
      const result = invokeShim(WRAPPER, 'getBaseContext', '()Landroid/content/Context;', [
        objectRef(wrapperRef),
      ]);
      expect(result).toEqual(objectRef(baseRef));
    });

    it('no-arg constructor succeeds', () => {
      const ref = heap.allocate(WRAPPER);
      const result = invokeShim(WRAPPER, '<init>', '()V', [objectRef(ref)]);
      expect(result.type).toBe('null');
    });
  });

  // ─── android.view.View ───

  describe('android.view.View', () => {
    const VIEW = 'Landroid/view/View;';
    const CONTEXT = 'Landroid/content/Context;';

    function createView(): { viewRef: number; contextRef: number } {
      const contextRef = heap.allocate(CONTEXT);
      const viewRef = heap.allocate(VIEW);
      invokeShim(VIEW, '<init>', '(Landroid/content/Context;)V', [
        objectRef(viewRef), objectRef(contextRef),
      ]);
      return { viewRef, contextRef };
    }

    it('constructor stores context', () => {
      const { viewRef, contextRef } = createView();
      const result = invokeShim(VIEW, 'getContext', '()Landroid/content/Context;', [
        objectRef(viewRef),
      ]);
      expect(result).toEqual(objectRef(contextRef));
    });

    it('setId/getId round-trips', () => {
      const { viewRef } = createView();
      invokeShim(VIEW, 'setId', '(I)V', [objectRef(viewRef), intValue(42)]);
      const result = invokeShim(VIEW, 'getId', '()I', [objectRef(viewRef)]);
      expect(result).toEqual(intValue(42));
    });

    it('visibility defaults to VISIBLE (0)', () => {
      const { viewRef } = createView();
      const result = invokeShim(VIEW, 'getVisibility', '()I', [objectRef(viewRef)]);
      expect(result).toEqual(intValue(0));
    });

    it('setVisibility/getVisibility round-trips', () => {
      const { viewRef } = createView();
      invokeShim(VIEW, 'setVisibility', '(I)V', [objectRef(viewRef), intValue(8)]); // GONE
      const result = invokeShim(VIEW, 'getVisibility', '()I', [objectRef(viewRef)]);
      expect(result).toEqual(intValue(8));
    });
  });

  // ─── android.view.ViewGroup ───

  describe('android.view.ViewGroup', () => {
    const VIEW_GROUP = 'Landroid/view/ViewGroup;';
    const VIEW = 'Landroid/view/View;';
    const CONTEXT = 'Landroid/content/Context;';

    it('constructor initializes context and child count', () => {
      const contextRef = heap.allocate(CONTEXT);
      const ref = heap.allocate(VIEW_GROUP);
      invokeShim(VIEW_GROUP, '<init>', '(Landroid/content/Context;)V', [
        objectRef(ref), objectRef(contextRef),
      ]);
      // Verify context stored
      const ctx = heap.getField(ref, 'mContext');
      expect(ctx).toEqual(objectRef(contextRef));
      // Verify starts with 0 children
      const count = invokeShim(VIEW_GROUP, 'getChildCount', '()I', [objectRef(ref)]);
      expect((count as { type: 'int'; value: number }).value).toBe(0);
    });

    it('addView increases child count', () => {
      const contextRef = heap.allocate(CONTEXT);
      const groupRef = heap.allocate(VIEW_GROUP);
      invokeShim(VIEW_GROUP, '<init>', '(Landroid/content/Context;)V', [
        objectRef(groupRef), objectRef(contextRef),
      ]);

      // Initially 0 children
      let count = invokeShim(VIEW_GROUP, 'getChildCount', '()I', [objectRef(groupRef)]);
      expect((count as { type: 'int'; value: number }).value).toBe(0);

      // Add a child
      const childRef = heap.allocate(VIEW);
      invokeShim(VIEW_GROUP, 'addView', '(Landroid/view/View;)V', [
        objectRef(groupRef), objectRef(childRef),
      ]);

      count = invokeShim(VIEW_GROUP, 'getChildCount', '()I', [objectRef(groupRef)]);
      expect((count as { type: 'int'; value: number }).value).toBe(1);
    });
  });

  // ─── android.widget.TextView ───

  describe('android.widget.TextView', () => {
    const TEXTVIEW = 'Landroid/widget/TextView;';
    const CONTEXT = 'Landroid/content/Context;';

    function createTextView(): number {
      const contextRef = heap.allocate(CONTEXT);
      const tvRef = heap.allocate(TEXTVIEW);
      invokeShim(TEXTVIEW, '<init>', '(Landroid/content/Context;)V', [
        objectRef(tvRef), objectRef(contextRef),
      ]);
      return tvRef;
    }

    it('constructor initializes empty text', () => {
      const ref = createTextView();
      const result = invokeShim(TEXTVIEW, 'getText', '()Ljava/lang/CharSequence;', [
        objectRef(ref),
      ]);
      expect(result.type).toBe('null');
    });

    it('setText stores text', () => {
      const ref = createTextView();
      const textRef = heap.internString('Hello World');
      invokeShim(TEXTVIEW, 'setText', '(Ljava/lang/CharSequence;)V', [
        objectRef(ref), objectRef(textRef),
      ]);
      const result = invokeShim(TEXTVIEW, 'getText', '()Ljava/lang/CharSequence;', [
        objectRef(ref),
      ]);
      expect(result.type).toBe('object');
      expect(heap.getStringValue((result as { type: 'object'; ref: number }).ref)).toBe('Hello World');
    });

    it('getText returns stored text', () => {
      const ref = createTextView();
      const textRef = heap.internString('Test');
      invokeShim(TEXTVIEW, 'setText', '(Ljava/lang/CharSequence;)V', [
        objectRef(ref), objectRef(textRef),
      ]);
      const got = invokeShim(TEXTVIEW, 'getText', '()Ljava/lang/CharSequence;', [objectRef(ref)]);
      expect(got.type).toBe('object');
      expect(heap.getStringValue((got as { type: 'object'; ref: number }).ref)).toBe('Test');
    });

    it('setTextSize stores size', () => {
      const ref = createTextView();
      invokeShim(TEXTVIEW, 'setTextSize', '(F)V', [objectRef(ref), floatValue(20.0)]);
      const stored = heap.getField(ref, 'mTextSize');
      expect(stored).toEqual(floatValue(20.0));
    });

    it('setTextColor stores color', () => {
      const ref = createTextView();
      invokeShim(TEXTVIEW, 'setTextColor', '(I)V', [objectRef(ref), intValue(0xFFFF0000)]);
      const stored = heap.getField(ref, 'mTextColor');
      expect((stored as { type: 'int'; value: number }).value).toBe(0xFFFF0000 | 0);
    });
  });

  // ─── android.app.Activity ───

  describe('android.app.Activity', () => {
    const ACTIVITY = 'Landroid/app/Activity;';

    function createActivity(): number {
      const ref = heap.allocate(ACTIVITY);
      invokeShim(ACTIVITY, '<init>', '()V', [objectRef(ref)]);
      return ref;
    }

    it('constructor initializes fields', () => {
      const ref = createActivity();
      // Verify mContentView initialized to null
      const contentView = heap.getField(ref, 'mContentView');
      expect(contentView.type).toBe('null');
      // Verify mFinished initialized to 0
      const finished = heap.getField(ref, 'mFinished');
      expect(finished).toEqual(intValue(0));
    });

    it('onCreate is callable', () => {
      const ref = createActivity();
      const result = invokeShim(ACTIVITY, 'onCreate', '(Landroid/os/Bundle;)V', [
        objectRef(ref), NULL_VALUE,
      ]);
      expect(result.type).toBe('null');
    });

    it('setContentView stores view reference', () => {
      const ref = createActivity();
      const viewRef = heap.allocate('Landroid/widget/TextView;');
      invokeShim(ACTIVITY, 'setContentView', '(Landroid/view/View;)V', [
        objectRef(ref), objectRef(viewRef),
      ]);
      const stored = heap.getField(ref, 'mContentView');
      expect(stored).toEqual(objectRef(viewRef));
    });

    it('lifecycle methods are callable', () => {
      const ref = createActivity();
      expect(invokeShim(ACTIVITY, 'onStart', '()V', [objectRef(ref)]).type).toBe('null');
      expect(invokeShim(ACTIVITY, 'onResume', '()V', [objectRef(ref)]).type).toBe('null');
      expect(invokeShim(ACTIVITY, 'onPause', '()V', [objectRef(ref)]).type).toBe('null');
      expect(invokeShim(ACTIVITY, 'onStop', '()V', [objectRef(ref)]).type).toBe('null');
      expect(invokeShim(ACTIVITY, 'onDestroy', '()V', [objectRef(ref)]).type).toBe('null');
    });

    it('finish sets finished flag', () => {
      const ref = createActivity();
      invokeShim(ACTIVITY, 'finish', '()V', [objectRef(ref)]);
      const finished = heap.getField(ref, 'mFinished');
      expect(finished).toEqual(intValue(1));
    });

    it('findViewById returns null (stub)', () => {
      const ref = createActivity();
      const result = invokeShim(ACTIVITY, 'findViewById', '(I)Landroid/view/View;', [
        objectRef(ref), intValue(1),
      ]);
      expect(result.type).toBe('null');
    });

    it('getIntent returns null (stub)', () => {
      const ref = createActivity();
      const result = invokeShim(ACTIVITY, 'getIntent', '()Landroid/content/Intent;', [
        objectRef(ref),
      ]);
      expect(result.type).toBe('null');
    });
  });

  // ─── Registration verification ───

  describe('shim registration', () => {
    it('unregistered method throws NoSuchMethodError', () => {
      const ref = heap.allocate('Landroid/app/Activity;');
      expect(() => {
        invokeShim('Landroid/app/Activity;', 'nonExistentMethod', '()V', [objectRef(ref)]);
      }).toThrow('No shim for');
    });

    it('all expected Android classes are registered as shim classes', () => {
      const expectedClasses = [
        'Landroid/os/Bundle;',
        'Landroid/content/Context;',
        'Landroid/content/ContextWrapper;',
        'Landroid/app/Activity;',
        'Landroid/view/View;',
        'Landroid/view/ViewGroup;',
        'Landroid/widget/TextView;',
      ];
      for (const cls of expectedClasses) {
        expect(registry.isShimClass(cls)).toBe(true);
      }
    });

    it('non-Android class is not registered', () => {
      expect(registry.isShimClass('Lcom/example/Fake;')).toBe(false);
    });
  });
});
