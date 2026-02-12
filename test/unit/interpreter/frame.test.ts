/**
 * Tests for FrameManager - execution frame creation and stack operations.
 */

import { FrameManager } from '../../../src/interpreter/frame';
import { ResolvedMethod } from '../../../src/interpreter/types';
import { Value, intValue, objectRef, NULL_VALUE } from '../../../src/core/types';
import { CodeItem } from '../../../src/parser/dex_types';
import { InterpreterError } from '../../../src/interpreter/errors';

function makeMethod(registersSize: number, insSize: number): ResolvedMethod {
  return {
    classDescriptor: 'Lcom/example/Test;',
    name: 'test',
    descriptor: '()V',
    accessFlags: 0,
    code: {
      registersSize,
      insSize,
      outsSize: 0,
      triesSize: 0,
      debugInfoOff: 0,
      insnsSize: 1,
      insns: new Uint16Array([0x0e]),  // return-void
      tries: [],
      handlers: [],
    },
    isShim: false,
  };
}

describe('FrameManager', () => {
  let fm: FrameManager;

  beforeEach(() => {
    fm = new FrameManager();
  });

  describe('Frame Creation', () => {
    it('creates frame with correct register count', () => {
      const method = makeMethod(5, 1);
      const frame = fm.createFrame(method, [objectRef(1)]);
      expect(frame.registers.length).toBe(5);
    });

    it('places arguments in last N registers', () => {
      // 4 registers total, 2 insSize (this + 1 arg)
      const method = makeMethod(4, 2);
      const frame = fm.createFrame(method, [objectRef(1), intValue(42)]);
      // Args go in registers 2 and 3 (4 - 2 = 2)
      expect(frame.registers[2]).toEqual(objectRef(1));
      expect(frame.registers[3]).toEqual(intValue(42));
    });

    it('initializes non-arg registers to int 0', () => {
      const method = makeMethod(4, 1);
      const frame = fm.createFrame(method, [objectRef(1)]);
      expect(frame.registers[0]).toEqual(intValue(0));
      expect(frame.registers[1]).toEqual(intValue(0));
      expect(frame.registers[2]).toEqual(intValue(0));
    });

    it('starts with PC at 0', () => {
      const method = makeMethod(2, 0);
      const frame = fm.createFrame(method, []);
      expect(frame.pc).toBe(0);
    });

    it('wide values span two registers', () => {
      // 6 registers, 3 insSize: this(obj) + long(wide) = 1+2 = 3 words
      const method = makeMethod(6, 3);
      const longVal: Value = { type: 'long', value: BigInt(123456789) };
      const frame = fm.createFrame(method, [objectRef(1), longVal]);
      // argStart = 6 - 3 = 3
      // reg[3] = objectRef(1) (this)
      // reg[4] = longVal (wide - occupies 4 and 5)
      expect(frame.registers[3]).toEqual(objectRef(1));
      expect(frame.registers[4]).toEqual(longVal);
      // reg[5] is skipped over by wide value in createFrame
    });
  });

  describe('Stack Operations', () => {
    it('push/pop works correctly', () => {
      const method = makeMethod(2, 0);
      const frame = fm.createFrame(method, []);
      fm.pushFrame(frame);
      expect(fm.getStackDepth()).toBe(1);

      const popped = fm.popFrame();
      expect(popped).toBe(frame);
      expect(fm.getStackDepth()).toBe(0);
    });

    it('currentFrame returns top frame', () => {
      const method1 = makeMethod(2, 0);
      const method2 = makeMethod(3, 0);
      const frame1 = fm.createFrame(method1, []);
      const frame2 = fm.createFrame(method2, []);

      fm.pushFrame(frame1);
      fm.pushFrame(frame2);

      expect(fm.currentFrame()).toBe(frame2);
    });

    it('returns null when stack is empty', () => {
      expect(fm.currentFrame()).toBeNull();
      expect(fm.popFrame()).toBeNull();
    });

    it('getStackDepth tracks correctly', () => {
      const method = makeMethod(2, 0);
      expect(fm.getStackDepth()).toBe(0);

      fm.pushFrame(fm.createFrame(method, []));
      expect(fm.getStackDepth()).toBe(1);

      fm.pushFrame(fm.createFrame(method, []));
      expect(fm.getStackDepth()).toBe(2);

      fm.popFrame();
      expect(fm.getStackDepth()).toBe(1);
    });
  });

  describe('Stack Trace', () => {
    it('generates readable stack trace', () => {
      const method = makeMethod(2, 0);
      const frame = fm.createFrame(method, []);
      fm.pushFrame(frame);

      const trace = fm.getStackTrace();
      expect(trace.length).toBe(1);
      expect(trace[0]).toContain('Lcom/example/Test;');
      expect(trace[0]).toContain('test');
    });
  });
});
