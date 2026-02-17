#!/usr/bin/env ts-node
/**
 * CRAFT Heap Dump - Skill #9
 * Inspect runtime heap state after method execution.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DexParser } from '../src/parser/dex_parser';
import { Heap, HeapDump } from '../src/interpreter/heap';
import { Interpreter } from '../src/interpreter/interpreter';
import { initializeShimRegistry } from '../src/interpreter/shim_init';
import { Value } from '../src/core/types';

function printUsage(): void {
  console.log(`
[CRAFT][HeapDump] Runtime Heap Inspector

Usage: npm run heap-dump <dex-file> [options]

Options:
  --class <descriptor>    Class to invoke
  --method <name>         Method to run first (default: main)
  --descriptor <desc>     Method descriptor (default: ()V)
  --json                  Output as JSON
  --help                  Show this help

Examples:
  npm run heap-dump test/fixtures/hello_world.dex
  npm run heap-dump test/fixtures/hello_world.dex -- --class "Lcom/example/Test;" --method test
  npm run heap-dump test/fixtures/hello_world.dex -- --json
`);
}

function formatValue(v: Value): string {
  switch (v.type) {
    case 'int': return `int(${v.value})`;
    case 'long': return `long(${v.value})`;
    case 'float': return `float(${v.value})`;
    case 'double': return `double(${v.value})`;
    case 'object': return `object@${v.ref}`;
    case 'null': return 'null';
    default: return JSON.stringify(v);
  }
}

function formatHeapDump(dump: HeapDump): void {
  console.log('=== Heap Dump ===');
  console.log(`Objects: ${dump.objectCount} allocated (nextRef: ${dump.nextRef})`);
  console.log(`String pool: ${dump.stringPool.length} entries`);
  console.log('');

  for (const obj of dump.objects) {
    const refStr = `[Ref ${obj.ref}]`;

    if (obj.stringValue !== undefined) {
      console.log(`${refStr} ${obj.classDescriptor} (string: "${obj.stringValue}")`);
    } else if (obj.arrayData) {
      console.log(`${refStr} ${obj.classDescriptor} (array, length: ${obj.arrayLength})`);
      const maxShow = Math.min(obj.arrayData.length, 20);
      const items: string[] = [];
      for (let i = 0; i < maxShow; i++) {
        items.push(`[${i}]: ${formatValue(obj.arrayData[i])}`);
      }
      console.log(`  ${items.join('  ')}`);
      if (obj.arrayData.length > maxShow) {
        console.log(`  ... and ${obj.arrayData.length - maxShow} more`);
      }
    } else {
      console.log(`${refStr} ${obj.classDescriptor}`);
    }

    const fieldNames = Object.keys(obj.fields);
    if (fieldNames.length > 0) {
      for (const name of fieldNames) {
        console.log(`  ${name}: ${formatValue(obj.fields[name])}`);
      }
    }
  }
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  let dexFile = '';
  let className = '';
  let methodName = 'main';
  let methodDesc = '()V';
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--class':
        className = args[++i] || '';
        break;
      case '--method':
        methodName = args[++i] || '';
        break;
      case '--descriptor':
        methodDesc = args[++i] || '';
        break;
      case '--json':
        jsonOutput = true;
        break;
      default:
        if (!args[i].startsWith('-') && !dexFile) {
          dexFile = args[i];
        }
        break;
    }
  }

  if (!dexFile) {
    console.error('[CRAFT][HeapDump][Error] No DEX file specified');
    process.exit(1);
  }

  const dexPath = path.resolve(dexFile);
  if (!fs.existsSync(dexPath)) {
    console.error(`[CRAFT][HeapDump][Error] File not found: ${dexPath}`);
    process.exit(1);
  }

  console.log(`[CRAFT][HeapDump][Info] Loading DEX: ${dexPath}`);
  const dexData = new Uint8Array(fs.readFileSync(dexPath));
  const dex = new DexParser(dexData);

  // Determine class
  if (!className) {
    const header = dex.parseHeader();
    if (header.classDefsSize > 0) {
      const classDef = dex.getClassDefByIndex(0);
      className = dex.getTypeName(classDef.classIdx);
    } else {
      console.error('[CRAFT][HeapDump][Error] No classes found in DEX');
      process.exit(1);
    }
  }

  const heap = new Heap();
  const shimRegistry = initializeShimRegistry();
  const interp = new Interpreter(dex, heap, shimRegistry);

  console.log(`[CRAFT][HeapDump][Info] Running ${className}.${methodName}${methodDesc}...\n`);

  try {
    interp.invoke(className, methodName, methodDesc, []);
  } catch (err: any) {
    console.error(`[CRAFT][HeapDump][Warn] Execution error: ${err.message}`);
    console.log('(Dumping heap state at point of error)\n');
  }

  const dump = heap.dump();

  if (jsonOutput) {
    console.log(JSON.stringify(dump, null, 2));
  } else {
    formatHeapDump(dump);
  }
}

main();
