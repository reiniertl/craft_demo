import { NULL_VALUE } from "@bundle:com.craft.runtime/entry/ets/craft/core/types";
import type { Value } from "@bundle:com.craft.runtime/entry/ets/craft/core/types";
import type { DexParser } from '../parser/dex_parser';
import type { Heap } from './heap';
import { FrameManager } from "@bundle:com.craft.runtime/entry/ets/craft/interpreter/frame";
import type { ExecutionFrame } from "@bundle:com.craft.runtime/entry/ets/craft/interpreter/frame";
import { ClassLoader } from "@bundle:com.craft.runtime/entry/ets/craft/interpreter/class_loader";
import { OpcodeTable } from "@bundle:com.craft.runtime/entry/ets/craft/interpreter/opcode_table";
import type { ExecutionContext, InterpreterControl } from "@bundle:com.craft.runtime/entry/ets/craft/interpreter/opcode_table";
import type { ShimRegistry, InterpreterRef } from './shim_registry';
import type { ResolvedMethod } from './types';
import { registerEssentialOpcodes } from "@bundle:com.craft.runtime/entry/ets/craft/interpreter/opcodes";
import { InterpreterError, NoSuchMethodError, AbstractMethodError, } from "@bundle:com.craft.runtime/entry/ets/craft/interpreter/errors";
export class Interpreter implements InterpreterControl, InterpreterRef {
    private dex: DexParser;
    private heap: Heap;
    private classLoader: ClassLoader;
    private frameManager: FrameManager;
    private opcodeTable: OpcodeTable;
    private shimRegistry: ShimRegistry;
    private lastResult: Value = NULL_VALUE;
    private running: boolean = false;
    private initialStackDepth: number = 0;
    constructor(dex: DexParser, heap: Heap, shimRegistry: ShimRegistry) {
        this.dex = dex;
        this.heap = heap;
        this.shimRegistry = shimRegistry;
        this.classLoader = new ClassLoader(dex, heap, shimRegistry);
        this.frameManager = new FrameManager();
        this.opcodeTable = new OpcodeTable();
        // Register opcodes
        registerEssentialOpcodes(this.opcodeTable);
        // Wire up clinit runner
        this.classLoader.setClinitRunner((descriptor: string) => {
            const resolved = this.classLoader.getClass(descriptor);
            if (!resolved)
                return;
            const clinit = resolved.directMethods.get('<clinit>()V');
            if (clinit && clinit.code) {
                this.invokeMethod(clinit, []);
                // Execute the clinit synchronously
                this.runUntilReturn();
            }
        });
    }
    /** Get the class loader */
    getClassLoader(): ClassLoader {
        return this.classLoader;
    }
    /** Get the heap */
    getHeap(): Heap {
        return this.heap;
    }
    /** Get the frame manager */
    getFrameManager(): FrameManager {
        return this.frameManager;
    }
    /**
     * Invoke a method by class name, method name, and descriptor.
     * This is the main entry point for execution.
     */
    invoke(className: string, methodName: string, descriptor: string, args: Value[]): Value {
        const method = this.classLoader.resolveMethodByName(className, methodName, descriptor);
        if (!method) {
            throw new NoSuchMethodError(`${className}.${methodName}${descriptor}`);
        }
        if (method.isShim) {
            // Execute shim immediately
            return this.shimRegistry.invoke(method, this, this.heap, args);
        }
        if (!method.code) {
            throw new AbstractMethodError(`${method.classDescriptor}.${method.name}`);
        }
        // Create and push frame
        const frame = this.frameManager.createFrame(method, args);
        this.frameManager.pushFrame(frame);
        const savedInitialDepth = this.initialStackDepth;
        this.initialStackDepth = this.frameManager.getStackDepth() - 1;
        // Execute
        this.running = true;
        while (this.running &&
            this.frameManager.getStackDepth() > this.initialStackDepth) {
            const currentFrame = this.frameManager.currentFrame()!;
            this.executeInstruction(currentFrame);
        }
        this.initialStackDepth = savedInitialDepth;
        return this.lastResult;
    }
    /** Invoke a resolved method (called by opcode handlers) */
    invokeMethod(method: ResolvedMethod, args: Value[]): void {
        if (method.isShim) {
            // Execute shim immediately
            this.lastResult = this.shimRegistry.invoke(method, this, this.heap, args);
        }
        else if (method.code) {
            // Push new frame for DEX method
            const frame = this.frameManager.createFrame(method, args);
            this.frameManager.pushFrame(frame);
        }
        else {
            throw new AbstractMethodError(`${method.classDescriptor}.${method.name}`);
        }
    }
    /** Return from the current method */
    returnFromMethod(value: Value): void {
        this.lastResult = value;
        this.frameManager.popFrame();
        if (this.frameManager.getStackDepth() <= this.initialStackDepth) {
            this.running = false;
        }
    }
    /** Get the result of the last method call */
    getLastResult(): Value {
        return this.lastResult;
    }
    /** Execute a single instruction in the given frame */
    private executeInstruction(frame: ExecutionFrame): void {
        const code = frame.method.code!;
        const insns = code.insns;
        if (frame.pc >= insns.length) {
            throw new InterpreterError(`PC out of bounds: ${frame.pc} >= ${insns.length} in ${frame.method.classDescriptor}.${frame.method.name}`);
        }
        const insn = insns[frame.pc];
        const opcode = insn & 0xff;
        const ctx: ExecutionContext = {
            frame,
            heap: this.heap,
            classLoader: this.classLoader,
            interpreter: this,
            dex: this.dex,
        };
        this.opcodeTable.execute(ctx, opcode, insn);
    }
    /** Run execution until the current frame returns (for clinit) */
    private runUntilReturn(): void {
        const targetDepth = this.frameManager.getStackDepth() - 1;
        while (this.frameManager.getStackDepth() > targetDepth) {
            const frame = this.frameManager.currentFrame();
            if (!frame)
                break;
            this.executeInstruction(frame);
        }
    }
}
