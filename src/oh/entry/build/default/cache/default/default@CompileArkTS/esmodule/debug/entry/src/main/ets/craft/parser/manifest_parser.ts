import { ParseError, NotFoundError } from "@bundle:com.craft.runtime/entry/ets/craft/core/errors";
import { readUint16LE, readUint32LE, readInt32LE, defaultLogger } from "@bundle:com.craft.runtime/entry/ets/craft/core/utils";
import type { Logger } from "@bundle:com.craft.runtime/entry/ets/craft/core/utils";
/** Chunk types */
const RES_NULL_TYPE = 0x0000;
const RES_STRING_POOL_TYPE = 0x0001;
const RES_XML_TYPE = 0x0003;
const RES_XML_START_NAMESPACE_TYPE = 0x0100;
const RES_XML_END_NAMESPACE_TYPE = 0x0101;
const RES_XML_START_ELEMENT_TYPE = 0x0102;
const RES_XML_END_ELEMENT_TYPE = 0x0103;
const RES_XML_CDATA_TYPE = 0x0104;
const RES_XML_RESOURCE_MAP_TYPE = 0x0180;
/** Attribute value types */
const TYPE_STRING = 0x03;
const TYPE_INT_DEC = 0x10;
const TYPE_INT_HEX = 0x11;
const TYPE_INT_BOOLEAN = 0x12;
/** String pool flag for UTF-8 encoding */
const UTF8_FLAG = 0x100;
/**
 * Information extracted from AndroidManifest.xml.
 */
export interface ManifestInfo {
    packageName: string;
    mainActivityClass: string;
    minSdkVersion?: number;
    targetSdkVersion?: number;
}
/**
 * Parser for binary AndroidManifest.xml files.
 */
