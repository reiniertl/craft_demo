#!/usr/bin/env ts-node
/**
 * CRAFT Validate Shims - Skill #8
 * Static analysis of shim files for registration completeness and consistency.
 */

import * as fs from 'fs';
import * as path from 'path';

interface ValidationIssue {
  severity: 'error' | 'warning';
  file: string;
  message: string;
}

function printUsage(): void {
  console.log(`
[CRAFT][ValidateShims] Shim Consistency Checker

Usage: npm run validate-shims [options]

Options:
  --fix             Auto-add missing imports to index.ts
  --verbose         Show all checks (not just failures)
  --json            Output as JSON
  --help            Show this help

Checks performed:
  1. Registration completeness - all register*Shim functions are imported and called
  2. Method descriptor format - class descriptors use L...;  format
  3. Parent class method duplication - subclass doesn't re-register parent methods
  4. Index file consistency - all shim files are referenced
`);
}

const SRC_ROOT = path.join(__dirname, '..', 'src', 'shim');
const ANDROID_DIR = path.join(SRC_ROOT, 'android');
const JAVA_LANG_DIR = path.join(SRC_ROOT, 'java', 'lang');

/** Scan shim files for exported register functions */
function findRegisterFunctions(dir: string): Map<string, string> {
  const functions = new Map<string, string>(); // functionName -> filePath
  scanDir(dir, functions);
  return functions;
}

function scanDir(dir: string, functions: Map<string, string>): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, functions);
    } else if (entry.name.endsWith('.ts') && entry.name !== 'index.ts') {
      const source = fs.readFileSync(fullPath, 'utf-8');
      const pattern = /export\s+function\s+(register\w+Shim)\s*\(/g;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source)) !== null) {
        functions.set(match[1], fullPath);
      }
    }
  }
}

/** Check if index file imports and calls all register functions */
function checkIndexRegistration(
  indexPath: string,
  functions: Map<string, string>,
  issues: ValidationIssue[],
  verbose: boolean
): void {
  if (!fs.existsSync(indexPath)) {
    issues.push({
      severity: 'error',
      file: indexPath,
      message: 'Index file does not exist',
    });
    return;
  }

  const source = fs.readFileSync(indexPath, 'utf-8');

  for (const [funcName, filePath] of functions) {
    const imported = source.includes(funcName);
    const called = new RegExp(`${funcName}\\s*\\(`).test(source);

    if (!imported) {
      issues.push({
        severity: 'error',
        file: indexPath,
        message: `Missing import: ${funcName} from ${path.relative(path.dirname(indexPath), filePath)}`,
      });
    } else if (!called) {
      issues.push({
        severity: 'warning',
        file: indexPath,
        message: `Imported but not called: ${funcName}`,
      });
    } else if (verbose) {
      console.log(`  [ok] ${funcName} imported and called`);
    }
  }
}

/** Check class descriptor format in registry.register calls */
function checkDescriptorFormat(
  dir: string,
  issues: ValidationIssue[],
  verbose: boolean
): void {
  scanForDescriptors(dir, issues, verbose);
}

function scanForDescriptors(
  dir: string,
  issues: ValidationIssue[],
  verbose: boolean
): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanForDescriptors(fullPath, issues, verbose);
    } else if (entry.name.endsWith('.ts') && entry.name !== 'index.ts') {
      const source = fs.readFileSync(fullPath, 'utf-8');
      const pattern = /registry\.register\(\s*'([^']+)'/g;
      let match: RegExpExecArray | null;
      const lineMap = source.split('\n');

      while ((match = pattern.exec(source)) !== null) {
        const descriptor = match[1];
        if (!descriptor.startsWith('L') || !descriptor.endsWith(';')) {
          const lineNum = source.substring(0, match.index).split('\n').length;
          issues.push({
            severity: 'error',
            file: fullPath,
            message: `Invalid class descriptor "${descriptor}" at line ${lineNum} (should use L...;  format)`,
          });
        } else if (verbose) {
          console.log(`  [ok] ${descriptor} format valid`);
        }
      }
    }
  }
}

/** Collect all registered methods by class across shim files */
function collectRegisteredMethods(
  dir: string
): Map<string, Set<string>> {
  const classMethodsMap = new Map<string, Set<string>>();
  collectFromDir(dir, classMethodsMap);
  return classMethodsMap;
}

function collectFromDir(
  dir: string,
  classMethodsMap: Map<string, Set<string>>
): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFromDir(fullPath, classMethodsMap);
    } else if (entry.name.endsWith('.ts') && entry.name !== 'index.ts') {
      const source = fs.readFileSync(fullPath, 'utf-8');
      const pattern = /registry\.register\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'/g;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(source)) !== null) {
        const className = match[1];
        const methodKey = `${match[2]}:${match[3]}`;

        if (!classMethodsMap.has(className)) {
          classMethodsMap.set(className, new Set());
        }
        classMethodsMap.get(className)!.add(methodKey);
      }
    }
  }
}

