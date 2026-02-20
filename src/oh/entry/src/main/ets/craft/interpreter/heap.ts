/**
 * CRAFT - Heap Implementation
 * Object allocation, field access, array and string support.
 */

import { Value, NULL_VALUE, intValue, objectRef } from '../core/types';
import {
  NullPointerException,
  ArrayIndexOutOfBoundsException,
} from './errors';

/** Heap-allocated object representation */
export interface HeapObject {
  classDescriptor: string;
  fields: Map<string, Value>;
  arrayData?: Value[];
  arrayLength?: number;
  stringValue?: string;
}

export class Heap {
  private objects: Map<number, HeapObject> = new Map();
  private nextRef: number = 1; // 0 is reserved for null
  private stringPool: Map<string, number> = new Map();

  /** Allocate a new object on the heap */
  allocate(classDescriptor: string): number {
    const ref = this.nextRef++;
    this.objects.set(ref, {
      classDescriptor,
      fields: new Map(),
    });
    return ref;
  }

  /** Allocate an array on the heap */
  allocateArray(elementType: string, length: number): number {
    const ref = this.nextRef++;
    const arrayData: Value[] = new Array(length);
    // Initialize with default values
    for (let i = 0; i < length; i++) {
      if (elementType.startsWith('L') || elementType.startsWith('[')) {
        arrayData[i] = NULL_VALUE;
      } else {
        arrayData[i] = intValue(0);
      }
    }
    this.objects.set(ref, {
      classDescriptor: `[${elementType}`,
      fields: new Map(),
      arrayData,
      arrayLength: length,
    });
    return ref;
  }

  /** Allocate a string object on the heap */
  allocateString(value: string): number {
    const ref = this.nextRef++;
    this.objects.set(ref, {
      classDescriptor: 'Ljava/lang/String;',
      fields: new Map(),
      stringValue: value,
    });
    return ref;
  }

  /** Get an object from the heap by reference */
  getObject(ref: number): HeapObject | null {
    return this.objects.get(ref) || null;
  }

  /** Get the class descriptor of an object */
  getClassDescriptor(ref: number): string | null {
    const obj = this.objects.get(ref);
    return obj ? obj.classDescriptor : null;
  }

  /** Get a field value from an object */
  getField(ref: number, fieldName: string): Value {
    const obj = this.objects.get(ref);
    if (!obj) {
      throw new NullPointerException(`getField on invalid ref ${ref}`);
    }
    return obj.fields.get(fieldName) || NULL_VALUE;
  }

  /** Set a field value on an object */
  setField(ref: number, fieldName: string, value: Value): void {
    const obj = this.objects.get(ref);
    if (!obj) {
      throw new NullPointerException(`setField on invalid ref ${ref}`);
    }
    obj.fields.set(fieldName, value);
  }

  /** Get an array element */
  getArrayElement(ref: number, index: number): Value {
    const obj = this.objects.get(ref);
    if (!obj || !obj.arrayData) {
      throw new NullPointerException('getArrayElement on non-array');
    }
    if (index < 0 || index >= obj.arrayData.length) {
      throw new ArrayIndexOutOfBoundsException(index);
    }
    return obj.arrayData[index];
  }

  /** Set an array element */
  setArrayElement(ref: number, index: number, value: Value): void {
    const obj = this.objects.get(ref);
    if (!obj || !obj.arrayData) {
      throw new NullPointerException('setArrayElement on non-array');
    }
    if (index < 0 || index >= obj.arrayData.length) {
      throw new ArrayIndexOutOfBoundsException(index);
    }
    obj.arrayData[index] = value;
  }

  /** Get array length */
  getArrayLength(ref: number): number {
    const obj = this.objects.get(ref);
    if (!obj || obj.arrayLength === undefined) {
      throw new NullPointerException('getArrayLength on non-array');
    }
    return obj.arrayLength;
  }

  /** Get the string value of a String object */
  getStringValue(ref: number): string {
    const obj = this.objects.get(ref);
    if (!obj) {
      throw new NullPointerException('getStringValue on invalid ref');
    }
    return obj.stringValue !== undefined ? obj.stringValue : '';
  }

  /** Set the string value of a String object */
  setStringValue(ref: number, value: string): void {
    const obj = this.objects.get(ref);
    if (!obj) {
      throw new NullPointerException('setStringValue on invalid ref');
    }
    obj.stringValue = value;
  }

  /** Intern a string - returns existing ref if already interned */
  internString(value: string): number {
    const existing = this.stringPool.get(value);
    if (existing !== undefined) {
      return existing;
    }
    const ref = this.allocateString(value);
    this.stringPool.set(value, ref);
    return ref;
  }

  /** Check if an object is an instance of a given class */
  isInstanceOf(ref: number, classDescriptor: string): boolean {
    const obj = this.objects.get(ref);
    if (!obj) return false;
    return obj.classDescriptor === classDescriptor;
  }

  /** Dump the entire heap state for inspection */
  dump(): HeapDump {
    const objects: HeapDumpObject[] = [];

    for (const [ref, obj] of this.objects.entries()) {
      const fields: Record<string, Value> = {};
      for (const [name, value] of obj.fields.entries()) {
        fields[name] = value;
      }

      objects.push({
        ref,
        classDescriptor: obj.classDescriptor,
        fields,
        stringValue: obj.stringValue,
        arrayData: obj.arrayData ? [...obj.arrayData] : undefined,
        arrayLength: obj.arrayLength,
      });
    }

    const stringPool: { value: string; ref: number }[] = [];
    for (const [value, ref] of this.stringPool.entries()) {
      stringPool.push({ value, ref });
    }

    return {
      objectCount: this.objects.size,
      nextRef: this.nextRef,
      objects: objects.sort((a, b) => a.ref - b.ref),
      stringPool,
    };
  }
}

/** Dump of a single heap object */
export interface HeapDumpObject {
  ref: number;
  classDescriptor: string;
  fields: Record<string, Value>;
  stringValue?: string;
  arrayData?: Value[];
  arrayLength?: number;
}

/** Complete heap dump */
export interface HeapDump {
  objectCount: number;
  nextRef: number;
  objects: HeapDumpObject[];
  stringPool: { value: string; ref: number }[];
}
