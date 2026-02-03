import { decodeUleb128, decodeSleb128, decodeMutf8 } from '../../src/core/utils';

describe('ULEB128', () => {
    test('decodes 0', () => {
        const data = new Uint8Array([0x00]);
        expect(decodeUleb128(data, 0)).toEqual([0, 1]);
    });

    test('decodes 1', () => {
        const data = new Uint8Array([0x01]);
        expect(decodeUleb128(data, 0)).toEqual([1, 1]);
    });

    test('decodes 127 (max single byte)', () => {
        const data = new Uint8Array([0x7F]);
        expect(decodeUleb128(data, 0)).toEqual([127, 1]);
    });

    test('decodes 128 (min two byte)', () => {
        const data = new Uint8Array([0x80, 0x01]);
        expect(decodeUleb128(data, 0)).toEqual([128, 2]);
    });

    test('decodes 255', () => {
        const data = new Uint8Array([0xFF, 0x01]);
        expect(decodeUleb128(data, 0)).toEqual([255, 2]);
    });

    test('decodes 300', () => {
        const data = new Uint8Array([0xAC, 0x02]);
        expect(decodeUleb128(data, 0)).toEqual([300, 2]);
    });

    test('decodes 16384 (three bytes)', () => {
        const data = new Uint8Array([0x80, 0x80, 0x01]);
        expect(decodeUleb128(data, 0)).toEqual([16384, 3]);
    });

    test('decodes at non-zero offset', () => {
        const data = new Uint8Array([0x00, 0x00, 0xAC, 0x02]);
        expect(decodeUleb128(data, 2)).toEqual([300, 4]);
    });
});

describe('SLEB128', () => {
    test('decodes 0', () => {
        const data = new Uint8Array([0x00]);
        expect(decodeSleb128(data, 0)).toEqual([0, 1]);
    });

    test('decodes 1', () => {
        const data = new Uint8Array([0x01]);
        expect(decodeSleb128(data, 0)).toEqual([1, 1]);
    });

    test('decodes -1', () => {
        const data = new Uint8Array([0x7F]);
        expect(decodeSleb128(data, 0)).toEqual([-1, 1]);
    });

    test('decodes 63 (max positive single byte)', () => {
        const data = new Uint8Array([0x3F]);
        expect(decodeSleb128(data, 0)).toEqual([63, 1]);
    });

    test('decodes -64 (min negative single byte)', () => {
        const data = new Uint8Array([0x40]);
        expect(decodeSleb128(data, 0)).toEqual([-64, 1]);
    });

    test('decodes 128', () => {
        const data = new Uint8Array([0x80, 0x01]);
        expect(decodeSleb128(data, 0)).toEqual([128, 2]);
    });

    test('decodes -128', () => {
        const data = new Uint8Array([0x80, 0x7F]);
        expect(decodeSleb128(data, 0)).toEqual([-128, 2]);
    });

    test('decodes -129', () => {
        const data = new Uint8Array([0xFF, 0x7E]);
        expect(decodeSleb128(data, 0)).toEqual([-129, 2]);
    });
});

describe('MUTF-8', () => {
    test('decodes ASCII', () => {
        const data = new Uint8Array([0x48, 0x69]); // "Hi"
        expect(decodeMutf8(data, 0, 2)).toBe('Hi');
    });

    test('decodes empty string', () => {
        const data = new Uint8Array([]);
        expect(decodeMutf8(data, 0, 0)).toBe('');
    });

    test('decodes null character (MUTF-8 special case)', () => {
        // MUTF-8 encodes U+0000 as 0xC0 0x80
        const data = new Uint8Array([0xC0, 0x80]);
        expect(decodeMutf8(data, 0, 2)).toBe('\u0000');
    });

    test('decodes 2-byte character', () => {
        // U+00A9 (copyright) = 0xC2 0xA9
        const data = new Uint8Array([0xC2, 0xA9]);
        expect(decodeMutf8(data, 0, 2)).toBe('\u00A9');
    });

    test('decodes 3-byte character', () => {
        // U+4E2D (Chinese character "middle") = 0xE4 0xB8 0xAD
        const data = new Uint8Array([0xE4, 0xB8, 0xAD]);
        expect(decodeMutf8(data, 0, 3)).toBe('\u4E2D');
    });

    test('decodes mixed ASCII and multi-byte', () => {
        // "A" + U+00A9 + "B" = 0x41 0xC2 0xA9 0x42
        const data = new Uint8Array([0x41, 0xC2, 0xA9, 0x42]);
        expect(decodeMutf8(data, 0, 4)).toBe('A\u00A9B');
    });

    test('decodes at non-zero offset', () => {
        const data = new Uint8Array([0x00, 0x00, 0x48, 0x69]); // prefix + "Hi"
        expect(decodeMutf8(data, 2, 2)).toBe('Hi');
    });
});
