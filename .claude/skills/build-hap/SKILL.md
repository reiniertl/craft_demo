---
name: build-hap
description: Build the OpenHarmony HAP package from the CRAFT project with ArkTS patching and signing.
user-invocable: true
allowed-tools: Bash(npm run:*), Bash(npx:*), Bash(cd *), Read, Grep, Glob, Edit
---

# Build HAP

Multi-step process to build the OpenHarmony HAP package.

## Prerequisites

- DevEco Studio SDK installed (check `src/oh/local.properties` for SDK path)
- Java 17+ on PATH
- Node.js 18+

## Steps

1. **Sync source files to OH copy**
   ```bash
   npm run sync-oh -- --fix
   ```
   Ensure all non-adapted files are up to date. Review any adapted file alerts.

2. **Verify ArkTS compatibility**
   - Check the 6 adapted files have correct ArkTS modifications:

   | File | Key Adaptation |
   |------|---------------|
   | `bridge/ui_bridge.ts` | `Map<string, string\|number\|boolean>` instead of `any` |
   | `bridge/state_manager.ts` | `Record<string, string\|number\|boolean>` instead of `any` |
   | `parser/apk_parser.ts` | Manual UTF-8 decoder, no Node.js `fs` |
   | `parser/manifest_parser.ts` | Manual UTF-8 decoder |
   | `shim/android/view/view.ts` | `setClickCallback()` instead of `updateViewProperty('onClick', ...)` |
   | `runtime.ts` | OpenHarmony `rawfile` API instead of Node.js `fs` |

3. **Build the HAP**
   ```bash
   cd src/oh && node node_modules/@anthropic/hvigorw/bin/hvigorw.js assembleHap --mode module -p product=default --no-daemon
   ```
   Or use the project's hvigorw wrapper if available.

4. **Check build output**
   - Unsigned HAP: `src/oh/entry/build/default/outputs/default/entry-default-unsigned.hap`
   - Signed HAP: `src/oh/entry/build/default/outputs/default/entry-default-signed.hap`

5. **Verify HAP contents**
   The HAP should contain the compiled `modules.abc` bytecode and all resources.

6. **Report** build status, HAP size, and any warnings
