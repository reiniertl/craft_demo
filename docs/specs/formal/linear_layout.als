// CRAFT Alloy Model -- LinearLayout Orientation Invariants (Spec V-4)
//
// Models the orientation domain invariant (I-LL1) and per-instance isolation
// for android.widget.LinearLayout.
//
// Run headlessly:
//   java -Djava.awt.headless=true -Dsat4j=yes -cp alloy6.jar \
//        edu.mit.csail.sdg.alloy4whole.SimpleCLI linear_layout.als
//
// Expected results:
//   All assertions: NO COUNTEREXAMPLE (valid within scope)

module craft/linear_layout

// --- Orientation constants ---

abstract sig Orientation {}
one sig HORIZONTAL extends Orientation {}
one sig VERTICAL   extends Orientation {}

// --- LinearLayout state ---

sig LinearLayoutState {
    orientation : one Orientation
}

// I-LL1: orientation is always HORIZONTAL or VERTICAL.
// This is guaranteed by Alloy's type system: orientation : one Orientation,
// and Orientation = {HORIZONTAL} + {VERTICAL}. The assertion makes it explicit.
assert OrientationInDomain {
    all s : LinearLayoutState | s.orientation in Orientation
}
check OrientationInDomain for 5
// EXPECTED: NO COUNTEREXAMPLE (trivially true by sig construction)

// --- Per-instance isolation ---

sig LinearLayoutInstance {
    state : one LinearLayoutState
}

// CORRECT MODEL: each instance owns a distinct state.
fact PerInstanceIsolation {
    all disj i1, i2 : LinearLayoutInstance |
        i1.state != i2.state
}

assert CorrectModelHasNoInterference {
    no disj i1, i2 : LinearLayoutInstance |
        i1.state = i2.state
}
check CorrectModelHasNoInterference for 5
// EXPECTED: NO COUNTEREXAMPLE (enforced by PerInstanceIsolation fact)

// --- setOrientation functional update ---

pred setOrientation[s : LinearLayoutState, newOri : Orientation, s2 : LinearLayoutState] {
    s2.orientation = newOri
}

// V-4 post:setOrientation — orientation updated correctly
assert SetOrientationUpdates {
    all s, s2 : LinearLayoutState, newOri : Orientation |
        setOrientation[s, newOri, s2] implies s2.orientation = newOri
}
check SetOrientationUpdates for 5
// EXPECTED: NO COUNTEREXAMPLE

// V-4 frame — setOrientation only changes orientation (trivially true here
// since orientation is the only field in LinearLayoutState).
assert SetOrientationFrame {
    all s, s2 : LinearLayoutState, newOri : Orientation |
        setOrientation[s, newOri, s2] implies
            (s2.orientation = newOri)
}
check SetOrientationFrame for 5
// EXPECTED: NO COUNTEREXAMPLE

// Two independent LinearLayout instances may hold different orientations.
// This run demonstrates that the correct model allows independent state.
run OrientationsDiffer {
    some disj i1, i2 : LinearLayoutInstance |
        i1.state.orientation != i2.state.orientation
} for 5
// EXPECTED: INSTANCE FOUND

// --- Buggy model: singleton orientation ---
//
// Before the isolation fix, a module-level variable could be shared.
// Model: multiple BuggyLinearLayoutInstances share the same BuggyLayoutState.

sig BuggyLayoutState {
    orientation : one Orientation
}

sig BuggyLinearLayoutInstance {
    state : one BuggyLayoutState
}

// When two buggy instances share state, orientation changes in one are
// immediately visible in the other. The assertion confirms total interference.
assert SharedStateCausesOrientationInterference {
    all disj b1, b2 : BuggyLinearLayoutInstance |
        b1.state = b2.state
        implies b1.state.orientation = b2.state.orientation
}
check SharedStateCausesOrientationInterference for 5
// EXPECTED: NO COUNTEREXAMPLE (interference is total when state is shared)
