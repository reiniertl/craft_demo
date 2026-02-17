#!/usr/bin/env ts-node
/**
 * CRAFT APK Onboard - Skill #12
 * Orchestrate APK analysis and produce a prioritized implementation checklist.
 */

import * as fs from 'fs';
import * as path from 'path';
import { APKParser } from '../src/parser/apk_parser';
import { DexParser } from '../src/parser/dex_parser';
import { ManifestParser } from '../src/parser/manifest_parser';

function printUsage(): void {
  console.log(`
[CRAFT][APKOnboard] APK Onboarding Agent

Usage: npm run apk-onboard <apk-file> [options]

Options:
  --generate           Auto-generate stub files for missing items
  --output <path>      Save report to file (default: stdout)
  --json               Output as JSON
  --help               Show this help

Examples:
  npm run apk-onboard test/fixtures/hello_world.apk
  npm run apk-onboard myapp.apk -- --output report.md
  npm run apk-onboard myapp.apk -- --json
`);
}

// ── Scan implemented opcodes from source ──

function scanImplementedOpcodes(): Map<number, string> {
  const opcodesPath = path.join(__dirname, '..', 'src', 'interpreter', 'opcodes.ts');
  const source = fs.readFileSync(opcodesPath, 'utf-8');

  const opcodes = new Map<number, string>();
  const pattern = /table\.register\(0x([0-9a-fA-F]+),\s*\{[\s\S]*?name:\s*'([^']+)'/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    opcodes.set(parseInt(match[1], 16), match[2]);
  }
  return opcodes;
}

// ── Scan implemented shim classes from source ──

function scanImplementedShims(): Map<string, string[]> {
  const shimDir = path.join(__dirname, '..', 'src', 'shim');
  const classMap = new Map<string, string[]>();
  scanShimDir(shimDir, classMap);
  return classMap;
}

function scanShimDir(dir: string, classMap: Map<string, string[]>): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanShimDir(fullPath, classMap);
    } else if (entry.name.endsWith('.ts') && entry.name !== 'index.ts') {
      const source = fs.readFileSync(fullPath, 'utf-8');
      const pattern = /registry\.register\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'/g;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source)) !== null) {
        const className = match[1];
        const methodKey = `${match[2]}${match[3]}`;
        if (!classMap.has(className)) {
          classMap.set(className, []);
        }
        classMap.get(className)!.push(methodKey);
      }
    }
  }
}

// ── Dalvik opcode name map ──

const DALVIK_OPCODE_NAMES: Map<number, string> = new Map([
  [0x00, 'nop'], [0x01, 'move'], [0x07, 'move-object'],
  [0x0a, 'move-result'], [0x0c, 'move-result-object'],
  [0x0e, 'return-void'], [0x0f, 'return'], [0x10, 'return-wide'], [0x11, 'return-object'],
  [0x12, 'const/4'], [0x13, 'const/16'], [0x14, 'const'], [0x1a, 'const-string'],
  [0x1c, 'const-class'], [0x20, 'instance-of'], [0x22, 'new-instance'],
  [0x23, 'new-array'], [0x24, 'filled-new-array'],
  [0x27, 'throw'], [0x28, 'goto'], [0x29, 'goto/16'], [0x2a, 'goto/32'],
  [0x2b, 'packed-switch'], [0x2c, 'sparse-switch'],
  [0x2d, 'cmpl-float'], [0x2e, 'cmpg-float'], [0x31, 'cmp-long'],
  [0x32, 'if-eq'], [0x33, 'if-ne'], [0x34, 'if-lt'], [0x35, 'if-ge'],
  [0x36, 'if-gt'], [0x37, 'if-le'],
  [0x38, 'if-eqz'], [0x39, 'if-nez'], [0x3a, 'if-ltz'], [0x3b, 'if-gez'],
  [0x44, 'aget'], [0x46, 'aget-object'], [0x4b, 'aput'], [0x4d, 'aput-object'],
  [0x52, 'iget'], [0x54, 'iget-object'], [0x59, 'iput'], [0x5b, 'iput-object'],
  [0x60, 'sget'], [0x62, 'sget-object'], [0x67, 'sput'], [0x69, 'sput-object'],
  [0x6e, 'invoke-virtual'], [0x6f, 'invoke-super'], [0x70, 'invoke-direct'],
  [0x71, 'invoke-static'], [0x72, 'invoke-interface'],
  [0x90, 'add-int'], [0x91, 'sub-int'], [0xb0, 'add-int/2addr'],
]);

