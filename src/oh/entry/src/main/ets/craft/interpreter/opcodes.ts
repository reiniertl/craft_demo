/**
 * CRAFT - Essential Opcode Implementations
 * All 28 opcodes needed for basic Dalvik bytecode execution.
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

  // 0x07 - move-object vA, vB
  table.register(0x07, {
    name: 'move-object',
    format: '12x',
    width: 1,
    handler: (ctx, insn) => {
      const vA = getRegA_12x(insn);
      const vB = getRegB_12x(insn);
      const val = ctx.frame.registers[vB];
      ctx.frame.registers[vA] = val;
      ctx.frame.pc += 1;
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
}
