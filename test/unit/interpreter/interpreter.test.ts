/**
 * Tests for the Interpreter - main execution loop with synthetic DEX data.
 */

import { Interpreter } from '../../../src/interpreter/interpreter';
import { Heap } from '../../../src/interpreter/heap';
import { ShimRegistry } from '../../../src/interpreter/shim_registry';
import { initializeShimRegistry } from '../../../src/interpreter/shim_init';
import { Value, intValue, objectRef, NULL_VALUE } from '../../../src/core/types';
import { DexParser } from '../../../src/parser/dex_parser';
import { CodeItem } from '../../../src/parser/dex_types';

/**
 * Creates a minimal mock DexParser that provides pre-defined methods.
 * This lets us test the interpreter without real DEX files.
 */
class SyntheticDexBuilder {
  private strings: string[] = [];
  private types: string[] = [];
  private protos: { shortyIdx: number; returnTypeIdx: number; params: number[] }[] = [];
  private methods: { classIdx: number; protoIdx: number; nameIdx: number }[] = [];
  private fields: { classIdx: number; typeIdx: number; nameIdx: number }[] = [];
  private classDefs: {
    descriptor: string;
    superClass: string | null;
    staticFields: { fieldIdx: number; accessFlags: number }[];
    instanceFields: { fieldIdx: number; accessFlags: number }[];
    directMethods: { methodIdx: number; accessFlags: number; code: CodeItem | null }[];
    virtualMethods: { methodIdx: number; accessFlags: number; code: CodeItem | null }[];
  }[] = [];

  addString(s: string): number {
    const idx = this.strings.indexOf(s);
    if (idx >= 0) return idx;
    this.strings.push(s);
    return this.strings.length - 1;
  }

  addType(descriptor: string): number {
    const existing = this.types.indexOf(descriptor);
    if (existing >= 0) return existing;
    this.addString(descriptor);
    this.types.push(descriptor);
    return this.types.length - 1;
  }

  addProto(returnType: string, paramTypes: string[] = []): number {
    const returnTypeIdx = this.addType(returnType);
    const params = paramTypes.map(p => this.addType(p));
    const shortyStr = this.buildShorty(returnType, paramTypes);
    const shortyIdx = this.addString(shortyStr);
    this.protos.push({ shortyIdx, returnTypeIdx, params });
    return this.protos.length - 1;
  }

  addMethod(className: string, name: string, returnType: string, paramTypes: string[] = []): number {
    const classIdx = this.addType(className);
    const nameIdx = this.addString(name);
    const protoIdx = this.addProto(returnType, paramTypes);
    this.methods.push({ classIdx, protoIdx, nameIdx });
    return this.methods.length - 1;
  }

  addField(className: string, fieldName: string, fieldType: string): number {
    const classIdx = this.addType(className);
    const nameIdx = this.addString(fieldName);
    const typeIdx = this.addType(fieldType);
    this.fields.push({ classIdx, typeIdx, nameIdx });
    return this.fields.length - 1;
  }

  addClass(
    descriptor: string,
    superClass: string | null,
    config: {
      staticFields?: { fieldIdx: number; accessFlags: number }[];
      instanceFields?: { fieldIdx: number; accessFlags: number }[];
      directMethods?: { methodIdx: number; accessFlags: number; code: CodeItem | null }[];
      virtualMethods?: { methodIdx: number; accessFlags: number; code: CodeItem | null }[];
    } = {}
  ): void {
    this.addType(descriptor);
    if (superClass) this.addType(superClass);
    this.classDefs.push({
      descriptor,
      superClass,
      staticFields: config.staticFields || [],
      instanceFields: config.instanceFields || [],
      directMethods: config.directMethods || [],
      virtualMethods: config.virtualMethods || [],
    });
  }

