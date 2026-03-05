/**
 * Tests for integer arithmetic opcode implementations.
 * Covers add/sub/mul/div-int (3-register, 2-address, lit16, lit8).
 */

import { OpcodeTable, ExecutionContext } from '../../../src/interpreter/opcode_table';
import { registerEssentialOpcodes } from '../../../src/interpreter/opcodes';
import { Heap } from '../../../src/interpreter/heap';
import { ExecutionFrame } from '../../../src/interpreter/frame';
import { ResolvedMethod, Value } from '../../../src/interpreter/types';
import { intValue, NULL_VALUE } from '../../../src/core/types';
import { CodeItem } from '../../../src/parser/dex_types';
import { InterpreterError } from '../../../src/interpreter/errors';

class MockInterpreterControl {
  lastResult: Value = NULL_VALUE;
  returnedValue: Value | null = null;
  getLastResult(): Value { return this.lastResult; }
  returnFromMethod(value: Value): void { this.returnedValue = value; }
  invokeMethod(_method: any, _args: Value[]): void {}
}

class MockDexParser {
  getString(_idx: number): string { return ''; }
  getTypeName(_idx: number): string { return ''; }
  getMethodId(_idx: number): any { return { classIdx: 0, protoIdx: 0, nameIdx: 0 }; }
  getFieldId(_idx: number): any { return { classIdx: 0, typeIdx: 0, nameIdx: 0 }; }
  getProtoId(_idx: number): any { return { shortyIdx: 0, returnTypeIdx: 0, parametersOff: 0 }; }
  getProtoParameters(_proto: any): number[] { return []; }
  parseHeader(): any { return {}; }
}

class MockClassLoader {
  resolveField(_idx: number): any { return { classDescriptor: 'Ltest;', name: 'f', descriptor: 'I', accessFlags: 0, offset: 0, isStatic: false }; }
  resolveMethod(_idx: number): ResolvedMethod { return { classDescriptor: 'Ltest;', name: 'm', descriptor: '()V', accessFlags: 0, code: null, isShim: true }; }
  resolveVirtualMethod(_ref: number, _idx: number): ResolvedMethod { return this.resolveMethod(_idx); }
  resolveSuperMethod(_cls: string, _idx: number): ResolvedMethod { return this.resolveMethod(_idx); }
  initializeClass(_desc: string): void {}
  getClassObject(_desc: string): number { return 1; }
  getStaticField(_f: any): Value { return NULL_VALUE; }
  setStaticField(_f: any, _v: Value): void {}
  isInstanceOf(a: string, b: string): boolean { return a === b; }
}

