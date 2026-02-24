/**
 * CRAFT - Opcode Implementations
 * All opcodes needed for Dalvik bytecode execution.
 */

import {
  OpcodeTable,
  getRegA_12x,
  getRegB_12x,
  getRegA_21c,
  getLiteral_11n,
  getRegisters_35c,
  signExtend16,
} from './opcode_table';
import { InterpreterError, NullPointerException } from './errors';

/** Helper: get numeric value from a register (int or float bits) */
function getIntValue(v: { type: string; value?: number | bigint; ref?: number }): number {
  if (v.type === 'int') return (v as { type: 'int'; value: number }).value;
  if (v.type === 'float') return (v as { type: 'float'; value: number }).value;
  if (v.type === 'null') return 0;
  if (v.type === 'object') return (v as { type: 'object'; ref: number }).ref;
  return 0;
}

/** Helper: sign-extend 8-bit value */
function signExtend8(value: number): number {
  return (value << 24) >> 24;
}

/** Helper: sign-extend 32-bit offset from two 16-bit words */
function signExtend32(low: number, high: number): number {
  return ((high << 16) | low) | 0;
}

/** Register all essential opcodes */
export function registerEssentialOpcodes(table: OpcodeTable): void {
  // 0x00 - nop
  table.register(0x00, {
    name: 'nop',
    format: '10x',
    width: 1,
    handler: (ctx, insn) => {
      ctx.frame.pc += 1;
    },
  });

  // 0x01 - move vA, vB
  table.register(0x01, {
    name: 'move',
    format: '12x',
    width: 1,
    handler: (ctx, insn) => {
      const vA = getRegA_12x(insn);
      const vB = getRegB_12x(insn);
      ctx.frame.registers[vA] = ctx.frame.registers[vB];
      ctx.frame.pc += 1;
    },
  });

  // 0x02 - move/from16 vAA, vBBBB
  table.register(0x02, {
    name: 'move/from16',
    format: '22x',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const vB = ctx.frame.method.code!.insns[ctx.frame.pc + 1];
      ctx.frame.registers[vA] = ctx.frame.registers[vB];
      ctx.frame.pc += 2;
    },
  });

  // 0x03 - move/16 vAAAA, vBBBB
  table.register(0x03, {
    name: 'move/16',
    format: '32x',
    width: 3,
    handler: (ctx, insn) => {
      const code = ctx.frame.method.code!.insns;
      const vA = code[ctx.frame.pc + 1];
      const vB = code[ctx.frame.pc + 2];
      ctx.frame.registers[vA] = ctx.frame.registers[vB];
      ctx.frame.pc += 3;
    },
  });

  // 0x04 - move-wide vA, vB
  table.register(0x04, {
    name: 'move-wide',
    format: '12x',
    width: 1,
    handler: (ctx, insn) => {
      const vA = getRegA_12x(insn);
      const vB = getRegB_12x(insn);
      ctx.frame.registers[vA] = ctx.frame.registers[vB];
      ctx.frame.registers[vA + 1] = ctx.frame.registers[vB + 1];
      ctx.frame.pc += 1;
    },
  });

  // 0x05 - move-wide/from16 vAA, vBBBB
  table.register(0x05, {
    name: 'move-wide/from16',
    format: '22x',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const vB = ctx.frame.method.code!.insns[ctx.frame.pc + 1];
      ctx.frame.registers[vA] = ctx.frame.registers[vB];
      ctx.frame.registers[vA + 1] = ctx.frame.registers[vB + 1];
      ctx.frame.pc += 2;
    },
  });

  // 0x06 - move-wide/16 vAAAA, vBBBB
  table.register(0x06, {
    name: 'move-wide/16',
    format: '32x',
    width: 3,
    handler: (ctx, insn) => {
      const code = ctx.frame.method.code!.insns;
      const vA = code[ctx.frame.pc + 1];
      const vB = code[ctx.frame.pc + 2];
      ctx.frame.registers[vA] = ctx.frame.registers[vB];
      ctx.frame.registers[vA + 1] = ctx.frame.registers[vB + 1];
      ctx.frame.pc += 3;
    },
  });

  // 0x07 - move-object vA, vB
  table.register(0x07, {
    name: 'move-object',
    format: '12x',
    width: 1,
    handler: (ctx, insn) => {
      const vA = getRegA_12x(insn);
      const vB = getRegB_12x(insn);
      ctx.frame.registers[vA] = ctx.frame.registers[vB];
      ctx.frame.pc += 1;
    },
  });

  // 0x08 - move-object/from16 vAA, vBBBB
  table.register(0x08, {
    name: 'move-object/from16',
    format: '22x',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const vB = ctx.frame.method.code!.insns[ctx.frame.pc + 1];
      ctx.frame.registers[vA] = ctx.frame.registers[vB];
      ctx.frame.pc += 2;
    },
  });

  // 0x09 - move-object/16 vAAAA, vBBBB
  table.register(0x09, {
    name: 'move-object/16',
    format: '32x',
    width: 3,
    handler: (ctx, insn) => {
      const code = ctx.frame.method.code!.insns;
      const vA = code[ctx.frame.pc + 1];
      const vB = code[ctx.frame.pc + 2];
      ctx.frame.registers[vA] = ctx.frame.registers[vB];
      ctx.frame.pc += 3;
    },
  });

  // 0x0a - move-result vAA
  table.register(0x0a, {
    name: 'move-result',
    format: '11x',
    width: 1,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      ctx.frame.registers[vA] = ctx.interpreter.getLastResult();
      ctx.frame.pc += 1;
    },
  });

  // 0x0b - move-result-wide vAA
  table.register(0x0b, {
    name: 'move-result-wide',
    format: '11x',
    width: 1,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      ctx.frame.registers[vA] = ctx.interpreter.getLastResult();
      ctx.frame.pc += 1;
    },
  });

  // 0x0c - move-result-object vAA
  table.register(0x0c, {
    name: 'move-result-object',
    format: '11x',
    width: 1,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      ctx.frame.registers[vA] = ctx.interpreter.getLastResult();
      ctx.frame.pc += 1;
    },
  });

  // 0x0d - move-exception vAA
  table.register(0x0d, {
    name: 'move-exception',
    format: '11x',
    width: 1,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      ctx.frame.registers[vA] = ctx.interpreter.getLastResult();
      ctx.frame.pc += 1;
    },
  });

  // 0x0e - return-void
  table.register(0x0e, {
    name: 'return-void',
    format: '10x',
    width: 1,
    handler: (ctx, insn) => {
      ctx.interpreter.returnFromMethod({ type: 'null' });
    },
  });

  // 0x0f - return vAA
  table.register(0x0f, {
    name: 'return',
    format: '11x',
    width: 1,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      ctx.interpreter.returnFromMethod(ctx.frame.registers[vA]);
    },
  });

  // 0x10 - return-wide vAA
  table.register(0x10, {
    name: 'return-wide',
    format: '11x',
    width: 1,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      // Wide values occupy two registers
      ctx.interpreter.returnFromMethod(ctx.frame.registers[vA]);
    },
  });

  // 0x11 - return-object vAA
  table.register(0x11, {
    name: 'return-object',
    format: '11x',
    width: 1,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      ctx.interpreter.returnFromMethod(ctx.frame.registers[vA]);
    },
  });

  // 0x12 - const/4 vA, #+B
  table.register(0x12, {
    name: 'const/4',
    format: '11n',
    width: 1,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xf;
      const literal = getLiteral_11n(insn);
      ctx.frame.registers[vA] = { type: 'int', value: literal };
      ctx.frame.pc += 1;
    },
  });

  // 0x13 - const/16 vAA, #+BBBB
  table.register(0x13, {
    name: 'const/16',
    format: '21s',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const literal = signExtend16(code[ctx.frame.pc + 1]);
      ctx.frame.registers[vA] = { type: 'int', value: literal };
      ctx.frame.pc += 2;
    },
  });

  // 0x14 - const vAA, #+BBBBBBBB
  table.register(0x14, {
    name: 'const',
    format: '31i',
    width: 3,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const low = code[ctx.frame.pc + 1];
      const high = code[ctx.frame.pc + 2];
      const literal = (high << 16) | low;
      ctx.frame.registers[vA] = { type: 'int', value: literal | 0 };
      ctx.frame.pc += 3;
    },
  });

  // 0x15 - const/high16 vAA, #+BBBB0000
  table.register(0x15, {
    name: 'const/high16',
    format: '21h',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const high16 = code[ctx.frame.pc + 1];
      const literal = (high16 << 16) | 0;
      ctx.frame.registers[vA] = { type: 'int', value: literal | 0 };
      ctx.frame.pc += 2;
    },
  });

  // 0x16 - const-wide/16 vAA, #+BBBB
  table.register(0x16, {
    name: 'const-wide/16',
    format: '21s',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const literal = signExtend16(code[ctx.frame.pc + 1]);
      ctx.frame.registers[vA] = { type: 'long', value: BigInt(literal) };
      ctx.frame.pc += 2;
    },
  });

  // 0x17 - const-wide/32 vAA, #+BBBBBBBB
  table.register(0x17, {
    name: 'const-wide/32',
    format: '31i',
    width: 3,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const low = code[ctx.frame.pc + 1];
      const high = code[ctx.frame.pc + 2];
      const literal = signExtend32(low, high);
      ctx.frame.registers[vA] = { type: 'long', value: BigInt(literal) };
      ctx.frame.pc += 3;
    },
  });

  // 0x18 - const-wide vAA, #+BBBBBBBBBBBBBBBB
  table.register(0x18, {
    name: 'const-wide',
    format: '51l',
    width: 5,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const w1 = code[ctx.frame.pc + 1];
      const w2 = code[ctx.frame.pc + 2];
      const w3 = code[ctx.frame.pc + 3];
      const w4 = code[ctx.frame.pc + 4];
      const lo = BigInt(w1) | (BigInt(w2) << 16n);
      const hi = BigInt(w3) | (BigInt(w4) << 16n);
      const value = lo | (hi << 32n);
      ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, value) };
      ctx.frame.pc += 5;
    },
  });

  // 0x19 - const-wide/high16 vAA, #+BBBB000000000000
  table.register(0x19, {
    name: 'const-wide/high16',
    format: '21h',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const high16 = code[ctx.frame.pc + 1];
      const value = BigInt(high16) << 48n;
      ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, value) };
      ctx.frame.pc += 2;
    },
  });

  // 0x1a - const-string vAA, string@BBBB
  table.register(0x1a, {
    name: 'const-string',
    format: '21c',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const stringIdx = code[ctx.frame.pc + 1];
      const str = ctx.dex.getString(stringIdx);
      const ref = ctx.heap.internString(str);
      ctx.frame.registers[vA] = { type: 'object', ref };
      ctx.frame.pc += 2;
    },
  });

  // 0x1b - const-string/jumbo vAA, string@BBBBBBBB
  table.register(0x1b, {
    name: 'const-string/jumbo',
    format: '31c',
    width: 3,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const low = code[ctx.frame.pc + 1];
      const high = code[ctx.frame.pc + 2];
      const stringIdx = (high << 16) | low;
      const str = ctx.dex.getString(stringIdx);
      const ref = ctx.heap.internString(str);
      ctx.frame.registers[vA] = { type: 'object', ref };
      ctx.frame.pc += 3;
    },
  });

  // 0x1c - const-class vAA, type@BBBB
  table.register(0x1c, {
    name: 'const-class',
    format: '21c',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const typeIdx = code[ctx.frame.pc + 1];
      const typeDescriptor = ctx.dex.getTypeName(typeIdx);
      const classRef = ctx.classLoader.getClassObject(typeDescriptor);
      ctx.frame.registers[vA] = { type: 'object', ref: classRef };
      ctx.frame.pc += 2;
    },
  });

  // 0x1f - check-cast vAA, type@BBBB
  table.register(0x1f, {
    name: 'check-cast',
    format: '21c',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const typeIdx = code[ctx.frame.pc + 1];
      const objRef = ctx.frame.registers[vA];
      if (objRef.type === 'null') {
        ctx.frame.pc += 2;
        return;
      }
      const targetType = ctx.dex.getTypeName(typeIdx);
      const obj = ctx.heap.getObject((objRef as { type: 'object'; ref: number }).ref);
      if (!obj) {
        throw new NullPointerException('check-cast on invalid object reference');
      }
      const isInstance = ctx.classLoader.isInstanceOf(obj.classDescriptor, targetType);
      if (!isInstance) {
        throw new InterpreterError(
          `ClassCastException: ${obj.classDescriptor} cannot be cast to ${targetType}`
        );
      }
      ctx.frame.pc += 2;
    },
  });

  // 0x20 - instance-of vA, vB, type@CCCC
  table.register(0x20, {
    name: 'instance-of',
    format: '22c',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xf;
      const vB = (insn >> 12) & 0xf;
      const code = ctx.frame.method.code!.insns;
      const typeIdx = code[ctx.frame.pc + 1];

      const objRef = ctx.frame.registers[vB];

      // null is not an instance of any type
      if (objRef.type === 'null') {
        ctx.frame.registers[vA] = { type: 'int', value: 0 };
        ctx.frame.pc += 2;
        return;
      }

      const targetType = ctx.dex.getTypeName(typeIdx);
      const obj = ctx.heap.getObject((objRef as { type: 'object'; ref: number }).ref);

      if (!obj) {
        throw new NullPointerException('instance-of on invalid object reference');
      }

      // Check if object's class matches or is a subclass of target type
      const isInstance = ctx.classLoader.isInstanceOf(obj.classDescriptor, targetType);
      ctx.frame.registers[vA] = { type: 'int', value: isInstance ? 1 : 0 };
      ctx.frame.pc += 2;
    },
  });

  // 0x21 - array-length vA, vB
  table.register(0x21, {
    name: 'array-length',
    format: '12x',
    width: 1,
    handler: (ctx, insn) => {
      const vA = getRegA_12x(insn);
      const vB = getRegB_12x(insn);
      const arrRef = ctx.frame.registers[vB];
      if (arrRef.type === 'null') {
        throw new NullPointerException('array-length on null');
      }
      const length = ctx.heap.getArrayLength((arrRef as { type: 'object'; ref: number }).ref);
      ctx.frame.registers[vA] = { type: 'int', value: length };
      ctx.frame.pc += 1;
    },
  });

  // 0x22 - new-instance vAA, type@BBBB
  table.register(0x22, {
    name: 'new-instance',
    format: '21c',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const typeIdx = code[ctx.frame.pc + 1];
      const typeDescriptor = ctx.dex.getTypeName(typeIdx);
      ctx.classLoader.initializeClass(typeDescriptor);
      const ref = ctx.heap.allocate(typeDescriptor);
      ctx.frame.registers[vA] = { type: 'object', ref };
      ctx.frame.pc += 2;
    },
  });

  // 0x23 - new-array vA, vB, type@CCCC
  table.register(0x23, {
    name: 'new-array',
    format: '22c',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xf;
      const vB = (insn >> 12) & 0xf;
      const code = ctx.frame.method.code!.insns;
      const typeIdx = code[ctx.frame.pc + 1];
      const length = getIntValue(ctx.frame.registers[vB]);
      const typeDescriptor = ctx.dex.getTypeName(typeIdx);
      const elementType = typeDescriptor.substring(1);
      const ref = ctx.heap.allocateArray(elementType, length);
      ctx.frame.registers[vA] = { type: 'object', ref };
      ctx.frame.pc += 2;
    },
  });

  // 0x27 - throw vAA
  table.register(0x27, {
    name: 'throw',
    format: '11x',
    width: 1,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const exRef = ctx.frame.registers[vA];
      if (exRef.type === 'null') {
        throw new NullPointerException('throw with null exception');
      }
      const obj = ctx.heap.getObject((exRef as { type: 'object'; ref: number }).ref);
      const className = obj ? obj.classDescriptor : 'unknown';
      throw new InterpreterError(`Uncaught exception: ${className}`);
    },
  });

  // 0x28 - goto +AA
  table.register(0x28, {
    name: 'goto',
    format: '10t',
    width: 1,
    handler: (ctx, insn) => {
      const offset = signExtend8((insn >> 8) & 0xff);
      ctx.frame.pc += offset;
    },
  });

  // 0x29 - goto/16 +AAAA
  table.register(0x29, {
    name: 'goto/16',
    format: '20t',
    width: 2,
    handler: (ctx, insn) => {
      const code = ctx.frame.method.code!.insns;
      const offset = signExtend16(code[ctx.frame.pc + 1]);
      ctx.frame.pc += offset;
    },
  });

  // 0x2a - goto/32 +AAAAAAAA
  table.register(0x2a, {
    name: 'goto/32',
    format: '30t',
    width: 3,
    handler: (ctx, insn) => {
      const code = ctx.frame.method.code!.insns;
      const low = code[ctx.frame.pc + 1];
      const high = code[ctx.frame.pc + 2];
      const offset = signExtend32(low, high);
      ctx.frame.pc += offset;
    },
  });

  // 0x32 - if-eq vA, vB, +CCCC
  table.register(0x32, {
    name: 'if-eq',
    format: '22t',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xf;
      const vB = (insn >> 12) & 0xf;
      const a = getIntValue(ctx.frame.registers[vA]);
      const b = getIntValue(ctx.frame.registers[vB]);
      if (a === b) {
        ctx.frame.pc += signExtend16(ctx.frame.method.code!.insns[ctx.frame.pc + 1]);
      } else {
        ctx.frame.pc += 2;
      }
    },
  });

  // 0x33 - if-ne vA, vB, +CCCC
  table.register(0x33, {
    name: 'if-ne',
    format: '22t',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xf;
      const vB = (insn >> 12) & 0xf;
      const a = getIntValue(ctx.frame.registers[vA]);
      const b = getIntValue(ctx.frame.registers[vB]);
      if (a !== b) {
        ctx.frame.pc += signExtend16(ctx.frame.method.code!.insns[ctx.frame.pc + 1]);
      } else {
        ctx.frame.pc += 2;
      }
    },
  });

  // 0x34 - if-lt vA, vB, +CCCC
  table.register(0x34, {
    name: 'if-lt',
    format: '22t',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xf;
      const vB = (insn >> 12) & 0xf;
      const a = getIntValue(ctx.frame.registers[vA]);
      const b = getIntValue(ctx.frame.registers[vB]);
      if (a < b) {
        ctx.frame.pc += signExtend16(ctx.frame.method.code!.insns[ctx.frame.pc + 1]);
      } else {
        ctx.frame.pc += 2;
      }
    },
  });

  // 0x35 - if-ge vA, vB, +CCCC
  table.register(0x35, {
    name: 'if-ge',
    format: '22t',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xf;
      const vB = (insn >> 12) & 0xf;
      const a = getIntValue(ctx.frame.registers[vA]);
      const b = getIntValue(ctx.frame.registers[vB]);
      if (a >= b) {
        ctx.frame.pc += signExtend16(ctx.frame.method.code!.insns[ctx.frame.pc + 1]);
      } else {
        ctx.frame.pc += 2;
      }
    },
  });

  // 0x36 - if-gt vA, vB, +CCCC
  table.register(0x36, {
    name: 'if-gt',
    format: '22t',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xf;
      const vB = (insn >> 12) & 0xf;
      const a = getIntValue(ctx.frame.registers[vA]);
      const b = getIntValue(ctx.frame.registers[vB]);
      if (a > b) {
        ctx.frame.pc += signExtend16(ctx.frame.method.code!.insns[ctx.frame.pc + 1]);
      } else {
        ctx.frame.pc += 2;
      }
    },
  });

  // 0x37 - if-le vA, vB, +CCCC
  table.register(0x37, {
    name: 'if-le',
    format: '22t',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xf;
      const vB = (insn >> 12) & 0xf;
      const a = getIntValue(ctx.frame.registers[vA]);
      const b = getIntValue(ctx.frame.registers[vB]);
      if (a <= b) {
        ctx.frame.pc += signExtend16(ctx.frame.method.code!.insns[ctx.frame.pc + 1]);
      } else {
        ctx.frame.pc += 2;
      }
    },
  });

  // 0x38 - if-eqz vAA, +BBBB
  table.register(0x38, {
    name: 'if-eqz',
    format: '21t',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const val = getIntValue(ctx.frame.registers[vA]);
      if (val === 0) {
        ctx.frame.pc += signExtend16(ctx.frame.method.code!.insns[ctx.frame.pc + 1]);
      } else {
        ctx.frame.pc += 2;
      }
    },
  });

  // 0x39 - if-nez vAA, +BBBB
  table.register(0x39, {
    name: 'if-nez',
    format: '21t',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const val = getIntValue(ctx.frame.registers[vA]);
      if (val !== 0) {
        ctx.frame.pc += signExtend16(ctx.frame.method.code!.insns[ctx.frame.pc + 1]);
      } else {
        ctx.frame.pc += 2;
      }
    },
  });

  // 0x3a - if-ltz vAA, +BBBB
  table.register(0x3a, {
    name: 'if-ltz',
    format: '21t',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const val = getIntValue(ctx.frame.registers[vA]);
      if (val < 0) {
        ctx.frame.pc += signExtend16(ctx.frame.method.code!.insns[ctx.frame.pc + 1]);
      } else {
        ctx.frame.pc += 2;
      }
    },
  });

  // 0x3b - if-gez vAA, +BBBB
  table.register(0x3b, {
    name: 'if-gez',
    format: '21t',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const val = getIntValue(ctx.frame.registers[vA]);
      if (val >= 0) {
        ctx.frame.pc += signExtend16(ctx.frame.method.code!.insns[ctx.frame.pc + 1]);
      } else {
        ctx.frame.pc += 2;
      }
    },
  });

  // 0x3c - if-gtz vAA, +BBBB
  table.register(0x3c, {
    name: 'if-gtz',
    format: '21t',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const val = getIntValue(ctx.frame.registers[vA]);
      if (val > 0) {
        ctx.frame.pc += signExtend16(ctx.frame.method.code!.insns[ctx.frame.pc + 1]);
      } else {
        ctx.frame.pc += 2;
      }
    },
  });

  // 0x3d - if-lez vAA, +BBBB
  table.register(0x3d, {
    name: 'if-lez',
    format: '21t',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const val = getIntValue(ctx.frame.registers[vA]);
      if (val <= 0) {
        ctx.frame.pc += signExtend16(ctx.frame.method.code!.insns[ctx.frame.pc + 1]);
      } else {
        ctx.frame.pc += 2;
      }
    },
  });

  // 0x44 - aget vAA, vBB, vCC
  table.register(0x44, {
    name: 'aget',
    format: '23x',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const vB = code[ctx.frame.pc + 1] & 0xff;
      const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
      const arrRef = ctx.frame.registers[vB];
      if (arrRef.type === 'null') throw new NullPointerException('aget on null');
      const index = getIntValue(ctx.frame.registers[vC]);
      ctx.frame.registers[vA] = ctx.heap.getArrayElement(
        (arrRef as { type: 'object'; ref: number }).ref, index
      );
      ctx.frame.pc += 2;
    },
  });

  // 0x45 - aget-wide vAA, vBB, vCC
  table.register(0x45, {
    name: 'aget-wide',
    format: '23x',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const vB = code[ctx.frame.pc + 1] & 0xff;
      const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
      const arrRef = ctx.frame.registers[vB];
      if (arrRef.type === 'null') throw new NullPointerException('aget-wide on null');
      const index = getIntValue(ctx.frame.registers[vC]);
      ctx.frame.registers[vA] = ctx.heap.getArrayElement(
        (arrRef as { type: 'object'; ref: number }).ref, index
      );
      ctx.frame.pc += 2;
    },
  });

  // 0x46 - aget-object vAA, vBB, vCC
  table.register(0x46, {
    name: 'aget-object',
    format: '23x',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const vB = code[ctx.frame.pc + 1] & 0xff;
      const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
      const arrRef = ctx.frame.registers[vB];
      if (arrRef.type === 'null') throw new NullPointerException('aget-object on null');
      const index = getIntValue(ctx.frame.registers[vC]);
      ctx.frame.registers[vA] = ctx.heap.getArrayElement(
        (arrRef as { type: 'object'; ref: number }).ref, index
      );
      ctx.frame.pc += 2;
    },
  });

  // 0x47 - aget-boolean vAA, vBB, vCC
  table.register(0x47, {
    name: 'aget-boolean',
    format: '23x',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const vB = code[ctx.frame.pc + 1] & 0xff;
      const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
      const arrRef = ctx.frame.registers[vB];
      if (arrRef.type === 'null') throw new NullPointerException('aget-boolean on null');
      const index = getIntValue(ctx.frame.registers[vC]);
      ctx.frame.registers[vA] = ctx.heap.getArrayElement(
        (arrRef as { type: 'object'; ref: number }).ref, index
      );
      ctx.frame.pc += 2;
    },
  });

  // 0x48 - aget-byte vAA, vBB, vCC
  table.register(0x48, {
    name: 'aget-byte',
    format: '23x',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const vB = code[ctx.frame.pc + 1] & 0xff;
      const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
      const arrRef = ctx.frame.registers[vB];
      if (arrRef.type === 'null') throw new NullPointerException('aget-byte on null');
      const index = getIntValue(ctx.frame.registers[vC]);
      ctx.frame.registers[vA] = ctx.heap.getArrayElement(
        (arrRef as { type: 'object'; ref: number }).ref, index
      );
      ctx.frame.pc += 2;
    },
  });

  // 0x49 - aget-char vAA, vBB, vCC
  table.register(0x49, {
    name: 'aget-char',
    format: '23x',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const vB = code[ctx.frame.pc + 1] & 0xff;
      const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
      const arrRef = ctx.frame.registers[vB];
      if (arrRef.type === 'null') throw new NullPointerException('aget-char on null');
      const index = getIntValue(ctx.frame.registers[vC]);
      ctx.frame.registers[vA] = ctx.heap.getArrayElement(
        (arrRef as { type: 'object'; ref: number }).ref, index
      );
      ctx.frame.pc += 2;
    },
  });

  // 0x4a - aget-short vAA, vBB, vCC
  table.register(0x4a, {
    name: 'aget-short',
    format: '23x',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const vB = code[ctx.frame.pc + 1] & 0xff;
      const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
      const arrRef = ctx.frame.registers[vB];
      if (arrRef.type === 'null') throw new NullPointerException('aget-short on null');
      const index = getIntValue(ctx.frame.registers[vC]);
      ctx.frame.registers[vA] = ctx.heap.getArrayElement(
        (arrRef as { type: 'object'; ref: number }).ref, index
      );
      ctx.frame.pc += 2;
    },
  });

  // 0x4b - aput vAA, vBB, vCC
  table.register(0x4b, {
    name: 'aput',
    format: '23x',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const vB = code[ctx.frame.pc + 1] & 0xff;
      const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
      const arrRef = ctx.frame.registers[vB];
      if (arrRef.type === 'null') throw new NullPointerException('aput on null');
      const index = getIntValue(ctx.frame.registers[vC]);
      ctx.heap.setArrayElement(
        (arrRef as { type: 'object'; ref: number }).ref, index, ctx.frame.registers[vA]
      );
      ctx.frame.pc += 2;
    },
  });

  // 0x4c - aput-wide vAA, vBB, vCC
  table.register(0x4c, {
    name: 'aput-wide',
    format: '23x',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const vB = code[ctx.frame.pc + 1] & 0xff;
      const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
      const arrRef = ctx.frame.registers[vB];
      if (arrRef.type === 'null') throw new NullPointerException('aput-wide on null');
      const index = getIntValue(ctx.frame.registers[vC]);
      ctx.heap.setArrayElement(
        (arrRef as { type: 'object'; ref: number }).ref, index, ctx.frame.registers[vA]
      );
      ctx.frame.pc += 2;
    },
  });

  // 0x4d - aput-object vAA, vBB, vCC
  table.register(0x4d, {
    name: 'aput-object',
    format: '23x',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const vB = code[ctx.frame.pc + 1] & 0xff;
      const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
      const arrRef = ctx.frame.registers[vB];
      if (arrRef.type === 'null') throw new NullPointerException('aput-object on null');
      const index = getIntValue(ctx.frame.registers[vC]);
      ctx.heap.setArrayElement(
        (arrRef as { type: 'object'; ref: number }).ref, index, ctx.frame.registers[vA]
      );
      ctx.frame.pc += 2;
    },
  });

  // 0x4e - aput-boolean vAA, vBB, vCC
  table.register(0x4e, {
    name: 'aput-boolean',
    format: '23x',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const vB = code[ctx.frame.pc + 1] & 0xff;
      const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
      const arrRef = ctx.frame.registers[vB];
      if (arrRef.type === 'null') throw new NullPointerException('aput-boolean on null');
      const index = getIntValue(ctx.frame.registers[vC]);
      ctx.heap.setArrayElement(
        (arrRef as { type: 'object'; ref: number }).ref, index, ctx.frame.registers[vA]
      );
      ctx.frame.pc += 2;
    },
  });

  // 0x4f - aput-byte vAA, vBB, vCC
  table.register(0x4f, {
    name: 'aput-byte',
    format: '23x',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const vB = code[ctx.frame.pc + 1] & 0xff;
      const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
      const arrRef = ctx.frame.registers[vB];
      if (arrRef.type === 'null') throw new NullPointerException('aput-byte on null');
      const index = getIntValue(ctx.frame.registers[vC]);
      ctx.heap.setArrayElement(
        (arrRef as { type: 'object'; ref: number }).ref, index, ctx.frame.registers[vA]
      );
      ctx.frame.pc += 2;
    },
  });

  // 0x50 - aput-char vAA, vBB, vCC
  table.register(0x50, {
    name: 'aput-char',
    format: '23x',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const vB = code[ctx.frame.pc + 1] & 0xff;
      const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
      const arrRef = ctx.frame.registers[vB];
      if (arrRef.type === 'null') throw new NullPointerException('aput-char on null');
      const index = getIntValue(ctx.frame.registers[vC]);
      ctx.heap.setArrayElement(
        (arrRef as { type: 'object'; ref: number }).ref, index, ctx.frame.registers[vA]
      );
      ctx.frame.pc += 2;
    },
  });

  // 0x51 - aput-short vAA, vBB, vCC
  table.register(0x51, {
    name: 'aput-short',
    format: '23x',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const vB = code[ctx.frame.pc + 1] & 0xff;
      const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
      const arrRef = ctx.frame.registers[vB];
      if (arrRef.type === 'null') throw new NullPointerException('aput-short on null');
      const index = getIntValue(ctx.frame.registers[vC]);
      ctx.heap.setArrayElement(
        (arrRef as { type: 'object'; ref: number }).ref, index, ctx.frame.registers[vA]
      );
      ctx.frame.pc += 2;
    },
  });

  // 0x52 - iget vA, vB, field@CCCC
  table.register(0x52, {
    name: 'iget',
    format: '22c',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xf;
      const vB = (insn >> 12) & 0xf;
      const code = ctx.frame.method.code!.insns;
      const fieldIdx = code[ctx.frame.pc + 1];

      const field = ctx.classLoader.resolveField(fieldIdx);
      const objRef = ctx.frame.registers[vB];

      if (objRef.type === 'null') {
        throw new NullPointerException('iget on null reference');
      }

      const value = ctx.heap.getField(
        (objRef as { type: 'object'; ref: number }).ref,
        field.name
      );
      ctx.frame.registers[vA] = value;
      ctx.frame.pc += 2;
    },
  });

  // 0x54 - iget-object vA, vB, field@CCCC
  table.register(0x54, {
    name: 'iget-object',
    format: '22c',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xf;
      const vB = (insn >> 12) & 0xf;
      const code = ctx.frame.method.code!.insns;
      const fieldIdx = code[ctx.frame.pc + 1];

      const field = ctx.classLoader.resolveField(fieldIdx);
      const objRef = ctx.frame.registers[vB];

      if (objRef.type === 'null') {
        throw new NullPointerException('iget-object on null reference');
      }

      const value = ctx.heap.getField(
        (objRef as { type: 'object'; ref: number }).ref,
        field.name
      );
      ctx.frame.registers[vA] = value;
      ctx.frame.pc += 2;
    },
  });

  // 0x59 - iput vA, vB, field@CCCC
  table.register(0x59, {
    name: 'iput',
    format: '22c',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xf;
      const vB = (insn >> 12) & 0xf;
      const code = ctx.frame.method.code!.insns;
      const fieldIdx = code[ctx.frame.pc + 1];

      const field = ctx.classLoader.resolveField(fieldIdx);
      const objRef = ctx.frame.registers[vB];

      if (objRef.type === 'null') {
        throw new NullPointerException('iput on null reference');
      }

      ctx.heap.setField(
        (objRef as { type: 'object'; ref: number }).ref,
        field.name,
        ctx.frame.registers[vA]
      );
      ctx.frame.pc += 2;
    },
  });

  // 0x5b - iput-object vA, vB, field@CCCC
  table.register(0x5b, {
    name: 'iput-object',
    format: '22c',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xf;
      const vB = (insn >> 12) & 0xf;
      const code = ctx.frame.method.code!.insns;
      const fieldIdx = code[ctx.frame.pc + 1];

      const field = ctx.classLoader.resolveField(fieldIdx);
      const objRef = ctx.frame.registers[vB];

      if (objRef.type === 'null') {
        throw new NullPointerException('iput-object on null reference');
      }

      ctx.heap.setField(
        (objRef as { type: 'object'; ref: number }).ref,
        field.name,
        ctx.frame.registers[vA]
      );
      ctx.frame.pc += 2;
    },
  });

  // 0x60 - sget vAA, field@BBBB
  table.register(0x60, {
    name: 'sget',
    format: '21c',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const fieldIdx = code[ctx.frame.pc + 1];

      const field = ctx.classLoader.resolveField(fieldIdx);
      ctx.classLoader.initializeClass(field.classDescriptor);

      const value = ctx.classLoader.getStaticField(field);
      ctx.frame.registers[vA] = value;
      ctx.frame.pc += 2;
    },
  });

  // 0x62 - sget-object vAA, field@BBBB
  table.register(0x62, {
    name: 'sget-object',
    format: '21c',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const fieldIdx = code[ctx.frame.pc + 1];

      const field = ctx.classLoader.resolveField(fieldIdx);
      ctx.classLoader.initializeClass(field.classDescriptor);

      const value = ctx.classLoader.getStaticField(field);
      ctx.frame.registers[vA] = value;
      ctx.frame.pc += 2;
    },
  });

  // 0x67 - sput vAA, field@BBBB
  table.register(0x67, {
    name: 'sput',
    format: '21c',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const fieldIdx = code[ctx.frame.pc + 1];

      const field = ctx.classLoader.resolveField(fieldIdx);
      ctx.classLoader.initializeClass(field.classDescriptor);

      ctx.classLoader.setStaticField(field, ctx.frame.registers[vA]);
      ctx.frame.pc += 2;
    },
  });

  // 0x69 - sput-object vAA, field@BBBB
  table.register(0x69, {
    name: 'sput-object',
    format: '21c',
    width: 2,
    handler: (ctx, insn) => {
      const vA = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const fieldIdx = code[ctx.frame.pc + 1];

      const field = ctx.classLoader.resolveField(fieldIdx);
      ctx.classLoader.initializeClass(field.classDescriptor);

      ctx.classLoader.setStaticField(field, ctx.frame.registers[vA]);
      ctx.frame.pc += 2;
    },
  });

  // 0x6e - invoke-virtual {vC, vD, vE, vF, vG}, meth@BBBB
  table.register(0x6e, {
    name: 'invoke-virtual',
    format: '35c',
    width: 3,
    handler: (ctx, insn) => {
      const code = ctx.frame.method.code!.insns;
      const methodIdx = code[ctx.frame.pc + 1];
      const regWord = code[ctx.frame.pc + 2];
      const regs = getRegisters_35c(insn, regWord);

      const thisRef = ctx.frame.registers[regs[0]];
      if (thisRef.type === 'null') {
        throw new NullPointerException('invoke-virtual on null');
      }

      const method = ctx.classLoader.resolveVirtualMethod(
        (thisRef as { type: 'object'; ref: number }).ref,
        methodIdx
      );

      const args = regs.map((r) => ctx.frame.registers[r]);
      ctx.frame.pc += 3;
      ctx.interpreter.invokeMethod(method, args);
    },
  });

  // 0x6f - invoke-super {vC, vD, vE, vF, vG}, meth@BBBB
  table.register(0x6f, {
    name: 'invoke-super',
    format: '35c',
    width: 3,
    handler: (ctx, insn) => {
      const code = ctx.frame.method.code!.insns;
      const methodIdx = code[ctx.frame.pc + 1];
      const regWord = code[ctx.frame.pc + 2];
      const regs = getRegisters_35c(insn, regWord);

      const method = ctx.classLoader.resolveSuperMethod(
        ctx.frame.method.classDescriptor,
        methodIdx
      );

      const args = regs.map((r) => ctx.frame.registers[r]);
      ctx.frame.pc += 3;
      ctx.interpreter.invokeMethod(method, args);
    },
  });

  // 0x70 - invoke-direct {vC, vD, vE, vF, vG}, meth@BBBB
  table.register(0x70, {
    name: 'invoke-direct',
    format: '35c',
    width: 3,
    handler: (ctx, insn) => {
      const code = ctx.frame.method.code!.insns;
      const methodIdx = code[ctx.frame.pc + 1];
      const regWord = code[ctx.frame.pc + 2];
      const regs = getRegisters_35c(insn, regWord);

      const method = ctx.classLoader.resolveMethod(methodIdx);

      const args = regs.map((r) => ctx.frame.registers[r]);
      ctx.frame.pc += 3;
      ctx.interpreter.invokeMethod(method, args);
    },
  });

  // 0x71 - invoke-static {vC, vD, vE, vF, vG}, meth@BBBB
  table.register(0x71, {
    name: 'invoke-static',
    format: '35c',
    width: 3,
    handler: (ctx, insn) => {
      const code = ctx.frame.method.code!.insns;
      const methodIdx = code[ctx.frame.pc + 1];
      const regWord = code[ctx.frame.pc + 2];
      const regs = getRegisters_35c(insn, regWord);

      const method = ctx.classLoader.resolveMethod(methodIdx);
      ctx.classLoader.initializeClass(method.classDescriptor);

      const args = regs.map((r) => ctx.frame.registers[r]);
      ctx.frame.pc += 3;
      ctx.interpreter.invokeMethod(method, args);
    },
  });

  // 0x72 - invoke-interface {vC, vD, vE, vF, vG}, meth@BBBB
  table.register(0x72, {
    name: 'invoke-interface',
    format: '35c',
    width: 3,
    handler: (ctx, insn) => {
      const code = ctx.frame.method.code!.insns;
      const methodIdx = code[ctx.frame.pc + 1];
      const regWord = code[ctx.frame.pc + 2];
      const regs = getRegisters_35c(insn, regWord);

      const thisRef = ctx.frame.registers[regs[0]];
      if (thisRef.type === 'null') {
        throw new NullPointerException('invoke-interface on null');
      }

      const method = ctx.classLoader.resolveVirtualMethod(
        (thisRef as { type: 'object'; ref: number }).ref,
        methodIdx
      );

      const args = regs.map((r) => ctx.frame.registers[r]);
      ctx.frame.pc += 3;
      ctx.interpreter.invokeMethod(method, args);
    },
  });

  // 0x74 - invoke-virtual/range {vCCCC .. v(CCCC+AA-1)}, meth@BBBB
  table.register(0x74, {
    name: 'invoke-virtual/range',
    format: '3rc',
    width: 3,
    handler: (ctx, insn) => {
      const count = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const methodIdx = code[ctx.frame.pc + 1];
      const vC = code[ctx.frame.pc + 2];

      const thisRef = ctx.frame.registers[vC];
      if (thisRef.type === 'null') {
        throw new NullPointerException('invoke-virtual/range on null');
      }

      const method = ctx.classLoader.resolveVirtualMethod(
        (thisRef as { type: 'object'; ref: number }).ref,
        methodIdx
      );

      const args = ctx.frame.registers.slice(vC, vC + count);
      ctx.frame.pc += 3;
      ctx.interpreter.invokeMethod(method, args);
    },
  });

  // 0x75 - invoke-super/range {vCCCC .. v(CCCC+AA-1)}, meth@BBBB
  table.register(0x75, {
    name: 'invoke-super/range',
    format: '3rc',
    width: 3,
    handler: (ctx, insn) => {
      const count = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const methodIdx = code[ctx.frame.pc + 1];
      const vC = code[ctx.frame.pc + 2];

      const method = ctx.classLoader.resolveSuperMethod(
        ctx.frame.method.classDescriptor,
        methodIdx
      );

      const args = ctx.frame.registers.slice(vC, vC + count);
      ctx.frame.pc += 3;
      ctx.interpreter.invokeMethod(method, args);
    },
  });

  // 0x76 - invoke-direct/range {vCCCC .. v(CCCC+AA-1)}, meth@BBBB
  table.register(0x76, {
    name: 'invoke-direct/range',
    format: '3rc',
    width: 3,
    handler: (ctx, insn) => {
      const count = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const methodIdx = code[ctx.frame.pc + 1];
      const vC = code[ctx.frame.pc + 2];

      const method = ctx.classLoader.resolveMethod(methodIdx);

      const args = ctx.frame.registers.slice(vC, vC + count);
      ctx.frame.pc += 3;
      ctx.interpreter.invokeMethod(method, args);
    },
  });

  // 0x77 - invoke-static/range {vCCCC .. v(CCCC+AA-1)}, meth@BBBB
  table.register(0x77, {
    name: 'invoke-static/range',
    format: '3rc',
    width: 3,
    handler: (ctx, insn) => {
      const count = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const methodIdx = code[ctx.frame.pc + 1];
      const vC = code[ctx.frame.pc + 2];

      const method = ctx.classLoader.resolveMethod(methodIdx);
      ctx.classLoader.initializeClass(method.classDescriptor);

      const args = ctx.frame.registers.slice(vC, vC + count);
      ctx.frame.pc += 3;
      ctx.interpreter.invokeMethod(method, args);
    },
  });

  // 0x78 - invoke-interface/range {vCCCC .. v(CCCC+AA-1)}, meth@BBBB
  table.register(0x78, {
    name: 'invoke-interface/range',
    format: '3rc',
    width: 3,
    handler: (ctx, insn) => {
      const count = (insn >> 8) & 0xff;
      const code = ctx.frame.method.code!.insns;
      const methodIdx = code[ctx.frame.pc + 1];
      const vC = code[ctx.frame.pc + 2];

      const thisRef = ctx.frame.registers[vC];
      if (thisRef.type === 'null') {
        throw new NullPointerException('invoke-interface/range on null');
      }

      const method = ctx.classLoader.resolveVirtualMethod(
        (thisRef as { type: 'object'; ref: number }).ref,
        methodIdx
      );

      const args = ctx.frame.registers.slice(vC, vC + count);
      ctx.frame.pc += 3;
      ctx.interpreter.invokeMethod(method, args);
    },
  });
}
