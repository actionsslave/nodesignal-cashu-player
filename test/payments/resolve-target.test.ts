import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase } from '../../src/db/database.js';
import { resolvePaymentTarget } from '../../src/payments/resolve-target.js';
import { MINT_A } from '../helpers/proofs.js';
import { resetDatabase } from '../helpers/db.js';
import {
  EMPFAENGER_HEX,
  EMPFAENGER_NPUB,
  P2PK_PUBKEY,
  fakeNostr,
  kind10019,
} from '../helpers/nostr.js';

const ERLAUBT = ['https://mint-a.example', 'https://mint-b.example'];

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await closeDatabase();
});

describe('FR-23: Zahlungen deaktivieren mit Grund', () => {
  it('US-07-AC-1: nennt die fehlende nostr-Identität im Feed', async () => {
    const target = await resolvePaymentTarget(undefined, {
      gateway: fakeNostr(),
      allowedMints: ERLAUBT,
    });

    expect(target).toMatchObject({ status: 'unresolved', reason: 'no-npub' });
    expect(target.status === 'unresolved' && target.message).toMatch(/nostr-Identität/i);
  });

  it('behandelt einen unlesbaren npub wie eine fehlende Identität', async () => {
    const target = await resolvePaymentTarget('npub1kaputt', {
      gateway: fakeNostr(),
      allowedMints: ERLAUBT,
    });
    expect(target).toMatchObject({ reason: 'no-npub' });
  });

  it('US-07-AC-2: nennt die fehlende Empfangs-Konfiguration des Podcasts', async () => {
    const target = await resolvePaymentTarget(EMPFAENGER_NPUB, {
      gateway: fakeNostr({ event: undefined }),
      allowedMints: ERLAUBT,
    });

    expect(target).toMatchObject({ status: 'unresolved', reason: 'no-nutzap-config' });
    expect(target.status === 'unresolved' && target.message).toMatch(/Empfangs-Konfiguration/i);
  });

  it('US-07-AC-3: nennt den fehlenden gemeinsamen Mint', async () => {
    const target = await resolvePaymentTarget(EMPFAENGER_NPUB, {
      gateway: fakeNostr({ event: kind10019({ mints: ['https://fremder-mint.example'] }) }),
      allowedMints: ERLAUBT,
    });

    expect(target).toMatchObject({ status: 'unresolved', reason: 'no-common-mint' });
    expect(target.status === 'unresolved' && target.message).toMatch(/Mint/i);
  });

  it('meldet einen Netzfehler als eigenen Grund, nicht als fehlende Konfiguration', async () => {
    const gateway = fakeNostr();
    gateway.fetchEvent = async () => {
      throw new Error('offline');
    };

    const target = await resolvePaymentTarget(EMPFAENGER_NPUB, {
      gateway,
      allowedMints: ERLAUBT,
    });
    expect(target).toMatchObject({ reason: 'lookup-failed' });
  });
});

describe('FR-22: aufgelöstes Ziel', () => {
  it('liefert npub, Pubkey, P2PK-Schlüssel, Mints und Relays', async () => {
    const target = await resolvePaymentTarget(EMPFAENGER_NPUB, {
      gateway: fakeNostr({
        event: kind10019({
          mints: ['https://mint-a.example'],
          relays: ['wss://r1.example'],
        }),
      }),
      allowedMints: ERLAUBT,
    });

    expect(target).toMatchObject({
      status: 'resolved',
      npub: EMPFAENGER_NPUB,
      pubkeyHex: EMPFAENGER_HEX,
      p2pkPubkey: P2PK_PUBKEY,
      mints: ['https://mint-a.example'],
      relays: ['wss://r1.example'],
    });
  });

  it('NR-07: schneidet die Mints mit der eigenen erlaubten Liste', async () => {
    const target = await resolvePaymentTarget(EMPFAENGER_NPUB, {
      gateway: fakeNostr({
        event: kind10019({ mints: ['https://fremder-mint.example', 'https://mint-b.example'] }),
      }),
      allowedMints: ERLAUBT,
    });

    expect(target.status === 'resolved' && target.mints).toEqual(['https://mint-b.example']);
  });

  it('FR-27: behält die Mint-URL exakt so, wie sie im kind:10019 steht', async () => {
    const target = await resolvePaymentTarget(EMPFAENGER_NPUB, {
      gateway: fakeNostr({ event: kind10019({ mints: ['https://Mint-A.example/'] }) }),
      allowedMints: ERLAUBT,
    });

    expect(target.status === 'resolved' && target.mints).toEqual(['https://Mint-A.example/']);
  });
});

describe('NIP-61: nur Mints, die unsere Einheit fuehren', () => {
  it('verwirft einen Mint, der ausschliesslich andere Einheiten fuehrt', async () => {
    const event = kind10019({ mints: [MINT_A] });
    event.tags = event.tags.map((tag) =>
      tag[0] === 'mint' ? ['mint', MINT_A, 'usd'] : tag,
    );

    const target = await resolvePaymentTarget(EMPFAENGER_NPUB, {
      gateway: fakeNostr({ event }),
      allowedMints: [MINT_A],
    });

    expect(target).toMatchObject({ status: 'unresolved', reason: 'no-common-unit' });
  });

  it('nennt die Einheit im Grund, damit der Baustein konkret bleibt', async () => {
    const event = kind10019({ mints: [MINT_A] });
    event.tags = event.tags.map((tag) =>
      tag[0] === 'mint' ? ['mint', MINT_A, 'usd'] : tag,
    );

    const target = await resolvePaymentTarget(EMPFAENGER_NPUB, {
      gateway: fakeNostr({ event }),
      allowedMints: [MINT_A],
    });

    expect(target.status === 'unresolved' && target.message).toContain('Sat');
  });

  it('behaelt einen Mint, der Sat neben anderen Einheiten fuehrt', async () => {
    const event = kind10019({ mints: [MINT_A] });
    event.tags = event.tags.map((tag) =>
      tag[0] === 'mint' ? ['mint', MINT_A, 'usd', 'sat'] : tag,
    );

    const target = await resolvePaymentTarget(EMPFAENGER_NPUB, {
      gateway: fakeNostr({ event }),
      allowedMints: [MINT_A],
    });

    expect(target).toMatchObject({ status: 'resolved', mints: [MINT_A] });
  });

  it('behaelt einen Mint ohne Marker — Schweigen ist keine Absage', async () => {
    const target = await resolvePaymentTarget(EMPFAENGER_NPUB, {
      gateway: fakeNostr({ event: kind10019({ mints: [MINT_A] }) }),
      allowedMints: [MINT_A],
    });

    expect(target).toMatchObject({ status: 'resolved' });
  });
});
