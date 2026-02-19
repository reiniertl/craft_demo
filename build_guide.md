# CRAFT Build & Test Guide: Hello World on OpenHarmony

Step-by-step guide to build, deploy, and test the CRAFT Hello World Android app on an OpenHarmony device.

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **DevEco Studio** | 4.0+ | OpenHarmony IDE and build toolchain |
| **OpenHarmony SDK** | API 10+ | Target platform SDK |
| **hvigorw** | (bundled with DevEco) | HAP build tool |
| **hdc** | (bundled with SDK) | Device communication tool |
| **Node.js** | 18+ | CRAFT TypeScript compilation |
| **Android Studio** | 2024+ | Bundled JDK (no separate Java install needed) |
| **Android SDK** | build-tools + platform | Compile the Hello World APK |
| **7-Zip** | any | Repack APK with STORE compression ([7-zip.org](https://7-zip.org/)) |
| **OpenHarmony device or emulator** | OH 4.0+ | Runtime target |

## Overview

The deployment pipeline has three phases:

```
1. Compile Hello World APK  →  2. Build HAP bundle  →  3. Deploy & run on device
     (Android SDK)              (DevEco / hvigorw)        (hdc)
```

---

## Phase 1: Compile the Hello World APK

The test fixture at `test/fixtures/hello_world.apk` is a Stage 1 stub that only exercises the parser. A complete APK is needed to exercise the full CRAFT stack (interpreter, shims, UI bridge, and rendering).

Source files are already provided in `test/fixtures/`:

- `MainActivity.java` — creates a `TextView`, sets text/size/color, calls `setContentView`
- `AndroidManifest.xml` — declares `com.example.helloworld` with a launcher `MainActivity`

### 1.1 Automated build (recommended)

A batch script automates the entire APK build. Edit the configuration block at the top of `build_apk.bat` to match your system paths, then run:

```cmd
build_apk.bat
```

The script performs all 8 steps automatically:

1. Set up work directory and copy source files
2. Compile Java to class files (`javac` from Android Studio's bundled JDK)
3. Convert to DEX bytecode (`d8` — requires `JAVA_HOME` to be set)
4. Create base APK with binary manifest (`aapt2 link`)
5. Repack APK with STORE compression via 7-Zip (CRAFT does not support DEFLATE)
6. Align (`zipalign`)
7. Sign with debug keystore (`apksigner`)
8. Copy result to `test\fixtures\hello_world.apk`

Before running, open `build_apk.bat` and verify the configuration block at the top:

```
set ANDROID_SDK=C:\Users\<YOU>\AppData\Local\Android\Sdk
set BUILD_TOOLS=%ANDROID_SDK%\build-tools\<VERSION>
set PLATFORM_JAR=%ANDROID_SDK%\platforms\<PLATFORM>\android.jar
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set SEVENZIP=C:\Program Files\7-Zip\7z.exe
```

The script validates all paths before starting and gives clear error messages if anything is missing. To check your installed SDK versions:

```cmd
dir "%LOCALAPPDATA%\Android\Sdk\build-tools"
dir "%LOCALAPPDATA%\Android\Sdk\platforms"
```

### 1.2 Verify the APK

```cmd
cd D:\craft\craft
npm run analyze-apk test/fixtures/hello_world.apk
```

Expected output should show:
- 100% opcode coverage (8/8 opcodes)
- 2 Android API classes detected
- 31 instructions across 2 methods

### 1.3 Optional: Test on a real Android device

The same APK runs on Android (minSdkVersion 24 / Android 7.0+). This is a useful sanity check before deploying through CRAFT on OpenHarmony:

```cmd
adb install D:\tmp\hello_world_apk\hello_world.apk
adb shell am start -n com.example.helloworld/.MainActivity
```

You should see a screen with **"Hello World"** in black text. If it works here, any issues on OpenHarmony are in the CRAFT runtime, not the APK.

---

## Phase 2: Build the HAP Bundle

### 2.1 Copy CRAFT TypeScript modules into the OH project

The OpenHarmony project lives at `src/oh/`. The CRAFT TypeScript modules must be copied into the ETS source tree so hvigor can bundle them.

```bash
cd /mnt/d/craft/craft

# Target directory for CRAFT modules inside the OH project
CRAFT_DIR=src/oh/entry/src/main/ets/craft

mkdir -p $CRAFT_DIR

# Copy core modules
cp -r src/core $CRAFT_DIR/
cp -r src/parser $CRAFT_DIR/
cp -r src/interpreter $CRAFT_DIR/
cp -r src/shim $CRAFT_DIR/
cp -r src/bridge $CRAFT_DIR/
cp src/runtime.ts $CRAFT_DIR/
cp src/index.ts $CRAFT_DIR/
```

### 2.2 Fix the page routing

The page router config must reference `CraftPage`. Edit `src/oh/entry/src/main/resources/base/profile/main_pages.json`:

```json
{
  "src": [
    "pages/CraftPage"
  ]
}
```

### 2.3 Build the HAP

**Option A: Command line (hvigorw)**

```bash
cd /mnt/d/craft/craft/src/oh
hvigorw assembleHap
```

The output HAP will be at:
```
entry/build/default/outputs/default/entry-default-signed.hap
```

**Option B: DevEco Studio**

1. Open the `src/oh/` directory as a project in DevEco Studio.
2. Select **Build > Build Hap(s)/APP(s) > Build Hap(s)**.
3. Find the output HAP in the `entry/build/` directory.

### 2.4 Build for release (optional)

```bash
cd /mnt/d/craft/craft/src/oh
hvigorw assembleHap --mode release
```

> **Note:** Release builds require a signing config in `build-profile.json5`. See the [OpenHarmony signing guide](https://developer.openharmony.cn/develop/signing) for details.

---

## Phase 3: Deploy and Test on Device

### 3.1 Connect the device

```bash
# Verify device is connected
hdc list targets
```

You should see your device serial number. If using an emulator, start it from DevEco Studio first.

### 3.2 Install the HAP

```bash
cd /mnt/d/craft/craft/src/oh
hdc install entry/build/default/outputs/default/entry-default-signed.hap
```

Expected output:
```
install bundle successfully.
```

### 3.3 Push the Hello World APK to the device

```bash
# Create the app data directory on device
hdc shell mkdir -p /data/app

# Push the APK
hdc file send /mnt/d/craft/craft/test/fixtures/hello_world.apk /data/app/hello_world.apk
```

### 3.4 Launch the app

```bash
hdc shell aa start -a EntryAbility -b com.craft.runtime \
  --ps apk_path /data/app/hello_world.apk
```

This tells `EntryAbility` to load the APK from `/data/app/hello_world.apk`. The ability reads the `apk_path` parameter from the Want object and passes it to `CraftRuntime.loadAPKFromPath()`.

### 3.5 Verify the output

You should see on screen:

- **"Hello World"** text rendered by ArkUI
- Font size 24
- Black text color (`#000000`)

### 3.6 View logs

```bash
# All CRAFT logs
hdc hilog -T CRAFT

# Filter by component
hdc hilog -T CRAFT | grep EntryAbility    # Lifecycle events
hdc hilog -T CRAFT | grep CraftPage       # UI rendering
hdc hilog -T CRAFT | grep Runtime         # APK loading
```

Expected log sequence:

```
[CRAFT] EntryAbility onCreate
[CRAFT] Loading APK from /data/app/hello_world.apk
[CRAFT] APK loaded: com.example.helloworld
[CRAFT] Main activity: com.example.helloworld.MainActivity
[CRAFT] Creating activity instance...
[CRAFT] Activity onCreate called
[CRAFT] EntryAbility onForeground
[CRAFT] Activity onStart called
[CRAFT] Activity onResume called
[CRAFT] CraftPage: state updated, version=N
[CRAFT] CraftPage: rendering root view
[CRAFT] CraftPage: rendering TextView id=craft_view_N
```

---

## How It Works End-to-End

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  hello_world │     │    CRAFT     │     │  OpenHarmony │
│     .apk     │────▶│   Runtime    │────▶│    ArkUI     │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                     │
  1. Parse APK         4. Execute DEX        7. Render UI
  2. Parse DEX         5. Shim API calls     8. Display
  3. Parse Manifest    6. Bridge to ArkUI       "Hello World"
```

**Detailed data flow:**

1. `EntryAbility.onCreate()` initializes `CraftRuntime` and loads the APK.
2. `CraftRuntime.loadAPK()` parses the APK (ZIP), extracts `classes.dex` and `AndroidManifest.xml`.
3. The manifest parser identifies the main activity: `com.example.helloworld.MainActivity`.
4. `CraftRuntime.createActivity()` allocates an Activity on the interpreter heap and invokes `onCreate(Bundle)`.
5. Inside `onCreate`, the bytecode interpreter executes Dalvik instructions:
   - `new-instance` → creates a `TextView` (shim allocates on heap, registers with UIBridge)
   - `invoke-virtual TextView.setText("Hello World")` → shim calls `uiBridge.updateViewProperty('text', 'Hello World')`
   - `invoke-virtual TextView.setTextSize(24.0)` → shim calls `uiBridge.updateViewProperty('textSize', 24.0)`
   - `invoke-virtual TextView.setTextColor(0xFF000000)` → shim calls `uiBridge.updateViewProperty('textColor', 0xFF000000)`
   - `invoke-virtual Activity.setContentView(textView)` → shim calls `uiBridge.setRootView(viewRef)`
6. `UIBridge.setRootView()` calls `stateManager.setRootView()`, which serializes the view tree and notifies subscribers.
7. `CraftPage.ets` receives the state update, reads the serialized view tree, and builds ArkUI components:
   - `TextView` → ArkUI `Text("Hello World")` with `.fontSize(24)` and `.fontColor('#000000')`
8. ArkUI renders the text on screen.

---

## Troubleshooting

### APK build fails

| Error | Fix |
|-------|-----|
| `'javac' is not recognized` | Use Android Studio's bundled JDK. Set `JAVA_HOME` to `C:\Program Files\Android\Android Studio\jbr` |
| `JAVA_HOME is not set` (from d8) | Set `JAVA_HOME` in `build_apk.bat` or run `set JAVA_HOME=...` before the command |
| `INSTALL_FAILED_DEPRECATED_SDK_VERSION` | `AndroidManifest.xml` is missing `<uses-sdk>`. Ensure it has `android:minSdkVersion="24" android:targetSdkVersion="33"` |
| `DEFLATE compression not supported` | APK was not repacked with STORE. Rebuild using `build_apk.bat` which uses `7z -mx0` |
| `Invalid output: dex_output` | The `dex_output` directory doesn't exist. The batch script creates it automatically |
| `Unexpected token '-source'` (PowerShell) | Prefix the command with `&` when calling executables with quoted paths in PowerShell |

### HAP build fails

| Error | Fix |
|-------|-----|
| `Cannot find module '@ohos/hvigor-ohos-plugin'` | Run `npm install` in `src/oh/` or open in DevEco Studio to auto-install |
| SDK version mismatch | Ensure OpenHarmony SDK API 10+ is installed in DevEco Studio |
| TypeScript errors in `ets/craft/` | Verify files were copied correctly in Phase 2 Step 2.1 |

### Device connection issues

| Error | Fix |
|-------|-----|
| `[Empty]` from `hdc list targets` | Check USB cable, enable developer mode on device |
| `install failed` | Uninstall previous version: `hdc uninstall com.craft.runtime` |
| Permission denied pushing APK | Use `hdc shell mkdir -p /data/app` first |

### App crashes on launch

| Symptom | Fix |
|---------|-----|
| Blank screen, no logs | Check `main_pages.json` routes to `pages/CraftPage` |
| "APK load failed" in logs | Verify APK was pushed: `hdc shell ls -la /data/app/hello_world.apk` |
| "No main activity" in logs | APK manifest may be malformed — re-run `npm run analyze-apk` |
| "Class not found" in logs | APK uses DEFLATE compression — rebuild with `zip -0` (STORE only) |

### UI not rendering

| Symptom | Fix |
|---------|-----|
| "Loading..." stays forever | Check that `CraftRuntime` was stored in AppStorage (see EntryAbility logs) |
| "Error" state shown | Check hilog for the error message — usually APK loading or interpreter failure |
| "No views" shown | Activity's `setContentView()` was not called — verify APK has correct bytecode |

---

## Running CRAFT Tests (Without a Device)

The full CRAFT test suite runs on any machine with Node.js — no device required.

```bash
cd /mnt/d/craft/craft

# Run all 274 tests
npm test

# Run specific component tests
npm run craft-test -- --component parser       # APK/DEX/Manifest parsing
npm run craft-test -- --component interpreter  # Bytecode execution
npm run craft-test -- --component shim         # Android API shims
npm run craft-test -- --component bridge       # UI Bridge & State

# TypeScript type checking
npx tsc --noEmit

# Full regression guard (types + tests + shims + opcodes)
npm run guard
```

---

## Quick Reference

```bash
# === Build ===
cd /mnt/d/craft/craft/src/oh
hvigorw assembleHap

# === Deploy ===
hdc install entry/build/default/outputs/default/entry-default-signed.hap
hdc file send /mnt/d/craft/craft/test/fixtures/hello_world.apk /data/app/hello_world.apk

# === Launch ===
hdc shell aa start -a EntryAbility -b com.craft.runtime \
  --ps apk_path /data/app/hello_world.apk

# === Logs ===
hdc hilog -T CRAFT

# === Uninstall ===
hdc uninstall com.craft.runtime
```
