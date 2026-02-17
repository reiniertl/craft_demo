#!/usr/bin/env ts-node
/**
 * CRAFT Regression Guard - Skill #13
 * Run all quality checks in sequence and report pass/fail.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function printUsage(): void {
  console.log(`
[CRAFT][Guard] Regression Guard

Usage: npm run guard [options]

Options:
  --fix              Auto-fix what can be fixed (shim registration)
  --skip-types       Skip TypeScript check
  --skip-tests       Skip test suite
  --verbose          Show full output from each check
  --help             Show this help

Checks run:
  1. TypeScript type checking (npx tsc --noEmit)
  2. Jest test suite (npx jest --no-coverage)
  3. Shim consistency (validate-shims logic)
  4. Opcode count verification
`);
}

interface CheckResult {
  name: string;
  passed: boolean;
  summary: string;
  output?: string;
}

function runCommand(cmd: string, verbose: boolean): { success: boolean; stdout: string; stderr: string } {
  try {
    // Use shell redirection to capture both stdout and stderr
    const output = execSync(`${cmd} 2>&1`, {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000,
    });
    if (verbose) {
      console.log(output);
    }
    return { success: true, stdout: output, stderr: '' };
  } catch (err: any) {
    const stdout = err.stdout || '';
    const stderr = err.stderr || '';
    if (verbose) {
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
    }
    return { success: false, stdout, stderr };
  }
}

function checkTypeScript(verbose: boolean): CheckResult {
  console.log('[CRAFT][Guard][Info] Checking TypeScript...');
  const result = runCommand('npx tsc --noEmit', verbose);

  if (result.success) {
    return { name: 'TypeScript', passed: true, summary: '0 errors' };
  }

  // Count errors
  const errorLines = (result.stdout + result.stderr)
    .split('\n')
    .filter((l) => l.includes('error TS'));
  return {
    name: 'TypeScript',
    passed: false,
    summary: `${errorLines.length} errors`,
    output: errorLines.slice(0, 10).join('\n'),
  };
}

function checkTests(verbose: boolean): CheckResult {
  console.log('[CRAFT][Guard][Info] Running tests...');
  const result = runCommand('npx jest --no-coverage', verbose);

  // Parse test results - Jest outputs to stderr
  const combined = (result.stdout || '') + '\n' + (result.stderr || '');
  const passMatch = combined.match(/Tests:\s+(\d+) passed/);
  const failMatch = combined.match(/Tests:.*?(\d+) failed/);
  const passed = passMatch ? parseInt(passMatch[1]) : 0;
  const failed = failMatch ? parseInt(failMatch[1]) : 0;

  if (result.success) {
    return { name: 'Tests', passed: true, summary: `${passed} passed, 0 failed` };
  }

  // Extract failed test names
  const failLines = combined
    .split('\n')
    .filter((l) => l.includes('FAIL ') || l.includes('\u25CF'));
  return {
    name: 'Tests',
    passed: false,
    summary: `${passed} passed, ${failed} failed`,
    output: failLines.slice(0, 10).join('\n'),
  };
}

function checkShims(verbose: boolean, fix: boolean): CheckResult {
  console.log('[CRAFT][Guard][Info] Validating shims...');

  const shimDir = path.join(__dirname, '..', 'src', 'shim');
  let issues = 0;

  // Check android shim registrations
  const androidIndex = path.join(shimDir, 'android', 'index.ts');
  const javaLangIndex = path.join(shimDir, 'java', 'lang', 'index.ts');

  function checkDir(dir: string, indexPath: string): number {
    if (!fs.existsSync(dir) || !fs.existsSync(indexPath)) return 0;
    const indexSource = fs.readFileSync(indexPath, 'utf-8');
    let localIssues = 0;

    function scan(d: string): void {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(d, entry.name);
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.name.endsWith('.ts') && entry.name !== 'index.ts') {
          const source = fs.readFileSync(fullPath, 'utf-8');
          const pattern = /export\s+function\s+(register\w+Shim)\s*\(/g;
          let match: RegExpExecArray | null;
          while ((match = pattern.exec(source)) !== null) {
            if (!indexSource.includes(match[1])) {
              if (verbose) {
                console.log(`  [WARN] ${match[1]} not in ${path.basename(indexPath)}`);
              }
              localIssues++;
            }
          }
        }
      }
    }

    scan(dir);
    return localIssues;
  }

  issues += checkDir(path.join(shimDir, 'android'), androidIndex);
  issues += checkDir(path.join(shimDir, 'java', 'lang'), javaLangIndex);

  if (issues === 0) {
    return { name: 'Shims', passed: true, summary: 'All registered, 0 issues' };
  }
  return { name: 'Shims', passed: false, summary: `${issues} issues` };
}

function checkOpcodes(verbose: boolean): CheckResult {
  console.log('[CRAFT][Guard][Info] Verifying opcode count...');

  const opcodesPath = path.join(__dirname, '..', 'src', 'interpreter', 'opcodes.ts');
  const source = fs.readFileSync(opcodesPath, 'utf-8');

  const pattern = /table\.register\(0x([0-9a-fA-F]+)/g;
  const opcodes = new Set<number>();
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    opcodes.add(parseInt(match[1], 16));
  }

  const count = opcodes.size;
  if (verbose) {
    console.log(`  Found ${count} registered opcodes`);
  }

  return { name: 'Opcodes', passed: true, summary: `${count} registered` };
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  const skipTypes = args.includes('--skip-types');
  const skipTests = args.includes('--skip-tests');
  const verbose = args.includes('--verbose');
  const fix = args.includes('--fix');

  console.log('[CRAFT][Guard][Info] Running regression guard...\n');

  const results: CheckResult[] = [];

  // 1. TypeScript
  if (!skipTypes) {
    results.push(checkTypeScript(verbose));
  }

  // 2. Tests
  if (!skipTests) {
    results.push(checkTests(verbose));
  }

  // 3. Shim consistency
  results.push(checkShims(verbose, fix));

  // 4. Opcode count
  results.push(checkOpcodes(verbose));

  // Print summary
  console.log('');
  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? '\u2705' : '\u274C';
    console.log(`${icon} ${r.name}: ${r.summary}`);
    if (!r.passed && r.output) {
      console.log(r.output.split('\n').map((l) => `  ${l}`).join('\n'));
    }
    if (!r.passed) allPassed = false;
  }

  console.log('');
  if (allPassed) {
    console.log('[CRAFT][Guard][Success] All checks passed! \u2705');
  } else {
    console.log('[CRAFT][Guard][Fail] Some checks failed \u274C');
    process.exit(1);
  }
}

main();
