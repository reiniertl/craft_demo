/**
 * APK Parser - ZIP extraction for Android Package files.
 * Supports STORE compression only (no DEFLATE).
 */

import * as fs from 'fs';
import { ParseError, NotFoundError } from '../core/errors';
import { readUint16LE, readUint32LE, defaultLogger, Logger } from '../core/utils';

/** ZIP End of Central Directory signature */
const EOCD_SIGNATURE = 0x06054b50;
/** ZIP Central Directory Entry signature */
const CD_SIGNATURE = 0x02014b50;
/** ZIP Local File Header signature */
const LFH_SIGNATURE = 0x04034b50;

/** Compression method: STORE (no compression) */
const COMPRESSION_STORE = 0;
/** Compression method: DEFLATE */
const COMPRESSION_DEFLATE = 8;

/**
 * Contents extracted from an APK file.
 */
export interface APKContents {
    /** Raw binary AndroidManifest.xml */
    manifest: Uint8Array;
    /** DEX files keyed by path (e.g., "classes.dex", "classes2.dex") */
    dexFiles: Map<string, Uint8Array>;
    /** Raw resources.arsc if present */
    resources: Uint8Array | null;
}

/**
 * Central Directory entry information.
 */
interface CDEntry {
    fileName: string;
    compressedSize: number;
    uncompressedSize: number;
    compressionMethod: number;
    localHeaderOffset: number;
}

/**
 * Parser for APK (Android Package) files.
 */
export class APKParser {
    private logger: Logger;

    constructor(logger: Logger = defaultLogger) {
        this.logger = logger;
    }

    /**
     * Parse APK from raw bytes.
     */
    parse(data: Uint8Array): APKContents {
        // Find and parse End of Central Directory
        const eocdOffset = this.findEOCD(data);
        const { cdOffset, cdEntryCount } = this.parseEOCD(data, eocdOffset);

        // Parse Central Directory entries
        const entries = this.parseCentralDirectory(data, cdOffset, cdEntryCount);
        this.logger.info('APKParser', 'APK loaded: ' + entries.length + ' files found');

        // Extract required files
        const manifest = this.extractFile(data, entries, 'AndroidManifest.xml');
        if (!manifest) {
            throw new NotFoundError('Required file not found: AndroidManifest.xml');
        }

        // Extract DEX files
        const dexFiles = new Map<string, Uint8Array>();
        for (const entry of entries) {
            if (entry.fileName === 'classes.dex' || /^classes\d+\.dex$/.test(entry.fileName)) {
                const dexData = this.extractEntry(data, entry);
                dexFiles.set(entry.fileName, dexData);
            }
        }

        if (dexFiles.size === 0) {
            throw new NotFoundError('Required file not found: classes.dex');
        }

        // Extract resources.arsc if present
        const resources = this.extractFile(data, entries, 'resources.arsc');

        return { manifest, dexFiles, resources };
    }

    /**
     * Parse APK from file path.
     */
    async parseFile(path: string): Promise<APKContents> {
        const data = await fs.promises.readFile(path);
        return this.parse(new Uint8Array(data));
    }

    /**
     * Parse APK from file path (synchronous).
     */
    parseFileSync(path: string): APKContents {
        const data = fs.readFileSync(path);
        return this.parse(new Uint8Array(data));
    }

    /**
     * Find the End of Central Directory record.
     * Searches backwards from the end of the file.
     */
    private findEOCD(data: Uint8Array): number {
        // EOCD is at least 22 bytes, search backwards for signature
        const minEOCDSize = 22;
        const maxCommentLength = 65535;
        const searchStart = Math.max(0, data.length - minEOCDSize - maxCommentLength);

        for (let i = data.length - minEOCDSize; i >= searchStart; i--) {
            if (readUint32LE(data, i) === EOCD_SIGNATURE) {
                return i;
            }
        }

        throw new ParseError('End of Central Directory not found - not a valid ZIP file');
    }

