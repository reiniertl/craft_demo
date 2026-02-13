/**
 * Tests for opcode implementations.
 * Uses synthetic bytecode sequences to test each opcode.
 */

import { OpcodeTable, ExecutionContext } from '../../../src/interpreter/opcode_table';
import { registerEssentialOpcodes } from '../../../src/interpreter/opcodes';
import { Heap } from '../../../src/interpreter/heap';
import { FrameManager, ExecutionFrame } from '../../../src/interpreter/frame';
import { ResolvedMethod, Value } from '../../../src/interpreter/types';
import { intValue, objectRef, NULL_VALUE } from '../../../src/core/types';
import { CodeItem } from '../../../src/parser/dex_types';
import { NullPointerException } from '../../../src/interpreter/errors';

// Mock interpreter control
class MockInterpreterControl {
  lastResult: Value = NULL_VALUE;
  returnedValue: Value | null = null;
  invokedMethod: any = null;
  invokedArgs: Value[] = [];

  getLastResult(): Value { return this.lastResult; }
  returnFromMethod(value: Value): void { this.returnedValue = value; }
  invokeMethod(method: any, args: Value[]): void {
    this.invokedMethod = method;
    this.invokedArgs = args;
  }
}

// Mock DexParser
class MockDexParser {
  private strings: Map<number, string> = new Map();
  private types: Map<number, string> = new Map();

  setString(idx: number, value: string): void { this.strings.set(idx, value); }
  setType(idx: number, value: string): void { this.types.set(idx, value); }

  getString(idx: number): string { return this.strings.get(idx) || ''; }
  getTypeName(idx: number): string { return this.types.get(idx) || ''; }
  getMethodId(idx: number): any { return { classIdx: 0, protoIdx: 0, nameIdx: 0 }; }
  getFieldId(idx: number): any { return { classIdx: 0, typeIdx: 0, nameIdx: 0 }; }
  getProtoId(idx: number): any { return { shortyIdx: 0, returnTypeIdx: 0, parametersOff: 0 }; }
  getProtoParameters(proto: any): number[] { return []; }
  parseHeader(): any { return {}; }
}

// Mock ClassLoader
class MockClassLoader {
  resolvedFields: Map<number, any> = new Map();
  staticFields: Map<string, Value> = new Map();

  resolveField(fieldIdx: number): any {
    return this.resolvedFields.get(fieldIdx) || {
      classDescriptor: 'Lcom/example/Test;',
      name: 'field' + fieldIdx,
      descriptor: 'I',
      accessFlags: 0,
      offset: 0,
      isStatic: false,
    };
  }

  resolveMethod(methodIdx: number): ResolvedMethod {
    return {
      classDescriptor: 'Lcom/example/Test;',
      name: 'method',
      descriptor: '()V',
      accessFlags: 0,
      code: null,
      isShim: true,
    };
  }

  resolveVirtualMethod(objectRef: number, methodIdx: number): ResolvedMethod {
    return this.resolveMethod(methodIdx);
  }

  resolveSuperMethod(callingClass: string, methodIdx: number): ResolvedMethod {
    return this.resolveMethod(methodIdx);
  }

  initializeClass(descriptor: string): void {}

  getClassObject(descriptor: string): number { return 1; }

  getStaticField(field: any): Value {
    return this.staticFields.get(`${field.classDescriptor}:${field.name}`) || NULL_VALUE;
  }

  setStaticField(field: any, value: Value): void {
    this.staticFields.set(`${field.classDescriptor}:${field.name}`, value);
  }

  isInstanceOf(objectClass: string, targetType: string): boolean {
    // Simple test implementation: exact match only
    return objectClass === targetType;
  }
}

function makeFrame(insns: number[], registersSize: number = 4): {
  frame: ExecutionFrame;
  method: ResolvedMethod;
} {
  const code: CodeItem = {
    registersSize,
    insSize: 0,
    outsSize: 0,
    triesSize: 0,
    debugInfoOff: 0,
    insnsSize: insns.length,
    insns: new Uint16Array(insns),
    tries: [],
    handlers: [],
  };
  const method: ResolvedMethod = {
    classDescriptor: 'Lcom/example/Test;',
    name: 'test',
    descriptor: '()V',
    accessFlags: 0,
    code,
    isShim: false,
  };
  return {
    frame: {
      method,
      registers: new Array(registersSize).fill(null).map(() => intValue(0)),
      pc: 0,
      callerFrame: null,
      returnRegister: -1,
      lockRef: null,
    },
    method,
  };
}

