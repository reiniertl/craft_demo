/**
 * Integration: new-instance + invoke-direct <init> + return-object -> valid object
 */

import { SyntheticDexBuilder, makeCode, createInterpreter } from './test_helpers';

describe('Integration: object creation', () => {
  it('creates and returns an Object via new-instance, invoke-direct, return-object', () => {
    const builder = new SyntheticDexBuilder();
    const objTypeIdx = builder.addType('Ljava/lang/Object;');
    const initMethodIdx = builder.addMethod('Ljava/lang/Object;', '<init>', 'V');
    const testMethodIdx = builder.addMethod('Lcom/example/Test;', 'create', 'Ljava/lang/Object;');

    // new-instance v0, type@objTypeIdx
    // invoke-direct {v0}, method@initMethodIdx   (count=1)
    // return-object v0
    const code = makeCode([
      0x0022, objTypeIdx,
      0x1070, initMethodIdx, 0x0000,
      0x0011,
    ], 1, 0);

    builder.addClass('Lcom/example/Test;', 'Ljava/lang/Object;', {
      directMethods: [{ methodIdx: testMethodIdx, accessFlags: 0x0009, code }],
    });

    const { interpreter, heap } = createInterpreter(builder.build());
    const result = interpreter.invoke('Lcom/example/Test;', 'create', '()Ljava/lang/Object;', []);
    expect(result.type).toBe('object');
    const ref = (result as { type: 'object'; ref: number }).ref;
    expect(heap.getClassDescriptor(ref)).toBe('Ljava/lang/Object;');
  });
});
