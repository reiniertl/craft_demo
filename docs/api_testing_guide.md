# CRAFT API Testing Guide

**Date:** 2026-03-09
**Scope:** Testing plan and procedures for all mapped Android APIs in CRAFT

---

## Overview

CRAFT currently maps **14 Android/Java classes (76 methods)** plus a **3-component bridge layer**. This guide covers how to test every mapped API at three levels:

1. **Unit tests** — Individual shim method correctness
2. **Integration tests** — Multi-component workflows (Activity lifecycle, layouts, click handling)
3. **Device/emulator tests** — Visual rendering and interaction on OpenHarmony

---

## 1. Mapped API Inventory

### 1.1 Java Standard Library (5 classes, 32 methods)

| Class | Methods | Test File |
|-------|---------|-----------|
| `java.lang.Object` | `<init>`, `getClass`, `hashCode`, `equals`, `toString` | `test/unit/shim/java_lang.test.ts` |
| `java.lang.String` | `<init>`×2, `length`, `charAt`, `equals`, `hashCode`, `toString`, `substring`×2, `concat`, `valueOf`×3 | `test/unit/shim/java_lang.test.ts` |
| `java.lang.StringBuilder` | `<init>`×2, `append`×4, `toString`, `length` | `test/unit/shim/java_lang.test.ts` |
| `java.lang.Class` | `getName`, `getSimpleName`, `toString` | `test/unit/shim/java_lang.test.ts` |
| `java.lang.System` | `currentTimeMillis`, `identityHashCode`, `arraycopy` | `test/unit/shim/java_lang.test.ts` |

### 1.2 Android Framework (9 classes, 44 methods)

| Class | Methods | UI Bridge | Test File |
|-------|---------|-----------|-----------|
| `android.os.Bundle` | `<init>`, `putString`, `getString`, `containsKey` | No | `test/unit/shim/android_api.test.ts` |
| `android.content.Context` | `<init>`, `getApplicationContext` | No | `test/unit/shim/android_api.test.ts` |
| `android.content.ContextWrapper` | `<init>`×2, `getBaseContext`, `getApplicationContext` | No | `test/unit/shim/android_api.test.ts` |
| `android.view.View` | `<init>`, `setId`, `getId`, `setVisibility`, `getVisibility`, `getContext`, `setOnClickListener`, `performClick` | Yes | `test/unit/shim/android_api.test.ts` |
| `android.view.ViewGroup` | `<init>`, `addView`, `getChildCount` | Yes | `test/unit/shim/android_api.test.ts` |
| `android.widget.TextView` | `<init>`, `setText`, `getText`, `setTextSize`, `setTextColor` | Yes | `test/unit/shim/android_api.test.ts` |
| `android.widget.LinearLayout` | `<init>`, `setOrientation`, `getOrientation` | Yes | `test/unit/shim/linear_layout.test.ts` |
| `android.widget.Button` | `<init>` (inherits TextView/View) | Yes | `test/unit/shim/button.test.ts` |
| `android.app.Activity` | `<init>`, `onCreate`, `onStart`, `onResume`, `onPause`, `onStop`, `onDestroy`, `setContentView`, `findViewById`, `finish`, `getIntent` | Yes | `test/unit/shim/android_api.test.ts` |

### 1.3 Bridge Layer (3 components)

| Component | Purpose | Test File |
|-----------|---------|-----------|
| `UIBridge` | View → ViewNode tree, property updates, click dispatch | `test/unit/bridge/ui_bridge.test.ts` |
| `StateManager` | Reactive `@State` re-renders via version counter | `test/unit/bridge/state_manager.test.ts` |
| `LifecycleBridge` | OH Ability → Android Activity lifecycle mapping | `test/unit/bridge/lifecycle_bridge.test.ts` |

---

## 2. Running Tests

### 2.1 Full Test Suite

```bash
npm test
```

### 2.2 Component-Filtered Tests

```bash
npm run craft-test -- --component shim       # All shim tests
npm run craft-test -- --component bridge     # All bridge tests
npm run craft-test -- --component integration # All integration tests
```

### 2.3 Individual Test Files

```bash
npx jest test/unit/shim/java_lang.test.ts
npx jest test/unit/shim/android_api.test.ts
npx jest test/unit/shim/button.test.ts
npx jest test/integration/android/
```

### 2.4 Regression Guard

After any code change, run the full regression guard:

```bash
npm run guard
```

