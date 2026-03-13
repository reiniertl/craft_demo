# CRAFT - Compatibility Runtime for Android Framework Translation

Run Android APKs natively on OpenHarmony through bytecode interpretation.

---

## Project Status

**Current Stage:** 5 - Complete (All Stages Done)

| Stage | Component | Status | Tests |
|-------|-----------|--------|-------|
| **1** | APK/DEX Parsing & Class Loading | ✅ Complete | 58 / 58 |
| **2** | Bytecode Interpreter & java.lang Shims | ✅ Complete | 118 / 118 |
| **3** | Android API Shim Layer | ✅ Complete | 35 / 35 |
| **4** | UI Bridge & OpenHarmony Host | ✅ Complete | 55 / 55 |
| **5** | Integration & Polish | ✅ Complete | 785 total |

**Total:** 785 tests passing | 0 TypeScript errors | 0 regressions | 218 opcodes implemented

**Stage 5 Status:**
- ✅ All code implementation complete (EntryAbility.ets, CraftPage.ets, runtime integration)
- ✅ HAP built, signed, and deployed
- ✅ APK rebuilt with full TextView creation
- ✅ HarmonyOS device testing successful (Feb 24)

📋 **See [Stage 5 Status](docs/stage_5_status.md) for complete deployment guide and what requires human intervention**

---

## Quick Start

### For New Developers

1. **Read the overview:** [Requirements](docs/requirements.md) - Project goals and constraints
2. **Understand the architecture:** [Architecture](docs/architecture.md) - System design
3. **Review implementation plan:** [Implementation Plan](docs/implementation_plan.md) - Stage-by-stage roadmap
4. **Check current progress:** [Stage 5 Status](docs/stage_5_status.md) - Deployment guide and current status

### For Claude Code / AI Agents

- **Read first:** [CLAUDE.md](CLAUDE.md) - Complete project context and current stage

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
craft/
├── README.md                   # This file - project overview
├── CLAUDE.md                   # AI agent context
├── docs/                       # All documentation
│   ├── index.md               # Navigation hub
│   ├── requirements.md        # Project goals & success criteria
│   ├── architecture.md        # System design & data flow
│   ├── specification.md       # Component specifications
│   ├── implementation_plan.md # 5-stage roadmap
│   ├── tools_guide.md         # 14 development tools reference
│   ├── deployment_guide.md    # HAP/device deployment
│   ├── apk_build_guide.md     # Demo APK building (HelloWorld + Calculator)
│   ├── hap_build_guide.md     # HAP building guide
│   ├── stage_5_status.md      # Deployment status
│   ├── stages/                # Stage-specific docs
│   └── specs/                 # Shim layer specifications
│       ├── INDEX.md           # Master index, ViewNode key registry, class hierarchy
│       ├── java_lang_*.md     # JL-1..JL-5: java.lang shim specs
│       ├── android_*.md       # A-1..A-4, V-1..V-5: Android shim specs
│       └── formal/            # Machine-checkable formal specs
│           ├── *.jml          # JML pre/post conditions (Android shims)
│           └── *.als          # Alloy structural models
├── demo/                       # Demo app Java sources
│   ├── hello_world/           # Simple Hello World app
│   ├── calculator/            # Calculator with button grid
│   └── clock/                 # Clock (System.currentTimeMillis)
├── src/                        # Source code
│   ├── parser/                # APK & DEX parsers
│   ├── interpreter/           # Bytecode interpreter (218 opcodes)
│   ├── shim/                  # API shims (java.lang + android.*)
│   ├── bridge/                # UI Bridge (View → ArkUI mapping)
│   ├── core/                  # Core types & utilities
│   ├── contracts/             # Runtime contract enforcement (TypeScript translation of JML)
│   ├── runtime.ts             # High-level CRAFT API
│   └── oh/                    # OpenHarmony HAP project
├── test/                       # Test suite (785 tests, 38 files)
│   ├── unit/                  # Unit tests
│   │   └── contracts/         # JML spec compliance tests
│   ├── integration/           # Integration tests
│   ├── helpers/               # Test utilities
│   └── fixtures/              # Built APKs & test data
└── tools/                      # Development tools (14 skills)
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
- 218 Dalvik opcodes implemented (full instruction set)
- Frame-based execution (locals, stack, PC)
- Heap with object allocation and field storage
- java.lang shims (Object, String, StringBuilder, System, Class)
- Method invocation (direct, virtual, static, super, interface)

