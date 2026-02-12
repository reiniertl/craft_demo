/**
 * CRAFT - Compatible Runtime for Android on Fuchsia/Trusty
 * Stage 1: APK Parsing Foundation
 * Stage 2: Interpreter Core
 */

// Core utilities
export { decodeUleb128, decodeSleb128, decodeMutf8 } from './core/utils';
export { readUint16LE, readUint32LE, readInt16LE, readInt32LE } from './core/utils';
export { Logger, defaultLogger } from './core/utils';

// Error types
export { CraftError, ParseError, ValidationError, NotFoundError } from './core/errors';

// DEX types
export * from './parser/dex_types';

// Parsers
export { APKParser, APKContents, parseAPK, parseAPKFile, parseAPKFileSync } from './parser/apk_parser';
export { DexParser } from './parser/dex_parser';
export { ManifestParser, ManifestInfo } from './parser/manifest_parser';

// Interpreter (Stage 2)
export { Interpreter } from './interpreter/interpreter';
export { Heap, HeapObject } from './interpreter/heap';
export { FrameManager, ExecutionFrame } from './interpreter/frame';
export { ClassLoader } from './interpreter/class_loader';
export { ShimRegistry } from './interpreter/shim_registry';
export { initializeShimRegistry } from './interpreter/shim_init';
export { ResolvedMethod, ResolvedClass, FieldInfo } from './interpreter/types';
export {
  InterpreterError,
  NullPointerException,
  NoSuchMethodError,
  AbstractMethodError,
  ClassNotFoundException,
  ArrayIndexOutOfBoundsException,
  StringIndexOutOfBoundsException,
} from './interpreter/errors';
