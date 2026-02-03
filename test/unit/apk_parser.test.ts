import { APKParser } from '../../src/parser/apk_parser';
import { ParseError, NotFoundError } from '../../src/core/errors';

// Minimal valid ZIP file for testing (empty, STORE compression)
function createMinimalZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
    const parts: Uint8Array[] = [];
    const centralDirectory: Uint8Array[] = [];
    let offset = 0;

    // Local file headers and data
    for (const file of files) {
        const nameBytes = new TextEncoder().encode(file.name);
        
        // Local file header
        const lfh = new Uint8Array(30 + nameBytes.length);
        const lfhView = new DataView(lfh.buffer);
        
        lfhView.setUint32(0, 0x04034b50, true);  // Signature
        lfhView.setUint16(4, 10, true);          // Version needed
        lfhView.setUint16(6, 0, true);           // Flags
        lfhView.setUint16(8, 0, true);           // Compression: STORE
        lfhView.setUint16(10, 0, true);          // Time
        lfhView.setUint16(12, 0, true);          // Date
        lfhView.setUint32(14, 0, true);          // CRC-32
        lfhView.setUint32(18, file.data.length, true);  // Compressed size
        lfhView.setUint32(22, file.data.length, true);  // Uncompressed size
        lfhView.setUint16(26, nameBytes.length, true);  // File name length
        lfhView.setUint16(28, 0, true);          // Extra field length
        lfh.set(nameBytes, 30);
        
        // Central directory entry
        const cd = new Uint8Array(46 + nameBytes.length);
        const cdView = new DataView(cd.buffer);
        
        cdView.setUint32(0, 0x02014b50, true);   // Signature
        cdView.setUint16(4, 0, true);            // Version made by
        cdView.setUint16(6, 10, true);           // Version needed
        cdView.setUint16(8, 0, true);            // Flags
        cdView.setUint16(10, 0, true);           // Compression: STORE
        cdView.setUint16(12, 0, true);           // Time
        cdView.setUint16(14, 0, true);           // Date
        cdView.setUint32(16, 0, true);           // CRC-32
        cdView.setUint32(20, file.data.length, true);  // Compressed size
        cdView.setUint32(24, file.data.length, true);  // Uncompressed size
        cdView.setUint16(28, nameBytes.length, true);  // File name length
        cdView.setUint16(30, 0, true);           // Extra field length
        cdView.setUint16(32, 0, true);           // Comment length
        cdView.setUint16(34, 0, true);           // Disk number start
        cdView.setUint16(36, 0, true);           // Internal attrs
        cdView.setUint32(38, 0, true);           // External attrs
        cdView.setUint32(42, offset, true);      // Local header offset
        cd.set(nameBytes, 46);
        
        parts.push(lfh);
        parts.push(file.data);
        centralDirectory.push(cd);
        
        offset += lfh.length + file.data.length;
    }

    // Central directory
    const cdOffset = offset;
    let cdSize = 0;
    for (const cd of centralDirectory) {
        parts.push(cd);
        cdSize += cd.length;
    }

    // End of central directory
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    
    eocdView.setUint32(0, 0x06054b50, true);     // Signature
    eocdView.setUint16(4, 0, true);              // Disk number
    eocdView.setUint16(6, 0, true);              // CD disk number
    eocdView.setUint16(8, files.length, true);   // CD entries on disk
    eocdView.setUint16(10, files.length, true);  // Total CD entries
    eocdView.setUint32(12, cdSize, true);        // CD size
    eocdView.setUint32(16, cdOffset, true);      // CD offset
    eocdView.setUint16(20, 0, true);             // Comment length
    
    parts.push(eocd);

    // Combine all parts
    const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
    const result = new Uint8Array(totalLength);
    let pos = 0;
    for (const part of parts) {
        result.set(part, pos);
        pos += part.length;
    }

    return result;
}

// Suppress logger output during tests
const silentLogger = {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
};

