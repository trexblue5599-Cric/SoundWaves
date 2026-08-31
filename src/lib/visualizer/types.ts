export type VizMode = "spire" | "orbit" | "halo";
export type ThemeId = "ember" | "ice" | "sage" | "pearl";
export type SourceKind = "idle" | "demo" | "mic" | "file";

export type RGB = readonly [number, number, number];

export type VizTheme = {
  id: ThemeId;
  name: string;
  low: RGB;
  mid: RGB;
  high: RGB;
  glow: RGB;
};

export const MODES: { id: VizMode; label: string }[] = [
  { id: "spire", label: "Spire" },
  { id: "orbit", label: "Orbit" },
  { id: "halo", label: "Halo" },
];

export const BAR_COUNT = 96;
