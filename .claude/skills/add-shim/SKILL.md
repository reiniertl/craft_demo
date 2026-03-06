---
name: add-shim
description: Add a new Android API shim class with full implementation, registration, tests, and OH sync.
disable-model-invocation: true
user-invocable: true
argument-hint: [android.widget.ClassName]
allowed-tools: Bash(npm run:*), Bash(npx:*), Read, Grep, Glob, Edit, Write
---

# Add Android API Shim

Full workflow for implementing a new Android framework class as a TypeScript shim.

## Steps

1. **Generate the shim stub**
   ```bash
   npm run gen-shim $ARGUMENTS
   ```
   If you know the parent class and methods, include them:
   ```bash
   npm run gen-shim $ARGUMENTS -- --extends <parent> --method "<name>:<descriptor>:<return>"
   ```

2. **Implement the shim** in the generated file at `src/shim/android/<package>/<class>.ts`
   - Implement constructor (`<init>`) — allocate fields, register with UIBridge if a View
   - Implement each method — use `heap.setField()`/`heap.getField()` for state
   - Follow patterns from existing shims (see `src/shim/android/widget/textview.ts` for a View example, `src/shim/android/app/activity.ts` for lifecycle)

3. **Register the shim**
   - Add the `register<Class>Shim` import and call in `src/shim/android/index.ts`
   - If it's a new base class, add to `isKnownBaseClass()` in `src/interpreter/class_loader.ts`
   - Add superclass mapping in `getShimSuperClass()` in `src/interpreter/class_loader.ts`

4. **Write tests** in `test/unit/shim/<class>.test.ts`
   - Use `createShimTestContext()` from `test/helpers/shim_test_utils.ts`
   - Test constructor, each method, inheritance chain

5. **Validate**
   ```bash
   npm run validate-shims
   npm run guard
   ```

6. **Sync OH copy**
   ```bash
   npm run sync-oh -- --fix
   ```

## Reference: Android Class Hierarchy

```
java.lang.Object
├── android.os.Bundle
├── android.content.Context
│   └── android.content.ContextWrapper
│       └── android.app.Activity
└── android.view.View
    ├── android.widget.TextView
    │   └── android.widget.Button
    └── android.view.ViewGroup
        └── android.widget.LinearLayout
```
