/**
 * Heartflame — the deterministic nudge engine.
 *
 * Public surface for the predicate engine, line pools, rules, and types.
 * Pure and framework-free. Delivery (Redis/WS) and the optional AI re-skin
 * are layered on top in later Track B steps.
 */
export * from './types';
export * from './predicates';
export * from './line-pool';
export * from './engine';
export * from './board-state';
export * from './delivery';
export { DEFAULT_RULES } from './rules';
