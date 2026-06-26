/**
 * audioService.ts
 * Adhan/Iqamah alert playback. Mirrors flutter_app/lib/core/audio_service.dart.
 * Browsers block autoplay until a user gesture, so call unlock() on first tap.
 */

let player: HTMLAudioElement | null = null;
let enabled = true;
let unlocked = false;

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

  async playAlert(filename: string): Promise<void> {
    if (!enabled) return;
    try {
      player?.pause();
      player = null;
      const a = new Audio(`/audio/${filename}`);
      await a.play().catch((e) => console.warn('[Audio] play blocked:', e));
      player = a;
    } catch (e) {
      console.warn('[Audio] failed to play', filename, e);
    }
  },

  stop(): void {
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
