# Stage 2: Interpreter Core - Implementation Plan

## Overview

**Goal:** Execute simple Dalvik bytecode sequences through a pure interpretation engine.

**Prerequisites:** Stage 1 complete (parser/*, core/* implemented and tested)

**Deliverables:**
- `src/interpreter/heap.ts` - Object allocation and field access
- `src/interpreter/frame.ts` - Execution frame management
- `src/interpreter/class_loader.ts` - Class and method resolution
- `src/interpreter/opcode_table.ts` - Opcode dispatch table
- `src/interpreter/opcodes.ts` - Essential opcode implementations
- `src/interpreter/interpreter.ts` - Main execution loop
- `src/interpreter/method_resolver.ts` - Method lookup and virtual dispatch
- `src/shim/java/lang/object.ts` - java.lang.Object base class
- `src/shim/java/lang/string.ts` - java.lang.String implementation
- `src/shim/java/lang/string_builder.ts` - java.lang.StringBuilder implementation
- `src/shim/java/lang/class.ts` - java.lang.Class (minimal)
- `src/shim/java/lang/system.ts` - java.lang.System (stub)
- `src/shim/java/lang/index.ts` - Registration index
- `src/interpreter/shim_registry.ts` - Shim method registry
- `src/interpreter/shim_init.ts` - Shim initialization
- `src/interpreter/errors.ts` - Exception classes

---

## 1. Type Definitions (`src/interpreter/types.ts`)

Create shared types used across interpreter modules.

### 1.1 Value Types

```typescript
// Primitive and reference value representation
export type Value =
  | { type: 'int'; value: number }
  | { type: 'long'; low: number; high: number }  // 64-bit as two 32-bit
  | { type: 'float'; value: number }
  | { type: 'double'; value: number }
  | { type: 'object'; ref: number }
  | { type: 'null' };

// Wide values occupy two registers
export type WideValue =
  | { type: 'long'; low: number; high: number }
  | { type: 'double'; value: number };

export function isWideValue(v: Value): v is WideValue {
  return v.type === 'long' || v.type === 'double';
}

export function isNullOrObject(v: Value): v is { type: 'object'; ref: number } | { type: 'null' } {
  return v.type === 'object' || v.type === 'null';
}
```

### 1.2 Resolved Structures

```typescript
// Resolved method with all info needed for execution
export interface ResolvedMethod {
  classDescriptor: string;    // e.g., "Lcom/example/MainActivity;"
  name: string;               // e.g., "onCreate"
  descriptor: string;         // e.g., "(Landroid/os/Bundle;)V"
  accessFlags: number;
  code: CodeItem | null;      // null for abstract/native
  isShim: boolean;            // true if handled by shim layer
}

// Resolved class with inheritance info
export interface ResolvedClass {
  descriptor: string;
  accessFlags: number;
  superClass: string | null;  // null for java/lang/Object
  interfaces: string[];
  staticFields: Map<string, FieldInfo>;
  instanceFields: Map<string, FieldInfo>;
  directMethods: Map<string, ResolvedMethod>;
  virtualMethods: Map<string, ResolvedMethod>;
  isInitialized: boolean;
}

export interface FieldInfo {
  classDescriptor: string;  // Declaring class
  name: string;
  descriptor: string;
  accessFlags: number;
  offset: number;  // Field index for fast access
  isStatic: boolean;
}
```

---

## 2. Heap Implementation (`src/interpreter/heap.ts`)

### 2.1 Interface Design

```typescript
export interface HeapObject {
  classRef: number;              // Reference to Class object in heap
  classDescriptor: string;       // Type descriptor for fast lookup
  fields: Map<string, Value>;    // fieldName -> value
  arrayData?: Value[];           // For array objects
  arrayLength?: number;          // For array objects
  stringValue?: string;          // For String objects (interned)
}

export class Heap {
  private objects: Map<number, HeapObject> = new Map();
  private nextRef: number = 1;  // 0 is reserved for null
  private stringPool: Map<string, number> = new Map();  // String interning

  // Object allocation
  allocate(classDescriptor: string): number;
  allocateArray(elementType: string, length: number): number;
  allocateString(value: string): number;

  // Object access
  getObject(ref: number): HeapObject | null;
  getClassDescriptor(ref: number): string | null;

  // Field operations
  getField(ref: number, fieldName: string): Value;
  setField(ref: number, fieldName: string, value: Value): void;
  getInstanceField(ref: number, fieldIdx: number): Value;
  setInstanceField(ref: number, fieldIdx: number, value: Value): void;

  // Array operations
  getArrayElement(ref: number, index: number): Value;
  setArrayElement(ref: number, index: number, value: Value): void;
  getArrayLength(ref: number): number;

  // String operations
  getStringValue(ref: number): string;
  internString(value: string): number;

  // Utility
  isInstanceOf(ref: number, classDescriptor: string): boolean;
}
```

### 2.2 Implementation Details

**Object Allocation:**
- Increment `nextRef` and create HeapObject entry
- Initialize all fields to default values (0 for primitives, null for objects)
- For arrays, pre-allocate `arrayData` with specified length

**String Interning:**
- Maintain `stringPool` map from string content to heap reference
- `internString()` returns existing ref if string already pooled
- All `const-string` operations should use interning

**Field Access:**
- Fields stored by name in Map for simplicity
- Consider optimization: use field index for O(1) access later

### 2.3 Implementation Order

1. Basic allocation (`allocate`, `getObject`)
2. Field operations (`getField`, `setField`)
3. Array support (`allocateArray`, `getArrayElement`, `setArrayElement`)
4. String support (`allocateString`, `getStringValue`, `internString`)
5. Type checking (`isInstanceOf`)

---

## 3. Execution Frame (`src/interpreter/frame.ts`)

### 3.1 Interface Design

```typescript
export interface ExecutionFrame {
  method: ResolvedMethod;
  registers: Value[];          // v0, v1, ..., vN
  pc: number;                  // Program counter (index into insns)
  callerFrame: ExecutionFrame | null;
  returnRegister: number;      // Which register in caller receives result
  lockRef: number | null;      // For synchronized methods
}

export class FrameManager {
  private stack: ExecutionFrame[] = [];
  private maxStackDepth: number = 256;

  // Frame operations
  createFrame(method: ResolvedMethod, args: Value[]): ExecutionFrame;
  pushFrame(frame: ExecutionFrame): void;
  popFrame(): ExecutionFrame | null;
  currentFrame(): ExecutionFrame | null;

  // Register access (convenience methods)
  getReg(frame: ExecutionFrame, reg: number): Value;
  setReg(frame: ExecutionFrame, reg: number, value: Value): void;
  getRegPair(frame: ExecutionFrame, reg: number): WideValue;
  setRegPair(frame: ExecutionFrame, reg: number, value: WideValue): void;

  // Stack inspection
  getStackDepth(): number;
  getStackTrace(): string[];
}
```

### 3.2 Implementation Details

**Frame Creation:**
```typescript
createFrame(method: ResolvedMethod, args: Value[]): ExecutionFrame {
  const code = method.code!;
  const registers = new Array<Value>(code.registersSize);

  // Initialize all registers to zero/null
  for (let i = 0; i < code.registersSize; i++) {
    registers[i] = { type: 'int', value: 0 };
  }

  // Arguments go in the last N registers
  // For instance method: v(registersSize - insSize) = this
  // Parameters follow
  const argStart = code.registersSize - code.insSize;
  for (let i = 0; i < args.length; i++) {
    registers[argStart + i] = args[i];
    // Wide values occupy two registers
    if (isWideValue(args[i])) {
      i++;  // Skip next register
    }
  }

  return {
    method,
    registers,
    pc: 0,
    callerFrame: this.currentFrame(),
    returnRegister: -1,
    lockRef: null
  };
}
```

**Register Access:**
- Dalvik uses register-based VM (not stack-based)
- Wide values (long, double) span two consecutive registers
- `getReg`/`setReg` handle single-width values
- `getRegPair`/`setRegPair` handle 64-bit values

### 3.3 Implementation Order

1. Basic frame creation and stack operations
2. Single-width register access
3. Wide register access
4. Stack trace generation (for debugging)

---

## 4. Class Loader (`src/interpreter/class_loader.ts`)

### 4.1 Interface Design

```typescript
export class ClassLoader {
  private dex: DexParser;
  private heap: Heap;
  private shimRegistry: ShimRegistry;

  private loadedClasses: Map<string, ResolvedClass> = new Map();
  private classObjects: Map<string, number> = new Map();  // descriptor -> heap ref

  constructor(dex: DexParser, heap: Heap, shimRegistry: ShimRegistry);

  // Class operations
  loadClass(descriptor: string): ResolvedClass;
  getClass(descriptor: string): ResolvedClass | null;
  isClassLoaded(descriptor: string): boolean;
  getClassObject(descriptor: string): number;  // java.lang.Class instance

  // Method resolution
  resolveMethod(methodIdx: number): ResolvedMethod;
  resolveMethodByName(
    classDescriptor: string,
    methodName: string,
    methodDescriptor: string
  ): ResolvedMethod | null;

  // Field resolution
  resolveField(fieldIdx: number): FieldInfo;
  resolveFieldByName(
    classDescriptor: string,
    fieldName: string,
    fieldDescriptor: string
  ): FieldInfo | null;

  // Virtual dispatch
  resolveVirtualMethod(
    objectRef: number,
    methodIdx: number
  ): ResolvedMethod;

  // Super method resolution
  resolveSuperMethod(
    callingClass: string,
    methodIdx: number
  ): ResolvedMethod;

  // Static field operations
  getStaticField(field: FieldInfo): Value;
  setStaticField(field: FieldInfo, value: Value): void;

  // Class initialization
  initializeClass(descriptor: string): void;
}
```

### 4.2 Implementation Details

**Class Loading:**
1. Check if class is a shim class (handled by ShimRegistry)
2. Look up ClassDefItem in DEX by descriptor
3. Parse ClassDataItem to get fields and methods
4. Recursively load superclass
5. Build ResolvedClass with all info

**Method Resolution:**
1. Get MethodIdItem from DEX by index
2. Extract class, name, descriptor
3. Check ShimRegistry for native implementation
4. If not shim, find CodeItem in DEX
5. Build ResolvedMethod

**Virtual Dispatch:**
1. Get actual class of object from heap
2. Look up method in class's virtual method table
3. If not found, walk up inheritance chain
4. Return resolved method for actual implementation

**Class Initialization (`<clinit>`):**
1. Check if already initialized
2. Initialize superclass first
3. Execute `<clinit>` method if present
4. Mark class as initialized

**Static Field Storage:**
- Static fields are stored per-class, not per-object
- ClassLoader maintains `staticFields: Map<string, Map<string, Value>>` (class -> field -> value)
- `getStaticField()` retrieves from this storage
- `setStaticField()` updates this storage
- Fields initialized to default values when class loads (0 for primitives, null for objects)

### 4.3 Implementation Order

1. Basic class loading from DEX
2. Method resolution by index
3. Method resolution by name (for shim lookups)
4. Field resolution
5. Virtual dispatch
6. Class initialization

---

## 5. Opcode Table (`src/interpreter/opcode_table.ts`)

### 5.1 Interface Design

```typescript
// Opcode handler signature
export type OpcodeHandler = (
  ctx: ExecutionContext,
  insn: number
) => void;

// Context passed to all handlers
export interface ExecutionContext {
  frame: ExecutionFrame;
  heap: Heap;
  classLoader: ClassLoader;
  interpreter: Interpreter;
  dex: DexParser;
}

// Opcode metadata
export interface OpcodeInfo {
  name: string;
  format: string;      // '10x', '12x', '21c', etc.
  handler: OpcodeHandler;
  width: number;       // Instruction width in 16-bit units
}

export class OpcodeTable {
  private handlers: Map<number, OpcodeInfo> = new Map();

  register(opcode: number, info: OpcodeInfo): void;
  get(opcode: number): OpcodeInfo | null;
  execute(ctx: ExecutionContext, opcode: number, insn: number): void;
}
```

### 5.2 Instruction Formats

Key formats needed for P1 opcodes:

| Format | Description | Fields |
|--------|-------------|--------|
| 10x | No operands | op |
| 11x | Single register | op, vA |
| 11n | Register + 4-bit literal | op, vA, +B |
| 12x | Two registers | op, vA, vB |
| 21s | Register + 16-bit signed | op, vA, +BBBB |
| 21c | Register + constant pool index | op, vA, @BBBB |
| 22c | Two registers + constant pool | op, vA, vB, @CCCC |
| 31i | Register + 32-bit literal | op, vA, +BBBBBBBB |
| 35c | Method invoke | op, count, @BBBB, regs |

### 5.3 Helper Functions

```typescript
// Extract register A from 12x format: op|A B
export function getRegA_12x(insn: number): number {
  return (insn >> 8) & 0xF;
}

// Extract register B from 12x format
export function getRegB_12x(insn: number): number {
  return (insn >> 12) & 0xF;
}

// Extract register A from 21c format: op|AA BBBB
export function getRegA_21c(insn: number): number {
  return (insn >> 8) & 0xFF;
}

// Extract 4-bit signed literal from 11n format
export function getLiteral_11n(insn: number): number {
  const val = (insn >> 12) & 0xF;
  return val >= 8 ? val - 16 : val;  // Sign extend
}

// Extract registers from 35c format invoke
export function getRegisters_35c(insn: number, word2: number): number[] {
  const count = (insn >> 12) & 0xF;
  const regs: number[] = [];

  // Registers encoded in word2: C|D|E|F and G from insn
  if (count >= 1) regs.push(word2 & 0xF);
  if (count >= 2) regs.push((word2 >> 4) & 0xF);
  if (count >= 3) regs.push((word2 >> 8) & 0xF);
  if (count >= 4) regs.push((word2 >> 12) & 0xF);
  if (count >= 5) regs.push((insn >> 8) & 0xF);

  return regs;
}
```

---

## 6. Essential Opcode Implementations (`src/interpreter/opcodes.ts`)

### 6.1 Required Opcodes

These opcodes are essential for executing Hello World and basic Java methods:

| Opcode | Hex | Format | Description |
|--------|-----|--------|-------------|
| nop | 0x00 | 10x | No operation |
| move | 0x01 | 12x | Move register (non-object) |
| move-object | 0x07 | 12x | Move object reference |
| move-result | 0x0a | 11x | Move result of method (non-object) |
| move-result-object | 0x0c | 11x | Move result of method (object) |
| return-void | 0x0e | 10x | Return void |
| return | 0x0f | 11x | Return 32-bit value |
| return-object | 0x11 | 11x | Return object reference |
| const/4 | 0x12 | 11n | Const 4-bit signed |
| const/16 | 0x13 | 21s | Const 16-bit signed |
| const | 0x14 | 31i | Const 32-bit |
| const-string | 0x1a | 21c | Load string from pool |
| const-class | 0x1c | 21c | Load class reference |
| new-instance | 0x22 | 21c | Create new object |
| iget | 0x52 | 22c | Get instance field (32-bit) |
| iget-object | 0x54 | 22c | Get instance field (object) |
| iput | 0x59 | 22c | Put instance field (32-bit) |
| iput-object | 0x5b | 22c | Put instance field (object) |
| sget | 0x60 | 21c | Get static field (32-bit) |
| sget-object | 0x62 | 21c | Get static field (object) |
| sput | 0x67 | 21c | Put static field (32-bit) |
| sput-object | 0x69 | 21c | Put static field (object) |
| invoke-virtual | 0x6e | 35c | Invoke virtual method |
| invoke-super | 0x6f | 35c | Invoke superclass method |
| invoke-direct | 0x70 | 35c | Invoke direct method |
| invoke-static | 0x71 | 35c | Invoke static method |

### 6.2 Opcode Implementations

#### nop (0x00)
```typescript
register(0x00, {
  name: 'nop',
  format: '10x',
  width: 1,
  handler: (ctx, insn) => {
    ctx.frame.pc += 1;
  }
});
```

#### move (0x01)
```typescript
register(0x01, {
  name: 'move',
  format: '12x',
  width: 1,
  handler: (ctx, insn) => {
    const vA = getRegA_12x(insn);
    const vB = getRegB_12x(insn);
    ctx.frame.registers[vA] = ctx.frame.registers[vB];
    ctx.frame.pc += 1;
  }
});
```

#### move-object (0x07)
```typescript
register(0x07, {
  name: 'move-object',
  format: '12x',
  width: 1,
  handler: (ctx, insn) => {
    const vA = getRegA_12x(insn);
    const vB = getRegB_12x(insn);
    const val = ctx.frame.registers[vB];
    if (val.type !== 'object' && val.type !== 'null') {
      throw new InterpreterError('move-object requires object reference');
    }
    ctx.frame.registers[vA] = val;
    ctx.frame.pc += 1;
  }
});
```

#### move-result-object (0x0c)
```typescript
register(0x0c, {
  name: 'move-result-object',
  format: '11x',
  width: 1,
  handler: (ctx, insn) => {
    const vA = (insn >> 8) & 0xFF;
    ctx.frame.registers[vA] = ctx.interpreter.getLastResult();
    ctx.frame.pc += 1;
  }
});
```

#### return-void (0x0e)
```typescript
register(0x0e, {
  name: 'return-void',
  format: '10x',
  width: 1,
  handler: (ctx, insn) => {
    ctx.interpreter.returnFromMethod({ type: 'null' });
  }
});
```

#### return-object (0x11)
```typescript
register(0x11, {
  name: 'return-object',
  format: '11x',
  width: 1,
  handler: (ctx, insn) => {
    const vA = (insn >> 8) & 0xFF;
    const val = ctx.frame.registers[vA];
    ctx.interpreter.returnFromMethod(val);
  }
});
```

#### const/4 (0x12)
```typescript
register(0x12, {
  name: 'const/4',
  format: '11n',
  width: 1,
  handler: (ctx, insn) => {
    const vA = (insn >> 8) & 0xF;
    const literal = getLiteral_11n(insn);
    ctx.frame.registers[vA] = { type: 'int', value: literal };
    ctx.frame.pc += 1;
  }
});
```

#### const/16 (0x13)
```typescript
register(0x13, {
  name: 'const/16',
  format: '21s',
  width: 2,
  handler: (ctx, insn) => {
    const vA = (insn >> 8) & 0xFF;
    const code = ctx.frame.method.code!.insns;
    const literal = signExtend16(code[ctx.frame.pc + 1]);
    ctx.frame.registers[vA] = { type: 'int', value: literal };
    ctx.frame.pc += 2;
  }
});
```

#### const-string (0x1a)
```typescript
register(0x1a, {
  name: 'const-string',
  format: '21c',
  width: 2,
  handler: (ctx, insn) => {
    const vA = (insn >> 8) & 0xFF;
    const code = ctx.frame.method.code!.insns;
    const stringIdx = code[ctx.frame.pc + 1];

    const str = ctx.dex.getString(stringIdx);
    const ref = ctx.heap.internString(str);

    ctx.frame.registers[vA] = { type: 'object', ref };
    ctx.frame.pc += 2;
  }
});
```

#### new-instance (0x22)
```typescript
register(0x22, {
  name: 'new-instance',
  format: '21c',
  width: 2,
  handler: (ctx, insn) => {
    const vA = (insn >> 8) & 0xFF;
    const code = ctx.frame.method.code!.insns;
    const typeIdx = code[ctx.frame.pc + 1];

    const typeDescriptor = ctx.dex.getTypeName(typeIdx);
    ctx.classLoader.initializeClass(typeDescriptor);

    const ref = ctx.heap.allocate(typeDescriptor);
    ctx.frame.registers[vA] = { type: 'object', ref };
    ctx.frame.pc += 2;
  }
});
```

#### iget (0x52)
```typescript
register(0x52, {
  name: 'iget',
  format: '22c',
  width: 2,
  handler: (ctx, insn) => {
    const vA = (insn >> 8) & 0xF;
    const vB = (insn >> 12) & 0xF;
    const code = ctx.frame.method.code!.insns;
    const fieldIdx = code[ctx.frame.pc + 1];

    const field = ctx.classLoader.resolveField(fieldIdx);
    const objRef = ctx.frame.registers[vB];

    if (objRef.type === 'null') {
      throw new NullPointerException('iget on null reference');
    }

    const value = ctx.heap.getField((objRef as {type: 'object', ref: number}).ref, field.name);
    ctx.frame.registers[vA] = value;
    ctx.frame.pc += 2;
  }
});
```

#### iget-object (0x54)
```typescript
register(0x54, {
  name: 'iget-object',
  format: '22c',
  width: 2,
  handler: (ctx, insn) => {
    // Same as iget but validates result is object type
    const vA = (insn >> 8) & 0xF;
    const vB = (insn >> 12) & 0xF;
    const code = ctx.frame.method.code!.insns;
    const fieldIdx = code[ctx.frame.pc + 1];

    const field = ctx.classLoader.resolveField(fieldIdx);
    const objRef = ctx.frame.registers[vB];

    if (objRef.type === 'null') {
      throw new NullPointerException('iget-object on null reference');
    }

    const value = ctx.heap.getField((objRef as {type: 'object', ref: number}).ref, field.name);
    ctx.frame.registers[vA] = value;
    ctx.frame.pc += 2;
  }
});
```

#### iput (0x59)
```typescript
register(0x59, {
  name: 'iput',
  format: '22c',
  width: 2,
  handler: (ctx, insn) => {
    const vA = (insn >> 8) & 0xF;
    const vB = (insn >> 12) & 0xF;
    const code = ctx.frame.method.code!.insns;
    const fieldIdx = code[ctx.frame.pc + 1];

    const field = ctx.classLoader.resolveField(fieldIdx);
    const objRef = ctx.frame.registers[vB];

    if (objRef.type === 'null') {
      throw new NullPointerException('iput on null reference');
    }

    const value = ctx.frame.registers[vA];
    ctx.heap.setField((objRef as {type: 'object', ref: number}).ref, field.name, value);
    ctx.frame.pc += 2;
  }
});
```

#### iput-object (0x5b)
```typescript
register(0x5b, {
  name: 'iput-object',
  format: '22c',
  width: 2,
  handler: (ctx, insn) => {
    // Same as iput but for object references
    const vA = (insn >> 8) & 0xF;
    const vB = (insn >> 12) & 0xF;
    const code = ctx.frame.method.code!.insns;
    const fieldIdx = code[ctx.frame.pc + 1];

    const field = ctx.classLoader.resolveField(fieldIdx);
    const objRef = ctx.frame.registers[vB];

    if (objRef.type === 'null') {
      throw new NullPointerException('iput-object on null reference');
    }

    const value = ctx.frame.registers[vA];
    ctx.heap.setField((objRef as {type: 'object', ref: number}).ref, field.name, value);
    ctx.frame.pc += 2;
  }
});
```

#### invoke-virtual (0x6e)
```typescript
register(0x6e, {
  name: 'invoke-virtual',
  format: '35c',
  width: 3,
  handler: (ctx, insn) => {
    const code = ctx.frame.method.code!.insns;
    const methodIdx = code[ctx.frame.pc + 1];
    const regWord = code[ctx.frame.pc + 2];
    const regs = getRegisters_35c(insn, regWord);

    // First register is 'this'
    const thisRef = ctx.frame.registers[regs[0]];
    if (thisRef.type === 'null') {
      throw new NullPointerException('invoke-virtual on null');
    }

    // Virtual dispatch based on actual object type
    const method = ctx.classLoader.resolveVirtualMethod(
      (thisRef as {type: 'object', ref: number}).ref,
      methodIdx
    );

    const args = regs.map(r => ctx.frame.registers[r]);
    ctx.interpreter.invokeMethod(method, args);
    ctx.frame.pc += 3;
  }
});
```

#### invoke-super (0x6f)
```typescript
register(0x6f, {
  name: 'invoke-super',
  format: '35c',
  width: 3,
  handler: (ctx, insn) => {
    const code = ctx.frame.method.code!.insns;
    const methodIdx = code[ctx.frame.pc + 1];
    const regWord = code[ctx.frame.pc + 2];
    const regs = getRegisters_35c(insn, regWord);

    // Resolve method in superclass, not virtual dispatch
    const method = ctx.classLoader.resolveSuperMethod(
      ctx.frame.method.classDescriptor,
      methodIdx
    );

    const args = regs.map(r => ctx.frame.registers[r]);
    ctx.interpreter.invokeMethod(method, args);
    ctx.frame.pc += 3;
  }
});
```

#### invoke-direct (0x70)
```typescript
register(0x70, {
  name: 'invoke-direct',
  format: '35c',
  width: 3,
  handler: (ctx, insn) => {
    const code = ctx.frame.method.code!.insns;
    const methodIdx = code[ctx.frame.pc + 1];
    const regWord = code[ctx.frame.pc + 2];
    const regs = getRegisters_35c(insn, regWord);

    // Direct invocation - no virtual dispatch
    // Used for constructors and private methods
    const method = ctx.classLoader.resolveMethod(methodIdx);

    const args = regs.map(r => ctx.frame.registers[r]);
    ctx.interpreter.invokeMethod(method, args);
    ctx.frame.pc += 3;
  }
});
```

#### invoke-static (0x71)
```typescript
register(0x71, {
  name: 'invoke-static',
  format: '35c',
  width: 3,
  handler: (ctx, insn) => {
    const code = ctx.frame.method.code!.insns;
    const methodIdx = code[ctx.frame.pc + 1];
    const regWord = code[ctx.frame.pc + 2];
    const regs = getRegisters_35c(insn, regWord);

    // Static invocation - no 'this' reference
    const method = ctx.classLoader.resolveMethod(methodIdx);

    // Ensure class is initialized
    ctx.classLoader.initializeClass(method.classDescriptor);

    const args = regs.map(r => ctx.frame.registers[r]);
    ctx.interpreter.invokeMethod(method, args);
    ctx.frame.pc += 3;
  }
});
```

#### move-result (0x0a)
```typescript
register(0x0a, {
  name: 'move-result',
  format: '11x',
  width: 1,
  handler: (ctx, insn) => {
    const vA = (insn >> 8) & 0xFF;
    ctx.frame.registers[vA] = ctx.interpreter.getLastResult();
    ctx.frame.pc += 1;
  }
});
```

#### return (0x0f)
```typescript
register(0x0f, {
  name: 'return',
  format: '11x',
  width: 1,
  handler: (ctx, insn) => {
    const vA = (insn >> 8) & 0xFF;
    const val = ctx.frame.registers[vA];
    ctx.interpreter.returnFromMethod(val);
  }
});
```

#### const (0x14)
```typescript
register(0x14, {
  name: 'const',
  format: '31i',
  width: 3,
  handler: (ctx, insn) => {
    const vA = (insn >> 8) & 0xFF;
    const code = ctx.frame.method.code!.insns;
    // 32-bit literal across two 16-bit words
    const low = code[ctx.frame.pc + 1];
    const high = code[ctx.frame.pc + 2];
    const literal = (high << 16) | low;
    ctx.frame.registers[vA] = { type: 'int', value: literal };
    ctx.frame.pc += 3;
  }
});
```

#### const-class (0x1c)
```typescript
register(0x1c, {
  name: 'const-class',
  format: '21c',
  width: 2,
  handler: (ctx, insn) => {
    const vA = (insn >> 8) & 0xFF;
    const code = ctx.frame.method.code!.insns;
    const typeIdx = code[ctx.frame.pc + 1];

    const typeDescriptor = ctx.dex.getTypeName(typeIdx);
    const classRef = ctx.classLoader.getClassObject(typeDescriptor);

    ctx.frame.registers[vA] = { type: 'object', ref: classRef };
    ctx.frame.pc += 2;
  }
});
```

#### sget (0x60)
```typescript
register(0x60, {
  name: 'sget',
  format: '21c',
  width: 2,
  handler: (ctx, insn) => {
    const vA = (insn >> 8) & 0xFF;
    const code = ctx.frame.method.code!.insns;
    const fieldIdx = code[ctx.frame.pc + 1];

    const field = ctx.classLoader.resolveField(fieldIdx);

    // Ensure class is initialized
    ctx.classLoader.initializeClass(field.classDescriptor);

    const value = ctx.classLoader.getStaticField(field);
    ctx.frame.registers[vA] = value;
    ctx.frame.pc += 2;
  }
});
```

#### sget-object (0x62)
```typescript
register(0x62, {
  name: 'sget-object',
  format: '21c',
  width: 2,
  handler: (ctx, insn) => {
    const vA = (insn >> 8) & 0xFF;
    const code = ctx.frame.method.code!.insns;
    const fieldIdx = code[ctx.frame.pc + 1];

    const field = ctx.classLoader.resolveField(fieldIdx);
    ctx.classLoader.initializeClass(field.classDescriptor);

    const value = ctx.classLoader.getStaticField(field);
    ctx.frame.registers[vA] = value;
    ctx.frame.pc += 2;
  }
});
```

#### sput (0x67)
```typescript
register(0x67, {
  name: 'sput',
  format: '21c',
  width: 2,
  handler: (ctx, insn) => {
    const vA = (insn >> 8) & 0xFF;
    const code = ctx.frame.method.code!.insns;
    const fieldIdx = code[ctx.frame.pc + 1];

    const field = ctx.classLoader.resolveField(fieldIdx);
    ctx.classLoader.initializeClass(field.classDescriptor);

    const value = ctx.frame.registers[vA];
    ctx.classLoader.setStaticField(field, value);
    ctx.frame.pc += 2;
  }
});
```

#### sput-object (0x69)
```typescript
register(0x69, {
  name: 'sput-object',
  format: '21c',
  width: 2,
  handler: (ctx, insn) => {
    const vA = (insn >> 8) & 0xFF;
    const code = ctx.frame.method.code!.insns;
    const fieldIdx = code[ctx.frame.pc + 1];

    const field = ctx.classLoader.resolveField(fieldIdx);
    ctx.classLoader.initializeClass(field.classDescriptor);

    const value = ctx.frame.registers[vA];
    ctx.classLoader.setStaticField(field, value);
    ctx.frame.pc += 2;
  }
});
```

---

## 7. Main Interpreter (`src/interpreter/interpreter.ts`)

### 7.1 Interface Design

```typescript
export class Interpreter {
  private dex: DexParser;
  private heap: Heap;
  private classLoader: ClassLoader;
  private frameManager: FrameManager;
  private opcodeTable: OpcodeTable;
  private shimRegistry: ShimRegistry;

  private lastResult: Value = { type: 'null' };
  private running: boolean = false;

  constructor(
    dex: DexParser,
    heap: Heap,
    shimRegistry: ShimRegistry
  );

  // Main entry points
  invoke(
    className: string,
    methodName: string,
    descriptor: string,
    args: Value[]
  ): Value;

  invokeMethod(method: ResolvedMethod, args: Value[]): void;

  // Internal execution
  private executeFrame(frame: ExecutionFrame): Value;
  private executeInstruction(frame: ExecutionFrame): boolean;

  // Method return handling
  returnFromMethod(value: Value): void;
  getLastResult(): Value;

  // Exception handling (basic)
  throwException(exceptionRef: number): void;
}
```

### 7.2 Execution Loop

```typescript
invoke(
  className: string,
  methodName: string,
  descriptor: string,
  args: Value[]
): Value {
  // Resolve the method
  const method = this.classLoader.resolveMethodByName(
    className,
    methodName,
    descriptor
  );

  if (!method) {
    throw new NoSuchMethodError(`${className}.${methodName}${descriptor}`);
  }

  // Create initial frame
  const frame = this.frameManager.createFrame(method, args);
  this.frameManager.pushFrame(frame);

  // Execute
  this.running = true;

  while (this.running && this.frameManager.getStackDepth() > 0) {
    const currentFrame = this.frameManager.currentFrame()!;

    if (currentFrame.method.isShim) {
      // Execute shim method
      const result = this.shimRegistry.invoke(
        currentFrame.method,
        this.heap,
        currentFrame.registers
      );
      this.returnFromMethod(result);
    } else {
      // Execute bytecode
      this.executeInstruction(currentFrame);
    }
  }

  return this.lastResult;
}

private executeInstruction(frame: ExecutionFrame): void {
  const code = frame.method.code!;
  const insns = code.insns;

  if (frame.pc >= insns.length) {
    throw new InterpreterError('PC out of bounds');
  }

  const insn = insns[frame.pc];
  const opcode = insn & 0xFF;

  const ctx: ExecutionContext = {
    frame,
    heap: this.heap,
    classLoader: this.classLoader,
    interpreter: this,
    dex: this.dex
  };

  this.opcodeTable.execute(ctx, opcode, insn);
}

returnFromMethod(value: Value): void {
  this.lastResult = value;

  const frame = this.frameManager.popFrame();
  if (!frame) {
    this.running = false;
    return;
  }

  // If there's a caller waiting for result, it will use move-result-*
}

invokeMethod(method: ResolvedMethod, args: Value[]): void {
  if (method.isShim) {
    // Shim methods execute immediately
    const result = this.shimRegistry.invoke(method, this.heap, args);
    this.lastResult = result;
  } else if (method.code) {
    // Push new frame for DEX method
    const frame = this.frameManager.createFrame(method, args);
    this.frameManager.pushFrame(frame);
  } else {
    throw new AbstractMethodError(`${method.classDescriptor}.${method.name}`);
  }
}
```

---

## 8. Method Resolver (`src/interpreter/method_resolver.ts`)

### 8.1 Interface Design

```typescript
export class MethodResolver {
  private dex: DexParser;
  private classLoader: ClassLoader;

  // Cache for resolved methods
  private methodCache: Map<number, ResolvedMethod> = new Map();
  private virtualMethodCache: Map<string, ResolvedMethod> = new Map();

  constructor(dex: DexParser, classLoader: ClassLoader);

  // Resolution methods
  resolveByIndex(methodIdx: number): ResolvedMethod;

  resolveVirtual(
    objectClass: string,
    methodIdx: number
  ): ResolvedMethod;

  resolveSuper(
    callingClass: string,
    methodIdx: number
  ): ResolvedMethod;

  resolveInterface(
    objectClass: string,
    methodIdx: number
  ): ResolvedMethod;

  // Cache management
  invalidateCache(): void;
}
```

### 8.2 Virtual Dispatch Algorithm

```typescript
resolveVirtual(objectClass: string, methodIdx: number): ResolvedMethod {
  // 1. Get method signature from methodIdx
  const methodId = this.dex.getMethodId(methodIdx);
  const methodName = this.dex.getString(methodId.nameIdx);
  const proto = this.dex.getProto(methodId.protoIdx);
  const descriptor = this.buildDescriptor(proto);

  // 2. Start from actual object class
  let currentClass = objectClass;

  // 3. Walk up inheritance chain
  while (currentClass) {
    const resolvedClass = this.classLoader.getClass(currentClass);
    if (!resolvedClass) break;

    // Check virtual methods
    const key = `${methodName}${descriptor}`;
    const method = resolvedClass.virtualMethods.get(key);
    if (method) {
      return method;
    }

    // Move to superclass
    currentClass = resolvedClass.superClass;
  }

  throw new NoSuchMethodError(`${objectClass}.${methodName}${descriptor}`);
}
```

---

## 9. Implementation Order

### Phase 1: Foundation (Days 1-2)

1. **`interpreter/types.ts`** - Value types and resolved structures
2. **`interpreter/heap.ts`** - Basic object allocation and field access
3. **`interpreter/frame.ts`** - Frame creation and register access

**Tests:**
- Allocate object, set/get fields
- Create frame, set/get registers
- String allocation and interning

### Phase 2: Class Loading (Days 3-4)

4. **`interpreter/class_loader.ts`** - Class and method resolution
5. **`interpreter/method_resolver.ts`** - Virtual dispatch

**Tests:**
- Load class from DEX
- Resolve method by index
- Virtual method lookup
- Static field storage and retrieval

### Phase 3: Opcodes (Days 5-7)

6. **`interpreter/opcode_table.ts`** - Dispatch infrastructure
7. **`interpreter/opcodes.ts`** - All essential opcode implementations

**Tests:**
- Execute `const/4 v0, 5; return v0` → returns 5
- Execute `new-instance; invoke-direct <init>` → allocates object
- Execute `invoke-static` → static method called
- Execute `sget/sput` → static fields accessed

### Phase 4: Java Base Classes (Days 8-9)

8. **`shim/java/lang/object.ts`** - java.lang.Object
9. **`shim/java/lang/string.ts`** - java.lang.String
10. **`shim/java/lang/string_builder.ts`** - java.lang.StringBuilder
11. **`shim/java/lang/class.ts`** - java.lang.Class (minimal)
12. **`shim/java/lang/system.ts`** - java.lang.System (stub)
13. **`shim/java/lang/index.ts`** - Registration

**Tests:**
- Object.hashCode() returns consistent value
- String.equals() works correctly
- StringBuilder.append().toString() builds string
- System.currentTimeMillis() returns value

### Phase 5: Integration (Days 10-12)

14. **`interpreter/interpreter.ts`** - Main execution loop
15. **Integration wiring** - Connect all components

**Tests:**
- Execute method that calls another method
- Execute method using StringBuilder
- Execute simple Hello World bytecode sequence

---

## 10. Testing Strategy

### 10.1 Unit Tests

```
test/unit/interpreter/
├── heap.test.ts
│   ├── allocates object with correct descriptor
│   ├── field set/get returns correct values
│   ├── array allocation and access
│   ├── string interning returns same reference
│   ├── getClassDescriptor returns correct type
│
├── frame.test.ts
│   ├── creates frame with correct register count
│   ├── arguments placed in correct registers
│   ├── wide values span two registers
│   ├── stack push/pop works correctly
│
├── class_loader.test.ts
│   ├── loads class from DEX
│   ├── resolves superclass chain
│   ├── resolves method by index
│   ├── virtual dispatch finds correct implementation
│   ├── static field get/set works
│   ├── class initialization calls <clinit>
│
├── opcodes.test.ts
│   ├── nop advances PC
│   ├── const/4 sets register to signed literal
│   ├── const/16 handles 16-bit signed values
│   ├── const handles 32-bit values
│   ├── const-string creates string reference
│   ├── const-class creates class reference
│   ├── new-instance allocates object
│   ├── iget/iput read/write instance fields
│   ├── sget/sput read/write static fields
│   ├── invoke-direct calls constructor
│   ├── invoke-virtual performs dispatch
│   ├── invoke-static calls static method
│   ├── invoke-super calls parent method
│   ├── return-void exits method
│   ├── return exits with int value
│   ├── return-object exits with reference
│   ├── move-result captures return value
│   ├── move-result-object captures object return
│
└── interpreter.test.ts
    ├── executes trivial method
    ├── handles method call chain
    ├── shim methods intercepted correctly
    ├── static methods execute correctly

test/unit/shim/
├── object.test.ts
│   ├── constructor initializes successfully
│   ├── hashCode returns consistent value
│   ├── equals compares references
│   ├── toString returns class@hash format
│
├── string.test.ts
│   ├── empty constructor creates empty string
│   ├── copy constructor copies value
│   ├── length returns correct count
│   ├── charAt returns character code
│   ├── equals compares string content
│   ├── substring extracts portion
│   ├── concat joins strings
│
├── string_builder.test.ts
│   ├── empty constructor creates empty builder
│   ├── append(String) adds string
│   ├── append(int) converts and adds
│   ├── append(Object) calls toString
│   ├── toString returns built string
│   ├── chained appends work correctly
│
├── class.test.ts
│   ├── getName returns dotted name
│   ├── getSimpleName returns short name
│
└── system.test.ts
    ├── currentTimeMillis returns timestamp
    ├── identityHashCode returns reference
    ├── arraycopy copies elements
```

### 10.2 Integration Tests

```
test/integration/
├── simple_method.test.ts
│   Execute: const/4 v0, 5; return v0
│   Expected: returns { type: 'int', value: 5 }
│
├── object_creation.test.ts
│   Execute: new-instance v0, Ljava/lang/Object;
│            invoke-direct {v0}, Ljava/lang/Object;-><init>()V
│            return-object v0
│   Expected: returns valid object reference
│
├── field_access.test.ts
│   Execute: new-instance, iput, iget sequence
│   Expected: field value correctly stored and retrieved
│
├── static_field.test.ts
│   Execute: sput, sget sequence
│   Expected: static field value stored and retrieved
│
├── method_calls.test.ts
│   Execute: method A calls method B, B returns value
│   Expected: A receives B's return value
│
├── static_method.test.ts
│   Execute: invoke-static to static method
│   Expected: static method executes and returns
│
├── string_builder.test.ts
│   Execute: new StringBuilder, append chain, toString
│   Expected: correctly built string returned
│
└── super_call.test.ts
    Execute: subclass method calling super.method()
    Expected: parent implementation executes
```

### 10.3 Test Fixtures

Create synthetic DEX bytecode for testing:

```typescript
// test/fixtures/synthetic_dex.ts

export function createSimpleMethodDex(): Uint8Array {
  // Returns DEX bytes with single class, single method:
  // public static int test() { return 5; }
  // Bytecode: const/4 v0, 5; return v0
}

export function createObjectCreationDex(): Uint8Array {
  // Returns DEX with method that creates and returns object
}
```

---

## 11. Error Handling

### 11.1 Exception Classes

```typescript
// src/interpreter/errors.ts

export class InterpreterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InterpreterError';
  }
}

export class NullPointerException extends InterpreterError {
  constructor(message?: string) {
    super(message || 'NullPointerException');
    this.name = 'NullPointerException';
  }
}

export class NoSuchMethodError extends InterpreterError {
  constructor(method: string) {
    super(`Method not found: ${method}`);
    this.name = 'NoSuchMethodError';
  }
}

export class AbstractMethodError extends InterpreterError {
  constructor(method: string) {
    super(`Abstract method called: ${method}`);
    this.name = 'AbstractMethodError';
  }
}

export class ClassNotFoundException extends InterpreterError {
  constructor(className: string) {
    super(`Class not found: ${className}`);
    this.name = 'ClassNotFoundException';
  }
}

export class VerifyError extends InterpreterError {
  constructor(message: string) {
    super(`Verification failed: ${message}`);
    this.name = 'VerifyError';
  }
}

export class ArrayIndexOutOfBoundsException extends InterpreterError {
  constructor(index: number) {
    super(`Array index out of bounds: ${index}`);
    this.name = 'ArrayIndexOutOfBoundsException';
  }
}

export class StringIndexOutOfBoundsException extends InterpreterError {
  constructor(index: number) {
    super(`String index out of bounds: ${index}`);
    this.name = 'StringIndexOutOfBoundsException';
  }
}

export class ArithmeticException extends InterpreterError {
  constructor(message: string) {
    super(message);
    this.name = 'ArithmeticException';
  }
}

export class IllegalArgumentException extends InterpreterError {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalArgumentException';
  }
}
```

---

## 12. Dependencies

### 12.1 From Stage 1

- `DexParser` - For reading DEX structures
- `CodeItem`, `MethodIdItem`, `ClassDefItem`, `FieldIdItem` - DEX types
- `decodeUleb128`, `decodeMutf8` - Utility functions
- `APKParser` - For extracting DEX from APK (optional for unit tests)

### 12.2 To Stage 3

Stage 3 (Android API Shim Layer) will depend on:
- `Heap` - For object allocation
- `Interpreter.invoke()` - For calling back into DEX code
- `Value` type - For parameter/return passing
- `ShimRegistry` - Now functional (not stubbed) with java.lang.* registered
- `ClassLoader` - For class resolution and initialization

### 12.3 Provided to Stage 3

Stage 2 provides these foundational shims that Stage 3 extends:
- `java.lang.Object` - Base class for all Android objects
- `java.lang.String` - Used extensively in Android APIs
- `java.lang.StringBuilder` - For string concatenation
- `java.lang.Class` - For reflection operations
- `java.lang.System` - Basic system utilities

### 12.4 ShimRegistry Implementation

```typescript
// src/interpreter/shim_registry.ts

type ShimMethod = (
  interpreter: Interpreter,
  heap: Heap,
  thisRef: number,
  args: Value[]
) => Value;

export class ShimRegistry {
  private methods: Map<string, ShimMethod> = new Map();
  private shimClasses: Set<string> = new Set();

  /**
   * Register a shim method implementation
   * @param className Class descriptor (e.g., "Ljava/lang/Object;")
   * @param methodName Method name (e.g., "toString")
   * @param descriptor Method descriptor (e.g., "()Ljava/lang/String;")
   * @param handler Implementation function
   */
  register(
    className: string,
    methodName: string,
    descriptor: string,
    handler: ShimMethod
  ): void {
    const key = `${className}:${methodName}:${descriptor}`;
    this.methods.set(key, handler);
    this.shimClasses.add(className);
  }

  /**
   * Check if a method has a shim implementation
   */
  hasMethod(className: string, methodName: string, descriptor: string): boolean {
    const key = `${className}:${methodName}:${descriptor}`;
    return this.methods.has(key);
  }

  /**
   * Check if a class is a shim class
   */
  isShimClass(className: string): boolean {
    return this.shimClasses.has(className);
  }

  /**
   * Invoke a shim method
   */
  invoke(
    method: ResolvedMethod,
    interpreter: Interpreter,
    heap: Heap,
    args: Value[]
  ): Value {
    const key = `${method.classDescriptor}:${method.name}:${method.descriptor}`;
    const handler = this.methods.get(key);

    if (!handler) {
      throw new NoSuchMethodError(
        `No shim for ${method.classDescriptor}.${method.name}${method.descriptor}`
      );
    }

    // Extract 'this' reference for instance methods
    // Static methods (no ACC_STATIC check needed for shims) pass thisRef as 0
    const isStatic = (method.accessFlags & 0x0008) !== 0;
    let thisRef = 0;
    let methodArgs = args;

    if (!isStatic && args.length > 0) {
      const firstArg = args[0];
      if (firstArg.type === 'object') {
        thisRef = firstArg.ref;
      }
      methodArgs = args.slice(1);
    }

    return handler(interpreter, heap, thisRef, methodArgs);
  }

  /**
   * Get all registered shim classes
   */
  getShimClasses(): string[] {
    return Array.from(this.shimClasses);
  }
}
```

### 12.5 ShimRegistry Initialization

```typescript
// src/interpreter/shim_init.ts

