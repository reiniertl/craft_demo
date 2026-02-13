#!/usr/bin/env ts-node
/**
 * CRAFT APK Analyzer - Skill #5
 * Analyze APK requirements: opcodes, APIs, implementation complexity
 */

import * as fs from 'fs';
import * as path from 'path';
import { APKParser } from '../src/parser/apk_parser';
import { DexParser } from '../src/parser/dex_parser';

interface AnalysisResult {
  apkPath: string;
  packageName: string;
  mainActivity: string;
  opcodes: Map<number, { name: string; count: number; implemented: boolean }>;
  androidAPIs: Map<string, string[]>; // className -> methods
  complexity: {
    totalMethods: number;
    totalInstructions: number;
    uniqueOpcodes: number;
    missingOpcodes: number;
    missingAPIs: number;
  };
  recommendations: string[];
}

// Known implemented opcodes from Stage 1-3
const IMPLEMENTED_OPCODES = new Set([
  0x00, // nop
  0x01, 0x02, 0x03, // move variants
  0x04, 0x05, 0x06, // move-result variants
  0x07, 0x08, 0x09, // move-object variants
  0x0a, 0x0b, 0x0c, 0x0d, // move-result-object/exception/wide
  0x0e, 0x0f, 0x10, 0x11, // return variants
  0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, // const variants
  0x1c, // const-class
  0x22, // new-instance
  0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, // iget variants
  0x59, 0x5a, 0x5b, 0x5c, 0x5d, 0x5e, 0x5f, // iput variants
  0x6e, 0x6f, 0x70, 0x71, 0x72  // invoke variants
]);

const OPCODE_NAMES: Map<number, string> = new Map([
  [0x00, 'nop'],
  [0x01, 'move'],
  [0x02, 'move/from16'],
  [0x03, 'move/16'],
  [0x04, 'move-wide'],
  [0x07, 'move-object'],
  [0x0a, 'move-result'],
  [0x0b, 'move-result-wide'],
  [0x0c, 'move-result-object'],
  [0x0d, 'move-exception'],
  [0x0e, 'return-void'],
  [0x0f, 'return'],
  [0x10, 'return-wide'],
  [0x11, 'return-object'],
  [0x12, 'const/4'],
  [0x13, 'const/16'],
  [0x14, 'const'],
  [0x15, 'const/high16'],
  [0x16, 'const-wide/16'],
  [0x17, 'const-wide/32'],
  [0x18, 'const-wide'],
  [0x19, 'const-wide/high16'],
  [0x1a, 'const-string'],
  [0x1b, 'const-string/jumbo'],
  [0x1c, 'const-class'],
  [0x22, 'new-instance'],
  [0x52, 'iget'],
  [0x53, 'iget-wide'],
  [0x54, 'iget-object'],
  [0x55, 'iget-boolean'],
  [0x56, 'iget-byte'],
  [0x57, 'iget-char'],
  [0x58, 'iget-short'],
  [0x59, 'iput'],
  [0x5a, 'iput-wide'],
  [0x5b, 'iput-object'],
  [0x5c, 'iput-boolean'],
  [0x5d, 'iput-byte'],
  [0x5e, 'iput-char'],
  [0x5f, 'iput-short'],
  [0x6e, 'invoke-virtual'],
  [0x6f, 'invoke-super'],
  [0x70, 'invoke-direct'],
  [0x71, 'invoke-static'],
  [0x72, 'invoke-interface']
]);

function printUsage() {
  console.log(`
CRAFT APK Analyzer

Usage: npx ts-node tools/analyze_apk.ts <apk-path> [options]

Arguments:
  <apk-path>            Path to APK file to analyze

Options:
  --verbose             Show detailed analysis
  --report <file>       Save report to file (JSON format)
  --help               Show this help message

Examples:
  npx ts-node tools/analyze_apk.ts test/fixtures/hello_world.apk
  npx ts-node tools/analyze_apk.ts myapp.apk --verbose --report analysis.json
`);
}

