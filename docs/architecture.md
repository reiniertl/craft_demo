# CRAFT Architecture

**CRAFT** - Compatibility Runtime for Android Framework Translation

This document describes the system architecture for running Android APKs on OpenHarmony through bytecode interpretation.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        OpenHarmony System                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   CRAFT Runtime                          │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │    │
│  │  │  APK Parser  │→ │  DEX Parser  │→ │ Class Loader │   │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │    │
│  │          ↓                                    ↓          │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │              Bytecode Interpreter                 │   │    │
│  │  │   ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │   │    │
│  │  │   │ Opcodes │  │  Heap   │  │ Execution Frame │  │   │    │
│  │  │   └─────────┘  └─────────┘  └─────────────────┘  │   │    │
│  │  └──────────────────────────────────────────────────┘   │    │
│  │          ↓                                              │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │              Android API Shim Layer              │   │    │
│  │  │   Activity │ Context │ TextView │ Button │ View  │   │    │
│  │  │   ViewGroup │ LinearLayout │ Bundle             │   │    │
│  │  └──────────────────────────────────────────────────┘   │    │
│  │          ↓                                              │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │                   UI Bridge                       │   │    │
│  │  │         Android View → ArkUI Component            │   │    │
│  │  └──────────────────────────────────────────────────┘   │    │
│  │          ↓                                              │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │              OpenHarmony Host                     │   │    │
│  │  │   UIAbility │ WindowStage │ Lifecycle Bridge     │   │    │
│  │  └──────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    ArkUI Renderer                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Overview

### 1. APK Parser (Stage 1)
- **Purpose:** Extract and parse Android APK files
- **Input:** APK file (ZIP archive)
- **Output:** Manifest, DEX files, resources
- **Implementation:** `src/parser/apk_parser.ts`, `src/parser/manifest_parser.ts`

### 2. DEX Parser (Stage 1)
- **Purpose:** Parse Dalvik Executable format
- **Input:** DEX file (binary)
- **Output:** Class definitions, method code, string pool
- **Implementation:** `src/parser/dex_parser.ts`

### 3. Class Loader (Stage 1-2)
- **Purpose:** Load and resolve Java/Android classes
- **Capabilities:**
  - Resolve class hierarchies (superclass chains)
  - Find methods (direct, virtual, static)
  - Manage shim classes (synthetic TypeScript implementations)
- **Implementation:** `src/interpreter/class_loader.ts`

### 4. Bytecode Interpreter (Stage 2)
- **Purpose:** Execute Dalvik bytecode instructions
- **Capabilities:**
  - 218 opcodes (full Dalvik instruction set: move, const, return, goto, switch, comparisons, if-test, if-testz, check-cast, instance-of, new-instance, arrays, field access, invocation, unary/binary arithmetic for int/long/float/double, type conversions, monitor, literal forms)
  - Frame-based execution (local variables, operand stack)
  - Method invocation (invoke-direct, invoke-virtual, invoke-static, invoke-super)
- **Implementation:**
  - `src/interpreter/interpreter.ts` - Main interpreter loop
  - `src/interpreter/opcodes.ts` - Opcode handlers
  - `src/interpreter/frame.ts` - Execution frame management
  - `src/interpreter/heap.ts` - Object heap and garbage collection

### 5. Android API Shim Layer (Stage 3)
- **Purpose:** Provide TypeScript implementations of Android framework classes
- **Implementation Pattern:** ShimRegistry maps (className, methodName, descriptor) to handler functions
- **Classes Implemented:**
  - `android.app.Activity` - Lifecycle, content view
  - `android.content.Context` - Base application context
  - `android.content.ContextWrapper` - Context wrapper
  - `android.view.View` - Base UI component
  - `android.view.ViewGroup` - Container for child views
  - `android.widget.LinearLayout` - Linear container with orientation
  - `android.widget.TextView` - Text display component
  - `android.widget.Button` - Clickable button (extends TextView)
  - `android.widget.LinearLayout` - Linear container with orientation
  - `android.os.Bundle` - Key-value data storage
- **Implementation:** `src/shim/android/` directory tree

### 6. UI Bridge (Stage 4 - Complete)
- **Purpose:** Map Android View objects to ArkUI components
- **Capabilities:**
  - ViewNode tree structure mirroring Android View hierarchy
  - Property mapping (text, textSize, textColor, visibility)
  - Reactive state management for ArkUI rendering
- **Implementation:** `src/bridge/ui_bridge.ts`, `src/bridge/state_manager.ts`, `src/bridge/lifecycle_bridge.ts`

### 7. OpenHarmony Host (Stage 5 - Code Complete)
- **Purpose:** Wrap CRAFT runtime as OpenHarmony UIAbility
- **Capabilities:**
  - Lifecycle bridging (Activity ↔ Ability)
  - Dynamic ArkUI page rendering
  - APK loading and execution
- **Implementation:** `src/oh/entry/src/main/ets/`

---

## Data Flow

### Application Startup Flow

