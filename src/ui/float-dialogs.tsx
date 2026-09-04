/**
 * Die Float-Dialoge aus 5b: erste Entnahme, Quellenwechsel, Konflikt, und der
 * liegengebliebene Rest einer abgebrochenen Sitzung.
 *
 * Alle Texte stammen wörtlich aus dem Handoff. Die Hauptaktion nennt jeweils
 * den Betrag — wer bestätigt, soll lesen können, worüber er entscheidet.
 */
import {
  FLOAT_MAX_SATS,
  FLOAT_MIN_SATS,
  STREAMING_RATE_DEFAULT_SATS_PER_MINUTE,
} from '../config/build-config.js';
import { mintLabel } from '../wallet/messages.js';
import { Dialog } from './dialog.js';

const zahl = (n: number) => n.toLocaleString('de-DE');

/**
 * SNR-06: Der einmalige Hinweis vor der ersten Entnahme. Wörtlich, und nur
 * einmal — wiederholt wäre er Dekoration statt Aufklärung.
 */
export const NIP60_RISIKO_HINWEIS =
  'Einmaliger Hinweis: Bei NIP-60 liegen deine Proofs verschlüsselt auf deinen Relays. ' +
  'Verliert ein Relay diese Events, sind sie für alle Clients nicht mehr auffindbar. ' +
  'Das ist eine Eigenschaft von NIP-60, keine dieses Players.';

export interface FirstTakeDialogProps {
  amount: number;
  mintUrl: string;
  rate?: number;
  /** SNR-06: nur vor der allerersten Entnahme. */
  showRiskNotice: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onChangeAmount: () => void;
  busy?: boolean;
}

/** 5b-1 (SFR-18, SNR-06). */
export function FirstTakeDialog({
  amount,
  mintUrl,
  rate = STREAMING_RATE_DEFAULT_SATS_PER_MINUTE,
  showRiskNotice,
  onConfirm,
  onCancel,
  onChangeAmount,
  busy,
}: FirstTakeDialogProps) {
  return (
    <Dialog
      kicker="Vor der ersten Zahlung"
      title={`${zahl(amount)} Sat aus deiner nostr-Wallet entnehmen`}
      explanation="Der Betrag wird einmal aus der Wallet genommen und liegt dann als Float lokal im Player. Streaming und Boosts laufen dagegen, ohne dass weiter auf Relays geschrieben wird. Der ungenutzte Rest geht am Ende der Sitzung zurück."
      details={[
        {
          label: 'Float-Betrag',
          value: (
            <>
              {zahl(amount)} Sat{' '}
              <span class="muted">
                · {zahl(FLOAT_MIN_SATS)}–{zahl(FLOAT_MAX_SATS)}
              </span>
            </>
          ),
        },
        { label: 'Streaming-Satz', value: `${zahl(rate)} Sat / Minute` },
        { label: 'Mint', value: mintLabel(mintUrl) },
      ]}
      actions={
        <>
          <button type="button" class="btn btn-primary" disabled={busy} onClick={onConfirm}>
            {zahl(amount)} Sat entnehmen
          </button>
          <button type="button" class="btn btn-secondary" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="button" class="btn btn-ghost" onClick={onChangeAmount}>
            Betrag ändern
          </button>
        </>
      }
      onCancel={onCancel}
    >
      {showRiskNotice && <p class="dialog-note">{NIP60_RISIKO_HINWEIS}</p>}
    </Dialog>
  );
}