async function analyzeAPK(apkPath: string, verbose: boolean): Promise<AnalysisResult> {
  console.log(`[CRAFT][Analyze][Info] Loading APK: ${apkPath}`);

  // Parse APK
  const apkData = fs.readFileSync(apkPath);
  const apkParser = new APKParser();
  const apk = apkParser.parse(new Uint8Array(apkData));

  // Parse primary DEX
  const dexData = apk.dexFiles.get('classes.dex');
  if (!dexData) {
    throw new Error('No classes.dex found in APK');
  }

  const dex = new DexParser(dexData);
  dex.parseHeader(); // Initialize header

  console.log(`[CRAFT][Analyze][Info] Analyzing DEX bytecode...`);

  const result: AnalysisResult = {
    apkPath,
    packageName: 'unknown', // TODO: Parse from manifest
    mainActivity: 'unknown',
    opcodes: new Map(),
    androidAPIs: new Map(),
    complexity: {
      totalMethods: 0,
      totalInstructions: 0,
      uniqueOpcodes: 0,
      missingOpcodes: 0,
      missingAPIs: 0
    },
    recommendations: []
  };

  // Analyze all classes
  const classDefs = dex.getClassDefs();
  for (const classDef of classDefs) {
    const className = dex.getTypeName(classDef.classIdx);

    if (classDef.classDataOff === 0) continue;

    const classData = dex.getClassData(classDef);

    // Analyze methods
    const allMethods = [...classData.directMethods, ...classData.virtualMethods];
    result.complexity.totalMethods += allMethods.length;

    for (const method of allMethods) {
      if (method.codeOff === 0) continue;

      const code = dex.getMethodCode(method.codeOff);
      if (!code) continue;

      result.complexity.totalInstructions += code.insnsSize;

      // Analyze opcodes
      let pc = 0;
      while (pc < code.insnsSize) {
        const insn = code.insns[pc];
        const opcode = insn & 0xFF;

        // Track opcode usage
        if (!result.opcodes.has(opcode)) {
          result.opcodes.set(opcode, {
            name: OPCODE_NAMES.get(opcode) || `unknown_${opcode.toString(16)}`,
            count: 0,
            implemented: IMPLEMENTED_OPCODES.has(opcode)
          });
        }
        const opcodeInfo = result.opcodes.get(opcode)!;
        opcodeInfo.count++;

        // Track API calls (invoke instructions)
        if (opcode >= 0x6e && opcode <= 0x72) {
          const methodIdx = code.insns[pc + 1];
          const methodId = dex.getMethodId(methodIdx);
          const className = dex.getTypeName(methodId.classIdx);
          const methodName = dex.getString(methodId.nameIdx);

          if (className.startsWith('Landroid/') || className.startsWith('Ljava/')) {
            if (!result.androidAPIs.has(className)) {
              result.androidAPIs.set(className, []);
            }
            result.androidAPIs.get(className)!.push(methodName);
          }
        }

        // Advance PC based on instruction size (simplified)
        pc += getInstructionSize(opcode);
      }
    }
  }

  // Calculate complexity metrics
  result.complexity.uniqueOpcodes = result.opcodes.size;
  result.complexity.missingOpcodes = Array.from(result.opcodes.values())
    .filter(op => !op.implemented).length;

  // Generate recommendations
  generateRecommendations(result);

  return result;
}

function getInstructionSize(opcode: number): number {
  // Simplified instruction size calculation
  // This should match the actual Dalvik instruction format
  if (opcode === 0x00 || (opcode >= 0x0e && opcode <= 0x11)) return 1;
  if (opcode >= 0x12 && opcode <= 0x1c) return 2;
  if (opcode >= 0x6e && opcode <= 0x72) return 3;
  return 1;
}

