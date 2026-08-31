export function mapSpectrum(
  freq: Uint8Array,
  out: Float32Array,
  sensitivity: number,
): void {
  const n = out.length;
  const len = freq.length;
  if (len < 2) {
    out.fill(0);
    return;
  }
  const logMin = Math.log(1);
  const logMax = Math.log(len - 1);

  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const b0 = Math.max(1, Math.floor(Math.exp(logMin + (logMax - logMin) * t0)));
    const b1 = Math.max(b0 + 1, Math.floor(Math.exp(logMin + (logMax - logMin) * t1)));
    let sum = 0;
    const end = Math.min(b1, len);
    for (let b = b0; b < end; b++) sum += freq[b] ?? 0;
    const avg = sum / Math.max(1, end - b0);
    const bassBoost = 0.82 + 0.32 * (1 - t0);
    out[i] = Math.min(1, (avg / 255) * sensitivity * bassBoost);
  }
}

export function idleSpectrum(out: Float32Array, time: number): void {
  const n = out.length;
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : i / (n - 1);
    const wave =
      0.2 * Math.sin(time * 0.55 + x * 5.4) +
      0.1 * Math.sin(time * 1.15 + x * 12.6) +
      0.07 * Math.sin(time * 0.32 + x * 2.1);
    const envelope =
      Math.exp(-Math.pow((x - 0.16) * 2.5, 2)) * 0.42 +
      Math.exp(-Math.pow((x - 0.52) * 3.1, 2)) * 0.22 +
      Math.exp(-Math.pow((x - 0.84) * 4.2, 2)) * 0.12 +
      0.1;
    out[i] = Math.max(0.035, envelope + wave * 0.14);
  }
}

export function smoothToward(
  current: Float32Array,
  target: Float32Array,
  dt: number,
  rate: number,
): void {
  const k = 1 - Math.exp(-dt * rate);
  for (let i = 0; i < current.length; i++) {
    const c = current[i] ?? 0;
    const t = target[i] ?? 0;
    current[i] = c + (t - c) * k;
  }
}

export function decayPeaks(peaks: Float32Array, values: Float32Array, dt: number, fall: number): void {
  for (let i = 0; i < peaks.length; i++) {
    const v = values[i] ?? 0;
    const p = peaks[i] ?? 0;
    peaks[i] = v > p ? v : Math.max(0, p - fall * dt);
  }
}

export function bandEnergy(values: Float32Array, start: number, end: number): number {
  const a = Math.max(0, Math.floor(start * values.length));
  const b = Math.min(values.length, Math.ceil(end * values.length));
  if (b <= a) return 0;
  let sum = 0;
  for (let i = a; i < b; i++) sum += values[i] ?? 0;
  return sum / (b - a);
}
