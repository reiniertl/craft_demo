/**
 * CRAFT - Compatibility Runtime for Android Framework Translation
 * Stage 1: APK Parsing Foundation
 * Stage 2: Interpreter Core
 * Stage 3: Android API Shim Layer
 * Stage 4: UI Bridge & OpenHarmony Host
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
export { APKParser, APKContents, parseAPK } from './parser/apk_parser';
export { DexParser } from './parser/dex_parser';
export { ManifestParser, ManifestInfo } from './parser/manifest_parser';

// Interpreter (Stage 2)
export { Interpreter } from './interpreter/interpreter';
export { Heap, HeapObject, HeapDump, HeapDumpObject } from './interpreter/heap';
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

// Tracer
export { ExecutionTracer, TraceEntry } from './interpreter/tracer';

// Bridge (Stage 4)
export { UIBridge, ViewNode } from './bridge/ui_bridge';
export { StateManager, ViewState, SerializedView } from './bridge/state_manager';
export { LifecycleBridge } from './bridge/lifecycle_bridge';

// Runtime (Stage 4)
export { CraftRuntime } from './runtime';
