/**
 * Kopf der Seite aus Entwurf 5a: Mastkopf, Index, Zeile mit dem Datum
 * (SFR-05, SFR-09, SFR-12).
 *
 * Die vier Indexlinks sind Anker innerhalb der Seite. SFR-05 verbietet Routing,
 * nicht das Springen — es gibt nur diese eine Seite.
 */
import { useEffect, useState } from 'preact/hooks';

export interface IndexLink {
  id: string;
  label: string;
}

export const INDEX_LINKS: IndexLink[] = [
  { id: 'folgen', label: 'Folgen' },
  { id: 'quelle', label: 'Wallet' },
  { id: 'einstellungen', label: 'Einstellungen' },
  { id: 'erklaerung', label: 'Was ist das?' },
];

/** SFR-09: Der Stand des Feeds — das Datum aus dem Build-Snapshot. */
export function formatFeedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * SFR-09: Der Text der mittleren Angabe.
 *
 * Ist der Snapshot von heute, ist der gescheiterte Laufzeit-Abruf keine
 * Nachricht — der Bauzeit-Stand ist ja aktuell. Erst ein aelterer Stand
 * zusammen mit einem gescheiterten Abruf ist eine Warnung wert.
 */
export function datelineFeed(fetchedAt: string, stale: boolean, now = new Date()): string {
  const stand = new Date(fetchedAt);
  const vonHeute = stand.toDateString() === now.toDateString();
  return stale && !vonHeute
    ? `Feed nicht erreichbar — Stand ${formatFeedDate(fetchedAt)}`
    : `Feed-Stand ${formatFeedDate(fetchedAt)}`;
}

export interface MastheadProps {
  npubShort?: string;
  onLogin: () => void;
  feedFetchedAt: string;
  /** SFR-09: Der Laufzeit-Abruf ist gescheitert; nur hier steht das. */
  feedStale?: boolean;
  /** Dritte Angabe der Datumszeile: die aktive Quelle (SFR-12). */
  sourceLabel: string;
  /** SFR-12: Ohne Anmeldung nennt die Zeile den Zustand, nicht den Feed-Stand. */
  loggedIn: boolean;
}

export function Masthead({
  npubShort,
  onLogin,
  feedFetchedAt,
  feedStale,
  sourceLabel,
  loggedIn,
}: MastheadProps) {
  const [active, setActive] = useState(INDEX_LINKS[0].id);

  // Der aktive Link folgt der Scrollposition.
  useEffect(() => {
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        const sichtbar = eintraege.filter((e) => e.isIntersecting);
        if (sichtbar.length > 0) setActive(sichtbar[0].target.id);
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    for (const link of INDEX_LINKS) {
      const element = document.getElementById(link.id);
      if (element) beobachter.observe(element);
    }
    return () => beobachter.disconnect();
  }, []);

  return (
    <header class="head">
      <div class="masthead">
        <span class="wordmark">Nodesignal</span>
        <span class="sub">Player</span>
        <nav class="index">
          {INDEX_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              class={link.id === active ? 'active' : undefined}
              onClick={() => setActive(link.id)}
            >
              {link.label}
            </a>
          ))}
        </nav>
        {npubShort ? (
          <span class="npub">{npubShort}</span>
        ) : (
          <button type="button" class="btn btn-primary" onClick={onLogin}>
            Mit nostr anmelden
          </button>
        )}
      </div>

      <div class="masthead-rule" />
      <div class="dateline">
        {loggedIn ? (
          <>
            <span>Value for Value mit Ecash</span>
            <span>{datelineFeed(feedFetchedAt, feedStale === true)}</span>
            <span>Quelle: {sourceLabel}</span>
          </>
        ) : (
          <>
            <span>Nicht angemeldet</span>
            <span>Wiedergabe frei</span>
            <span>Zahlungen aus</span>
          </>
        )}
      </div>
      <div class="hairline" />
    </header>
  );
}
