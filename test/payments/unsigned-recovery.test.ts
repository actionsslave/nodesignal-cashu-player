/**
 * Der schwerste Fund des Audits: Scheitert die Signatur *nach* dem Swap, waren
 * die gelockten Proofs weg.
 *
 * Der Swap sperrt sie auf den Schlüssel des Empfängers. Ohne das kind:9321
 * erfährt der Empfänger nie davon, und ohne gespeicherte Proofs kann auch
 * dieser Player es nicht nachholen. Das Geld verschwindet still — kein
 * Fehler, kein Log, nur ein Verlaufseintrag „ausstehend", der nie weitergeht.
 *
 * Eine abgelehnte Signaturanfrage ist kein Randfall: Sie passiert bei jedem
 * versehentlichen Klick auf „Ablehnen" in der Extension.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { sendNutzap, retryPendingNutzaps } from '../../src/payments/pay.js';
import { openDatabase } from '../../src/db/database.js';
import { LocalWallet } from '../../src/wallet/local-wallet.js';
import { resetDatabase } from '../helpers/db.js';
import { fakeNostr, kind10019, P2PK_PUBKEY, EMPFAENGER_HEX } from '../helpers/nostr.js';
import { fakeGateway } from '../helpers/mint.js';
import { makeProof } from '../helpers/proofs.js';
import type { ResolvedPaymentTarget } from '../../src/contracts/index.js';

const MINT = 'https://mint-a.example';

const target: ResolvedPaymentTarget = {
  status: 'resolved',
  npub: 'npub1',
  pubkeyHex: EMPFAENGER_HEX,
  p2pkPubkey: P2PK_PUBKEY,
  mints: [MINT],
  relays: ['wss://relay-empfaenger.example'],
  fetchedAt: Date.now(),
};

async function walletMit(betrag: number) {
  const wallet = new LocalWallet({ gateway: fakeGateway() });
  await wallet.addProofs(MINT, [makeProof(betrag, MINT).proof]);
  return wallet;
}

describe('Signatur abgelehnt nach dem Swap', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('hebt die gelockten Proofs auf, statt sie zu verlieren', async () => {
    const wallet = await walletMit(100);
    const ergebnis = await sendNutzap(
      { target, amount: 21, kind: 'boost' },
      {
        wallet,
        mintGateway: fakeGateway(),
        nostr: fakeNostr({ event: kind10019() }),
        signEvent: async () => {
          throw new Error('Nutzer hat abgelehnt');
        },
      },
    );

    expect(ergebnis.status).toBe('ausstehend');

    const db = await openDatabase();
    const offen = await db.getAll('pendingNutzaps');
    expect(offen).toHaveLength(1);
    // Die gelockten Proofs muessen gespeichert sein, sonst ist das Geld weg.
    expect(offen[0].lockedProofs?.length).toBeGreaterThan(0);
    expect(offen[0].event).toBeUndefined();
    expect(offen[0].unsigned).toBeDefined();
  });

  it('holt die Signatur beim naechsten Versuch nach und publiziert', async () => {
    const wallet = await walletMit(100);
    await sendNutzap(
      { target, amount: 21, kind: 'boost' },
      {
        wallet,
        mintGateway: fakeGateway(),
        nostr: fakeNostr({ event: kind10019() }),
        signEvent: async () => {
          throw new Error('Nutzer hat abgelehnt');
        },
      },
    );

    const nostr = fakeNostr({ event: kind10019() });
    const gesendet = await retryPendingNutzaps({
      nostr,
      signEvent: async (event) => ({ ...event, id: 'nachtraeglich', pubkey: 'p', sig: 's' }),
    });

    expect(gesendet).toBe(1);
    expect(nostr.published.map((e) => e.kind)).toEqual([9321]);

    const db = await openDatabase();
    await expect(db.getAll('pendingNutzaps')).resolves.toEqual([]);
    const verlauf = await db.getAll('history');
    expect(verlauf[0].status).toBe('gesendet');
  });

  it('behaelt den Eintrag, wenn die Signatur erneut scheitert', async () => {
    const wallet = await walletMit(100);
    await sendNutzap(
      { target, amount: 21, kind: 'boost' },
      {
        wallet,
        mintGateway: fakeGateway(),
        nostr: fakeNostr({ event: kind10019() }),
        signEvent: async () => {
          throw new Error('abgelehnt');
        },
      },
    );

    const gesendet = await retryPendingNutzaps({
      nostr: fakeNostr({ event: kind10019() }),
      signEvent: async () => {
        throw new Error('wieder abgelehnt');
      },
    });

    expect(gesendet).toBe(0);
    const db = await openDatabase();
    const offen = await db.getAll('pendingNutzaps');
    expect(offen).toHaveLength(1);
    expect(offen[0].attempts).toBe(2);
  });

  it('SFR-32: der Verlauf nennt die Quelle der Zahlung', async () => {
    const wallet = await walletMit(100);
    const nostr = fakeNostr({ event: kind10019() });
    await sendNutzap(
      { target, amount: 21, kind: 'boost', source: 'local' },
      {
        wallet,
        mintGateway: fakeGateway(),
        nostr,
        signEvent: async (event) => ({ ...event, id: 'i', pubkey: 'p', sig: 's' }),
      },
    );

    const db = await openDatabase();
    const verlauf = await db.getAll('history');
    expect(verlauf[0].source).toBe('local');
  });
});
