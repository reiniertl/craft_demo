# Spec A-3 — android.content.ContextWrapper

**Class:** `android.content.ContextWrapper`
**DEX descriptor:** `Landroid/content/ContextWrapper;`
**Extends:** `android.content.Context` (A-2)
**Source:** `src/shim/android/content/context.ts`
**Inventory ref:** P0-5 (partial)

---

## Purpose

Concrete `Context` subclass that holds a reference to a wrapped base context.
`Activity` (A-4) extends `ContextWrapper`. The wrapper exists to satisfy the class
hierarchy; no delegation beyond `getBaseContext` is required by the current demo apps.

---

## Class Invariants

1. `mBase` is set exactly once in the constructor and is immutable thereafter.
2. When the no-arg constructor is used (as in the `Activity` super-chain), `mBase` is
   null. Callers MUST NOT invoke `getBaseContext()` on such an instance.

---

## Internal State

| Field | Type | Initial value | Description |
|-------|------|---------------|-------------|
| `mBase` | heap ref \| null | see constructors | The wrapped base `Context`. |

---

## Constructors

### `ContextWrapper()`
**Signature:** `()V`

Sets `mBase` to null. Used exclusively as the `Activity` super-chain constructor
when no explicit base context is provided.

### `ContextWrapper(Context base)`
**Signature:** `(Landroid/content/Context;)V`

**Pre:** `base` is a non-null `Context` heap ref.

Sets `mBase` to `base`.

---

## Methods

### `getBaseContext() → Context`
**Signature:** `()Landroid/content/Context;`

**Pre:** `mBase` is non-null.

Returns `mBase`.

---

### `getApplicationContext() → Context`
**Signature:** `()Landroid/content/Context;`

Returns `this`. Overrides `Context.getApplicationContext()`.

**Post:** Return value is non-null.

---

## ViewNode Property Contract

None.

## Event Callback Contract

None.
