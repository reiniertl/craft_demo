/**
 * CRAFT - Class Loader
 * Class and method resolution from DEX files.
 */

import { Value, NULL_VALUE, intValue } from '../core/types';
import { DexParser } from '../parser/dex_parser';
import { NO_INDEX } from '../parser/dex_types';
import { Heap } from './heap';
import { ShimRegistry } from './shim_registry';
import {
  ResolvedClass,
  ResolvedMethod,
  FieldInfo,
} from './types';
import {
  ClassNotFoundException,
  NoSuchMethodError,
  NullPointerException,
  InterpreterError,
} from './errors';

export class ClassLoader {
  private dex: DexParser;
  private heap: Heap;
  private shimRegistry: ShimRegistry;

  private loadedClasses: Map<string, ResolvedClass> = new Map();
  private classObjects: Map<string, number> = new Map();
  private staticFieldStorage: Map<string, Map<string, Value>> = new Map();

  // Set by interpreter after construction to break circular dep
  private clinitRunner: ((descriptor: string) => void) | null = null;

  constructor(dex: DexParser, heap: Heap, shimRegistry: ShimRegistry) {
    this.dex = dex;
    this.heap = heap;
    this.shimRegistry = shimRegistry;
  }

  /** Set the clinit runner (called by Interpreter to break circular dep) */
  setClinitRunner(runner: (descriptor: string) => void): void {
    this.clinitRunner = runner;
  }

  /** Load a class by descriptor */
  loadClass(descriptor: string): ResolvedClass {
    const existing = this.loadedClasses.get(descriptor);
    if (existing) return existing;

    // Check if it's a shim-only class
    if (this.shimRegistry.isShimClass(descriptor)) {
      return this.loadShimClass(descriptor);
    }

    // Look up in DEX
    const classDef = this.dex.getClassDef(descriptor);
    if (!classDef) {
      // May still be a partially shimmed class (e.g., base Java classes)
      if (this.isKnownBaseClass(descriptor)) {
        return this.loadShimClass(descriptor);
      }
      throw new ClassNotFoundException(descriptor);
    }

    // Get superclass
    let superClass: string | null = null;
    if (classDef.superclassIdx !== NO_INDEX) {
      superClass = this.dex.getTypeName(classDef.superclassIdx);
    }

    // Get interfaces
    const interfaces: string[] = [];
    // (Interface parsing would go here if needed)

    // Parse class data
    const classData = this.dex.getClassData(classDef);

    // Build field maps
    const staticFields = new Map<string, FieldInfo>();
    const instanceFields = new Map<string, FieldInfo>();

    for (let i = 0; i < classData.staticFields.length; i++) {
      const ef = classData.staticFields[i];
      const fieldId = this.dex.getFieldId(ef.fieldIdx);
      const name = this.dex.getString(fieldId.nameIdx);
      const fieldDescriptor = this.dex.getTypeName(fieldId.typeIdx);
      const info: FieldInfo = {
        classDescriptor: descriptor,
        name,
        descriptor: fieldDescriptor,
        accessFlags: ef.accessFlags,
        offset: i,
        isStatic: true,
      };
      staticFields.set(name, info);
    }

    for (let i = 0; i < classData.instanceFields.length; i++) {
      const ef = classData.instanceFields[i];
      const fieldId = this.dex.getFieldId(ef.fieldIdx);
      const name = this.dex.getString(fieldId.nameIdx);
      const fieldDescriptor = this.dex.getTypeName(fieldId.typeIdx);
      const info: FieldInfo = {
        classDescriptor: descriptor,
        name,
        descriptor: fieldDescriptor,
        accessFlags: ef.accessFlags,
        offset: i,
        isStatic: false,
      };
      instanceFields.set(name, info);
    }

    // Build method maps
    const directMethods = new Map<string, ResolvedMethod>();
    const virtualMethods = new Map<string, ResolvedMethod>();

    for (const em of classData.directMethods) {
      const methodId = this.dex.getMethodId(em.methodIdx);
      const name = this.dex.getString(methodId.nameIdx);
      const methodDescriptor = this.buildMethodDescriptor(methodId.protoIdx);
      const code = this.dex.getMethodCode(em.codeOff);
      const key = `${name}${methodDescriptor}`;

      const isShim = this.shimRegistry.hasMethod(
        descriptor,
        name,
        methodDescriptor
      );

      directMethods.set(key, {
        classDescriptor: descriptor,
        name,
        descriptor: methodDescriptor,
        accessFlags: em.accessFlags,
        code: isShim ? null : code,
        isShim,
      });
    }

    for (const em of classData.virtualMethods) {
      const methodId = this.dex.getMethodId(em.methodIdx);
      const name = this.dex.getString(methodId.nameIdx);
      const methodDescriptor = this.buildMethodDescriptor(methodId.protoIdx);
      const code = this.dex.getMethodCode(em.codeOff);
      const key = `${name}${methodDescriptor}`;

      const isShim = this.shimRegistry.hasMethod(
        descriptor,
        name,
        methodDescriptor
      );

      virtualMethods.set(key, {
        classDescriptor: descriptor,
        name,
        descriptor: methodDescriptor,
        accessFlags: em.accessFlags,
        code: isShim ? null : code,
        isShim,
      });
    }

    const resolved: ResolvedClass = {
      descriptor,
      accessFlags: classDef.accessFlags,
      superClass,
      interfaces,
      staticFields,
      instanceFields,
      directMethods,
      virtualMethods,
      isInitialized: false,
    };

    this.loadedClasses.set(descriptor, resolved);

    // Initialize static field storage with defaults
    const storage = new Map<string, Value>();
    for (const [name, field] of staticFields) {
      storage.set(name, this.defaultValueForType(field.descriptor));
    }
    this.staticFieldStorage.set(descriptor, storage);

    return resolved;
  }

