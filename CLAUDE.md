# CRAFT Project Context

CRAFT (Compatibility Runtime for Android Framework Translation) - An Android APK parser and runtime for OpenHarmony.

## Current Stage: 5 Complete - All Stages Done

**Status:** 660 tests passing | 0 TypeScript errors | 0 regressions | Device Tested ✅

Stage 1: APK/DEX/Manifest parsing ✅
Stage 2: Bytecode interpretation ✅
Stage 3: Android API shims ✅
Stage 4: UI Bridge & OpenHarmony host ✅
Stage 5: Integration & Polish ✅ Tested on HarmonyOS Device

**Tested:** HAP built & signed | APK rebuilt & verified on Android | HarmonyOS device testing successful
**Details:** See `docs/stage_5_status.md` for deployment guide

## Documentation

**All documentation centralized in `docs/` with consistent snake_case naming:**

- **Main entry:** `README.md` - Project overview
- **Documentation hub:** `docs/index.md` - Complete navigation
- **Requirements:** `docs/requirements.md` - Goals, constraints, success criteria
- **Architecture:** `docs/architecture.md` - System design, data flow
- **Specification:** `docs/specification.md` - Component specs (12 components)
- **Implementation plan:** `docs/implementation_plan.md` - 5-stage roadmap
- **Stage plans:** `docs/stages/stage_N_plan.md` - Detailed planning for each stage
- **Stage results:** `docs/stages/stage_N_results.md` - Completion reports (Stage 4 uses `stage_4_complete.md`; Stage 5 uses `docs/stage_5_status.md` at the docs root)
- **Deployment:** `docs/stage_5_status.md` - Current deployment status
- **Guides:** `docs/deployment_guide.md`, `docs/apk_build_guide.md`, `docs/hap_build_guide.md`, `docs/tools_guide.md`
- **Shim specs:** `docs/specs/INDEX.md` - Prescriptive contracts for every implemented shim class

## Shim Layer Specifications

`docs/specs/` contains one spec file per implemented Android / Java stdlib class.
**Consult these before implementing, modifying, reviewing, or debugging any shim or
renderer code.** Each spec defines:
- The exact method signatures and DEX descriptors to intercept
- Pre/post conditions and class invariants that the implementation MUST satisfy
- The ViewNode property keys written by the shim (Layer 2 → Layer 3 contract)
- Event callback wiring between the shim and UIBridge
- Host renderer hints for ArkUI

| Task | Which spec to read |
|------|--------------------|
| Implementing a new shim method | Open the spec for that class |
| Reviewing an existing shim | Check every method against its spec |
| Debugging a rendering issue | Check the ViewNode Property Contract section |
| Adding a ViewNode key | Register it in `docs/specs/INDEX.md` first |
| Checking class hierarchy / inheritance | See class hierarchy tree in `docs/specs/INDEX.md` |

## Quick Reference

```bash
# Run tests
npm test
npm run craft-test -- --component parser

# Development tools (see tools/README.md for details)
npm run analyze-apk test/fixtures/hello_world.apk  # Analyze APK requirements
npm run dex-dump test/fixtures/hello_world.dex --all  # Dump DEX contents
npm run gen-shim android.widget.Button  # Generate Android API shim
npm run gen-opcode 0x32 if-eq 22t -- --category control  # Generate opcode handler

# New debugging and validation tools
npm run trace-exec test/fixtures/hello_world.dex     # Trace bytecode execution
npm run coverage-map                                  # Opcode & shim coverage
npm run validate-shims                                # Shim consistency check
npm run heap-dump test/fixtures/hello_world.dex       # Inspect heap state
npm run gen-fixture -- --list                         # List test fixture scenarios
npm run gen-integration-test my-test                  # Scaffold integration test
npm run apk-onboard test/fixtures/hello_world.apk     # APK onboarding report
npm run guard                                         # Full regression guard
npm run sync-oh                                       # Check OH copy sync status

# TypeScript check
npx tsc --noEmit
```

## Development Tools

14 development tools are available (see `tools/README.md`):

