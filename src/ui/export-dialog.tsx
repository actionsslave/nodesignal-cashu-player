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
  onCancel: () => void;
  copied?: boolean;
}

export function ExportDialog({
  amount,
  mintUrl,
  token,
  onCopy,
  onSaveFile,
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
          <button type="button" class="btn btn-secondary" onClick={onCancel}>
            Schließen
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
    </Dialog>
  );
}
