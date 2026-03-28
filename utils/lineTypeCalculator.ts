
import { PrimaryPlayerProp } from '../types';

/**
 * Computes the structural classification for a prop line.
 * Volume Line: Driven by minutes and repeatable opportunity.
 * Efficiency Line: Driven by shot-making, game flow, or variable usage.
 */
export const determineLineType = (
  line: number,
  marketKey: string,
  consensus: 'Low' | 'Medium' | 'High'
): 'Volume Line' | 'Efficiency Line' | undefined => {
  const isPoints = marketKey.includes('points');
  const isAssists = marketKey.includes('assists');
  const isRebounds = marketKey.includes('rebounds');
  const isDefensive = marketKey.includes('blocks') || marketKey.includes('steals');
  const isThrees = marketKey.includes('threes');

  // Hierarchy 1: Market Consensus Stability (Secondary Signal)
  // If consensus is low, markets aren't certain about the role/pricing,
  // typically indicating higher variance or efficiency dependency.
  if (consensus === 'Low') return 'Efficiency Line';

  // Hierarchy 2: Role + Line Height (Primary Signal)
  
  // High thresholds usually indicate primary options (Volume)
  if (isPoints && line >= 20.5) return 'Volume Line';
  if (isAssists && line >= 7.5) return 'Volume Line';
  if (isRebounds && line >= 9.5) return 'Volume Line';

  // Low thresholds indicate secondary/bench/specialist roles (Efficiency)
  if (isPoints && line <= 12.5) return 'Efficiency Line';
  if (isAssists && line <= 3.5) return 'Efficiency Line';
  if (isRebounds && line <= 5.5) return 'Efficiency Line';
  
  // Threes, Blocks, Steals are structurally high-variance
  if (isThrees || isDefensive) {
    // Only volume if the line is unusually high for these markets
    return line >= 3.5 ? 'Volume Line' : 'Efficiency Line';
  }

  // Hierarchy 3: Usage Dependency (Heuristic)
  // For mid-range lines, high consensus suggests minutes/role security (Volume).
  if (consensus === 'High') {
    return 'Volume Line';
  }

  // Safety: If consensus is Medium and we're in a "gray area" of line heights,
  // we do not have enough data to confidently distinguish.
  return undefined;
};
