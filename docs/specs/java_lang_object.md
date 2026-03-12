# Spec JL-1 — java.lang.Object

**Class:** `java.lang.Object`
**DEX descriptor:** `Ljava/lang/Object;`
**Extends:** — (root class)
**Source:** `src/shim/java/lang/object.ts`

---

## Purpose

Root of the Java class hierarchy. Every shimmed class implicitly extends Object.
Provides object identity, reference equality, hash code, and a default string
representation.

---

## Class Invariants

1. Every heap-allocated object has a unique positive integer reference (the *heap ref*)
   that is stable for the lifetime of the runtime session.
2. `hashCode()` MUST return the heap ref of `this` on every call.
3. `equals(o)` MUST return `true` if and only if `o` is the same heap ref as `this`.
   Subclasses (e.g. `String`) MAY override this contract.

---

## Constructor

### `Object()`
**Signature:** `()V`

No-op. Object allocation is performed by the heap allocator before the constructor
is invoked; the constructor body MUST NOT perform any further allocation.

---

## Methods

### `getClass() → Class`
**Signature:** `()Ljava/lang/Class;`

Returns a `Class` instance (JL-5) whose `__classDescriptor` field equals the DEX
type descriptor of the runtime type of `this`.

**Post:** Return value is non-null. Repeated calls on the same object return a ref
with the same descriptor.

---

### `hashCode() → int`
**Signature:** `()I`

Returns the integer heap ref of `this`.

**Post:** Return value > 0 and is identical across all invocations for the same
object within a session.

---

### `equals(Object o) → boolean`
**Signature:** `(Ljava/lang/Object;)Z`

Returns `true` iff the heap ref of `o` equals the heap ref of `this`; `false`
otherwise. A null argument MUST return `false`.

---

### `toString() → String`
**Signature:** `()Ljava/lang/String;`

Returns a new `String` of the form `"LClassName;@<hex_ref>"`, where `<hex_ref>` is
the lowercase hexadecimal representation of `hashCode()` and `ClassName` is derived
from the DEX descriptor of `this` (e.g. `Lcom/example/Foo;` → `LLcom/example/Foo;;`).

---

## ViewNode Property Contract

None. `Object` has no visual representation.

## Event Callback Contract

None.