export class ManifestParser {
    private data: Uint8Array;
    private stringPool: string[] = [];
    private logger: Logger;
    constructor(data: Uint8Array, logger: Logger = defaultLogger) {
        this.data = data;
        this.logger = logger;
    }
    /**
     * Parse binary manifest and extract essential information.
     */
    parse(): ManifestInfo {
        let offset = 0;
        // Parse XML header
        const xmlType = readUint16LE(this.data, offset);
        if (xmlType !== RES_XML_TYPE) {
            throw new ParseError('Invalid XML header type: expected 0x' + RES_XML_TYPE.toString(16) + ', got 0x' + xmlType.toString(16));
        }
        const xmlHeaderSize = readUint16LE(this.data, offset + 2);
        const xmlSize = readUint32LE(this.data, offset + 4);
        offset += xmlHeaderSize;
        // Parse chunks until we've processed the whole file
        let packageName = '';
        let mainActivityClass = '';
        let minSdkVersion: number | undefined;
        let targetSdkVersion: number | undefined;
        // Track state for finding main activity
        let currentActivity = '';
        let hasMainAction = false;
        let hasLauncherCategory = false;
        let inIntentFilter = false;
        while (offset < this.data.length) {
            const chunkType = readUint16LE(this.data, offset);
            const chunkHeaderSize = readUint16LE(this.data, offset + 2);
            const chunkSize = readUint32LE(this.data, offset + 4);
            if (chunkSize === 0) {
                break;
            }
            switch (chunkType) {
                case RES_STRING_POOL_TYPE:
                    this.parseStringPool(offset);
                    break;
                case RES_XML_START_ELEMENT_TYPE: {
                    const element = this.parseStartElement(offset);
                    if (element.name === 'manifest') {
                        for (const attr of element.attributes) {
                            if (attr.name === 'package') {
                                packageName = attr.value;
                            }
                        }
                    }
                    else if (element.name === 'uses-sdk') {
                        for (const attr of element.attributes) {
                            if (attr.name === 'minSdkVersion') {
                                minSdkVersion = parseInt(attr.value, 10);
                            }
                            else if (attr.name === 'targetSdkVersion') {
                                targetSdkVersion = parseInt(attr.value, 10);
                            }
                        }
                    }
                    else if (element.name === 'activity' || element.name === 'activity-alias') {
                        for (const attr of element.attributes) {
                            if (attr.name === 'name') {
                                currentActivity = attr.value;
                                // Resolve relative class names
                                if (currentActivity.startsWith('.') && packageName) {
                                    currentActivity = packageName + currentActivity;
                                }
                            }
                        }
                        hasMainAction = false;
                        hasLauncherCategory = false;
                    }
                    else if (element.name === 'intent-filter') {
                        inIntentFilter = true;
                    }
                    else if (element.name === 'action' && inIntentFilter) {
                        for (const attr of element.attributes) {
                            if (attr.name === 'name' && attr.value === 'android.intent.action.MAIN') {
                                hasMainAction = true;
                            }
                        }
                    }
                    else if (element.name === 'category' && inIntentFilter) {
                        for (const attr of element.attributes) {
                            if (attr.name === 'name' && attr.value === 'android.intent.category.LAUNCHER') {
                                hasLauncherCategory = true;
                            }
                        }
                    }
                    break;
                }
                case RES_XML_END_ELEMENT_TYPE: {
                    const element = this.parseEndElement(offset);
                    if (element.name === 'intent-filter') {
                        if (hasMainAction && hasLauncherCategory && currentActivity && !mainActivityClass) {
                            mainActivityClass = currentActivity;
                        }
                        inIntentFilter = false;
                    }
                    else if (element.name === 'activity' || element.name === 'activity-alias') {
                        currentActivity = '';
                    }
                    break;
                }
                case RES_XML_START_NAMESPACE_TYPE:
                case RES_XML_END_NAMESPACE_TYPE:
                case RES_XML_RESOURCE_MAP_TYPE:
                case RES_XML_CDATA_TYPE:
                    // Skip these chunk types
                    break;
                default:
                    this.logger.debug('ManifestParser', 'Skipping unknown chunk type 0x' + chunkType.toString(16));
                    break;
            }
            offset += chunkSize;
        }
        if (!packageName) {
            throw new NotFoundError('Package name not found in manifest');
        }
        if (!mainActivityClass) {
            throw new NotFoundError('Main launcher activity not found in manifest');
        }
        this.logger.info('ManifestParser', 'Package: ' + packageName + ', Main Activity: ' + mainActivityClass);
        return {
            packageName,
            mainActivityClass,
            minSdkVersion,
            targetSdkVersion,
        };
    }
    /**
     * Parse the string pool chunk.
     */
    private parseStringPool(offset: number): void {
        const headerSize = readUint16LE(this.data, offset + 2);
        const stringCount = readUint32LE(this.data, offset + 8);
        const flags = readUint32LE(this.data, offset + 16);
        const stringsStart = readUint32LE(this.data, offset + 20);
        const isUtf8 = (flags & UTF8_FLAG) !== 0;
        const stringOffsets: number[] = [];
        // Read string offsets
        for (let i = 0; i < stringCount; i++) {
            stringOffsets.push(readUint32LE(this.data, offset + 28 + i * 4));
        }
        // Read strings
        const stringsBase = offset + stringsStart;
        this.stringPool = [];
        for (let i = 0; i < stringCount; i++) {
            const stringStart = stringsBase + stringOffsets[i];
            const str = isUtf8
                ? this.readUtf8String(stringStart)
                : this.readUtf16String(stringStart);
            this.stringPool.push(str);
        }
    }
    /**
     * Read a UTF-8 string from the string pool.
     */
    private readUtf8String(offset: number): string {
        // UTF-8 format: char_length (1-2 bytes), byte_length (1-2 bytes), data, null
        let pos = offset;
        // Read char length (1-2 bytes)
        let charLen = this.data[pos++];
        if (charLen & 0x80) {
            charLen = ((charLen & 0x7F) << 8) | this.data[pos++];
        }
        // Read byte length (1-2 bytes)
        let byteLen = this.data[pos++];
        if (byteLen & 0x80) {
            byteLen = ((byteLen & 0x7F) << 8) | this.data[pos++];
        }
        // Read UTF-8 data
        const bytes = this.data.slice(pos, pos + byteLen);
        return ManifestParser.decodeUtf8(bytes);
    }
    /**
     * Read a UTF-16 string from the string pool.
     */
    private readUtf16String(offset: number): string {
        let pos = offset;
        // Read length (2 or 4 bytes)
        let len = readUint16LE(this.data, pos);
        pos += 2;
        if (len & 0x8000) {
            len = ((len & 0x7FFF) << 16) | readUint16LE(this.data, pos);
            pos += 2;
        }
        // Read UTF-16LE data
        const chars: number[] = [];
        for (let i = 0; i < len; i++) {
            chars.push(readUint16LE(this.data, pos + i * 2));
        }
        return String.fromCharCode(...chars);
    }
    /**
     * Get a string from the pool by index.
     */
    private getPoolString(idx: number): string {
        if (idx < 0 || idx >= this.stringPool.length) {
            return '';
        }
        return this.stringPool[idx];
    }
    /**
     * Parse a start element chunk.
     */
    private parseStartElement(offset: number): {
        name: string;
        attributes: {
            name: string;
            value: string;
        }[];
    } {
        const namespaceIdx = readInt32LE(this.data, offset + 16);
        const nameIdx = readInt32LE(this.data, offset + 20);
        const attrCount = readUint16LE(this.data, offset + 28);
        const name = this.getPoolString(nameIdx);
        const attributes: {
            name: string;
            value: string;
        }[] = [];
        let attrOffset = offset + 36;
        for (let i = 0; i < attrCount; i++) {
            const attrNameIdx = readInt32LE(this.data, attrOffset + 4);
            const rawValueIdx = readInt32LE(this.data, attrOffset + 8);
            const typedValueType = this.data[attrOffset + 15];
            const typedValueData = readUint32LE(this.data, attrOffset + 16);
            const attrName = this.getPoolString(attrNameIdx);
            let attrValue: string;
            if (rawValueIdx >= 0) {
                attrValue = this.getPoolString(rawValueIdx);
            }
            else if (typedValueType === TYPE_STRING) {
                attrValue = this.getPoolString(typedValueData);
            }
            else if (typedValueType === TYPE_INT_DEC || typedValueType === TYPE_INT_HEX) {
                attrValue = typedValueData.toString();
            }
            else if (typedValueType === TYPE_INT_BOOLEAN) {
                attrValue = typedValueData !== 0 ? 'true' : 'false';
            }
            else {
                attrValue = '0x' + typedValueData.toString(16);
            }
            // Strip namespace prefix from attribute name if present
            const attrNameClean = attrName.includes(':') ? attrName.split(':')[1] : attrName;
            attributes.push({ name: attrNameClean, value: attrValue });
            attrOffset += 20;
        }
        return { name, attributes };
    }
    /**
     * Parse an end element chunk.
     */
    private parseEndElement(offset: number): {
        name: string;
    } {
        const nameIdx = readInt32LE(this.data, offset + 20);
        return { name: this.getPoolString(nameIdx) };
    }
    private static decodeUtf8(bytes: Uint8Array): string {
        let result = '';
        let i = 0;
        while (i < bytes.length) {
            const byte = bytes[i];
            if (byte < 0x80) {
                result += String.fromCharCode(byte);
                i++;
            }
            else if ((byte & 0xE0) === 0xC0) {
                result += String.fromCharCode(((byte & 0x1F) << 6) | (bytes[i + 1] & 0x3F));
                i += 2;
            }
            else if ((byte & 0xF0) === 0xE0) {
                result += String.fromCharCode(((byte & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F));
                i += 3;
            }
            else {
                const codePoint = ((byte & 0x07) << 18) | ((bytes[i + 1] & 0x3F) << 12) | ((bytes[i + 2] & 0x3F) << 6) | (bytes[i + 3] & 0x3F);
                const offset = codePoint - 0x10000;
                result += String.fromCharCode(0xD800 + (offset >> 10), 0xDC00 + (offset & 0x3FF));
                i += 4;
            }
        }
        return result;
    }
    /**
     * Static convenience method.
     */
    static parse(data: Uint8Array, logger?: Logger): ManifestInfo {
        return new ManifestParser(data, logger).parse();
    }
}