This checks: TypeScript compilation, all tests, shim consistency, and opcode coverage.

---

## 3. Unit Test Coverage

### 3.1 java.lang.String Edge Cases

File: `test/unit/shim/java_lang_string_extended.test.ts`

Tests added for:
- `charAt` with negative index (throws `StringIndexOutOfBoundsException`)
- `substring` with equal start/end (returns empty string)
- `substring` full string (start=0)
- `concat` with empty strings (both sides)
- `hashCode` consistency across calls and equal strings
- `hashCode` empty string (returns 0)
- `valueOf(Object)` with null input (returns "null")
- `valueOf(I)` with zero and negative values
- `equals` against non-String object (returns false)
- `length` on empty string (returns 0)

### 3.2 Bridge Layer Stress Tests

File: `test/unit/bridge/bridge_stress.test.ts`

Tests added for:
- UIBridge: Register 100 views, verify all unique IDs
- UIBridge: Property update throughput (100 rapid updates)
- StateManager: Version monotonicity under rapid updates
- StateManager: Subscriber notification count accuracy
- LifecycleBridge: Full lifecycle cycle (create → resume → pause → resume → pause → destroy)
- LifecycleBridge: Double-destroy safety

---

## 4. Integration Test Coverage

### 4.1 Calculator App Simulation

File: `test/integration/android/calculator_simulation.test.ts`

Simulates `com.example.calculator.MainActivity.onCreate()` using shim-level calls:

| Test | Validates |
|------|-----------|
| Layout structure | Vertical root + display + 4 horizontal rows |
| Display widget | TextView with "0", 32sp, black |
| Button grid | 16 buttons with correct labels and IDs |
| Button hierarchy | Each row is a horizontal LinearLayout with 4 Button children |
| Click → digit | Tapping "5" updates display to "5" |
| Click → operator → equals | 5 + 3 = 8 arithmetic sequence |
| Clear button | Resets display to "0" |

### 4.2 Clock App Simulation

File: `test/integration/android/clock_simulation.test.ts`

Simulates `com.example.clock.MainActivity.onCreate()` using shim-level calls:

| Test | Validates |
|------|-----------|
| Time computation | `System.currentTimeMillis()` returns valid long |
| Long arithmetic | Division, modulo for hours/minutes/seconds extraction |
| Zero-padding | Minutes and seconds < 10 get leading "0" |
| Time format | Output matches `H:MM:SS` or `HH:MM:SS` pattern |
| View properties | TextView with 48sp size, black color |
| setContentView | Content view stored on Activity |

### 4.3 Cross-Component Interaction

File: `test/integration/bridge/cross_component.test.ts`

| Test | Validates |
|------|-----------|
| Click → state → render | Button click updates text, UIBridge notifies, StateManager bumps version |
| View hierarchy traversal | Nested LinearLayout with children, verify parent refs and child ordering |
| Activity with complex layout | Activity → setContentView(LinearLayout → nested ViewGroups) |
| State serialization of deep tree | 3-level deep ViewNode tree serializes correctly |

---

## 5. Device & Emulator Testing

### 5.1 SDK Configuration

DevEco Studio 6.0.1 manages two separate SDK types:

