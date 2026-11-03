// ─── WebAudio synth — terminal bleeps & HALCYON room tone ───────────────────
// No audio assets; everything is synthesized. The context is created lazily on
// the first user gesture (browser autoplay policy).

class HalcyonAudio {
  private ctx: AudioContext | null = null;
  private humGain: GainNode | null = null;
  private humOsc: OscillatorNode[] = [];
  enabled = false;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) {
      this.ensure();
      this.startHum();
    } else {
      this.stopHum();
    }
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    delay = 0,
    slideTo?: number
  ) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  tick() {
    this.tone(1720, 0.018, "square", 0.014);
  }

  select() {
    this.tone(880, 0.05, "sine", 0.05);
    this.tone(1318, 0.06, "sine", 0.04, 0.055);
  }

  hover() {
    this.tone(2400, 0.012, "sine", 0.008);
  }

  confirm() {
    this.tone(523, 0.09, "triangle", 0.06);
    this.tone(784, 0.1, "triangle", 0.05, 0.08);
    this.tone(1047, 0.16, "triangle", 0.045, 0.16);
  }

  deny() {
    this.tone(196, 0.16, "sawtooth", 0.05);
    this.tone(147, 0.22, "sawtooth", 0.045, 0.12);
  }

  ping() {
    this.tone(1245, 0.28, "sine", 0.045, 0, 880);
  }

  scan() {
    this.tone(420, 0.5, "sine", 0.02, 0, 1800);
  }

  private startHum() {
    if (this.humGain || !this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    const mk = (freq: number, vol: number) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = vol;
      o.connect(g).connect(gain);
      o.start();
      return o;
    };
    this.humOsc = [mk(52, 0.55), mk(54.5, 0.45), mk(104, 0.18)];
    gain.gain.linearRampToValueAtTime(0.016, ctx.currentTime + 2.5);
    this.humGain = gain;
  }

  private stopHum() {
    if (!this.humGain) return;
    const ctx = this.ctx;
    const gain = this.humGain;
    const oscs = this.humOsc;
    this.humGain = null;
    this.humOsc = [];
    try {
      if (ctx) {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        oscs.forEach((o) => o.stop(ctx.currentTime + 0.5));
      }
    } catch {
      /* noop */
    }
  }
}

export const halcyonAudio = new HalcyonAudio();
