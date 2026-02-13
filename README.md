# CRAFT - Compatibility Runtime for Android Framework Translation

Run Android APKs natively on OpenHarmony through bytecode interpretation.

---

## Project Status

**Current Stage:** 5 In Progress (Code Complete, Needs Device Testing)

| Stage | Component | Status | Tests |
|-------|-----------|--------|-------|
| **1** | APK/DEX Parsing & Class Loading | ✅ Complete | 58 / 58 |
| **2** | Bytecode Interpreter & java.lang Shims | ✅ Complete | 115 / 115 |
| **3** | Android API Shim Layer | ✅ Complete | 35 / 35 |
| **4** | UI Bridge & OpenHarmony Host | ✅ Complete | 55 / 55 |
| **5** | Integration & Polish | 🚧 In Progress | 266 / 266 |

**Total:** 266 tests passing | 0 TypeScript errors | 0 regressions | 28 opcodes implemented

**Stage 5 Progress:**
- ✅ Opcode 0x20 (instance-of) implemented
- ✅ CraftAbility.ets updated with full runtime
- ✅ CraftPage.ets for dynamic UI rendering
- ✅ TypeScript runtime packaged for ArkTS
- ✅ Completed APK source files ready (Stage 1 stub needs recompilation)
- ⚠️ APK recompilation (blocked - needs Android SDK)
- ⚠️ Device testing (blocked - needs OpenHarmony device)
- ⚠️ Performance profiling (blocked - needs device)

**Note:** Stage 1 created a minimal stub APK (just `super.onCreate()`). Source files for the completed version (with TextView, setText, setContentView) are ready in `test/fixtures/` but need Android SDK to compile.

---

## Quick Start

### For New Developers

1. **Read the overview:** [Requirements](docs/requirements.md) - Project goals and constraints
2. **Understand the architecture:** [Architecture](docs/architecture.md) - System design
3. **Review implementation plan:** [Implementation Plan](docs/implementation_plan.md) - Stage-by-stage roadmap
4. **Check current progress:** [Stage 3 Results](docs/stages/stage_3_results.md) - Latest completion status

### For Claude Code / AI Agents

- **Read first:** [CLAUDE.md](craft/CLAUDE.md) - Complete project context and current stage

### Documentation Index

📚 **[Full Documentation Index](docs/index.md)** - Complete navigation to all documentation

---

## What is CRAFT?

CRAFT is a compatibility layer enabling OpenHarmony to run Android APKs through pure bytecode interpretation.

**Key Features:**
- ✅ **No JIT/AOT:** Pure interpretation for simplicity and security
- ✅ **Native UI:** Renders through OpenHarmony's ArkUI framework
- ✅ **Minimal API Surface:** Only implements what's needed for "Hello World" PoC
- ✅ **TypeScript/ArkTS:** Runs entirely in OpenHarmony's native runtime

**Architecture:**
```
Android APK → DEX Parser → Bytecode Interpreter → Android API Shims
                                    ↓
                               UI Bridge
                                    ↓
                       OpenHarmony ArkUI Renderer
```

---

## Project Structure

```
/mnt/d/craft/
├── README.md                   # This file - project overview
├── docs/                       # 📚 All documentation
│   ├── index.md               # Navigation hub
│   ├── requirements.md        # Project goals & success criteria
│   ├── architecture.md        # System design & data flow
│   ├── specification.md       # Component specifications
│   ├── implementation_plan.md # 5-stage roadmap
│   └── stages/                # Stage-specific docs
│       ├── stage_1_results.md # APK/DEX parsing complete
│       ├── stage_2_plan.md    # Interpreter design (196KB detailed spec)
│       ├── stage_2_results.md # Interpreter complete
│       ├── stage_3_plan.md    # Android API shims design
│       ├── stage_3_results.md # Android API shims complete
│       └── stage_4_plan.md    # UI Bridge & OpenHarmony host design
│
├── craft/                      # Implementation codebase
│   ├── src/                   # Source code
│   │   ├── parser/            # APK & DEX parsers
│   │   ├── interpreter/       # Bytecode interpreter
│   │   ├── shim/              # API shims (java.lang, android.*)
│   │   ├── core/              # Core types
│   │   └── utils/             # Utilities
│   ├── test/                  # Test suite (208 tests)
│   │   ├── unit/              # Unit tests
│   │   ├── integration/       # Integration tests
│   │   └── fixtures/          # Test APKs & data
│   ├── CLAUDE.md              # AI agent context
│   └── README.md              # Quick reference
│
├── android/                    # Android AOSP (reference only)
└── oh/                         # OpenHarmony SDK (reference only)
```

