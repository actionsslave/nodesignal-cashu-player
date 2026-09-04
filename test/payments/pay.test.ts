import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDatabase, openDatabase } from '../../src/db/database.js';
import { InsufficientFundsError, type ResolvedPaymentTarget } from '../../src/contracts/index.js';
import { LocalWallet } from '../../src/wallet/local-wallet.js';
import { MintCapabilityError, MintUnreachableError } from '../../src/wallet/mint-gateway.js';
import { NoRelayError } from '../../src/payments/nostr-gateway.js';
import { retryPendingNutzaps, sendNutzap } from '../../src/payments/pay.js';
import { listHistory } from '../../src/wallet/history.js';
import { resetDatabase } from '../helpers/db.js';
import { MINT_A, seedProofs } from '../helpers/proofs.js';
import { fakeGateway } from '../helpers/mint.js';
import { EMPFAENGER_HEX, EMPFAENGER_NPUB, P2PK_PUBKEY, fakeNostr } from '../helpers/nostr.js';
import type { SignedNostrEvent, UnsignedNostrEvent } from '../../src/identity/nip07.js';

const TARGET: ResolvedPaymentTarget = {
  status: 'resolved',
  npub: EMPFAENGER_NPUB,
  pubkeyHex: EMPFAENGER_HEX,
  p2pkPubkey: P2PK_PUBKEY,
  mints: [MINT_A],
  relays: ['wss://r1.example'],
  fetchedAt: 0,
};

const sign = vi.fn(
  async (event: UnsignedNostrEvent): Promise<SignedNostrEvent> => ({
    ...event,
    id: 'signiert',
    pubkey: 'sender',
    sig: 'sig',
  }),
);

function deps(overrides: Partial<Parameters<typeof sendNutzap>[1]> = {}) {
  return {
    wallet: new LocalWallet(),
    mintGateway: fakeGateway(),
    nostr: fakeNostr(),
    signEvent: sign,
    ...overrides,
  } as Parameters<typeof sendNutzap>[1];
}

beforeEach(async () => {
  await resetDatabase();
  sign.mockClear();
});

afterEach(async () => {
  await closeDatabase();
});

describe('FR-29: erfolgreicher Ablauf', () => {
  it('bucht den Betrag ab und meldet die bestätigenden Relays', async () => {
    await seedProofs([64]);
    const d = deps();

    const result = await sendNutzap({ target: TARGET, amount: 10, kind: 'boost' }, d);

    expect(result.status).toBe('gesendet');
    expect(result.acceptedBy).toEqual(['wss://relay-empfaenger.example']);
    await expect(d.wallet.balance()).resolves.toBe(54);
  });

  it('FR-27: publiziert ein kind:9321 mit den gelockten Proofs', async () => {
    await seedProofs([64]);
    const nostr = fakeNostr();
    await sendNutzap({ target: TARGET, amount: 10, kind: 'boost' }, deps({ nostr }));

    const event = nostr.published[0];
    expect(event.kind).toBe(9321);
    expect(event.tags.filter((tag) => tag[0] === 'proof').length).toBeGreaterThan(0);
    expect(event.tags).toContainEqual(['u', MINT_A]);
    expect(event.tags).toContainEqual(['p', EMPFAENGER_HEX]);
  });

  it('FR-27: lockt beim Mint auf den Schlüssel mit 02-Präfix', async () => {
    await seedProofs([64]);
    const mintGateway = fakeGateway();
    const send = vi.spyOn(mintGateway, 'send');

    await sendNutzap({ target: TARGET, amount: 10, kind: 'boost' }, deps({ mintGateway }));

    expect(send.mock.calls[0][3]).toBe(`02${P2PK_PUBKEY}`);
  });

  it('signiert über die Extension', async () => {
    await seedProofs([64]);
    await sendNutzap({ target: TARGET, amount: 10, kind: 'boost' }, deps());
    expect(sign).toHaveBeenCalledTimes(1);
  });

  it('FR-19: schreibt Podcast und Episode in den Verlauf', async () => {
    await seedProofs([64]);
    await sendNutzap(
      {
        target: TARGET,
        amount: 10,
        kind: 'streaming',
        feedTitle: 'Testpodcast',
        episodeTitle: 'Folge 2',
      },
      deps(),
    );

    const [entry] = await listHistory();
    expect(entry).toMatchObject({
      direction: 'out',
      amount: 10,
      kind: 'streaming',
      status: 'gesendet',
      feedTitle: 'Testpodcast',
      episodeTitle: 'Folge 2',
    });
  });

  it('FR-28: übergibt die Nachricht als content', async () => {
    await seedProofs([1024]);
    const nostr = fakeNostr();
    await sendNutzap(
      { target: TARGET, amount: 1000, kind: 'boost', content: 'Starke Folge 00:14:07' },
      deps({ nostr }),
    );
    expect(nostr.published[0].content).toBe('Starke Folge 00:14:07');
  });
});

