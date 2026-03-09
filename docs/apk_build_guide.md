# Android APK Build Guide for CRAFT

**Purpose:** Build demo APKs for CRAFT testing and deployment

**Status:** Three demo apps available (HelloWorld + Calculator + Clock)

---

## Demo Apps

CRAFT ships three demo apps. Sources live in `demo/`, built APKs go to `test/fixtures/`.

### HelloWorld (`demo/hello_world/`)

Simple app that creates a TextView with "Hello World". Tests the basic Activity → TextView → setContentView flow.

- Package: `com.example.helloworld`
- API usage: Activity, Bundle, TextView (setText, setTextSize, setTextColor), setContentView

### Calculator (`demo/calculator/`)

Calculator app with a 4x4 button grid, display, and arithmetic operations. Tests LinearLayout, Button, View.OnClickListener, and complex view hierarchies.

- Package: `com.example.calculator`
- API usage: Activity, Bundle, LinearLayout, TextView, Button, View.OnClickListener, setContentView

### Clock (`demo/clock/`)

Clock app that reads `System.currentTimeMillis()`, computes hours/minutes/seconds via long arithmetic, and displays the formatted time. Tests `System.currentTimeMillis`, `StringBuilder.append(J)`, long division/modulo opcodes, and conditional branching.

- Package: `com.example.clock`
- API usage: Activity, Bundle, TextView (setText, setTextSize, setTextColor), System.currentTimeMillis, StringBuilder.append(long), setContentView

---

## Building with build_apk.bat (Recommended)

The `build_apk.bat` script in the project root handles the full build pipeline: compile → DEX → AAPT2 → STORE repack → align → sign.

### Prerequisites

- Android Studio (bundled JDK at `jbr\`)
- Android SDK (build-tools + platform)
- 7-Zip (https://7-zip.org/)

### Usage

```cmd
build_apk.bat                 :: builds hello_world (default)
build_apk.bat hello_world     :: builds hello_world
build_apk.bat calculator      :: builds calculator
build_apk.bat clock           :: builds clock
build_apk.bat all             :: builds all demo apps
```

Output: `test\fixtures\<app_name>.apk`

### Configuration

Edit the paths at the top of `build_apk.bat` to match your system:

```bat
set ANDROID_SDK=C:\Users\YourName\AppData\Local\Android\Sdk
set BUILD_TOOLS=%ANDROID_SDK%\build-tools\36.1.0
set PLATFORM_JAR=%ANDROID_SDK%\platforms\android-36.1\android.jar
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set SEVENZIP=C:\Program Files\7-Zip\7z.exe
```

### What It Does

1. Copies source from `demo\<app_name>\` to a temp work directory
2. Compiles Java to class files with `javac`
3. Converts to DEX bytecode with `d8`
4. Creates base APK with `aapt2` (produces binary manifest)
5. Repacks with 7-Zip using STORE compression (no DEFLATE — required by CRAFT parser)
6. Aligns with `zipalign`
7. Signs with `apksigner` (debug key)
8. Copies to `test\fixtures\<app_name>.apk`

### STORE Compression

The APK is built with STORE compression (no DEFLATE) because the CRAFT parser only supports uncompressed ZIP entries. The manifest includes `uses-sdk` with `minSdkVersion=24` and `targetSdkVersion=33` so the APK can also be tested on a real Android device.

---

## Building with Android Studio

1. Create New Project (Empty Activity, Java, package matching the demo app)
2. Replace `MainActivity.java` with content from `demo/<app_name>/MainActivity.java`
3. Replace `AndroidManifest.xml` with content from `demo/<app_name>/AndroidManifest.xml`
4. Build → Build Bundle(s) / APK(s) → Build APK(s)
5. Copy to `test/fixtures/<app_name>.apk`

**Note:** Android Studio builds use DEFLATE compression by default. For CRAFT testing, use `build_apk.bat` which forces STORE compression.

---

## Verification

After building an APK:

```bash
npm run analyze-apk test/fixtures/hello_world.apk
npm run analyze-apk test/fixtures/calculator.apk
npm run analyze-apk test/fixtures/clock.apk
```

### Expected: HelloWorld

```
Package: com.example.helloworld
Main Activity: com.example.helloworld.MainActivity

Android API Usage:
  Landroid/app/Activity;       - onCreate, setContentView
  Landroid/widget/TextView;    - <init>, setText, setTextSize, setTextColor
  Landroid/os/Bundle;
```

### Expected: Calculator

```
Package: com.example.calculator
Main Activity: com.example.calculator.MainActivity

Android API Usage:
  Landroid/app/Activity;            - onCreate, setContentView
  Landroid/widget/LinearLayout;     - <init>, setOrientation, addView
  Landroid/widget/TextView;         - <init>, setText, setTextSize, setTextColor
  Landroid/widget/Button;           - <init>, setText, setId, setOnClickListener
  Landroid/view/View;               - getId, OnClickListener
  Landroid/os/Bundle;
```

### Expected: Clock

```
Package: com.example.clock
Main Activity: com.example.clock.MainActivity

Android API Usage:
  Landroid/app/Activity;       - onCreate, setContentView
  Landroid/widget/TextView;    - <init>, setText, setTextSize, setTextColor
  Ljava/lang/System;           - currentTimeMillis
  Ljava/lang/StringBuilder;    - <init>, append (String, J), toString
  Landroid/os/Bundle;
```

---

## Testing on Android Device

```bash
adb install test/fixtures/hello_world.apk
adb shell am start -n com.example.helloworld/.MainActivity

adb install test/fixtures/calculator.apk
adb shell am start -n com.example.calculator/.MainActivity

adb install test/fixtures/clock.apk
adb shell am start -n com.example.clock/.MainActivity
```

---

## Deploying to OpenHarmony via CRAFT

The default bundled app is `hello_world.apk`. To use the calculator:

```bash
# Copy to device
hdc file send test/fixtures/calculator.apk /data/app/calculator.apk

# Launch with custom path
hdc shell aa start -a EntryAbility -b com.craft.runtime --ps apk_path /data/app/calculator.apk
```

---

## Troubleshooting

### Issue: "d8 not found"
Install Android SDK build tools: `sdkmanager "build-tools;36.1.0"`

### Issue: "android.jar not found"
Install Android platform: `sdkmanager "platforms;android-36"`

### Issue: "javac: command not found"
Ensure JAVA_HOME points to a valid JDK (Android Studio bundles one at `jbr\`).

### Issue: APK install fails on OpenHarmony
APKs built for Android won't install on OpenHarmony. They're only used as input for the CRAFT runtime.

---

**Last Updated:** 2026-03-09
**Status:** Three demo apps ready, requires Android SDK for compilation
