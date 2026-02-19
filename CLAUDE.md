# CRAFT Project Context

CRAFT (Compatibility Runtime for Android Framework Translation) - An Android APK parser and runtime for OpenHarmony.

## Current Stage: 5 Code Complete, Awaiting APK & Device Testing

**Status:** 274 tests passing | 0 TypeScript errors | 0 regressions | Code 100% Complete

Stage 1: APK/DEX/Manifest parsing ✅
Stage 2: Bytecode interpretation ✅
Stage 3: Android API shims ✅
Stage 4: UI Bridge & OpenHarmony host ✅
Stage 5: Integration & Polish ✅ Code Complete | ⚠️ Needs APK + Device

**Deployment Ready:** HAP buildable now | Need Android SDK for APK + OH device for testing
**Details:** See `docs/STAGE_5_STATUS.md` for complete deployment guide

## 📚 Documentation (Reorganized 2026-02-12)

**All documentation now centralized in `docs/` with consistent snake_case naming:**

- **Main entry:** `README.md` - Project overview
- **Documentation hub:** `docs/index.md` - Complete navigation
- **Requirements:** `docs/requirements.md` - Goals, constraints, success criteria
- **Architecture:** `docs/architecture.md` - System design, data flow
- **Specification:** `docs/specification.md` - Component specs
- **Implementation plan:** `docs/implementation_plan.md` - 5-stage roadmap
- **Stage plans:** `docs/stages/stage_N_plan.md` - Detailed planning for each stage
- **Stage results:** `docs/stages/stage_N_results.md` - Completion reports
- **Stage 4 complete:** `docs/stages/stage_4_complete.md` - UI Bridge completion report

**File Naming Convention:** All docs use snake_case (stage_1_results.md, implementation_plan.md, etc.)

## Quick Reference

```bash
# Run tests
npm test
npm run craft-test -- --component parser

# Development skills (see tools/README.md for details)
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

# TypeScript check
npx tsc --noEmit
```

## Development Skills

14 skills are available to accelerate development:

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

See `/mnt/d/craft/craft/tools/README.md` for comprehensive documentation.

## Project Structure

```
src/
├── core/           # Utilities: LEB128, MUTF-8, errors, logging, types
├── parser/         # APK, DEX, Manifest parsers (portable TypeScript)
├── interpreter/    # Bytecode interpreter (Stage 2)
│   ├── interpreter.ts     # Main execution loop
│   ├── heap.ts            # Object allocation and field access
│   ├── frame.ts           # Execution frame management
│   ├── class_loader.ts    # Class and method resolution
│   ├── method_resolver.ts # Virtual dispatch with caching
│   ├── opcode_table.ts    # Opcode dispatch table
│   ├── opcodes.ts         # 28 essential opcode implementations
│   ├── shim_registry.ts   # Shim method registry
│   ├── shim_init.ts       # Shim initialization (java.lang + android.*)
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
│       ├── view/view_group.ts   # android.view.ViewGroup
│       ├── widget/textview.ts   # android.widget.TextView (+ UIBridge)
│       ├── app/activity.ts      # android.app.Activity (+ UIBridge)
│       └── index.ts             # Registration
├── bridge/         # UI Bridge (Stage 4)
│   ├── ui_bridge.ts       # View → ViewNode mapping
│   ├── state_manager.ts   # Reactive state management
│   └── lifecycle_bridge.ts # Activity ↔ Ability lifecycle
├── runtime.ts      # High-level CRAFT API (Stage 4)
└── oh/             # OpenHarmony ability (for Stage 5)

tools/
├── craft_test.ts            # Test runner with component filtering
├── gen_shim.ts              # Android API shim generator
├── gen_opcode.ts            # Opcode handler generator
├── dex_dumper.ts            # DEX file inspector
├── analyze_apk.ts           # APK requirements analyzer
└── generate_test_fixtures.ts # Test fixture generator

test/
├── fixtures/       # hello_world.apk, .dex, manifest_binary.xml
├── unit/           # 274 tests (58+118+35+55+8 integration)
│   ├── interpreter/  # heap, frame, opcodes, shim_registry, interpreter
│   ├── shim/         # java.lang.* and android.* shim tests
│   └── bridge/       # UIBridge, StateManager, LifecycleBridge tests (Stage 4)
└── integration/    # (included in unit count above)
    ├── interpreter/  # Interpreter integration tests
    ├── android/      # Activity lifecycle integration tests
    └── bridge/       # UI Bridge integration tests (Stage 4)
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
| `src/interpreter/opcodes.ts` | 28 essential Dalvik opcodes |
| `src/interpreter/shim_registry.ts` | TypeScript shim method dispatch |
| `src/shim/android/app/activity.ts` | Activity lifecycle shim (+ UIBridge) |
| `src/shim/android/widget/textview.ts` | TextView shim (+ UIBridge) |
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
- **Android class hierarchy**: Activity > ContextWrapper > Context > Object; TextView > View > Object

## Android Class Hierarchy (Stage 3)

```
java.lang.Object
├── android.os.Bundle
├── android.content.Context
│     └── android.content.ContextWrapper
│           └── android.app.Activity
└── android.view.View
      ├── android.widget.TextView
      └── android.view.ViewGroup
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

## Coding Conventions

- Log format: `[CRAFT][Component][Level] Message`
- Error messages include offset/context for debugging
- ArkTS compatibility: avoid `any`, dynamic properties, `eval()`

## Test Fixtures

- `hello_world.apk` - Package: `com.example.helloworld`, Main: `MainActivity`
- Built with STORE compression (no DEFLATE)
- Regenerate: `npx ts-node tools/generate_test_fixtures.ts`

## Documentation

- `docs/specification.md` - Component specifications
- `docs/stages/stage_2_plan.md` - Interpreter implementation plan
- `docs/stages/stage_3_plan.md` - Android API shim implementation plan