  /** Load a shim-only class (not in DEX) */
  private loadShimClass(descriptor: string): ResolvedClass {
    const existing = this.loadedClasses.get(descriptor);
    if (existing) return existing;

    const superClass = this.getShimSuperClass(descriptor);

    const resolved: ResolvedClass = {
      descriptor,
      accessFlags: 0x0001, // PUBLIC
      superClass,
      interfaces: [],
      staticFields: new Map(),
      instanceFields: new Map(),
      directMethods: new Map(),
      virtualMethods: new Map(),
      isInitialized: true, // Shim classes are always initialized
    };

    this.loadedClasses.set(descriptor, resolved);
    this.staticFieldStorage.set(descriptor, new Map());

    return resolved;
  }

  /** Get the correct superclass for a shim class */
  private getShimSuperClass(descriptor: string): string | null {
    const superMap: Record<string, string | null> = {
      'Ljava/lang/Object;': null,
      // Android class hierarchy
      'Landroid/os/Bundle;': 'Ljava/lang/Object;',
      'Landroid/content/Context;': 'Ljava/lang/Object;',
      'Landroid/content/ContextWrapper;': 'Landroid/content/Context;',
      'Landroid/app/Activity;': 'Landroid/content/ContextWrapper;',
      'Landroid/view/View;': 'Ljava/lang/Object;',
      'Landroid/view/ViewGroup;': 'Landroid/view/View;',
      'Landroid/widget/TextView;': 'Landroid/view/View;',
      'Landroid/widget/LinearLayout;': 'Landroid/view/ViewGroup;',
      'Landroid/widget/Button;': 'Landroid/widget/TextView;',
      'Landroid/view/View$OnClickListener;': 'Ljava/lang/Object;',
    };
    if (descriptor in superMap) {
      return superMap[descriptor] ?? null;
    }
    return descriptor === 'Ljava/lang/Object;' ? null : 'Ljava/lang/Object;';
  }

  /** Check if descriptor is a known base class */
  private isKnownBaseClass(descriptor: string): boolean {
    const known = [
      // Stage 2 - java.lang
      'Ljava/lang/Object;',
      'Ljava/lang/String;',
      'Ljava/lang/StringBuilder;',
      'Ljava/lang/Class;',
      'Ljava/lang/System;',
      // Stage 3 - android.*
      'Landroid/os/Bundle;',
      'Landroid/content/Context;',
      'Landroid/content/ContextWrapper;',
      'Landroid/app/Activity;',
      'Landroid/view/View;',
      'Landroid/view/ViewGroup;',
      'Landroid/widget/TextView;',
      'Landroid/widget/LinearLayout;',
      'Landroid/widget/Button;',
      'Landroid/view/View$OnClickListener;',
    ];
    return known.includes(descriptor);
  }

  /** Get a loaded class or null */
  getClass(descriptor: string): ResolvedClass | null {
    return this.loadedClasses.get(descriptor) || null;
  }

  /** Check if a class is loaded */
  isClassLoaded(descriptor: string): boolean {
    return this.loadedClasses.has(descriptor);
  }

  /** Check if an object's class is an instance of a target type */
  isInstanceOf(objectClass: string, targetType: string): boolean {
    // Exact match
    if (objectClass === targetType) {
      return true;
    }

    // Walk up the superclass chain
    let currentClass: string | null = objectClass;
    while (currentClass) {
      if (currentClass === targetType) {
        return true;
      }

      try {
        const resolved = this.loadClass(currentClass);
        currentClass = resolved.superClass;
      } catch {
        // Can't load class - break the chain
        break;
      }
    }

    // TODO: Check interfaces when interface support is added

    return false;
  }

