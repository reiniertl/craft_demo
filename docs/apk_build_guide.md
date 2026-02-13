# Android APK Build Guide for CRAFT

**Purpose:** Build the completed Hello World APK for CRAFT testing

**Status:** Source files prepared, requires Android SDK for compilation

---

## Important: Stage 1 Stub vs Completed APK

### Current APK (Stage 1 Stub)

The project already has `test/fixtures/hello_world.apk` created in Stage 1. However, this is a **minimal stub** designed only to test the parser:

**What the Stage 1 stub contains:**
- ✅ Basic APK structure
- ✅ MainActivity class
- ✅ onCreate() method signature
- ❌ **Only 7 instructions total** (just calls `super.onCreate()` and returns)
- ❌ **No Android API usage** (no TextView, setText, setContentView)
- ❌ **0 Android API classes** detected by analyzer

**Stage 1 onCreate() code:**
```java
protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // That's all - just a stub!
}
```

### Why Completion is Needed

The Stage 1 stub was intentionally minimal - just enough to test APK parsing and DEX format handling. To test the functionality implemented in Stages 2-5, we need to **complete** the onCreate() implementation:

**Stage 2 (Interpreter):** Needs actual bytecode to interpret
- new-instance, invoke-direct, invoke-virtual opcodes
- Method calls and object creation

**Stage 3 (Android API Shims):** Needs Android API calls to intercept
- TextView constructor, setText(), setTextSize(), setTextColor()
- Activity.setContentView()

**Stage 4 (UI Bridge):** Needs View objects to bridge to ArkUI
- TextView creation and property updates
- setContentView() to register root view

**Stage 5 (Integration):** Needs complete flow to demonstrate end-to-end
- Full Activity lifecycle with actual UI output
- Visual confirmation of "Hello World" on screen

---

## Overview

The CRAFT project requires a properly built Android APK with a **complete** MainActivity that includes:
- `onCreate()` method with `super.onCreate()` call
- `TextView` instantiation
- `setText()`, `setTextSize()`, `setTextColor()` calls
- `setContentView()` call

**Source Files Location:** `/mnt/d/craft/craft/test/fixtures/`
- `MainActivity.java` - Main activity source code
- `AndroidManifest.xml` - Application manifest

**Target Output:** `/mnt/d/craft/craft/test/fixtures/hello_world_complete.apk`

---

## Option 1: Using Android Studio (Easiest)

### Prerequisites
- Android Studio installed (latest version recommended)
- Android SDK API 28 or higher

### Steps

1. **Create New Project:**
   ```
   File → New → New Project
   Select "Empty Activity"
   Name: HelloWorld
   Package: com.example.helloworld
   Language: Java
   Minimum SDK: API 28
   ```

2. **Replace MainActivity.java:**
   - Copy content from `/mnt/d/craft/craft/test/fixtures/MainActivity.java`
   - Paste into `app/src/main/java/com/example/helloworld/MainActivity.java`

3. **Replace AndroidManifest.xml:**
   - Copy content from `/mnt/d/craft/craft/test/fixtures/AndroidManifest.xml`
   - Paste into `app/src/main/AndroidManifest.xml`

4. **Build APK:**
   ```
   Build → Build Bundle(s) / APK(s) → Build APK(s)
   ```

5. **Locate APK:**
   - Find in: `app/build/outputs/apk/debug/app-debug.apk`

6. **Copy to CRAFT:**
   ```bash
   cp app/build/outputs/apk/debug/app-debug.apk \
      /mnt/d/craft/craft/test/fixtures/hello_world_complete.apk
   ```

7. **Verify:**
   ```bash
   cd /mnt/d/craft/craft
   npm run analyze-apk test/fixtures/hello_world_complete.apk
   ```

---

## Option 2: Using Command Line (Advanced)

### Prerequisites
- Android SDK command-line tools installed
- `ANDROID_HOME` environment variable set
- Java JDK 8 or higher

