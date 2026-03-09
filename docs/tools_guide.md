# CRAFT Development Tools Guide

**Last Updated:** 2026-03-09
**Status:** 14 development tools implemented and tested

## Overview

CRAFT provides 14 development tools that accelerate implementation work. These tools automate repetitive tasks like testing, code generation, analysis, debugging, and orchestration.

## Tool Categories

### Core (5 tools)
- **craft-test** - Component-filtered test runner
- **gen-shim** - Android API shim generator
- **gen-opcode** - Opcode handler generator
- **dex-dump** - DEX file dumper
- **analyze-apk** - APK requirements analyzer

### Debugging & Analysis (4 tools)
- **trace-exec** - Bytecode execution tracer
- **coverage-map** - Opcode & API coverage reporter
- **validate-shims** - Shim consistency checker
- **heap-dump** - Runtime heap inspector

### Code Generation & Testing (2 tools)
- **gen-fixture** - Test fixture builder (6 scenarios)
- **gen-integration-test** - Integration test scaffolder

### Orchestration (3 tools)
- **apk-onboard** - APK onboarding agent
- **guard** - Regression guard (TypeScript + tests + shims + opcodes)
- **sync-oh** - OH sync checker (detect/fix src ↔ OH drift)

---

## Tool #1: craft-test

**Purpose:** Run CRAFT-specific tests with component filtering and detailed output.

**When to use:**
- During development to run focused test suites
- In watch mode for TDD workflow
- To verify specific components after changes

**Common commands:**
```bash
# Run all parser tests
npm run craft-test -- --component parser

# Watch interpreter tests
npm run craft-test -- --component interpreter --watch

# Run tests matching pattern
npm run craft-test -- --pattern "dex.*parser"

# Verbose output
npm run craft-test -- --verbose
```

**Integration with stages:**
- Stage 1: `--component parser`
- Stage 2: `--component interpreter`
- Stage 3: `--component shim`
- Stage 4: `--component bridge`

---

## Tool #2: gen-shim

**Purpose:** Generate Android API shim implementations with boilerplate code.

**When to use:**
- Adding support for new Android classes
- Implementing missing API methods identified by analyze-apk
- Extending Android framework coverage

**Common workflows:**

### Basic shim generation
```bash
npm run gen-shim android.graphics.Paint
```

### With inheritance and methods
```bash
npm run gen-shim android.widget.Button -- \
  --extends android.widget.TextView \
  --method "setOnClickListener:(Landroid/view/View$OnClickListener;)V:void" \
  --field "mOnClickListener:number"
```

### Complex example
```bash
npm run gen-shim android.app.Dialog -- \
  --extends android.content.Context \
  --method "show:()V:void" \
  --method "dismiss:()V:void" \
  --method "setTitle:(Ljava/lang/CharSequence;)V:void" \
  --field "mShowing:boolean"
```

**Generated files:**
- `src/shim/android/{package}/{class}.ts` - Implementation
- `test/unit/shim/android/{package}/{class}.ts` - Tests
- Console output with integration instructions

**Next steps after generation:**
1. Implement the TODO sections in generated shim
2. Add registration call to appropriate `index.ts`
3. Run tests: `npm run craft-test -- --component shim`
4. Update documentation if needed

---

## Tool #3: gen-opcode

**Purpose:** Generate Dalvik opcode handler implementations with format parsing.

**When to use:**
- Implementing missing opcodes identified by analyze-apk
- Adding new opcode support during Stage 2 expansion
- Creating reference documentation for opcodes

**Common workflows:**

### Generate invoke opcode
```bash
npm run gen-opcode 0x6e invoke-virtual 35c -- --category invoke
```

### Generate field access opcode
```bash
npm run gen-opcode 0x52 iget 22c -- \
  --category field \
  --description "Get instance field value"
```

### Generate control flow opcode
```bash
npm run gen-opcode 0x32 if-eq 22t -- \
  --category control \
  --description "Branch if equal"
```

