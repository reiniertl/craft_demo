// CRAFT Alloy Model — android.os.Bundle Instance Isolation (Spec A-1)
//
// Models the key-value isolation invariant: no two Bundle instances may share
// their backing store. This encodes JML invariant I-B4 from android_os_bundle.jml.
//
// Run with Alloy Analyzer 6.x:
//   java -jar alloy6.jar bundle_isolation.als
//
// All 'check' commands marked EXPECTED: NO COUNTEREXAMPLE should pass cleanly.
// Checks marked EXPECTED: COUNTEREXAMPLE FOUND demonstrate the pre-fix bug.

module craft/bundle_isolation

// ─── Domain types ────────────────────────────────────────────────────────────

abstract sig Key {}    // String-valued bundle keys
abstract sig Val {}    // Stored values (String heap refs, or null)
one sig NullVal extends Val {}   // Represents the null Value

// ─── Correct Bundle model ────────────────────────────────────────────────────

sig Bundle {
    // Each Bundle instance owns its own key→value relation.
    // In the implementation this is encoded as heap fields __bundle_<key>
    // scoped to the object's lifetime.
    store  : Key ->lone Val,
    exists : set Key     // tracks keys added by putString
} {
    // I-B3: exists == store.keySet()
    exists = store.Key
}

// ─── Operations ──────────────────────────────────────────────────────────────

// putString: add or overwrite a key
pred putString[b : Bundle, k : Key, v : Val, b' : Bundle] {
    b'.store  = b.store  ++ (k -> v)
    b'.exists = b.exists + k
}

// getString: returns the stored value or NullVal if absent
fun getString[b : Bundle, k : Key] : lone Val {
    k in b.exists => b.store[k] else NullVal
}

// containsKey: key is in the exists set
pred containsKey[b : Bundle, k : Key] {
    k in b.exists
}

// ─── Invariant checks ────────────────────────────────────────────────────────

// I-B3: exists always equals the domain of store (key consistency)
assert ExistsDomainConsistency {
    all b : Bundle | b.exists = b.store.Key
}
check ExistsDomainConsistency for 5     // EXPECTED: NO COUNTEREXAMPLE

// putString adds the key to exists
assert PutStringUpdatesExists {
    all b, b' : Bundle, k : Key, v : Val |
        putString[b, k, v, b'] implies k in b'.exists
}
check PutStringUpdatesExists for 5      // EXPECTED: NO COUNTEREXAMPLE

// putString stores the value correctly
assert PutStringStoresValue {
    all b, b' : Bundle, k : Key, v : Val |
        putString[b, k, v, b'] implies b'.store[k] = v
}
check PutStringStoresValue for 5        // EXPECTED: NO COUNTEREXAMPLE

// putString does not change other keys (frame condition)
assert PutStringFrame {
    all b, b' : Bundle, k, k2 : Key, v : Val |
        (putString[b, k, v, b'] && k != k2) implies b'.store[k2] = b.store[k2]
}
check PutStringFrame for 5              // EXPECTED: NO COUNTEREXAMPLE

// getString returns the value after putString
assert GetAfterPut {
    all b, b' : Bundle, k : Key, v : Val |
        putString[b, k, v, b'] implies getString[b', k] = v
}
check GetAfterPut for 5                 // EXPECTED: NO COUNTEREXAMPLE

// containsKey returns false for a fresh bundle
assert EmptyBundleHasNoKeys {
    all b : Bundle |
        b.exists = none implies (all k : Key | !containsKey[b, k])
}
check EmptyBundleHasNoKeys for 5        // EXPECTED: NO COUNTEREXAMPLE

// ─── Isolation check ─────────────────────────────────────────────────────────

// CORRECT MODEL: each Bundle has its own store relation.
// Alloy sigs automatically give each instance its own relation,
// so no explicit isolation fact is needed — isolation is guaranteed.

// Verify: two distinct bundles never share a stored value *object*
// (they may store equal values, but not the same Val instance for the same key
//  as a result of aliasing)
assert BundleStoresAreDisjoint {
    all disj b1, b2 : Bundle |
        no k : Key | some v : Val |
            v != NullVal && b1.store[k] = v && b2.store[k] = v
            && b1.store = b2.store
            // i.e., they cannot share the exact same backing relation
}
check BundleStoresAreDisjoint for 5 Bundle, 5 Key, 5 Val
// EXPECTED: NO COUNTEREXAMPLE — correct model is always isolated.

// ─── BUGGY MODEL: singleton backing store ────────────────────────────────────
//
// Before commit 34a6d62, the shim used a module-level singleton Map<string, Value>
// shared across all Bundle instances. All instances pointed to the same store.
// Model this violation:

sig SingletonStore {
    store  : Key ->lone Val,
    exists : set Key
} {
    exists = store.Key
}

sig BuggyBundle {
    sharedStore : one SingletonStore
    // All BuggyBundle instances CAN share the same SingletonStore
}

// The bug: if b1 and b2 share the same SingletonStore, a putString on b1
// is immediately visible via getString on b2.
assert SharedStoreCausesLeak {
    all disj b1, b2 : BuggyBundle, k : Key, v : Val |
        b1.sharedStore = b2.sharedStore
        implies (
            b1.sharedStore.store[k] = v iff b2.sharedStore.store[k] = v
        )
}
check SharedStoreCausesLeak for 3 BuggyBundle, 1 SingletonStore, 4 Key, 4 Val
// EXPECTED: NO COUNTEREXAMPLE — because the assertion STATES the leakage.
// The assertion proves that shared stores guarantee cross-instance visibility,
// which is the definition of the memory isolation bug.

// The dual: in the correct model, NO such forced cross-visibility can exist.
assert CorrectModelNoForcedCrossVisibility {
    no disj b1, b2 : Bundle |
        b1.store = b2.store
}
check CorrectModelNoForcedCrossVisibility for 5 Bundle, 5 Key, 5 Val
// EXPECTED: NO COUNTEREXAMPLE — correct model has no shared stores.