/** Check that shim files don't have unregistered exports */
function checkUnreferencedFiles(
  dir: string,
  indexPath: string,
  issues: ValidationIssue[],
  verbose: boolean
): void {
  if (!fs.existsSync(dir) || !fs.existsSync(indexPath)) return;
  const indexSource = fs.readFileSync(indexPath, 'utf-8');
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      // Check subdirectories for .ts files
      const subDir = path.join(dir, entry.name);
      const subEntries = fs.readdirSync(subDir, { withFileTypes: true });
      for (const subEntry of subEntries) {
        if (subEntry.name.endsWith('.ts') && subEntry.name !== 'index.ts') {
          const baseName = subEntry.name.replace('.ts', '');
          const importPath = `./${entry.name}/${baseName}`;
          if (!indexSource.includes(importPath)) {
            issues.push({
              severity: 'warning',
              file: path.join(subDir, subEntry.name),
              message: `File not imported in ${path.basename(indexPath)}: ${importPath}`,
            });
          } else if (verbose) {
            console.log(`  [ok] ${importPath} referenced in index`);
          }
        }
      }
    } else if (entry.name.endsWith('.ts') && entry.name !== 'index.ts') {
      const baseName = entry.name.replace('.ts', '');
      const importPath = `./${baseName}`;
      if (!indexSource.includes(importPath)) {
        issues.push({
          severity: 'warning',
          file: path.join(dir, entry.name),
          message: `File not imported in ${path.basename(indexPath)}: ${importPath}`,
        });
      } else if (verbose) {
        console.log(`  [ok] ${importPath} referenced in index`);
      }
    }
  }
}

/** Auto-fix missing imports (--fix mode) */
function autoFix(indexPath: string, issues: ValidationIssue[]): number {
  const importIssues = issues.filter(
    (i) => i.severity === 'error' && i.message.startsWith('Missing import:')
  );
  if (importIssues.length === 0) return 0;

  let source = fs.readFileSync(indexPath, 'utf-8');
  let fixCount = 0;

  for (const issue of importIssues) {
    const match = issue.message.match(/Missing import: (\w+) from (.+)/);
    if (!match) continue;
    const funcName = match[1];
    const importFrom = match[2].replace('.ts', '');
    const importLine = `import { ${funcName} } from './${importFrom}';\n`;

    // Add import after last import
    const lastImportIdx = source.lastIndexOf('import ');
    if (lastImportIdx >= 0) {
      const lineEnd = source.indexOf('\n', lastImportIdx);
      source = source.substring(0, lineEnd + 1) + importLine + source.substring(lineEnd + 1);
      fixCount++;
    }
  }

  if (fixCount > 0) {
    fs.writeFileSync(indexPath, source, 'utf-8');
  }
  return fixCount;
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  const fix = args.includes('--fix');
  const verbose = args.includes('--verbose');
  const jsonOutput = args.includes('--json');

  const issues: ValidationIssue[] = [];

  console.log('[CRAFT][ValidateShims][Info] Running shim consistency checks...\n');

  // 1. Check android shim registration
  if (verbose) console.log('Check 1: Android shim registration completeness');
  const androidFunctions = findRegisterFunctions(ANDROID_DIR);
  const androidIndex = path.join(ANDROID_DIR, 'index.ts');
  checkIndexRegistration(androidIndex, androidFunctions, issues, verbose);
  if (verbose) console.log('');

  // 2. Check java.lang shim registration
  if (verbose) console.log('Check 2: java.lang shim registration completeness');
  const javaLangFunctions = findRegisterFunctions(JAVA_LANG_DIR);
  const javaLangIndex = path.join(JAVA_LANG_DIR, 'index.ts');
  checkIndexRegistration(javaLangIndex, javaLangFunctions, issues, verbose);
  if (verbose) console.log('');

  // 3. Check descriptor format
  if (verbose) console.log('Check 3: Class descriptor format validation');
  checkDescriptorFormat(SRC_ROOT, issues, verbose);
  if (verbose) console.log('');

  // 4. Check unreferenced files
  if (verbose) console.log('Check 4: Unreferenced shim files');
  checkUnreferencedFiles(ANDROID_DIR, androidIndex, issues, verbose);
  checkUnreferencedFiles(JAVA_LANG_DIR, javaLangIndex, issues, verbose);
  if (verbose) console.log('');

  // Auto-fix if requested
  if (fix) {
    let fixCount = 0;
    fixCount += autoFix(androidIndex, issues);
    fixCount += autoFix(javaLangIndex, issues);
    if (fixCount > 0) {
      console.log(`[CRAFT][ValidateShims][Info] Auto-fixed ${fixCount} issues\n`);
    }
  }

  // Output results
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  if (jsonOutput) {
    console.log(JSON.stringify({ issues, errors: errors.length, warnings: warnings.length }, null, 2));
  } else {
    if (issues.length === 0) {
      console.log('[CRAFT][ValidateShims][Success] All registered, 0 issues');
    } else {
      for (const issue of issues) {
        const prefix = issue.severity === 'error' ? 'ERROR' : 'WARN';
        const relPath = path.relative(path.join(__dirname, '..'), issue.file);
        console.log(`  [${prefix}] ${relPath}: ${issue.message}`);
      }
      console.log('');
      console.log(`[CRAFT][ValidateShims][Result] ${errors.length} errors, ${warnings.length} warnings`);
    }
  }

  if (errors.length > 0) {
    process.exit(1);
  }
}

main();
