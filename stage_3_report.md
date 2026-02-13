# Stage 3 Implementation Report — Android API Shim Layer

**Project:** CRAFT (Compatible Runtime for Android on Fuchsia/Trusty)
**Stage:** 3 — Android API Shim Layer
**Date:** 2026-02-12
**Status:** Complete

---

## 1. Overview

Stage 3 adds Android framework API shims to CRAFT, enabling the interpreter to execute Android Activity bytecode. Seven Android classes are implemented as TypeScript shims, registered via the existing ShimRegistry. The ClassLoader is extended with correct superclass chains for Android classes so that `invoke-super` and virtual dispatch work correctly. All 202 tests pass (173 Stage 1+2 + 29 Stage 3) with zero TypeScript errors.

---

## 2. Deliverables Summary

| Deliverable | Status | Notes |
|-------------|--------|-------|
| android.os.Bundle shim | Done | `src/shim/android/os/bundle.ts` |
| android.content.Context shim | Done | `src/shim/android/content/context.ts` |
| android.content.ContextWrapper shim | Done | `src/shim/android/content/context.ts` |
| android.view.View shim | Done | `src/shim/android/view/view.ts` |
| android.view.ViewGroup shim | Done | `src/shim/android/view/view_group.ts` |
| android.widget.TextView shim | Done | `src/shim/android/widget/textview.ts` |
| android.app.Activity shim | Done | `src/shim/android/app/activity.ts` |
| Android registration index | Done | `src/shim/android/index.ts` |
| ClassLoader superclass chains | Done | `src/interpreter/class_loader.ts` updated |
| Unit tests | Done | 28 tests in 1 file |
| Integration tests | Done | 3 test scenarios |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Interpreter (Stage 2)                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────────┐  │
│  │  Frame   │  │  Opcode  │  │  Class Loader             │  │
│  │ Manager  │  │  Table   │  │  (+ Android superclasses) │  │
│  └──────────┘  └──────────┘  └───────────────────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────────┐  │
│  │   Heap   │  │  Method  │  │  Shim Registry            │  │
│  │          │  │ Resolver │  │  (java.lang + android.*)  │  │
│  └──────────┘  └──────────┘  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                        │
              ┌─────────┴─────────┐
              │  Shim Layer       │
              │  ┌──────────────┐ │
              │  │ java.lang.*  │ │  (Stage 2)
              │  └──────────────┘ │
              │  ┌──────────────┐ │
              │  │ android.*    │ │  (Stage 3)
              │  │  Activity    │ │
              │  │  Context     │ │
              │  │  TextView    │ │
              │  │  View        │ │
              │  │  Bundle      │ │
              │  └──────────────┘ │
              └───────────────────┘
