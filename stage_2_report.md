# Stage 2 Implementation Report — Dalvik Bytecode Interpreter

**Project:** CRAFT (Compatible Runtime for Android on Fuchsia/Trusty)
**Stage:** 2 — Bytecode Interpreter
**Date:** 2026-02-12
**Status:** Complete

---

## 1. Overview

Stage 2 adds a register-based Dalvik bytecode interpreter to CRAFT. The interpreter executes DEX bytecode parsed by the Stage 1 DexParser, supports virtual dispatch across class hierarchies, and delegates Java standard library calls to a TypeScript shim layer. All 173 tests pass (58 Stage 1 + 115 Stage 2) with zero TypeScript errors.

---

## 2. Deliverables Summary

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Interpreter execution loop | Done | `src/interpreter/interpreter.ts` |
| Heap (objects, arrays, strings) | Done | `src/interpreter/heap.ts` |
| Frame manager (call stack) | Done | `src/interpreter/frame.ts` |
| Class loader & method resolution | Done | `src/interpreter/class_loader.ts` |
| Virtual dispatch with caching | Done | `src/interpreter/method_resolver.ts` |
| 26 essential opcodes | Done | `src/interpreter/opcodes.ts` |
| Opcode dispatch table | Done | `src/interpreter/opcode_table.ts` |
| Shim registry | Done | `src/interpreter/shim_registry.ts` |
| java.lang.Object shim | Done | `src/shim/java/lang/object.ts` |
| java.lang.String shim | Done | `src/shim/java/lang/string.ts` |
| java.lang.StringBuilder shim | Done | `src/shim/java/lang/string_builder.ts` |
| java.lang.Class shim | Done | `src/shim/java/lang/class.ts` |
| java.lang.System shim | Done | `src/shim/java/lang/system.ts` |
| Exception hierarchy | Done | `src/interpreter/errors.ts` |
| Unit tests | Done | 7 test files, 115 tests |
| Integration tests | Done | 8 test scenarios |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Interpreter                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  Frame   │  │  Opcode  │  │  Method Resolver  │  │
│  │ Manager  │  │  Table   │  │   (cached vtable) │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │   Heap   │  │  Class   │  │  Shim Registry    │  │
│  │          │  │  Loader  │  │  (java.lang.*)    │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
              ┌─────────┴─────────┐
              │    DexParser       │
              │    (Stage 1)       │
              └────────────────────┘
