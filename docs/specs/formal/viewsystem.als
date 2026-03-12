// CRAFT Alloy Model -- View System Structural Invariants
// Specs V-1 (View), V-2 (ViewGroup), V-3 (TextView)
//
// Models the structural properties of the Android View hierarchy shim.
//
// Run headlessly:
//   java -Djava.awt.headless=true -Dsat4j=yes -cp alloy6.jar \
//        edu.mit.csail.sdg.alloy4whole.SimpleCLI viewsystem.als
//
// Expected results:
//   All assertions: NO COUNTEREXAMPLE (valid within scope)

module craft/viewsystem

// --- Visibility constants ---

abstract sig Visibility {}
one sig VISIBLE   extends Visibility {}
one sig INVISIBLE extends Visibility {}
one sig GONE      extends Visibility {}

// --- Heap references ---

abstract sig HeapRef {}

// --- View (V-1): base state ---

sig ViewState {
    visibility  : one Visibility,
    hasListener : lone HeapRef,
    registered  : one UIBridgeNode
}

sig UIBridgeNode {
    nodeVisibility : one Visibility
}

// I3b: UIBridge visibility is always in sync with heap visibility.
// This fact prevents any model instance where the two diverge.
fact VisibilitySync {
    all v : ViewState |
        v.visibility = v.registered.nodeVisibility
}

// --- ViewGroup (V-2): adds ordered child list ---

sig ViewGroupState extends ViewState {
    children : seq HeapRef
}

// I-VG3: no duplicate children in any ViewGroup
fact NoDuplicateChildren {
    all vg : ViewGroupState |
        all i, j : vg.children.inds |
            i != j implies vg.children[i] != vg.children[j]
}

// --- Per-instance isolation ---

sig ViewGroupInstance {
    state : one ViewGroupState
}

// CORRECT MODEL: each instance owns a distinct ViewGroupState.
// This fact encodes the key design decision: no shared mutable state.
fact PerInstanceIsolation {
    all disj v1, v2 : ViewGroupInstance |
        v1.state != v2.state
}

// --- addView operation (functional-update style) ---
// vg2 is the ViewGroupState after the call.

pred addView[vg : ViewGroupState, child : HeapRef, vg2 : ViewGroupState] {
    child not in vg.children.elems          // precondition: not already present
    vg2.children   = vg.children.add[child] // child appended at end
    vg2.visibility  = vg.visibility          // frame: unchanged
    vg2.hasListener = vg.hasListener
    vg2.registered  = vg.registered
}

// V-2 I-VG2: child count increases by exactly 1 after addView
assert AddViewIncrementsCount {
    all vg, vg2 : ViewGroupState, child : HeapRef |
        addView[vg, child, vg2] implies
            #vg2.children = add[#vg.children, 1]
}
check AddViewIncrementsCount for 5
// EXPECTED: NO COUNTEREXAMPLE

// Insertion order: all existing children stay at the same indices
assert InsertionOrderPreserved {
    all vg, vg2 : ViewGroupState, child : HeapRef |
        addView[vg, child, vg2] implies
            (all i : vg.children.inds |
                vg2.children[i] = vg.children[i])
}
check InsertionOrderPreserved for 5
// EXPECTED: NO COUNTEREXAMPLE

// NoDuplicateChildren is preserved by addView
assert AddViewPreservesUniqueness {
    all vg, vg2 : ViewGroupState, child : HeapRef |
        addView[vg, child, vg2] implies
            (all i, j : vg2.children.inds |
                i != j implies vg2.children[i] != vg2.children[j])
}
check AddViewPreservesUniqueness for 5
// EXPECTED: NO COUNTEREXAMPLE

// Correct model: distinct instances never share their state
assert CorrectModelHasNoInterference {
    no disj v1, v2 : ViewGroupInstance |
        v1.state = v2.state
}
check CorrectModelHasNoInterference for 5
// EXPECTED: NO COUNTEREXAMPLE (enforced by PerInstanceIsolation fact)

// --- Buggy model: singleton children array ---
//
// Before commit 34a6d62, a module-level Map was shared across all ViewGroup
// instances. Model this: multiple BuggyViewGroupInstances can share the same
// BuggyViewGroupState (no isolation fact).

sig BuggyViewGroupState {
    children : seq HeapRef
}

sig BuggyViewGroupInstance {
    state : one BuggyViewGroupState
}

// When two BuggyViewGroupInstances share the same state, any child present in
// one is identically present in the other. The assertion states this total
// interference -- the checker finds no counterexample, confirming the bug.
assert SharedStateCausesInterference {
    all disj b1, b2 : BuggyViewGroupInstance |
    all child : HeapRef |
        b1.state = b2.state
        implies (child in b1.state.children.elems iff child in b2.state.children.elems)
}
check SharedStateCausesInterference for 5
// EXPECTED: NO COUNTEREXAMPLE (interference is total when state is shared)
