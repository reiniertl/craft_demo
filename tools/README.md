# CRAFT Development Tools & Skills

This directory contains development tools (skills) for the CRAFT project. These tools accelerate development by automating common tasks like testing, code generation, analysis, and debugging.

## Available Skills

### 1. `craft-test` - Test Runner

Run CRAFT-specific tests with filtering and detailed output.

**Usage:**
```bash
# Run all tests
npm run craft-test

# Run specific component tests
npm run craft-test -- --component parser
npm run craft-test -- --component interpreter
npm run craft-test -- --component shim
npm run craft-test -- --component bridge

# Run tests matching a pattern
npm run craft-test -- --pattern "dex.*parser"

# Watch mode
npm run craft-test -- --component interpreter --watch

# Verbose output
npm run craft-test -- --verbose
```

---

### 2. `gen-shim` - Android API Shim Generator

Generate Android API shim implementations with boilerplate code, tests, and documentation.

**Usage:**
```bash
# Generate basic shim
npm run gen-shim android.graphics.Paint

# With methods and parent class
npm run gen-shim android.graphics.Paint -- \
  --extends android.view.View \
  --method "setColor:(I)V:void" \
  --method "getColor:()I:number" \
  --field "mColor:number"
```

**What it generates:**
- `src/shim/android/graphics/paint.ts` - Shim implementation
- `test/unit/shim/android/graphics/paint.ts` - Unit tests
- Instructions for updating `index.ts`

---

### 3. `gen-opcode` - Opcode Handler Generator

Generate Dalvik opcode handler implementations with boilerplate code and documentation.

**Usage:**
```bash
# Generate opcode handler
npm run gen-opcode 0x6e invoke-virtual 35c -- --category invoke

# More examples
npm run gen-opcode 0x52 iget 22c -- --category field
npm run gen-opcode 0x2d cmpl-float 23x -- --category compare
```

---

### 4. `dex-dump` - DEX File Dumper

Dump and analyze DEX file contents for debugging.

**Usage:**
```bash
# Dump all sections
npm run dex-dump test/fixtures/hello_world.dex

# Dump specific sections
npm run dex-dump test/fixtures/hello_world.dex -- --header
npm run dex-dump test/fixtures/hello_world.dex -- --strings
npm run dex-dump test/fixtures/hello_world.dex -- --classes
npm run dex-dump test/fixtures/hello_world.dex -- --methods
```

---

### 5. `analyze-apk` - APK Requirements Analyzer

Analyze APK requirements: opcodes, APIs, implementation complexity.

**Usage:**
```bash
# Basic analysis
npm run analyze-apk test/fixtures/hello_world.apk

# Verbose analysis with all details
npm run analyze-apk myapp.apk -- --verbose

# Save report to JSON file
npm run analyze-apk myapp.apk -- --report analysis.json
```

---

### 6. `trace-exec` - Bytecode Execution Tracer

Trace bytecode execution step-by-step for debugging.

**Usage:**
```bash
# Trace execution of first class's main method
npm run trace-exec test/fixtures/hello_world.dex

# Trace specific class and method
npm run trace-exec test/fixtures/hello_world.dex -- --class "Lcom/example/Test;" --method test

# Limit steps and output as JSON
npm run trace-exec test/fixtures/hello_world.dex -- --max-steps 500 --json

# Include register snapshots
npm run trace-exec test/fixtures/hello_world.dex -- --registers
```

**Options:**
- `--class <descriptor>` - Class to invoke (default: first class)
- `--method <name>` - Method name (default: main)
- `--descriptor <desc>` - Method descriptor (default: ()V)
- `--max-steps <n>` - Max instructions before stop (default: 1000)
- `--json` - Output as JSON
- `--registers` - Include register snapshots

**Programmatic use:**
```typescript
import { ExecutionTracer } from './src/interpreter/tracer';

const tracer = new ExecutionTracer({ maxSteps: 500, captureRegisters: true });
tracer.startTrace();
// ... run interpreter ...
tracer.stopTrace();
console.log(tracer.formatTable());
```

---

