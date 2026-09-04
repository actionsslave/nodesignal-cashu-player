import type { SignedNostrEvent } from '../../src/identity/nip07.js';
import type { EventFilter, NostrGateway } from '../../src/payments/nostr-gateway.js';

export const EMPFAENGER_HEX = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
export const EMPFAENGER_NPUB = 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6';
export const P2PK_PUBKEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

export function kind10019(options: {
  mints?: string[];
  relays?: string[];
  pubkey?: string;
} = {}): SignedNostrEvent {
  const tags: string[][] = [];
  for (const relay of options.relays ?? ['wss://relay-empfaenger.example']) {
    tags.push(['relay', relay]);
  }
  for (const mint of options.mints ?? ['https://mint-a.example']) {
    tags.push(['mint', mint, 'sat']);
  }
  if (options.pubkey !== null) tags.push(['pubkey', options.pubkey ?? P2PK_PUBKEY]);
  return {
    kind: 10019,
    created_at: 1_700_000_000,
    tags,
    content: '',
    id: 'event-10019',
    pubkey: EMPFAENGER_HEX,
    sig: 'sig',
  };
}

export interface FakeNostrOptions {
  event?: SignedNostrEvent;
  /** Relays, die mit OK antworten. Leer heißt: keines bestätigt (US-06-AC-4). */
  acceptedBy?: string[];
  connectFails?: boolean;
}

export interface FakeNostrGateway extends NostrGateway {
  published: SignedNostrEvent[];
  fetches: EventFilter[];
}

export function fakeNostr(options: FakeNostrOptions = {}): FakeNostrGateway {
  const published: SignedNostrEvent[] = [];
  const fetches: EventFilter[] = [];
  return {
    published,
    fetches,
    async fetchEvent(_relays, filter) {
      fetches.push(filter);
      return options.event;
    },
    async connect(relays) {
      if (options.connectFails) throw new Error('Kein Relay erreichbar');
      return relays;
    },
    async publish(_relays, event) {
      published.push(event);
      const accepted = options.acceptedBy ?? ['wss://relay-empfaenger.example'];
      if (accepted.length === 0) throw new Error('Kein Relay hat das Event bestätigt.');
      return { acceptedBy: accepted };
    },
  };
}