| SDK Type | Purpose | Your Installation |
|----------|---------|-------------------|
| **OpenHarmony** | Open-source SDK for building apps | API 12 at `C:\Users\Bluezone1\AppData\Local\OpenHarmony\Sdk\` |
| **HarmonyOS** | Huawei commercial SDK (superset) | Bundled with DevEco Studio |

The CRAFT project uses **OpenHarmony API 12** (`runtimeOS: "OpenHarmony"`, `compileSdkVersion: 12`
in `src/oh/build-profile.json5`).

To view/change SDK settings: **File > Settings** → search for **SDK** in the left panel. This shows
a list of installed SDK versions (no tabs).

### 5.2 Emulator Setup

The DevEco Studio emulator uses **HarmonyOS** system images (separate from the OpenHarmony SDK).
OpenHarmony apps are compatible with HarmonyOS devices/emulators since HarmonyOS is a superset.

**Emulator location:**
```
C:\Program Files\Huawei\DevEco Studio\tools\emulator\Emulator.exe (v6.0.1.200)
```

**Requirements:**
- **Windows 10/11 (64-bit)** with **Hyper-V enabled** (bare-metal, not inside a VM)
- **8 GB RAM minimum** (12 GB recommended)
- System image downloaded for the desired device type

**System images** are stored at:
```
C:\Users\<user>\AppData\Local\Huawei\Sdk\system-image\HarmonyOS-6.0.1\
```

Each device type (phone, wearable, tablet, etc.) requires its own system image. Only device
types with a downloaded system image appear in the Device Manager's "New Emulator" dialog.

#### Downloading a Phone System Image

The phone system image is **not** managed through the OpenHarmony SDK settings. To download it:

1. Open DevEco Studio → **Tools > Device Manager**
2. Go to the **Local Emulator** tab
3. Click **New Emulator** — if the phone profile is unavailable, the system image
   needs to be downloaded first
4. DevEco Studio should prompt to download the missing image, or provide a link
   to the SDK Manager download page
5. Alternatively, check **File > Settings** → search for **SDK** and look for a
   **HarmonyOS** entry (separate from your OpenHarmony SDK) where system image
   components can be selected

> **Current state:** Only the wearable system image (`wearable_ov_x86`) is installed.
> The phone image (e.g., `phone_ov_x86`) is needed for phone emulation.
>
> If you cannot find the phone system image download option, you may need to sign in
> to a Huawei developer account in DevEco Studio, as some system images require
> authentication to download.

#### Creating an Emulator Instance

Once the system image is downloaded:

1. Go to **Tools > Device Manager > Local Emulator** tab
2. Click **New Emulator**
3. Select the desired device profile (e.g., **Huawei_Phone**)
4. Keep defaults (4096 MB RAM, 6144 MB data disk)
5. Click **Finish**
6. Click the **Play** button to launch (first boot is slower)

### 5.3 Real Device (Recommended)

If you have a HarmonyOS/OpenHarmony device, you can skip the emulator entirely.
This is often simpler than configuring the emulator.

1. **Enable developer mode** on the device:
   - Go to **Settings > About** and tap the build number multiple times
   - Enable **USB debugging** in Developer Options
2. **Connect via USB** and authorize the connection on the device
3. **Verify the device is detected:**
   ```bash
   hdc list targets
   ```
4. **Deploy** using DevEco Studio or `hdc` commands (see section 5.4)

### 5.4 Deploying CRAFT HAP

**Option A: From DevEco Studio**
- Open `src/oh/` as a project in DevEco Studio
- Select the device/emulator as target in the toolbar
- Press **Shift+F10** to build and deploy

**Option B: From command line**
```bash
# Verify device/emulator is visible
hdc list targets

# Install the HAP (use your target's address)
hdc -t <target> app install src/oh/entry/build/default/outputs/default/entry-default-signed.hap
```

### 5.5 Testing APKs on Device/Emulator

Push APK files to the device, then launch CRAFT with the APK path:

```bash
# Push APK to device filesystem
hdc file send test/fixtures/hello_world.apk /data/app/hello_world.apk

# Launch CRAFT with the APK
hdc shell aa start -a EntryAbility -b com.craft.runtime --ps apk_path /data/app/hello_world.apk
```

### 5.6 Test Matrix

| Test | Command | Expected Result |
|------|---------|-----------------|
| HAP installs | `hdc app install *.hap` | No errors |
| Hello World | Launch with `hello_world.apk` | "Hello World" text at 24sp, black |
| Calculator | Launch with `calculator.apk` | Display + 4x4 button grid |
| Calculator clicks | Tap buttons | Display updates with computed values |
| Clock | Launch with `clock.apk` | Time in `HH:MM:SS` format |
| Lifecycle | Press Home, return | `onPause`/`onResume` fire correctly |
| Error handling | Invalid APK path | Graceful error, no crash |

### 5.7 CLI Reference

```bash
# Emulator management
"C:\Program Files\Huawei\DevEco Studio\tools\emulator\Emulator.exe" -list       # List emulators
"C:\Program Files\Huawei\DevEco Studio\tools\emulator\Emulator.exe" -hvd <name> # Start emulator
"C:\Program Files\Huawei\DevEco Studio\tools\emulator\Emulator.exe" -stop <name> # Stop emulator

