# Stage 3: Android API Shim Layer - Implementation Plan

## Overview

**Goal:** Provide minimal Android API surface so that a Hello World Activity's bytecode can execute through the interpreter.

**Prerequisites:** Stage 2 complete (interpreter/*, shim/java/lang/* implemented and tested, 173 tests passing)

**Scope:** Android framework shim classes only. UI Bridge (Stage 4) and OpenHarmony host integration (Stage 4) are NOT in scope. The shim layer stores view state internally; rendering is deferred to Stage 4.

---

## 1. Class Hierarchy

The Hello World app requires this Android class hierarchy:

```
java.lang.Object                          (Stage 2 - exists)
├── android.os.Bundle                     (Stage 3)
├── android.content.Context               (Stage 3 - abstract base)
│     └── android.content.ContextWrapper  (Stage 3)
│           └── android.app.Activity      (Stage 3 - lifecycle + setContentView)
└── android.view.View                     (Stage 3 - base view)
      ├── android.widget.TextView         (Stage 3 - setText/getText)
      └── android.view.ViewGroup          (Stage 3 - container stub)
```

### Superclass Relationships (critical for invoke-super)

| Class | Superclass |
|-------|-----------|
| `Landroid/os/Bundle;` | `Ljava/lang/Object;` |
| `Landroid/content/Context;` | `Ljava/lang/Object;` |
| `Landroid/content/ContextWrapper;` | `Landroid/content/Context;` |
| `Landroid/app/Activity;` | `Landroid/content/ContextWrapper;` |
| `Landroid/view/View;` | `Ljava/lang/Object;` |
| `Landroid/view/ViewGroup;` | `Landroid/view/View;` |
| `Landroid/widget/TextView;` | `Landroid/view/View;` |

---

## 2. Deliverables

### 2.1 New Source Files

| File | Purpose |
|------|---------|
| `src/shim/android/os/bundle.ts` | android.os.Bundle shim |
| `src/shim/android/content/context.ts` | android.content.Context + ContextWrapper shim |
| `src/shim/android/view/view.ts` | android.view.View base shim |
| `src/shim/android/view/view_group.ts` | android.view.ViewGroup stub |
| `src/shim/android/widget/textview.ts` | android.widget.TextView shim |
| `src/shim/android/app/activity.ts` | android.app.Activity shim |
| `src/shim/android/index.ts` | Android shim registration index |

### 2.2 New Test Files

| File | Purpose |
|------|---------|
| `test/unit/shim/android_api.test.ts` | Unit tests for all Android shim classes |
| `test/integration/android/activity_lifecycle.test.ts` | End-to-end Activity lifecycle test |

### 2.3 Modified Existing Files

| File | Change |
|------|--------|
| `src/interpreter/shim_init.ts` | Add `registerAndroidShims()` call |
| `src/interpreter/class_loader.ts` | Extend `isKnownBaseClass()` + `loadShimClass()` for superclass chains |
| `src/index.ts` | Export new Stage 3 types |
| `CLAUDE.md` | Update for Stage 3 |

---

## 3. Shim Implementations

### 3.1 android.os.Bundle (`src/shim/android/os/bundle.ts`)

Minimal key-value container. Uses a `Map<string, Value>` stored as a hidden field on the heap object.

**Methods:**

| Method | Descriptor | Implementation |
|--------|-----------|----------------|
| `<init>()V` | Constructor | Initialize empty data map |
| `putString(Ljava/lang/String;Ljava/lang/String;)V` | Store string by key | Extract key string, store value ref |
| `getString(Ljava/lang/String;)Ljava/lang/String;` | Retrieve string by key | Look up by key, return ref or null |
| `containsKey(Ljava/lang/String;)Z` | Check key existence | Return 1/0 |

**Storage approach:** Bundle data is stored as a native TypeScript `Map<string, Value>` referenced by a hidden field `__bundleData` on the heap object.

### 3.2 android.content.Context (`src/shim/android/content/context.ts`)

Abstract base class. Provides minimal context methods. ContextWrapper delegates to a wrapped Context.

**Context methods:**

| Method | Descriptor | Implementation |
|--------|-----------|----------------|
| `<init>()V` | Constructor | No-op |
| `getApplicationContext()Landroid/content/Context;` | Get app context | Return self |

**ContextWrapper methods:**

| Method | Descriptor | Implementation |
|--------|-----------|----------------|
| `<init>(Landroid/content/Context;)V` | Constructor with base context | Store base context ref |
| `<init>()V` | No-arg constructor | No-op (for Activity super call) |
| `getBaseContext()Landroid/content/Context;` | Get wrapped context | Return stored ref |

### 3.3 android.view.View (`src/shim/android/view/view.ts`)

Base class for all UI components. Stores minimal view state.

**Methods:**

| Method | Descriptor | Implementation |
|--------|-----------|----------------|
| `<init>(Landroid/content/Context;)V` | Constructor | Store context ref, assign view ID |
| `getContext()Landroid/content/Context;` | Get context | Return stored context ref |
| `setId(I)V` | Set view ID | Store in field |
| `getId()I` | Get view ID | Return from field |
| `setVisibility(I)V` | Set visibility | Store in field |
| `getVisibility()I` | Get visibility | Return from field (default VISIBLE=0) |

### 3.4 android.view.ViewGroup (`src/shim/android/view/view_group.ts`)

Container stub for future use. Minimal implementation for now.

**Methods:**

| Method | Descriptor | Implementation |
|--------|-----------|----------------|
| `<init>(Landroid/content/Context;)V` | Constructor | Call View.<init> |
| `addView(Landroid/view/View;)V` | Add child view | Store child ref in list |
| `getChildCount()I` | Get child count | Return list size |

### 3.5 android.widget.TextView (`src/shim/android/widget/textview.ts`)

The critical UI component for Hello World. Stores text content.

**Methods:**

| Method | Descriptor | Implementation |
|--------|-----------|----------------|
| `<init>(Landroid/content/Context;)V` | Constructor | Call View.<init>, init empty text |
| `setText(Ljava/lang/CharSequence;)V` | Set text content | Store string ref in `mText` field |
| `getText()Ljava/lang/CharSequence;` | Get text content | Return `mText` field |
| `setTextSize(F)V` | Set text size | Store float in field |
| `setTextColor(I)V` | Set text color | Store int in field |

### 3.6 android.app.Activity (`src/shim/android/app/activity.ts`)

The main lifecycle class. Manages the Activity lifecycle and content view.

**Methods:**

| Method | Descriptor | Implementation |
|--------|-----------|----------------|
| `<init>()V` | Constructor | Call ContextWrapper.<init>, init fields |
| `onCreate(Landroid/os/Bundle;)V` | Lifecycle: create | No-op base (subclass overrides call super) |
| `onStart()V` | Lifecycle: start | No-op base |
| `onResume()V` | Lifecycle: resume | No-op base |
| `onPause()V` | Lifecycle: pause | No-op base |
| `onStop()V` | Lifecycle: stop | No-op base |
| `onDestroy()V` | Lifecycle: destroy | No-op base |
| `setContentView(Landroid/view/View;)V` | Set root view | Store view ref in `mContentView` |
| `findViewById(I)Landroid/view/View;` | Find view by ID | Search stored views (stub: return null) |
| `finish()V` | Finish activity | Set `mFinished` flag |
| `getIntent()Landroid/content/Intent;` | Get intent | Return null (stub) |

---

## 4. ClassLoader Updates

### 4.1 Known Base Classes

Extend `isKnownBaseClass()` in `class_loader.ts` to include all Android shim classes:

```typescript
private isKnownBaseClass(descriptor: string): boolean {
  const known = [
    // Stage 2 - java.lang
    'Ljava/lang/Object;',
    'Ljava/lang/String;',
    'Ljava/lang/StringBuilder;',
    'Ljava/lang/Class;',
    'Ljava/lang/System;',
    // Stage 3 - android.*
    'Landroid/os/Bundle;',
    'Landroid/content/Context;',
    'Landroid/content/ContextWrapper;',
    'Landroid/app/Activity;',
    'Landroid/view/View;',
    'Landroid/view/ViewGroup;',
    'Landroid/widget/TextView;',
  ];
  return known.includes(descriptor);
}
```

### 4.2 Superclass Chain for Shim Classes

Update `loadShimClass()` to correctly set superclass for Android classes:

```typescript
private getShimSuperClass(descriptor: string): string | null {
  const superMap: Record<string, string> = {
    'Ljava/lang/Object;': null,
    'Landroid/os/Bundle;': 'Ljava/lang/Object;',
    'Landroid/content/Context;': 'Ljava/lang/Object;',
    'Landroid/content/ContextWrapper;': 'Landroid/content/Context;',
    'Landroid/app/Activity;': 'Landroid/content/ContextWrapper;',
    'Landroid/view/View;': 'Ljava/lang/Object;',
    'Landroid/view/ViewGroup;': 'Landroid/view/View;',
    'Landroid/widget/TextView;': 'Landroid/view/View;',
  };
  if (descriptor in superMap) {
    return superMap[descriptor] ?? null;
  }
  return descriptor === 'Ljava/lang/Object;' ? null : 'Ljava/lang/Object;';
}
```

This is critical for `invoke-super` to work correctly when a DEX-defined `MainActivity` extends `Activity` and calls `super.onCreate()`.

---

## 5. Registration

### 5.1 Android Index (`src/shim/android/index.ts`)

```typescript
import { ShimRegistry } from '../../interpreter/shim_registry';
import { registerBundleShim } from './os/bundle';
import { registerContextShim, registerContextWrapperShim } from './content/context';
import { registerViewShim } from './view/view';
import { registerViewGroupShim } from './view/view_group';
import { registerTextViewShim } from './widget/textview';
import { registerActivityShim } from './app/activity';

export function registerAndroidShims(registry: ShimRegistry): void {
  registerBundleShim(registry);
  registerContextShim(registry);
  registerContextWrapperShim(registry);
  registerViewShim(registry);
  registerViewGroupShim(registry);
  registerTextViewShim(registry);
  registerActivityShim(registry);
}
```

### 5.2 Updated shim_init.ts

```typescript
import { ShimRegistry } from './shim_registry';
import { registerJavaLangShims } from '../shim/java/lang/index';
import { registerAndroidShims } from '../shim/android/index';

export function initializeShimRegistry(): ShimRegistry {
  const registry = new ShimRegistry();
  registerJavaLangShims(registry);
  registerAndroidShims(registry);
  return registry;
}
```

---

## 6. Testing Strategy

### 6.1 Unit Tests (`test/unit/shim/android_api.test.ts`)

```
describe('android.os.Bundle')
  ├── constructor creates empty bundle
  ├── putString stores value
  ├── getString retrieves stored value
  ├── getString returns null for missing key
  └── containsKey returns correct boolean

describe('android.content.Context')
  ├── constructor succeeds
  └── getApplicationContext returns self

describe('android.content.ContextWrapper')
  ├── constructor stores base context
  └── getBaseContext returns stored context

describe('android.view.View')
  ├── constructor stores context
  ├── getContext returns stored context
  ├── setId/getId round-trips
  └── visibility defaults to VISIBLE

describe('android.view.ViewGroup')
  ├── constructor works
  ├── addView increases child count
  └── getChildCount returns correct value

describe('android.widget.TextView')
  ├── constructor initializes empty text
  ├── setText stores text
  ├── getText returns stored text
  └── setTextSize stores size

describe('android.app.Activity')
  ├── constructor succeeds
  ├── onCreate is callable
  ├── setContentView stores view reference
  ├── lifecycle methods are callable (onStart, onResume, onPause, onStop, onDestroy)
  └── finish sets finished flag
```

### 6.2 Integration Tests (`test/integration/android/activity_lifecycle.test.ts`)

```
describe('Activity lifecycle integration')
  ├── creates Activity, calls onCreate with null Bundle
  ├── creates TextView, sets text, calls setContentView
  └── full Hello World sequence: Activity.onCreate → new TextView → setText → setContentView
```

---

## 7. Implementation Order

### Phase 1: Foundation Classes (Bundle, Context)
1. `src/shim/android/os/bundle.ts`
2. `src/shim/android/content/context.ts` (Context + ContextWrapper)

### Phase 2: View Hierarchy
3. `src/shim/android/view/view.ts`
4. `src/shim/android/view/view_group.ts`
5. `src/shim/android/widget/textview.ts`

### Phase 3: Activity
6. `src/shim/android/app/activity.ts`

### Phase 4: Registration & Wiring
7. `src/shim/android/index.ts`
8. Update `src/interpreter/shim_init.ts`
9. Update `src/interpreter/class_loader.ts` (known classes + superclass chains)
10. Update `src/index.ts` (exports)

### Phase 5: Tests
11. `test/unit/shim/android_api.test.ts`
12. `test/integration/android/activity_lifecycle.test.ts`

### Phase 6: Documentation
13. Update `CLAUDE.md`
14. Write `stage_3_report.md`

---

## 8. Design Decisions

### 8.1 No UI Bridge in Stage 3
Stage 3 focuses purely on the shim layer. `setContentView()` stores the view reference but does NOT notify any UI bridge. Stage 4 will add the UIBridge, StateManager, and ArkUI rendering.

### 8.2 Bundle uses hidden TypeScript Map
Rather than simulating a Java HashMap on the heap, Bundle stores data in a hidden TypeScript `Map<string, Value>` accessible via a module-level WeakMap keyed by heap reference. This is simpler and avoids needing HashMap shims.

### 8.3 View identification
Each View gets a monotonically increasing internal ID (separate from the Android `setId()` ID) for tracking. This will be used by the UI bridge in Stage 4.

### 8.4 Superclass chain correctness
The `loadShimClass()` method must correctly encode superclass relationships. Without this, `invoke-super` from `MainActivity.onCreate()` to `Activity.onCreate()` will fail because the class loader won't know that `Activity` extends `ContextWrapper` extends `Context` extends `Object`.

---

## 9. Dependencies

### From Stage 2
- `ShimRegistry` - registration and dispatch
- `Heap` - object allocation, field storage, string interning
- `InterpreterRef` - for callback into interpreter (e.g., toString calls)
- `Value`, `NULL_VALUE`, `intValue`, `objectRef` - value constructors
- `ResolvedMethod` - for makeMethod in tests

### Provided to Stage 4
Stage 4 (UI Bridge) will depend on:
- `Activity.setContentView()` storing the root view reference
- `TextView.setText()` storing text content
- `View` field storage for properties (text, textSize, textColor, visibility)
- All shim classes properly registered in ShimRegistry

---

## 10. Exit Criteria

Stage 3 is complete when:
1. All 7 Android shim classes are implemented
2. All shim methods listed in Section 3 are functional
3. ClassLoader correctly resolves superclass chains for shim classes
4. All new unit tests pass
5. All new integration tests pass
6. All existing 173 Stage 1+2 tests still pass (zero regressions)
7. `npx tsc --noEmit` reports zero errors

### Target Test Count
- Stage 1: 58 tests (unchanged)
- Stage 2: 115 tests (unchanged)
- Stage 3 Unit: ~25 tests
- Stage 3 Integration: ~3 tests
- **Total: ~199 tests**
