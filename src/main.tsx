/**
 * Einstiegspunkt.
 *
 * Die Oberfläche aus SFR-05 bis SFR-07 fehlt noch: Sie wartet auf das
 * Design-Handoff. Was darunter liegt — Feed-Snapshot, NIP-60-Auswertung,
 * Float-Planung, Quellenwahl, Zahlungen — ist gebaut und getestet.
 *
 * Diese Seite zeigt so lange den Konfigurationsstand, damit sichtbar ist,
 * was noch fehlt, statt eine leere Seite auszuliefern.
 */
import { render } from 'preact';
import {
  ALLOWED_MINTS,
  DEMO_RELAYS,
  FEED_URL,
  RECIPIENT_NPUB,
  hasPlaceholders,
} from './config/build-config.js';
import snapshot from './feed/snapshot.json';

function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '46rem', margin: '3rem auto', padding: '0 1rem' }}>
      <h1>Nodesignal — Cashu-Player</h1>
      <p>
        Die Oberfläche wartet auf das Design-Handoff. Feed-Snapshot,
        NIP-60-Auswertung, Float-Planung und Quellenwahl sind gebaut und
        getestet.
      </p>

      {hasPlaceholders() && (
        <p style={{ color: '#aa0b56' }}>
          Konfiguration unvollständig: In <code>src/config/build-config.ts</code> stehen noch
          Platzhalter.
        </p>
      )}

      <h2>Stand</h2>
      <dl>
        <dt>Feed</dt>
        <dd>
          <code>{FEED_URL}</code> — {snapshot.episodes.length} Episoden im Snapshot, Stand{' '}
          {snapshot.fetchedAt}
        </dd>
        <dt>Empfänger</dt>
        <dd>
          <code>{RECIPIENT_NPUB}</code>
        </dd>
        <dt>Erlaubte Mints</dt>
        <dd>{ALLOWED_MINTS.join(', ')}</dd>
        <dt>Relays für kind:10019</dt>
        <dd>{DEMO_RELAYS.join(', ')}</dd>
      </dl>
    </main>
  );
}

const root = document.getElementById('app');
if (root) render(<App />, root);
