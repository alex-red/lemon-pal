// A short two-note chime made with Web Audio, so there's no audio file to license or load.
// iOS Safari only plays sound from an AudioContext unlocked by a tap, so call unlockDing() in a tap handler.

let context: AudioContext | null = null;

export function unlockDing() {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
  } catch {
    // No Web Audio: the Paid screen still shows.
  }
}

export function playDing() {
  if (!context || context.state !== "running") return;
  const now = context.currentTime;
  [880, 1318.5].forEach((frequency, i) => {
    const osc = context!.createOscillator();
    const gain = context!.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    const start = now + i * 0.12;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.4, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
    osc.connect(gain).connect(context!.destination);
    osc.start(start);
    osc.stop(start + 0.65);
  });
}
