/**
 * Tests for java.lang.* shim implementations.
 */

import { ShimRegistry, InterpreterRef } from '../../../src/interpreter/shim_registry';
import { Heap } from '../../../src/interpreter/heap';
import { registerJavaLangShims } from '../../../src/shim/java/lang/index';
import { Value, intValue, objectRef, NULL_VALUE } from '../../../src/core/types';
import { ResolvedMethod } from '../../../src/interpreter/types';
import { StringIndexOutOfBoundsException } from '../../../src/interpreter/errors';

function makeMethod(
  classDesc: string,
  name: string,
  desc: string,
  isStatic: boolean = false
): ResolvedMethod {
  return {
    classDescriptor: classDesc,
    name,
    descriptor: desc,
    accessFlags: isStatic ? 0x0008 : 0,
    code: null,
    isShim: true,
  };
}

describe('java.lang.* shims', () => {
  let registry: ShimRegistry;
  let heap: Heap;
  let mockInterp: InterpreterRef;

  beforeEach(() => {
    registry = new ShimRegistry();
    heap = new Heap();
    registerJavaLangShims(registry);

    mockInterp = {
      invoke: (className, methodName, descriptor, args) => {
        const method = makeMethod(className, methodName, descriptor);
        return registry.invoke(method, mockInterp, heap, args);
      },
      getClassLoader: () => ({
        getClassObject: (desc: string) => {
          const ref = heap.allocate('Ljava/lang/Class;');
          heap.setField(ref, '__classDescriptor', {
            type: 'object',
            ref: heap.internString(desc),
          });
          return ref;
        },
      }),
    };
  });

  function invokeShim(
    classDesc: string,
    name: string,
    desc: string,
    args: Value[],
    isStatic: boolean = false
  ): Value {
    const method = makeMethod(classDesc, name, desc, isStatic);
    return registry.invoke(method, mockInterp, heap, args);
  }

  describe('java.lang.Object', () => {
    it('<init> does nothing', () => {
      const ref = heap.allocate('Ljava/lang/Object;');
      const result = invokeShim('Ljava/lang/Object;', '<init>', '()V', [objectRef(ref)]);
      expect(result).toEqual(NULL_VALUE);
    });

    it('hashCode returns object reference', () => {
      const ref = heap.allocate('Ljava/lang/Object;');
      const result = invokeShim('Ljava/lang/Object;', 'hashCode', '()I', [objectRef(ref)]);
      expect(result).toEqual(intValue(ref));
    });

    it('equals returns true for same reference', () => {
      const ref = heap.allocate('Ljava/lang/Object;');
      const result = invokeShim(
        'Ljava/lang/Object;', 'equals', '(Ljava/lang/Object;)Z',
        [objectRef(ref), objectRef(ref)]
      );
      expect(result).toEqual(intValue(1));
    });

    it('equals returns false for different references', () => {
      const ref1 = heap.allocate('Ljava/lang/Object;');
      const ref2 = heap.allocate('Ljava/lang/Object;');
      const result = invokeShim(
        'Ljava/lang/Object;', 'equals', '(Ljava/lang/Object;)Z',
        [objectRef(ref1), objectRef(ref2)]
      );
      expect(result).toEqual(intValue(0));
    });

    it('equals returns false for null', () => {
      const ref = heap.allocate('Ljava/lang/Object;');
      const result = invokeShim(
        'Ljava/lang/Object;', 'equals', '(Ljava/lang/Object;)Z',
        [objectRef(ref), NULL_VALUE]
      );
      expect(result).toEqual(intValue(0));
    });

    it('toString returns descriptor@hex format', () => {
      const ref = heap.allocate('Ljava/lang/Object;');
      const result = invokeShim(
        'Ljava/lang/Object;', 'toString', '()Ljava/lang/String;',
        [objectRef(ref)]
      );
      expect(result.type).toBe('object');
      const strRef = (result as { type: 'object'; ref: number }).ref;
      const str = heap.getStringValue(strRef);
      expect(str).toContain('Ljava/lang/Object;@');
    });
  });

  describe('java.lang.String', () => {
    function makeString(value: string): number {
      return heap.internString(value);
    }

    it('<init>()V creates empty string', () => {
      const ref = heap.allocate('Ljava/lang/String;');
      invokeShim('Ljava/lang/String;', '<init>', '()V', [objectRef(ref)]);
      expect(heap.getStringValue(ref)).toBe('');
    });

    it('<init>(String) copies value', () => {
      const sourceRef = makeString('copied');
      const ref = heap.allocate('Ljava/lang/String;');
      invokeShim('Ljava/lang/String;', '<init>', '(Ljava/lang/String;)V', [objectRef(ref), objectRef(sourceRef)]);
      expect(heap.getStringValue(ref)).toBe('copied');
    });

    it('length returns correct count', () => {
      const ref = makeString('hello');
      const result = invokeShim('Ljava/lang/String;', 'length', '()I', [objectRef(ref)]);
      expect(result).toEqual(intValue(5));
    });

    it('charAt returns character code', () => {
      const ref = makeString('ABC');
      const result = invokeShim('Ljava/lang/String;', 'charAt', '(I)C', [objectRef(ref), intValue(1)]);
      expect(result).toEqual(intValue(66)); // 'B' = 66
    });

    it('charAt throws on out of bounds', () => {
      const ref = makeString('ABC');
      expect(() =>
        invokeShim('Ljava/lang/String;', 'charAt', '(I)C', [objectRef(ref), intValue(5)])
      ).toThrow(StringIndexOutOfBoundsException);
    });

    it('equals returns true for same content', () => {
      const ref1 = makeString('test');
      const ref2 = heap.allocateString('test'); // Different ref, same content
      const result = invokeShim(
        'Ljava/lang/String;', 'equals', '(Ljava/lang/Object;)Z',
        [objectRef(ref1), objectRef(ref2)]
      );
      expect(result).toEqual(intValue(1));
    });

    it('equals returns false for different content', () => {
      const ref1 = makeString('hello');
      const ref2 = makeString('world');
      const result = invokeShim(
        'Ljava/lang/String;', 'equals', '(Ljava/lang/Object;)Z',
        [objectRef(ref1), objectRef(ref2)]
      );
      expect(result).toEqual(intValue(0));
    });

    it('hashCode is consistent', () => {
      const ref = makeString('test');
      const r1 = invokeShim('Ljava/lang/String;', 'hashCode', '()I', [objectRef(ref)]);
      const r2 = invokeShim('Ljava/lang/String;', 'hashCode', '()I', [objectRef(ref)]);
      expect(r1).toEqual(r2);
    });

    it('toString returns this', () => {
      const ref = makeString('hello');
      const result = invokeShim('Ljava/lang/String;', 'toString', '()Ljava/lang/String;', [objectRef(ref)]);
      expect(result).toEqual(objectRef(ref));
    });

    it('substring(I) extracts suffix', () => {
      const ref = makeString('hello world');
      const result = invokeShim(
        'Ljava/lang/String;', 'substring', '(I)Ljava/lang/String;',
        [objectRef(ref), intValue(6)]
      );
      expect(result.type).toBe('object');
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('world');
    });

    it('substring(II) extracts range', () => {
      const ref = makeString('hello world');
      const result = invokeShim(
        'Ljava/lang/String;', 'substring', '(II)Ljava/lang/String;',
        [objectRef(ref), intValue(0), intValue(5)]
      );
      expect(result.type).toBe('object');
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('hello');
    });

    it('concat joins strings', () => {
      const ref1 = makeString('hello ');
      const ref2 = makeString('world');
      const result = invokeShim(
        'Ljava/lang/String;', 'concat', '(Ljava/lang/String;)Ljava/lang/String;',
        [objectRef(ref1), objectRef(ref2)]
      );
      expect(result.type).toBe('object');
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('hello world');
    });
  });

  describe('java.lang.StringBuilder', () => {
    function createBuilder(): number {
      const ref = heap.allocate('Ljava/lang/StringBuilder;');
      invokeShim('Ljava/lang/StringBuilder;', '<init>', '()V', [objectRef(ref)]);
      return ref;
    }

    it('<init>()V creates empty builder', () => {
      const ref = createBuilder();
      const result = invokeShim(
        'Ljava/lang/StringBuilder;', 'toString', '()Ljava/lang/String;',
        [objectRef(ref)]
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('');
    });

    it('append(String) adds string', () => {
      const ref = createBuilder();
      const str = heap.internString('hello');
      invokeShim(
        'Ljava/lang/StringBuilder;', 'append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;',
        [objectRef(ref), objectRef(str)]
      );
      const result = invokeShim(
        'Ljava/lang/StringBuilder;', 'toString', '()Ljava/lang/String;',
        [objectRef(ref)]
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('hello');
    });

    it('append(int) converts and adds', () => {
      const ref = createBuilder();
      invokeShim(
        'Ljava/lang/StringBuilder;', 'append', '(I)Ljava/lang/StringBuilder;',
        [objectRef(ref), intValue(42)]
      );
      const result = invokeShim(
        'Ljava/lang/StringBuilder;', 'toString', '()Ljava/lang/String;',
        [objectRef(ref)]
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('42');
    });

    it('append(Object) calls toString', () => {
      const ref = createBuilder();
      const objRef = heap.allocate('Ljava/lang/Object;');
      invokeShim(
        'Ljava/lang/StringBuilder;', 'append', '(Ljava/lang/Object;)Ljava/lang/StringBuilder;',
        [objectRef(ref), objectRef(objRef)]
      );
      const result = invokeShim(
        'Ljava/lang/StringBuilder;', 'toString', '()Ljava/lang/String;',
        [objectRef(ref)]
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      const str = heap.getStringValue(strRef);
      // Should contain the Object.toString() output (descriptor@hex)
      expect(str).toContain('Ljava/lang/Object;@');
    });

    it('chained appends work correctly', () => {
      const ref = createBuilder();
      const hello = heap.internString('hello');
      const space = heap.internString(' ');
      const world = heap.internString('world');

      invokeShim(
        'Ljava/lang/StringBuilder;', 'append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;',
        [objectRef(ref), objectRef(hello)]
      );
      invokeShim(
        'Ljava/lang/StringBuilder;', 'append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;',
        [objectRef(ref), objectRef(space)]
      );
      invokeShim(
        'Ljava/lang/StringBuilder;', 'append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;',
        [objectRef(ref), objectRef(world)]
      );

      const result = invokeShim(
        'Ljava/lang/StringBuilder;', 'toString', '()Ljava/lang/String;',
        [objectRef(ref)]
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('hello world');
    });

    it('length returns correct value', () => {
      const ref = createBuilder();
      const str = heap.internString('test');
      invokeShim(
        'Ljava/lang/StringBuilder;', 'append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;',
        [objectRef(ref), objectRef(str)]
      );
      const result = invokeShim(
        'Ljava/lang/StringBuilder;', 'length', '()I',
        [objectRef(ref)]
      );
      expect(result).toEqual(intValue(4));
    });
  });

  describe('java.lang.Class', () => {
    function createClassObject(descriptor: string): number {
      const ref = heap.allocate('Ljava/lang/Class;');
      heap.setField(ref, '__classDescriptor', {
        type: 'object',
        ref: heap.internString(descriptor),
      });
      return ref;
    }

    it('getName returns dotted name', () => {
      const ref = createClassObject('Lcom/example/Foo;');
      const result = invokeShim(
        'Ljava/lang/Class;', 'getName', '()Ljava/lang/String;',
        [objectRef(ref)]
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('com.example.Foo');
    });

    it('getSimpleName returns short name', () => {
      const ref = createClassObject('Lcom/example/Foo;');
      const result = invokeShim(
        'Ljava/lang/Class;', 'getSimpleName', '()Ljava/lang/String;',
        [objectRef(ref)]
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('Foo');
    });

    it('toString returns class prefix', () => {
      const ref = createClassObject('Lcom/example/Foo;');
      const result = invokeShim(
        'Ljava/lang/Class;', 'toString', '()Ljava/lang/String;',
        [objectRef(ref)]
      );
      const strRef = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getStringValue(strRef)).toBe('class com.example.Foo');
    });
  });

  describe('java.lang.System', () => {
    it('currentTimeMillis returns timestamp', () => {
      const before = Date.now();
      const result = invokeShim(
        'Ljava/lang/System;', 'currentTimeMillis', '()J',
        [], true
      );
      const after = Date.now();
      expect(result.type).toBe('long');
      const time = Number((result as { type: 'long'; value: bigint }).value);
      expect(time).toBeGreaterThanOrEqual(before);
      expect(time).toBeLessThanOrEqual(after);
    });

    it('identityHashCode returns reference', () => {
      const ref = heap.allocate('Ljava/lang/Object;');
      const result = invokeShim(
        'Ljava/lang/System;', 'identityHashCode', '(Ljava/lang/Object;)I',
        [objectRef(ref)], true
      );
      expect(result).toEqual(intValue(ref));
    });

    it('identityHashCode returns 0 for null', () => {
      const result = invokeShim(
        'Ljava/lang/System;', 'identityHashCode', '(Ljava/lang/Object;)I',
        [NULL_VALUE], true
      );
      expect(result).toEqual(intValue(0));
    });

    it('arraycopy copies elements', () => {
      const src = heap.allocateArray('I', 5);
      const dst = heap.allocateArray('I', 5);

      for (let i = 0; i < 5; i++) {
        heap.setArrayElement(src, i, intValue(i * 10));
      }

      invokeShim(
        'Ljava/lang/System;', 'arraycopy',
        '(Ljava/lang/Object;ILjava/lang/Object;II)V',
        [objectRef(src), intValue(1), objectRef(dst), intValue(2), intValue(3)],
        true
      );

      expect(heap.getArrayElement(dst, 0)).toEqual(intValue(0));
      expect(heap.getArrayElement(dst, 1)).toEqual(intValue(0));
      expect(heap.getArrayElement(dst, 2)).toEqual(intValue(10));
      expect(heap.getArrayElement(dst, 3)).toEqual(intValue(20));
      expect(heap.getArrayElement(dst, 4)).toEqual(intValue(30));
    });
  });
});
