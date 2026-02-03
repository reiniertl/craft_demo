import fs from '@ohos.file.fs';
import hilog from '@ohos.hilog';

const DOMAIN = 0x0000;
const TAG = 'CRAFT';

/**
 * Result of parsing an APK file.
 */
export interface ParseResult {
    packageName: string;
    mainActivityClass: string;
    classCount: number;
    methodCount: number;
    mainActivityCodeSize?: number;
}

/**
 * CRAFT Parser - OpenHarmony adapter for APK/DEX parsing.
 *
 * This wraps the portable core parsers with OH-specific file I/O.
 */
export class CraftParser {

    /**
     * Parse an APK file and return essential information.
     */
    async parseApkFile(apkPath: string): Promise<ParseResult> {
        hilog.info(DOMAIN, TAG, '[CraftParser][INFO] Loading APK: %{public}s', apkPath);

        // Read APK file
        const data = await this.readFile(apkPath);
        hilog.info(DOMAIN, TAG, '[CraftParser][INFO] APK size: %{public}d bytes', data.byteLength);

        // Parse APK (ZIP extraction)
        const apkContents = this.parseApk(data);
        hilog.info(DOMAIN, TAG, '[APKParser][INFO] APK loaded: %{public}d files found', apkContents.fileCount);

        // Parse manifest
        const manifestInfo = this.parseManifest(apkContents.manifest);
        hilog.info(DOMAIN, TAG, '[ManifestParser][INFO] Package: %{public}s, Main Activity: %{public}s',
            manifestInfo.packageName, manifestInfo.mainActivityClass);

        // Parse DEX
        const dexInfo = this.parseDex(apkContents.classesDex);
        hilog.info(DOMAIN, TAG, '[DexParser][INFO] DEX parsed: %{public}d classes, %{public}d methods',
            dexInfo.classCount, dexInfo.methodCount);

        // Find main activity bytecode size
        let mainActivityCodeSize: number | undefined;
        const mainClassName = 'L' + manifestInfo.mainActivityClass.replace(/\./g, '/') + ';';
        const mainClass = this.findClass(apkContents.classesDex, dexInfo, mainClassName);
        if (mainClass) {
            mainActivityCodeSize = mainClass.totalCodeSize;
        }

        return {
            packageName: manifestInfo.packageName,
            mainActivityClass: manifestInfo.mainActivityClass,
            classCount: dexInfo.classCount,
            methodCount: dexInfo.methodCount,
            mainActivityCodeSize,
        };
    }

    /**
     * Read a file into a Uint8Array.
     */
    private async readFile(path: string): Promise<Uint8Array> {
        const file = await fs.open(path, fs.OpenMode.READ_ONLY);
        const stat = await fs.stat(path);
        const buffer = new ArrayBuffer(stat.size);
        await fs.read(file.fd, buffer);
        await fs.close(file);
        return new Uint8Array(buffer);
    }

    // ========================================================================
    // Inline implementations of core parsers (ArkTS-compatible)
    // ========================================================================

    /**
     * Parse APK (ZIP with STORE compression).
     */
    private parseApk(data: Uint8Array): { manifest: Uint8Array; classesDex: Uint8Array; fileCount: number } {
        // Find EOCD
        const eocdOffset = this.findEocd(data);
        const cdEntryCount = this.readUint16LE(data, eocdOffset + 10);
        const cdOffset = this.readUint32LE(data, eocdOffset + 16);

        // Parse central directory
        const entries = this.parseCentralDirectory(data, cdOffset, cdEntryCount);

        // Extract required files
        let manifest: Uint8Array | null = null;
        let classesDex: Uint8Array | null = null;

        for (const entry of entries) {
            if (entry.name === 'AndroidManifest.xml') {
                manifest = this.extractFile(data, entry);
            } else if (entry.name === 'classes.dex') {
                classesDex = this.extractFile(data, entry);
            }
        }

        if (!manifest) {
            throw new Error('AndroidManifest.xml not found in APK');
        }
        if (!classesDex) {
            throw new Error('classes.dex not found in APK');
        }

        return { manifest, classesDex, fileCount: entries.length };
    }

    private findEocd(data: Uint8Array): number {
        for (let i = data.length - 22; i >= 0; i--) {
            if (this.readUint32LE(data, i) === 0x06054b50) {
                return i;
            }
        }
        throw new Error('EOCD not found - not a valid ZIP');
    }

