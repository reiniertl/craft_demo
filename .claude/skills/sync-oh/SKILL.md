---
name: sync-oh
description: Check and fix drift between src/ and the OpenHarmony ArkTS copy after modifying source files. Use after any changes to files in src/.
user-invocable: true
allowed-tools: Bash(npm run sync-oh:*), Read, Grep, Edit
---

# OH Sync Checker

Detect and fix drift between `src/` and the OpenHarmony ArkTS copy at `src/oh/entry/src/main/ets/craft/`.

## Steps

1. Run `npm run sync-oh` to check sync status
2. If non-adapted files are out of sync:
   - Run `npm run sync-oh -- --fix` to auto-copy them
3. If adapted files have new exports missing from OH:
   - Alert the user with the specific files and what needs manual adaptation
   - The 6 adapted files require special ArkTS modifications:

| File | Adaptation Required |
|------|-------------------|
| `bridge/ui_bridge.ts` | `Map<string, string\|number\|boolean>` instead of `any`; separate `clickCallbacks` map |
| `bridge/state_manager.ts` | `Record<string, string\|number\|boolean>` instead of `any` |
| `parser/apk_parser.ts` | Manual UTF-8 decoder instead of `TextDecoder`; no Node.js `fs` |
| `parser/manifest_parser.ts` | Manual UTF-8 decoder instead of `TextDecoder` |
| `shim/android/view/view.ts` | Uses `setClickCallback()` instead of `updateViewProperty('onClick', ...)` |
| `runtime.ts` | OpenHarmony `rawfile` API instead of Node.js `fs` |

4. Report which files were synced and which need manual attention
