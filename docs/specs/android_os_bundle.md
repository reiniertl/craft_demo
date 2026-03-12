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

## Formal Specification Guide

> Structured annotation for LLMs writing `android_os_bundle.jml` or
> `bundle_isolation.als`.

**JML model variable bindings:**
- `_store(k)` → `heap.getField(thisRef, '__bundle_' + k)` (the Value)
- `_exists(k)` → `heap.getField(thisRef, '__bundleExists_' + k).value == 1`

The implementation encodes the logical `_store` map as heap fields with name
prefixes `__bundle_<key>` and `__bundleExists_<key>`. The JML model fields
abstract over this encoding.

**I-B4 (isolation) cannot be expressed in standard JML** — it requires reasoning
about other object instances. Use an informal predicate `(*  *)` in the JML file
and encode the structural check in `bundle_isolation.als` using Alloy's relational
model. The TypeScript contract `BundleContracts.invariantIsolation()` provides a
runtime test that would catch the pre-fix singleton bug.

**putString frame condition** is critical: the `assignable` clause must name only
the specific `_store(key)` and `_exists` entries that change. If the JML uses
`assignable _store` (the whole map), it cannot detect mutations to unrelated keys.
Use `assignable _store[heap.getStringValue(key.ref)], _exists` instead, or the
informal equivalent.

**Alloy guidance for `bundle_isolation.als`:**
- Model `Bundle` as a sig with `store : Key ->lone Val` and `exists : set Key`.
- The `ExistsDomainConsistency` check verifies I-B3 (`exists == store.Key`).
- The buggy model uses `BuggyBundle` with a `sharedStore : one SingletonStore`
  that multiple instances point to. The `SharedStoreCausesLeak` assert proves
  that shared stores guarantee cross-instance visibility — which IS the bug.
- All `check` commands should find no counterexamples except for the intentional
  bug-demonstration asserts.

## ViewNode Property Contract

None.

## Event Callback Contract

None.