---

## Implementation Progress

### ✅ Stage 1: APK/DEX Parsing (Complete)

**Deliverables:**
- APK file extraction (ZIP)
- AndroidManifest.xml parsing (binary XML)
- DEX format parsing (header, strings, types, classes, methods, code)
- Class loader with superclass resolution

**Tests:** 58 passing | **Files:** 6 source, 6 test

### ✅ Stage 2: Bytecode Interpreter (Complete)

**Deliverables:**
- 26 Dalvik opcodes implemented
- Frame-based execution (locals, stack, PC)
- Heap with object allocation and field storage
- java.lang shims (Object, String, Integer, StringBuilder, System, Class)
- Method invocation (direct, virtual, static, super)

**Tests:** 115 passing | **Files:** 13 source, 14 test

### ✅ Stage 3: Android API Shims (Complete)

**Deliverables:**
- 7 Android classes: Activity, Context, ContextWrapper, View, ViewGroup, TextView, Bundle
- 35 Android methods implemented
- Correct superclass chains for virtual dispatch
- Activity lifecycle methods (onCreate, onStart, onResume, onPause, onStop, onDestroy)
- TextView with text storage (setText, getText, setTextSize, setTextColor)

**Tests:** 35 passing (32 unit + 3 integration + 6 verification) | **Files:** 8 source, 2 test

### ✅ Stage 4: UI Bridge & OpenHarmony Host (Complete)

**Deliverables:**
- UI Bridge: Maps Android Views to ArkUI ViewNode tree
- State Manager: Reactive state management with observable pattern
- Lifecycle Bridge: Activity ↔ Ability lifecycle mapping
- CraftRuntime: High-level API wrapper for all components
- Shim Integration: TextView and Activity wired to UIBridge
- **Achievement:** Android View updates trigger ArkUI re-renders

**Tests:** 55 passing (34 bridge + 13 lifecycle + 8 integration) | **Files:** 8 source, 4 test

### 🚧 Stage 5: Integration & Polish (Next)

**Planned Deliverables:**
- OpenHarmony host implementation (CraftAbility.ets, CraftPage.ets)
- Visual confirmation on OpenHarmony device/emulator
- End-to-end integration testing with real APK
- Performance profiling and optimization
- Final documentation and demo preparation
- Working PoC demonstration with "Hello World" on screen

**Estimated:** ~1-2 weeks | **Requires:** OpenHarmony DevEco Studio environment

---

## Development

### Prerequisites

- **Node.js:** v18+ (for TypeScript compilation and Jest testing)
- **npm:** v8+ (package manager)
- **DevEco Studio:** For OpenHarmony development (Stage 4+)
- **OpenHarmony SDK:** API 10+ (Stage 4+)

### Setup

```bash
cd /mnt/d/craft/craft

# Install dependencies (none currently - zero dependency project)
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Run specific test suite
npm test -- test/unit/parser/dex_parser.test.ts

# Type check (no compilation)
npx tsc --noEmit
```

### Testing

```bash
# Run all 208 tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run only Stage 3 tests
npm test -- test/unit/shim/android_api.test.ts
npm test -- test/integration/android/
```

### Project Commands

```bash
# Build
npm run build              # Compile TypeScript to dist/

# Test
npm test                   # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only

# Type checking
npm run typecheck          # Run tsc --noEmit

# Linting (future)
npm run lint              # ESLint (not yet configured)
```

---

