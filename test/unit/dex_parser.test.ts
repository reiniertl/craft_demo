import { DexParser } from '../../src/parser/dex_parser';
import { ParseError } from '../../src/core/errors';
import { HEADER_SIZE, ENDIAN_CONSTANT } from '../../src/parser/dex_types';

// Minimal valid DEX header for testing
function createMinimalDexHeader(): Uint8Array {
    const header = new Uint8Array(HEADER_SIZE);
    
    // Magic: "dex\n035\0"
    header[0] = 0x64; // d
    header[1] = 0x65; // e
    header[2] = 0x78; // x
    header[3] = 0x0A; // \n
    header[4] = 0x30; // 0
    header[5] = 0x33; // 3
    header[6] = 0x35; // 5
    header[7] = 0x00; // null
    
    // Checksum (offset 8, 4 bytes) - any value for now
    header[8] = 0x00;
    header[9] = 0x00;
    header[10] = 0x00;
    header[11] = 0x00;
    
    // Signature (offset 12, 20 bytes) - zeros
    
    // File size (offset 32, 4 bytes)
    const fileSize = HEADER_SIZE;
    header[32] = fileSize & 0xFF;
    header[33] = (fileSize >> 8) & 0xFF;
    header[34] = (fileSize >> 16) & 0xFF;
    header[35] = (fileSize >> 24) & 0xFF;
    
    // Header size (offset 36, 4 bytes) - 0x70 = 112
    header[36] = 0x70;
    header[37] = 0x00;
    header[38] = 0x00;
    header[39] = 0x00;
    
    // Endian tag (offset 40, 4 bytes) - 0x12345678
    header[40] = 0x78;
    header[41] = 0x56;
    header[42] = 0x34;
    header[43] = 0x12;
    
    // Remaining fields are 0 (no strings, types, etc.)
    
    return header;
}

describe('DexParser', () => {
    describe('magic validation', () => {
        test('accepts valid DEX 035 magic', () => {
            const data = createMinimalDexHeader();
            expect(() => new DexParser(data)).not.toThrow();
        });

        test('accepts valid DEX 037 magic', () => {
            const data = createMinimalDexHeader();
            data[6] = 0x37; // Change version to 037
            expect(() => new DexParser(data)).not.toThrow();
        });

        test('accepts valid DEX 038 magic', () => {
            const data = createMinimalDexHeader();
            data[6] = 0x38; // Change version to 038
            expect(() => new DexParser(data)).not.toThrow();
        });

        test('accepts valid DEX 039 magic', () => {
            const data = createMinimalDexHeader();
            data[6] = 0x39; // Change version to 039
            expect(() => new DexParser(data)).not.toThrow();
        });

        test('rejects invalid magic prefix', () => {
            const data = createMinimalDexHeader();
            data[0] = 0x00; // Invalid first byte
            expect(() => new DexParser(data)).toThrow(ParseError);
        });

        test('rejects file too small', () => {
            const data = new Uint8Array(4);
            expect(() => new DexParser(data)).toThrow(ParseError);
        });
    });

    describe('header parsing', () => {
        test('parses header size correctly', () => {
            const data = createMinimalDexHeader();
            const parser = new DexParser(data);
            const header = parser.parseHeader();
            expect(header.headerSize).toBe(HEADER_SIZE);
        });

        test('parses endian tag correctly', () => {
            const data = createMinimalDexHeader();
            const parser = new DexParser(data);
            const header = parser.parseHeader();
            expect(header.endianTag).toBe(ENDIAN_CONSTANT);
        });

        test('rejects invalid header size', () => {
            const data = createMinimalDexHeader();
            // Set invalid header size
            data[36] = 0x60; // Wrong size
            const parser = new DexParser(data);
            expect(() => parser.parseHeader()).toThrow(ParseError);
        });

        test('rejects invalid endian tag', () => {
            const data = createMinimalDexHeader();
            // Set invalid endian tag
            data[40] = 0x00;
            data[41] = 0x00;
            const parser = new DexParser(data);
            expect(() => parser.parseHeader()).toThrow(ParseError);
        });

        test('caches parsed header', () => {
            const data = createMinimalDexHeader();
            const parser = new DexParser(data);
            const header1 = parser.parseHeader();
            const header2 = parser.parseHeader();
            expect(header1).toBe(header2);
        });
    });

    describe('empty DEX file', () => {
        test('returns empty class list for DEX with no classes', () => {
            const data = createMinimalDexHeader();
            const parser = new DexParser(data);
            const classDefs = parser.getClassDefs();
            expect(classDefs).toEqual([]);
        });
    });
});
