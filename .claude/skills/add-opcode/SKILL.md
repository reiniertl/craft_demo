---
name: add-opcode
description: Add a new Dalvik opcode handler with implementation, tests, and verification.
disable-model-invocation: true
user-invocable: true
argument-hint: [0xNN opcode-name format]
allowed-tools: Bash(npm run:*), Bash(npx:*), Read, Grep, Glob, Edit, Write
---

# Add Dalvik Opcode

Full workflow for implementing a new Dalvik bytecode opcode handler.

## Steps

1. **Generate the opcode stub**
   ```bash
   npm run gen-opcode $ARGUMENTS
   ```

2. **Implement the handler** in `src/interpreter/opcodes.ts`
   - Find the `table.register(0xNN, ...)` call
   - Implement the handler logic following the Dalvik bytecode spec
   - Use `ctx.frame.registers` for register access
   - Advance PC: `ctx.frame.pc += width` (width depends on format)
   - Reference: https://source.android.com/devices/tech/dalvik/dalvik-bytecode

3. **Add tests** in `test/unit/interpreter/opcodes.test.ts` or `test/unit/interpreter/remaining_opcodes.test.ts`
   - Create a minimal bytecode sequence that exercises the opcode
   - Test edge cases (zero values, negative numbers, wide types, etc.)

4. **Verify with real bytecode** (optional)
   ```bash
   npm run trace-exec test/fixtures/hello_world.dex -- --registers
   ```

5. **Run the guard**
   ```bash
   npm run guard
   ```

## Opcode Format Reference

| Format | Encoding | Example |
|--------|----------|---------|
| 10x | op | nop |
| 12x | op vA, vB (4-bit regs) | move |
| 11n | op vA, #+B (4-bit literal) | const/4 |
| 21s | op vAA, #+BBBB (16-bit literal) | const/16 |
| 21c | op vAA, type/field@BBBB | check-cast |
| 22t | op vA, vB, +CCCC (branch offset) | if-eq |
| 23x | op vAA, vBB, vCC | cmp-long |
| 35c | op {vC..vG}, meth@BBBB | invoke-virtual |
| 3rc | op {vCCCC..vNNNN}, meth@BBBB | invoke-virtual/range |
