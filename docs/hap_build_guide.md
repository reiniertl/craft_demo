# HAP Build Guide for CRAFT

**Purpose:** Build and deploy the CRAFT runtime as an OpenHarmony or HarmonyOS HAP

**Status:** Build verified working (480KB unsigned HAP)

---

## Overview

The CRAFT HAP bundles the full runtime stack (parser, interpreter, shim layer, UI bridge) into an OpenHarmony/HarmonyOS application package. APKs are kept separate — push any APK to the device via `hdc file send` and pass its path via the `apk_path` launch parameter.

```
CRAFT Source (TypeScript)  →  HAP Bundle  →  Device
     (src/)                   (hvigorw)      (hdc install)
```

### Build Products

| Product | runtimeOS | Target Device | SDK Required |
|---------|-----------|---------------|--------------|
| `default` | OpenHarmony | OH emulator / devices | OpenHarmony SDK |
| `charlotte` | HarmonyOS | Huawei Mate 60 (Kirin) | HarmonyOS SDK |

---

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **DevEco Studio** | 5.0+ (hvigor 6.21.1) | IDE, hvigorw build tool, ohpm package manager |
| **OpenHarmony SDK** | API 12+ (bundled with DevEco) | Target platform SDK (default product) |
| **HarmonyOS SDK** | API 12+ | Target platform SDK (charlotte product) |
| **Node.js** | 18+ | TypeScript compilation |
| **Java** | 17+ (bundled with DevEco as JBR) | HAP packaging |
| **Device or emulator** | OH 5.0+ / HarmonyOS 4.0+ | Runtime target |

### Verify DevEco installation

After installing DevEco Studio, confirm the command-line tools are available:

```cmd
:: Check if ohpm is in PATH (DevEco adds it during install)
ohpm --version

:: If not in PATH, find it in your DevEco installation:
dir "C:\Program Files\Huawei\DevEco Studio\tools\ohpm\bin"
dir "C:\Program Files\Huawei\DevEco Studio\tools\hvigor\bin"

:: Java (bundled as JBR):
"C:\Program Files\Huawei\DevEco Studio\jbr\bin\java.exe" -version
```

---

## Option 1: Automated Build (Recommended)

A batch script automates the entire HAP build. Edit the configuration block at the top of `build_hap.bat` to match your system, then run:

```cmd
:: OpenHarmony (default product)
build_hap.bat

:: HarmonyOS / Charlotte (Mate 60)
build_hap.bat charlotte
```

The script performs 8 steps automatically:

1. Sync CRAFT TypeScript modules into the OH project tree
2. Bundle hello_world.apk into rawfile resources
3. Apply ArkTS compatibility patches (removes `fs`, `TextDecoder`, `any` types)
4. Create placeholder icon resources if missing
5. Validate configuration files (page routing, bundle name)
6. Set up SDK versioned directory structure (symlinks to DevEco SDK)
7. Install OH dependencies (`ohpm install`)
8. Build HAP (`hvigorw assembleHap -p product=<name>`)

### Configuration

Before running, open `build_hap.bat` and verify the configuration block:

```bat
set DEVECO_HOME=C:\Program Files\Huawei\DevEco Studio
set CRAFT_DIR=D:\craft\craft
set SDK_DIR=C:\Users\%USERNAME%\OpenHarmony\Sdk
```

The script auto-detects `ohpm` and `hvigorw` from PATH first, falling back to the DevEco installation directory. Java is automatically found from DevEco's bundled JBR.

### Output

The built HAP will be at:

```
:: Default (OpenHarmony)
src\oh\entry\build\default\outputs\default\entry-default-unsigned.hap

:: Charlotte (HarmonyOS)
src\oh\entry\build\charlotte\outputs\charlotte\entry-charlotte-signed.hap
```

> **Note:** The default product HAP may be unsigned. Configure signing in `build-profile.json5` or DevEco Studio for a signed build. The charlotte product requires signing configuration before deployment to a real device.

---

## Option 2: DevEco Studio (GUI)

1. Open `src/oh/` as a project in DevEco Studio.
2. Wait for the IDE to sync dependencies (ohpm install runs automatically).
3. If prompted about missing SDK versions, install them via **File > Settings > SDK**.
4. **Select the product** in the toolbar: `default` (OpenHarmony) or `charlotte` (HarmonyOS).
5. Select **Build > Build Hap(s)/APP(s) > Build Hap(s)**.
6. Find the output HAP in `entry/build/<product>/outputs/<product>/`.