import { ShimRegistry } from './shim_registry';
import { registerJavaLangShims } from '../shim/java/lang/index';

export function initializeShimRegistry(): ShimRegistry {
  const registry = new ShimRegistry();

  // Register java.lang.* base classes (Stage 2)
  registerJavaLangShims(registry);

  // Stage 3 will add:
  // registerAndroidShims(registry);

  return registry;
}
```

---

## 13. Java Base Classes (`src/shim/java/lang/`)

Stage 2 includes minimal implementations of core java.lang.* classes required for the interpreter to function. These are foundational shims that Stage 3 builds upon.

### 13.1 java.lang.Object (`src/shim/java/lang/object.ts`)

The root of all Java classes. Required for any object instantiation.

```typescript
const OBJECT_CLASS = 'Ljava/lang/Object;';

export function registerObjectShim(registry: ShimRegistry): void {

  // <init>()V - Default constructor
  registry.register(OBJECT_CLASS, '<init>', '()V',
    (interp, heap, thisRef, args) => {
      // Object constructor does nothing
      return { type: 'null' };
    }
  );

  // getClass()Ljava/lang/Class;
  registry.register(OBJECT_CLASS, 'getClass', '()Ljava/lang/Class;',
    (interp, heap, thisRef, args) => {
      const descriptor = heap.getClassDescriptor(thisRef);
      const classRef = interp.getClassLoader().getClassObject(descriptor!);
      return { type: 'object', ref: classRef };
    }
  );

  // hashCode()I
  registry.register(OBJECT_CLASS, 'hashCode', '()I',
    (interp, heap, thisRef, args) => {
      // Use object reference as identity hash
      return { type: 'int', value: thisRef };
    }
  );

  // equals(Ljava/lang/Object;)Z
  registry.register(OBJECT_CLASS, 'equals', '(Ljava/lang/Object;)Z',
    (interp, heap, thisRef, args) => {
      const other = args[0];
      if (other.type === 'null') {
        return { type: 'int', value: 0 };
      }
      const otherRef = (other as { type: 'object'; ref: number }).ref;
      return { type: 'int', value: thisRef === otherRef ? 1 : 0 };
    }
  );

  // toString()Ljava/lang/String;
  registry.register(OBJECT_CLASS, 'toString', '()Ljava/lang/String;',
    (interp, heap, thisRef, args) => {
      const descriptor = heap.getClassDescriptor(thisRef);
      const str = `${descriptor}@${thisRef.toString(16)}`;
      const ref = heap.internString(str);
      return { type: 'object', ref };
    }
  );
}
```

### 13.2 java.lang.String (`src/shim/java/lang/string.ts`)

String is special - it's both a heap object and has a native string value.

```typescript
const STRING_CLASS = 'Ljava/lang/String;';

