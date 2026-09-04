/**
 * SOQ-03: Schreibt jemand anders an derselben Wallet, während der Float offen ist?
 *
 * Solange ein Float aussteht, liegen Proofs lokal, die in der Wallet als
 * verbraucht gelten. Taucht in dieser Zeit ein fremdes kind:7375 auf, hat ein
 * anderer Client dieselbe Wallet angefasst — und die Rückgabe kann auf einen
 * Konflikt laufen (SFR-19). Die Sitzungszeile sagt deshalb, ob etwas kam.
 *
 * Die eigenen Schreibvorgänge bleiben draussen. Die Entnahme selbst legt ein
 * kind:7375 mit dem Wechselgeld an; ohne diese Ausnahme meldete die App jedes
 * Mal fremde Aktivität, und zwar ihre eigene.
 */
import type { SignedNostrEvent } from '../identity/nip07.js';
import type { NostrGateway } from '../payments/nostr-gateway.js';
import { TOKEN_KIND } from './wallet-event.js';

export interface WatchDeps {
  pubkeyHex: string;
  relays: string[];
  gateway: NostrGateway;
  /** Zeitpunkt der Entnahme in epoch ms. */
  sinceMs: number;
  /** Event-IDs, die diese App selbst geschrieben hat. */
  ownEventIds: string[];
}

export async function foreignWalletEventsSince({
  pubkeyHex,
  relays,
  gateway,
  sinceMs,
  ownEventIds,
}: WatchDeps): Promise<SignedNostrEvent[]> {
  const events = await gateway.fetchEvents(relays, {
    kinds: [TOKEN_KIND],
    authors: [pubkeyHex],
    // nostr zählt in Sekunden, IndexedDB in Millisekunden.
    since: Math.floor(sinceMs / 1000),
  });
  const eigene = new Set(ownEventIds);
  return events.filter((event) => !eigene.has(event.id));
}