---

## Option 3: Command Line (Manual)

### Step 1: Set up environment

```cmd
:: Add Java to PATH (required for HAP packaging)
set "JAVA_HOME=C:\Program Files\Huawei\DevEco Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
```

### Step 2: Sync CRAFT modules

The CRAFT TypeScript modules must be copied into the OH project's ETS source tree so hvigor can bundle them.

```cmd
cd D:\craft\craft

set CRAFT_ETS=src\oh\entry\src\main\ets\craft

:: Remove stale copy
rmdir /s /q %CRAFT_ETS% 2>nul
mkdir %CRAFT_ETS%

:: Copy each module
xcopy /s /q /y src\core %CRAFT_ETS%\core\
xcopy /s /q /y src\parser %CRAFT_ETS%\parser\
xcopy /s /q /y src\interpreter %CRAFT_ETS%\interpreter\
xcopy /s /q /y src\shim %CRAFT_ETS%\shim\
xcopy /s /q /y src\bridge %CRAFT_ETS%\bridge\
copy /y src\runtime.ts %CRAFT_ETS%\
copy /y src\index.ts %CRAFT_ETS%\
```

### Step 3: Apply ArkTS patches

ArkTS has stricter requirements than standard TypeScript. The following manual patches are needed after syncing:

**`parser/apk_parser.ts`:**
- Remove `import * as fs from 'fs'` (no Node.js fs module in ArkTS)
- Remove `parseFile()` and `parseFileSync()` methods
- Replace `new TextDecoder('utf-8').decode(...)` with a manual UTF-8 decoder
- Remove `parseAPKFile` and `parseAPKFileSync` exports

**`parser/manifest_parser.ts`:**
- Replace `new TextDecoder('utf-8').decode(...)` with a manual UTF-8 decoder

**`runtime.ts`:**
- Replace `parser.parseFile(apkPath)` with OpenHarmony file API (`@ohos.file.fs`)

**`index.ts`:**
- Remove `parseAPKFile` and `parseAPKFileSync` from exports

**`bridge/state_manager.ts` and `bridge/ui_bridge.ts`:**
- Replace `any` types with `string | number | boolean` (ArkTS forbids `any`)

> The automated `build_hap.bat` applies all these patches automatically.

### Step 4: Verify page routing

Ensure `src/oh/entry/src/main/resources/base/profile/main_pages.json` includes CraftPage:

```json
{
  "src": [
    "pages/CraftPage",
    "pages/Index"
  ]
}
```

### Step 5: Install dependencies

```cmd
cd D:\craft\craft\src\oh
ohpm install
```

### Step 6: Build

```cmd
cd D:\craft\craft\src\oh

:: Default (OpenHarmony)
node "C:\Program Files\Huawei\DevEco Studio\tools\hvigor\bin\hvigorw.js" assembleHap -p product=default --no-daemon

:: Charlotte (HarmonyOS)
node "C:\Program Files\Huawei\DevEco Studio\tools\hvigor\bin\hvigorw.js" assembleHap -p product=charlotte --no-daemon
```

---

## Charlotte / HarmonyOS Build (Mate 60)

The `charlotte` product targets HarmonyOS devices like the Huawei Mate 60 (Kirin 9000S / "Charlotte" chipset).

### Requirements

- **HarmonyOS SDK** (API 12+) installed in DevEco Studio
- **Signing configuration**: Real device deployment requires a valid signing config. Configure in DevEco Studio:
  1. **File > Project Structure > Signing Configs**
  2. Select the `charlotte` signing config
  3. Configure certificate, profile, and keystore paths

### Build

```cmd
:: Automated
build_hap.bat charlotte

:: Or in DevEco Studio: select "charlotte" product, Build > Build Hap(s)
```

### Key differences from default

| Aspect | default | charlotte |
|--------|---------|-----------|
| runtimeOS | OpenHarmony | HarmonyOS |
| SDK | OpenHarmony SDK | HarmonyOS SDK |
| deviceTypes | default (emulator) | default, phone |
| Signing | OpenHarmony debug cert | HarmonyOS signing required |

### Signing config placeholder

The `charlotte` signing config in `build-profile.json5` has empty paths. Fill them in after configuring signing in DevEco Studio:

```json5
{
  "name": "charlotte",
  "material": {
    "certpath": "<your-cert-path>",
    "keyAlias": "<your-key-alias>",
    "keyPassword": "<encrypted>",
    "profile": "<your-profile-path>",
    "signAlg": "SHA256withECDSA",
    "storeFile": "<your-keystore-path>",
    "storePassword": "<encrypted>"
  }
}
```

