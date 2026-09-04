/**
 * FR-14: Hörposition je Episode, mindestens alle 10 s persistiert und beim
 * erneuten Öffnen wiederhergestellt.
 */
import { POSITION_PERSIST_INTERVAL_MS } from '../config/build-config.js';
import { openDatabase } from '../db/database.js';
import type { AudioLike } from './listening-ticker.js';

export async function savePosition(episodeId: string, positionSeconds: number): Promise<void> {
  const db = await openDatabase();
  await db.put('positions', { episodeId, positionSeconds, updatedAt: Date.now() });
}

export async function loadPosition(episodeId: string): Promise<number | undefined> {
  const db = await openDatabase();
  return (await db.get('positions', episodeId))?.positionSeconds;
}

export interface PositionPersisterOptions {
  audio: AudioLike;
  episodeId: string;
  now?: () => number;
}

/**
 * Schreibt die Position, während gespielt wird — gedrosselt, weil timeupdate
 * mehrmals pro Sekunde feuert und IndexedDB das nicht braucht.
 */
export class PositionPersister {
  private readonly audio: AudioLike;
  private readonly episodeId: string;
  private readonly now: () => number;
  private lastWrite: number;
  private stopped = false;
  private readonly onTimeUpdate = () => {
    if (this.now() - this.lastWrite < POSITION_PERSIST_INTERVAL_MS) return;
    void this.flush();
  };

  constructor(options: PositionPersisterOptions) {
    this.audio = options.audio;
    this.episodeId = options.episodeId;
    this.now = options.now ?? Date.now;
    this.lastWrite = this.now();
    this.audio.addEventListener('timeupdate', this.onTimeUpdate);
  }

  /** Schreibt sofort — beim Pausieren, beim Episodenwechsel, beim Verlassen. */
  async flush(): Promise<void> {
    if (this.stopped) return;
    this.lastWrite = this.now();
    await savePosition(this.episodeId, this.audio.currentTime);
  }

  stop(): void {
    this.stopped = true;
    this.audio.removeEventListener('timeupdate', this.onTimeUpdate);
  }
}
