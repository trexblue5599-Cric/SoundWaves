import type { RGB, VizMode, VizTheme } from "./types";
import { bandEnergy } from "./spectrum";

export type DrawFrame = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  values: Float32Array;
  peaks: Float32Array;
  timeDomain: Uint8Array | null;
  theme: VizTheme;
  mode: VizMode;
  time: number;
  bass: number;
  energy: number;
  playing: boolean;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function rgba(c: RGB, a: number): string {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}

function barColor(theme: VizTheme, x: number, amp: number): RGB {
  const along = mix(theme.low, theme.high, x);
  return mix(along, theme.mid, Math.min(1, amp * 1.15));
}

function fillTrail(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number): void {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(5,5,6,${alpha})`;
  ctx.fillRect(0, 0, w, h);
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createRadialGradient(
    w * 0.5,
    h * 0.5,
    Math.min(w, h) * 0.2,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.72,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function bloom(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: RGB, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.4, rgba(color, alpha * 0.35));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawNeedle(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  amp: number,
  color: RGB,
  glow: RGB,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const baseW = 1.1 + amp * 2.4;
  const tipW = 0.35 + amp * 0.6;

  ctx.beginPath();
  ctx.moveTo(x0 + nx * baseW, y0 + ny * baseW);
  ctx.lineTo(x0 - nx * baseW, y0 - ny * baseW);
  ctx.lineTo(x1 - nx * tipW, y1 - ny * tipW);
  ctx.lineTo(x1 + nx * tipW, y1 + ny * tipW);
  ctx.closePath();
  ctx.fillStyle = rgba(color, 0.22 + amp * 0.7);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = rgba(color, 0.35 + amp * 0.55);
  ctx.lineWidth = 0.8;
  ctx.stroke();

  const orb = 1.6 + amp * 6.5;
  bloom(ctx, x1, y1, orb * 2.8, glow, 0.12 + amp * 0.28);
  ctx.beginPath();
  ctx.arc(x1, y1, Math.max(1.1, orb * 0.38), 0, Math.PI * 2);
  ctx.fillStyle = rgba([255, 255, 255], 0.45 + amp * 0.5);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x1, y1, orb * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = rgba(glow, 0.55 + amp * 0.35);
  ctx.fill();
}

function drawSpire(frame: DrawFrame): void {
  const { ctx, width: w, height: h, values, peaks, theme, bass } = frame;
  const n = values.length;
  const horizon = h * 0.58;
  const up = h * 0.42;
  const down = h * 0.26;
  const margin = w * 0.07;
  const span = w * 0.86;
  const slot = span / n;

  bloom(ctx, w * 0.5, horizon, w * 0.42, theme.glow, 0.04 + bass * 0.1);

  const hg = ctx.createLinearGradient(margin, 0, margin + span, 0);
  hg.addColorStop(0, "rgba(255,255,255,0)");
  hg.addColorStop(0.5, rgba(theme.glow, 0.35 + bass * 0.25));
  hg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.beginPath();
  ctx.moveTo(margin, horizon);
  ctx.lineTo(margin + span, horizon);
  ctx.strokeStyle = hg;
  ctx.lineWidth = 1;
  ctx.stroke();

  const tips: { x: number; y: number; amp: number }[] = [];

  for (let i = 0; i < n; i++) {
    const amp = values[i] ?? 0;
    const peak = peaks[i] ?? amp;
    const x = margin + (i + 0.5) * slot;
    const t = n === 1 ? 0 : i / (n - 1);
    const color = barColor(theme, t, amp);
    const y1 = horizon - amp * up;
    drawNeedle(ctx, x, horizon, x, y1, amp, color, theme.glow);
    tips.push({ x, y: y1, amp });

    const py = horizon - peak * up;
    ctx.beginPath();
    ctx.arc(x, py, 1.15, 0, Math.PI * 2);
    ctx.fillStyle = rgba(theme.high, 0.25 + peak * 0.5);
    ctx.fill();

    ctx.save();
    ctx.globalAlpha = 0.28;
    const ry = horizon + amp * down;
    drawNeedle(ctx, x, horizon, x, ry, amp * 0.85, color, theme.glow);
    ctx.restore();
  }

  ctx.beginPath();
  let linked = false;
  for (let i = 0; i < tips.length; i++) {
    const a = tips[i]!;
    if (a.amp < 0.62) {
      linked = false;
      continue;
    }
    if (!linked) {
      ctx.moveTo(a.x, a.y);
      linked = true;
    } else {
      const prev = tips[i - 1]!;
      const mx = (prev.x + a.x) / 2;
      const my = Math.min(prev.y, a.y) - 8;
      ctx.quadraticCurveTo(mx, my, a.x, a.y);
    }
  }
  ctx.strokeStyle = rgba(theme.glow, 0.22);
  ctx.lineWidth = 1;
  ctx.stroke();

  const fade = ctx.createLinearGradient(0, horizon, 0, h);
  fade.addColorStop(0, "rgba(5,5,6,0)");
  fade.addColorStop(0.55, "rgba(5,5,6,0.35)");
  fade.addColorStop(1, "rgba(5,5,6,0.88)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, horizon, w, h - horizon);
}

function drawOrbit(frame: DrawFrame): void {
  const { ctx, width: w, height: h, values, peaks, theme, time, bass, energy, timeDomain } = frame;
  const n = values.length;
  const cx = w * 0.5;
  const cy = h * 0.5;
  const maxR = Math.min(w, h) * 0.38;
  const inner = Math.min(w, h) * (0.07 + bass * 0.045);
  const rot = time * 0.12 + energy * 0.4;

  bloom(ctx, cx, cy, maxR * 1.35, theme.glow, 0.05 + bass * 0.12);

  ctx.beginPath();
  ctx.arc(cx, cy, maxR * 1.05, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(theme.mid, 0.12 + energy * 0.12);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, inner * 1.15, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(theme.glow, 0.35 + bass * 0.4);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  for (let i = 0; i < n; i++) {
    const amp = values[i] ?? 0;
    const peak = peaks[i] ?? amp;
    const t = n === 1 ? 0 : i / (n - 1);
    const ang = rot + t * Math.PI * 2;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const r0 = inner;
    const r1 = inner + amp * (maxR - inner);
    const x0 = cx + cos * r0;
    const y0 = cy + sin * r0;
    const x1 = cx + cos * r1;
    const y1 = cy + sin * r1;
    const color = barColor(theme, t, amp);
    drawNeedle(ctx, x0, y0, x1, y1, amp, color, theme.glow);

    const pr = inner + peak * (maxR - inner);
    ctx.beginPath();
    ctx.arc(cx + cos * pr, cy + sin * pr, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = rgba(theme.high, 0.3 + peak * 0.4);
    ctx.fill();
  }

  if (timeDomain && timeDomain.length > 4) {
    ctx.beginPath();
    const steps = 128;
    for (let i = 0; i <= steps; i++) {
      const idx = Math.floor((i / steps) * (timeDomain.length - 1));
      const v = ((timeDomain[idx] ?? 128) - 128) / 128;
      const r = inner * 0.55 + v * inner * 0.45;
      const a = (i / steps) * Math.PI * 2 + time * 0.4;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = rgba(theme.high, 0.35);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  bloom(ctx, cx, cy, inner * 2.2, theme.glow, 0.2 + bass * 0.35);
  ctx.beginPath();
  ctx.arc(cx, cy, inner * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = rgba(theme.high, 0.7);
  ctx.fill();
}

function drawWave(frame: DrawFrame): void {
  const { ctx, width: w, height: h, values, peaks, theme, time, bass, energy } = frame;
  const n = values.length;
  const midY = h * 0.5;
  const ampScale = Math.min(w, h) * 0.35;
  const margin = w * 0.04;
  const span = w * 0.92;
  const slot = span / n;

  bloom(ctx, w * 0.5, midY, w * 0.5, theme.glow, 0.04 + bass * 0.12);

  const hg = ctx.createLinearGradient(margin, 0, margin + span, 0);
  hg.addColorStop(0, "rgba(255,255,255,0)");
  hg.addColorStop(0.5, rgba(theme.glow, 0.3 + bass * 0.25));
  hg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.beginPath();
  ctx.moveTo(margin, midY);
  ctx.lineTo(margin + span, midY);
  ctx.strokeStyle = hg;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  for (let i = 0; i < n; i++) {
    const amp = values[i] ?? 0;
    const peak = peaks[i] ?? amp;
    const x = margin + (i + 0.5) * slot;
    const t = n === 1 ? 0 : i / (n - 1);
    const color = barColor(theme, t, amp);
    const height = amp * ampScale;

    drawNeedle(ctx, x, midY, x, midY - height, amp, color, theme.glow);
    drawNeedle(ctx, x, midY, x, midY + height, amp * 0.85, color, theme.glow);

    const pyTop = midY - peak * ampScale;
    const pyBottom = midY + peak * ampScale;
    ctx.beginPath();
    ctx.arc(x, pyTop, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = rgba(theme.high, 0.25 + peak * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, pyBottom, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = rgba(theme.high, 0.15 + peak * 0.35);
    ctx.fill();
  }

  const scanX = (Math.sin(time * 0.6) * 0.5 + 0.5) * span + margin;
  ctx.beginPath();
  ctx.moveTo(scanX, midY - 20 - bass * 15);
  ctx.lineTo(scanX, midY + 20 + bass * 15);
  ctx.strokeStyle = rgba(theme.high, 0.25 + bass * 0.25);
  ctx.lineWidth = 1.6;
  ctx.shadowColor = rgba(theme.glow, 0.5);
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;

  const fade = ctx.createLinearGradient(0, midY, 0, h);
  fade.addColorStop(0, "rgba(5,5,6,0)");
  fade.addColorStop(0.5, "rgba(5,5,6,0.15)");
  fade.addColorStop(1, "rgba(5,5,6,0.7)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, midY, w, h - midY);
}

export function drawVisualizer(frame: DrawFrame): void {
  const { ctx, width, height, theme, bass, mode } = frame;
  fillTrail(ctx, width, height, 0.24);
  bloom(ctx, width * 0.5, height * 0.5, Math.max(width, height) * 0.45, theme.glow, 0.03 + bass * 0.07);

  if (mode === "spire") drawSpire(frame);
  else if (mode === "orbit") drawOrbit(frame);
  else drawWave(frame);

  vignette(ctx, width, height);
               }