### Build Script

Create `build_apk.sh`:

```bash
#!/bin/bash
set -e

# Configuration
PACKAGE="com.example.helloworld"
APP_NAME="HelloWorld"
BUILD_DIR="build_tmp"
SRC_DIR="test/fixtures"
API_LEVEL="30"

# Paths (adjust for your system)
ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
BUILD_TOOLS="$ANDROID_HOME/build-tools/30.0.0"
PLATFORM="$ANDROID_HOME/platforms/android-$API_LEVEL"

# Check prerequisites
if [ ! -d "$ANDROID_HOME" ]; then
    echo "Error: ANDROID_HOME not found: $ANDROID_HOME"
    exit 1
fi

if [ ! -f "$BUILD_TOOLS/d8" ]; then
    echo "Error: Build tools not found: $BUILD_TOOLS"
    exit 1
fi

echo "Building Hello World APK..."

# Clean
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"/{bin,dex,apk}

# Step 1: Compile Java to class files
echo "1. Compiling Java..."
javac -source 1.8 -target 1.8 \
    -bootclasspath "$PLATFORM/android.jar" \
    -d "$BUILD_DIR/bin" \
    "$SRC_DIR/MainActivity.java"

# Step 2: Convert class files to DEX
echo "2. Converting to DEX..."
"$BUILD_TOOLS/d8" \
    --lib "$PLATFORM/android.jar" \
    --output "$BUILD_DIR/dex" \
    "$BUILD_DIR/bin/com/example/helloworld/MainActivity.class"

# Step 3: Create unsigned APK
echo "3. Packaging APK..."
cd "$BUILD_DIR/apk"
mkdir -p META-INF

# Add DEX file
cp ../dex/classes.dex .

# Add AndroidManifest.xml
cp "../../$SRC_DIR/AndroidManifest.xml" .

# Create ZIP (APK is a ZIP file)
zip -q -r ../unsigned.apk .
cd ../..

# Step 4: Align APK
echo "4. Aligning APK..."
"$BUILD_TOOLS/zipalign" -f -p 4 \
    "$BUILD_DIR/unsigned.apk" \
    "$BUILD_DIR/aligned.apk"

# Step 5: Sign APK (debug key)
echo "5. Signing APK..."
if [ ! -f "$HOME/.android/debug.keystore" ]; then
    echo "Creating debug keystore..."
    keytool -genkey -v \
        -keystore "$HOME/.android/debug.keystore" \
        -alias androiddebugkey \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -storepass android \
        -keypass android \
        -dname "CN=Android Debug,O=Android,C=US"
fi

"$BUILD_TOOLS/apksigner" sign \
    --ks "$HOME/.android/debug.keystore" \
    --ks-key-alias androiddebugkey \
    --ks-pass pass:android \
    --key-pass pass:android \
    --out "$BUILD_DIR/hello_world_complete.apk" \
    "$BUILD_DIR/aligned.apk"

# Step 6: Copy to test fixtures
echo "6. Copying to test fixtures..."
cp "$BUILD_DIR/hello_world_complete.apk" "test/fixtures/"

echo ""
echo "✅ APK built successfully!"
echo "Location: test/fixtures/hello_world_complete.apk"

# Step 7: Verify
echo ""
echo "Verifying APK..."
npm run analyze-apk test/fixtures/hello_world_complete.apk
```

### Usage

```bash
chmod +x build_apk.sh
./build_apk.sh
```

---

## Option 3: Using Gradle (Recommended for CI/CD)

### Create build.gradle

```gradle
plugins {
    id 'com.android.application' version '8.0.0'
}

android {
    namespace 'com.example.helloworld'
    compileSdk 33

    defaultConfig {
        applicationId "com.example.helloworld"
        minSdk 28
        targetSdk 33
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        release {
            minifyEnabled false
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}
```

### Create settings.gradle

```gradle
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "HelloWorld"
include ':app'
```

### Build

