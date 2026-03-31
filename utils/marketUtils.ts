
export const renderMarketLabelClean = (key: string) => {
  const words = key.replace('player_', '').split('_');
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

export const getMarketKeyFromLabel = (label: string) => {
  const map: Record<string, string> = {
    'Points': 'player_points',
    'Rebounds': 'player_rebounds',
    'Assists': 'player_assists',
    'Blocks': 'player_blocks',
    'Steals': 'player_steals',
    'Threes': 'player_threes'
  };
  return map[label] || `player_${label.toLowerCase()}`;
};