export function registerStringShim(registry: ShimRegistry): void {

  // <init>()V - Empty string constructor
  registry.register(STRING_CLASS, '<init>', '()V',
    (interp, heap, thisRef, args) => {
      heap.setStringValue(thisRef, '');
      return { type: 'null' };
    }
  );

  // <init>(Ljava/lang/String;)V - Copy constructor
  registry.register(STRING_CLASS, '<init>', '(Ljava/lang/String;)V',
    (interp, heap, thisRef, args) => {
      const sourceRef = (args[0] as { type: 'object'; ref: number }).ref;
      const value = heap.getStringValue(sourceRef);
      heap.setStringValue(thisRef, value);
      return { type: 'null' };
    }
  );

  // length()I
  registry.register(STRING_CLASS, 'length', '()I',
    (interp, heap, thisRef, args) => {
      const value = heap.getStringValue(thisRef);
      return { type: 'int', value: value.length };
    }
  );

  // charAt(I)C
  registry.register(STRING_CLASS, 'charAt', '(I)C',
    (interp, heap, thisRef, args) => {
      const index = (args[0] as { type: 'int'; value: number }).value;
      const value = heap.getStringValue(thisRef);
      if (index < 0 || index >= value.length) {
        throw new StringIndexOutOfBoundsException(index);
      }
      return { type: 'int', value: value.charCodeAt(index) };
    }
  );

  // equals(Ljava/lang/Object;)Z
  registry.register(STRING_CLASS, 'equals', '(Ljava/lang/Object;)Z',
    (interp, heap, thisRef, args) => {
      const other = args[0];
      if (other.type === 'null') {
        return { type: 'int', value: 0 };
      }
      const otherRef = (other as { type: 'object'; ref: number }).ref;
      const otherDescriptor = heap.getClassDescriptor(otherRef);
      if (otherDescriptor !== STRING_CLASS) {
        return { type: 'int', value: 0 };
      }
      const thisValue = heap.getStringValue(thisRef);
      const otherValue = heap.getStringValue(otherRef);
      return { type: 'int', value: thisValue === otherValue ? 1 : 0 };
    }
  );

  // hashCode()I
  registry.register(STRING_CLASS, 'hashCode', '()I',
    (interp, heap, thisRef, args) => {
      const value = heap.getStringValue(thisRef);
      // Java String hashCode algorithm
      let hash = 0;
      for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
      }
      return { type: 'int', value: hash };
    }
  );

  // toString()Ljava/lang/String;
  registry.register(STRING_CLASS, 'toString', '()Ljava/lang/String;',
    (interp, heap, thisRef, args) => {
      // String.toString() returns this
      return { type: 'object', ref: thisRef };
    }
  );

  // substring(I)Ljava/lang/String;
  registry.register(STRING_CLASS, 'substring', '(I)Ljava/lang/String;',
    (interp, heap, thisRef, args) => {
      const start = (args[0] as { type: 'int'; value: number }).value;
      const value = heap.getStringValue(thisRef);
      const result = value.substring(start);
      const ref = heap.internString(result);
      return { type: 'object', ref };
    }
  );

  // substring(II)Ljava/lang/String;
  registry.register(STRING_CLASS, 'substring', '(II)Ljava/lang/String;',
    (interp, heap, thisRef, args) => {
      const start = (args[0] as { type: 'int'; value: number }).value;
      const end = (args[1] as { type: 'int'; value: number }).value;
      const value = heap.getStringValue(thisRef);
      const result = value.substring(start, end);
      const ref = heap.internString(result);
      return { type: 'object', ref };
    }
  );

  // concat(Ljava/lang/String;)Ljava/lang/String;
  registry.register(STRING_CLASS, 'concat', '(Ljava/lang/String;)Ljava/lang/String;',
    (interp, heap, thisRef, args) => {
      const otherRef = (args[0] as { type: 'object'; ref: number }).ref;
      const thisValue = heap.getStringValue(thisRef);
      const otherValue = heap.getStringValue(otherRef);
      const result = thisValue + otherValue;
      const ref = heap.internString(result);
      return { type: 'object', ref };
    }
  );
}
```

### 13.3 java.lang.StringBuilder (`src/shim/java/lang/string_builder.ts`)

StringBuilder is commonly used for string concatenation.

```typescript
const STRINGBUILDER_CLASS = 'Ljava/lang/StringBuilder;';