  /** Get or create a java.lang.Class object for a descriptor */
  getClassObject(descriptor: string): number {
    const existing = this.classObjects.get(descriptor);
    if (existing !== undefined) return existing;

    const ref = this.heap.allocate('Ljava/lang/Class;');
    // Store the descriptor as a special field
    this.heap.setField(
      ref,
      '__classDescriptor',
      { type: 'object', ref: this.heap.internString(descriptor) }
    );
    this.classObjects.set(descriptor, ref);
    return ref;
  }

  /** Resolve a method by its DEX index */
  resolveMethod(methodIdx: number): ResolvedMethod {
    const methodId = this.dex.getMethodId(methodIdx);
    const classDescriptor = this.dex.getTypeName(methodId.classIdx);
    const name = this.dex.getString(methodId.nameIdx);
    const descriptor = this.buildMethodDescriptor(methodId.protoIdx);

    // Check shim first
    if (this.shimRegistry.hasMethod(classDescriptor, name, descriptor)) {
      return {
        classDescriptor,
        name,
        descriptor,
        accessFlags: 0,
        code: null,
        isShim: true,
      };
    }

    // Load class and find method
    const resolvedClass = this.loadClass(classDescriptor);

    const key = `${name}${descriptor}`;
    const direct = resolvedClass.directMethods.get(key);
    if (direct) return direct;

    const virtual = resolvedClass.virtualMethods.get(key);
    if (virtual) return virtual;

    // Search superclass chain
    let superClass = resolvedClass.superClass;
    while (superClass) {
      // Check shim
      if (this.shimRegistry.hasMethod(superClass, name, descriptor)) {
        return {
          classDescriptor: superClass,
          name,
          descriptor,
          accessFlags: 0,
          code: null,
          isShim: true,
        };
      }

      const superResolved = this.loadClass(superClass);
      const superDirect = superResolved.directMethods.get(key);
      if (superDirect) return superDirect;
      const superVirtual = superResolved.virtualMethods.get(key);
      if (superVirtual) return superVirtual;
      superClass = superResolved.superClass;
    }

    throw new NoSuchMethodError(
      `${classDescriptor}.${name}${descriptor}`
    );
  }

  /** Resolve a method by name */
  resolveMethodByName(
    classDescriptor: string,
    methodName: string,
    methodDescriptor: string
  ): ResolvedMethod | null {
    // Check shim first
    if (
      this.shimRegistry.hasMethod(classDescriptor, methodName, methodDescriptor)
    ) {
      return {
        classDescriptor,
        name: methodName,
        descriptor: methodDescriptor,
        accessFlags: 0,
        code: null,
        isShim: true,
      };
    }

    try {
      const resolvedClass = this.loadClass(classDescriptor);
      const key = `${methodName}${methodDescriptor}`;

      const direct = resolvedClass.directMethods.get(key);
      if (direct) return direct;

      const virtual = resolvedClass.virtualMethods.get(key);
      if (virtual) return virtual;

      // Search superclass chain
      let superClass = resolvedClass.superClass;
      while (superClass) {
        if (
          this.shimRegistry.hasMethod(superClass, methodName, methodDescriptor)
        ) {
          return {
            classDescriptor: superClass,
            name: methodName,
            descriptor: methodDescriptor,
            accessFlags: 0,
            code: null,
            isShim: true,
          };
        }

        const superResolved = this.loadClass(superClass);
        const d = superResolved.directMethods.get(key);
        if (d) return d;
        const v = superResolved.virtualMethods.get(key);
        if (v) return v;
        superClass = superResolved.superClass;
      }
    } catch {
      // Class not found
    }

    return null;
  }

  /** Resolve a field by its DEX index */
  resolveField(fieldIdx: number): FieldInfo {
    const fieldId = this.dex.getFieldId(fieldIdx);
    const classDescriptor = this.dex.getTypeName(fieldId.classIdx);
    const name = this.dex.getString(fieldId.nameIdx);
    const fieldDescriptor = this.dex.getTypeName(fieldId.typeIdx);

    // Try loading the class and finding the field
    try {
      const resolvedClass = this.loadClass(classDescriptor);

      const staticField = resolvedClass.staticFields.get(name);
      if (staticField) return staticField;

      const instanceField = resolvedClass.instanceFields.get(name);
      if (instanceField) return instanceField;
    } catch {
      // Class not in DEX - return synthetic field info
    }

    // Return a synthetic field info for shim/external classes
    const isStatic = false; // Assume instance field by default
    return {
      classDescriptor,
      name,
      descriptor: fieldDescriptor,
      accessFlags: 0,
      offset: 0,
      isStatic,
    };
  }