  /**
   * Build a mock DexParser. We override the methods the interpreter uses.
   */
  build(): DexParser {
    const self = this;

    function getClassDefsImpl() {
      return self.classDefs.map((cd, _i) => ({
        classIdx: self.types.indexOf(cd.descriptor),
        accessFlags: 0x0001,
        superclassIdx: cd.superClass ? self.types.indexOf(cd.superClass) : 0xFFFFFFFF,
        interfacesOff: 0,
        sourceFileIdx: 0xFFFFFFFF,
        annotationsOff: 0,
        classDataOff: 1,
        staticValuesOff: 0,
      }));
    }

    const mock = {
      parseHeader() {
        return {
          stringIdsSize: self.strings.length,
          typeIdsSize: self.types.length,
          protoIdsSize: self.protos.length,
          methodIdsSize: self.methods.length,
          fieldIdsSize: self.fields.length,
          classDefsSize: self.classDefs.length,
        };
      },
      getString(idx: number) {
        return self.strings[idx] || '';
      },
      getTypeName(idx: number) {
        return self.types[idx] || '';
      },
      getMethodId(idx: number) {
        return self.methods[idx] || { classIdx: 0, protoIdx: 0, nameIdx: 0 };
      },
      getFieldId(idx: number) {
        return self.fields[idx] || { classIdx: 0, typeIdx: 0, nameIdx: 0 };
      },
      getProtoId(idx: number) {
        const proto = self.protos[idx];
        return proto ? {
          shortyIdx: proto.shortyIdx,
          returnTypeIdx: proto.returnTypeIdx,
          parametersOff: proto.params.length > 0 ? 1 : 0, // non-zero if params exist
        } : { shortyIdx: 0, returnTypeIdx: 0, parametersOff: 0 };
      },
      getProtoParameters(proto: any) {
        // Find the proto by matching returnTypeIdx
        for (const p of self.protos) {
          if (p.returnTypeIdx === proto.returnTypeIdx && p.shortyIdx === proto.shortyIdx) {
            return p.params;
          }
        }
        return [];
      },
      getClassDefs() {
        return getClassDefsImpl();
      },
      getClassDef(className: string) {
        const defs = getClassDefsImpl();
        for (let i = 0; i < self.classDefs.length; i++) {
          if (self.classDefs[i].descriptor === className) {
            return defs[i];
          }
        }
        return null;
      },
      getClassDefByIndex(idx: number) {
        return getClassDefsImpl()[idx];
      },
      getClassData(classDef: any) {
        const typeName = self.types[classDef.classIdx];
        const cd = self.classDefs.find(c => c.descriptor === typeName);
        if (!cd) return { staticFields: [], instanceFields: [], directMethods: [], virtualMethods: [] };
        return {
          staticFields: cd.staticFields,
          instanceFields: cd.instanceFields,
          directMethods: cd.directMethods.map(m => ({
            methodIdx: m.methodIdx,
            accessFlags: m.accessFlags,
            codeOff: m.code ? 1 : 0, // non-zero if code exists
          })),
          virtualMethods: cd.virtualMethods.map(m => ({
            methodIdx: m.methodIdx,
            accessFlags: m.accessFlags,
            codeOff: m.code ? 1 : 0,
          })),
        };
      },
      getMethodCode(codeOff: number) {
        // Find the method with this codeOff marker
        for (const cd of self.classDefs) {
          for (const m of [...cd.directMethods, ...cd.virtualMethods]) {
            if (m.code && codeOff !== 0) {
              return m.code;
            }
          }
        }
        return null;
      },
    } as unknown as DexParser;

    // Override getMethodCode to properly find code by method index
    const originalGetClassData = mock.getClassData.bind(mock);
    const codeMap = new Map<number, CodeItem>();

    // Build code map from method indices
    for (const cd of self.classDefs) {
      for (const m of [...cd.directMethods, ...cd.virtualMethods]) {
        if (m.code) {
          codeMap.set(m.methodIdx, m.code);
        }
      }
    }

    // Override getMethodCode to use a unique offset per method
    (mock as any).getMethodCode = function(codeOff: number) {
      if (codeOff === 0) return null;
      // codeOff is used as a key - we encode method index + 1 as the offset
      return codeMap.get(codeOff - 1) || null;
    };

    // Fix getClassData to use proper codeOff
    (mock as any).getClassData = function(classDef: any) {
      const typeName = self.types[classDef.classIdx];
      const cd = self.classDefs.find(c => c.descriptor === typeName);
      if (!cd) return { staticFields: [], instanceFields: [], directMethods: [], virtualMethods: [] };
      return {
        staticFields: cd.staticFields,
        instanceFields: cd.instanceFields,
        directMethods: cd.directMethods.map(m => ({
          methodIdx: m.methodIdx,
          accessFlags: m.accessFlags,
          codeOff: m.code ? m.methodIdx + 1 : 0,
        })),
        virtualMethods: cd.virtualMethods.map(m => ({
          methodIdx: m.methodIdx,
          accessFlags: m.accessFlags,
          codeOff: m.code ? m.methodIdx + 1 : 0,
        })),
      };
    };

    return mock;
  }