```

### Key Design Decisions

- **Register-based execution**: Each frame owns a `Value[]` register array. Arguments are placed in the last N registers (`registersSize - insSize`), matching the Dalvik calling convention.
- **Circular dependency resolution**: `InterpreterRef` and `ClassLoaderRef` interfaces in `shim_registry.ts` break the Interpreter ↔ ShimRegistry cycle. A `setClinitRunner()` callback breaks the Interpreter ↔ ClassLoader cycle.
- **Shim dispatch**: ShimRegistry maps `(class, method, descriptor)` → TypeScript function. Instance method shims automatically extract the `this` reference from the first argument.
- **Virtual dispatch**: `resolveVirtualMethod()` walks the class hierarchy upward to find the most-derived implementation. Results are cached in MethodResolver.
- **String interning**: `Heap.internString()` ensures identical string content returns the same heap reference, matching Java semantics.
- **Stack depth limit**: 256 frames maximum, preventing runaway recursion.

---

## 4. Opcodes Implemented (26)

| Opcode | Hex | Format | Description |
|--------|-----|--------|-------------|
| nop | 0x00 | 10x | No operation |
| move | 0x01 | 12x | Copy register |
| move-object | 0x07 | 12x | Copy object reference |
| move-result | 0x0a | 11x | Capture method return value |
| move-result-object | 0x0c | 11x | Capture object return value |
| return-void | 0x0e | 10x | Return void |
| return | 0x0f | 11x | Return int/float value |
| return-object | 0x11 | 11x | Return object reference |
| const/4 | 0x12 | 11n | Load 4-bit signed constant |
| const/16 | 0x13 | 21s | Load 16-bit signed constant |
| const | 0x14 | 31i | Load 32-bit constant |
| const-string | 0x1a | 21c | Load string from pool |
| const-class | 0x1c | 21c | Load class object |
| new-instance | 0x22 | 21c | Allocate new object |
| iget | 0x52 | 22c | Read instance int field |
| iget-object | 0x54 | 22c | Read instance object field |
| iput | 0x59 | 22c | Write instance int field |
| iput-object | 0x5b | 22c | Write instance object field |
| sget | 0x60 | 21c | Read static int field |
| sget-object | 0x62 | 21c | Read static object field |
| sput | 0x67 | 21c | Write static int field |
| sput-object | 0x69 | 21c | Write static object field |
| invoke-virtual | 0x6e | 35c | Virtual method dispatch |
| invoke-super | 0x6f | 35c | Parent class method call |
| invoke-direct | 0x70 | 35c | Direct method call (constructors, private) |
| invoke-static | 0x71 | 35c | Static method call |

---

## 5. Shim Layer

### 5 Classes, 31 Methods

**java.lang.Object** (5 methods)
- `<init>()V` — No-op constructor
- `getClass()Ljava/lang/Class;` — Returns class object for descriptor
- `hashCode()I` — Returns heap reference as hash
- `equals(Ljava/lang/Object;)Z` — Reference equality
- `toString()Ljava/lang/String;` — Returns `ClassName@hexRef`

**java.lang.String** (12 methods)
- `<init>()V` — Empty string init
- `<init>(Ljava/lang/String;)V` — Copy constructor
- `length()I` — String length
- `charAt(I)C` — Character at index
- `equals(Ljava/lang/Object;)Z` — Content equality
- `hashCode()I` — Java string hash algorithm
- `toString()Ljava/lang/String;` — Returns self
- `substring(I)Ljava/lang/String;` — Substring from index
- `substring(II)Ljava/lang/String;` — Substring range
- `concat(Ljava/lang/String;)Ljava/lang/String;` — String concatenation
- `valueOf(I)Ljava/lang/String;` — Int to string (static)
- `valueOf(Ljava/lang/Object;)Ljava/lang/String;` — Object to string (static)

**java.lang.StringBuilder** (7 methods)
- `<init>()V` — Initialize empty builder
- `<init>(Ljava/lang/String;)V` — Initialize with string
- `append(Ljava/lang/String;)Ljava/lang/StringBuilder;` — Append string
- `append(I)Ljava/lang/StringBuilder;` — Append integer
- `append(Ljava/lang/Object;)Ljava/lang/StringBuilder;` — Append object via toString
- `toString()Ljava/lang/String;` — Build final string
- `length()I` — Current content length

**java.lang.Class** (3 methods)
- `getName()Ljava/lang/String;` — Fully qualified name (`Lcom/example/Foo;` → `com.example.Foo`)
- `getSimpleName()Ljava/lang/String;` — Short name (`Foo`)
- `toString()Ljava/lang/String;` — Prefixed with `class `

**java.lang.System** (3 methods)
- `currentTimeMillis()J` — Epoch milliseconds (as bigint)
- `identityHashCode(Ljava/lang/Object;)I` — Heap ref as hash
- `arraycopy(Ljava/lang/Object;ILjava/lang/Object;II)V` — Array region copy

---

## 6. Exception Hierarchy

```
InterpreterError (base)
├── NullPointerException
├── NoSuchMethodError
├── AbstractMethodError
├── ClassNotFoundException
├── VerifyError
├── ArrayIndexOutOfBoundsException
├── StringIndexOutOfBoundsException
├── ArithmeticException
└── IllegalArgumentException
```

All exceptions extend `InterpreterError`, which extends the Stage 1 `CraftError` base class.

---

## 7. File Inventory

### Source Files (17 files, ~2,440 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `src/interpreter/class_loader.ts` | 576 | Class/method/field resolution, static fields |
| `src/interpreter/opcodes.ts` | 474 | 26 opcode handler implementations |
| `src/interpreter/interpreter.ts` | 198 | Main execution loop |
| `src/interpreter/heap.ts` | 166 | Object/array/string allocation |
| `src/interpreter/opcode_table.ts` | 106 | Dispatch table and instruction format helpers |
| `src/interpreter/shim_registry.ts` | 103 | Shim method registry and dispatch |
| `src/interpreter/frame.ts` | 93 | Execution frame management |
| `src/interpreter/errors.ts` | 76 | 10 exception classes |
| `src/interpreter/method_resolver.ts` | 61 | Virtual dispatch with caching |
| `src/interpreter/types.ts` | 58 | Type definitions and helpers |
| `src/interpreter/shim_init.ts` | 14 | Registry initialization entry point |
| `src/shim/java/lang/string.ts` | 169 | java.lang.String shim |
| `src/shim/java/lang/string_builder.ts` | 148 | java.lang.StringBuilder shim |
| `src/shim/java/lang/object.ts` | 61 | java.lang.Object shim |
| `src/shim/java/lang/class.ts` | 60 | java.lang.Class shim |
| `src/shim/java/lang/system.ts` | 57 | java.lang.System shim |
| `src/shim/java/lang/index.ts` | 20 | Shim registration index |

### Test Files (16 files, ~2,661 lines)

| File | Lines | Tests | Scope |
|------|-------|-------|-------|
| `test/unit/interpreter/opcodes.test.ts` | 527 | 21+ | All 26 opcodes |
| `test/unit/interpreter/interpreter.test.ts` | 462 | 6 | End-to-end interpreter |
| `test/unit/shim/java_lang.test.ts` | 426 | 30 | All 5 shim classes |
| `test/unit/interpreter/class_loader.test.ts` | 369 | 9 | Class/method resolution |
| `test/integration/interpreter/test_helpers.ts` | 174 | — | Shared test utilities |
| `test/unit/interpreter/frame.test.ts` | 140 | 9 | Frame management |
| `test/unit/interpreter/heap.test.ts` | 137 | 13 | Heap operations |
| `test/unit/interpreter/shim_registry.test.ts` | 105 | 6 | Shim dispatch |
| `test/integration/interpreter/string_builder.test.ts` | 56 | 1 | StringBuilder chain |
| `test/integration/interpreter/super_call.test.ts` | 48 | 1 | invoke-super dispatch |
| `test/integration/interpreter/field_access.test.ts` | 44 | 1 | iput/iget sequence |
| `test/integration/interpreter/method_calls.test.ts` | 41 | 1 | Cross-method calls |
| `test/integration/interpreter/static_field.test.ts` | 38 | 1 | sput/sget sequence |
| `test/integration/interpreter/static_method.test.ts` | 38 | 1 | invoke-static across classes |
| `test/integration/interpreter/object_creation.test.ts` | 33 | 1 | new-instance + init |
| `test/integration/interpreter/simple_method.test.ts` | 23 | 1 | Minimal const + return |

### Modified Existing Files

| File | Change |
|------|--------|
| `src/index.ts` | Added Stage 2 public API exports |
| `CLAUDE.md` | Updated project context for Stage 2 |

**No Stage 1 source or test files were modified.**

---

## 8. Test Results

```
Test Suites: 20 passed, 20 total
Tests:       173 passed, 173 total
Snapshots:   0 total
Time:        3.331 s
```

### Breakdown

| Category | Suites | Tests |
|----------|--------|-------|
| Stage 1 (unchanged) | 6 | 58 |
| Stage 2 Unit | 7 | 107 |
| Stage 2 Integration | 8 | 8 |
| **Total** | **20** | **173** |

### Unit Test Coverage

| Test Suite | Tests | What It Covers |
|------------|-------|----------------|
| heap.test.ts | 13 | Object allocation, field get/set, arrays, strings, interning, type checking |
| frame.test.ts | 9 | Frame creation, argument placement, wide values, stack push/pop, stack trace, depth limit |
| opcodes.test.ts | 21+ | All 26 opcodes with mock execution context |
| shim_registry.test.ts | 6 | Registration, lookup, instance/static dispatch, error handling |
| interpreter.test.ts | 6 | Synthetic DEX execution: const+return, return-void, object creation, shim calls, StringBuilder |
| class_loader.test.ts | 9 | DEX loading, superclass chains, ClassNotFoundException, shim classes, method resolution, virtual dispatch with override, virtual dispatch inheritance, static fields, class initialization |
| java_lang.test.ts | 30 | Object (6), String (11), StringBuilder (6), Class (3), System (4) |

### Integration Test Scenarios

| Test | Bytecode Flow | Verifies |
|------|---------------|----------|
| simple_method | `const/4 v0, 5` → `return v0` | Basic instruction decode and return |
| object_creation | `new-instance` → `invoke-direct <init>` → `return-object` | Object lifecycle |
| field_access | `new-instance` → `iput` → `iget` → `return` | Instance field read/write |
| static_field | `const/16` → `sput` → `sget` → `return` | Static field storage |
| method_calls | Method A calls Method B via `invoke-static` → `move-result` | Cross-method invocation |
| static_method | `invoke-static` across two different classes | Inter-class calls |
| string_builder | Shim `<init>` → 3x `append` → `toString` | Shim integration, string building |
| super_call | Child overrides `getValue`, calls `invoke-super` → parent returns 10 | Virtual dispatch, super resolution |

---

## 9. Issues Encountered and Resolved

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Duplicate NullPointerException class | Local class in `class_loader.ts` conflicted with import from `errors.ts` | Removed duplicate, used import |
| TypeScript error in interpreter test | `this.getClassDefs()` in mock object literal lacked type context | Extracted to standalone function |
| super_call test failure | `const/4` with value 10 (0xA) sign-extends to -6 in 4-bit signed format | Changed to `const/16 v0, 10` |
| Circular dependency (Interpreter ↔ ShimRegistry) | Shims need to call interpreter; interpreter uses shim registry | Introduced `InterpreterRef`/`ClassLoaderRef` interfaces |
| Circular dependency (Interpreter ↔ ClassLoader) | Class init (`<clinit>`) needs interpreter; interpreter uses class loader | `setClinitRunner()` callback pattern |

---

## 10. Metrics Summary

| Metric | Value |
|--------|-------|
| Source files created | 17 |
| Source lines written | ~2,440 |
| Test files created | 16 |
| Test lines written | ~2,661 |
| Total new lines | ~5,101 |
| Opcodes implemented | 26 |
| Shim classes | 5 |
| Shimmed methods | 31 |
| Exception classes | 10 |
| Tests passing | 173 / 173 |
| TypeScript errors | 0 |
| Stage 1 regressions | 0 |
