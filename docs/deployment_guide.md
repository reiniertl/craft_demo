# CRAFT Deployment Guide

**Project:** CRAFT (Compatibility Runtime for Android Framework Translation)
**Last Updated:** 2026-03-09

---

## Overview

CRAFT deployment has two independent parts:

1. **The CRAFT runtime** (HAP) — the translation layer, installed once on the device
2. **Android APKs** — pushed separately and loaded on demand via launch parameters

The runtime and APKs are fully decoupled. Install the HAP once, then run any compatible APK without rebuilding.

---

## Building

| What | Guide | Quick Command |
|------|-------|---------------|
| Demo APKs (hello_world, calculator, clock) | [APK Build Guide](apk_build_guide.md) | `build_apk.bat all` |
| CRAFT runtime HAP | [HAP Build Guide](hap_build_guide.md) | `build_hap.bat` |

---

## Deploying and Running

### 1. Install the CRAFT HAP (once)

```cmd
hdc install src\oh\entry\build\default\outputs\default\entry-default-signed.hap
```

### 2. Push an APK and launch

```cmd
:: Push APK to device
hdc file send test\fixtures\hello_world.apk /data/app/hello_world.apk

:: Launch CRAFT with the APK
hdc shell aa start -a EntryAbility -b com.craft.runtime --ps apk_path /data/app/hello_world.apk
```

To run a different APK, push and launch it the same way:

```cmd
hdc file send test\fixtures\calculator.apk /data/app/calculator.apk
hdc shell aa start -a EntryAbility -b com.craft.runtime --ps apk_path /data/app/calculator.apk
```

### 3. View logs

```cmd
hdc hilog -T CRAFT
```

### 4. Uninstall

```cmd
hdc uninstall com.craft.runtime
```

---

## Detailed Guides

- **[HAP Build Guide](hap_build_guide.md)** — Prerequisites, build options (automated/DevEco/manual), SDK setup, charlotte/HarmonyOS builds, troubleshooting
- **[APK Build Guide](apk_build_guide.md)** — Building demo APKs with Android SDK tools
- **[Stage 5 Status](stage_5_status.md)** — Device testing results and current deployment status

---

## Troubleshooting

See the [HAP Build Guide troubleshooting section](hap_build_guide.md#troubleshooting) for build failures, device connection issues, and runtime problems.
