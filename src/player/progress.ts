/**
 * Hörfortschritt je Episode, abgeleitet aus gespeicherten Positionen.
 *
 * Der Handoff verlangt „42 min left" beziehungsweise „Played" an der
 * Episodenzeile und einen magenta Punkt an Abos mit ungehörten Folgen. Beides
 * ist aus PositionRecord und der Episodendauer ableitbar; es gibt kein eigenes
 * „gehört"-Flag und braucht auch keines.
 */

/** Ab wie wenig Rest eine Episode als gehört gilt. Abspann und Nachspann zählen nicht. */
const PLAYED_THRESHOLD_SECONDS = 30;

export function remainingSeconds(
  durationSeconds: number | undefined,
  positionSeconds: number | undefined,
): number | undefined {
  if (!durationSeconds) return undefined;
  return Math.max(0, durationSeconds - (positionSeconds ?? 0));
}

export function isPlayed(
  durationSeconds: number | undefined,
  positionSeconds: number | undefined,
): boolean {
  if (!durationSeconds || positionSeconds === undefined) return false;
  return durationSeconds - positionSeconds <= PLAYED_THRESHOLD_SECONDS;
}

/** Volle Minuten; Sekunden wären hier Scheingenauigkeit. */
export function formatRemaining(seconds: number): string {
  const minuten = Math.floor(seconds / 60);
  return minuten < 1 ? 'unter 1 Min. übrig' : `${minuten} Min. übrig`;
}

/**
 * Wie viele Folgen eines Abos noch ungehört sind. Treibt den magenta Punkt —
 * im ganzen Entwurf die einzige Verwendung von Magenta.
 */
export function unplayedCount(
  episodes: { id: string; durationSeconds?: number }[],
  positions: Map<string, number>,
): number {
  return episodes.filter((episode) => !isPlayed(episode.durationSeconds, positions.get(episode.id)))
    .length;
}