  private buildShorty(returnType: string, paramTypes: string[]): string {
    const shortyChar = (t: string) => {
      switch (t) {
        case 'V': return 'V';
        case 'Z': return 'Z';
        case 'B': return 'B';
        case 'S': return 'S';
        case 'C': return 'C';
        case 'I': return 'I';
        case 'J': return 'J';
        case 'F': return 'F';
        case 'D': return 'D';
        default: return 'L';
      }
    };
    return shortyChar(returnType) + paramTypes.map(shortyChar).join('');
  }
}

function makeCode(insns: number[], registersSize: number, insSize: number = 0): CodeItem {
  return {
    registersSize,
    insSize,
    outsSize: 0,
    triesSize: 0,
    debugInfoOff: 0,
    insnsSize: insns.length,
    insns: new Uint16Array(insns),
    tries: [],
    handlers: [],
  };
}

describe('Interpreter', () => {
  describe('Simple method execution', () => {
    it('executes const/4 + return (returns int 5)', () => {
      const builder = new SyntheticDexBuilder();
      const methodIdx = builder.addMethod('Lcom/example/Test;', 'test', 'I');

      // const/4 v0, 5; return v0
      const code = makeCode([0x5012, 0x000f], 1, 0);

      builder.addClass('Lcom/example/Test;', 'Ljava/lang/Object;', {
        directMethods: [
          { methodIdx, accessFlags: 0x0009, code }, // PUBLIC STATIC
        ],
      });

      const dex = builder.build();
      const heap = new Heap();
      const shimRegistry = initializeShimRegistry();
      const interpreter = new Interpreter(dex, heap, shimRegistry);

      const result = interpreter.invoke('Lcom/example/Test;', 'test', '()I', []);
      expect(result).toEqual(intValue(5));
    });

    it('executes const/16 + return (returns int 1000)', () => {
      const builder = new SyntheticDexBuilder();
      const methodIdx = builder.addMethod('Lcom/example/Test;', 'getValue', 'I');

      // const/16 v0, 1000; return v0
      const code = makeCode([0x0013, 0x03e8, 0x000f], 1, 0);

      builder.addClass('Lcom/example/Test;', 'Ljava/lang/Object;', {
        directMethods: [
          { methodIdx, accessFlags: 0x0009, code },
        ],
      });

      const dex = builder.build();
      const heap = new Heap();
      const shimRegistry = initializeShimRegistry();
      const interpreter = new Interpreter(dex, heap, shimRegistry);

      const result = interpreter.invoke('Lcom/example/Test;', 'getValue', '()I', []);
      expect(result).toEqual(intValue(1000));
    });

    it('executes return-void', () => {
      const builder = new SyntheticDexBuilder();
      const methodIdx = builder.addMethod('Lcom/example/Test;', 'doNothing', 'V');

      // return-void
      const code = makeCode([0x000e], 0, 0);

      builder.addClass('Lcom/example/Test;', 'Ljava/lang/Object;', {
        directMethods: [
          { methodIdx, accessFlags: 0x0009, code },
        ],
      });

      const dex = builder.build();
      const heap = new Heap();
      const shimRegistry = initializeShimRegistry();
      const interpreter = new Interpreter(dex, heap, shimRegistry);

      const result = interpreter.invoke('Lcom/example/Test;', 'doNothing', '()V', []);
      expect(result).toEqual(NULL_VALUE);
    });
  });

  describe('Object operations', () => {
    it('creates and returns object via new-instance + invoke-direct <init>', () => {
      const builder = new SyntheticDexBuilder();

      // We need type index for Ljava/lang/Object; and the <init> method
      const objTypeIdx = builder.addType('Ljava/lang/Object;');
      const initMethodIdx = builder.addMethod('Ljava/lang/Object;', '<init>', 'V');
      const testMethodIdx = builder.addMethod('Lcom/example/Test;', 'createObj', 'Ljava/lang/Object;');

      // new-instance v0, Ljava/lang/Object; (type@objTypeIdx)
      // invoke-direct {v0}, Ljava/lang/Object;-><init>()V (method@initMethodIdx)
      // return-object v0
      const code = makeCode([
        0x0022, objTypeIdx,                        // new-instance v0, type@objTypeIdx
        0x1070 | (0 << 8), initMethodIdx, 0x0000,  // invoke-direct {v0}, method@initMethodIdx
        0x0011,                                     // return-object v0
      ], 1, 0);

      builder.addClass('Lcom/example/Test;', 'Ljava/lang/Object;', {
        directMethods: [
          { methodIdx: testMethodIdx, accessFlags: 0x0009, code },
        ],
      });

      const dex = builder.build();
      const heap = new Heap();
      const shimRegistry = initializeShimRegistry();
      const interpreter = new Interpreter(dex, heap, shimRegistry);

      const result = interpreter.invoke(
        'Lcom/example/Test;', 'createObj', '()Ljava/lang/Object;', []
      );
      expect(result.type).toBe('object');
      const ref = (result as { type: 'object'; ref: number }).ref;
      expect(heap.getClassDescriptor(ref)).toBe('Ljava/lang/Object;');
    });
  });

  describe('Shim method invocation', () => {
    it('invokes Object.hashCode via shim', () => {
      const heap = new Heap();
      const shimRegistry = initializeShimRegistry();

      // Allocate an object
      const ref = heap.allocate('Ljava/lang/Object;');

      // Create a minimal dex
      const builder = new SyntheticDexBuilder();
      builder.addType('Ljava/lang/Object;');
      const dex = builder.build();

      const interpreter = new Interpreter(dex, heap, shimRegistry);
      const result = interpreter.invoke(
        'Ljava/lang/Object;',
        'hashCode',
        '()I',
        [objectRef(ref)]
      );
      expect(result).toEqual(intValue(ref));
    });

    it('StringBuilder builds string correctly via shims', () => {
      const heap = new Heap();
      const shimRegistry = initializeShimRegistry();

      const builder = new SyntheticDexBuilder();
      builder.addType('Ljava/lang/StringBuilder;');
      builder.addType('Ljava/lang/String;');
      const dex = builder.build();

      const interpreter = new Interpreter(dex, heap, shimRegistry);

      // Create StringBuilder
      const sbRef = heap.allocate('Ljava/lang/StringBuilder;');
      interpreter.invoke(
        'Ljava/lang/StringBuilder;', '<init>', '()V',
        [objectRef(sbRef)]
      );

      // Append "hello"
      const helloRef = heap.internString('hello');
      interpreter.invoke(
        'Ljava/lang/StringBuilder;', 'append',
        '(Ljava/lang/String;)Ljava/lang/StringBuilder;',
        [objectRef(sbRef), objectRef(helloRef)]
      );

      // Append " "
      const spaceRef = heap.internString(' ');
      interpreter.invoke(
        'Ljava/lang/StringBuilder;', 'append',
        '(Ljava/lang/String;)Ljava/lang/StringBuilder;',
        [objectRef(sbRef), objectRef(spaceRef)]
      );

      // Append "world"
      const worldRef = heap.internString('world');
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
      expect(heap.getStringValue(strRef)).toBe('hello world');
    });
  });
});
