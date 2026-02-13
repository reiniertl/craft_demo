# CRAFT Project Context

CRAFT (Compatible Runtime for Android on Fuchsia/Trusty) - An Android APK parser and runtime for OpenHarmony.

## Current Stage: 3 Complete, Stage 4 Next

**Status:** 208 tests passing | 0 TypeScript errors | 0 regressions

Stage 1: APK/DEX/Manifest parsing ✅
Stage 2: Bytecode interpretation ✅
Stage 3: Android API shims ✅
Stage 4: UI Bridge & OpenHarmony host 🚧 (next)

## 📚 Documentation (Reorganized 2026-02-12)

**All documentation now centralized in `/mnt/d/craft/docs/` with consistent snake_case naming:**

- **Main entry:** `/mnt/d/craft/README.md` - Project overview
- **Documentation hub:** `/mnt/d/craft/docs/index.md` - Complete navigation
- **Requirements:** `docs/requirements.md` - Goals, constraints, success criteria
- **Architecture:** `docs/architecture.md` - System design, data flow
- **Specification:** `docs/specification.md` - Component specs
- **Implementation plan:** `docs/implementation_plan.md` - 5-stage roadmap
- **Stage plans:** `docs/stages/stage_N_plan.md` - Detailed planning for each stage
- **Stage results:** `docs/stages/stage_N_results.md` - Completion reports

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

# TypeScript check
npx tsc --noEmit
```

## 🔧 Development Skills

Five core skills are available to accelerate development:

1. **`craft-test`** - Run tests with component filtering
2. **`gen-shim`** - Generate Android API shim implementations
3. **`gen-opcode`** - Generate opcode handler implementations
4. **`dex-dump`** - Dump and analyze DEX file contents
5. **`analyze-apk`** - Analyze APK requirements and complexity

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
│   ├── opcodes.ts         # 26 essential opcode implementations
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
│       ├── widget/textview.ts   # android.widget.TextView
│       ├── app/activity.ts      # android.app.Activity
│       └── index.ts             # Registration
├── bridge/         # UI Bridge (Stage 4 - empty)
└── oh/             # OpenHarmony ability (excluded from desktop build)

tools/
└── dex_dumper.ts   # CLI tool for DEX inspection

test/
├── fixtures/       # hello_world.apk, .dex, manifest_binary.xml
├── unit/           # 208 unit tests (58 Stage 1 + 115 Stage 2 + 35 Stage 3)
│   ├── interpreter/  # heap, frame, opcodes, shim_registry, interpreter
│   └── shim/         # java.lang.* and android.* shim tests
└── integration/    # (included in unit count above)
    ├── interpreter/  # Interpreter integration tests
    └── android/      # Activity lifecycle integration tests
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
| `src/interpreter/opcodes.ts` | 26 essential Dalvik opcodes |
| `src/interpreter/shim_registry.ts` | TypeScript shim method dispatch |
| `src/shim/android/app/activity.ts` | Activity lifecycle shim |
| `src/shim/android/widget/textview.ts` | TextView shim |
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

- `hello_world.apk` - Package: `com.example.hello`, Main: `MainActivity`
- Built with STORE compression (no DEFLATE)
- Regenerate: `npx ts-node tools/generate_test_fixtures.ts`

## Documentation

- `docs/stage1_specification.md` - Detailed file format specs and interfaces
- `Stage_2.md` - Interpreter implementation plan
- `Stage_3.md` - Android API shim implementation plan
