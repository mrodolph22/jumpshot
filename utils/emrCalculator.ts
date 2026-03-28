import { PrimaryPlayerProp, PlayerOffer } from '../types';

export interface EMRResult {
  value: number;
  level: 'Lower Miss Risk' | 'Moderate Miss Risk' | 'Elevated Miss Risk' | 'High Miss Risk';
  isHook: boolean;
}

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

export const calculateEMR = (prop: PrimaryPlayerProp, selectedBookmakerKey: string): EMRResult => {
  const offer = prop.offers.find(o => o.bookmaker === selectedBookmakerKey);
  
  // 1. Base Market EMR
  // Default to a 50/50 baseline (-110 odds) if no specific offer is found to avoid crashes
  const odds = offer?.overPrice || -110;
  const impliedProb = odds < 0 
    ? Math.abs(odds) / (Math.abs(odds) + 100)
    : 100 / (odds + 100);
  
  const baseEMR = 1 - impliedProb;

  // 2. Hook Adjustment
  const isHook = prop.line % 1 !== 0;
  const hookAdjustment = isHook ? 0.04 : 0;

  // 3. Market Disagreement Adjustment
  // Compare overPrice across all available bookmakers for this specific line
  let marketAdjustment = 0; // Default to mild
  const allOverOdds = prop.offers.map(o => o.overPrice).filter((p): p is number => p !== undefined);
  
  if (allOverOdds.length > 1) {
    const minOdds = Math.min(...allOverOdds);
    const maxOdds = Math.max(...allOverOdds);
    const spread = Math.abs(maxOdds - minOdds);

    if (spread < 10) marketAdjustment = 0.01; // Tight consensus
    else if (spread < 25) marketAdjustment = 0.03; // Mild disagreement
    else marketAdjustment = 0.06; // Large disagreement
  }

  // 4. Role-Based Volatility Heuristic (Points line context)
  let roleAdjustment = 0;
  if (prop.marketKey.includes('points')) {
    if (prop.line < 10) roleAdjustment = 0.06;
    else if (prop.line < 18) roleAdjustment = 0.03;
  }

  // 5. Raw EMR (pre-calibration)
  const rawEMR = baseEMR +
    hookAdjustment +
    marketAdjustment +
    roleAdjustment;

    // 6. Shrink toward 50% to normalize distribution
  const SHRINK_FACTOR = 0.65;
  const shrunkEMR = 0.5 + SHRINK_FACTOR * (rawEMR - 0.5);

  const finalEMR = clamp(shrunkEMR, 0.10, 0.85);

  // 7. Bucketing
  let level: EMRResult['level'];
  
  // New threshold buckets (FIX 1)
  if (finalEMR < 0.40) level = 'Lower Miss Risk';
  else if (finalEMR <= 0.55) level = 'Moderate Miss Risk';
  else if (finalEMR <= 0.65) level = 'Elevated Miss Risk';
  else level = 'High Miss Risk';

  return {
    value: Math.round(finalEMR * 100),
    level,
    isHook
  };
};

export const calculateParlayMissRate = (emrs: number[]): number => {
  if (emrs.length === 0) return 0;
  const parlayHitProb = emrs.reduce((acc, emr) => acc * (1 - (emr / 100)), 1);
  return Math.round((1 - parlayHitProb) * 100);
};
