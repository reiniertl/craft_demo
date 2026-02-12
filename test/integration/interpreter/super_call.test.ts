/**
 * Integration: subclass method calling super.method() -> parent implementation executes
 */

import { SyntheticDexBuilder, makeCode, createInterpreter } from './test_helpers';
import { intValue, objectRef } from '../../../src/core/types';

describe('Integration: super call', () => {
  it('invoke-super calls parent class implementation', () => {
    const builder = new SyntheticDexBuilder();

    // Base class with virtual method: getValue() returns 10
    const baseGetValueIdx = builder.addMethod('Lcom/example/Base;', 'getValue', 'I');
    const baseCode = makeCode([
      0x0013, 10,  // const/16 v0, 10
      0x000f,      // return v0
    ], 1, 0);

    // Child class overrides getValue() but calls super.getValue() via invoke-super
    // Registers: v0=this, v1=result
    const childGetValueIdx = builder.addMethod('Lcom/example/Child;', 'getValue', 'I');
    // invoke-super {v0}, Base.getValue() (count=1, v0=this)
    // move-result v1
    // return v1
    const childCode = makeCode([
      0x106f, baseGetValueIdx, 0x0000,  // invoke-super {v0}, method@baseGetValue
      0x010a,                           // move-result v1
      0x010f,                           // return v1
    ], 2, 1); // 2 regs, 1 insSize (this)

    builder.addClass('Lcom/example/Base;', 'Ljava/lang/Object;', {
      virtualMethods: [{ methodIdx: baseGetValueIdx, accessFlags: 0x0001, code: baseCode }],
    });
    builder.addClass('Lcom/example/Child;', 'Lcom/example/Base;', {
      virtualMethods: [{ methodIdx: childGetValueIdx, accessFlags: 0x0001, code: childCode }],
    });

    const { interpreter, heap } = createInterpreter(builder.build());

    // Allocate a Child object and call getValue on it
    const childObj = heap.allocate('Lcom/example/Child;');
    const result = interpreter.invoke(
      'Lcom/example/Child;', 'getValue', '()I',
      [objectRef(childObj)]
    );
    expect(result).toEqual(intValue(10));
  });
});