    private parseCentralDirectory(data: Uint8Array, offset: number, count: number): Array<{ name: string; localOffset: number; size: number }> {
        const entries: Array<{ name: string; localOffset: number; size: number }> = [];
        let pos = offset;

        for (let i = 0; i < count; i++) {
            const sig = this.readUint32LE(data, pos);
            if (sig !== 0x02014b50) {
                throw new Error('Invalid CD signature');
            }

            const compMethod = this.readUint16LE(data, pos + 10);
            const uncompSize = this.readUint32LE(data, pos + 24);
            const nameLen = this.readUint16LE(data, pos + 28);
            const extraLen = this.readUint16LE(data, pos + 30);
            const commentLen = this.readUint16LE(data, pos + 32);
            const localOffset = this.readUint32LE(data, pos + 42);

            const nameBytes = data.slice(pos + 46, pos + 46 + nameLen);
            const name = this.decodeUtf8(nameBytes);

            if (compMethod !== 0) {
                // Skip non-STORE files
                pos += 46 + nameLen + extraLen + commentLen;
                continue;
            }

            entries.push({ name, localOffset, size: uncompSize });
            pos += 46 + nameLen + extraLen + commentLen;
        }

        return entries;
    }

    private extractFile(data: Uint8Array, entry: { name: string; localOffset: number; size: number }): Uint8Array {
        const offset = entry.localOffset;
        const sig = this.readUint32LE(data, offset);
        if (sig !== 0x04034b50) {
            throw new Error('Invalid local file header');
        }

        const nameLen = this.readUint16LE(data, offset + 26);
        const extraLen = this.readUint16LE(data, offset + 28);
        const dataOffset = offset + 30 + nameLen + extraLen;

        return data.slice(dataOffset, dataOffset + entry.size);
    }

    /**
     * Parse binary AndroidManifest.xml.
     */
    private parseManifest(data: Uint8Array): { packageName: string; mainActivityClass: string } {
        // Parse string pool
        const stringPool = this.parseStringPool(data);

        // Find package and main activity
        let packageName = '';
        let mainActivityClass = '';
        let currentActivity = '';
        let hasMainAction = false;
        let hasLauncherCategory = false;
        let inIntentFilter = false;

        let offset = 8; // Skip XML header
        offset += this.readUint32LE(data, offset + 4); // Skip string pool

        while (offset < data.length) {
            const chunkType = this.readUint16LE(data, offset);
            const chunkSize = this.readUint32LE(data, offset + 4);

            if (chunkSize === 0) break;

            if (chunkType === 0x0102) { // START_ELEMENT
                const nameIdx = this.readInt32LE(data, offset + 20);
                const attrCount = this.readUint16LE(data, offset + 28);
                const elemName = this.getPoolString(stringPool, nameIdx);

                const attrs = this.parseAttributes(data, offset + 36, attrCount, stringPool);

                if (elemName === 'manifest') {
                    packageName = attrs['package'] || '';
                } else if (elemName === 'activity' || elemName === 'activity-alias') {
                    currentActivity = attrs['name'] || '';
                    if (currentActivity.startsWith('.') && packageName) {
                        currentActivity = packageName + currentActivity;
                    }
                    hasMainAction = false;
                    hasLauncherCategory = false;
                } else if (elemName === 'intent-filter') {
                    inIntentFilter = true;
                } else if (elemName === 'action' && inIntentFilter) {
                    if (attrs['name'] === 'android.intent.action.MAIN') {
                        hasMainAction = true;
                    }
                } else if (elemName === 'category' && inIntentFilter) {
                    if (attrs['name'] === 'android.intent.category.LAUNCHER') {
                        hasLauncherCategory = true;
                    }
                }
            } else if (chunkType === 0x0103) { // END_ELEMENT
                const nameIdx = this.readInt32LE(data, offset + 20);
                const elemName = this.getPoolString(stringPool, nameIdx);

                if (elemName === 'intent-filter') {
                    if (hasMainAction && hasLauncherCategory && currentActivity && !mainActivityClass) {
                        mainActivityClass = currentActivity;
                    }
                    inIntentFilter = false;
                } else if (elemName === 'activity' || elemName === 'activity-alias') {
                    currentActivity = '';
                }
            }

            offset += chunkSize;
        }

        if (!packageName) {
            throw new Error('Package name not found');
        }
        if (!mainActivityClass) {
            throw new Error('Main activity not found');
        }

        return { packageName, mainActivityClass };
    }

