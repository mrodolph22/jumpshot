import { PrimaryPlayerProp } from '../types';

/**
 * Evaluates the role of a leg in a parlay structure based on market data.
 * Anchor: Stabilizes the parlay with low lines and high agreement.
 * Volatile: High variance, wide disagreement, aggressive lines.
 * Support: Standard moderate variance legs.
 */
export const evaluateParlayRole = (
  line: number,
  marketKey: string,
  consensus: 'Low' | 'Medium' | 'High',
  avgJuice: number
): 'Anchor' | 'Support' | 'Volatile' => {
  const isPoints = marketKey.includes('points');
  const isAggressivePrice = avgJuice > 120 || avgJuice < -180;

  // VOLATILE: Wide disagreement OR high line values OR aggressive pricing
  if (
    consensus === 'Low' || 
    (isPoints && line > 26) || 
    (!isPoints && line > 10) ||
    isAggressivePrice
  ) {
    return 'Volatile';
  }

  // ANCHOR: Strong agreement AND lower line values AND moderate pricing
  if (
    consensus === 'High' && 
    ((isPoints && line < 16) || (!isPoints && line < 5)) &&
    Math.abs(avgJuice) <= 150
  ) {
    return 'Anchor';
  }

  // SUPPORT: Default middle ground
  return 'Support';
};