```
1. APK Load
   User launches CRAFT Ability
   → CraftAbility.onCreate(want)
   → APKParser.parse(apkPath)
   → Extract DEX files

2. Class Loading
   → DEXParser.parse(dexData)
   → ClassLoader.loadClass('Lcom/example/MainActivity;')
   → Resolve superclass chain (Activity → ContextWrapper → Context → Object)

3. Activity Creation
   → Interpreter.newInstance('Lcom/example/MainActivity;')
   → Allocate object on heap
   → Invoke <init> constructor

4. Lifecycle Execution
   → Activity.onCreate(bundle)
   → Execute bytecode (new TextView, setText, setContentView)
   → Android shims capture View state

5. UI Rendering (Stage 4)
   → UIBridge maps TextView to ViewNode
   → StateManager triggers ArkUI @State update
   → CraftPage.build() renders Text("Hello World")
```

### Method Invocation Flow

```
invoke-virtual #methodRef, vA, vB
  ↓
1. Interpreter resolves methodRef → (className, methodName, descriptor)
  ↓
2. ClassLoader.resolveMethod(thisRef.class, methodName, descriptor)
  ↓
3. If method is shim:
     → ShimRegistry.invoke(method, heap, args)
     → Execute TypeScript handler
     → Return result
   Else:
     → Load CodeItem from DEX
     → Create new Frame
     → Interpreter.execute(code)
```

---

## Memory Architecture

### Heap Structure

```typescript
class Heap {
  private objects: Map<number, HeapObject>;  // ref → object
  private nextRef: number;                    // monotonic reference counter
  private stringPool: Map<number, string>;    // interned strings
}

interface HeapObject {
  classDescriptor: string;                   // e.g., 'Landroid/widget/TextView;'
  fields: Map<string, Value>;                // field name → value
}
```

**Key Design Decisions:**
- Reference counting (no full GC for PoC)
- String interning for efficiency
- Fields stored as flat map (no prototype chain)
- Module-level state for special cases (Bundle data, ViewGroup children)

### Execution Frame

```typescript
interface Frame {
  method: ResolvedMethod;
  locals: Value[];           // Method parameters + local variables
  stack: Value[];            // Operand stack
  pc: number;                // Program counter (instruction index)
  caller: Frame | null;      // Call stack linkage
}
```

**Frame Lifecycle:**
1. Created on method entry (invoke-*)
2. Locals initialized with arguments
3. Stack manipulated by opcodes
4. Return value pushed to caller's stack
5. Frame popped on return

---

## Extension Points

### Adding New View Components
1. Create shim in `src/shim/android/widget/`
2. Register with ShimRegistry in `src/shim/android/index.ts`
3. Add rendering case in `CraftPage.renderView()` (Stage 4)
4. Map properties to ArkUI equivalents

### Adding New Opcodes
1. Add handler in `src/interpreter/opcodes.ts`
2. Register in opcode dispatch table
3. Add unit tests in `test/unit/interpreter/opcodes/`

### Adding New API Classes
1. Create shim file in appropriate `src/shim/android/` subdirectory
2. Register methods with ShimRegistry
3. Add to `isKnownBaseClass()` in ClassLoader if base class
4. Add superclass mapping to `getShimSuperClass()` if needed
5. Write unit tests

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | TypeScript | OpenHarmony ArkTS compatibility |
| Testing | Jest | Standard TypeScript testing framework |
| Build | npm + tsc | Standard Node.js tooling |
| Host Platform | OpenHarmony API 10+ | UIAbility model, ArkUI framework |
| Dev Environment | DevEco Studio | Official OpenHarmony IDE |

---

## Performance Characteristics

**Current Status (Stages 1-5):**
- Test suite: 565 tests in ~5 seconds
- Zero TypeScript compilation errors
- Heap allocation: ~1000 objects for Hello World scenario
- Opcode execution: ~500 instructions for Hello World

**Expected Performance (On Device):**
- APK load time: <1 second
- Activity startup: <500ms
- UI rendering: <100ms (ArkUI native performance)

**Trade-offs:**
- ✅ Simplicity: Pure interpretation, no JIT complexity
- ✅ Portability: Pure TypeScript, runs anywhere
- ❌ Speed: ~100-1000x slower than native (acceptable for PoC)
- ❌ Memory: No garbage collection (manual reference management)

---

## Security Considerations

**Sandboxing:**
- APK runs in OpenHarmony sandbox (Ability isolation)
- No native code execution (pure bytecode interpretation)
- No access to Android system services

**Validation:**
- DEX magic number verification
- Class descriptor format validation
- Method signature validation
- Heap reference bounds checking

---

## References

- [Dalvik Executable Format](https://source.android.com/devices/tech/dalvik/dex-format) - DEX file specification
- [Dalvik Bytecode](https://source.android.com/devices/tech/dalvik/dalvik-bytecode) - Opcode reference
- [OpenHarmony ArkUI](https://docs.openharmony.cn/pages/v4.0/en/application-dev/ui/arkui-overview.md) - UI framework
- [OpenHarmony UIAbility](https://docs.openharmony.cn/pages/v4.0/en/application-dev/application-models/uiability-overview.md) - Application model

---

**For detailed component specifications, see:** [specification.md](specification.md)

**Last Updated:** 2026-03-06
