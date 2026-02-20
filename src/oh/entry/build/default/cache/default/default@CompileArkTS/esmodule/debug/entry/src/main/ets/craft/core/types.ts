/**
 * CRAFT - Core Type Definitions
 * Shared types used throughout the runtime
 */
/** Dalvik register value types */
export type Value = {
    type: 'int';
    value: number;
} | {
    type: 'long';
    value: bigint;
} | {
    type: 'float';
    value: number;
} | {
    type: 'double';
    value: number;
} | {
    type: 'object';
    ref: number;
} | {
    type: 'null';
};
/** Create a null value */
export const NULL_VALUE: Value = { type: 'null' };
/** Create an int value */
export function intValue(value: number): Value {
    return { type: 'int', value: value | 0 };
}
/** Create a long value */
export function longValue(value: bigint): Value {
    return { type: 'long', value };
}
/** Create a float value */
export function floatValue(value: number): Value {
    return { type: 'float', value };
}
/** Create a double value */
export function doubleValue(value: number): Value {
    return { type: 'double', value };
}
/** Create an object reference value */
export function objectRef(ref: number): Value {
    return { type: 'object', ref };
}
/** Check if value is null */
export function isNull(value: Value): boolean {
    return value.type === 'null' || (value.type === 'object' && value.ref === 0);
}
/** Get int value or throw */
export function asInt(value: Value): number {
    if (value.type !== 'int') {
        throw new Error(`Expected int, got ${value.type}`);
    }
    return value.value;
}
/** Get object reference or throw */
export function asObjectRef(value: Value): number {
    if (value.type === 'null')
        return 0;
    if (value.type !== 'object') {
        throw new Error(`Expected object, got ${value.type}`);
    }
    return value.ref;
}
/** Access flags for classes, methods, and fields */
export const AccessFlags = {
    PUBLIC: 0x0001,
    PRIVATE: 0x0002,
    PROTECTED: 0x0004,
    STATIC: 0x0008,
    FINAL: 0x0010,
    SYNCHRONIZED: 0x0020,
    VOLATILE: 0x0040,
    BRIDGE: 0x0040,
    TRANSIENT: 0x0080,
    VARARGS: 0x0080,
    NATIVE: 0x0100,
    INTERFACE: 0x0200,
    ABSTRACT: 0x0400,
    STRICT: 0x0800,
    SYNTHETIC: 0x1000,
    ANNOTATION: 0x2000,
    ENUM: 0x4000,
    CONSTRUCTOR: 0x10000,
    DECLARED_SYNCHRONIZED: 0x20000,
} as const;
/** Special index value meaning "no index" in DEX */
export const NO_INDEX = 0xFFFFFFFF;
/** Type descriptor prefixes */
export const TypeDescriptors = {
    VOID: 'V',
    BOOLEAN: 'Z',
    BYTE: 'B',
    SHORT: 'S',
    CHAR: 'C',
    INT: 'I',
    LONG: 'J',
    FLOAT: 'F',
    DOUBLE: 'D',
    ARRAY: '[',
    OBJECT: 'L',
} as const;
