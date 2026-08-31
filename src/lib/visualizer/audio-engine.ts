import type { SourceKind } from "./types";

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor {
  const w = globalThis as typeof globalThis & {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) throw new Error("Web Audio is not supported in this browser.");
  return Ctor;
}

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * 1;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

const ARP = [110, 130.81, 146.83, 164.81, 196, 220, 246.94, 293.66];

export class AudioEngine {
  ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  audioEl: HTMLAudioElement | null = null;

  private sourceGain: GainNode | null = null;
  private outputGain: GainNode | null = null;
  private freqData: Uint8Array | null = null;
  private timeData: Uint8Array | null = null;

  private mediaSource: MediaElementAudioSourceNode | null = null;
  private objectUrl: string | null = null;

  private micSource: MediaStreamAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;

  private demoNodes: AudioScheduledSourceNode[] = [];
  private demoCleanup: (() => void) | null = null;
  private demoGain: GainNode | null = null;

  kind: SourceKind = "idle";
  private volume = 0.85;

  ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const Ctor = getAudioContextCtor();
    const ctx = new Ctor({ latencyHint: "interactive" });
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.78;
    analyser.minDecibels = -88;
    analyser.maxDecibels = -18;

    const sourceGain = ctx.createGain();
    sourceGain.gain.value = 1;
    const outputGain = ctx.createGain();
    outputGain.gain.value = this.volume * this.volume;

    sourceGain.connect(analyser);
    sourceGain.connect(outputGain);
    outputGain.connect(ctx.destination);

