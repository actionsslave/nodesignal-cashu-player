/**
 * „Was ist das?" (SOQ-08, SFR-11) und die Absage im iframe (SNR-05).
 *
 * Der Abschnitt richtet sich an Besucher ohne Extension: Er sagt, was hier
 * passiert und was es braucht — ohne zur Anmeldung zu drängen, denn Hören
 * verlangt sie nicht.
 */
import { ALLOWED_MINTS, SUGGESTED_EXTENSIONS } from '../config/build-config.js';
import { mintLabel } from '../wallet/messages.js';

/** SNR-05: eigener Block, wenn die Seite in einem Rahmen läuft. */
export function EmbeddedNotice() {
  return (
    <section class="block" id="eingebettet">
      <div class="blocked-source" style={{ borderTop: 'none' }}>
        <span class="kicker kicker-12 fail">Einbettung erkannt</span>
        <p class="dialog-text">
          Der Player läuft in einem iframe. Der Wallet-Betrieb ist deshalb abgeschaltet. Öffne
          player.nodesignal.space direkt.
        </p>
        <div class="dialog-actions">
          <a class="btn btn-primary" href={window.location.href} target="_blank" rel="noreferrer">
            Im eigenen Fenster öffnen
          </a>
        </div>
      </div>
    </section>
  );
}

export function Explainer() {
  return (
    <section class="block" id="erklaerung">
      <div class="section-head">
        <h3>Was ist das?</h3>
        <span class="right">Value for Value · nichts davon ist Pflicht</span>
      </div>

      <p class="intro">
        Alle Folgen lassen sich ohne Anmeldung hören. Zum Zahlen brauchst du eine nostr-Extension —
        sie dient der Identität, den Betrag bestimmst du selbst.
      </p>

      <div class="dialog-details" style={{ maxWidth: '84ch' }}>
        <div class="dialog-detail">
          <dt>Ecash</dt>
          <dd>
            Cashu-Token sind Inhaberpapiere: Wer sie hat, kann sie ausgeben. Sie liegen bei einem
            Mint, der sie ausgibt und einlöst — ein Verwahrer, dem du für diesen Betrag vertraust.
          </dd>
        </div>
        <div class="dialog-detail">
          <dt>Zwei Quellen</dt>
          <dd>
            Entweder aus deiner nostr-Wallet nach NIP-60, oder aus einem Token, den du hier
            einfügst. Beide können dasselbe; du wählst eine.
          </dd>
        </div>
        <div class="dialog-detail">
          <dt>Akzeptierte Mints</dt>
          <dd>{ALLOWED_MINTS.map(mintLabel).join(' · ')}</dd>
        </div>
        <div class="dialog-detail">
          <dt>Was du brauchst</dt>
          <dd>
            Eine NIP-07-Extension mit nip44 — etwa{' '}
            {SUGGESTED_EXTENSIONS.map((extension, index) => (
              <span key={extension.name}>
                {index > 0 ? ' oder ' : ''}
                <a href={extension.url} target="_blank" rel="noreferrer">
                  {extension.name}
                </a>
              </span>
            ))}
            . Ohne nip44 bleibt die nostr-Wallet gesperrt; die lokale Wallet funktioniert trotzdem.
          </dd>
        </div>
      </div>

      <p class="source-note" style={{ maxWidth: '84ch' }}>
        Dieser Player legt keine nostr-Wallet an und ändert deine bestehende nicht. Er liest sie,
        entnimmt auf Bestätigung einen Float und schreibt den Rest zurück.
      </p>
    </section>
  );
}