**Core (original):**
1. **`craft-test`** - Run tests with component filtering
2. **`gen-shim`** - Generate Android API shim implementations
3. **`gen-opcode`** - Generate opcode handler implementations
4. **`dex-dump`** - Dump and analyze DEX file contents
5. **`analyze-apk`** - Analyze APK requirements and complexity

**Debugging & Analysis:**
6. **`trace-exec`** - Bytecode execution tracer
7. **`coverage-map`** - Opcode & API coverage reporter
8. **`validate-shims`** - Shim consistency checker
9. **`heap-dump`** - Runtime heap inspector

**Code Generation & Testing:**
10. **`gen-fixture`** - Test fixture builder (6 scenarios)
11. **`gen-integration-test`** - Integration test scaffolder

**Orchestration:**
12. **`apk-onboard`** - APK onboarding agent
13. **`guard`** - Regression guard (TypeScript + tests + shims + opcodes)
14. **`sync-oh`** - OH sync checker (detect/fix src ↔ OH drift)

## Project Structure

```
demo/
├── hello_world/
│   ├── MainActivity.java      # Simple Hello World app
│   └── AndroidManifest.xml    # com.example.helloworld
├── calculator/
│   ├── MainActivity.java      # Calculator app with button grid
│   └── AndroidManifest.xml    # com.example.calculator
└── clock/
    ├── MainActivity.java      # Clock app (System.currentTimeMillis)
    └── AndroidManifest.xml    # com.example.clock

src/
├── index.ts        # Main export barrel
├── core/           # Utilities: LEB128, MUTF-8, errors, logging, types
│   ├── errors.ts          # CraftError, ParseError, ValidationError
│   ├── types.ts           # Value types, AccessFlags, TypeDescriptors
│   └── utils.ts           # LEB128/MUTF-8 decoding, Logger, binary readers
├── parser/         # APK, DEX, Manifest parsers (portable TypeScript)
│   ├── apk_parser.ts      # ZIP extraction (STORE only)
│   ├── dex_parser.ts      # DEX file parsing
│   ├── dex_types.ts       # DEX format type definitions
│   └── manifest_parser.ts # Binary XML parsing
├── interpreter/    # Bytecode interpreter (Stage 2)
│   ├── interpreter.ts     # Main execution loop
│   ├── heap.ts            # Object allocation and field access
│   ├── frame.ts           # Execution frame management
│   ├── class_loader.ts    # Class and method resolution
│   ├── method_resolver.ts # Virtual dispatch with caching
│   ├── opcode_table.ts    # Opcode dispatch table
│   ├── opcodes.ts         # 218 Dalvik opcode implementations
│   ├── shim_registry.ts   # Shim method registry
│   ├── shim_init.ts       # Shim initialization (java.lang + android.*)
│   ├── tracer.ts          # Execution tracer (debugging)
│   ├── types.ts           # Interpreter type definitions
│   └── errors.ts          # Interpreter exception classes
├── shim/
│   ├── java/lang/         # java.lang.* base class shims (Stage 2)
│   │   ├── object.ts      # java.lang.Object
│   │   ├── string.ts      # java.lang.String
│   │   ├── string_builder.ts # java.lang.StringBuilder
│   │   ├── class.ts       # java.lang.Class (minimal)
│   │   ├── system.ts      # java.lang.System
│   │   └── index.ts       # Registration
│   └── android/           # Android API shims (Stage 3)
│       ├── os/bundle.ts         # android.os.Bundle
│       ├── content/context.ts   # android.content.Context + ContextWrapper
│       ├── view/view.ts         # android.view.View
│       ├── view/view_group.ts   # android.view.ViewGroup (+ UIBridge)
│       ├── widget/textview.ts   # android.widget.TextView (+ UIBridge)
│       ├── widget/linear_layout.ts # android.widget.LinearLayout (+ UIBridge)
│       ├── widget/button.ts     # android.widget.Button (+ UIBridge)
│       ├── app/activity.ts      # android.app.Activity (+ UIBridge)
│       └── index.ts             # Registration
├── bridge/         # UI Bridge (Stage 4)
│   ├── ui_bridge.ts       # View → ViewNode mapping
│   ├── state_manager.ts   # Reactive state management
│   └── lifecycle_bridge.ts # Activity ↔ Ability lifecycle
├── runtime.ts      # High-level CRAFT API (Stage 4)
└── oh/             # OpenHarmony HAP project (Stage 5)
    ├── entry/build/        # Compiled HAP output (checked in)
    ├── oh_modules/         # OH package dependencies (checked in)
    ├── .hvigor/            # Hvigor build cache (checked in)
    ├── hvigor/             # Hvigor wrapper config
    ├── local.properties    # SDK path (update for your machine)
    └── entry/src/main/ets/craft/  # ArkTS-patched copy of src/

tools/
├── craft_test.ts            # Test runner with component filtering
├── gen_shim.ts              # Android API shim generator
├── gen_opcode.ts            # Opcode handler generator
├── dex_dumper.ts            # DEX file inspector
├── analyze_apk.ts           # APK requirements analyzer
├── trace_exec.ts            # Bytecode execution tracer
├── coverage_map.ts          # Opcode & shim coverage reporter
├── validate_shims.ts        # Shim consistency checker
├── heap_dump.ts             # Runtime heap inspector
├── gen_fixture.ts           # Test fixture builder
├── gen_integration_test.ts  # Integration test scaffolder
├── apk_onboard.ts           # APK onboarding agent
├── regression_guard.ts      # Regression guard
└── sync_oh.ts               # OH sync checker

test/
├── fixtures/       # hello_world.apk, calculator.apk, clock.apk, .dex, manifest_binary.xml
├── helpers/        # shim_test_utils.ts, value_matchers.ts
├── unit/           # Unit tests (20 test files)
│   ├── interpreter/  # heap, frame, opcodes, shim_registry, interpreter, tracer
│   ├── shim/         # java.lang.*, android.*, button, linear_layout tests
│   └── bridge/       # UIBridge, StateManager, LifecycleBridge tests
└── integration/    # Integration tests (12 test files + 1 helper)
    ├── interpreter/  # Interpreter integration tests
    ├── android/      # Activity lifecycle integration tests
    └── bridge/       # UI Bridge integration tests
```