---

## SDK Directory Setup

hvigor 6.x expects SDK components at `<sdk.dir>/<apiVersion>/<component>` (e.g., `Sdk/21/ets/`). DevEco Studio bundles the SDK in a flat structure under `<DevEco>/sdk/default/openharmony/`. The build script creates directory junctions to bridge this:

```
C:\Users\<username>\OpenHarmony\Sdk\
└── 21\
    ├── ets\        → C:\Program Files\Huawei\DevEco Studio\sdk\default\openharmony\ets
    ├── js\         → ...openharmony\js
    ├── native\     → ...openharmony\native
    ├── previewer\  → ...openharmony\previewer
    └── toolchains\ → ...openharmony\toolchains
```

The `local.properties` file in `src/oh/` points to this SDK root:
```
sdk.dir=C:/Users/<username>/OpenHarmony/Sdk
```

---

## Deployment

### OpenHarmony (default product)

```cmd
:: Connect device
hdc list targets

:: Install HAP (once - the runtime, not the APK)
hdc install src\oh\entry\build\default\outputs\default\entry-default-unsigned.hap

:: Push the APK you want to run, then launch
hdc file send test\fixtures\hello_world.apk /data/app/hello_world.apk
hdc shell aa start -a EntryAbility -b com.craft.runtime --ps apk_path /data/app/hello_world.apk

:: To run a different APK, just push and launch again
hdc file send test\fixtures\calculator.apk /data/app/calculator.apk
hdc shell aa start -a EntryAbility -b com.craft.runtime --ps apk_path /data/app/calculator.apk
```

### HarmonyOS / Charlotte (Mate 60)

```cmd
:: Connect Mate 60
hdc list targets

:: Install HAP (must be signed)
hdc install entry-charlotte-signed.hap

:: Push and launch an APK
hdc file send test\fixtures\hello_world.apk /data/app/hello_world.apk
hdc shell aa start -a EntryAbility -b com.craft.runtime --ps apk_path /data/app/hello_world.apk
```

### Verify

You should see on screen:

- **"Hello World"** text rendered by ArkUI (when running hello_world.apk)
- Font size 24
- Black text color (`#000000`)

### View logs

```cmd
:: All CRAFT logs
hdc hilog -T CRAFT

:: Filter by component
hdc hilog -T CRAFT | findstr EntryAbility
hdc hilog -T CRAFT | findstr CraftPage
hdc hilog -T CRAFT | findstr Runtime
```

### Uninstall

```cmd
hdc uninstall com.craft.runtime
```

---

## Project Structure

```
src/oh/
├── AppScope/
│   ├── app.json5                          # Bundle: com.craft.runtime
│   └── resources/base/
│       ├── element/string.json            # App name: "CRAFT"
│       └── media/app_icon.png             # App icon
├── entry/
│   ├── build-profile.json5               # Entry build config (stageMode)
│   ├── hvigorfile.ts                      # Entry module build (hapTasks)
│   ├── oh-package.json5                   # Entry module package
│   └── src/main/
│       ├── module.json5                   # Module config (EntryAbility)
│       ├── ets/
│       │   ├── entryability/
│       │   │   └── EntryAbility.ets       # Main ability (APK loader)
│       │   ├── pages/
│       │   │   ├── CraftPage.ets          # Dynamic ArkUI renderer
│       │   │   └── Index.ets              # Stub/fallback page
│       │   └── craft/                     # <-- CRAFT modules (synced + patched)
│       │       ├── index.ts
│       │       ├── runtime.ts
│       │       ├── core/
│       │       ├── parser/
│       │       ├── interpreter/
│       │       ├── shim/
│       │       └── bridge/
│       └── resources/
│           ├── base/
│           │   ├── element/               # Strings, colors
│           │   ├── media/icon.png         # Ability icon
│           │   └── profile/main_pages.json # Page routing
│           └── rawfile/
│               └── hello_world.apk        # Bundled demo APK
├── hvigor/
│   └── hvigor-config.json5               # Hvigor config (6.21.1 deps)
├── build-profile.json5                    # App build config (default + charlotte)
├── hvigorfile.ts                          # Root build (appTasks)
├── local.properties                       # SDK path
└── oh-package.json5                       # Root package
```

---

## Key Configuration Files

