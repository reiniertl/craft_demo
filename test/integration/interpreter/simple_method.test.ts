/**
 * Integration: Execute const/4 v0, 5; return v0 -> returns { type: 'int', value: 5 }
 */

import { SyntheticDexBuilder, makeCode, createInterpreter } from './test_helpers';
import { intValue } from '../../../src/core/types';

describe('Integration: simple method', () => {
  it('executes const/4 v0, 5; return v0 and returns 5', () => {
    const builder = new SyntheticDexBuilder();
    const methodIdx = builder.addMethod('Lcom/example/Test;', 'test', 'I');
    // const/4 v0, 5  ->  0x5012
    // return v0       ->  0x000f
    const code = makeCode([0x5012, 0x000f], 1, 0);
    builder.addClass('Lcom/example/Test;', 'Ljava/lang/Object;', {
      directMethods: [{ methodIdx, accessFlags: 0x0009, code }],
    });

    const { interpreter } = createInterpreter(builder.build());
    const result = interpreter.invoke('Lcom/example/Test;', 'test', '()I', []);
    expect(result).toEqual(intValue(5));
  });
});