    private parseStringPool(data: Uint8Array): string[] {
        let offset = 8; // After XML header
        const poolType = this.readUint16LE(data, offset);
        if (poolType !== 0x0001) {
            throw new Error('String pool not found');
        }

        const stringCount = this.readUint32LE(data, offset + 8);
        const flags = this.readUint32LE(data, offset + 16);
        const stringsStart = this.readUint32LE(data, offset + 20);
        const isUtf8 = (flags & 0x100) !== 0;

        const offsets: number[] = [];
        for (let i = 0; i < stringCount; i++) {
            offsets.push(this.readUint32LE(data, offset + 28 + i * 4));
        }

        const stringsBase = offset + stringsStart;
        const strings: string[] = [];

        for (let i = 0; i < stringCount; i++) {
            const strStart = stringsBase + offsets[i];
            if (isUtf8) {
                strings.push(this.readUtf8PoolString(data, strStart));
            } else {
                strings.push(this.readUtf16PoolString(data, strStart));
            }
        }

        return strings;
    }

    private readUtf8PoolString(data: Uint8Array, offset: number): string {
        let pos = offset;
        let charLen = data[pos++];
        if (charLen & 0x80) {
            charLen = ((charLen & 0x7F) << 8) | data[pos++];
        }
        let byteLen = data[pos++];
        if (byteLen & 0x80) {
            byteLen = ((byteLen & 0x7F) << 8) | data[pos++];
        }
        return this.decodeUtf8(data.slice(pos, pos + byteLen));
    }

    private readUtf16PoolString(data: Uint8Array, offset: number): string {
        let pos = offset;
        let len = this.readUint16LE(data, pos);
        pos += 2;
        if (len & 0x8000) {
            len = ((len & 0x7FFF) << 16) | this.readUint16LE(data, pos);
            pos += 2;
        }
        const chars: number[] = [];
        for (let i = 0; i < len; i++) {
            chars.push(this.readUint16LE(data, pos + i * 2));
        }
        return String.fromCharCode(...chars);
    }

    private getPoolString(pool: string[], idx: number): string {
        if (idx < 0 || idx >= pool.length) return '';
        return pool[idx];
    }

    private parseAttributes(data: Uint8Array, offset: number, count: number, pool: string[]): Record<string, string> {
        const attrs: Record<string, string> = {};
        for (let i = 0; i < count; i++) {
            const attrOffset = offset + i * 20;
            const nameIdx = this.readInt32LE(data, attrOffset + 4);
            const rawIdx = this.readInt32LE(data, attrOffset + 8);
            const valueType = data[attrOffset + 15];
            const valueData = this.readUint32LE(data, attrOffset + 16);

            let name = this.getPoolString(pool, nameIdx);
            // Strip namespace prefix
            const colonIdx = name.indexOf(':');
            if (colonIdx >= 0) {
                name = name.substring(colonIdx + 1);
            }

            let value: string;
            if (rawIdx >= 0) {
                value = this.getPoolString(pool, rawIdx);
            } else if (valueType === 0x03) {
                value = this.getPoolString(pool, valueData);
            } else {
                value = valueData.toString();
            }

            attrs[name] = value;
        }
        return attrs;
    }

    /**
     * Parse DEX file.
     */
    private parseDex(data: Uint8Array): { classCount: number; methodCount: number; header: DexHeader } {
        // Validate magic
        if (data[0] !== 0x64 || data[1] !== 0x65 || data[2] !== 0x78 || data[3] !== 0x0A) {
            throw new Error('Invalid DEX magic');
        }

        const header: DexHeader = {
            stringIdsSize: this.readUint32LE(data, 56),
            stringIdsOff: this.readUint32LE(data, 60),
            typeIdsSize: this.readUint32LE(data, 64),
            typeIdsOff: this.readUint32LE(data, 68),
            methodIdsSize: this.readUint32LE(data, 88),
            methodIdsOff: this.readUint32LE(data, 92),
            classDefsSize: this.readUint32LE(data, 96),
            classDefsOff: this.readUint32LE(data, 100),
        };

        return {
            classCount: header.classDefsSize,
            methodCount: header.methodIdsSize,
            header,
        };
    }

    private findClass(data: Uint8Array, dexInfo: { header: DexHeader }, className: string): { totalCodeSize: number } | null {
        const header = dexInfo.header;

        for (let i = 0; i < header.classDefsSize; i++) {
            const offset = header.classDefsOff + i * 32;
            const classIdx = this.readUint32LE(data, offset);
            const classDataOff = this.readUint32LE(data, offset + 24);

            const typeName = this.getDexTypeName(data, header, classIdx);
            if (typeName === className) {
                if (classDataOff === 0) {
                    return { totalCodeSize: 0 };
                }
                return { totalCodeSize: this.getClassCodeSize(data, classDataOff) };
            }
        }

        return null;
    }

