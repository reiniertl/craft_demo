import { intValue } from "@bundle:com.craft.runtime/entry/ets/craft/core/types";
import type { Value } from "@bundle:com.craft.runtime/entry/ets/craft/core/types";
import { isWideValue } from "@bundle:com.craft.runtime/entry/ets/craft/interpreter/types";
import type { ResolvedMethod } from "@bundle:com.craft.runtime/entry/ets/craft/interpreter/types";
import { InterpreterError } from "@bundle:com.craft.runtime/entry/ets/craft/interpreter/errors";
/** A single execution frame on the call stack */
export interface ExecutionFrame {
    method: ResolvedMethod;
    registers: Value[];
    pc: number;
    callerFrame: ExecutionFrame | null;
    returnRegister: number;
    lockRef: number | null;
}
export class FrameManager {
    private stack: ExecutionFrame[] = [];
    private maxStackDepth: number = 256;
    /** Create a new execution frame for a method call */
    createFrame(method: ResolvedMethod, args: Value[]): ExecutionFrame {
        const code = method.code!;
        const registers = new Array<Value>(code.registersSize);
        // Initialize all registers to int 0
        for (let i = 0; i < code.registersSize; i++) {
            registers[i] = intValue(0);
        }
        // Arguments go in the last N registers (insSize)
        const argStart = code.registersSize - code.insSize;
        let regIdx = argStart;
        for (let i = 0; i < args.length; i++) {
            registers[regIdx] = args[i];
            regIdx++;
            // Wide values occupy two registers
            if (isWideValue(args[i])) {
                regIdx++;
            }
        }
        return {
            method,
            registers,
            pc: 0,
            callerFrame: this.currentFrame(),
            returnRegister: -1,
            lockRef: null,
        };
    }
    /** Push a frame onto the call stack */
    pushFrame(frame: ExecutionFrame): void {
        if (this.stack.length >= this.maxStackDepth) {
            throw new InterpreterError(`Stack overflow: exceeded max depth of ${this.maxStackDepth}`);
        }
        this.stack.push(frame);
    }
    /** Pop the top frame from the call stack */
    popFrame(): ExecutionFrame | null {
        return this.stack.pop() || null;
    }
    /** Get the current (top) frame */
    currentFrame(): ExecutionFrame | null {
        return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
    }
    /** Get call stack depth */
    getStackDepth(): number {
        return this.stack.length;
    }
    /** Get a human-readable stack trace */
    getStackTrace(): string[] {
        const trace: string[] = [];
        for (let i = this.stack.length - 1; i >= 0; i--) {
            const frame = this.stack[i];
            trace.push(`  at ${frame.method.classDescriptor}.${frame.method.name}${frame.method.descriptor} (pc=${frame.pc})`);
        }
        return trace;
    }
}
