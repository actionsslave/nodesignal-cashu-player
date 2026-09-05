import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDatabase, openDatabase } from '../../src/db/database.js';
import { readNip60Wallet } from '../../src/nip60/read.js';
import { resetDatabase } from '../helpers/db.js';
import type { SignedNostrEvent } from '../../src/identity/nip07.js';
import type { EventFilter } from '../../src/payments/nostr-gateway.js';

const PUBKEY = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
const MINT_A = 'https://mint-a.example';
const MINT_B = 'https://mint-b.example';
const PRIVKEY = 'aa'.repeat(32);

/** Der Klartext steht hier im Event; „entschlüsseln" gibt ihn unverändert zurück. */
function event(id: string, kind: number, content: string): SignedNostrEvent {
  return { id, kind, created_at: 1_700_000_000, tags: [], content, pubkey: PUBKEY, sig: 'sig' };
}

const walletEvent = event(
  'w1',
  17375,
  JSON.stringify([
    ['privkey', PRIVKEY],
    ['mint', MINT_A],
  ]),
);

const tokenEvent = (id: string, mint: string, ...amounts: number[]) =>
  event(
    id,
    7375,
    JSON.stringify({
      mint,
      unit: 'sat',
      proofs: amounts.map((amount, i) => ({
        id: '00ad268c4d1f5826',
        amount,
        secret: `${id}-${i}`,
        C: '02aa',
      })),
    }),
  );

function gateway(wallet: SignedNostrEvent | undefined, tokens: SignedNostrEvent[]) {
  return {
    fetchEvent: vi.fn(async (_relays: string[], _filter: EventFilter) => wallet),
    fetchEvents: vi.fn(async (_relays: string[], _filter: EventFilter) => tokens),
    connect: vi.fn(async (relays: string[]) => relays),
    publish: vi.fn(async () => ({ acceptedBy: ['wss://r.example'] })),
  };
}

const decrypt = vi.fn(async (_pubkey: string, ciphertext: string) => ciphertext);

beforeEach(async () => {
  await resetDatabase();
  decrypt.mockClear();
});

afterEach(async () => {
  await closeDatabase();
});

describe('SFR-13: kind:17375 lesen', () => {
  it('liefert Privkey und Mints der Wallet', async () => {
    const result = await readNip60Wallet({
      pubkeyHex: PUBKEY,
      relays: ['wss://r.example'],
      gateway: gateway(walletEvent, []),
      decrypt,
    });

    expect(result.wallet).toEqual({ privkey: PRIVKEY, mints: [MINT_A] });
  });

  it('legt keine Wallet an, wenn es keine gibt', async () => {
    const g = gateway(undefined, []);
    const result = await readNip60Wallet({
      pubkeyHex: PUBKEY,
      relays: ['wss://r.example'],
      gateway: g,
      decrypt,
    });

    // SNR-01: nichts anlegen, nichts publizieren — nur melden.
    expect(result.wallet).toBeUndefined();
    expect(g.publish).not.toHaveBeenCalled();
  });

  it('fragt genau nach kind:17375 des angemeldeten Nutzers', async () => {
    const g = gateway(walletEvent, []);
    await readNip60Wallet({ pubkeyHex: PUBKEY, relays: ['wss://r.example'], gateway: g, decrypt });

    expect(g.fetchEvent.mock.calls[0][1]).toMatchObject({ kinds: [17375], authors: [PUBKEY] });
  });
});

