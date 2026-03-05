/**
 * Tests for remaining opcode implementations (Tier 1 additions).
 * Covers monitor, comparisons, switch, field variants, unary, conversion,
 * remaining int arithmetic, long/float/double arithmetic, 2addr forms,
 * lit16/lit8 forms, and array init opcodes.
 */

import { OpcodeTable, ExecutionContext } from '../../../src/interpreter/opcode_table';
import { registerEssentialOpcodes } from '../../../src/interpreter/opcodes';
import { Heap } from '../../../src/interpreter/heap';
import { ExecutionFrame } from '../../../src/interpreter/frame';
import { ResolvedMethod, Value } from '../../../src/interpreter/types';
import { intValue, longValue, floatValue, doubleValue, objectRef, NULL_VALUE } from '../../../src/core/types';
import { CodeItem } from '../../../src/parser/dex_types';
import { InterpreterError, NullPointerException } from '../../../src/interpreter/errors';

class MockInterpreterControl {
  lastResult: Value = NULL_VALUE;
  returnedValue: Value | null = null;
  getLastResult(): Value { return this.lastResult; }
  returnFromMethod(value: Value): void { this.returnedValue = value; }
  invokeMethod(_method: any, _args: Value[]): void {}
}

class MockDexParser {
  private strings: Map<number, string> = new Map();
  private types: Map<number, string> = new Map();

  setString(idx: number, value: string): void { this.strings.set(idx, value); }
  setType(idx: number, value: string): void { this.types.set(idx, value); }

  getString(idx: number): string { return this.strings.get(idx) || ''; }
  getTypeName(idx: number): string { return this.types.get(idx) || ''; }
  getMethodId(_idx: number): any { return { classIdx: 0, protoIdx: 0, nameIdx: 0 }; }
  getFieldId(_idx: number): any { return { classIdx: 0, typeIdx: 0, nameIdx: 0 }; }
  getProtoId(_idx: number): any { return { shortyIdx: 0, returnTypeIdx: 0, parametersOff: 0 }; }
  getProtoParameters(_proto: any): number[] { return []; }
  parseHeader(): any { return {}; }
}

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

  resolveMethod(_idx: number): ResolvedMethod {
    return { classDescriptor: 'Ltest;', name: 'm', descriptor: '()V', accessFlags: 0, code: null, isShim: true };
  }
  resolveVirtualMethod(_ref: number, _idx: number): ResolvedMethod { return this.resolveMethod(_idx); }
  resolveSuperMethod(_cls: string, _idx: number): ResolvedMethod { return this.resolveMethod(_idx); }
  initializeClass(_desc: string): void {}
  getClassObject(_desc: string): number { return 1; }

  getStaticField(field: any): Value {
    return this.staticFields.get(`${field.classDescriptor}:${field.name}`) || NULL_VALUE;
  }

  setStaticField(field: any, value: Value): void {
    this.staticFields.set(`${field.classDescriptor}:${field.name}`, value);
  }

  isInstanceOf(a: string, b: string): boolean { return a === b; }
}

function makeFrame(insns: number[], registersSize: number = 8): ExecutionFrame {
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
    classDescriptor: 'Ltest;',
    name: 'test',
    descriptor: '()V',
    accessFlags: 0,
    code,
    isShim: false,
  };
  return {
    method,
    registers: new Array(registersSize).fill(null).map(() => intValue(0)),
    pc: 0,
    callerFrame: null,
    returnRegister: -1,
    lockRef: null,
  };
}

