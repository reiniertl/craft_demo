/**
 * Integration: method A calls method B, B returns value -> A receives it
 */

import { SyntheticDexBuilder, makeCode, createInterpreter } from './test_helpers';
import { intValue } from '../../../src/core/types';

describe('Integration: method calls', () => {
  it('method A calls static method B and receives return value', () => {
    const builder = new SyntheticDexBuilder();

    // Method B: returns 42
    const methodB = builder.addMethod('Lcom/example/Test;', 'getFortyTwo', 'I');
    const codeB = makeCode([
      0x0013, 42,     // const/16 v0, 42
      0x000f,         // return v0
    ], 1, 0);

    // Method A: calls B, returns result
    const methodA = builder.addMethod('Lcom/example/Test;', 'callB', 'I');
    // invoke-static {}, method@methodB  (count=0)
    // move-result v0
    // return v0
    const codeA = makeCode([
      0x0071, methodB, 0x0000,  // invoke-static {}, method@B
      0x000a,                   // move-result v0
      0x000f,                   // return v0
    ], 1, 0);

    builder.addClass('Lcom/example/Test;', 'Ljava/lang/Object;', {
      directMethods: [
        { methodIdx: methodB, accessFlags: 0x0009, code: codeB },
        { methodIdx: methodA, accessFlags: 0x0009, code: codeA },
      ],
    });

    const { interpreter } = createInterpreter(builder.build());
    const result = interpreter.invoke('Lcom/example/Test;', 'callB', '()I', []);
    expect(result).toEqual(intValue(42));
  });
});
