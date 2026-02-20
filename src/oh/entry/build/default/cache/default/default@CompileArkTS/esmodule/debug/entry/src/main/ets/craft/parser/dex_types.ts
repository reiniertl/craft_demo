/**
 * DEX file format type definitions.
 */
/** Special value indicating "no index" */
export const NO_INDEX = 0xFFFFFFFF;
/** DEX magic bytes for version 035 */
export const DEX_MAGIC_035 = new Uint8Array([0x64, 0x65, 0x78, 0x0A, 0x30, 0x33, 0x35, 0x00]);
/** DEX magic bytes for version 037 */
export const DEX_MAGIC_037 = new Uint8Array([0x64, 0x65, 0x78, 0x0A, 0x30, 0x33, 0x37, 0x00]);
/** DEX magic bytes for version 038 */
export const DEX_MAGIC_038 = new Uint8Array([0x64, 0x65, 0x78, 0x0A, 0x30, 0x33, 0x38, 0x00]);
/** DEX magic bytes for version 039 */
export const DEX_MAGIC_039 = new Uint8Array([0x64, 0x65, 0x78, 0x0A, 0x30, 0x33, 0x39, 0x00]);
/** Expected endian tag for little-endian DEX files */
export const ENDIAN_CONSTANT = 0x12345678;
/** DEX header size in bytes */
export const HEADER_SIZE = 0x70; // 112 bytes
/**
 * DEX file header (112 bytes).
 */
export interface DexHeader {
    magic: Uint8Array; // 8 bytes
    checksum: number; // Adler32
    signature: Uint8Array; // 20 bytes SHA-1
    fileSize: number;
    headerSize: number; // Always 0x70
    endianTag: number; // 0x12345678
    linkSize: number;
    linkOff: number;
    mapOff: number;
    stringIdsSize: number;
    stringIdsOff: number;
    typeIdsSize: number;
    typeIdsOff: number;
    protoIdsSize: number;
    protoIdsOff: number;
    fieldIdsSize: number;
    fieldIdsOff: number;
    methodIdsSize: number;
    methodIdsOff: number;
    classDefsSize: number;
    classDefsOff: number;
    dataSize: number;
    dataOff: number;
}
/**
 * String ID item - points to string data in data section.
 */
export interface StringIdItem {
    stringDataOff: number;
}
/**
 * Type ID item - references a type descriptor string.
 */
export interface TypeIdItem {
    descriptorIdx: number;
}
/**
 * Proto ID item - method prototype (signature).
 */
export interface ProtoIdItem {
    shortyIdx: number; // Shorty descriptor string index
    returnTypeIdx: number; // Return type index
    parametersOff: number; // Offset to type_list, or 0
}
/**
 * Field ID item - field identifier.
 */
export interface FieldIdItem {
    classIdx: number; // Defining class type index
    typeIdx: number; // Field type index
    nameIdx: number; // Field name string index
}
/**
 * Method ID item - method identifier.
 */
export interface MethodIdItem {
    classIdx: number; // Defining class type index
    protoIdx: number; // Prototype index
    nameIdx: number; // Method name string index
}
/**
 * Class definition item.
 */
export interface ClassDefItem {
    classIdx: number; // This class's type index
    accessFlags: number; // Access flags (ACC_*)
    superclassIdx: number; // Superclass type index, or NO_INDEX
    interfacesOff: number; // Offset to type_list, or 0
    sourceFileIdx: number; // Source file string index, or NO_INDEX
    annotationsOff: number; // Offset to annotations, or 0
    classDataOff: number; // Offset to class_data_item, or 0
    staticValuesOff: number; // Offset to encoded_array, or 0
}
/**
 * Parsed class data.
 */
export interface ClassDataItem {
    staticFields: EncodedField[];
    instanceFields: EncodedField[];
    directMethods: EncodedMethod[];
    virtualMethods: EncodedMethod[];
}
/**
 * Encoded field within class data.
 */
export interface EncodedField {
    fieldIdx: number; // Absolute field index
    accessFlags: number; // Access flags
}
/**
 * Encoded method within class data.
 */
export interface EncodedMethod {
    methodIdx: number; // Absolute method index
    accessFlags: number; // Access flags
    codeOff: number; // Offset to code_item, or 0
}
/**
 * Method bytecode and metadata.
 */
