/**
 * CRAFT - java.lang.StringBuilder Shim
 * Mutable string builder for efficient concatenation.
 */

import { ShimRegistry } from '../../../interpreter/shim_registry';

const STRINGBUILDER_CLASS = 'Ljava/lang/StringBuilder;';
const BUILDER_VALUE_FIELD = '__builderValue';

export function registerStringBuilderShim(registry: ShimRegistry): void {
  // <init>()V
  registry.register(
    STRINGBUILDER_CLASS,
    '<init>',
    '()V',
    (interp, heap, thisRef, args) => {
      heap.setField(thisRef, BUILDER_VALUE_FIELD, {
        type: 'object',
        ref: heap.internString(''),
      });
      return { type: 'null' };
    }
  );

  // <init>(Ljava/lang/String;)V
  registry.register(
    STRINGBUILDER_CLASS,
    '<init>',
    '(Ljava/lang/String;)V',
    (interp, heap, thisRef, args) => {
      const strRef = (args[0] as { type: 'object'; ref: number }).ref;
      const value = heap.getStringValue(strRef);
      heap.setField(thisRef, BUILDER_VALUE_FIELD, {
        type: 'object',
        ref: heap.internString(value),
      });
      return { type: 'null' };
    }
  );

  // append(Ljava/lang/String;)Ljava/lang/StringBuilder;
  registry.register(
    STRINGBUILDER_CLASS,
    'append',
    '(Ljava/lang/String;)Ljava/lang/StringBuilder;',
    (interp, heap, thisRef, args) => {
      const currentField = heap.getField(thisRef, BUILDER_VALUE_FIELD);
      const currentRef = (currentField as { type: 'object'; ref: number }).ref;
      const current = heap.getStringValue(currentRef);

      let appendStr: string;
      if (args[0].type === 'null') {
        appendStr = 'null';
      } else {
        const appendRef = (args[0] as { type: 'object'; ref: number }).ref;
        appendStr = heap.getStringValue(appendRef);
      }

      heap.setField(thisRef, BUILDER_VALUE_FIELD, {
        type: 'object',
        ref: heap.internString(current + appendStr),
      });

      return { type: 'object', ref: thisRef };
    }
  );

  // append(I)Ljava/lang/StringBuilder;
  registry.register(
    STRINGBUILDER_CLASS,
    'append',
    '(I)Ljava/lang/StringBuilder;',
    (interp, heap, thisRef, args) => {
      const currentField = heap.getField(thisRef, BUILDER_VALUE_FIELD);
      const currentRef = (currentField as { type: 'object'; ref: number }).ref;
      const current = heap.getStringValue(currentRef);

      const intValue = (args[0] as { type: 'int'; value: number }).value;

      heap.setField(thisRef, BUILDER_VALUE_FIELD, {
        type: 'object',
        ref: heap.internString(current + intValue.toString()),
      });

      return { type: 'object', ref: thisRef };
    }
  );

  // append(J)Ljava/lang/StringBuilder;
  registry.register(
    STRINGBUILDER_CLASS,
    'append',
    '(J)Ljava/lang/StringBuilder;',
    (interp, heap, thisRef, args) => {
      const currentField = heap.getField(thisRef, BUILDER_VALUE_FIELD);
      const currentRef = (currentField as { type: 'object'; ref: number }).ref;
      const current = heap.getStringValue(currentRef);

      const longValue = (args[0] as { type: 'long'; value: bigint }).value;

      heap.setField(thisRef, BUILDER_VALUE_FIELD, {
        type: 'object',
        ref: heap.internString(current + longValue.toString()),
      });

      return { type: 'object', ref: thisRef };
    }
  );

  // append(Ljava/lang/Object;)Ljava/lang/StringBuilder;
  registry.register(
    STRINGBUILDER_CLASS,
    'append',
    '(Ljava/lang/Object;)Ljava/lang/StringBuilder;',
    (interp, heap, thisRef, args) => {
      const currentField = heap.getField(thisRef, BUILDER_VALUE_FIELD);
      const currentRef = (currentField as { type: 'object'; ref: number }).ref;
      const current = heap.getStringValue(currentRef);

      let appendStr: string;
      if (args[0].type === 'null') {
        appendStr = 'null';
      } else {
        const objRef = (args[0] as { type: 'object'; ref: number }).ref;
        const result = interp.invoke(
          heap.getClassDescriptor(objRef)!,
          'toString',
          '()Ljava/lang/String;',
          [args[0]]
        );
        appendStr = heap.getStringValue(
          (result as { type: 'object'; ref: number }).ref
        );
      }

      heap.setField(thisRef, BUILDER_VALUE_FIELD, {
        type: 'object',
        ref: heap.internString(current + appendStr),
      });

      return { type: 'object', ref: thisRef };
    }
  );

  // toString()Ljava/lang/String;
  registry.register(
    STRINGBUILDER_CLASS,
    'toString',
    '()Ljava/lang/String;',
    (interp, heap, thisRef, args) => {
      return heap.getField(thisRef, BUILDER_VALUE_FIELD);
    }
  );

  // length()I
  registry.register(
    STRINGBUILDER_CLASS,
    'length',
    '()I',
    (interp, heap, thisRef, args) => {
      const valueField = heap.getField(thisRef, BUILDER_VALUE_FIELD);
      const valueRef = (valueField as { type: 'object'; ref: number }).ref;
      const value = heap.getStringValue(valueRef);
      return { type: 'int', value: value.length };
    }
  );
}
