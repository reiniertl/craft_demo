# CRAFT Deployment Guide

**Project:** CRAFT (Compatibility Runtime for Android Framework Translation)
**Version:** 1.0.0-alpha
**Last Updated:** 2026-02-13

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Building the Android APK](#building-the-android-apk)
3. [Building the OpenHarmony HAP](#building-the-openharmony-hap)
4. [Deploying to Device](#deploying-to-device)
5. [Running the Application](#running-the-application)
6. [Viewing Logs](#viewing-logs)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

1. **DevEco Studio 4.0+**
   - Download from: https://developer.harmonyos.com/deveco-studio
   - Includes OpenHarmony SDK

2. **OpenHarmony SDK API 10+**
   - Installed via DevEco Studio
   - Minimum API level: 10
   - Recommended: API level 11

3. **Android SDK** (for building test APK)
   - Android Studio or command-line tools
   - Target API: 28-33
   - Build tools: 30.0.0+

4. **HDC (HarmonyOS Device Connector)**
   - Included with DevEco Studio
   - Used for device communication

### Required Hardware

- **OpenHarmony Device** OR **OpenHarmony Emulator**
  - OS Version: OpenHarmony 4.0+
  - Architecture: arm64-v8a or x86_64
  - Storage: At least 100MB free

---

## Building the Android APK

### Step 1: Create MainActivity.java

Create a file `MainActivity.java`:

```java
package com.example.helloworld;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        TextView textView = new TextView(this);
        textView.setText("Hello World");
        textView.setTextSize(24.0f);
        textView.setTextColor(0xFF000000);

        setContentView(textView);
    }
}
```

### Step 2: Create AndroidManifest.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.helloworld">

    <application
        android:label="Hello World">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### Step 3: Build APK

Using Android Studio:
1. Create new project with empty Activity
2. Replace MainActivity.java with above code
3. Build → Build Bundle(s) / APK(s) → Build APK(s)
4. Find APK in `app/build/outputs/apk/debug/`

Using Command Line:
```bash
# Set up directory structure
mkdir -p hello_world/src/com/example/helloworld
mkdir -p hello_world/res

# Copy MainActivity.java to src/com/example/helloworld/
# Copy AndroidManifest.xml to hello_world/

# Compile Java to class files
javac -source 1.8 -target 1.8 \
  -bootclasspath $ANDROID_HOME/platforms/android-30/android.jar \
  -d hello_world/bin \
  hello_world/src/com/example/helloworld/MainActivity.java

# Convert class files to DEX
$ANDROID_HOME/build-tools/30.0.0/d8 \
  --lib $ANDROID_HOME/platforms/android-30/android.jar \
  --output hello_world/dex \
  hello_world/bin/com/example/helloworld/*.class

# Package into APK
$ANDROID_HOME/build-tools/30.0.0/aapt package -f \
  -M hello_world/AndroidManifest.xml \
  -I $ANDROID_HOME/platforms/android-30/android.jar \
  -F hello_world/hello_world_unsigned.apk \
  hello_world/dex

# Sign APK (debug key)
jarsigner -keystore ~/.android/debug.keystore \
  -storepass android -keypass android \
  hello_world/hello_world_unsigned.apk androiddebugkey

# Align APK
$ANDROID_HOME/build-tools/30.0.0/zipalign -f 4 \
  hello_world/hello_world_unsigned.apk \
  hello_world/hello_world.apk
```

### Step 4: Verify APK

```bash
cd /mnt/d/craft/craft
cp /path/to/hello_world.apk test/fixtures/hello_world_complete.apk
npm run analyze-apk test/fixtures/hello_world_complete.apk
```

Verify:
- Opcode Coverage: 100%
- Android API Classes: Should include Activity, Context, TextView, Bundle
- No missing opcodes

---

## Building the OpenHarmony HAP

### Step 1: Open Project in DevEco Studio

1. Launch DevEco Studio
2. Open Project: `/mnt/d/craft/craft/src/oh`
3. Wait for Gradle sync to complete

### Step 2: Configure Build

Verify `build-profile.json5`:
```json
{
  "app": {
    "signingConfigs": [],
    "products": [
      {
        "name": "default",
        "signingConfig": "default",
      }
    ]
  },
  "modules": [
    {
      "name": "entry",
      "srcPath": "./entry",
      "targets": [
        {
          "name": "default",
          "applyToProducts": ["default"]
        }
      ]
    }
  ]
}
```

### Step 3: Build HAP

**Option A: Using DevEco Studio**
1. Build → Build Hap(s)/APP(s) → Build Hap(s)
2. Find HAP in `entry/build/default/outputs/default/`

**Option B: Using Command Line**
```bash
cd /mnt/d/craft/craft/src/oh
hvigorw assembleHap --mode module -p module=entry@default
```

Output: `entry/build/default/outputs/default/entry-default-signed.hap`

### Step 4: Verify HAP

```bash
ls -lh entry/build/default/outputs/default/*.hap
# Should see entry-default-signed.hap
```

---

## Deploying to Device

### Step 1: Connect Device

**For Physical Device:**
1. Enable Developer Mode on device
2. Connect via USB
3. Verify connection:
   ```bash
   hdc list targets
   ```

**For Emulator:**
1. Launch emulator from DevEco Studio
2. Wait for boot to complete
3. Verify:
   ```bash
   hdc list targets
   ```

### Step 2: Install HAP

```bash
cd /mnt/d/craft/craft/src/oh
hdc install entry/build/default/outputs/default/entry-default-signed.hap
```

Expected output:
```
[Info] install bundle successfully.
```

If already installed:
```bash
hdc uninstall com.craft.runtime
hdc install entry/build/default/outputs/default/entry-default-signed.hap
```

### Step 3: Push Test APK to Device

```bash
# Create directory
hdc shell mkdir -p /data/app

# Push APK
hdc file send test/fixtures/hello_world_complete.apk /data/app/hello_world.apk

# Verify
hdc shell ls -l /data/app/hello_world.apk
```

---

## Running the Application

### Launch Application

```bash
hdc shell aa start -a EntryAbility -b com.craft.runtime \
  --ps apk_path /data/app/hello_world.apk
```

### Expected Behavior

1. CRAFT Ability launches
2. Logs show:
   - "onCreate"
   - "Loading APK..."
   - "APK loaded successfully"
   - "Creating Activity..."
   - "Activity created"
   - "CraftPage loaded"
   - "Calling Activity.onCreate()..."
   - "Activity.onCreate() complete"

3. Screen displays:
   - "Hello World" text at 24sp, black color

### Stop Application

```bash
hdc shell aa force-stop com.craft.runtime
```

---

## Viewing Logs

### Real-time Log Viewing

```bash
# View all CRAFT logs
hdc hilog -T CRAFT

# View with tag filtering
hdc hilog | grep -E "\[CRAFT\]|\[CraftAbility\]|\[CraftPage\]"
```

### Log Levels

- `[INFO]` - Normal operation
- `[ERROR]` - Errors and exceptions
- `[WARN]` - Warnings (non-critical)

### Key Log Messages

**Successful Launch:**
```
[CRAFT][CraftAbility][INFO] onCreate
[CRAFT][CraftAbility][INFO] APK: /data/app/hello_world.apk
[CRAFT][CraftAbility][INFO] Runtime initialized
[CRAFT][CraftAbility][INFO] onWindowStageCreate
[CRAFT][CraftAbility][INFO] Loading APK...
[CRAFT][APKParser][INFO] APK loaded: 2 files found
[CRAFT][DexParser][INFO] DEX parsed: 1 classes, 4 methods
[CRAFT][CraftAbility][INFO] APK loaded successfully
[CRAFT][CraftAbility][INFO] Creating Activity...
[CRAFT][CraftAbility][INFO] Activity created: ref=1
[CRAFT][CraftAbility][INFO] CraftPage loaded
[CRAFT][CraftPage][INFO] aboutToAppear
[CRAFT][CraftAbility][INFO] Calling Activity.onCreate()...
[CRAFT][Interpreter][INFO] Executing MainActivity.onCreate()
[CRAFT][CraftAbility][INFO] Activity.onCreate() complete
[CRAFT][CraftPage][INFO] State update received
[CRAFT][CraftPage][INFO] Rendering TextView: text="Hello World", size=24
```

**Error Example:**
```
[CRAFT][CraftAbility][ERROR] APK load failed: File not found
```

---

## Troubleshooting

### Issue: HAP Installation Fails

**Symptoms:**
```
[Error] install bundle failed.
```

**Solutions:**
1. Uninstall existing version:
   ```bash
   hdc uninstall com.craft.runtime
   ```

2. Check signing configuration in `build-profile.json5`

3. Clean and rebuild:
   ```bash
   hvigorw clean
   hvigorw assembleHap
   ```

---

### Issue: APK Not Found

**Symptoms:**
```
[CRAFT][CraftAbility][ERROR] APK load failed: File not found
```

**Solutions:**
1. Verify APK path:
   ```bash
   hdc shell ls -l /data/app/hello_world.apk
   ```

2. Re-push APK:
   ```bash
   hdc file send test/fixtures/hello_world_complete.apk /data/app/hello_world.apk
   ```

3. Check file permissions:
   ```bash
   hdc shell chmod 644 /data/app/hello_world.apk
   ```

---

### Issue: Activity Creation Fails

**Symptoms:**
```
[CRAFT][CraftAbility][ERROR] Activity creation failed: Class not found
```

**Solutions:**
1. Verify APK package name matches code:
   - Code expects: `com.example.helloworld.MainActivity`
   - Check AndroidManifest.xml

2. Analyze APK:
   ```bash
   npm run analyze-apk test/fixtures/hello_world_complete.apk --verbose
   ```

3. Verify all opcodes are implemented

---

### Issue: Screen Shows "Loading..." Forever

**Symptoms:**
- Screen stuck on loading state
- No state updates in logs

**Solutions:**
1. Check for errors in hilog:
   ```bash
   hdc hilog | grep ERROR
   ```

2. Verify StateManager subscription:
   ```bash
   hdc hilog | grep "aboutToAppear\|State update"
   ```

3. Check if Activity.onCreate() completed:
   ```bash
   hdc hilog | grep "onCreate() complete"
   ```

---

### Issue: Nothing Renders on Screen

**Symptoms:**
- State update received
- No visual output

**Solutions:**
1. Check TextView properties:
   ```bash
   hdc hilog | grep "Rendering TextView"
   ```

2. Verify text is not empty or transparent

3. Check ArkUI build() method execution

---

### Issue: TypeScript Import Errors

**Symptoms:**
```
Cannot find module '../craft/runtime'
```

**Solutions:**
1. Verify craft directory exists:
   ```bash
   ls /mnt/d/craft/craft/src/oh/entry/src/main/ets/craft/
   ```

2. Re-copy runtime files:
   ```bash
   cd /mnt/d/craft/craft
   cp -r src/core src/oh/entry/src/main/ets/craft/
   cp -r src/parser src/oh/entry/src/main/ets/craft/
   # ... (repeat for all modules)
   ```

3. Clean DevEco Studio cache and rebuild

---

### Issue: Performance is Slow

**Expected Performance:**
- APK load: < 5 seconds
- Activity creation: < 1 second
- UI render: < 500ms
- Total startup: < 10 seconds

**If slower:**
1. Profile with DevEco Profiler
2. Check interpreter performance
3. Optimize hot paths
4. Consider caching frequently used data

---

## Advanced Configuration

### Custom APK Path

```bash
hdc shell aa start -a EntryAbility -b com.craft.runtime \
  --ps apk_path /sdcard/my_app.apk
```

### Debug Mode

Add debug logs by modifying `utils.ts`:
```typescript
export const DEBUG = true;  // Enable verbose logging
```

### Custom Activity Class

Modify `EntryAbility.ets`:
```typescript
this.activityRef = this.runtime.createActivity('com.myapp.MainActivity');
```

---

## Performance Monitoring

### Metrics to Track

1. **APK Load Time:**
   - Measure from "Loading APK..." to "APK loaded successfully"
   - Target: < 5 seconds

2. **Activity Creation Time:**
   - Measure from "Creating Activity..." to "Activity created"
   - Target: < 1 second

3. **UI Render Time:**
   - Measure from "State update received" to "Rendering TextView"
   - Target: < 500ms

4. **Total Startup Time:**
   - Measure from launch to screen display
   - Target: < 10 seconds

### Profiling Tools

1. **DevEco Profiler:**
   - Tools → Profiler
   - Select device and process
   - Monitor CPU, memory, method traces

2. **hilog Timestamps:**
   ```bash
   hdc hilog -v time -T CRAFT
   ```

3. **Performance.now():**
   Add to critical paths in TypeScript code

---

## Cleanup

### Uninstall Application

```bash
hdc uninstall com.craft.runtime
```

### Remove APK from Device

```bash
hdc shell rm /data/app/hello_world.apk
```

### Clear Logs

```bash
hdc hilog -r
```

---

## Next Steps

1. **Test with More Complex APKs:**
   - Multiple TextViews
   - ViewGroup layouts
   - Different text styles

2. **Implement More View Types:**
   - Button
   - EditText
   - ImageView
   - LinearLayout

3. **Optimize Performance:**
   - Method caching
   - Opcode inlining
   - Faster dispatch

4. **Add Error Recovery:**
   - Graceful degradation
   - User-friendly error messages
   - Restart capabilities

---

## Support

For issues or questions:
- Check hilog output for errors
- Review troubleshooting section
- Consult CRAFT documentation in `/docs`
- File issues with log snippets and APK details

---

**Last Updated:** 2026-02-13
**Tested On:** OpenHarmony 4.0 (Emulator)
**Status:** Ready for Deployment Testing