function estimateOpcodeWidth(opcode: number): number {
  if (opcode <= 0x0d) return 1;
  if (opcode <= 0x11) return 1;
  if (opcode === 0x12) return 1;
  if (opcode === 0x13) return 2;
  if (opcode === 0x14) return 3;
  if (opcode >= 0x16 && opcode <= 0x19) return opcode === 0x18 ? 5 : 2;
  if (opcode === 0x1a) return 2;
  if (opcode === 0x1b) return 3;
  if (opcode === 0x1c) return 2;
  if (opcode >= 0x1d && opcode <= 0x20) return 2;
  if (opcode === 0x21) return 1;
  if (opcode === 0x22) return 2;
  if (opcode === 0x23) return 2;
  if (opcode >= 0x24 && opcode <= 0x25) return 3;
  if (opcode === 0x26) return 3;
  if (opcode === 0x27) return 1;
  if (opcode === 0x28) return 1;
  if (opcode === 0x29) return 2;
  if (opcode === 0x2a) return 3;
  if (opcode >= 0x2b && opcode <= 0x2c) return 3;
  if (opcode >= 0x2d && opcode <= 0x31) return 2;
  if (opcode >= 0x32 && opcode <= 0x3d) return 2;
  if (opcode >= 0x44 && opcode <= 0x51) return 2;
  if (opcode >= 0x52 && opcode <= 0x6d) return 2;
  if (opcode >= 0x6e && opcode <= 0x72) return 3;
  if (opcode >= 0x74 && opcode <= 0x78) return 3;
  if (opcode >= 0x90 && opcode <= 0xaf) return 2;
  if (opcode >= 0xb0 && opcode <= 0xcf) return 1;
  if (opcode >= 0xd0 && opcode <= 0xe2) return 2;
  return 1;
}

interface OnboardingReport {
  packageName: string;
  mainActivity: string;
  missingOpcodes: { opcode: number; name: string; count: number; priority: string }[];
  missingShims: { className: string; methods: string[]; priority: string }[];
  recommendations: string[];
}

