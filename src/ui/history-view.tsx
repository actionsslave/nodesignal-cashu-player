/**
 * Der Verlauf aus 5a (SFR-21, SFR-32).
 *
 * Sechs Arten, und nur diese. Die Spalte „Quelle" ist der Grund für den
 * ganzen Abschnitt: Ohne sie liesse sich einer Zahlung nicht ansehen, ob sie
 * den Float oder die lokale Wallet belastet hat.
 */
import { useState } from 'preact/hooks';
import type { HistoryRecord } from '../db/database.js';

export type HistoryFilter = 'alle' | 'streaming' | 'boost' | 'float' | 'wallet';

const FILTER: { id: HistoryFilter; label: string }[] = [
  { id: 'alle', label: 'Alle' },
  { id: 'streaming', label: 'Streaming' },
  { id: 'boost', label: 'Boost' },
  { id: 'float', label: 'Float' },
  { id: 'wallet', label: 'Wallet' },
];

const ART: Record<HistoryRecord['kind'], string> = {
  streaming: 'Streaming',
  boost: 'Boost',
  float_out: 'Float-Entnahme',
  float_in: 'Float-Rückgabe',
  import: 'Aufgeladen',
  export: 'Exportiert',
};

export function artLabel(entry: HistoryRecord): string {
  return ART[entry.kind];
}

/** Die Float-Vorgänge sind keine Zahlungen — bei ihnen steht nur die Wallet. */
export function sourceLabel(entry: HistoryRecord): string {
  if (entry.source === 'local') return 'Lokale Wallet';
  if (entry.source !== 'nip60') return '—';
  return entry.kind === 'float_out' || entry.kind === 'float_in'
    ? 'nostr-Wallet'
    : 'nostr-Wallet · Float';
}

/** SFR-21: Bei Float-Vorgängen sagt die Spalte, was auf die Relays ging. */
export function statusLabel(entry: HistoryRecord): string {
  if (entry.kind === 'float_out') return 'kind:7375 · kind:5';
  if (entry.kind === 'float_in') return 'kind:7375';
  if (entry.status === 'gesendet') return 'Gesendet';
  if (entry.status === 'empfangen') return 'Empfangen';
  if (entry.status === 'ausstehend') return 'Ausstehend';
  return 'Fehlgeschlagen';
}

export function matchesFilter(entry: HistoryRecord, filter: HistoryFilter): boolean {
  switch (filter) {
    case 'alle':
      return true;
    case 'float':
      return entry.kind === 'float_out' || entry.kind === 'float_in';
    case 'wallet':
      return entry.kind === 'import' || entry.kind === 'export';
    default:
      return entry.kind === filter;
  }
}

const zahl = (n: number) => n.toLocaleString('de-DE');

function wann(at: number): string {
  return new Date(at).toLocaleString('de-DE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface HistoryViewProps {
  entries: HistoryRecord[];
}

export function HistoryView({ entries }: HistoryViewProps) {
  const [filter, setFilter] = useState<HistoryFilter>('alle');
  const sichtbar = entries.filter((entry) => matchesFilter(entry, filter));

  return (
    <section class="block" id="verlauf">
      <div class="section-head">
        <h3>Verlauf</h3>
        <div class="chips" style={{ marginTop: 0, marginLeft: '20px' }}>
          {FILTER.map((eintrag) => (
            <button
              type="button"
              key={eintrag.id}
              class={eintrag.id === filter ? 'tag tag-filled' : 'tag tag-outline'}
              onClick={() => setFilter(eintrag.id)}
            >
              {eintrag.label}
            </button>
          ))}
        </div>
      </div>

      {sichtbar.length === 0 ? (
        <p class="source-note">Noch nichts in dieser Ansicht.</p>
      ) : (
        <div class="history">
          <div class="history-head">
            <span>Betrag</span>
            <span>Wann</span>
            <span>Art</span>
            <span>Quelle</span>
            <span>Folge</span>
            <span>Status</span>
          </div>
          {sichtbar.map((entry) => (
            <div class="history-row" key={entry.id}>
              <span class="amount">
                {entry.direction === 'out' ? '−' : '+'}
                {zahl(entry.amount)} Sat
              </span>
              <span class="muted">{wann(entry.at)}</span>
              <span>{artLabel(entry)}</span>
              <span class="muted">{sourceLabel(entry)}</span>
              <span class="muted">{entry.episodeTitle ?? '—'}</span>
              <span
                class={
                  entry.kind === 'float_out' || entry.kind === 'float_in'
                    ? 'muted'
                    : entry.status === 'fehlgeschlagen'
                      ? 'fail'
                      : 'sent'
                }
              >
                {statusLabel(entry)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