### 7. `coverage-map` - Opcode & API Coverage Reporter

Report opcode and shim coverage by scanning source code. Optionally analyze an APK to show the gap.

**Usage:**
```bash
# Show all coverage
npm run coverage-map

# Show only opcode or shim coverage
npm run coverage-map -- --opcodes-only
npm run coverage-map -- --shims-only

# Analyze coverage for a specific APK
npm run coverage-map test/fixtures/hello_world.apk

# Output as JSON
npm run coverage-map -- --json
```

**Options:**
- `--opcodes-only` - Show only opcode coverage
- `--shims-only` - Show only shim coverage
- `--json` - Output as JSON

---

### 8. `validate-shims` - Shim Consistency Checker

Static analysis of shim files for registration completeness and consistency.

**Usage:**
```bash
# Run all checks
npm run validate-shims

# Verbose output showing all checks
npm run validate-shims -- --verbose

# Auto-fix missing imports
npm run validate-shims -- --fix

# Output as JSON
npm run validate-shims -- --json
```

**Checks performed:**
1. Registration completeness - all `register*Shim` functions are imported and called in index files
2. Class descriptor format - all descriptors use `L...;` format
3. Unreferenced files - all shim files are imported in their index

---

### 9. `heap-dump` - Runtime Heap Inspector

Run a method then dump the heap state for inspection.

**Usage:**
```bash
# Dump heap after running first class's main method
npm run heap-dump test/fixtures/hello_world.dex

# Dump heap after specific method
npm run heap-dump test/fixtures/hello_world.dex -- --class "Lcom/example/Test;" --method test

# Output as JSON
npm run heap-dump test/fixtures/hello_world.dex -- --json
```

**Options:**
- `--class <descriptor>` - Class to invoke
- `--method <name>` - Method to run first (default: main)
- `--descriptor <desc>` - Method descriptor (default: ()V)
- `--json` - Output as JSON

**Programmatic use:**
```typescript
const heap = new Heap();
// ... run interpreter ...
const dump = heap.dump();
console.log(`Objects: ${dump.objectCount}, Strings: ${dump.stringPool.length}`);
```

---

### 10. `gen-fixture` - Test Fixture Builder

Generate DEX test fixtures for specific test scenarios.

**Usage:**
```bash
# List available scenarios
npm run gen-fixture -- --list

# Generate a specific scenario
npm run gen-fixture null-pointer
npm run gen-fixture deep-inheritance
npm run gen-fixture static-init

# Custom output path
npm run gen-fixture string-ops -- --output test/fixtures/my_strings.ts
```

**Built-in scenarios:**
- `null-pointer` - Method that triggers NullPointerException
- `deep-inheritance` - 4-level class hierarchy with virtual dispatch
- `static-init` - Class with `<clinit>` static initializer
- `array-ops` - Array creation, fill, access patterns
- `string-ops` - String creation, const-string usage
- `all-opcodes` - Uses key implemented opcodes

---

### 11. `gen-integration-test` - Integration Test Scaffolder

Generate Jest integration test files for APK/DEX flows.

**Usage:**
```bash
# Generate interpreter-based test (DEX)
npm run gen-integration-test hello-world

# Generate runtime-based test (APK)
npm run gen-integration-test login-flow -- --fixture test/fixtures/login.apk --runtime

# Custom activity and output
npm run gen-integration-test calc -- --activity "Lcom/example/CalcActivity;" --output test/integration/calc.test.ts
```

**Options:**
- `--fixture <path>` - APK/DEX fixture to use
- `--activity <class>` - Activity class name
- `--output <path>` - Output test file path
- `--runtime` - Generate CraftRuntime-based test (APK)
- `--interpreter` - Generate Interpreter-based test (DEX, default)

---

### 12. `apk-onboard` - APK Onboarding Agent

Analyze an APK and produce a prioritized implementation checklist of missing opcodes and shims.

**Usage:**
```bash
# Analyze APK and show report
npm run apk-onboard test/fixtures/hello_world.apk

# Save report to file
npm run apk-onboard myapp.apk -- --output report.md

# Output as JSON
npm run apk-onboard myapp.apk -- --json

# Show stub generation commands
npm run apk-onboard myapp.apk -- --generate
```