function analyzeAPK(apkPath: string): OnboardingReport {
  const data = new Uint8Array(fs.readFileSync(apkPath));
  const apkParser = new APKParser();
  const apk = apkParser.parse(data);

  // Parse manifest
  let packageName = 'unknown';
  let mainActivity = 'unknown';
  try {
    const manifestParser = new ManifestParser(apk.manifest);
    const manifest = manifestParser.parse();
    packageName = manifest.packageName;
    mainActivity = manifest.mainActivityClass;
  } catch {
    // Manifest parsing may fail for non-standard APKs
  }

  // Get implemented opcodes and shims
  const implementedOpcodes = scanImplementedOpcodes();
  const implementedShims = scanImplementedShims();

  // Scan DEX for used opcodes and API calls
  const dexFiles = Array.from(apk.dexFiles.values());
  if (dexFiles.length === 0) {
    return {
      packageName,
      mainActivity,
      missingOpcodes: [],
      missingShims: [],
      recommendations: ['No DEX files found in APK'],
    };
  }

  const dex = new DexParser(dexFiles[0]);
  const opcodeCounts = new Map<number, number>();
  const apiCalls = new Map<string, Set<string>>(); // className -> Set of methods

  const header = dex.parseHeader();
  for (let i = 0; i < header.classDefsSize; i++) {
    try {
      const classDef = dex.getClassDefByIndex(i);
      if (classDef.classDataOff === 0) continue;
      const classData = dex.getClassData(classDef);

      for (const method of [...classData.directMethods, ...classData.virtualMethods]) {
        if (method.codeOff === 0) continue;
        const code = dex.getMethodCode(method.codeOff);
        if (!code) continue;
        const insns = code.insns;

        for (let pc = 0; pc < insns.length; ) {
          const opcode = insns[pc] & 0xff;
          opcodeCounts.set(opcode, (opcodeCounts.get(opcode) || 0) + 1);

          // Check for invoke opcodes to find API calls
          if (opcode >= 0x6e && opcode <= 0x72 && pc + 1 < insns.length) {
            const methodIdx = insns[pc + 1];
            try {
              const methodId = dex.getMethodId(methodIdx);
              const className = dex.getTypeName(methodId.classIdx);
              const methodName = dex.getString(methodId.nameIdx);

              if (className.startsWith('Landroid/') || className.startsWith('Ljava/')) {
                if (!apiCalls.has(className)) {
                  apiCalls.set(className, new Set());
                }
                apiCalls.get(className)!.add(methodName);
              }
            } catch {
              // Skip invalid method refs
            }
          }

          pc += estimateOpcodeWidth(opcode);
        }
      }
    } catch {
      // Skip unparseable classes
    }
  }

  // Find missing opcodes
  const missingOpcodes: OnboardingReport['missingOpcodes'] = [];
  for (const [opcode, count] of opcodeCounts.entries()) {
    if (!implementedOpcodes.has(opcode)) {
      const name = DALVIK_OPCODE_NAMES.get(opcode) || `unknown(0x${opcode.toString(16)})`;
      const priority = count >= 10 ? 'HIGH' : count >= 3 ? 'MEDIUM' : 'LOW';
      missingOpcodes.push({ opcode, name, count, priority });
    }
  }
  missingOpcodes.sort((a, b) => b.count - a.count);

  // Find missing shim classes
  const missingShims: OnboardingReport['missingShims'] = [];
  for (const [className, methods] of apiCalls.entries()) {
    if (!implementedShims.has(className)) {
      const methodList = Array.from(methods);
      const priority = methodList.length >= 5 ? 'HIGH' : methodList.length >= 2 ? 'MEDIUM' : 'LOW';
      missingShims.push({ className, methods: methodList, priority });
    }
  }
  missingShims.sort((a, b) => b.methods.length - a.methods.length);

  // Generate recommendations
  const recommendations: string[] = [];
  const highPriorityOpcodes = missingOpcodes.filter((o) => o.priority === 'HIGH');
  const highPriorityShims = missingShims.filter((s) => s.priority === 'HIGH');

  let order = 1;
  for (const op of highPriorityOpcodes) {
    const hex = `0x${op.opcode.toString(16).padStart(2, '0')}`;
    recommendations.push(`${order++}. Implement ${op.name} (${hex}) - ${op.count} uses, blocks execution`);
  }
  for (const shim of highPriorityShims) {
    const shortName = shim.className.replace(/^L/, '').replace(/;$/, '').replace(/\//g, '.');
    recommendations.push(`${order++}. Generate ${shortName} shim - ${shim.methods.length} methods used`);
  }
  for (const op of missingOpcodes.filter((o) => o.priority === 'MEDIUM')) {
    const hex = `0x${op.opcode.toString(16).padStart(2, '0')}`;
    recommendations.push(`${order++}. Implement ${op.name} (${hex}) - ${op.count} uses`);
  }

  return { packageName, mainActivity, missingOpcodes, missingShims, recommendations };
}

function formatMarkdown(report: OnboardingReport): string {
  const lines: string[] = [];
  lines.push(`# APK Onboarding Report: ${report.packageName}`);
  lines.push('');
  lines.push(`**Main Activity:** ${report.mainActivity}`);
  lines.push('');

  if (report.missingOpcodes.length > 0) {
    lines.push(`## Missing Opcodes (${report.missingOpcodes.length})`);
    for (const op of report.missingOpcodes) {
      const hex = `0x${op.opcode.toString(16).padStart(2, '0')}`;
      lines.push(`- [ ] ${hex} ${op.name} — ${op.priority} priority (${op.count} uses)`);
    }
    lines.push('');
  } else {
    lines.push('## Opcodes');
    lines.push('All used opcodes are implemented!');
    lines.push('');
  }

  if (report.missingShims.length > 0) {
    lines.push(`## Missing Shim Classes (${report.missingShims.length})`);
    for (const shim of report.missingShims) {
      const shortName = shim.className.replace(/^L/, '').replace(/;$/, '').replace(/\//g, '.');
      lines.push(`- [ ] ${shortName} — ${shim.methods.length} methods used`);
      for (const m of shim.methods) {
        lines.push(`  - ${m}`);
      }
    }
    lines.push('');
  } else {
    lines.push('## Shim Classes');
    lines.push('All used API classes are implemented!');
    lines.push('');
  }

  if (report.recommendations.length > 0) {
    lines.push('## Recommended Order');
    for (const rec of report.recommendations) {
      lines.push(rec);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  let apkFile = '';
  let outputFile = '';
  let generate = false;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--output':
        outputFile = args[++i] || '';
        break;
      case '--generate':
        generate = true;
        break;
      case '--json':
        jsonOutput = true;
        break;
      default:
        if (!args[i].startsWith('-') && !apkFile) {
          apkFile = args[i];
        }
        break;
    }
  }

  if (!apkFile) {
    console.error('[CRAFT][APKOnboard][Error] No APK file specified');
    process.exit(1);
  }

  const apkPath = path.resolve(apkFile);
  if (!fs.existsSync(apkPath)) {
    console.error(`[CRAFT][APKOnboard][Error] File not found: ${apkPath}`);
    process.exit(1);
  }

  console.log(`[CRAFT][APKOnboard][Info] Analyzing: ${apkPath}\n`);

  const report = analyzeAPK(apkPath);

  if (jsonOutput) {
    const output = JSON.stringify(report, null, 2);
    if (outputFile) {
      fs.writeFileSync(path.resolve(outputFile), output, 'utf-8');
      console.log(`[CRAFT][APKOnboard][Info] JSON report written to: ${outputFile}`);
    } else {
      console.log(output);
    }
  } else {
    const markdown = formatMarkdown(report);
    if (outputFile) {
      fs.writeFileSync(path.resolve(outputFile), markdown, 'utf-8');
      console.log(`[CRAFT][APKOnboard][Info] Report written to: ${outputFile}`);
    } else {
      console.log(markdown);
    }
  }

  if (generate) {
    console.log('[CRAFT][APKOnboard][Info] Generating stubs...');
    for (const op of report.missingOpcodes) {
      const hex = `0x${op.opcode.toString(16).padStart(2, '0')}`;
      console.log(`  Would generate: npm run gen-opcode ${hex} ${op.name} -- --category unknown`);
    }
    for (const shim of report.missingShims) {
      const dotName = shim.className.replace(/^L/, '').replace(/;$/, '').replace(/\//g, '.');
      console.log(`  Would generate: npm run gen-shim ${dotName}`);
    }
    console.log('[CRAFT][APKOnboard][Info] Run the above commands to create stubs');
  }

  // Summary
  const totalMissing = report.missingOpcodes.length + report.missingShims.length;
  if (totalMissing === 0) {
    console.log('\n[CRAFT][APKOnboard][Success] APK is fully supported!');
  } else {
    console.log(`\n[CRAFT][APKOnboard][Info] ${totalMissing} items to implement`);
  }
}

main();