describe('SFR-14: kind:7375 lesen und zuordnen', () => {
  it('summiert das Guthaben je Mint über mehrere Events', async () => {
    const result = await readNip60Wallet({
      pubkeyHex: PUBKEY,
      relays: ['wss://r.example'],
      gateway: gateway(walletEvent, [tokenEvent('t1', MINT_A, 8, 2), tokenEvent('t2', MINT_A, 500)]),
      decrypt,
    });

    expect(result.balanceByMint).toEqual({ [MINT_A]: 510 });
  });

  it('hält die Zuordnung Event-ID zu Proofs lokal', async () => {
    await readNip60Wallet({
      pubkeyHex: PUBKEY,
      relays: ['wss://r.example'],
      gateway: gateway(walletEvent, [tokenEvent('t1', MINT_A, 8, 2)]),
      decrypt,
    });

    // Ohne diese Zuordnung liesse sich ein abgebrochener Float nicht
    // wiederherstellen — die Proofs laegen lokal, ohne Bezug zu ihren Events.
    const db = await openDatabase();
    const gespeichert = await db.get('tokenEvents', 't1');
    expect(gespeichert).toMatchObject({ id: 't1', mintUrl: MINT_A });
    expect(gespeichert?.secrets).toEqual(['t1-0', 't1-1']);
  });

  it('trennt Guthaben nach Mint', async () => {
    const result = await readNip60Wallet({
      pubkeyHex: PUBKEY,
      relays: ['wss://r.example'],
      gateway: gateway(walletEvent, [tokenEvent('t1', MINT_A, 8), tokenEvent('t2', MINT_B, 5)]),
      decrypt,
    });

    expect(result.balanceByMint).toEqual({ [MINT_A]: 8, [MINT_B]: 5 });
  });

  it('überspringt ein Event, das sich nicht entschlüsseln lässt', async () => {
    const kaputt = vi.fn(async (_p: string, c: string) => {
      if (c.includes('t2')) throw new Error('nicht entschlüsselbar');
      return c;
    });

    const result = await readNip60Wallet({
      pubkeyHex: PUBKEY,
      relays: ['wss://r.example'],
      gateway: gateway(walletEvent, [tokenEvent('t1', MINT_A, 8), tokenEvent('t2', MINT_A, 500)]),
      decrypt: kaputt,
    });

    // Ein unlesbares Event darf die ganze Wallet nicht unbrauchbar machen.
    expect(result.balanceByMint).toEqual({ [MINT_A]: 8 });
    expect(result.unreadableEvents).toBe(1);
  });

  it('liefert ohne Wallet-Event auch keine Token-Events', async () => {
    const g = gateway(undefined, [tokenEvent('t1', MINT_A, 8)]);
    const result = await readNip60Wallet({
      pubkeyHex: PUBKEY,
      relays: ['wss://r.example'],
      gateway: g,
      decrypt,
    });

    // Ohne Privkey ist das Guthaben nicht ausgebbar; es anzuzeigen waere irrefuehrend.
    expect(result.balanceByMint).toEqual({});
    expect(g.fetchEvents).not.toHaveBeenCalled();
  });
});

describe('SFR-29: der Grund muss stimmen', () => {
  /*
   * Eine Wallet, die dasteht, sich aber nicht entschluesseln laesst, ist etwas
   * anderes als keine Wallet. Der Satz „Zu deinem npub gibt es kein kind:17375"
   * waere hier schlicht falsch — und schickte den Nutzer auf die Suche nach
   * einem Problem, das er nicht hat.
   */
  it('meldet „keine", wenn kein kind:17375 dasteht', async () => {
    const snapshot = await readNip60Wallet({
      pubkeyHex: PUBKEY,
      relays: ['wss://r.example'],
      gateway: gateway(undefined, []),
      decrypt,
    });
    expect(snapshot.walletStatus).toBe('keine');
  });

  it('meldet „unlesbar", wenn die Entschluesselung scheitert', async () => {
    const snapshot = await readNip60Wallet({
      pubkeyHex: PUBKEY,
      relays: ['wss://r.example'],
      gateway: gateway(walletEvent, []),
      decrypt: async () => {
        throw new Error('Extension hat abgelehnt');
      },
    });
    expect(snapshot.walletStatus).toBe('unlesbar');
    expect(snapshot.wallet).toBeUndefined();
  });

  it('meldet „gefunden" und liest weiter, auch ohne Privkey', async () => {
    const ohnePrivkey = event('w2', 17375, JSON.stringify([['mint', MINT_A]]));
    const snapshot = await readNip60Wallet({
      pubkeyHex: PUBKEY,
      relays: ['wss://r.example'],
      gateway: gateway(ohnePrivkey, [tokenEvent('t1', MINT_A, 100)]),
      decrypt,
    });
    expect(snapshot.walletStatus).toBe('gefunden');
    expect(snapshot.balanceByMint[MINT_A]).toBe(100);
  });
});