// StringBuilder stores its value in a special field
const BUILDER_VALUE_FIELD = '__builderValue';

export function registerStringBuilderShim(registry: ShimRegistry): void {

  // <init>()V
  registry.register(STRINGBUILDER_CLASS, '<init>', '()V',
    (interp, heap, thisRef, args) => {
      heap.setField(thisRef, BUILDER_VALUE_FIELD,
        { type: 'object', ref: heap.internString('') });
      return { type: 'null' };
    }
  );

  // <init>(Ljava/lang/String;)V
  registry.register(STRINGBUILDER_CLASS, '<init>', '(Ljava/lang/String;)V',
    (interp, heap, thisRef, args) => {
      const strRef = (args[0] as { type: 'object'; ref: number }).ref;
      const value = heap.getStringValue(strRef);
      heap.setField(thisRef, BUILDER_VALUE_FIELD,
        { type: 'object', ref: heap.internString(value) });
      return { type: 'null' };
    }
  );

  // append(Ljava/lang/String;)Ljava/lang/StringBuilder;
  registry.register(STRINGBUILDER_CLASS, 'append',
    '(Ljava/lang/String;)Ljava/lang/StringBuilder;',
    (interp, heap, thisRef, args) => {
      const currentField = heap.getField(thisRef, BUILDER_VALUE_FIELD);
      const currentRef = (currentField as { type: 'object'; ref: number }).ref;
      const current = heap.getStringValue(currentRef);

      const appendRef = (args[0] as { type: 'object'; ref: number }).ref;
      const appendStr = args[0].type === 'null' ? 'null' : heap.getStringValue(appendRef);

      heap.setField(thisRef, BUILDER_VALUE_FIELD,
        { type: 'object', ref: heap.internString(current + appendStr) });

      return { type: 'object', ref: thisRef };  // Returns this for chaining
    }
  );

  // append(I)Ljava/lang/StringBuilder;
  registry.register(STRINGBUILDER_CLASS, 'append',
    '(I)Ljava/lang/StringBuilder;',
    (interp, heap, thisRef, args) => {
      const currentField = heap.getField(thisRef, BUILDER_VALUE_FIELD);
      const currentRef = (currentField as { type: 'object'; ref: number }).ref;
      const current = heap.getStringValue(currentRef);

      const intValue = (args[0] as { type: 'int'; value: number }).value;

      heap.setField(thisRef, BUILDER_VALUE_FIELD,
        { type: 'object', ref: heap.internString(current + intValue.toString()) });

      return { type: 'object', ref: thisRef };
    }
  );

  // append(Ljava/lang/Object;)Ljava/lang/StringBuilder;
  registry.register(STRINGBUILDER_CLASS, 'append',
    '(Ljava/lang/Object;)Ljava/lang/StringBuilder;',
    (interp, heap, thisRef, args) => {
      const currentField = heap.getField(thisRef, BUILDER_VALUE_FIELD);
      const currentRef = (currentField as { type: 'object'; ref: number }).ref;
      const current = heap.getStringValue(currentRef);

      let appendStr: string;
      if (args[0].type === 'null') {
        appendStr = 'null';
      } else {
        // Call toString() on the object
        const objRef = (args[0] as { type: 'object'; ref: number }).ref;
        const result = interp.invoke(
          heap.getClassDescriptor(objRef)!,
          'toString',
          '()Ljava/lang/String;',
          [args[0]]
        );
        appendStr = heap.getStringValue((result as { type: 'object'; ref: number }).ref);
      }

      heap.setField(thisRef, BUILDER_VALUE_FIELD,
        { type: 'object', ref: heap.internString(current + appendStr) });

      return { type: 'object', ref: thisRef };
    }
  );

  // toString()Ljava/lang/String;
  registry.register(STRINGBUILDER_CLASS, 'toString', '()Ljava/lang/String;',
    (interp, heap, thisRef, args) => {
      const valueField = heap.getField(thisRef, BUILDER_VALUE_FIELD);
      return valueField;
    }
  );

  // length()I
  registry.register(STRINGBUILDER_CLASS, 'length', '()I',
    (interp, heap, thisRef, args) => {
      const valueField = heap.getField(thisRef, BUILDER_VALUE_FIELD);
      const valueRef = (valueField as { type: 'object'; ref: number }).ref;
      const value = heap.getStringValue(valueRef);
      return { type: 'int', value: value.length };
    }
  );
}
```

### 13.4 java.lang.Class (`src/shim/java/lang/class.ts`)

Minimal Class implementation for reflection basics.

```typescript
const CLASS_CLASS = 'Ljava/lang/Class;';

