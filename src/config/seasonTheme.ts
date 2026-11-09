export type Season = 'autumn' | 'winter' | 'spring' | 'summer';

export interface SeasonColors {
  // Card/element borders
  border: string;
  // Active tab text, heading, spinner
  accent: string;
  // Gradient button/header end color (darker accent)
  accentDark: string;
  // Inactive tab background
  tabInactiveBg: string;
  // Divider / separator lines (light theme)
  divider: string;
}

const SEASONS: Record<Season, SeasonColors> = {
  autumn: {
    border:       '#E8AD82',
    accent:       '#C4824A',
    accentDark:   '#A0622E',
    tabInactiveBg:'rgba(232,173,130,0.12)',
    divider:      '#E8AD82',
  },
  winter: {
    border:       '#A8C8E8',
    accent:       '#5A8EB8',
    accentDark:   '#3A6E98',
    tabInactiveBg:'rgba(90,142,184,0.12)',
    divider:      '#A8C8E8',
  },
  spring: {
    border:       '#A8D8A0',
    accent:       '#5A9A50',
    accentDark:   '#3A7A30',
    tabInactiveBg:'rgba(90,154,80,0.12)',
    divider:      '#A8D8A0',
  },
  summer: {
    border:       '#F0D080',
    accent:       '#C8A030',
    accentDark:   '#A08020',
    tabInactiveBg:'rgba(200,160,48,0.12)',
    divider:      '#F0D080',
  },
};

export const CURRENT_SEASON: Season = 'autumn';

export const seasonColors: SeasonColors = SEASONS[CURRENT_SEASON];
