# Spec A-2 — android.content.Context

**Class:** `android.content.Context`
**DEX descriptor:** `Landroid/content/Context;`
**Extends:** `java.lang.Object` (JL-1)
**Source:** `src/shim/android/content/context.ts`
**Inventory ref:** P0-5 (partial)

---

## Purpose

Abstract base class for Android environment access. `Context` is never instantiated
directly; it anchors the class hierarchy for `ContextWrapper` (A-3) and `Activity`
(A-4). View constructors accept a `Context` parameter and store it for later use.

---

## Class Invariants

1. `Context` is abstract. No app-bytecode constructor targets this class directly; all
   instantiation goes through a concrete subclass.
2. `getApplicationContext()` MUST return a non-null `Context` ref for any concrete
   subclass instance.

---

## Constructor

### `Context()`
**Signature:** `()V`

No-op. Invoked only as part of a subclass constructor super-chain.

---

## Methods

### `getApplicationContext() → Context`
**Signature:** `()Landroid/content/Context;`

Returns `this`. Concrete subclasses MAY override this if they wrap a separate
application context; returning `this` is correct for all current subclasses.

**Post:** Return value is non-null.

---

## Formal Specification Guide

**For LLMs writing JML and Alloy specs for this class (covers A-2 Context and A-3 ContextWrapper):**

### Model variable bindings
- **Context (A-2)**: no heap model variables — the shim stores no state.
- **ContextWrapper (A-3)**: `_mBase` — `heap.getField(thisRef, 'mBase')`: object ref (the wrapped Context).
  Note: the no-arg constructor used in the Activity super-chain does NOT set `_mBase`. Do NOT write
  `invariant _mBase != null` — it would be violated by `Activity()` which uses the no-arg path.

### Non-obvious invariants
- **I-C2**: `getApplicationContext()` returns non-null. The base Context returns `this`, which is
  always non-null. ContextWrapper also returns `this`. This is the key safety contract.
- **No `_mBase != null` invariant**: only the Context-arg constructor sets `_mBase`. The no-arg
  constructor (used by Activity) leaves it unset. Write a postcondition on the Context-arg constructor
  (`ensures _mBase == context`) but not a class invariant.
- **ContextWrapper.getBaseContext()**: may return null if the no-arg constructor was used. This is
  intentional — Activity never calls `getBaseContext()`, so it's not a bug.

### JML guidance
- Context is `abstract` — mark it with a `// Context is abstract` comment. JML's `abstract` keyword
  applies to methods; mark the class abstractness informally.
- Two constructors for ContextWrapper: no-arg (no postcondition beyond `ensures true`) and
  Context-arg (`requires context != null; ensures _mBase == context`).
- `getApplicationContext()`: `ensures \result != null; ensures (* \result == this *)` — the informal
  predicate captures "returns this" which isn't a JML first-class concept.

### Alloy guidance
- No Alloy model needed. Context/ContextWrapper have no collection state, no isolation invariants,
  and no ordering constraints. All contracts are expressible in JML.

## ViewNode Property Contract

None.

## Event Callback Contract

None.