describe('FR-29: Abbruch vor dem Mint-Swap', () => {
  it('US-06-AC-4: kein erreichbares Relay lässt das Guthaben vollständig stehen', async () => {
    await seedProofs([64]);
    const d = deps({ nostr: fakeNostr({ connectFails: true }) });

    await expect(sendNutzap({ target: TARGET, amount: 10, kind: 'boost' }, d)).rejects.toBeInstanceOf(
      NoRelayError,
    );

    await expect(d.wallet.balance()).resolves.toBe(64);
    expect((await listHistory())[0]).toMatchObject({ status: 'fehlgeschlagen' });
  });

  it('zu wenig Guthaben bricht ab, ohne zu publizieren', async () => {
    await seedProofs([4]);
    const nostr = fakeNostr();

    await expect(
      sendNutzap({ target: TARGET, amount: 10, kind: 'boost' }, deps({ nostr })),
    ).rejects.toBeInstanceOf(InsufficientFundsError);

    expect(nostr.published).toEqual([]);
    expect((await listHistory())[0]).toMatchObject({ status: 'fehlgeschlagen' });
  });

  it('NIP-61: ein Mint ohne NUT-11 bricht ab, bevor geswappt wird', async () => {
    await seedProofs([64]);
    const nostr = fakeNostr();
    const d = deps({ mintGateway: fakeGateway({ ohneP2pk: true }), nostr });

    await expect(
      sendNutzap({ target: TARGET, amount: 10, kind: 'boost' }, d),
    ).rejects.toBeInstanceOf(MintCapabilityError);

    // Ohne durchgesetztes P2PK waere der Nutzap fuer jeden ausgebbar — also
    // gar nicht erst senden. Guthaben vollstaendig zurueck, nichts publiziert.
    await expect(d.wallet.balance()).resolves.toBe(64);
    expect(nostr.published).toEqual([]);
    expect((await listHistory())[0]).toMatchObject({ status: 'fehlgeschlagen' });
  });

  it('ein nicht erreichbarer Mint gibt die reservierten Proofs frei', async () => {
    await seedProofs([64]);
    const d = deps({ mintGateway: fakeGateway({ unreachable: true }) });

    await expect(
      sendNutzap({ target: TARGET, amount: 10, kind: 'boost' }, d),
    ).rejects.toBeInstanceOf(MintUnreachableError);

    await expect(d.wallet.balance()).resolves.toBe(64);
  });
});

