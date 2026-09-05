/**
 * 5b-7 (SFR-25): Die lokale Wallet als Cashu-Token ausgeben.
 *
 * Der Token verlässt den Player endgültig — deshalb steht das auch so da, und
 * deshalb steht der QR-Code neben der Zeichenkette: Wer ihn abfotografiert,
 * muss nichts abtippen.
 */
import { mintLabel } from '../wallet/messages.js';
import { Dialog } from './dialog.js';
import { QrCode } from './qr-code.js';

const zahl = (n: number) => n.toLocaleString('de-DE');

export interface ExportDialogProps {
  amount: number;
  mintUrl: string;
  token: string;
  onCopy: () => void;
  onSaveFile: () => void;
  /** Der Token ist gesichert — das Guthaben verlässt den Player endgültig. */
  onDone: () => void;
  /** Abgebrochen: Das Guthaben bleibt liegen. */
  onCancel: () => void;
  copied?: boolean;
}

export function ExportDialog({
  amount,
  mintUrl,
  token,
  onCopy,
  onSaveFile,
  onDone,
  onCancel,
  copied,
}: ExportDialogProps) {
  return (
    <Dialog
      kicker="Lokale Wallet"
      title={`${zahl(amount)} Sat als Cashu-Token ausgeben`}
      explanation="Der Token ist in jeder Cashu-Wallet einlösbar. Er verlässt diesen Player endgültig — sichere ihn, bevor du das Fenster schließt."
      details={[{ label: 'Mint', value: mintLabel(mintUrl) }]}
      actions={
        <>
          <button type="button" class="btn btn-primary" onClick={onCopy}>
            {copied ? 'Kopiert' : 'Kopieren'}
          </button>
          <button type="button" class="btn btn-ghost" onClick={onSaveFile}>
            Als Datei speichern
          </button>
          {/*
            Erst wenn der Token gesichert ist, gibt die Wallet ihn her. Wer
            abbricht, behaelt sein Guthaben — ein Fehlklick darf kein Geld
            kosten.
          */}
          <button
            type="button"
            class="btn btn-secondary"
            disabled={!copied}
            onClick={onDone}
            style={{ marginLeft: 'auto' }}
          >
            Fertig
          </button>
          <button type="button" class="btn btn-ghost" onClick={onCancel}>
            Abbrechen
          </button>
        </>
      }
      onCancel={onCancel}
    >
      <div class="export-row">
        <div class="qr">
          <QrCode value={token} size={118} />
        </div>
        <p class="export-token">{token}</p>
      </div>
      <p class="dialog-note">
        Solange der Token nicht eingelöst wird, bleibt das Guthaben beim Mint. Löschen der
        Website-Daten vernichtet nur die lokale Kopie — nicht diesen Token.
      </p>
      <p class="dialog-note">
        {copied
          ? 'Mit „Fertig" gibt die lokale Wallet den Betrag ab; danach steht er hier nicht mehr.'
          : 'Kopiere oder speichere den Token zuerst. „Abbrechen" lässt dein Guthaben unangetastet.'}
      </p>
    </Dialog>
  );
}
