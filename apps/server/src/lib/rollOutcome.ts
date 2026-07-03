export type RollOutcome = "TOTAL_FAILURE" | "FAILURE" | "SUCCESS" | "TOTAL_SUCCESS";

/**
 * Classe le resultat d'un jet de de en une issue, selon les seuils du jet.
 * Regle metier pure (sans dependance HTTP ni base) : testable en isolation.
 * Retourne null tant que le de n'a pas ete lance (result === null).
 */
export function getRollOutcome(roll: {
  result: number | null;
  totalFailureMax: number;
  successMin: number;
  totalSuccessMin: number;
}): RollOutcome | null {
  if (roll.result === null) return null;
  if (roll.result <= roll.totalFailureMax) return "TOTAL_FAILURE";
  if (roll.result >= roll.totalSuccessMin) return "TOTAL_SUCCESS";
  if (roll.result >= roll.successMin) return "SUCCESS";
  return "FAILURE";
}
