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

## ViewNode Property Contract

None.

## Event Callback Contract

None.