```bash
./gradlew assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk \
   test/fixtures/hello_world_complete.apk
```

---

## Option 4: Using Docker (Reproducible Builds)

### Dockerfile

```dockerfile
FROM gradle:7.6-jdk11

# Install Android SDK
ENV ANDROID_HOME=/opt/android-sdk
RUN mkdir -p ${ANDROID_HOME}/cmdline-tools && \
    cd ${ANDROID_HOME}/cmdline-tools && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip && \
    unzip -q commandlinetools-linux-9477386_latest.zip && \
    rm commandlinetools-linux-9477386_latest.zip && \
    mv cmdline-tools latest

ENV PATH=${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools

# Accept licenses and install components
RUN yes | sdkmanager --licenses && \
    sdkmanager "platform-tools" "platforms;android-33" "build-tools;30.0.0"

WORKDIR /app
COPY test/fixtures/MainActivity.java .
COPY test/fixtures/AndroidManifest.xml .

# Build script will go here
```

### Usage

```bash
docker build -t craft-apk-builder .
docker run --rm -v $(pwd)/test/fixtures:/output craft-apk-builder
```

---

## Verification

After building the APK, verify it's correct:

```bash
cd /mnt/d/craft/craft
npm run analyze-apk test/fixtures/hello_world_complete.apk
```

**Expected Output:**
```
🔧 Opcode Coverage:
   Implemented: 100%

📦 APK Information:
   Package: com.example.helloworld
   Main Activity: com.example.helloworld.MainActivity

📱 Android API Usage:
   Landroid/app/Activity;
      - onCreate
      - setContentView
   Landroid/widget/TextView;
      - <init>
      - setText
      - setTextSize
      - setTextColor
   Landroid/os/Bundle;
```

**Required Opcodes:**
All opcodes used must be implemented in CRAFT. Check the output for any missing opcodes.

---

## Troubleshooting

### Issue: "d8 not found"

**Solution:** Install Android SDK build tools:
```bash
sdkmanager "build-tools;30.0.0"
```

### Issue: "android.jar not found"

**Solution:** Install Android platform:
```bash
sdkmanager "platforms;android-30"
```

### Issue: "javac: command not found"

**Solution:** Install Java JDK:
```bash
# Ubuntu/Debian
sudo apt install openjdk-11-jdk

# macOS
brew install openjdk@11

# Windows
# Download from https://adoptium.net/
```

### Issue: APK install fails on OpenHarmony

**Solution:** APKs built for Android won't install on OpenHarmony. They're only used as input for the CRAFT runtime.

---

## Alternative: Download Pre-built APK

If you cannot build the APK locally, you can:

1. **Use an online Android compiler:**
   - https://www.tutorialspoint.com/compile_java_online.php
   - Build and download the APK

2. **Request from team member:**
   - Someone with Android Studio can build and share

3. **Use CI/CD:**
   - Set up GitHub Actions to build automatically

---

## Next Steps

After building the APK:

1. **Place in test fixtures:**
   ```bash
   cp your-built-apk.apk \
      /mnt/d/craft/craft/test/fixtures/hello_world_complete.apk
   ```

2. **Verify with analyzer:**
   ```bash
   npm run analyze-apk test/fixtures/hello_world_complete.apk
   ```

3. **Run tests:**
   ```bash
   npm test
   ```

4. **Deploy to OpenHarmony:**
   - See `docs/deployment_guide.md` for deployment instructions

---

## Summary

Building the completed Hello World APK requires:
- ✅ Source files (provided in `test/fixtures/`)
- ⚠️ Android SDK (not available in current environment)
- ⚠️ Java compiler (not available in current environment)

**Recommended:** Use Android Studio (Option 1) for the easiest build process.

**For CI/CD:** Use Gradle (Option 3) or Docker (Option 4) for reproducible builds.

---

**Last Updated:** 2026-02-13
**Status:** Source files ready, awaiting SDK-based build
