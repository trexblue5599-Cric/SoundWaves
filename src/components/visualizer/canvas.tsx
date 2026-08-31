import { useEffect, useRef } from "react";
import { audioEngine } from "@/lib/visualizer/audio-engine";
import { drawVisualizer } from "@/lib/visualizer/draw";
import { bandEnergy, decayPeaks, idleSpectrum, mapSpectrum, smoothToward } from "@/lib/visualizer/spectrum";
import { useVizStore } from "@/lib/visualizer/store";
import { THEMES } from "@/lib/visualizer/themes";
import { BAR_COUNT } from "@/lib/visualizer/types";

export function VisualizerCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const target = new Float32Array(BAR_COUNT);
    const smoothed = new Float32Array(BAR_COUNT);
    const peaks = new Float32Array(BAR_COUNT);
    idleSpectrum(smoothed, 0);

    let raf = 0;
    let last = performance.now();
    let disposed = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const loop = (now: number) => {
      if (disposed) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const state = useVizStore.getState();
      const freq = audioEngine.getFrequencyData();
      const hasSignal = Boolean(freq) && state.playing && state.source !== "idle";

      if (hasSignal && freq) {
        mapSpectrum(freq, target, state.sensitivity);
      } else {
        idleSpectrum(target, now / 1000);
      }

      smoothToward(smoothed, target, dt, hasSignal ? 14 : 3.2);
      decayPeaks(peaks, smoothed, dt, hasSignal ? 0.42 : 0.12);

      const bass = bandEnergy(smoothed, 0, 0.12);
      const energy = bandEnergy(smoothed, 0, 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      drawVisualizer({
        ctx,
        width: w,
        height: h,
        values: smoothed,
        peaks,
        timeDomain: hasSignal ? audioEngine.getTimeData() : null,
        theme: THEMES[state.theme],
        mode: state.mode,
        time: now / 1000,
        bass,
        energy,
        playing: state.playing,
      });

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 size-full bg-bg"
      aria-hidden="true"
    />
  );
}
