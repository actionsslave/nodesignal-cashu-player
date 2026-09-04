/**
 * SFR-13, SFR-14: die NIP-60-Wallet des angemeldeten Nutzers lesen.
 *
 * Ausschließlich lesen. SNR-01 verbietet, eine Wallet anzulegen oder das
 * kind:17375 zu ändern — findet sich keines, meldet diese Funktion das und
 * publiziert nichts.
 *
 * Die Zuordnung Event-ID zu Proofs wird lokal gehalten (SFR-14). Ohne sie ließe
 * sich ein abgebrochener Float nicht wiederherstellen: Die Proofs lägen im
 * Browser, aber niemand wüsste, welche kind:7375-Events sie ersetzen — und ein
 * Deletion-Event ohne diese Kenntnis wäre genau das, was SNR-02 verbietet.
 *
 * Der Wallet-Privkey wird zurückgegeben, aber nirgends gespeichert (SNR-03).
 */
import { openDatabase, type TokenEventRecord } from '../db/database.js';
import type { SignedNostrEvent } from '../identity/nip07.js';
import type { NostrGateway } from '../payments/nostr-gateway.js';
import {
  TOKEN_KIND,
  WALLET_KIND,
  balanceByMint,
  parseTokenEvent,
  parseWalletEvent,
  type TokenEventContent,
  type WalletDescriptor,
} from './wallet-event.js';

export interface ReadNip60Deps {
  pubkeyHex: string;
  /** Die Relays des Nutzers — Wallet-Events liegen dort, nicht auf einer eigenen Liste. */
  relays: string[];
  gateway: NostrGateway;
  /** nip44-Entschlüsselung über die Extension (SFR-10). */
  decrypt: (pubkey: string, ciphertext: string) => Promise<string>;
}

export interface Nip60Snapshot {
  /** Undefined heißt: kein kind:17375 gefunden. Die App legt keines an. */
  wallet?: WalletDescriptor;
  /** Die gelesenen Token-Events, für die Float-Planung. */
  tokenEvents: { id: string; content: TokenEventContent }[];
  balanceByMint: Record<string, number>;
  /** Wie viele kind:7375 sich nicht lesen ließen — für die Anzeige. */
  unreadableEvents: number;
}

const LEER: Nip60Snapshot = {
  wallet: undefined,
  tokenEvents: [],
  balanceByMint: {},
  unreadableEvents: 0,
};

export async function readNip60Wallet(deps: ReadNip60Deps): Promise<Nip60Snapshot> {
  const walletEvent = await deps.gateway.fetchEvent(deps.relays, {
    kinds: [WALLET_KIND],
    authors: [deps.pubkeyHex],
  });
  if (!walletEvent) return LEER;

  const wallet = await entschluesseln(walletEvent, deps).then((klartext) =>
    klartext === undefined ? undefined : parseWalletEvent(klartext),
  );
  // Ohne Privkey ist das Guthaben nicht ausgebbar. Es anzuzeigen waere
  // irrefuehrend, also wird gar nicht erst nach Token-Events gefragt.
  if (!wallet) return LEER;

  const rohe = await deps.gateway.fetchEvents(deps.relays, {
    kinds: [TOKEN_KIND],
    authors: [deps.pubkeyHex],
  });

  const tokenEvents: Nip60Snapshot['tokenEvents'] = [];
  let unreadableEvents = 0;

  for (const event of rohe) {
    const klartext = await entschluesseln(event, deps);
    const content = klartext === undefined ? undefined : parseTokenEvent(klartext);
    if (!content) {
      // Ein unlesbares Event darf die ganze Wallet nicht unbrauchbar machen.
      unreadableEvents += 1;
      continue;
    }
    tokenEvents.push({ id: event.id, content });
  }

  await rememberTokenEvents(tokenEvents);

  return {
    wallet,
    tokenEvents,
    balanceByMint: balanceByMint(tokenEvents.map((entry) => entry.content)),
    unreadableEvents,
  };
}

async function entschluesseln(
  event: SignedNostrEvent,
  deps: ReadNip60Deps,
): Promise<string | undefined> {
  try {
    return await deps.decrypt(deps.pubkeyHex, event.content);
  } catch {
    return undefined;
  }
}

/** SFR-14: Welches Event welche Proofs trug — Grundlage der Wiederherstellung. */
async function rememberTokenEvents(events: Nip60Snapshot['tokenEvents']): Promise<void> {
  if (events.length === 0) return;
  const db = await openDatabase();
  const tx = db.transaction('tokenEvents', 'readwrite');
  const readAt = Date.now();
  for (const entry of events) {
    const record: TokenEventRecord = {
      id: entry.id,
      mintUrl: entry.content.mint,
      secrets: entry.content.proofs.map((proof) => String(proof.secret)),
      readAt,
    };
    await tx.store.put(record);
  }
  await tx.done;
}
