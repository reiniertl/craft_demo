---
name: debug-bytecode
description: Debug bytecode execution failures by combining trace-exec, heap-dump, and dex-dump for root cause analysis.
user-invocable: true
argument-hint: [path/to/file.dex or test failure description]
allowed-tools: Bash(npm run:*), Bash(npx:*), Read, Grep, Glob
---

# Debug Bytecode

Diagnose interpreter test failures or unexpected bytecode behavior using CRAFT's debugging tools.

## Steps

1. **Identify the failing test or bytecode**
   - If given a test failure, read the test file to find the DEX fixture or bytecode sequence
   - If given a DEX file, use it directly

2. **Dump the DEX structure**
   ```bash
   npm run dex-dump <file.dex> -- --all
   ```
   Review class definitions, method bytecode, and string pool.

3. **Trace execution**
   ```bash
   npm run trace-exec <file.dex> -- --registers
   ```
   Follow the PC, opcode sequence, and register state at each step.

4. **Inspect heap state** (if object-related)
   ```bash
   npm run heap-dump <file.dex>
   ```
   Check object allocations, field values, and reference chains.

5. **Cross-reference with opcode coverage**
   ```bash
   npm run coverage-map
   ```
   Verify all opcodes used by the bytecode are implemented.

6. **Root cause analysis**
   - Compare traced register values against expected Dalvik semantics
   - Check for missing or incorrect opcode implementations in `src/interpreter/opcodes.ts`
   - Check for missing shim methods in `src/shim/`
   - Verify class loader resolution in `src/interpreter/class_loader.ts`

7. **Report** the root cause and suggest a fix
