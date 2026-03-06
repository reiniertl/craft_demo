---
name: onboard-apk
description: Onboard a new Android APK by analyzing requirements, implementing missing opcodes and shims, and running tests.
disable-model-invocation: true
user-invocable: true
argument-hint: [path/to/app.apk]
allowed-tools: Bash(npm run:*), Bash(npx:*), Read, Grep, Glob, Edit, Write
---

# APK Onboarding

Full pipeline for adding support for a new Android APK.

## Steps

1. **Analyze the APK**
   ```bash
   npm run apk-onboard $ARGUMENTS -- --generate
   ```
   Review the output to identify missing opcodes, shims, and estimated effort.

2. **Check current coverage**
   ```bash
   npm run coverage-map $ARGUMENTS
   ```

3. **Implement missing opcodes** (if any)
   For each missing opcode:
   - Use `npm run gen-opcode <hex> <name> <format> -- --category <cat>` to generate the handler stub
   - Implement the handler logic in `src/interpreter/opcodes.ts`
   - Add tests in `test/unit/interpreter/opcodes.test.ts`

4. **Implement missing shims** (if any)
   For each missing Android class:
   - Use `npm run gen-shim <class> -- --extends <parent>` to generate the shim stub
   - Implement the shim methods
   - Register in `src/shim/android/index.ts`
   - Add to ClassLoader's `isKnownBaseClass()` and `getShimSuperClass()` in `src/interpreter/class_loader.ts`
   - Write tests

5. **Run the regression guard**
   ```bash
   npm run guard
   ```

6. **Sync OH copy**
   ```bash
   npm run sync-oh -- --fix
   ```

7. **Test with the APK**
   - Generate an integration test: `npm run gen-integration-test <name> -- --fixture $ARGUMENTS --runtime`
   - Run it to verify the APK works end-to-end

8. **Report** what was added and the final test results
