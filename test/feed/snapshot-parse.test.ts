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

  it('überspringt Beiträge, die überhaupt kein Audio nennen', () => {
    const xml = feed(
      `<item><title>Nur Text</title><guid>a</guid><description>Ein Beitrag ohne Ton.</description></item>
       <item><title>Mit Audio</title><enclosure url="https://example.test/a.mp3"/></item>`,
    );
    const snapshot = parseSnapshot(xml, STAND);
    expect(snapshot.episodes).toHaveLength(1);
    expect(snapshot.episodes[0].title).toBe('Mit Audio');
  });

  /*
   * Die drei neuesten Beitraege des Nodesignal-Feeds tragen kein <enclosure>.
   * WordPress hat den Ton stattdessen als Audio-Shortcode in den Text gelegt.
   * Ohne diesen Rueckgriff fehlten im Player genau die aktuellen Folgen.
   */
  it('nimmt die Audiodatei aus einem eingebetteten audio-Element', () => {
    const xml = feed(
      `<item><title>E291</title><description>&lt;audio class="wp-audio-shortcode"&gt;` +
        `&lt;source type="audio/mpeg" src="https://serve.podhome.fm/e291.mp3?_=1" /&gt;` +
        `&lt;/audio&gt;</description></item>`,
    );
    const episodes = parseSnapshot(xml, STAND).episodes;
    expect(episodes).toHaveLength(1);
    expect(episodes[0].enclosureUrl).toBe('https://serve.podhome.fm/e291.mp3?_=1');
  });

  it('nimmt auch ein audio-Element mit src am Element selbst', () => {
    const xml = feed(
      `<item><title>E291</title><content:encoded>&lt;audio src="https://x.test/a.mp3"&gt;&lt;/audio&gt;</content:encoded></item>`,
    );
    expect(parseSnapshot(xml, STAND).episodes[0].enclosureUrl).toBe('https://x.test/a.mp3');
  });

  it('nimmt keinen mp3-Link aus den Shownotes, der nicht im audio-Element steht', () => {
    // Ein Link in den Shownotes ist eine Empfehlung, keine Folge.
    const xml = feed(
      `<item><title>Nur ein Hinweis</title><description>Hört auch &lt;a href="https://fremd.test/andere.mp3"&gt;das hier&lt;/a&gt;.</description></item>`,
    );
    expect(parseSnapshot(xml, STAND).episodes).toHaveLength(0);
  });

  it('bevorzugt das Enclosure, wenn beides dasteht', () => {
    const xml = feed(
      `<item><title>Beides</title><enclosure url="https://example.test/echt.mp3"/>` +
        `<description>&lt;audio&gt;&lt;source src="https://example.test/eingebettet.mp3" /&gt;&lt;/audio&gt;</description></item>`,
    );
    expect(parseSnapshot(xml, STAND).episodes[0].enclosureUrl).toBe('https://example.test/echt.mp3');
  });
});