| File | Key Settings |
|------|-------------|
| `build-profile.json5` | Products: `default` (OpenHarmony) + `charlotte` (HarmonyOS), `compileSdkVersion: 12` |
| `entry/build-profile.json5` | Targets: `default` (OpenHarmony) + `charlotte` (HarmonyOS), `apiType: "stageMode"` |
| `entry/src/main/module.json5` | `deviceTypes: ["default", "phone"]` |
| `hvigor/hvigor-config.json5` | `modelVersion: "5.0.0"`, `@ohos/hvigor: "6.21.1"`, `@ohos/hvigor-ohos-plugin: "6.21.1"` |
| `oh-package.json5` | `modelVersion: "5.0.0"` (required by hvigor) |
| `local.properties` | `sdk.dir=C:/Users/<username>/OpenHarmony/Sdk` |

---

## Troubleshooting

### Build failures

| Error | Fix |
|-------|-----|
| `spawn java ENOENT` | Java not on PATH. Set `JAVA_HOME` to DevEco's `jbr/` directory |
| `root node not yet available` | Dual hvigor singleton. Ensure `hvigor-config.json5` lists `@ohos/hvigor` in dependencies |
| `Cannot find module 'fs'` | ArkTS patches not applied. Run `build_hap.bat` or apply patches manually |
| `Use explicit types instead of "any"` | ArkTS patches not applied. Replace `any` with explicit types |
| `Cannot find name 'TextDecoder'` | ArkTS patches not applied. Replace TextDecoder with manual decode |
| `Unknown mode 'debug'` | Remove `--mode debug` flag. Use `assembleHap --no-daemon` |
| `SDK management mode has changed` | SDK directory structure missing. Create versioned symlinks (see SDK section) |
| `Component placed in wrong place` | SDK symlinks at wrong level. Must be at `<sdk.dir>/<apiVersion>/<component>` |
| `Cannot find module '@ohos/hvigor-ohos-plugin'` | Run `ohpm install` in `src/oh/` or open in DevEco Studio |
| `ohpm not found` | Add DevEco tools to PATH or edit `DEVECO_HOME` in `build_hap.bat` |
| `The project needs to be upgraded` | Missing `modelVersion: "5.0.0"` in `oh-package.json5` files |
| `Please configure compileSdkVersion` | Add `compileSdkVersion: 12` to `build-profile.json5` |
| `deviceType 'phone' not supported` | OpenHarmony SDK doesn't support "phone" — build with `default` product or use HarmonyOS SDK |
| Missing `$media:icon` resource | Run `build_hap.bat` (creates placeholders) or add a 48x48 PNG |
| `Cannot find CraftPage` | Verify `main_pages.json` includes `"pages/CraftPage"` |
| Charlotte build fails | Charlotte requires HarmonyOS SDK. This machine may only have OpenHarmony SDK |
| Charlotte signing error | Configure signing in DevEco Studio for the `charlotte` signing config |

### Device connection

| Error | Fix |
|-------|-----|
| `[Empty]` from `hdc list targets` | Check USB cable, enable developer mode on device |
| `install failed` | Uninstall previous version: `hdc uninstall com.craft.runtime` |
| `signature verification failed` | Build is unsigned; configure signing in `build-profile.json5` |

### Runtime issues

| Symptom | Fix |
|---------|-----|
| Blank screen, no logs | Check `main_pages.json` routes to `pages/CraftPage` |
| "Loading..." stays forever | Check `EntryAbility` logs -- APK load may have failed |
| "Error" state shown | Check `hdc hilog -T CRAFT` for the error message |
| "Runtime not available" | `AppStorage` link failed -- check `EntryAbility` logs |

---

## Quick Reference

```cmd
:: === Build (OpenHarmony) ===
build_hap.bat

:: === Build (Charlotte / HarmonyOS / Mate 60) ===
build_hap.bat charlotte

:: === Deploy runtime (once) ===
hdc install src\oh\entry\build\default\outputs\default\entry-default-unsigned.hap

:: === Run an APK ===
hdc file send test\fixtures\hello_world.apk /data/app/hello_world.apk
hdc shell aa start -a EntryAbility -b com.craft.runtime --ps apk_path /data/app/hello_world.apk

:: === Deploy runtime - Charlotte (once) ===
hdc install entry-charlotte-signed.hap

:: === Logs ===
hdc hilog -T CRAFT

:: === Uninstall ===
hdc uninstall com.craft.runtime
```

---

**Last Updated:** 2026-02-20
