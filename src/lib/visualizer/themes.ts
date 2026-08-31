import type { ThemeId, VizTheme } from "./types";

export const THEMES: Record<ThemeId, VizTheme> = {
  ember: {
    id: "ember",
    name: "Ember",
    low: [72, 18, 12],
    mid: [255, 92, 58],
    high: [255, 214, 186],
    glow: [255, 110, 64],
  },
  ice: {
    id: "ice",
    name: "Ice",
    low: [8, 36, 56],
    mid: [110, 200, 255],
    high: [232, 246, 255],
    glow: [140, 214, 255],
  },
  sage: {
    id: "sage",
    name: "Sage",
    low: [10, 40, 24],
    mid: [61, 204, 138],
    high: [210, 255, 230],
    glow: [90, 230, 168],
  },
  pearl: {
    id: "pearl",
    name: "Pearl",
    low: [36, 36, 40],
    mid: [200, 200, 206],
    high: [255, 255, 255],
    glow: [232, 232, 236],
  },
};

export const THEME_LIST: VizTheme[] = [
  THEMES.ember,
  THEMES.ice,
  THEMES.sage,
  THEMES.pearl,
];
