import { useRef, type ReactNode } from "react";
import {
  Maximize2,
  Mic,
  Minimize2,
  Pause,
  Play,
  Square,
  Upload,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { MODES } from "@/lib/visualizer/types";
import { THEME_LIST } from "@/lib/visualizer/themes";
import { useVizStore } from "@/lib/visualizer/store";
import type { ThemeId, VizMode } from "@/lib/visualizer/types";

type HudProps = {
  visible: boolean;
  onMic: () => void;
  onUpload: (file: File) => void;
  onDemo: () => void;
  onTogglePlay: () => void;
  onStop: () => void;
  onSeek: (t: number) => void;
  onFullscreen: () => void;
};

const THEME_SWATCH: Record<ThemeId, string> = {
  ember: "bg-ember",
  ice: "bg-ice",
  sage: "bg-sage",
  pearl: "bg-pearl",
};

export function VisualizerHud({
  visible,
  onMic,
  onUpload,
  onDemo,
  onTogglePlay,
  onStop,
  onSeek,
  onFullscreen,
}: HudProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const source = useVizStore((s) => s.source);
  const playing = useVizStore((s) => s.playing);
  const mode = useVizStore((s) => s.mode);
  const theme = useVizStore((s) => s.theme);
  const sensitivity = useVizStore((s) => s.sensitivity);
  const volume = useVizStore((s) => s.volume);
  const fileName = useVizStore((s) => s.fileName);
  const duration = useVizStore((s) => s.duration);
  const currentTime = useVizStore((s) => s.currentTime);
  const fullscreen = useVizStore((s) => s.fullscreen);
  const error = useVizStore((s) => s.error);
  const setMode = useVizStore((s) => s.setMode);
  const setTheme = useVizStore((s) => s.setTheme);
  const setSensitivity = useVizStore((s) => s.setSensitivity);
  const setVolume = useVizStore((s) => s.setVolume);

  const idle = source === "idle";
  const canTransport = source === "file" || source === "demo";
  const showProgress = source === "file" && duration > 0;

  const status =
    source === "mic"
      ? "Listening"
      : source === "demo"
        ? "Demo pulse"
        : source === "file"
          ? (fileName ?? "Track")
          : "Ready";

  return (
    <>
      <header
        className={cn(
          "hud-fade pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-4 pt-4 sm:px-6 sm:pt-6",
          "transition-opacity duration-200 ease-out",
          visible ? "opacity-100" : "opacity-0",
        )}
      >
        <div className={cn("pointer-events-auto", idle && "opacity-0")}>
          <p className="font-display text-lg font-semibold tracking-display text-fg sm:text-xl">
            Vanta
          </p>
          <p className="mt-0.5 text-xs tracking-wide text-muted">Listen in the dark</p>
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="hud-panel flex rounded-xl p-1">
            {MODES.map((m) => (
              <ModeButton
                key={m.id}
                active={mode === m.id}
                label={m.label}
                onClick={() => setMode(m.id as VizMode)}
              />
            ))}
          </div>
          <div className="hud-panel flex items-center gap-1 rounded-xl px-2 py-1.5">
            {THEME_LIST.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-label={`${t.name} theme`}
                aria-pressed={theme === t.id}
                onClick={() => setTheme(t.id)}
                className="pressable relative flex size-11 items-center justify-center rounded-lg sm:size-8"
              >
                <span
                  className={cn(
                    "size-3.5 rounded-full",
                    THEME_SWATCH[t.id],
                    theme === t.id ? "opacity-100" : "opacity-55",
                  )}
                />
                {theme === t.id ? (
                  <span className="absolute inset-1 rounded-md ring-1 ring-fg/40" />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </header>

      {idle ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-5">
          <div className="flex w-full max-w-lg flex-col items-center text-center">
            <h1 className="font-display text-5xl font-semibold tracking-display text-fg sm:text-7xl">
              Vanta
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted sm:text-base">
              A black-field visualizer. Feed it a microphone or a track and watch
              light gather at the edges of sound.
            </p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
              <SourceButton icon={Mic} label="Microphone" onClick={onMic} />
              <SourceButton
                icon={Upload}
                label="Upload track"
                onClick={() => fileRef.current?.click()}
              />
              <SourceButton icon={Play} label="Play demo" onClick={onDemo} primary />
            </div>
            {error ? (
              <p className="mt-4 text-sm text-ember" role="alert">
                {error}
              </p>
            ) : (
              <p className="mt-5 hidden text-xs text-subtle sm:block">
                Space play · F fullscreen · 1–3 modes
              </p>
            )}
          </div>
        </div>
      ) : null}

      {!idle ? (
      <footer
        className={cn(
          "hud-fade pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-3 sm:px-6 sm:pb-6",
          "transition-opacity duration-200 ease-out",
          visible ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="pointer-events-auto hud-panel mx-auto flex max-w-3xl flex-col gap-3 rounded-xl p-3 sm:rounded-2xl sm:p-4">
          {error ? (
            <p className="text-xs text-ember" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-2 sm:gap-3">
            {canTransport ? (
              <>
                <IconBtn
                  label={playing ? "Pause" : "Play"}
                  onClick={onTogglePlay}
                >
                  {playing ? (
                    <Pause className="size-5" />
                  ) : (
                    <Play className="size-5 translate-x-px" />
                  )}
                </IconBtn>
                <IconBtn label="Stop" onClick={onStop}>
                  <Square className="size-4 fill-current" />
                </IconBtn>
              </>
            ) : (
              <IconBtn label="Stop microphone" onClick={onStop}>
                <Square className="size-4 fill-current" />
              </IconBtn>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium tracking-wide text-fg">{status}</p>
              {showProgress ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="w-8 text-xs tabular-nums text-subtle">
                    {formatTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.01}
                    value={Math.min(currentTime, duration)}
                    onChange={(e) => onSeek(Number(e.target.value))}
                    aria-label="Seek"
                    className="range-input"
                  />
                  <span className="w-8 text-right text-xs tabular-nums text-subtle">
                    {formatTime(duration)}
                  </span>
                </div>
              ) : (
                <p className="mt-0.5 text-xs text-subtle">
                  {source === "mic" ? "Live input" : "Generative pulse"}
                </p>
              )}
            </div>

            <IconBtn label="Microphone" onClick={onMic}>
              <Mic className="size-4" />
            </IconBtn>
            <IconBtn label="Upload track" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" />
            </IconBtn>
            <IconBtn
              label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={onFullscreen}
            >
              {fullscreen ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </IconBtn>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-3">
              <span className="w-20 shrink-0 text-xs font-medium tracking-wide text-muted">
                Sensitivity
              </span>
              <input
                type="range"
                min={0.4}
                max={2.4}
                step={0.01}
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
                className="range-input"
              />
            </label>
            {source !== "mic" ? (
              <label className="flex min-w-0 flex-1 items-center gap-3">
                <span className="w-20 shrink-0 text-xs font-medium tracking-wide text-muted">
                  Volume
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="range-input"
                />
              </label>
            ) : null}
          </div>
        </div>
      </footer>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac"
        className="hidden"
        suppressHydrationWarning
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
    </>
  );
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "pressable min-h-11 rounded-lg px-3 text-xs font-medium tracking-wide sm:min-h-8",
        active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}

function SourceButton({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: typeof Mic;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium",
        primary ? "bg-accent text-accent-fg" : "hud-panel text-fg",
      )}
    >
      <Icon className={cn("size-4", primary && "translate-x-px")} />
      {label}
    </button>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="pressable flex size-11 shrink-0 items-center justify-center rounded-lg text-fg hover:bg-surface-2"
    >
      {children}
    </button>
  );
}
