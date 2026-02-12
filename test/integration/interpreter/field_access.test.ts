/**
 * Integration: new-instance, iput, iget -> correct field value
 */

import { SyntheticDexBuilder, makeCode, createInterpreter } from './test_helpers';
import { intValue } from '../../../src/core/types';

describe('Integration: field access', () => {
  it('stores and retrieves instance field via iput/iget', () => {
    const builder = new SyntheticDexBuilder();
    const objTypeIdx = builder.addType('Lcom/example/Holder;');
    const initMethodIdx = builder.addMethod('Ljava/lang/Object;', '<init>', 'V');
    builder.addType('Ljava/lang/Object;');
    const fieldIdx = builder.addField('Lcom/example/Holder;', 'value', 'I');
    const testMethodIdx = builder.addMethod('Lcom/example/Test;', 'test', 'I');

    // Registers: v0=obj, v1=value(42), v2=result
    // new-instance v0, Lcom/example/Holder;
    // invoke-direct {v0}, Object.<init>()V  (count=1)
    // const/16 v1, 42
    // iput v1, v0, field@fieldIdx       (vA=1 value, vB=0 obj) -> 0x0159
    // iget v2, v0, field@fieldIdx       (vA=2 dest, vB=0 obj) -> 0x0252
    // return v2
    const code = makeCode([
      0x0022, objTypeIdx,                      // new-instance v0
      0x1070, initMethodIdx, 0x0000,           // invoke-direct {v0}
      0x0113, 42,                              // const/16 v1, 42
      0x0159, fieldIdx,                        // iput v1, v0, field@fieldIdx
      0x0252, fieldIdx,                        // iget v2, v0, field@fieldIdx
      0x020f,                                  // return v2
    ], 3, 0);

    builder.addClass('Lcom/example/Holder;', 'Ljava/lang/Object;', {
      instanceFields: [{ fieldIdx, accessFlags: 0x0001 }],
    });
    builder.addClass('Lcom/example/Test;', 'Ljava/lang/Object;', {
      directMethods: [{ methodIdx: testMethodIdx, accessFlags: 0x0009, code }],
    });

    const { interpreter } = createInterpreter(builder.build());
    const result = interpreter.invoke('Lcom/example/Test;', 'test', '()I', []);
    expect(result).toEqual(intValue(42));
  });
});