## Key Metrics

| Metric | Value |
|--------|-------|
| **Stages Complete** | 4 / 5 |
| **Tests Passing** | 263 / 263 (100%) |
| **TypeScript Errors** | 0 |
| **Regressions** | 0 |
| **Opcodes Implemented** | 27 |
| **Java Classes Shimmed** | 6 (java.lang.*) |
| **Android Classes Shimmed** | 7 (android.*) |
| **Total Methods Shimmed** | 66 (31 java.lang + 35 android) |
| **Source Files** | 43 |
| **Test Files** | 26 |
| **Total Lines of Code** | ~5,150 |

---

## Technical Highlights

### Bytecode Interpretation

CRAFT implements a frame-based Dalvik bytecode interpreter with:
- **27 opcodes:** move, const, return, return-wide, arithmetic, conditionals, invocation
- **Virtual dispatch:** Correct superclass chain resolution (Activity → ContextWrapper → Context → Object)
- **Heap management:** Reference-based object storage with field access
- **String interning:** Efficient string pool for constants

### Android API Shims

Shim pattern example (TextView.setText):
```typescript
registry.register('Landroid/widget/TextView;', 'setText', '(Ljava/lang/CharSequence;)V',
  (interp, heap, thisRef, args) => {
    heap.setField(thisRef, 'mText', args[0]);
    return NULL_VALUE;
  }
);
```

### UI Bridge & Reactive Rendering

CRAFT's UI Bridge connects Android Views to OpenHarmony's ArkUI:
- **ViewNode mapping:** Android View objects → ArkUI component tree
- **Reactive state:** Observable pattern with version-based change detection
- **Property tracking:** setText(), setTextSize(), setTextColor() → UIBridge updates
- **State serialization:** ViewNode (Map) → SerializedView (POJO) for ArkUI
- **Lifecycle mapping:** Activity ↔ Ability lifecycle bridging

### Hello World Execution Flow

```
1. DEXParser.parse(hello_world.dex)
2. ClassLoader.loadClass('Lcom/example/MainActivity;')
3. LifecycleBridge.createActivity(MainActivity)
4. Interpreter.invoke(MainActivity.onCreate, [bundle])
   → new TextView(this)
   → textView.setText("Hello World")
   → setContentView(textView)
5. TextView shim → UIBridge.updateViewProperty('text', 'Hello World')
6. Activity shim → UIBridge.setRootView(textViewRef)
7. StateManager.notifyUpdate() → increments version
8. ArkUI @State updates → build() re-renders
9. Text("Hello World") appears on screen
```

---

## Contributing

This project is currently in proof-of-concept stage with AI-assisted development (Claude Code).

**Development Guidelines:**
- All code in TypeScript (strict mode)
- Zero external dependencies (except devDependencies)
- 100% test coverage for core components
- No regressions allowed (all prior tests must pass)
- Document all public APIs

---

## References

### Documentation
- **[Documentation Index](docs/index.md)** - Complete navigation
- **[Architecture](docs/architecture.md)** - System design
- **[Specification](docs/specification.md)** - Component specs
- **[CRAFT_SPECIFICATION.md](CRAFT_SPECIFICATION.md)** - Comprehensive 1400+ line detailed spec

### External References
- [Dalvik Executable Format](https://source.android.com/devices/tech/dalvik/dex-format)
- [Dalvik Bytecode Reference](https://source.android.com/devices/tech/dalvik/dalvik-bytecode)
- [OpenHarmony ArkUI Documentation](https://docs.openharmony.cn/pages/v4.0/en/application-dev/ui/arkui-overview.md)
- [OpenHarmony UIAbility](https://docs.openharmony.cn/pages/v4.0/en/application-dev/application-models/uiability-overview.md)

---

## License

[To be determined]

---

## Contact

[Project contact information to be added]

---

**Status:** 4 of 5 stages complete | 263 tests passing | Ready for OpenHarmony Integration
**Last Updated:** 2026-02-13
**Version:** 1.2.0 (Post-Stage 4 UI Bridge)