function generateRecommendations(result: AnalysisResult): void {
  const { complexity, opcodes, androidAPIs } = result;

  // Check for missing opcodes
  const missingOpcodes = Array.from(opcodes.entries())
    .filter(([_, info]) => !info.implemented)
    .sort((a, b) => b[1].count - a[1].count);

  if (missingOpcodes.length > 0) {
    result.recommendations.push(
      `⚠️  Missing ${missingOpcodes.length} opcodes - prioritize by usage:`
    );
    missingOpcodes.slice(0, 5).forEach(([opcode, info]) => {
      result.recommendations.push(
        `   - 0x${opcode.toString(16).padStart(2, '0')} (${info.name}): used ${info.count} times`
      );
    });
  }

  // Check for Android APIs
  const uniqueAPIs = androidAPIs.size;
  if (uniqueAPIs > 0) {
    result.recommendations.push(
      `📱 Uses ${uniqueAPIs} Android API classes - review shim coverage`
    );
  }

  // Complexity assessment
  if (complexity.totalMethods > 50) {
    result.recommendations.push(
      `⚡ Complex APK with ${complexity.totalMethods} methods - consider staged implementation`
    );
  }

  if (complexity.totalInstructions > 1000) {
    result.recommendations.push(
      `🔥 Large bytecode (${complexity.totalInstructions} instructions) - performance testing recommended`
    );
  }

  // Implementation order suggestion
  if (missingOpcodes.length > 0) {
    result.recommendations.push(
      `🎯 Recommended implementation order:`
    );
    result.recommendations.push(
      `   1. Implement missing opcodes (${missingOpcodes.length} total)`
    );
  }
  if (complexity.missingAPIs > 0) {
    result.recommendations.push(
      `   2. Create Android API shims (${uniqueAPIs} classes)`
    );
  }
  result.recommendations.push(
    `   3. Test with incrementally complex APKs`
  );
}

function printReport(result: AnalysisResult, verbose: boolean): void {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║               CRAFT APK Analysis Report                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log('📦 APK Information:');
  console.log(`   Path: ${result.apkPath}`);
  console.log(`   Package: ${result.packageName}`);
  console.log(`   Main Activity: ${result.mainActivity}\n`);

  console.log('📊 Complexity Metrics:');
  console.log(`   Total Methods: ${result.complexity.totalMethods}`);
  console.log(`   Total Instructions: ${result.complexity.totalInstructions}`);
  console.log(`   Unique Opcodes: ${result.complexity.uniqueOpcodes}`);
  console.log(`   Missing Opcodes: ${result.complexity.missingOpcodes}`);
  console.log(`   Android API Classes: ${result.androidAPIs.size}\n`);

  console.log('🔧 Opcode Coverage:');
  const implementedCount = Array.from(result.opcodes.values())
    .filter(op => op.implemented).length;
  const coveragePercent = ((implementedCount / result.opcodes.size) * 100).toFixed(1);
  console.log(`   Implemented: ${implementedCount}/${result.opcodes.size} (${coveragePercent}%)\n`);

  if (verbose) {
    console.log('📋 Opcode Usage Details:');
    const sortedOpcodes = Array.from(result.opcodes.entries())
      .sort((a, b) => b[1].count - a[1].count);

    sortedOpcodes.forEach(([opcode, info]) => {
      const status = info.implemented ? '✅' : '❌';
      console.log(`   ${status} 0x${opcode.toString(16).padStart(2, '0')} ${info.name.padEnd(20)} - used ${info.count} times`);
    });
    console.log();

    console.log('📱 Android API Usage:');
    Array.from(result.androidAPIs.entries()).forEach(([className, methods]) => {
      const uniqueMethods = [...new Set(methods)];
      console.log(`   ${className}`);
      if (verbose) {
        uniqueMethods.slice(0, 5).forEach(method => {
          console.log(`      - ${method}`);
        });
        if (uniqueMethods.length > 5) {
          console.log(`      ... and ${uniqueMethods.length - 5} more`);
        }
      }
    });
    console.log();
  }

  console.log('💡 Recommendations:');
  result.recommendations.forEach(rec => console.log(`   ${rec}`));
  console.log();
}

function saveReport(result: AnalysisResult, outputPath: string): void {
  const report = {
    ...result,
    opcodes: Array.from(result.opcodes.entries()),
    androidAPIs: Array.from(result.androidAPIs.entries())
  };

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`[CRAFT][Analyze][Success] Report saved to: ${outputPath}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  const apkPath = args[0];
  let verbose = false;
  let reportPath: string | null = null;

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--verbose':
        verbose = true;
        break;
      case '--report':
        reportPath = args[++i];
        break;
    }
  }

  try {
    const result = await analyzeAPK(apkPath, verbose);
    printReport(result, verbose);

    if (reportPath) {
      saveReport(result, reportPath);
    }

    console.log('[CRAFT][Analyze][Success] Analysis complete! ✅');
  } catch (error) {
    console.error('[CRAFT][Analyze][Error] Analysis failed:', error);
    process.exit(1);
  }
}

main();
