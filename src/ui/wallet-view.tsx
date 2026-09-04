/**
 * SFR-20, SFR-28, SFR-29: die Wallet-Ansicht.
 *
 * Beide Quellen stehen gleichrangig nebeneinander, jede mit eigenem Guthaben
 * und eigenem Zustand; genau eine ist aktiv. Ist eine nicht verfügbar, nennt
 * sie den konkreten Grund — nicht „geht nicht", sondern welcher Baustein fehlt.
 *
 * Schmucklos: Das Design-Handoff stand beim Bauen nicht zur Verfügung.
 */
import type { SourceEvaluation, SourceId, SourceUnavailable } from '../payments/source.js';
import type { HistoryRecord } from '../db/database.js';

/** SFR-29: je Quelle der konkret fehlende Baustein. */
export const REASON_TEXT: Record<SourceUnavailable, string> = {
  'nicht-angemeldet': 'Nicht angemeldet. Melde dich mit deiner nostr-Extension an.',
  'kein-nip44':
    'Deine Extension unterstützt nip44 nicht. Ohne sie lässt sich die nostr-Wallet nicht entschlüsseln.',
  'keine-wallet':
    'Zu deinem npub gibt es kein kind:17375. Diese App legt keine Wallet an — die lokale Wallet steht als Alternative bereit.',
  'keine-mint-schnittmenge':
    'Kein gemeinsamer Mint: Es gibt keinen Mint, den Wallet, erlaubte Liste und der Podcast zugleich akzeptieren.',
  'kein-guthaben': 'Kein Guthaben bei einem der gemeinsamen Mints.',
};

const zahl = (n: number) => n.toLocaleString('de-DE');

export interface WalletViewProps {
  sources: SourceEvaluation;
  active?: SourceId;
  onChooseSource: (id: SourceId) => void;
  /** SFR-20: Entnahme minus Ausgegebenes. */
  floatRemaining: number;
  /** SFR-20: in dieser Sitzung gesendet, quellenübergreifend (SFR-31). */
  sessionSent: number;
  history: HistoryRecord[];
  /** Lokale Wallet aufladen (SFR-24). */
  token: string;
  onTokenChange: (value: string) => void;
  onImport: () => void;
  onExport: () => void;
  importError?: string;
  exportToken?: string;
  storageMode?: string;
}

function SourceCard({
  titel,
  state,
  aktiv,
  onChoose,
  children,
}: {
  titel: string;
  state: SourceEvaluation['nip60'];
  aktiv: boolean;
  onChoose: () => void;
  children?: preact.ComponentChildren;
}) {
  return (
    <section class={aktiv ? 'source active' : 'source'}>
      <h3>{titel}</h3>
      <p class="balance">
        <strong>{zahl(state.balance)}</strong> Sat
      </p>
      {state.available ? (
        <button type="button" disabled={aktiv} onClick={onChoose}>
          {aktiv ? 'Aktive Quelle' : 'Als Quelle wählen'}
        </button>
      ) : (
        <p class="reason">{state.reason ? REASON_TEXT[state.reason] : 'Nicht verfügbar.'}</p>
      )}
      {/* SFR-30: die Schnittmenge wird je Quelle getrennt gebildet und angezeigt. */}
      <p class="mints">
        Gemeinsame Mints: {state.mints.length > 0 ? state.mints.join(', ') : 'keine'}
      </p>
      {children}
    </section>
  );
}

export function WalletView({
  sources,
  active,
  onChooseSource,
  floatRemaining,
  sessionSent,
  history,
  token,
  onTokenChange,
  onImport,
  onExport,
  importError,
  exportToken,
  storageMode,
}: WalletViewProps) {
  return (
    <div class="wallet">
      <h2>Wallet</h2>

      {/* SFR-20: Guthaben, Float und Sitzungssumme getrennt. */}
      <dl class="totals">
        <dt>Offener Float</dt>
        <dd>{zahl(floatRemaining)} Sat</dd>
        <dt>In dieser Sitzung gesendet</dt>
        <dd>{zahl(sessionSent)} Sat</dd>
      </dl>

      <div class="sources">
        <SourceCard
          titel="nostr-Wallet (NIP-60)"
          state={sources.nip60}
          aktiv={active === 'nip60'}
          onChoose={() => onChooseSource('nip60')}
        />
        <SourceCard
          titel="Lokale Wallet"
          state={sources.local}
          aktiv={active === 'local'}
          onChoose={() => onChooseSource('local')}
        >
          {/* SFR-24 bis SFR-26 */}
          <label for="token-input">Cashu-Token einfügen</label>
          <textarea
            id="token-input"
            placeholder="cashuB…"
            value={token}
            onInput={(event) => onTokenChange((event.target as HTMLTextAreaElement).value)}
          />
          {importError && <p class="error">{importError}</p>}
          <button type="button" onClick={onImport} disabled={token.trim() === ''}>
            Aufladen
          </button>
          <button type="button" onClick={onExport}>
            Guthaben exportieren
          </button>
          {exportToken && <p class="export-token">{exportToken}</p>}
          {storageMode && <p class="storage">Browser-Speicher: {storageMode}</p>}
          <p class="warning">
            Löschen der Website-Daten vernichtet das Guthaben der lokalen Wallet. Exportiere einen
            Token, bevor du den Browser schließt.
          </p>
        </SourceCard>
      </div>

      <h3>Verlauf</h3>
      <table class="history">
        <thead>
          <tr>
            <th>Betrag</th>
            <th>Wann</th>
            <th>Art</th>
            <th>Episode</th>
            <th>Quelle</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry) => (
            <tr key={entry.id}>
              <td>
                {entry.direction === 'in' ? '+' : '−'}
                {zahl(entry.amount)} Sat
              </td>
              <td>{new Date(entry.at).toLocaleString('de-DE')}</td>
              <td>{entry.kind}</td>
              <td>{entry.episodeTitle ?? '—'}</td>
              {/* SFR-32: jeder Eintrag nennt die Quelle. */}
              <td>{entry.source ?? '—'}</td>
              <td>{entry.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
