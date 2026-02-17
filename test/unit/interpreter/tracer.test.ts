/**
 * Tests for ExecutionTracer
 */

import { ExecutionTracer, TraceEntry } from '../../../src/interpreter/tracer';
import { OpcodeTable, ExecutionContext } from '../../../src/interpreter/opcode_table';
import { NULL_VALUE, intValue } from '../../../src/core/types';
import { ResolvedMethod } from '../../../src/interpreter/types';

function makeFrame(methodName: string) {
  const method: ResolvedMethod = {
    classDescriptor: 'LTest;',
    name: methodName,
    descriptor: '()V',
    accessFlags: 0,
    code: {
      registersSize: 4, insSize: 0, outsSize: 0,
      triesSize: 0, debugInfoOff: 0, insnsSize: 1,
      insns: new Uint16Array([0]), tries: [], handlers: [],
    },
    isShim: false,
  };
  return {
    method,
    registers: [intValue(0), intValue(1), NULL_VALUE, NULL_VALUE],
    pc: 0,
    callerFrame: null,
    returnRegister: -1,
    lockRef: null,
  };
}

function makeCtx(frame: ReturnType<typeof makeFrame>): ExecutionContext {
  return {
    frame,
    heap: {} as any,
    classLoader: {} as any,
    interpreter: {} as any,
    dex: {} as any,
  };
}

describe('ExecutionTracer', () => {
  let tracer: ExecutionTracer;
  let table: OpcodeTable;

  beforeEach(() => {
    tracer = new ExecutionTracer({ maxSteps: 10, captureRegisters: true });
    table = new OpcodeTable();
    table.register(0x00, { name: 'nop', format: '10x', width: 1, handler: () => {} });
    table.register(0x0e, { name: 'return-void', format: '10x', width: 1, handler: () => {} });
  });

  it('starts and stops tracing', () => {
    expect(tracer.isTracing()).toBe(false);
    tracer.startTrace();
    expect(tracer.isTracing()).toBe(true);
    tracer.stopTrace();
    expect(tracer.isTracing()).toBe(false);
  });

  it('records trace entries', () => {
    tracer.startTrace();
    const frame = makeFrame('testMethod');
    const ctx = makeCtx(frame);

    tracer.recordStep(ctx, 0x00, table, 0);
    frame.pc = 1;
    tracer.recordStep(ctx, 0x0e, table, 0);

    const trace = tracer.getTrace();
    expect(trace).toHaveLength(2);
    expect(trace[0].opcodeName).toBe('nop');
    expect(trace[0].pc).toBe(0);
    expect(trace[0].method).toBe('LTest;.testMethod');
    expect(trace[1].opcodeName).toBe('return-void');
    expect(trace[1].pc).toBe(1);
  });

  it('captures register snapshots when enabled', () => {
    tracer.startTrace();
    const frame = makeFrame('test');
    const ctx = makeCtx(frame);

    tracer.recordStep(ctx, 0x00, table, 0);
    const trace = tracer.getTrace();
    expect(trace[0].registers).not.toBeNull();
    expect(trace[0].registers!).toHaveLength(4);
    expect(trace[0].registers![0]).toEqual(intValue(0));
  });

  it('does not capture registers when disabled', () => {
    const noRegTracer = new ExecutionTracer({ captureRegisters: false });
    noRegTracer.startTrace();
    const frame = makeFrame('test');
    const ctx = makeCtx(frame);

    noRegTracer.recordStep(ctx, 0x00, table, 0);
    expect(noRegTracer.getTrace()[0].registers).toBeNull();
  });

  it('stops tracing at maxSteps', () => {
    const limitTracer = new ExecutionTracer({ maxSteps: 3 });
    limitTracer.startTrace();
    const frame = makeFrame('test');
    const ctx = makeCtx(frame);

    for (let i = 0; i < 10; i++) {
      limitTracer.recordStep(ctx, 0x00, table, 0);
    }

    expect(limitTracer.getTrace()).toHaveLength(3);
    expect(limitTracer.isMaxStepsReached()).toBe(true);
    expect(limitTracer.isTracing()).toBe(false);
  });

  it('records stack depth', () => {
    tracer.startTrace();
    const frame = makeFrame('test');
    const ctx = makeCtx(frame);

    tracer.recordStep(ctx, 0x00, table, 0);
    tracer.recordStep(ctx, 0x00, table, 1);
    tracer.recordStep(ctx, 0x00, table, 2);

    const trace = tracer.getTrace();
    expect(trace[0].depth).toBe(0);
    expect(trace[1].depth).toBe(1);
    expect(trace[2].depth).toBe(2);
  });

  it('formats table output', () => {
    tracer.startTrace();
    const frame = makeFrame('main');
    const ctx = makeCtx(frame);

    tracer.recordStep(ctx, 0x00, table, 0);
    tracer.recordStep(ctx, 0x0e, table, 0);

    const output = tracer.formatTable();
    expect(output).toContain('nop');
    expect(output).toContain('return-void');
    expect(output).toContain('LTest;.main');
    expect(output).toContain('Total steps: 2');
  });

  it('startTrace resets previous trace', () => {
    tracer.startTrace();
    const frame = makeFrame('test');
    const ctx = makeCtx(frame);
    tracer.recordStep(ctx, 0x00, table, 0);
    expect(tracer.getTrace()).toHaveLength(1);

    tracer.startTrace();
    expect(tracer.getTrace()).toHaveLength(0);
  });
});
