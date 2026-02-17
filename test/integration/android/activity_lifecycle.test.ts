/**
 * Integration tests for Android Activity lifecycle (Stage 3).
 * Tests the full sequence: Activity creation → onCreate → TextView → setContentView.
 */

import { ShimRegistry } from '../../../src/interpreter/shim_registry';
import { Heap } from '../../../src/interpreter/heap';
import { Value, intValue, objectRef, NULL_VALUE } from '../../../src/core/types';
import { createShimTestContext, ShimTestContext } from '../../helpers/shim_test_utils';

describe('Activity lifecycle integration', () => {
  let registry: ShimRegistry;
  let heap: Heap;
  let invokeShim: ShimTestContext['invokeShim'];

  beforeEach(() => {
    const ctx = createShimTestContext({ javaLang: true, android: true });
    registry = ctx.registry;
    heap = ctx.heap;
    invokeShim = ctx.invokeShim;
  });

  it('creates Activity, calls onCreate with null Bundle, verifies initialized state', () => {
    const activityRef = heap.allocate('Landroid/app/Activity;');
    invokeShim('Landroid/app/Activity;', '<init>', '()V', [objectRef(activityRef)]);

    // Verify constructor set up initial fields
    expect(heap.getField(activityRef, 'mContentView').type).toBe('null');
    expect(heap.getField(activityRef, 'mFinished')).toEqual(intValue(0));

    // Call onCreate(null) - base Activity no-op
    const result = invokeShim('Landroid/app/Activity;', 'onCreate', '(Landroid/os/Bundle;)V', [
      objectRef(activityRef), NULL_VALUE,
    ]);
    expect(result.type).toBe('null');

    // Verify state unchanged after onCreate (no side effects in base impl)
    expect(heap.getField(activityRef, 'mContentView').type).toBe('null');
    expect(heap.getField(activityRef, 'mFinished')).toEqual(intValue(0));
  });

  it('creates TextView, sets text, calls setContentView', () => {
    // Create Activity
    const activityRef = heap.allocate('Landroid/app/Activity;');
    invokeShim('Landroid/app/Activity;', '<init>', '()V', [objectRef(activityRef)]);

    // Create TextView with Activity as context
    const tvRef = heap.allocate('Landroid/widget/TextView;');
    invokeShim('Landroid/widget/TextView;', '<init>', '(Landroid/content/Context;)V', [
      objectRef(tvRef), objectRef(activityRef),
    ]);

    // Set text
    const textRef = heap.internString('Hello World');
    invokeShim('Landroid/widget/TextView;', 'setText', '(Ljava/lang/CharSequence;)V', [
      objectRef(tvRef), objectRef(textRef),
    ]);

    // Verify text
    const getText = invokeShim('Landroid/widget/TextView;', 'getText', '()Ljava/lang/CharSequence;', [
      objectRef(tvRef),
    ]);
    expect(getText.type).toBe('object');
    expect(heap.getStringValue((getText as { type: 'object'; ref: number }).ref)).toBe('Hello World');

    // setContentView
    invokeShim('Landroid/app/Activity;', 'setContentView', '(Landroid/view/View;)V', [
      objectRef(activityRef), objectRef(tvRef),
    ]);

    // Verify content view stored
    const contentView = heap.getField(activityRef, 'mContentView');
    expect(contentView).toEqual(objectRef(tvRef));
  });

  it('full Hello World sequence: Activity.onCreate -> new TextView -> setText -> setContentView', () => {
    // This simulates what the Hello World APK's MainActivity.onCreate() does:
    //   super.onCreate(savedInstanceState);
    //   TextView textView = new TextView(this);
    //   textView.setText("Hello World");
    //   setContentView(textView);

    // 1. Create Activity (simulates new-instance + invoke-direct <init>)
    const activityRef = heap.allocate('Landroid/app/Activity;');
    invokeShim('Landroid/app/Activity;', '<init>', '()V', [objectRef(activityRef)]);

    // 2. super.onCreate(null) — lands in Activity.onCreate shim
    invokeShim('Landroid/app/Activity;', 'onCreate', '(Landroid/os/Bundle;)V', [
      objectRef(activityRef), NULL_VALUE,
    ]);

    // 3. new TextView(this)
    const tvRef = heap.allocate('Landroid/widget/TextView;');
    invokeShim('Landroid/widget/TextView;', '<init>', '(Landroid/content/Context;)V', [
      objectRef(tvRef), objectRef(activityRef),
    ]);

    // 4. textView.setText("Hello World")
    const helloRef = heap.internString('Hello World');
    invokeShim('Landroid/widget/TextView;', 'setText', '(Ljava/lang/CharSequence;)V', [
      objectRef(tvRef), objectRef(helloRef),
    ]);

    // 5. setContentView(textView)
    invokeShim('Landroid/app/Activity;', 'setContentView', '(Landroid/view/View;)V', [
      objectRef(activityRef), objectRef(tvRef),
    ]);

    // Verify final state
    const contentView = heap.getField(activityRef, 'mContentView');
    expect(contentView.type).toBe('object');
    expect((contentView as { type: 'object'; ref: number }).ref).toBe(tvRef);

    const text = heap.getField(tvRef, 'mText');
    expect(text.type).toBe('object');
    expect(heap.getStringValue((text as { type: 'object'; ref: number }).ref)).toBe('Hello World');

    // Verify TextView has correct context
    const ctx = heap.getField(tvRef, 'mContext');
    expect(ctx).toEqual(objectRef(activityRef));
  });
});