describe('FR-29: Abbruch nach dem Mint-Swap', () => {
  it('legt den Nutzap in die Warteschlange, wenn kein Relay bestätigt', async () => {
    await seedProofs([64]);
    const d = deps({ nostr: fakeNostr({ acceptedBy: [] }) });

    const result = await sendNutzap({ target: TARGET, amount: 10, kind: 'boost' }, d);

    expect(result.status).toBe('ausstehend');
    const db = await openDatabase();
    const pending = await db.getAll('pendingNutzaps');
    expect(pending).toHaveLength(1);
    expect(pending[0].event.kind).toBe(9321);
    expect(pending[0].relays).toEqual(['wss://r1.example']);
  });

  it('protokolliert die Zahlung als ausstehend, nicht als gesendet', async () => {
    await seedProofs([64]);
    await sendNutzap(
      { target: TARGET, amount: 10, kind: 'boost' },
      deps({ nostr: fakeNostr({ acceptedBy: [] }) }),
    );
    expect((await listHistory())[0]).toMatchObject({ status: 'ausstehend' });
  });

  it('gibt die gelockten Proofs nicht zurück — sie gehören dem Empfänger', async () => {
    await seedProofs([64]);
    const d = deps({ nostr: fakeNostr({ acceptedBy: [] }) });

    await sendNutzap({ target: TARGET, amount: 10, kind: 'boost' }, d);

    // 64 Sat eingesetzt, 10 Sat gelockt, 54 Sat Wechselgeld zurück.
    await expect(d.wallet.balance()).resolves.toBe(54);
  });
});

describe('FR-29 (Restfall): erneuter Publish-Versuch aus der Warteschlange', () => {
  /** Bringt eine Zahlung in den Zustand nach dem Swap, aber ohne Relay-Bestaetigung. */
  async function nachDemSwapOhneOk() {
    await seedProofs([64]);
    const wallet = new LocalWallet();
    const result = await sendNutzap(
      { target: TARGET, amount: 10, kind: 'boost' },
      deps({ wallet, nostr: fakeNostr({ acceptedBy: [] }) }),
    );
    expect(result.status).toBe('ausstehend');
    return { wallet, historyId: result.historyId };
  }

  it('publiziert erneut und meldet den Verlaufseintrag als gesendet', async () => {
    await nachDemSwapOhneOk();
    const nostr = fakeNostr();

    await expect(retryPendingNutzaps({ nostr })).resolves.toBe(1);

    expect(nostr.published).toHaveLength(1);
    expect(nostr.published[0].kind).toBe(9321);
    expect((await listHistory())[0]).toMatchObject({ status: 'gesendet' });
  });

  it('leert die Warteschlange erst nach der Bestaetigung', async () => {
    await nachDemSwapOhneOk();
    const db = await openDatabase();
    expect(await db.getAll('pendingNutzaps')).toHaveLength(1);

    await retryPendingNutzaps({ nostr: fakeNostr() });

    expect(await db.getAll('pendingNutzaps')).toHaveLength(0);
  });

  it('behaelt den Eintrag und zaehlt die Versuche, solange kein Relay bestaetigt', async () => {
    await nachDemSwapOhneOk();

    await expect(retryPendingNutzaps({ nostr: fakeNostr({ acceptedBy: [] }) })).resolves.toBe(0);

    const db = await openDatabase();
    const [pending] = await db.getAll('pendingNutzaps');
    expect(pending.attempts).toBe(2);
    expect((await listHistory())[0]).toMatchObject({ status: 'ausstehend' });
  });

  it('gibt kein Guthaben zurueck — die Proofs gehoeren dem Empfaenger', async () => {
    const { wallet } = await nachDemSwapOhneOk();

    await retryPendingNutzaps({ nostr: fakeNostr({ acceptedBy: [] }) });
    await expect(wallet.balance()).resolves.toBe(54);

    await retryPendingNutzaps({ nostr: fakeNostr() });
    await expect(wallet.balance()).resolves.toBe(54);
  });

  it('sendet an die Relays des Empfaengers, nicht an eine eigene Liste (NR-02)', async () => {
    await nachDemSwapOhneOk();
    const nostr = fakeNostr();
    const publish = vi.spyOn(nostr, 'publish');

    await retryPendingNutzaps({ nostr });

    expect(publish.mock.calls[0][0]).toEqual(TARGET.relays);
  });
});