describe('APKParser', () => {
    describe('ZIP validation', () => {
        test('rejects non-ZIP data', () => {
            const data = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
            const parser = new APKParser(silentLogger);
            expect(() => parser.parse(data)).toThrow(ParseError);
        });

        test('rejects empty data', () => {
            const data = new Uint8Array(0);
            const parser = new APKParser(silentLogger);
            expect(() => parser.parse(data)).toThrow(ParseError);
        });
    });

    describe('required files', () => {
        test('rejects ZIP without AndroidManifest.xml', () => {
            const zip = createMinimalZip([
                { name: 'classes.dex', data: new Uint8Array([0x64, 0x65, 0x78]) }
            ]);
            const parser = new APKParser(silentLogger);
            expect(() => parser.parse(zip)).toThrow(NotFoundError);
        });

        test('rejects ZIP without classes.dex', () => {
            const zip = createMinimalZip([
                { name: 'AndroidManifest.xml', data: new Uint8Array([0x03, 0x00]) }
            ]);
            const parser = new APKParser(silentLogger);
            expect(() => parser.parse(zip)).toThrow(NotFoundError);
        });

        test('accepts ZIP with both required files', () => {
            const zip = createMinimalZip([
                { name: 'AndroidManifest.xml', data: new Uint8Array([0x03, 0x00, 0x08, 0x00]) },
                { name: 'classes.dex', data: new Uint8Array([0x64, 0x65, 0x78, 0x0A]) }
            ]);
            const parser = new APKParser(silentLogger);
            const result = parser.parse(zip);
            expect(result.manifest).toBeDefined();
            expect(result.dexFiles.has('classes.dex')).toBe(true);
        });
    });

    describe('file extraction', () => {
        test('extracts manifest correctly', () => {
            const manifestData = new Uint8Array([0x03, 0x00, 0x08, 0x00, 0x01, 0x02, 0x03, 0x04]);
            const zip = createMinimalZip([
                { name: 'AndroidManifest.xml', data: manifestData },
                { name: 'classes.dex', data: new Uint8Array([0x64, 0x65, 0x78, 0x0A]) }
            ]);
            const parser = new APKParser(silentLogger);
            const result = parser.parse(zip);
            expect(Array.from(result.manifest)).toEqual(Array.from(manifestData));
        });

        test('extracts DEX correctly', () => {
            const dexData = new Uint8Array([0x64, 0x65, 0x78, 0x0A, 0x30, 0x33, 0x35, 0x00]);
            const zip = createMinimalZip([
                { name: 'AndroidManifest.xml', data: new Uint8Array([0x03, 0x00, 0x08, 0x00]) },
                { name: 'classes.dex', data: dexData }
            ]);
            const parser = new APKParser(silentLogger);
            const result = parser.parse(zip);
            expect(Array.from(result.dexFiles.get('classes.dex')!)).toEqual(Array.from(dexData));
        });

        test('extracts multiple DEX files', () => {
            const zip = createMinimalZip([
                { name: 'AndroidManifest.xml', data: new Uint8Array([0x03, 0x00, 0x08, 0x00]) },
                { name: 'classes.dex', data: new Uint8Array([0x01]) },
                { name: 'classes2.dex', data: new Uint8Array([0x02]) },
                { name: 'classes3.dex', data: new Uint8Array([0x03]) }
            ]);
            const parser = new APKParser(silentLogger);
            const result = parser.parse(zip);
            expect(result.dexFiles.size).toBe(3);
            expect(result.dexFiles.has('classes.dex')).toBe(true);
            expect(result.dexFiles.has('classes2.dex')).toBe(true);
            expect(result.dexFiles.has('classes3.dex')).toBe(true);
        });

        test('extracts resources.arsc if present', () => {
            const resourcesData = new Uint8Array([0x02, 0x00, 0x0C, 0x00]);
            const zip = createMinimalZip([
                { name: 'AndroidManifest.xml', data: new Uint8Array([0x03, 0x00, 0x08, 0x00]) },
                { name: 'classes.dex', data: new Uint8Array([0x64, 0x65, 0x78, 0x0A]) },
                { name: 'resources.arsc', data: resourcesData }
            ]);
            const parser = new APKParser(silentLogger);
            const result = parser.parse(zip);
            expect(result.resources).not.toBeNull();
            expect(Array.from(result.resources!)).toEqual(Array.from(resourcesData));
        });

        test('returns null resources if not present', () => {
            const zip = createMinimalZip([
                { name: 'AndroidManifest.xml', data: new Uint8Array([0x03, 0x00, 0x08, 0x00]) },
                { name: 'classes.dex', data: new Uint8Array([0x64, 0x65, 0x78, 0x0A]) }
            ]);
            const parser = new APKParser(silentLogger);
            const result = parser.parse(zip);
            expect(result.resources).toBeNull();
        });
    });
});
