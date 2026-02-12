/**
 * Integration: sput, sget -> correct static field value
 */

import { SyntheticDexBuilder, makeCode, createInterpreter } from './test_helpers';
import { intValue } from '../../../src/core/types';

describe('Integration: static field', () => {
  it('stores and retrieves static field via sput/sget', () => {
    const builder = new SyntheticDexBuilder();
    const fieldIdx = builder.addField('Lcom/example/Foo;', 'counter', 'I');
    const testMethodIdx = builder.addMethod('Lcom/example/Test;', 'test', 'I');

    // const/16 v0, 99
    // sput v0, field@fieldIdx
    // const/4 v0, 0         (clear v0)
    // sget v1, field@fieldIdx
    // return v1
    const code = makeCode([
      0x0013, 99,           // const/16 v0, 99
      0x0067, fieldIdx,     // sput v0, field@fieldIdx
      0x0012,               // const/4 v0, 0
      0x0160, fieldIdx,     // sget v1, field@fieldIdx
      0x010f,               // return v1
    ], 2, 0);

    builder.addClass('Lcom/example/Foo;', 'Ljava/lang/Object;', {
      staticFields: [{ fieldIdx, accessFlags: 0x0009 }],
    });
    builder.addClass('Lcom/example/Test;', 'Ljava/lang/Object;', {
      directMethods: [{ methodIdx: testMethodIdx, accessFlags: 0x0009, code }],
    });

    const { interpreter } = createInterpreter(builder.build());
    const result = interpreter.invoke('Lcom/example/Test;', 'test', '()I', []);
    expect(result).toEqual(intValue(99));
  });
});