    this.ctx = ctx;
    this.analyser = analyser;
    this.sourceGain = sourceGain;
    this.outputGain = outputGain;
    this.freqData = new Uint8Array(analyser.frequencyBinCount);
    this.timeData = new Uint8Array(analyser.fftSize);
    return ctx;
  }

  resume(): void {
    const ctx = this.ensure();
    if (ctx.state === "suspended") void ctx.resume();
  }

  setVolume(v: number): void {
    this.volume = v;
    const ctx = this.ctx;
    const out = this.outputGain;
    if (!ctx || !out) return;
    const target = this.kind === "mic" ? 0 : v * v;
    out.gain.setTargetAtTime(target, ctx.currentTime, 0.03);
  }

  getFrequencyData(): Uint8Array | null {
    if (!this.analyser || !this.freqData) return null;
    this.analyser.getByteFrequencyData(this.freqData as unknown as Uint8Array<ArrayBuffer>);
    return this.freqData;
  }

  getTimeData(): Uint8Array | null {
    if (!this.analyser || !this.timeData) return null;
    this.analyser.getByteTimeDomainData(this.timeData as unknown as Uint8Array<ArrayBuffer>);
    return this.timeData;
  }

  private muteOutput(mute: boolean): void {
    const ctx = this.ctx;
    const out = this.outputGain;
    if (!ctx || !out) return;
    const target = mute ? 0 : this.volume * this.volume;
    out.gain.setTargetAtTime(target, ctx.currentTime, 0.02);
  }

  private stopMic(): void {
    this.micSource?.disconnect();
    this.micSource = null;
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
  }

  private stopDemo(): void {
    this.demoCleanup?.();
    this.demoCleanup = null;
    for (const node of this.demoNodes) {
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.demoNodes = [];
    this.demoGain?.disconnect();
    this.demoGain = null;
  }

  private pauseFile(): void {
    if (this.audioEl && !this.audioEl.paused) this.audioEl.pause();
  }

  stopAll(): void {
    this.stopMic();
    this.stopDemo();
    this.pauseFile();
    this.kind = "idle";
    this.muteOutput(false);
  }

  async startMic(): Promise<void> {
    this.resume();
    this.stopDemo();
    this.pauseFile();
    this.stopMic();
    this.muteOutput(true);
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const ctx = this.ctx!;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(this.sourceGain!);
    this.micStream = stream;
    this.micSource = source;
    this.kind = "mic";
  }

  async loadFile(file: File): Promise<HTMLAudioElement> {
    this.resume();
    this.stopMic();
    this.stopDemo();
    const ctx = this.ctx!;
    if (!this.audioEl) {
      const el = new Audio();
      el.crossOrigin = "anonymous";
      el.preload = "auto";
      this.mediaSource = ctx.createMediaElementSource(el);
      this.mediaSource.connect(this.sourceGain!);
      this.audioEl = el;
    }
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);
    this.audioEl.src = this.objectUrl;
    this.audioEl.currentTime = 0;
    this.kind = "file";
    this.muteOutput(false);
    await this.audioEl.play();
    return this.audioEl;
  }

  async playFile(): Promise<void> {
    if (!this.audioEl) return;
    this.resume();
    this.kind = "file";
    this.muteOutput(false);
    await this.audioEl.play();
  }

  pause(): void {
    if (this.kind === "file") {
      this.pauseFile();
      return;
    }
    if (this.kind === "demo") {
      this.demoGain?.gain.setTargetAtTime(0, this.ctx?.currentTime ?? 0, 0.04);
      if (this.ctx?.state === "running") void this.ctx.suspend();
    }
  }

  async resumePlayback(): Promise<void> {
    this.resume();
    if (this.kind === "file") {
      await this.audioEl?.play();
    }
    if (this.kind === "demo") {
      this.demoGain?.gain.setTargetAtTime(0.9, this.ctx?.currentTime ?? 0, 0.04);
    }
  }

  seek(t: number): void {
    if (this.audioEl) this.audioEl.currentTime = t;
  }

  startDemo(): void {
    this.resume();
    this.stopMic();
    this.pauseFile();
    this.stopDemo();
    const ctx = this.ctx!;
    this.kind = "demo";
    this.muteOutput(false);

    const demoGain = ctx.createGain();
    demoGain.gain.value = 0.9;
    demoGain.connect(this.sourceGain!);
    this.demoGain = demoGain;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 720;
    filter.Q.value = 3.2;
    filter.connect(demoGain);

    const padGain = ctx.createGain();
    padGain.gain.value = 0.045;
    padGain.connect(filter);

    const pad = ctx.createOscillator();
    pad.type = "sawtooth";
    pad.frequency.value = 55;
    const pad2 = ctx.createOscillator();
    pad2.type = "sawtooth";
    pad2.frequency.value = 55.4;
    pad.connect(padGain);
    pad2.connect(padGain);

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.18;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 480;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const noiseBuf = createNoiseBuffer(ctx);

    pad.start();
    pad2.start();
    lfo.start();
    this.demoNodes.push(pad, pad2, lfo);

    let step = 0;
    let next = ctx.currentTime + 0.05;
    let timer: number | null = null;
    let stopped = false;

    const schedule = () => {
      if (stopped || !this.ctx) return;
      const now = this.ctx.currentTime;
      while (next < now + 0.25) {
        this.scheduleKick(next, demoGain);
        if (step % 2 === 1) this.scheduleHat(next, noiseBuf, demoGain);
        if (step % 4 !== 3) this.scheduleArp(next, step, demoGain);
        next += 0.5;
        step += 1;
      }
    };

    schedule();
    timer = window.setInterval(schedule, 80);

    this.demoCleanup = () => {
      stopped = true;
      if (timer != null) window.clearInterval(timer);
      padGain.disconnect();
      filter.disconnect();
      lfoGain.disconnect();
    };
  }

  private scheduleKick(when: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(128, when);
    osc.frequency.exponentialRampToValueAtTime(42, when + 0.18);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.7, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.28);
    osc.connect(g);
    g.connect(dest);
    osc.start(when);
    osc.stop(when + 0.3);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private scheduleHat(when: number, buf: AudioBuffer, dest: AudioNode): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "highpass";
    bp.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.12, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
    src.connect(bp);
    bp.connect(g);
    g.connect(dest);
    src.start(when);
    src.stop(when + 0.08);
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      g.disconnect();
    };
  }

  private scheduleArp(when: number, step: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const freq = ARP[step % ARP.length] ?? 220;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq * 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.09, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.36);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1800;
    osc.connect(f);
    f.connect(g);
    g.connect(dest);
    osc.start(when);
    osc.stop(when + 0.4);
    osc.onended = () => {
      osc.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }

  dispose(): void {
    this.stopAll();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    void this.ctx?.close();
    this.ctx = null;
  }
}

export const audioEngine = new AudioEngine();
