/**
 * NIP-65: Die Wallet eines Nutzers liegt auf *seinen* Relays.
 *
 * Ohne diese Auflösung schriebe der Player die Rückgabe auf eine feste Liste.
 * Liest der Wallet-Client des Nutzers dort nicht mit, ist das zurückgegebene
 * Guthaben für ihn nicht auffindbar — genau der Relay-Verlust, vor dem der
 * Dialog aus SNR-06 warnt, nur von dieser App verursacht.
 */
import { describe, expect, it } from 'vitest';
import { RELAY_LIST_KIND, resolveWalletRelays } from '../../src/nip60/relays.js';
import { fakeNostr } from '../helpers/nostr.js';
import type { SignedNostrEvent } from '../../src/identity/nip07.js';

const PUBKEY = 'a'.repeat(64);
const FALLBACK = ['wss://fallback.example'];

function relayList(tags: string[][]): SignedNostrEvent {
  return {
    id: 'rl',
    kind: RELAY_LIST_KIND,
    created_at: 1,
    tags,
    content: '',
    pubkey: PUBKEY,
    sig: 'sig',
  };
}

async function loese(event?: SignedNostrEvent) {
  return resolveWalletRelays({
    pubkeyHex: PUBKEY,
    gateway: fakeNostr({ event }),
    fallback: FALLBACK,
  });
}

describe('resolveWalletRelays', () => {
  it('nimmt die Relays aus kind:10002', async () => {
    const relays = await loese(
      relayList([
        ['r', 'wss://eins.example'],
        ['r', 'wss://zwei.example'],
      ]),
    );
    expect(relays).toEqual(['wss://eins.example', 'wss://zwei.example']);
  });

  it('lässt reine Lese-Relays draussen — dorthin zu schreiben nützt nichts', async () => {
    const relays = await loese(
      relayList([
        ['r', 'wss://nur-lesen.example', 'read'],
        ['r', 'wss://schreiben.example', 'write'],
        ['r', 'wss://beides.example'],
      ]),
    );
    expect(relays).toEqual(['wss://schreiben.example', 'wss://beides.example']);
  });

  it('fällt auf die Vorgabeliste zurück, wenn es kein kind:10002 gibt', async () => {
    await expect(loese(undefined)).resolves.toEqual(FALLBACK);
  });

  it('fällt zurück, wenn die Liste nur Lese-Relays nennt', async () => {
    await expect(loese(relayList([['r', 'wss://nur-lesen.example', 'read']]))).resolves.toEqual(
      FALLBACK,
    );
  });

  it('verwirft alles, was nicht wss ist (NR-02)', async () => {
    const relays = await loese(
      relayList([
        ['r', 'ws://unverschluesselt.example'],
        ['r', 'https://kein-relay.example'],
        ['r', 'wss://gut.example'],
      ]),
    );
    expect(relays).toEqual(['wss://gut.example']);
  });

  it('entfernt Doppelungen', async () => {
    const relays = await loese(
      relayList([
        ['r', 'wss://eins.example'],
        ['r', 'wss://eins.example', 'write'],
      ]),
    );
    expect(relays).toEqual(['wss://eins.example']);
  });
});
