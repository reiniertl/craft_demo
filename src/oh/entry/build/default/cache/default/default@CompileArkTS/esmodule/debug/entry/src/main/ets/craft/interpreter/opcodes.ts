import { getRegA_12x, getRegB_12x, getLiteral_11n, getRegisters_35c, signExtend16, } from "@bundle:com.craft.runtime/entry/ets/craft/interpreter/opcode_table";
import type { OpcodeTable } from "@bundle:com.craft.runtime/entry/ets/craft/interpreter/opcode_table";
import { InterpreterError, NullPointerException } from "@bundle:com.craft.runtime/entry/ets/craft/interpreter/errors";
/** Helper: get numeric value from a register (int or float bits) */
function getIntValue(v: {
    type: string;
    value?: number | bigint;
    ref?: number;
}): number {
    if (v.type === 'int')
        return (v as {
            type: 'int';
            value: number;
        }).value;
    if (v.type === 'float')
        return (v as {
            type: 'float';
            value: number;
        }).value;
    if (v.type === 'null')
        return 0;
    if (v.type === 'object')
        return (v as {
            type: 'object';
            ref: number;
        }).ref;
    return 0;
}
/** Helper: get long (bigint) value from a register */
function getLongValue(v: {
    type: string;
    value?: number | bigint;
    ref?: number;
}): bigint {
    if (v.type === 'long')
        return (v as {
            type: 'long';
            value: bigint;
        }).value;
    if (v.type === 'int')
        return BigInt((v as {
            type: 'int';
            value: number;
        }).value);
    return 0n;
}
/** Helper: get float value from a register */
function getFloatValue(v: {
    type: string;
    value?: number | bigint;
    ref?: number;
}): number {
    if (v.type === 'float')
        return (v as {
            type: 'float';
            value: number;
        }).value;
    if (v.type === 'int')
        return (v as {
            type: 'int';
            value: number;
        }).value;
    return 0;
}
/** Helper: get double value from a register */
function getDoubleValue(v: {
    type: string;
    value?: number | bigint;
    ref?: number;
}): number {
    if (v.type === 'double')
        return (v as {
            type: 'double';
            value: number;
        }).value;
    if (v.type === 'float')
        return (v as {
            type: 'float';
            value: number;
        }).value;
    if (v.type === 'int')
        return (v as {
            type: 'int';
            value: number;
        }).value;
    return 0;
}
/** Helper: truncate float to 32-bit precision */
function fround(v: number): number {
    return Math.fround(v);
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
            const obj = ctx.heap.getObject((objRef as {
                type: 'object';
                ref: number;
            }).ref);
            if (!obj) {
                throw new NullPointerException('check-cast on invalid object reference');
            }
            const isInstance = ctx.classLoader.isInstanceOf(obj.classDescriptor, targetType);
            if (!isInstance) {
                throw new InterpreterError(`ClassCastException: ${obj.classDescriptor} cannot be cast to ${targetType}`);
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
            const obj = ctx.heap.getObject((objRef as {
                type: 'object';
                ref: number;
            }).ref);
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
            const length = ctx.heap.getArrayLength((arrRef as {
                type: 'object';
                ref: number;
            }).ref);
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
    // 0x1d - monitor-enter vAA (no-op in single-threaded runtime)
    table.register(0x1d, {
        name: 'monitor-enter',
        format: '11x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const objRef = ctx.frame.registers[vA];
            if (objRef.type === 'null') {
                throw new NullPointerException('monitor-enter on null');
            }
            ctx.frame.pc += 1;
        },
    });
    // 0x1e - monitor-exit vAA (no-op in single-threaded runtime)
    table.register(0x1e, {
        name: 'monitor-exit',
        format: '11x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const objRef = ctx.frame.registers[vA];
            if (objRef.type === 'null') {
                throw new NullPointerException('monitor-exit on null');
            }
            ctx.frame.pc += 1;
        },
    });
    // 0x24 - filled-new-array {vC, vD, vE, vF, vG}, type@BBBB
    table.register(0x24, {
        name: 'filled-new-array',
        format: '35c',
        width: 3,
        handler: (ctx, insn) => {
            const code = ctx.frame.method.code!.insns;
            const typeIdx = code[ctx.frame.pc + 1];
            const regWord = code[ctx.frame.pc + 2];
            const regs = getRegisters_35c(insn, regWord);
            const typeDescriptor = ctx.dex.getTypeName(typeIdx);
            const elementType = typeDescriptor.substring(1);
            const ref = ctx.heap.allocateArray(elementType, regs.length);
            for (let i = 0; i < regs.length; i++) {
                ctx.heap.setArrayElement(ref, i, ctx.frame.registers[regs[i]]);
            }
            ctx.interpreter.returnFromMethod({ type: 'object', ref });
            ctx.frame.pc += 3;
        },
    });
    // 0x25 - filled-new-array/range {vCCCC .. v(CCCC+AA-1)}, type@BBBB
    table.register(0x25, {
        name: 'filled-new-array/range',
        format: '3rc',
        width: 3,
        handler: (ctx, insn) => {
            const count = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const typeIdx = code[ctx.frame.pc + 1];
            const vC = code[ctx.frame.pc + 2];
            const typeDescriptor = ctx.dex.getTypeName(typeIdx);
            const elementType = typeDescriptor.substring(1);
            const ref = ctx.heap.allocateArray(elementType, count);
            for (let i = 0; i < count; i++) {
                ctx.heap.setArrayElement(ref, i, ctx.frame.registers[vC + i]);
            }
            ctx.interpreter.returnFromMethod({ type: 'object', ref });
            ctx.frame.pc += 3;
        },
    });
    // 0x26 - fill-array-data vAA, +BBBBBBBB
    table.register(0x26, {
        name: 'fill-array-data',
        format: '31t',
        width: 3,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const low = code[ctx.frame.pc + 1];
            const high = code[ctx.frame.pc + 2];
            const offset = signExtend32(low, high);
            const payloadPC = ctx.frame.pc + offset;
            // Payload format: ident(0x0300), element_width(16), size(32), data...
            const elementWidth = code[payloadPC + 1];
            const sizeLow = code[payloadPC + 2];
            const sizeHigh = code[payloadPC + 3];
            const size = (sizeHigh << 16) | sizeLow;
            const arrRef = ctx.frame.registers[vA];
            if (arrRef.type === 'null')
                throw new NullPointerException('fill-array-data on null');
            const ref = (arrRef as {
                type: 'object';
                ref: number;
            }).ref;
            let dataOffset = payloadPC + 4;
            for (let i = 0; i < size; i++) {
                let value = 0;
                if (elementWidth === 1) {
                    // Byte: packed 2 per 16-bit word
                    const wordIdx = dataOffset + Math.floor(i / 2);
                    value = (i % 2 === 0) ? (code[wordIdx] & 0xff) : ((code[wordIdx] >> 8) & 0xff);
                    value = (value << 24) >> 24; // sign extend
                }
                else if (elementWidth === 2) {
                    value = signExtend16(code[dataOffset + i]);
                }
                else if (elementWidth === 4) {
                    const lo = code[dataOffset + i * 2];
                    const hi = code[dataOffset + i * 2 + 1];
                    value = ((hi << 16) | lo) | 0;
                }
                ctx.heap.setArrayElement(ref, i, { type: 'int', value });
            }
            ctx.frame.pc += 3;
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
            const obj = ctx.heap.getObject((exRef as {
                type: 'object';
                ref: number;
            }).ref);
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
    // 0x2b - packed-switch vAA, +BBBBBBBB
    table.register(0x2b, {
        name: 'packed-switch',
        format: '31t',
        width: 3,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const low = code[ctx.frame.pc + 1];
            const high = code[ctx.frame.pc + 2];
            const offset = signExtend32(low, high);
            const payloadPC = ctx.frame.pc + offset;
            // Payload: ident(0x0100), size(16), first_key(32), targets(32 each)
            const size = code[payloadPC + 1];
            const firstKeyLow = code[payloadPC + 2];
            const firstKeyHigh = code[payloadPC + 3];
            const firstKey = signExtend32(firstKeyLow, firstKeyHigh);
            const testVal = getIntValue(ctx.frame.registers[vA]);
            const index = testVal - firstKey;
            if (index >= 0 && index < size) {
                const targetBase = payloadPC + 4;
                const targetLow = code[targetBase + index * 2];
                const targetHigh = code[targetBase + index * 2 + 1];
                const target = signExtend32(targetLow, targetHigh);
                ctx.frame.pc += target;
            }
            else {
                ctx.frame.pc += 3;
            }
        },
    });
    // 0x2c - sparse-switch vAA, +BBBBBBBB
    table.register(0x2c, {
        name: 'sparse-switch',
        format: '31t',
        width: 3,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const low = code[ctx.frame.pc + 1];
            const high = code[ctx.frame.pc + 2];
            const offset = signExtend32(low, high);
            const payloadPC = ctx.frame.pc + offset;
            // Payload: ident(0x0200), size(16), keys(32 each), targets(32 each)
            const size = code[payloadPC + 1];
            const testVal = getIntValue(ctx.frame.registers[vA]);
            const keysBase = payloadPC + 2;
            const targetsBase = keysBase + size * 2;
            let matched = false;
            for (let i = 0; i < size; i++) {
                const keyLow = code[keysBase + i * 2];
                const keyHigh = code[keysBase + i * 2 + 1];
                const key = signExtend32(keyLow, keyHigh);
                if (key === testVal) {
                    const targetLow = code[targetsBase + i * 2];
                    const targetHigh = code[targetsBase + i * 2 + 1];
                    const target = signExtend32(targetLow, targetHigh);
                    ctx.frame.pc += target;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                ctx.frame.pc += 3;
            }
        },
    });
    // ─── Comparison Opcodes ───
    // 0x2d - cmpl-float vAA, vBB, vCC (NaN → -1)
    table.register(0x2d, {
        name: 'cmpl-float',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getFloatValue(ctx.frame.registers[vB]);
            const c = getFloatValue(ctx.frame.registers[vC]);
            let result: number;
            if (isNaN(b) || isNaN(c)) {
                result = -1;
            }
            else if (b > c) {
                result = 1;
            }
            else if (b === c) {
                result = 0;
            }
            else {
                result = -1;
            }
            ctx.frame.registers[vA] = { type: 'int', value: result };
            ctx.frame.pc += 2;
        },
    });
    // 0x2e - cmpg-float vAA, vBB, vCC (NaN → 1)
    table.register(0x2e, {
        name: 'cmpg-float',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getFloatValue(ctx.frame.registers[vB]);
            const c = getFloatValue(ctx.frame.registers[vC]);
            let result: number;
            if (isNaN(b) || isNaN(c)) {
                result = 1;
            }
            else if (b > c) {
                result = 1;
            }
            else if (b === c) {
                result = 0;
            }
            else {
                result = -1;
            }
            ctx.frame.registers[vA] = { type: 'int', value: result };
            ctx.frame.pc += 2;
        },
    });
    // 0x2f - cmpl-double vAA, vBB, vCC (NaN → -1)
    table.register(0x2f, {
        name: 'cmpl-double',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getDoubleValue(ctx.frame.registers[vB]);
            const c = getDoubleValue(ctx.frame.registers[vC]);
            let result: number;
            if (isNaN(b) || isNaN(c)) {
                result = -1;
            }
            else if (b > c) {
                result = 1;
            }
            else if (b === c) {
                result = 0;
            }
            else {
                result = -1;
            }
            ctx.frame.registers[vA] = { type: 'int', value: result };
            ctx.frame.pc += 2;
        },
    });
    // 0x30 - cmpg-double vAA, vBB, vCC (NaN → 1)
    table.register(0x30, {
        name: 'cmpg-double',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getDoubleValue(ctx.frame.registers[vB]);
            const c = getDoubleValue(ctx.frame.registers[vC]);
            let result: number;
            if (isNaN(b) || isNaN(c)) {
                result = 1;
            }
            else if (b > c) {
                result = 1;
            }
            else if (b === c) {
                result = 0;
            }
            else {
                result = -1;
            }
            ctx.frame.registers[vA] = { type: 'int', value: result };
            ctx.frame.pc += 2;
        },
    });
    // 0x31 - cmp-long vAA, vBB, vCC
    table.register(0x31, {
        name: 'cmp-long',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getLongValue(ctx.frame.registers[vB]);
            const c = getLongValue(ctx.frame.registers[vC]);
            let result: number;
            if (b > c)
                result = 1;
            else if (b === c)
                result = 0;
            else
                result = -1;
            ctx.frame.registers[vA] = { type: 'int', value: result };
            ctx.frame.pc += 2;
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
            }
            else {
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
            }
            else {
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
            }
            else {
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
            }
            else {
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
            }
            else {
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
            }
            else {
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
            }
            else {
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
            }
            else {
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
            }
            else {
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
            }
            else {
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
            }
            else {
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
            }
            else {
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
            if (arrRef.type === 'null')
                throw new NullPointerException('aget on null');
            const index = getIntValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = ctx.heap.getArrayElement((arrRef as {
                type: 'object';
                ref: number;
            }).ref, index);
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
            if (arrRef.type === 'null')
                throw new NullPointerException('aget-wide on null');
            const index = getIntValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = ctx.heap.getArrayElement((arrRef as {
                type: 'object';
                ref: number;
            }).ref, index);
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
            if (arrRef.type === 'null')
                throw new NullPointerException('aget-object on null');
            const index = getIntValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = ctx.heap.getArrayElement((arrRef as {
                type: 'object';
                ref: number;
            }).ref, index);
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
            if (arrRef.type === 'null')
                throw new NullPointerException('aget-boolean on null');
            const index = getIntValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = ctx.heap.getArrayElement((arrRef as {
                type: 'object';
                ref: number;
            }).ref, index);
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
            if (arrRef.type === 'null')
                throw new NullPointerException('aget-byte on null');
            const index = getIntValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = ctx.heap.getArrayElement((arrRef as {
                type: 'object';
                ref: number;
            }).ref, index);
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
            if (arrRef.type === 'null')
                throw new NullPointerException('aget-char on null');
            const index = getIntValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = ctx.heap.getArrayElement((arrRef as {
                type: 'object';
                ref: number;
            }).ref, index);
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
            if (arrRef.type === 'null')
                throw new NullPointerException('aget-short on null');
            const index = getIntValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = ctx.heap.getArrayElement((arrRef as {
                type: 'object';
                ref: number;
            }).ref, index);
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
            if (arrRef.type === 'null')
                throw new NullPointerException('aput on null');
            const index = getIntValue(ctx.frame.registers[vC]);
            ctx.heap.setArrayElement((arrRef as {
                type: 'object';
                ref: number;
            }).ref, index, ctx.frame.registers[vA]);
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
            if (arrRef.type === 'null')
                throw new NullPointerException('aput-wide on null');
            const index = getIntValue(ctx.frame.registers[vC]);
            ctx.heap.setArrayElement((arrRef as {
                type: 'object';
                ref: number;
            }).ref, index, ctx.frame.registers[vA]);
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
            if (arrRef.type === 'null')
                throw new NullPointerException('aput-object on null');
            const index = getIntValue(ctx.frame.registers[vC]);
            ctx.heap.setArrayElement((arrRef as {
                type: 'object';
                ref: number;
            }).ref, index, ctx.frame.registers[vA]);
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
            if (arrRef.type === 'null')
                throw new NullPointerException('aput-boolean on null');
            const index = getIntValue(ctx.frame.registers[vC]);
            ctx.heap.setArrayElement((arrRef as {
                type: 'object';
                ref: number;
            }).ref, index, ctx.frame.registers[vA]);
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
            if (arrRef.type === 'null')
                throw new NullPointerException('aput-byte on null');
            const index = getIntValue(ctx.frame.registers[vC]);
            ctx.heap.setArrayElement((arrRef as {
                type: 'object';
                ref: number;
            }).ref, index, ctx.frame.registers[vA]);
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
            if (arrRef.type === 'null')
                throw new NullPointerException('aput-char on null');
            const index = getIntValue(ctx.frame.registers[vC]);
            ctx.heap.setArrayElement((arrRef as {
                type: 'object';
                ref: number;
            }).ref, index, ctx.frame.registers[vA]);
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
            if (arrRef.type === 'null')
                throw new NullPointerException('aput-short on null');
            const index = getIntValue(ctx.frame.registers[vC]);
            ctx.heap.setArrayElement((arrRef as {
                type: 'object';
                ref: number;
            }).ref, index, ctx.frame.registers[vA]);
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
            const value = ctx.heap.getField((objRef as {
                type: 'object';
                ref: number;
            }).ref, field.name);
            ctx.frame.registers[vA] = value;
            ctx.frame.pc += 2;
        },
    });
    // 0x53 - iget-wide vA, vB, field@CCCC
    table.register(0x53, {
        name: 'iget-wide',
        format: '22c',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const fieldIdx = code[ctx.frame.pc + 1];
            const field = ctx.classLoader.resolveField(fieldIdx);
            const objRef = ctx.frame.registers[vB];
            if (objRef.type === 'null')
                throw new NullPointerException('iget-wide on null reference');
            const value = ctx.heap.getField((objRef as {
                type: 'object';
                ref: number;
            }).ref, field.name);
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
            const value = ctx.heap.getField((objRef as {
                type: 'object';
                ref: number;
            }).ref, field.name);
            ctx.frame.registers[vA] = value;
            ctx.frame.pc += 2;
        },
    });
    // 0x55 - iget-boolean vA, vB, field@CCCC
    table.register(0x55, {
        name: 'iget-boolean',
        format: '22c',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const fieldIdx = code[ctx.frame.pc + 1];
            const field = ctx.classLoader.resolveField(fieldIdx);
            const objRef = ctx.frame.registers[vB];
            if (objRef.type === 'null')
                throw new NullPointerException('iget-boolean on null reference');
            ctx.frame.registers[vA] = ctx.heap.getField((objRef as {
                type: 'object';
                ref: number;
            }).ref, field.name);
            ctx.frame.pc += 2;
        },
    });
    // 0x56 - iget-byte vA, vB, field@CCCC
    table.register(0x56, {
        name: 'iget-byte',
        format: '22c',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const fieldIdx = code[ctx.frame.pc + 1];
            const field = ctx.classLoader.resolveField(fieldIdx);
            const objRef = ctx.frame.registers[vB];
            if (objRef.type === 'null')
                throw new NullPointerException('iget-byte on null reference');
            ctx.frame.registers[vA] = ctx.heap.getField((objRef as {
                type: 'object';
                ref: number;
            }).ref, field.name);
            ctx.frame.pc += 2;
        },
    });
    // 0x57 - iget-char vA, vB, field@CCCC
    table.register(0x57, {
        name: 'iget-char',
        format: '22c',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const fieldIdx = code[ctx.frame.pc + 1];
            const field = ctx.classLoader.resolveField(fieldIdx);
            const objRef = ctx.frame.registers[vB];
            if (objRef.type === 'null')
                throw new NullPointerException('iget-char on null reference');
            ctx.frame.registers[vA] = ctx.heap.getField((objRef as {
                type: 'object';
                ref: number;
            }).ref, field.name);
            ctx.frame.pc += 2;
        },
    });
    // 0x58 - iget-short vA, vB, field@CCCC
    table.register(0x58, {
        name: 'iget-short',
        format: '22c',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const fieldIdx = code[ctx.frame.pc + 1];
            const field = ctx.classLoader.resolveField(fieldIdx);
            const objRef = ctx.frame.registers[vB];
            if (objRef.type === 'null')
                throw new NullPointerException('iget-short on null reference');
            ctx.frame.registers[vA] = ctx.heap.getField((objRef as {
                type: 'object';
                ref: number;
            }).ref, field.name);
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
            ctx.heap.setField((objRef as {
                type: 'object';
                ref: number;
            }).ref, field.name, ctx.frame.registers[vA]);
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
            ctx.heap.setField((objRef as {
                type: 'object';
                ref: number;
            }).ref, field.name, ctx.frame.registers[vA]);
            ctx.frame.pc += 2;
        },
    });
    // 0x5a - iput-wide vA, vB, field@CCCC
    table.register(0x5a, {
        name: 'iput-wide',
        format: '22c',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const fieldIdx = code[ctx.frame.pc + 1];
            const field = ctx.classLoader.resolveField(fieldIdx);
            const objRef = ctx.frame.registers[vB];
            if (objRef.type === 'null')
                throw new NullPointerException('iput-wide on null reference');
            ctx.heap.setField((objRef as {
                type: 'object';
                ref: number;
            }).ref, field.name, ctx.frame.registers[vA]);
            ctx.frame.pc += 2;
        },
    });
    // 0x5c - iput-boolean vA, vB, field@CCCC
    table.register(0x5c, {
        name: 'iput-boolean',
        format: '22c',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const fieldIdx = code[ctx.frame.pc + 1];
            const field = ctx.classLoader.resolveField(fieldIdx);
            const objRef = ctx.frame.registers[vB];
            if (objRef.type === 'null')
                throw new NullPointerException('iput-boolean on null reference');
            ctx.heap.setField((objRef as {
                type: 'object';
                ref: number;
            }).ref, field.name, ctx.frame.registers[vA]);
            ctx.frame.pc += 2;
        },
    });
    // 0x5d - iput-byte vA, vB, field@CCCC
    table.register(0x5d, {
        name: 'iput-byte',
        format: '22c',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const fieldIdx = code[ctx.frame.pc + 1];
            const field = ctx.classLoader.resolveField(fieldIdx);
            const objRef = ctx.frame.registers[vB];
            if (objRef.type === 'null')
                throw new NullPointerException('iput-byte on null reference');
            ctx.heap.setField((objRef as {
                type: 'object';
                ref: number;
            }).ref, field.name, ctx.frame.registers[vA]);
            ctx.frame.pc += 2;
        },
    });
    // 0x5e - iput-char vA, vB, field@CCCC
    table.register(0x5e, {
        name: 'iput-char',
        format: '22c',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const fieldIdx = code[ctx.frame.pc + 1];
            const field = ctx.classLoader.resolveField(fieldIdx);
            const objRef = ctx.frame.registers[vB];
            if (objRef.type === 'null')
                throw new NullPointerException('iput-char on null reference');
            ctx.heap.setField((objRef as {
                type: 'object';
                ref: number;
            }).ref, field.name, ctx.frame.registers[vA]);
            ctx.frame.pc += 2;
        },
    });
    // 0x5f - iput-short vA, vB, field@CCCC
    table.register(0x5f, {
        name: 'iput-short',
        format: '22c',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const fieldIdx = code[ctx.frame.pc + 1];
            const field = ctx.classLoader.resolveField(fieldIdx);
            const objRef = ctx.frame.registers[vB];
            if (objRef.type === 'null')
                throw new NullPointerException('iput-short on null reference');
            ctx.heap.setField((objRef as {
                type: 'object';
                ref: number;
            }).ref, field.name, ctx.frame.registers[vA]);
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
    // 0x61 - sget-wide vAA, field@BBBB
    table.register(0x61, {
        name: 'sget-wide',
        format: '21c',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const fieldIdx = code[ctx.frame.pc + 1];
            const field = ctx.classLoader.resolveField(fieldIdx);
            ctx.classLoader.initializeClass(field.classDescriptor);
            ctx.frame.registers[vA] = ctx.classLoader.getStaticField(field);
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
    // 0x63 - sget-boolean vAA, field@BBBB
    table.register(0x63, {
        name: 'sget-boolean',
        format: '21c',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const fieldIdx = code[ctx.frame.pc + 1];
            const field = ctx.classLoader.resolveField(fieldIdx);
            ctx.classLoader.initializeClass(field.classDescriptor);
            ctx.frame.registers[vA] = ctx.classLoader.getStaticField(field);
            ctx.frame.pc += 2;
        },
    });
    // 0x64 - sget-byte vAA, field@BBBB
    table.register(0x64, {
        name: 'sget-byte',
        format: '21c',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const fieldIdx = code[ctx.frame.pc + 1];
            const field = ctx.classLoader.resolveField(fieldIdx);
            ctx.classLoader.initializeClass(field.classDescriptor);
            ctx.frame.registers[vA] = ctx.classLoader.getStaticField(field);
            ctx.frame.pc += 2;
        },
    });
    // 0x65 - sget-char vAA, field@BBBB
    table.register(0x65, {
        name: 'sget-char',
        format: '21c',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const fieldIdx = code[ctx.frame.pc + 1];
            const field = ctx.classLoader.resolveField(fieldIdx);
            ctx.classLoader.initializeClass(field.classDescriptor);
            ctx.frame.registers[vA] = ctx.classLoader.getStaticField(field);
            ctx.frame.pc += 2;
        },
    });
    // 0x66 - sget-short vAA, field@BBBB
    table.register(0x66, {
        name: 'sget-short',
        format: '21c',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const fieldIdx = code[ctx.frame.pc + 1];
            const field = ctx.classLoader.resolveField(fieldIdx);
            ctx.classLoader.initializeClass(field.classDescriptor);
            ctx.frame.registers[vA] = ctx.classLoader.getStaticField(field);
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
    // 0x68 - sput-wide vAA, field@BBBB
    table.register(0x68, {
        name: 'sput-wide',
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
    // 0x6a - sput-boolean vAA, field@BBBB
    table.register(0x6a, {
        name: 'sput-boolean',
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
    // 0x6b - sput-byte vAA, field@BBBB
    table.register(0x6b, {
        name: 'sput-byte',
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
    // 0x6c - sput-char vAA, field@BBBB
    table.register(0x6c, {
        name: 'sput-char',
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
    // 0x6d - sput-short vAA, field@BBBB
    table.register(0x6d, {
        name: 'sput-short',
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
            const method = ctx.classLoader.resolveVirtualMethod((thisRef as {
                type: 'object';
                ref: number;
            }).ref, methodIdx);
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
            const method = ctx.classLoader.resolveSuperMethod(ctx.frame.method.classDescriptor, methodIdx);
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
            const method = ctx.classLoader.resolveVirtualMethod((thisRef as {
                type: 'object';
                ref: number;
            }).ref, methodIdx);
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
            const method = ctx.classLoader.resolveVirtualMethod((thisRef as {
                type: 'object';
                ref: number;
            }).ref, methodIdx);
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
            const method = ctx.classLoader.resolveSuperMethod(ctx.frame.method.classDescriptor, methodIdx);
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
            const method = ctx.classLoader.resolveVirtualMethod((thisRef as {
                type: 'object';
                ref: number;
            }).ref, methodIdx);
            const args = ctx.frame.registers.slice(vC, vC + count);
            ctx.frame.pc += 3;
            ctx.interpreter.invokeMethod(method, args);
        },
    });
    // ─── Unary Operations ───
    // 0x7b - neg-int vA, vB
    table.register(0x7b, {
        name: 'neg-int',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'int', value: (-getIntValue(ctx.frame.registers[vB])) | 0 };
            ctx.frame.pc += 1;
        },
    });
    // 0x7c - not-int vA, vB
    table.register(0x7c, {
        name: 'not-int',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'int', value: (~getIntValue(ctx.frame.registers[vB])) | 0 };
            ctx.frame.pc += 1;
        },
    });
    // 0x7d - neg-long vA, vB
    table.register(0x7d, {
        name: 'neg-long',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, -getLongValue(ctx.frame.registers[vB])) };
            ctx.frame.pc += 1;
        },
    });
    // 0x7e - not-long vA, vB
    table.register(0x7e, {
        name: 'not-long',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, ~getLongValue(ctx.frame.registers[vB])) };
            ctx.frame.pc += 1;
        },
    });
    // 0x7f - neg-float vA, vB
    table.register(0x7f, {
        name: 'neg-float',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'float', value: -getFloatValue(ctx.frame.registers[vB]) };
            ctx.frame.pc += 1;
        },
    });
    // 0x80 - neg-double vA, vB
    table.register(0x80, {
        name: 'neg-double',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'double', value: -getDoubleValue(ctx.frame.registers[vB]) };
            ctx.frame.pc += 1;
        },
    });
    // ─── Type Conversion Operations ───
    // 0x81 - int-to-long vA, vB
    table.register(0x81, {
        name: 'int-to-long',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt(getIntValue(ctx.frame.registers[vB])) };
            ctx.frame.pc += 1;
        },
    });
    // 0x82 - int-to-float vA, vB
    table.register(0x82, {
        name: 'int-to-float',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'float', value: fround(getIntValue(ctx.frame.registers[vB])) };
            ctx.frame.pc += 1;
        },
    });
    // 0x83 - int-to-double vA, vB
    table.register(0x83, {
        name: 'int-to-double',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'double', value: getIntValue(ctx.frame.registers[vB]) };
            ctx.frame.pc += 1;
        },
    });
    // 0x84 - long-to-int vA, vB
    table.register(0x84, {
        name: 'long-to-int',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'int', value: Number(BigInt.asIntN(32, getLongValue(ctx.frame.registers[vB]))) };
            ctx.frame.pc += 1;
        },
    });
    // 0x85 - long-to-float vA, vB
    table.register(0x85, {
        name: 'long-to-float',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'float', value: fround(Number(getLongValue(ctx.frame.registers[vB]))) };
            ctx.frame.pc += 1;
        },
    });
    // 0x86 - long-to-double vA, vB
    table.register(0x86, {
        name: 'long-to-double',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'double', value: Number(getLongValue(ctx.frame.registers[vB])) };
            ctx.frame.pc += 1;
        },
    });
    // 0x87 - float-to-int vA, vB
    table.register(0x87, {
        name: 'float-to-int',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            const f = getFloatValue(ctx.frame.registers[vB]);
            let result: number;
            if (isNaN(f))
                result = 0;
            else if (f >= 2147483647)
                result = 2147483647;
            else if (f <= -2147483648)
                result = -2147483648;
            else
                result = Math.trunc(f) | 0;
            ctx.frame.registers[vA] = { type: 'int', value: result };
            ctx.frame.pc += 1;
        },
    });
    // 0x88 - float-to-long vA, vB
    table.register(0x88, {
        name: 'float-to-long',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            const f = getFloatValue(ctx.frame.registers[vB]);
            let result: bigint;
            if (isNaN(f))
                result = 0n;
            else if (f >= 9223372036854775807)
                result = 9223372036854775807n;
            else if (f <= -9223372036854775808)
                result = -9223372036854775808n;
            else
                result = BigInt(Math.trunc(f));
            ctx.frame.registers[vA] = { type: 'long', value: result };
            ctx.frame.pc += 1;
        },
    });
    // 0x89 - float-to-double vA, vB
    table.register(0x89, {
        name: 'float-to-double',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'double', value: getFloatValue(ctx.frame.registers[vB]) };
            ctx.frame.pc += 1;
        },
    });
    // 0x8a - double-to-int vA, vB
    table.register(0x8a, {
        name: 'double-to-int',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            const d = getDoubleValue(ctx.frame.registers[vB]);
            let result: number;
            if (isNaN(d))
                result = 0;
            else if (d >= 2147483647)
                result = 2147483647;
            else if (d <= -2147483648)
                result = -2147483648;
            else
                result = Math.trunc(d) | 0;
            ctx.frame.registers[vA] = { type: 'int', value: result };
            ctx.frame.pc += 1;
        },
    });
    // 0x8b - double-to-long vA, vB
    table.register(0x8b, {
        name: 'double-to-long',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            const d = getDoubleValue(ctx.frame.registers[vB]);
            let result: bigint;
            if (isNaN(d))
                result = 0n;
            else if (d >= 9223372036854775807)
                result = 9223372036854775807n;
            else if (d <= -9223372036854775808)
                result = -9223372036854775808n;
            else
                result = BigInt(Math.trunc(d));
            ctx.frame.registers[vA] = { type: 'long', value: result };
            ctx.frame.pc += 1;
        },
    });
    // 0x8c - double-to-float vA, vB
    table.register(0x8c, {
        name: 'double-to-float',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'float', value: fround(getDoubleValue(ctx.frame.registers[vB])) };
            ctx.frame.pc += 1;
        },
    });
    // 0x8d - int-to-byte vA, vB
    table.register(0x8d, {
        name: 'int-to-byte',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'int', value: (getIntValue(ctx.frame.registers[vB]) << 24) >> 24 };
            ctx.frame.pc += 1;
        },
    });
    // 0x8e - int-to-char vA, vB
    table.register(0x8e, {
        name: 'int-to-char',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'int', value: getIntValue(ctx.frame.registers[vB]) & 0xffff };
            ctx.frame.pc += 1;
        },
    });
    // 0x8f - int-to-short vA, vB
    table.register(0x8f, {
        name: 'int-to-short',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'int', value: (getIntValue(ctx.frame.registers[vB]) << 16) >> 16 };
            ctx.frame.pc += 1;
        },
    });
    // ─── Integer Arithmetic (3-register forms) ───
    // 0x90 - add-int vAA, vBB, vCC
    table.register(0x90, {
        name: 'add-int',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getIntValue(ctx.frame.registers[vB]);
            const c = getIntValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'int', value: (b + c) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0x91 - sub-int vAA, vBB, vCC
    table.register(0x91, {
        name: 'sub-int',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getIntValue(ctx.frame.registers[vB]);
            const c = getIntValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'int', value: (b - c) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0x92 - mul-int vAA, vBB, vCC
    table.register(0x92, {
        name: 'mul-int',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getIntValue(ctx.frame.registers[vB]);
            const c = getIntValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'int', value: Math.imul(b, c) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0x93 - div-int vAA, vBB, vCC
    table.register(0x93, {
        name: 'div-int',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getIntValue(ctx.frame.registers[vB]);
            const c = getIntValue(ctx.frame.registers[vC]);
            if (c === 0)
                throw new InterpreterError('ArithmeticException: divide by zero');
            ctx.frame.registers[vA] = { type: 'int', value: (b / c) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0x94 - rem-int vAA, vBB, vCC
    table.register(0x94, {
        name: 'rem-int',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getIntValue(ctx.frame.registers[vB]);
            const c = getIntValue(ctx.frame.registers[vC]);
            if (c === 0)
                throw new InterpreterError('ArithmeticException: divide by zero');
            ctx.frame.registers[vA] = { type: 'int', value: (b % c) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0x95 - and-int vAA, vBB, vCC
    table.register(0x95, {
        name: 'and-int',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getIntValue(ctx.frame.registers[vB]);
            const c = getIntValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'int', value: (b & c) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0x96 - or-int vAA, vBB, vCC
    table.register(0x96, {
        name: 'or-int',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getIntValue(ctx.frame.registers[vB]);
            const c = getIntValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'int', value: (b | c) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0x97 - xor-int vAA, vBB, vCC
    table.register(0x97, {
        name: 'xor-int',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getIntValue(ctx.frame.registers[vB]);
            const c = getIntValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'int', value: (b ^ c) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0x98 - shl-int vAA, vBB, vCC
    table.register(0x98, {
        name: 'shl-int',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getIntValue(ctx.frame.registers[vB]);
            const c = getIntValue(ctx.frame.registers[vC]) & 0x1f;
            ctx.frame.registers[vA] = { type: 'int', value: (b << c) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0x99 - shr-int vAA, vBB, vCC
    table.register(0x99, {
        name: 'shr-int',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getIntValue(ctx.frame.registers[vB]);
            const c = getIntValue(ctx.frame.registers[vC]) & 0x1f;
            ctx.frame.registers[vA] = { type: 'int', value: (b >> c) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0x9a - ushr-int vAA, vBB, vCC
    table.register(0x9a, {
        name: 'ushr-int',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getIntValue(ctx.frame.registers[vB]);
            const c = getIntValue(ctx.frame.registers[vC]) & 0x1f;
            ctx.frame.registers[vA] = { type: 'int', value: (b >>> c) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // ─── Long Arithmetic (3-register forms) ───
    // 0x9b - add-long vAA, vBB, vCC
    table.register(0x9b, {
        name: 'add-long',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getLongValue(ctx.frame.registers[vB]);
            const c = getLongValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, b + c) };
            ctx.frame.pc += 2;
        },
    });
    // 0x9c - sub-long vAA, vBB, vCC
    table.register(0x9c, {
        name: 'sub-long',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getLongValue(ctx.frame.registers[vB]);
            const c = getLongValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, b - c) };
            ctx.frame.pc += 2;
        },
    });
    // 0x9d - mul-long vAA, vBB, vCC
    table.register(0x9d, {
        name: 'mul-long',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getLongValue(ctx.frame.registers[vB]);
            const c = getLongValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, b * c) };
            ctx.frame.pc += 2;
        },
    });
    // 0x9e - div-long vAA, vBB, vCC
    table.register(0x9e, {
        name: 'div-long',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getLongValue(ctx.frame.registers[vB]);
            const c = getLongValue(ctx.frame.registers[vC]);
            if (c === 0n)
                throw new InterpreterError('ArithmeticException: divide by zero');
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, b / c) };
            ctx.frame.pc += 2;
        },
    });
    // 0x9f - rem-long vAA, vBB, vCC
    table.register(0x9f, {
        name: 'rem-long',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getLongValue(ctx.frame.registers[vB]);
            const c = getLongValue(ctx.frame.registers[vC]);
            if (c === 0n)
                throw new InterpreterError('ArithmeticException: divide by zero');
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, b % c) };
            ctx.frame.pc += 2;
        },
    });
    // 0xa0 - and-long vAA, vBB, vCC
    table.register(0xa0, {
        name: 'and-long',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getLongValue(ctx.frame.registers[vB]);
            const c = getLongValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, b & c) };
            ctx.frame.pc += 2;
        },
    });
    // 0xa1 - or-long vAA, vBB, vCC
    table.register(0xa1, {
        name: 'or-long',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getLongValue(ctx.frame.registers[vB]);
            const c = getLongValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, b | c) };
            ctx.frame.pc += 2;
        },
    });
    // 0xa2 - xor-long vAA, vBB, vCC
    table.register(0xa2, {
        name: 'xor-long',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getLongValue(ctx.frame.registers[vB]);
            const c = getLongValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, b ^ c) };
            ctx.frame.pc += 2;
        },
    });
    // 0xa3 - shl-long vAA, vBB, vCC
    table.register(0xa3, {
        name: 'shl-long',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getLongValue(ctx.frame.registers[vB]);
            const c = BigInt(getIntValue(ctx.frame.registers[vC]) & 0x3f);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, b << c) };
            ctx.frame.pc += 2;
        },
    });
    // 0xa4 - shr-long vAA, vBB, vCC
    table.register(0xa4, {
        name: 'shr-long',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getLongValue(ctx.frame.registers[vB]);
            const c = BigInt(getIntValue(ctx.frame.registers[vC]) & 0x3f);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, b >> c) };
            ctx.frame.pc += 2;
        },
    });
    // 0xa5 - ushr-long vAA, vBB, vCC
    table.register(0xa5, {
        name: 'ushr-long',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = BigInt.asUintN(64, getLongValue(ctx.frame.registers[vB]));
            const c = BigInt(getIntValue(ctx.frame.registers[vC]) & 0x3f);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, b >> c) };
            ctx.frame.pc += 2;
        },
    });
    // ─── Float Arithmetic (3-register forms) ───
    // 0xa6 - add-float vAA, vBB, vCC
    table.register(0xa6, {
        name: 'add-float',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getFloatValue(ctx.frame.registers[vB]);
            const c = getFloatValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'float', value: fround(b + c) };
            ctx.frame.pc += 2;
        },
    });
    // 0xa7 - sub-float vAA, vBB, vCC
    table.register(0xa7, {
        name: 'sub-float',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getFloatValue(ctx.frame.registers[vB]);
            const c = getFloatValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'float', value: fround(b - c) };
            ctx.frame.pc += 2;
        },
    });
    // 0xa8 - mul-float vAA, vBB, vCC
    table.register(0xa8, {
        name: 'mul-float',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getFloatValue(ctx.frame.registers[vB]);
            const c = getFloatValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'float', value: fround(b * c) };
            ctx.frame.pc += 2;
        },
    });
    // 0xa9 - div-float vAA, vBB, vCC
    table.register(0xa9, {
        name: 'div-float',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getFloatValue(ctx.frame.registers[vB]);
            const c = getFloatValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'float', value: fround(b / c) };
            ctx.frame.pc += 2;
        },
    });
    // 0xaa - rem-float vAA, vBB, vCC
    table.register(0xaa, {
        name: 'rem-float',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getFloatValue(ctx.frame.registers[vB]);
            const c = getFloatValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'float', value: fround(b % c) };
            ctx.frame.pc += 2;
        },
    });
    // ─── Double Arithmetic (3-register forms) ───
    // 0xab - add-double vAA, vBB, vCC
    table.register(0xab, {
        name: 'add-double',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getDoubleValue(ctx.frame.registers[vB]);
            const c = getDoubleValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'double', value: b + c };
            ctx.frame.pc += 2;
        },
    });
    // 0xac - sub-double vAA, vBB, vCC
    table.register(0xac, {
        name: 'sub-double',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getDoubleValue(ctx.frame.registers[vB]);
            const c = getDoubleValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'double', value: b - c };
            ctx.frame.pc += 2;
        },
    });
    // 0xad - mul-double vAA, vBB, vCC
    table.register(0xad, {
        name: 'mul-double',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getDoubleValue(ctx.frame.registers[vB]);
            const c = getDoubleValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'double', value: b * c };
            ctx.frame.pc += 2;
        },
    });
    // 0xae - div-double vAA, vBB, vCC
    table.register(0xae, {
        name: 'div-double',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getDoubleValue(ctx.frame.registers[vB]);
            const c = getDoubleValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'double', value: b / c };
            ctx.frame.pc += 2;
        },
    });
    // 0xaf - rem-double vAA, vBB, vCC
    table.register(0xaf, {
        name: 'rem-double',
        format: '23x',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const vC = (code[ctx.frame.pc + 1] >> 8) & 0xff;
            const b = getDoubleValue(ctx.frame.registers[vB]);
            const c = getDoubleValue(ctx.frame.registers[vC]);
            ctx.frame.registers[vA] = { type: 'double', value: b % c };
            ctx.frame.pc += 2;
        },
    });
    // ─── Integer Arithmetic (2-address forms) ───
    // 0xb0 - add-int/2addr vA, vB
    table.register(0xb0, {
        name: 'add-int/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            const a = getIntValue(ctx.frame.registers[vA]);
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: (a + b) | 0 };
            ctx.frame.pc += 1;
        },
    });
    // 0xb1 - sub-int/2addr vA, vB
    table.register(0xb1, {
        name: 'sub-int/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            const a = getIntValue(ctx.frame.registers[vA]);
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: (a - b) | 0 };
            ctx.frame.pc += 1;
        },
    });
    // 0xb2 - mul-int/2addr vA, vB
    table.register(0xb2, {
        name: 'mul-int/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            const a = getIntValue(ctx.frame.registers[vA]);
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: Math.imul(a, b) | 0 };
            ctx.frame.pc += 1;
        },
    });
    // 0xb3 - div-int/2addr vA, vB
    table.register(0xb3, {
        name: 'div-int/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            const a = getIntValue(ctx.frame.registers[vA]);
            const b = getIntValue(ctx.frame.registers[vB]);
            if (b === 0)
                throw new InterpreterError('ArithmeticException: divide by zero');
            ctx.frame.registers[vA] = { type: 'int', value: (a / b) | 0 };
            ctx.frame.pc += 1;
        },
    });
    // 0xb4 - rem-int/2addr vA, vB
    table.register(0xb4, {
        name: 'rem-int/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            const a = getIntValue(ctx.frame.registers[vA]);
            const b = getIntValue(ctx.frame.registers[vB]);
            if (b === 0)
                throw new InterpreterError('ArithmeticException: divide by zero');
            ctx.frame.registers[vA] = { type: 'int', value: (a % b) | 0 };
            ctx.frame.pc += 1;
        },
    });
    // 0xb5 - and-int/2addr vA, vB
    table.register(0xb5, {
        name: 'and-int/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'int', value: (getIntValue(ctx.frame.registers[vA]) & getIntValue(ctx.frame.registers[vB])) | 0 };
            ctx.frame.pc += 1;
        },
    });
    // 0xb6 - or-int/2addr vA, vB
    table.register(0xb6, {
        name: 'or-int/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'int', value: (getIntValue(ctx.frame.registers[vA]) | getIntValue(ctx.frame.registers[vB])) | 0 };
            ctx.frame.pc += 1;
        },
    });
    // 0xb7 - xor-int/2addr vA, vB
    table.register(0xb7, {
        name: 'xor-int/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'int', value: (getIntValue(ctx.frame.registers[vA]) ^ getIntValue(ctx.frame.registers[vB])) | 0 };
            ctx.frame.pc += 1;
        },
    });
    // 0xb8 - shl-int/2addr vA, vB
    table.register(0xb8, {
        name: 'shl-int/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            const a = getIntValue(ctx.frame.registers[vA]);
            const b = getIntValue(ctx.frame.registers[vB]) & 0x1f;
            ctx.frame.registers[vA] = { type: 'int', value: (a << b) | 0 };
            ctx.frame.pc += 1;
        },
    });
    // 0xb9 - shr-int/2addr vA, vB
    table.register(0xb9, {
        name: 'shr-int/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            const a = getIntValue(ctx.frame.registers[vA]);
            const b = getIntValue(ctx.frame.registers[vB]) & 0x1f;
            ctx.frame.registers[vA] = { type: 'int', value: (a >> b) | 0 };
            ctx.frame.pc += 1;
        },
    });
    // 0xba - ushr-int/2addr vA, vB
    table.register(0xba, {
        name: 'ushr-int/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            const a = getIntValue(ctx.frame.registers[vA]);
            const b = getIntValue(ctx.frame.registers[vB]) & 0x1f;
            ctx.frame.registers[vA] = { type: 'int', value: (a >>> b) | 0 };
            ctx.frame.pc += 1;
        },
    });
    // ─── Long Arithmetic (2-address forms) ───
    // 0xbb - add-long/2addr vA, vB
    table.register(0xbb, {
        name: 'add-long/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, getLongValue(ctx.frame.registers[vA]) + getLongValue(ctx.frame.registers[vB])) };
            ctx.frame.pc += 1;
        },
    });
    // 0xbc - sub-long/2addr vA, vB
    table.register(0xbc, {
        name: 'sub-long/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, getLongValue(ctx.frame.registers[vA]) - getLongValue(ctx.frame.registers[vB])) };
            ctx.frame.pc += 1;
        },
    });
    // 0xbd - mul-long/2addr vA, vB
    table.register(0xbd, {
        name: 'mul-long/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, getLongValue(ctx.frame.registers[vA]) * getLongValue(ctx.frame.registers[vB])) };
            ctx.frame.pc += 1;
        },
    });
    // 0xbe - div-long/2addr vA, vB
    table.register(0xbe, {
        name: 'div-long/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            const b = getLongValue(ctx.frame.registers[vB]);
            if (b === 0n)
                throw new InterpreterError('ArithmeticException: divide by zero');
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, getLongValue(ctx.frame.registers[vA]) / b) };
            ctx.frame.pc += 1;
        },
    });
    // 0xbf - rem-long/2addr vA, vB
    table.register(0xbf, {
        name: 'rem-long/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            const b = getLongValue(ctx.frame.registers[vB]);
            if (b === 0n)
                throw new InterpreterError('ArithmeticException: divide by zero');
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, getLongValue(ctx.frame.registers[vA]) % b) };
            ctx.frame.pc += 1;
        },
    });
    // 0xc0 - and-long/2addr vA, vB
    table.register(0xc0, {
        name: 'and-long/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, getLongValue(ctx.frame.registers[vA]) & getLongValue(ctx.frame.registers[vB])) };
            ctx.frame.pc += 1;
        },
    });
    // 0xc1 - or-long/2addr vA, vB
    table.register(0xc1, {
        name: 'or-long/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, getLongValue(ctx.frame.registers[vA]) | getLongValue(ctx.frame.registers[vB])) };
            ctx.frame.pc += 1;
        },
    });
    // 0xc2 - xor-long/2addr vA, vB
    table.register(0xc2, {
        name: 'xor-long/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, getLongValue(ctx.frame.registers[vA]) ^ getLongValue(ctx.frame.registers[vB])) };
            ctx.frame.pc += 1;
        },
    });
    // 0xc3 - shl-long/2addr vA, vB
    table.register(0xc3, {
        name: 'shl-long/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            const shift = BigInt(getIntValue(ctx.frame.registers[vB]) & 0x3f);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, getLongValue(ctx.frame.registers[vA]) << shift) };
            ctx.frame.pc += 1;
        },
    });
    // 0xc4 - shr-long/2addr vA, vB
    table.register(0xc4, {
        name: 'shr-long/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            const shift = BigInt(getIntValue(ctx.frame.registers[vB]) & 0x3f);
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, getLongValue(ctx.frame.registers[vA]) >> shift) };
            ctx.frame.pc += 1;
        },
    });
    // 0xc5 - ushr-long/2addr vA, vB
    table.register(0xc5, {
        name: 'ushr-long/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            const shift = BigInt(getIntValue(ctx.frame.registers[vB]) & 0x3f);
            const unsigned = BigInt.asUintN(64, getLongValue(ctx.frame.registers[vA]));
            ctx.frame.registers[vA] = { type: 'long', value: BigInt.asIntN(64, unsigned >> shift) };
            ctx.frame.pc += 1;
        },
    });
    // ─── Float Arithmetic (2-address forms) ───
    // 0xc6 - add-float/2addr vA, vB
    table.register(0xc6, {
        name: 'add-float/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'float', value: fround(getFloatValue(ctx.frame.registers[vA]) + getFloatValue(ctx.frame.registers[vB])) };
            ctx.frame.pc += 1;
        },
    });
    // 0xc7 - sub-float/2addr vA, vB
    table.register(0xc7, {
        name: 'sub-float/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'float', value: fround(getFloatValue(ctx.frame.registers[vA]) - getFloatValue(ctx.frame.registers[vB])) };
            ctx.frame.pc += 1;
        },
    });
    // 0xc8 - mul-float/2addr vA, vB
    table.register(0xc8, {
        name: 'mul-float/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'float', value: fround(getFloatValue(ctx.frame.registers[vA]) * getFloatValue(ctx.frame.registers[vB])) };
            ctx.frame.pc += 1;
        },
    });
    // 0xc9 - div-float/2addr vA, vB
    table.register(0xc9, {
        name: 'div-float/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'float', value: fround(getFloatValue(ctx.frame.registers[vA]) / getFloatValue(ctx.frame.registers[vB])) };
            ctx.frame.pc += 1;
        },
    });
    // 0xca - rem-float/2addr vA, vB
    table.register(0xca, {
        name: 'rem-float/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'float', value: fround(getFloatValue(ctx.frame.registers[vA]) % getFloatValue(ctx.frame.registers[vB])) };
            ctx.frame.pc += 1;
        },
    });
    // ─── Double Arithmetic (2-address forms) ───
    // 0xcb - add-double/2addr vA, vB
    table.register(0xcb, {
        name: 'add-double/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'double', value: getDoubleValue(ctx.frame.registers[vA]) + getDoubleValue(ctx.frame.registers[vB]) };
            ctx.frame.pc += 1;
        },
    });
    // 0xcc - sub-double/2addr vA, vB
    table.register(0xcc, {
        name: 'sub-double/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'double', value: getDoubleValue(ctx.frame.registers[vA]) - getDoubleValue(ctx.frame.registers[vB]) };
            ctx.frame.pc += 1;
        },
    });
    // 0xcd - mul-double/2addr vA, vB
    table.register(0xcd, {
        name: 'mul-double/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'double', value: getDoubleValue(ctx.frame.registers[vA]) * getDoubleValue(ctx.frame.registers[vB]) };
            ctx.frame.pc += 1;
        },
    });
    // 0xce - div-double/2addr vA, vB
    table.register(0xce, {
        name: 'div-double/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'double', value: getDoubleValue(ctx.frame.registers[vA]) / getDoubleValue(ctx.frame.registers[vB]) };
            ctx.frame.pc += 1;
        },
    });
    // 0xcf - rem-double/2addr vA, vB
    table.register(0xcf, {
        name: 'rem-double/2addr',
        format: '12x',
        width: 1,
        handler: (ctx, insn) => {
            const vA = getRegA_12x(insn);
            const vB = getRegB_12x(insn);
            ctx.frame.registers[vA] = { type: 'double', value: getDoubleValue(ctx.frame.registers[vA]) % getDoubleValue(ctx.frame.registers[vB]) };
            ctx.frame.pc += 1;
        },
    });
    // ─── Integer Arithmetic (lit16 forms) ───
    // 0xd0 - add-int/lit16 vA, vB, #+CCCC
    table.register(0xd0, {
        name: 'add-int/lit16',
        format: '22s',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const lit = signExtend16(code[ctx.frame.pc + 1]);
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: (b + lit) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0xd1 - rsub-int vA, vB, #+CCCC
    table.register(0xd1, {
        name: 'rsub-int',
        format: '22s',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const lit = signExtend16(code[ctx.frame.pc + 1]);
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: (lit - b) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0xd2 - mul-int/lit16 vA, vB, #+CCCC
    table.register(0xd2, {
        name: 'mul-int/lit16',
        format: '22s',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const lit = signExtend16(code[ctx.frame.pc + 1]);
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: Math.imul(b, lit) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0xd3 - div-int/lit16 vA, vB, #+CCCC
    table.register(0xd3, {
        name: 'div-int/lit16',
        format: '22s',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const lit = signExtend16(code[ctx.frame.pc + 1]);
            if (lit === 0)
                throw new InterpreterError('ArithmeticException: divide by zero');
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: (b / lit) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0xd4 - rem-int/lit16 vA, vB, #+CCCC
    table.register(0xd4, {
        name: 'rem-int/lit16',
        format: '22s',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const lit = signExtend16(code[ctx.frame.pc + 1]);
            if (lit === 0)
                throw new InterpreterError('ArithmeticException: divide by zero');
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: (b % lit) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0xd5 - and-int/lit16 vA, vB, #+CCCC
    table.register(0xd5, {
        name: 'and-int/lit16',
        format: '22s',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const lit = signExtend16(code[ctx.frame.pc + 1]);
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: (b & lit) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0xd6 - or-int/lit16 vA, vB, #+CCCC
    table.register(0xd6, {
        name: 'or-int/lit16',
        format: '22s',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const lit = signExtend16(code[ctx.frame.pc + 1]);
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: (b | lit) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0xd7 - xor-int/lit16 vA, vB, #+CCCC
    table.register(0xd7, {
        name: 'xor-int/lit16',
        format: '22s',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xf;
            const vB = (insn >> 12) & 0xf;
            const code = ctx.frame.method.code!.insns;
            const lit = signExtend16(code[ctx.frame.pc + 1]);
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: (b ^ lit) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // ─── Integer Arithmetic (lit8 forms) ───
    // 0xd8 - add-int/lit8 vAA, vBB, #+CC
    table.register(0xd8, {
        name: 'add-int/lit8',
        format: '22b',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const lit = signExtend8((code[ctx.frame.pc + 1] >> 8) & 0xff);
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: (b + lit) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0xd9 - rsub-int/lit8 vAA, vBB, #+CC
    table.register(0xd9, {
        name: 'rsub-int/lit8',
        format: '22b',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const lit = signExtend8((code[ctx.frame.pc + 1] >> 8) & 0xff);
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: (lit - b) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0xda - mul-int/lit8 vAA, vBB, #+CC
    table.register(0xda, {
        name: 'mul-int/lit8',
        format: '22b',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const lit = signExtend8((code[ctx.frame.pc + 1] >> 8) & 0xff);
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: Math.imul(b, lit) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0xdb - div-int/lit8 vAA, vBB, #+CC
    table.register(0xdb, {
        name: 'div-int/lit8',
        format: '22b',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const lit = signExtend8((code[ctx.frame.pc + 1] >> 8) & 0xff);
            const b = getIntValue(ctx.frame.registers[vB]);
            if (lit === 0)
                throw new InterpreterError('ArithmeticException: divide by zero');
            ctx.frame.registers[vA] = { type: 'int', value: (b / lit) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0xdc - rem-int/lit8 vAA, vBB, #+CC
    table.register(0xdc, {
        name: 'rem-int/lit8',
        format: '22b',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const lit = signExtend8((code[ctx.frame.pc + 1] >> 8) & 0xff);
            const b = getIntValue(ctx.frame.registers[vB]);
            if (lit === 0)
                throw new InterpreterError('ArithmeticException: divide by zero');
            ctx.frame.registers[vA] = { type: 'int', value: (b % lit) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0xdd - and-int/lit8 vAA, vBB, #+CC
    table.register(0xdd, {
        name: 'and-int/lit8',
        format: '22b',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const lit = signExtend8((code[ctx.frame.pc + 1] >> 8) & 0xff);
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: (b & lit) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0xde - or-int/lit8 vAA, vBB, #+CC
    table.register(0xde, {
        name: 'or-int/lit8',
        format: '22b',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const lit = signExtend8((code[ctx.frame.pc + 1] >> 8) & 0xff);
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: (b | lit) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0xdf - xor-int/lit8 vAA, vBB, #+CC
    table.register(0xdf, {
        name: 'xor-int/lit8',
        format: '22b',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const lit = signExtend8((code[ctx.frame.pc + 1] >> 8) & 0xff);
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: (b ^ lit) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0xe0 - shl-int/lit8 vAA, vBB, #+CC
    table.register(0xe0, {
        name: 'shl-int/lit8',
        format: '22b',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const lit = signExtend8((code[ctx.frame.pc + 1] >> 8) & 0xff) & 0x1f;
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: (b << lit) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0xe1 - shr-int/lit8 vAA, vBB, #+CC
    table.register(0xe1, {
        name: 'shr-int/lit8',
        format: '22b',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const lit = signExtend8((code[ctx.frame.pc + 1] >> 8) & 0xff) & 0x1f;
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: (b >> lit) | 0 };
            ctx.frame.pc += 2;
        },
    });
    // 0xe2 - ushr-int/lit8 vAA, vBB, #+CC
    table.register(0xe2, {
        name: 'ushr-int/lit8',
        format: '22b',
        width: 2,
        handler: (ctx, insn) => {
            const vA = (insn >> 8) & 0xff;
            const code = ctx.frame.method.code!.insns;
            const vB = code[ctx.frame.pc + 1] & 0xff;
            const lit = signExtend8((code[ctx.frame.pc + 1] >> 8) & 0xff) & 0x1f;
            const b = getIntValue(ctx.frame.registers[vB]);
            ctx.frame.registers[vA] = { type: 'int', value: (b >>> lit) | 0 };
            ctx.frame.pc += 2;
        },
    });
}
