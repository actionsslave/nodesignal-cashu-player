import type { AudioLike } from '../../src/player/listening-ticker.js';

/**
 * Minimales Audio-Double. Es hält currentTime und feuert timeupdate — mehr
 * braucht der Ticker nicht, und mehr soll er auch nicht brauchen.
 */
export class FakeAudio implements AudioLike {
  currentTime = 0;
  playbackRate = 1;
  paused = true;
  private readonly listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, listener: () => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener();
  }

  /** Spielt `seconds` Sekunden ab: currentTime und Wanduhr laufen gleich weit. */
  play(seconds: number, clock: { now: number }, step = 0.25): void {
    for (let played = 0; played < seconds - 1e-9; played += step) {
      this.currentTime += step;
      clock.now += step * 1000;
      this.emit('timeupdate');
    }
  }

  /** Springt, ohne dass Zeit vergeht. */
  seekTo(position: number, clock: { now: number }): void {
    this.currentTime = position;
    clock.now += 30;
    this.emit('timeupdate');
  }
}
