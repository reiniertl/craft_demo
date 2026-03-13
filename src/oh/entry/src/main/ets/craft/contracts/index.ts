/**
 * CRAFT Spec Compliance Contracts
 *
 * TypeScript runtime translation of the JML formal specifications in
 * docs/specs/formal/*.jml. Each contract method encodes one JML clause
 * (invariant, requires, or ensures) and returns ContractViolation|null.
 *
 * Used by: test/unit/contracts/spec_compliance.test.ts
 */

export { ContractViolation, checkAll } from './contract_types';
// java.lang contracts (JL-1 through JL-5)
export { ObjectContracts }             from './object_contracts';
export { StringContracts }             from './string_contracts';
export { StringBuilderContracts }      from './string_builder_contracts';
export { SystemContracts }             from './system_contracts';
export { ClassContracts }              from './class_contracts';
// android.* contracts (V-1 through V-5, A-1 through A-4)
export { ViewContracts }               from './view_contracts';
export { ViewGroupContracts }          from './view_group_contracts';
export { TextViewContracts }           from './textview_contracts';
export { BundleContracts }             from './bundle_contracts';
export { ButtonContracts }             from './button_contracts';
export { LinearLayoutContracts }       from './linear_layout_contracts';
export { ActivityContracts }           from './activity_contracts';
export { ContextContracts, ContextWrapperContracts } from './context_contracts';
