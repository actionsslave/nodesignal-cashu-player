/**
 * 5b-2 (SFR-22, SFR-32): Boost senden.
 *
 * Der Betrag wird aus dem gewählten Chip oder dem freien Feld genommen; deckt
 * die Quelle ihn nicht, fällt der Knopf auf den zahlbaren Betrag zurück und
 * sagt das. Ein Knopf, der „500 Sat senden" verspricht und 470 sendet, wäre
 * eine Lüge — deshalb steht im Knopf, was tatsächlich rausgeht.
 *
 * Der Zeitstempel wird beim Öffnen eingefroren: Sonst wanderte er, während der
 * Nutzer tippt, und der Boost trüge die Stelle der Bestätigung statt der
 * Stelle, die gemeint war.
 */
import { useState } from 'preact/hooks';
import { BOOST_MESSAGE_MAX_LENGTH, BOOST_PRESETS_SATS } from '../config/build-config.js';
import { mintLabel } from '../wallet/messages.js';
import { Dialog } from './dialog.js';

const zahl = (n: number) => n.toLocaleString('de-DE');

/** SFR-22: Was die Quelle tatsächlich decken kann. */
export function payableAmount(wunsch: number, verfuegbar: number): number {
  return Math.max(0, Math.min(wunsch, verfuegbar));
}

export interface BoostDialogProps {
  episodeTitle: string;
  /** Beim Klick eingefroren (Position in hh:mm:ss). */
  timecode: string;
  /** Nummer der Folge, falls der Titel eine trägt. */
  episodeNumber?: string;
  podcastTitle: string;
  sourceLabel: string;
  mintUrl: string;
  /** Was die aktive Quelle decken kann. */
  available: number;
  /** SFR-20: Float nach dem Boost — bei NIP-60 die dritte Zahl. */
  floatRemaining?: number;
  onSend: (amount: number, comment: string) => void;
  onTopUpFloat?: () => void;
  onCancel: () => void;
  busy?: boolean;
}

export function BoostDialog({
  episodeTitle,
  timecode,
  episodeNumber,
  podcastTitle,
  sourceLabel,
  mintUrl,
  available,
  floatRemaining,
  onSend,
  onTopUpFloat,
  onCancel,
  busy,
}: BoostDialogProps) {
  const [wunsch, setWunsch] = useState(BOOST_PRESETS_SATS[1] ?? 500);
  const [comment, setComment] = useState('');

  const zahlbar = payableAmount(wunsch, available);
  const gedeckt = zahlbar === wunsch;
  const floatDanach = floatRemaining === undefined ? undefined : floatRemaining - wunsch;

  const details = [
    { label: 'Quelle', value: sourceLabel },
    { label: 'Mint', value: mintLabel(mintUrl) },
  ];
  if (floatDanach !== undefined) {
    details.push({
      label: 'Float danach',
      value: floatDanach < 0 ? `−${zahl(Math.abs(floatDanach))} Sat` : `${zahl(floatDanach)} Sat`,
    });
  }

  return (
    <Dialog
      kicker={`${podcastTitle}${episodeNumber ? ` · E${episodeNumber}` : ''} · ${timecode}`}
      title="Boost senden"
      explanation="Der Betrag geht als Cashu-Token an Nodesignal, gesperrt auf den Schlüssel aus kind:10019. Der Kommentar wird öffentlich auf nostr veröffentlicht."
      details={details}
      actions={
        <>
          <button
            type="button"
            class="btn btn-primary"
            disabled={busy || zahlbar === 0}
            onClick={() => onSend(zahlbar, comment.trim())}
          >
            {zahl(zahlbar)} Sat senden
          </button>
          <button type="button" class="btn btn-secondary" onClick={onCancel}>
            Abbrechen
          </button>
        </>
      }
      onCancel={onCancel}
    >
      <p class="dialog-note" style={{ marginTop: '4px' }}>
        {episodeTitle}
      </p>

      <div class="chips">
        {BOOST_PRESETS_SATS.map((preset) => (
          <button
            type="button"
            key={preset}
            class={preset === wunsch ? 'tag tag-filled' : 'tag tag-outline'}
            onClick={() => setWunsch(preset)}
          >
            {zahl(preset)}
          </button>
        ))}
        <input
          class="input"
          style={{ width: '7rem' }}
          type="number"
          min={1}
          aria-label="Betrag in Sat"
          value={String(wunsch)}
          onInput={(event) => setWunsch(Number((event.target as HTMLInputElement).value) || 0)}
        />
        <span class="muted" style={{ fontSize: '14px' }}>
          Sat · frei wählbar
        </span>
      </div>

      <input
        class="input"
        style={{ marginTop: '12px' }}
        placeholder="Kommentar (öffentlich)"
        aria-label="Kommentar (öffentlich)"
        maxLength={BOOST_MESSAGE_MAX_LENGTH}
        value={comment}
        onInput={(event) => setComment((event.target as HTMLInputElement).value)}
      />

      {!gedeckt && (
        <p class="dialog-note fail">
          Der Float deckt {zahl(wunsch)} Sat nicht mehr.{' '}
          {onTopUpFloat && (
            <button type="button" class="btn btn-ghost" onClick={onTopUpFloat}>
              Float aufstocken
            </button>
          )}{' '}
          oder Betrag verringern.
        </p>
      )}
    </Dialog>
  );
}
