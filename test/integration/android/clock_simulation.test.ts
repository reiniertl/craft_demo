/**
 * Clock app simulation integration tests.
 * Simulates com.example.clock.MainActivity.onCreate() at the shim level.
 * Validates time computation, formatting, and view construction.
 */

import { ShimRegistry } from '../../../src/interpreter/shim_registry';
import { Heap } from '../../../src/interpreter/heap';
import { Value, intValue, floatValue, longValue, objectRef, NULL_VALUE } from '../../../src/core/types';
import { UIBridge } from '../../../src/bridge/ui_bridge';
import { StateManager } from '../../../src/bridge/state_manager';
import { registerJavaLangShims } from '../../../src/shim/java/lang/index';
import { registerAndroidShims } from '../../../src/shim/android/index';
import { InterpreterRef } from '../../../src/interpreter/shim_registry';

describe('Clock app simulation', () => {
  let registry: ShimRegistry;
  let heap: Heap;
  let uiBridge: UIBridge;
  let stateManager: StateManager;
  let mockInterp: InterpreterRef;
  let invokeShim: (classDesc: string, name: string, desc: string, args: Value[], isStatic?: boolean) => Value;

  const ACTIVITY = 'Landroid/app/Activity;';
  const TEXTVIEW = 'Landroid/widget/TextView;';
  const SYSTEM = 'Ljava/lang/System;';
  const STRING_BUILDER = 'Ljava/lang/StringBuilder;';

  beforeEach(() => {
    heap = new Heap();
    stateManager = new StateManager();
    uiBridge = new UIBridge(heap, stateManager);
    registry = new ShimRegistry();

    mockInterp = {
      invoke: (className: string, methodName: string, descriptor: string, args: Value[]) => {
        const method = {
          classDescriptor: className,
          name: methodName,
          descriptor,
          accessFlags: 0,
          code: null,
          isShim: true,
        };
        return registry.invoke(method as any, mockInterp, heap, args);
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

    registerJavaLangShims(registry);
    registerAndroidShims(registry, uiBridge);

    invokeShim = (classDesc, name, desc, args, isStatic = false) => {
      const method = {
        classDescriptor: classDesc,
        name,
        descriptor: desc,
        accessFlags: isStatic ? 0x0008 : 0,
        code: null,
        isShim: true,
      };
      return registry.invoke(method as any, mockInterp, heap, args);
    };
  });

  /**
   * Simulates the clock's onCreate logic with a specific timestamp,
   * mimicking the Java code's arithmetic and StringBuilder formatting.
   */
  function simulateClockOnCreate(timestampMs: bigint): {
    activityRef: number;
    tvRef: number;
    timeString: string;
  } {
    // Create Activity
    const activityRef = heap.allocate(ACTIVITY);
    invokeShim(ACTIVITY, '<init>', '()V', [objectRef(activityRef)]);
    invokeShim(ACTIVITY, 'onCreate', '(Landroid/os/Bundle;)V', [objectRef(activityRef), NULL_VALUE]);

    // long millis = System.currentTimeMillis()
    // For this test we use a known timestamp
    const millis = timestampMs;

    // long totalSeconds = millis / 1000
    const totalSeconds = millis / BigInt(1000);

    // long hours = (totalSeconds / 3600) % 24
    const hours = (totalSeconds / BigInt(3600)) % BigInt(24);

    // long minutes = (totalSeconds % 3600) / 60
    const minutes = (totalSeconds % BigInt(3600)) / BigInt(60);

    // long seconds = totalSeconds % 60
    const seconds = totalSeconds % BigInt(60);

    // StringBuilder sb = new StringBuilder()
    const sbRef = heap.allocate(STRING_BUILDER);
    invokeShim(STRING_BUILDER, '<init>', '()V', [objectRef(sbRef)]);

    // sb.append(hours)
    invokeShim(STRING_BUILDER, 'append', '(J)Ljava/lang/StringBuilder;', [
      objectRef(sbRef), longValue(hours),
    ]);

    // sb.append(":")
    const colonStr = heap.internString(':');
    invokeShim(STRING_BUILDER, 'append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;', [
      objectRef(sbRef), objectRef(colonStr),
    ]);

    // if (minutes < 10) sb.append("0")
    if (minutes < BigInt(10)) {
      const zeroStr = heap.internString('0');
      invokeShim(STRING_BUILDER, 'append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;', [
        objectRef(sbRef), objectRef(zeroStr),
      ]);
    }

    // sb.append(minutes)
    invokeShim(STRING_BUILDER, 'append', '(J)Ljava/lang/StringBuilder;', [
      objectRef(sbRef), longValue(minutes),
    ]);

    // sb.append(":")
    invokeShim(STRING_BUILDER, 'append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;', [
      objectRef(sbRef), objectRef(colonStr),
    ]);

    // if (seconds < 10) sb.append("0")
    if (seconds < BigInt(10)) {
      const zeroStr = heap.internString('0');
      invokeShim(STRING_BUILDER, 'append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;', [
        objectRef(sbRef), objectRef(zeroStr),
      ]);
    }

    // sb.append(seconds)
    invokeShim(STRING_BUILDER, 'append', '(J)Ljava/lang/StringBuilder;', [
      objectRef(sbRef), longValue(seconds),
    ]);

    // String timeStr = sb.toString()
    const timeResult = invokeShim(STRING_BUILDER, 'toString', '()Ljava/lang/String;', [objectRef(sbRef)]);
    const timeStrRef = (timeResult as { type: 'object'; ref: number }).ref;
    const timeString = heap.getStringValue(timeStrRef);

    // TextView textView = new TextView(this)
    const tvRef = heap.allocate(TEXTVIEW);
    invokeShim(TEXTVIEW, '<init>', '(Landroid/content/Context;)V', [
      objectRef(tvRef), objectRef(activityRef),
    ]);

    // textView.setText(sb.toString())
    invokeShim(TEXTVIEW, 'setText', '(Ljava/lang/CharSequence;)V', [
      objectRef(tvRef), timeResult,
    ]);

    // textView.setTextSize(48.0f)
    invokeShim(TEXTVIEW, 'setTextSize', '(F)V', [objectRef(tvRef), floatValue(48.0)]);

    // textView.setTextColor(0xFF000000)
    invokeShim(TEXTVIEW, 'setTextColor', '(I)V', [objectRef(tvRef), intValue(0xFF000000 | 0)]);

    // setContentView(textView)
    invokeShim(ACTIVITY, 'setContentView', '(Landroid/view/View;)V', [
      objectRef(activityRef), objectRef(tvRef),
    ]);

    return { activityRef, tvRef, timeString };
  }

  // ─── System.currentTimeMillis tests ───

  it('System.currentTimeMillis returns a valid long timestamp', () => {
    const before = BigInt(Date.now());
    const result = invokeShim(SYSTEM, 'currentTimeMillis', '()J', [], true);
    const after = BigInt(Date.now());

    expect(result.type).toBe('long');
    const millis = (result as { type: 'long'; value: bigint }).value;
    expect(millis).toBeGreaterThanOrEqual(before);
    expect(millis).toBeLessThanOrEqual(after);
  });

  // ─── Time formatting tests ───

  it('formats midnight (00:00:00) correctly', () => {
    // Midnight UTC: 0 ms
    const { timeString } = simulateClockOnCreate(BigInt(0));
    expect(timeString).toBe('0:00:00');
  });

  it('formats 1:02:03 correctly with zero-padding', () => {
    // 1h 2m 3s = 3600 + 120 + 3 = 3723 seconds = 3723000 ms
    const { timeString } = simulateClockOnCreate(BigInt(3723000));
    expect(timeString).toBe('1:02:03');
  });

  it('formats 12:30:45 correctly without zero-padding', () => {
    // 12h 30m 45s = 43200 + 1800 + 45 = 45045 seconds = 45045000 ms
    const { timeString } = simulateClockOnCreate(BigInt(45045000));
    expect(timeString).toBe('12:30:45');
  });

  it('formats 23:59:59 correctly', () => {
    // 23h 59m 59s = 82800 + 3540 + 59 = 86399 seconds = 86399000 ms
    const { timeString } = simulateClockOnCreate(BigInt(86399000));
    expect(timeString).toBe('23:59:59');
  });

  it('wraps around after 24 hours (modulo 24)', () => {
    // 25h 5m 10s = 90000 + 300 + 10 = 90310 seconds → 25%24=1, so 1:05:10
    const { timeString } = simulateClockOnCreate(BigInt(90310000));
    expect(timeString).toBe('1:05:10');
  });

  it('zero-pads minutes < 10', () => {
    // 5h 3m 30s = 18000 + 180 + 30 = 18210s
    const { timeString } = simulateClockOnCreate(BigInt(18210000));
    expect(timeString).toBe('5:03:30');
  });

  it('zero-pads seconds < 10', () => {
    // 5h 30m 5s = 18000 + 1800 + 5 = 19805s
    const { timeString } = simulateClockOnCreate(BigInt(19805000));
    expect(timeString).toBe('5:30:05');
  });

  it('matches HH:MM:SS pattern with live timestamp', () => {
    const millis = BigInt(Date.now());
    const { timeString } = simulateClockOnCreate(millis);
    // Pattern: digits:digits:digits, minutes and seconds always 2 digits
    expect(timeString).toMatch(/^\d{1,2}:\d{2}:\d{2}$/);
  });

  // ─── View construction tests ───

  it('creates a single TextView as content view', () => {
    const { activityRef, tvRef } = simulateClockOnCreate(BigInt(45045000));

    const rootNode = uiBridge.getRootView();
    expect(rootNode).not.toBeNull();
    expect(rootNode!.viewType).toBe('TextView');
    expect(rootNode!.viewRef).toBe(tvRef);
  });

  it('TextView has correct text size (48sp)', () => {
    const { tvRef } = simulateClockOnCreate(BigInt(45045000));

    const textSize = heap.getField(tvRef, 'mTextSize');
    expect(textSize).toEqual(floatValue(48.0));
  });

  it('TextView has black text color', () => {
    const { tvRef } = simulateClockOnCreate(BigInt(45045000));

    const textColor = heap.getField(tvRef, 'mTextColor');
    expect((textColor as { type: 'int'; value: number }).value).toBe(0xFF000000 | 0);
  });

  it('setContentView stores the view on Activity', () => {
    const { activityRef, tvRef } = simulateClockOnCreate(BigInt(45045000));

    const contentView = heap.getField(activityRef, 'mContentView');
    expect(contentView).toEqual(objectRef(tvRef));
  });

  it('StateManager has serialized root with time text', () => {
    simulateClockOnCreate(BigInt(45045000));

    const state = stateManager.getState();
    expect(state.root).not.toBeNull();
    expect(state.root!.type).toBe('TextView');
    expect(state.root!.props['text']).toBe('12:30:45');
    expect(state.root!.props['textSize']).toBe(48.0);
  });

  // ─── StringBuilder tests (as used in clock) ───

  it('StringBuilder correctly chains long append and string append', () => {
    const sbRef = heap.allocate(STRING_BUILDER);
    invokeShim(STRING_BUILDER, '<init>', '()V', [objectRef(sbRef)]);

    invokeShim(STRING_BUILDER, 'append', '(J)Ljava/lang/StringBuilder;', [
      objectRef(sbRef), longValue(BigInt(14)),
    ]);
    const sep = heap.internString(':');
    invokeShim(STRING_BUILDER, 'append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;', [
      objectRef(sbRef), objectRef(sep),
    ]);
    const zero = heap.internString('0');
    invokeShim(STRING_BUILDER, 'append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;', [
      objectRef(sbRef), objectRef(zero),
    ]);
    invokeShim(STRING_BUILDER, 'append', '(J)Ljava/lang/StringBuilder;', [
      objectRef(sbRef), longValue(BigInt(5)),
    ]);

    const result = invokeShim(STRING_BUILDER, 'toString', '()Ljava/lang/String;', [objectRef(sbRef)]);
    const strRef = (result as { type: 'object'; ref: number }).ref;
    expect(heap.getStringValue(strRef)).toBe('14:05');
  });
});