  /** Resolve virtual method based on actual object type */
  resolveVirtualMethod(objectRef: number, methodIdx: number): ResolvedMethod {
    const objectClass = this.heap.getClassDescriptor(objectRef);
    if (!objectClass) {
      throw new NullPointerException('resolveVirtualMethod on null');
    }

    const methodId = this.dex.getMethodId(methodIdx);
    const name = this.dex.getString(methodId.nameIdx);
    const descriptor = this.buildMethodDescriptor(methodId.protoIdx);
    const key = `${name}${descriptor}`;

    // Walk up from actual class
    let currentClass: string | null = objectClass;
    while (currentClass) {
      // Check shim
      if (this.shimRegistry.hasMethod(currentClass, name, descriptor)) {
        return {
          classDescriptor: currentClass,
          name,
          descriptor,
          accessFlags: 0,
          code: null,
          isShim: true,
        };
      }

      const resolved = this.getClass(currentClass);
      if (resolved) {
        const method = resolved.virtualMethods.get(key);
        if (method) return method;
        const direct = resolved.directMethods.get(key);
        if (direct) return direct;
        currentClass = resolved.superClass;
      } else {
        // Try to load the class
        try {
          const loaded = this.loadClass(currentClass);
          const method = loaded.virtualMethods.get(key);
          if (method) return method;
          currentClass = loaded.superClass;
        } catch {
          break;
        }
      }
    }

    throw new NoSuchMethodError(`${objectClass}.${name}${descriptor}`);
  }

  /** Resolve super method (for invoke-super) */
  resolveSuperMethod(
    callingClass: string,
    methodIdx: number
  ): ResolvedMethod {
    const resolved = this.loadClass(callingClass);
    if (!resolved.superClass) {
      throw new NoSuchMethodError(
        `No superclass for ${callingClass}`
      );
    }

    const methodId = this.dex.getMethodId(methodIdx);
    const name = this.dex.getString(methodId.nameIdx);
    const descriptor = this.buildMethodDescriptor(methodId.protoIdx);
    const key = `${name}${descriptor}`;

    let currentClass: string | null = resolved.superClass;
    while (currentClass) {
      if (this.shimRegistry.hasMethod(currentClass, name, descriptor)) {
        return {
          classDescriptor: currentClass,
          name,
          descriptor,
          accessFlags: 0,
          code: null,
          isShim: true,
        };
      }

      try {
        const superResolved = this.loadClass(currentClass);
        const method = superResolved.virtualMethods.get(key);
        if (method) return method;
        const direct = superResolved.directMethods.get(key);
        if (direct) return direct;
        currentClass = superResolved.superClass;
      } catch {
        break;
      }
    }

    throw new NoSuchMethodError(
      `Super method not found: ${callingClass}.${name}${descriptor}`
    );
  }

  /** Get a static field value */
  getStaticField(field: FieldInfo): Value {
    const storage = this.staticFieldStorage.get(field.classDescriptor);
    if (storage) {
      const val = storage.get(field.name);
      if (val !== undefined) return val;
    }
    return this.defaultValueForType(field.descriptor);
  }

  /** Set a static field value */
  setStaticField(field: FieldInfo, value: Value): void {
    let storage = this.staticFieldStorage.get(field.classDescriptor);
    if (!storage) {
      storage = new Map();
      this.staticFieldStorage.set(field.classDescriptor, storage);
    }
    storage.set(field.name, value);
  }

  /** Initialize a class (run <clinit> if not yet initialized) */
  initializeClass(descriptor: string): void {
    let resolved: ResolvedClass;
    try {
      resolved = this.loadClass(descriptor);
    } catch {
      return; // Can't load - skip initialization
    }

    if (resolved.isInitialized) return;

    // Mark as initialized first to prevent infinite recursion
    resolved.isInitialized = true;

    // Initialize superclass first
    if (resolved.superClass) {
      this.initializeClass(resolved.superClass);
    }

    // Run <clinit> if present
    const clinit = resolved.directMethods.get('<clinit>()V');
    if (clinit && clinit.code && this.clinitRunner) {
      this.clinitRunner(descriptor);
    }
  }

  /** Build a method descriptor string from a proto index */
  buildMethodDescriptor(protoIdx: number): string {
    const proto = this.dex.getProtoId(protoIdx);
    const returnType = this.dex.getTypeName(proto.returnTypeIdx);
    const params = this.dex.getProtoParameters(proto);
    const paramTypes = params.map((p) => this.dex.getTypeName(p)).join('');
    return `(${paramTypes})${returnType}`;
  }

  /** Get default value for a type descriptor */
  private defaultValueForType(descriptor: string): Value {
    switch (descriptor) {
      case 'Z': // boolean
      case 'B': // byte
      case 'S': // short
      case 'C': // char
      case 'I': // int
        return intValue(0);
      case 'J': // long
        return { type: 'long', value: BigInt(0) };
      case 'F': // float
        return { type: 'float', value: 0.0 };
      case 'D': // double
        return { type: 'double', value: 0.0 };
      default:
        return NULL_VALUE;
    }
  }
}