**Generated outputs:**
- Handler code added to `src/interpreter/opcode_table.ts`
- Documentation created in `docs/opcodes/{opcode-name}.md`
- Test skeleton (when markers present)

**Next steps after generation:**
1. Implement the TODO handler logic in `opcode_table.ts`
2. Add comprehensive tests in `test/unit/interpreter/opcodes.test.ts`
3. Review and enhance documentation
4. Test with real bytecode sequences

---

## Tool #4: dex-dump

**Purpose:** Dump and analyze DEX file contents for debugging.

**When to use:**
- Debugging DEX parsing issues
- Understanding bytecode structure
- Verifying DEX generation in test fixtures
- Investigating opcode sequences

**Common workflows:**

### Dump entire DEX
```bash
npm run dex-dump test/fixtures/hello_world.dex
```

### Specific sections
```bash
# Header only
npm run dex-dump test/fixtures/hello_world.dex -- --header

# String table
npm run dex-dump test/fixtures/hello_world.dex -- --strings

# Method bytecode
npm run dex-dump test/fixtures/hello_world.dex -- --methods
```

### Redirect to file
```bash
npm run dex-dump test/fixtures/hello_world.dex -- --all > analysis.txt
```

### Find specific method
```bash
npm run dex-dump test/fixtures/hello_world.dex -- --methods | grep -A 30 "onCreate"
```

**Output sections:**
- **Header** - Magic, checksums, section offsets
- **Strings** - String table with indices
- **Types** - Type descriptors
- **Classes** - Class definitions with access flags
- **Methods** - Method signatures and bytecode

---

## Tool #5: analyze-apk

**Purpose:** Analyze APK requirements including opcodes, APIs, and complexity.

**When to use:**
- Before starting work on a new APK
- To estimate implementation effort
- To prioritize missing opcodes/APIs
- To generate implementation roadmaps

**Common workflows:**

### Basic analysis
```bash
npm run analyze-apk test/fixtures/hello_world.apk
```

**Example output:**
```
╔══════════════════════════════════════════════════════════════╗
║               CRAFT APK Analysis Report                     ║
╚══════════════════════════════════════════════════════════════╝

📦 APK Information:
   Path: test/fixtures/hello_world.apk
   Package: unknown
   Main Activity: unknown

📊 Complexity Metrics:
   Total Methods: 2
   Total Instructions: 7
   Unique Opcodes: 5
   Missing Opcodes: 1

🔧 Opcode Coverage:
   Implemented: 4/5 (80.0%)

💡 Recommendations:
   ⚠️  Missing 1 opcodes - prioritize by usage
   🎯 Recommended implementation order
```

### Detailed analysis
```bash
npm run analyze-apk myapp.apk -- --verbose
```

Shows:
- All opcodes with usage counts
- Android API classes and methods
- Detailed breakdown by category

### Save report
```bash
npm run analyze-apk myapp.apk -- --report analysis.json
```

Creates JSON report for:
- Integration with CI/CD
- Trend analysis over time
- Programmatic processing

**Use cases:**

1. **Pre-implementation planning**
   ```bash
   npm run analyze-apk new_app.apk -- --verbose --report plan.json
   # Review missing opcodes
   # Generate shims for missing APIs
   # Estimate effort
   ```

2. **Progress tracking**
   ```bash
   # Run periodically to track opcode coverage
   npm run analyze-apk test_suite/*.apk -- --report progress_$(date +%Y%m%d).json
   ```

3. **Prioritization**
   ```bash
   # Identify most-used missing opcodes
   npm run analyze-apk large_app.apk -- --verbose | grep "Missing.*opcodes" -A 20
   ```

---

## Tool #6: trace-exec

**Purpose:** Trace bytecode execution step-by-step for debugging.

**When to use:**
- Debugging unexpected bytecode behavior
- Understanding execution flow through methods
- Verifying opcode implementations with real bytecode

**Common commands:**
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

## Tool #7: coverage-map

