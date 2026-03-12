# Spec JL-3 — java.lang.StringBuilder

**Class:** `java.lang.StringBuilder`
**DEX descriptor:** `Ljava/lang/StringBuilder;`
**Extends:** `java.lang.Object` (JL-1)
**Source:** `src/shim/java/lang/string_builder.ts`

---

## Purpose

Mutable character sequence for incremental string construction. Demo apps use it
to assemble display strings from numeric values (calculator result, clock time).
All mutating methods return `this` to support method chaining.

---

## Class Invariants

1. The internal buffer is mutable. Every mutating method MUST modify the buffer in
   place and return the same heap ref as `this`.
2. The buffer is initialised to `""` at construction.
3. `length()` MUST equal `toString().length()` at all times.

---

## Internal State

| Field | Type | Initial value | Description |
|-------|------|---------------|-------------|
| `__builderValue` | `string` | `""` | Host-language string holding the accumulated content. Not part of the Android API. |

---

## Constructors

### `StringBuilder()`
**Signature:** `()V`

Sets `__builderValue` to `""`.

### `StringBuilder(String s)`
**Signature:** `(Ljava/lang/String;)V`

**Pre:** `s` is a non-null `String` heap ref.

Sets `__builderValue` to the string value of `s`.

---

## Methods

### `append(String s) → StringBuilder`
**Signature:** `(Ljava/lang/String;)Ljava/lang/StringBuilder;`

**Pre:** `s` is a non-null `String` heap ref.

Appends the string value of `s` to `__builderValue`. Returns `this`.

---

### `append(int i) → StringBuilder`
**Signature:** `(I)Ljava/lang/StringBuilder;`

Converts `i` to its decimal string representation and appends it to
`__builderValue`. Returns `this`.

---

### `append(long l) → StringBuilder`
**Signature:** `(J)Ljava/lang/StringBuilder;`

Converts `l` to its decimal string representation and appends it to
`__builderValue`. Returns `this`.

---

### `append(Object o) → StringBuilder`
**Signature:** `(Ljava/lang/Object;)Ljava/lang/StringBuilder;`

If `o` is null, appends the literal string `"null"`. Otherwise invokes `o.toString()`
via the interpreter and appends the resulting string value. Returns `this`.

---

### `toString() → String`
**Signature:** `()Ljava/lang/String;`

Returns a new `String` heap object whose value equals `__builderValue`.

**Post:** The returned object is a distinct heap ref from `this`.

---

### `length() → int`
**Signature:** `()I`

Returns the number of UTF-16 code units in `__builderValue`.

**Post:** Return value ≥ 0.

---

## ViewNode Property Contract

None.

## Event Callback Contract

None.
