/**
 * Der Feed-Parser, geteilt zwischen Bauzeit und Laufzeit.
 *
 * Bewusst ohne Node-Importe: Zur Bauzeit holt `tools/feed-snapshot.ts` den
 * Feed und schreibt das JSON, zur Laufzeit ruft `episodes.ts` denselben Parser
 * fuer den Abruf aus SFR-09 auf. Lagen beide in derselben Datei, zoege der
 * Browser `node:fs` mit herein und die Seite bliebe leer — genau das ist
 * einmal passiert.
 *
 * Er kommt ohne DOMParser aus, weil er unter Node laufen muss.
 */
import { EPISODES_PER_FEED } from '../config/build-config.js';

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
    // Der echte Feed schreibt Gedankenstriche als &#8211;. Ohne diese Zeile
    // stuenden die Entities woertlich in den Episodentiteln.
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dez: string) => String.fromCodePoint(Number(dez)))
    .trim();
}

/**
 * Die Audiodatei aus einem eingebetteten `<audio>`-Element.
 *
 * Nicht jeder Beitrag traegt ein `<enclosure>`: Die neuesten Nodesignal-Folgen
 * kamen ueber den Audio-Shortcode von WordPress herein, der den Ton in den
 * Beitragstext legt. Ohne diesen Rueckgriff fehlten im Player genau die
 * aktuellen Folgen.
 *
 * Gesucht wird ausschliesslich innerhalb des `<audio>`-Blocks. Ein mp3-Link in
 * den Shownotes ist eine Empfehlung, keine Folge — er darf hier nicht landen.
 */
export function embeddedAudioUrl(item: string): string | undefined {
  const block = /<audio[^>]*>[\s\S]*?<\/audio>/i.exec(decode(item));
  if (!block) return undefined;
  const inhalt = block[0];
  return (
    /<source[^>]*\ssrc="([^"]+)"/i.exec(inhalt)?.[1] ??
    /<audio[^>]*\ssrc="([^"]+)"/i.exec(inhalt)?.[1]
  );
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
    // Das Enclosure ist die erklaerte Datei und geht vor.
    const enclosureUrl = attr(item, 'enclosure', 'url') ?? embeddedAudioUrl(item);
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
    // Nur die erklaerte Identitaet zaehlt (FR-21). Der Nodesignal-Feed nennt in
    // den Shownotes auch npubs von Gaesten; ein Treffer irgendwo im XML waere
    // der falsche.
    npub: /<podcast:txt[^>]*purpose="nostr"[^>]*>\s*(npub1[023456789acdefghjklmnpqrstuvwxyz]{58})\s*</i.exec(
      channel,
    )?.[1],
    episodes: episodes
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, EPISODES_PER_FEED),
    fetchedAt,
  };
}
