/**
 * CRAFT - Opcode Dispatch Table
 * Maps opcodes to handler functions with instruction format metadata.
 */

import { Value } from '../core/types';
import { DexParser } from '../parser/dex_parser';
import { ExecutionFrame } from './frame';
import { Heap } from './heap';
import { ClassLoader } from './class_loader';
import { InterpreterError } from './errors';
import { ResolvedMethod } from './types';

/** Context passed to all opcode handlers */
export interface ExecutionContext {
  frame: ExecutionFrame;
  heap: Heap;
  classLoader: ClassLoader;
  interpreter: InterpreterControl;
  dex: DexParser;
}

/** Interface for interpreter control from opcode handlers */
export interface InterpreterControl {
  getLastResult(): Value;
  returnFromMethod(value: Value): void;
  invokeMethod(method: ResolvedMethod, args: Value[]): void;
}

/** Opcode handler function */
export type OpcodeHandler = (ctx: ExecutionContext, insn: number) => void;

/** Opcode metadata */
export interface OpcodeInfo {
  name: string;
  format: string;
  handler: OpcodeHandler;
  width: number;
}

export class OpcodeTable {
  private handlers: Map<number, OpcodeInfo> = new Map();

  /** Register an opcode handler */
  register(opcode: number, info: OpcodeInfo): void {
    this.handlers.set(opcode, info);
  }

  /** Get opcode info */
  get(opcode: number): OpcodeInfo | null {
    return this.handlers.get(opcode) || null;
  }

  /** Execute an opcode */
  execute(ctx: ExecutionContext, opcode: number, insn: number): void {
    const info = this.handlers.get(opcode);
    if (!info) {
      throw new InterpreterError(
        `Unimplemented opcode: 0x${opcode.toString(16).padStart(2, '0')} at PC=${ctx.frame.pc}`
      );
    }
    info.handler(ctx, insn);
  }
}

// --- Instruction format helper functions ---

/** Extract register A from 12x format: ????|A|B */
export function getRegA_12x(insn: number): number {
  return (insn >> 8) & 0xf;
}

/** Extract register B from 12x format */
export function getRegB_12x(insn: number): number {
  return (insn >> 12) & 0xf;
}

/** Extract register A from 21c/21s format: ????|AA */
export function getRegA_21c(insn: number): number {
  return (insn >> 8) & 0xff;
}

/** Extract 4-bit signed literal from 11n format */
export function getLiteral_11n(insn: number): number {
  const val = (insn >> 12) & 0xf;
  return val >= 8 ? val - 16 : val;
}

/** Extract registers from 35c format invoke */
export function getRegisters_35c(insn: number, word2: number): number[] {
  const count = (insn >> 12) & 0xf;
  const regs: number[] = [];

  if (count >= 1) regs.push(word2 & 0xf);
  if (count >= 2) regs.push((word2 >> 4) & 0xf);
  if (count >= 3) regs.push((word2 >> 8) & 0xf);
  if (count >= 4) regs.push((word2 >> 12) & 0xf);
  if (count >= 5) regs.push((insn >> 8) & 0xf);

  return regs;
}

/** Sign-extend a 16-bit value */
export function signExtend16(value: number): number {
  return (value << 16) >> 16;
}
