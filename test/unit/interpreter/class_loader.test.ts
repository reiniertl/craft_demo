/**
 * Tests for ClassLoader - class/method/field resolution from DEX.
 */

import { ClassLoader } from '../../../src/interpreter/class_loader';
import { ShimRegistry } from '../../../src/interpreter/shim_registry';
import { Heap } from '../../../src/interpreter/heap';
import { DexParser } from '../../../src/parser/dex_parser';
import { Value, intValue, objectRef, NULL_VALUE } from '../../../src/core/types';
import { initializeShimRegistry } from '../../../src/interpreter/shim_init';
import { ClassNotFoundException, NoSuchMethodError } from '../../../src/interpreter/errors';
import { ResolvedMethod } from '../../../src/interpreter/types';
import { CodeItem } from '../../../src/parser/dex_types';

/**
 * Minimal mock DexParser for ClassLoader tests.
 */
class MockDex {
  strings: string[] = [];
  types: string[] = [];
  protos: { shortyIdx: number; returnTypeIdx: number; params: number[] }[] = [];
  methods: { classIdx: number; protoIdx: number; nameIdx: number }[] = [];
  fields: { classIdx: number; typeIdx: number; nameIdx: number }[] = [];
  classDefs: {
    descriptor: string;
    superClass: string | null;
    accessFlags: number;
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

  addType(d: string): number {
    const idx = this.types.indexOf(d);
    if (idx >= 0) return idx;
    this.addString(d);
    this.types.push(d);
    return this.types.length - 1;
  }

  addProto(ret: string, params: string[] = []): number {
    const retIdx = this.addType(ret);
    const pIdxs = params.map(p => this.addType(p));
    const shorty = this.addString('S' + this.protos.length);
    this.protos.push({ shortyIdx: shorty, returnTypeIdx: retIdx, params: pIdxs });
    return this.protos.length - 1;
  }

  addMethod(cls: string, name: string, ret: string, params: string[] = []): number {
    const classIdx = this.addType(cls);
    const nameIdx = this.addString(name);
    const protoIdx = this.addProto(ret, params);
    this.methods.push({ classIdx, protoIdx, nameIdx });
    return this.methods.length - 1;
  }

  addField(cls: string, name: string, type: string): number {
    const classIdx = this.addType(cls);
    const nameIdx = this.addString(name);
    const typeIdx = this.addType(type);
    this.fields.push({ classIdx, typeIdx, nameIdx });
    return this.fields.length - 1;
  }

  addClass(desc: string, superClass: string | null, config: {
    accessFlags?: number;
    staticFields?: { fieldIdx: number; accessFlags: number }[];
    instanceFields?: { fieldIdx: number; accessFlags: number }[];
    directMethods?: { methodIdx: number; accessFlags: number; code: CodeItem | null }[];
    virtualMethods?: { methodIdx: number; accessFlags: number; code: CodeItem | null }[];
  } = {}): void {
    this.addType(desc);
    if (superClass) this.addType(superClass);
    this.classDefs.push({
      descriptor: desc,
      superClass,
      accessFlags: config.accessFlags || 0x0001,
      staticFields: config.staticFields || [],
      instanceFields: config.instanceFields || [],
      directMethods: config.directMethods || [],
      virtualMethods: config.virtualMethods || [],
    });
  }

  build(): DexParser {
    const self = this;

    function getClassDefsArray() {
      return self.classDefs.map(cd => ({
        classIdx: self.types.indexOf(cd.descriptor),
        accessFlags: cd.accessFlags,
        superclassIdx: cd.superClass ? self.types.indexOf(cd.superClass) : 0xFFFFFFFF,
        interfacesOff: 0,
        sourceFileIdx: 0xFFFFFFFF,
        annotationsOff: 0,
        classDataOff: 1,
        staticValuesOff: 0,
      }));
    }

    // Build codeOff -> CodeItem map using methodIdx+1 as key
    const codeMap = new Map<number, CodeItem>();
    for (const cd of self.classDefs) {
      for (const m of [...cd.directMethods, ...cd.virtualMethods]) {
        if (m.code) codeMap.set(m.methodIdx + 1, m.code);
      }
    }

    return {
      parseHeader: () => ({
        stringIdsSize: self.strings.length,
        typeIdsSize: self.types.length,
        protoIdsSize: self.protos.length,
        methodIdsSize: self.methods.length,
        fieldIdsSize: self.fields.length,
        classDefsSize: self.classDefs.length,
      }),
      getString: (idx: number) => self.strings[idx] || '',
      getTypeName: (idx: number) => self.types[idx] || '',
      getMethodId: (idx: number) => self.methods[idx] || { classIdx: 0, protoIdx: 0, nameIdx: 0 },
      getFieldId: (idx: number) => self.fields[idx] || { classIdx: 0, typeIdx: 0, nameIdx: 0 },
      getProtoId: (idx: number) => {
        const p = self.protos[idx];
        return p ? { shortyIdx: p.shortyIdx, returnTypeIdx: p.returnTypeIdx, parametersOff: p.params.length > 0 ? 1 : 0 } : { shortyIdx: 0, returnTypeIdx: 0, parametersOff: 0 };
      },
      getProtoParameters: (proto: any) => {
        for (const p of self.protos) {
          if (p.returnTypeIdx === proto.returnTypeIdx && p.shortyIdx === proto.shortyIdx) return p.params;
        }
        return [];
      },
      getClassDefs: () => getClassDefsArray(),
      getClassDef: (className: string) => {
        const defs = getClassDefsArray();
        for (let i = 0; i < self.classDefs.length; i++) {
          if (self.classDefs[i].descriptor === className) return defs[i];
        }
        return null;
      },
      getClassDefByIndex: (idx: number) => getClassDefsArray()[idx],
      getClassData: (classDef: any) => {
        const typeName = self.types[classDef.classIdx];
        const cd = self.classDefs.find(c => c.descriptor === typeName);
        if (!cd) return { staticFields: [], instanceFields: [], directMethods: [], virtualMethods: [] };
        return {
          staticFields: cd.staticFields,
          instanceFields: cd.instanceFields,
          directMethods: cd.directMethods.map(m => ({ methodIdx: m.methodIdx, accessFlags: m.accessFlags, codeOff: m.code ? m.methodIdx + 1 : 0 })),
          virtualMethods: cd.virtualMethods.map(m => ({ methodIdx: m.methodIdx, accessFlags: m.accessFlags, codeOff: m.code ? m.methodIdx + 1 : 0 })),
        };
      },
      getMethodCode: (codeOff: number) => {
        if (codeOff === 0) return null;
        return codeMap.get(codeOff) || null;
      },
    } as unknown as DexParser;
  }
}

function makeCode(insns: number[], registersSize: number = 1, insSize: number = 0): CodeItem {
  return {
    registersSize, insSize, outsSize: 0, triesSize: 0, debugInfoOff: 0,
    insnsSize: insns.length, insns: new Uint16Array(insns), tries: [], handlers: [],
  };
}

describe('ClassLoader', () => {
  let heap: Heap;
  let shimRegistry: ShimRegistry;

  beforeEach(() => {
    heap = new Heap();
    shimRegistry = initializeShimRegistry();
  });

  describe('Class Loading', () => {
    it('loads class from DEX', () => {
      const mock = new MockDex();
      mock.addClass('Lcom/example/Foo;', 'Ljava/lang/Object;');
      const dex = mock.build();
      const cl = new ClassLoader(dex, heap, shimRegistry);

      const resolved = cl.loadClass('Lcom/example/Foo;');
      expect(resolved.descriptor).toBe('Lcom/example/Foo;');
      expect(resolved.superClass).toBe('Ljava/lang/Object;');
    });

    it('resolves superclass chain', () => {
      const mock = new MockDex();
      mock.addClass('Lcom/example/Base;', 'Ljava/lang/Object;');
      mock.addClass('Lcom/example/Child;', 'Lcom/example/Base;');
      const dex = mock.build();
      const cl = new ClassLoader(dex, heap, shimRegistry);

      const child = cl.loadClass('Lcom/example/Child;');
      expect(child.superClass).toBe('Lcom/example/Base;');

      const base = cl.loadClass('Lcom/example/Base;');
      expect(base.superClass).toBe('Ljava/lang/Object;');
    });

    it('throws ClassNotFoundException for unknown class', () => {
      const mock = new MockDex();
      const dex = mock.build();
      const cl = new ClassLoader(dex, heap, shimRegistry);

      expect(() => cl.loadClass('Lcom/example/Missing;')).toThrow(ClassNotFoundException);
    });

    it('loads shim-only classes', () => {
      const mock = new MockDex();
      const dex = mock.build();
      const cl = new ClassLoader(dex, heap, shimRegistry);

      const objClass = cl.loadClass('Ljava/lang/Object;');
      expect(objClass.descriptor).toBe('Ljava/lang/Object;');
      expect(objClass.superClass).toBeNull();
      expect(objClass.isInitialized).toBe(true);
    });
  });

  describe('Method Resolution', () => {
    it('resolves method by index', () => {
      const mock = new MockDex();
      const methodIdx = mock.addMethod('Lcom/example/Foo;', 'bar', 'V');
      const code = makeCode([0x000e]); // return-void
      mock.addClass('Lcom/example/Foo;', 'Ljava/lang/Object;', {
        directMethods: [{ methodIdx, accessFlags: 0x0001, code }],
      });
      const dex = mock.build();
      const cl = new ClassLoader(dex, heap, shimRegistry);

      const resolved = cl.resolveMethod(methodIdx);
      expect(resolved.name).toBe('bar');
      expect(resolved.classDescriptor).toBe('Lcom/example/Foo;');
      expect(resolved.code).not.toBeNull();
    });

    it('resolves shim method by index', () => {
      const mock = new MockDex();
      const methodIdx = mock.addMethod('Ljava/lang/Object;', '<init>', 'V');
      const dex = mock.build();
      const cl = new ClassLoader(dex, heap, shimRegistry);

      const resolved = cl.resolveMethod(methodIdx);
      expect(resolved.name).toBe('<init>');
      expect(resolved.isShim).toBe(true);
    });
  });

  describe('Virtual Dispatch', () => {
    it('finds correct implementation via virtual dispatch', () => {
      const mock = new MockDex();

      // Base class with virtual method
      const baseMethodIdx = mock.addMethod('Lcom/example/Base;', 'doIt', 'I');
      const baseCode = makeCode([0x5012, 0x000f], 1); // const/4 v0,5; return v0
      mock.addClass('Lcom/example/Base;', 'Ljava/lang/Object;', {
        virtualMethods: [{ methodIdx: baseMethodIdx, accessFlags: 0x0001, code: baseCode }],
      });

      // Child class with override
      const childMethodIdx = mock.addMethod('Lcom/example/Child;', 'doIt', 'I');
      const childCode = makeCode([0xa012, 0x000f], 1); // const/4 v0,0xA(10); return v0
      mock.addClass('Lcom/example/Child;', 'Lcom/example/Base;', {
        virtualMethods: [{ methodIdx: childMethodIdx, accessFlags: 0x0001, code: childCode }],
      });

      const dex = mock.build();
      const cl = new ClassLoader(dex, heap, shimRegistry);

      // Allocate a Child object
      const objRef = heap.allocate('Lcom/example/Child;');

      // Virtual dispatch on baseMethodIdx should find Child's impl
      const resolved = cl.resolveVirtualMethod(objRef, baseMethodIdx);
      expect(resolved.classDescriptor).toBe('Lcom/example/Child;');
    });

    it('walks up to superclass when method not overridden', () => {
      const mock = new MockDex();

      const methodIdx = mock.addMethod('Lcom/example/Base;', 'parentOnly', 'V');
      const code = makeCode([0x000e], 1); // return-void
      mock.addClass('Lcom/example/Base;', 'Ljava/lang/Object;', {
        virtualMethods: [{ methodIdx, accessFlags: 0x0001, code }],
      });

      mock.addClass('Lcom/example/Child;', 'Lcom/example/Base;');

      const dex = mock.build();
      const cl = new ClassLoader(dex, heap, shimRegistry);

      const objRef = heap.allocate('Lcom/example/Child;');
      const resolved = cl.resolveVirtualMethod(objRef, methodIdx);
      expect(resolved.classDescriptor).toBe('Lcom/example/Base;');
      expect(resolved.name).toBe('parentOnly');
    });
  });

  describe('Static Fields', () => {
    it('get/set static field works', () => {
      const mock = new MockDex();
      const fieldIdx = mock.addField('Lcom/example/Foo;', 'count', 'I');
      mock.addClass('Lcom/example/Foo;', 'Ljava/lang/Object;', {
        staticFields: [{ fieldIdx, accessFlags: 0x0009 }],
      });
      const dex = mock.build();
      const cl = new ClassLoader(dex, heap, shimRegistry);

      const field = cl.resolveField(fieldIdx);

      // Default value should be 0
      expect(cl.getStaticField(field)).toEqual(intValue(0));

      // Set and read back
      cl.setStaticField(field, intValue(42));
      expect(cl.getStaticField(field)).toEqual(intValue(42));
    });
  });

  describe('Class Initialization', () => {
    it('marks class as initialized', () => {
      const mock = new MockDex();
      mock.addClass('Lcom/example/Foo;', 'Ljava/lang/Object;');
      const dex = mock.build();
      const cl = new ClassLoader(dex, heap, shimRegistry);

      cl.initializeClass('Lcom/example/Foo;');
      const resolved = cl.getClass('Lcom/example/Foo;');
      expect(resolved).not.toBeNull();
      expect(resolved!.isInitialized).toBe(true);
    });

    it('calls <clinit> during class initialization', () => {
      const mock = new MockDex();
      const fieldIdx = mock.addField('Lcom/example/Foo;', 'initialized', 'I');
      // <clinit> sets static field to 1: sput v0, field@fieldIdx
      // But since we need a real field resolution, we'll just check the runner is wired
      const clinitIdx = mock.addMethod('Lcom/example/Foo;', '<clinit>', 'V');
      // const/4 v0, 1; return-void -> simple clinit
      const clinitCode = makeCode([0x1012, 0x000e], 1);
      mock.addClass('Lcom/example/Foo;', 'Ljava/lang/Object;', {
        directMethods: [{ methodIdx: clinitIdx, accessFlags: 0x10008, code: clinitCode }],
      });
      const dex = mock.build();
      const cl = new ClassLoader(dex, heap, shimRegistry);

      // Track whether clinit runner is called
      let clinitCalled = false;
      cl.setClinitRunner((descriptor: string) => {
        clinitCalled = true;
        expect(descriptor).toBe('Lcom/example/Foo;');
      });

      cl.initializeClass('Lcom/example/Foo;');
      expect(clinitCalled).toBe(true);
    });
  });
});
