/**
 * 5b-5 (SFR-29, SUS-02-AC-4): Beide Quellen gesperrt.
 *
 * Ein Block auf der Seite, kein Dialog — es gibt nichts zu bestätigen. Je
 * Quelle steht einzeln da, was fehlt; „Zahlungen sind nicht möglich" allein
 * wäre keine Auskunft.
 */
import { ALLOWED_MINTS } from '../config/build-config.js';
import type { SourceEvaluation, SourceState, SourceUnavailable } from '../payments/source.js';
import { mintLabel } from '../wallet/messages.js';

/** SFR-29: die Sätze aus dem Handoff, je Grund einer. */
export const BLOCKED_REASON: Record<SourceUnavailable, string> = {
  'nicht-angemeldet':
    'Melde dich mit deiner nostr-Extension an. Sie dient der Identität; den Betrag bestimmst du selbst.',
  'kein-nip44':
    'Deine Extension bietet kein nip44. Ohne das lässt sich die nostr-Wallet nicht entschlüsseln.',
  'keine-wallet':
    'Zu deinem npub wurde kein kind:17375 gefunden. Der Player legt keine Wallet an. Wenn du in einem anderen Client eine nostr-Wallet einrichtest, erscheint sie hier.',
  'keine-mint-schnittmenge':
    'Es gibt keinen gemeinsamen Mint zwischen deiner Wallet, der erlaubten Liste und Nodesignals kind:10019.',
  'kein-guthaben': '',
};

function reasonText(state: SourceState, local: boolean): string {
  if (state.reason === 'kein-guthaben') {
    return local
      ? `Füge einen Cashu-Token von ${ALLOWED_MINTS.map(mintLabel).join(' oder ')} ein, um zu zahlen.`
      : 'Kein Guthaben bei einem der nutzbaren Mints.';
  }
  return state.reason ? BLOCKED_REASON[state.reason] : '';
}

function tagText(state: SourceState): string {
  return state.reason === 'kein-guthaben' ? 'Kein Guthaben' : 'Nicht wählbar';
}

export interface BlockedSourcesProps {
  sources: SourceEvaluation;
  token: string;
  onTokenChange: (value: string) => void;
  onImport: () => void;
}

export function BlockedSources({
  sources,
  token,
  onTokenChange,
  onImport,
}: BlockedSourcesProps) {
  const zeile = (state: SourceState, name: string, local: boolean) => (
    <div class="blocked-source">
      <div class="blocked-head">
        <label class="radio disabled">
          <input type="radio" name="gesperrt" disabled />
          <span class="dot" />
        </label>
        <span class="name">{name}</span>
        <span class="tag tag-accent-2">{tagText(state)}</span>
      </div>
      <p class="why">{reasonText(state, local)}</p>
      {local && (
        <div class="actions">
          <input
            class="input"
            style={{ maxWidth: '16rem' }}
            placeholder="cashuA…"
            aria-label="Cashu-Token einfügen"
            value={token}
            onInput={(event) => onTokenChange((event.target as HTMLInputElement).value)}
          />
          <button
            type="button"
            class="btn btn-primary"
            disabled={token.trim() === ''}
            onClick={onImport}
          >
            Aufladen
          </button>
        </div>
      )}
    </div>
  );

  return (
    <section class="block" id="quelle">
      <h3 class="dialog-title">Zahlungen sind deaktiviert</h3>
      <p class="dialog-text">
        Hören funktioniert uneingeschränkt weiter. Für jede Quelle steht einzeln, was fehlt.
      </p>
      {zeile(sources.nip60, 'nostr-Wallet (NIP-60)', false)}
      {zeile(sources.local, 'Lokale Wallet', true)}
      <p class="source-note">
        Weitere Gründe, die hier genauso erscheinen: die Extension bietet kein nip44, oder es gibt
        keinen gemeinsamen Mint zwischen deiner Wallet, der erlaubten Liste und Nodesignals
        kind:10019.
      </p>
    </section>
  );
}
