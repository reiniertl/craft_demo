# Spec JL-2 — java.lang.String

**Class:** `java.lang.String`
**DEX descriptor:** `Ljava/lang/String;`
**Extends:** `java.lang.Object` (JL-1)
**Source:** `src/shim/java/lang/string.ts`

---

## Purpose

Immutable UTF-16 character sequence. Used for all text content, resource keys, and
string literals emitted by the DEX bytecode. The shim wraps a host-language string
value and exposes the Java String API.

---

## Class Invariants

1. The underlying string value is immutable after construction. No method modifies it
   in place; every method that produces a derived string MUST return a new heap-
   allocated `String` object.
2. `equals(o)` MUST compare by value (character content), not by heap ref. This
   overrides `Object.equals`.
3. `hashCode()` MUST implement the Java polynomial hash:
   `h = s[0]×31^(n-1) + s[1]×31^(n-2) + … + s[n-1]`, computed as a signed 32-bit
   integer (modulo 2³²).
4. `toString()` MUST return `this` (same heap ref, not a copy).

---

## Constructors

### `String()`
**Signature:** `()V`

Initialises the internal value to `""` (empty string).

### `String(String s)`
**Signature:** `(Ljava/lang/String;)V`

**Pre:** `s` is a non-null `String` heap ref.

Initialises the internal value to the content of `s`. The result is a distinct heap
ref with identical content.

---

## Methods

### `length() → int`
**Signature:** `()I`

Returns the number of UTF-16 code units in the string value.

**Post:** Return value ≥ 0.

---

### `charAt(int index) → char`
**Signature:** `(I)C`

**Pre:** `0 ≤ index < length()`.

Returns the UTF-16 code unit at position `index`.

**Error:** If the precondition is violated the shim MUST return `0` and log a warning
(graceful degradation per inventory §7.7).

---

### `equals(Object o) → boolean`
**Signature:** `(Ljava/lang/Object;)Z`

Returns `true` iff `o` is a `String` heap ref with identical character content.
Returns `false` if `o` is null or not a `String`.

---

### `hashCode() → int`
**Signature:** `()I`

Returns the Java polynomial hash (see invariant 3).

---

### `toString() → String`
**Signature:** `()Ljava/lang/String;`

Returns `this` — the same heap ref, not a copy.

---

### `substring(int start) → String`
**Signature:** `(I)Ljava/lang/String;`

**Pre:** `0 ≤ start ≤ length()`.

Returns a new `String` containing characters `[start, length())`.
If `start == length()` the result is `""`.

---

### `substring(int start, int end) → String`
**Signature:** `(II)Ljava/lang/String;`

**Pre:** `0 ≤ start ≤ end ≤ length()`.

Returns a new `String` containing characters `[start, end)`.

---

### `concat(String other) → String`
**Signature:** `(Ljava/lang/String;)Ljava/lang/String;`

**Pre:** `other` is non-null.

Returns a new `String` whose value is the content of `this` followed by the content
of `other`.

---

### `valueOf(int i) → String` *(static)*
**Signature:** `(I)Ljava/lang/String;`

Returns a new `String` containing the decimal representation of `i` (no leading
zeros except for the value `0`).

---

### `valueOf(long l) → String` *(static)*
**Signature:** `(J)Ljava/lang/String;`

Returns a new `String` containing the decimal representation of `l`.

---

### `valueOf(Object o) → String` *(static)*
**Signature:** `(Ljava/lang/Object;)Ljava/lang/String;`

If `o` is null, returns the string `"null"`. Otherwise returns the result of
invoking `o.toString()` via the interpreter.

---

## ViewNode Property Contract

None. `String` is a data value; the receiving shim (e.g. `TextView`) owns the
ViewNode key.

## Event Callback Contract

None.
