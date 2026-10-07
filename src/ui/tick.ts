// 089: a very short, quiet click for the day strip and the time wheel, one per step, like the iPhone's own wheels.
// Web pages can't use the system's wheel sound or haptics (iOS has no vibrate for the web), so this is a tiny
// synthesized tick. It stays silent until the first touch has unlocked audio, and when the phone's mute switch is on.
let ctx: AudioContext | null = null;

/** Call from a touch or pointer-down: iOS only lets audio start after a gesture. */
export function unlockTick(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* no audio: the strip still works */ }
}

export function tick(): void {
  try {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1800, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.001); // a soft click, not a beep
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.015);
  } catch { /* ignore */ }
}