**Options:**
- `--generate` - Show commands to generate stubs for missing items
- `--output <path>` - Save report to file (default: stdout)
- `--json` - Output as JSON

---

### 13. `guard` - Regression Guard

Run all quality checks in sequence and report pass/fail.

**Usage:**
```bash
# Run all checks
npm run guard

# Skip specific checks
npm run guard -- --skip-types
npm run guard -- --skip-tests

# Verbose output
npm run guard -- --verbose

# Auto-fix shim issues
npm run guard -- --fix
```

**Checks run:**
1. TypeScript type checking (`npx tsc --noEmit`)
2. Jest test suite (`npx jest --no-coverage`)
3. Shim consistency (validate-shims logic)
4. Opcode count verification

**Example output:**
```
[CRAFT][Guard][Info] Running regression guard...

✅ TypeScript: 0 errors
✅ Tests: 274 passed, 0 failed
✅ Shims: All registered, 0 issues
✅ Opcodes: 28 registered

[CRAFT][Guard][Success] All checks passed!
```

---

## Shared Test Helpers

Reusable test utilities in `test/helpers/`:

### `shim_test_utils.ts`

```typescript
import { createShimTestContext } from '../../test/helpers/shim_test_utils';

const ctx = createShimTestContext({ javaLang: true, android: true });
const result = ctx.invokeShim('Landroid/app/Activity;', '<init>', '()V', [objectRef(ref)]);
```

**Exports:**
- `makeMethod(classDesc, name, desc, isStatic?)` - Create ResolvedMethod stub
- `invokeShim(registry, interp, heap, classDesc, name, desc, args, isStatic?)` - Invoke shim directly
- `createShimTestContext(opts?)` - Create complete test context with registry, heap, mockInterp, and invokeShim

### `value_matchers.ts`

Custom Jest matchers auto-loaded via `setupFilesAfterEnv`:
- `toBeInt(n)` - Assert `{ type: 'int', value: n }`
- `toBeFloat(n)` - Assert `{ type: 'float', value: n }` (approximate)
- `toBeNullValue()` - Assert `{ type: 'null' }`
- `toBeObjectRef(n)` - Assert `{ type: 'object', ref: n }`
- `toHaveStringValue(heap, s)` - Assert object ref has string value `s`

---

## Quick Reference

| Task | Command |
|------|---------|
| Run all tests | `npm test` |
| Component tests | `npm run craft-test -- --component <name>` |
| Type check | `npx tsc --noEmit` |
| Full quality check | `npm run guard` |
| Generate shim | `npm run gen-shim <class>` |
| Generate opcode | `npm run gen-opcode <hex> <name> <format>` |
| Dump DEX | `npm run dex-dump <file>` |
| Analyze APK | `npm run analyze-apk <file>` |
| Trace execution | `npm run trace-exec <dex-file>` |
| Coverage report | `npm run coverage-map [apk-file]` |
| Validate shims | `npm run validate-shims` |
| Dump heap | `npm run heap-dump <dex-file>` |
| Generate fixture | `npm run gen-fixture <scenario>` |
| Scaffold test | `npm run gen-integration-test <name>` |
| Onboard APK | `npm run apk-onboard <apk-file>` |

## Common Workflows

**1. Adding support for a new APK:**
```bash
npm run apk-onboard myapp.apk -- --generate
# Review missing items, then implement them
npm run guard
```

**2. Debugging bytecode execution:**
```bash
npm run trace-exec test/fixtures/hello_world.dex -- --registers
npm run heap-dump test/fixtures/hello_world.dex
```

**3. Validating after changes:**
```bash
npm run guard
```

**4. Creating test fixtures:**
```bash
npm run gen-fixture -- --list
npm run gen-fixture deep-inheritance
npm run gen-integration-test my-test -- --fixture test/fixtures/deep-inheritance.dex
```

---

**Last Updated:** 2026-02-17
