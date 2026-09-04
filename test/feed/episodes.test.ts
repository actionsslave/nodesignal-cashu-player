import { describe, expect, it, vi } from 'vitest';
import { loadEpisodes, toEpisodeRecords } from '../../src/feed/episodes.js';
import type { FeedSnapshot } from '../../src/feed/snapshot-parse.js';

const SNAPSHOT: FeedSnapshot = {
  title: 'Nodesignal',
  episodes: [
    { guid: 'e-2', title: 'Folge 2', description: 'Zwei', enclosureUrl: 'https://a/2.mp3', publishedAt: 2000, durationSeconds: 3600 },
    { guid: 'e-1', title: 'Folge 1', description: 'Eins', enclosureUrl: 'https://a/1.mp3', publishedAt: 1000 },
  ],
  fetchedAt: '2026-09-04T00:00:00.000Z',
};

describe('SFR-06: Episoden aus dem Snapshot', () => {
  it('erzeugt Datensätze mit stabiler ID aus der guid', () => {
    const records = toEpisodeRecords(SNAPSHOT);
    expect(records[0]).toMatchObject({ id: 'nodesignal::e-2', title: 'Folge 2', durationSeconds: 3600 });
  });

  it('sortiert absteigend nach Datum', () => {
    const gedreht = { ...SNAPSHOT, episodes: [...SNAPSHOT.episodes].reverse() };
    expect(toEpisodeRecords(gedreht).map((e) => e.title)).toEqual(['Folge 2', 'Folge 1']);
  });

  it('zeigt höchstens EPISODES_VISIBLE Episoden', () => {
    const viele = {
      ...SNAPSHOT,
      episodes: Array.from({ length: 40 }, (_u, i) => ({
        guid: `g-${i}`,
        title: `Folge ${i}`,
        description: '',
        enclosureUrl: `https://a/${i}.mp3`,
        publishedAt: i,
      })),
    };
    expect(toEpisodeRecords(viele)).toHaveLength(20);
  });
});

describe('SFR-09: Laufzeit-Abruf mit Rückfall', () => {
  it('nimmt den frischen Feed, wenn der Abruf gelingt', async () => {
    const xml = `<rss><channel><title>Nodesignal</title><item><title>Neu</title>
      <guid>e-9</guid><enclosure url="https://a/9.mp3"/><pubDate>Wed, 03 Sep 2026 10:00:00 +0000</pubDate>
      </item></channel></rss>`;
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(xml, { status: 200 }));

    const result = await loadEpisodes(SNAPSHOT, { fetchImpl, feedUrl: 'https://feed.example/rss' });

    expect(result.stale).toBe(false);
    expect(result.episodes[0].title).toBe('Neu');
  });

  it('bleibt beim Build-Stand, wenn der Abruf scheitert, und nennt sein Datum', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await loadEpisodes(SNAPSHOT, { fetchImpl, feedUrl: 'https://feed.example/rss' });

    // SFR-09: der letzte Stand bleibt sichtbar, sein Datum wird genannt.
    expect(result.stale).toBe(true);
    expect(result.fetchedAt).toBe('2026-09-04T00:00:00.000Z');
    expect(result.episodes.map((e) => e.title)).toEqual(['Folge 2', 'Folge 1']);
  });

  it('bleibt beim Build-Stand bei einem HTTP-Fehler', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('weg', { status: 500 }));
    const result = await loadEpisodes(SNAPSHOT, { fetchImpl, feedUrl: 'https://feed.example/rss' });
    expect(result.stale).toBe(true);
  });

  it('versucht ohne Feed-URL gar nicht erst abzurufen', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await loadEpisodes(SNAPSHOT, { fetchImpl, feedUrl: '' });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.stale).toBe(true);
  });
});
