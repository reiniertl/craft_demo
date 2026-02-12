/**
 * Shared helpers for interpreter integration tests.
 * Provides a SyntheticDexBuilder to create mock DEX data with real bytecode.
 */

import { DexParser } from '../../../src/parser/dex_parser';
import { CodeItem } from '../../../src/parser/dex_types';
import { Interpreter } from '../../../src/interpreter/interpreter';
import { Heap } from '../../../src/interpreter/heap';
import { initializeShimRegistry } from '../../../src/interpreter/shim_init';

export class SyntheticDexBuilder {
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
    const shorty = this.addString('$p' + this.protos.length);
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

export function makeCode(insns: number[], registersSize: number, insSize: number = 0): CodeItem {
  return {
    registersSize, insSize, outsSize: 0, triesSize: 0, debugInfoOff: 0,
    insnsSize: insns.length, insns: new Uint16Array(insns), tries: [], handlers: [],
  };
}

export function createInterpreter(dex: DexParser): { interpreter: Interpreter; heap: Heap } {
  const heap = new Heap();
  const shimRegistry = initializeShimRegistry();
  const interpreter = new Interpreter(dex, heap, shimRegistry);
  return { interpreter, heap };
}