export interface CodeItem {
    registersSize: number; // Number of registers
    insSize: number; // Incoming argument words
    outsSize: number; // Outgoing argument words
    triesSize: number; // Number of try blocks
    debugInfoOff: number; // Debug info offset, or 0
    insnsSize: number; // Instruction count (16-bit units)
    insns: Uint16Array; // Bytecode instructions
    tries: TryItem[]; // Exception handlers
    handlers: EncodedCatchHandler[];
}
/**
 * Exception try block.
 */
export interface TryItem {
    startAddr: number; // Start code unit
    insnCount: number; // Number of code units covered
    handlerOff: number; // Offset in handler list
}
/**
 * Exception catch handler.
 */
export interface EncodedCatchHandler {
    handlers: TypeAddrPair[]; // Typed exception handlers
    catchAllAddr: number | null; // Catch-all handler address, or null
}
/**
 * Exception type and handler address pair.
 */
export interface TypeAddrPair {
    typeIdx: number; // Exception type index
    addr: number; // Handler code address
}
/**
 * Access flags for classes, fields, and methods.
 */
export const AccessFlags = {
    ACC_PUBLIC: 0x0001,
    ACC_PRIVATE: 0x0002,
    ACC_PROTECTED: 0x0004,
    ACC_STATIC: 0x0008,
    ACC_FINAL: 0x0010,
    ACC_SYNCHRONIZED: 0x0020,
    ACC_VOLATILE: 0x0040,
    ACC_BRIDGE: 0x0040,
    ACC_TRANSIENT: 0x0080,
    ACC_VARARGS: 0x0080,
    ACC_NATIVE: 0x0100,
    ACC_INTERFACE: 0x0200,
    ACC_ABSTRACT: 0x0400,
    ACC_STRICT: 0x0800,
    ACC_SYNTHETIC: 0x1000,
    ACC_ANNOTATION: 0x2000,
    ACC_ENUM: 0x4000,
    ACC_CONSTRUCTOR: 0x10000,
    ACC_DECLARED_SYNCHRONIZED: 0x20000,
} as const;
/**
 * Convert access flags to a human-readable string.
 */
export function accessFlagsToString(flags: number, isMethod: boolean = false): string {
    const parts: string[] = [];
    if (flags & AccessFlags.ACC_PUBLIC)
        parts.push('PUBLIC');
    if (flags & AccessFlags.ACC_PRIVATE)
        parts.push('PRIVATE');
    if (flags & AccessFlags.ACC_PROTECTED)
        parts.push('PROTECTED');
    if (flags & AccessFlags.ACC_STATIC)
        parts.push('STATIC');
    if (flags & AccessFlags.ACC_FINAL)
        parts.push('FINAL');
    if (isMethod) {
        if (flags & AccessFlags.ACC_SYNCHRONIZED)
            parts.push('SYNCHRONIZED');
        if (flags & AccessFlags.ACC_BRIDGE)
            parts.push('BRIDGE');
        if (flags & AccessFlags.ACC_VARARGS)
            parts.push('VARARGS');
    }
    else {
        if (flags & AccessFlags.ACC_VOLATILE)
            parts.push('VOLATILE');
        if (flags & AccessFlags.ACC_TRANSIENT)
            parts.push('TRANSIENT');
    }
    if (flags & AccessFlags.ACC_NATIVE)
        parts.push('NATIVE');
    if (flags & AccessFlags.ACC_INTERFACE)
        parts.push('INTERFACE');
    if (flags & AccessFlags.ACC_ABSTRACT)
        parts.push('ABSTRACT');
    if (flags & AccessFlags.ACC_STRICT)
        parts.push('STRICT');
    if (flags & AccessFlags.ACC_SYNTHETIC)
        parts.push('SYNTHETIC');
    if (flags & AccessFlags.ACC_ANNOTATION)
        parts.push('ANNOTATION');
    if (flags & AccessFlags.ACC_ENUM)
        parts.push('ENUM');
    if (flags & AccessFlags.ACC_CONSTRUCTOR)
        parts.push('CONSTRUCTOR');
    if (flags & AccessFlags.ACC_DECLARED_SYNCHRONIZED)
        parts.push('DECLARED_SYNCHRONIZED');
    return parts.join(' ');
}
