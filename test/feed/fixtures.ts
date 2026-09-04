export const VOLLSTAENDIGER_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>Testpodcast</title>
    <description>Ein Podcast zum Testen</description>
    <itunes:image href="https://example.com/cover.jpg"/>
    <podcast:guid>917393e3-1b1e-5cef-ace4-edaa54e1f810</podcast:guid>
    <podcast:txt purpose="nostr">npub1sn0wdenkukak0d9dfczzeacvhkrgz92ak56egt7vdgzn8pv2wfqqhrjdv9</podcast:txt>
    <podcast:value type="lightning" method="keysend" suggested="0.00000005000">
      <podcast:valueRecipient name="Host" type="node" address="0326f0a8...ab" split="100"/>
    </podcast:value>
    <item>
      <title>Folge 2</title>
      <description>Die zweite Folge</description>
      <pubDate>Tue, 12 Aug 2025 10:00:00 +0000</pubDate>
      <itunes:duration>1:02:03</itunes:duration>
      <guid isPermaLink="false">episode-2</guid>
      <enclosure url="https://example.com/2.mp3" length="1000" type="audio/mpeg"/>
    </item>
    <item>
      <title>Folge 1</title>
      <description>Die erste Folge</description>
      <pubDate>Mon, 04 Aug 2025 10:00:00 +0000</pubDate>
      <itunes:duration>630</itunes:duration>
      <guid isPermaLink="false">episode-1</guid>
      <enclosure url="https://example.com/1.mp3" length="900" type="audio/mpeg"/>
    </item>
  </channel>
</rss>`;

export const FEED_OHNE_NOSTR = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Ohne nostr</title>
    <item>
      <title>Einzige Folge</title>
      <pubDate>Mon, 04 Aug 2025 10:00:00 +0000</pubDate>
      <enclosure url="https://example.com/a.mp3" length="1" type="audio/mpeg"/>
    </item>
  </channel>
</rss>`;

export function feedMitEpisoden(anzahl: number): string {
  const items = Array.from({ length: anzahl }, (_unused, index) => {
    const tag = String((index % 28) + 1).padStart(2, '0');
    const monat = index < 28 ? 'Aug' : 'Sep';
    return `<item>
      <title>Folge ${index + 1}</title>
      <pubDate>Mon, ${tag} ${monat} 2025 10:00:00 +0000</pubDate>
      <guid isPermaLink="false">e-${index + 1}</guid>
      <enclosure url="https://example.com/${index + 1}.mp3" length="1" type="audio/mpeg"/>
    </item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Viele Folgen</title>${items}</channel></rss>`;
}