# hdc commands (works with both emulator and real device)
hdc list targets                         # List connected devices
hdc -t <target> app install <hap>        # Install HAP
hdc file send <local> <remote>           # Push file
hdc file recv <remote>                   # Pull file
hdc shell screencap -p <path>            # Screenshot
hdc hilog                                # System logs
```

### 5.8 Emulator vs Real Device

| Aspect | Emulator | Real Device |
|--------|----------|-------------|
| Architecture | x86_64 (Hyper-V) | ARM64 |
| CRAFT compatibility | Fully equivalent (pure TypeScript) | Fully equivalent |
| ArkUI rendering | Identical behavior | Identical behavior |
| Touch input | Mouse click simulation | Native touch |
| Sensors | Simulated only | Full hardware |
| Performance | Host-dependent | Native |

Since CRAFT is a pure TypeScript/ArkTS interpreter with no native code, both the emulator
and real devices are **fully equivalent** for all CRAFT testing scenarios.

---

## 6. API Gap Analysis

### 6.1 High-Priority Missing APIs

| Priority | Class | Reason | Effort |
|----------|-------|--------|--------|
| 1 | `java.lang.Math` | Calculator needs it; maps to JS `Math` | Low |
| 2 | `java.lang.Integer` | Numeric boxing used everywhere | Low |
| 3 | `java.lang.Long` | Long boxing for time APIs | Low |
| 4 | `java.lang.Float/Double` | Float boxing for UI dimensions | Low |
| 5 | `java.lang.Boolean` | Conditional logic in apps | Low |
| 6 | `Activity.findViewById` | Currently stubbed; needed for real apps | Medium |
| 7 | `java.util.ArrayList` | Most common collection in Android | Medium |
| 8 | `java.util.HashMap` | Key-value storage, universal | Medium |
| 9 | Exception types | NPE, IAE, ISE, IOOBE, CCE | Low |

### 6.2 Coverage Statistics

**Total: 650 tests (647 passing, 3 pre-existing fixture mismatches)**

| Category | Classes | Methods | Test Count |
|----------|---------|---------|------------|
| java.lang.* (core) | 5 | 32 | 20 |
| java.lang.String (extended) | 1 | 13 | 30 |
| android.* (unit) | 9 | 44 | 55 |
| Bridge layer (unit) | 3 | ~20 | 45 |
| Bridge stress tests | 3 | — | 17 |
| Calculator simulation | — | — | 14 |
| Clock simulation | — | — | 14 |
| Cross-component | — | — | 10 |
| Other integration | — | — | ~60 |
| Parser/interpreter | — | — | ~385 |

See `docs/api_mapping_report.md` for the full Android API surface analysis.

---

## 7. Adding New API Tests

### 7.1 Unit Test Pattern

Use the shared test context from `test/helpers/shim_test_utils.ts`:

```typescript
import { createShimTestContext, ShimTestContext } from '../../helpers/shim_test_utils';
import { intValue, objectRef, NULL_VALUE } from '../../../src/core/types';

describe('MyNewShim', () => {
  let ctx: ShimTestContext;

  beforeEach(() => {
    ctx = createShimTestContext({ javaLang: true, android: true });
  });

  it('method does X', () => {
    const ref = ctx.heap.allocate('Lmy/Class;');
    const result = ctx.invokeShim('Lmy/Class;', 'method', '()I', [objectRef(ref)]);
    expect(result).toEqual(intValue(42));
  });
});
```

### 7.2 Integration Test Pattern (with UIBridge)

For tests that need UIBridge integration, wire up manually:

```typescript
import { Heap } from '../../../src/interpreter/heap';
import { ShimRegistry } from '../../../src/interpreter/shim_registry';
import { UIBridge } from '../../../src/bridge/ui_bridge';
import { StateManager } from '../../../src/bridge/state_manager';
import { registerJavaLangShims } from '../../../src/shim/java/lang/index';
import { registerAndroidShims } from '../../../src/shim/android/index';

beforeEach(() => {
  heap = new Heap();
  stateManager = new StateManager();
  uiBridge = new UIBridge(heap, stateManager);
  registry = new ShimRegistry();
  registerJavaLangShims(registry);
  registerAndroidShims(registry, uiBridge);
  // ... set up mockInterp and invokeShim helper
});
```

### 7.3 Shim Workflow

To add a new Android API shim with tests:

```bash
# 1. Generate shim scaffold
npm run gen-shim android.widget.ImageView

# 2. Implement the shim in src/shim/android/widget/image_view.ts

# 3. Register in src/shim/android/index.ts

# 4. Write tests in test/unit/shim/image_view.test.ts

# 5. Sync to OH copy
npm run sync-oh

# 6. Verify no regressions
npm run guard
```