    /**
     * Parse the End of Central Directory record.
     */
    private parseEOCD(data: Uint8Array, offset: number): { cdOffset: number; cdEntryCount: number } {
        const signature = readUint32LE(data, offset);
        if (signature !== EOCD_SIGNATURE) {
            throw new ParseError('Invalid EOCD signature: expected 0x' + EOCD_SIGNATURE.toString(16) + ', got 0x' + signature.toString(16), offset);
        }

        const cdEntryCount = readUint16LE(data, offset + 10);
        const cdOffset = readUint32LE(data, offset + 16);

        return { cdOffset, cdEntryCount };
    }

    /**
     * Parse all Central Directory entries.
     */
    private parseCentralDirectory(data: Uint8Array, offset: number, count: number): CDEntry[] {
        const entries: CDEntry[] = [];
        let pos = offset;

        for (let i = 0; i < count; i++) {
            const signature = readUint32LE(data, pos);
            if (signature !== CD_SIGNATURE) {
                throw new ParseError('Invalid CD signature at entry ' + i + ': expected 0x' + CD_SIGNATURE.toString(16) + ', got 0x' + signature.toString(16), pos);
            }

            const compressionMethod = readUint16LE(data, pos + 10);
            const compressedSize = readUint32LE(data, pos + 20);
            const uncompressedSize = readUint32LE(data, pos + 24);
            const fileNameLength = readUint16LE(data, pos + 28);
            const extraFieldLength = readUint16LE(data, pos + 30);
            const commentLength = readUint16LE(data, pos + 32);
            const localHeaderOffset = readUint32LE(data, pos + 42);

            const fileNameBytes = data.slice(pos + 46, pos + 46 + fileNameLength);
            const fileName = new TextDecoder('utf-8').decode(fileNameBytes);

            entries.push({
                fileName,
                compressedSize,
                uncompressedSize,
                compressionMethod,
                localHeaderOffset,
            });

            // Move to next entry
            pos += 46 + fileNameLength + extraFieldLength + commentLength;
        }

        return entries;
    }

    /**
     * Extract a file by name from the APK.
     */
    private extractFile(data: Uint8Array, entries: CDEntry[], fileName: string): Uint8Array | null {
        const entry = entries.find(e => e.fileName === fileName);
        if (!entry) {
            return null;
        }
        return this.extractEntry(data, entry);
    }

    /**
     * Extract file data for a Central Directory entry.
     */
    private extractEntry(data: Uint8Array, entry: CDEntry): Uint8Array {
        const offset = entry.localHeaderOffset;

        // Verify Local File Header signature
        const signature = readUint32LE(data, offset);
        if (signature !== LFH_SIGNATURE) {
            throw new ParseError('Invalid Local File Header signature for ' + entry.fileName + ': expected 0x' + LFH_SIGNATURE.toString(16) + ', got 0x' + signature.toString(16), offset);
        }

        // Get Local File Header variable lengths
        const fileNameLength = readUint16LE(data, offset + 26);
        const extraFieldLength = readUint16LE(data, offset + 28);

        // Calculate data offset
        const dataOffset = offset + 30 + fileNameLength + extraFieldLength;

        // Check compression method
        if (entry.compressionMethod === COMPRESSION_DEFLATE) {
            throw new ParseError('DEFLATE compression not supported for ' + entry.fileName + '. Build APK with STORE compression.');
        }

        if (entry.compressionMethod !== COMPRESSION_STORE) {
            throw new ParseError('Unsupported compression method ' + entry.compressionMethod + ' for ' + entry.fileName);
        }

        // For STORE compression, just slice the data
        return data.slice(dataOffset, dataOffset + entry.uncompressedSize);
    }
}

// Static convenience methods
export const parseAPK = (data: Uint8Array, logger?: Logger): APKContents => {
    return new APKParser(logger).parse(data);
};

export const parseAPKFile = async (path: string, logger?: Logger): Promise<APKContents> => {
    return new APKParser(logger).parseFile(path);
};

export const parseAPKFileSync = (path: string, logger?: Logger): APKContents => {
    return new APKParser(logger).parseFileSync(path);
};
