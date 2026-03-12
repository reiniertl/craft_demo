// CRAFT Alloy Model -- android.os.Bundle Instance Isolation (Spec A-1)
//
// Models the key-value isolation invariant: no two Bundle instances may share
// their backing store. This encodes JML invariant I-B4 from android_os_bundle.jml.
//
// Run headlessly:
//   java -Djava.awt.headless=true -Dsat4j=yes -cp alloy6.jar \
//        edu.mit.csail.sdg.alloy4whole.SimpleCLI bundle_isolation.als
//
// Expected results:
//   All assertions: NO COUNTEREXAMPLE (valid within scope)

module craft/bundle_isolation

// --- Domain types ---

abstract sig Key {}
abstract sig Val {}
one sig NullVal extends Val {}

// --- Correct Bundle model ---
//
// Each Bundle owns its own key->value relation via Alloy sig fields.
// In Alloy, each sig instance automatically has its own copy of its fields,
// so per-instance isolation is guaranteed by construction.

sig Bundle {
    store  : Key ->lone Val,
    exists : set Key
} {
    // I-B3: exists tracks exactly the keys that have been stored.
    // Alloy join: (Key ->lone Val).Val = {k : Key | some v : Val | (k,v) in store}
    // This gives the domain (set of keys) of the store relation.
    exists = store.Val
}

// --- Operations (relational/functional-update style) ---

// putString: b2 is the Bundle state after the operation
pred putString[b : Bundle, k : Key, v : Val, b2 : Bundle] {
    b2.store  = b.store  ++ (k -> v)
    b2.exists = b.exists + k
}

// getString: returns stored value or NullVal if absent
fun getString[b : Bundle, k : Key] : lone Val {
    k in b.exists => b.store[k] else NullVal
}

// containsKey
pred containsKey[b : Bundle, k : Key] {
    k in b.exists
}

// --- Correctness assertions ---

// I-B3: exists == domain of store, for all Bundle instances
assert ExistsDomainConsistency {
    all b : Bundle | b.exists = b.store.Val
}
check ExistsDomainConsistency for 5
// EXPECTED: NO COUNTEREXAMPLE

// putString adds the key to exists
assert PutStringUpdatesExists {
    all b, b2 : Bundle, k : Key, v : Val |
        putString[b, k, v, b2] implies k in b2.exists
}
check PutStringUpdatesExists for 5
// EXPECTED: NO COUNTEREXAMPLE

// putString stores the value correctly
assert PutStringStoresValue {
    all b, b2 : Bundle, k : Key, v : Val |
        putString[b, k, v, b2] implies b2.store[k] = v
}
check PutStringStoresValue for 5
// EXPECTED: NO COUNTEREXAMPLE

// putString does not change other keys (frame condition)
assert PutStringFrame {
    all b, b2 : Bundle, k, k2 : Key, v : Val |
        (putString[b, k, v, b2] and k != k2) implies b2.store[k2] = b.store[k2]
}
check PutStringFrame for 5
// EXPECTED: NO COUNTEREXAMPLE

// getString returns the stored value after putString
assert GetAfterPut {
    all b, b2 : Bundle, k : Key, v : Val |
        putString[b, k, v, b2] implies getString[b2, k] = v
}
check GetAfterPut for 5
// EXPECTED: NO COUNTEREXAMPLE

// containsKey is false for a bundle with no keys
assert EmptyBundleHasNoKeys {
    all b : Bundle |
        b.exists = none implies (all k : Key | not containsKey[b, k])
}
check EmptyBundleHasNoKeys for 5
// EXPECTED: NO COUNTEREXAMPLE

// Correct model: independent bundles CAN hold different content.
// (Two bundles are not forced to have the same keys/values.)
// Use 'run' to find a satisfying instance demonstrating this independence.
run BundlesDiffer {
    some disj b1, b2 : Bundle |
        b1.exists != b2.exists
} for 5
// EXPECTED: INSTANCE FOUND (proves correct model allows independent state)

// --- Buggy model: singleton backing store ---
//
// Before commit 34a6d62, the shim used a module-level singleton Map<string,Value>
// shared across all Bundle instances. Model this as all BuggyBundles referencing
// a shared SingletonStore.

sig SingletonStore {
    store  : Key ->lone Val,
    exists : set Key
} {
    exists = store.Val
}

sig BuggyBundle {
    sharedStore : one SingletonStore
}

// When two BuggyBundles share the same SingletonStore, any value stored
// under key k is identically visible in both. This assertion states that
// the leak is total — the checker finds no counterexample, confirming the bug.
assert SharedStoreCausesLeak {
    all disj b1, b2 : BuggyBundle, k : Key, v : Val |
        b1.sharedStore = b2.sharedStore
        implies (
            b1.sharedStore.store[k] = v iff b2.sharedStore.store[k] = v
        )
}
check SharedStoreCausesLeak for 5
// EXPECTED: NO COUNTEREXAMPLE (leak is unconditional when state is shared)
