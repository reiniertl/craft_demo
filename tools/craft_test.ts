#!/usr/bin/env ts-node
/**
 * CRAFT Test Runner - Skill #1
 * Run CRAFT-specific tests with filtering and detailed output
 */

import { execSync } from 'child_process';
import * as path from 'path';

interface TestOptions {
  component?: 'parser' | 'interpreter' | 'shim' | 'bridge' | 'all';
  watch?: boolean;
  verbose?: boolean;
  pattern?: string;
}

function printUsage() {
  console.log(`
CRAFT Test Runner

Usage: npx ts-node tools/craft_test.ts [options]

Options:
  --component <name>    Run tests for specific component:
                        parser, interpreter, shim, bridge, all
  --pattern <pattern>   Run tests matching pattern (regex)
  --watch              Run tests in watch mode
  --verbose            Show verbose output
  --help               Show this help message

Examples:
  npx ts-node tools/craft_test.ts --component parser
  npx ts-node tools/craft_test.ts --pattern "dex.*parser"
  npx ts-node tools/craft_test.ts --component interpreter --watch
  npx ts-node tools/craft_test.ts --verbose
`);
}

function parseArgs(): TestOptions | null {
  const args = process.argv.slice(2);
  const options: TestOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--help':
      case '-h':
        return null;
      case '--component':
        options.component = args[++i] as any;
        break;
      case '--pattern':
        options.pattern = args[++i];
        break;
      case '--watch':
        options.watch = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        return null;
    }
  }

  return options;
}

function buildJestCommand(options: TestOptions): string {
  const parts = ['jest'];

  // Component filtering
  if (options.component && options.component !== 'all') {
    switch (options.component) {
      case 'parser':
        parts.push('--testPathPattern="(apk_parser|dex_parser|manifest_parser)"');
        break;
      case 'interpreter':
        parts.push('--testPathPattern="(interpreter|opcodes|heap|frame)"');
        break;
      case 'shim':
        parts.push('--testPathPattern="shim"');
        break;
      case 'bridge':
        parts.push('--testPathPattern="bridge"');
        break;
    }
  }

  // Pattern filtering
  if (options.pattern) {
    parts.push(`-t "${options.pattern}"`);
  }

  // Watch mode
  if (options.watch) {
    parts.push('--watch');
  }

  // Verbose mode
  if (options.verbose) {
    parts.push('--verbose');
  }

  return parts.join(' ');
}

function runTests(options: TestOptions): void {
  const command = buildJestCommand(options);

  console.log('[CRAFT][Test][Info] Running tests...');
  if (options.component) {
    console.log(`[CRAFT][Test][Info] Component: ${options.component}`);
  }
  if (options.pattern) {
    console.log(`[CRAFT][Test][Info] Pattern: ${options.pattern}`);
  }
  console.log(`[CRAFT][Test][Info] Command: ${command}\n`);

  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('\n[CRAFT][Test][Success] All tests passed! ✅');
  } catch (error) {
    console.error('\n[CRAFT][Test][Error] Tests failed! ❌');
    process.exit(1);
  }
}

function main() {
  const options = parseArgs();

  if (options === null) {
    printUsage();
    process.exit(0);
  }

  runTests(options);
}

main();
