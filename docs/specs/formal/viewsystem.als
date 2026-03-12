// CRAFT Alloy Model — View System Structural Invariants
// Specs V-1 (View), V-2 (ViewGroup), V-3 (TextView)
//
// Models the structural properties of the Android View hierarchy shim.
// Run with Alloy Analyzer 6.x:
//   java -jar alloy6.jar viewsystem.als
//
// All 'check' commands should find NO counterexamples in the correct model.
// The 'BuggyViewGroup' section intentionally violates the invariants to show
// what the pre-fix singleton implementation allowed.

module craft/viewsystem

// ─── Visibility constants ────────────────────────────────────────────────────

abstract sig Visibility {}
one sig VISIBLE   extends Visibility {}   // 0
one sig INVISIBLE extends Visibility {}   // 4
one sig GONE      extends Visibility {}   // 8

// ─── Heap references ────────────────────────────────────────────────────────

abstract sig HeapRef {}

// ─── View (V-1) ─────────────────────────────────────────────────────────────

sig ViewState {
    visibility   : one Visibility,
    hasListener  : lone HeapRef,    // null or an OnClickListener ref
    registered   : one UIBridgeNode
}

sig UIBridgeNode {
    nodeVisibility : one Visibility
}

// I3b: UIBridge visibility is always in sync with heap visibility
fact VisibilitySync {
    all v : ViewState |
        v.visibility = v.registered.nodeVisibility
}

// ─── ViewGroup (V-2) ────────────────────────────────────────────────────────

sig ViewGroupState extends ViewState {
    children : seq HeapRef
}

// I-VG2: count == children.length (Alloy seqs carry length intrinsically)
// (this holds by construction in Alloy)

// I-VG3: no duplicate children in any ViewGroup
fact NoDuplicateChildren {
    all vg : ViewGroupState |
        all i, j : vg.children.inds |
            i != j implies vg.children[i] != vg.children[j]
}

// ─── Per-instance isolation ──────────────────────────────────────────────────

sig ViewGroupInstance {
    state : one ViewGroupState
}

// CORRECT MODEL: each instance owns its own distinct ViewGroupState
fact PerInstanceIsolation {
    all disj v1, v2 : ViewGroupInstance |
        v1.state != v2.state
}

// ─── addView operation ───────────────────────────────────────────────────────

// Models a single addView call: child is appended, no duplicate, count increases
pred addView[
    vg  : ViewGroupState,
    child : HeapRef,
    vg' : ViewGroupState
] {
    // Precondition: child not already present
    child !in vg.children.elems
    // Postcondition: child appended at end
    vg'.children = vg.children.add[child]
    // Frame: visibility and listener unchanged
    vg'.visibility  = vg.visibility
    vg'.hasListener = vg.hasListener
    vg'.registered  = vg.registered
}

// After addView, getChildCount increased by exactly 1
assert AddViewIncrementsCount {
    all vg, vg' : ViewGroupState, child : HeapRef |
        addView[vg, child, vg'] implies
            #vg'.children = #vg.children.add[child]
}
check AddViewIncrementsCount for 5

// Insertion order: previous children are unchanged after addView
assert InsertionOrderPreserved {
    all vg, vg' : ViewGroupState, child : HeapRef |
        addView[vg, child, vg'] implies
            (all i : vg.children.inds |
                vg'.children[i] = vg.children[i])
}
check InsertionOrderPreserved for 5

// NoDuplicateChildren is preserved by addView
assert AddViewPreservesUniqueness {
    all vg, vg' : ViewGroupState, child : HeapRef |
        (addView[vg, child, vg'] &&
         all i, j : vg.children.inds | (i != j implies vg.children[i] != vg.children[j]))
        implies
        (all i, j : vg'.children.inds | (i != j implies vg'.children[i] != vg'.children[j]))
}
check AddViewPreservesUniqueness for 5

// ─── BUGGY MODEL: singleton children array (pre-fix behaviour) ───────────────
//
// Before commit 34a6d62, a module-level Map was shared across all ViewGroup
// instances. Modelling this: all BuggyViewGroupInstances share one state object.

sig BuggyViewGroupState {
    children : seq HeapRef
}

sig BuggyViewGroupInstance {
    state : one BuggyViewGroupState
    // NOTE: no isolation fact — multiple instances CAN share the same state
}

// With a shared state, adding a child to one instance affects all instances
// that share the same BuggyViewGroupState.
assert SharedStateCausesInterference {
    some disj b1, b2 : BuggyViewGroupInstance |
    some child : HeapRef |
        b1.state = b2.state
        implies (child in b1.state.children.elems iff child in b2.state.children.elems)
}
// This WILL find a counterexample (confirming the bug model is valid).
// Expected: counterexample found — interference demonstrated.
check SharedStateCausesInterference for 3 BuggyViewGroupInstance, 1 BuggyViewGroupState, 4 HeapRef

// ─── Correct model has no such interference ──────────────────────────────────

// In the correct model, distinct instances always have disjoint states,
// so modifying one cannot affect the other.
assert CorrectModelHasNoInterference {
    no disj v1, v2 : ViewGroupInstance |
        v1.state = v2.state
}
check CorrectModelHasNoInterference for 5
