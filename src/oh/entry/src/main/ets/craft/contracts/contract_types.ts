/**
 * CRAFT Contract Violation Types
 *
 * Shared types used by all contract checkers.
 * Each JML clause (invariant / requires / ensures) maps to one check method
 * that returns ContractViolation|null.
 */

export interface ContractViolation {
  /** Spec ID and clause label, e.g. "V-1 I3" or "V-3 post:setText" */
  clause:  string;
  /** The kind of JML clause violated */
  kind:    'invariant' | 'precondition' | 'postcondition';
  /** Human-readable explanation of what was wrong */
  detail:  string;
}

/**
 * Run all checks in an array and return all violations found.
 * Convenient for combining multiple invariant checks in a single call.
 */
export function checkAll(
  checks: Array<() => ContractViolation | null>
): ContractViolation[] {
  const violations: ContractViolation[] = [];
  for (const check of checks) {
    const v = check();
    if (v !== null) violations.push(v);
  }
  return violations;
}