describe('ClassLoader superclass chain for Android shims', () => {
  // Import ClassLoader to verify superclass resolution
  const { ClassLoader } = require('../../../src/interpreter/class_loader');
  const { DexParser } = require('../../../src/parser/dex_parser');
  const { initializeShimRegistry } = require('../../../src/interpreter/shim_init');

  it('Activity superclass chain resolves correctly: Activity -> ContextWrapper -> Context -> Object', () => {
    // Create a minimal DEX (empty but valid header)
    const dexData = new Uint8Array(112);
    // DEX magic: "dex\n035\0"
    dexData.set([0x64, 0x65, 0x78, 0x0a, 0x30, 0x33, 0x35, 0x00], 0);
    // Endian tag at offset 40
    dexData[40] = 0x78; dexData[41] = 0x56; dexData[42] = 0x34; dexData[43] = 0x12;
    // Header size at offset 36 = 112
    dexData[36] = 0x70;
    // File size at offset 32 = 112
    dexData[32] = 0x70;

    const heap = new Heap();
    const shimRegistry = initializeShimRegistry();
    const dex = new DexParser(dexData);
    const classLoader = new ClassLoader(dex, heap, shimRegistry);

    // Load Activity - should recursively load its superclass chain
    const activityClass = classLoader.loadClass('Landroid/app/Activity;');
    expect(activityClass.superClass).toBe('Landroid/content/ContextWrapper;');

    const wrapperClass = classLoader.loadClass('Landroid/content/ContextWrapper;');
    expect(wrapperClass.superClass).toBe('Landroid/content/Context;');

    const contextClass = classLoader.loadClass('Landroid/content/Context;');
    expect(contextClass.superClass).toBe('Ljava/lang/Object;');

    const objectClass = classLoader.loadClass('Ljava/lang/Object;');
    expect(objectClass.superClass).toBeNull();
  });

  it('TextView superclass chain resolves correctly: TextView -> View -> Object', () => {
    const dexData = new Uint8Array(112);
    dexData.set([0x64, 0x65, 0x78, 0x0a, 0x30, 0x33, 0x35, 0x00], 0);
    dexData[40] = 0x78; dexData[41] = 0x56; dexData[42] = 0x34; dexData[43] = 0x12;
    dexData[36] = 0x70;
    dexData[32] = 0x70;

    const heap = new Heap();
    const shimRegistry = initializeShimRegistry();
    const dex = new DexParser(dexData);
    const classLoader = new ClassLoader(dex, heap, shimRegistry);

    const tvClass = classLoader.loadClass('Landroid/widget/TextView;');
    expect(tvClass.superClass).toBe('Landroid/view/View;');

    const viewClass = classLoader.loadClass('Landroid/view/View;');
    expect(viewClass.superClass).toBe('Ljava/lang/Object;');
  });

  it('ViewGroup superclass chain resolves correctly: ViewGroup -> View -> Object', () => {
    const dexData = new Uint8Array(112);
    dexData.set([0x64, 0x65, 0x78, 0x0a, 0x30, 0x33, 0x35, 0x00], 0);
    dexData[40] = 0x78; dexData[41] = 0x56; dexData[42] = 0x34; dexData[43] = 0x12;
    dexData[36] = 0x70;
    dexData[32] = 0x70;

    const heap = new Heap();
    const shimRegistry = initializeShimRegistry();
    const dex = new DexParser(dexData);
    const classLoader = new ClassLoader(dex, heap, shimRegistry);

    const vgClass = classLoader.loadClass('Landroid/view/ViewGroup;');
    expect(vgClass.superClass).toBe('Landroid/view/View;');
  });
});
