/**
 * NIP-65: Auf welchen Relays die Wallet des Nutzers liegt.
 *
 * Die Wallet-Events gehören dem Nutzer, nicht dieser App. Sie liegen dort, wo
 * er sie hat — und dorthin muss auch die Rückgabe des Floats gehen. Schriebe
 * der Player sie auf eine feste Liste, wäre das zurückgegebene Guthaben für
 * seinen eigenen Wallet-Client womöglich nicht auffindbar.
 *
 * Nur Schreib-Relays zählen: Ein Relay, das der Nutzer bloss liest, nimmt
 * seine Events gar nicht erst an. Und nur wss (NR-02).
 */
import type { NostrGateway } from '../payments/nostr-gateway.js';

export const RELAY_LIST_KIND = 10002;

export interface ResolveWalletRelaysDeps {
  pubkeyHex: string;
  gateway: NostrGateway;
  /** Wenn der Nutzer keine Liste veröffentlicht hat. */
  fallback: readonly string[];
}

/** NIP-65: `["r", url]` ohne Marker heisst lesen und schreiben. */
function istSchreibRelay(tag: string[]): boolean {
  return tag[0] === 'r' && typeof tag[1] === 'string' && (tag[2] === undefined || tag[2] === 'write');
}

export async function resolveWalletRelays({
  pubkeyHex,
  gateway,
  fallback,
}: ResolveWalletRelaysDeps): Promise<string[]> {
  const event = await gateway
    .fetchEvent([...fallback], { kinds: [RELAY_LIST_KIND], authors: [pubkeyHex] })
    .catch(() => undefined);

  const relays = [
    ...new Set(
      (event?.tags ?? [])
        .filter(istSchreibRelay)
        .map((tag) => tag[1])
        .filter((url) => url.startsWith('wss://')),
    ),
  ];

  return relays.length > 0 ? relays : [...fallback];
}