    private getDexTypeName(data: Uint8Array, header: DexHeader, typeIdx: number): string {
        const typeIdOff = header.typeIdsOff + typeIdx * 4;
        const stringIdx = this.readUint32LE(data, typeIdOff);
        return this.getDexString(data, header, stringIdx);
    }

    private getDexString(data: Uint8Array, header: DexHeader, stringIdx: number): string {
        const stringIdOff = header.stringIdsOff + stringIdx * 4;
        const stringDataOff = this.readUint32LE(data, stringIdOff);

        // Skip ULEB128 length
        let pos = stringDataOff;
        while (data[pos] & 0x80) pos++;
        pos++;

        // Read until null
        let end = pos;
        while (data[end] !== 0) end++;

        return this.decodeMutf8(data, pos, end - pos);
    }

    private getClassCodeSize(data: Uint8Array, classDataOff: number): number {
        let pos = classDataOff;

        // Read ULEB128 sizes
        const staticFieldsSize = this.decodeUleb128(data, pos);
        pos = staticFieldsSize[1];
        const instanceFieldsSize = this.decodeUleb128(data, pos);
        pos = instanceFieldsSize[1];
        const directMethodsSize = this.decodeUleb128(data, pos);
        pos = directMethodsSize[1];
        const virtualMethodsSize = this.decodeUleb128(data, pos);
        pos = virtualMethodsSize[1];

        // Skip fields
        for (let i = 0; i < staticFieldsSize[0] + instanceFieldsSize[0]; i++) {
            const fieldIdxDiff = this.decodeUleb128(data, pos);
            pos = fieldIdxDiff[1];
            const accessFlags = this.decodeUleb128(data, pos);
            pos = accessFlags[1];
        }

        // Sum method code sizes
        let totalCodeSize = 0;
        const totalMethods = directMethodsSize[0] + virtualMethodsSize[0];
        for (let i = 0; i < totalMethods; i++) {
            const methodIdxDiff = this.decodeUleb128(data, pos);
            pos = methodIdxDiff[1];
            const accessFlags = this.decodeUleb128(data, pos);
            pos = accessFlags[1];
            const codeOff = this.decodeUleb128(data, pos);
            pos = codeOff[1];

            if (codeOff[0] !== 0) {
                const insnsSize = this.readUint32LE(data, codeOff[0] + 12);
                totalCodeSize += insnsSize;
            }
        }

        return totalCodeSize;
    }

    // ========================================================================
    // Utility functions
    // ========================================================================

    private readUint16LE(data: Uint8Array, offset: number): number {
        return data[offset] | (data[offset + 1] << 8);
    }

    private readUint32LE(data: Uint8Array, offset: number): number {
        return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
    }

    private readInt32LE(data: Uint8Array, offset: number): number {
        return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
    }

    private decodeUleb128(data: Uint8Array, offset: number): [number, number] {
        let result = 0;
        let shift = 0;
        let pos = offset;
        let byte: number;
        do {
            byte = data[pos++];
            result |= (byte & 0x7F) << shift;
            shift += 7;
        } while (byte & 0x80);
        return [result >>> 0, pos];
    }

    private decodeUtf8(data: Uint8Array): string {
        let result = '';
        for (let i = 0; i < data.length; i++) {
            result += String.fromCharCode(data[i]);
        }
        // Simple ASCII decode - for full UTF-8 use TextDecoder if available
        return decodeURIComponent(escape(result));
    }

    private decodeMutf8(data: Uint8Array, offset: number, length: number): string {
        const chars: number[] = [];
        let pos = offset;
        const end = offset + length;

        while (pos < end) {
            const byte1 = data[pos++];
            if (byte1 === 0) break;
            if ((byte1 & 0x80) === 0) {
                chars.push(byte1);
            } else if ((byte1 & 0xE0) === 0xC0) {
                const byte2 = data[pos++];
                chars.push(((byte1 & 0x1F) << 6) | (byte2 & 0x3F));
            } else if ((byte1 & 0xF0) === 0xE0) {
                const byte2 = data[pos++];
                const byte3 = data[pos++];
                chars.push(((byte1 & 0x0F) << 12) | ((byte2 & 0x3F) << 6) | (byte3 & 0x3F));
            }
        }

        return String.fromCharCode(...chars);
    }
}

/**
 * Minimal DEX header info needed for parsing.
 */
interface DexHeader {
    stringIdsSize: number;
    stringIdsOff: number;
    typeIdsSize: number;
    typeIdsOff: number;
    methodIdsSize: number;
    methodIdsOff: number;
    classDefsSize: number;
    classDefsOff: number;
}
