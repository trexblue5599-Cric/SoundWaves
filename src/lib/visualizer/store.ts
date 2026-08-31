import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SourceKind, ThemeId, VizMode } from "./types";

export type VizStore = {
  mode: VizMode;
  theme: ThemeId;
  sensitivity: number;
  volume: number;
  source: SourceKind;
  playing: boolean;
  fileName: string | null;
  duration: number;
  currentTime: number;
  error: string | null;
  fullscreen: boolean;
  hudPinned: boolean;
  setMode: (mode: VizMode) => void;
  setTheme: (theme: ThemeId) => void;
  setSensitivity: (sensitivity: number) => void;
  setVolume: (volume: number) => void;
  setSource: (source: SourceKind) => void;
  setPlaying: (playing: boolean) => void;
  setFileMeta: (fileName: string | null, duration: number) => void;
  setCurrentTime: (currentTime: number) => void;
  setError: (error: string | null) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setHudPinned: (hudPinned: boolean) => void;
};

export const useVizStore = create<VizStore>()(
  persist(
    (set) => ({
      mode: "spire",
      theme: "ember",
      sensitivity: 1.15,
      volume: 0.85,
      source: "idle",
      playing: false,
      fileName: null,
      duration: 0,
      currentTime: 0,
      error: null,
      fullscreen: false,
      hudPinned: false,
      setMode: (mode) => set({ mode }),
      setTheme: (theme) => set({ theme }),
      setSensitivity: (sensitivity) => set({ sensitivity }),
      setVolume: (volume) => set({ volume }),
      setSource: (source) => set({ source }),
      setPlaying: (playing) => set({ playing }),
      setFileMeta: (fileName, duration) => set({ fileName, duration }),
      setCurrentTime: (currentTime) => set({ currentTime }),
      setError: (error) => set({ error }),
      setFullscreen: (fullscreen) => set({ fullscreen }),
      setHudPinned: (hudPinned) => set({ hudPinned }),
    }),
    {
      name: "vanta-viz",
      partialize: (s) => ({
        mode: s.mode,
        theme: s.theme,
        sensitivity: s.sensitivity,
        volume: s.volume,
      }),
    },
  ),
);
