import type {
  AnalyticFlagInstance,
  Figure,
  ProvenanceTokens,
  SuppressedValue,
  SuppressingState,
} from "./types";

// Small constructors for the two Figure<T> variants (§10.0.2 rule 1 — a
// value and its qualifications are never separated). Every M1–M16 module
// builds its output cells through these rather than the raw object literal,
// so the shape can't drift module to module.

export function suppressedValue(state: SuppressingState, cause: string): SuppressedValue {
  return { suppressed: true, state, cause };
}

/** The cause every figure gated by an unconfirmed input carries (computedValue below). */
export const NOT_CONFIRMED_INPUT_CAUSE =
  "a REQUIRED input is NOT CONFIRMED (contradicted by its source, not located, or failed a cross-check), so nothing is computed from it (§5)";

/**
 * A computed figure — unless its own weakest-input provenance is NOT
 * CONFIRMED, in which case it is INCOMPLETE and carries no value.
 *
 * CF-AR3-REPRODUCIBLE-RUNS-01 (R7 gating: "contradicted facts block what
 * depends on them"; §5: NOT CONFIRMED propagates INCOMPLETE). Every M1–M16
 * module issues its figures through here with combineProvenance of the
 * inputs it actually used, and combineProvenance resolves to NOT CONFIRMED
 * exactly when one of those inputs is — so this one check gates every module
 * on its own dependencies, and the suppression then cascades to whatever
 * reads the figure, the same way a missing input already does. Before this,
 * such a figure was computed and merely carried the weaker token.
 */
export function computedValue<T>(
  value: T,
  provenanceTokens: ProvenanceTokens,
  analyticFlags: AnalyticFlagInstance[] = []
): Figure<T> {
  if (provenanceTokens.verificationState === "NOT CONFIRMED") {
    return suppressedValue("INCOMPLETE", NOT_CONFIRMED_INPUT_CAUSE);
  }
  return { suppressed: false, value, qualification: { provenanceTokens, analyticFlags } };
}
