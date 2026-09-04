import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase } from '../../src/db/database.js';
import { fetchNutzapConfig, parseNutzapConfig } from '../../src/payments/nutzap-config.js';
import { resetDatabase } from '../helpers/db.js';
import { EMPFAENGER_HEX, P2PK_PUBKEY, fakeNostr, kind10019 } from '../helpers/nostr.js';

const RELAYS = ['wss://such-relay.example'];

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await closeDatabase();
});

describe('FR-22: kind:10019 laden', () => {
  it('liest Mints, Relays und den P2PK-Pubkey', async () => {
    const gateway = fakeNostr({
      event: kind10019({
        mints: ['https://mint-a.example', 'https://mint-b.example'],
        relays: ['wss://r1.example', 'wss://r2.example'],
      }),
    });

    const config = await fetchNutzapConfig(EMPFAENGER_HEX, { gateway, lookupRelays: RELAYS });

    expect(config?.mints).toEqual(['https://mint-a.example', 'https://mint-b.example']);
    expect(config?.relays).toEqual(['wss://r1.example', 'wss://r2.example']);
    expect(config?.p2pkPubkey).toBe(P2PK_PUBKEY);
  });

  it('fragt genau nach kind:10019 des Empfängers', async () => {
    const gateway = fakeNostr({ event: kind10019() });
    await fetchNutzapConfig(EMPFAENGER_HEX, { gateway, lookupRelays: RELAYS });
    expect(gateway.fetches[0]).toEqual({ kinds: [10019], authors: [EMPFAENGER_HEX] });
  });

  it('US-07-AC-2: liefert nichts, wenn kein kind:10019 auffindbar ist', async () => {
    const gateway = fakeNostr({ event: undefined });
    await expect(
      fetchNutzapConfig(EMPFAENGER_HEX, { gateway, lookupRelays: RELAYS }),
    ).resolves.toBeUndefined();
  });

  it('ignoriert ein kind:10019 ohne P2PK-Pubkey', async () => {
    const event = kind10019();
    event.tags = event.tags.filter((tag) => tag[0] !== 'pubkey');
    const gateway = fakeNostr({ event });
    await expect(
      fetchNutzapConfig(EMPFAENGER_HEX, { gateway, lookupRelays: RELAYS }),
    ).resolves.toBeUndefined();
  });
});

describe('FR-22: 24-Stunden-Cache', () => {
  it('fragt die Relays beim zweiten Mal nicht erneut', async () => {
    const gateway = fakeNostr({ event: kind10019() });
    const now = () => 1_000_000_000;

    await fetchNutzapConfig(EMPFAENGER_HEX, { gateway, lookupRelays: RELAYS, now });
    await fetchNutzapConfig(EMPFAENGER_HEX, { gateway, lookupRelays: RELAYS, now });

    expect(gateway.fetches).toHaveLength(1);
  });

  it('lädt nach Ablauf von 24 Stunden neu — kind:10019 ist replaceable', async () => {
    const gateway = fakeNostr({ event: kind10019() });
    let clock = 1_000_000_000;

    await fetchNutzapConfig(EMPFAENGER_HEX, { gateway, lookupRelays: RELAYS, now: () => clock });
    clock += 24 * 60 * 60 * 1000 + 1;
    await fetchNutzapConfig(EMPFAENGER_HEX, { gateway, lookupRelays: RELAYS, now: () => clock });

    expect(gateway.fetches).toHaveLength(2);
  });

  it('nutzt den Cache noch kurz vor Ablauf', async () => {
    const gateway = fakeNostr({ event: kind10019() });
    let clock = 1_000_000_000;

    await fetchNutzapConfig(EMPFAENGER_HEX, { gateway, lookupRelays: RELAYS, now: () => clock });
    clock += 24 * 60 * 60 * 1000 - 1000;
    await fetchNutzapConfig(EMPFAENGER_HEX, { gateway, lookupRelays: RELAYS, now: () => clock });

    expect(gateway.fetches).toHaveLength(1);
  });
});

describe('NIP-61: Basiseinheiten an den mint-Tags', () => {
  it('liest die Marker als unterstuetzte Einheiten je Mint', () => {
    const event = kind10019();
    event.tags = [
      ['relay', 'wss://r.example'],
      ['mint', 'https://mint-a.example', 'usd', 'sat'],
      ['mint', 'https://mint-b.example', 'usd'],
      ['pubkey', P2PK_PUBKEY],
    ];

    const parsed = parseNutzapConfig(event);

    expect(parsed?.mints).toEqual(['https://mint-a.example', 'https://mint-b.example']);
    expect(parsed?.units).toEqual({
      'https://mint-a.example': ['usd', 'sat'],
      'https://mint-b.example': ['usd'],
    });
  });

  it('laesst einen Mint ohne Marker ohne Eintrag', () => {
    const event = kind10019();
    event.tags = [
      ['mint', 'https://mint-a.example'],
      ['pubkey', P2PK_PUBKEY],
    ];

    // Kein Marker ist keine Absage — NIP-61 nennt sie "additional markers".
    expect(parseNutzapConfig(event)?.units).toEqual({});
  });
});
