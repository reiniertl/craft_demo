# Android to OpenHarmony Compatibility Framework
## Comprehensive Development Specification

**Project Codename:** CRAFT (Compatibility Runtime for Android Framework Translation)

**Version:** 0.1.0
**Last Updated:** 2026-02-17
**Status:** Stages 1-5 Code Complete, Awaiting APK recompilation & device testing

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Project Structure](#3-project-structure)
4. [Component Specifications](#4-component-specifications)
   - 4.1 APK Parser
   - 4.2 DEX Parser
   - 4.3 Bytecode Interpreter
   - 4.4 Android API Shim Layer
   - 4.5 UI Bridge
   - 4.6 OpenHarmony Host
5. [Data Flow & Integration](#5-data-flow--integration)
6. [Implementation Stages](#6-implementation-stages)
7. [Testing Strategy](#7-testing-strategy)
8. [Extension Points](#8-extension-points)

---

## 1. Executive Summary

### 1.1 Goal
Create a compatibility layer enabling OpenHarmony to run Android APKs natively. The PoC demonstrates "Hello World" from an Android app rendered through OpenHarmony's ArkUI framework.

### 1.1.1 Current Implementation Status (as of 2026-02-13)
- ✅ **Stage 1 Complete:** APK/DEX parsing, manifest parsing, class loading
- ✅ **Stage 2 Complete:** Bytecode interpreter with 27 opcodes, java.lang shims
- ✅ **Stage 3 Complete:** Android API shims (Activity, Context, View, TextView, Bundle)
- ✅ **Stage 4 Complete:** UI Bridge, State Manager, Lifecycle Bridge, Runtime integration
- 🚧 **Stage 5 In Progress:** OpenHarmony host implementation and device testing
- **Tests:** 266/266 passing | 0 TypeScript errors | 0 regressions

### 1.2 Constraints
- **No JIT/AOT** - Pure bytecode interpretation only
- **No Android Services** - Uses OpenHarmony native services
- **Minimal API Surface** - Only implement what's needed for Hello World
- **TypeScript/ArkTS** - All code in TypeScript for OpenHarmony compatibility

### 1.3 Platform & Tooling Decisions
- **Target Platform:** OpenHarmony 4.x (API 10-11) - stable UIAbility model
- **Test APK Strategy:** Pre-built binary committed to repo (no build tooling)
- **Debugging:** Minimal logging - console logs for major lifecycle events only

### 1.4 Success Criteria
1. APK file loads into OpenHarmony
2. APK runs as an OpenHarmony Ability
3. Android Activity lifecycle executes correctly
4. "Hello World" text renders via ArkUI
5. Pure interpretation (no native code compilation)

---

## 2. Architecture Overview

### 2.1 High-Level Architecture

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
│  │  │   Activity │ Context │ TextView │ View │ Bundle  │   │    │
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

### 2.2 Component Interaction Flow

```
1. APK Load:     APKParser → DEXParser → ClassLoader
2. App Start:    OHHost.onCreate() → ActivityShim.onCreate()
3. UI Setup:     setContentView(TextView) → UIBridge.mapView()
4. Rendering:    UIBridge → ArkUI Text Component
5. Lifecycle:    OHHost.onForeground() → ActivityShim.onResume()
```

---

## 3. Project Structure

### 3.1 Directory Layout

```
/mnt/d/craft/
├── src/
│   ├── core/
│   │   ├── types.ts              # Shared type definitions
│   │   ├── errors.ts             # Custom error classes
│   │   └── utils.ts              # Utility functions (LEB128, MUTF-8)
│   │
│   ├── parser/
│   │   ├── apk_parser.ts         # APK ZIP extraction
│   │   ├── dex_parser.ts         # DEX file format parser
│   │   ├── dex_types.ts          # DEX data structures
│   │   └── manifest_parser.ts    # AndroidManifest.xml (binary XML)
│   │
│   ├── interpreter/
│   │   ├── interpreter.ts        # Main bytecode execution loop
│   │   ├── opcodes.ts            # Opcode implementations
│   │   ├── opcode_table.ts       # Opcode dispatch table
│   │   ├── frame.ts              # Execution frame (registers, PC)
│   │   ├── heap.ts               # Object heap management
│   │   ├── class_loader.ts       # Class resolution & loading
│   │   └── method_resolver.ts    # Method lookup & virtual dispatch
│   │
│   ├── shim/
│   │   ├── java/
│   │   │   ├── lang/
│   │   │   │   ├── object.ts          # java.lang.Object
│   │   │   │   ├── string.ts          # java.lang.String
│   │   │   │   ├── string_builder.ts  # java.lang.StringBuilder
│   │   │   │   ├── class.ts           # java.lang.Class
│   │   │   │   ├── system.ts          # java.lang.System
│   │   │   │   └── index.ts           # Registration
│   │   │   └── (no other java packages)
│   │   │
│   │   └── android/
│   │       ├── app/
│   │       │   └── activity.ts   # android.app.Activity
│   │       ├── content/
│   │       │   └── context.ts    # android.content.Context + ContextWrapper
│   │       ├── view/
│   │       │   ├── view.ts       # android.view.View
│   │       │   └── view_group.ts # android.view.ViewGroup
│   │       ├── widget/
│   │       │   └── textview.ts   # android.widget.TextView
│   │       ├── os/
│   │       │   └── bundle.ts     # android.os.Bundle
│   │       └── index.ts
│   │
│   ├── bridge/
│   │   ├── ui_bridge.ts          # View → ArkUI mapping
│   │   ├── view_registry.ts      # View type registration
│   │   └── lifecycle_bridge.ts   # Activity ↔ Ability lifecycle
│   │
│   ├── oh/
│   │   ├── ability_host.ets      # OpenHarmony UIAbility wrapper
│   │   ├── craft_page.ets        # Dynamic ArkUI page
│   │   └── state_manager.ts      # Reactive state for ArkUI
│   │
│   └── index.ts                  # Main entry point
│
├── test/
│   ├── unit/
│   │   ├── parser/
│   │   ├── interpreter/
│   │   └── shim/
│   ├── integration/
│   │   └── hello_world.test.ts
│   └── fixtures/
│       ├── hello_world.apk       # Test APK
│       └── hello_world.dex       # Extracted DEX
│
├── docs/
│   ├── architecture.md
│   ├── component-specs/
│   │   ├── dex-parser.md
│   │   ├── interpreter.md
│   │   └── ui-bridge.md
│   └── extension-guide.md
│
├── tools/
│   └── dex_dumper.ts             # Debug tool to dump DEX contents
│
├── package.json
├── tsconfig.json
└── CLAUDE.md                     # Claude Code project instructions
```

### 3.2 Module Dependencies

```
core/types ←─────────────────────────────────────────┐
    ↑                                                │
parser/dex_parser ←── parser/apk_parser              │
    ↑                                                │
interpreter/class_loader                             │
    ↑                                                │
interpreter/interpreter ←── interpreter/opcodes      │
    ↑                        interpreter/heap        │
    ↑                        interpreter/frame       │
shim/java/* ←── shim/android/*                       │
    ↑              ↑                                 │
    └──────────────┼─────────────────────────────────┘
                   ↓
bridge/ui_bridge ←── bridge/lifecycle_bridge
    ↑
oh/ability_host ←── oh/craft_page
```

---

## 4. Component Specifications

### 4.1 APK Parser (`src/parser/apk_parser.ts`)

#### Purpose
Extract contents from APK files (which are ZIP archives).

#### Interface

```typescript
interface APKContents {
  manifest: Uint8Array;          // AndroidManifest.xml (binary XML)
  dexFiles: Map<string, Uint8Array>;  // classes.dex, classes2.dex, etc.
  resources: Uint8Array | null;  // resources.arsc (optional for PoC)
}

class APKParser {
  /**
   * Parse an APK file from a byte array
   * @param data Raw APK file bytes
   * @returns Extracted APK contents
   */
  static parse(data: Uint8Array): APKContents;

  /**
   * Parse APK from file path (OpenHarmony file API)
   * @param path Path to APK file
   */
  static async parseFile(path: string): Promise<APKContents>;
}
```

#### Implementation Notes
- Use a ZIP library or implement minimal ZIP parsing (PKZIP format)
- Central directory at end of file contains file entries
- Local file headers precede compressed data
- DEX files use STORE (no compression) or DEFLATE

#### Required ZIP Structures
```
Local File Header (30 bytes + variable):
  - Signature: 0x04034b50
  - Version, flags, compression method
  - CRC32, compressed size, uncompressed size
  - File name length, extra field length
  - File name, extra field

Central Directory Entry (46 bytes + variable):
  - Signature: 0x02014b50
  - Version made by, version needed
  - Flags, compression, time, date
  - CRC32, sizes, name length, extra length, comment length
  - Disk number, attributes, local header offset
  - File name, extra, comment

End of Central Directory (22 bytes + variable):
  - Signature: 0x06054b50
  - Disk numbers, entry counts
  - Central directory size and offset
  - Comment length, comment
```

---

### 4.2 DEX Parser (`src/parser/dex_parser.ts`)

#### Purpose
Parse DEX file format to extract classes, methods, fields, and bytecode.

#### Core Data Structures

```typescript
// DEX Header (112 bytes)
interface DexHeader {
  magic: Uint8Array;        // "dex\n035\0" or similar
  checksum: number;         // Adler32
  signature: Uint8Array;    // SHA-1 (20 bytes)
  fileSize: number;
  headerSize: number;       // Always 0x70 (112)
  endianTag: number;        // 0x12345678 for little-endian
  linkSize: number;
  linkOff: number;
  mapOff: number;
  stringIdsSize: number;
  stringIdsOff: number;
  typeIdsSize: number;
  typeIdsOff: number;
  protoIdsSize: number;
  protoIdsOff: number;
  fieldIdsSize: number;
  fieldIdsOff: number;
  methodIdsSize: number;
  methodIdsOff: number;
  classDefsSize: number;
  classDefsOff: number;
  dataSize: number;
  dataOff: number;
}

// String ID (4 bytes) - points to string_data_item
interface StringIdItem {
  stringDataOff: number;
}

// Type ID (4 bytes) - index into string_ids
interface TypeIdItem {
  descriptorIdx: number;
}

// Proto ID (12 bytes) - method prototype
interface ProtoIdItem {
  shortyIdx: number;        // Shorty descriptor string
  returnTypeIdx: number;    // Index into type_ids
  parametersOff: number;    // Offset to type_list (0 if no params)
}

// Field ID (8 bytes)
interface FieldIdItem {
  classIdx: number;         // Defining class (type_ids index)
  typeIdx: number;          // Field type (type_ids index)
  nameIdx: number;          // Field name (string_ids index)
}

// Method ID (8 bytes)
interface MethodIdItem {
  classIdx: number;         // Defining class (type_ids index)
  protoIdx: number;         // Method prototype (proto_ids index)
  nameIdx: number;          // Method name (string_ids index)
}

// Class Definition (32 bytes)
interface ClassDefItem {
  classIdx: number;         // This class (type_ids index)
  accessFlags: number;      // ACC_PUBLIC, ACC_FINAL, etc.
  superclassIdx: number;    // Superclass (type_ids index), NO_INDEX if none
  interfacesOff: number;    // Offset to type_list of interfaces
  sourceFileIdx: number;    // Source file name (string_ids index)
  annotationsOff: number;   // Annotations (can ignore for PoC)
  classDataOff: number;     // Offset to class_data_item
  staticValuesOff: number;  // Offset to static field initializers
}

// Class Data (variable length)
interface ClassDataItem {
  staticFieldsSize: number;
  instanceFieldsSize: number;
  directMethodsSize: number;
  virtualMethodsSize: number;
  staticFields: EncodedField[];
  instanceFields: EncodedField[];
  directMethods: EncodedMethod[];
  virtualMethods: EncodedMethod[];
}

// Encoded Field (variable length - LEB128)
interface EncodedField {
  fieldIdxDiff: number;     // Delta from previous field index
  accessFlags: number;
}

// Encoded Method (variable length - LEB128)
interface EncodedMethod {
  methodIdxDiff: number;    // Delta from previous method index
  accessFlags: number;
  codeOff: number;          // Offset to code_item (0 if abstract/native)
}

// Code Item (variable length, 4-byte aligned)
interface CodeItem {
  registersSize: number;    // Total registers
  insSize: number;          // Input argument count (including 'this')
  outsSize: number;         // Outgoing argument count
  triesSize: number;        // Exception handlers
  debugInfoOff: number;     // Debug info (can ignore)
  insnsSize: number;        // Instruction count (16-bit units)
  insns: Uint16Array;       // Bytecode instructions
  tries?: TryItem[];        // Exception handler info
}
```

#### Parser Interface

```typescript
class DexParser {
  private data: DataView;
  private header: DexHeader;

  // String table (lazy-loaded)
  private strings: Map<number, string>;

  // Parsed structures
  private typeIds: TypeIdItem[];
  private protoIds: ProtoIdItem[];
  private fieldIds: FieldIdItem[];
  private methodIds: MethodIdItem[];
  private classDefs: ClassDefItem[];

  constructor(data: Uint8Array);

  // Core parsing
  parseHeader(): DexHeader;
  parseStringIds(): void;
  parseTypeIds(): void;
  parseProtoIds(): void;
  parseFieldIds(): void;
  parseMethodIds(): void;
  parseClassDefs(): void;

  // String resolution
  getString(idx: number): string;
  getTypeName(idx: number): string;

  // Class resolution
  getClassDef(className: string): ClassDefItem | null;
  getClassData(classDefItem: ClassDefItem): ClassDataItem;

  // Method resolution
  getMethodCode(methodIdx: number): CodeItem | null;
  findMethod(className: string, methodName: string, proto: string): MethodIdItem | null;
}
```

#### MUTF-8 String Decoding

```typescript
function decodeMutf8(data: Uint8Array, offset: number): [string, number] {
  // Read uleb128 length first
  const [utf16Length, newOffset] = decodeUleb128(data, offset);
  let pos = newOffset;
  const chars: number[] = [];

  while (chars.length < utf16Length) {
    const byte1 = data[pos++];

    if ((byte1 & 0x80) === 0) {
      // 1-byte: 0xxxxxxx
      chars.push(byte1);
    } else if ((byte1 & 0xE0) === 0xC0) {
      // 2-byte: 110xxxxx 10xxxxxx
      const byte2 = data[pos++];
      chars.push(((byte1 & 0x1F) << 6) | (byte2 & 0x3F));
    } else if ((byte1 & 0xF0) === 0xE0) {
      // 3-byte: 1110xxxx 10xxxxxx 10xxxxxx
      const byte2 = data[pos++];
      const byte3 = data[pos++];
      chars.push(((byte1 & 0x0F) << 12) | ((byte2 & 0x3F) << 6) | (byte3 & 0x3F));
    }
  }

  // Skip null terminator
  pos++;

  return [String.fromCharCode(...chars), pos];
}
```

#### LEB128 Decoding

```typescript
function decodeUleb128(data: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;

  while (true) {
    const byte = data[pos++];
    result |= (byte & 0x7F) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }

  return [result, pos];
}

function decodeSleb128(data: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  let byte: number;

  do {
    byte = data[pos++];
    result |= (byte & 0x7F) << shift;
    shift += 7;
  } while ((byte & 0x80) !== 0);

  // Sign extend
  if (shift < 32 && (byte & 0x40) !== 0) {
    result |= (~0 << shift);
  }

  return [result, pos];
}
```

---

### 4.3 Bytecode Interpreter (`src/interpreter/`)

#### 4.3.1 Execution Frame

```typescript
interface ExecutionFrame {
  method: ResolvedMethod;     // Currently executing method
  registers: Value[];         // Register file (v0, v1, ... vN)
  pc: number;                 // Program counter (instruction index)
  returnAddress: number;      // Return PC in caller
  callerFrame: ExecutionFrame | null;
}

type Value =
  | { type: 'int'; value: number }
  | { type: 'long'; value: bigint }
  | { type: 'float'; value: number }
  | { type: 'double'; value: number }
  | { type: 'object'; ref: number }  // Heap reference
  | { type: 'null' };
```

#### 4.3.2 Heap & Object Model

```typescript
interface HeapObject {
  classRef: number;           // Reference to Class object
  fields: Map<string, Value>; // Field name → value
  monitor?: Monitor;          // For synchronization (stub for PoC)
}

interface ArrayObject extends HeapObject {
  elements: Value[];
  length: number;
}

class Heap {
  private objects: Map<number, HeapObject>;
  private nextRef: number = 1;  // 0 is null

  allocate(classRef: number): number;
  allocateArray(classRef: number, length: number): number;
  getObject(ref: number): HeapObject | null;
  getField(ref: number, fieldName: string): Value;
  setField(ref: number, fieldName: string, value: Value): void;
}
```

#### 4.3.3 Interpreter Core

```typescript
class Interpreter {
  private dex: DexParser;
  private heap: Heap;
  private classLoader: ClassLoader;
  private shimRegistry: ShimRegistry;

  private callStack: ExecutionFrame[];

  /**
   * Execute a method
   * @param className Fully qualified class name (e.g., "Lcom/example/MainActivity;")
   * @param methodName Method name (e.g., "onCreate")
   * @param descriptor Method descriptor (e.g., "(Landroid/os/Bundle;)V")
   * @param thisRef Object reference for instance methods (0 for static)
   * @param args Method arguments
   */
  invoke(
    className: string,
    methodName: string,
    descriptor: string,
    thisRef: number,
    args: Value[]
  ): Value;

  /**
   * Main interpretation loop
   */
  private executeFrame(frame: ExecutionFrame): Value;

  /**
   * Execute single instruction
   * @returns true if execution should continue, false if method returns
   */
  private executeInstruction(frame: ExecutionFrame): boolean;
}
```

#### 4.3.4 Implemented Opcodes (28 total)

| Opcode | Hex | Format | Status | Stage |
|--------|-----|--------|--------|-------|
| nop | 0x00 | 10x | ✅ Implemented | 2 |
| move | 0x01 | 12x | ✅ Implemented | 2 |
| move-object | 0x07 | 12x | ✅ Implemented | 2 |
| move-result | 0x0a | 11x | ✅ Implemented | 2 |
| move-result-object | 0x0c | 11x | ✅ Implemented | 2 |
| return-void | 0x0e | 10x | ✅ Implemented | 2 |
| return | 0x0f | 11x | ✅ Implemented | 2 |
| return-wide | 0x10 | 11x | ✅ Implemented | 4 |
| return-object | 0x11 | 11x | ✅ Implemented | 2 |
| const/4 | 0x12 | 11n | ✅ Implemented | 2 |
| const/16 | 0x13 | 21s | ✅ Implemented | 2 |
| const | 0x14 | 31i | ✅ Implemented | 2 |
| const-string | 0x1a | 21c | ✅ Implemented | 2 |
| const-class | 0x1c | 21c | ✅ Implemented | 2 |
| instance-of | 0x20 | 22c | ✅ Implemented | 5 |
| new-instance | 0x22 | 21c | ✅ Implemented | 2 |
| iget | 0x52 | 22c | ✅ Implemented | 2 |
| iget-object | 0x54 | 22c | ✅ Implemented | 2 |
| iput | 0x59 | 22c | ✅ Implemented | 2 |
| iput-object | 0x5b | 22c | ✅ Implemented | 2 |
| sget | 0x60 | 21c | ✅ Implemented | 2 |
| sget-object | 0x62 | 21c | ✅ Implemented | 2 |
| sput | 0x67 | 21c | ✅ Implemented | 2 |
| sput-object | 0x69 | 21c | ✅ Implemented | 2 |
| invoke-virtual | 0x6e | 35c | ✅ Implemented | 2 |
| invoke-super | 0x6f | 35c | ✅ Implemented | 2 |
| invoke-direct | 0x70 | 35c | ✅ Implemented | 2 |
| invoke-static | 0x71 | 35c | ✅ Implemented | 2 |

**Total:** 28 opcodes implemented

#### 4.3.5 Opcode Implementation Example

```typescript
// Opcode handler type
type OpcodeHandler = (frame: ExecutionFrame, insn: number) => void;

// Opcode table
const opcodeTable: Map<number, OpcodeHandler> = new Map();

// 0x1a: const-string vAA, string@BBBB
opcodeTable.set(0x1a, (frame, insn) => {
  const regA = (insn >> 8) & 0xFF;
  const stringIdx = frame.method.code.insns[frame.pc + 1];

  const str = this.dex.getString(stringIdx);
  const strRef = this.heap.allocateString(str);

  frame.registers[regA] = { type: 'object', ref: strRef };
  frame.pc += 2;  // This instruction is 2 code units
});

// 0x70: invoke-direct {vC, vD, vE, vF, vG}, meth@BBBB
opcodeTable.set(0x70, (frame, insn) => {
  const argCount = (insn >> 12) & 0xF;
  const methodIdx = frame.method.code.insns[frame.pc + 1];
  const regList = frame.method.code.insns[frame.pc + 2];

  // Extract registers C, D, E, F, G from regList
  const regs = extractRegisters(regList, argCount);

  // Resolve method
  const method = this.classLoader.resolveMethod(methodIdx);

  // Check if this is a shim method
  if (this.shimRegistry.hasMethod(method.className, method.name, method.descriptor)) {
    const result = this.shimRegistry.invoke(method, frame, regs);
    // Store result if non-void
  } else {
    // Create new frame and invoke DEX method
    const newFrame = this.createFrame(method, regs.map(r => frame.registers[r]));
    this.callStack.push(newFrame);
  }

  frame.pc += 3;  // This instruction is 3 code units
});
```

---

### 4.4 Android API Shim Layer (`src/shim/`)

#### 4.4.1 Shim Registry

```typescript
type ShimMethod = (
  interpreter: Interpreter,
  heap: Heap,
  thisRef: number,
  args: Value[]
) => Value;

class ShimRegistry {
  private methods: Map<string, ShimMethod>;  // "className:methodName:descriptor" → handler
  private classes: Map<string, ShimClass>;

  register(className: string, methodName: string, descriptor: string, handler: ShimMethod): void;
  hasMethod(className: string, methodName: string, descriptor: string): boolean;
  invoke(method: ResolvedMethod, frame: ExecutionFrame, argRegs: number[]): Value;

  // Class instantiation
  createInstance(className: string): number;  // Returns heap ref
}
```

#### 4.4.2 Activity Shim

```typescript
// src/shim/android/app/activity.ts

const ACTIVITY_CLASS = 'Landroid/app/Activity;';

// Fields stored in heap object
interface ActivityFields {
  mContentView: number;  // View reference
  mIntent: number;       // Intent reference
  mFinished: boolean;
}

export function registerActivityShim(registry: ShimRegistry, bridge: UIBridge): void {

  // <init>()V - Constructor
  registry.register(ACTIVITY_CLASS, '<init>', '()V', (interp, heap, thisRef, args) => {
    // Call ContextThemeWrapper.<init>
    // Initialize fields
    return { type: 'null' };
  });

  // onCreate(Landroid/os/Bundle;)V
  registry.register(ACTIVITY_CLASS, 'onCreate', '(Landroid/os/Bundle;)V',
    (interp, heap, thisRef, args) => {
      // Default implementation does nothing
      // Subclass overrides call super.onCreate() which lands here
      return { type: 'null' };
    }
  );

  // setContentView(Landroid/view/View;)V
  registry.register(ACTIVITY_CLASS, 'setContentView', '(Landroid/view/View;)V',
    (interp, heap, thisRef, args) => {
      const viewRef = (args[0] as { type: 'object'; ref: number }).ref;

      // Store in Activity's field
      heap.setField(thisRef, 'mContentView', { type: 'object', ref: viewRef });

      // Notify UI bridge
      bridge.setRootView(viewRef);

      return { type: 'null' };
    }
  );

  // finish()V
  registry.register(ACTIVITY_CLASS, 'finish', '()V', (interp, heap, thisRef, args) => {
    heap.setField(thisRef, 'mFinished', { type: 'int', value: 1 });
    // Notify lifecycle bridge
    return { type: 'null' };
  });
}
```

#### 4.4.3 TextView Shim

```typescript
// src/shim/android/widget/textview.ts

const TEXTVIEW_CLASS = 'Landroid/widget/TextView;';

interface TextViewFields {
  mText: string;
  mTextSize: number;
  mTextColor: number;
}

export function registerTextViewShim(registry: ShimRegistry, bridge: UIBridge): void {

  // <init>(Landroid/content/Context;)V
  registry.register(TEXTVIEW_CLASS, '<init>', '(Landroid/content/Context;)V',
    (interp, heap, thisRef, args) => {
      // Initialize View parent
      // Initialize default values
      heap.setField(thisRef, 'mText', { type: 'object', ref: heap.allocateString('') });
      heap.setField(thisRef, 'mTextSize', { type: 'float', value: 14.0 });
      heap.setField(thisRef, 'mTextColor', { type: 'int', value: 0xFF000000 });

      // Register with UI bridge
      bridge.registerView(thisRef, 'TextView');

      return { type: 'null' };
    }
  );

  // setText(Ljava/lang/CharSequence;)V
  registry.register(TEXTVIEW_CLASS, 'setText', '(Ljava/lang/CharSequence;)V',
    (interp, heap, thisRef, args) => {
      const textRef = (args[0] as { type: 'object'; ref: number }).ref;
      const text = heap.getStringValue(textRef);

      heap.setField(thisRef, 'mText', args[0]);

      // Notify UI bridge of text change
      bridge.updateViewProperty(thisRef, 'text', text);

      return { type: 'null' };
    }
  );

  // getText()Ljava/lang/CharSequence;
  registry.register(TEXTVIEW_CLASS, 'getText', '()Ljava/lang/CharSequence;',
    (interp, heap, thisRef, args) => {
      return heap.getField(thisRef, 'mText');
    }
  );
}
```

#### 4.4.4 Bundle Shim

```typescript
// src/shim/android/os/bundle.ts

const BUNDLE_CLASS = 'Landroid/os/Bundle;';

export function registerBundleShim(registry: ShimRegistry): void {

  // <init>()V
  registry.register(BUNDLE_CLASS, '<init>', '()V', (interp, heap, thisRef, args) => {
    // Bundle stores data in a Map field
    heap.setField(thisRef, 'mMap', { type: 'object', ref: heap.allocateMap() });
    return { type: 'null' };
  });

  // putString(Ljava/lang/String;Ljava/lang/String;)V
  registry.register(BUNDLE_CLASS, 'putString', '(Ljava/lang/String;Ljava/lang/String;)V',
    (interp, heap, thisRef, args) => {
      const mapRef = (heap.getField(thisRef, 'mMap') as { type: 'object'; ref: number }).ref;
      const key = heap.getStringValue((args[0] as { type: 'object'; ref: number }).ref);
      heap.mapPut(mapRef, key, args[1]);
      return { type: 'null' };
    }
  );

  // getString(Ljava/lang/String;)Ljava/lang/String;
  registry.register(BUNDLE_CLASS, 'getString', '(Ljava/lang/String;)Ljava/lang/String;',
    (interp, heap, thisRef, args) => {
      const mapRef = (heap.getField(thisRef, 'mMap') as { type: 'object'; ref: number }).ref;
      const key = heap.getStringValue((args[0] as { type: 'object'; ref: number }).ref);
      return heap.mapGet(mapRef, key) ?? { type: 'null' };
    }
  );
}
```

---

### 4.5 UI Bridge (`src/bridge/`)

#### 4.5.1 View Registry & Mapping

```typescript
// src/bridge/ui_bridge.ts

interface ViewNode {
  viewRef: number;           // Heap reference to Android View
  viewType: string;          // 'TextView', 'ViewGroup', etc.
  properties: Map<string, any>;
  children: ViewNode[];
  parent: ViewNode | null;
  arkuiId: string;           // Generated ID for ArkUI component
}

class UIBridge {
  private stateManager: StateManager;
  private viewTree: ViewNode | null = null;
  private viewMap: Map<number, ViewNode> = new Map();

  /**
   * Register a newly created View
   */
  registerView(viewRef: number, viewType: string): void {
    const node: ViewNode = {
      viewRef,
      viewType,
      properties: new Map(),
      children: [],
      parent: null,
      arkuiId: `view_${viewRef}`
    };
    this.viewMap.set(viewRef, node);
  }

  /**
   * Set the root view (from Activity.setContentView)
   */
  setRootView(viewRef: number): void {
    const node = this.viewMap.get(viewRef);
    if (node) {
      this.viewTree = node;
      this.stateManager.setRootView(node);
    }
  }

  /**
   * Update a view property (triggers ArkUI re-render)
   */
  updateViewProperty(viewRef: number, property: string, value: any): void {
    const node = this.viewMap.get(viewRef);
    if (node) {
      node.properties.set(property, value);
      this.stateManager.updateView(node);
    }
  }

  /**
   * Add child to ViewGroup
   */
  addChild(parentRef: number, childRef: number): void {
    const parent = this.viewMap.get(parentRef);
    const child = this.viewMap.get(childRef);
    if (parent && child) {
      child.parent = parent;
      parent.children.push(child);
      this.stateManager.updateView(parent);
    }
  }
}
```

#### 4.5.2 State Manager for ArkUI Reactivity

```typescript
// src/bridge/state_manager.ts

/**
 * Manages reactive state that drives ArkUI rendering.
 * Uses a simple observable pattern that integrates with ArkUI's @State.
 */
class StateManager {
  private rootView: ViewNode | null = null;
  private updateCallbacks: Set<() => void> = new Set();

  // This will be bound to ArkUI @State variable
  private viewState: ViewState = { version: 0, root: null };

  setRootView(node: ViewNode): void {
    this.rootView = node;
    this.notifyUpdate();
  }

  updateView(node: ViewNode): void {
    this.notifyUpdate();
  }

  private notifyUpdate(): void {
    this.viewState = {
      version: this.viewState.version + 1,
      root: this.serializeViewTree(this.rootView)
    };
    this.updateCallbacks.forEach(cb => cb());
  }

  /**
   * Subscribe to state changes (called by ArkUI page)
   */
  subscribe(callback: () => void): void {
    this.updateCallbacks.add(callback);
  }

  getState(): ViewState {
    return this.viewState;
  }

  private serializeViewTree(node: ViewNode | null): SerializedView | null {
    if (!node) return null;

    return {
      id: node.arkuiId,
      type: node.viewType,
      props: Object.fromEntries(node.properties),
      children: node.children.map(c => this.serializeViewTree(c)!)
    };
  }
}

interface ViewState {
  version: number;
  root: SerializedView | null;
}

interface SerializedView {
  id: string;
  type: string;
  props: Record<string, any>;
  children: SerializedView[];
}
```

---

### 4.6 OpenHarmony Host (`src/oh/`)

#### 4.6.1 Ability Host

```typescript
// src/oh/ability_host.ets

import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { CraftRuntime } from '../index';

export default class CraftAbility extends UIAbility {
  private runtime: CraftRuntime | null = null;
  private apkPath: string = '';

  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    console.info('CraftAbility onCreate');

    // Get APK path from want parameters
    this.apkPath = want.parameters?.apkPath as string || '';

    // Initialize CRAFT runtime
    this.runtime = new CraftRuntime();
  }

  onDestroy(): void {
    console.info('CraftAbility onDestroy');
    if (this.runtime) {
      this.runtime.callActivityLifecycle('onDestroy');
      this.runtime.shutdown();
    }
  }

  async onWindowStageCreate(windowStage: window.WindowStage): Promise<void> {
    console.info('CraftAbility onWindowStageCreate');

    // Load and parse APK
    if (this.runtime && this.apkPath) {
      await this.runtime.loadAPK(this.apkPath);

      // Initialize the Android Activity
      this.runtime.initializeActivity();

      // Call Activity.onCreate(null)
      this.runtime.callActivityLifecycle('onCreate', null);
    }

    // Load the CRAFT rendering page
    windowStage.loadContent('pages/CraftPage', (err) => {
      if (err.code) {
        console.error('Failed to load CraftPage:', JSON.stringify(err));
        return;
      }

      // Share runtime with page via global state or LocalStorage
      AppStorage.setOrCreate('craftRuntime', this.runtime);
    });
  }

  onWindowStageDestroy(): void {
    console.info('CraftAbility onWindowStageDestroy');
  }

  onForeground(): void {
    console.info('CraftAbility onForeground');
    if (this.runtime) {
      this.runtime.callActivityLifecycle('onStart');
      this.runtime.callActivityLifecycle('onResume');
    }
  }

  onBackground(): void {
    console.info('CraftAbility onBackground');
    if (this.runtime) {
      this.runtime.callActivityLifecycle('onPause');
      this.runtime.callActivityLifecycle('onStop');
    }
  }
}
```

#### 4.6.2 Dynamic ArkUI Page

```typescript
// src/oh/craft_page.ets

import { CraftRuntime } from '../index';

interface ViewProps {
  id: string;
  type: string;
  props: Record<string, ESObject>;
  children: ViewProps[];
}

@Entry
@Component
struct CraftPage {
  @StorageLink('craftRuntime') runtime: CraftRuntime | null = null;
  @State viewTree: ViewProps | null = null;
  @State updateCounter: number = 0;

  aboutToAppear(): void {
    if (this.runtime) {
      // Subscribe to UI updates from the bridge
      this.runtime.getUIBridge().getStateManager().subscribe(() => {
        const state = this.runtime!.getUIBridge().getStateManager().getState();
        this.viewTree = state.root as ViewProps;
        this.updateCounter++;
      });

      // Get initial state
      const state = this.runtime.getUIBridge().getStateManager().getState();
      this.viewTree = state.root as ViewProps;
    }
  }

  build() {
    Column() {
      if (this.viewTree !== null) {
        this.renderView(this.viewTree)
      } else {
        Text('Loading...')
          .fontSize(20)
      }
    }
    .width('100%')
    .height('100%')
  }

  @Builder
  renderView(view: ViewProps) {
    if (view.type === 'TextView') {
      Text(view.props['text'] as string || '')
        .fontSize((view.props['textSize'] as number) || 14)
        .fontColor(this.intToColor(view.props['textColor'] as number))
    } else if (view.type === 'ViewGroup') {
      Column() {
        ForEach(view.children, (child: ViewProps) => {
          this.renderView(child)
        }, (child: ViewProps) => child.id)
      }
    }
  }

  private intToColor(argb: number | undefined): Color {
    if (argb === undefined) return Color.Black;
    // Convert ARGB int to ArkUI Color
    const a = (argb >> 24) & 0xFF;
    const r = (argb >> 16) & 0xFF;
    const g = (argb >> 8) & 0xFF;
    const b = argb & 0xFF;
    return `rgba(${r},${g},${b},${a/255})` as Color;
  }
}
```

#### 4.6.3 Lifecycle Bridge Mapping

```
OpenHarmony UIAbility          Android Activity
─────────────────────          ────────────────
onCreate()                  →  (initialization only)
onWindowStageCreate()       →  onCreate(Bundle)
onForeground()              →  onStart() → onResume()
onBackground()              →  onPause() → onStop()
onWindowStageDestroy()      →  (cleanup only)
onDestroy()                 →  onDestroy()
```

---

## 5. Data Flow & Integration

### 5.1 APK Loading Flow

```
1. User launches APK via OpenHarmony launcher
2. System starts CraftAbility with APK path in Want
3. CraftAbility.onCreate():
   - Create CraftRuntime instance
4. CraftAbility.onWindowStageCreate():
   - APKParser.parseFile(apkPath)
   - DexParser processes classes.dex
   - ClassLoader indexes all classes
   - Find main Activity from AndroidManifest
   - Create Activity instance on heap
   - Call Activity.onCreate(null) via interpreter
5. Activity.onCreate() in DEX bytecode:
   - super.onCreate(bundle) → hits shim
   - new TextView(this) → shim creates view, registers with UIBridge
   - textView.setText("Hello World") → shim updates property
   - setContentView(textView) → shim sets root view
6. UIBridge notifies StateManager
7. StateManager triggers ArkUI re-render
8. CraftPage.build() renders Text component with "Hello World"
```

### 5.2 Method Invocation Flow

```
Interpreter.invoke("Lcom/example/MainActivity;", "onCreate", "(Landroid/os/Bundle;)V", activityRef, [bundleRef])
    │
    ├── ClassLoader.resolveMethod()
    │       └── Lookup in DEX method_ids, find code_item
    │
    ├── Create ExecutionFrame (registers, PC=0)
    │
    └── executeFrame() loop:
            │
            ├── fetch instruction at PC
            ├── decode opcode
            ├── dispatch to handler:
            │       │
            │       ├── Regular DEX instruction → modify registers/heap, advance PC
            │       │
            │       └── invoke-* instruction:
            │               ├── Resolve target method
            │               ├── Check ShimRegistry.hasMethod()
            │               │       ├── YES → ShimRegistry.invoke() → return value
            │               │       └── NO → Create new frame, push to call stack
            │               └── Continue execution
            │
            └── return-* instruction → pop frame, pass return value to caller
```

---

## 6. Implementation Stages

### Stage 1: Foundation (Files: parser/*, core/*)

**Goal:** Parse APK and DEX files successfully

**Tasks:**
1. Implement `core/utils.ts` - LEB128, MUTF-8 utilities
2. Implement `parser/apk_parser.ts` - ZIP extraction
3. Implement `parser/dex_types.ts` - DEX data structures
4. Implement `parser/dex_parser.ts` - Full DEX parsing
5. Create test fixtures - minimal Hello World APK

**Verification:**
- Unit test: Parse DEX header from real APK
- Unit test: Extract all strings from string table
- Unit test: Resolve class by name
- Unit test: Find method and get its bytecode

---

### Stage 2: Interpreter Core (Files: interpreter/*)

**Goal:** Execute simple bytecode sequences

**Tasks:**
1. Implement `interpreter/heap.ts` - Object allocation, field access
2. Implement `interpreter/frame.ts` - Execution frame management
3. Implement `interpreter/class_loader.ts` - Class/method resolution
4. Implement `interpreter/opcode_table.ts` - Dispatch table structure
5. Implement `interpreter/opcodes.ts` - P1 opcodes (see 4.3.4)
6. Implement `interpreter/interpreter.ts` - Main execution loop

**Verification:**
- Unit test: Execute `const/4 v0, 5; return v0` → returns 5
- Unit test: Execute `new-instance v0, Ljava/lang/Object;` → allocates object
- Unit test: Execute simple method with `invoke-direct` to constructor
- Integration test: Execute method that calls another method

---

### Stage 3: Android API Shim (Files: shim/*)

**Goal:** Provide minimal Android API implementations

**Tasks:**
1. Implement `shim/java/lang/object.ts` - java.lang.Object
2. Implement `shim/java/lang/string.ts` - java.lang.String
3. Implement `shim/android/os/bundle.ts` - Bundle
4. Implement `shim/android/content/context.ts` - Context hierarchy
5. Implement `shim/android/view/view.ts` - Base View
6. Implement `shim/android/widget/textview.ts` - TextView
7. Implement `shim/android/app/activity.ts` - Activity with lifecycle

**Verification:**
- Unit test: Activity.onCreate() receives Bundle
- Unit test: new TextView(context) creates view
- Unit test: textView.setText("text") stores value
- Unit test: activity.setContentView(view) stores view reference

---

### Stage 4: UI Bridge & OpenHarmony Host (Files: bridge/*, oh/*)

**Goal:** Render Android Views through ArkUI

**Tasks:**
1. Implement `bridge/ui_bridge.ts` - View → ArkUI mapping
2. Implement `bridge/state_manager.ts` - Reactive state
3. Implement `bridge/lifecycle_bridge.ts` - Lifecycle mapping
4. Implement `oh/ability_host.ets` - UIAbility wrapper
5. Implement `oh/craft_page.ets` - Dynamic ArkUI rendering
6. Wire everything together in `index.ts`

**Verification:**
- Visual test: Static Text("Hello") renders
- Visual test: Dynamic text update triggers re-render
- Lifecycle test: onForeground → onResume() called

---

### Stage 5: Integration & Polish

**Goal:** End-to-end working demonstration

**Tasks:**
1. Create proper Hello World test APK
2. Full integration testing
3. Debug and fix issues
4. Performance profiling
5. Documentation
6. Demo preparation

**Verification:**
- Load unmodified Hello World APK
- See "Hello World" rendered via ArkUI
- Verify lifecycle events logged correctly
- Clean shutdown without errors

---

## 7. Testing Strategy

### 7.1 Unit Tests

```
test/unit/
├── parser/
│   ├── apk_parser.test.ts      # ZIP extraction tests
│   ├── dex_parser.test.ts      # DEX structure parsing
│   └── utils.test.ts           # LEB128, MUTF-8 encoding
├── interpreter/
│   ├── opcodes.test.ts         # Individual opcode tests
│   ├── heap.test.ts            # Object allocation, field access
│   └── interpreter.test.ts     # Execution flow tests
└── shim/
    ├── activity.test.ts        # Activity lifecycle
    ├── textview.test.ts        # TextView methods
    └── bundle.test.ts          # Bundle get/put
```

### 7.2 Integration Tests

```
test/integration/
├── simple_method.test.ts       # Execute standalone method
├── object_creation.test.ts     # new-instance + constructor
├── method_calls.test.ts        # invoke-virtual chain
├── activity_lifecycle.test.ts  # Full lifecycle sequence
└── hello_world.test.ts         # End-to-end APK execution
```

### 7.3 Test APK

A pre-built minimal APK is committed at `test/fixtures/hello_world.apk`.

**Source code (for reference):**
```java
package com.example.helloworld;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        TextView textView = new TextView(this);
        textView.setText("Hello World");
        setContentView(textView);
    }
}
```

**APK Contents:**
- `classes.dex` - Compiled bytecode
- `AndroidManifest.xml` - Binary XML with MainActivity declaration
- No resources.arsc (hardcoded string, no R.string references)

---

## 8. Extension Points

### 8.1 Adding New Views

1. Create shim in `src/shim/android/widget/`
2. Register with ShimRegistry
3. Add renderer case in `CraftPage.renderView()`
4. Map properties to ArkUI equivalents

### 8.2 Adding New Opcodes

1. Add handler in `src/interpreter/opcodes.ts`
2. Register in opcode dispatch table
3. Add unit test
4. Document in opcode reference

### 8.3 Adding New Android APIs

1. Identify Java package (e.g., `android.graphics`)
2. Create shim module under `src/shim/android/`
3. Implement minimal methods needed
4. Register with ShimRegistry
5. Add tests

### 8.4 Performance Optimization (Post-PoC)

- Inline common opcode sequences
- Cache method lookups
- Optimize string interning
- Consider selective JIT for hot paths

---

## CLAUDE.md Instructions

```markdown
# CRAFT - Android to OpenHarmony Compatibility Framework

## Project Overview
This project implements a compatibility layer to run Android APKs on OpenHarmony.
The current scope is a PoC that displays "Hello World" from an Android app.

## Key Concepts
- **APK/DEX Parsing**: Extract and parse Android package files
- **Bytecode Interpretation**: Execute Dalvik bytecode without JIT/AOT
- **API Shims**: Provide minimal Android API implementations
- **UI Bridge**: Map Android Views to ArkUI components

## Development Commands
```bash
# Run tests
npm test

# Run specific test file
npm test -- parser/dex_parser.test.ts

# Build for OpenHarmony
hvigorw assembleHap

# Dump DEX contents (debug)
npx ts-node tools/dex_dumper.ts test/fixtures/hello_world.dex
```

## Architecture
See docs/architecture.md for detailed component diagrams.

## Adding Features
1. New Views: See docs/extension-guide.md#adding-views
2. New Opcodes: See docs/extension-guide.md#adding-opcodes
3. New APIs: See docs/extension-guide.md#adding-apis

## Code Style
- TypeScript strict mode
- No `any` types (use `unknown` with type guards)
- Document public APIs with JSDoc
- Unit test all opcode implementations
```
