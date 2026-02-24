/**
 * Tests for opcode implementations.
 * Uses synthetic bytecode sequences to test each opcode.
 */

import { OpcodeTable, ExecutionContext } from '../../../src/interpreter/opcode_table';
import { registerEssentialOpcodes } from '../../../src/interpreter/opcodes';
import { Heap } from '../../../src/interpreter/heap';
import { FrameManager, ExecutionFrame } from '../../../src/interpreter/frame';
import { ResolvedMethod, Value } from '../../../src/interpreter/types';
import { intValue, longValue, objectRef, NULL_VALUE } from '../../../src/core/types';
import { CodeItem } from '../../../src/parser/dex_types';
import { NullPointerException, InterpreterError } from '../../../src/interpreter/errors';

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

  function execEx(insns: number[], regCount: number, setupFrame?: (frame: ExecutionFrame) => void): ExecutionFrame {
    const { frame } = makeFrame(insns, regCount);
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

  // ============================================
  // Tests for newly added Tier 1 opcodes
  // ============================================

  describe('move/from16 (0x02)', () => {
    it('copies from high register to low', () => {
      // move/from16 v0, v3 -> [0x0002, 0x0003]
      const frame = execEx([0x0002, 0x0003], 8, (f) => {
        f.registers[3] = intValue(55);
      });
      expect(frame.registers[0]).toEqual(intValue(55));
      expect(frame.pc).toBe(2);
    });
  });

  describe('move/16 (0x03)', () => {
    it('copies between any two registers', () => {
      // move/16 vAAAA, vBBBB -> [0x0003, vA, vB]
      const frame = execEx([0x0003, 0x0001, 0x0004], 8, (f) => {
        f.registers[4] = intValue(77);
      });
      expect(frame.registers[1]).toEqual(intValue(77));
      expect(frame.pc).toBe(3);
    });
  });

  describe('move-wide (0x04)', () => {
    it('copies wide value (two registers)', () => {
      // move-wide v0, v2 -> 0x2004 (A=0, B=2)
      const frame = execEx([0x2004], 4, (f) => {
        f.registers[2] = longValue(100n);
        f.registers[3] = intValue(0); // second half
      });
      expect(frame.registers[0]).toEqual(longValue(100n));
      expect(frame.pc).toBe(1);
    });
  });

  describe('move-wide/from16 (0x05)', () => {
    it('copies wide value from high register', () => {
      // move-wide/from16 v0, v4 -> [0x0005, 0x0004]
      const frame = execEx([0x0005, 0x0004], 8, (f) => {
        f.registers[4] = longValue(999n);
        f.registers[5] = intValue(0);
      });
      expect(frame.registers[0]).toEqual(longValue(999n));
      expect(frame.pc).toBe(2);
    });
  });

  describe('move-wide/16 (0x06)', () => {
    it('copies wide value between any registers', () => {
      // move-wide/16 v0, v4 -> [0x0006, 0x0000, 0x0004]
      const frame = execEx([0x0006, 0x0000, 0x0004], 8, (f) => {
        f.registers[4] = longValue(12345n);
        f.registers[5] = intValue(0);
      });
      expect(frame.registers[0]).toEqual(longValue(12345n));
      expect(frame.pc).toBe(3);
    });
  });

  describe('move-object/from16 (0x08)', () => {
    it('copies object ref from high register', () => {
      // move-object/from16 v0, v3 -> [0x0008, 0x0003]
      const frame = execEx([0x0008, 0x0003], 8, (f) => {
        f.registers[3] = objectRef(42);
      });
      expect(frame.registers[0]).toEqual(objectRef(42));
      expect(frame.pc).toBe(2);
    });
  });

  describe('move-object/16 (0x09)', () => {
    it('copies object ref between any registers', () => {
      // move-object/16 v1, v5 -> [0x0009, 0x0001, 0x0005]
      const frame = execEx([0x0009, 0x0001, 0x0005], 8, (f) => {
        f.registers[5] = objectRef(10);
      });
      expect(frame.registers[1]).toEqual(objectRef(10));
      expect(frame.pc).toBe(3);
    });
  });

  describe('move-result-wide (0x0b)', () => {
    it('captures wide result', () => {
      mockInterp.lastResult = longValue(9999n);
      // move-result-wide v0 -> 0x000b
      const frame = exec([0x000b]);
      expect(frame.registers[0]).toEqual(longValue(9999n));
      expect(frame.pc).toBe(1);
    });
  });

  describe('move-exception (0x0d)', () => {
    it('moves exception to register', () => {
      mockInterp.lastResult = objectRef(7);
      // move-exception v0 -> 0x000d
      const frame = exec([0x000d]);
      expect(frame.registers[0]).toEqual(objectRef(7));
      expect(frame.pc).toBe(1);
    });
  });

  describe('const/high16 (0x15)', () => {
    it('loads high 16 bits of 32-bit value', () => {
      // const/high16 v0, 0x41C0 -> [0x0015, 0x41C0] => value = 0x41C00000
      const frame = execEx([0x0015, 0x41c0], 4);
      expect(frame.registers[0]).toEqual(intValue(0x41c00000));
      expect(frame.pc).toBe(2);
    });

    it('handles negative high16 (0xFF00)', () => {
      // const/high16 v0, 0xFF00 -> value = 0xFF000000 = -16777216
      const frame = execEx([0x0015, 0xff00], 4);
      expect(frame.registers[0].type).toBe('int');
      expect((frame.registers[0] as { type: 'int'; value: number }).value).toBe(0xff000000 | 0);
      expect(frame.pc).toBe(2);
    });
  });

  describe('const-wide/16 (0x16)', () => {
    it('loads sign-extended 16-bit value as long', () => {
      // const-wide/16 v0, 100 -> [0x0016, 0x0064]
      const frame = execEx([0x0016, 0x0064], 4);
      expect(frame.registers[0]).toEqual(longValue(100n));
      expect(frame.pc).toBe(2);
    });

    it('sign-extends negative value', () => {
      // const-wide/16 v0, -1 -> [0x0016, 0xFFFF]
      const frame = execEx([0x0016, 0xffff], 4);
      expect(frame.registers[0]).toEqual(longValue(-1n));
    });
  });

  describe('const-wide/32 (0x17)', () => {
    it('loads sign-extended 32-bit value as long', () => {
      // const-wide/32 v0, 0x00010000 -> [0x0017, 0x0000, 0x0001]
      const frame = execEx([0x0017, 0x0000, 0x0001], 4);
      expect(frame.registers[0]).toEqual(longValue(0x10000n));
      expect(frame.pc).toBe(3);
    });

    it('sign-extends negative 32-bit', () => {
      // const-wide/32 v0, -1 -> [0x0017, 0xFFFF, 0xFFFF]
      const frame = execEx([0x0017, 0xffff, 0xffff], 4);
      expect(frame.registers[0]).toEqual(longValue(-1n));
    });
  });

  describe('const-wide (0x18)', () => {
    it('loads full 64-bit value', () => {
      // const-wide v0, 0x0000000100000000 -> [0x0018, 0x0000, 0x0000, 0x0001, 0x0000]
      const frame = execEx([0x0018, 0x0000, 0x0000, 0x0001, 0x0000], 4);
      expect(frame.registers[0]).toEqual(longValue(0x100000000n));
      expect(frame.pc).toBe(5);
    });

    it('loads negative 64-bit value', () => {
      // const-wide v0, -1 -> all 0xFFFF
      const frame = execEx([0x0018, 0xffff, 0xffff, 0xffff, 0xffff], 4);
      expect(frame.registers[0]).toEqual(longValue(-1n));
    });
  });

  describe('const-wide/high16 (0x19)', () => {
    it('loads value into top 16 bits of 64-bit', () => {
      // const-wide/high16 v0, 0x4000 -> value = 0x4000_0000_0000_0000
      const frame = execEx([0x0019, 0x4000], 4);
      expect(frame.registers[0]).toEqual(longValue(0x4000000000000000n));
      expect(frame.pc).toBe(2);
    });
  });

  describe('const-string/jumbo (0x1b)', () => {
    it('loads string with 32-bit index', () => {
      mockDex.setString(0, 'Jumbo String');
      // const-string/jumbo v0, string@0 -> [0x001b, 0x0000, 0x0000]
      const frame = execEx([0x001b, 0x0000, 0x0000], 4);
      expect(frame.registers[0].type).toBe('object');
      const ref = (frame.registers[0] as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(ref)).toBe('Jumbo String');
      expect(frame.pc).toBe(3);
    });
  });

  describe('check-cast (0x1f)', () => {
    it('passes when type matches', () => {
      mockDex.setType(0, 'Lcom/example/Foo;');
      const objRef = heap.allocate('Lcom/example/Foo;');
      // check-cast v0, type@0 -> [0x001f, 0x0000]
      const frame = execEx([0x001f, 0x0000], 4, (f) => {
        f.registers[0] = objectRef(objRef);
      });
      expect(frame.pc).toBe(2); // no exception
    });

    it('passes for null reference', () => {
      mockDex.setType(0, 'Lcom/example/Foo;');
      const frame = execEx([0x001f, 0x0000], 4, (f) => {
        f.registers[0] = NULL_VALUE;
      });
      expect(frame.pc).toBe(2);
    });

    it('throws on type mismatch', () => {
      mockDex.setType(0, 'Lcom/example/Bar;');
      const objRef = heap.allocate('Lcom/example/Foo;');
      expect(() => {
        execEx([0x001f, 0x0000], 4, (f) => {
          f.registers[0] = objectRef(objRef);
        });
      }).toThrow(InterpreterError);
    });
  });

  describe('array-length (0x21)', () => {
    it('gets array length', () => {
      const arrRef = heap.allocateArray('I', 5);
      // array-length v0, v1 -> 0x1021 (A=0, B=1)
      const frame = exec([0x1021], (f) => {
        f.registers[1] = objectRef(arrRef);
      });
      expect(frame.registers[0]).toEqual(intValue(5));
      expect(frame.pc).toBe(1);
    });

    it('throws on null array', () => {
      expect(() => {
        exec([0x1021], (f) => {
          f.registers[1] = NULL_VALUE;
        });
      }).toThrow(NullPointerException);
    });
  });

  describe('new-array (0x23)', () => {
    it('allocates int array', () => {
      mockDex.setType(0, '[I');
      // new-array v0, v1, type@0 -> vA=0, vB=1 -> 0x1023, 0x0000
      const frame = execEx([0x1023, 0x0000], 4, (f) => {
        f.registers[1] = intValue(3);
      });
      expect(frame.registers[0].type).toBe('object');
      const ref = (frame.registers[0] as { type: 'object'; ref: number }).ref;
      expect(heap.getArrayLength(ref)).toBe(3);
      expect(frame.pc).toBe(2);
    });
  });

  describe('throw (0x27)', () => {
    it('throws exception from register', () => {
      const exRef = heap.allocate('Ljava/lang/RuntimeException;');
      expect(() => {
        exec([0x0027], (f) => {
          f.registers[0] = objectRef(exRef);
        });
      }).toThrow(InterpreterError);
    });

    it('throws NullPointerException for null', () => {
      expect(() => {
        exec([0x0027], (f) => {
          f.registers[0] = NULL_VALUE;
        });
      }).toThrow(NullPointerException);
    });
  });

  describe('goto (0x28)', () => {
    it('branches forward', () => {
      // goto +3 -> offset=3 in bits 15..8 -> 0x0328
      const frame = exec([0x0328]);
      expect(frame.pc).toBe(3);
    });

    it('branches backward', () => {
      // goto -2 -> offset=-2=0xFE in bits 15..8 -> 0xFE28
      // Start at PC=5 to avoid negative PC
      const { frame } = makeFrame([0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0xfe28]);
      frame.pc = 5;
      const ctx: ExecutionContext = {
        frame, heap, classLoader: mockClassLoader as any,
        interpreter: mockInterp, dex: mockDex as any,
      };
      table.execute(ctx, 0x28, 0xfe28);
      expect(frame.pc).toBe(3); // 5 + (-2) = 3
    });
  });

  describe('goto/16 (0x29)', () => {
    it('branches with 16-bit offset', () => {
      // goto/16 +10 -> [0x0029, 0x000A]
      const frame = execEx([0x0029, 0x000a], 4);
      expect(frame.pc).toBe(10);
    });

    it('branches backward with negative offset', () => {
      // goto/16 -3 -> [0x0029, 0xFFFD] at PC=5
      const { frame } = makeFrame([0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0029, 0xfffd]);
      frame.pc = 5;
      const ctx: ExecutionContext = {
        frame, heap, classLoader: mockClassLoader as any,
        interpreter: mockInterp, dex: mockDex as any,
      };
      table.execute(ctx, 0x29, 0x0029);
      expect(frame.pc).toBe(2); // 5 + (-3) = 2
    });
  });

  describe('goto/32 (0x2a)', () => {
    it('branches with 32-bit offset', () => {
      // goto/32 +100 -> [0x002a, 0x0064, 0x0000]
      const frame = execEx([0x002a, 0x0064, 0x0000], 4);
      expect(frame.pc).toBe(100);
    });
  });

  describe('if-eq (0x32)', () => {
    it('branches when equal', () => {
      // if-eq v0, v1, +5 -> vA=0, vB=1 -> 0x1032, 0x0005
      const frame = execEx([0x1032, 0x0005], 4, (f) => {
        f.registers[0] = intValue(10);
        f.registers[1] = intValue(10);
      });
      expect(frame.pc).toBe(5);
    });

    it('falls through when not equal', () => {
      const frame = execEx([0x1032, 0x0005], 4, (f) => {
        f.registers[0] = intValue(10);
        f.registers[1] = intValue(20);
      });
      expect(frame.pc).toBe(2);
    });
  });

  describe('if-ne (0x33)', () => {
    it('branches when not equal', () => {
      const frame = execEx([0x1033, 0x0005], 4, (f) => {
        f.registers[0] = intValue(10);
        f.registers[1] = intValue(20);
      });
      expect(frame.pc).toBe(5);
    });

    it('falls through when equal', () => {
      const frame = execEx([0x1033, 0x0005], 4, (f) => {
        f.registers[0] = intValue(10);
        f.registers[1] = intValue(10);
      });
      expect(frame.pc).toBe(2);
    });
  });

  describe('if-lt (0x34)', () => {
    it('branches when less than', () => {
      const frame = execEx([0x1034, 0x0005], 4, (f) => {
        f.registers[0] = intValue(5);
        f.registers[1] = intValue(10);
      });
      expect(frame.pc).toBe(5);
    });

    it('falls through when not less', () => {
      const frame = execEx([0x1034, 0x0005], 4, (f) => {
        f.registers[0] = intValue(10);
        f.registers[1] = intValue(5);
      });
      expect(frame.pc).toBe(2);
    });
  });

  describe('if-ge (0x35)', () => {
    it('branches when greater or equal', () => {
      const frame = execEx([0x1035, 0x0005], 4, (f) => {
        f.registers[0] = intValue(10);
        f.registers[1] = intValue(10);
      });
      expect(frame.pc).toBe(5);
    });

    it('falls through when less', () => {
      const frame = execEx([0x1035, 0x0005], 4, (f) => {
        f.registers[0] = intValue(5);
        f.registers[1] = intValue(10);
      });
      expect(frame.pc).toBe(2);
    });
  });

  describe('if-gt (0x36)', () => {
    it('branches when greater than', () => {
      const frame = execEx([0x1036, 0x0005], 4, (f) => {
        f.registers[0] = intValue(20);
        f.registers[1] = intValue(10);
      });
      expect(frame.pc).toBe(5);
    });

    it('falls through when not greater', () => {
      const frame = execEx([0x1036, 0x0005], 4, (f) => {
        f.registers[0] = intValue(10);
        f.registers[1] = intValue(10);
      });
      expect(frame.pc).toBe(2);
    });
  });

  describe('if-le (0x37)', () => {
    it('branches when less or equal', () => {
      const frame = execEx([0x1037, 0x0005], 4, (f) => {
        f.registers[0] = intValue(5);
        f.registers[1] = intValue(10);
      });
      expect(frame.pc).toBe(5);
    });

    it('branches when equal', () => {
      const frame = execEx([0x1037, 0x0005], 4, (f) => {
        f.registers[0] = intValue(10);
        f.registers[1] = intValue(10);
      });
      expect(frame.pc).toBe(5);
    });

    it('falls through when greater', () => {
      const frame = execEx([0x1037, 0x0005], 4, (f) => {
        f.registers[0] = intValue(20);
        f.registers[1] = intValue(10);
      });
      expect(frame.pc).toBe(2);
    });
  });

  describe('if-eqz (0x38)', () => {
    it('branches when zero', () => {
      // if-eqz v0, +5 -> 0x0038, 0x0005
      const frame = execEx([0x0038, 0x0005], 4, (f) => {
        f.registers[0] = intValue(0);
      });
      expect(frame.pc).toBe(5);
    });

    it('falls through when nonzero', () => {
      const frame = execEx([0x0038, 0x0005], 4, (f) => {
        f.registers[0] = intValue(1);
      });
      expect(frame.pc).toBe(2);
    });
  });

  describe('if-nez (0x39)', () => {
    it('branches when nonzero', () => {
      const frame = execEx([0x0039, 0x0005], 4, (f) => {
        f.registers[0] = intValue(1);
      });
      expect(frame.pc).toBe(5);
    });

    it('falls through when zero', () => {
      const frame = execEx([0x0039, 0x0005], 4, (f) => {
        f.registers[0] = intValue(0);
      });
      expect(frame.pc).toBe(2);
    });
  });

  describe('if-ltz (0x3a)', () => {
    it('branches when negative', () => {
      const frame = execEx([0x003a, 0x0005], 4, (f) => {
        f.registers[0] = intValue(-1);
      });
      expect(frame.pc).toBe(5);
    });

    it('falls through when non-negative', () => {
      const frame = execEx([0x003a, 0x0005], 4, (f) => {
        f.registers[0] = intValue(0);
      });
      expect(frame.pc).toBe(2);
    });
  });

  describe('if-gez (0x3b)', () => {
    it('branches when zero', () => {
      const frame = execEx([0x003b, 0x0005], 4, (f) => {
        f.registers[0] = intValue(0);
      });
      expect(frame.pc).toBe(5);
    });

    it('branches when positive', () => {
      const frame = execEx([0x003b, 0x0005], 4, (f) => {
        f.registers[0] = intValue(5);
      });
      expect(frame.pc).toBe(5);
    });

    it('falls through when negative', () => {
      const frame = execEx([0x003b, 0x0005], 4, (f) => {
        f.registers[0] = intValue(-1);
      });
      expect(frame.pc).toBe(2);
    });
  });

  describe('if-gtz (0x3c)', () => {
    it('branches when positive', () => {
      const frame = execEx([0x003c, 0x0005], 4, (f) => {
        f.registers[0] = intValue(1);
      });
      expect(frame.pc).toBe(5);
    });

    it('falls through when zero', () => {
      const frame = execEx([0x003c, 0x0005], 4, (f) => {
        f.registers[0] = intValue(0);
      });
      expect(frame.pc).toBe(2);
    });
  });

  describe('if-lez (0x3d)', () => {
    it('branches when negative', () => {
      const frame = execEx([0x003d, 0x0005], 4, (f) => {
        f.registers[0] = intValue(-5);
      });
      expect(frame.pc).toBe(5);
    });

    it('branches when zero', () => {
      const frame = execEx([0x003d, 0x0005], 4, (f) => {
        f.registers[0] = intValue(0);
      });
      expect(frame.pc).toBe(5);
    });

    it('falls through when positive', () => {
      const frame = execEx([0x003d, 0x0005], 4, (f) => {
        f.registers[0] = intValue(1);
      });
      expect(frame.pc).toBe(2);
    });
  });

  describe('aget (0x44)', () => {
    it('reads array element', () => {
      const arrRef = heap.allocateArray('I', 3);
      heap.setArrayElement(arrRef, 1, intValue(42));
      // aget v0, v1, v2 -> [0x0044, (v2<<8)|v1]
      // vA=0, vB=1(arr), vC=2(idx) -> 0x0044, 0x0201
      const frame = execEx([0x0044, 0x0201], 4, (f) => {
        f.registers[1] = objectRef(arrRef);
        f.registers[2] = intValue(1);
      });
      expect(frame.registers[0]).toEqual(intValue(42));
      expect(frame.pc).toBe(2);
    });

    it('throws on null array', () => {
      expect(() => {
        execEx([0x0044, 0x0201], 4, (f) => {
          f.registers[1] = NULL_VALUE;
          f.registers[2] = intValue(0);
        });
      }).toThrow(NullPointerException);
    });
  });

  describe('aget-wide (0x45)', () => {
    it('reads wide array element', () => {
      const arrRef = heap.allocateArray('J', 2);
      heap.setArrayElement(arrRef, 0, longValue(999n));
      const frame = execEx([0x0045, 0x0201], 4, (f) => {
        f.registers[1] = objectRef(arrRef);
        f.registers[2] = intValue(0);
      });
      expect(frame.registers[0]).toEqual(longValue(999n));
    });
  });

  describe('aget-object (0x46)', () => {
    it('reads object from array', () => {
      const innerObj = heap.allocate('Lcom/example/Foo;');
      const arrRef = heap.allocateArray('Lcom/example/Foo;', 2);
      heap.setArrayElement(arrRef, 0, objectRef(innerObj));
      const frame = execEx([0x0046, 0x0201], 4, (f) => {
        f.registers[1] = objectRef(arrRef);
        f.registers[2] = intValue(0);
      });
      expect(frame.registers[0]).toEqual(objectRef(innerObj));
    });
  });

  describe('aget-boolean (0x47)', () => {
    it('reads boolean from array', () => {
      const arrRef = heap.allocateArray('Z', 2);
      heap.setArrayElement(arrRef, 1, intValue(1));
      const frame = execEx([0x0047, 0x0201], 4, (f) => {
        f.registers[1] = objectRef(arrRef);
        f.registers[2] = intValue(1);
      });
      expect(frame.registers[0]).toEqual(intValue(1));
    });
  });

  describe('aget-byte (0x48)', () => {
    it('reads byte from array', () => {
      const arrRef = heap.allocateArray('B', 3);
      heap.setArrayElement(arrRef, 2, intValue(127));
      const frame = execEx([0x0048, 0x0201], 4, (f) => {
        f.registers[1] = objectRef(arrRef);
        f.registers[2] = intValue(2);
      });
      expect(frame.registers[0]).toEqual(intValue(127));
    });
  });

  describe('aget-char (0x49)', () => {
    it('reads char from array', () => {
      const arrRef = heap.allocateArray('C', 2);
      heap.setArrayElement(arrRef, 0, intValue(65)); // 'A'
      const frame = execEx([0x0049, 0x0201], 4, (f) => {
        f.registers[1] = objectRef(arrRef);
        f.registers[2] = intValue(0);
      });
      expect(frame.registers[0]).toEqual(intValue(65));
    });
  });

  describe('aget-short (0x4a)', () => {
    it('reads short from array', () => {
      const arrRef = heap.allocateArray('S', 2);
      heap.setArrayElement(arrRef, 0, intValue(1000));
      const frame = execEx([0x004a, 0x0201], 4, (f) => {
        f.registers[1] = objectRef(arrRef);
        f.registers[2] = intValue(0);
      });
      expect(frame.registers[0]).toEqual(intValue(1000));
    });
  });

  describe('aput (0x4b)', () => {
    it('writes int to array', () => {
      const arrRef = heap.allocateArray('I', 3);
      // aput v0, v1, v2 -> 0x004b, 0x0201
      execEx([0x004b, 0x0201], 4, (f) => {
        f.registers[0] = intValue(55);
        f.registers[1] = objectRef(arrRef);
        f.registers[2] = intValue(2);
      });
      expect(heap.getArrayElement(arrRef, 2)).toEqual(intValue(55));
    });

    it('throws on null array', () => {
      expect(() => {
        execEx([0x004b, 0x0201], 4, (f) => {
          f.registers[0] = intValue(1);
          f.registers[1] = NULL_VALUE;
          f.registers[2] = intValue(0);
        });
      }).toThrow(NullPointerException);
    });
  });

  describe('aput-wide (0x4c)', () => {
    it('writes wide to array', () => {
      const arrRef = heap.allocateArray('J', 2);
      execEx([0x004c, 0x0201], 4, (f) => {
        f.registers[0] = longValue(12345n);
        f.registers[1] = objectRef(arrRef);
        f.registers[2] = intValue(0);
      });
      expect(heap.getArrayElement(arrRef, 0)).toEqual(longValue(12345n));
    });
  });

  describe('aput-object (0x4d)', () => {
    it('writes object to array', () => {
      const innerObj = heap.allocate('Lcom/example/Foo;');
      const arrRef = heap.allocateArray('Lcom/example/Foo;', 2);
      execEx([0x004d, 0x0201], 4, (f) => {
        f.registers[0] = objectRef(innerObj);
        f.registers[1] = objectRef(arrRef);
        f.registers[2] = intValue(0);
      });
      expect(heap.getArrayElement(arrRef, 0)).toEqual(objectRef(innerObj));
    });
  });

  describe('aput-boolean (0x4e)', () => {
    it('writes boolean to array', () => {
      const arrRef = heap.allocateArray('Z', 2);
      execEx([0x004e, 0x0201], 4, (f) => {
        f.registers[0] = intValue(1);
        f.registers[1] = objectRef(arrRef);
        f.registers[2] = intValue(0);
      });
      expect(heap.getArrayElement(arrRef, 0)).toEqual(intValue(1));
    });
  });

  describe('aput-byte (0x4f)', () => {
    it('writes byte to array', () => {
      const arrRef = heap.allocateArray('B', 2);
      execEx([0x004f, 0x0201], 4, (f) => {
        f.registers[0] = intValue(0x7F);
        f.registers[1] = objectRef(arrRef);
        f.registers[2] = intValue(1);
      });
      expect(heap.getArrayElement(arrRef, 1)).toEqual(intValue(0x7F));
    });
  });

  describe('aput-char (0x50)', () => {
    it('writes char to array', () => {
      const arrRef = heap.allocateArray('C', 2);
      execEx([0x0050, 0x0201], 4, (f) => {
        f.registers[0] = intValue(66); // 'B'
        f.registers[1] = objectRef(arrRef);
        f.registers[2] = intValue(0);
      });
      expect(heap.getArrayElement(arrRef, 0)).toEqual(intValue(66));
    });
  });

  describe('aput-short (0x51)', () => {
    it('writes short to array', () => {
      const arrRef = heap.allocateArray('S', 2);
      execEx([0x0051, 0x0201], 4, (f) => {
        f.registers[0] = intValue(500);
        f.registers[1] = objectRef(arrRef);
        f.registers[2] = intValue(1);
      });
      expect(heap.getArrayElement(arrRef, 1)).toEqual(intValue(500));
    });
  });

  describe('invoke-interface (0x72)', () => {
    it('dispatches interface method call', () => {
      const objRef = heap.allocate('Lcom/example/Impl;');
      // invoke-interface {v0}, method@0 -> count=1
      const { frame } = makeFrame([0x1072, 0x0000, 0x0000]);
      frame.registers[0] = objectRef(objRef);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x72, 0x1072);
      expect(mockInterp.invokedMethod).not.toBeNull();
      expect(mockInterp.invokedArgs).toEqual([objectRef(objRef)]);
      expect(frame.pc).toBe(3);
    });

    it('throws NullPointerException on null', () => {
      const { frame } = makeFrame([0x1072, 0x0000, 0x0000]);
      frame.registers[0] = NULL_VALUE;
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      expect(() => table.execute(ctx, 0x72, 0x1072)).toThrow(NullPointerException);
    });
  });

  describe('invoke-virtual/range (0x74)', () => {
    it('invokes with consecutive registers', () => {
      const objRef = heap.allocate('Lcom/example/Test;');
      // invoke-virtual/range {v0..v1}, method@0 -> count=2, vC=0
      // word0: (count<<8)|0x74 = 0x0274
      // word1: method@0 = 0x0000
      // word2: vC = 0x0000
      const { frame } = makeFrame([0x0274, 0x0000, 0x0000]);
      frame.registers[0] = objectRef(objRef);
      frame.registers[1] = intValue(42);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x74, 0x0274);
      expect(mockInterp.invokedArgs).toEqual([objectRef(objRef), intValue(42)]);
      expect(frame.pc).toBe(3);
    });
  });

  describe('invoke-super/range (0x75)', () => {
    it('invokes super with range', () => {
      const objRef = heap.allocate('Lcom/example/Test;');
      const { frame } = makeFrame([0x0175, 0x0000, 0x0000]);
      frame.registers[0] = objectRef(objRef);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x75, 0x0175);
      expect(mockInterp.invokedMethod).not.toBeNull();
      expect(frame.pc).toBe(3);
    });
  });

  describe('invoke-direct/range (0x76)', () => {
    it('invokes direct with range', () => {
      const { frame } = makeFrame([0x0176, 0x0000, 0x0000]);
      frame.registers[0] = objectRef(1);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x76, 0x0176);
      expect(mockInterp.invokedMethod).not.toBeNull();
      expect(frame.pc).toBe(3);
    });
  });

  describe('invoke-static/range (0x77)', () => {
    it('invokes static with range', () => {
      const { frame } = makeFrame([0x0077, 0x0000, 0x0000]);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x77, 0x0077);
      expect(mockInterp.invokedMethod).not.toBeNull();
      expect(frame.pc).toBe(3);
    });
  });

  describe('invoke-interface/range (0x78)', () => {
    it('invokes interface with range', () => {
      const objRef = heap.allocate('Lcom/example/Impl;');
      const { frame } = makeFrame([0x0178, 0x0000, 0x0000]);
      frame.registers[0] = objectRef(objRef);
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      table.execute(ctx, 0x78, 0x0178);
      expect(mockInterp.invokedMethod).not.toBeNull();
      expect(frame.pc).toBe(3);
    });

    it('throws NullPointerException on null', () => {
      const { frame } = makeFrame([0x0178, 0x0000, 0x0000]);
      frame.registers[0] = NULL_VALUE;
      const ctx: ExecutionContext = {
        frame,
        heap,
        classLoader: mockClassLoader as any,
        interpreter: mockInterp,
        dex: mockDex as any,
      };
      expect(() => table.execute(ctx, 0x78, 0x0178)).toThrow(NullPointerException);
    });
  });
});
