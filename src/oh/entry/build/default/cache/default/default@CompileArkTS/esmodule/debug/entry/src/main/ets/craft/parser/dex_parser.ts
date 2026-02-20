import { ParseError, NotFoundError } from "@bundle:com.craft.runtime/entry/ets/craft/core/errors";
import { decodeUleb128, decodeSleb128, decodeMutf8, readUint16LE, readUint32LE, defaultLogger } from "@bundle:com.craft.runtime/entry/ets/craft/core/utils";
import type { Logger } from "@bundle:com.craft.runtime/entry/ets/craft/core/utils";
import { HEADER_SIZE, ENDIAN_CONSTANT, } from "@bundle:com.craft.runtime/entry/ets/craft/parser/dex_types";
import type { DexHeader, ClassDefItem, ClassDataItem, EncodedField, EncodedMethod, CodeItem, TryItem, EncodedCatchHandler, TypeAddrPair, MethodIdItem, FieldIdItem, ProtoIdItem } from "@bundle:com.craft.runtime/entry/ets/craft/parser/dex_types";
/**
 * Parser for DEX (Dalvik Executable) files.
 */
export class DexParser {
    private data: Uint8Array;
    private header: DexHeader | null = null;
    private stringCache: Map<number, string> = new Map();
    private logger: Logger;
    constructor(data: Uint8Array, logger: Logger = defaultLogger) {
        this.data = data;
        this.logger = logger;
        this.validateMagic();
    }
    /**
     * Validate the DEX magic number.
     */
    private validateMagic(): void {
        if (this.data.length < 8) {
            throw new ParseError('File too small to be a valid DEX file');
        }
        // Check "dex\n"
        if (this.data[0] !== 0x64 || this.data[1] !== 0x65 ||
            this.data[2] !== 0x78 || this.data[3] !== 0x0A) {
            throw new ParseError('Invalid DEX magic number');
        }
        // Check version (035, 037, 038, or 039)
        const version = String.fromCharCode(this.data[4], this.data[5], this.data[6]);
        if (!['035', '037', '038', '039'].includes(version)) {
            this.logger.warn('DexParser', 'Unknown DEX version ' + version + ', attempting parse');
        }
    }
    /**
     * Parse and return the DEX header.
     */
    parseHeader(): DexHeader {
        if (this.header) {
            return this.header;
        }
        if (this.data.length < HEADER_SIZE) {
            throw new ParseError('File too small for DEX header: expected ' + HEADER_SIZE + ' bytes, got ' + this.data.length);
        }
        const magic = this.data.slice(0, 8);
        const checksum = readUint32LE(this.data, 8);
        const signature = this.data.slice(12, 32);
        const fileSize = readUint32LE(this.data, 32);
        const headerSize = readUint32LE(this.data, 36);
        const endianTag = readUint32LE(this.data, 40);
        if (headerSize !== HEADER_SIZE) {
            throw new ParseError('Invalid header size: expected ' + HEADER_SIZE + ', got ' + headerSize);
        }
        if (endianTag !== ENDIAN_CONSTANT) {
            throw new ParseError('Invalid endian tag: expected 0x' + ENDIAN_CONSTANT.toString(16) + ', got 0x' + endianTag.toString(16));
        }
        this.header = {
            magic,
            checksum,
            signature,
            fileSize,
            headerSize,
            endianTag,
            linkSize: readUint32LE(this.data, 44),
            linkOff: readUint32LE(this.data, 48),
            mapOff: readUint32LE(this.data, 52),
            stringIdsSize: readUint32LE(this.data, 56),
            stringIdsOff: readUint32LE(this.data, 60),
            typeIdsSize: readUint32LE(this.data, 64),
            typeIdsOff: readUint32LE(this.data, 68),
            protoIdsSize: readUint32LE(this.data, 72),
            protoIdsOff: readUint32LE(this.data, 76),
            fieldIdsSize: readUint32LE(this.data, 80),
            fieldIdsOff: readUint32LE(this.data, 84),
            methodIdsSize: readUint32LE(this.data, 88),
            methodIdsOff: readUint32LE(this.data, 92),
            classDefsSize: readUint32LE(this.data, 96),
            classDefsOff: readUint32LE(this.data, 100),
            dataSize: readUint32LE(this.data, 104),
            dataOff: readUint32LE(this.data, 108),
        };
        this.logger.info('DexParser', 'DEX parsed: ' + this.header.classDefsSize + ' classes, ' + this.header.methodIdsSize + ' methods');
        return this.header;
    }
    /**
     * Get a string by its index in the string table.
     */
    getString(idx: number): string {
        if (this.stringCache.has(idx)) {
            return this.stringCache.get(idx)!;
        }
        const header = this.parseHeader();
        if (idx < 0 || idx >= header.stringIdsSize) {
            throw new NotFoundError('Invalid string index: ' + idx);
        }
        // Get string_id_item offset
        const stringIdOff = header.stringIdsOff + idx * 4;
        const stringDataOff = readUint32LE(this.data, stringIdOff);
        // Read string_data_item: ULEB128 length followed by MUTF-8 data
        const [utf16Length, dataStart] = decodeUleb128(this.data, stringDataOff);
        // Find the null terminator to get actual byte length
        let byteLength = 0;
        while (this.data[dataStart + byteLength] !== 0) {
            byteLength++;
        }
        const str = decodeMutf8(this.data, dataStart, byteLength);
        this.stringCache.set(idx, str);
        return str;
    }
    /**
     * Get a type name by its index in the type table.
     */
    getTypeName(idx: number): string {
        const header = this.parseHeader();
        if (idx < 0 || idx >= header.typeIdsSize) {
            throw new NotFoundError('Invalid type index: ' + idx);
        }
        const typeIdOff = header.typeIdsOff + idx * 4;
        const descriptorIdx = readUint32LE(this.data, typeIdOff);
        return this.getString(descriptorIdx);
    }
    /**
     * Get all class definitions.
     */
    getClassDefs(): ClassDefItem[] {
        const header = this.parseHeader();
        const classDefs: ClassDefItem[] = [];
        for (let i = 0; i < header.classDefsSize; i++) {
            classDefs.push(this.getClassDefByIndex(i));
        }
        return classDefs;
    }
    /**
     * Get a class definition by index.
     */
    getClassDefByIndex(idx: number): ClassDefItem {
        const header = this.parseHeader();
        if (idx < 0 || idx >= header.classDefsSize) {
            throw new NotFoundError('Invalid class def index: ' + idx);
        }
        const offset = header.classDefsOff + idx * 32;
        return {
            classIdx: readUint32LE(this.data, offset),
            accessFlags: readUint32LE(this.data, offset + 4),
            superclassIdx: readUint32LE(this.data, offset + 8),
            interfacesOff: readUint32LE(this.data, offset + 12),
            sourceFileIdx: readUint32LE(this.data, offset + 16),
            annotationsOff: readUint32LE(this.data, offset + 20),
            classDataOff: readUint32LE(this.data, offset + 24),
            staticValuesOff: readUint32LE(this.data, offset + 28),
        };
    }
    /**
     * Find a class definition by its type descriptor.
     */
    getClassDef(className: string): ClassDefItem | null {
        const header = this.parseHeader();
        for (let i = 0; i < header.classDefsSize; i++) {
            const classDef = this.getClassDefByIndex(i);
            const typeName = this.getTypeName(classDef.classIdx);
            if (typeName === className) {
                return classDef;
            }
        }
        return null;
    }
    /**
     * Parse the class data for a class definition.
     */
    getClassData(classDef: ClassDefItem): ClassDataItem {
        if (classDef.classDataOff === 0) {
            return {
                staticFields: [],
                instanceFields: [],
                directMethods: [],
                virtualMethods: [],
            };
        }
        let offset = classDef.classDataOff;
        const [staticFieldsSize, off1] = decodeUleb128(this.data, offset);
        const [instanceFieldsSize, off2] = decodeUleb128(this.data, off1);
        const [directMethodsSize, off3] = decodeUleb128(this.data, off2);
        const [virtualMethodsSize, off4] = decodeUleb128(this.data, off3);
        offset = off4;
        // Parse static fields
        const staticFields: EncodedField[] = [];
        let fieldIdx = 0;
        for (let i = 0; i < staticFieldsSize; i++) {
            const [fieldIdxDiff, off1] = decodeUleb128(this.data, offset);
            const [accessFlags, off2] = decodeUleb128(this.data, off1);
            fieldIdx += fieldIdxDiff;
            staticFields.push({ fieldIdx, accessFlags });
            offset = off2;
        }
        // Parse instance fields
        const instanceFields: EncodedField[] = [];
        fieldIdx = 0;
        for (let i = 0; i < instanceFieldsSize; i++) {
            const [fieldIdxDiff, off1] = decodeUleb128(this.data, offset);
            const [accessFlags, off2] = decodeUleb128(this.data, off1);
            fieldIdx += fieldIdxDiff;
            instanceFields.push({ fieldIdx, accessFlags });
            offset = off2;
        }
        // Parse direct methods
        const directMethods: EncodedMethod[] = [];
        let methodIdx = 0;
        for (let i = 0; i < directMethodsSize; i++) {
            const [methodIdxDiff, off1] = decodeUleb128(this.data, offset);
            const [accessFlags, off2] = decodeUleb128(this.data, off1);
            const [codeOff, off3] = decodeUleb128(this.data, off2);
            methodIdx += methodIdxDiff;
            directMethods.push({ methodIdx, accessFlags, codeOff });
            offset = off3;
        }
        // Parse virtual methods
        const virtualMethods: EncodedMethod[] = [];
        methodIdx = 0;
        for (let i = 0; i < virtualMethodsSize; i++) {
            const [methodIdxDiff, off1] = decodeUleb128(this.data, offset);
            const [accessFlags, off2] = decodeUleb128(this.data, off1);
            const [codeOff, off3] = decodeUleb128(this.data, off2);
            methodIdx += methodIdxDiff;
            virtualMethods.push({ methodIdx, accessFlags, codeOff });
            offset = off3;
        }
        return { staticFields, instanceFields, directMethods, virtualMethods };
    }
    /**
     * Get the bytecode for a method.
     */
    getMethodCode(codeOffset: number): CodeItem | null {
        if (codeOffset === 0) {
            return null;
        }
        let offset = codeOffset;
        const registersSize = readUint16LE(this.data, offset);
        const insSize = readUint16LE(this.data, offset + 2);
        const outsSize = readUint16LE(this.data, offset + 4);
        const triesSize = readUint16LE(this.data, offset + 6);
        const debugInfoOff = readUint32LE(this.data, offset + 8);
        const insnsSize = readUint32LE(this.data, offset + 12);
        offset += 16;
        // Read instructions
        const insns = new Uint16Array(insnsSize);
        for (let i = 0; i < insnsSize; i++) {
            insns[i] = readUint16LE(this.data, offset + i * 2);
        }
        offset += insnsSize * 2;
        // Padding if triesSize > 0 and insnsSize is odd
        if (triesSize > 0 && insnsSize % 2 !== 0) {
            offset += 2;
        }
        // Parse tries
        const tries: TryItem[] = [];
        const handlersOffset = offset + triesSize * 8;
        for (let i = 0; i < triesSize; i++) {
            tries.push({
                startAddr: readUint32LE(this.data, offset),
                insnCount: readUint16LE(this.data, offset + 4),
                handlerOff: readUint16LE(this.data, offset + 6),
            });
            offset += 8;
        }
        // Parse handlers if there are tries
        const handlers: EncodedCatchHandler[] = [];
        if (triesSize > 0) {
            let handlerOffset = handlersOffset;
            const [handlersSize, off1] = decodeUleb128(this.data, handlerOffset);
            handlerOffset = off1;
            for (let i = 0; i < handlersSize; i++) {
                const [size, off2] = decodeSleb128(this.data, handlerOffset);
                handlerOffset = off2;
                const handlerPairs: TypeAddrPair[] = [];
                const absSize = Math.abs(size);
                for (let j = 0; j < absSize; j++) {
                    const [typeIdx, off3] = decodeUleb128(this.data, handlerOffset);
                    const [addr, off4] = decodeUleb128(this.data, off3);
                    handlerPairs.push({ typeIdx, addr });
                    handlerOffset = off4;
                }
                let catchAllAddr: number | null = null;
                if (size <= 0) {
                    const [addr, off5] = decodeUleb128(this.data, handlerOffset);
                    catchAllAddr = addr;
                    handlerOffset = off5;
                }
                handlers.push({ handlers: handlerPairs, catchAllAddr });
            }
        }
        return {
            registersSize,
            insSize,
            outsSize,
            triesSize,
            debugInfoOff,
            insnsSize,
            insns,
            tries,
            handlers,
        };
    }
    /**
     * Get method information by index.
     */
    getMethodId(idx: number): MethodIdItem {
        const header = this.parseHeader();
        if (idx < 0 || idx >= header.methodIdsSize) {
            throw new NotFoundError('Invalid method index: ' + idx);
        }
        const offset = header.methodIdsOff + idx * 8;
        return {
            classIdx: readUint16LE(this.data, offset),
            protoIdx: readUint16LE(this.data, offset + 2),
            nameIdx: readUint32LE(this.data, offset + 4),
        };
    }
    /**
     * Get field information by index.
     */
    getFieldId(idx: number): FieldIdItem {
        const header = this.parseHeader();
        if (idx < 0 || idx >= header.fieldIdsSize) {
            throw new NotFoundError('Invalid field index: ' + idx);
        }
        const offset = header.fieldIdsOff + idx * 8;
        return {
            classIdx: readUint16LE(this.data, offset),
            typeIdx: readUint16LE(this.data, offset + 2),
            nameIdx: readUint32LE(this.data, offset + 4),
        };
    }
    /**
     * Get prototype information by index.
     */
    getProtoId(idx: number): ProtoIdItem {
        const header = this.parseHeader();
        if (idx < 0 || idx >= header.protoIdsSize) {
            throw new NotFoundError('Invalid proto index: ' + idx);
        }
        const offset = header.protoIdsOff + idx * 12;
        return {
            shortyIdx: readUint32LE(this.data, offset),
            returnTypeIdx: readUint32LE(this.data, offset + 4),
            parametersOff: readUint32LE(this.data, offset + 8),
        };
    }
    /**
     * Get parameter types for a prototype.
     */
    getProtoParameters(proto: ProtoIdItem): number[] {
        if (proto.parametersOff === 0) {
            return [];
        }
        const size = readUint32LE(this.data, proto.parametersOff);
        const params: number[] = [];
        for (let i = 0; i < size; i++) {
            params.push(readUint16LE(this.data, proto.parametersOff + 4 + i * 2));
        }
        return params;
    }
    /**
     * Format a method signature for display.
     */
    formatMethodSignature(methodId: MethodIdItem): string {
        const className = this.getTypeName(methodId.classIdx);
        const methodName = this.getString(methodId.nameIdx);
        const proto = this.getProtoId(methodId.protoIdx);
        const returnType = this.getTypeName(proto.returnTypeIdx);
        const params = this.getProtoParameters(proto);
        const paramTypes = params.map(p => this.getTypeName(p)).join(', ');
        return className + '->' + methodName + '(' + paramTypes + ')' + returnType;
    }
}
