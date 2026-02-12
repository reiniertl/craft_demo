/**
 * Integration: invoke-static -> static method executes and returns
 */

import { SyntheticDexBuilder, makeCode, createInterpreter } from './test_helpers';
import { intValue } from '../../../src/core/types';

describe('Integration: static method', () => {
  it('invoke-static calls static method which computes and returns value', () => {
    const builder = new SyntheticDexBuilder();

    // static helper: returns const 7
    const helperIdx = builder.addMethod('Lcom/example/Util;', 'seven', 'I');
    const helperCode = makeCode([
      0x7012,     // const/4 v0, 7
      0x000f,     // return v0
    ], 1, 0);

    // main: calls Util.seven() and returns it
    const mainIdx = builder.addMethod('Lcom/example/Test;', 'main', 'I');
    const mainCode = makeCode([
      0x0071, helperIdx, 0x0000,  // invoke-static {}, Util.seven()
      0x000a,                     // move-result v0
      0x000f,                     // return v0
    ], 1, 0);

    builder.addClass('Lcom/example/Util;', 'Ljava/lang/Object;', {
      directMethods: [{ methodIdx: helperIdx, accessFlags: 0x0009, code: helperCode }],
    });
    builder.addClass('Lcom/example/Test;', 'Ljava/lang/Object;', {
      directMethods: [{ methodIdx: mainIdx, accessFlags: 0x0009, code: mainCode }],
    });

    const { interpreter } = createInterpreter(builder.build());
    const result = interpreter.invoke('Lcom/example/Test;', 'main', '()I', []);
    expect(result).toEqual(intValue(7));
  });
});