**Purpose:** Report opcode and shim coverage by scanning source code. Optionally analyze an APK to show the gap.

**When to use:**
- Checking overall opcode/shim implementation status
- Identifying gaps before onboarding a new APK
- Generating coverage reports for documentation

**Common commands:**
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

---

## Tool #8: validate-shims

**Purpose:** Static analysis of shim files for registration completeness and consistency.

**When to use:**
- After adding or modifying shim files
- Before committing shim changes
- As part of CI/CD validation

**Common commands:**
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
1. Registration completeness - all `register*Shim` functions are imported and called
2. Class descriptor format - all descriptors use `L...;` format
3. Unreferenced files - all shim files are imported in their index

---

## Tool #9: heap-dump

**Purpose:** Run a method then dump the heap state for inspection.

**When to use:**
- Debugging object allocation issues
- Verifying field values after execution
- Understanding memory layout of running apps

**Common commands:**
```bash
# Dump heap after running first class's main method
npm run heap-dump test/fixtures/hello_world.dex

# Dump heap after specific method
npm run heap-dump test/fixtures/hello_world.dex -- --class "Lcom/example/Test;" --method test

# Output as JSON
npm run heap-dump test/fixtures/hello_world.dex -- --json
```

**Programmatic use:**
```typescript
const heap = new Heap();
// ... run interpreter ...
const dump = heap.dump();
console.log(`Objects: ${dump.objectCount}, Strings: ${dump.stringPool.length}`);
```

---

## Tool #10: gen-fixture

**Purpose:** Generate DEX test fixtures for specific test scenarios.

**When to use:**
- Creating targeted test cases for specific opcode/shim behavior
- Building regression test fixtures
- Generating edge-case scenarios

**Common commands:**
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

## Tool #11: gen-integration-test

**Purpose:** Generate Jest integration test files for APK/DEX flows.

**When to use:**
- Scaffolding new integration tests quickly
- Testing end-to-end APK loading and execution
- Creating regression tests for specific flows

**Common commands:**
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

## Tool #12: apk-onboard

**Purpose:** Analyze an APK and produce a prioritized implementation checklist of missing opcodes and shims.

**When to use:**
- Before starting work on a new APK
- To generate implementation checklists
- To estimate effort for supporting a new app

**Common commands:**
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

---

## Tool #13: guard

**Purpose:** Run all quality checks in sequence and report pass/fail.

**When to use:**
- Before committing changes
- After any modification to verify no regressions
- As a CI/CD gate

**Common commands:**
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
✅ Tests: 568 passed, 0 failed
✅ Shims: All registered, 0 issues
✅ Opcodes: 218 registered

[CRAFT][Guard][Success] All checks passed!
```

---

## Tool #14: sync-oh

**Purpose:** Detect and fix drift between main `src/` and the OpenHarmony ArkTS copy (`src/oh/entry/src/main/ets/craft/`).

**When to use:**
- After modifying any `src/` files
- Before building the HAP
- To verify OH copy consistency

**Common commands:**
```bash
# Check sync status (read-only)
npm run sync-oh

# Auto-copy non-adapted files that are out of sync
npm run sync-oh -- --fix

# Show all files, not just problems
npm run sync-oh -- --verbose

# Machine-readable output
npm run sync-oh -- --json

# List adapted files and their adaptations
npm run sync-oh -- --list-adapted
```

**Behavior:**
- **Non-adapted files** (33 files): Byte-for-byte comparison. `--fix` copies `src` → OH.
- **Adapted files** (6 files): Checks for new exports in src that are missing from OH. No auto-fix (manual adaptation required).
- **Exit code**: 0 = all in sync, 1 = issues found.

---

## Workflow Examples

### Adding Support for a New APK

```bash
# 1. Analyze requirements
npm run analyze-apk new_app.apk -- --verbose --report analysis.json

# 2. Review recommendations
cat analysis.json | jq '.recommendations'

# 3. Implement missing opcodes (example)
npm run gen-opcode 0x32 if-eq 22t -- --category control
npm run gen-opcode 0x38 if-eqz 21t -- --category control