export interface SwitchSourceDialogProps {
  /** Offener Float, der vor dem Wechsel zurückgeht. */
  floatRemaining: number;
  targetName: string;
  targetBalance: number;
  sessionSent: number;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

/** 5b-3 (SFR-31, SNR-07). */
export function SwitchSourceDialog({
  floatRemaining,
  targetName,
  targetBalance,
  sessionSent,
  onConfirm,
  onCancel,
  busy,
}: SwitchSourceDialogProps) {
  return (
    <Dialog
      kicker="Wiedergabe läuft"
      title={`Auf die ${targetName} umschalten`}
      explanation={`Bevor die ${targetName} aktiv wird, gehen ${zahl(floatRemaining)} Sat offener Float zurück in deine nostr-Wallet. Guthaben wird dabei nicht zwischen den Quellen verschoben.`}
      details={[
        { label: 'Float-Rückgabe', value: `${zahl(floatRemaining)} Sat → kind:7375` },
        { label: 'Neue Quelle', value: `${targetName} · ${zahl(targetBalance)} Sat` },
        { label: 'Sitzungszähler', value: `läuft weiter bei ${zahl(sessionSent)} Sat` },
      ]}
      actions={
        <>
          <button type="button" class="btn btn-primary" disabled={busy} onClick={onConfirm}>
            Zurückschreiben und wechseln
          </button>
          <button type="button" class="btn btn-secondary" onClick={onCancel}>
            Abbrechen
          </button>
        </>
      }
      onCancel={onCancel}
    />
  );
}

export interface ConflictDialogProps {
  affectedEvents: number;
  newBalance: number;
  floatRemaining: number;
  onRetry: () => void;
  onSwitchToLocal: () => void;
  onCancel: () => void;
}

/** 5b-4 (SFR-19, SUS-01-AC-7). */
export function ConflictDialog({
  affectedEvents,
  newBalance,
  floatRemaining,
  onRetry,
  onSwitchToLocal,
  onCancel,
}: ConflictDialogProps) {
  return (
    <Dialog
      kicker="Konflikt"
      kickerFail
      title={'Der Mint meldet \u201Ebereits ausgegeben\u201C'}
      explanation="Wahrscheinlich hat ein anderer Client dieselbe Wallet benutzt. Der Wallet-Zustand wurde neu geladen. Es wurde kein Deletion-Event für die betroffenen Events publiziert."
      details={[
        { label: 'Betroffen', value: `${zahl(affectedEvents)} kind:7375-Events` },
        { label: 'Neues Guthaben', value: `${zahl(newBalance)} Sat` },
        { label: 'Float', value: `unverändert ${zahl(floatRemaining)} Sat` },
      ]}
      actions={
        <>
          <button type="button" class="btn btn-primary" onClick={onRetry}>
            Erneut versuchen
          </button>
          <button type="button" class="btn btn-secondary" onClick={onSwitchToLocal}>
            Auf lokale Wallet wechseln
          </button>
        </>
      }
      onCancel={onCancel}
    />
  );
}

export interface LeftoverFloatProps {
  amount: number;
  mintUrl: string;
  openedAt: number;
  onReturn: () => void;
  onKeep: () => void;
  busy?: boolean;
}

/**
 * 5b-6 (SOQ-03) — ein Block auf der Seite, kein Dialog. Er wird angeboten,
 * nicht ausgeführt: Was mit dem Rest geschieht, entscheidet der Nutzer.
 */
export function LeftoverFloat({
  amount,
  mintUrl,
  openedAt,
  onReturn,
  onKeep,
  busy,
}: LeftoverFloatProps) {
  const seit = new Date(openedAt);
  const datum = seit.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  const uhrzeit = seit.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <section class="block" id="rest">
      <span class="kicker kicker-12">Beim Öffnen der Seite</span>
      <h3 class="dialog-title">
        {zahl(amount)} Sat aus der letzten Sitzung liegen noch lokal
      </h3>
      <p class="dialog-text">
        Die Sitzung am {datum} wurde beendet, bevor der Float zurückgeschrieben werden konnte. Das
        Guthaben ist nicht verloren, aber bis zur Rückgabe nur hier sichtbar.
      </p>
      <dl class="dialog-details" style={{ maxWidth: '540px' }}>
        <div class="dialog-detail">
          <dt>Rest</dt>
          <dd>{zahl(amount)} Sat</dd>
        </div>
        <div class="dialog-detail">
          <dt>Mint</dt>
          <dd>{mintLabel(mintUrl)}</dd>
        </div>
        <div class="dialog-detail">
          <dt>Seit</dt>
          <dd>
            {datum}, {uhrzeit}
          </dd>
        </div>
      </dl>
      <div class="dialog-actions">
        <button type="button" class="btn btn-primary" disabled={busy} onClick={onReturn}>
          Jetzt zurückschreiben
        </button>
        <button type="button" class="btn btn-ghost" onClick={onKeep}>
          Als Float weiterverwenden
        </button>
      </div>
    </section>
  );
}
