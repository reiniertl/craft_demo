# Spec JL-5 — java.lang.Class

**Class:** `java.lang.Class`
**DEX descriptor:** `Ljava/lang/Class;`
**Extends:** `java.lang.Object` (JL-1)
**Source:** `src/shim/java/lang/class.ts`

---

## Purpose

Minimal reflection support. `Class` objects are returned by `Object.getClass()` and
used for class-name-based dispatch and logging. Full reflection (field/method
introspection) is out of scope.

---

## Class Invariants

1. A `Class` object is always constructed with `__classDescriptor` set to a valid DEX
   type descriptor (e.g. `Lcom/example/Foo;`). The field is immutable after
   construction.
2. `Class` objects are produced exclusively by `Object.getClass()` (JL-1); app
   bytecode MUST NOT construct them directly.
3. `getName()` and `getSimpleName()` MUST be derived from `__classDescriptor` alone.

---

## Internal State

| Field | Type | Description |
|-------|------|-------------|
| `__classDescriptor` | `string` | DEX type descriptor, e.g. `Lcom/example/Foo;`. Immutable. |

---

## Methods

### `getName() → String`
**Signature:** `()Ljava/lang/String;`

Derives the fully qualified binary name from `__classDescriptor` by:
1. Stripping the leading `L` and trailing `;`.
2. Replacing every `/` with `.`.

**Example:** `Lcom/example/Foo;` → `"com.example.Foo"`.

**Post:** Return value is non-null and non-empty.

---

### `getSimpleName() → String`
**Signature:** `()Ljava/lang/String;`

Returns the substring of `getName()` after the last `.`. If `getName()` contains no
`.`, returns `getName()` unchanged.

**Example:** `"com.example.Foo"` → `"Foo"`.

**Post:** Return value is non-null and non-empty.

---

### `toString() → String`
**Signature:** `()Ljava/lang/String;`

Returns the string `"class " + getName()`.

**Example:** `"class com.example.Foo"`.

---

## ViewNode Property Contract

None.

## Event Callback Contract

None.
