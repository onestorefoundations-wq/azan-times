/**
 * audioService.ts
 * Adhan/Iqamah alert playback. Mirrors flutter_app/lib/core/audio_service.dart.
 * Browsers block autoplay until a user gesture, so call unlock() on first tap.
 */

let player: HTMLAudioElement | null = null;
let enabled = true;
let unlocked = false;
// Bumped by every playAlert and stop, so a finished playback can tell whether
// it is still the current one before reporting completion.
let playToken = 0;

export const AudioService = {
  setEnabled(value: boolean): void {
    enabled = value;
    if (!value) AudioService.stop();
  },

  /** Call from a user-gesture handler to satisfy autoplay policies. */
  unlock(): void {
    if (unlocked) return;
    unlocked = true;
    // Prime a silent element so subsequent .play() calls are allowed.
    try {
      const a = new Audio();
      a.muted = true;
      void a.play().catch(() => {});
    } catch {
      /* ignore */
    }
  },

  /**
   * Plays [filename] through [repeats] times.
   *
   * [onComplete] fires only when the last repeat has actually finished playing,
   * and only if no newer alert has started since -- callers use it to clear the
   * alert overlay when the adhan ends. It is deliberately not called when audio
   * is disabled or the browser blocks playback: nothing played, so there is no
   * end to dismiss on, and the caller's own timeout stays in charge.
   */
  async playAlert(filename: string, repeats = 1, onComplete?: () => void): Promise<void> {
    if (!enabled) return;
    const count = Math.max(1, Math.min(10, Math.round(repeats)));
    const token = ++playToken;
    try {
      player?.pause();
      player = null;
      const a = new Audio(`/audio/${filename}`);
      let played = 0;
      a.addEventListener('ended', () => {
        if (token !== playToken) return;
        played += 1;
        if (played < count) {
          a.currentTime = 0;
          void a.play().catch((e) => console.warn('[Audio] repeat blocked:', e));
          return;
        }
        onComplete?.();
      });
      let blocked = false;
      await a.play().catch((e) => {
        blocked = true;
        console.warn('[Audio] play blocked:', e);
      });
      if (blocked) return;
      player = a;
    } catch (e) {
      console.warn('[Audio] failed to play', filename, e);
    }
  },

  stop(): void {
    playToken += 1; // invalidate any pending completion callback
    try {
      player?.pause();
    } catch {
      /* ignore */
    }
  },

  dispose(): void {
    AudioService.stop();
    player = null;
  },
};
