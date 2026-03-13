# Spec A-4 — android.app.Activity

**Class:** `android.app.Activity`
**DEX descriptor:** `Landroid/app/Activity;`
**Extends:** `android.content.ContextWrapper` (A-3)
**Source:** `src/shim/android/app/activity.ts`
**Inventory ref:** P0-5 (partial)

---

## Purpose

Entry point for an Android application screen. App bytecode subclasses `Activity`,
overrides lifecycle methods (principally `onCreate`), builds the view hierarchy, and
calls `setContentView`. The `LifecycleBridge` (`src/bridge/lifecycle_bridge.ts`)
maps OpenHarmony UIAbility events to Activity lifecycle calls.

---

## Class Invariants

1. `Activity` is always subclassed; it is never instantiated directly.
2. `setContentView(view)` MUST be called at most once per Activity instance, from
   within `onCreate`. The behaviour of calling it more than once is undefined.
3. After `onDestroy()` returns, all UIBridge timers associated with this Activity MUST
   be cancelled.
4. `mFinished` transitions from `0` to `1` at most once (on `finish()`) and MUST NOT
   revert.

---

## Internal State

| Field | Type | Initial value | Description |
|-------|------|---------------|-------------|
| `mContentView` | heap ref \| null | `null` | Root `View` set by `setContentView`. |
| `mFinished` | `int` | `0` | `0` = running; `1` = finished. |

---

## Constructor

### `Activity()`
**Signature:** `()V`

Invokes the `ContextWrapper()` super-constructor. Sets `mContentView = null` and
`mFinished = 0`.

---

## Lifecycle Methods

All base implementations are no-ops. They MUST be registered in the shim registry so
that app subclasses may call `super.onCreate(bundle)` etc. without a dispatch error.

### `onCreate(Bundle savedInstanceState)`
**Signature:** `(Landroid/os/Bundle;)V`

Base: no-op.

The runtime MUST invoke this on the app subclass instance after construction.
`savedInstanceState` MUST be a non-null `Bundle` heap ref (store MAY be empty).

---

### `onStart()` / `onResume()` / `onPause()` / `onStop()`
**Signatures:** `()V` (each)

Base: no-op for all four.

---

### `onDestroy()`
**Signature:** `()V`

Base: calls `uiBridge.cancelAllTimers()` if a `UIBridge` is associated with this
Activity.

---

## UI Methods

### `setContentView(View view)`
**Signature:** `(Landroid/view/View;)V`

**Pre:** `view` is a non-null `View` heap ref.

1. Sets `mContentView = view`.
2. Calls `uiBridge.setRootView(view)`, triggering an initial render and incrementing
   the state version counter.

**Post:** The view tree rooted at `view` is available to the host renderer.

---

### `findViewById(int id) → View`
**Signature:** `(I)Landroid/view/View;`

**Status — stub.** Returns null unconditionally. A warning SHOULD be logged.

---

### `finish()`
**Signature:** `()V`

Sets `mFinished = 1`. The host MAY observe this flag to close the Ability.

---

### `getIntent() → Intent`
**Signature:** `()Landroid/content/Intent;`

**Status — stub.** Returns null unconditionally.

---

## Formal Specification Guide

**For LLMs writing JML and Alloy specs for this class:**

### Model variable bindings
- `_mContentView` — `heap.getField(thisRef, 'mContentView')`: object ref or null.
- `_mFinished` — `heap.getField(thisRef, 'mFinished')`: int, domain {0, 1}.

### Non-obvious invariants
- **I-AC1**: `_mFinished in {0, 1}`. Simple domain invariant; easy to express in JML.
- **I-AC2**: `_mFinished` transitions 0→1 monotonically. This is a **temporal** property — it cannot
  be expressed as a pure state invariant in JML (JML invariants are state predicates, not trace
  properties). Model it as two postconditions: `post:finish ensures _mFinished == 1`, and test
  the temporal aspect by recording the value before/after in compliance tests.
- **I-AC4** (call-once for `setContentView`): similarly temporal. Treat as an informal predicate
  in JML. The compliance test checks the postcondition for a single call; undefined behavior for
  multiple calls is not mechanically enforced.

### JML guidance
- Lifecycle methods (onCreate, onStart, etc.): `assignable \nothing`, `ensures true` — they are no-ops
  in the base class. The `requires savedInstanceState != null` on `onCreate` is the key precondition.
- `setContentView`: two postconditions — heap and UIBridge. Use informal predicates for UIBridge:
  `ensures (* uiBridge.getRootView().viewRef == view *)`.
- `finish`: do NOT use `requires _mFinished == 0`. The spec says behavior is undefined on double-call,
  but the shim idempotently sets 1 — the `requires` would make the spec stricter than the implementation.
- `onDestroy`: the timer-cancellation postcondition is best expressed as an informal predicate.

### Alloy guidance
- No Alloy model is needed for Activity. Its invariants are:
  1. Scalar domain: `_mFinished in {0,1}` — trivially modeled as `one sig` if needed.
  2. Temporal monotonicity: requires a trace model (Alloy temporal logic or explicit before/after states).
     This is disproportionate to the value; the TypeScript compliance test covers it adequately.
  3. No structural isolation invariant (Activity has no collection state like ViewGroup's children).

## LifecycleBridge — OpenHarmony UIAbility Mapping

| UIAbility event | Activity calls (in order) |
|---|---|
| `onCreate(want)` | `new SubclassActivity()` then `onCreate(Bundle.EMPTY)` |
| `onForeground()` | `onStart()` then `onResume()` |
| `onBackground()` | `onPause()` then `onStop()` |
| `onDestroy()` | `onDestroy()` |

`Bundle.EMPTY` is a `Bundle` instance with an empty `__store`. The runtime MUST NOT
pass null as `savedInstanceState`.

---

## ViewNode Property Contract

None. `Activity` is not a visual node; it sets the root via `setContentView`.

---

## Event Callback Contract

| UIAbility event | Activity method | Dispatched by |
|---|---|---|
| `onCreate` | `onCreate(Bundle)` | `LifecycleBridge.createActivity()` |
| `onForeground` | `onStart()`, `onResume()` | `LifecycleBridge.resumeActivity()` |
| `onBackground` | `onPause()`, `onStop()` | `LifecycleBridge.pauseActivity()` |
| `onDestroy` | `onDestroy()` | `LifecycleBridge.destroyActivity()` |
