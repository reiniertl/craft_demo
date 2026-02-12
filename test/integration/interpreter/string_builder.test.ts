/**
 * Integration: new StringBuilder, append chain, toString -> correct string
 */

import { SyntheticDexBuilder, makeCode, createInterpreter } from './test_helpers';
import { objectRef } from '../../../src/core/types';

describe('Integration: StringBuilder', () => {
  it('builds string via shim StringBuilder append chain and toString', () => {
    const builder = new SyntheticDexBuilder();
    builder.addType('Ljava/lang/StringBuilder;');
    builder.addType('Ljava/lang/String;');
    const dex = builder.build();

    const { interpreter, heap } = createInterpreter(dex);

    // Create StringBuilder via shim
    const sbRef = heap.allocate('Ljava/lang/StringBuilder;');
    interpreter.invoke('Ljava/lang/StringBuilder;', '<init>', '()V', [objectRef(sbRef)]);

    // Append "Hello"
    const helloRef = heap.internString('Hello');
    interpreter.invoke(
      'Ljava/lang/StringBuilder;', 'append',
      '(Ljava/lang/String;)Ljava/lang/StringBuilder;',
      [objectRef(sbRef), objectRef(helloRef)]
    );

    // Append ", "
    const commaRef = heap.internString(', ');
    interpreter.invoke(
      'Ljava/lang/StringBuilder;', 'append',
      '(Ljava/lang/String;)Ljava/lang/StringBuilder;',
      [objectRef(sbRef), objectRef(commaRef)]
    );

    // Append "World!"
    const worldRef = heap.internString('World!');
    interpreter.invoke(
      'Ljava/lang/StringBuilder;', 'append',
      '(Ljava/lang/String;)Ljava/lang/StringBuilder;',
      [objectRef(sbRef), objectRef(worldRef)]
    );

    // toString
    const result = interpreter.invoke(
      'Ljava/lang/StringBuilder;', 'toString',
      '()Ljava/lang/String;',
      [objectRef(sbRef)]
    );

    expect(result.type).toBe('object');
    const strRef = (result as { type: 'object'; ref: number }).ref;
    expect(heap.getStringValue(strRef)).toBe('Hello, World!');
  });
});
