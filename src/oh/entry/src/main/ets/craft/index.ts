/**
 * CRAFT Runtime - Main Exports
 * Import point for OpenHarmony ArkTS integration
 */

// Runtime
export { CraftRuntime } from './runtime';

// Core types
export {
  Value,
  NULL_VALUE,
  intValue,
  longValue,
  floatValue,
  doubleValue,
  objectRef,
} from './core/types';

// Parser
export { APKParser } from './parser/apk_parser';
export { DexParser } from './parser/dex_parser';
export { ManifestParser } from './parser/manifest_parser';

// Interpreter
export { Interpreter } from './interpreter/interpreter';
export { Heap } from './interpreter/heap';
export { ClassLoader } from './interpreter/class_loader';

// Bridge
export { UIBridge } from './bridge/ui_bridge';
export { StateManager, SerializedView } from './bridge/state_manager';
export { LifecycleBridge } from './bridge/lifecycle_bridge';

// Errors
export {
  InterpreterError,
  ClassNotFoundException,
  NoSuchMethodError,
  NullPointerException,
} from './interpreter/errors';
