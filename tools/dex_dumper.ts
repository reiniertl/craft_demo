#!/usr/bin/env ts-node
/**
 * DEX Dumper - CLI tool for debugging DEX file contents.
 *
 * Usage:
 *   npx ts-node tools/dex_dumper.ts <dex-file> [options]
 *
 * Options:
 *   --header      Print header info only
 *   --strings     Print string table
 *   --types       Print type table
 *   --classes     Print class definitions
 *   --methods     Print method definitions with bytecode
 *   --all         Print everything (default)
 */

import * as fs from 'fs';
import * as path from 'path';
import { DexParser } from '../src/parser/dex_parser';
import { accessFlagsToString, NO_INDEX } from '../src/parser/dex_types';

interface Options {
    header: boolean;
    strings: boolean;
    types: boolean;
    classes: boolean;
    methods: boolean;
}

function parseArgs(args: string[]): { filePath: string; options: Options } {
    const options: Options = {
        header: false,
        strings: false,
        types: false,
        classes: false,
        methods: false,
    };

    let filePath = '';

    for (const arg of args) {
        if (arg.startsWith('--')) {
            const flag = arg.slice(2);
            if (flag === 'all') {
                options.header = true;
                options.strings = true;
                options.types = true;
                options.classes = true;
                options.methods = true;
            } else if (flag in options) {
                (options as unknown as Record<string, boolean>)[flag] = true;
            } else {
                console.error('Unknown option: ' + arg);
                process.exit(1);
            }
        } else {
            filePath = arg;
        }
    }

    // Default to all if no options specified
    if (!options.header && !options.strings && !options.types && !options.classes && !options.methods) {
        options.header = true;
        options.strings = true;
        options.types = true;
        options.classes = true;
        options.methods = true;
    }

    return { filePath, options };
}

function printUsage(): void {
    console.log('DEX Dumper - CLI tool for debugging DEX file contents');
    console.log('');
    console.log('Usage:');
    console.log('  npx ts-node tools/dex_dumper.ts <dex-file> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --header      Print header info only');
    console.log('  --strings     Print string table');
    console.log('  --types       Print type table');
    console.log('  --classes     Print class definitions');
    console.log('  --methods     Print method definitions with bytecode');
    console.log('  --all         Print everything (default)');
}

function formatHex(value: number, width: number = 8): string {
    return '0x' + value.toString(16).padStart(width, '0');
}

function printHeader(parser: DexParser): void {
    const header = parser.parseHeader();

    console.log('DEX Header:');
    console.log('  Magic: dex\\n' + String.fromCharCode(header.magic[4], header.magic[5], header.magic[6]));
    console.log('  Checksum: ' + formatHex(header.checksum));
    console.log('  File Size: ' + header.fileSize + ' bytes');
    console.log('  Header Size: ' + header.headerSize + ' bytes');
    console.log('  Endian Tag: ' + formatHex(header.endianTag));
    console.log('  String IDs: ' + header.stringIdsSize);
    console.log('  Type IDs: ' + header.typeIdsSize);
    console.log('  Proto IDs: ' + header.protoIdsSize);
    console.log('  Field IDs: ' + header.fieldIdsSize);
    console.log('  Method IDs: ' + header.methodIdsSize);
    console.log('  Class Defs: ' + header.classDefsSize);
    console.log('');
}

function printStrings(parser: DexParser): void {
    const header = parser.parseHeader();

    console.log('String Table:');
    for (let i = 0; i < header.stringIdsSize; i++) {
        const str = parser.getString(i);
        // Escape special characters for display
        const escaped = str
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
        console.log('  [' + i + '] ' + escaped);
    }
    console.log('');
}

function printTypes(parser: DexParser): void {
    const header = parser.parseHeader();

    console.log('Type Table:');
    for (let i = 0; i < header.typeIdsSize; i++) {
        const typeName = parser.getTypeName(i);
        console.log('  [' + i + '] ' + typeName);
    }
    console.log('');
}

