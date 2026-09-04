/**
 * SFR-08: Der Feed wird zur Bauzeit abgerufen und als JSON ins Bundle gelegt;
 * ein täglicher CI-Lauf baut neu und veröffentlicht.
 *
 * Zur Bauzeit gibt es keine Same-Origin-Policy — damit ist der CORS-Fall, für
 * den `cashu-player` einen Proxy brauchte, für einen einzigen eigenen Podcast
 * vollständig gelöst.
 *
 * Läuft unter Node. Das Parsen selbst steht in `src/feed/snapshot-parse.ts`,
 * weil die Laufzeit denselben Parser braucht (SFR-09) — dieses Modul hier darf
 * nie im Browser landen, es fasst das Dateisystem an.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { FEED_URL, hasPlaceholders } from '../src/config/build-config.js';
import { parseSnapshot, type FeedSnapshot } from '../src/feed/snapshot-parse.js';

const ZIEL = resolve(import.meta.dirname, '..', 'src', 'feed', 'snapshot.json');

async function main(): Promise<void> {
  if (hasPlaceholders()) {
    // Ohne echte Feed-URL gibt es nichts zu holen. Der Build soll trotzdem
    // laufen, damit sich die App vor der Konfiguration entwickeln laesst.
    const leer: FeedSnapshot = {
      title: 'Nodesignal',
      episodes: [],
      fetchedAt: new Date().toISOString(),
    };
    mkdirSync(dirname(ZIEL), { recursive: true });
    writeFileSync(ZIEL, JSON.stringify(leer, null, 2) + '\n');
    process.stdout.write('feed-snapshot: FEED_URL ist ein Platzhalter, leerer Snapshot.\n');
    return;
  }

  const response = await fetch(FEED_URL);
  if (!response.ok) throw new Error(`Feed antwortete mit HTTP ${response.status}.`);
  const snapshot = parseSnapshot(await response.text(), new Date().toISOString());

  mkdirSync(dirname(ZIEL), { recursive: true });
  writeFileSync(ZIEL, JSON.stringify(snapshot, null, 2) + '\n');
  process.stdout.write(
    `feed-snapshot: ${snapshot.episodes.length} Episoden, Stand ${snapshot.fetchedAt}\n`,
  );
}

await main();
