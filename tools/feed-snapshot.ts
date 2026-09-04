/**
 * SFR-08: Der Feed wird zur Bauzeit abgerufen, geparst und als JSON ins Bundle
 * gelegt. Ein täglicher CI-Lauf baut neu und veröffentlicht.
 *
 * Zur Bauzeit gibt es keine Same-Origin-Policy — damit ist der CORS-Fall, für
 * den `cashu-player` einen Proxy brauchte, für einen einzigen eigenen Podcast
 * vollständig gelöst.
 *
 * Läuft unter Node, nicht im Browser. Der Parser benutzt DOMParser; hier steht
 * deshalb ein eigener, schmaler Parser für genau die Felder, die SFR-06 nennt.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EPISODES_PER_FEED, FEED_URL, hasPlaceholders } from '../src/config/build-config.js';

export interface SnapshotEpisode {
  guid: string;
  title: string;
  description: string;
  enclosureUrl: string;
  publishedAt: number;
  durationSeconds?: number;
}

export interface FeedSnapshot {
  title: string;
  imageUrl?: string;
  npub?: string;
  episodes: SnapshotEpisode[];
  /** SFR-09: Datum des Stands, damit die App es nennen kann. */
  fetchedAt: string;
}

const tag = (xml: string, name: string): string | undefined => {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(xml);
  return match ? decode(match[1].trim()) : undefined;
};

const attr = (xml: string, element: string, name: string): string | undefined => {
  const match = new RegExp(`<${element}[^>]*\\s${name}="([^"]*)"`, 'i').exec(xml);
  return match ? decode(match[1]) : undefined;
};

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

/** hh:mm:ss, mm:ss oder blanke Sekunden — so schreiben Feeds die Dauer. */
export function parseDuration(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parts = value.split(':').map(Number);
  if (parts.some(Number.isNaN)) return undefined;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

export function parseSnapshot(xml: string, fetchedAt: string): FeedSnapshot {
  const channel = xml.slice(0, xml.indexOf('<item')) || xml;
  const items = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map((m) => m[0]);

  const episodes: SnapshotEpisode[] = [];
  for (const item of items) {
    const enclosureUrl = attr(item, 'enclosure', 'url');
    if (!enclosureUrl) continue;
    const published = tag(item, 'pubDate');
    episodes.push({
      guid: tag(item, 'guid') ?? enclosureUrl,
      title: tag(item, 'title') ?? 'Ohne Titel',
      description: tag(item, 'description') ?? tag(item, 'itunes:summary') ?? '',
      enclosureUrl,
      publishedAt: published ? Date.parse(published) : 0,
      durationSeconds: parseDuration(tag(item, 'itunes:duration')),
    });
  }

  return {
    title: tag(channel, 'title') ?? 'Nodesignal',
    imageUrl: attr(channel, 'itunes:image', 'href') ?? tag(channel, 'url'),
    npub: /npub1[023456789acdefghjklmnpqrstuvwxyz]{58}/.exec(xml)?.[0],
    episodes: episodes
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, EPISODES_PER_FEED),
    fetchedAt,
  };
}

const ZIEL = resolve(import.meta.dirname, '..', 'src', 'feed', 'snapshot.json');

async function main(): Promise<void> {
  if (hasPlaceholders()) {
    // Ohne echte Feed-URL gibt es nichts zu holen. Der Build soll trotzdem
    // laufen, damit sich die App vor der Konfiguration entwickeln laesst.
    const leer: FeedSnapshot = {
      title: 'Nodesignal',
      episodes: [],
      fetchedAt: new Date().toISOString(),
    };
    mkdirSync(dirname(ZIEL), { recursive: true });
    writeFileSync(ZIEL, JSON.stringify(leer, null, 2) + '\n');
    process.stdout.write('feed-snapshot: FEED_URL ist ein Platzhalter, leerer Snapshot.\n');
    return;
  }

  const response = await fetch(FEED_URL);
  if (!response.ok) throw new Error(`Feed antwortete mit HTTP ${response.status}.`);
  const snapshot = parseSnapshot(await response.text(), new Date().toISOString());

  mkdirSync(dirname(ZIEL), { recursive: true });
  writeFileSync(ZIEL, JSON.stringify(snapshot, null, 2) + '\n');
  process.stdout.write(`feed-snapshot: ${snapshot.episodes.length} Episoden, Stand ${snapshot.fetchedAt}\n`);
}

// Nur ausfuehren, wenn direkt aufgerufen — die Tests importieren parseSnapshot.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')) {
  await main();
}
