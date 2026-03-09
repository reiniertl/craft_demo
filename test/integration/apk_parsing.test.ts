/**
 * Integration tests for APK parsing.
 * Tests the full pipeline: APK -> DEX -> Manifest
 */

import * as fs from 'fs';
import * as path from 'path';
import { APKParser } from '../../src/parser/apk_parser';
import { DexParser } from '../../src/parser/dex_parser';
import { ManifestParser } from '../../src/parser/manifest_parser';

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

// Suppress logger output during tests
const silentLogger = {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
};

describe('End-to-end APK parsing', () => {
    const apkPath = path.join(FIXTURES_DIR, 'hello_world.apk');
    
    beforeAll(() => {
        // Verify fixtures exist
        if (!fs.existsSync(apkPath)) {
            throw new Error('Test fixture not found: ' + apkPath + '. Run: npx ts-node tools/generate_test_fixtures.ts');
        }
    });

    test('parses Hello World APK', () => {
        const apkData = fs.readFileSync(apkPath);
        const parser = new APKParser(silentLogger);
        const contents = parser.parse(new Uint8Array(apkData));

        expect(contents.manifest).toBeDefined();
        expect(contents.manifest.length).toBeGreaterThan(0);
        expect(contents.dexFiles.has('classes.dex')).toBe(true);
    });

    test('extracts correct manifest info', () => {
        const apkData = fs.readFileSync(apkPath);
        const parser = new APKParser(silentLogger);
        const contents = parser.parse(new Uint8Array(apkData));

        const manifest = ManifestParser.parse(contents.manifest, silentLogger);

        expect(manifest.packageName).toBe('com.example.helloworld');
        expect(manifest.mainActivityClass).toBe('com.example.helloworld.MainActivity');
    });

    test('parses DEX with correct class count', () => {
        const apkData = fs.readFileSync(apkPath);
        const parser = new APKParser(silentLogger);
        const contents = parser.parse(new Uint8Array(apkData));

        const dexData = contents.dexFiles.get('classes.dex')!;
        const dexParser = new DexParser(dexData, silentLogger);
        const header = dexParser.parseHeader();

        expect(header.classDefsSize).toBe(1);
        expect(header.methodIdsSize).toBe(23);
    });

    test('finds MainActivity class in DEX', () => {
        const apkData = fs.readFileSync(apkPath);
        const parser = new APKParser(silentLogger);
        const contents = parser.parse(new Uint8Array(apkData));

        const dexData = contents.dexFiles.get('classes.dex')!;
        const dexParser = new DexParser(dexData, silentLogger);

        const classDef = dexParser.getClassDef('Lcom/example/helloworld/MainActivity;');
        expect(classDef).not.toBeNull();

        const classData = dexParser.getClassData(classDef!);
        expect(classData.directMethods.length).toBe(3);  // <init>, computePending, updateDisplay
        expect(classData.virtualMethods.length).toBe(2); // onClick, onCreate
    });

    test('retrieves method bytecode', () => {
        const apkData = fs.readFileSync(apkPath);
        const parser = new APKParser(silentLogger);
        const contents = parser.parse(new Uint8Array(apkData));

        const dexData = contents.dexFiles.get('classes.dex')!;
        const dexParser = new DexParser(dexData, silentLogger);

        const classDef = dexParser.getClassDef('Lcom/example/helloworld/MainActivity;');
        const classData = dexParser.getClassData(classDef!);

        // Check <init> method (first direct method)
        const initMethod = classData.directMethods[0];
        expect(initMethod.codeOff).toBeGreaterThan(0);

        const initCode = dexParser.getMethodCode(initMethod.codeOff);
        expect(initCode).not.toBeNull();
        expect(initCode!.insnsSize).toBe(4);

        // Check onCreate method (second virtual method, after onClick)
        const onCreateMethod = classData.virtualMethods[1];
        expect(onCreateMethod.codeOff).toBeGreaterThan(0);

        const onCreateCode = dexParser.getMethodCode(onCreateMethod.codeOff);
        expect(onCreateCode).not.toBeNull();
        expect(onCreateCode!.insnsSize).toBe(234);
    });
});

describe('Direct DEX file parsing', () => {
    const dexPath = path.join(FIXTURES_DIR, 'hello_world.dex');

    test('parses standalone DEX file', () => {
        const dexData = fs.readFileSync(dexPath);
        const parser = new DexParser(new Uint8Array(dexData), silentLogger);
        const header = parser.parseHeader();

        expect(header.magic[0]).toBe(0x64); // 'd'
        expect(header.magic[1]).toBe(0x65); // 'e'
        expect(header.magic[2]).toBe(0x78); // 'x'
        expect(header.headerSize).toBe(112);
    });

    test('retrieves all strings', () => {
        const dexData = fs.readFileSync(dexPath);
        const parser = new DexParser(new Uint8Array(dexData), silentLogger);
        const header = parser.parseHeader();

        const strings: string[] = [];
        for (let i = 0; i < header.stringIdsSize; i++) {
            strings.push(parser.getString(i));
        }

        expect(strings).toContain('<init>');
        expect(strings).toContain('onCreate');
        expect(strings).toContain('Lcom/example/hello/MainActivity;');
    });
});

describe('Direct manifest parsing', () => {
    const manifestPath = path.join(FIXTURES_DIR, 'manifest_binary.xml');

    test('parses standalone manifest', () => {
        const manifestData = fs.readFileSync(manifestPath);
        const manifest = ManifestParser.parse(new Uint8Array(manifestData), silentLogger);

        expect(manifest.packageName).toBe('com.example.hello');
        expect(manifest.mainActivityClass).toBe('com.example.hello.MainActivity');
    });
});