describe('Opcodes', () => {
  let table: OpcodeTable;
  let heap: Heap;
  let mockInterp: MockInterpreterControl;
  let mockDex: MockDexParser;
  let mockClassLoader: MockClassLoader;

  beforeEach(() => {
    table = new OpcodeTable();
    registerEssentialOpcodes(table);
    heap = new Heap();
    mockInterp = new MockInterpreterControl();
    mockDex = new MockDexParser();
    mockClassLoader = new MockClassLoader();
  });

  function exec(insns: number[], setupFrame?: (frame: ExecutionFrame) => void): ExecutionFrame {
    const { frame } = makeFrame(insns);
    if (setupFrame) setupFrame(frame);
    const ctx: ExecutionContext = {
      frame,
      heap,
      classLoader: mockClassLoader as any,
      interpreter: mockInterp,
      dex: mockDex as any,
    };
    const opcode = insns[0] & 0xFF;
    table.execute(ctx, opcode, insns[0]);
    return frame;
  }

  describe('nop (0x00)', () => {
    it('advances PC by 1', () => {
      const frame = exec([0x0000]);
      expect(frame.pc).toBe(1);
    });
  });

  describe('move (0x01)', () => {
    it('copies value between registers', () => {
      // move v0, v1 -> 0x1001 (A=0, B=1)
      const frame = exec([0x1001], (f) => {
        f.registers[1] = intValue(42);
      });
      expect(frame.registers[0]).toEqual(intValue(42));
      expect(frame.pc).toBe(1);
    });
  });

  describe('move-result (0x0a)', () => {
    it('captures last result into register', () => {
      mockInterp.lastResult = intValue(99);
      // move-result v0 -> 0x000a
      const frame = exec([0x000a]);
      expect(frame.registers[0]).toEqual(intValue(99));
    });
  });

  describe('move-result-object (0x0c)', () => {
    it('captures object result into register', () => {
      mockInterp.lastResult = objectRef(5);
      // move-result-object v0 -> 0x000c
      const frame = exec([0x000c]);
      expect(frame.registers[0]).toEqual(objectRef(5));
    });
  });

  describe('return-void (0x0e)', () => {
    it('returns null value', () => {
      exec([0x000e]);
      expect(mockInterp.returnedValue).toEqual(NULL_VALUE);
    });
  });

  describe('return (0x0f)', () => {
    it('returns register value', () => {
      // return v1 -> 0x010f
      exec([0x010f], (f) => {
        f.registers[1] = intValue(77);
      });
      expect(mockInterp.returnedValue).toEqual(intValue(77));
    });
  });

  describe('return-object (0x11)', () => {
    it('returns object reference', () => {
      // return-object v0 -> 0x0011
      exec([0x0011], (f) => {
        f.registers[0] = objectRef(3);
      });
      expect(mockInterp.returnedValue).toEqual(objectRef(3));
    });
  });

  describe('const/4 (0x12)', () => {
    it('sets register to positive literal', () => {
      // const/4 v0, 5 -> vA=0, B=5 -> 0x5012
      const frame = exec([0x5012]);
      expect(frame.registers[0]).toEqual(intValue(5));
      expect(frame.pc).toBe(1);
    });

    it('sets register to negative literal', () => {
      // const/4 v0, -1 -> vA=0, B=0xF -> 0xF012
      const frame = exec([0xf012]);
      expect(frame.registers[0]).toEqual(intValue(-1));
    });

    it('sets register to 0', () => {
      // const/4 v0, 0 -> 0x0012
      const frame = exec([0x0012]);
      expect(frame.registers[0]).toEqual(intValue(0));
    });
  });

  describe('const/16 (0x13)', () => {
    it('sets register to 16-bit value', () => {
      // const/16 v0, 1000 -> [0x0013, 0x03E8]
      const { frame } = makeFrame([0x0013, 0x03e8]);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x13, 0x0013);
      expect(frame.registers[0]).toEqual(intValue(1000));
      expect(frame.pc).toBe(2);
    });

    it('handles negative 16-bit value', () => {
      // const/16 v0, -1 -> [0x0013, 0xFFFF]
      const { frame } = makeFrame([0x0013, 0xffff]);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x13, 0x0013);
      expect(frame.registers[0]).toEqual(intValue(-1));
    });
  });

  describe('const (0x14)', () => {
    it('sets register to 32-bit value', () => {
      // const v0, 0x12345678 -> [0x0014, 0x5678, 0x1234]
      const { frame } = makeFrame([0x0014, 0x5678, 0x1234]);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x14, 0x0014);
      expect(frame.registers[0]).toEqual(intValue(0x12345678));
      expect(frame.pc).toBe(3);
    });
  });

  describe('const-string (0x1a)', () => {
    it('loads string from pool into register', () => {
      mockDex.setString(0, 'Hello World');
      // const-string v0, string@0 -> [0x001a, 0x0000]
      const { frame } = makeFrame([0x001a, 0x0000]);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x1a, 0x001a);
      expect(frame.registers[0].type).toBe('object');
      const ref = (frame.registers[0] as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(ref)).toBe('Hello World');
      expect(frame.pc).toBe(2);
    });
  });

  describe('const-class (0x1c)', () => {
    it('creates class reference in register', () => {
      mockDex.setType(0, 'Lcom/example/Bar;');
      // const-class v0, type@0 -> [0x001c, 0x0000]
      const { frame } = makeFrame([0x001c, 0x0000]);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x1c, 0x001c);
      expect(frame.registers[0].type).toBe('object');
      expect(frame.pc).toBe(2);
    });
  });

  describe('instance-of (0x20)', () => {
    it('returns 1 when object is instance of type', () => {
      mockDex.setType(0, 'Lcom/example/Foo;');
      const objRef = heap.allocate('Lcom/example/Foo;');

      // instance-of v0, v1, type@0 -> vA=0(dest), vB=1(obj) -> [0x1020, 0x0000]
      const { frame } = makeFrame([0x1020, 0x0000]);
      frame.registers[1] = objectRef(objRef);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x20, 0x1020);
      expect(frame.registers[0]).toEqual(intValue(1)); // true
      expect(frame.pc).toBe(2);
    });

    it('returns 0 when object is not instance of type', () => {
      mockDex.setType(0, 'Lcom/example/Bar;');
      const objRef = heap.allocate('Lcom/example/Foo;'); // Different type

      // instance-of v0, v1, type@0
      const { frame } = makeFrame([0x1020, 0x0000]);
      frame.registers[1] = objectRef(objRef);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x20, 0x1020);
      expect(frame.registers[0]).toEqual(intValue(0)); // false
      expect(frame.pc).toBe(2);
    });

    it('returns 0 when object is null', () => {
      mockDex.setType(0, 'Lcom/example/Foo;');

      // instance-of v0, v1, type@0 with v1 = null
      const { frame } = makeFrame([0x1020, 0x0000]);
      frame.registers[1] = NULL_VALUE;
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x20, 0x1020);
      expect(frame.registers[0]).toEqual(intValue(0)); // false
      expect(frame.pc).toBe(2);
    });
  });

  describe('new-instance (0x22)', () => {
    it('allocates object of specified type', () => {
      mockDex.setType(0, 'Lcom/example/Foo;');
      // new-instance v0, type@0 -> [0x0022, 0x0000]
      const { frame } = makeFrame([0x0022, 0x0000]);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x22, 0x0022);
      expect(frame.registers[0].type).toBe('object');
      const ref = (frame.registers[0] as { type: 'object'; ref: number }).ref;
      expect(heap.getClassDescriptor(ref)).toBe('Lcom/example/Foo;');
      expect(frame.pc).toBe(2);
    });
  });

  describe('iget/iput (0x52/0x59)', () => {
    it('stores and retrieves instance field', () => {
      const objRef = heap.allocate('Lcom/example/Test;');

      // iput v0, v1, field@0 -> vA=0(value), vB=1(obj) -> 0x1052 for iget, 0x1059 for iput
      // First iput: store value from v0 into field of object in v1
      const { frame: putFrame } = makeFrame([0x1059, 0x0000]);
      putFrame.registers[0] = intValue(42);    // value to store
      putFrame.registers[1] = objectRef(objRef); // object ref
      const putCtx: ExecutionContext = {
        frame: putFrame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(putCtx, 0x59, 0x1059);

      // Then iget: load field of object in v1 into v0
      const { frame: getFrame } = makeFrame([0x1052, 0x0000]);
      getFrame.registers[1] = objectRef(objRef);
      const getCtx: ExecutionContext = {
        frame: getFrame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(getCtx, 0x52, 0x1052);
      expect(getFrame.registers[0]).toEqual(intValue(42));
    });

    it('throws NullPointerException on null object', () => {
      const { frame } = makeFrame([0x0052, 0x0000]);
      frame.registers[0] = NULL_VALUE;
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      expect(() => table.execute(ctx, 0x52, 0x0052)).toThrow(NullPointerException);
    });
  });

  describe('sget/sput (0x60/0x67)', () => {
    it('stores and retrieves static field', () => {
      // sput v0, field@0 -> 0x0067, 0x0000
      const { frame: putFrame } = makeFrame([0x0067, 0x0000]);
      putFrame.registers[0] = intValue(100);
      const putCtx: ExecutionContext = {
        frame: putFrame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(putCtx, 0x67, 0x0067);

      // sget v0, field@0 -> 0x0060, 0x0000
      const { frame: getFrame } = makeFrame([0x0060, 0x0000]);
      const getCtx: ExecutionContext = {
        frame: getFrame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(getCtx, 0x60, 0x0060);
      expect(getFrame.registers[0]).toEqual(intValue(100));
    });
  });

  describe('invoke-virtual (0x6e)', () => {
    it('performs virtual dispatch with correct args', () => {
      const objRef = heap.allocate('Lcom/example/Test;');
      // invoke-virtual {v0, v1}, method@0 -> count=2
      // word0: (2<<12)|(0<<8)|0x6e  (count=2, G=v0)  -- but G is only used for 5th reg
      // Actually for 35c: count in bits 15..12, vA (G register) in bits 11..8
      // For count=2: word0 = (2<<12)|0x6e = 0x206e
      // word1: method@0 = 0x0000
      // word2: C=v0, D=v1 -> (v1<<4)|v0 = 0x0010
      const { frame } = makeFrame([0x206e, 0x0000, 0x0010]);
      frame.registers[0] = objectRef(objRef);
      frame.registers[1] = intValue(99);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x6e, 0x206e);
      expect(mockInterp.invokedMethod).not.toBeNull();
      expect(mockInterp.invokedArgs).toEqual([objectRef(objRef), intValue(99)]);
      expect(frame.pc).toBe(3);
    });

    it('throws NullPointerException on null receiver', () => {
      // invoke-virtual {v0}, method@0 -> count=1
      const { frame } = makeFrame([0x106e, 0x0000, 0x0000]);
      frame.registers[0] = NULL_VALUE;
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      expect(() => table.execute(ctx, 0x6e, 0x106e)).toThrow(NullPointerException);
    });
  });

  describe('invoke-super (0x6f)', () => {
    it('calls parent method with correct args', () => {
      const objRef = heap.allocate('Lcom/example/Test;');
      // invoke-super {v0}, method@0 -> count=1
      // word0: (1<<12)|0x6f = 0x106f
      const { frame } = makeFrame([0x106f, 0x0000, 0x0000]);
      frame.registers[0] = objectRef(objRef);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x6f, 0x106f);
      expect(mockInterp.invokedMethod).not.toBeNull();
      expect(mockInterp.invokedArgs).toEqual([objectRef(objRef)]);
      expect(frame.pc).toBe(3);
    });
  });

  describe('invoke-direct (0x70)', () => {
    it('invokes method with correct args', () => {
      // invoke-direct {v0}, method@0 -> 3 words
      // word0: count=1, G=v0 -> (1<<12)|(0<<8)|0x70 = 0x1070
      // word1: method@0 = 0x0000
      // word2: regs DCFE = C=v0 -> 0x0000
      const { frame } = makeFrame([0x1070, 0x0000, 0x0000]);
      frame.registers[0] = objectRef(1);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x70, 0x1070);
      expect(mockInterp.invokedMethod).not.toBeNull();
      expect(mockInterp.invokedArgs).toEqual([objectRef(1)]);
      expect(frame.pc).toBe(3);
    });
  });

  describe('invoke-static (0x71)', () => {
    it('invokes static method', () => {
      // invoke-static {}, method@0 -> count=0
      // word0: (0<<12)|0x71 = 0x0071
      const { frame } = makeFrame([0x0071, 0x0000, 0x0000]);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x71, 0x0071);
      expect(mockInterp.invokedMethod).not.toBeNull();
      expect(frame.pc).toBe(3);
    });
  });
});