function printClasses(parser: DexParser, includeMethodCode: boolean): void {
    const classDefs = parser.getClassDefs();

    for (const classDef of classDefs) {
        const className = parser.getTypeName(classDef.classIdx);
        const superclass = classDef.superclassIdx !== NO_INDEX
            ? parser.getTypeName(classDef.superclassIdx)
            : '<none>';
        const accessStr = accessFlagsToString(classDef.accessFlags);

        console.log('Class: ' + className);
        console.log('  Access: ' + (accessStr || '<none>'));
        console.log('  Superclass: ' + superclass);

        if (classDef.sourceFileIdx !== NO_INDEX) {
            console.log('  Source File: ' + parser.getString(classDef.sourceFileIdx));
        }

        const classData = parser.getClassData(classDef);

        // Print fields
        if (classData.staticFields.length > 0) {
            console.log('');
            console.log('  Static Fields:');
            for (const field of classData.staticFields) {
                const fieldId = parser.getFieldId(field.fieldIdx);
                const fieldName = parser.getString(fieldId.nameIdx);
                const fieldType = parser.getTypeName(fieldId.typeIdx);
                const fieldAccess = accessFlagsToString(field.accessFlags);
                console.log('    [' + field.fieldIdx + '] ' + fieldName + ': ' + fieldType + ' (' + fieldAccess + ')');
            }
        }

        if (classData.instanceFields.length > 0) {
            console.log('');
            console.log('  Instance Fields:');
            for (const field of classData.instanceFields) {
                const fieldId = parser.getFieldId(field.fieldIdx);
                const fieldName = parser.getString(fieldId.nameIdx);
                const fieldType = parser.getTypeName(fieldId.typeIdx);
                const fieldAccess = accessFlagsToString(field.accessFlags);
                console.log('    [' + field.fieldIdx + '] ' + fieldName + ': ' + fieldType + ' (' + fieldAccess + ')');
            }
        }

        // Print methods
        if (classData.directMethods.length > 0) {
            console.log('');
            console.log('  Direct Methods:');
            for (const method of classData.directMethods) {
                printMethod(parser, method, includeMethodCode);
            }
        }

        if (classData.virtualMethods.length > 0) {
            console.log('');
            console.log('  Virtual Methods:');
            for (const method of classData.virtualMethods) {
                printMethod(parser, method, includeMethodCode);
            }
        }

        console.log('');
    }
}

function printMethod(parser: DexParser, method: { methodIdx: number; accessFlags: number; codeOff: number }, includeCode: boolean): void {
    const methodId = parser.getMethodId(method.methodIdx);
    const methodName = parser.getString(methodId.nameIdx);
    const proto = parser.getProtoId(methodId.protoIdx);
    const returnType = parser.getTypeName(proto.returnTypeIdx);
    const params = parser.getProtoParameters(proto);
    const paramStr = params.map(p => parser.getTypeName(p)).join(', ');
    const accessStr = accessFlagsToString(method.accessFlags, true);

    console.log('    [' + method.methodIdx + '] ' + methodName + '(' + paramStr + ')' + returnType);
    console.log('        Access: ' + (accessStr || '<none>'));

    if (method.codeOff !== 0 && includeCode) {
        const code = parser.getMethodCode(method.codeOff);
        if (code) {
            console.log('        Registers: ' + code.registersSize + ', Ins: ' + code.insSize + ', Outs: ' + code.outsSize);
            console.log('        Code: ' + code.insnsSize + ' code units');

            // Print bytecode as hex
            let hexLine = '        ';
            for (let i = 0; i < code.insns.length; i++) {
                hexLine += formatHex(code.insns[i], 4).slice(2) + ' ';
                if ((i + 1) % 8 === 0) {
                    console.log(hexLine);
                    hexLine = '        ';
                }
            }
            if (hexLine.trim()) {
                console.log(hexLine);
            }

            if (code.tries.length > 0) {
                console.log('        Try blocks: ' + code.tries.length);
            }
        }
    } else if (method.codeOff === 0) {
        console.log('        Code: <abstract/native>');
    }
}

function main(): void {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        printUsage();
        process.exit(0);
    }

    const { filePath, options } = parseArgs(args);

    if (!filePath) {
        console.error('Error: No DEX file specified');
        printUsage();
        process.exit(1);
    }

    if (!fs.existsSync(filePath)) {
        console.error('Error: File not found: ' + filePath);
        process.exit(1);
    }

    const data = fs.readFileSync(filePath);
    const parser = new DexParser(new Uint8Array(data));

    if (options.header) {
        printHeader(parser);
    }

    if (options.strings) {
        printStrings(parser);
    }

    if (options.types) {
        printTypes(parser);
    }

    if (options.classes || options.methods) {
        printClasses(parser, options.methods);
    }
}

main();
