/**
 * Der Snapshot-Parser gegen den echten Nodesignal-Feed.
 *
 * Beide Fälle hier stammen aus dem Abruf vom 04.09.2026: Der Feed schreibt
 * Gedankenstriche als numerische Entity und trägt zwei npubs in den Shownotes,
 * von denen der erste einem Gast gehört.
 */
import { describe, expect, it } from 'vitest';
import { parseSnapshot } from '../../src/feed/snapshot-parse.js';

const STAND = '2026-09-04T18:00:00.000Z';

function feed(items: string, kanal = ''): string {
  return `<rss><channel><title>Nodesignal</title>${kanal}${items}</channel></rss>`;
}

describe('parseSnapshot', () => {
  it('löst numerische Entities im Titel auf', () => {
    const xml = feed(
      `<item><title>Nodesignal-Talk &#8211; E289 &#8211; Keine Angst</title>
       <enclosure url="https://example.test/e289.mp3"/></item>`,
    );
    expect(parseSnapshot(xml, STAND).episodes[0].title).toBe(
      'Nodesignal-Talk – E289 – Keine Angst',
    );
  });

  it('löst hexadezimale Entities auf', () => {
    const xml = feed(
      `<item><title>Schr&#xF6;dingers Node</title>
       <enclosure url="https://example.test/a.mp3"/></item>`,
    );
    expect(parseSnapshot(xml, STAND).episodes[0].title).toBe('Schrödingers Node');
  });

  it('liest den npub nur aus podcast:txt, nicht aus den Shownotes', () => {
    const gast = 'npub1ftkd33ca43qgpfzq7ha2rjgyrgah0vsjgqm3z66leaanrfzstmuskgtpnw';
    const xml = feed(
      `<item><title>Folge</title><description>Folgt uns: ${gast}</description>
       <enclosure url="https://example.test/a.mp3"/></item>`,
    );
    expect(parseSnapshot(xml, STAND).npub).toBeUndefined();
  });

  it('nimmt den npub aus podcast:txt mit purpose="nostr"', () => {
    const podcast = 'npub1n0devk3h2l3rx6vmt24a3lz4hsxp7j8rn3x44jkx6daj7j8jzc0q2u02cy';
    const xml = feed(
      '<item><title>Folge</title><enclosure url="https://example.test/a.mp3"/></item>',
      `<podcast:txt purpose="nostr">${podcast}</podcast:txt>`,
    );
    expect(parseSnapshot(xml, STAND).npub).toBe(podcast);
  });

  it('überspringt Beiträge ohne Enclosure — der Feed führt zwei davon', () => {
    const xml = feed(
      `<item><title>Nur Video</title><guid>a</guid></item>
       <item><title>Mit Audio</title><enclosure url="https://example.test/a.mp3"/></item>`,
    );
    const snapshot = parseSnapshot(xml, STAND);
    expect(snapshot.episodes).toHaveLength(1);
    expect(snapshot.episodes[0].title).toBe('Mit Audio');
  });
});