function makeFrame(insns: number[], registersSize: number = 4): ExecutionFrame {
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

describe('Arithmetic Opcodes', () => {
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

  function exec(insns: number[], setupFrame?: (f: ExecutionFrame) => void, regCount = 4): ExecutionFrame {
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

  // ─── 3-register forms (0x90-0x93) ───

  describe('add-int (0x90)', () => {
    it('adds two registers', () => {
      // add-int v0, v1, v2: opcode=0x90, vA=0x00 → word0=0x0090; word1=vB|vC = 0x0201
      const frame = exec([0x0090, 0x0201], (f) => {
        f.registers[1] = intValue(42);
        f.registers[2] = intValue(13);
      });
      expect(frame.registers[0]).toEqual(intValue(55));
      expect(frame.pc).toBe(2);
    });

    it('handles negative numbers', () => {
      const frame = exec([0x0090, 0x0201], (f) => {
        f.registers[1] = intValue(-10);
        f.registers[2] = intValue(3);
      });
      expect(frame.registers[0]).toEqual(intValue(-7));
    });

    it('wraps on overflow (32-bit)', () => {
      const frame = exec([0x0090, 0x0201], (f) => {
        f.registers[1] = intValue(0x7FFFFFFF);
        f.registers[2] = intValue(1);
      });
      expect((frame.registers[0] as { type: 'int'; value: number }).value).toBe(-2147483648);
    });
  });

  describe('sub-int (0x91)', () => {
    it('subtracts two registers', () => {
      const frame = exec([0x0091, 0x0201], (f) => {
        f.registers[1] = intValue(42);
        f.registers[2] = intValue(13);
      });
      expect(frame.registers[0]).toEqual(intValue(29));
      expect(frame.pc).toBe(2);
    });
  });

  describe('mul-int (0x92)', () => {
    it('multiplies two registers', () => {
      const frame = exec([0x0092, 0x0201], (f) => {
        f.registers[1] = intValue(6);
        f.registers[2] = intValue(7);
      });
      expect(frame.registers[0]).toEqual(intValue(42));
    });
  });

  describe('div-int (0x93)', () => {
    it('divides two registers', () => {
      const frame = exec([0x0093, 0x0201], (f) => {
        f.registers[1] = intValue(100);
        f.registers[2] = intValue(3);
      });
      expect(frame.registers[0]).toEqual(intValue(33));
    });

    it('throws on divide by zero', () => {
      expect(() => {
        exec([0x0093, 0x0201], (f) => {
          f.registers[1] = intValue(42);
          f.registers[2] = intValue(0);
        });
      }).toThrow('ArithmeticException');
    });
  });

  // ─── 2-address forms (0xb0-0xb3) ───

  describe('add-int/2addr (0xb0)', () => {
    it('adds vB into vA', () => {
      // add-int/2addr v0, v1: A=0, B=1 → 0x10b0
      const frame = exec([0x10b0], (f) => {
        f.registers[0] = intValue(10);
        f.registers[1] = intValue(20);
      });
      expect(frame.registers[0]).toEqual(intValue(30));
      expect(frame.pc).toBe(1);
    });
  });

  describe('sub-int/2addr (0xb1)', () => {
    it('subtracts vB from vA', () => {
      const frame = exec([0x10b1], (f) => {
        f.registers[0] = intValue(50);
        f.registers[1] = intValue(20);
      });
      expect(frame.registers[0]).toEqual(intValue(30));
    });
  });

  describe('mul-int/2addr (0xb2)', () => {
    it('multiplies vA by vB', () => {
      const frame = exec([0x10b2], (f) => {
        f.registers[0] = intValue(5);
        f.registers[1] = intValue(9);
      });
      expect(frame.registers[0]).toEqual(intValue(45));
    });
  });

  describe('div-int/2addr (0xb3)', () => {
    it('divides vA by vB', () => {
      const frame = exec([0x10b3], (f) => {
        f.registers[0] = intValue(100);
        f.registers[1] = intValue(4);
      });
      expect(frame.registers[0]).toEqual(intValue(25));
    });

    it('throws on divide by zero', () => {
      expect(() => {
        exec([0x10b3], (f) => {
          f.registers[0] = intValue(42);
          f.registers[1] = intValue(0);
        });
      }).toThrow('ArithmeticException');
    });
  });

  // ─── lit16 forms (0xd0-0xd1) ───

  describe('add-int/lit16 (0xd0)', () => {
    it('adds literal to register', () => {
      // add-int/lit16 v0, v1: A=0, B=1 → 0x10d0; lit16=100 → 0x0064
      const frame = exec([0x10d0, 0x0064], (f) => {
        f.registers[1] = intValue(42);
      });
      expect(frame.registers[0]).toEqual(intValue(142));
      expect(frame.pc).toBe(2);
    });

    it('handles negative literal', () => {
      // lit16 = -1 → 0xFFFF
      const frame = exec([0x10d0, 0xFFFF], (f) => {
        f.registers[1] = intValue(42);
      });
      expect(frame.registers[0]).toEqual(intValue(41));
    });
  });

  describe('rsub-int (0xd1)', () => {
    it('reverse-subtracts: lit - vB', () => {
      // rsub-int v0, v1, lit16=100 → 0x10d1, 0x0064
      const frame = exec([0x10d1, 0x0064], (f) => {
        f.registers[1] = intValue(42);
      });
      expect(frame.registers[0]).toEqual(intValue(58)); // 100 - 42 = 58
    });
  });

  // ─── lit8 forms (0xd8-0xdb) ───

  describe('add-int/lit8 (0xd8)', () => {
    it('adds 8-bit literal to register', () => {
      // add-int/lit8 v0, v1, #+10: word0=0x00d8; word1=vB(0x01)|lit8(0x0a) → 0x0a01
      const frame = exec([0x00d8, 0x0a01], (f) => {
        f.registers[1] = intValue(32);
      });
      expect(frame.registers[0]).toEqual(intValue(42));
      expect(frame.pc).toBe(2);
    });

    it('handles negative lit8', () => {
      // lit8 = -5 → 0xfb; word1 = 0xfb01 (vB=1, lit=-5)
      const frame = exec([0x00d8, 0xfb01], (f) => {
        f.registers[1] = intValue(10);
      });
      expect(frame.registers[0]).toEqual(intValue(5));
    });
  });

  describe('rsub-int/lit8 (0xd9)', () => {
    it('reverse-subtracts with lit8', () => {
      // rsub-int/lit8 v0, v1, #+10: word1=0x0a01
      const frame = exec([0x00d9, 0x0a01], (f) => {
        f.registers[1] = intValue(3);
      });
      expect(frame.registers[0]).toEqual(intValue(7)); // 10 - 3 = 7
    });
  });

  describe('mul-int/lit8 (0xda)', () => {
    it('multiplies register by lit8', () => {
      // mul-int/lit8 v0, v1, #+7: word1=0x0701
      const frame = exec([0x00da, 0x0701], (f) => {
        f.registers[1] = intValue(6);
      });
      expect(frame.registers[0]).toEqual(intValue(42));
    });
  });

  describe('div-int/lit8 (0xdb)', () => {
    it('divides register by lit8', () => {
      // div-int/lit8 v0, v1, #+5: word1=0x0501
      const frame = exec([0x00db, 0x0501], (f) => {
        f.registers[1] = intValue(42);
      });
      expect(frame.registers[0]).toEqual(intValue(8)); // 42 / 5 = 8 (truncated)
    });

    it('throws on divide by zero', () => {
      expect(() => {
        exec([0x00db, 0x0001], (f) => {
          f.registers[1] = intValue(42);
        });
      }).toThrow('ArithmeticException');
    });
  });
});