```

### Key Design Decisions

- **Shim-only classes**: All Android classes are pure TypeScript shims, not backed by DEX bytecode. The ShimRegistry handles method dispatch.
- **Superclass chain in ClassLoader**: `loadShimClass()` now correctly sets superclass relationships (e.g., Activity → ContextWrapper → Context → Object). This enables `invoke-super` to resolve correctly.
- **Bundle storage**: Uses module-level `Map<number, Map<string, Value>>` keyed by heap reference, avoiding the need for a Java HashMap shim.
- **View state**: All view properties (text, textSize, textColor, visibility, etc.) are stored as heap fields on the object. Stage 4's UI Bridge will read these.
- **No UI Bridge**: Stage 3 stores view state only. Rendering via ArkUI is deferred to Stage 4.

---

## 4. Android Classes Implemented (7)

### android.os.Bundle (4 methods)
- `<init>()V` — Initialize empty data map
- `putString(Ljava/lang/String;Ljava/lang/String;)V` — Store string by key
- `getString(Ljava/lang/String;)Ljava/lang/String;` — Retrieve string by key
- `containsKey(Ljava/lang/String;)Z` — Check key existence

### android.content.Context (2 methods)
- `<init>()V` — No-op constructor
- `getApplicationContext()Landroid/content/Context;` — Returns self

### android.content.ContextWrapper (4 methods)
- `<init>()V` — No-arg constructor
- `<init>(Landroid/content/Context;)V` — Constructor with base context
- `getBaseContext()Landroid/content/Context;` — Returns stored base context
- `getApplicationContext()Landroid/content/Context;` — Returns self

### android.view.View (6 methods)
- `<init>(Landroid/content/Context;)V` — Constructor storing context
- `getContext()Landroid/content/Context;` — Returns stored context
- `setId(I)V` — Set view ID
- `getId()I` — Get view ID
- `setVisibility(I)V` — Set visibility
- `getVisibility()I` — Get visibility (default VISIBLE=0)

### android.view.ViewGroup (3 methods)
- `<init>(Landroid/content/Context;)V` — Constructor
- `addView(Landroid/view/View;)V` — Add child view
- `getChildCount()I` — Get child count

### android.widget.TextView (5 methods)
- `<init>(Landroid/content/Context;)V` — Constructor initializing text fields
- `setText(Ljava/lang/CharSequence;)V` — Set text content
- `getText()Ljava/lang/CharSequence;` — Get text content
- `setTextSize(F)V` — Set text size
- `setTextColor(I)V` — Set text color

### android.app.Activity (11 methods)
- `<init>()V` — Constructor initializing fields
- `onCreate(Landroid/os/Bundle;)V` — Lifecycle: create
- `onStart()V` — Lifecycle: start
- `onResume()V` — Lifecycle: resume
- `onPause()V` — Lifecycle: pause
- `onStop()V` — Lifecycle: stop
- `onDestroy()V` — Lifecycle: destroy
- `setContentView(Landroid/view/View;)V` — Set root view
- `findViewById(I)Landroid/view/View;` — Find view by ID (stub)
- `finish()V` — Finish activity
- `getIntent()Landroid/content/Intent;` — Get intent (stub)

**Total: 7 classes, 35 methods**

---

## 5. File Inventory

### New Source Files (8 files, ~320 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `src/shim/android/app/activity.ts` | 85 | Activity lifecycle and content view |
| `src/shim/android/os/bundle.ts` | 68 | Bundle key-value storage |
| `src/shim/android/content/context.ts` | 62 | Context + ContextWrapper |
| `src/shim/android/view/view.ts` | 62 | Base View class |
| `src/shim/android/widget/textview.ts` | 56 | TextView with text storage |
| `src/shim/android/view/view_group.ts` | 52 | ViewGroup child management |
| `src/shim/android/index.ts` | 17 | Registration index |

### New Test Files (2 files, ~370 lines)

| File | Lines | Tests | Scope |
|------|-------|-------|-------|
| `test/unit/shim/android_api.test.ts` | 260 | 26 | All 7 Android shim classes |
| `test/integration/android/activity_lifecycle.test.ts` | 110 | 3 | Activity lifecycle sequence |

### Modified Existing Files

| File | Change |
|------|--------|
| `src/interpreter/shim_init.ts` | Added `registerAndroidShims()` import and call |
| `src/interpreter/class_loader.ts` | Extended `isKnownBaseClass()` with 7 Android classes; added `getShimSuperClass()` for correct superclass chains |
| `CLAUDE.md` | Updated for Stage 3 |

**No Stage 1 or Stage 2 source or test files were modified** (only class_loader.ts and shim_init.ts which are wiring files).

---

## 6. Test Results

**Final Status: 208 tests passing (all stages)**

Initial implementation: 202 tests (173 existing + 29 new Stage 3 tests)
After test strengthening audit: 208 tests (173 existing + 35 new Stage 3 tests)

The audit strengthened 4 weak tests to verify actual side effects (not just return types) and added 6 new verification tests (3 registration tests + 3 ClassLoader superclass chain tests).

### Breakdown

| Category | Suites | Tests |
|----------|--------|-------|
| Stage 1 (unchanged) | 6 | 58 |
| Stage 2 Unit (unchanged) | 7 | 107 |
| Stage 2 Integration (unchanged) | 1 | 8 |
| Stage 3 Unit | 1 | 32 |
| Stage 3 Integration | 1 | 3 |
| **Total** | **22** | **208** |

### Stage 3 Unit Test Coverage

| Test Group | Tests | What It Covers |
|------------|-------|----------------|
| android.os.Bundle | 4 | Constructor, putString, getString, containsKey |
| android.content.Context | 2 | Constructor, getApplicationContext |
| android.content.ContextWrapper | 2 | Constructor with base context, no-arg constructor |
| android.view.View | 4 | Constructor, getContext, setId/getId, visibility |
| android.view.ViewGroup | 2 | Constructor, addView/getChildCount |
| android.widget.TextView | 5 | Constructor, setText/getText, setTextSize, setTextColor |
| android.app.Activity | 7 | Constructor, onCreate, setContentView, lifecycle methods, finish, findViewById, getIntent |
| Shim Registration | 3 | Unregistered method throws, classes registered, non-Android not registered |
| ClassLoader Superclasses | 3 | Activity chain, TextView chain, ViewGroup chain |
| **Total Unit Tests** | **32** | |

### Stage 3 Integration Test Scenarios

| Test | Flow | Verifies |
|------|------|----------|
| Activity + null Bundle | Create Activity → call onCreate(null) | Basic lifecycle |
| TextView + setContentView | Create Activity → new TextView → setText → setContentView | View creation and storage |
| Full Hello World | Activity.<init> → onCreate → new TextView → setText("Hello World") → setContentView | Complete Hello World bytecode sequence |

---

## 7. Metrics Summary

| Metric | Value |
|--------|-------|
| Source files created | 8 |
| Source lines written | ~320 |
| Test files created | 2 |
| Test lines written | ~450 (370 initial + 80 from audit strengthening) |
| Total new lines | ~770 |
| Android classes shimmed | 7 |
| Android methods shimmed | 35 |
| Tests passing | 208 / 208 |
| Stage 3 tests added | 35 (29 initial + 6 from audit) |
| TypeScript errors | 0 |
| Stage 1+2 regressions | 0 |

---

## 8. Dependencies for Stage 4

Stage 4 (UI Bridge & OpenHarmony Host) can begin. Stage 3 provides:
- `Activity.setContentView()` stores root view reference in `mContentView` heap field
- `TextView.setText()` stores text in `mText` heap field
- View properties accessible via `heap.getField(ref, fieldName)`
- Correct superclass chains for virtual dispatch across Android hierarchy
- All Android lifecycle methods callable via ShimRegistry