# 4. Implement missing Android APIs (example)
npm run gen-shim android.widget.Button -- --extends android.widget.TextView
npm run gen-shim android.view.LayoutInflater

# 5. Run component tests
npm run craft-test -- --component interpreter
npm run craft-test -- --component shim

# 6. Re-analyze to verify progress
npm run analyze-apk new_app.apk
```

### TDD Workflow for New Feature

```bash
# 1. Generate shim with tests
npm run gen-shim android.graphics.Canvas

# 2. Start watch mode
npm run craft-test -- --component shim --watch

# 3. Implement methods one by one
# 4. Tests run automatically on save
# 5. Fix until all tests pass
```

### Debugging Bytecode Issues

```bash
# 1. Dump method bytecode
npm run dex-dump problematic.dex -- --methods > bytecode.txt

# 2. Find problematic method
grep -A 50 "problematicMethod" bytecode.txt

# 3. Identify unknown/unimplemented opcodes
# 4. Generate handlers for missing opcodes
npm run gen-opcode 0xXX opcode-name format -- --category type

# 5. Test fix
npm run craft-test -- --pattern "opcode.*name"
```

---

## Integration with Development Stages

### Stage 1 (Parser) - Complete ✅
Tools used: `dex-dump`, `craft-test --component parser`

### Stage 2 (Interpreter) - Complete ✅
Tools used: `gen-opcode`, `craft-test --component interpreter`, `dex-dump --methods`, `trace-exec`

### Stage 3 (Shims) - Complete ✅
Tools used: `gen-shim`, `craft-test --component shim`, `analyze-apk`, `validate-shims`

### Stage 4 (UI Bridge) - Complete ✅
Tools used: `gen-shim`, `craft-test --component bridge`, `heap-dump`, `coverage-map`

### Stage 5 (Integration & Polish) - Complete ✅
Tools used: `analyze-apk`, `guard`, `sync-oh`, `apk-onboard`, `gen-fixture`, `gen-integration-test`

---

## Tips & Best Practices

### 1. Always analyze before implementing
```bash
npm run analyze-apk app.apk -- --verbose
```
Understand requirements before writing code.

### 2. Use watch mode during development
```bash
npm run craft-test -- --component shim --watch
```
Get immediate feedback on changes.

### 3. Generate code, don't copy-paste
```bash
npm run gen-shim android.new.Class
```
Ensures consistency and includes tests.

### 4. Review generated code
Generated code includes TODOs - always implement the logic.

### 5. Run tests before committing
```bash
npm run craft-test
npx tsc --noEmit
```

### 6. Document complex implementations
Generated docs are starting points - enhance them.

### 7. Use analyze-apk for planning
Identify priorities and estimate effort upfront.

---

## Extending Tools

To add new tools:

1. Create TypeScript tool in `tools/` directory
2. Follow naming convention: `action_target.ts`
3. Add npm script to `package.json`
4. Document in `tools/README.md`
5. Update this guide

Example template in `tools/README.md`.

---

## Troubleshooting

### Tool not found
```bash
# Verify npm script exists
npm run

# Try direct invocation
npx ts-node tools/tool_name.ts
```

### TypeScript errors
```bash
# Check compilation
npx tsc --noEmit

# Verify dependencies
npm install
```

### Generated code errors
- Review the actual API signatures in project code
- Update template code in tool implementation
- Report issues for tool improvement

---

## Future Tools (Potential)

Ideas for additional tools:

- **`perf-profile`** - Profile interpreter performance
- **`apk-build`** - Build minimal test APKs
- **`doc-gen`** - Generate API documentation

---

## Resources

- **Skill implementations:** `tools/`
- **Skill documentation:** `tools/README.md`
- **Project context:** `CLAUDE.md`
- **Architecture:** `docs/architecture.md`

---

**Note:** Tools are designed to accelerate development, not replace understanding. Always review generated code and understand what it does before integrating into the project.
