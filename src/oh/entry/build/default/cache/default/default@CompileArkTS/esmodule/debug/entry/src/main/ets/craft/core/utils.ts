/**
 * Core utility functions for CRAFT.
 * LEB128 encoding/decoding and MUTF-8 string handling.
 */
/**
 * Decode an unsigned LEB128 value from the given data at the specified offset.
 * @returns Tuple of [decoded value, new offset after the encoded bytes]
 */
export function decodeUleb128(data: Uint8Array, offset: number): [
    number,
    number
] {
    let result = 0;
    let shift = 0;
    let position = offset;
    while (true) {
        const byte = data[position++];
        result |= (byte & 0x7F) << shift;
        if ((byte & 0x80) === 0) {
            break;
        }
        shift += 7;
        if (shift >= 35) {
            throw new Error(`ULEB128 too long at offset ${offset}`);
        }
    }
    return [result >>> 0, position];
}
/**
 * Decode a signed LEB128 value from the given data at the specified offset.
 * @returns Tuple of [decoded value, new offset after the encoded bytes]
 */
export function decodeSleb128(data: Uint8Array, offset: number): [
    number,
    number
] {
    let result = 0;
    let shift = 0;
    let position = offset;
    let byte: number;
    do {
        byte = data[position++];
        result |= (byte & 0x7F) << shift;
        shift += 7;
        if (shift >= 35) {
            throw new Error(`SLEB128 too long at offset ${offset}`);
        }
    } while (byte & 0x80);
    // Sign extend if the highest bit of the last byte is set
    if (shift < 32 && (byte & 0x40)) {
        result |= (~0 << shift);
    }
    return [result, position];
}
/**
 * Decode a MUTF-8 encoded string from the given data.
 * MUTF-8 differs from standard UTF-8:
 * - Null character (U+0000) is encoded as 0xC0 0x80
 * - Supplementary characters (> U+FFFF) are encoded as surrogate pairs
 *
 * @param data - The byte array containing MUTF-8 data
 * @param offset - Starting offset in the data
 * @param byteLength - Number of bytes to decode (not including null terminator)
 * @returns The decoded string
 */
export function decodeMutf8(data: Uint8Array, offset: number, byteLength: number): string {
    const chars: number[] = [];
    let pos = offset;
    const end = offset + byteLength;
    while (pos < end) {
        const byte1 = data[pos++];
        if (byte1 === 0) {
            // Null terminator - shouldn't happen before byteLength exhausted
            break;
        }
        else if ((byte1 & 0x80) === 0) {
            // 1-byte character: 0xxxxxxx
            chars.push(byte1);
        }
        else if ((byte1 & 0xE0) === 0xC0) {
            // 2-byte character: 110xxxxx 10xxxxxx
            const byte2 = data[pos++];
            chars.push(((byte1 & 0x1F) << 6) | (byte2 & 0x3F));
        }
        else if ((byte1 & 0xF0) === 0xE0) {
            // 3-byte character: 1110xxxx 10xxxxxx 10xxxxxx
            const byte2 = data[pos++];
            const byte3 = data[pos++];
            chars.push(((byte1 & 0x0F) << 12) | ((byte2 & 0x3F) << 6) | (byte3 & 0x3F));
        }
    }
    return String.fromCharCode(...chars);
}
/**
 * Logger interface for CRAFT components.
 */
export interface Logger {
    error(component: string, message: string): void;
    warn(component: string, message: string): void;
    info(component: string, message: string): void;
    debug(component: string, message: string): void;
}
/**
 * Default logger implementation using console.
 */
export const defaultLogger: Logger = {
    error: (c, m) => console.error(`[CRAFT][${c}][ERROR] ${m}`),
    warn: (c, m) => console.warn(`[CRAFT][${c}][WARN] ${m}`),
    info: (c, m) => console.info(`[CRAFT][${c}][INFO] ${m}`),
    debug: (c, m) => console.debug(`[CRAFT][${c}][DEBUG] ${m}`)
};
/**
 * Read a 16-bit unsigned integer (little-endian) from the data.
 */
export function readUint16LE(data: Uint8Array, offset: number): number {
    return data[offset] | (data[offset + 1] << 8);
}
/**
 * Read a 32-bit unsigned integer (little-endian) from the data.
 */
export function readUint32LE(data: Uint8Array, offset: number): number {
    return (data[offset] |
        (data[offset + 1] << 8) |
        (data[offset + 2] << 16) |
        (data[offset + 3] << 24)) >>> 0;
}
/**
 * Read a 16-bit signed integer (little-endian) from the data.
 */
export function readInt16LE(data: Uint8Array, offset: number): number {
    const val = data[offset] | (data[offset + 1] << 8);
    return val > 0x7FFF ? val - 0x10000 : val;
}
/**
 * Read a 32-bit signed integer (little-endian) from the data.
 */
export function readInt32LE(data: Uint8Array, offset: number): number {
    return (data[offset] |
        (data[offset + 1] << 8) |
        (data[offset + 2] << 16) |
        (data[offset + 3] << 24));
}
