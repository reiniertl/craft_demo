# Spec A-1 — android.os.Bundle

**Class:** `android.os.Bundle`
**DEX descriptor:** `Landroid/os/Bundle;`
**Extends:** `java.lang.Object` (JL-1)
**Source:** `src/shim/android/os/bundle.ts`
**Inventory ref:** P1-5 (partial — String type only)

---

## Purpose

Typed key-value container. Passed as the `savedInstanceState` argument to
`Activity.onCreate()`. Only `String` values are required by the current demo apps;
all other types are deferred to P1-5.

---

## Class Invariants

1. The internal store maps string-valued keys to `Value` entries. Keys are compared
   by string content, not by heap ref.
2. A `Bundle` passed to `Activity.onCreate()` by the runtime MUST be non-null; its
   store MAY be empty.

---

## Internal State

| Field | Type | Initial value | Description |
|-------|------|---------------|-------------|
| `__store` | `Map<string, Value>` | `{}` | Backing key-value store. Not part of the Android API. |

---

## Constructor

### `Bundle()`
**Signature:** `()V`

Initialises `__store` to an empty map.

---

## Methods

### `putString(String key, String value)`
**Signature:** `(Ljava/lang/String;Ljava/lang/String;)V`

**Pre:** `key` is a non-null `String` heap ref.

Resolves the string value of `key`. Stores `value` under that key in `__store`,
replacing any existing entry. `value` MAY be null; null is stored as-is.

---

### `getString(String key) → String`
**Signature:** `(Ljava/lang/String;)Ljava/lang/String;`

**Pre:** `key` is a non-null `String` heap ref.

Resolves the string value of `key`. If the key is present in `__store` and its
stored value is a non-null `String` heap ref, returns that ref. If the key is absent
or its value is null, returns null.

---

### `containsKey(String key) → boolean`
**Signature:** `(Ljava/lang/String;)Z`

**Pre:** `key` is a non-null `String` heap ref.

Returns `true` iff the string value of `key` is a key in `__store`.

---

## ViewNode Property Contract

None.

## Event Callback Contract

None.
