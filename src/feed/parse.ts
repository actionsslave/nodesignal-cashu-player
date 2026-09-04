/**
 * RSS-2.0-Parser mit iTunes- und Podcast-Namespace (FR-07, FR-10, FR-21).
 * Nutzt den DOMParser des Browsers — für RSS braucht es keine Bibliothek.
 */
import { decode } from 'nostr-tools/nip19';
import { EPISODES_PER_FEED } from '../config/build-config.js';
import { ITUNES_NS, PODCAST_NS } from './namespaces.js';

export class FeedParseError extends Error {
  readonly name = 'FeedParseError';
  constructor(message = 'Kein gültiger Podcast-Feed') {
    super(message);
  }
}

export interface ParsedEpisode {
  /** guid des Items, sonst die Enclosure-URL. */
  guid: string;
  title: string;
  description: string;
  enclosureUrl: string;
  publishedAt: number;
  durationSeconds?: number;
}

export interface ValueRecipient {
  name?: string;
  type?: string;
  address?: string;
  split?: number;
}

export interface ValueBlock {
  type?: string;
  method?: string;
  suggested?: string;
  recipients: ValueRecipient[];
}

export interface ParsedFeed {
  title: string;
  description: string;
  imageUrl?: string;
  podcastGuid?: string;
  /** FR-21: nostr-Identität des Podcasts, Primärquelle podcast:txt purpose="nostr". */
  npub?: string;
  value?: ValueBlock;
  /**
   * Anzahl aller Items im Feed, vor dem Zuschnitt auf EPISODES_PER_FEED.
   * Eine Angabe ueber den Feed, kein Versprechen ueber den lokalen Bestand.
   */
  totalEpisodes: number;
  episodes: ParsedEpisode[];
}

function text(element: Element | null | undefined): string | undefined {
  const value = element?.textContent?.trim();
  return value ? value : undefined;
}

/** Direktes Kind, damit ein <item> vor dem Channel-Titel nichts verfälscht. */
function child(parent: Element, tagName: string): Element | undefined {
  for (const element of parent.children) {
    if (element.tagName === tagName) return element;
  }
  return undefined;
}

/**
 * Direkte Kinder im Podcast-Namespace. Direkte Kinder deshalb, weil FR-21
 * podcast:txt ausdrücklich auf Channel-Ebene liest — ein gleichnamiges Element
 * in einer Episode darf den Empfänger des Podcasts nicht überschreiben.
 */
function childrenNs(parent: Element, localName: string): Element[] {
  return [...parent.children].filter(
    (element) => element.localName === localName && PODCAST_NS.includes(element.namespaceURI ?? ''),
  );
}

function firstNs(parent: Element, localName: string): Element | undefined {
  return childrenNs(parent, localName)[0];
}

function allNs(parent: Element, localName: string): Element[] {
  return childrenNs(parent, localName);
}

/** itunes:duration kommt als Sekunden, mm:ss oder hh:mm:ss. */
export function parseDuration(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const parts = raw.split(':').map((part) => Number(part.trim()));
  if (parts.some((part) => !Number.isFinite(part))) return undefined;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return seconds > 0 ? seconds : undefined;
}

/** Nur ein echter npub zählt; alles andere wird verworfen (FR-21). */
function readNpub(channel: Element): string | undefined {
  for (const element of allNs(channel, 'txt')) {
    if (element.getAttribute('purpose') !== 'nostr') continue;
    const candidate = text(element);
    if (!candidate) continue;
    try {
      if (decode(candidate).type === 'npub') return candidate;
    } catch {
      // Kein gültiger bech32-npub — weitersuchen.
    }
  }
  return undefined;
}

function readValue(channel: Element): ValueBlock | undefined {
  const block = firstNs(channel, 'value');
  if (!block) return undefined;
  return {
    type: block.getAttribute('type') ?? undefined,
    method: block.getAttribute('method') ?? undefined,
    suggested: block.getAttribute('suggested') ?? undefined,
    recipients: allNs(block, 'valueRecipient').map((recipient) => ({
      name: recipient.getAttribute('name') ?? undefined,
      type: recipient.getAttribute('type') ?? undefined,
      address: recipient.getAttribute('address') ?? undefined,
      split: recipient.hasAttribute('split')
        ? Number(recipient.getAttribute('split'))
        : undefined,
    })),
  };
}

function readEpisodes(channel: Element): ParsedEpisode[] {
  const episodes: ParsedEpisode[] = [];
  for (const item of channel.getElementsByTagName('item')) {
    const enclosureUrl = item.getElementsByTagName('enclosure')[0]?.getAttribute('url');
    // Ohne Enclosure gibt es nichts abzuspielen.
    if (!enclosureUrl) continue;

    const published = text(item.getElementsByTagName('pubDate')[0]);
    episodes.push({
      guid: text(item.getElementsByTagName('guid')[0]) ?? enclosureUrl,
      title: text(item.getElementsByTagName('title')[0]) ?? 'Ohne Titel',
      description:
        text(item.getElementsByTagName('description')[0]) ??
        text(item.getElementsByTagNameNS(ITUNES_NS, 'summary')[0]) ??
        '',
      enclosureUrl,
      publishedAt: published ? Date.parse(published) : 0,
      durationSeconds: parseDuration(text(item.getElementsByTagNameNS(ITUNES_NS, 'duration')[0])),
    });
  }

  return episodes.sort((a, b) => b.publishedAt - a.publishedAt);
}

export function parseFeed(xml: string): ParsedFeed {
  const document = new DOMParser().parseFromString(xml, 'text/xml');
  if (document.getElementsByTagName('parsererror').length > 0) {
    throw new FeedParseError();
  }

  const channel = document.querySelector('rss > channel');
  if (!channel) throw new FeedParseError();

  const title = text(child(channel, 'title'));
  if (!title) throw new FeedParseError();

  // Erst alle Episoden, dann der Zuschnitt: die Gesamtzahl gehoert in die
  // Abo-Zeile (FR-09) und waere nach dem Slice nicht mehr zu haben.
  const alle = readEpisodes(channel);

  return {
    title,
    description: text(child(channel, 'description')) ?? '',
    imageUrl:
      channel.getElementsByTagNameNS(ITUNES_NS, 'image')[0]?.getAttribute('href') ??
      text(channel.querySelector('image > url')),
    podcastGuid: text(firstNs(channel, 'guid')),
    npub: readNpub(channel),
    value: readValue(channel),
    totalEpisodes: alle.length,
    episodes: alle.slice(0, EPISODES_PER_FEED),
  };
}
