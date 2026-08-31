import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { audioEngine } from "@/lib/visualizer/audio-engine";
import { useVizStore } from "@/lib/visualizer/store";
import { VisualizerCanvas } from "./canvas";
import { VisualizerHud } from "./hud";

export function VisualizerApp() {
  const rootRef = useRef<HTMLElement>(null);
  const [hudVisible, setHudVisible] = useState(true);
  const hideTimer = useRef<number | null>(null);

  const source = useVizStore((s) => s.source);
  const playing = useVizStore((s) => s.playing);
  const volume = useVizStore((s) => s.volume);
  const hudPinned = useVizStore((s) => s.hudPinned);

  const revealHud = useCallback(() => {
    setHudVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    const state = useVizStore.getState();
    if (state.source === "idle" || !state.playing || state.hudPinned) return;
    hideTimer.current = window.setTimeout(() => setHudVisible(false), 2800);
  }, []);

  useEffect(() => {
    revealHud();
  }, [source, playing, hudPinned, revealHud]);

  useEffect(() => {
    audioEngine.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") audioEngine.resume();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const onFs = () => {
      useVizStore.getState().setFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const el = audioEngine.audioEl;
      const state = useVizStore.getState();
      if (state.source === "file" && el) {
        state.setCurrentTime(el.currentTime || 0);
        if (el.duration && Number.isFinite(el.duration)) {
          state.setFileMeta(state.fileName, el.duration);
        }
        if (el.ended) state.setPlaying(false);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  const startMic = useCallback(async () => {
    revealHud();
    const store = useVizStore.getState();
    store.setError(null);
    try {
      await audioEngine.startMic();
      store.setSource("mic");
      store.setPlaying(true);
      store.setFileMeta(null, 0);
    } catch {
      store.setError("Microphone is blocked or unavailable. Try uploading a track.");
      store.setSource("idle");
      store.setPlaying(false);
    }
  }, [revealHud]);

  const startDemo = useCallback(() => {
    revealHud();
    const store = useVizStore.getState();
    store.setError(null);
    audioEngine.startDemo();
    store.setSource("demo");
    store.setPlaying(true);
    store.setFileMeta(null, 0);
  }, [revealHud]);

  const loadFile = useCallback(
    async (file: File) => {
      revealHud();
      const store = useVizStore.getState();
      store.setError(null);
      try {
        const el = await audioEngine.loadFile(file);
        store.setSource("file");
        store.setPlaying(true);
        store.setFileMeta(file.name, el.duration || 0);
        el.onended = () => useVizStore.getState().setPlaying(false);
        el.onloadedmetadata = () => {
          useVizStore.getState().setFileMeta(file.name, el.duration || 0);
        };
      } catch {
        store.setError("Could not play that file. Try another audio format.");
        store.setSource("idle");
        store.setPlaying(false);
      }
    },
    [revealHud],
  );

  const stop = useCallback(() => {
    audioEngine.stopAll();
    const store = useVizStore.getState();
    store.setSource("idle");
    store.setPlaying(false);
    store.setCurrentTime(0);
    store.setFileMeta(null, 0);
    setHudVisible(true);
  }, []);

  const togglePlay = useCallback(async () => {
    const store = useVizStore.getState();
    if (store.source === "idle") {
      startDemo();
      return;
    }
    if (store.playing) {
      audioEngine.pause();
      store.setPlaying(false);
      setHudVisible(true);
      return;
    }
    try {
      await audioEngine.resumePlayback();
      store.setPlaying(true);
    } catch {
      store.setError("Playback was interrupted. Tap play again.");
    }
  }, [startDemo]);

  const seek = useCallback((t: number) => {
    audioEngine.seek(t);
    useVizStore.getState().setCurrentTime(t);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const node = rootRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await node.requestFullscreen();
    } catch {
      useVizStore.getState().setError("Fullscreen is not available in this view.");
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        void togglePlay();
      } else if (e.key === "f" || e.key === "F") {
        void toggleFullscreen();
      } else if (e.key === "1") useVizStore.getState().setMode("spire");
      else if (e.key === "2") useVizStore.getState().setMode("orbit");
      else if (e.key === "3") useVizStore.getState().setMode("halo");
      else if (e.key === "Escape" && useVizStore.getState().source !== "idle") {
        stop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleFullscreen, stop]);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("audio")) void loadFile(file);
    },
    [loadFile],
  );

  return (
    <main
      ref={rootRef}
      className="grain relative min-h-dvh overflow-hidden bg-bg text-fg select-none"
      onPointerMove={revealHud}
      onPointerDown={revealHud}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <VisualizerCanvas />
      <VisualizerHud
        visible={hudVisible}
        onMic={() => void startMic()}
        onUpload={(file) => void loadFile(file)}
        onDemo={startDemo}
        onTogglePlay={() => void togglePlay()}
        onStop={stop}
        onSeek={seek}
        onFullscreen={() => void toggleFullscreen()}
      />
    </main>
  );
}
