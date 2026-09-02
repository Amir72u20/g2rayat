/**
 * Tone control for background music.
 *
 * An <audio> element gives us playback rate and volume for free; bass and
 * treble need Web Audio. The graph is built lazily around an element and cached
 * per element, because an element can only ever have one MediaElementSource.
 */

export interface ToneChain {
  bass: BiquadFilterNode;
  treble: BiquadFilterNode;
  ctx: AudioContext;
}

const chains = new WeakMap<HTMLMediaElement, ToneChain>();

type WindowWithAudio = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

export function toneChain(el: HTMLMediaElement): ToneChain | null {
  const cached = chains.get(el);
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  const w = window as WindowWithAudio;
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    const ctx = new Ctor();
    const source = ctx.createMediaElementSource(el);
    const bass = ctx.createBiquadFilter();
    bass.type = "lowshelf";
    bass.frequency.value = 220;
    const treble = ctx.createBiquadFilter();
    treble.type = "highshelf";
    treble.frequency.value = 3200;
    source.connect(bass);
    bass.connect(treble);
    treble.connect(ctx.destination);
    const chain = { ctx, bass, treble };
    chains.set(el, chain);
    return chain;
  } catch {
    // Autoplay policies or an unsupported browser: playback still works, it
    // just plays flat.
    return null;
  }
}

/** Apply speed and tone to a playing element; safe to call on every change. */
export function applyTone(
  el: HTMLMediaElement,
  opts: { speed?: number; bass?: number; treble?: number },
) {
  const speed = opts.speed ?? 1;
  el.playbackRate = Math.min(4, Math.max(0.25, speed || 1));
  const wantsTone = !!(opts.bass || opts.treble);
  if (!wantsTone && !chains.has(el)) return;
  const chain = toneChain(el);
  if (!chain) return;
  chain.bass.gain.value = Math.min(12, Math.max(-12, opts.bass ?? 0));
  chain.treble.gain.value = Math.min(12, Math.max(-12, opts.treble ?? 0));
  if (chain.ctx.state === "suspended") void chain.ctx.resume().catch(() => undefined);
}
