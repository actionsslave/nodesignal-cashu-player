/**
 * Abschnitt „Zahlungsquelle" aus Entwurf 5a (SFR-28 bis SFR-32).
 *
 * Beide Spalten sind gleich gebaut: dieselben Schriftgrößen, dieselbe
 * Reihenfolge der Teile, keine Linie dazwischen. Keine der Quellen ist der
 * Notausgang der anderen, und das soll man sehen.
 *
 * Der Kicker über der Mint-Liste nennt die Mengen, aus denen die Schnittmenge
 * gebildet wird — die Anforderung sichtbar gemacht, nicht bloß erfüllt.
 */
import type { SourceEvaluation, SourceId, SourceState, SourceUnavailable } from '../payments/source.js';
import { Icon } from './icons.js';

const zahl = (n: number) => n.toLocaleString('de-DE');

/** SFR-29: je Quelle der konkret fehlende Baustein, nicht „geht nicht". */
export const REASON_TEXT: Record<SourceUnavailable, string> = {
  'nicht-angemeldet': 'Melde dich mit deiner nostr-Extension an, um zu zahlen.',
  'kein-nip44':
    'Deine Extension bietet kein nip44. Ohne das lässt sich die nostr-Wallet nicht entschlüsseln.',
  'keine-wallet':
    'Zu deinem npub gibt es kein kind:17375. Dieser Player legt keine Wallet an.',
  'keine-mint-schnittmenge':
    'Kein Mint, den alle drei Seiten annehmen. Ohne gemeinsamen Mint kommt der Nutzap nicht an.',
  'kein-guthaben': 'Kein Guthaben bei einem der nutzbaren Mints.',
};

/** Die Beschriftung des Status-Tags rechts vom Quellennamen. */
export function statusTag(state: SourceState, aktiv: boolean): { text: string; klasse: string } {
  if (aktiv) return { text: 'Aktiv', klasse: 'tag tag-accent' };
  if (state.available) return { text: 'Bereit', klasse: 'tag tag-neutral' };
  if (state.reason === 'kein-guthaben') return { text: 'Kein Guthaben', klasse: 'tag tag-accent-2' };
  return { text: 'Nicht wählbar', klasse: 'tag tag-accent-2' };
}

export interface SourceSectionProps {
  sources: SourceEvaluation;
  active?: SourceId;
  onChoose: (id: SourceId) => void;
  /** SFR-20: lokal verfügbarer Rest des Floats. */
  floatRemaining: number;
  floatAmount: number;
  onChangeFloat: () => void;
  /** SFR-20: quellenübergreifend, überlebt einen Quellenwechsel (SFR-31). */
  sessionSent: number;
  nip60BalanceByMint: Record<string, number>;
  localBalanceByMint: Record<string, number>;
  storageMode?: string;
  token: string;
  onTokenChange: (value: string) => void;
  onImport: () => void;
  onExport: () => void;
  onPaste: () => void;
}

