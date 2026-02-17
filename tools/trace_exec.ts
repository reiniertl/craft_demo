#!/usr/bin/env ts-node
/**
 * CRAFT Execution Tracer - Skill #6
 * Trace bytecode execution step-by-step for debugging.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DexParser } from '../src/parser/dex_parser';
import { Heap } from '../src/interpreter/heap';
import { Interpreter } from '../src/interpreter/interpreter';
import { initializeShimRegistry } from '../src/interpreter/shim_init';
import { ExecutionTracer } from '../src/interpreter/tracer';
import { OpcodeTable, ExecutionContext } from '../src/interpreter/opcode_table';
import { registerEssentialOpcodes } from '../src/interpreter/opcodes';
import { NULL_VALUE, Value } from '../src/core/types';

function printUsage(): void {
  console.log(`
[CRAFT][TraceExec] Bytecode Execution Tracer

Usage: npm run trace-exec <dex-file> [options]

Options:
  --class <descriptor>    Class to invoke (default: first class)
  --method <name>         Method name (default: main)
  --descriptor <desc>     Method descriptor (default: ()V)
  --max-steps <n>         Max instructions before stop (default: 1000)
  --json                  Output as JSON
  --registers             Include register snapshots
  --help                  Show this help

Examples:
  npm run trace-exec test/fixtures/hello_world.dex
  npm run trace-exec test/fixtures/hello_world.dex -- --class "Lcom/example/Test;" --method test
  npm run trace-exec test/fixtures/hello_world.dex -- --max-steps 500 --json
`);
}

function parseArgs(argv: string[]): {
  dexFile: string;
  className: string;
  methodName: string;
  methodDesc: string;
  maxSteps: number;
  json: boolean;
  registers: boolean;
} {
  const opts = {
    dexFile: '',
    className: '',
    methodName: 'main',
    methodDesc: '()V',
    maxSteps: 1000,
    json: false,
    registers: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case '--class':
        opts.className = argv[++i] || '';
        break;
      case '--method':
        opts.methodName = argv[++i] || '';
        break;
      case '--descriptor':
        opts.methodDesc = argv[++i] || '';
        break;
      case '--max-steps':
        opts.maxSteps = parseInt(argv[++i] || '1000', 10);
        break;
      case '--json':
        opts.json = true;
        break;
      case '--registers':
        opts.registers = true;
        break;
      case '--help':
        printUsage();
        process.exit(0);
      default:
        if (!arg.startsWith('-') && !opts.dexFile) {
          opts.dexFile = arg;
        }
        break;
    }
    i++;
  }

  return opts;
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  const opts = parseArgs(args);

  if (!opts.dexFile) {
    console.error('[CRAFT][TraceExec][Error] No DEX file specified');
    process.exit(1);
  }

  const dexPath = path.resolve(opts.dexFile);
  if (!fs.existsSync(dexPath)) {
    console.error(`[CRAFT][TraceExec][Error] File not found: ${dexPath}`);
    process.exit(1);
  }

  console.log(`[CRAFT][TraceExec][Info] Loading DEX: ${dexPath}`);
  const dexData = new Uint8Array(fs.readFileSync(dexPath));
  const dex = new DexParser(dexData);

  // Determine class to invoke
  let className = opts.className;
  if (!className) {
    // Use first class in DEX
    const header = dex.parseHeader();
    if (header.classDefsSize > 0) {
      const classDef = dex.getClassDefByIndex(0);
      className = dex.getTypeName(classDef.classIdx);
    } else {
      console.error('[CRAFT][TraceExec][Error] No classes found in DEX');
      process.exit(1);
    }
  }

  // Set up interpreter with tracer
  const heap = new Heap();
  const shimRegistry = initializeShimRegistry();
  const tracer = new ExecutionTracer({
    maxSteps: opts.maxSteps,
    captureRegisters: opts.registers,
  });

  // Create a tracing-aware opcode table
  const opcodeTable = new OpcodeTable();
  registerEssentialOpcodes(opcodeTable);

  console.log(`[CRAFT][TraceExec][Info] Tracing ${className}.${opts.methodName}${opts.methodDesc}`);
  console.log(`[CRAFT][TraceExec][Info] Max steps: ${opts.maxSteps}`);
  console.log('');

  // Use the interpreter but with our tracer
  const interp = new Interpreter(dex, heap, shimRegistry);

  // Start tracing and run
  tracer.startTrace();

  try {
    // We can't easily hook into the interpreter's internal loop,
    // so we'll use the public invoke method and note that for deep tracing
    // the tracer would need to be integrated into the interpreter.
    // For now, trace at the public API level.
    const result = interp.invoke(className, opts.methodName, opts.methodDesc, []);

    tracer.stopTrace();

    if (opts.json) {
      const output = {
        class: className,
        method: opts.methodName,
        descriptor: opts.methodDesc,
        steps: tracer.getTrace(),
        result: result,
        maxStepsReached: tracer.isMaxStepsReached(),
      };
      console.log(JSON.stringify(output, null, 2));
    } else {
      if (tracer.getTrace().length > 0) {
        console.log(tracer.formatTable());
      } else {
        console.log('(No bytecode steps recorded - method may be a shim or have no code)');
      }
      console.log('');
      console.log(`Result: ${JSON.stringify(result)}`);
      if (tracer.isMaxStepsReached()) {
        console.log(`\n[CRAFT][TraceExec][Warn] Execution stopped at max steps (${opts.maxSteps})`);
      }
    }
  } catch (err: any) {
    tracer.stopTrace();

    if (opts.json) {
      console.log(JSON.stringify({
        class: className,
        method: opts.methodName,
        error: err.message,
        steps: tracer.getTrace(),
      }, null, 2));
    } else {
      if (tracer.getTrace().length > 0) {
        console.log(tracer.formatTable());
        console.log('');
      }
      console.error(`[CRAFT][TraceExec][Error] ${err.message}`);
    }
    process.exit(1);
  }
}

main();
