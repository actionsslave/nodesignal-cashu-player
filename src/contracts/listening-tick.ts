/**
 * Vertrag aus Kapitel 5.7: Das Ereignis, das der Player pro tatsächlich gehörter Zeit ausgibt.
 * Abgeleitet aus `currentTime` des Audio-Elements, nicht aus Timer-Ticks (Kapitel 5.6).
 * Betrifft FR-24, FR-25.
 */
export interface ListeningTick {
  feedId: string;
  episodeId: string;
  /** Aktuelle Hörposition in Sekunden (`audio.currentTime`). */
  positionSeconds: number;
  /**
   * Tatsächlich gehörte Sekunden seit dem letzten Tick.
   * Pause und Seek akkumulieren nicht (FR-24, US-05-AC-2).
   */
  listenedSeconds: number;
  /** Zeitpunkt des Ticks in epoch ms. */
  at: number;
}

export type ListeningTickHandler = (tick: ListeningTick) => void;

export interface ListeningTickSource {
  /** Registriert einen Handler; gibt eine Abmeldefunktion zurück. */
  onTick(handler: ListeningTickHandler): () => void;
}