function MintList({
  mints,
  balances,
  kicker,
  reason,
}: {
  mints: string[];
  balances: Record<string, number>;
  kicker: string;
  reason?: SourceUnavailable;
}) {
  return (
    <div class="mint-block">
      <span class="kicker">{kicker}</span>
      {mints.length === 0 ? (
        <p class="fail" style={{ fontSize: '15px', margin: 0 }}>
          {reason ? REASON_TEXT[reason] : REASON_TEXT['keine-mint-schnittmenge']}
        </p>
      ) : (
        mints.map((mint) => (
          <p class="mint-line" key={mint}>
            <span>{mint.replace(/^https:\/\//, '')}</span>
            <span class="amount">{zahl(balances[mint] ?? 0)} Sat</span>
          </p>
        ))
      )}
    </div>
  );
}

export function SourceSection({
  sources,
  active,
  onChoose,
  floatRemaining,
  floatAmount,
  onChangeFloat,
  sessionSent,
  nip60BalanceByMint,
  localBalanceByMint,
  storageMode,
  token,
  onTokenChange,
  onImport,
  onExport,
  onPaste,
}: SourceSectionProps) {
  const spalte = (id: SourceId, state: SourceState) => {
    const aktiv = active === id;
    const tag = statusTag(state, aktiv);
    const nip60 = id === 'nip60';

    return (
      <div class="source">
        <div class="source-head">
          <label class={state.available ? 'radio' : 'radio disabled'}>
            <input
              type="radio"
              name="zahlungsquelle"
              checked={aktiv}
              disabled={!state.available}
              onChange={() => onChoose(id)}
            />
            <span class="dot" />
          </label>
          <h4>{nip60 ? 'nostr-Wallet (NIP-60)' : 'Lokale Wallet'}</h4>
          <span class={tag.klasse}>{tag.text}</span>
        </div>

        <p class="balance">
          <span class="amount">{zahl(state.balance)}</span>
          <span class="unit">Sat</span>
          <span class="qualifier">{nip60 ? 'in der Wallet' : 'auf diesem Gerät'}</span>
        </p>

        <div class="figures">
          {nip60 ? (
            <>
              <span>Float (lokal verfügbar)</span>
              <span>{zahl(floatRemaining)} Sat</span>
            </>
          ) : (
            <>
              <span>Speicher</span>
              <span>{storageMode ?? 'noch nicht angefordert'}</span>
            </>
          )}
          <span>In dieser Sitzung gesendet</span>
          <span>{zahl(sessionSent)} Sat</span>
        </div>

        {/*
          SFR-29: Steht die Quelle nicht zur Verfuegung, muss der fehlende
          Baustein dastehen. Eine leere Schnittmenge erklaert sich in der
          Mint-Liste selbst; jeder andere Grund braucht diese Zeile, sonst
          bliebe ein „Nicht waehlbar" ohne Begruendung stehen.
        */}
        {!state.available && state.reason && state.mints.length > 0 && (
          <p class="fail" style={{ fontSize: '15px', marginTop: '12px' }}>
            {REASON_TEXT[state.reason]}
          </p>
        )}

        <MintList
          mints={state.mints}
          balances={nip60 ? nip60BalanceByMint : localBalanceByMint}
          kicker={
            nip60
              ? 'Nutzbare Mints — kind:17375 ∩ erlaubte Liste ∩ kind:10019'
              : 'Nutzbare Mints — erlaubte Liste ∩ kind:10019'
          }
          reason={state.reason}
        />

        {nip60 ? (
          <>
            <div class="source-actions">
              <span style={{ fontSize: '15px' }}>Float-Betrag {zahl(floatAmount)} Sat</span>
              <button type="button" class="btn btn-ghost" onClick={onChangeFloat}>
                Ändern
              </button>
            </div>
            <p class="source-note">
              Streaming und Boosts laufen gegen den Float. Auf die Relays wird zweimal je Sitzung
              geschrieben: bei der Entnahme und bei der Rückgabe.
            </p>
          </>
        ) : (
          <div class="source-actions">
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
              onClick={onImport}
              disabled={token.trim() === ''}
            >
              Aufladen
            </button>
            <button type="button" class="btn btn-secondary" onClick={onExport}>
              Als Token exportieren
            </button>
            <button type="button" class="btn btn-ghost" onClick={onPaste}>
              <Icon name="clipboard" size={16} /> Aus Zwischenablage
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section class="block" id="quelle">
      <div class="section-head">
        <h3>Zahlungsquelle</h3>
        <span class="right">
          Genau eine Quelle ist aktiv · die Wahl bleibt nach einem Reload erhalten
        </span>
      </div>
      <p class="intro">
        Beide Quellen können dasselbe. Wer eine nostr-Wallet hat, zahlt daraus; wer keine hat oder
        keine nip44-fähige Extension, hinterlegt einen Cashu-Token und bekommt denselben
        Funktionsumfang.
      </p>

      <div class="sources">
        {spalte('nip60', sources.nip60)}
        {spalte('local', sources.local)}
      </div>

      <div class="source-footnotes">
        <span>Eine Zahlung wird immer aus genau einer Quelle finanziert.</span>
        <span>
          Beim Wechsel wird ein offener Float zurückgeschrieben, bevor die neue Quelle aktiv wird.
        </span>
      </div>
    </section>
  );
}