## Key Files

| File | Purpose |
|------|---------|
| `src/parser/apk_parser.ts` | ZIP extraction (STORE only) |
| `src/parser/dex_parser.ts` | DEX file parsing |
| `src/parser/manifest_parser.ts` | Binary XML parsing |
| `src/interpreter/interpreter.ts` | Main bytecode execution loop |
| `src/interpreter/heap.ts` | Object/array/string allocation |
| `src/interpreter/class_loader.ts` | Class/method/field resolution |
| `src/interpreter/opcodes.ts` | 218 Dalvik opcode implementations |
| `src/interpreter/shim_registry.ts` | TypeScript shim method dispatch |
| `src/shim/android/app/activity.ts` | Activity lifecycle shim (+ UIBridge) |
| `src/shim/android/widget/textview.ts` | TextView shim (+ UIBridge) |
| `src/shim/android/widget/linear_layout.ts` | LinearLayout shim (+ UIBridge) |
| `src/shim/android/widget/button.ts` | Button shim (extends TextView, + UIBridge) |
| `src/bridge/ui_bridge.ts` | View → ViewNode mapping |
| `src/bridge/state_manager.ts` | Reactive state for ArkUI |
| `src/bridge/lifecycle_bridge.ts` | Activity ↔ Ability lifecycle |
| `src/runtime.ts` | High-level CRAFT API |
| `src/core/types.ts` | Value types (int, long, float, double, object, null) |

## Architecture

- **Portable core**: All code operates on `Uint8Array`, no OS dependencies
- **Register-based VM**: Dalvik register-based execution with frame stack
- **Shim layer**: Java stdlib + Android API methods implemented in TypeScript
- **Virtual dispatch**: Class hierarchy walking for invoke-virtual
- **Android class hierarchy**: Activity > ContextWrapper > Context > Object; Button > TextView > View > Object; LinearLayout > ViewGroup > View > Object

## Android Class Hierarchy (Stage 3)

