/**
 * SFR-06, SFR-08, SFR-09: die Episodenliste.
 *
 * Grundlage ist der Snapshot aus dem Build — zur Bauzeit gibt es keine
 * Same-Origin-Policy, damit ist der CORS-Fall gelöst, für den `cashu-player`
 * einen Proxy brauchte. Zur Laufzeit versucht die App zusätzlich einen direkten
 * Abruf; scheitert er, bleibt der Build-Stand sichtbar und sein Datum wird
 * genannt, statt eine leere Liste zu zeigen.
 */
import { EPISODES_VISIBLE, FEED_URL } from '../config/build-config.js';
import type { EpisodeRecord } from '../db/database.js';
import { parseSnapshot, type FeedSnapshot } from './snapshot-parse.js';

/** Ein einziger Podcast — die Feed-ID ist konstant. */
export const FEED_ID = 'nodesignal';

export interface LoadedEpisodes {
  episodes: EpisodeRecord[];
  /** True, wenn der Laufzeit-Abruf scheiterte und der Build-Stand gilt. */
  stale: boolean;
  /** Datum des angezeigten Stands, ISO. */
  fetchedAt: string;
  imageUrl?: string;
  title: string;
}

export function toEpisodeRecords(snapshot: FeedSnapshot): EpisodeRecord[] {
  return [...snapshot.episodes]
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, EPISODES_VISIBLE)
    .map((episode) => ({
      id: `${FEED_ID}::${episode.guid}`,
      feedId: FEED_ID,
      title: episode.title,
      description: episode.description,
      enclosureUrl: episode.enclosureUrl,
      publishedAt: episode.publishedAt,
      durationSeconds: episode.durationSeconds,
      guid: episode.guid,
    }));
}

export interface LoadOptions {
  fetchImpl?: typeof fetch;
  feedUrl?: string;
}

export async function loadEpisodes(
  snapshot: FeedSnapshot,
  options: LoadOptions = {},
): Promise<LoadedEpisodes> {
  const feedUrl = options.feedUrl ?? FEED_URL;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);

  const ausSnapshot: LoadedEpisodes = {
    episodes: toEpisodeRecords(snapshot),
    stale: true,
    fetchedAt: snapshot.fetchedAt,
    imageUrl: snapshot.imageUrl,
    title: snapshot.title,
  };

  // Ohne Feed-URL gibt es nichts abzurufen — der Build-Stand ist alles.
  if (feedUrl === '') return ausSnapshot;

  try {
    const response = await fetchImpl(feedUrl);
    if (!response.ok) return ausSnapshot;
    const frisch = parseSnapshot(await response.text(), new Date().toISOString());
    return {
      episodes: toEpisodeRecords(frisch),
      stale: false,
      fetchedAt: frisch.fetchedAt,
      imageUrl: frisch.imageUrl ?? snapshot.imageUrl,
      title: frisch.title,
    };
  } catch {
    // Der haeufigste Fall im Browser: fehlende CORS-Header. Kein Fehler fuer
    // den Nutzer, nur ein aelterer Stand — deshalb nur `stale`, keine Ausnahme.
    return ausSnapshot;
  }
}
