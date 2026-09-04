/**
 * Quelle der ListeningTicks (Vertrag aus Kapitel 5.7, Grundlage von FR-24).
 *
 * Die gehörte Zeit kommt aus `currentTime` des Audio-Elements, nicht aus
 * Timer-Ticks (Kapitel 5.6). Ein Sprung erkennt sich daran, dass die Medienzeit
 * weiter springt, als die Wanduhr in derselben Spanne zulässt.
 */
import type {
  ListeningTick,
  ListeningTickHandler,
  ListeningTickSource,
} from '../contracts/index.js';

export interface AudioLike {
  currentTime: number;
  playbackRate: number;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface ListeningTickerOptions {
  audio: AudioLike;
  feedId: string;
  episodeId: string;
  now?: () => number;
}

/**
 * Spielraum in Sekunden zwischen Medienzeit und Wanduhr. Deckt Jitter der
 * timeupdate-Ereignisse ab, ohne einen Sprung von +30 s oder −15 s (FR-12)
 * durchzulassen.
 */
const SEEK_TOLERANCE_SECONDS = 0.5;

export class ListeningTicker implements ListeningTickSource {
  private readonly audio: AudioLike;
  private readonly feedId: string;
  private readonly episodeId: string;
  private readonly now: () => number;
  private readonly handlers = new Set<ListeningTickHandler>();

  private lastMediaTime: number;
  private lastWallTime: number;
  /** Gehörte Zeit unter einer Sekunde, die auf den nächsten Tick wartet. */
  private pending = 0;
  private readonly onTimeUpdate = () => this.sample();

  constructor(options: ListeningTickerOptions) {
    this.audio = options.audio;
    this.feedId = options.feedId;
    this.episodeId = options.episodeId;
    this.now = options.now ?? Date.now;
    this.lastMediaTime = this.audio.currentTime;
    this.lastWallTime = this.now();
    this.audio.addEventListener('timeupdate', this.onTimeUpdate);
  }

  onTick(handler: ListeningTickHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  stop(): void {
    this.audio.removeEventListener('timeupdate', this.onTimeUpdate);
    this.handlers.clear();
  }

  private sample(): void {
    const mediaTime = this.audio.currentTime;
    const wallTime = this.now();
    const mediaDelta = mediaTime - this.lastMediaTime;
    const wallDelta = (wallTime - this.lastWallTime) / 1000;
    const plausible = wallDelta * this.audio.playbackRate + SEEK_TOLERANCE_SECONDS;

    this.lastMediaTime = mediaTime;
    this.lastWallTime = wallTime;

    // Rückwärts oder weiter als die Wanduhr erlaubt: ein Sprung, keine Hörzeit.
    // Der offene Rest bleibt stehen — er wurde ja tatsächlich gehört.
    if (mediaDelta <= 0 || mediaDelta > plausible) return;

    this.pending += mediaDelta;
    if (this.pending < 1) return;

    const tick: ListeningTick = {
      feedId: this.feedId,
      episodeId: this.episodeId,
      positionSeconds: mediaTime,
      listenedSeconds: this.pending,
      at: wallTime,
    };
    this.pending = 0;
    for (const handler of [...this.handlers]) handler(tick);
  }
}
