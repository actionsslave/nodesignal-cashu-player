import { describe, expect, it } from 'vitest';
import { EPISODES_PER_FEED } from '../../src/config/build-config.js';
import { FeedParseError, parseFeed } from '../../src/feed/parse.js';
import { FEED_OHNE_NOSTR, VOLLSTAENDIGER_FEED, feedMitEpisoden } from './fixtures.js';

describe('FR-07: Feed parsen', () => {
  it('US-02-AC-1: liest Titel und Cover des Podcasts', () => {
    const feed = parseFeed(VOLLSTAENDIGER_FEED);
    expect(feed.title).toBe('Testpodcast');
    expect(feed.imageUrl).toBe('https://example.com/cover.jpg');
  });

  it('liest podcast:guid aus dem Podcast-Namespace', () => {
    expect(parseFeed(VOLLSTAENDIGER_FEED).podcastGuid).toBe(
      '917393e3-1b1e-5cef-ace4-edaa54e1f810',
    );
  });

  it('liest podcast:value mit type, method und suggested', () => {
    const value = parseFeed(VOLLSTAENDIGER_FEED).value;
    expect(value).toMatchObject({ type: 'lightning', method: 'keysend', suggested: '0.00000005000' });
  });

  it('liest podcast:valueRecipient mit address und split', () => {
    const recipients = parseFeed(VOLLSTAENDIGER_FEED).value?.recipients ?? [];
    expect(recipients).toHaveLength(1);
    expect(recipients[0]).toMatchObject({ name: 'Host', split: 100 });
  });

  it('US-02-AC-3: weist eine Seite zurück, die kein RSS ist', () => {
    expect(() => parseFeed('<html><body>Keine Ahnung</body></html>')).toThrow(FeedParseError);
  });

  it('US-02-AC-3: weist unlesbares XML zurück', () => {
    expect(() => parseFeed('<<<nicht xml')).toThrow(FeedParseError);
  });

  it('nimmt den Channel-Titel, nicht den einer voranstehenden Episode', () => {
    const feed = `<rss version="2.0"><channel>
      <item><title>Folge X</title>
        <enclosure url="https://example.com/x.mp3" length="1" type="audio/mpeg"/></item>
      <title>Der Podcast</title>
      <description>Beschreibung des Podcasts</description>
    </channel></rss>`;
    const parsed = parseFeed(feed);
    expect(parsed.title).toBe('Der Podcast');
    expect(parsed.description).toBe('Beschreibung des Podcasts');
  });

  it('verlangt mindestens einen Titel im Channel', () => {
    expect(() => parseFeed('<rss version="2.0"><channel></channel></rss>')).toThrow(FeedParseError);
  });
});

describe('FR-21: nostr-Identität aus dem Feed', () => {
  it('liest den npub aus podcast:txt mit purpose="nostr"', () => {
    expect(parseFeed(VOLLSTAENDIGER_FEED).npub).toBe(
      'npub1sn0wdenkukak0d9dfczzeacvhkrgz92ak56egt7vdgzn8pv2wfqqhrjdv9',
    );
  });

  it('US-07-AC-1: liefert keinen npub, wenn der Feed keine nostr-Identität trägt', () => {
    expect(parseFeed(FEED_OHNE_NOSTR).npub).toBeUndefined();
  });

  it('ignoriert podcast:txt mit anderem purpose', () => {
    const feed = `<rss version="2.0" xmlns:podcast="https://podcastindex.org/namespace/1.0">
      <channel><title>T</title>
      <podcast:txt purpose="verify">irgendwas</podcast:txt></channel></rss>`;
    expect(parseFeed(feed).npub).toBeUndefined();
  });

  it('FR-21: liest podcast:txt nur auf Channel-Ebene, nicht aus einer Episode', () => {
    const feed = `<rss version="2.0" xmlns:podcast="https://podcastindex.org/namespace/1.0">
      <channel><title>T</title>
      <item><title>F</title>
        <podcast:txt purpose="nostr">npub1sn0wdenkukak0d9dfczzeacvhkrgz92ak56egt7vdgzn8pv2wfqqhrjdv9</podcast:txt>
        <enclosure url="https://example.com/a.mp3" length="1" type="audio/mpeg"/></item>
      </channel></rss>`;
    expect(parseFeed(feed).npub).toBeUndefined();
  });

  it('ignoriert einen podcast:txt-Wert, der kein npub ist', () => {
    const feed = `<rss version="2.0" xmlns:podcast="https://podcastindex.org/namespace/1.0">
      <channel><title>T</title>
      <podcast:txt purpose="nostr">kein-npub</podcast:txt></channel></rss>`;
    expect(parseFeed(feed).npub).toBeUndefined();
  });
});

describe('FR-09: Gesamtzahl der Episoden im Feed', () => {
  it('zaehlt alle Items, auch die ueber EPISODES_PER_FEED hinaus', () => {
    const parsed = parseFeed(feedMitEpisoden(70));
    expect(parsed.totalEpisodes).toBe(70);
    // Gespeichert wird trotzdem nur der Zuschnitt.
    expect(parsed.episodes).toHaveLength(EPISODES_PER_FEED);
  });

  it('zaehlt bei kleinen Feeds genau die vorhandenen Episoden', () => {
    const parsed = parseFeed(VOLLSTAENDIGER_FEED);
    expect(parsed.totalEpisodes).toBe(2);
    expect(parsed.episodes).toHaveLength(2);
  });
});

describe('FR-10: Episoden', () => {
  it('liest Titel, Beschreibung, Datum, Dauer und Enclosure', () => {
    const [erste] = parseFeed(VOLLSTAENDIGER_FEED).episodes;
    expect(erste).toMatchObject({
      title: 'Folge 2',
      description: 'Die zweite Folge',
      enclosureUrl: 'https://example.com/2.mp3',
      durationSeconds: 3723,
    });
    expect(erste.publishedAt).toBe(Date.parse('Tue, 12 Aug 2025 10:00:00 +0000'));
  });

  it('versteht itunes:duration auch als reine Sekundenzahl', () => {
    const episodes = parseFeed(VOLLSTAENDIGER_FEED).episodes;
    expect(episodes[1].durationSeconds).toBe(630);
  });

  it('sortiert absteigend nach Datum', () => {
    const titles = parseFeed(VOLLSTAENDIGER_FEED).episodes.map((episode) => episode.title);
    expect(titles).toEqual(['Folge 2', 'Folge 1']);
  });

  it('liefert höchstens 50 Episoden', () => {
    expect(parseFeed(feedMitEpisoden(70)).episodes).toHaveLength(50);
  });

  it('überspringt Einträge ohne Enclosure — sie sind nicht abspielbar', () => {
    const feed = `<rss version="2.0"><channel><title>T</title>
      <item><title>Ohne Audio</title></item></channel></rss>`;
    expect(parseFeed(feed).episodes).toEqual([]);
  });

  it('nimmt die guid als Episoden-ID und fällt sonst auf die Enclosure-URL zurück', () => {
    expect(parseFeed(VOLLSTAENDIGER_FEED).episodes[0].guid).toBe('episode-2');
    expect(parseFeed(FEED_OHNE_NOSTR).episodes[0].guid).toBe('https://example.com/a.mp3');
  });
});
