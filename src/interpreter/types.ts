/**
 * CRAFT - Interpreter Type Definitions
 * Shared types used across interpreter modules.
 */

import { Value } from '../core/types';
import { CodeItem } from '../parser/dex_types';

export { Value } from '../core/types';

/** Check if a value is wide (occupies two registers) */
export function isWideValue(v: Value): boolean {
  return v.type === 'long' || v.type === 'double';
}

/** Check if a value is null or object */
export function isNullOrObject(v: Value): boolean {
  return v.type === 'object' || v.type === 'null';
}

/** Resolved method with all info needed for execution */
export interface ResolvedMethod {
  classDescriptor: string;
  name: string;
  descriptor: string;
  accessFlags: number;
  code: CodeItem | null;
  isShim: boolean;
}

/** Resolved class with inheritance info */
export interface ResolvedClass {
  descriptor: string;
  accessFlags: number;
  superClass: string | null;
  interfaces: string[];
  staticFields: Map<string, FieldInfo>;
  instanceFields: Map<string, FieldInfo>;
  directMethods: Map<string, ResolvedMethod>;
  virtualMethods: Map<string, ResolvedMethod>;
  isInitialized: boolean;
}

/** Field information */
export interface FieldInfo {
  classDescriptor: string;
  name: string;
  descriptor: string;
  accessFlags: number;
  offset: number;
  isStatic: boolean;
}

/** Sign-extend a 16-bit value to 32-bit */
export function signExtend16(value: number): number {
  return (value << 16) >> 16;
}
