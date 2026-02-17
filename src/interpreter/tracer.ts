/**
 * CRAFT - Execution Tracer
 * Records bytecode execution steps for debugging and analysis.
 */

import { Value } from '../core/types';
import { OpcodeTable, ExecutionContext } from './opcode_table';

/** A single recorded execution step */
export interface TraceEntry {
  pc: number;
  opcode: number;
  opcodeName: string;
  method: string;
  registers: Value[] | null;
  depth: number;
}

/**
 * ExecutionTracer wraps an OpcodeTable to record each instruction executed.
 * Use by replacing the opcode table's execute method during tracing.
 */
export class ExecutionTracer {
  private trace: TraceEntry[] = [];
  private tracing: boolean = false;
  private maxSteps: number;
  private captureRegisters: boolean;

  constructor(opts: { maxSteps?: number; captureRegisters?: boolean } = {}) {
    this.maxSteps = opts.maxSteps ?? 1000;
    this.captureRegisters = opts.captureRegisters ?? false;
  }

  /** Start recording trace entries */
  startTrace(): void {
    this.trace = [];
    this.tracing = true;
  }

  /** Stop recording */
  stopTrace(): void {
    this.tracing = false;
  }

  /** Get the recorded trace */
  getTrace(): TraceEntry[] {
    return this.trace;
  }

  /** Check if tracer is active */
  isTracing(): boolean {
    return this.tracing;
  }

  /** Check if max steps reached */
  isMaxStepsReached(): boolean {
    return this.trace.length >= this.maxSteps;
  }

  /**
   * Record a step before opcode execution.
   * Call this from an instrumented interpreter loop.
   */
  recordStep(
    ctx: ExecutionContext,
    opcode: number,
    opcodeTable: OpcodeTable,
    stackDepth: number
  ): void {
    if (!this.tracing) return;
    if (this.trace.length >= this.maxSteps) {
      this.tracing = false;
      return;
    }

    const info = opcodeTable.get(opcode);
    const entry: TraceEntry = {
      pc: ctx.frame.pc,
      opcode,
      opcodeName: info ? info.name : `unknown(0x${opcode.toString(16)})`,
      method: `${ctx.frame.method.classDescriptor}.${ctx.frame.method.name}`,
      registers: this.captureRegisters
        ? ctx.frame.registers.map((v) => ({ ...v } as Value))
        : null,
      depth: stackDepth,
    };

    this.trace.push(entry);
  }

  /** Format trace as a human-readable table */
  formatTable(): string {
    const lines: string[] = [];
    lines.push(
      `${'Step'.padEnd(6)} ${'PC'.padEnd(6)} ${'Opcode'.padEnd(24)} ${'Method'}`
    );
    lines.push('-'.repeat(72));

    for (let i = 0; i < this.trace.length; i++) {
      const e = this.trace[i];
      const indent = '  '.repeat(e.depth);
      const opcodeHex = `0x${e.opcode.toString(16).padStart(2, '0')}`;
      const opStr = `${opcodeHex} ${e.opcodeName}`;
      lines.push(
        `${String(i).padEnd(6)} ${String(e.pc).padEnd(6)} ${opStr.padEnd(24)} ${indent}${e.method}`
      );
    }

    lines.push('');
    lines.push(`Total steps: ${this.trace.length}`);
    return lines.join('\n');
  }
}