describe('Remaining Opcodes', () => {
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

  function exec(insns: number[], setupFrame?: (f: ExecutionFrame) => void, regCount = 8): ExecutionFrame {
    const frame = makeFrame(insns, regCount);
    if (setupFrame) setupFrame(frame);
    const ctx: ExecutionContext = {
      frame,
      heap,
      classLoader: mockClassLoader as any,
      interpreter: mockInterp,
      dex: mockDex as any,
    };
    const opcode = insns[0] & 0xff;
    table.execute(ctx, opcode, insns[0]);
    return frame;
  }

  // ─── Monitor Opcodes (0x1d-0x1e) ───

  describe('monitor-enter (0x1d)', () => {
    it('is a no-op on valid object', () => {
      const ref = heap.allocate('Ltest;');
      // monitor-enter v0: opcode=0x1d, vAA=0x00 -> word0=0x001d
      const frame = exec([0x001d], (f) => {
        f.registers[0] = objectRef(ref);
      });
      expect(frame.pc).toBe(1);
    });

    it('throws NullPointerException on null', () => {
      expect(() => {
        exec([0x001d], (f) => {
          f.registers[0] = NULL_VALUE;
        });
      }).toThrow(NullPointerException);
    });
  });

  describe('monitor-exit (0x1e)', () => {
    it('is a no-op on valid object', () => {
      const ref = heap.allocate('Ltest;');
      const frame = exec([0x001e], (f) => {
        f.registers[0] = objectRef(ref);
      });
      expect(frame.pc).toBe(1);
    });

    it('throws NullPointerException on null', () => {
      expect(() => {
        exec([0x001e], (f) => {
          f.registers[0] = NULL_VALUE;
        });
      }).toThrow(NullPointerException);
    });
  });

  // ─── Comparison Opcodes (0x2d-0x31) ───

  describe('cmpl-float (0x2d)', () => {
    // 23x format: word0 = opcode | (vA << 8), word1 = vB | (vC << 8)
    it('returns 1 when a > b', () => {
      const frame = exec([0x002d, 0x0201], (f) => {
        f.registers[1] = floatValue(5.0);
        f.registers[2] = floatValue(3.0);
      });
      expect(frame.registers[0]).toEqual(intValue(1));
      expect(frame.pc).toBe(2);
    });

    it('returns 0 when a == b', () => {
      const frame = exec([0x002d, 0x0201], (f) => {
        f.registers[1] = floatValue(3.0);
        f.registers[2] = floatValue(3.0);
      });
      expect(frame.registers[0]).toEqual(intValue(0));
    });

    it('returns -1 when a < b', () => {
      const frame = exec([0x002d, 0x0201], (f) => {
        f.registers[1] = floatValue(1.0);
        f.registers[2] = floatValue(3.0);
      });
      expect(frame.registers[0]).toEqual(intValue(-1));
    });

    it('returns -1 on NaN', () => {
      const frame = exec([0x002d, 0x0201], (f) => {
        f.registers[1] = floatValue(NaN);
        f.registers[2] = floatValue(3.0);
      });
      expect(frame.registers[0]).toEqual(intValue(-1));
    });
  });

  describe('cmpg-float (0x2e)', () => {
    it('returns 1 when a > b', () => {
      const frame = exec([0x002e, 0x0201], (f) => {
        f.registers[1] = floatValue(5.0);
        f.registers[2] = floatValue(3.0);
      });
      expect(frame.registers[0]).toEqual(intValue(1));
    });

    it('returns 0 when a == b', () => {
      const frame = exec([0x002e, 0x0201], (f) => {
        f.registers[1] = floatValue(3.0);
        f.registers[2] = floatValue(3.0);
      });
      expect(frame.registers[0]).toEqual(intValue(0));
    });

    it('returns -1 when a < b', () => {
      const frame = exec([0x002e, 0x0201], (f) => {
        f.registers[1] = floatValue(1.0);
        f.registers[2] = floatValue(3.0);
      });
      expect(frame.registers[0]).toEqual(intValue(-1));
    });

    it('returns 1 on NaN', () => {
      const frame = exec([0x002e, 0x0201], (f) => {
        f.registers[1] = floatValue(NaN);
        f.registers[2] = floatValue(3.0);
      });
      expect(frame.registers[0]).toEqual(intValue(1));
    });
  });

  describe('cmpl-double (0x2f)', () => {
    it('returns 1 when a > b', () => {
      const frame = exec([0x002f, 0x0201], (f) => {
        f.registers[1] = doubleValue(5.0);
        f.registers[2] = doubleValue(3.0);
      });
      expect(frame.registers[0]).toEqual(intValue(1));
    });

    it('returns 0 when a == b', () => {
      const frame = exec([0x002f, 0x0201], (f) => {
        f.registers[1] = doubleValue(3.0);
        f.registers[2] = doubleValue(3.0);
      });
      expect(frame.registers[0]).toEqual(intValue(0));
    });

    it('returns -1 on NaN', () => {
      const frame = exec([0x002f, 0x0201], (f) => {
        f.registers[1] = doubleValue(NaN);
        f.registers[2] = doubleValue(3.0);
      });
      expect(frame.registers[0]).toEqual(intValue(-1));
    });
  });

  describe('cmpg-double (0x30)', () => {
    it('returns -1 when a < b', () => {
      const frame = exec([0x0030, 0x0201], (f) => {
        f.registers[1] = doubleValue(1.0);
        f.registers[2] = doubleValue(3.0);
      });
      expect(frame.registers[0]).toEqual(intValue(-1));
    });

    it('returns 1 on NaN', () => {
      const frame = exec([0x0030, 0x0201], (f) => {
        f.registers[1] = doubleValue(NaN);
        f.registers[2] = doubleValue(3.0);
      });
      expect(frame.registers[0]).toEqual(intValue(1));
    });
  });

  describe('cmp-long (0x31)', () => {
    it('returns 1 when a > b', () => {
      const frame = exec([0x0031, 0x0201], (f) => {
        f.registers[1] = longValue(100n);
        f.registers[2] = longValue(50n);
      });
      expect(frame.registers[0]).toEqual(intValue(1));
    });

    it('returns 0 when a == b', () => {
      const frame = exec([0x0031, 0x0201], (f) => {
        f.registers[1] = longValue(42n);
        f.registers[2] = longValue(42n);
      });
      expect(frame.registers[0]).toEqual(intValue(0));
    });

    it('returns -1 when a < b', () => {
      const frame = exec([0x0031, 0x0201], (f) => {
        f.registers[1] = longValue(-1n);
        f.registers[2] = longValue(50n);
      });
      expect(frame.registers[0]).toEqual(intValue(-1));
    });
  });

  // ─── Switch Opcodes (0x2b-0x2c) ───

  describe('packed-switch (0x2b)', () => {
    it('jumps to matching case', () => {
      // packed-switch v0, +3
      // word0: 0x002b, word1: offset_low=3, word2: offset_high=0
      // Payload at pc+3:
      //   word3: 0x0100 (ident), word4: size=2, word5: first_key_low=0, word6: first_key_high=0
      //   word7: target0_low=10, word8: target0_high=0, word9: target1_low=20, word10: target1_high=0
      const frame = exec(
        [0x002b, 0x0003, 0x0000,
         0x0100, 0x0002, 0x0000, 0x0000,
         0x000a, 0x0000, 0x0014, 0x0000],
        (f) => { f.registers[0] = intValue(0); }
      );
      // key=0, first_key=0, index=0 -> target at index 0 = 10
      expect(frame.pc).toBe(10);
    });

    it('falls through when key does not match', () => {
      const frame = exec(
        [0x002b, 0x0003, 0x0000,
         0x0100, 0x0002, 0x0000, 0x0000,
         0x000a, 0x0000, 0x0014, 0x0000],
        (f) => { f.registers[0] = intValue(5); } // key 5 is outside range [0, 1]
      );
      // Falls through: pc += 3
      expect(frame.pc).toBe(3);
    });
  });

  describe('sparse-switch (0x2c)', () => {
    it('jumps to matching key', () => {
      // sparse-switch v0, +3
      // Payload at pc+3:
      //   word3: 0x0200 (ident), word4: size=2,
      //   keys: key0_low=10, key0_high=0, key1_low=20, key1_high=0
      //   targets: target0_low=15, target0_high=0, target1_low=25, target1_high=0
      const frame = exec(
        [0x002c, 0x0003, 0x0000,
         0x0200, 0x0002,
         0x000a, 0x0000, 0x0014, 0x0000,
         0x000f, 0x0000, 0x0019, 0x0000],
        (f) => { f.registers[0] = intValue(10); }
      );
      // key=10 matches key0 -> target0=15
      expect(frame.pc).toBe(15);
    });

    it('falls through when key does not match', () => {
      const frame = exec(
        [0x002c, 0x0003, 0x0000,
         0x0200, 0x0002,
         0x000a, 0x0000, 0x0014, 0x0000,
         0x000f, 0x0000, 0x0019, 0x0000],
        (f) => { f.registers[0] = intValue(99); }
      );
      expect(frame.pc).toBe(3);
    });
  });

  // ─── Instance Field Variants (0x53, 0x55-0x58, 0x5a, 0x5c-0x5f) ───

  describe('iget-wide (0x53)', () => {
    it('reads a wide field', () => {
      const ref = heap.allocate('Ltest;');
      heap.setField(ref, 'field0', longValue(999n));
      // 22c format: word0 = opcode | (vA << 8) | (vB << 12), word1 = fieldIdx
      const frame = exec([0x1053, 0x0000], (f) => {
        f.registers[1] = objectRef(ref);
      });
      expect(frame.registers[0]).toEqual(longValue(999n));
      expect(frame.pc).toBe(2);
    });
  });

  describe('iget-boolean (0x55)', () => {
    it('reads a boolean field', () => {
      const ref = heap.allocate('Ltest;');
      heap.setField(ref, 'field0', intValue(1));
      const frame = exec([0x1055, 0x0000], (f) => {
        f.registers[1] = objectRef(ref);
      });
      expect(frame.registers[0]).toEqual(intValue(1));
    });
  });

  describe('iget-byte (0x56)', () => {
    it('reads a byte field', () => {
      const ref = heap.allocate('Ltest;');
      heap.setField(ref, 'field0', intValue(127));
      const frame = exec([0x1056, 0x0000], (f) => {
        f.registers[1] = objectRef(ref);
      });
      expect(frame.registers[0]).toEqual(intValue(127));
    });
  });

  describe('iget-char (0x57)', () => {
    it('reads a char field', () => {
      const ref = heap.allocate('Ltest;');
      heap.setField(ref, 'field0', intValue(65)); // 'A'
      const frame = exec([0x1057, 0x0000], (f) => {
        f.registers[1] = objectRef(ref);
      });
      expect(frame.registers[0]).toEqual(intValue(65));
    });
  });

  describe('iget-short (0x58)', () => {
    it('reads a short field', () => {
      const ref = heap.allocate('Ltest;');
      heap.setField(ref, 'field0', intValue(32000));
      const frame = exec([0x1058, 0x0000], (f) => {
        f.registers[1] = objectRef(ref);
      });
      expect(frame.registers[0]).toEqual(intValue(32000));
    });
  });

  describe('iput-wide (0x5a)', () => {
    it('writes a wide field', () => {
      const ref = heap.allocate('Ltest;');
      // iput-wide v0, v1, field@0: word0 = 0x5a | (0 << 8) | (1 << 12) = 0x105a
      const frame = exec([0x105a, 0x0000], (f) => {
        f.registers[0] = longValue(12345n);
        f.registers[1] = objectRef(ref);
      });
      expect(heap.getField(ref, 'field0')).toEqual(longValue(12345n));
      expect(frame.pc).toBe(2);
    });
  });

  describe('iput-boolean (0x5c)', () => {
    it('writes a boolean field', () => {
      const ref = heap.allocate('Ltest;');
      const frame = exec([0x105c, 0x0000], (f) => {
        f.registers[0] = intValue(1);
        f.registers[1] = objectRef(ref);
      });
      expect(heap.getField(ref, 'field0')).toEqual(intValue(1));
    });
  });

  describe('iput-byte (0x5d)', () => {
    it('writes a byte field', () => {
      const ref = heap.allocate('Ltest;');
      exec([0x105d, 0x0000], (f) => {
        f.registers[0] = intValue(42);
        f.registers[1] = objectRef(ref);
      });
      expect(heap.getField(ref, 'field0')).toEqual(intValue(42));
    });
  });

  describe('iput-char (0x5e)', () => {
    it('writes a char field', () => {
      const ref = heap.allocate('Ltest;');
      exec([0x105e, 0x0000], (f) => {
        f.registers[0] = intValue(65);
        f.registers[1] = objectRef(ref);
      });
      expect(heap.getField(ref, 'field0')).toEqual(intValue(65));
    });
  });

  describe('iput-short (0x5f)', () => {
    it('writes a short field', () => {
      const ref = heap.allocate('Ltest;');
      exec([0x105f, 0x0000], (f) => {
        f.registers[0] = intValue(1000);
        f.registers[1] = objectRef(ref);
      });
      expect(heap.getField(ref, 'field0')).toEqual(intValue(1000));
    });
  });

  // ─── Static Field Variants (0x61, 0x63-0x66, 0x68, 0x6a-0x6d) ───

  describe('sget-wide (0x61)', () => {
    it('reads a wide static field', () => {
      mockClassLoader.staticFields.set('Lcom/example/Test;:field0', longValue(777n));
      // sget-wide v0, field@0: 21c format, word0 = 0x61 | (0 << 8), word1 = fieldIdx=0
      const frame = exec([0x0061, 0x0000]);
      expect(frame.registers[0]).toEqual(longValue(777n));
      expect(frame.pc).toBe(2);
    });
  });

  describe('sget-boolean (0x63)', () => {
    it('reads a boolean static field', () => {
      mockClassLoader.staticFields.set('Lcom/example/Test;:field0', intValue(1));
      const frame = exec([0x0063, 0x0000]);
      expect(frame.registers[0]).toEqual(intValue(1));
    });
  });

  describe('sget-byte (0x64)', () => {
    it('reads a byte static field', () => {
      mockClassLoader.staticFields.set('Lcom/example/Test;:field0', intValue(42));
      const frame = exec([0x0064, 0x0000]);
      expect(frame.registers[0]).toEqual(intValue(42));
    });
  });

  describe('sget-char (0x65)', () => {
    it('reads a char static field', () => {
      mockClassLoader.staticFields.set('Lcom/example/Test;:field0', intValue(65));
      const frame = exec([0x0065, 0x0000]);
      expect(frame.registers[0]).toEqual(intValue(65));
    });
  });

  describe('sget-short (0x66)', () => {
    it('reads a short static field', () => {
      mockClassLoader.staticFields.set('Lcom/example/Test;:field0', intValue(1000));
      const frame = exec([0x0066, 0x0000]);
      expect(frame.registers[0]).toEqual(intValue(1000));
    });
  });

  describe('sput-wide (0x68)', () => {
    it('writes a wide static field', () => {
      // sput-wide v0, field@0: word0 = 0x68 | (0 << 8), word1 = 0
      exec([0x0068, 0x0000], (f) => {
        f.registers[0] = longValue(999n);
      });
      expect(mockClassLoader.staticFields.get('Lcom/example/Test;:field0')).toEqual(longValue(999n));
    });
  });

  describe('sput-boolean (0x6a)', () => {
    it('writes a boolean static field', () => {
      exec([0x006a, 0x0000], (f) => {
        f.registers[0] = intValue(1);
      });
      expect(mockClassLoader.staticFields.get('Lcom/example/Test;:field0')).toEqual(intValue(1));
    });
  });

  describe('sput-byte (0x6b)', () => {
    it('writes a byte static field', () => {
      exec([0x006b, 0x0000], (f) => {
        f.registers[0] = intValue(127);
      });
      expect(mockClassLoader.staticFields.get('Lcom/example/Test;:field0')).toEqual(intValue(127));
    });
  });

  describe('sput-char (0x6c)', () => {
    it('writes a char static field', () => {
      exec([0x006c, 0x0000], (f) => {
        f.registers[0] = intValue(65);
      });
      expect(mockClassLoader.staticFields.get('Lcom/example/Test;:field0')).toEqual(intValue(65));
    });
  });

  describe('sput-short (0x6d)', () => {
    it('writes a short static field', () => {
      exec([0x006d, 0x0000], (f) => {
        f.registers[0] = intValue(32000);
      });
      expect(mockClassLoader.staticFields.get('Lcom/example/Test;:field0')).toEqual(intValue(32000));
    });
  });

  // ─── Unary Operations (0x7b-0x80) ───

  describe('neg-int (0x7b)', () => {
    it('negates an integer', () => {
      // 12x format: word0 = opcode | (vA << 8) | (vB << 12)
      // neg-int v0, v1: 0x7b | (0 << 8) | (1 << 12) = 0x107b
      const frame = exec([0x107b], (f) => {
        f.registers[1] = intValue(42);
      });
      expect(frame.registers[0]).toEqual(intValue(-42));
      expect(frame.pc).toBe(1);
    });

    it('negates zero', () => {
      const frame = exec([0x107b], (f) => {
        f.registers[1] = intValue(0);
      });
      expect(frame.registers[0]).toEqual(intValue(0));
    });
  });

  describe('not-int (0x7c)', () => {
    it('bitwise complements an integer', () => {
      const frame = exec([0x107c], (f) => {
        f.registers[1] = intValue(0);
      });
      expect(frame.registers[0]).toEqual(intValue(-1)); // ~0 = -1
    });

    it('complements 0xff', () => {
      const frame = exec([0x107c], (f) => {
        f.registers[1] = intValue(0xff);
      });
      expect((frame.registers[0] as { type: 'int'; value: number }).value).toBe(~0xff | 0);
    });
  });

  describe('neg-long (0x7d)', () => {
    it('negates a long', () => {
      const frame = exec([0x107d], (f) => {
        f.registers[1] = longValue(100n);
      });
      expect(frame.registers[0]).toEqual(longValue(-100n));
    });
  });

  describe('not-long (0x7e)', () => {
    it('bitwise complements a long', () => {
      const frame = exec([0x107e], (f) => {
        f.registers[1] = longValue(0n);
      });
      expect(frame.registers[0]).toEqual(longValue(-1n));
    });
  });

  describe('neg-float (0x7f)', () => {
    it('negates a float', () => {
      const frame = exec([0x107f], (f) => {
        f.registers[1] = floatValue(3.14);
      });
      expect((frame.registers[0] as { type: 'float'; value: number }).value).toBeCloseTo(-3.14, 1);
    });
  });

  describe('neg-double (0x80)', () => {
    it('negates a double', () => {
      const frame = exec([0x1080], (f) => {
        f.registers[1] = doubleValue(2.718);
      });
      expect(frame.registers[0]).toEqual(doubleValue(-2.718));
    });
  });

  // ─── Type Conversion Operations (0x81-0x8f) ───

  describe('int-to-long (0x81)', () => {
    it('converts int to long', () => {
      const frame = exec([0x1081], (f) => {
        f.registers[1] = intValue(42);
      });
      expect(frame.registers[0]).toEqual(longValue(42n));
      expect(frame.pc).toBe(1);
    });

    it('preserves sign for negative int', () => {
      const frame = exec([0x1081], (f) => {
        f.registers[1] = intValue(-100);
      });
      expect(frame.registers[0]).toEqual(longValue(-100n));
    });
  });

  describe('int-to-float (0x82)', () => {
    it('converts int to float', () => {
      const frame = exec([0x1082], (f) => {
        f.registers[1] = intValue(42);
      });
      expect(frame.registers[0]).toEqual({ type: 'float', value: Math.fround(42) });
    });
  });

  describe('int-to-double (0x83)', () => {
    it('converts int to double', () => {
      const frame = exec([0x1083], (f) => {
        f.registers[1] = intValue(42);
      });
      expect(frame.registers[0]).toEqual(doubleValue(42));
    });
  });

  describe('long-to-int (0x84)', () => {
    it('truncates long to int', () => {
      const frame = exec([0x1084], (f) => {
        f.registers[1] = longValue(42n);
      });
      expect(frame.registers[0]).toEqual(intValue(42));
    });

    it('truncates large long', () => {
      const frame = exec([0x1084], (f) => {
        f.registers[1] = longValue(0x1_0000_0000n + 5n);
      });
      expect((frame.registers[0] as { type: 'int'; value: number }).value).toBe(5);
    });
  });

  describe('long-to-float (0x85)', () => {
    it('converts long to float', () => {
      const frame = exec([0x1085], (f) => {
        f.registers[1] = longValue(42n);
      });
      expect(frame.registers[0]).toEqual({ type: 'float', value: Math.fround(42) });
    });
  });

  describe('long-to-double (0x86)', () => {
    it('converts long to double', () => {
      const frame = exec([0x1086], (f) => {
        f.registers[1] = longValue(42n);
      });
      expect(frame.registers[0]).toEqual(doubleValue(42));
    });
  });

  describe('float-to-int (0x87)', () => {
    it('truncates float to int', () => {
      const frame = exec([0x1087], (f) => {
        f.registers[1] = floatValue(3.7);
      });
      expect(frame.registers[0]).toEqual(intValue(3));
    });

    it('returns 0 for NaN', () => {
      const frame = exec([0x1087], (f) => {
        f.registers[1] = floatValue(NaN);
      });
      expect(frame.registers[0]).toEqual(intValue(0));
    });

    it('clamps positive overflow', () => {
      const frame = exec([0x1087], (f) => {
        f.registers[1] = floatValue(1e15);
      });
      expect((frame.registers[0] as { type: 'int'; value: number }).value).toBe(2147483647);
    });

    it('clamps negative overflow', () => {
      const frame = exec([0x1087], (f) => {
        f.registers[1] = floatValue(-1e15);
      });
      expect((frame.registers[0] as { type: 'int'; value: number }).value).toBe(-2147483648);
    });
  });

  describe('float-to-long (0x88)', () => {
    it('converts float to long', () => {
      const frame = exec([0x1088], (f) => {
        f.registers[1] = floatValue(42.5);
      });
      expect(frame.registers[0]).toEqual(longValue(42n));
    });

    it('returns 0n for NaN', () => {
      const frame = exec([0x1088], (f) => {
        f.registers[1] = floatValue(NaN);
      });
      expect(frame.registers[0]).toEqual(longValue(0n));
    });
  });

  describe('float-to-double (0x89)', () => {
    it('widens float to double', () => {
      const frame = exec([0x1089], (f) => {
        f.registers[1] = floatValue(3.5);
      });
      expect(frame.registers[0]).toEqual(doubleValue(3.5));
    });
  });

  describe('double-to-int (0x8a)', () => {
    it('truncates double to int', () => {
      const frame = exec([0x108a], (f) => {
        f.registers[1] = doubleValue(9.9);
      });
      expect(frame.registers[0]).toEqual(intValue(9));
    });

    it('returns 0 for NaN', () => {
      const frame = exec([0x108a], (f) => {
        f.registers[1] = doubleValue(NaN);
      });
      expect(frame.registers[0]).toEqual(intValue(0));
    });
  });

  describe('double-to-long (0x8b)', () => {
    it('truncates double to long', () => {
      const frame = exec([0x108b], (f) => {
        f.registers[1] = doubleValue(42.9);
      });
      expect(frame.registers[0]).toEqual(longValue(42n));
    });

    it('returns 0n for NaN', () => {
      const frame = exec([0x108b], (f) => {
        f.registers[1] = doubleValue(NaN);
      });
      expect(frame.registers[0]).toEqual(longValue(0n));
    });
  });

  describe('double-to-float (0x8c)', () => {
    it('narrows double to float', () => {
      const frame = exec([0x108c], (f) => {
        f.registers[1] = doubleValue(3.14159265358979);
      });
      expect((frame.registers[0] as { type: 'float'; value: number }).value).toBe(Math.fround(3.14159265358979));
    });
  });

  describe('int-to-byte (0x8d)', () => {
    it('sign-extends to byte', () => {
      const frame = exec([0x108d], (f) => {
        f.registers[1] = intValue(0xff);
      });
      expect(frame.registers[0]).toEqual(intValue(-1)); // 0xff sign-extended = -1
    });

    it('preserves positive byte values', () => {
      const frame = exec([0x108d], (f) => {
        f.registers[1] = intValue(100);
      });
      expect(frame.registers[0]).toEqual(intValue(100));
    });
  });

  describe('int-to-char (0x8e)', () => {
    it('zero-extends to char (unsigned 16-bit)', () => {
      const frame = exec([0x108e], (f) => {
        f.registers[1] = intValue(-1);
      });
      expect(frame.registers[0]).toEqual(intValue(0xffff)); // -1 & 0xffff = 65535
    });

    it('preserves normal char values', () => {
      const frame = exec([0x108e], (f) => {
        f.registers[1] = intValue(65); // 'A'
      });
      expect(frame.registers[0]).toEqual(intValue(65));
    });
  });

  describe('int-to-short (0x8f)', () => {
    it('sign-extends to short', () => {
      const frame = exec([0x108f], (f) => {
        f.registers[1] = intValue(0xffff);
      });
      expect(frame.registers[0]).toEqual(intValue(-1)); // 0xffff sign-extended = -1
    });

    it('preserves positive short values', () => {
      const frame = exec([0x108f], (f) => {
        f.registers[1] = intValue(1000);
      });
      expect(frame.registers[0]).toEqual(intValue(1000));
    });
  });

  // ─── Remaining Integer 3-register (0x94-0x9a) ───

  describe('rem-int (0x94)', () => {
    it('computes remainder', () => {
      // 23x format: word0 = opcode | (vA << 8), word1 = vB | (vC << 8)
      const frame = exec([0x0094, 0x0201], (f) => {
        f.registers[1] = intValue(10);
        f.registers[2] = intValue(3);
      });
      expect(frame.registers[0]).toEqual(intValue(1)); // 10 % 3 = 1
      expect(frame.pc).toBe(2);
    });

    it('throws on divide by zero', () => {
      expect(() => {
        exec([0x0094, 0x0201], (f) => {
          f.registers[1] = intValue(10);
          f.registers[2] = intValue(0);
        });
      }).toThrow('ArithmeticException');
    });
  });

  describe('and-int (0x95)', () => {
    it('bitwise AND', () => {
      const frame = exec([0x0095, 0x0201], (f) => {
        f.registers[1] = intValue(0xff);
        f.registers[2] = intValue(0x0f);
      });
      expect(frame.registers[0]).toEqual(intValue(0x0f));
    });
  });

  describe('or-int (0x96)', () => {
    it('bitwise OR', () => {
      const frame = exec([0x0096, 0x0201], (f) => {
        f.registers[1] = intValue(0xf0);
        f.registers[2] = intValue(0x0f);
      });
      expect(frame.registers[0]).toEqual(intValue(0xff));
    });
  });

  describe('xor-int (0x97)', () => {
    it('bitwise XOR', () => {
      const frame = exec([0x0097, 0x0201], (f) => {
        f.registers[1] = intValue(0xff);
        f.registers[2] = intValue(0x0f);
      });
      expect(frame.registers[0]).toEqual(intValue(0xf0));
    });
  });

  describe('shl-int (0x98)', () => {
    it('shifts left', () => {
      const frame = exec([0x0098, 0x0201], (f) => {
        f.registers[1] = intValue(1);
        f.registers[2] = intValue(4);
      });
      expect(frame.registers[0]).toEqual(intValue(16));
    });
  });

  describe('shr-int (0x99)', () => {
    it('arithmetic shifts right', () => {
      const frame = exec([0x0099, 0x0201], (f) => {
        f.registers[1] = intValue(-16);
        f.registers[2] = intValue(2);
      });
      expect(frame.registers[0]).toEqual(intValue(-4));
    });
  });

  describe('ushr-int (0x9a)', () => {
    it('logical shifts right (unsigned)', () => {
      const frame = exec([0x009a, 0x0201], (f) => {
        f.registers[1] = intValue(-1);
        f.registers[2] = intValue(16);
      });
      // -1 >>> 16 = 65535 (0x0000ffff), but |0 makes it signed
      expect((frame.registers[0] as { type: 'int'; value: number }).value).toBe((-1 >>> 16) | 0);
    });
  });

  // ─── Long 3-register (0x9b-0xa5) ───

  describe('add-long (0x9b)', () => {
    it('adds two longs', () => {
      const frame = exec([0x009b, 0x0201], (f) => {
        f.registers[1] = longValue(100n);
        f.registers[2] = longValue(200n);
      });
      expect(frame.registers[0]).toEqual(longValue(300n));
      expect(frame.pc).toBe(2);
    });
  });

  describe('sub-long (0x9c)', () => {
    it('subtracts two longs', () => {
      const frame = exec([0x009c, 0x0201], (f) => {
        f.registers[1] = longValue(200n);
        f.registers[2] = longValue(50n);
      });
      expect(frame.registers[0]).toEqual(longValue(150n));
    });
  });

  describe('mul-long (0x9d)', () => {
    it('multiplies two longs', () => {
      const frame = exec([0x009d, 0x0201], (f) => {
        f.registers[1] = longValue(6n);
        f.registers[2] = longValue(7n);
      });
      expect(frame.registers[0]).toEqual(longValue(42n));
    });
  });

  describe('div-long (0x9e)', () => {
    it('divides two longs', () => {
      const frame = exec([0x009e, 0x0201], (f) => {
        f.registers[1] = longValue(100n);
        f.registers[2] = longValue(3n);
      });
      expect(frame.registers[0]).toEqual(longValue(33n));
    });

    it('throws on divide by zero', () => {
      expect(() => {
        exec([0x009e, 0x0201], (f) => {
          f.registers[1] = longValue(42n);
          f.registers[2] = longValue(0n);
        });
      }).toThrow('ArithmeticException');
    });
  });

  describe('rem-long (0x9f)', () => {
    it('computes long remainder', () => {
      const frame = exec([0x009f, 0x0201], (f) => {
        f.registers[1] = longValue(10n);
        f.registers[2] = longValue(3n);
      });
      expect(frame.registers[0]).toEqual(longValue(1n));
    });

    it('throws on divide by zero', () => {
      expect(() => {
        exec([0x009f, 0x0201], (f) => {
          f.registers[1] = longValue(10n);
          f.registers[2] = longValue(0n);
        });
      }).toThrow('ArithmeticException');
    });
  });

  describe('and-long (0xa0)', () => {
    it('bitwise AND long', () => {
      const frame = exec([0x00a0, 0x0201], (f) => {
        f.registers[1] = longValue(0xffn);
        f.registers[2] = longValue(0x0fn);
      });
      expect(frame.registers[0]).toEqual(longValue(0x0fn));
    });
  });

  describe('or-long (0xa1)', () => {
    it('bitwise OR long', () => {
      const frame = exec([0x00a1, 0x0201], (f) => {
        f.registers[1] = longValue(0xf0n);
        f.registers[2] = longValue(0x0fn);
      });
      expect(frame.registers[0]).toEqual(longValue(0xffn));
    });
  });

  describe('xor-long (0xa2)', () => {
    it('bitwise XOR long', () => {
      const frame = exec([0x00a2, 0x0201], (f) => {
        f.registers[1] = longValue(0xffn);
        f.registers[2] = longValue(0x0fn);
      });
      expect(frame.registers[0]).toEqual(longValue(0xf0n));
    });
  });

  describe('shl-long (0xa3)', () => {
    it('shifts long left', () => {
      const frame = exec([0x00a3, 0x0201], (f) => {
        f.registers[1] = longValue(1n);
        f.registers[2] = intValue(4);
      });
      expect(frame.registers[0]).toEqual(longValue(16n));
    });
  });

  describe('shr-long (0xa4)', () => {
    it('arithmetic shifts long right', () => {
      const frame = exec([0x00a4, 0x0201], (f) => {
        f.registers[1] = longValue(-16n);
        f.registers[2] = intValue(2);
      });
      expect(frame.registers[0]).toEqual(longValue(-4n));
    });
  });

  describe('ushr-long (0xa5)', () => {
    it('logical shifts long right', () => {
      const frame = exec([0x00a5, 0x0201], (f) => {
        f.registers[1] = longValue(64n);
        f.registers[2] = intValue(2);
      });
      expect(frame.registers[0]).toEqual(longValue(16n));
    });
  });

  // ─── Float 3-register (0xa6-0xaa) ───

  describe('add-float (0xa6)', () => {
    it('adds two floats', () => {
      const frame = exec([0x00a6, 0x0201], (f) => {
        f.registers[1] = floatValue(1.5);
        f.registers[2] = floatValue(2.5);
      });
      expect(frame.registers[0]).toEqual({ type: 'float', value: Math.fround(4.0) });
      expect(frame.pc).toBe(2);
    });
  });

  describe('sub-float (0xa7)', () => {
    it('subtracts two floats', () => {
      const frame = exec([0x00a7, 0x0201], (f) => {
        f.registers[1] = floatValue(5.0);
        f.registers[2] = floatValue(2.0);
      });
      expect(frame.registers[0]).toEqual({ type: 'float', value: Math.fround(3.0) });
    });
  });

  describe('mul-float (0xa8)', () => {
    it('multiplies two floats', () => {
      const frame = exec([0x00a8, 0x0201], (f) => {
        f.registers[1] = floatValue(3.0);
        f.registers[2] = floatValue(7.0);
      });
      expect(frame.registers[0]).toEqual({ type: 'float', value: Math.fround(21.0) });
    });
  });

  describe('div-float (0xa9)', () => {
    it('divides two floats', () => {
      const frame = exec([0x00a9, 0x0201], (f) => {
        f.registers[1] = floatValue(10.0);
        f.registers[2] = floatValue(4.0);
      });
      expect(frame.registers[0]).toEqual({ type: 'float', value: Math.fround(2.5) });
    });
  });

  describe('rem-float (0xaa)', () => {
    it('computes float remainder', () => {
      const frame = exec([0x00aa, 0x0201], (f) => {
        f.registers[1] = floatValue(10.0);
        f.registers[2] = floatValue(3.0);
      });
      expect((frame.registers[0] as { type: 'float'; value: number }).value).toBeCloseTo(1.0, 5);
    });
  });

  // ─── Double 3-register (0xab-0xaf) ───

  describe('add-double (0xab)', () => {
    it('adds two doubles', () => {
      const frame = exec([0x00ab, 0x0201], (f) => {
        f.registers[1] = doubleValue(1.5);
        f.registers[2] = doubleValue(2.5);
      });
      expect(frame.registers[0]).toEqual(doubleValue(4.0));
      expect(frame.pc).toBe(2);
    });
  });

  describe('sub-double (0xac)', () => {
    it('subtracts two doubles', () => {
      const frame = exec([0x00ac, 0x0201], (f) => {
        f.registers[1] = doubleValue(5.0);
        f.registers[2] = doubleValue(2.0);
      });
      expect(frame.registers[0]).toEqual(doubleValue(3.0));
    });
  });

  describe('mul-double (0xad)', () => {
    it('multiplies two doubles', () => {
      const frame = exec([0x00ad, 0x0201], (f) => {
        f.registers[1] = doubleValue(3.0);
        f.registers[2] = doubleValue(7.0);
      });
      expect(frame.registers[0]).toEqual(doubleValue(21.0));
    });
  });

  describe('div-double (0xae)', () => {
    it('divides two doubles', () => {
      const frame = exec([0x00ae, 0x0201], (f) => {
        f.registers[1] = doubleValue(10.0);
        f.registers[2] = doubleValue(4.0);
      });
      expect(frame.registers[0]).toEqual(doubleValue(2.5));
    });
  });

  describe('rem-double (0xaf)', () => {
    it('computes double remainder', () => {
      const frame = exec([0x00af, 0x0201], (f) => {
        f.registers[1] = doubleValue(10.0);
        f.registers[2] = doubleValue(3.0);
      });
      expect(frame.registers[0]).toEqual(doubleValue(1.0));
    });
  });

  // ─── Remaining 2addr Integer (0xb4-0xba) ───

  describe('rem-int/2addr (0xb4)', () => {
    // 12x format: word0 = opcode | (vA << 8) | (vB << 12)
    it('computes remainder in-place', () => {
      const frame = exec([0x10b4], (f) => {
        f.registers[0] = intValue(10);
        f.registers[1] = intValue(3);
      });
      expect(frame.registers[0]).toEqual(intValue(1));
      expect(frame.pc).toBe(1);
    });

    it('throws on divide by zero', () => {
      expect(() => {
        exec([0x10b4], (f) => {
          f.registers[0] = intValue(10);
          f.registers[1] = intValue(0);
        });
      }).toThrow('ArithmeticException');
    });
  });

  describe('and-int/2addr (0xb5)', () => {
    it('ANDs in-place', () => {
      const frame = exec([0x10b5], (f) => {
        f.registers[0] = intValue(0xff);
        f.registers[1] = intValue(0x0f);
      });
      expect(frame.registers[0]).toEqual(intValue(0x0f));
    });
  });

  describe('or-int/2addr (0xb6)', () => {
    it('ORs in-place', () => {
      const frame = exec([0x10b6], (f) => {
        f.registers[0] = intValue(0xf0);
        f.registers[1] = intValue(0x0f);
      });
      expect(frame.registers[0]).toEqual(intValue(0xff));
    });
  });

  describe('xor-int/2addr (0xb7)', () => {
    it('XORs in-place', () => {
      const frame = exec([0x10b7], (f) => {
        f.registers[0] = intValue(0xff);
        f.registers[1] = intValue(0x0f);
      });
      expect(frame.registers[0]).toEqual(intValue(0xf0));
    });
  });

  describe('shl-int/2addr (0xb8)', () => {
    it('shifts left in-place', () => {
      const frame = exec([0x10b8], (f) => {
        f.registers[0] = intValue(1);
        f.registers[1] = intValue(8);
      });
      expect(frame.registers[0]).toEqual(intValue(256));
    });
  });

  describe('shr-int/2addr (0xb9)', () => {
    it('arithmetic shifts right in-place', () => {
      const frame = exec([0x10b9], (f) => {
        f.registers[0] = intValue(-256);
        f.registers[1] = intValue(4);
      });
      expect(frame.registers[0]).toEqual(intValue(-16));
    });
  });

  describe('ushr-int/2addr (0xba)', () => {
    it('logical shifts right in-place', () => {
      const frame = exec([0x10ba], (f) => {
        f.registers[0] = intValue(256);
        f.registers[1] = intValue(4);
      });
      expect(frame.registers[0]).toEqual(intValue(16));
    });
  });

  // ─── Long 2addr (0xbb-0xc5) ───

  describe('add-long/2addr (0xbb)', () => {
    it('adds longs in-place', () => {
      const frame = exec([0x10bb], (f) => {
        f.registers[0] = longValue(100n);
        f.registers[1] = longValue(200n);
      });
      expect(frame.registers[0]).toEqual(longValue(300n));
      expect(frame.pc).toBe(1);
    });
  });

  describe('sub-long/2addr (0xbc)', () => {
    it('subtracts longs in-place', () => {
      const frame = exec([0x10bc], (f) => {
        f.registers[0] = longValue(300n);
        f.registers[1] = longValue(100n);
      });
      expect(frame.registers[0]).toEqual(longValue(200n));
    });
  });

  describe('mul-long/2addr (0xbd)', () => {
    it('multiplies longs in-place', () => {
      const frame = exec([0x10bd], (f) => {
        f.registers[0] = longValue(6n);
        f.registers[1] = longValue(7n);
      });
      expect(frame.registers[0]).toEqual(longValue(42n));
    });
  });

  describe('div-long/2addr (0xbe)', () => {
    it('divides longs in-place', () => {
      const frame = exec([0x10be], (f) => {
        f.registers[0] = longValue(100n);
        f.registers[1] = longValue(3n);
      });
      expect(frame.registers[0]).toEqual(longValue(33n));
    });

    it('throws on divide by zero', () => {
      expect(() => {
        exec([0x10be], (f) => {
          f.registers[0] = longValue(42n);
          f.registers[1] = longValue(0n);
        });
      }).toThrow('ArithmeticException');
    });
  });

  describe('rem-long/2addr (0xbf)', () => {
    it('computes long remainder in-place', () => {
      const frame = exec([0x10bf], (f) => {
        f.registers[0] = longValue(10n);
        f.registers[1] = longValue(3n);
      });
      expect(frame.registers[0]).toEqual(longValue(1n));
    });
  });

  describe('and-long/2addr (0xc0)', () => {
    it('ANDs longs in-place', () => {
      const frame = exec([0x10c0], (f) => {
        f.registers[0] = longValue(0xffn);
        f.registers[1] = longValue(0x0fn);
      });
      expect(frame.registers[0]).toEqual(longValue(0x0fn));
    });
  });

  describe('or-long/2addr (0xc1)', () => {
    it('ORs longs in-place', () => {
      const frame = exec([0x10c1], (f) => {
        f.registers[0] = longValue(0xf0n);
        f.registers[1] = longValue(0x0fn);
      });
      expect(frame.registers[0]).toEqual(longValue(0xffn));
    });
  });

  describe('xor-long/2addr (0xc2)', () => {
    it('XORs longs in-place', () => {
      const frame = exec([0x10c2], (f) => {
        f.registers[0] = longValue(0xffn);
        f.registers[1] = longValue(0x0fn);
      });
      expect(frame.registers[0]).toEqual(longValue(0xf0n));
    });
  });

  describe('shl-long/2addr (0xc3)', () => {
    it('shifts long left in-place', () => {
      const frame = exec([0x10c3], (f) => {
        f.registers[0] = longValue(1n);
        f.registers[1] = intValue(10);
      });
      expect(frame.registers[0]).toEqual(longValue(1024n));
    });
  });

  describe('shr-long/2addr (0xc4)', () => {
    it('arithmetic shifts long right in-place', () => {
      const frame = exec([0x10c4], (f) => {
        f.registers[0] = longValue(-1024n);
        f.registers[1] = intValue(2);
      });
      expect(frame.registers[0]).toEqual(longValue(-256n));
    });
  });

  describe('ushr-long/2addr (0xc5)', () => {
    it('logical shifts long right in-place', () => {
      const frame = exec([0x10c5], (f) => {
        f.registers[0] = longValue(1024n);
        f.registers[1] = intValue(2);
      });
      expect(frame.registers[0]).toEqual(longValue(256n));
    });
  });

  // ─── Float/Double 2addr (0xc6-0xcf) ───

  describe('add-float/2addr (0xc6)', () => {
    it('adds floats in-place', () => {
      const frame = exec([0x10c6], (f) => {
        f.registers[0] = floatValue(1.5);
        f.registers[1] = floatValue(2.5);
      });
      expect(frame.registers[0]).toEqual({ type: 'float', value: Math.fround(4.0) });
      expect(frame.pc).toBe(1);
    });
  });

  describe('sub-float/2addr (0xc7)', () => {
    it('subtracts floats in-place', () => {
      const frame = exec([0x10c7], (f) => {
        f.registers[0] = floatValue(5.0);
        f.registers[1] = floatValue(2.0);
      });
      expect(frame.registers[0]).toEqual({ type: 'float', value: Math.fround(3.0) });
    });
  });

  describe('mul-float/2addr (0xc8)', () => {
    it('multiplies floats in-place', () => {
      const frame = exec([0x10c8], (f) => {
        f.registers[0] = floatValue(3.0);
        f.registers[1] = floatValue(7.0);
      });
      expect(frame.registers[0]).toEqual({ type: 'float', value: Math.fround(21.0) });
    });
  });

  describe('div-float/2addr (0xc9)', () => {
    it('divides floats in-place', () => {
      const frame = exec([0x10c9], (f) => {
        f.registers[0] = floatValue(10.0);
        f.registers[1] = floatValue(4.0);
      });
      expect(frame.registers[0]).toEqual({ type: 'float', value: Math.fround(2.5) });
    });
  });

  describe('rem-float/2addr (0xca)', () => {
    it('computes float remainder in-place', () => {
      const frame = exec([0x10ca], (f) => {
        f.registers[0] = floatValue(10.0);
        f.registers[1] = floatValue(3.0);
      });
      expect((frame.registers[0] as { type: 'float'; value: number }).value).toBeCloseTo(1.0, 5);
    });
  });

  describe('add-double/2addr (0xcb)', () => {
    it('adds doubles in-place', () => {
      const frame = exec([0x10cb], (f) => {
        f.registers[0] = doubleValue(1.5);
        f.registers[1] = doubleValue(2.5);
      });
      expect(frame.registers[0]).toEqual(doubleValue(4.0));
    });
  });

  describe('sub-double/2addr (0xcc)', () => {
    it('subtracts doubles in-place', () => {
      const frame = exec([0x10cc], (f) => {
        f.registers[0] = doubleValue(5.0);
        f.registers[1] = doubleValue(2.0);
      });
      expect(frame.registers[0]).toEqual(doubleValue(3.0));
    });
  });

  describe('mul-double/2addr (0xcd)', () => {
    it('multiplies doubles in-place', () => {
      const frame = exec([0x10cd], (f) => {
        f.registers[0] = doubleValue(3.0);
        f.registers[1] = doubleValue(7.0);
      });
      expect(frame.registers[0]).toEqual(doubleValue(21.0));
    });
  });

  describe('div-double/2addr (0xce)', () => {
    it('divides doubles in-place', () => {
      const frame = exec([0x10ce], (f) => {
        f.registers[0] = doubleValue(10.0);
        f.registers[1] = doubleValue(4.0);
      });
      expect(frame.registers[0]).toEqual(doubleValue(2.5));
    });
  });

  describe('rem-double/2addr (0xcf)', () => {
    it('computes double remainder in-place', () => {
      const frame = exec([0x10cf], (f) => {
        f.registers[0] = doubleValue(10.0);
        f.registers[1] = doubleValue(3.0);
      });
      expect(frame.registers[0]).toEqual(doubleValue(1.0));
    });
  });

  // ─── Remaining lit16 (0xd2-0xd7) ───

  describe('mul-int/lit16 (0xd2)', () => {
    // 22s format: word0 = opcode | (vA << 8) | (vB << 12), word1 = literal_16
    it('multiplies register by lit16', () => {
      // mul-int/lit16 v0, v1, #10: word0 = 0xd2 | (0 << 8) | (1 << 12) = 0x10d2, word1 = 10
      const frame = exec([0x10d2, 0x000a], (f) => {
        f.registers[1] = intValue(5);
      });
      expect(frame.registers[0]).toEqual(intValue(50));
      expect(frame.pc).toBe(2);
    });
  });

  describe('div-int/lit16 (0xd3)', () => {
    it('divides register by lit16', () => {
      const frame = exec([0x10d3, 0x0005], (f) => {
        f.registers[1] = intValue(42);
      });
      expect(frame.registers[0]).toEqual(intValue(8));
    });

    it('throws on divide by zero', () => {
      expect(() => {
        exec([0x10d3, 0x0000], (f) => {
          f.registers[1] = intValue(42);
        });
      }).toThrow('ArithmeticException');
    });
  });

  describe('rem-int/lit16 (0xd4)', () => {
    it('computes remainder with lit16', () => {
      const frame = exec([0x10d4, 0x0003], (f) => {
        f.registers[1] = intValue(10);
      });
      expect(frame.registers[0]).toEqual(intValue(1));
    });

    it('throws on divide by zero', () => {
      expect(() => {
        exec([0x10d4, 0x0000], (f) => {
          f.registers[1] = intValue(10);
        });
      }).toThrow('ArithmeticException');
    });
  });

  describe('and-int/lit16 (0xd5)', () => {
    it('ANDs register with lit16', () => {
      const frame = exec([0x10d5, 0x00ff], (f) => {
        f.registers[1] = intValue(0x12ff);
      });
      expect(frame.registers[0]).toEqual(intValue(0xff));
    });
  });

  describe('or-int/lit16 (0xd6)', () => {
    it('ORs register with lit16', () => {
      const frame = exec([0x10d6, 0x000f], (f) => {
        f.registers[1] = intValue(0xf0);
      });
      expect(frame.registers[0]).toEqual(intValue(0xff));
    });
  });

  describe('xor-int/lit16 (0xd7)', () => {
    it('XORs register with lit16', () => {
      const frame = exec([0x10d7, 0x00ff], (f) => {
        f.registers[1] = intValue(0xff);
      });
      expect(frame.registers[0]).toEqual(intValue(0));
    });
  });

  // ─── Remaining lit8 (0xdc-0xe2) ───

  describe('rem-int/lit8 (0xdc)', () => {
    // 22b format: word0 = opcode | (vA << 8), word1 = vB | (lit8 << 8)
    it('computes remainder with lit8', () => {
      // rem-int/lit8 v0, v1, #+3: word0 = 0x00dc, word1 = 0x0301
      const frame = exec([0x00dc, 0x0301], (f) => {
        f.registers[1] = intValue(10);
      });
      expect(frame.registers[0]).toEqual(intValue(1));
      expect(frame.pc).toBe(2);
    });

    it('throws on divide by zero', () => {
      expect(() => {
        exec([0x00dc, 0x0001], (f) => {
          f.registers[1] = intValue(10);
        });
      }).toThrow('ArithmeticException');
    });
  });

  describe('and-int/lit8 (0xdd)', () => {
    it('ANDs register with lit8', () => {
      // and-int/lit8 v0, v1, #+0x0f: word1 = 0x0f01
      const frame = exec([0x00dd, 0x0f01], (f) => {
        f.registers[1] = intValue(0xff);
      });
      expect(frame.registers[0]).toEqual(intValue(0x0f));
    });
  });

  describe('or-int/lit8 (0xde)', () => {
    it('ORs register with lit8', () => {
      // or-int/lit8 v0, v1, #+0x0f: word1 = 0x0f01
      const frame = exec([0x00de, 0x0f01], (f) => {
        f.registers[1] = intValue(0xf0);
      });
      expect(frame.registers[0]).toEqual(intValue(0xff));
    });
  });

  describe('xor-int/lit8 (0xdf)', () => {
    it('XORs register with lit8', () => {
      // xor-int/lit8 v0, v1, #+0xff -> lit8=0xff sign-extended = -1
      // word1 = 0xff01
      const frame = exec([0x00df, 0xff01], (f) => {
        f.registers[1] = intValue(0);
      });
      // 0 ^ (-1) = -1
      expect(frame.registers[0]).toEqual(intValue(-1));
    });
  });

  describe('shl-int/lit8 (0xe0)', () => {
    it('shifts left by lit8', () => {
      // shl-int/lit8 v0, v1, #+4: word1 = 0x0401
      const frame = exec([0x00e0, 0x0401], (f) => {
        f.registers[1] = intValue(1);
      });
      expect(frame.registers[0]).toEqual(intValue(16));
    });
  });

  describe('shr-int/lit8 (0xe1)', () => {
    it('arithmetic shifts right by lit8', () => {
      // shr-int/lit8 v0, v1, #+2: word1 = 0x0201
      const frame = exec([0x00e1, 0x0201], (f) => {
        f.registers[1] = intValue(-16);
      });
      expect(frame.registers[0]).toEqual(intValue(-4));
    });
  });

  describe('ushr-int/lit8 (0xe2)', () => {
    it('logical shifts right by lit8', () => {
      // ushr-int/lit8 v0, v1, #+4: word1 = 0x0401
      const frame = exec([0x00e2, 0x0401], (f) => {
        f.registers[1] = intValue(256);
      });
      expect(frame.registers[0]).toEqual(intValue(16));
    });
  });

  // ─── Array Init Opcodes (0x24-0x26) ───

  describe('filled-new-array (0x24)', () => {
    it('creates array with register values', () => {
      mockDex.setType(0, '[I');
      // 35c format: insn = opcode | (count << 12) | (vA_placeholder << 8)
      // For count=3, regs {v0,v1,v2}: insn = 0x24 | (3 << 12) = 0x3024
      // word1 = typeIdx = 0
      // word2 = regList: v0=0 | (v1=1 << 4) | (v2=2 << 8) = 0x0210
      const frame = exec([0x3024, 0x0000, 0x0210], (f) => {
        f.registers[0] = intValue(10);
        f.registers[1] = intValue(20);
        f.registers[2] = intValue(30);
      });
      // The opcode calls returnFromMethod with the array ref
      expect(mockInterp.returnedValue).not.toBeNull();
      const arrRef = (mockInterp.returnedValue as { type: 'object'; ref: number }).ref;
      expect(heap.getArrayElement(arrRef, 0)).toEqual(intValue(10));
      expect(heap.getArrayElement(arrRef, 1)).toEqual(intValue(20));
      expect(heap.getArrayElement(arrRef, 2)).toEqual(intValue(30));
      expect(frame.pc).toBe(3);
    });
  });

  describe('filled-new-array/range (0x25)', () => {
    it('creates array with range of register values', () => {
      mockDex.setType(0, '[I');
      // 3rc format: insn = opcode | (count << 8) = 0x25 | (3 << 8) = 0x0325
      // word1 = typeIdx = 0
      // word2 = vC = 0 (start register)
      const frame = exec([0x0325, 0x0000, 0x0000], (f) => {
        f.registers[0] = intValue(5);
        f.registers[1] = intValue(10);
        f.registers[2] = intValue(15);
      });
      expect(mockInterp.returnedValue).not.toBeNull();
      const arrRef = (mockInterp.returnedValue as { type: 'object'; ref: number }).ref;
      expect(heap.getArrayElement(arrRef, 0)).toEqual(intValue(5));
      expect(heap.getArrayElement(arrRef, 1)).toEqual(intValue(10));
      expect(heap.getArrayElement(arrRef, 2)).toEqual(intValue(15));
      expect(frame.pc).toBe(3);
    });
  });

  describe('fill-array-data (0x26)', () => {
    it('fills array from payload data (4-byte elements)', () => {
      // Allocate an int array of size 2
      const arrRef = heap.allocateArray('I', 2);
      // fill-array-data v0, +3 (offset to payload at pc+3)
      // word0: 0x0026, word1: offset_low=3, word2: offset_high=0
      // Payload at pc+3:
      //   word3: 0x0300 (ident), word4: elementWidth=4
      //   word5: size_low=2, word6: size_high=0
      //   word7: data[0]_low=42, word8: data[0]_high=0
      //   word9: data[1]_low=99, word10: data[1]_high=0
      const frame = exec(
        [0x0026, 0x0003, 0x0000,
         0x0300, 0x0004, 0x0002, 0x0000,
         0x002a, 0x0000, 0x0063, 0x0000],
        (f) => { f.registers[0] = objectRef(arrRef); }
      );
      expect(heap.getArrayElement(arrRef, 0)).toEqual(intValue(42));
      expect(heap.getArrayElement(arrRef, 1)).toEqual(intValue(99));
      expect(frame.pc).toBe(3);
    });

    it('fills array from payload data (2-byte elements)', () => {
      const arrRef = heap.allocateArray('S', 3);
      // fill-array-data v0, +3
      // Payload: ident=0x0300, width=2, size=3
      // data: 10, 20, 30 (as 16-bit words)
      const frame = exec(
        [0x0026, 0x0003, 0x0000,
         0x0300, 0x0002, 0x0003, 0x0000,
         0x000a, 0x0014, 0x001e, 0x0000],
        (f) => { f.registers[0] = objectRef(arrRef); }
      );
      expect(heap.getArrayElement(arrRef, 0)).toEqual(intValue(10));
      expect(heap.getArrayElement(arrRef, 1)).toEqual(intValue(20));
      expect(heap.getArrayElement(arrRef, 2)).toEqual(intValue(30));
    });

    it('throws NullPointerException on null array', () => {
      expect(() => {
        exec(
          [0x0026, 0x0003, 0x0000,
           0x0300, 0x0004, 0x0001, 0x0000,
           0x0001, 0x0000, 0x0000, 0x0000],
          (f) => { f.registers[0] = NULL_VALUE; }
        );
      }).toThrow(NullPointerException);
    });
  });
});
