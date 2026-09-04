/**
 * SOQ-03: Hat ein anderer Client die Wallet angefasst, seit der Float offen ist?
 *
 * Die Frage ist nur beantwortbar, wenn die eigenen Schreibvorgänge draussen
 * bleiben: Die Entnahme selbst schreibt ein kind:7375 mit dem Wechselgeld.
 * Ohne diese Ausnahme meldete die App jedes Mal fremde Aktivität — und zwar
 * ihre eigene.
 */
import { describe, expect, it } from 'vitest';
import { foreignWalletEventsSince } from '../../src/nip60/watch.js';
import { TOKEN_KIND } from '../../src/nip60/wallet-event.js';
import { fakeNostr } from '../helpers/nostr.js';
import type { SignedNostrEvent } from '../../src/identity/nip07.js';

const PUBKEY = 'a'.repeat(64);
const RELAYS = ['wss://relay.example'];
const ENTNAHME_MS = 1_700_000_000_000;

function event(id: string, sekunden: number): SignedNostrEvent {
  return {
    id,
    kind: TOKEN_KIND,
    created_at: sekunden,
    tags: [],
    content: 'enc',
    pubkey: PUBKEY,
    sig: 'sig',
  };
}

const seit = Math.floor(ENTNAHME_MS / 1000);

async function frage(events: SignedNostrEvent[], ownEventIds: string[] = []) {
  const gateway = fakeNostr({ events });
  const treffer = await foreignWalletEventsSince({
    pubkeyHex: PUBKEY,
    relays: RELAYS,
    gateway,
    sinceMs: ENTNAHME_MS,
    ownEventIds,
  });
  return { treffer, gateway };
}

describe('foreignWalletEventsSince', () => {
  it('fragt die Relays mit since in Sekunden', async () => {
    const { gateway } = await frage([]);
    expect(gateway.fetches[0]).toMatchObject({ kinds: [TOKEN_KIND], since: seit });
  });

  it('meldet nichts, wenn seit der Entnahme kein Event kam', async () => {
    const { treffer } = await frage([event('alt', seit - 3600)]);
    expect(treffer).toEqual([]);
  });

  it('lässt das eigene Wechselgeld-Event draussen', async () => {
    const { treffer } = await frage([event('eigen', seit + 1)], ['eigen']);
    expect(treffer).toEqual([]);
  });

  it('meldet ein fremdes Event', async () => {
    const { treffer } = await frage([event('eigen', seit + 1), event('fremd', seit + 30)], [
      'eigen',
    ]);
    expect(treffer.map((e) => e.id)).toEqual(['fremd']);
  });
});
