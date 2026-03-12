# Spec JL-4 — java.lang.System

**Class:** `java.lang.System`
**DEX descriptor:** `Ljava/lang/System;`
**Extends:** `java.lang.Object` (JL-1)
**Source:** `src/shim/java/lang/system.ts`

---

## Purpose

Provides static system-level utilities. The clock demo depends on `currentTimeMillis()`
to read wall-clock time. All methods are static; the class is never instantiated.

---

## Class Invariants

1. All methods are static. The shim MUST NOT require a `this` argument.
2. `currentTimeMillis()` MUST return a non-decreasing value across successive calls
   within a session (real time must advance between calls for the values to differ).

---

## Methods

### `currentTimeMillis() → long` *(static)*
**Signature:** `()J`

Returns the current wall-clock time as milliseconds elapsed since the Unix epoch
(1970-01-01T00:00:00.000Z). Delegates to the host platform's `Date.now()` or
equivalent.

**Post:** Return value > 0.

---

### `identityHashCode(Object o) → int` *(static)*
**Signature:** `(Ljava/lang/Object;)I`

Returns the heap ref of `o` — identical to what `Object.hashCode()` (JL-1) returns
for the same object. Returns `0` if `o` is null.

---

### `arraycopy(Object src, int srcPos, Object dst, int dstPos, int length)` *(static)*
**Signature:** `(Ljava/lang/Object;ILjava/lang/Object;II)V`

**Pre:**
- `src` and `dst` are heap refs to array objects of compatible element type.
- `srcPos ≥ 0`, `dstPos ≥ 0`, `length ≥ 0`.
- `srcPos + length ≤ src.length`.
- `dstPos + length ≤ dst.length`.

Copies `length` elements from `src[srcPos]` into `dst[dstPos]`. The copy is shallow.
Overlapping ranges within the same array MUST be handled correctly (copy direction
chosen to avoid clobber).

**Error:** If any precondition is violated the shim MUST log a warning and return
without modifying `dst` (graceful degradation per inventory §7.7).

---

## ViewNode Property Contract

None.

## Event Callback Contract

None.