export function registerClassShim(registry: ShimRegistry): void {

  // getName()Ljava/lang/String;
  registry.register(CLASS_CLASS, 'getName', '()Ljava/lang/String;',
    (interp, heap, thisRef, args) => {
      // Class objects store descriptor in a special field
      const descriptor = heap.getField(thisRef, '__classDescriptor');
      const descriptorRef = (descriptor as { type: 'object'; ref: number }).ref;
      const descriptorStr = heap.getStringValue(descriptorRef);

      // Convert Lcom/example/Foo; to com.example.Foo
      const name = descriptorStr
        .slice(1, -1)  // Remove L and ;
        .replace(/\//g, '.');

      const ref = heap.internString(name);
      return { type: 'object', ref };
    }
  );

  // getSimpleName()Ljava/lang/String;
  registry.register(CLASS_CLASS, 'getSimpleName', '()Ljava/lang/String;',
    (interp, heap, thisRef, args) => {
      const descriptor = heap.getField(thisRef, '__classDescriptor');
      const descriptorRef = (descriptor as { type: 'object'; ref: number }).ref;
      const descriptorStr = heap.getStringValue(descriptorRef);

      // Extract simple name from Lcom/example/Foo;
      const fullName = descriptorStr.slice(1, -1);
      const simpleName = fullName.substring(fullName.lastIndexOf('/') + 1);

      const ref = heap.internString(simpleName);
      return { type: 'object', ref };
    }
  );

  // toString()Ljava/lang/String;
  registry.register(CLASS_CLASS, 'toString', '()Ljava/lang/String;',
    (interp, heap, thisRef, args) => {
      const descriptor = heap.getField(thisRef, '__classDescriptor');
      const descriptorRef = (descriptor as { type: 'object'; ref: number }).ref;
      const descriptorStr = heap.getStringValue(descriptorRef);
      const name = descriptorStr.slice(1, -1).replace(/\//g, '.');
      const ref = heap.internString(`class ${name}`);
      return { type: 'object', ref };
    }
  );
}
```

### 13.5 java.lang.System (`src/shim/java/lang/system.ts`)

Stub for System class - minimal implementation.

```typescript
const SYSTEM_CLASS = 'Ljava/lang/System;';

export function registerSystemShim(registry: ShimRegistry): void {

  // currentTimeMillis()J
  registry.register(SYSTEM_CLASS, 'currentTimeMillis', '()J',
    (interp, heap, thisRef, args) => {
      const time = Date.now();
      // Return as long (two 32-bit values)
      return {
        type: 'long',
        low: time & 0xFFFFFFFF,
        high: Math.floor(time / 0x100000000) & 0xFFFFFFFF
      };
    }
  );

  // identityHashCode(Ljava/lang/Object;)I
  registry.register(SYSTEM_CLASS, 'identityHashCode', '(Ljava/lang/Object;)I',
    (interp, heap, thisRef, args) => {
      if (args[0].type === 'null') {
        return { type: 'int', value: 0 };
      }
      const ref = (args[0] as { type: 'object'; ref: number }).ref;
      return { type: 'int', value: ref };
    }
  );

  // arraycopy(Ljava/lang/Object;ILjava/lang/Object;II)V
  registry.register(SYSTEM_CLASS, 'arraycopy',
    '(Ljava/lang/Object;ILjava/lang/Object;II)V',
    (interp, heap, thisRef, args) => {
      const srcRef = (args[0] as { type: 'object'; ref: number }).ref;
      const srcPos = (args[1] as { type: 'int'; value: number }).value;
      const dstRef = (args[2] as { type: 'object'; ref: number }).ref;
      const dstPos = (args[3] as { type: 'int'; value: number }).value;
      const length = (args[4] as { type: 'int'; value: number }).value;

      for (let i = 0; i < length; i++) {
        const value = heap.getArrayElement(srcRef, srcPos + i);
        heap.setArrayElement(dstRef, dstPos + i, value);
      }

      return { type: 'null' };
    }
  );
}
```

### 13.6 Registration Index (`src/shim/java/lang/index.ts`)

```typescript
import { ShimRegistry } from '../../interpreter/shim_registry';
import { registerObjectShim } from './object';
import { registerStringShim } from './string';
import { registerStringBuilderShim } from './string_builder';
import { registerClassShim } from './class';
import { registerSystemShim } from './system';

export function registerJavaLangShims(registry: ShimRegistry): void {
  registerObjectShim(registry);
  registerStringShim(registry);
  registerStringBuilderShim(registry);
  registerClassShim(registry);
  registerSystemShim(registry);
}
```

---

## 14. Verification Checklist

### Stage 2 Complete When:

**Heap & Memory:**
- [ ] `Heap` allocates objects and arrays correctly
- [ ] `Heap` field access works for all primitive and object types
- [ ] `Heap` string interning returns same reference for same string
- [ ] `Heap` array element access works correctly

**Frame Management:**
- [ ] `FrameManager` creates frames with correct register count
- [ ] Arguments placed in correct registers (last N registers)
- [ ] Wide values span two registers correctly

**Class Loading:**
- [ ] `ClassLoader` loads classes from DEX
- [ ] `ClassLoader` resolves methods by index
- [ ] `ClassLoader` resolves fields by index
- [ ] `ClassLoader` handles static field storage
- [ ] `ClassLoader` performs class initialization (`<clinit>`)
- [ ] `MethodResolver` performs virtual dispatch correctly
- [ ] `MethodResolver` resolves super methods correctly

**Opcodes:**
- [ ] All 26 essential opcodes implemented
- [ ] `invoke-virtual` performs virtual dispatch
- [ ] `invoke-direct` calls constructors/private methods
- [ ] `invoke-static` calls static methods
- [ ] `invoke-super` calls superclass methods
- [ ] `sget/sput` access static fields
- [ ] `iget/iput` access instance fields

**Java Base Classes:**
- [ ] `java.lang.Object` - constructor, hashCode, equals, toString
- [ ] `java.lang.String` - constructor, length, charAt, equals, substring, concat
- [ ] `java.lang.StringBuilder` - constructor, append (String, int, Object), toString
- [ ] `java.lang.Class` - getName, getSimpleName (minimal)
- [ ] `java.lang.System` - currentTimeMillis, identityHashCode, arraycopy

**Interpreter:**
- [ ] `Interpreter` executes simple methods
- [ ] `Interpreter` handles method call chains
- [ ] `Interpreter` correctly passes return values

**Verification Tests:**
- [ ] Unit test: `const/4 v0, 5; return v0` → returns 5
- [ ] Unit test: `new-instance` + `invoke-direct <init>` works
- [ ] Unit test: `invoke-static` calls static method
- [ ] Unit test: `sget/sput` reads/writes static fields
- [ ] Unit test: StringBuilder builds and returns string
- [ ] Integration test: Method calling another method works
- [ ] Integration test: String concatenation via StringBuilder works

---

## 14. Notes and Considerations

### 14.1 Performance

For PoC, prioritize correctness over performance:
- Use Map for fields (vs. array with offsets)
- Linear search in vtable (vs. hash table)
- No method caching initially

### 14.2 Debugging

Add tracing support (disabled by default):
```typescript
const TRACE_EXECUTION = false;

if (TRACE_EXECUTION) {
  console.log(`[${frame.method.name}] PC=${frame.pc} op=${opcode.toString(16)}`);
}
```

### 14.3 Future Optimization Points

Mark these for post-PoC:
- Field access by index instead of name
- Method dispatch table caching
- Instruction combining for common patterns
- Register allocation analysis

---

## 15. Task Allocation Alignment

Per craft_plan.md, Stage 2 tasks are allocated as follows:

| Task | Owner | Support | Status |
|------|-------|---------|--------|
| Interpreter architecture | Engineer A | Engineer B | |
| Bytecode interpreter loop | Engineer B | | |
| Opcode implementation (arithmetic/logic) | Engineer B | | |
| Opcode implementation (invoke/return) | Engineer A | Engineer B | |
| Object model & heap | Engineer B | | |
| java.lang.* base classes | Engineer A | | |
| Testing framework & tests | Engineer C | | |
| Code review & management | Engineer A | | |

### Parallel Workstreams

**Engineer A Focus:**
- Interpreter architecture design
- invoke-* opcode family
- java.lang.Object, String, StringBuilder shims
- Code review

**Engineer B Focus:**
- Bytecode interpreter loop
- Heap and object model
- const/move/return opcodes
- Field access opcodes (iget/iput/sget/sput)

**Engineer C Focus:**
- Testing framework setup
- Unit test implementation
- Integration test implementation

### Recommended Sprint Plan

**Week 3 (Days 1-5):**
- Day 1-2: types.ts, heap.ts, frame.ts (Engineer B)
- Day 1-2: Interpreter architecture doc (Engineer A)
- Day 1-2: Test framework setup (Engineer C)
- Day 3-4: class_loader.ts, method_resolver.ts (Engineer B + A)
- Day 3-5: Opcode table and basic opcodes (Engineer B)
- Day 5: First integration checkpoint

**Week 4 (Days 6-10):**
- Day 6-7: Complete all opcodes (Engineer A + B)
- Day 6-8: java.lang.* shims (Engineer A)
- Day 6-10: Unit tests for all components (Engineer C)
- Day 8-9: interpreter.ts main loop (Engineer B)
- Day 9-10: Full integration wiring (All)
- Day 10: Stage 2 verification checkpoint

---

## 16. Summary

### Key Additions from craft_plan.md

This detailed plan adds the following beyond the high-level craft_plan.md:

1. **java.lang.* Base Classes** - Explicitly included in Stage 2:
   - `java.lang.Object` - Foundation for all objects
   - `java.lang.String` - Essential for any string handling
   - `java.lang.StringBuilder` - Common for string concatenation
   - `java.lang.Class` - Minimal reflection support
   - `java.lang.System` - Basic utilities

2. **invoke-static Opcode** - Elevated to essential (was marked P2)

3. **Static Field Operations** - Added sget/sput opcodes for static fields

4. **Full ShimRegistry** - Now functional, not a stub

5. **Comprehensive Error Classes** - All exception types defined

### Stage 2 Exit Criteria

Stage 2 is complete when:
1. All 26 essential opcodes are implemented and tested
2. java.lang.* base classes are implemented and tested
3. Interpreter can execute method call chains
4. String operations via StringBuilder work
5. All unit tests pass
6. All integration tests pass

### Dependencies for Stage 3

Stage 3 (Android API Shim) can begin when Stage 2 provides:
- Working `Interpreter.invoke()` method
- Functional `ShimRegistry` with java.lang.* registered
- Working `Heap` for object allocation
- Working `ClassLoader` for class resolution