**Tests:** 118 passing | **Files:** 13 source, 14 test

### ✅ Stage 3: Android API Shims (Complete)

**Deliverables:**
- 9 Android classes: Activity, Context, ContextWrapper, View, ViewGroup, TextView, Button, LinearLayout, Bundle
- 41 Android methods implemented
- Correct superclass chains for virtual dispatch
- Activity lifecycle methods (onCreate, onStart, onResume, onPause, onStop, onDestroy)
- TextView with text storage (setText, getText, setTextSize, setTextColor)

**Tests:** 35 passing (29 unit + 6 integration) | **Files:** 8 source, 2 test

### ✅ Stage 4: UI Bridge & OpenHarmony Host (Complete)

**Deliverables:**
- UI Bridge: Maps Android Views to ArkUI ViewNode tree
- State Manager: Reactive state management with observable pattern
- Lifecycle Bridge: Activity ↔ Ability lifecycle mapping
- CraftRuntime: High-level API wrapper for all components
- Shim Integration: TextView and Activity wired to UIBridge
- **Achievement:** Android View updates trigger ArkUI re-renders

**Tests:** 55 passing (34 bridge + 13 lifecycle + 8 integration) | **Files:** 8 source, 4 test

### ✅ Stage 5: Integration & Polish (Complete)

**Deliverables:**
- OpenHarmony host implementation (EntryAbility.ets, CraftPage.ets)
- TypeScript packaging for ArkTS consumption
- instance-of opcode (0x20) added
- Comprehensive deployment documentation
- Development tools

**Status:** Complete | Tested on HarmonyOS device Feb 24

---

## Development

### Prerequisites

- **Node.js:** v18+ (for TypeScript compilation and Jest testing)
- **npm:** v8+ (package manager)
- **DevEco Studio:** For OpenHarmony development (Stage 4+)
- **OpenHarmony SDK:** API 10+ (Stage 4+)

### Setup

```bash
cd craft

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
# Run all tests
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
npm test -- test/unit/     # Unit tests only
npm test -- test/integration/  # Integration tests only

# Type checking
npx tsc --noEmit           # Run tsc --noEmit

# Development tools (see tools/README.md)
npm run craft-test -- --component parser    # Run parser tests
npm run analyze-apk test/fixtures/hello_world.apk  # Analyze APK
npm run dex-dump test/fixtures/hello_world.dex      # Inspect DEX
```

---

## Key Metrics

| Metric | Value |
|--------|-------|
| **Stages Complete** | 5 / 5 ✅ |
| **Tests** | 785 passing |
| **TypeScript Errors** | 0 |
| **Regressions** | 0 |
| **Opcodes Implemented** | 218 |
| **Java Classes Shimmed** | 5 (java.lang.*) |
| **Android Classes Shimmed** | 9 (android.*) |
| **Total Methods Shimmed** | 73 (32 java.lang + 41 android) |
| **Source Files** | 39 |
| **Test Files** | 38 |
| **Lines of Code** | ~25,220 (9,307 src + 10,897 test + 5,016 tools) |

---

## Technical Highlights

### Bytecode Interpretation

CRAFT implements a frame-based Dalvik bytecode interpreter with:
- **218 opcodes:** Full Dalvik instruction set including move, const, return, goto, switch, comparisons, if-test, if-testz, check-cast, instance-of, arrays, field access (instance + static), invocation (5 types + range variants), unary/binary arithmetic (int/long/float/double), type conversions, literal forms
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

### External References
- [Dalvik Executable Format](https://source.android.com/devices/tech/dalvik/dex-format)
- [Dalvik Bytecode Reference](https://source.android.com/devices/tech/dalvik/dalvik-bytecode)
- [OpenHarmony ArkUI Documentation](https://docs.openharmony.cn/pages/v4.0/en/application-dev/ui/arkui-overview.md)
- [OpenHarmony UIAbility](https://docs.openharmony.cn/pages/v4.0/en/application-dev/application-models/uiability-overview.md)

---

## License

MIT

---

## Contact

[Project contact information to be added]

---

**Status:** 5 of 5 stages complete | 785 tests passing | APK built & verified | HarmonyOS device tested ✅
**Last Updated:** 2026-03-13
**Version:** 0.1.0