```
java.lang.Object
├── android.os.Bundle
├── android.content.Context
│     └── android.content.ContextWrapper
│           └── android.app.Activity
└── android.view.View
      ├── android.widget.TextView
      │     └── android.widget.Button
      └── android.view.ViewGroup
            └── android.widget.LinearLayout
```

## Interpreter Entry Point

```typescript
import { DexParser, Interpreter, Heap, initializeShimRegistry } from './src';

const dex = new DexParser(dexData);
const heap = new Heap();
const shims = initializeShimRegistry();
const interp = new Interpreter(dex, heap, shims);

const result = interp.invoke('Lcom/example/Test;', 'main', '()V', []);
```

## Reference Source Trees

Full AOSP and OpenHarmony repo checkouts live alongside the CRAFT project. **Use these for API lookup instead of web searches** when implementing shims, checking Android API behavior, or looking up OpenHarmony/ArkUI APIs.

```
../                   # Parent directory of this project
├── android/          # AOSP repo checkout
│   ├── art/          # ART runtime (JNI, class loading, GC)
│   ├── dalvik/       # Dalvik VM, dx/d8 tools, DEX format spec
│   ├── external/     # Third-party libraries
│   ├── build/        # Build system
│   └── .repo/        # More repos available (frameworks/, libcore/, packages/, system/)
├── oh/               # OpenHarmony repo checkout
│   └── src/
│       ├── applications/  # OH sample/standard apps
│       └── .repo/         # More repos available (arkcompiler/, foundation/, interface/)
└── craft/            # ← This project
```

**Key lookup paths (relative to project root):**
- Dalvik bytecode spec / DEX format: `../android/dalvik/`
- ART runtime internals: `../android/art/`
- OH sample apps (ArkTS patterns): `../oh/src/applications/standard/`

**Note:** These are partial checkouts. If a repo isn't checked out to the working tree, its git objects are still in `.repo/projects/` and can be synced with `repo sync <project>`.

## Coding Conventions

- Log format: `[CRAFT][Component][Level] Message`
- Error messages include offset/context for debugging
- ArkTS compatibility: avoid `any`, dynamic properties, `eval()`

## Demo Apps & Test Fixtures

Demo app sources live in `demo/`, built APKs go to `test/fixtures/`:

- `hello_world.apk` - Simple Hello World (package: `com.example.helloworld`)
- `calculator.apk` - Calculator with button grid (package: `com.example.calculator`)
- `clock.apk` - Clock displaying system time (package: `com.example.clock`)
- Built with STORE compression (no DEFLATE) via `build_apk.bat`
- `hello_world.dex` - Standalone DEX stub for parser/interpreter tests (independent)

```cmd
build_apk.bat                 :: builds hello_world (default)
build_apk.bat hello_world     :: builds hello_world
build_apk.bat calculator      :: builds calculator
build_apk.bat clock           :: builds clock
build_apk.bat all             :: builds all demo apps
```

## Claude Code Skills

7 Claude Code skills are available in `.claude/skills/` for automated workflows:

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `/guard` | After code changes | Run regression guard, analyze failures, fix issues |
| `/sync-oh` | After src/ edits | Detect OH drift, auto-fix non-adapted files, alert about adapted files |
| `/onboard-apk <path>` | User-invoked | Full APK onboarding pipeline (analyze → implement → test) |
| `/add-shim <class>` | User-invoked | Add new Android API shim (generate → implement → register → test → sync) |
| `/add-opcode <hex> <name> <format>` | User-invoked | Add new Dalvik opcode handler (generate → implement → test → verify) |
| `/debug-bytecode <file>` | User-invoked | Debug bytecode execution with trace-exec + heap-dump + dex-dump |
| `/build-hap` | User-invoked | Build OpenHarmony HAP with ArkTS patching and signing |

## Documentation

- `docs/specification.md` - Component specifications (12 components, all API signatures)
- `docs/architecture.md` - System design and data flow
- `docs/stage_5_status.md` - Current deployment status
- `docs/stages/stage_N_plan.md` - Stage planning docs
- `docs/stages/stage_N_results.md` - Stage completion reports
